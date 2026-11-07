"use client";

import type { CSSProperties } from "react";
import { BOOSTERS, SKINS, Skin, THEMES, Theme } from "@/game/catalog";
import { sfx } from "@/game/audio";
import { useGame, ShopTab } from "@/lib/store";
import { CoinPill, Header, toast } from "./ui";

function skinBg(s: Skin): CSSProperties {
  switch (s.style) {
    case "wood":
      return { background: `repeating-linear-gradient(90deg, transparent 0 9px, ${s.c2}55 9px 11px), linear-gradient(180deg, ${s.c3}, ${s.c1} 55%, ${s.c2})` };
    case "candy":
      return { background: `repeating-linear-gradient(115deg, ${s.c1} 0 10px, ${s.c2} 10px 20px)` };
    case "marble":
      return { background: `linear-gradient(115deg, transparent 40%, ${s.c2}55 41%, transparent 43%), linear-gradient(160deg, ${s.c3}, ${s.c1})` };
    case "neon":
      return { background: s.c1, boxShadow: `inset 0 0 0 3px ${s.c2}, inset 0 0 12px ${s.c3}` };
    case "ice":
      return { background: `linear-gradient(135deg, ${s.c3}, ${s.c1} 40%, ${s.c2})` };
    case "metal":
      return { background: `linear-gradient(180deg, ${s.c3}, ${s.c1} 45%, ${s.c2})` };
    case "galaxy":
      return { background: `radial-gradient(circle at 30% 40%, ${s.c3}99, transparent 40%), radial-gradient(circle at 75% 60%, ${s.c2}cc, transparent 45%), ${s.c1}` };
    case "lava":
      return { background: `linear-gradient(100deg, transparent 30%, ${s.c2} 31% 34%, transparent 35% 60%, ${s.c3} 61% 63%, transparent 64%), ${s.c1}` };
    case "rainbow":
      return { background: "linear-gradient(90deg,#ff3d6e,#ffb43d,#ffe53d,#3dff9a,#3dd6ff,#a43dff)" };
  }
}

function SkinPreview({ skin }: { skin: Skin }) {
  const bar = (w: number, rot = 0): CSSProperties => ({
    ...skinBg(skin),
    width: w,
    height: 22,
    borderRadius: 6,
    transform: `rotate(${rot}deg)`,
    border: "1px solid rgba(0,0,0,0.25)",
    boxShadow: (skinBg(skin).boxShadow ? skinBg(skin).boxShadow + "," : "") + "0 4px 6px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.35)",
  });
  return (
    <div className="flex h-[92px] flex-col items-center justify-center gap-[3px]">
      <div style={bar(84, -3)} />
      <div className="flex gap-[3px]">
        <div style={bar(26)} />
        <div style={bar(26)} />
        <div style={bar(26)} />
      </div>
      <div style={bar(84, 2)} />
    </div>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div className="relative h-[92px] overflow-hidden rounded-2xl" style={{ background: `linear-gradient(180deg, ${theme.sky[0]}, ${theme.sky[1]})` }}>
      <div className="absolute bottom-[-14px] left-1/2 h-12 w-[150%] -translate-x-1/2 rounded-[50%]" style={{ background: theme.table, boxShadow: `0 -3px 0 ${theme.rim}` }} />
      <div className="absolute bottom-[22px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-[2px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3 rounded-sm" style={{ width: 40 - i * 4, background: "linear-gradient(180deg,#f6c36d,#c9812c)", transform: `translateX(${[0, 3, -2][i]}px)` }} />
        ))}
      </div>
    </div>
  );
}

