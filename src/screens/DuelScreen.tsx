import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { appendLedgerEvent } from "@/engine/EconomyLedger";
import { DuelEngine, LANE_SLOTS, slotPos, type DuelSnapshot } from "@/engine/DuelEngine";
import {
  applyDuelResult,
  arenaFor,
  buyDuelShopItem,
  claimDuelMission,
  DECK_SIZE,
  DUEL_CARDS,
  DUEL_LENGTH_MS,
  DUEL_MAX_MANA,
  DUEL_SHOP,
  duelAiSkill,
  duelMissionsFor,
  duelWeek,
  FIRST_WIN_PRIZE,
  getDuelCard,
  getShopItem,
  isValidDeck,
  NO_PRIZE,
  RANK_STEPS,
  rankFor,
  rankPrize,
  STREAK_PRIZES,
  WEEKLY_CHALLENGE_AI,
  WEEKLY_CHALLENGE_SHARDS,
  weeklyChallenge,
  type DuelCardId,
  type DuelOutcome,
  type DuelPrize,
  type DuelRank,
  type LeagueId,
} from "@/config/duel";
import { drawEnemy } from "@/rendering/EntityRenderer";
import { drawDuelFrame, DUEL_H, DUEL_W } from "@/rendering/duelRenderer";
import { ensureEnemySpritesLoading, setSpriteBiome } from "@/rendering/enemySprites";
import { createEnemyInstance } from "@/entities/Enemy";
import type { EnemyType } from "@/config/enemyStats";
import { TowerPortrait } from "@/ui/TowerPortrait";
import { PAGE_CSS } from "@/ui/pageChrome";

const W = DUEL_W;
const H = DUEL_H;

function CardFace({ id, small, dim }: { id: DuelCardId; small?: boolean; dim?: boolean }) {
  const { t } = useLanguage();
  const card = getDuelCard(id)!;
  const size = small ? 46 : 70;
  return (
    <div className={`dc-face is-${card.kind}${small ? " is-small" : ""}${dim ? " is-dim" : ""}`}>
      <div className="dc-art">
        {card.kind === "TOWER" ? (
          <TowerPortrait type={card.tower} level={21} width={size} height={size} zoom={1.7} baseY={0.74} />
        ) : (
          <EnemyPortrait type={card.enemy} size={size} />
        )}
      </div>
      <span className="dc-cost">{card.cost}</span>
      {!small && (
        <>
          <span className="dc-kind">{t(card.kind === "TOWER" ? "duel.kindTower" : "duel.kindSend")}</span>
          <span className="dc-name">{t(`duel.card.${id}.name` as TranslationKey)}</span>
        </>
      )}
    </div>
  );
}

