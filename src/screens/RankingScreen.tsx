import { useEffect, useMemo, useState } from "react";
import { PlayerProfilePanel } from "@/ui/PlayerProfilePanel";
import { getProfileService, type LeaderboardEntry } from "@/profile/profileService";
import { useLanguage } from "@/i18n/LanguageContext";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus } from "@/engine/AscensionManager";
import { getPrestigeTier } from "@/config/prestige";
import { getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";

interface RankingScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const REWARD_RANKS: AscensionRank[] = [1, 2, 3, 4, 5];
/** Bands the full leaderboard will be split into once a server exists. */
const BANDS = ["#6–10", "#11–25", "#26–50"];

/**
 * RANKING — the Season leaderboard (profiles open on click, see
 * PlayerProfilePanel) plus the player's own score and what each top rank
 * earns. HONESTY: HORDENOVA has no backend yet, so offline the board lists
 * only the local player and the position block says so — no other player,
 * name or position is ever invented. With VITE_PROFILE_API_URL set, the
 * same table fills from the server (profile/profileService.ts).
 */
export function RankingScreen({ onNavigate, onPlay }: RankingScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const save = useMemo(() => loadSave(), []);
  const status = useMemo(() => getAscensionStatus(), []);
  const profiles = getProfileService();
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null | "error">(null);

  useEffect(() => {
    let alive = true;
    // Keep the player's own public snapshot fresh on the server (no-op offline).
    void profiles.publishMyProfile().catch(() => undefined);
    profiles
      .getLeaderboard(50)
      .then((rows) => alive && setLeaderboard(rows))
      .catch(() => alive && setLeaderboard("error"));
    return () => {
      alive = false;
    };
  }, [openProfileId === null]);

  const waveLabel = (wave: number) => t("hud.phaseWaveValue", { phase: phaseNumberFromWave(Math.max(1, wave)), onda: waveInPhase(Math.max(1, wave)) });
  const tierName = (level: number) => {
    const tier = getPrestigeTier(level);
    return { name: t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : ""), color: tier.color };
  };

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + RANKING_CSS}</style>
      <TopNav active="RANKING" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <p className="pg-kicker">{t("season.kicker", { number: status.seasonNumber })}</p>
              <h1 className="pg-h1">{t("ranking.pageTitle")}</h1>
              <p className="pg-lead">{t("ranking.lead")}</p>
            </div>
            <dl className="pg-score">
              <dt>{t("ranking.yourSeasonScore")}</dt>
              <dd>{status.hasParticipated ? waveLabel(status.seasonBestWave) : "—"}</dd>
              <p>{status.hasParticipated ? t("ranking.scoreBasis") : t("season.notYetParticipating")}</p>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <div className="pg-cols">
            <section>
              <div className="pg-head">
                <h2 className="pg-h2">{t("profile.leaderboardTitle")}</h2>
                <button className="pg-btn-ghost rk-mine" onClick={() => setOpenProfileId(profiles.getMyProfile().playerId)}>
                  {t("ranking.viewMyProfile")}
                </button>
              </div>
              {leaderboard === null && <p className="pg-note">{t("profile.leaderboardLoading")}</p>}
              {leaderboard === "error" && <p className="pg-note">{t("profile.leaderboardError")}</p>}
              {Array.isArray(leaderboard) && (
                <div className="pg-table-wrap">
                  <table className="pg-table rk-table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">{t("ranking.playerCol")}</th>
                        <th scope="col">{t("ranking.prestigeCol")}</th>
                        <th scope="col" className="is-num">
                          {t("ranking.bestCol")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row) => {
                        const isMe = row.playerId === save.playerId;
                        const tier = tierName(row.prestigeLevel);
                        return (
                          <tr key={row.playerId} className={isMe ? "is-me" : ""} onClick={() => setOpenProfileId(row.playerId)}>
                            <th scope="row">{row.rank}</th>
                            <td>
                              <button className="rk-name" onClick={() => setOpenProfileId(row.playerId)} title={t("profile.open")}>
                                {row.displayName}
                              </button>
                              {isMe && <span className="rk-you">{t("ranking.you")}</span>}
                            </td>
                            <td>
                              <span style={{ color: tier.color }}>{tier.name}</span> <span className="rk-dim">{row.prestigeLevel}</span>
                            </td>
                            <td className="is-num">{row.seasonBestWave > 0 ? waveLabel(row.seasonBestWave) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!profiles.online && <p className="pg-note">{t("profile.leaderboardOfflineNote")}</p>}
            </section>

            <aside className="pg-aside">
              <div className="pg-block">
                <h3>{t("ranking.yourPosition")}</h3>
                <p>{profiles.online ? t("ranking.positionOnline") : t("ranking.positionOffline")}</p>
              </div>
              <div className="pg-block">
                <h3>{t("ranking.rewardsTitle")}</h3>
                <ol className="rk-rewards">
                  {REWARD_RANKS.map((rank) => {
                    const bundle = getSeasonRewardBundle(status.seasonNumber, rank);
                    return (
                      <li key={rank}>
                        <span className="rk-rank">#{rank}</span>
                        <span className="rk-title">{t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)}</span>
                        <span className="rk-gems">{t("ranking.gemsValue", { gems: bundle.gems.toLocaleString(locale) })}</span>
                      </li>
                    );
                  })}
                </ol>
                <p>{t("ranking.bandsNote", { bands: BANDS.join(", ") })}</p>
                <button className="pg-link" onClick={() => onNavigate("SEASON")}>
                  {t("ranking.seasonCta")}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {openProfileId && <PlayerProfilePanel playerId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}

const RANKING_CSS = `
.rk-mine { padding: 9px 16px; font-size: 14px; }
.rk-table tbody tr { cursor: pointer; }
.rk-table tbody tr:hover td, .rk-table tbody tr:hover th { background: rgba(239,229,210,0.03); }
.rk-table tbody tr.is-me td, .rk-table tbody tr.is-me th { background: rgba(232,176,75,0.08); }
.rk-table tbody th { width: 56px; }
.rk-name { padding: 0; background: none; border: none; cursor: pointer; font-weight: 600; font-size: 15px; color: var(--bone); text-align: left; }
.rk-name:hover { color: var(--gold-hi); text-decoration: underline; text-underline-offset: 3px; }
.rk-you { margin-left: 10px; font-size: 12px; font-weight: 700; color: var(--gold); }
.rk-dim { color: var(--ash-2); font-size: 13px; }
.rk-rewards { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1px solid var(--line-soft); }
.rk-rewards li { display: grid; grid-template-columns: 40px 1fr auto; align-items: baseline; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line-soft); }
.rk-rank { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--gold-hi); font-variant-numeric: lining-nums; }
.rk-title { font-size: 15px; }
.rk-gems { font-size: 14px; color: var(--ash); font-variant-numeric: tabular-nums; }
`;
