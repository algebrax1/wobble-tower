"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOSTERS, BoosterId, skinById, themeById } from "@/game/catalog";
import { JengaEngine, TickInfo, loadRapier } from "@/game/engine";
import { MAX_LEVEL, difficultyLabel, generateLevel, starsFor } from "@/game/levels";
import { sfx } from "@/game/audio";
import { syncScore, useGame } from "@/lib/store";
import { CoinPill, toast } from "./ui";
import { chipsFor, worldName } from "./MapScreen";

interface Float {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function GameScreen() {
  const level = useGame((s) => s.level);
  const skinId = useGame((s) => s.skin);
  const themeId = useGame((s) => s.theme);
  const go = useGame((s) => s.go);
  const start = useGame((s) => s.startLevel);
  const boosters = useGame((s) => s.boosters);
  const coins = useGame((s) => s.coins);
  const tutorialSeen = useGame((s) => s.tutorialSeen);
  const fails = useGame((s) => s.fails[level] ?? 0);

  const cfg = useMemo(() => generateLevel(level), [level]);
  const theme = themeById(themeId);
  const diff = difficultyLabel(level);

  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<JengaEngine | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [removed, setRemoved] = useState(0);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<"playing" | "won" | "failed">("playing");
  const [failReason, setFailReason] = useState<"collapse" | "time">("collapse");
  const [win, setWin] = useState<{ stars: number; coins: number; seconds: number; first: boolean } | null>(null);
  const [tick, setTick] = useState<TickInfo>({ time: 0, timeLeft: cfg.timeLimit, glue: 0, tremor: "none" });
  const [floats, setFloats] = useState<Float[]>([]);
  const [intro, setIntro] = useState(true);
  const floatId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let eng: JengaEngine | null = null;
    setRemoved(0);
    setPhase("playing");
    setWin(null);
    setPaused(false);
    setLoading(true);
    setIntro(true);
    setTick({ time: 0, timeLeft: cfg.timeLimit, glue: 0, tremor: "none" });
    const skin = skinById(skinId);
    const th = themeById(themeId);
    loadRapier()
      .then((R) => {
        if (cancelled || !hostRef.current) return;
        eng = new JengaEngine(hostRef.current, R, cfg, skin, th, {
          onProgress: (n) => setRemoved(n),
          onFloat: (text, x, y, color) => {
            const id = ++floatId.current;
            setFloats((f) => [...f.slice(-6), { id, text, x, y, color }]);
            setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1100);
          },
          onToast: (m) => toast(m),
          onGold: (n) => useGame.getState().addCoins(n),
          onTick: (t) => setTick(t),
          onWin: ({ seconds }) => {
            const stars = starsFor(cfg, seconds);
            const reward = cfg.baseCoins + stars * 12;
            const st = useGame.getState();
            const res = st.completeLevel(cfg.level, stars, reward);
            setWin({ stars, coins: res.coinsAwarded, seconds, first: res.firstClear });
            setPhase("won");
            syncScore();
          },
          onFail: (reason) => {
            useGame.getState().recordFail(cfg.level);
            setFailReason(reason);
            setPhase("failed");
          },
        });
        engineRef.current = eng;
        setLoading(false);
        setTimeout(() => !cancelled && setIntro(false), 2000);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      eng?.dispose();
      engineRef.current = null;
    };
  }, [cfg, attempt, skinId, themeId]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phase === "playing") setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  useEffect(() => {
    if (removed >= 1 && !tutorialSeen && level === 1) useGame.getState().markTutorial();
  }, [removed, tutorialSeen, level]);

  const usePower = useCallback(
    (id: BoosterId) => {
      const eng = engineRef.current;
      if (!eng || paused || phase === "won") return;
      const st = useGame.getState();
      const b = BOOSTERS.find((x) => x.id === id)!;
      const have = st.boosters[id] > 0;
      if (!have && st.coins < b.cost) {
        sfx.deny();
        toast(`Need ${b.cost} coins for ${b.name}`);
        return;
      }
      if (phase === "failed" && id !== "rewind") return;
      if (!eng.usePower(id)) {
        if (id === "rewind") toast("Nothing to rewind yet");
        return;
      }
      if (have) st.consumeBooster(id);
      else {
        st.buyBooster(id);
        st.consumeBooster(id);
      }
      sfx.boost();
      if (id === "rewind") setPhase("playing");
    },
    [paused, phase],
  );

  const retry = () => {
    sfx.click();
    setAttempt((a) => a + 1);
  };

  const pct = Math.min(100, (removed / cfg.goal) * 100);
  const lowTime = tick.timeLeft !== null && tick.timeLeft < 10;
  const showTutorial = level === 1 && !tutorialSeen && !loading && !intro && removed === 0 && phase === "playing";
  const chips = useMemo(() => chipsFor(cfg).slice(0, 4), [cfg]);

  return (
    <div className="screen" style={{ background: `linear-gradient(180deg, ${theme.sky[0]} 0%, ${theme.sky[1]} 100%)`, animation: "none" }}>
      <div ref={hostRef} className="absolute inset-0 overflow-hidden" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.28) 100%)" }} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3">
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-round pointer-events-auto"
            onClick={() => {
              sfx.click();
              setPaused(true);
            }}
            aria-label="Pause"
          >
            ⏸
          </button>
          <div className="glass flex-1 rounded-2xl px-3 py-1.5 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Level {level} · {diff.label}
            </div>
            <div className="truncate text-sm font-black">{cfg.name}</div>
          </div>
          <CoinPill />
        </div>

        <div className="mx-auto mt-3 w-[78%] max-w-[340px]">
          <div className="relative h-7 overflow-hidden rounded-full border-2 border-white/40 bg-black/35 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(180deg,#9dffb8,#22c55e)", boxShadow: "inset 0 2px 0 rgba(255,255,255,.5)" }}
            />
            <div className="absolute inset-0 grid place-items-center text-sm font-black drop-shadow">
              🧱 {removed} / {cfg.goal}
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className={`pill !py-0.5 !pl-2 text-sm ${lowTime ? "!border-red-400 text-red-300" : ""}`} style={lowTime ? { animation: "warn .5s infinite" } : undefined}>
              {tick.timeLeft !== null ? `⏱ ${fmt(tick.timeLeft)}` : `⏱ ${fmt(tick.time)}`}
            </span>
            {tick.glue > 0 && <span className="pill !py-0.5 !pl-2 text-sm">🧈 {Math.ceil(tick.glue)}s</span>}
          </div>
        </div>

        {tick.tremor !== "none" && (
          <div
            className="mx-auto mt-2 w-fit rounded-full bg-red-500/90 px-4 py-1 text-sm font-black shadow-lg"
            style={{ animation: "warn .4s infinite" }}
          >
            {tick.tremor === "warn" ? "⚠️ TREMOR INCOMING — hold steady!" : "🌋 SHAKING!"}
          </div>
        )}
      </div>

      {/* floating texts */}
      {floats.map((f) => (
        <div
          key={f.id}
          className="pointer-events-none absolute z-20 text-2xl font-black"
          style={{ left: f.x, top: f.y, color: f.color, textShadow: "0 3px 0 rgba(0,0,0,.5)", animation: "floatUp 1.1s ease-out both" }}
        >
          {f.text}
        </div>
      ))}

      {/* tutorial */}
      {showTutorial && (
        <div className="pointer-events-none absolute inset-x-0 bottom-36 z-10 flex flex-col items-center">
          <div className="glass rounded-2xl px-5 py-3 text-center">
            <div className="text-lg font-black">👆 Drag a block sideways to pull it out!</div>
            <div className="text-xs font-bold opacity-80">Swipe empty space to rotate · Pinch to zoom</div>
          </div>
          <div className="mt-2 text-5xl" style={{ animation: "handDrag 2s ease-in-out infinite" }}>
            👉
          </div>
        </div>
      )}

      {/* boosters */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-4 px-4 pb-5">
        {BOOSTERS.map((b) => {
          const n = boosters[b.id];
          return (
            <button key={b.id} className="btn btn-ghost pointer-events-auto !h-[68px] !w-[68px] !rounded-[22px] !p-0" onClick={() => usePower(b.id)} aria-label={b.name}>
              <span className="text-3xl">{b.icon}</span>
              <span
                className={`absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white px-1 text-xs font-black ${n > 0 ? "bg-pink-500" : "bg-green-500"}`}
              >
                {n > 0 ? n : "+"}
              </span>
              {n === 0 && (
                <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/70 px-1.5 text-[10px] font-black">
                  <span className="coin !h-3.5 !w-3.5 !text-[8px]">$</span>
                  {b.cost}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* loading / intro */}
      {loading && !error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#140b2e]">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-300" style={{ animation: "spinSlow 1.2s linear infinite" }} />
            <p className="mt-4 font-extrabold">Stacking level {level}…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#140b2e] p-8 text-center">
          <div>
            <div className="text-5xl">😵</div>
            <p className="mt-3 font-extrabold">3D graphics couldn&apos;t start on this device.</p>
            <button className="btn mt-5" onClick={() => go("home")}>
              Back
            </button>
          </div>
        </div>
      )}
      {intro && !loading && (
        <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20 text-center" style={{ animation: "introPop 2s ease both" }}>
          <div className="text-xs font-black uppercase tracking-[0.35em] opacity-90">World {cfg.world} · {worldName(cfg.world)}</div>
          <div className="title-text text-5xl">LEVEL {level}</div>
          <div className="mt-1 text-lg font-black drop-shadow">Pull {cfg.goal} blocks!</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-6">
            {chips.map((c) => (
              <span key={c.text} className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-extrabold">
                {c.icon} {c.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* pause */}
      {paused && (
        <Overlay>
          <h2 className="title-text text-5xl">PAUSED</h2>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <button className="btn btn-green btn-xl" onClick={() => setPaused(false)}>
              ▶ Resume
            </button>
            <button
              className="btn btn-blue"
              onClick={() => {
                setPaused(false);
                retry();
              }}
            >
              ↻ Restart
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.click();
                go("map");
              }}
            >
              🗺️ Levels
            </button>
          </div>
        </Overlay>
      )}

      {/* win */}
      {phase === "won" && win && (
        <Overlay>
          <div className="anim-pop text-center">
            <div className="title-text text-5xl">LEVEL CLEAR!</div>
            <div className="mt-1 text-sm font-bold opacity-80">
              {cfg.name} · {fmt(win.seconds)}
            </div>
          </div>
          <div className="my-5 flex items-end gap-2">
            {[1, 2, 3].map((i) => (
              <svg
                key={i}
                width={i === 2 ? 96 : 76}
                height={i === 2 ? 96 : 76}
                viewBox="0 0 24 24"
                style={{ animation: `pop .5s ${0.3 + i * 0.25}s cubic-bezier(.2,.9,.3,1.3) both`, filter: i <= win.stars ? "drop-shadow(0 5px 0 #8a5a00)" : "none" }}
              >
                <path
                  d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
                  fill={i <= win.stars ? "#ffd23f" : "rgba(255,255,255,0.2)"}
                  stroke={i <= win.stars ? "#ff9d1c" : "rgba(255,255,255,0.15)"}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
          </div>
          <div className="glass anim-pop flex items-center gap-3 rounded-2xl px-6 py-3" style={{ animationDelay: "1.1s" }}>
            <span className="coin !h-9 !w-9 !text-lg">$</span>
            <span className="text-3xl font-black">+{win.coins}</span>
          </div>
          {win.stars < 3 && <p className="mt-2 text-xs font-bold opacity-70">Beat {cfg.parTime}s for 3 stars</p>}
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <button
              className="btn btn-green btn-xl"
              onClick={() => {
                sfx.click();
                if (level >= MAX_LEVEL) go("map");
                else start(level + 1);
              }}
            >
              Next level ▶
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-blue !py-2.5 text-sm" onClick={retry}>
                ↻ Replay
              </button>
              <button className="btn btn-ghost !py-2.5 text-sm" onClick={() => go("map")}>
                🗺️ Levels
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* fail */}
      {phase === "failed" && (
        <Overlay>
          <div className="anim-pop text-center">
            <div className="text-7xl">{failReason === "time" ? "⏰" : "💥"}</div>
            <div className="mt-1 text-5xl font-black text-red-300 drop-shadow-[0_4px_0_rgba(0,0,0,.4)]">{failReason === "time" ? "TIME'S UP!" : "TOWER FELL!"}</div>
            <div className="mt-1 text-sm font-bold opacity-80">
              You pulled {removed} of {cfg.goal} blocks
            </div>
          </div>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            {failReason === "collapse" && (
              <button
                className="btn btn-pink btn-xl"
                onClick={() => {
                  const st = useGame.getState();
                  const b = BOOSTERS[0];
                  if (st.boosters.rewind <= 0 && st.coins < b.cost) {
                    sfx.deny();
                    toast(`Need ${b.cost} coins to revive`);
                    return;
                  }
                  const eng = engineRef.current;
                  if (eng && eng.revive()) {
                    if (st.boosters.rewind > 0) st.consumeBooster("rewind");
                    else {
                      st.buyBooster("rewind");
                      st.consumeBooster("rewind");
                    }
                    sfx.boost();
                    setPhase("playing");
                  } else toast("Can't revive this one");
                }}
              >
                ⏪ Revive
                <span className="rounded-xl bg-black/25 px-2 py-0.5 text-base">
                  {boosters.rewind > 0 ? `×${boosters.rewind}` : `🪙 ${BOOSTERS[0].cost}`}
                </span>
              </button>
            )}
            <button className="btn btn-green" onClick={retry}>
              ↻ Try again
            </button>
            {fails >= 2 && level < MAX_LEVEL && (
              <button
                className="btn btn-violet"
                onClick={() => {
                  if (useGame.getState().skipLevel(level)) {
                    sfx.buy();
                    start(level + 1);
                  } else {
                    sfx.deny();
                    toast("Need 400 coins to skip");
                  }
                }}
              >
                ⏭ Skip level <span className="rounded-xl bg-black/25 px-2 py-0.5 text-sm">🪙 400</span>
              </button>
            )}
            <button className="btn btn-ghost !py-2.5 text-sm" onClick={() => go("map")}>
              🗺️ Levels
            </button>
          </div>
          <p className="mt-3 text-xs opacity-60">You have {coins.toLocaleString()} coins</p>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#12082b]/80 px-6 backdrop-blur-sm"
      style={{ animation: "fadeIn .3s both" }}
    >
      {children}
    </div>
  );
}
