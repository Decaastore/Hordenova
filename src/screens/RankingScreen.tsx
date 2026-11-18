import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PlayerProfilePanel } from "@/ui/PlayerProfilePanel";
import { getProfileService, type LeaderboardEntry } from "@/profile/profileService";
import { useLanguage } from "@/i18n/LanguageContext";
import { ETERNAL_STORAGE_KEY, loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus } from "@/engine/AscensionManager";
import { getPrestigeTier } from "@/config/prestige";
import { getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import { rankFor } from "@/config/duel";
import { ACHIEVEMENTS, bestiaryStats } from "@/config/achievements";
import { ENEMY_TYPES } from "@/config/enemyStats";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { EMBLEM_COLOR } from "@/ui/hudIcons";
import { Medallion, type GameIconName } from "@/ui/gameIcons";
import { CrownArt } from "@/ui/StoreArt";

interface RankingScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const REWARD_RANKS: AscensionRank[] = [1, 2, 3, 4, 5];
/** Bands the full leaderboard will be split into once a server exists. */
const BANDS = ["#6–10", "#11–25", "#26–50"];
const ROMAN = ["", "I", "II", "III"];

type BoardId = "SEASON" | "ETERNAL" | "DUEL" | "COLOSSUS" | "RECORD" | "PRESTIGE" | "BOSSES" | "BESTIARY" | "ACHIEVEMENTS";

/** A bronze-and-enamel medallion (the same art as the game's top bar) for a ranking. */
function Emblem({ color, icon, big }: { color: string; icon: GameIconName; big?: boolean }) {
  return (
    <span className={`rk-emb${big ? " is-big" : ""}`} aria-hidden="true">
      <Medallion name={icon} color={color} size={big ? 64 : 32} />
    </span>
  );
}

/**
 * RANKING — every leaderboard of the game in one place: the Season (furthest wave this season),
 * the Eternal (deepest wave of the endless castle), the ranked Duel (trophies and league), the
 * Global Boss (biggest hit), the all-time record, Prestige, bosses defeated, the Bestiary and
 * Achievements. HONESTY: HORDENOVA has no ranking server yet, so offline every board lists only
 * the local player, with its real numbers, and says so — no other player, name or position is
 * ever invented. With VITE_PROFILE_API_URL set, the Season board fills from the server
 * (profile/profileService.ts); the others join it when the server ranks them too.
 */
export function RankingScreen({ onNavigate, onPlay }: RankingScreenProps) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const num = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const save = useMemo(() => loadSave(), []);
  const eternal = useMemo(() => loadSave(ETERNAL_STORAGE_KEY), []);
  const status = useMemo(() => getAscensionStatus(), []);
  const profiles = getProfileService();
  const me = profiles.getMyProfile();
  const [board, setBoard] = useState<BoardId>(() => {
    try {
      return (window.localStorage.getItem("hn.rankingBoard") as BoardId) || "SEASON";
    } catch {
      return "SEASON";
    }
  });
  const pick = (b: BoardId) => {
    setBoard(b);
    try {
      window.localStorage.setItem("hn.rankingBoard", b);
    } catch {
      /* per-viewer convenience only */
    }
  };
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
  const tierOf = (level: number) => {
    const tier = getPrestigeTier(level);
    return { name: t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : ""), color: tier.color };
  };
  const duelRank = rankFor(save.duel.trophies);
  const duelName = `${t(`duel.league.${duelRank.league}` as TranslationKey)}${duelRank.league === "MASTER" || duelRank.league === "LEGEND" ? "" : " " + ROMAN[duelRank.division]}`;
  const best = bestiaryStats(save.bestiaryKills);
  const myTier = tierOf(save.prestigeLevel);

  /** Every board: how it is measured, the player's own value, and a detail line. */
  const BOARDS: Record<BoardId, { color: string; glyph: GameIconName; value: string; has: boolean; detail: string }> = {
    SEASON: {
      color: "#e8b45a",
      glyph: "trophy" as GameIconName,
      value: status.hasParticipated ? waveLabel(status.seasonBestWave) : "—",
      has: status.hasParticipated,
      detail: status.hasParticipated ? t("ranking.scoreBasis") : t("season.notYetParticipating"),
    },
    ETERNAL: {
      color: EMBLEM_COLOR.eternal,
      glyph: "hourglass" as GameIconName,
      value: eternal.seasonBestWave > 0 ? t("ranking.boards.waveN", { n: num.format(eternal.seasonBestWave) }) : "—",
      has: eternal.seasonBestWave > 0,
      detail: t("ranking.boards.ETERNAL.detail"),
    },
    DUEL: {
      color: "#e2313f",
      glyph: "swords" as GameIconName,
      value: t("ranking.boards.trophiesN", { n: num.format(save.duel.trophies) }),
      has: save.duel.wins + save.duel.losses > 0,
      detail: t("ranking.boards.DUEL.detail", { rank: duelName, best: num.format(save.duel.bestTrophies), wins: num.format(save.duel.wins), losses: num.format(save.duel.losses) }),
    },
    COLOSSUS: {
      color: "#8a3ad0",
      glyph: "eye" as GameIconName,
      value: save.colossus.bestDamage > 0 ? num.format(Math.round(save.colossus.bestDamage)) : "—",
      has: save.colossus.bestDamage > 0,
      detail: t("ranking.boards.COLOSSUS.detail", { week: num.format(Math.round(save.colossus.weekDamage)) }),
    },
    RECORD: {
      color: EMBLEM_COLOR.city,
      glyph: "summit" as GameIconName,
      value: save.bestWave > 0 ? waveLabel(save.bestWave) : "—",
      has: save.bestWave > 0,
      detail: t("ranking.boards.RECORD.detail"),
    },
    PRESTIGE: {
      color: "#b07cff",
      glyph: "crown" as GameIconName,
      value: t("ranking.boards.levelN", { n: num.format(save.prestigeLevel) }),
      has: save.prestigeLevel > 0,
      detail: myTier.name,
    },
    BOSSES: {
      color: EMBLEM_COLOR.bestiary,
      glyph: "skull" as GameIconName,
      value: num.format(save.bossesDefeatedTotal),
      has: save.bossesDefeatedTotal > 0,
      detail: t("ranking.boards.BOSSES.detail"),
    },
    BESTIARY: {
      color: EMBLEM_COLOR.expeditions,
      glyph: "book" as GameIconName,
      value: `${best.met} / ${ENEMY_TYPES.length}`,
      has: best.total > 0,
      detail: t("ranking.boards.BESTIARY.detail", { kills: num.format(best.total), stars: best.goldStars }),
    },
    ACHIEVEMENTS: {
      color: EMBLEM_COLOR.talents,
      glyph: "medal" as GameIconName,
      value: `${save.achievements.length} / ${ACHIEVEMENTS.length}`,
      has: save.achievements.length > 0,
      detail: save.equippedTitle ? t("ranking.boards.ACHIEVEMENTS.detailTitle", { title: t(`achievements.list.${save.equippedTitle}.title` as TranslationKey) }) : t("ranking.boards.ACHIEVEMENTS.detail"),
    },
  };
  const ORDER: BoardId[] = ["SEASON", "ETERNAL", "DUEL", "COLOSSUS", "RECORD", "PRESTIGE", "BOSSES", "BESTIARY", "ACHIEVEMENTS"];
  const cur = BOARDS[board] ?? BOARDS.SEASON;
  const boardName = (b: BoardId) => t(`ranking.boards.${b}.name` as TranslationKey);

  // the rows of the chosen board: the server's Season board when it has one, otherwise just you, with your real number
  const serverRows = board === "SEASON" && Array.isArray(leaderboard) ? leaderboard : null;
  const rows: { rank: number; id: string; name: string; prestige: number; value: string; me: boolean }[] = serverRows
    ? serverRows.map((r) => ({ rank: r.rank, id: r.playerId, name: r.displayName, prestige: r.prestigeLevel, value: r.seasonBestWave > 0 ? waveLabel(r.seasonBestWave) : "—", me: r.playerId === save.playerId }))
    : [{ rank: 1, id: me.playerId, name: me.displayName, prestige: save.prestigeLevel, value: cur.value, me: true }];
  const podium = profiles.online && serverRows && serverRows.length > 0 ? serverRows.slice(0, 3) : null;

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + RANKING_CSS}</style>
      <TopNav active="RANKING" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero rk-hero">
          <div className="pg-hero-inner rk-hero-inner">
            <div>
              <p className="pg-kicker">{t("season.kicker", { number: status.seasonNumber })}</p>
              <h1 className="pg-h1">{t("ranking.pageTitle")}</h1>
              <p className="pg-lead">{t("ranking.leadAll")}</p>
              <button className="rk-me-btn" onClick={() => setOpenProfileId(me.playerId)}>
                <span className="rk-me-crown">
                  <CrownArt />
                </span>
                <span>
                  <small>{t("ranking.you")}</small>
                  <b>{me.displayName}</b>
                  <em style={{ color: myTier.color }}>{myTier.name}</em>
                </span>
                <span className="rk-me-go">{t("ranking.viewMyProfile")} ›</span>
              </button>
            </div>
            <div className="rk-highlights">
              {(["SEASON", "DUEL", "ETERNAL"] as BoardId[]).map((b) => (
                <button key={b} className="rk-hl" onClick={() => pick(b)}>
                  <Emblem color={BOARDS[b].color} icon={BOARDS[b].glyph} />
                  <span>
                    <small>{boardName(b)}</small>
                    <b>{BOARDS[b].value}</b>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="pg-wrap">
          <nav className="rk-tabs" aria-label={t("ranking.pageTitle")}>
            {ORDER.map((b) => (
              <button key={b} className={`rk-tab${board === b ? " is-on" : ""}`} onClick={() => pick(b)} data-testid={`ranking-tab-${b}`}>
                <Emblem color={BOARDS[b].color} icon={BOARDS[b].glyph} />
                <span>{boardName(b)}</span>
              </button>
            ))}
          </nav>

          <div className="rk-grid" key={board}>
            <section className="rk-main">
              <div className="rk-board-head" style={{ ["--emb" as string]: cur.color } as CSSProperties}>
                <Emblem color={cur.color} icon={cur.glyph} big />
                <div>
                  <h2>{boardName(board)}</h2>
                  <p>{t(`ranking.boards.${board}.how` as TranslationKey)}</p>
                </div>
              </div>

              {/* top three: real players only (online); until then, empty pedestals waiting for them */}
              <div className="rk-podium">
                {[1, 0, 2].map((i) => {
                  const p = podium?.[i];
                  return (
                    <div key={i} className={`rk-ped is-${i + 1}${p ? "" : " is-empty"}`}>
                      <div className="rk-ped-who">
                        {p ? (
                          <button className="rk-name" onClick={() => setOpenProfileId(p.playerId)}>
                            {p.displayName}
                          </button>
                        ) : (
                          <span className="rk-ped-wait">{t("ranking.waitingOnline")}</span>
                        )}
                        {p && <small>{p.seasonBestWave > 0 ? waveLabel(p.seasonBestWave) : "—"}</small>}
                      </div>
                      <div className="rk-ped-block">
                        <span>{i + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {board === "SEASON" && leaderboard === null && <p className="pg-note">{t("profile.leaderboardLoading")}</p>}
              {board === "SEASON" && leaderboard === "error" && <p className="pg-note">{t("profile.leaderboardError")}</p>}
              <div className="rk-list" role="table">
                <div className="rk-row is-head" role="row">
                  <span role="columnheader">#</span>
                  <span role="columnheader">{t("ranking.playerCol")}</span>
                  <span role="columnheader">{t("ranking.prestigeCol")}</span>
                  <span role="columnheader" className="is-num">
                    {t(`ranking.boards.${board}.col` as TranslationKey)}
                  </span>
                </div>
                {rows.map((row) => {
                  const tier = tierOf(row.prestige);
                  return (
                    <div key={row.id} role="row" className={`rk-row${row.me ? " is-me" : ""}`} onClick={() => setOpenProfileId(row.id)}>
                      <span className="rk-pos" role="cell">
                        {row.rank}
                      </span>
                      <span role="cell" className="rk-who">
                        <button className="rk-name" onClick={() => setOpenProfileId(row.id)} title={t("profile.open")}>
                          {row.name}
                        </button>
                        {row.me && <span className="rk-you">{t("ranking.you")}</span>}
                        {row.me && save.equippedTitle && <span className="rk-title">{t(`achievements.list.${save.equippedTitle}.title` as TranslationKey)}</span>}
                      </span>
                      <span role="cell">
                        <span style={{ color: tier.color }}>{tier.name}</span> <span className="rk-dim">{row.prestige}</span>
                      </span>
                      <span role="cell" className="is-num rk-val">
                        {row.value}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="pg-note">{board === "SEASON" ? (profiles.online ? t("ranking.positionOnline") : t("profile.leaderboardOfflineNote")) : t("ranking.boardsOfflineNote")}</p>
            </section>

            <aside className="rk-side">
              <div className="rk-card rk-mine" style={{ ["--emb" as string]: cur.color } as CSSProperties}>
                <small>{t("ranking.yourRecord")}</small>
                <b>{cur.value}</b>
                <p>{cur.detail}</p>
                {!cur.has && board !== "SEASON" && <p className="rk-hint">{t(`ranking.boards.${board}.start` as TranslationKey)}</p>}
              </div>
              {board === "SEASON" ? (
                <div className="rk-card">
                  <h3>{t("ranking.rewardsTitle")}</h3>
                  <ol className="rk-rewards">
                    {REWARD_RANKS.map((rank) => {
                      const bundle = getSeasonRewardBundle(status.seasonNumber, rank);
                      return (
                        <li key={rank} className={`is-${rank}`}>
                          <span className="rk-rank">#{rank}</span>
                          <span className="rk-rtitle">{t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)}</span>
                          <span className="rk-gems">{t("ranking.gemsValue", { gems: bundle.gems.toLocaleString(locale) })}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="rk-small">{t("ranking.bandsNote", { bands: BANDS.join(", ") })}</p>
                  <button className="pg-link" onClick={() => onNavigate("SEASON")}>
                    {t("ranking.seasonCta")}
                  </button>
                </div>
              ) : (
                <div className="rk-card">
                  <h3>{t("ranking.yourPosition")}</h3>
                  <p className="rk-small">{t("ranking.positionOffline")}</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
      {openProfileId && <PlayerProfilePanel playerId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}

const RANKING_CSS = `
/* medallion emblems */
.rk-emb { flex: none; display: inline-flex; line-height: 0; margin: -2px 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7)); transition: transform 240ms var(--hn-ease-back); }
.rk-emb.is-big { filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6)); }
.rk-tab:hover .rk-emb, .rk-hl:hover .rk-emb { transform: scale(1.12) rotate(-6deg); }
.rk-tab.is-on .rk-emb { transform: scale(1.08); }

/* hero */
.rk-hero-inner { align-items: center; gap: 28px; }
.rk-me-btn { display: inline-flex; align-items: center; gap: 12px; margin-top: 16px; padding: 8px 16px 8px 8px; border-radius: 14px; cursor: pointer; text-align: left; color: var(--bone);
  background: linear-gradient(160deg, rgba(58,40,20,0.85), rgba(16,11,7,0.92)); border: 1px solid rgba(232,176,75,0.45); box-shadow: inset 0 1px 0 rgba(255,236,190,0.12), 0 10px 24px rgba(0,0,0,0.4);
  transition: transform 180ms var(--hn-ease-out), border-color 180ms ease; }
.rk-me-btn:hover { transform: translateY(-2px); border-color: var(--gold-hi); }
.rk-me-crown { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px; background: radial-gradient(circle at 50% 40%, rgba(240,190,82,0.25), rgba(0,0,0,0.35)); }
.rk-me-crown .st-crown { width: 34px; height: 28px; animation: hn-float 3.6s ease-in-out infinite; }
.rk-me-btn small { display: block; font-size: 11px; color: var(--ash); }
.rk-me-btn b { display: block; font-size: 16px; }
.rk-me-btn em { display: block; font-style: normal; font-size: 12px; font-weight: 700; }
.rk-me-go { margin-left: 8px; font-size: 13px; font-weight: 700; color: var(--gold-hi); }
.rk-highlights { display: grid; gap: 10px; min-width: min(100%, 320px); }
.rk-hl { display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 12px; border-radius: 14px; cursor: pointer; text-align: left; color: var(--bone);
  background: linear-gradient(160deg, rgba(42,30,18,0.88), rgba(14,10,6,0.94)); border: 1px solid rgba(232,176,75,0.28); box-shadow: inset 0 1px 0 rgba(255,236,190,0.08), 0 8px 18px rgba(0,0,0,0.35);
  transition: transform 180ms var(--hn-ease-out), border-color 180ms ease; }
.rk-hl:hover { transform: translateX(-3px); border-color: rgba(232,176,75,0.6); }
.rk-hl small { display: block; font-size: 11.5px; color: var(--ash); }
.rk-hl b { display: block; font-family: var(--display); font-size: 22px; color: #fff3d6; font-variant-numeric: lining-nums tabular-nums; }

/* tabs */
.rk-tabs { display: flex; flex-wrap: wrap; gap: 8px; overflow-x: auto; padding: 26px 0 8px; scrollbar-width: thin; }
.rk-tab { flex: none; display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border-radius: 999px; cursor: pointer; font-size: 13.5px; font-weight: 700; color: var(--ash);
  background: rgba(24,18,12,0.7); border: 1px solid var(--line); transition: color 160ms ease, border-color 160ms ease, background 160ms ease, transform 140ms ease; }
.rk-tab:hover { color: var(--bone); border-color: rgba(232,176,75,0.5); }
.rk-tab.is-on { color: #2b1906; background: linear-gradient(180deg, #f6cf7a, var(--gold) 55%, #c58a2c); border-color: #f2c873; box-shadow: 0 4px 14px rgba(232,176,75,0.3); }

.rk-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 22px; padding: 16px 0 96px; animation: hn-rise 320ms var(--hn-ease-out) backwards; }
.rk-board-head { display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 16px;
  background: radial-gradient(60% 120% at 0% 50%, color-mix(in srgb, var(--emb) 22%, transparent), transparent 70%), linear-gradient(160deg, rgba(42,30,18,0.9), rgba(14,10,6,0.95));
  border: 1px solid color-mix(in srgb, var(--emb) 45%, transparent); }
.rk-board-head h2 { margin: 0; font-family: var(--display); font-size: 30px; color: var(--bone); }
.rk-board-head p { margin: 4px 0 0; font-size: 13.5px; color: var(--ash); line-height: 1.45; }

/* podium */
.rk-podium { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: end; gap: 10px; margin: 22px 0 16px; padding: 0 10px; }
.rk-ped { display: grid; justify-items: center; gap: 8px; }
.rk-ped-who { display: grid; justify-items: center; gap: 2px; text-align: center; min-height: 40px; }
.rk-ped-who small { font-size: 12px; color: var(--ash); }
.rk-ped-wait { font-size: 12px; color: var(--ash-2); font-style: italic; }
.rk-ped-block { width: 100%; display: grid; place-items: start center; padding-top: 10px; border-radius: 10px 10px 4px 4px; position: relative; overflow: hidden;
  background: linear-gradient(180deg, #4a3418, #1e140a); border: 1px solid rgba(232,176,75,0.35); box-shadow: inset 0 1px 0 rgba(255,236,190,0.2), 0 10px 22px rgba(0,0,0,0.4); }
.rk-ped-block span { font-family: var(--display); font-weight: 700; font-size: 34px; line-height: 1; color: #fff3d6; text-shadow: 0 2px 8px rgba(0,0,0,0.6); }
.rk-ped.is-1 .rk-ped-block { height: 118px; background: linear-gradient(180deg, #7a5418, #2a1a08); border-color: #f0be52; box-shadow: inset 0 1px 0 rgba(255,240,200,0.35), 0 0 26px rgba(240,190,82,0.25), 0 10px 22px rgba(0,0,0,0.4); }
.rk-ped.is-1 .rk-ped-block span { color: #ffe08a; font-size: 42px; }
.rk-ped.is-2 .rk-ped-block { height: 88px; background: linear-gradient(180deg, #5a5a62, #1e1e24); border-color: #c8ccd8; }
.rk-ped.is-3 .rk-ped-block { height: 68px; background: linear-gradient(180deg, #6a3e20, #24140a); border-color: #c98a4e; }
.rk-ped.is-empty .rk-ped-block { opacity: 0.55; filter: saturate(0.6); }
.rk-ped.is-1 .rk-ped-block::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,240,200,0.25) 50%, transparent 65%); background-size: 260% 100%; animation: rk-shine 4s ease-in-out infinite; }
@keyframes rk-shine { 0%, 60% { background-position: 130% 0; } 100% { background-position: -40% 0; } }

/* list */
.rk-list { display: grid; gap: 6px; }
.rk-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) 150px 150px; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; cursor: pointer;
  background: rgba(24,18,12,0.6); border: 1px solid var(--line-soft); transition: background 160ms ease, border-color 160ms ease, transform 160ms var(--hn-ease-out); }
.rk-row:hover:not(.is-head) { border-color: rgba(232,176,75,0.45); transform: translateX(3px); }
.rk-row.is-head { cursor: default; background: none; border: none; padding-top: 4px; padding-bottom: 4px; font-size: 11.5px; color: var(--ash); letter-spacing: 0.04em; }
.rk-row.is-me { background: linear-gradient(90deg, rgba(232,176,75,0.16), rgba(24,18,12,0.6)); border-color: rgba(232,176,75,0.5); }
.rk-pos { font-family: var(--display); font-weight: 700; font-size: 22px; color: var(--gold-hi); font-variant-numeric: lining-nums; }
.rk-who { min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.rk-val { font-weight: 800; color: #fff3d6; font-variant-numeric: tabular-nums; }
.is-num { text-align: right; }
.rk-name { padding: 0; background: none; border: none; cursor: pointer; font-weight: 700; font-size: 15px; color: var(--bone); text-align: left; }
.rk-name:hover { color: var(--gold-hi); text-decoration: underline; text-underline-offset: 3px; }
.rk-you { font-size: 11.5px; font-weight: 800; color: #2b1906; background: var(--gold); padding: 1px 8px; border-radius: 999px; }
.rk-title { font-size: 11.5px; font-style: italic; color: var(--gold); opacity: 0.85; }
.rk-dim { color: var(--ash-2); font-size: 13px; }

/* side */
.rk-side { display: grid; gap: 14px; align-content: start; }
.rk-card { padding: 18px; border-radius: 16px; background: linear-gradient(180deg, rgba(42,30,18,0.9), rgba(14,10,6,0.95)); border: 1px solid rgba(232,176,75,0.28); box-shadow: inset 0 1px 0 rgba(255,236,190,0.08), 0 10px 22px rgba(0,0,0,0.35); }
.rk-card h3 { margin: 0 0 6px; font-family: var(--display); font-size: 21px; color: var(--bone); }
.rk-mine { border-color: color-mix(in srgb, var(--emb) 55%, transparent); background: radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--emb) 20%, transparent), transparent 70%), linear-gradient(180deg, rgba(42,30,18,0.9), rgba(14,10,6,0.95)); }
.rk-mine small { font-size: 11.5px; color: var(--ash); letter-spacing: 0.04em; }
.rk-mine b { display: block; margin-top: 4px; font-family: var(--display); font-size: 34px; color: #fff3d6; line-height: 1.05; font-variant-numeric: lining-nums tabular-nums; }
.rk-mine p { margin: 8px 0 0; font-size: 13.5px; color: #d9cdb6; line-height: 1.45; }
.rk-hint { color: var(--gold) !important; font-weight: 600; }
.rk-small { margin: 10px 0 0; font-size: 12.5px; color: var(--ash); line-height: 1.5; }
.rk-rewards { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
.rk-rewards li { display: grid; grid-template-columns: 42px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,236,190,0.08); }
.rk-rewards li.is-1 { border-color: rgba(240,190,82,0.6); background: linear-gradient(90deg, rgba(240,190,82,0.16), rgba(0,0,0,0.28)); }
.rk-rewards li.is-2 { border-color: rgba(200,204,216,0.45); }
.rk-rewards li.is-3 { border-color: rgba(201,138,78,0.5); }
.rk-rank { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--gold-hi); font-variant-numeric: lining-nums; }
.rk-rtitle { font-size: 14px; font-style: italic; color: var(--bone); }
.rk-gems { font-size: 13px; font-weight: 700; color: #a8dcff; font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .rk-grid, .rk-ped.is-1 .rk-ped-block::after, .rk-me-crown .st-crown { animation: none !important; }
  .rk-row:hover, .rk-hl:hover, .rk-me-btn:hover { transform: none; }
}
@media (max-width: 900px) {
  .rk-grid { grid-template-columns: minmax(0, 1fr); }
  .rk-tabs { flex-wrap: nowrap; }
}
@media (max-width: 560px) {
  .rk-row { grid-template-columns: 34px minmax(0, 1fr) 96px; }
  .rk-row > :nth-child(3) { display: none; }
  .rk-board-head h2 { font-size: 24px; }
  .rk-highlights { width: 100%; }
}
`;