export function ShopScreen() {
  const go = useGame((s) => s.go);
  const tab = useGame((s) => s.shopTab);
  const setTab = useGame((s) => s.setShopTab);
  const g = useGame();

  const fail = () => {
    sfx.deny();
    toast("Not enough coins — claim free rewards! 🎁");
  };

  const tabs: { id: ShopTab; label: string; icon: string }[] = [
    { id: "skins", label: "Blocks", icon: "🧱" },
    { id: "themes", label: "Worlds", icon: "🌄" },
    { id: "boosters", label: "Boosters", icon: "⚡" },
  ];

  return (
    <div className="screen">
      <Header title="Shop" onBack={() => go("home")} right={<CoinPill />} />
      <button
        className="glass mx-4 mb-3 flex items-center gap-3 rounded-2xl p-3 text-left"
        onClick={() => {
          sfx.click();
          g.openModal("daily");
        }}
      >
        <span className="text-3xl">🎁</span>
        <span className="flex-1">
          <span className="block text-sm font-black">Free gifts & Lucky Spin</span>
          <span className="block text-xs opacity-70">Claim every day for bigger rewards</span>
        </span>
        <span className="btn btn-green !rounded-xl !px-3 !py-1.5 text-sm">Open</span>
      </button>

      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? "btn-violet" : "btn-ghost"} !rounded-2xl !px-2 !py-2.5 text-sm`}
            onClick={() => {
              sfx.click();
              setTab(t.id);
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
        {tab === "skins" && (
          <div className="grid grid-cols-2 gap-3">
            {SKINS.map((s) => {
              const owned = g.ownedSkins.includes(s.id);
              const eq = g.skin === s.id;
              return (
                <div key={s.id} className={`glass relative rounded-3xl p-3 ${eq ? "ring-2 ring-amber-300" : ""}`}>
                  {s.tag && <span className="absolute right-2 top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-black">{s.tag}</span>}
                  <SkinPreview skin={s} />
                  <div className="mt-1 text-center text-sm font-black">{s.name}</div>
                  {owned ? (
                    <button
                      className={`btn ${eq ? "btn-ghost" : "btn-teal"} mt-2 w-full !rounded-xl !py-2 text-sm`}
                      disabled={eq}
                      onClick={() => {
                        sfx.click();
                        g.equipSkin(s.id);
                      }}
                    >
                      {eq ? "✓ Equipped" : "Equip"}
                    </button>
                  ) : (
                    <button
                      className="btn mt-2 w-full !rounded-xl !py-2 text-sm"
                      onClick={() => {
                        if (g.buySkin(s.id)) {
                          sfx.buy();
                          toast(`${s.name} unlocked!`);
                        } else fail();
                      }}
                    >
                      <span className="coin !h-5 !w-5">$</span> {s.cost.toLocaleString()}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {tab === "themes" && (
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => {
              const owned = g.ownedThemes.includes(t.id);
              const eq = g.theme === t.id;
              return (
                <div key={t.id} className={`glass rounded-3xl p-3 ${eq ? "ring-2 ring-amber-300" : ""}`}>
                  <ThemePreview theme={t} />
                  <div className="mt-2 text-center text-sm font-black">{t.name}</div>
                  {owned ? (
                    <button
                      className={`btn ${eq ? "btn-ghost" : "btn-teal"} mt-2 w-full !rounded-xl !py-2 text-sm`}
                      disabled={eq}
                      onClick={() => {
                        sfx.click();
                        g.equipTheme(t.id);
                      }}
                    >
                      {eq ? "✓ Equipped" : "Equip"}
                    </button>
                  ) : (
                    <button
                      className="btn mt-2 w-full !rounded-xl !py-2 text-sm"
                      onClick={() => {
                        if (g.buyTheme(t.id)) {
                          sfx.buy();
                          toast(`${t.name} unlocked!`);
                        } else fail();
                      }}
                    >
                      <span className="coin !h-5 !w-5">$</span> {t.cost.toLocaleString()}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {tab === "boosters" && (
          <div className="flex flex-col gap-3">
            {BOOSTERS.map((b) => (
              <div key={b.id} className="glass flex items-center gap-3 rounded-3xl p-4">
                <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-black/25 text-4xl">
                  {b.icon}
                  <span className="absolute -right-2 -top-2 grid h-7 min-w-7 place-items-center rounded-full border-2 border-white bg-pink-500 px-1 text-sm font-black">
                    {g.boosters[b.id]}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-black">{b.name}</div>
                  <div className="text-xs leading-snug opacity-75">{b.desc}</div>
                </div>
                <button
                  className="btn !rounded-xl !px-3 !py-2 text-sm"
                  onClick={() => {
                    if (g.buyBooster(b.id)) {
                      sfx.buy();
                      toast(`+1 ${b.name}`);
                    } else fail();
                  }}
                >
                  <span className="coin !h-5 !w-5">$</span> {b.cost}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
