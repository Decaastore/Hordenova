import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { loadSave } from "@/engine/SaveSystem";
import { claimAllFreePassLevels, claimFreePassLevel, getPassView } from "@/engine/SeasonPassService";
import { freeRewardForLevel, PASS_LEVELS, PASS_XP, PREMIUM_PASS_PRICE_BRL, premiumRewardForLevel, type PassReward } from "@/config/seasonPass";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { seasonClock } from "@/engine/SeasonClock";
import { RewardPartsLabel, REWARD_CSS } from "./RewardPartsLabel";

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

  const save = loadSave();
  const season = seasonClock.getCurrentSeasonWindow().seasonNumber;
  const reward = (r: PassReward) => <RewardPartsLabel parts={r} currentWave={save.currentWave} />;

  return (
    <section className="sp" aria-labelledby="sp-title">
      <style>{PASS_CSS + REWARD_CSS}</style>
      <div className="pg-head">
        <h2 className={showTitle ? "pg-h2" : "pg-h2 sp-title-hidden"} id="sp-title">
          {t("pass.title")}
        </h2>
        {view.claimable.length > 0 && (
          <button
            className="pg-btn sp-claim-all"
            data-testid="pass-claim-all"
            onClick={() => {
              claimAllFreePassLevels();
              setTick((n) => n + 1);
              window.dispatchEvent(new Event(PASS_CHANGED_EVENT));
            }}
          >
            {t("pass.claimAll", { n: view.claimable.length })}
          </button>
        )}
      </div>
      <p className="pg-sub">{t("pass.sub", { wave: PASS_XP.WAVE_CLEARED, mini: PASS_XP.MINI_BOSS, boss: PASS_XP.MAIN_BOSS, mission: PASS_XP.MISSION_CLAIMED })}</p>

      <div className="sp-progress">
        <strong data-testid="pass-level">{t("pass.level", { level: view.level, max: PASS_LEVELS })}</strong>
        <div className="pg-progress-track" style={{ flex: 1 }}>
          <div className="pg-progress-fill" style={{ width: `${(view.xpIntoLevel / view.xpPerLevel) * 100}%` }} />
        </div>
        <span>{view.level >= PASS_LEVELS ? t("pass.complete") : t("pass.xp", { xp: view.xpIntoLevel, need: view.xpPerLevel })}</span>
      </div>

      <div className="sp-track" role="list">
        <div className="sp-labels" aria-hidden="true">
          <span />
          <span>{t("pass.freeTrack")}</span>
          <span>{t("pass.premiumTrack")}</span>
        </div>
        {levels.map((level) => {
          const reached = level <= view.level;
          const claimed = view.claimedFree.has(level);
          return (
            <div key={level} role="listitem" className={`sp-col${reached ? " is-reached" : ""}${level === view.level + 1 ? " is-next" : ""}`}>
              <span className="sp-num">{level}</span>
              <div className={`sp-cell${claimed ? " is-claimed" : ""}`}>
                {reward(freeRewardForLevel(level))}
                {reached && !claimed && (
                  <button
                    className="sp-claim"
                    data-testid={`pass-claim-${level}`}
                    onClick={() => {
                      claimFreePassLevel(level);
                      setTick((n) => n + 1);
              window.dispatchEvent(new Event(PASS_CHANGED_EVENT));
                    }}
                  >
                    {t("pass.claim")}
                  </button>
                )}
                {claimed && <span className="sp-done">{t("pass.claimed")}</span>}
              </div>
              <div className="sp-cell is-premium">{reward(premiumRewardForLevel(level, season))}</div>
            </div>
          );
        })}
      </div>
      <p className="pg-note">{t("pass.boundNote")}</p>
      <p className="pg-note">{REAL_MONEY_PAYMENTS_ENABLED ? t("pass.premiumOn", { price: brl }) : t("pass.premiumSoon", { price: brl })}</p>
    </section>
  );
}

const PASS_CSS = `
.sp-title-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sp { padding: 44px 0 8px; border-bottom: 1px solid var(--line); }
.sp-claim-all { padding: 10px 20px; font-size: 14px; }
.sp-progress { display: flex; align-items: center; gap: 16px; margin: 4px 0 18px; font-size: 13.5px; color: var(--ash); max-width: 640px; }
.sp-progress strong { font-family: var(--display); font-size: 24px; color: var(--gold-hi); white-space: nowrap; }
.sp-progress span { white-space: nowrap; font-variant-numeric: tabular-nums; }
.sp-track { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: thin; }
.sp-labels { position: sticky; left: 0; z-index: 1; display: grid; grid-template-rows: 22px 96px 96px; gap: 6px; flex: 0 0 72px; padding-right: 6px; background: var(--night); font-size: 12px; color: var(--ash); }
.sp-labels span { display: flex; align-items: center; }
.sp-col { display: grid; grid-template-rows: 22px 96px 96px; gap: 6px; flex: 0 0 112px; }
.sp-num { display: flex; align-items: center; justify-content: center; font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--ash-2); }
.sp-col.is-reached .sp-num { color: var(--gold-hi); }
.sp-col.is-next .sp-num { color: var(--bone); text-decoration: underline; text-decoration-color: var(--gold); text-underline-offset: 4px; }
.sp-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px; border-radius: 9px; background: var(--night-2); border: 1px solid var(--line-soft); font-size: 12.5px; text-align: center; color: var(--bone); }
.sp-col.is-reached .sp-cell:not(.is-premium) { border-color: rgba(232,176,75,0.45); }
.sp-cell.is-claimed { opacity: 0.55; }
.sp-cell.is-premium { color: var(--ash); background: rgba(24,18,12,0.4); border-style: dashed; }
.sp-cell.is-premium > span { opacity: 0.85; }
.sp-claim { margin-top: 2px; padding: 3px 10px; border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 800; border: 1px solid #f2c873; color: #2b1906 !important; background: var(--gold); }
.sp-done { font-size: 11.5px; color: var(--ok); font-weight: 600; }
`;
