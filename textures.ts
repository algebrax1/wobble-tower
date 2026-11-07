import * as THREE from "three";
import type { Skin } from "./catalog";
import type { BlockKind } from "./levels";
import { mulberry32 } from "./levels";

const W = 256;
const H = 128;

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grainLines(g: CanvasRenderingContext2D, rng: () => number, color: string, count: number, alpha: number) {
  g.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const y = rng() * H;
    g.globalAlpha = alpha * (0.4 + rng() * 0.8);
    g.lineWidth = 0.6 + rng() * 1.8;
    g.beginPath();
    g.moveTo(0, y);
    const wob = 2 + rng() * 5;
    g.bezierCurveTo(W * 0.3, y + (rng() - 0.5) * wob, W * 0.6, y + (rng() - 0.5) * wob, W, y + (rng() - 0.5) * wob);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export interface SkinTex {
  map: THREE.CanvasTexture;
  emissive?: THREE.CanvasTexture;
}

export function makeSkinTexture(skin: Skin, variant: number): SkinTex {
  const rng = mulberry32(variant * 7919 + skin.id.length * 131 + skin.cost);
  const c = canvas();
  const g = c.getContext("2d")!;
  let emissive: THREE.CanvasTexture | undefined;

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, skin.c1);
  grad.addColorStop(1, skin.c3);

  switch (skin.style) {
    case "wood": {
      g.fillStyle = skin.c1;
      g.fillRect(0, 0, W, H);
      g.fillStyle = grad;
      g.globalAlpha = 0.35;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      grainLines(g, rng, skin.c2, 38, 0.35);
      grainLines(g, rng, skin.c3, 16, 0.4);
      // knot
      if (rng() < 0.6) {
        const kx = 30 + rng() * 190;
        const ky = 20 + rng() * 88;
        for (let r = 12; r > 1; r -= 3) {
          g.strokeStyle = skin.c2;
          g.globalAlpha = 0.25;
          g.beginPath();
          g.ellipse(kx, ky, r * 1.8, r * 0.8, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      break;
    }
    case "marble": {
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = skin.c2;
      for (let i = 0; i < 9; i++) {
        g.globalAlpha = 0.15 + rng() * 0.45;
        g.lineWidth = 0.5 + rng() * 2.2;
        g.beginPath();
        let x = rng() * W;
        let y = 0;
        g.moveTo(x, y);
        while (y < H) {
          x += (rng() - 0.5) * 50;
          y += 10 + rng() * 20;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    }
    case "candy": {
      g.fillStyle = skin.c2;
      g.fillRect(0, 0, W, H);
      g.fillStyle = skin.c1;
      const stripe = 34;
      for (let x = -H; x < W + H; x += stripe * 2) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + stripe, 0);
        g.lineTo(x + stripe - H * 0.6, H);
        g.lineTo(x - H * 0.6, H);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(0, 0, W, H * 0.3);
      break;
    }
    case "neon": {
      g.fillStyle = skin.c1;
      g.fillRect(0, 0, W, H);
      const e = canvas();
      const eg = e.getContext("2d")!;
      eg.fillStyle = "#000";
      eg.fillRect(0, 0, W, H);
      for (const [col, off] of [
        [skin.c2, 10],
        [skin.c3, 22],
      ] as const) {
        for (const ctx of [g, eg]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.shadowColor = col;
          ctx.shadowBlur = 10;
          ctx.strokeRect(off, off, W - off * 2, H - off * 2);
        }
      }
      for (let x = 40; x < W - 20; x += 36) {
        for (const ctx of [g, eg]) {
          ctx.strokeStyle = skin.c2;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(x, 30);
          ctx.lineTo(x, H - 30);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      emissive = tex(e);
      break;
    }
    case "ice": {
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#ffffff";
      for (let i = 0; i < 40; i++) {
        g.globalAlpha = 0.1 + rng() * 0.4;
        g.lineWidth = 0.6;
        g.beginPath();
        const x = rng() * W;
        const y = rng() * H;
        g.moveTo(x, y);
        g.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 40);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    }
    case "metal": {
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      grainLines(g, rng, skin.c2, 60, 0.18);
      grainLines(g, rng, skin.c3, 40, 0.3);
      break;
    }
    case "galaxy": {
      g.fillStyle = skin.c1;
      g.fillRect(0, 0, W, H);
      const e = canvas();
      const eg = e.getContext("2d")!;
      eg.fillStyle = "#000";
      eg.fillRect(0, 0, W, H);
      for (let i = 0; i < 5; i++) {
        const x = rng() * W;
        const y = rng() * H;
        const r = 40 + rng() * 60;
        for (const ctx of [g, eg]) {
          const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, i % 2 ? skin.c2 : skin.c3);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
      for (let i = 0; i < 70; i++) {
        const x = rng() * W;
        const y = rng() * H;
        const r = rng() * 1.5 + 0.4;
        for (const ctx of [g, eg]) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      emissive = tex(e);
      break;
    }
    case "lava": {
      g.fillStyle = skin.c1;
      g.fillRect(0, 0, W, H);
      const e = canvas();
      const eg = e.getContext("2d")!;
      eg.fillStyle = "#000";
      eg.fillRect(0, 0, W, H);
      for (let i = 0; i < 7; i++) {
        let x = rng() * W;
        let y = rng() * H;
        for (const ctx of [g, eg]) {
          ctx.strokeStyle = i % 2 ? skin.c2 : skin.c3;
          ctx.lineWidth = 1.5 + rng() * 2.5;
          ctx.shadowColor = skin.c2;
          ctx.shadowBlur = 8;
        }
        const pts: [number, number][] = [[x, y]];
        for (let k = 0; k < 6; k++) {
          x += (rng() - 0.3) * 60;
          y += (rng() - 0.5) * 50;
          pts.push([x, y]);
        }
        for (const ctx of [g, eg]) {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (const p of pts) ctx.lineTo(p[0], p[1]);
          ctx.stroke();
        }
      }
      emissive = tex(e);
      break;
    }
    case "rainbow": {
      const lg = g.createLinearGradient(0, 0, W, 0);
      const off = rng();
      for (let i = 0; i <= 6; i++) lg.addColorStop(i / 6, `hsl(${((i / 6 + off) * 360) % 360},90%,60%)`);
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,0.2)";
      g.fillRect(0, 0, W, H * 0.35);
      break;
    }
  }
  // soft edge shading for depth
  g.shadowBlur = 0;
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, "rgba(255,255,255,0.12)");
  edge.addColorStop(0.5, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.14)");
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  return { map: tex(c), emissive };
}

export function makeSpecialTexture(kind: BlockKind): { map: THREE.CanvasTexture; emissive?: THREE.CanvasTexture } {
  const c = canvas();
  const g = c.getContext("2d")!;
  const rng = mulberry32(kind.length * 977);
  if (kind === "gold") {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#ffe27a");
    grad.addColorStop(0.5, "#ffb81c");
    grad.addColorStop(1, "#ffe9a0");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    grainLines(g, rng, "#fff6c2", 40, 0.35);
    g.font = "bold 70px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(160,100,0,0.55)";
    g.fillText("★", W / 2, H / 2 + 4);
  } else if (kind === "heavy") {
    g.fillStyle = "#6b7280";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${rng() < 0.5 ? "255,255,255" : "0,0,0"},${0.05 + rng() * 0.12})`;
      g.fillRect(rng() * W, rng() * H, 2 + rng() * 5, 2 + rng() * 5);
    }
    g.strokeStyle = "rgba(20,20,30,0.7)";
    g.lineWidth = 8;
    g.strokeRect(4, 4, W - 8, H - 8);
    g.font = "bold 60px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(15,15,25,0.65)";
    g.fillText("⛰", W / 2, H / 2 + 4);
  } else if (kind === "locked") {
    g.fillStyle = "#3b1d1d";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffcc00";
    for (let x = -H; x < W + H; x += 44) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 22, 0);
      g.lineTo(x + 22 - H, H);
      g.lineTo(x - H, H);
      g.fill();
    }
    g.fillStyle = "rgba(20,10,10,0.82)";
    g.fillRect(W / 2 - 52, 14, 104, H - 28);
    g.font = "bold 66px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText("🔒", W / 2, H / 2 + 4);
  } else if (kind === "bomb") {
    g.fillStyle = "#c81e1e";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 14, H);
    g.fillStyle = "#fff";
    g.fillRect(W / 2 - 62, 26, 124, H - 52);
    g.font = "900 56px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#c81e1e";
    g.fillText("TNT", W / 2, H / 2 + 3);
    const e = canvas();
    const eg = e.getContext("2d")!;
    eg.fillStyle = "#000";
    eg.fillRect(0, 0, W, H);
    eg.fillStyle = "#ff3030";
    eg.fillRect(W / 2 - 62, 26, 124, H - 52);
    return { map: tex(c), emissive: tex(e) };
  } else {
    g.fillStyle = "#ddd";
    g.fillRect(0, 0, W, H);
  }
  return { map: tex(c) };
}
