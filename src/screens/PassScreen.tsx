import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { PASS_CHANGED_EVENT, SeasonPassSection } from "@/ui/SeasonPassSection";
import { seasonClock } from "@/engine/SeasonClock";
import { loadSave } from "@/engine/SaveSystem";
import { getPassView } from "@/engine/SeasonPassService";
import { formatDurationShort } from "@/utils/formatDuration";
import {
  freeRewardForLevel,
  PASS_LEVELS,
  PREMIUM_PASS_PRICE_BRL,
  premiumSkinsForSeason,
  SUPREME_PASS_PRICE_BRL,
  supremeOnSale,
  type RewardPart,
} from "@/config/seasonPass";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { PURCHASE_MIN_AGE } from "@/config/ageGate";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { MAX_TOWER_LEVEL } from "@/config/towerStats";
import { Tower3DPortrait } from "@/ui/Tower3DPortrait";
import { LevelMedallion, RewardArt, RewardIcon } from "@/ui/PassArt";
import { RewardPartsLabel, REWARD_CSS } from "@/ui/RewardPartsLabel";

interface PassScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/**
 * PASSE — the Season Pass on its own page. A hero with the player's level
 * medallion, XP and the next reward; the three passes side by side (Free,
 * Premium with this Season's two skins, Supreme with the top-rarity items);
 * then the full 30-level track (shared with the Season page).
 */
