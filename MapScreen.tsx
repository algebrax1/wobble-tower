"use client";

import { useMemo, useState } from "react";
import { MAX_LEVEL, LevelConfig, difficultyLabel, generateLevel } from "@/game/levels";
import { sfx } from "@/game/audio";
import { useGame } from "@/lib/store";
import { CoinPill, Header, Stars, toast } from "./ui";

const MAX_WORLD = MAX_LEVEL / 10;
const WORLD_NAMES = ["Timber Town", "Maple Meadows", "Crooked Canyon", "Sugar Summit", "Frostbite Fields", "Neon Nights", "Lava Lagoon", "Starfall Steppe", "Clockwork Cliffs", "Jade Jungle"];
const WORLD_HUES = [28, 140, 12, 320, 200, 280, 8, 245, 50, 160];

export function worldName(w: number) {
  const base = WORLD_NAMES[(w - 1) % WORLD_NAMES.length];
  const tier = Math.floor((w - 1) / WORLD_NAMES.length);
  return tier === 0 ? base : `${base} ${["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][tier] ?? tier + 1}`;
}

export function MapScreen() {
  const go = useGame((s) => s.go);
  const unlocked = useGame((s) => s.unlocked);
  const stars = useGame((s) => s.stars);
  const start = useGame((s) => s.startLevel);
  const [world, setWorld] = useState(Math.min(MAX_WORLD, Math.floor((Math.min(unlocked, MAX_LEVEL) - 1) / 10) + 1));
  const [sel, setSel] = useState<number | null>(null);

  const hue = WORLD_HUES[(world - 1) % WORLD_HUES.length];
  const levels = Array.from({ length: 10 }, (_, i) => (world - 1) * 10 + i + 1);
  const ROW = 96;
  const pts = levels.map((_, i) => ({ x: 50 + Math.sin(i * 1.15) * 28, y: (9 - i) * ROW + 56 }));

  return (
    <div className="screen" style={{ background: `linear-gradient(180deg, hsl(${hue} 60% 22% / 0.85), hsl(${hue} 55% 10% / 0.95))` }}>
      <Header title="Levels" onBack={() => go("home")} right={<CoinPill onClick={() => go("shop")} />} />
      <div className="px-5 text-center">
        <div className="text-xs font-black uppercase tracking-[0.3em] opacity-70">World {world}</div>
        <div className="title-text text-3xl">{worldName(world)}</div>
      </div>

      <div className="no-scrollbar relative mt-2 flex-1 overflow-y-auto">
        <div className="relative mx-auto" style={{ height: ROW * 10 + 40, width: "100%" }}>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${ROW * 10 + 40}`} preserveAspectRatio="none">
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.6"
              strokeDasharray="3 3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 5 }}
            />
          </svg>
          {levels.map((lv, i) => {
            const isLocked = lv > unlocked;
            const isCurrent = lv === unlocked;
            const st = stars[lv] ?? 0;
            const boss = lv % 10 === 0;
            const size = boss ? 78 : 64;
            return (
              <button
                key={lv}
                onClick={() => {
                  sfx.click();
                  setSel(lv);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pts[i].x}%`, top: pts[i].y }}
                aria-label={`Level ${lv}`}
              >
                <div
                  className="relative grid place-items-center rounded-full font-black"
                  style={{
                    width: size,
                    height: size,
                    fontSize: boss ? 28 : 24,
                    background: isLocked
                      ? "linear-gradient(180deg,#6b6785,#45415c)"
                      : boss
                        ? "linear-gradient(180deg,#ff8aa0,#e0245e)"
                        : st > 0
                          ? "linear-gradient(180deg,#8dffb0,#22b45a)"
                          : "linear-gradient(180deg,#ffe27a,#ffa41c)",
                    boxShadow: `0 6px 0 ${isLocked ? "#2c2940" : boss ? "#8d1239" : st > 0 ? "#147a3b" : "#b36a00"}, 0 10px 16px rgba(0,0,0,.35), inset 0 3px 0 rgba(255,255,255,.5)`,
                    color: isLocked ? "#b7b3d0" : boss ? "#fff" : "#3a2300",
                    animation: isCurrent ? "pulse-ring 1.4s infinite" : undefined,
                    border: isCurrent ? "3px solid #fff" : "none",
                  }}
                >
                  {isLocked ? "🔒" : boss ? "💀" : lv}
                  {!isLocked && boss && <span className="absolute -bottom-5 text-[10px] font-black text-white">LV {lv}</span>}
                  {!isLocked && st > 0 && (
                    <span className="absolute -bottom-3">
                      <Stars n={st} size={16} gap={0} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass mx-3 mb-3 flex items-center gap-2 rounded-3xl p-2.5">
        <button className="btn btn-ghost btn-round" disabled={world <= 1} onClick={() => setWorld((w) => Math.max(1, w - 1))}>
          ‹
        </button>
        <div className="flex flex-1 flex-col items-center px-1">
          <input
            type="range"
            min={1}
            max={MAX_WORLD}
            value={world}
            onChange={(e) => setWorld(Number(e.target.value))}
            className="w-full"
            aria-label="World"
          />
          <button
            className="mt-0.5 text-[11px] font-black opacity-70"
            onClick={() => setWorld(Math.min(MAX_WORLD, Math.floor((Math.min(unlocked, MAX_LEVEL) - 1) / 10) + 1))}
          >
            ⌖ Jump to my level ({Math.min(unlocked, MAX_LEVEL)})
          </button>
        </div>
        <button className="btn btn-ghost btn-round" disabled={world >= MAX_WORLD} onClick={() => setWorld((w) => Math.min(MAX_WORLD, w + 1))}>
          ›
        </button>
      </div>

      {sel !== null && (
        <LevelSheet
          level={sel}
          locked={sel > unlocked}
          onClose={() => setSel(null)}
          onPlay={() => {
            if (sel > unlocked) {
              toast("Beat the previous levels first!");
              return;
            }
            start(sel);
          }}
        />
      )}
    </div>
  );
}

