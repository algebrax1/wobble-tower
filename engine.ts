import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Skin, Theme } from "./catalog";
import { BH, BL, BW } from "./layout";
import type { LevelConfig } from "./levels";
import {
  PBlock,
  PhysicsWorld,
  RapierModule,
  GROUP_BLOCK,
  GROUP_FLOOR,
  axisOffset,
  createPhysics,
  driveBlock,
  ghostBlock,
  settlePhysics,
} from "./physics";
import { makeSkinTexture, makeSpecialTexture } from "./textures";
import { sfx, vibrate } from "./audio";

let rapierPromise: Promise<RapierModule> | null = null;
export function loadRapier(): Promise<RapierModule> {
  if (!rapierPromise) {
    rapierPromise = import("@dimforge/rapier3d-compat").then(async (m) => {
      const R = ((m as unknown as { default?: RapierModule }).default ?? (m as unknown as RapierModule)) as RapierModule;
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

export interface TickInfo {
  time: number;
  timeLeft: number | null;
  glue: number;
  tremor: "none" | "warn" | "active";
}

export interface EngineCallbacks {
  onProgress(removed: number): void;
  onFloat(text: string, x: number, y: number, color: string): void;
  onToast(msg: string): void;
  onGold(amount: number): void;
  onWin(info: { seconds: number }): void;
  onFail(reason: "collapse" | "time"): void;
  onTick(info: TickInfo): void;
}

type State = "playing" | "failing" | "failed" | "won";

interface Snapshot {
  blocks: { removed: boolean; p: [number, number, number]; q: [number, number, number, number]; maxS: number }[];
  removedCount: number;
}

const TREMOR_HZ = 3;
const PULL_OUT = 2.35;
const RELEASE_OUT = 1.9;
const VMAX = 7.5;

export class JengaEngine {
  private container: HTMLElement;
  private R: RapierModule;
  private cfg: LevelConfig;
  private cb: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pw: PhysicsWorld;
  private meshes = new Map<PBlock, THREE.Mesh>();
  private meshList: THREE.Mesh[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private table: THREE.Mesh;
  private rim: THREE.Mesh;
  private halo: THREE.Mesh;
  private hintHalo: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private raf = 0;
  private lastT = 0;
  private acc = 0;
  private disposed = false;
  private paused = false;
  private ro: ResizeObserver;

  // camera orbit
  private theta = 0.6;
  private el = 0.3;
  private zoom = 1;
  private baseRadius = 18;
  private camRadius = 26; // animated intro
  private ty = 5;

  // game state
  state: State = "playing";
  private simTime = 0;
  private playTime = 0;
  private armedAt = 0.5;
  private removedCount = 0;
  private failTimer = 0;
  private failAt = 0;
  private winAt = 0;
  private goldPaid = new Set<string>();
  private snapshot: Snapshot | null = null;
  private glueUntil = 0;
  private hintBlock: PBlock | null = null;
  private hintUntil = 0;
  private shake = new Map<THREE.Mesh, number>();
  private camShake = 0;
  private tickAcc = 0;

  // tremor
  private tremorActive = false;
  private tremorT0 = 0;
  private tremorDur = 0;
  private tremorAmp = 0;
  private nextTremorAt = Infinity;
  private tremorWarned = false;

  // input
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { pb: PBlock; ptr0: number; startS: number; target: number; pid: number; lastS: number } | null = null;
  private pinchDist = 0;
  private lastSlideSound = 0;

  // particles
  private pPos: Float32Array;
  private pVel: Float32Array;
  private pCol: Float32Array;
  private pLife: Float32Array;
  private pGeo: THREE.BufferGeometry;
  private pPoints: THREE.Points;
  private pIdx = 0;
  private readonly PN = 260;

  constructor(
    container: HTMLElement,
    R: RapierModule,
    cfg: LevelConfig,
    skin: Skin,
    theme: Theme,
    cb: EngineCallbacks,
  ) {
    this.container = container;
    this.R = R;
    this.cfg = cfg;
    this.cb = cb;

    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 2 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;outline:none;";
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 200);

    // environment for PBR reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.55;
    this.disposables.push(pmrem, envTex);

    // lights
    const hemi = new THREE.HemisphereLight(new THREE.Color(theme.light), new THREE.Color(theme.table), 0.7);
    this.scene.add(hemi);
    const H = cfg.layers * BH;
    const sun = new THREE.DirectionalLight(new THREE.Color(theme.light), 2.3);
    sun.position.set(7, H + 10, 9);
    sun.target.position.set(0, H * 0.4, 0);
    sun.castShadow = true;
    const ms = coarse ? 1024 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    const sc = sun.shadow.camera;
    const ext = Math.max(9, H * 0.75 + 4);
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 1;
    sc.far = H + 50;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target);

    // table
    const tableMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.table), roughness: 0.75, metalness: 0.02 });
    const tableGeo = new THREE.CylinderGeometry(6.6, 6.6, 0.8, 64);
    this.table = new THREE.Mesh(tableGeo, tableMat);
    this.table.position.y = -0.4;
    this.table.receiveShadow = true;
    this.scene.add(this.table);
    const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.rim), roughness: 0.5, metalness: 0.2 });
    const rimGeo = new THREE.TorusGeometry(6.6, 0.12, 12, 80);
    this.rim = new THREE.Mesh(rimGeo, rimMat);
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.y = -0.02;
    this.scene.add(this.rim);
    this.disposables.push(tableMat, tableGeo, rimMat, rimGeo);

    // physics
    this.pw = createPhysics(R, cfg);
    settlePhysics(this.pw, 1.2);

    // block meshes
    const geo = new RoundedBoxGeometry(BL, BH, BW, 3, 0.05);
    this.disposables.push(geo);
    const skinTex = [0, 1, 2].map((v) => makeSkinTexture(skin, v));
    const specials: Partial<Record<string, ReturnType<typeof makeSpecialTexture>>> = {};
    for (const pb of this.pw.blocks) {
      const kind = pb.spec.kind;
      let mat: THREE.MeshStandardMaterial;
      if (kind === "normal") {
        const st = skinTex[(pb.spec.idx + pb.spec.layer) % 3];
        const v = 0.9 + ((pb.spec.layer * 7 + pb.spec.idx * 13) % 10) / 100;
        mat = new THREE.MeshStandardMaterial({
          map: st.map,
          color: new THREE.Color(v, v, v),
          roughness: skin.rough,
          metalness: skin.metal,
          emissive: st.emissive ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
          emissiveMap: st.emissive ?? null,
          emissiveIntensity: skin.glow ?? 0,
        });
      } else {
        const st = (specials[kind] ??= makeSpecialTexture(kind));
        mat = new THREE.MeshStandardMaterial({
          map: st.map,
          roughness: kind === "gold" ? 0.25 : kind === "heavy" ? 0.9 : 0.5,
          metalness: kind === "gold" ? 0.9 : kind === "heavy" ? 0.2 : 0.1,
          emissive: st.emissive ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
          emissiveMap: st.emissive ?? null,
          emissiveIntensity: kind === "bomb" ? 0.45 : 0,
        });
      }
      this.mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.pb = pb;
      this.scene.add(mesh);
      this.meshes.set(pb, mesh);
      this.meshList.push(mesh);
    }
    for (const t of skinTex) {
      this.disposables.push(t.map);
      if (t.emissive) this.disposables.push(t.emissive);
    }
    for (const t of Object.values(specials)) {
      if (!t) continue;
      this.disposables.push(t.map);
      if (t.emissive) this.disposables.push(t.emissive);
    }
    this.disposables.push(...this.mats);

    // halos
    const haloGeo = new THREE.BoxGeometry(BL + 0.14, BH + 0.14, BW + 0.14);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    this.halo = new THREE.Mesh(haloGeo, haloMat);
    this.halo.visible = false;
    this.halo.raycast = () => {};
    const hintMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    this.hintHalo = new THREE.Mesh(haloGeo, hintMat);
    this.hintHalo.visible = false;
    this.hintHalo.raycast = () => {};
    this.scene.add(this.halo, this.hintHalo);
    this.disposables.push(haloGeo, haloMat, hintMat);

    // particles
    this.pPos = new Float32Array(this.PN * 3).fill(-999);
    this.pVel = new Float32Array(this.PN * 3);
    this.pCol = new Float32Array(this.PN * 3);
    this.pLife = new Float32Array(this.PN);
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3));
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sg = sprite.getContext("2d")!;
    const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.4, "rgba(255,255,255,0.7)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    sg.fillStyle = rg;
    sg.fillRect(0, 0, 64, 64);
    const spriteTex = new THREE.CanvasTexture(sprite);
    const pMat = new THREE.PointsMaterial({
      size: 0.4,
      map: spriteTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.pPoints = new THREE.Points(this.pGeo, pMat);
    this.pPoints.frustumCulled = false;
    this.scene.add(this.pPoints);
    this.disposables.push(this.pGeo, pMat, spriteTex);

    // camera framing
    this.ty = H * 0.5;
    this.resize();
    this.camRadius = this.baseRadius * 1.5;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    if (cfg.tremor) this.nextTremorAt = this.armedAt + cfg.tremor.interval * 0.8;

    this.syncMeshes(0);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- public API ----------
  setPaused(p: boolean) {
    this.paused = p;
    this.lastT = performance.now();
  }

  get removed() {
    return this.removedCount;
  }

  hasSnapshot() {
    return this.snapshot !== null;
  }

  usePower(kind: "rewind" | "glue" | "eye"): boolean {
    if (kind === "rewind") {
      if (this.state === "won") return false;
      return this.revive();
    }
    if (this.state !== "playing") return false;
    if (kind === "glue") {
      this.glueUntil = this.simTime + 20;
      this.cb.onToast("🧈 Slick Grip active!");
      return true;
    }
    if (kind === "eye") {
      const b = this.safestBlock();
      if (!b) {
        this.cb.onToast("No safe block found");
        return false;
      }
      this.hintBlock = b;
      this.hintUntil = this.simTime + 10;
      this.cb.onToast("🔮 Pull the glowing block!");
      return true;
    }
    return false;
  }

  revive(): boolean {
    const snap = this.snapshot;
    if (!snap) return false;
    this.endDrag(false);
    snap.blocks.forEach((s, i) => {
      const pb = this.pw.blocks[i];
      pb.body.setEnabled(true);
      pb.collider.setCollisionGroups((GROUP_BLOCK << 16) | (GROUP_BLOCK | GROUP_FLOOR));
      pb.body.lockRotations(false, true);
      pb.body.setLinearDamping(0.08);
      pb.body.setTranslation({ x: s.p[0], y: s.p[1], z: s.p[2] }, true);
      pb.body.setRotation({ x: s.q[0], y: s.q[1], z: s.q[2], w: s.q[3] }, true);
      pb.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pb.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      pb.removed = s.removed;
      pb.maxS = s.maxS;
      const mesh = this.meshes.get(pb)!;
      mesh.visible = !s.removed;
      mesh.scale.setScalar(1);
    });
    this.removedCount = snap.removedCount;
    this.cb.onProgress(this.removedCount);
    this.state = "playing";
    this.failTimer = 0;
    this.winAt = 0;
    this.tremorActive = false;
    this.armedAt = this.simTime + 0.8;
    this.hintBlock = null;
    this.cb.onToast("⏪ Rewound!");
    return true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onDown);
    canvas.removeEventListener("pointermove", this.onMove);
    canvas.removeEventListener("pointerup", this.onUp);
    canvas.removeEventListener("pointercancel", this.onUp);
    canvas.removeEventListener("wheel", this.onWheel);
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.renderer.dispose();
    canvas.remove();
    try {
      this.pw.world.free();
    } catch {
      /* ignore */
    }
  }

  // ---------- camera ----------
  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const H = this.cfg.layers * BH;
    const tanH = Math.tan((this.camera.fov * Math.PI) / 360);
    const rV = (H / 2 + 2.2) / tanH;
    const rW = 4.4 / (tanH * this.camera.aspect);
    this.baseRadius = Math.max(11, rV, rW);
  }

  private updateCamera(dt: number) {
    this.camRadius += (this.baseRadius * this.zoom - this.camRadius) * Math.min(1, dt * 3.2);
    const r = this.camRadius;
    const ce = Math.cos(this.el);
    let sx = 0;
    let sy = 0;
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt);
      sx = (Math.random() - 0.5) * this.camShake * 0.6;
      sy = (Math.random() - 0.5) * this.camShake * 0.6;
    }
    this.camera.position.set(r * ce * Math.sin(this.theta) + sx, this.ty + r * Math.sin(this.el) + sy, r * ce * Math.cos(this.theta));
    this.camera.lookAt(0, this.ty, 0);
  }

  // ---------- input ----------
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = Math.min(1.5, Math.max(0.5, this.zoom * (1 + e.deltaY * 0.001)));
  };

  private pick(cx: number, cy: number): PBlock | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const vis = this.meshList.filter((m) => m.visible && !(m.userData.pb as PBlock).removed);
    const hit = this.raycaster.intersectObjects(vis, false)[0];
    return hit ? (hit.object.userData.pb as PBlock) : null;
  }

  private axisParam(pb: PBlock, cx: number, cy: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const D = this.raycaster.ray.direction;
    const C = this.raycaster.ray.origin;
    const t = pb.body.translation();
    const u = pb.spec.axis;
    const w0x = pb.origin[0] - C.x;
    const w0y = t.y - C.y;
    const w0z = pb.origin[2] - C.z;
    const b = u[0] * D.x + u[1] * D.y + u[2] * D.z;
    const d = u[0] * w0x + u[1] * w0y + u[2] * w0z;
    const e = D.x * w0x + D.y * w0y + D.z * w0z;
    const denom = 1 - b * b;
    if (denom < 0.03) return null;
    return (b * e - d) / denom;
  }

  private onDown = (e: PointerEvent) => {
    const canvas = this.renderer.domElement;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.endDrag(false);
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }
    if (this.pointers.size > 2 || this.paused) return;
    if (this.state !== "playing") return;
    const pb = this.pick(e.clientX, e.clientY);
    if (!pb) return;
    if (pb.spec.kind === "locked") {
      this.denyShake(pb, "🔒 This block is locked");
      return;
    }
    if (pb.spec.layer >= this.cfg.layers - 1) {
      this.denyShake(pb, "Top layer is off-limits");
      return;
    }
    const p0 = this.axisParam(pb, e.clientX, e.clientY);
    if (p0 === null) return;
    this.takeSnapshot();
    pb.touched = true;
    pb.body.lockRotations(true, true);
    if (this.glueUntil > this.simTime) this.applySlick(pb, true);
    const s = axisOffset(pb);
    this.drag = { pb, ptr0: p0, startS: s, target: s, pid: e.pointerId, lastS: s };
    this.halo.visible = true;
    this.meshes.get(pb)!.add(this.halo);
    this.halo.position.set(0, 0, 0);
    if (this.hintBlock === pb) this.hintBlock = null;
    sfx.grab();
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (this.drag && this.drag.pid === e.pointerId) {
      const p = this.axisParam(this.drag.pb, e.clientX, e.clientY);
      if (p !== null) {
        this.drag.target = Math.max(-3.4, Math.min(3.4, this.drag.startS + (p - this.drag.ptr0)));
      }
      return;
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) {
        this.zoom = Math.min(1.5, Math.max(0.5, this.zoom * (this.pinchDist / Math.max(20, dist))));
      }
      this.pinchDist = dist;
      return;
    }
    if (this.pointers.size === 1 && !this.drag) {
      this.theta -= dx * 0.008;
      this.el = Math.min(1.25, Math.max(0.02, this.el + dy * 0.004));
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.drag && this.drag.pid === e.pointerId) this.endDrag(true);
    if (this.pointers.size < 2) this.pinchDist = 0;
  };

  private denyShake(pb: PBlock, msg: string) {
    this.shake.set(this.meshes.get(pb)!, this.simTime + 0.35);
    sfx.deny();
    this.cb.onToast(msg);
  }

  private applySlick(pb: PBlock, on: boolean) {
    const R = this.R;
    if (on) {
      pb.collider.setFriction(0.03);
      pb.collider.setFrictionCombineRule(R.CoefficientCombineRule.Min);
    } else {
      pb.collider.setFriction(pb.baseFriction);
      pb.collider.setFrictionCombineRule(R.CoefficientCombineRule.Average);
    }
  }

  private endDrag(release: boolean) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.halo.visible = false;
    this.meshes.get(d.pb)?.remove(this.halo);
    const pb = d.pb;
    if (pb.removed) return;
    this.applySlick(pb, false);
    pb.body.lockRotations(false, true);
    if (release) {
      const s = axisOffset(pb);
      pb.maxS = Math.max(pb.maxS, Math.abs(s));
      if (Math.abs(s) >= RELEASE_OUT && this.state === "playing") this.finishRemoval(pb);
    }
  }

  // ---------- gameplay ----------
  private takeSnapshot() {
    if (this.state !== "playing") return;
    this.snapshot = {
      blocks: this.pw.blocks.map((pb) => {
        const t = pb.body.translation();
        const r = pb.body.rotation();
        return { removed: pb.removed, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], maxS: pb.maxS };
      }),
      removedCount: this.removedCount,
    };
  }

  private finishRemoval(pb: PBlock) {
    if (pb.removed) return;
    const t = pb.body.translation();
    const dir = Math.sign(axisOffset(pb)) || 1;
    ghostBlock(pb);
    pb.removedAt = this.simTime;
    pb.body.setLinvel({ x: pb.spec.axis[0] * dir * 2.5, y: 1.5, z: pb.spec.axis[2] * dir * 2.5 }, true);
    if (this.drag?.pb === pb) {
      this.drag = null;
      this.halo.visible = false;
      this.meshes.get(pb)?.remove(this.halo);
      this.applySlick(pb, false);
    }
    this.removedCount++;
    this.cb.onProgress(this.removedCount);
    if (this.hintBlock === pb) this.hintBlock = null;

    const kind = pb.spec.kind;
    const screen = this.toScreen(t.x, t.y + 0.4, t.z);
    if (kind === "gold") {
      if (!this.goldPaid.has(pb.spec.id)) {
        this.goldPaid.add(pb.spec.id);
        const amt = 15 + Math.floor(Math.sqrt(this.cfg.level) * 1.2);
        this.cb.onGold(amt);
        this.cb.onFloat(`+${amt} 🪙`, screen.x, screen.y, "#ffd23f");
        sfx.coin();
      }
      this.burst(t.x, t.y, t.z, [1, 0.8, 0.2], 36, 5);
    } else if (kind === "bomb") {
      this.cb.onFloat("💥 BOOM!", screen.x, screen.y, "#ff5555");
      this.burst(t.x, t.y, t.z, [1, 0.35, 0.15], 60, 8);
      sfx.bomb();
      this.camShake = 0.6;
      this.startTremor(0.07, 0.9);
    } else {
      this.burst(t.x, t.y, t.z, [1, 1, 1], 16, 3.5);
      this.cb.onFloat("+1", screen.x, screen.y, "#ffffff");
    }
    sfx.pop();
    if (this.removedCount >= this.cfg.goal && this.winAt === 0) this.winAt = this.simTime + 1.0;
  }

  private startTremor(amp: number, dur: number) {
    this.tremorActive = true;
    this.tremorT0 = this.simTime;
    this.tremorDur = dur;
    this.tremorAmp = amp;
  }

  private safestBlock(): PBlock | null {
    const counts = new Array(this.cfg.layers).fill(0);
    for (const pb of this.pw.blocks) if (!pb.removed) counts[pb.spec.layer]++;
    let best: PBlock | null = null;
    let bestScore = -1e9;
    for (const pb of this.pw.blocks) {
      if (pb.removed) continue;
      const l = pb.spec.layer;
      if (pb.spec.kind === "locked" || pb.spec.kind === "bomb") continue;
      if (l < 1 || l >= this.cfg.layers - 1) continue;
      if (counts[l] < 3) continue;
      const below = counts[l - 1] ?? 3;
      const above = counts[l + 1] ?? 3;
      let sc = (this.cfg.layers - l) * 1.0;
      sc += pb.spec.idx === 1 ? 2.5 : 0;
      sc += below === 3 ? 2 : -4;
      sc += above === 3 ? 2 : -3;
      if (pb.spec.kind === "heavy") sc -= 2;
      if (pb.spec.kind === "gold") sc += 0.8;
      sc -= pb.maxS * 2;
      if (sc > bestScore) {
        bestScore = sc;
        best = pb;
      }
    }
    return best;
  }

  private toScreen(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }

  private burst(x: number, y: number, z: number, c: [number, number, number], n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const k = this.pIdx++ % this.PN;
      this.pPos[k * 3] = x;
      this.pPos[k * 3 + 1] = y;
      this.pPos[k * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 0.6;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pVel[k * 3] = Math.cos(a) * s * (1 - Math.abs(u) * 0.3);
      this.pVel[k * 3 + 1] = u * s + 1.5;
      this.pVel[k * 3 + 2] = Math.sin(a) * s * (1 - Math.abs(u) * 0.3);
      const m = 0.6 + Math.random() * 0.4;
      this.pCol[k * 3] = c[0] * m;
      this.pCol[k * 3 + 1] = c[1] * m;
      this.pCol[k * 3 + 2] = c[2] * m;
      this.pLife[k] = 0.7 + Math.random() * 0.6;
    }
  }

  private updateParticles(dt: number) {
    for (let k = 0; k < this.PN; k++) {
      if (this.pLife[k] <= 0) continue;
      this.pLife[k] -= dt;
      if (this.pLife[k] <= 0) {
        this.pPos[k * 3 + 1] = -999;
        continue;
      }
      this.pVel[k * 3 + 1] -= 9 * dt;
      this.pPos[k * 3] += this.pVel[k * 3] * dt;
      this.pPos[k * 3 + 1] += this.pVel[k * 3 + 1] * dt;
      this.pPos[k * 3 + 2] += this.pVel[k * 3 + 2] * dt;
      const f = Math.min(1, this.pLife[k] * 1.5);
      this.pCol[k * 3] *= 1 - (1 - f) * 0.08;
      this.pCol[k * 3 + 1] *= 1 - (1 - f) * 0.08;
      this.pCol[k * 3 + 2] *= 1 - (1 - f) * 0.08;
    }
    (this.pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.pGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  private checkFail(dt: number) {
    if (this.simTime < this.armedAt || this.state !== "playing") return;
    const bad: PBlock[] = [];
    for (const pb of this.pw.blocks) {
      if (pb.removed || this.drag?.pb === pb) continue;
      const t = pb.body.translation();
      const r = pb.body.rotation();
      const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
      const dy = pb.origin[1] - t.y;
      const dx = t.x - pb.origin[0];
      const dz = t.z - pb.origin[2];
      const ax = pb.spec.axis[0];
      const az = pb.spec.axis[2];
      const along = dx * ax + dz * az;
      const perp = Math.hypot(dx - along * ax, dz - along * az);
      const partial = pb.maxS > 0.25;
      if (dy > 0.7 * BH || upY < 0.8 || perp > 1.1 || (!partial && Math.abs(along) > 1.3) || (partial && Math.abs(along) > 3.4)) {
        bad.push(pb);
      }
    }
    if (bad.length === 1 && bad[0].maxS > 1.0 && bad[0].spec.kind !== "locked") {
      // a block that was pulled far out simply slid out the rest of the way
      this.finishRemoval(bad[0]);
      return;
    }
    if (bad.length > 0) {
      this.failTimer += dt;
      if (this.failTimer > 0.22) this.triggerFail("collapse");
    } else {
      this.failTimer = Math.max(0, this.failTimer - dt * 2);
    }
  }

  private triggerFail(reason: "collapse" | "time") {
    if (this.state !== "playing") return;
    this.state = "failing";
    this.endDrag(false);
    this.failAt = this.simTime + (reason === "collapse" ? 1.5 : 0.2);
    this.failReason = reason;
    if (reason === "collapse") {
      sfx.crash();
      this.camShake = 0.8;
    }
  }
  private failReason: "collapse" | "time" = "collapse";

  // ---------- main loop ----------
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.step(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number) {
    const SUB = 1 / 120;
    this.acc += dt;
    let n = 0;
    while (this.acc >= SUB && n < 5) {
      this.acc -= SUB;
      n++;
      this.simTime += SUB;
      this.updateTremor();
      if (this.drag) driveBlock(this.drag.pb, this.drag.target, VMAX);
      this.pw.world.step();
    }
    if (this.acc > SUB * 5) this.acc = 0;

    // drag completion + slide sound
    if (this.drag && this.state === "playing") {
      const s = axisOffset(this.drag.pb);
      const v = Math.abs(s - this.drag.lastS) / Math.max(dt, 0.001);
      this.drag.lastS = s;
      this.drag.pb.maxS = Math.max(this.drag.pb.maxS, Math.abs(s));
      if (v > 0.6 && this.simTime - this.lastSlideSound > 0.11) {
        this.lastSlideSound = this.simTime;
        sfx.slide(v / 4);
      }
      if (Math.abs(s) >= PULL_OUT) this.finishRemoval(this.drag.pb);
    }

    if (this.state === "playing") {
      if (this.simTime >= this.armedAt) this.playTime += dt;
      this.checkFail(dt);
      if (this.cfg.timeLimit && this.playTime >= this.cfg.timeLimit) this.triggerFail("time");
      if (this.winAt > 0 && this.simTime >= this.winAt && this.failTimer < 0.01 && !this.drag) {
        this.state = "won";
        sfx.win();
        this.camShake = 0.2;
        const H = this.cfg.layers * BH;
        for (let i = 0; i < 5; i++) {
          this.burst((Math.random() - 0.5) * 4, H + 1, (Math.random() - 0.5) * 4, [Math.random(), Math.random(), Math.random()].map((v) => 0.4 + v * 0.6) as [number, number, number], 30, 6);
        }
        this.cb.onWin({ seconds: this.playTime });
      }
    } else if (this.state === "failing" && this.simTime >= this.failAt) {
      this.state = "failed";
      this.cb.onFail(this.failReason);
    }

    // ghost block cleanup
    for (const pb of this.pw.blocks) {
      if (!pb.removed) continue;
      const mesh = this.meshes.get(pb)!;
      if (!mesh.visible) continue;
      const age = this.simTime - pb.removedAt;
      if (age > 1.3) {
        const f = 1 - (age - 1.3) / 0.4;
        if (f <= 0) {
          mesh.visible = false;
          pb.body.setEnabled(false);
        } else mesh.scale.setScalar(f);
      }
    }

    // glue expiry
    if (this.glueUntil > 0 && this.simTime > this.glueUntil) this.glueUntil = 0;
    if (this.hintBlock && this.simTime > this.hintUntil) this.hintBlock = null;

    this.syncMeshes(dt);
    this.updateParticles(dt);

    this.tickAcc += dt;
    if (this.tickAcc > 0.25) {
      this.tickAcc = 0;
      const cfg = this.cfg;
      const toNext = this.nextTremorAt - this.simTime;
      this.cb.onTick({
        time: this.playTime,
        timeLeft: cfg.timeLimit ? Math.max(0, cfg.timeLimit - this.playTime) : null,
        glue: this.glueUntil > 0 ? Math.max(0, this.glueUntil - this.simTime) : 0,
        tremor: this.tremorActive ? "active" : cfg.tremor && toNext < 1.6 && this.state === "playing" ? "warn" : "none",
      });
    }
  }

  private updateTremor() {
    const cfg = this.cfg;
    if (cfg.tremor && !this.tremorActive && this.state === "playing") {
      if (!this.tremorWarned && this.simTime >= this.nextTremorAt - 1.6) {
        this.tremorWarned = true;
        sfx.tremorWarn();
      }
      if (this.simTime >= this.nextTremorAt) {
        this.tremorWarned = false;
        this.startTremor(cfg.tremor.strength, cfg.tremor.duration);
        this.nextTremorAt = this.simTime + cfg.tremor.interval;
        sfx.tremor();
        this.camShake = Math.max(this.camShake, 0.35);
      }
    }
    let ox = 0;
    let oz = 0;
    if (this.tremorActive) {
      const p = (this.simTime - this.tremorT0) / this.tremorDur;
      if (p >= 1) this.tremorActive = false;
      else {
        const env = Math.sin(Math.PI * p);
        const ph = 2 * Math.PI * TREMOR_HZ * (this.simTime - this.tremorT0);
        ox = this.tremorAmp * env * Math.sin(ph);
        oz = this.tremorAmp * env * 0.6 * Math.cos(ph * 0.9);
      }
    }
    this.pw.floor.setNextKinematicTranslation({ x: ox, y: -0.5, z: oz });
    this.table.position.x = ox;
    this.table.position.z = oz;
    this.rim.position.x = ox;
    this.rim.position.z = oz;
  }

  private syncMeshes(_dt: number) {
    const pulse = 0.5 + 0.5 * Math.sin(this.simTime * 6);
    for (const pb of this.pw.blocks) {
      const mesh = this.meshes.get(pb)!;
      if (!mesh.visible) continue;
      const t = pb.body.translation();
      const r = pb.body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
      const sk = this.shake.get(mesh);
      if (sk !== undefined) {
        if (this.simTime > sk) this.shake.delete(mesh);
        else mesh.position.x += Math.sin(this.simTime * 90) * 0.04 * (sk - this.simTime) * 3;
      }
    }
    if (this.hintBlock) {
      const m = this.meshes.get(this.hintBlock)!;
      if (this.hintHalo.parent !== m) m.add(this.hintHalo);
      this.hintHalo.visible = true;
      (this.hintHalo.material as THREE.MeshBasicMaterial).opacity = 0.25 + pulse * 0.5;
    } else if (this.hintHalo.visible) {
      this.hintHalo.visible = false;
      this.hintHalo.parent?.remove(this.hintHalo);
    }
  }
}