export function PassScreen({ onNavigate, onPlay }: PassScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const brl = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(v);
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener(PASS_CHANGED_EVENT, on);
    return () => window.removeEventListener(PASS_CHANGED_EVENT, on);
  }, []);

  const season = seasonClock.getCurrentSeasonWindow();
  const now = seasonClock.now();
  const remaining = Math.max(0, season.endAtMs - now);
  const save = loadSave();
  const view = getPassView(save);
  const nextLevel = Math.min(PASS_LEVELS, view.level + 1);
  const next = freeRewardForLevel(nextLevel);
  const xpPct = view.level >= PASS_LEVELS ? 100 : (view.xpIntoLevel / view.xpPerLevel) * 100;
  const [skinA, skinB] = premiumSkinsForSeason(season.seasonNumber);
  const supremeLeft = supremeOnSale(season, now);
  const sample = (parts: RewardPart[], size = 46) => parts.map((p, i) => <RewardIcon key={i} part={p} size={size} />);

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + PASS_PAGE_CSS + REWARD_CSS}</style>
      <TopNav active="PASS" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero ps-hero">
          <div className="pg-hero-art" style={{ backgroundImage: `url(${assetBase}sprites/ground/ancient_forest.webp)` }} aria-hidden="true" />
          <div className="pg-hero-inner ps-hero-inner">
            <div>
              <p className="pg-kicker">{t("season.kicker", { number: season.seasonNumber })}</p>
              <h1 className="pg-h1">{t("pass.title")}</h1>
              <p className="pg-sub">{t("pass.pageLead", { time: formatDurationShort(remaining) })}</p>
              <span className="ps-ends">⏳ {t("pass.endsIn", { time: formatDurationShort(remaining) })}</span>
            </div>
            <div className="ps-status">
              <div className="ps-medal">
                <LevelMedallion level={view.level} max={PASS_LEVELS} />
                <div className="ps-medal-num">
                  <small>{t("pass.yourLevel")}</small>
                  <b>{view.level}</b>
                  <small>/ {PASS_LEVELS}</small>
                </div>
              </div>
              <div className="ps-status-side">
                <div className="ps-xp">
                  <div className="ps-xp-bar">
                    <div className="ps-xp-fill" style={{ width: `${xpPct}%` }} />
                  </div>
                  <span>{view.level >= PASS_LEVELS ? t("pass.complete") : t("pass.xp", { xp: view.xpIntoLevel, need: view.xpPerLevel })}</span>
                </div>
                {view.level < PASS_LEVELS && (
                  <div className="ps-next">
                    <span className="ps-next-art">
                      <RewardArt reward={next} size={40} />
                    </span>
                    <div>
                      <small>
                        {t("pass.nextReward")} · {nextLevel}
                      </small>
                      <p>
                        <RewardPartsLabel parts={next} currentWave={save.currentWave} />
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="pg-wrap">
          <section className="ps-tiers-wrap">
            <div className="pg-head">
              <h2 className="pg-h2">{t("pass.tiersTitle")}</h2>
            </div>
            <div className="ps-tiers">
              <article className="ps-tier is-free">
                <div className="ps-tier-top">
                  <h3>{t("pass.freeTrack")}</h3>
                  <span className="ps-badge is-on">✓ {t("pass.active")}</span>
                </div>
                <div className="ps-tier-art">{sample([{ kind: "SHARDS", amount: 3 }, { kind: "GOLD", kills: 40 }, { kind: "GEMS", amount: 1 }, { kind: "ITEM", rarity: "UNCOMMON" }])}</div>
                <p className="ps-tier-desc">{t("pass.freeDesc")}</p>
                <ul className="ps-tier-list">
                  <li>{t("pass.freeHighlights")}</li>
                  <li>{t("pass.itemsUpTo")}</li>
                </ul>
                <div className="ps-tier-price">
                  <span className="ps-included">✓ {t("pass.active")}</span>
                </div>
              </article>

              <article className="ps-tier is-premium">
                <div className="ps-tier-top">
                  <h3>{t("pass.premiumTrack")}</h3>
                </div>
                <div className="ps-tier-skins" aria-label={t("pass.seasonSkins")}>
                  {[skinA, skinB].map((id) => {
                    const sk = getTowerSkinDefinition(id);
                    return sk ? (
                      <figure key={id}>
                        <Tower3DPortrait type={sk.towerType} level={MAX_TOWER_LEVEL} skinId={sk.id} width={110} height={110} />
                        <figcaption>{t(`towerSkins.${sk.id}.name` as TranslationKey)}</figcaption>
                      </figure>
                    ) : null;
                  })}
                </div>
                <p className="ps-tier-desc">{t("pass.premiumDesc")}</p>
                <ul className="ps-tier-list">
                  <li>{t("pass.seasonSkins")}: 2</li>
                  <li>{t("pass.itemsUpTo")}</li>
                </ul>
                <div className="ps-tier-price">
                  <b>{brl(PREMIUM_PASS_PRICE_BRL)}</b> <small>{t("pass.perSeason")}</small>
                  <button className="ps-buy" disabled={!REAL_MONEY_PAYMENTS_ENABLED}>
                    {t(REAL_MONEY_PAYMENTS_ENABLED ? "store.buy" : "store.soon")}
                  </button>
                </div>
              </article>

              <article className={`ps-tier is-supreme${supremeLeft !== null ? " is-sale" : ""}`}>
                <div className="ps-tier-top">
                  <h3>{t("pass.supremeTrack")}</h3>
                  <span className={`ps-badge${supremeLeft !== null ? " is-sale" : ""}`}>
                    {supremeLeft !== null ? t("pass.onSaleLeft", { time: formatDurationShort(supremeLeft) }) : t("pass.offSale")}
                  </span>
                </div>
                <div className="ps-tier-art is-supreme">
                  {sample([{ kind: "ITEM", rarity: "RARE" }, { kind: "ITEM", rarity: "EPIC" }, { kind: "ITEM", rarity: "LEGENDARY" }])}
                </div>
                <p className="ps-tier-desc">{t("pass.supremeDesc")}</p>
                <ul className="ps-tier-list">
                  <li>{t("pass.includesPremium")}</li>
                  <li>{t("pass.itemsTop")}</li>
                </ul>
                <div className="ps-tier-price">
                  <b>{brl(SUPREME_PASS_PRICE_BRL)}</b> <small>{t("pass.perSeason")}</small>
                  <button className="ps-buy is-supreme" disabled={!REAL_MONEY_PAYMENTS_ENABLED || supremeLeft === null}>
                    {t(REAL_MONEY_PAYMENTS_ENABLED ? "store.buy" : "store.soon")}
                  </button>
                </div>
              </article>
            </div>
            <p className="ps-adult">
              <span>{PURCHASE_MIN_AGE}+</span>
              {t("pass.adultOnly", { age: PURCHASE_MIN_AGE })}
            </p>
          </section>
          <SeasonPassSection showTitle={false} />
        </div>
      </div>
    </div>
  );
}

