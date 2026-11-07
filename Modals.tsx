"use client";

import { useEffect, useState } from "react";
import { DAILY_REWARDS, SPIN_PRIZES, Reward } from "@/game/catalog";
import { sfx } from "@/game/audio";
import { MAX_LEVEL } from "@/game/levels";
import { syncScore, today, useGame } from "@/lib/store";
import { Modal, toast } from "./ui";

function rewardText(r: Reward) {
  const parts: string[] = [];
  if (r.coins) parts.push(`+${r.coins} coins`);
  if (r.boosters) for (const [k, v] of Object.entries(r.boosters)) parts.push(`+${v} ${k === "glue" ? "Slick Grip" : k === "eye" ? "Lucky Eye" : "Rewind"}`);
  return parts.join(" & ");
}

export function DailyModal() {
  const close = () => useGame.getState().openModal(null);
  const [tab, setTab] = useState<"daily" | "spin">("daily");
  return (
    <Modal title="Rewards" onClose={close}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button className={`btn ${tab === "daily" ? "btn-violet" : "btn-ghost"} !rounded-2xl !py-2.5 text-sm`} onClick={() => setTab("daily")}>
          📅 Daily Gift
        </button>
        <button className={`btn ${tab === "spin" ? "btn-violet" : "btn-ghost"} !rounded-2xl !py-2.5 text-sm`} onClick={() => setTab("spin")}>
          🎡 Lucky Spin
        </button>
      </div>
      {tab === "daily" ? <DailyTab /> : <SpinTab />}
    </Modal>
  );
}

