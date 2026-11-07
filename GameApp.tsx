"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { MAX_LEVEL, difficultyLabel } from "@/game/levels";
import { sfx, unlockAudio } from "@/game/audio";
import { syncScore, useGame } from "@/lib/store";
import { CoinPill, ToastHost, TowerLogo } from "./ui";
import { MapScreen } from "./MapScreen";
import { ShopScreen } from "./ShopScreen";
import { DailyModal, LeaderboardModal, SettingsModal } from "./Modals";

const GameScreen = dynamic(() => import("./GameScreen"), {
  ssr: false,
  loading: () => (
    <div className="screen items-center justify-center">
      <div className="h-14 w-14 rounded-2xl bg-amber-300" style={{ animation: "spinSlow 1.2s linear infinite" }} />
      <p className="mt-4 font-extrabold opacity-80">Stacking blocks…</p>
    </div>
  ),
});

export default function GameApp() {
  const hydrated = useGame((s) => s.hydrated);
  const screen = useGame((s) => s.screen);
  const modal = useGame((s) => s.modal);
  const hydrate = useGame((s) => s.hydrate);
  const openedDaily = useRef(false);

  useEffect(() => {
    hydrate();
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || openedDaily.current) return;
    openedDaily.current = true;
    syncScore();
    const t = setTimeout(() => {
      if (useGame.getState().canClaimDaily() && useGame.getState().screen === "home") useGame.getState().openModal("daily");
    }, 700);
    return () => clearTimeout(t);
  }, [hydrated]);

  return (
    <div id="app-root">
      <div className="app-frame">
        {!hydrated ? (
          <div className="screen items-center justify-center">
            <div className="h-14 w-14 rounded-2xl bg-amber-300" style={{ animation: "spinSlow 1.2s linear infinite" }} />
          </div>
        ) : (
          <>
            {screen === "home" && <HomeScreen />}
            {screen === "map" && <MapScreen />}
            {screen === "shop" && <ShopScreen />}
            {screen === "game" && <GameScreen />}
            {modal === "daily" && <DailyModal />}
            {modal === "leaderboard" && <LeaderboardModal />}
            {modal === "settings" && <SettingsModal />}
          </>
        )}
        <ToastHost />
      </div>
    </div>
  );
}

function HomeScreen() {
  const unlocked = useGame((s) => s.unlocked);
  const go = useGame((s) => s.go);
  const start = useGame((s) => s.startLevel);
  const open = useGame((s) => s.openModal);
  const stars = useGame((s) => Object.values(s.stars).reduce((a, b) => a + b, 0));
  const canDaily = useGame((s) => s.lastDaily !== localToday());
  const canSpin = useGame((s) => s.lastSpin !== localToday());
  const lvl = Math.min(unlocked, MAX_LEVEL);
  const diff = difficultyLabel(lvl);

  return (
    <div className="screen">
      {/* floating bg blocks */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-lg opacity-20"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 90}%`,
              width: 46 + (i % 3) * 22,
              height: 18 + (i % 3) * 8,
              background: "linear-gradient(180deg,#ffd98a,#d98c2b)",
              ["--r" as string]: `${(i * 23) % 60 - 30}deg`,
              animation: `float ${4 + (i % 4)}s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <div className="pill text-base">
          <span className="text-xl leading-none">⭐</span>
          <span className="tabular-nums">{stars}</span>
        </div>
        <CoinPill onClick={() => go("shop")} />
      </div>

      <div className="relative z-10 mt-2 flex flex-1 flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-black uppercase tracking-[0.4em] text-amber-200/80">3D Physics</div>
          <div className="title-text text-6xl leading-none">WOBBLE</div>
          <div className="title-text -mt-1 text-6xl leading-none">TOWER</div>
        </div>
        <div className="mt-5 scale-[0.9]">
          <TowerLogo />
        </div>
      </div>

      <div className="relative z-10 px-6 pb-4">
        <button
          className="btn btn-green btn-xl shine w-full overflow-hidden"
          onClick={() => {
            sfx.click();
            start(lvl);
          }}
          style={{ animation: "pop 0.5s both" }}
        >
          ▶ PLAY
          <span className="ml-1 rounded-xl bg-black/20 px-2.5 py-0.5 text-lg">Lv {lvl}</span>
        </button>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold">
          <span className="rounded-full px-3 py-0.5 text-xs font-black text-black/80" style={{ background: diff.color }}>
            {diff.label}
          </span>
          <span className="opacity-70">{MAX_LEVEL.toLocaleString()} unique levels</span>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          <HomeBtn icon="🗺️" label="Levels" onClick={() => go("map")} />
          <HomeBtn icon="🛍️" label="Shop" onClick={() => go("shop")} />
          <HomeBtn icon="🎁" label="Rewards" dot={canDaily || canSpin} onClick={() => open("daily")} />
          <HomeBtn icon="🏆" label="Ranks" onClick={() => open("leaderboard")} />
        </div>
        <button className="mx-auto mt-4 block text-sm font-bold opacity-70" onClick={() => open("settings")}>
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function HomeBtn({ icon, label, onClick, dot }: { icon: string; label: string; onClick: () => void; dot?: boolean }) {
  return (
    <button
      className="btn btn-ghost relative flex-col gap-0 !rounded-2xl !px-1 !py-3"
      onClick={() => {
        sfx.click();
        onClick();
      }}
    >
      <span className="text-3xl leading-none">{icon}</span>
      <span className="mt-1 text-xs font-black">{label}</span>
      {dot && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-red-500" style={{ animation: "warn 1s infinite" }} />}
    </button>
  );
}