const PASS_PAGE_CSS = `
.ps-hero-inner { align-items: center; gap: 28px; }
.ps-ends { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; color: var(--bone); background: rgba(0,0,0,0.4); border: 1px solid var(--line); }
.ps-status { display: flex; align-items: center; gap: 20px; padding: 16px 22px 16px 16px; border-radius: 20px; min-width: min(100%, 470px);
  background: linear-gradient(160deg, rgba(58,40,20,0.85), rgba(16,11,7,0.92)); border: 1px solid rgba(232,176,75,0.45); box-shadow: inset 0 1px 0 rgba(255,236,190,0.15), 0 18px 40px rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
.ps-medal { position: relative; flex: none; width: 140px; height: 140px; }
.pa-medal { width: 100%; height: 100%; animation: ps-turn 60s linear infinite; }
.pa-medal .pa-medal-ring { animation: hn-fade 900ms ease-out backwards; }
@keyframes ps-turn { to { transform: rotate(360deg); } }
.ps-medal-num { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1; }
.ps-medal-num b { font-family: var(--display); font-size: 46px; color: #fff3d6; text-shadow: 0 2px 10px rgba(255,208,106,0.5); }
.ps-medal-num small { font-size: 10.5px; color: var(--ash); letter-spacing: 0.04em; }
.ps-status-side { flex: 1; min-width: 0; display: grid; gap: 14px; }
.ps-xp { display: grid; gap: 6px; font-size: 13px; color: var(--bone); font-variant-numeric: tabular-nums; }
.ps-xp-bar { height: 12px; border-radius: 999px; background: rgba(0,0,0,0.5); box-shadow: inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,176,75,0.3); overflow: hidden; }
.ps-xp-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b07a20, #ffd06a 70%, #fff3c4); box-shadow: 0 0 12px rgba(255,208,106,0.7); transform-origin: left; animation: hn-grow-x 1s var(--hn-ease-out) 300ms backwards; }
.ps-next { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,236,190,0.1); }
.ps-next-art { flex: none; display: grid; place-items: center; width: 58px; height: 58px; border-radius: 12px; background: radial-gradient(circle at 50% 40%, rgba(255,214,150,0.2), rgba(0,0,0,0.3)); }
.ps-next-art .pa-art { height: 46px; animation: hn-float 3s ease-in-out infinite; }
.ps-next small { font-size: 11px; color: var(--ash); letter-spacing: 0.04em; }
.ps-next p { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--bone); }

.ps-tiers-wrap { padding-top: 40px; }
.ps-tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 16px; }
.ps-tier { position: relative; display: flex; flex-direction: column; padding: 20px; border-radius: 18px; overflow: hidden; isolation: isolate;
  background: linear-gradient(180deg, rgba(42,30,18,0.92), rgba(16,11,7,0.96)); border: 1px solid rgba(232,176,75,0.3); box-shadow: inset 0 1px 0 rgba(255,236,190,0.1), 0 12px 28px rgba(0,0,0,0.4);
  transition: transform 220ms var(--hn-ease-out), box-shadow 220ms ease; }
.ps-tier:hover { transform: translateY(-4px); box-shadow: inset 0 1px 0 rgba(255,236,190,0.14), 0 20px 36px rgba(0,0,0,0.5); }
.ps-tier.is-premium { border-color: rgba(92,192,255,0.5); background: radial-gradient(70% 40% at 50% 0%, rgba(92,192,255,0.18), transparent 70%), linear-gradient(180deg, #16202c, #0c1118); }
.ps-tier.is-supreme { border: 1px solid transparent;
  background: radial-gradient(70% 40% at 50% 0%, rgba(255,150,70,0.22), transparent 70%), linear-gradient(180deg, #2c180c, #120a06) padding-box,
              conic-gradient(from var(--ps-a, 0deg), #7a3a10, #ffb36b, #fff0c8, #ffb36b, #7a3a10 40%, #4a200a 70%, #7a3a10) border-box;
  animation: ps-edge 7s linear infinite; box-shadow: 0 16px 36px rgba(0,0,0,0.5), 0 0 34px rgba(255,150,70,0.14); }
@property --ps-a { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
@keyframes ps-edge { to { --ps-a: 360deg; } }
.ps-tier-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ps-tier h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 28px; color: var(--bone); }
.ps-tier.is-premium h3 { color: #bfe4ff; }
.ps-tier.is-supreme h3 { background: linear-gradient(180deg, #fff0c8, #ffb36b 60%, #c06a20); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ps-badge { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; color: var(--ash); border: 1px solid var(--line); background: rgba(0,0,0,0.35); white-space: nowrap; }
.ps-badge.is-on { color: #9be37a; border-color: rgba(110,220,120,0.5); background: rgba(110,220,120,0.1); }
.ps-badge.is-sale { color: #ffcf9a; border-color: rgba(255,170,90,0.6); background: rgba(255,150,70,0.12); animation: sp-next 1.8s ease-in-out infinite; }
.ps-tier-art { display: flex; align-items: flex-end; justify-content: center; gap: 10px; height: 120px; margin: 10px 0 4px; border-radius: 12px;
  background: radial-gradient(55% 60% at 50% 45%, rgba(255,214,150,0.14), transparent 70%), radial-gradient(45% 10% at 50% 90%, rgba(0,0,0,0.55), transparent 70%); padding-bottom: 18px; }
.ps-tier-art svg { filter: drop-shadow(0 4px 6px rgba(0,0,0,0.55)); transition: transform 300ms var(--hn-ease-back); }
.ps-tier-art svg:nth-child(odd) { animation: hn-float 3.4s ease-in-out infinite; }
.ps-tier-art svg:nth-child(even) { animation: hn-float 3.4s ease-in-out -1.7s infinite; }
.ps-tier-art.is-supreme svg:last-child { width: 64px; height: 64px; }
.ps-tier-skins { display: flex; justify-content: center; gap: 4px; height: 120px; margin: 10px 0 4px; border-radius: 12px; background: radial-gradient(55% 60% at 50% 45%, rgba(120,190,255,0.16), transparent 70%); }
.ps-tier-skins figure { margin: 0; display: grid; justify-items: center; }
.ps-tier-skins canvas { display: block; }
.ps-tier-skins figcaption { margin-top: -8px; font-size: 11px; font-weight: 700; color: #bfe4ff; }
.ps-tier-desc { margin: 10px 0 0; font-size: 13.5px; line-height: 1.5; color: #d9cdb6; }
.ps-tier-list { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: var(--bone); }
.ps-tier-list li { display: flex; align-items: center; gap: 8px; }
.ps-tier-list li::before { content: ""; width: 8px; height: 8px; transform: rotate(45deg); background: var(--gold); box-shadow: 0 0 6px rgba(232,176,75,0.7); flex: none; }
.ps-tier.is-premium .ps-tier-list li::before { background: #5cc0ff; box-shadow: 0 0 6px rgba(92,192,255,0.7); }
.ps-tier.is-supreme .ps-tier-list li::before { background: #ffb36b; box-shadow: 0 0 6px rgba(255,170,90,0.7); }
.ps-tier-price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-top: auto; padding-top: 18px; }
.ps-tier-price b { font-family: var(--display); font-size: 26px; color: #fff3d6; }
.ps-tier-price small { font-size: 12.5px; color: var(--ash); }
.ps-included { width: 100%; padding: 11px 14px; border-radius: 10px; text-align: center; font-weight: 800; font-size: 14px; color: #9be37a; border: 1px solid rgba(110,220,120,0.45); background: rgba(110,220,120,0.08); }
.ps-buy { width: 100%; padding: 11px 14px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 14px; border: 1px solid #f2c873; color: #2b1906;
  background: linear-gradient(180deg, #f6cf7a, var(--gold) 55%, #c58a2c); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.35); }
.ps-buy:disabled { cursor: default; background: linear-gradient(180deg, rgba(239,229,210,0.09), rgba(239,229,210,0.04)); border-color: rgba(239,229,210,0.22); color: #cdbf9f; box-shadow: none; }
.ps-adult { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; font-size: 12.5px; color: var(--ash); }
.ps-adult span { flex: none; display: inline-grid; place-items: center; min-width: 36px; height: 24px; border-radius: 6px; border: 1.5px solid #e0644b; color: #ff9a85; font-weight: 800; font-size: 12px; }
@media (prefers-reduced-motion: reduce) {
  .pa-medal, .ps-xp-fill, .ps-next-art .pa-art, .ps-tier.is-supreme, .ps-badge.is-sale, .ps-tier-art svg { animation: none !important; }
  .ps-tier:hover { transform: none; }
}
@media (max-width: 720px) {
  .ps-status { flex-direction: column; align-items: stretch; }
  .ps-medal { align-self: center; }
}
`;
