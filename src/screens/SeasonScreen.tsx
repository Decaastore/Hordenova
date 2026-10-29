import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus, resetSeasonProgressionForTesting, syncSeasonIfNeeded } from "@/engine/AscensionManager";
import { SEASON_DURATION_MS } from "@/engine/SeasonClock";
import { getPhaseForWave } from "@/config/phaseConfig";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import { canUnlockPrestige, getPrestigeBonuses, getPrestigeTier, getPrestigeUpgradeDualPrice, PRESTIGE_MIN_BEST_WAVE } from "@/config/prestige";
import { getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";
import { formatDurationShort } from "@/utils/formatDuration";
import { TopNav, type NavView } from "@/ui/TopNav";
import { AscensionPanel } from "@/ui/AscensionPanel";
import { PAGE_CSS } from "@/ui/pageChrome";

interface SeasonScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Backdrop art for each season theme — the biome that best matches its name. */
const THEME_ART: Record<string, string> = {
  THE_HOLLOW_KING: "ancient_forest",
  EMBERS_OF_WAR: "volcanic_wastes",
  FROZEN_REIGN: "frozen_tundra",
  STORMFALL: "floating_isles",
};

const RANKS: AscensionRank[] = [1, 2, 3, 4, 5];

/**
 * SEASON — the pre-game hub (Home → Play → Season → run). Answers "what's
 * happening now and what do I need to compete": the season's theme and
 * time left, the player's own season score, Prestige and records, and what
 * the top five will earn. No backend yet, so nothing about other players
 * is ever invented (same stance as RankingScreen.tsx).
 */
export function SeasonScreen({ onNavigate, onPlay }: SeasonScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [panelOpen, setPanelOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    syncSeasonIfNeeded();
    setRefreshTick((n) => n + 1);
  }, []);

  const save = useMemo(() => loadSave(), [refreshTick]);
  const status = useMemo(() => getAscensionStatus(), [refreshTick]);
  const elapsed = Math.max(0, SEASON_DURATION_MS - status.timeRemainingMs);
  const progress = Math.min(1, elapsed / SEASON_DURATION_MS);
  const totalDays = Math.round(SEASON_DURATION_MS / DAY_MS);
  const day = Math.min(totalDays, Math.floor(elapsed / DAY_MS) + 1);
  const bestPhase = getPhaseForWave(Math.max(1, status.seasonBestWave));
  const tier = getPrestigeTier(save.prestigeLevel);
  const tierName = t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : "");
  const nextPrice = getPrestigeUpgradeDualPrice(save.prestigeLevel);
  const bonuses = getPrestigeBonuses(save.prestigeLevel);
  const goldBonus = Math.round((bonuses.goldMultiplier - 1) * 1000) / 10;
  const shardBonus = Math.round((bonuses.gemShardMultiplier - 1) * 1000) / 10;
  const theme = t(`ascension.seasonThemes.${status.themeNameKey}` as TranslationKey);
  const score = t("hud.phaseWaveValue", { phase: phaseNumberFromWave(Math.max(1, status.seasonBestWave)), onda: waveInPhase(Math.max(1, status.seasonBestWave)) });
  const art = THEME_ART[status.themeNameKey] ?? "ancient_forest";
  const inRun = save.currentWave > 0 && save.towerLoadout.length > 0;

  return (
    <div className="pg-root">
      <style>{PAGE_CSS}</style>
      <TopNav active="SEASON" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-art" style={{ backgroundImage: `url(${assetBase}sprites/ground/${art}.webp)` }} aria-hidden="true" />
          <div className="pg-hero-inner">
            <div>
              <p className="pg-kicker">{t("season.kicker", { number: status.seasonNumber })}</p>
              <h1 className="pg-h1">{theme}</h1>
              <div className="pg-progress">
                <div className="pg-progress-track">
                  <div className="pg-progress-fill" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
                </div>
                <div className="pg-progress-label">
                  <span>{t("season.dayOf", { day, total: totalDays })}</span>
                  <strong>{t("season.endsIn", { time: formatDurationShort(status.timeRemainingMs) })}</strong>
                </div>
              </div>
              <div className="pg-actions">
                <button className="pg-btn" onClick={onPlay}>
                  {inRun ? t("season.continueRun", { wave: save.currentWave }) : t("season.startRun")}
                </button>
                <button className="pg-btn-ghost" onClick={() => setPanelOpen(true)}>
                  {t("season.collectionCta")}
                </button>
              </div>
            </div>
            <dl className="pg-score">
              <dt>{t("ranking.yourSeasonScore")}</dt>
              <dd>{status.hasParticipated ? score : "—"}</dd>
              <p>{status.hasParticipated ? t("ranking.scoreBasis") : t("season.notYetParticipating")}</p>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <dl className="pg-figures">
            <div>
              <dt>{t("season.bestPhase")}</dt>
              <dd>{t(`phases.${bestPhase.i18nKey}.name` as TranslationKey)}</dd>
            </div>
            <div>
              <dt>{t("season.bossesDefeated")}</dt>
              <dd>{save.bossesDefeatedTotal.toLocaleString(locale)}</dd>
            </div>
            <div>
              <dt>{t("season.figSeasonsWon")}</dt>
              <dd>{save.ascensionSeasonsWon}</dd>
            </div>
            <div>
              <dt>{t("season.figTop3")}</dt>
              <dd>{save.ascensionTop3}</dd>
            </div>
            <div>
              <dt>{t("season.figTop5")}</dt>
              <dd>{save.ascensionTop5}</dd>
            </div>
          </dl>

          <div className="pg-cols">
            <section>
              <h2 className="pg-h2">{t("season.rewardsTitle")}</h2>
              <p className="pg-sub">{t("season.rewardsSub")}</p>
              <div className="pg-table-wrap">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("season.rankCol")}</th>
                      <th scope="col">{t("season.titleCol")}</th>
                      <th scope="col" className="is-num">
                        {t("season.gemsCol")}
                      </th>
                      <th scope="col">{t("season.rewardsCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RANKS.map((rank) => {
                      const bundle = getSeasonRewardBundle(status.seasonNumber, rank);
                      return (
                        <tr key={rank}>
                          <th scope="row">#{rank}</th>
                          <td>{t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)}</td>
                          <td className="is-num">{bundle.gems.toLocaleString(locale)}</td>
                          <td style={{ whiteSpace: "normal" }}>{bundle.cosmetics.length > 0 ? bundle.cosmetics.map((c) => t(`ascension.cosmeticTypes.${c.type}` as TranslationKey)).join(", ") : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="pg-note">{t("ascension.topFive.honestNote")}</p>
            </section>

            <aside className="pg-aside">
              <div className="pg-block">
                <h3>{t("season.standingTitle")}</h3>
                <p>{t("season.standingBody")}</p>
                <button className="pg-link" onClick={() => onNavigate("RANKING")}>
                  {t("season.rankingCta")}
                </button>
              </div>
              <div className="pg-block">
                <h3>
                  {t("season.prestigeTitle")}
                  <span className="pg-pill" style={{ color: tier.color, borderColor: tier.color }}>
                    {tierName}
                  </span>
                </h3>
                <p>{t("prestige.levelPlain", { level: save.prestigeLevel })}</p>
                <p>{goldBonus > 0 || shardBonus > 0 ? t("season.prestigeBonus", { gold: goldBonus, shards: shardBonus }) : t("season.prestigeNone")}</p>
                <p>
                  {canUnlockPrestige(save.bestWave)
                    ? t("season.prestigeNext", { purchased: nextPrice.purchased.toLocaleString(locale), free: nextPrice.free.toLocaleString(locale) })
                    : t("prestige.locked.requirement", { required: PRESTIGE_MIN_BEST_WAVE, bestWave: save.bestWave })}
                </p>
              </div>
            </aside>
          </div>

          {/* Tester-only full season reset, confirm-gated before any save write. */}
          <details className="pg-danger" style={{ marginBottom: 64 }}>
            <summary>{t("season.testingTitle")}</summary>
            <p>{t("season.testingReset.confirm")}</p>
            {confirmingReset ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="pg-danger-btn is-solid"
                  onClick={() => {
                    resetSeasonProgressionForTesting();
                    setConfirmingReset(false);
                    setRefreshTick((n) => n + 1);
                  }}
                >
                  {t("season.testingReset.confirmYes")}
                </button>
                <button className="pg-danger-btn" style={{ borderColor: "var(--line)", color: "var(--ash)" }} onClick={() => setConfirmingReset(false)}>
                  {t("season.testingReset.confirmNo")}
                </button>
              </div>
            ) : (
              <button className="pg-danger-btn" onClick={() => setConfirmingReset(true)}>
                {t("season.testingReset.button")}
              </button>
            )}
          </details>
        </div>
      </div>

      {panelOpen && <AscensionPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