function DailyTab() {
  const lastDaily = useGame((s) => s.lastDaily);
  const streak = useGame((s) => s.streak);
  const claim = useGame((s) => s.claimDaily);
  const claimable = lastDaily !== today();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  const nextStreak = claimable ? (lastDaily === ys ? streak + 1 : 1) : streak;
  const todayIdx = (nextStreak - 1) % 7;
  return (
    <div>
      <p className="mb-3 text-center text-sm font-bold opacity-80">Come back every day — day 7 has a MEGA chest!</p>
      <div className="grid grid-cols-4 gap-2">
        {DAILY_REWARDS.map((r, i) => {
          const done = claimable ? i < todayIdx : i <= todayIdx;
          const isToday = claimable && i === todayIdx;
          return (
            <div
              key={i}
              className={`relative flex flex-col items-center rounded-2xl p-2 text-center ${i === 6 ? "col-span-2" : ""} ${isToday ? "ring-2 ring-amber-300" : ""}`}
              style={{
                background: isToday ? "linear-gradient(180deg,#ffd34d55,#ff9d1c33)" : "rgba(0,0,0,0.25)",
                animation: isToday ? "pulse-ring 1.5s infinite" : undefined,
              }}
            >
              <div className="text-[10px] font-black uppercase opacity-60">Day {i + 1}</div>
              <div className="my-1 text-3xl">{r.icon}</div>
              <div className="text-[11px] font-extrabold leading-tight">{r.label}</div>
              {done && <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/55 text-3xl">✅</div>}
            </div>
          );
        })}
      </div>
      <button
        className="btn btn-green btn-xl mt-5 w-full"
        disabled={!claimable}
        onClick={() => {
          const idx = claim();
          if (idx !== null) {
            sfx.buy();
            toast(`🎁 ${rewardText(DAILY_REWARDS[idx])}`);
            syncScore();
          }
        }}
      >
        {claimable ? "Claim reward!" : "Come back tomorrow"}
      </button>
    </div>
  );
}

function SpinTab() {
  const canSpin = useGame((s) => s.lastSpin !== today());
  const spin = useGame((s) => s.spin);
  const [rot, setRot] = useState(0);
  const [busy, setBusy] = useState(false);
  const n = SPIN_PRIZES.length;
  const seg = 360 / n;
  const colors = ["#ff6b8b", "#ffb43d", "#4fd1ff", "#7ee081", "#b06bff", "#ff8a4f", "#3dd6c4", "#ffd23f"];
  const gradient = `conic-gradient(from 0deg, ${colors.map((c, i) => `${c} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;

  const doSpin = () => {
    if (busy || !canSpin) return;
    const idx = spin();
    if (idx === null) return;
    setBusy(true);
    sfx.boost();
    const target = 360 * 6 + (360 - (idx * seg + seg / 2));
    setRot(target);
    let ticks = 0;
    const tk = setInterval(() => {
      sfx.tick();
      if (++ticks > 28) clearInterval(tk);
    }, 140);
    setTimeout(() => {
      sfx.buy();
      toast(`🎡 ${rewardText(SPIN_PRIZES[idx])}`);
      setBusy(false);
      syncScore();
    }, 4300);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative mt-1" style={{ width: 280, height: 280 }}>
        <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-4xl drop-shadow-lg" style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,.4))" }}>
          🔻
        </div>
        <div
          className="absolute inset-0 rounded-full border-[8px] border-amber-300"
          style={{
            background: gradient,
            transform: `rotate(${rot}deg)`,
            transition: busy ? "transform 4.2s cubic-bezier(0.12, 0.7, 0.1, 1)" : "none",
            boxShadow: "0 12px 30px rgba(0,0,0,.45), inset 0 0 30px rgba(0,0,0,.25)",
          }}
        >
          {SPIN_PRIZES.map((p, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 origin-[0_0] text-center"
              style={{ transform: `rotate(${i * seg + seg / 2}deg) translate(-22px, -118px)`, width: 44 }}
            >
              <div className="text-2xl leading-none">{p.icon}</div>
              <div className="text-[11px] font-black text-black/80">{p.label}</div>
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-pink-500 text-xl font-black shadow-lg">
          ★
        </div>
      </div>
      <button className="btn btn-pink btn-xl mt-6 w-full" disabled={!canSpin || busy} onClick={doSpin}>
        {busy ? "Spinning…" : canSpin ? "SPIN!" : "Free spin tomorrow"}
      </button>
    </div>
  );
}

interface Row {
  name: string;
  highestLevel: number;
  totalStars: number;
  isMe: boolean;
}

export function LeaderboardModal() {
  const close = () => useGame.getState().openModal(null);
  const playerId = useGame((s) => s.playerId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<{ rank: number | null; name: string; level: number; stars: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await syncScore();
      try {
        const r = await fetch(`/api/leaderboard?playerId=${encodeURIComponent(playerId)}`);
        const j = await r.json();
        if (!alive) return;
        setRows(j.top ?? []);
        if (j.mine) setMe({ rank: j.myRank, name: j.mine.name, level: j.mine.highestLevel, stars: j.mine.totalStars });
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [playerId]);

  return (
    <Modal title="Top Builders" onClose={close}>
      {me && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-300/20 p-3 ring-2 ring-amber-300">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-300 font-black text-amber-950">#{me.rank ?? "–"}</div>
          <div className="flex-1">
            <div className="font-black">{me.name} (you)</div>
            <div className="text-xs opacity-75">Level {me.level} · ⭐ {me.stars}</div>
          </div>
        </div>
      )}
      {rows === null && <p className="py-10 text-center font-bold opacity-70">Loading…</p>}
      {rows && rows.length === 0 && <p className="py-10 text-center font-bold opacity-70">No scores yet — be the first!</p>}
      <div className="flex flex-col gap-1.5">
        {rows?.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.isMe ? "bg-amber-300/25" : "bg-black/20"}`}>
            <div className="w-8 text-center text-lg font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
            <div className="flex-1 truncate font-extrabold">{r.name}</div>
            <div className="text-right text-xs font-bold">
              <div>Lv {r.highestLevel}</div>
              <div className="opacity-70">⭐ {r.totalStars}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function SettingsModal() {
  const s = useGame();
  const [name, setName] = useState(s.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const close = () => {
    useGame.getState().openModal(null);
  };
  return (
    <Modal title="Settings" onClose={close}>
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-black/25 p-3">
          <div className="mb-1 text-xs font-black uppercase tracking-widest opacity-60">Player name</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/30 px-3 py-2 font-bold outline-none focus:border-amber-300"
              style={{ userSelect: "text" }}
            />
            <button
              className="btn btn-green !rounded-xl !px-4 !py-2 text-sm"
              onClick={() => {
                s.setName(name);
                sfx.buy();
                toast("Name saved");
                setTimeout(syncScore, 50);
              }}
            >
              Save
            </button>
          </div>
        </div>
        <Toggle label="🔊 Sound effects" value={s.sound} onChange={(v) => s.setSound(v)} />
        <Toggle label="📳 Vibration" value={s.haptics} onChange={(v) => s.setHaptics(v)} />
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Cleared" value={`${s.completed()}`} />
          <Mini label="Stars" value={`${s.totalStars()}`} />
          <Mini label="Of" value={MAX_LEVEL.toLocaleString()} />
        </div>
        <button
          className="btn btn-ghost mt-1 !py-2.5 text-sm"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            localStorage.removeItem("wobble-tower-save-v1");
            location.reload();
          }}
        >
          {confirmReset ? "⚠️ Tap again to erase ALL progress" : "Reset progress"}
        </button>
        <p className="text-center text-xs opacity-50">Wobble Tower 3D · v1.0</p>
      </div>
    </Modal>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 font-black"
      onClick={() => {
        onChange(!value);
        sfx.click();
      }}
    >
      <span>{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${value ? "bg-green-400" : "bg-white/20"}`}>
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: value ? 22 : 2 }} />
      </span>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 py-2">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</div>
    </div>
  );
}
