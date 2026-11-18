import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { loadSave } from "@/engine/SaveSystem";
import { claimAllFreePassLevels, claimFreePassLevel, getPassView } from "@/engine/SeasonPassService";
import { freeRewardForLevel, PASS_LEVELS, PASS_XP, PREMIUM_PASS_PRICE_BRL, premiumRewardForLevel, SUPREME_PASS_PRICE_BRL, supremeOnSale, supremeRewardForLevel, type PassReward } from "@/config/seasonPass";
import { formatDurationShort } from "@/utils/formatDuration";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { PURCHASE_MIN_AGE } from "@/config/ageGate";
import { seasonClock } from "@/engine/SeasonClock";
import { RewardPartsLabel, REWARD_CSS } from "./RewardPartsLabel";
import { RewardArt, rewardGlow } from "./PassArt";

/**
 * The Season Pass track on the Season page: 30 levels, the free reward on
 * top (claimable once reached), the premium reward underneath (locked until
 * real payments exist — shown so players know what's coming).
 */
/** Fired after a claim so other parts of the page (the PASSE dot in the top nav) refresh. */
export const PASS_CHANGED_EVENT = "hn-pass-changed";

export function SeasonPassSection({ showTitle = true }: { showTitle?: boolean } = {}) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [tick, setTick] = useState(0);
  const view = useMemo(() => getPassView(loadSave()), [tick]);
  const levels = Array.from({ length: PASS_LEVELS }, (_, i) => i + 1);
  const brl = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(PREMIUM_PASS_PRICE_BRL);

  const supremeBrl = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(SUPREME_PASS_PRICE_BRL);
  const save = loadSave();
  const seasonWindow = seasonClock.getCurrentSeasonWindow();
  const season = seasonWindow.seasonNumber;
  const supremeLeft = supremeOnSale(seasonWindow, seasonClock.now());
  const label = (r: PassReward) => <RewardPartsLabel parts={r} currentWave={save.currentWave} />;
  const trackRef = useRef<HTMLDivElement>(null);
  const fillPct = Math.min(100, ((Math.min(view.level, PASS_LEVELS) - 1 + (view.level >= PASS_LEVELS ? 1 : view.xpIntoLevel / view.xpPerLevel)) / (PASS_LEVELS - 1)) * 100);

  // open the track on the player's current level
  useEffect(() => {
    const el = trackRef.current?.querySelector<HTMLElement>(".sp-col.is-next, .sp-col.is-reached:last-of-type");
    const track = trackRef.current;
    if (el && track) track.scrollLeft = Math.max(0, el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2);
  }, []);
  const scrollBy = (dir: number) => trackRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
  const claim = (fn: () => void) => {
    fn();
    setTick((n) => n + 1);
    window.dispatchEvent(new Event(PASS_CHANGED_EVENT));
  };

  return (
    <section className="sp" aria-labelledby="sp-title">
      <style>{PASS_CSS + REWARD_CSS}</style>
      <div className="pg-head sp-head">
        <h2 className={showTitle ? "pg-h2" : "pg-h2 sp-title-hidden"} id="sp-title">
          {t("pass.title")}
        </h2>
        {!showTitle && <h2 className="pg-h2 sp-track-title">{t("pass.trackTitle")}</h2>}
        <div className="sp-head-tools">
          {view.claimable.length > 0 && (
            <button className="sp-claim-all" data-testid="pass-claim-all" onClick={() => claim(() => claimAllFreePassLevels())}>
              {t("pass.claimAll", { n: view.claimable.length })}
            </button>
          )}
          <button className="sp-arrow" aria-label="◀" onClick={() => scrollBy(-1)}>
            ‹
          </button>
          <button className="sp-arrow" aria-label="▶" onClick={() => scrollBy(1)}>
            ›
          </button>
        </div>
      </div>
      <p className="pg-sub">{t("pass.sub", { wave: PASS_XP.WAVE_CLEARED, mini: PASS_XP.MINI_BOSS, boss: PASS_XP.MAIN_BOSS, mission: PASS_XP.MISSION_CLAIMED })}</p>

      <div className="sp-progress">
        <strong data-testid="pass-level">{t("pass.level", { level: view.level, max: PASS_LEVELS })}</strong>
        <div className="sp-xpbar">
          <div className="sp-xpbar-fill" style={{ width: `${view.level >= PASS_LEVELS ? 100 : (view.xpIntoLevel / view.xpPerLevel) * 100}%` }} />
        </div>
        <span>{view.level >= PASS_LEVELS ? t("pass.complete") : t("pass.xp", { xp: view.xpIntoLevel, need: view.xpPerLevel })}</span>
      </div>

      <div className="sp-frame">
        <div className="sp-labels" aria-hidden="true">
          <span />
          <span className="is-free">{t("pass.freeTrack")}</span>
          <span className="is-premium">{t("pass.premiumTrack")}</span>
          <span className="sp-supreme-label">{t("pass.supremeTrack")}</span>
        </div>
        <div className="sp-track" role="list" ref={trackRef}>
          <div className="sp-rail" aria-hidden="true">
            <div className="sp-rail-fill" style={{ width: `${Math.max(0, fillPct)}%` }} />
          </div>
          {levels.map((level) => {
            const reached = level <= view.level;
            const claimed = view.claimedFree.has(level);
            const milestone = level % 5 === 0;
            const free = freeRewardForLevel(level);
            const premium = premiumRewardForLevel(level, season);
            const supreme = supremeRewardForLevel(level);
            const glow = (r: PassReward) => {
              const c = rewardGlow(r);
              return c ? ({ ["--glow" as string]: c } as CSSProperties) : undefined;
            };
            return (
              <div
                key={level}
                role="listitem"
                className={`sp-col${reached ? " is-reached" : ""}${level === view.level + 1 ? " is-next" : ""}${milestone ? " is-milestone" : ""}`}
              >
                <span className="sp-num">
                  <b>{level}</b>
                </span>
                <div className={`sp-cell is-free${claimed ? " is-claimed" : ""}${reached && !claimed ? " is-ready" : ""}${glow(free) ? " has-glow" : ""}`} style={glow(free)}>
                  <RewardArt reward={free} size={milestone ? 50 : 44} />
                  <span className="sp-label">{label(free)}</span>
                  {reached && !claimed && (
                    <button className="sp-claim" data-testid={`pass-claim-${level}`} onClick={() => claim(() => claimFreePassLevel(level))}>
                      {t("pass.claim")}
                    </button>
                  )}
                  {claimed && <span className="sp-done">✓ {t("pass.claimed")}</span>}
                </div>
                <div className={`sp-cell is-premium${glow(premium) ? " has-glow" : ""}`} style={glow(premium)}>
                  <span className="sp-lock" aria-hidden="true">🔒</span>
                  <RewardArt reward={premium} size={milestone ? 50 : 44} />
                  <span className="sp-label">{label(premium)}</span>
                </div>
                <div className={`sp-cell is-premium is-supreme${glow(supreme) ? " has-glow" : ""}`} style={glow(supreme)} data-testid={`pass-supreme-${level}`}>
                  <span className="sp-lock" aria-hidden="true">🔒</span>
                  <RewardArt reward={supreme} size={milestone ? 50 : 44} />
                  <span className="sp-label">{label(supreme)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="sp-notes">
        <p className="pg-note">{t("pass.boundNote")}</p>
        <p className="pg-note">{REAL_MONEY_PAYMENTS_ENABLED ? t("pass.premiumOn", { price: brl }) : t("pass.premiumSoon", { price: brl })}</p>
        <p className="pg-note sp-supreme-note" data-testid="pass-supreme-note">
          {supremeLeft !== null ? t("pass.supremeOnSale", { price: supremeBrl, time: formatDurationShort(supremeLeft) }) : t("pass.supremeOffSale", { price: supremeBrl })}
        </p>
        <p className="pg-note">{t("pass.adultOnly", { age: PURCHASE_MIN_AGE })}</p>
      </div>
    </section>
  );
}

const PASS_CSS = `
.sp-title-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sp { padding: 44px 0 8px; }
.sp-head { align-items: center; }
.sp-head-tools { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.sp-claim-all { padding: 9px 18px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 13.5px; border: 1px solid #f2c873; color: #2b1906; background: linear-gradient(180deg, #f6cf7a, var(--gold) 55%, #c58a2c); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.35), 0 0 16px rgba(255,208,106,0.35); animation: sp-ready 2s ease-in-out infinite; }
.sp-arrow { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 22px; line-height: 1; color: var(--gold-hi); background: rgba(0,0,0,0.35); border: 1px solid rgba(232,176,75,0.4); transition: background 160ms ease, transform 140ms ease; }
.sp-arrow:hover { background: rgba(232,176,75,0.15); }
.sp-arrow:active { transform: scale(0.94); }
.sp-progress { display: flex; align-items: center; gap: 16px; margin: 6px 0 18px; font-size: 13.5px; color: var(--ash); max-width: 680px; }
.sp-progress strong { font-family: var(--display); font-size: 24px; color: var(--gold-hi); white-space: nowrap; }
.sp-progress span { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--bone); }
.sp-xpbar { flex: 1; height: 10px; border-radius: 999px; background: rgba(0,0,0,0.45); box-shadow: inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,176,75,0.25); overflow: hidden; }
.sp-xpbar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b07a20, #ffd06a 70%, #fff3c4); box-shadow: 0 0 10px rgba(255,208,106,0.6); position: relative; transform-origin: left; animation: hn-grow-x 900ms var(--hn-ease-out) 200ms backwards; }
.sp-xpbar-fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: sp-run 2.4s ease-in-out infinite; }
@keyframes sp-run { from { background-position: -40% 0; } to { background-position: 140% 0; } }

/* the track sits in a framed panel; labels stay pinned on the left */
.sp-frame { position: relative; display: flex; border-radius: 16px; padding: 12px 0 12px 12px;
  background: linear-gradient(180deg, rgba(42,30,18,0.7), rgba(14,10,6,0.9)); border: 1px solid rgba(232,176,75,0.25); box-shadow: inset 0 1px 0 rgba(255,236,190,0.08), 0 14px 30px rgba(0,0,0,0.35); }
.sp-labels { display: grid; grid-template-rows: 40px 132px 132px 132px; gap: 8px; flex: 0 0 86px; padding-right: 10px; border-right: 1px solid rgba(232,176,75,0.18); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.sp-labels span { display: flex; align-items: center; }
.sp-labels .is-free { color: var(--bone); }
.sp-labels .is-premium { color: #8fd0ff; }
.sp-supreme-label { color: #ffb36b; }
.sp-track { position: relative; display: flex; gap: 8px; overflow-x: auto; padding: 0 12px 10px 12px; scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: rgba(232,176,75,0.4) transparent; }
.sp-rail { position: absolute; left: 72px; top: 19px; width: calc(29 * 128px); height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); }
.sp-rail-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b07a20, #ffd06a); box-shadow: 0 0 8px rgba(255,208,106,0.6); }
.sp-col { position: relative; display: grid; grid-template-rows: 40px 132px 132px 132px; gap: 8px; flex: 0 0 120px; }
.sp-num { display: flex; align-items: center; justify-content: center; }
.sp-num b { position: relative; z-index: 1; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; font-family: var(--display); font-weight: 700; font-size: 15px; color: var(--ash-2);
  background: #1a120a; border: 2px solid rgba(255,255,255,0.12); }
.sp-col.is-milestone .sp-num b { width: 36px; height: 36px; font-size: 16px; background: transparent !important; border: none !important; box-shadow: none !important; }
.sp-col.is-milestone .sp-num b::before { content: ""; position: absolute; inset: 3px; z-index: -1; transform: rotate(45deg); border-radius: 6px; background: #1a120a; border: 2px solid rgba(232,176,75,0.55); }
.sp-col.is-milestone.is-reached .sp-num b::before { background: linear-gradient(180deg, #fff0b8, #e0a43a); border-color: #fff0b8; box-shadow: 0 0 12px rgba(255,208,106,0.7); }
.sp-col.is-milestone.is-next .sp-num b::before { border-color: var(--gold-hi); }
.sp-col.is-reached .sp-num b { color: #2b1906; background: linear-gradient(180deg, #fff0b8, #e0a43a); border-color: #fff0b8; box-shadow: 0 0 10px rgba(255,208,106,0.6); }
.sp-col.is-next .sp-num b { color: var(--bone); border-color: var(--gold-hi); animation: sp-next 1.6s ease-in-out infinite; }
@keyframes sp-next { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,208,106,0.6); } 50% { box-shadow: 0 0 0 6px rgba(255,208,106,0); } }
.sp-col.is-milestone .sp-num b > * , 
.sp-cell { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; border-radius: 12px; text-align: center; color: var(--bone); font-size: 11.5px; line-height: 1.25;
  background: radial-gradient(70% 55% at 50% 35%, rgba(255,214,150,0.09), transparent 70%), linear-gradient(180deg, #241a10, #150e08);
  border: 1px solid rgba(232,176,75,0.18); transition: transform 200ms var(--hn-ease-out), border-color 180ms ease, box-shadow 200ms ease; }
.sp-cell:hover { transform: translateY(-3px); border-color: rgba(232,176,75,0.5); }
.sp-cell.has-glow { border-color: color-mix(in srgb, var(--glow) 55%, transparent); box-shadow: inset 0 0 18px color-mix(in srgb, var(--glow) 18%, transparent); }
.sp-col.is-milestone .sp-cell.is-free { background: radial-gradient(70% 55% at 50% 35%, rgba(255,214,150,0.16), transparent 70%), linear-gradient(180deg, #2c1f12, #170f08); }
.sp-cell.is-premium { background: radial-gradient(70% 55% at 50% 35%, rgba(120,190,255,0.10), transparent 70%), linear-gradient(180deg, #161d28, #0e1219); border-color: rgba(92,192,255,0.2); }
.sp-cell.is-supreme { background: radial-gradient(70% 55% at 50% 35%, rgba(255,170,90,0.14), transparent 70%), linear-gradient(180deg, #2a1a10, #140c07); border-color: rgba(255,170,90,0.28); }
.sp-cell.is-premium.has-glow { border-color: color-mix(in srgb, var(--glow) 55%, transparent); }
.sp-cell.is-ready { border-color: var(--gold-hi); box-shadow: 0 0 0 1px rgba(255,208,106,0.4), 0 0 18px rgba(255,208,106,0.25); animation: sp-ready 2s ease-in-out infinite; }
@keyframes sp-ready { 0%, 100% { box-shadow: 0 0 0 1px rgba(255,208,106,0.4), 0 0 12px rgba(255,208,106,0.2); } 50% { box-shadow: 0 0 0 1px rgba(255,208,106,0.7), 0 0 24px rgba(255,208,106,0.45); } }
.sp-cell.is-claimed .pa-art { opacity: 0.45; filter: grayscale(0.6); }
.sp-cell.is-claimed .sp-label { opacity: 0.55; }
.sp-label { max-width: 100%; }
.sp-label > span { display: block; }
.sp-lock { position: absolute; top: 5px; right: 6px; font-size: 10px; opacity: 0.55; }
.pa-art { position: relative; display: inline-flex; align-items: flex-end; justify-content: center; height: 60px; transition: transform 260ms var(--hn-ease-back); }
.sp-col.is-milestone .pa-art { height: 66px; }
.pa-main { display: inline-flex; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55)); }
.pa-main canvas { display: block; margin-bottom: -10px; }
.pa-extra { position: absolute; right: -14px; bottom: -2px; display: inline-flex; padding: 2px; border-radius: 50%; background: #1a120a; box-shadow: 0 0 0 1px rgba(232,176,75,0.35); }
.pa-extra + .pa-extra { right: auto; left: -14px; }
.sp-cell:hover .pa-art { transform: translateY(-3px) scale(1.06); }
.sp-claim { margin-top: 2px; padding: 4px 12px; border-radius: 8px; cursor: pointer; font-size: 11.5px; font-weight: 800; border: 1px solid #fff0b8; color: #2b1906 !important; background: linear-gradient(180deg, #fff0b8, #e0a43a); box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.sp-claim:hover { filter: brightness(1.08); }
.sp-done { font-size: 11px; color: var(--ok); font-weight: 700; }
.sp-notes { margin-top: 14px; display: grid; gap: 2px; max-width: 760px; }
.sp-supreme-note { color: #ffcf9a !important; }
@media (prefers-reduced-motion: reduce) {
  .sp-xpbar-fill, .sp-xpbar-fill::after, .sp-col.is-next .sp-num b, .sp-cell.is-ready { animation: none !important; }
  .sp-cell:hover, .sp-cell:hover .pa-art { transform: none; }
}
@media (max-width: 720px) {
  .sp-labels { flex-basis: 64px; font-size: 10.5px; }
  .sp-head-tools .sp-arrow { display: none; }
}
`;
