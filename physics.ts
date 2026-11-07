import type RAPIERNS from "@dimforge/rapier3d-compat";
import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import { BH, BL, BW, BlockSpec, GRAVITY, buildLayout } from "./layout";
import type { LevelConfig } from "./levels";

export type RapierModule = typeof RAPIERNS;

export const GROUP_BLOCK = 0x0001;
export const GROUP_FLOOR = 0x0002;
export const GROUP_GHOST = 0x0004; // removed blocks: only collide with floor

export interface PBlock {
  spec: BlockSpec;
  body: RigidBody;
  collider: Collider;
  removed: boolean;
  maxS: number;
  touched: boolean;
  removedAt: number;
  baseFriction: number;
  origin: [number, number, number]; // settled rest position
}

export interface PhysicsWorld {
  R: RapierModule;
  world: World;
  floor: RigidBody;
  blocks: PBlock[];
  cfg: LevelConfig;
}

const SUBSTEP = 1 / 120;

export function createPhysics(R: RapierModule, cfg: LevelConfig): PhysicsWorld {
  const world = new R.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = SUBSTEP;
  world.integrationParameters.numSolverIterations = 10;

  const floorBody = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -0.5, 0));
  world.createCollider(
    R.ColliderDesc.cuboid(6.2, 0.5, 6.2)
      .setFriction(0.8)
      .setRestitution(0)
      .setCollisionGroups((GROUP_FLOOR << 16) | (GROUP_BLOCK | GROUP_GHOST)),
    floorBody,
  );

  const specs = buildLayout(cfg);
  const blocks: PBlock[] = specs.map((spec) => {
    const heavy = spec.kind === "heavy";
    const q = { x: 0, y: Math.sin(spec.yaw / 2), z: 0, w: Math.cos(spec.yaw / 2) };
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(spec.pos[0], spec.pos[1], spec.pos[2])
        .setRotation(q)
        .setLinearDamping(0.08)
        .setAngularDamping(0.6)
        .setCanSleep(true),
    );
    const friction = heavy ? Math.min(0.95, cfg.friction * 1.4) : cfg.friction;
    const collider = world.createCollider(
      R.ColliderDesc.cuboid(BL / 2, BH / 2, BW / 2)
        .setFriction(friction)
        .setRestitution(0)
        .setDensity(heavy ? 1.5 : 1)
        .setCollisionGroups((GROUP_BLOCK << 16) | (GROUP_BLOCK | GROUP_FLOOR)),
      body,
    );
    return { spec, body, collider, removed: false, maxS: 0, touched: false, removedAt: 0, baseFriction: friction, origin: [spec.pos[0], spec.pos[1], spec.pos[2]] };
  });

  return { R, world, floor: floorBody, blocks, cfg };
}

export function stepPhysics(pw: PhysicsWorld, dt: number) {
  const n = Math.max(1, Math.min(4, Math.round(dt / SUBSTEP)));
  for (let i = 0; i < n; i++) pw.world.step();
}

/** distance of block along its original pull axis relative to its original position */
export function axisOffset(pb: PBlock): number {
  const t = pb.body.translation();
  const s = pb.spec;
  return (t.x - pb.origin[0]) * s.axis[0] + (t.z - pb.origin[2]) * s.axis[2];
}

/** Velocity-drive a block along its axis toward targetS (used by the player drag). */
export function driveBlock(pb: PBlock, targetS: number, vmax = 9) {
  const t = pb.body.translation();
  const v = pb.body.linvel();
  const s = pb.spec;
  const rx = t.x - pb.origin[0];
  const rz = t.z - pb.origin[2];
  const along = rx * s.axis[0] + rz * s.axis[2];
  const px = rx - along * s.axis[0];
  const pz = rz - along * s.axis[2];
  let vs = (targetS - along) * 14;
  vs = Math.max(-vmax, Math.min(vmax, vs));
  pb.body.setLinvel({ x: s.axis[0] * vs - px * 10, y: v.y, z: s.axis[2] * vs - pz * 10 }, true);
  pb.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

export function ghostBlock(pb: PBlock) {
  pb.removed = true;
  pb.collider.setCollisionGroups((GROUP_GHOST << 16) | GROUP_FLOOR);
  pb.body.lockRotations(false, true);
  pb.body.setEnabledRotations(true, true, true, true);
  pb.body.setLinearDamping(0.05);
  pb.body.wakeUp();
}

/** Run the initial settle phase, then record rest positions as the baseline. */
export function settlePhysics(pw: PhysicsWorld, seconds = 1.2) {
  const n = Math.round(seconds / SUBSTEP);
  for (let i = 0; i < n; i++) pw.world.step();
  for (const b of pw.blocks) {
    const t = b.body.translation();
    b.origin = [t.x, t.y, t.z];
  }
}
