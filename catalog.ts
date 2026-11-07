export type SkinStyle = "wood" | "marble" | "candy" | "neon" | "ice" | "metal" | "galaxy" | "lava" | "rainbow";

export interface Skin {
  id: string;
  name: string;
  cost: number;
  style: SkinStyle;
  c1: string;
  c2: string;
  c3: string;
  rough: number;
  metal: number;
  glow?: number;
  tag?: string;
}

export const SKINS: Skin[] = [
  { id: "pine", name: "Classic Pine", cost: 0, style: "wood", c1: "#e8b86d", c2: "#b9833a", c3: "#f5d9a0", rough: 0.7, metal: 0 },
  { id: "birch", name: "Birch", cost: 250, style: "wood", c1: "#f1dfc0", c2: "#c9a979", c3: "#fff3dc", rough: 0.65, metal: 0 },
  { id: "walnut", name: "Walnut", cost: 500, style: "wood", c1: "#8a5a3b", c2: "#4e2f1b", c3: "#a77650", rough: 0.55, metal: 0 },
  { id: "candy", name: "Candy Cane", cost: 800, style: "candy", c1: "#ff5c8a", c2: "#ffffff", c3: "#ffd1e0", rough: 0.35, metal: 0, tag: "Sweet" },
  { id: "marble", name: "Carrara Marble", cost: 1200, style: "marble", c1: "#f2f2f5", c2: "#7d8597", c3: "#ffffff", rough: 0.18, metal: 0.05 },
  { id: "ice", name: "Frost", cost: 1600, style: "ice", c1: "#bfe9ff", c2: "#6ec6ff", c3: "#ffffff", rough: 0.12, metal: 0.1 },
  { id: "neon", name: "Neon Grid", cost: 2200, style: "neon", c1: "#0d0b1f", c2: "#00f0ff", c3: "#ff2ea6", rough: 0.35, metal: 0.3, glow: 0.9, tag: "Glow" },
  { id: "lava", name: "Magma", cost: 3000, style: "lava", c1: "#1b0f0d", c2: "#ff5a1f", c3: "#ffd23f", rough: 0.6, metal: 0.1, glow: 0.8, tag: "Hot" },
  { id: "gold", name: "Pure Gold", cost: 4200, style: "metal", c1: "#ffd24a", c2: "#b8860b", c3: "#fff2a8", rough: 0.22, metal: 0.95, tag: "Rich" },
  { id: "galaxy", name: "Galaxy", cost: 5500, style: "galaxy", c1: "#120a33", c2: "#7b5cff", c3: "#ff7ad9", rough: 0.3, metal: 0.4, glow: 0.7, tag: "Epic" },
  { id: "rainbow", name: "Prism", cost: 8000, style: "rainbow", c1: "#ff3d6e", c2: "#3dd6ff", c3: "#ffe53d", rough: 0.25, metal: 0.3, glow: 0.35, tag: "Legend" },
];

export interface Theme {
  id: string;
  name: string;
  cost: number;
  sky: [string, string];
  table: string;
  rim: string;
  light: string;
  accent: string;
}

export const THEMES: Theme[] = [
  { id: "day", name: "Sunny Day", cost: 0, sky: ["#4facfe", "#d4f1ff"], table: "#e9d8b4", rim: "#b99660", light: "#fff4e0", accent: "#ffb703" },
  { id: "dusk", name: "Dusk", cost: 0, sky: ["#5b2a86", "#ff8a65"], table: "#3b2a4f", rim: "#241833", light: "#ffd9c2", accent: "#ff8a65" },
  { id: "candy", name: "Candy Land", cost: 400, sky: ["#ff8fd0", "#fff0f8"], table: "#fff1f7", rim: "#ff9ccf", light: "#fff", accent: "#ff4fa3" },
  { id: "forest", name: "Enchanted Forest", cost: 700, sky: ["#0c4a34", "#8fe0a0"], table: "#5b4630", rim: "#2f2417", light: "#f2ffd9", accent: "#7ee081" },
  { id: "ocean", name: "Deep Ocean", cost: 1000, sky: ["#06285f", "#2fd0f0"], table: "#12304d", rim: "#0a1d30", light: "#cfefff", accent: "#27c1e6" },
  { id: "space", name: "Outer Space", cost: 1500, sky: ["#03030c", "#321a6b"], table: "#1d1d3d", rim: "#0e0e24", light: "#d9d6ff", accent: "#9b7bff" },
  { id: "neoncity", name: "Neon City", cost: 2200, sky: ["#0f0026", "#ff2e97"], table: "#101020", rim: "#ff2e97", light: "#ffd1f0", accent: "#00f0ff" },
  { id: "volcano", name: "Volcano", cost: 3000, sky: ["#1a0400", "#ff6a1a"], table: "#2c1b15", rim: "#ff5a1f", light: "#ffe0c2", accent: "#ff8a3d" },
  { id: "arctic", name: "Arctic", cost: 4000, sky: ["#8fb8ff", "#ffffff"], table: "#e2f4ff", rim: "#9fd2f2", light: "#f0f8ff", accent: "#4aa3ff" },
];

export type BoosterId = "rewind" | "glue" | "eye";
export interface Booster {
  id: BoosterId;
  name: string;
  icon: string;
  cost: number;
  desc: string;
}
export const BOOSTERS: Booster[] = [
  { id: "rewind", name: "Rewind", icon: "⏪", cost: 150, desc: "Undo your last pull — or revive the tower after a collapse." },
  { id: "glue", name: "Slick Grip", icon: "🧈", cost: 100, desc: "Your pulled block slides almost frictionless for 20 seconds." },
  { id: "eye", name: "Lucky Eye", icon: "🔮", cost: 80, desc: "Reveals the safest block to pull right now." },
];

export interface Reward {
  coins?: number;
  boosters?: Partial<Record<BoosterId, number>>;
  label: string;
  icon: string;
}

export const DAILY_REWARDS: Reward[] = [
  { coins: 60, label: "60 coins", icon: "🪙" },
  { boosters: { eye: 1 }, label: "Lucky Eye", icon: "🔮" },
  { coins: 120, label: "120 coins", icon: "🪙" },
  { boosters: { glue: 2 }, label: "2× Grip", icon: "🧈" },
  { coins: 200, label: "200 coins", icon: "💰" },
  { boosters: { rewind: 1 }, label: "Rewind", icon: "⏪" },
  { coins: 500, boosters: { eye: 1, glue: 1, rewind: 1 }, label: "MEGA chest", icon: "🎁" },
];

export const SPIN_PRIZES: Reward[] = [
  { coins: 25, label: "25", icon: "🪙" },
  { boosters: { eye: 1 }, label: "Eye", icon: "🔮" },
  { coins: 75, label: "75", icon: "🪙" },
  { boosters: { glue: 1 }, label: "Grip", icon: "🧈" },
  { coins: 150, label: "150", icon: "💰" },
  { boosters: { rewind: 1 }, label: "Rewind", icon: "⏪" },
  { coins: 40, label: "40", icon: "🪙" },
  { coins: 400, label: "400", icon: "💎" },
];

export const SPIN_WEIGHTS = [22, 14, 16, 12, 8, 10, 14, 4];

export function skinById(id: string) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
export function themeById(id: string) {
  return THEMES.find((s) => s.id === id) ?? THEMES[0];
}
