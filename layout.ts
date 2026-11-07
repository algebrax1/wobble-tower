import { BlockKind, LevelConfig, mulberry32 } from "./levels";

// Block dimensions (Jenga proportions 3 : 1 : 0.6)
export const BL = 3.0; // length
export const BW = 0.95; // width (slightly under 1 so blocks have a gap)
export const BH = 0.6; // height
export const PITCH = 1.0;
export const GRAVITY = -32;

export interface BlockSpec {
  id: string;
  layer: number;
  idx: number;
  kind: BlockKind;
  pos: [number, number, number];
  yaw: number;
  axis: [number, number, number]; // world long axis (unit)
}

export function buildLayout(cfg: LevelConfig): BlockSpec[] {
  const rng = mulberry32(cfg.seed ^ 0xa5a5a5a5);
  const holes = new Set(cfg.holes);
  const out: BlockSpec[] = [];
  for (let l = 0; l < cfg.layers; l++) {
    const alongX = l % 2 === 0;
    const layerYaw = cfg.twist * l;
    const y = (l + 0.5) * BH + l * 0.004 + 0.002;
    for (let i = 0; i < 3; i++) {
      const k = `${l}:${i}`;
      if (holes.has(k)) continue;
      const off = (i - 1) * PITCH + (rng() * 2 - 1) * cfg.jitterPos;
      const along = (rng() * 2 - 1) * cfg.jitterPos;
      let x = alongX ? along : off;
      let z = alongX ? off : along;
      // rotate about tower centre by layer twist
      const c = Math.cos(layerYaw);
      const s = Math.sin(layerYaw);
      const rx = x * c + z * s;
      const rz = -x * s + z * c;
      x = rx;
      z = rz;
      const yawJ = (rng() * 2 - 1) * cfg.jitterYaw;
      // yaw such that local +X maps to world long axis
      const baseYaw = alongX ? 0 : Math.PI / 2;
      const yaw = baseYaw + layerYaw + yawJ;
      // three.js / rapier rotation about +Y by angle a maps local X -> (cos a, 0, -sin a)
      const axis: [number, number, number] = [Math.cos(yaw), 0, -Math.sin(yaw)];
      out.push({
        id: `${l}-${i}`,
        layer: l,
        idx: i,
        kind: cfg.kinds[k] ?? "normal",
        pos: [x, y, z],
        yaw,
        axis,
      });
    }
  }
  return out;
}
