"use client";

import { create } from "zustand";
import { BOOSTERS, BoosterId, DAILY_REWARDS, Reward, SKINS, SPIN_PRIZES, SPIN_WEIGHTS, THEMES } from "@/game/catalog";
import { MAX_LEVEL } from "@/game/levels";
import { setAudioEnabled, setHapticsEnabled } from "@/game/audio";

const KEY = "wobble-tower-save-v1";

export type Screen = "home" | "map" | "game" | "shop";
export type ModalId = null | "daily" | "leaderboard" | "settings";
export type ShopTab = "skins" | "themes" | "boosters";

interface Persisted {
  coins: number;
  unlocked: number; // highest playable level
  stars: Record<string, number>;
  skin: string;
  theme: string;
  ownedSkins: string[];
  ownedThemes: string[];
  boosters: Record<BoosterId, number>;
  sound: boolean;
  haptics: boolean;
  name: string;
  playerId: string;
  lastDaily: string;
  streak: number;
  lastSpin: string;
  tutorialSeen: boolean;
  fails: Record<string, number>;
}

interface GameState extends Persisted {
  hydrated: boolean;
  screen: Screen;
  level: number;
  modal: ModalId;
  shopTab: ShopTab;
  hydrate(): void;
  go(screen: Screen): void;
  openModal(m: ModalId): void;
  startLevel(level: number): void;
  addCoins(n: number): void;
  completeLevel(level: number, stars: number, coins: number): { firstClear: boolean; coinsAwarded: number };
  recordFail(level: number): number;
  skipLevel(level: number): boolean;
  buySkin(id: string): boolean;
  buyTheme(id: string): boolean;
  equipSkin(id: string): void;
  equipTheme(id: string): void;
  buyBooster(id: BoosterId): boolean;
  consumeBooster(id: BoosterId): boolean;
  canClaimDaily(): boolean;
  claimDaily(): number | null;
  canSpin(): boolean;
  spin(): number | null;
  setSound(v: boolean): void;
  setHaptics(v: boolean): void;
  setName(n: string): void;
  setShopTab(t: ShopTab): void;
  markTutorial(): void;
  totalStars(): number;
  completed(): number;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function randomName() {
  const a = ["Wobbly", "Swift", "Lucky", "Mighty", "Sneaky", "Cosmic", "Tiny", "Brave", "Steady", "Jolly"];
  const b = ["Builder", "Stacker", "Pilot", "Fox", "Panda", "Wizard", "Tiger", "Owl", "Ninja", "Otter"];
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

const defaults = (): Persisted => ({
  coins: 100,
  unlocked: 1,
  stars: {},
  skin: "pine",
  theme: "day",
  ownedSkins: ["pine"],
  ownedThemes: ["day", "dusk"],
  boosters: { rewind: 1, glue: 1, eye: 2 },
  sound: true,
  haptics: true,
  name: "",
  playerId: "",
  lastDaily: "",
  streak: 0,
  lastSpin: "",
  tutorialSeen: false,
  fails: {},
});

function pickPersisted(s: GameState): Persisted {
  return {
    coins: s.coins,
    unlocked: s.unlocked,
    stars: s.stars,
    skin: s.skin,
    theme: s.theme,
    ownedSkins: s.ownedSkins,
    ownedThemes: s.ownedThemes,
    boosters: s.boosters,
    sound: s.sound,
    haptics: s.haptics,
    name: s.name,
    playerId: s.playerId,
    lastDaily: s.lastDaily,
    streak: s.streak,
    lastSpin: s.lastSpin,
    tutorialSeen: s.tutorialSeen,
    fails: s.fails,
  };
}

export const useGame = create<GameState>((set, get) => ({
  ...defaults(),
  hydrated: false,
  screen: "home",
  level: 1,
  modal: null,
  shopTab: "skins",

  hydrate() {
    if (get().hydrated) return;
    let saved: Partial<Persisted> = {};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const d = { ...defaults(), ...saved };
    d.boosters = { ...defaults().boosters, ...(saved.boosters ?? {}) };
    if (!d.playerId) d.playerId = uid();
    if (!d.name) d.name = randomName();
    setAudioEnabled(d.sound);
    setHapticsEnabled(d.haptics);
    set({ ...d, hydrated: true, level: Math.min(d.unlocked, MAX_LEVEL) });
  },

  go(screen) {
    set({ screen });
  },
  openModal(m) {
    set({ modal: m });
  },
  startLevel(level) {
    set({ level: Math.max(1, Math.min(MAX_LEVEL, level)), screen: "game", modal: null });
  },
  addCoins(n) {
    set((s) => ({ coins: s.coins + n }));
  },

  completeLevel(level, stars, coins) {
    const s = get();
    const prev = s.stars[level] ?? 0;
    const firstClear = prev === 0;
    const coinsAwarded = firstClear ? coins : stars > prev ? Math.round(coins * 0.6) : Math.round(coins * 0.25);
    set({
      stars: { ...s.stars, [level]: Math.max(prev, stars) },
      unlocked: Math.min(MAX_LEVEL, Math.max(s.unlocked, level + 1)),
      coins: s.coins + coinsAwarded,
      fails: { ...s.fails, [level]: 0 },
    });
    return { firstClear, coinsAwarded };
  },

  recordFail(level) {
    const n = (get().fails[level] ?? 0) + 1;
    set((s) => ({ fails: { ...s.fails, [level]: n } }));
    return n;
  },

  skipLevel(level) {
    const s = get();
    const cost = 400;
    if (s.coins < cost) return false;
    set({
      coins: s.coins - cost,
      stars: { ...s.stars, [level]: Math.max(s.stars[level] ?? 0, 1) },
      unlocked: Math.min(MAX_LEVEL, Math.max(s.unlocked, level + 1)),
      fails: { ...s.fails, [level]: 0 },
    });
    return true;
  },

  buySkin(id) {
    const s = get();
    const item = SKINS.find((x) => x.id === id);
    if (!item || s.ownedSkins.includes(id) || s.coins < item.cost) return false;
    set({ coins: s.coins - item.cost, ownedSkins: [...s.ownedSkins, id], skin: id });
    return true;
  },
  buyTheme(id) {
    const s = get();
    const item = THEMES.find((x) => x.id === id);
    if (!item || s.ownedThemes.includes(id) || s.coins < item.cost) return false;
    set({ coins: s.coins - item.cost, ownedThemes: [...s.ownedThemes, id], theme: id });
    return true;
  },
  equipSkin(id) {
    if (get().ownedSkins.includes(id)) set({ skin: id });
  },
  equipTheme(id) {
    if (get().ownedThemes.includes(id)) set({ theme: id });
  },
  buyBooster(id) {
    const s = get();
    const b = BOOSTERS.find((x) => x.id === id);
    if (!b || s.coins < b.cost) return false;
    set({ coins: s.coins - b.cost, boosters: { ...s.boosters, [id]: s.boosters[id] + 1 } });
    return true;
  },
  consumeBooster(id) {
    const s = get();
    if (s.boosters[id] <= 0) return false;
    set({ boosters: { ...s.boosters, [id]: s.boosters[id] - 1 } });
    return true;
  },

  canClaimDaily() {
    return get().lastDaily !== today();
  },
  claimDaily() {
    const s = get();
    if (s.lastDaily === today()) return null;
    const streak = s.lastDaily === yesterday() ? s.streak + 1 : 1;
    const idx = (streak - 1) % DAILY_REWARDS.length;
    set({ lastDaily: today(), streak, ...applyReward(s, DAILY_REWARDS[idx]) });
    return idx;
  },
  canSpin() {
    return get().lastSpin !== today();
  },
  spin() {
    const s = get();
    if (s.lastSpin === today()) return null;
    const total = SPIN_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < SPIN_WEIGHTS.length; i++) {
      r -= SPIN_WEIGHTS[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    set({ lastSpin: today(), ...applyReward(s, SPIN_PRIZES[idx]) });
    return idx;
  },

  setSound(v) {
    setAudioEnabled(v);
    set({ sound: v });
  },
  setHaptics(v) {
    setHapticsEnabled(v);
    set({ haptics: v });
  },
  setName(n) {
    set({ name: n.replace(/[^\w \-.]/g, "").slice(0, 16) });
  },
  setShopTab(t) {
    set({ shopTab: t });
  },
  markTutorial() {
    set({ tutorialSeen: true });
  },
  totalStars() {
    return Object.values(get().stars).reduce((a, b) => a + b, 0);
  },
  completed() {
    return Object.keys(get().stars).length;
  },
}));

function applyReward(s: Persisted, r: Reward): Partial<Persisted> {
  const boosters = { ...s.boosters };
  if (r.boosters) for (const [k, v] of Object.entries(r.boosters)) boosters[k as BoosterId] += v ?? 0;
  return { coins: s.coins + (r.coins ?? 0), boosters };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== "undefined") {
  useGame.subscribe((state) => {
    if (!state.hydrated) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(pickPersisted(state)));
      } catch {
        /* ignore */
      }
    }, 150);
  });
}

export async function syncScore() {
  const s = useGame.getState();
  if (!s.hydrated || !s.playerId) return;
  try {
    await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: s.playerId,
        name: s.name,
        highestLevel: Math.max(0, s.unlocked - 1),
        totalStars: s.totalStars(),
      }),
    });
  } catch {
    /* offline is fine */
  }
}
