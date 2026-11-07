// Deterministic procedural level generator.
// Every level number maps to a unique seed -> unique tower, modifiers and goals.
// Difficulty is a smooth, monotonic function of the level number.

export const MAX_LEVEL = 5000;

export type BlockKind = "normal" | "gold" | "heavy" | "locked" | "bomb";
export type Archetype = "classic" | "cheese" | "spire" | "hourglass" | "arches" | "mushroom";

export interface TremorConfig {
  interval: number; // seconds between tremors
  strength: number; // amplitude in world units
  duration: number; // seconds
}

export interface LevelConfig {
  level: number;
  seed: number;
  name: string;
  archetype: Archetype;
  layers: number;
  goal: number;
  difficulty: number; // 0..1
  jitterPos: number;
  jitterYaw: number; // radians
  twist: number; // radians per layer
  friction: number;
  holes: string[]; // "layer:idx"
  kinds: Record<string, BlockKind>;
  tremor: TremorConfig | null;
  timeLimit: number | null;
  parTime: number;
  baseCoins: number;
  world: number;
  stageInWorld: number;
  pullable: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashLevel(level: number): number {
  let h = Math.imul(level + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  return h >>> 0;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const ADJ = [
  "Wobbly", "Sneaky", "Rickety", "Mighty", "Jumpy", "Silent", "Grumpy", "Lucky", "Frosty", "Dizzy",
  "Cosmic", "Crooked", "Shaky", "Brave", "Tricky", "Nimble", "Gloomy", "Sunny", "Spicy", "Royal",
  "Twisty", "Fragile", "Stubborn", "Electric", "Mystic", "Rowdy", "Gentle", "Wicked", "Hasty", "Jolly",
];
const NOUN: Record<Archetype, string[]> = {
  classic: ["Tower", "Stack", "Column", "Keep", "Pile"],
  cheese: ["Cheese", "Sponge", "Swiss", "Honeycomb", "Lattice"],
  spire: ["Spire", "Needle", "Obelisk", "Beacon", "Pinnacle"],
  hourglass: ["Hourglass", "Waist", "Pinch", "Bridge", "Neck"],
  arches: ["Arches", "Pillars", "Gateway", "Colonnade", "Cloister"],
  mushroom: ["Mushroom", "Umbrella", "Anvil", "Crown", "Toadstool"],
};

export function difficultyOf(level: number): number {
  return 1 - Math.exp(-(level - 1) / 380);
}

export function generateLevel(levelIn: number): LevelConfig {
  const level = clamp(Math.floor(levelIn), 1, MAX_LEVEL);
  const seed = hashLevel(level);
  const rng = mulberry32(seed);
  const d = difficultyOf(level);
  // slow secondary ramp so levels beyond 1000 keep getting harder
  const e = clamp((level - 1) / MAX_LEVEL, 0, 1);

  // --- archetype ---
  let archetype: Archetype = "classic";
  if (level > 3) {
    const pool: Archetype[] = ["classic", "classic"];
    if (level >= 6) pool.push("cheese");
    if (level >= 9) pool.push("arches");
    if (level >= 12) pool.push("hourglass");
    if (level >= 16) pool.push("mushroom");
    if (level >= 20) pool.push("spire");
    // every 10th level is a "boss" shape
    if (level % 10 === 0) {
      const bosses: Archetype[] = ["spire", "mushroom", "hourglass", "arches", "cheese"];
      archetype = bosses[Math.floor(rng() * bosses.length)];
      rng();
    } else {
      archetype = pool[Math.floor(rng() * pool.length)];
    }
  }

  // --- tower size ---
  let layers = Math.round(lerp(8, 22, Math.pow(d, 0.85)) + (rng() * 3 - 1) + e * 3);
  layers = clamp(layers, 8, 27);
  if (archetype === "spire") layers = clamp(layers + 2, 10, 28);

  const holes = new Set<string>();
  const topCap = layers - 1; // topmost layer index (locked cap)
  const key = (l: number, i: number) => `${l}:${i}`;
  // Layer types: F full, M middle missing, S one side missing, C both sides missing (column)
  const layerType: ("F" | "M" | "S" | "C")[] = new Array(layers).fill("F");
  const compatible = (a: string, b: string) => a === "F" || b === "F" || (a === b && (a === "C" || a === "M"));
  const trySet = (l: number, idxs: number[]) => {
    if (l < 0 || l >= topCap) return false;
    if (layerType[l] !== "F") return false;
    const t = idxs.length === 2 ? "C" : idxs[0] === 1 ? "M" : "S";
    if (l <= 1 && t !== "M") return false;
    if (l > layers - 4 && t === "S") return false;
    const below = l > 0 ? layerType[l - 1] : "F";
    const above = l < layers - 1 ? layerType[l + 1] : "F";
    if (!compatible(t, below) || !compatible(t, above)) return false;
    if (t === "S") {
      if (layerType[l - 2] === "S" || layerType[l + 2] === "S") return false;
    }
    // limit column runs
    if (t === "C") {
      let run = 1;
      for (let k = l - 1; k >= 0 && layerType[k] === "C"; k--) run++;
      for (let k = l + 1; k < layers && layerType[k] === "C"; k++) run++;
      if (run > 9) return false;
    }
    layerType[l] = t;
    for (const i of idxs) holes.add(key(l, i));
    return true;
  };
  const removeSides = (l: number) => trySet(l, [0, 2]);
  const removeMiddle = (l: number) => trySet(l, [1]);

  if (archetype === "spire") {
    const start = Math.floor(layers * lerp(0.62, 0.38, rng()));
    for (let l = start; l < layers; l++) {
      // top two layers keep a complete cap for stability unless very hard
      if (l >= layers - 2 && rng() > 0.35) continue;
      removeSides(l);
    }
  } else if (archetype === "mushroom") {
    const start = Math.floor(layers * lerp(0.3, 0.5, rng()));
    const end = Math.max(start + 1, layers - 3 - Math.floor(rng() * 2));
    for (let l = start; l <= end; l++) removeSides(l);
  } else if (archetype === "hourglass") {
    const mid = layers * lerp(0.4, 0.6, rng());
    const half = Math.max(2, Math.floor(layers * lerp(0.18, 0.3, rng())));
    for (let l = Math.floor(mid - half); l <= Math.floor(mid + half); l++) {
      const depth = 1 - Math.abs(l - mid) / (half + 1);
      if (rng() < 0.45 + depth * 0.55) removeSides(l);
    }
  } else if (archetype === "arches") {
    const a = 1 + Math.floor(rng() * 3);
    const b = layers - 3 - Math.floor(rng() * 3);
    const density = lerp(0.55, 0.9, rng());
    for (let l = a; l <= b; l++) if (rng() < density) removeMiddle(l);
  } else if (archetype === "cheese") {
    const count = Math.round(lerp(3, layers * 0.85, Math.pow(d, 0.9)) * lerp(0.7, 1.1, rng()));
    let tries = 0;
    let placed = 0;
    while (placed < count && tries < 400) {
      tries++;
      const l = Math.floor(rng() * (layers - 2));
      const r = rng();
      const idx = r < 0.4 ? 1 : r < 0.7 ? 0 : 2;
      if (trySet(l, [idx])) placed++;
    }
  }

  // random scattered extra holes on harder levels
  if (level >= 5 && archetype !== "cheese") {
    const extra = Math.round(rng() * lerp(1, 6, d));
    for (let k = 0; k < extra; k++) {
      const l = Math.floor(rng() * (layers - 2));
      const idx = rng() < 0.5 ? 1 : rng() < 0.5 ? 0 : 2;
      trySet(l, [idx]);
    }
  }

  // --- block kinds ---
  const kinds: Record<string, BlockKind> = {};
  const pGold = lerp(0.07, 0.1, rng());
  const columny = layerType.includes("C");
  const pHeavy = level >= 8 ? lerp(0.02, 0.1, d) * (0.6 + rng() * 0.8) * (columny ? 0.3 : 1) : 0;
  const pLocked = level >= 15 ? lerp(0.02, 0.12, d) * (0.6 + rng() * 0.8) : 0;
  const pBomb = level >= 25 ? lerp(0.015, 0.07, d) * (0.6 + rng() * 0.8) : 0;
  let pullable = 0;
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < 3; i++) {
      const k = key(l, i);
      if (holes.has(k)) continue;
      if (l >= topCap) {
        kinds[k] = "normal";
        continue;
      }
      const r = rng();
      let kind: BlockKind = "normal";
      if (r < pGold) kind = "gold";
      else if (r < pGold + pHeavy) kind = "heavy";
      else if (r < pGold + pHeavy + pLocked) kind = "locked";
      else if (r < pGold + pHeavy + pLocked + pBomb) kind = "bomb";
      // never lock more than one block per layer and never in layer 0
      if (kind === "locked") {
        const sameLayerLocked = [0, 1, 2].some((x) => kinds[key(l, x)] === "locked");
        if (sameLayerLocked || l === 0) kind = "normal";
      }
      kinds[k] = kind;
      if (kind !== "locked") pullable++;
    }
  }

  // --- goal ---
  let goal = Math.round(lerp(3, 34, Math.pow(d, 0.9)) + rng() * 2 + e * 4);
  goal = clamp(goal, 3, Math.max(3, Math.floor(pullable * 0.42)));

  // --- physical modifiers ---
  const hasColumns = layerType.includes("C");
  const jScale = hasColumns ? 0.3 : 1;
  const jitterPos = lerp(0, 0.035, Math.pow(d, 0.8)) * (0.5 + rng() * 0.8) * jScale;
  const jitterYaw = ((lerp(0, 0.45, d) * (0.4 + rng() * 0.9)) * Math.PI) / 180 * jScale;
  const twistRoll = rng();
  const twistMag = lerp(0.4, 1.8, rng());
  const twistSign = rng() < 0.5 ? -1 : 1;
  const twist =
    level >= 18 && !hasColumns && twistRoll < lerp(0.18, 0.45, d)
      ? (twistSign * twistMag * Math.PI) / 180
      : 0;
  const friction = clamp(lerp(0.66, 0.46, d) + (rng() - 0.5) * 0.06, 0.4, 0.7);

  let tremor: TremorConfig | null = null;
  if (level >= 12 && rng() < lerp(0.3, 0.75, d)) {
    tremor = {
      interval: lerp(14, 6, d) * (0.85 + rng() * 0.3),
      strength: 0.012 + (0.02 + 0.02 * e) * d * (0.5 + rng()),
      duration: 0.8 + rng() * 0.5,
    };
  }

  const parTime = Math.round(goal * lerp(13, 7, d) + 10);
  const timeLimit = level >= 10 && level % 5 === 0 ? Math.round(parTime * 1.9) : null;

  const adj = ADJ[Math.floor(rng() * ADJ.length)];
  const nouns = NOUN[archetype];
  const noun = nouns[Math.floor(rng() * nouns.length)];

  return {
    level,
    seed,
    name: `${adj} ${noun}`,
    archetype,
    layers,
    goal,
    difficulty: d,
    jitterPos,
    jitterYaw,
    twist,
    friction,
    holes: [...holes],
    kinds,
    tremor,
    timeLimit,
    parTime,
    baseCoins: 25 + Math.floor(Math.sqrt(level) * 4),
    world: Math.floor((level - 1) / 10) + 1,
    stageInWorld: ((level - 1) % 10) + 1,
    pullable,
  };
}

export function difficultyLabel(level: number): { label: string; color: string } {
  const d = difficultyOf(level);
  if (level % 10 === 0) return { label: "BOSS", color: "#ff4d6d" };
  if (d < 0.08) return { label: "Easy", color: "#4ade80" };
  if (d < 0.25) return { label: "Medium", color: "#facc15" };
  if (d < 0.5) return { label: "Hard", color: "#fb923c" };
  if (d < 0.8) return { label: "Expert", color: "#f87171" };
  return { label: "Insane", color: "#c084fc" };
}

export function starsFor(cfg: LevelConfig, seconds: number): number {
  if (seconds <= cfg.parTime) return 3;
  if (seconds <= cfg.parTime * 1.7) return 2;
  return 1;
}