export function chipsFor(cfg: LevelConfig) {
  const c: { icon: string; text: string }[] = [];
  const count = (k: string) => Object.values(cfg.kinds).filter((v) => v === k).length;
  if (cfg.tremor) c.push({ icon: "🌋", text: "Tremors" });
  if (cfg.timeLimit) c.push({ icon: "⏱️", text: `Rush ${cfg.timeLimit}s` });
  if (count("bomb")) c.push({ icon: "💣", text: `${count("bomb")} TNT` });
  if (count("locked")) c.push({ icon: "🔒", text: `${count("locked")} Locked` });
  if (count("heavy")) c.push({ icon: "⛰️", text: `${count("heavy")} Stone` });
  if (count("gold")) c.push({ icon: "⭐", text: `${count("gold")} Gold` });
  if (cfg.twist) c.push({ icon: "🌀", text: "Twisted" });
  if (cfg.holes.length) c.push({ icon: "🕳️", text: `${cfg.holes.length} Gaps` });
  return c;
}

const ARCH_LABEL: Record<string, string> = {
  classic: "Classic Stack",
  cheese: "Swiss Cheese",
  spire: "Needle Spire",
  hourglass: "Hourglass",
  arches: "Arches",
  mushroom: "Mushroom Top",
};

function LevelSheet({ level, locked, onClose, onPlay }: { level: number; locked: boolean; onClose: () => void; onPlay: () => void }) {
  const cfg = useMemo(() => generateLevel(level), [level]);
  const diff = difficultyLabel(level);
  const st = useGame((s) => s.stars[level] ?? 0);
  const chips = chipsFor(cfg);
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/50" style={{ animation: "fadeIn .2s both" }} onClick={onClose}>
      <div
        className="w-full rounded-t-[32px] border-t border-white/20 bg-gradient-to-b from-[#3a2078] to-[#1d1045] p-5 pb-7"
        style={{ animation: "sheetUp .3s cubic-bezier(.2,.9,.3,1.05) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest opacity-60">Level {level}</div>
            <div className="text-2xl font-black">{cfg.name}</div>
            <div className="text-sm font-bold opacity-70">{ARCH_LABEL[cfg.archetype]}</div>
          </div>
          <div className="text-right">
            <span className="rounded-full px-3 py-1 text-xs font-black text-black/80" style={{ background: diff.color }}>
              {diff.label}
            </span>
            <div className="mt-2">
              <Stars n={st} size={22} />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Goal" value={`${cfg.goal} blocks`} />
          <Stat label="Height" value={`${cfg.layers} layers`} />
          <Stat label="Par" value={`${cfg.parTime}s`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.text} className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-extrabold">
              {c.icon} {c.text}
            </span>
          ))}
        </div>
        <button className="btn btn-green btn-xl mt-5 w-full" disabled={locked} onClick={onPlay}>
          {locked ? "🔒 Locked" : st ? "▶ Play again" : "▶ Play"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-2">
      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</div>
      <div className="text-sm font-black">{value}</div>
    </div>
  );
}