/** A creature drawn with the game's own sprite, gently animated. */
function EnemyPortrait({ type, size }: { type: EnemyType; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inst = useMemo(() => {
    const e = createEnemyInstance(type, 1);
    e.position = { x: 0, y: 0 };
    return e;
  }, [type]);
  useEffect(() => {
    ensureEnemySpritesLoading();
    const draw = () => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      cv.width = size * dpr;
      cv.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, size / 2 * dpr, size * 0.68 * dpr);
      ctx.clearRect(-size, -size, size * 2, size * 2);
      const k = size / 74;
      ctx.scale(k, k);
      drawEnemy(ctx, inst, performance.now(), Infinity, type === "BRUTE" || type === "IRONCLAD" ? 2 : type === "SWARMLING" ? 3.2 : 2.6, undefined, Math.PI * 0.85, 0);
    };
    draw();
    const id = window.setInterval(draw, 120);
    return () => window.clearInterval(id);
  }, [inst, size, type]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

interface DuelScreenProps {
  onExit: () => void;
}

/** DUELO — lobby (trophies, arena, deck) and the match against the AI. */
type MatchResult = {
  outcome: DuelOutcome;
  weekly: boolean;
  trophyChange: number;
  prize: DuelPrize;
  rankBefore: DuelRank | null;
  rankAfter: DuelRank | null;
  firstWin: boolean;
  streakBonus: number | null;
};

const LEAGUE_COLOR: Record<LeagueId, [string, string]> = {
  BRONZE: ["#d08a52", "#5a3418"],
  SILVER: ["#d8dee6", "#5a6470"],
  GOLD: ["#ffd56a", "#8a5a10"],
  PLATINUM: ["#8ae8e0", "#1f6a70"],
  DIAMOND: ["#9ac8ff", "#2a3aa8"],
  MASTER: ["#e0a0ff", "#5a1a8a"],
  LEGEND: ["#ff8a6a", "#8a1a1a"],
};
const ROMAN = ["", "I", "II", "III"];

/** The rank emblem — a shield in the league's colours with its division. */
export function RankBadge({ trophies, size = 64 }: { trophies: number; size?: number }) {
  const { t } = useLanguage();
  const r = rankFor(trophies);
  const [c1, c2] = LEAGUE_COLOR[r.league];
  const label = `${t(`duel.league.${r.league}` as TranslationKey)}${r.league === "MASTER" || r.league === "LEGEND" ? "" : " " + ROMAN[r.division]}`;
  return (
    <span className="rk-badge" title={label} style={{ width: size, height: size * 1.12 }}>
      <svg viewBox="0 0 64 72" width={size} height={size * 1.12} aria-hidden="true">
        <defs>
          <linearGradient id={`rk-${r.league}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <path d="M32 2 L60 12 L56 44 Q52 60 32 70 Q12 60 8 44 L4 12 Z" fill={`url(#rk-${r.league})`} stroke="#1a120a" strokeWidth="3" />
        <path d="M32 9 L53 17 L50 42 Q47 55 32 63 Q17 55 14 42 L11 17 Z" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        {r.league === "LEGEND" || r.league === "MASTER" ? (
          <text x="32" y="44" textAnchor="middle" fontSize="24" fill="#fff" stroke="#1a120a" strokeWidth="1">{r.league === "LEGEND" ? "♛" : "★"}</text>
        ) : (
          Array.from({ length: r.division }, (_, i) => <path key={i} d={`M${20 + i * 12 - (r.division - 1) * 6 + 6} ${30} l6 6 l-6 6 l-6 -6 Z`} fill="#fff" stroke="#1a120a" strokeWidth="1" />)
        )}
      </svg>
    </span>
  );
}

function PrizeLine({ prize }: { prize: DuelPrize }) {
  const { t } = useLanguage();
  const parts = [
    prize.coins ? t("duel.prize.coins", { n: prize.coins }) : null,
    prize.shards ? t("duel.prize.shards", { n: prize.shards }) : null,
    prize.splinters ? t("duel.prize.splinters", { n: prize.splinters }) : null,
    prize.rare ? t("duel.prize.rare", { n: prize.rare }) : null,
    prize.epic ? t("duel.prize.epic", { n: prize.epic }) : null,
    prize.legendary ? t("duel.prize.legendary", { n: prize.legendary }) : null,
  ].filter(Boolean);
  return <span className="du-prize">{parts.join(" · ")}</span>;
}

/** Puts a Duel prize on the account: Gem Shards and Forge materials (coins live in the Duel profile). */
function grantPrize(cur: SaveData, prize: DuelPrize, source: string): Partial<SaveData> {
  if (prize.shards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: prize.shards });
  const e = cur.expeditions;
  return {
    gemShards: cur.gemShards + prize.shards,
    expeditions: {
      ...e,
      splinters: e.splinters + prize.splinters,
      essences: { ...e.essences, RARE: e.essences.RARE + prize.rare, EPIC: e.essences.EPIC + prize.epic, LEGENDARY: e.essences.LEGENDARY + prize.legendary },
    },
  };
}

interface DuelScreenProps {
  onExit: () => void;
}

/** DUELO — ranked lobby (league, missions, prizes, shop, deck) and the match against the AI. */
export function DuelScreen({ onExit }: DuelScreenProps) {
  const { t, language } = useLanguage();
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [deck, setDeck] = useState<DuelCardId[]>(() => [...save.duel.deck]);
  const [match, setMatch] = useState<DuelEngine | null>(null);
  /** Bumped every new match so the match view starts fresh (its end-of-match latch included). */
  const [matchNo, setMatchNo] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [challenge, setChallenge] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const now = Date.now();
  const day = Math.floor(now / 86_400_000);
  const week = duelWeek(now);
  const weekly = useMemo(() => weeklyChallenge(week), [week]);
  const weeklyDone = save.duel.weeklyWonWeek === week;
  const duel = save.duel;
  const arena = arenaFor(duel.trophies);
  const rank = rankFor(duel.trophies);
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const deckOk = isValidDeck(deck);
  const missions = duelMissionsFor(day);
  const mState = duel.missions.day === day ? duel.missions : { day, progress: {} as Record<string, number>, claimed: [] as string[] };
  const rankName = (r: DuelRank) => `${t(`duel.league.${r.league}` as TranslationKey)}${r.league === "MASTER" || r.league === "LEGEND" ? "" : " " + ROMAN[r.division]}`;
  const banner = duel.banner ? getShopItem(duel.banner)?.cosmetic ?? null : null;
  const frame = duel.frame ? getShopItem(duel.frame)?.cosmetic ?? null : null;

  const toggleCard = (id: DuelCardId) => {
    setDeck((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < DECK_SIZE ? [...d, id] : d));
  };

  const start = () => {
    if (!deckOk) return;
    const next = updateSave({ duel: { ...loadSave().duel, deck } });
    setSave(next);
    setResult(null);
    setChallenge(false);
    setMatchNo((n) => n + 1);
    setMatch(new DuelEngine((Date.now() & 0x7fffffff) | 1, [deck, aiDeck(arena.id)], duelAiSkill(next.duel.trophies), next.equippedTowerSkinByType));
  };

  const startWeekly = () => {
    setResult(null);
    setChallenge(true);
    setMatchNo((n) => n + 1);
    setMatch(new DuelEngine(weekly.seed, [weekly.myDeck, weekly.foeDeck], WEEKLY_CHALLENGE_AI, save.equippedTowerSkinByType));
  };

  const finish = (snap: DuelSnapshot) => {
    const outcome = snap.outcome!;
    const cur = loadSave();
    if (challenge) {
      const paid = outcome === "WIN" && cur.duel.weeklyWonWeek !== week;
      const prize = paid ? { ...NO_PRIZE, shards: WEEKLY_CHALLENGE_SHARDS } : NO_PRIZE;
      const next = updateSave({ ...grantPrize(cur, prize, "duel_weekly"), duel: { ...cur.duel, weeklyWonWeek: paid ? week : cur.duel.weeklyWonWeek } });
      setSave(next);
      setResult({ outcome, weekly: true, trophyChange: 0, prize, rankBefore: null, rankAfter: null, firstWin: false, streakBonus: null });
      return;
    }
    const r = applyDuelResult(cur.duel, { outcome, myCastle: snap.players[0]!.castle, foeCastle: snap.players[1]!.castle, sends: snap.players[0]!.sends, deck: cur.duel.deck }, Date.now());
    const next = updateSave({ ...grantPrize(cur, r.prize, "duel_match"), duel: r.profile });
    setSave(next);
    setResult({ outcome, weekly: false, trophyChange: r.trophyChange, prize: r.prize, rankBefore: r.rankBefore, rankAfter: r.rankAfter, firstWin: r.firstWin, streakBonus: r.streakBonus });
  };

  const claimMission = (id: string) => {
    const cur = loadSave();
    const p = claimDuelMission(cur.duel, id, Date.now());
    if (!p) return;
    setSave(updateSave({ duel: p }));
  };

  const buy = (id: string) => {
    const cur = loadSave();
    const r = buyDuelShopItem(cur.duel, id, Date.now());
    if (!r) return;
    setSave(updateSave({ ...grantPrize(cur, r.prize, "duel_shop"), duel: r.profile }));
    setNotice(t("duel.shopBought"));
  };

  const wear = (id: string) => {
    const cur = loadSave();
    const item = getShopItem(id);
    if (!item?.cosmetic || !cur.duel.owned.includes(id)) return;
    const k = item.cosmetic.kind === "BANNER" ? "banner" : "frame";
    setSave(updateSave({ duel: { ...cur.duel, [k]: cur.duel[k] === id ? null : id } }));
  };

  if (match)
    return (
      <DuelMatch
        key={matchNo}
        engine={match}
        arenaId={challenge ? "ARENA_ABYSS" : arena.id}
        biome={challenge ? "ABYSS" : arena.biome}
        banner={banner}
        frame={frame}
        result={result}
        rankName={rankName}
        onFinish={finish}
        onAgain={challenge ? startWeekly : start}
        onLobby={() => setMatch(null)}
      />
    );

  const pct = rank.next ? Math.max(0, Math.min(1, (duel.trophies - rank.from) / (rank.next - rank.from))) : 1;
  const leagueSteps = RANK_STEPS.map((r, i) => ({ ...r, i })).filter((r) => r.division === 1 && r.i > 0);

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + LOBBY_CSS + MATCH_CSS}</style>
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <button className="pg-link" onClick={onExit}>
                ← {t("duel.back")}
              </button>
              <h1 className="pg-h1">{t("duel.lobbyTitle")}</h1>
              <p className="pg-lead">{t("duel.rankedLead")}</p>
            </div>
            <div className="du-rank" data-testid="duel-rank">
              <RankBadge trophies={duel.trophies} size={92} />
              <div>
                <p className="du-rank-name">{rankName(rank)}</p>
                <p className="du-rank-tr">🏆 {fmt(duel.trophies)}</p>
                <div className="du-rank-bar">
                  <div style={{ width: `${pct * 100}%` }} />
                </div>
                <p className="du-rank-next">{rank.next !== null ? t("duel.toNext", { n: rank.next - duel.trophies, name: rankName(rankFor(rank.next)) }) : t("duel.topRank")}</p>
                {duel.streak >= 2 && <p className="du-streak">{t("duel.streak", { n: duel.streak })}</p>}
              </div>
            </div>
          </div>
        </header>
        <div className="pg-wrap">
          <section className="du-play">
            <div>
              <p className="pg-sub">{t("duel.rankedRules")}</p>
              <p className="pg-sub">
                {duel.firstWinDay === day ? t("duel.firstWinDone") : t("duel.firstWinOpen")} <PrizeLine prize={FIRST_WIN_PRIZE} />
              </p>
              <p className="pg-sub">{t("duel.coinsBalance", { n: fmt(duel.coins) })}</p>
            </div>
            <button className="pg-btn" disabled={!deckOk} onClick={start} data-testid="duel-start">
              {t("duel.playRanked")}
            </button>
          </section>
          {notice && <p className="du-notice">{notice}</p>}

          <section className="du-block" data-testid="duel-missions">
            <h2 className="pg-h2">{t("duel.missionsTitle")}</h2>
            <p className="pg-sub">{t("duel.missionsLead")}</p>
            <div className="du-missions">
              {missions.map((m) => {
                const prog = mState.progress[m.id] ?? 0;
                const done = prog >= m.target;
                const claimed = mState.claimed.includes(m.id);
                return (
                  <div key={m.id} className="du-mission">
                    <div>
                      <strong>{t(`duel.mission.${m.kind}` as TranslationKey, { n: m.target, card: m.card ? t(`duel.card.${m.card}.name` as TranslationKey) : "" })}</strong>
                      <div className="du-mbar">
                        <div style={{ width: `${(prog / m.target) * 100}%` }} />
                      </div>
                      <small>
                        {prog} / {m.target} · {t("duel.prize.coins", { n: m.coins })}
                      </small>
                    </div>
                    <button className={claimed ? "pg-btn-ghost" : "pg-btn"} disabled={!done || claimed} onClick={() => claimMission(m.id)}>
                      {claimed ? t("duel.claimed") : t("duel.claim")}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="du-block" data-testid="duel-ladder">
            <h2 className="pg-h2">{t("duel.ladderTitle")}</h2>
            <p className="pg-sub">{t("duel.ladderLead")}</p>
            <div className="du-ladder">
              {leagueSteps.map((r) => {
                const reached = duel.rankPaidUpTo >= r.i;
                return (
                  <div key={r.i} className={`du-step${reached ? " is-done" : ""}`}>
                    <RankBadge trophies={r.from} size={44} />
                    <div>
                      <strong>{rankName(rankFor(r.from))}</strong>
                      <small>🏆 {fmt(r.from)}</small>
                      <PrizeLine prize={rankPrize(r.i)} />
                    </div>
                    <span className="du-step-tag">{reached ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className="pg-sub">{t("duel.ladderDivisions")}</p>
            <p className="pg-sub">
              {t("duel.streakRules")}
            </p>
            <ul className="du-streaks">
              {STREAK_PRIZES.map((s) => (
                <li key={s.at}>
                  🔥 {s.at} — <PrizeLine prize={s.prize} />
                </li>
              ))}
            </ul>
          </section>

          <section className="du-weekly" data-testid="duel-weekly">
            <div>
              <h2 className="pg-h2">{t("duel.weeklyTitle")}</h2>
              <p className="pg-sub">{t("duel.weeklyLead", { shards: WEEKLY_CHALLENGE_SHARDS })}</p>
              <div className="du-weekly-decks">
                <span>{t("duel.weeklyYours")}</span>
                {weekly.myDeck.map((id) => (
                  <CardFace key={id} id={id} small />
                ))}
              </div>
            </div>
            <button className={weeklyDone ? "pg-btn-ghost" : "pg-btn"} onClick={startWeekly} data-testid="duel-weekly-start">
              {weeklyDone ? t("duel.weeklyDone") : t("duel.weeklyPlay")}
            </button>
          </section>

          <section className="du-block" data-testid="duel-shop">
            <div className="pg-head">
              <h2 className="pg-h2">{t("duel.shopTitle")}</h2>
              <span className="du-coins">◈ {fmt(duel.coins)}</span>
            </div>
            <p className="pg-sub">{t("duel.shopLead")}</p>
            <div className="du-shop">
              {DUEL_SHOP.map((item) => {
                const owned = duel.owned.includes(item.id);
                const worn = duel.banner === item.id || duel.frame === item.id;
                const weeklyLocked = item.weekly && duel.shopWeek === week;
                return (
                  <div key={item.id} className="du-item">
                    {item.cosmetic ? (
                      <span className={`du-swatch is-${item.cosmetic.kind}`} style={{ background: `linear-gradient(160deg, ${item.cosmetic.color}, ${item.cosmetic.color2})` }} aria-hidden="true" />
                    ) : (
                      <span className="du-swatch is-mat" aria-hidden="true">
                        {item.id === "EPIC" ? "◆" : item.id === "RARE" ? "◆" : "✦"}
                      </span>
                    )}
                    <strong>{t(`duel.shop.${item.id}` as TranslationKey)}</strong>
                    {item.prize && <PrizeLine prize={item.prize} />}
                    {item.weekly && <small>{t("duel.shopWeekly")}</small>}
                    {owned ? (
                      <button className="pg-btn-ghost" onClick={() => wear(item.id)}>
                        {worn ? t("duel.wearing") : t("duel.wear")}
                      </button>
                    ) : (
                      <button className="pg-btn" disabled={duel.coins < item.price || !!weeklyLocked} onClick={() => buy(item.id)}>
                        {weeklyLocked ? t("duel.shopWeeklyDone") : `◈ ${fmt(item.price)}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="du-deck">
            <div className="pg-head">
              <h2 className="pg-h2">{t("duel.deck")}</h2>
              <span className={deckOk ? "du-count" : "du-count is-bad"}>{t("duel.deckCount", { n: deck.length })}</span>
            </div>
            <p className="pg-sub">{deckOk ? t("duel.deckHint") : t("duel.deckInvalid")}</p>
            <div className="du-cards">
              {DUEL_CARDS.map((c) => {
                const on = deck.includes(c.id);
                return (
                  <button key={c.id} className={`du-cardbtn${on ? " is-on" : ""}`} onClick={() => toggleCard(c.id)} aria-pressed={on} data-testid={`deck-${c.id}`}>
                    <CardFace id={c.id} dim={!on} />
                    <span className="du-desc">{t(`duel.card.${c.id}.desc` as TranslationKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The AI's deck per arena — always valid, a little meaner in higher arenas. */
function aiDeck(arenaId: string): DuelCardId[] {
  if (arenaId === "ARENA_FOREST") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SHIELDS"];
  if (arenaId === "ARENA_VOLCANO") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_SWARM", "S_BRUTE", "S_SHIELDS"];
  return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_RUNNERS", "S_SWARM", "S_SHIELDS", "S_IRONCLAD"];
}

interface DuelMatchProps {
  engine: DuelEngine;
  arenaId: string;
  biome: string;
  banner: { color: string; color2: string } | null;
  frame: { color: string; color2: string } | null;
  result: MatchResult | null;
  rankName: (r: DuelRank) => string;
  onFinish: (s: DuelSnapshot) => void;
  onAgain: () => void;
  onLobby: () => void;
}

function DuelMatch({ engine, arenaId, biome, banner, frame, result, rankName, onFinish, onAgain, onLobby }: DuelMatchProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snap, setSnap] = useState<DuelSnapshot>(() => engine.snapshot());
  const [picked, setPicked] = useState<DuelCardId | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const finishedRef = useRef(false);

  useEffect(() => {
    setSpriteBiome(biome);
    if (import.meta.env.DEV) (window as unknown as { __hordenovaDuel?: DuelEngine }).__hordenovaDuel = engine;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(1000, now - last);
      last = now;
      if (acc >= 50) {
        const steps = Math.floor(acc / 50) * 50;
        engine.advance(steps);
        acc -= steps;
      }
      const s = engine.snapshot();
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth;
        const h = (w * H) / W;
        if (cv.width !== Math.round(w * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(h * dpr);
        }
        ctx.setTransform((cv.width / W), 0, 0, cv.height / H, 0, 0);
        drawDuelFrame(ctx, s, arenaId, biome, now, !!pickedRef.current && getDuelCard(pickedRef.current)?.kind === "TOWER", hoverRef.current, banner);
      }
      setSnap(s);
      if (s.over && !finishedRef.current) {
        finishedRef.current = true;
        onFinish(s);
      }
      if (!s.over) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const me = snap.players[0]!;
  const foe = snap.players[1]!;
  const left = Math.max(0, DUEL_LENGTH_MS - snap.timeMs);
  const clock = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  const slotAt = (ev: React.MouseEvent<HTMLCanvasElement>): number | null => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const y = ((ev.clientY - r.top) / r.height) * H;
    let best: number | null = null;
    let bd = 40;
    LANE_SLOTS.forEach((_, i) => {
      const p = slotPos(0, i);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const onCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picked) return;
    const card = getDuelCard(picked);
    if (card?.kind !== "TOWER") return;
    const slot = slotAt(ev);
    if (slot !== null && engine.play(0, picked, slot)) setPicked(null);
  };

  const onCard = (id: DuelCardId) => {
    const card = getDuelCard(id)!;
    if (card.kind === "SEND") {
      engine.play(0, id);
      setPicked(null);
    } else setPicked((p) => (p === id ? null : id));
  };

  return (
    <div style={{ ...matchRoot, ...(frame ? { ["--fr1" as string]: frame.color, ["--fr2" as string]: frame.color2 } : null) }} className={frame ? "has-frame" : undefined}>
      <style>{MATCH_CSS}</style>
      <div className="dm-top">
        <div className="dm-side">
          <span className="dm-crest is-you" aria-hidden="true">⚔</span>
          <div>
            <strong>{t("duel.you")}</strong>
            <CastleBar hp={me.castle} />
          </div>
        </div>
        <div className={`dm-clock${snap.doubleMana ? " is-double" : ""}`} style={{ ["--p" as string]: `${(snap.timeMs / DUEL_LENGTH_MS) * 360}deg` }}>
          <div className="dm-clock-face">
            <span>{clock}</span>
          </div>
          {snap.doubleMana && <small>{t("duel.doubleMana")}</small>}
        </div>
        <div className="dm-side is-foe">
          <div>
            <strong>{t("duel.foe")}</strong>
            <CastleBar hp={foe.castle} foe />
          </div>
          <span className="dm-crest is-foe" aria-hidden="true">☠</span>
        </div>
      </div>
      <div className="dm-stage">
        <canvas
          ref={canvasRef}
          className="dm-canvas"
          style={{ cursor: picked ? "pointer" : "default" }}
          onClick={onCanvasClick}
          onMouseMove={(e) => setHover(picked ? slotAt(e) : null)}
          data-testid="duel-canvas"
        />
        {picked && getDuelCard(picked)?.kind === "TOWER" && <div className="dm-hint">{t("duel.pickSlot")}</div>}
        {result && (
          <div className="dm-result" role="dialog" data-testid="duel-result">
            <h2 className={`is-${result.outcome}`}>{t(result.outcome === "WIN" ? "duel.win" : result.outcome === "LOSS" ? "duel.loss" : "duel.draw")}</h2>
            {!result.weekly && <p className="dm-tr">{t("duel.trophiesDelta", { n: (result.trophyChange > 0 ? "+" : "") + result.trophyChange })}</p>}
            {result.rankBefore && result.rankAfter && result.rankAfter.index !== result.rankBefore.index && (
              <div className={`dm-rankchange ${result.rankAfter.index > result.rankBefore.index ? "is-up" : "is-down"}`}>
                <RankBadge trophies={result.rankAfter.from} size={70} />
                <span>{t(result.rankAfter.index > result.rankBefore.index ? "duel.promoted" : "duel.demoted", { name: rankName(result.rankAfter) })}</span>
              </div>
            )}
            {result.firstWin && <p className="dm-tag">{t("duel.firstWinTag")}</p>}
            {result.streakBonus && <p className="dm-tag">{t("duel.streakTag", { n: result.streakBonus })}</p>}
            {(result.prize.coins || result.prize.shards) > 0 && (
              <p>
                <PrizeLine prize={result.prize} />
              </p>
            )}
            <div className="dm-result-actions">
              <button className="dm-btn" onClick={onAgain}>
                {t("duel.again")}
              </button>
              <button className="dm-btn is-ghost" onClick={onLobby}>
                {t("duel.toLobby")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="dm-hand">
        <div className="dm-mana" aria-label={t("duel.mana")}>
          <span>{Math.floor(me.mana)}</span>
          <div className="dm-mana-bar">
            {Array.from({ length: DUEL_MAX_MANA }, (_, i) => (
              <i key={i} className={i < me.mana ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="dm-cards">
          {me.hand.map((id, i) => {
            const card = getDuelCard(id)!;
            const can = me.mana >= card.cost && !snap.over;
            return (
              <button key={`${id}-${i}`} className={`dm-card${picked === id ? " is-picked" : ""}`} disabled={!can} onClick={() => onCard(id)} title={t(`duel.card.${id}.desc` as TranslationKey)} data-testid={`hand-${id}`}>
                <CardFace id={id} dim={!can} />
              </button>
            );
          })}
          <div className="dm-next">
            <small>{t("duel.next")}</small>
            <CardFace id={me.next} small />
          </div>
        </div>
        {!snap.over && (
          <button className="dm-btn is-ghost dm-quit" onClick={() => engine.surrender()}>
            {t("duel.surrender")}
          </button>
        )}
      </div>
    </div>
  );
}

function CastleBar({ hp, foe }: { hp: number; foe?: boolean }) {
  const left = Math.max(0, hp);
  return (
    <div className={`dm-hp${foe ? " is-foe" : ""}`} aria-label={String(left)}>
      <div className="dm-hp-segs">
        {Array.from({ length: 20 }, (_, i) => (
          <i key={i} className={i < left ? (left > 10 ? "ok" : left > 5 ? "mid" : "low") : ""} />
        ))}
      </div>
      <span>{left} / 20</span>
    </div>
  );
}

const matchRoot: CSSProperties = { position: "fixed", inset: 0, display: "grid", gridTemplateRows: "auto 1fr auto", background: "#0d0a07", color: "#efe4cf" };

const LOBBY_CSS = `
.rk-badge { display: inline-grid; place-items: center; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6)); flex: none; }
.du-rank { display: flex; align-items: center; gap: 18px; }
.du-rank p { margin: 0; }
.du-rank-name { font-family: var(--display); font-weight: 700; font-size: clamp(26px, 3vw, 38px); color: var(--gold-hi); line-height: 1.05; }
.du-rank-tr { font-size: 16px; color: var(--bone); margin-top: 4px !important; }
.du-rank-bar { width: 220px; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-top: 8px; overflow: hidden; }
.du-rank-bar div { height: 100%; background: linear-gradient(90deg, #a8761e, #ffd56a); }
.du-rank-next { font-size: 12.5px; color: var(--ash); margin-top: 5px !important; }
.du-streak { font-size: 13px; font-weight: 700; color: #ff9a5a; margin-top: 4px !important; }
.du-notice { margin: 12px 0 0; color: #9be37a; font-weight: 700; }
.du-block { padding: 30px 0 6px; }
.du-block .pg-sub { margin: 4px 0 0; }
.du-prize { color: var(--bone); font-weight: 600; }
.du-missions { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 14px; }
.du-mission { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.du-mission > div { flex: 1; min-width: 0; display: grid; gap: 5px; }
.du-mission strong { font-size: 14.5px; color: var(--bone); }
.du-mission button:disabled, .du-item button:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
.du-mission small { font-size: 12px; color: var(--ash); }
.du-mbar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; }
.du-mbar div { height: 100%; background: linear-gradient(90deg, #a8761e, #ffd56a); }
.du-ladder { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; margin: 14px 0 10px; }
.du-step { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.5); }
.du-step > div { flex: 1; display: grid; gap: 2px; font-size: 13px; }
.du-step strong { font-family: var(--display); font-size: 18px; color: var(--bone); }
.du-step small { color: var(--ash); }
.du-step.is-done { border-color: rgba(155,227,122,0.45); }
.du-step-tag { font-size: 20px; color: #9be37a; font-weight: 800; }
.du-streaks { margin: 6px 0 0; padding-left: 18px; color: var(--ash); font-size: 14px; display: grid; gap: 4px; }
.du-coins { font-size: 18px; font-weight: 800; color: #8ae0d0; }
.du-shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-top: 14px; }
.du-item { display: grid; justify-items: start; gap: 6px; padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); font-size: 13px; }
.du-item strong { font-size: 15px; color: var(--bone); }
.du-item small { color: #d8a8ff; }
.du-item button { margin-top: auto; }
.du-swatch { width: 54px; height: 54px; border-radius: 10px; display: grid; place-items: center; border: 2px solid rgba(255,255,255,0.25); }
.du-swatch.is-BANNER { clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
.du-swatch.is-FRAME { background-clip: padding-box; box-shadow: inset 0 0 0 10px rgba(20,14,8,0.9); }
.du-swatch.is-mat { background: rgba(0,0,0,0.3); font-size: 28px; color: #b47cff; }
.du-figs { display: flex; gap: 32px; margin: 0; }
.du-figs dt { font-size: 13px; color: var(--ash); }
.du-figs dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(28px, 3.4vw, 42px); line-height: 1; color: var(--gold-hi); }
.du-figs dd.is-arena { color: var(--bone); font-size: clamp(22px, 2.6vw, 32px); }
.du-play { display: flex; flex-wrap: wrap; gap: 16px 40px; align-items: center; justify-content: space-between; padding: 28px 0; border-bottom: 1px solid var(--line); }
.du-play > div { max-width: 70ch; display: grid; gap: 6px; }
.du-play .pg-sub { margin: 0; }
.du-deck { padding: 32px 0 96px; }
.du-weekly { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; margin-top: 28px; padding: 20px 22px; border-radius: 12px; border: 1px solid rgba(180,124,255,0.45); background: linear-gradient(100deg, rgba(180,124,255,0.12), rgba(24,18,12,0.6) 60%); }
.du-weekly .pg-sub { margin: 4px 0 0; max-width: 60ch; }
.du-weekly-decks { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: var(--ash); }
.du-count { font-size: 14px; color: var(--ash); }
.du-count.is-bad { color: #ff9a85; }
.du-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 14px; }
.du-cardbtn { display: grid; justify-items: center; gap: 6px; padding: 14px 10px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); color: var(--bone); cursor: pointer; }
.du-cardbtn.is-on { border-color: rgba(232,176,75,0.7); background: linear-gradient(180deg, rgba(232,176,75,0.14), rgba(24,18,12,0.6)); }
.du-cardbtn:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.du-desc { font-size: 12px; color: var(--ash); text-align: center; line-height: 1.35; }
`;

const MATCH_CSS = `
.has-frame .dc-face { border-color: var(--fr1) !important; box-shadow: 0 0 0 1px var(--fr2), 0 0 14px color-mix(in srgb, var(--fr1) 45%, transparent), inset 0 1px 0 rgba(255,230,180,0.15) !important; }
.dm-tr { font-size: 20px !important; font-weight: 700; }
.dm-rankchange { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 12px; background: rgba(0,0,0,0.45); font-family: Georgia, serif; font-size: 22px; font-weight: 700; animation: dmIn 0.6s ease-out; }
.dm-rankchange.is-up { color: #ffd56a; box-shadow: 0 0 30px rgba(255,213,106,0.35); }
.dm-rankchange.is-down { color: #e0a090; }
.dm-tag { font-size: 14px !important; font-weight: 800; color: #ff9a5a; }
.dm-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 10px 22px; background: linear-gradient(180deg, #2a1f14, #140e09); border-bottom: 2px solid #5a4226; box-shadow: 0 2px 0 rgba(255,214,140,0.12) inset, 0 6px 18px rgba(0,0,0,0.5); }
.dm-side { display: flex; align-items: center; gap: 12px; font-size: 15px; }
.dm-side strong { font-family: Georgia, serif; font-size: 17px; color: #f4e2bb; letter-spacing: 0.02em; }
.dm-side.is-foe { justify-content: flex-end; text-align: right; }
.dm-crest { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; border: 2px solid #c9a050; box-shadow: 0 0 0 3px rgba(0,0,0,0.5), 0 0 16px rgba(255,200,110,0.25); }
.dm-crest.is-you { background: radial-gradient(circle at 35% 30%, #3a6aa8, #13284a); }
.dm-crest.is-foe { background: radial-gradient(circle at 35% 30%, #a83a3a, #4a1313); }
.dm-hp { display: grid; gap: 3px; margin-top: 4px; }
.dm-hp-segs { display: flex; gap: 2px; }
.dm-hp.is-foe .dm-hp-segs { flex-direction: row-reverse; }
.dm-hp-segs i { width: 11px; height: 12px; border-radius: 2px; background: rgba(255,255,255,0.07); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.35); }
.dm-hp-segs i.ok { background: linear-gradient(180deg, #9be37a, #3f8a2a); }
.dm-hp-segs i.mid { background: linear-gradient(180deg, #f0cf6a, #a87a1a); }
.dm-hp-segs i.low { background: linear-gradient(180deg, #ff7a5a, #a82a1a); animation: dmBlink 0.8s infinite alternate; }
@keyframes dmBlink { to { filter: brightness(1.5); } }
.dm-hp span { font-size: 11px; font-weight: 700; color: #b8a888; }
.dm-clock { display: grid; justify-items: center; gap: 3px; }
.dm-clock-face { width: 74px; height: 74px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#e8b04b var(--p), rgba(255,255,255,0.08) 0); padding: 4px; box-shadow: 0 0 0 2px #5a4226, 0 4px 14px rgba(0,0,0,0.6); }
.dm-clock-face span { width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 40% 30%, #2e2216, #120c07); font-family: Georgia, serif; font-size: 21px; font-weight: 700; color: #f8e6c0; font-variant-numeric: tabular-nums; }
.dm-clock.is-double .dm-clock-face { background: conic-gradient(#c58bff var(--p), rgba(255,255,255,0.08) 0); box-shadow: 0 0 0 2px #7a4ab0, 0 0 22px rgba(197,139,255,0.5); }
.dm-clock small { font-size: 11px; font-weight: 800; color: #d8a8ff; text-transform: none; }
.dm-stage { position: relative; display: grid; place-items: center; min-height: 0; padding: 10px; background: radial-gradient(ellipse at center, #1c140c, #080604 75%); }
.dm-canvas { width: min(100%, calc((100vh - 270px) * ${W / H})); aspect-ratio: ${W} / ${H}; border-radius: 6px; border: 3px solid #4a3620; box-shadow: 0 0 0 1px #8a6a3a, 0 14px 40px rgba(0,0,0,0.75); }
.dm-hint { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); padding: 7px 16px; border-radius: 20px; background: rgba(0,0,0,0.75); border: 1px solid #8a6a3a; color: #ffd56a; font-weight: 700; font-size: 13px; pointer-events: none; }
.dm-result { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; background: radial-gradient(ellipse at center, rgba(20,14,8,0.7), rgba(4,3,2,0.9)); animation: dmIn 0.4s ease-out; }
@keyframes dmIn { from { opacity: 0; transform: scale(1.04); } }
.dm-result h2 { margin: 0; font-family: Georgia, serif; font-size: 64px; letter-spacing: 0.02em; text-shadow: 0 4px 24px rgba(0,0,0,0.8); }
.dm-result h2.is-WIN { color: #ffd56a; text-shadow: 0 0 30px rgba(255,200,80,0.5); }
.dm-result h2.is-LOSS { color: #e0644b; }
.dm-result h2.is-DRAW { color: #cfc4b0; }
.dm-result p { margin: 0; font-size: 17px; }
.dm-result-actions { display: flex; gap: 10px; margin-top: 14px; }
.dm-hand { display: flex; align-items: center; justify-content: center; gap: 22px; padding: 12px 16px 14px; background: linear-gradient(0deg, #1e160e, #2a1f14); border-top: 2px solid #5a4226; flex-wrap: wrap; }
.dm-mana { display: grid; justify-items: center; gap: 5px; }
.dm-mana > span { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font-weight: 800; font-size: 20px; color: #fff; background: radial-gradient(circle at 35% 30%, #d38bff, #5a1a9a); border: 2px solid #f0d6ff; box-shadow: 0 0 16px rgba(197,139,255,0.5); }
.dm-mana-bar { display: flex; gap: 3px; }
.dm-mana-bar i { width: 14px; height: 10px; border-radius: 3px; background: rgba(255,255,255,0.08); }
.dm-mana-bar i.on { background: linear-gradient(180deg, #e0a8ff, #7a2ad0); box-shadow: 0 0 6px rgba(197,139,255,0.6); }
.dm-cards { display: flex; gap: 10px; align-items: flex-end; }
.dm-card { padding: 0; border: none; background: none; cursor: pointer; transition: transform 0.12s; }
.dm-card:not(:disabled):hover { transform: translateY(-6px); }
.dm-card.is-picked { transform: translateY(-10px); }
.dm-card.is-picked .dc-face { box-shadow: 0 0 0 2px #ffd56a, 0 0 22px rgba(255,213,106,0.6); }
.dm-card:disabled { cursor: default; }
.dm-card:focus-visible { outline: 2px solid #ffd56a; outline-offset: 3px; border-radius: 12px; }
.dc-face { position: relative; width: 104px; display: grid; justify-items: center; gap: 2px; padding: 8px 6px 8px; border-radius: 12px; border: 2px solid #8a6a3a; background: linear-gradient(180deg, #3a2a1a, #1a120a); box-shadow: inset 0 1px 0 rgba(255,230,180,0.15), 0 6px 14px rgba(0,0,0,0.5); color: #f4e6c8; }
.dc-face.is-TOWER { border-color: #6a8ac0; background: linear-gradient(180deg, #24324a, #10161f); }
.dc-face.is-SEND { border-color: #b0603a; background: linear-gradient(180deg, #4a2418, #1e0e08); }
.dc-face.is-dim { filter: grayscale(0.8) brightness(0.6); }
.dc-face.is-small { width: auto; padding: 4px; border-width: 1px; }
.dc-art { display: grid; place-items: center; border-radius: 8px; background: radial-gradient(circle at 50% 60%, rgba(255,255,255,0.1), rgba(0,0,0,0.3)); }
.dc-cost { position: absolute; left: -8px; top: -8px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #d38bff, #5a1a9a); border: 2px solid #f0d6ff; font-weight: 800; font-size: 13px; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.6); }
.dc-face.is-small .dc-cost { width: 20px; height: 20px; font-size: 11px; left: -6px; top: -6px; }
.dc-kind { font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; color: #b8c8e8; }
.dc-face.is-SEND .dc-kind { color: #ffb08a; }
.dc-name { font-size: 12px; font-weight: 700; text-align: center; line-height: 1.15; }
.dm-next { display: grid; justify-items: center; gap: 3px; font-size: 11px; color: #a89a84; padding-left: 6px; }
.dm-btn { padding: 10px 20px; border-radius: 9px; border: 1px solid #e8c06a; background: linear-gradient(180deg, #b0382a, #741c12); color: #fff; font-weight: 700; cursor: pointer; }
.dm-btn.is-ghost { background: rgba(0,0,0,0.3); border-color: rgba(232,192,106,0.5); color: #efe4cf; }
.dm-quit { font-size: 12px; padding: 6px 12px; }
@media (max-width: 720px) { .dc-face { width: 80px; } .dm-crest { display: none; } .dm-hp-segs i { width: 6px; } }
`;
