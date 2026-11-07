"use client";

import { ReactNode, useEffect, useState } from "react";
import { sfx } from "@/game/audio";
import { useGame } from "@/lib/store";

// ---------- toast ----------
let toastListener: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  toastListener?.(msg);
}
export function ToastHost() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    let n = 0;
    toastListener = (msg) => {
      const id = ++n;
      setItems((s) => [...s.slice(-1), { id, msg }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2100);
    };
    return () => {
      toastListener = null;
    };
  }, []);
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-[100] w-full max-w-[420px] -translate-x-1/2">
      {items.map((t, i) => (
        <div
          key={t.id}
          className="glass absolute left-1/2 rounded-full px-5 py-2.5 text-center text-sm font-extrabold whitespace-nowrap"
          style={{ top: i * 46, animation: "toastIn 2.1s ease both" }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ---------- bits ----------
export function CoinPill({ onClick }: { onClick?: () => void }) {
  const coins = useGame((s) => s.coins);
  return (
    <button className="pill text-base" onClick={onClick} aria-label="Coins">
      <span className="coin">$</span>
      <span className="tabular-nums">{coins.toLocaleString()}</span>
      {onClick && <span className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-green-400 text-xs text-green-950">+</span>}
    </button>
  );
}

export function Stars({ n, size = 22, gap = 2 }: { n: number; size?: number; gap?: number }) {
  return (
    <span className="inline-flex" style={{ gap }}>
      {[1, 2, 3].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ filter: i <= n ? "drop-shadow(0 2px 0 #8a5a00)" : "none" }}>
          <path
            d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
            fill={i <= n ? "#ffd23f" : "rgba(255,255,255,0.18)"}
            stroke={i <= n ? "#ff9d1c" : "rgba(255,255,255,0.1)"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
      {onBack ? (
        <button
          className="btn btn-ghost btn-round"
          onClick={() => {
            sfx.click();
            onBack();
          }}
          aria-label="Back"
        >
          ‹
        </button>
      ) : (
        <div className="w-12" />
      )}
      <h1 className="flex-1 text-center text-2xl font-black tracking-wide">{title}</h1>
      <div className="flex min-w-12 justify-end">{right}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      style={{ animation: "fadeIn 0.2s ease both" }}
      onClick={onClose}
    >
      <div
        className={`relative max-h-[92%] w-full overflow-y-auto rounded-t-[32px] border border-white/15 bg-gradient-to-b from-[#3a2078] to-[#1d1045] p-5 pb-8 shadow-2xl no-scrollbar ${wide ? "" : "sm:max-w-md sm:rounded-[32px]"}`}
        style={{ animation: "sheetUp 0.35s cubic-bezier(0.2,0.9,0.3,1.05) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="title-text text-3xl">{title}</h2>
          <button className="btn btn-pink btn-round" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// CSS tower used on the home screen
export function TowerLogo() {
  const layers = 9;
  const colors = ["#f6c36d", "#e9a64e", "#fbd28a"];
  const rows = [];
  for (let l = layers - 1; l >= 0; l--) {
    const even = l % 2 === 0;
    const jitter = [0, 5, -4, 3, -6, 4, -3, 6, -5][l % 9];
    rows.push(
      <div
        key={l}
        className="flex justify-center"
        style={{
          gap: 3,
          transform: `translateX(${jitter}px) rotate(${(jitter / 4).toFixed(1)}deg)`,
          marginTop: -1,
        }}
      >
        {[0, 1, 2].map((i) => {
          const missing = (l === 3 && i === 1) || (l === 5 && i === 2) || (l === 1 && i === 0 && false);
          return (
            <div
              key={i}
              style={{
                width: even ? 82 : 30,
                height: 28,
                opacity: missing ? 0 : 1,
                borderRadius: 7,
                background: `linear-gradient(180deg, ${colors[(l + i) % 3]}, #c9812c)`,
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(120,60,0,0.35), 0 6px 10px rgba(0,0,0,0.35)",
                border: "1px solid rgba(110,55,0,0.5)",
              }}
            />
          );
        })}
      </div>,
    );
  }
  return (
    <div style={{ animation: "sway 5s ease-in-out infinite", transformOrigin: "50% 100%", width: 270 }} className="mx-auto">
      <div className="flex flex-col items-center">{rows}</div>
    </div>
  );
}
