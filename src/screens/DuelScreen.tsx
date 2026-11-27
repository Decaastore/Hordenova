import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { appendLedgerEvent } from "@/engine/EconomyLedger";
import { DuelEngine, LANE_SLOTS, slotPos, type DuelSnapshot, type Pt } from "@/engine/DuelEngine";
import { drawSpellIcon } from "@/rendering/duelSpells";
import { formatDurationShort } from "@/utils/formatDuration";
import { DuelAudio } from "@/audio/arenaAudio";
import { audioManager } from "@/audio/AudioManager";
import {
  applyDuelResult,
  arenaFor,
  buyDuelShopItem,
  claimDuelMission,
  DECK_SIZE,
  DUEL_CARDS,
  DUEL_LENGTH_MS,
  DUEL_OVERTIME_MS,
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
  WEEKLY_CHALLENGE_COINS,
  WEEKLY_CHALLENGE_GEMS,
  WEEKLY_WIN_GOALS,
  MISSIONS_ALL_DONE_PRIZE,
  TOURNEY_ROUNDS,
  TOURNEY_BANNER,
  applyTourneyResult,
  tourneyState,
  earnedHow,
  LEAGUE_UNLOCKS,
  weeklyChallenge,
  duelKillFx,
  duelSkinLooks,
  toggleDuelCosmetic,
  addMasteryWin,
  buyCard,
  CARD_UNLOCKS,
  deckOwned,
  ownsCard,
  commanderFor,
  canReplay,
  cardMasteryLevel,
  claimMastery,
  deckAverageCost,
  DECK_SLOTS,
  DUEL_RULES_VERSION,
  MASTERY_LEVELS,
  masteryClaimable,
  pushHistory,
  type DuelHistoryEntry,
  type DuelMode,
  applyEventResult,
  draftOptions,
  duelEventFor,
  EVENT_WIN_COINS,
  randomDeck,
  type DuelEventId,
  type DuelShopItem,
  type KillFxId,
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
import { Tower3DPortrait } from "@/ui/Tower3DPortrait";
import { PAGE_CSS } from "@/ui/pageChrome";
import { MaterialIcon, type MaterialKind } from "@/ui/MaterialIcon";
import { drawKillFx, setDuelLooks } from "@/rendering/duelLooks";

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
          <Tower3DPortrait type={card.tower} level={21} width={size} height={size} />
        ) : card.kind === "SPELL" ? (
          <SpellPortrait effect={card.effect} size={size} />
        ) : (
          <EnemyPortrait type={card.enemy} size={size} />
        )}
      </div>
      <span className="dc-cost">{card.cost}</span>
      {!small && (
        <>
          <span className="dc-kind">{t(card.kind === "TOWER" ? "duel.kindTower" : card.kind === "SPELL" ? "duel.kindSpell" : "duel.kindSend")}</span>
          <span className="dc-name">{t(`duel.card.${id}.name` as TranslationKey)}</span>
        </>
      )}
    </div>
  );
}

/** A spell's card art, drawn live. */
function SpellPortrait({ effect, size }: { effect: "METEOR" | "FREEZE" | "RAGE" | "WARD"; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const draw = () => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== size * dpr) {
        cv.width = size * dpr;
        cv.height = size * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSpellIcon(ctx, effect, size, performance.now());
    };
    draw();
    const id = window.setInterval(draw, 60);
    return () => window.clearInterval(id);
  }, [effect, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
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

/** A looping preview of a kill effect. */
function KillFxPreview({ fx }: { fx: KillFxId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const dpr = window.devicePixelRatio || 1;
        if (cv.width !== 80 * dpr) {
          cv.width = 80 * dpr;
          cv.height = 64 * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, 80, 64);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(40, 50, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        const t = (now % 1300) / 1300;
        drawKillFx(ctx, fx, 40, 50, t, Math.floor(now / 1300) % 997, true);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fx]);
  return <canvas ref={ref} className="du-fxprev" style={{ width: 80, height: 64 }} aria-hidden="true" />;
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
  tourneyRound?: number | null;
  tourneyWon?: boolean;
  unlocked?: string[];
  /** Cards freed by reaching a new arena this match. */
  cardsUnlocked?: DuelCardId[];
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
  const parts: [MaterialKind, number, string][] = (
    [
      ["DUEL_COINS", prize.coins, "coins"],
      ["GEMS_FREE", prize.gems, "gems"],
      ["SHARDS", prize.shards, "shards"],
      ["SPLINTERS", prize.splinters, "splinters"],
      ["RARE", prize.rare, "rare"],
      ["EPIC", prize.epic, "epic"],
      ["LEGENDARY", prize.legendary, "legendary"],
    ] as [MaterialKind, number, string][]
  ).filter(([, n]) => n > 0);
  return (
    <span className="du-prize">
      {parts.map(([k, n, key]) => {
        const label = t(`duel.prize.${key}` as TranslationKey, { n });
        return (
          <span key={k} className="du-pz" title={label}>
            <MaterialIcon kind={k} size={18} title={label} />
            {label}
          </span>
        );
      })}
    </span>
  );
}

/** Puts a Duel prize on the account: Gem Shards and Forge materials (coins live in the Duel profile). */
function grantPrize(cur: SaveData, prize: DuelPrize, source: string): Partial<SaveData> {
  if (prize.shards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: prize.shards });
  // Free Gems won in the Duel work in the whole game (earned by playing — never a purchase)
  if (prize.gems > 0) appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: prize.gems, currency: "FREE" });
  const e = cur.expeditions;
  return {
    freeGems: cur.freeGems + prize.gems,
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
  const [deck, setDeck] = useState<DuelCardId[]>(() => [...(save.duel.decks[save.duel.activeDeck] ?? save.duel.deck)]);
  const [replay, setReplay] = useState<DuelHistoryEntry | null>(null);
  const [tab, setTab] = useState<DuelTab>(() => {
    try {
      const v = window.localStorage.getItem(TAB_KEY) as DuelTab | null;
      return v && (DUEL_TABS as readonly string[]).includes(v) ? v : "deck";
    } catch {
      return "deck";
    }
  });
  const pickTab = (id: DuelTab) => {
    setTab(id);
    try {
      window.localStorage.setItem(TAB_KEY, id);
    } catch {
      // a remembered tab is only a convenience
    }
  };
  const [match, setMatch] = useState<DuelEngine | null>(null);
  /** Bumped every new match so the match view starts fresh (its end-of-match latch included). */
  const [matchNo, setMatchNo] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [mode, setMode] = useState<"ranked" | "weekly" | "tourney" | "event">("ranked");
  /** DRAFT in progress: the cards picked so far (null when not drafting). */
  const [draft, setDraft] = useState<{ seed: number; picked: DuelCardId[] } | null>(null);
  const challenge = mode === "weekly";
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
  const deckOk = isValidDeck(deck) && deckOwned(duel, deck);
  const missions = duelMissionsFor(day);
  const mState = duel.missions.day === day ? duel.missions : { day, progress: {} as Record<string, number>, claimed: [] as string[] };
  const missionsReady = missions.filter((m) => (mState.progress[m.id] ?? 0) >= m.target && !mState.claimed.includes(m.id)).length;
  const masteryReady = DUEL_CARDS.filter((c) => masteryClaimable(duel, c.id) > 0).length;
  const rankName = (r: DuelRank) => `${t(`duel.league.${r.league}` as TranslationKey)}${r.league === "MASTER" || r.league === "LEGEND" ? "" : " " + ROMAN[r.division]}`;
  const banner = duel.banner ? getShopItem(duel.banner)?.cosmetic ?? null : null;
  const frame = duel.frame ? getShopItem(duel.frame)?.cosmetic ?? null : null;

  /** Saves the deck being edited into its slot (and as the active deck once it's complete). */
  const saveDeck = (d: DuelCardId[], slot = loadSave().duel.activeDeck) => {
    const cur = loadSave().duel;
    const decks = cur.decks.map((x, i) => (i === slot ? [...d] : x));
    setSave(updateSave({ duel: { ...cur, decks, activeDeck: slot, ...(isValidDeck(d) ? { deck: [...d] } : {}) } }));
  };

  const toggleCard = (id: DuelCardId) => {
    const d = deck.includes(id) ? deck.filter((x) => x !== id) : deck.length < DECK_SIZE ? [...deck, id] : deck;
    if (d === deck) return;
    setDeck(d);
    saveDeck(d);
  };

  const pickSlot = (slot: number) => {
    const d = [...(loadSave().duel.decks[slot] ?? [])];
    setDeck(d);
    saveDeck(d, slot);
  };

  const collectMastery = (id: DuelCardId) => {
    const cur = loadSave();
    const r = claimMastery(cur.duel, id);
    if (!r) return;
    setSave(updateSave({ duel: r.profile }));
    setNotice(`+${t("duel.prize.coins", { n: r.coins })}`);
  };

  const start = () => {
    if (!deckOk) return;
    const next = updateSave({ duel: { ...loadSave().duel, deck } });
    setSave(next);
    setResult(null);
    setMode("ranked");
    setMatchNo((n) => n + 1);
    setDuelLooks(duelSkinLooks(next.duel), duelKillFx(next.duel));
    setMatch(new DuelEngine((Date.now() & 0x7fffffff) | 1, [deck, aiDeck(arena.id)], duelAiSkill(next.duel.trophies), next.equippedTowerSkinByType));
  };

  const startWeekly = () => {
    setResult(null);
    setMode("weekly");
    setMatchNo((n) => n + 1);
    setDuelLooks(duelSkinLooks(save.duel), duelKillFx(save.duel));
    setMatch(new DuelEngine(weekly.seed, [weekly.myDeck, weekly.foeDeck], WEEKLY_CHALLENGE_AI, save.equippedTowerSkinByType));
  };

  const tourney = tourneyState(duel, now);
  const startTourney = () => {
    const tNow = tourneyState(loadSave().duel, Date.now());
    if (!deckOk || !tNow || tNow.out || tNow.won) return;
    const next = updateSave({ duel: { ...loadSave().duel, deck } });
    setSave(next);
    setResult(null);
    setMode("tourney");
    setMatchNo((n) => n + 1);
    setDuelLooks(duelSkinLooks(next.duel), duelKillFx(next.duel));
    setMatch(new DuelEngine((Date.now() & 0x7fffffff) | 1, [deck, aiDeck("ARENA_ABYSS")], TOURNEY_ROUNDS[tNow.round]!.ai, next.equippedTowerSkinByType));
  };

  /** The history line for the match that just ended (with what's needed to replay it). */
  const historyEntry = (snap: DuelSnapshot, m: DuelMode, trophyChange: number): DuelHistoryEntry => ({
    at: Date.now(),
    mode: m,
    outcome: snap.outcome!,
    myCastle: Math.max(0, snap.players[0]!.castle),
    foeCastle: Math.max(0, snap.players[1]!.castle),
    trophyChange,
    arenaId: m === "RANKED" || m === "EVENT" ? arena.id : "ARENA_ABYSS",
    biome: m === "RANKED" || m === "EVENT" ? arena.biome : "ABYSS",
    v: DUEL_RULES_VERSION,
    seed: match!.seed,
    decks: [[...match!.decks[0]], [...match!.decks[1]]],
    ai: match!.aiSkill ?? 0,
    ...(m === "EVENT" ? { event: todayEvent, ...(match!.rules.doubleMana ? { doubleMana: true } : {}) } : {}),
    plays: match!.log.filter((p) => p.side === 0).map((p) => ({ t: p.t, card: p.card, ...(p.slot !== undefined ? { slot: p.slot } : {}), ...(p.at ? { at: { ...p.at } } : {}) })),
  });

  const todayEvent: DuelEventId = duelEventFor(day);
  /** Starts today's event match (DRAFT starts from the finished draft's deck). */
  const startEvent = (draftedDeck?: DuelCardId[]) => {
    const seed = (Date.now() & 0x7fffffff) | 1;
    const cur = loadSave();
    const ev = duelEventFor(Math.floor(Date.now() / 86_400_000));
    if (ev === "DRAFT" && !draftedDeck) {
      setDraft({ seed, picked: [] });
      return;
    }
    const mine = ev === "DRAFT" ? draftedDeck! : ev === "RANDOM" ? randomDeck(seed) : [...cur.duel.deck];
    const theirs = ev === "MIRROR" ? [...cur.duel.deck] : ev === "DOUBLE_MANA" ? aiDeck(arena.id) : randomDeck(seed + 7919);
    setDraft(null);
    setResult(null);
    setMode("event");
    setMatchNo((n) => n + 1);
    setDuelLooks(duelSkinLooks(cur.duel), duelKillFx(cur.duel));
    setMatch(new DuelEngine(seed, [mine, theirs], duelAiSkill(cur.duel.trophies), cur.equippedTowerSkinByType, ev === "DOUBLE_MANA" ? { doubleMana: true } : {}));
  };

  const pickDraft = (id: DuelCardId) => {
    if (!draft) return;
    const picked = [...draft.picked, id];
    if (picked.length >= DECK_SIZE) startEvent(picked);
    else setDraft({ ...draft, picked });
  };

  const finish = (snap: DuelSnapshot) => {
    const outcome = snap.outcome!;
    const cur = loadSave();
    if (mode === "event") {
      const r = applyEventResult(cur.duel, outcome, Date.now());
      const prize = { ...NO_PRIZE, coins: r.coins };
      const next = updateSave({ duel: { ...r.profile, history: pushHistory(r.profile.history, historyEntry(snap, "EVENT", 0)) } });
      setSave(next);
      setResult({ outcome, weekly: true, trophyChange: 0, prize, rankBefore: null, rankAfter: null, firstWin: false, streakBonus: null });
      return;
    }
    if (mode === "tourney") {
      const r = applyTourneyResult(cur.duel, outcome, Date.now());
      const prize = r?.prize ?? NO_PRIZE;
      let duelAfter = r?.profile ?? cur.duel;
      if (outcome === "WIN") duelAfter = addMasteryWin(duelAfter, match!.decks[0]);
      duelAfter = { ...duelAfter, history: pushHistory(duelAfter.history, historyEntry(snap, "TOURNEY", 0)) };
      const next = updateSave({ ...grantPrize(cur, { ...prize, coins: 0 }, "duel_tourney"), duel: duelAfter });
      setSave(next);
      setResult({ outcome, weekly: true, trophyChange: 0, prize, rankBefore: null, rankAfter: null, firstWin: false, streakBonus: null, tourneyRound: r && outcome === "WIN" ? r.profile.tourney.round : null, tourneyWon: !!r?.profile.tourney.won });
      return;
    }
    if (challenge) {
      const paid = outcome === "WIN" && cur.duel.weeklyWonWeek !== week;
      const prize = paid ? { ...NO_PRIZE, coins: WEEKLY_CHALLENGE_COINS, gems: WEEKLY_CHALLENGE_GEMS } : NO_PRIZE;
      const next = updateSave({
        ...grantPrize(cur, { ...prize, coins: 0 }, "duel_weekly"),
        duel: { ...cur.duel, coins: cur.duel.coins + prize.coins, weeklyWonWeek: paid ? week : cur.duel.weeklyWonWeek, history: pushHistory(cur.duel.history, historyEntry(snap, "WEEKLY", 0)) },
      });
      setSave(next);
      setResult({ outcome, weekly: true, trophyChange: 0, prize, rankBefore: null, rankAfter: null, firstWin: false, streakBonus: null });
      return;
    }
    const r = applyDuelResult(cur.duel, { outcome, myCastle: snap.players[0]!.castle, foeCastle: snap.players[1]!.castle, sends: snap.players[0]!.sends, deck: cur.duel.deck }, Date.now());
    const next = updateSave({ ...grantPrize(cur, r.prize, "duel_match"), duel: { ...r.profile, history: pushHistory(r.profile.history, historyEntry(snap, "RANKED", r.trophyChange)) } });
    setSave(next);
    const cardsUnlocked = DUEL_CARDS.filter((c) => !ownsCard(cur.duel, c.id) && ownsCard(r.profile, c.id)).map((c) => c.id);
    setResult({ outcome, weekly: false, trophyChange: r.trophyChange, prize: r.prize, rankBefore: r.rankBefore, rankAfter: r.rankAfter, firstWin: r.firstWin, streakBonus: r.streakBonus, unlocked: r.unlocked, cardsUnlocked });
  };

  const claimMission = (id: string) => {
    const cur = loadSave();
    const r = claimDuelMission(cur.duel, id, Date.now());
    if (!r) return;
    setSave(updateSave({ ...grantPrize(cur, { ...NO_PRIZE, gems: r.gems }, "duel_missions"), duel: r.profile }));
    if (r.bonus) setNotice(t("duel.missionsAllDone", { n: MISSIONS_ALL_DONE_PRIZE.coins }));
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
    const p = toggleDuelCosmetic(cur.duel, id);
    if (p) setSave(updateSave({ duel: p }));
  };


  if (replay) return <DuelReplay entry={replay} onBack={() => setReplay(null)} />;

  if (draft) {
    const options = draftOptions(draft.seed, draft.picked);
    return (
      <div className="pg-root">
        <style>{PAGE_CSS + LOBBY_CSS + MATCH_CSS}</style>
        <div className="pg-scroll">
          <div className="pg-wrap du-draft" data-testid="duel-draft">
            <h2 className="pg-h2">{t("duel.draftTitle", { n: draft.picked.length + 1, max: DECK_SIZE })}</h2>
            <div className="du-draft-opts">
              {options.map((id) => (
                <button key={id} className="du-cardbtn is-on du-draft-opt" onClick={() => pickDraft(id)} data-testid={`draft-${id}`}>
                  <CardFace id={id} />
                  <span className="du-desc">{t(`duel.card.${id}.desc` as TranslationKey)}</span>
                </button>
              ))}
            </div>
            <p className="pg-sub">{t("duel.draftDeck")}</p>
            <div className="du-draft-deck">
              {draft.picked.map((id) => (
                <CardFace key={id} id={id} small />
              ))}
              {Array.from({ length: DECK_SIZE - draft.picked.length }, (_, i) => (
                <span key={i} className="du-draft-empty" aria-hidden="true" />
              ))}
            </div>
            <button className="pg-btn-ghost" onClick={() => setDraft(null)}>
              {t("duel.draftCancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (match)
    return (
      <DuelMatch
        key={matchNo}
        engine={match}
        arenaId={mode === "ranked" || mode === "event" ? arena.id : "ARENA_ABYSS"}
        biome={mode === "ranked" || mode === "event" ? arena.biome : "ABYSS"}
        banner={banner}
        frame={frame}
        result={result}
        rankName={rankName}
        onFinish={finish}
        onAgain={mode === "weekly" ? startWeekly : mode === "tourney" ? startTourney : mode === "event" ? () => startEvent() : start}
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
          <DuelModesGrid
            cards={[
              {
                id: "RANKED",
                kicker: t("duel.modeRankedKicker"),
                title: t("duel.modeRanked"),
                pitch: t("duel.rankedRules"),
                art: `${arena.biome.toLowerCase()}`,
                status: duel.firstWinDay === day ? t("duel.firstWinDone") : t("duel.firstWinOpen"),
                prize: duel.firstWinDay === day ? null : FIRST_WIN_PRIZE,
                cta: t("duel.playRanked"),
                disabled: !deckOk,
                onPlay: start,
                testId: "duel-start",
                hot: true,
              },
              {
                id: "EVENT",
                kicker: `${t("duel.eventTitle")} · ${t("duel.eventEndsIn", { time: formatDurationShort((day + 1) * 86_400_000 - now) })}`,
                title: t(`duel.event.${todayEvent}.name` as TranslationKey),
                pitch: t(`duel.event.${todayEvent}.desc` as TranslationKey),
                art: "crystal_sea",
                status: duel.eventWinDay === day ? t("duel.eventPrizeDone") : t("duel.eventPrizeOpen", { n: EVENT_WIN_COINS }),
                prize: null,
                cta: t("duel.eventPlay"),
                disabled: (todayEvent === "MIRROR" || todayEvent === "DOUBLE_MANA") && !isValidDeck(duel.deck),
                onPlay: () => startEvent(),
                testId: "duel-event-start",
                badge: t("duel.modeNew"),
              },
              {
                id: "TOURNEY",
                kicker: t("duel.modeTourneyKicker"),
                title: t("duel.tourneyTitle"),
                pitch: t("duel.tourneyLead"),
                art: "abyss",
                status:
                  tourney === null
                    ? t("duel.tourneyClosed")
                    : tourney.won
                      ? t("duel.tourneyWon")
                      : tourney.out
                        ? t("duel.tourneyOut")
                        : t("duel.modeTourneyRound", { n: tourney.round + 1, max: TOURNEY_ROUNDS.length }),
                prize: TOURNEY_ROUNDS[TOURNEY_ROUNDS.length - 1]!.prize,
                prizeLabel: t("duel.modeTopPrize"),
                cta: tourney && !tourney.won && !tourney.out ? t("duel.tourneyPlay", { n: tourney.round + 1 }) : t("duel.modeUnavailable"),
                disabled: !deckOk || !tourney || tourney.won || tourney.out,
                onPlay: startTourney,
                testId: "duel-tourney-start",
                rounds: TOURNEY_ROUNDS.map((_, i) => (tourney && tourney.round > i ? "done" : tourney && tourney.out && tourney.round === i ? "lost" : "open")),
              },
              {
                id: "WEEKLY",
                kicker: t("duel.modeWeeklyKicker"),
                title: t("duel.weeklyTitle"),
                pitch: t("duel.weeklyLead", { coins: WEEKLY_CHALLENGE_COINS, gems: WEEKLY_CHALLENGE_GEMS }),
                art: "volcanic_wastes",
                status: weeklyDone ? t("duel.weeklyDone") : t("duel.modeWeeklyOpen"),
                prize: null,
                cta: weeklyDone ? t("duel.modePlayAgain") : t("duel.weeklyPlay"),
                disabled: false,
                onPlay: startWeekly,
                testId: "duel-weekly-start",
                deck: weekly.myDeck,
              },
            ]}
          />
          {notice && <p className="du-notice">{notice}</p>}

          <div className="du-tabs" role="tablist" aria-label={t("duel.tabsLabel")}>
            {DUEL_TABS.map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`du-tab${tab === id ? " is-on" : ""}`} onClick={() => pickTab(id)} data-testid={`duel-tab-${id}`}>
                <span aria-hidden="true">{TAB_ICON[id]}</span> {t(`duel.tabs.${id}` as TranslationKey)}
                {id === "missions" && missionsReady > 0 && <b className="du-tab-dot">{missionsReady}</b>}
                {id === "collection" && masteryReady > 0 && <b className="du-tab-dot">{masteryReady}</b>}
              </button>
            ))}
          </div>

          {tab === "missions" && (
          <section className="du-block" data-testid="duel-missions">
            <h2 className="pg-h2">{t("duel.missionsTitle")}</h2>
            <p className="pg-sub">
              {t("duel.missionsLead")} {t("duel.missionsBonus")} <PrizeLine prize={MISSIONS_ALL_DONE_PRIZE} />
            </p>
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
          )}

          {tab === "rewards" && (
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
                      {(LEAGUE_UNLOCKS[r.league] ?? []).length > 0 && (
                        <span className="du-unlock">✦ {(LEAGUE_UNLOCKS[r.league] ?? []).map((id) => t(`duel.shop.${id}` as TranslationKey)).join(", ")}</span>
                      )}
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
          )}

          {tab === "rewards" && (
          <section className="du-block" data-testid="duel-weekwins">
            <h2 className="pg-h2">{t("duel.weekWinsTitle")}</h2>
            <p className="pg-sub">{t("duel.weekWinsLead", { n: duel.weekWins.week === week ? duel.weekWins.wins : 0 })}</p>
            <div className="du-ladder">
              {WEEKLY_WIN_GOALS.map((g) => {
                const wins = duel.weekWins.week === week ? duel.weekWins.wins : 0;
                const paid = duel.weekWins.week === week && duel.weekWins.paid.includes(g.wins);
                return (
                  <div key={g.wins} className={`du-step${paid ? " is-done" : ""}`}>
                    <div>
                      <strong>{t("duel.weekWinsGoal", { n: g.wins })}</strong>
                      <div className="du-mbar">
                        <div style={{ width: `${Math.min(100, (wins / g.wins) * 100)}%` }} />
                      </div>
                      <PrizeLine prize={g.prize} />
                    </div>
                    <span className="du-step-tag">{paid ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {tab === "shop" && (
          <section className="du-block" data-testid="duel-shop">
            <div className="pg-head">
              <h2 className="pg-h2">{t("duel.shopTitle")}</h2>
              <span className="du-coins">
                <MaterialIcon kind="DUEL_COINS" size={22} /> {fmt(duel.coins)}
              </span>
            </div>
            <p className="pg-sub">{t("duel.shopLead")}</p>
            {(
              [
                ["skins", (i: DuelShopItem) => i.cosmetic?.kind === "TOWER_SKIN"],
                ["kills", (i: DuelShopItem) => i.cosmetic?.kind === "KILL_FX"],
                ["looks", (i: DuelShopItem) => i.cosmetic?.kind === "BANNER" || i.cosmetic?.kind === "FRAME"],
              ] as const
            ).map(([group, pick]) => (
              <div key={group} className="du-shop-group">
                <h3 className="du-shop-h">{t(`duel.shopGroup.${group}` as TranslationKey)}</h3>
                {(group === "skins" || group === "kills") && <p className="pg-sub">{t("duel.shopWhereShown")}</p>}
                <div className="du-shop">
                  {DUEL_SHOP.filter(pick).map((item) => {
                    const owned = duel.owned.includes(item.id);
                    const c = item.cosmetic;
                    const worn = duel.banner === item.id || duel.frame === item.id || duel.killFx === item.id || (c?.tower ? duel.towerSkins[c.tower] === item.id : false);
                    const weeklyLocked = item.weekly && duel.shopWeek === week;
                    return (
                      <div key={item.id} className={`du-item${c?.kind === "TOWER_SKIN" ? " is-skin" : ""}`}>
                        {c?.kind === "TOWER_SKIN" && c.skinId && c.tower ? (
                          <span className="du-skinart">
                            <Tower3DPortrait type={c.tower} level={41} skinId={c.skinId} width={110} height={110} />
                          </span>
                        ) : c?.kind === "KILL_FX" && c.fx ? (
                          <KillFxPreview fx={c.fx} />
                        ) : c ? (
                          <span className={`du-swatch is-${c.kind}`} style={{ background: `linear-gradient(160deg, ${c.color}, ${c.color2})` }} aria-hidden="true" />
                        ) : (
                          <span className="du-swatch is-mat" aria-hidden="true">
                            <MaterialIcon kind={item.id === "EPIC" ? "EPIC" : item.id === "RARE" ? "RARE" : "SPLINTERS"} size={40} />
                          </span>
                        )}
                        <strong>{t(`duel.shop.${item.id}` as TranslationKey)}</strong>
                        {c?.tower && <small className="du-item-tower">{t(`towers.${c.tower}.name` as TranslationKey)}</small>}
                        {item.prize && <PrizeLine prize={item.prize} />}
                        {item.weekly && <small>{t("duel.shopWeekly")}</small>}
                        {item.earnedOnly && !owned ? (
                          <button className="pg-btn-ghost" disabled>
                            {(() => {
                              const how = earnedHow(item.id);
                              if (how.league) return t("duel.earnedLeague", { name: t(`duel.league.${how.league}` as TranslationKey) });
                              if (how.tourney || item.id === TOURNEY_BANNER) return t("duel.tourneyOnly");
                              if (how.weekly) return t("duel.earnedWeekly");
                              if (how.ranked) return t("duel.earnedRanked", { board: t(`ranked.board.${how.ranked}` as TranslationKey) });
                              if (how.creator) return t("duel.earnedCreator");
                              return t("duel.earnedOnly");
                            })()}
                          </button>
                        ) : owned ? (
                          <button className="pg-btn-ghost" onClick={() => wear(item.id)}>
                            {worn ? t("duel.wearing") : t("duel.wear")}
                          </button>
                        ) : (
                          <button className="pg-btn" disabled={duel.coins < item.price || !!weeklyLocked} onClick={() => buy(item.id)}>
                            {weeklyLocked ? (
                              t("duel.shopWeeklyDone")
                            ) : (
                              <>
                                <MaterialIcon kind="DUEL_COINS" size={16} /> {fmt(item.price)}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
          )}

          {tab === "history" && (
          <section className="du-block" data-testid="duel-history">
            <h2 className="pg-h2">{t("duel.historyTitle")}</h2>
            <p className="pg-sub">{t("duel.historyLead")}</p>
            {duel.history.length === 0 ? (
              <p className="pg-sub">{t("duel.historyEmpty")}</p>
            ) : (
              <ul className="du-history">
                {duel.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className={`du-hrow is-${h.outcome}`}>
                    <span className="du-hres">{t(h.outcome === "WIN" ? "duel.win" : h.outcome === "LOSS" ? "duel.loss" : "duel.draw")}</span>
                    <span className="du-hscore">
                      {h.myCastle} – {h.foeCastle}
                    </span>
                    <span className="du-hmeta">
                      {t(`duel.historyMode.${h.mode}` as TranslationKey)}
                      {h.event && ` · ${t(`duel.event.${h.event}.name` as TranslationKey)}`}
                      {h.mode === "RANKED" && <b className={h.trophyChange > 0 ? "is-up" : h.trophyChange < 0 ? "is-down" : ""}> {(h.trophyChange > 0 ? "+" : "") + h.trophyChange} 🏆</b>}
                    </span>
                    <span className="du-hdate">{new Date(h.at).toLocaleString(language === "ptBR" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" })}</span>
                    {canReplay(h) ? (
                      <button className="pg-btn-ghost du-hbtn" onClick={() => setReplay(h)} data-testid={`history-replay-${i}`}>
                        ▶ {t("duel.historyReplay")}
                      </button>
                    ) : (
                      <small className="du-hold">{t("duel.historyOld")}</small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          {tab === "collection" && (
          <section className="du-block" data-testid="duel-mastery">
            <h2 className="pg-h2">{t("duel.masteryTitle")}</h2>
            <p className="pg-sub">{t("duel.masteryLead")}</p>
            <div className="du-mastery">
              {DUEL_CARDS.map((c) => {
                const m = duel.mastery[c.id] ?? { wins: 0, claimed: 0 };
                const level = cardMasteryLevel(m.wins);
                const nextL = MASTERY_LEVELS[level];
                const prev = level > 0 ? MASTERY_LEVELS[level - 1]!.wins : 0;
                const claimable = masteryClaimable(duel, c.id);
                const coins = MASTERY_LEVELS.slice(m.claimed, level).reduce((s2, l) => s2 + l.coins, 0);
                return (
                  <div key={c.id} className="du-mcard" data-testid={`mastery-${c.id}`}>
                    <CardFace id={c.id} small />
                    <div>
                      <strong>
                        {t(`duel.card.${c.id}.name` as TranslationKey)} <MasteryStars level={level} />
                      </strong>
                      <small>{nextL ? t("duel.masteryProgress", { wins: m.wins, need: nextL.wins }) : t("duel.masteryMax", { wins: m.wins })}</small>
                      <div className="du-mbar">
                        <div style={{ width: `${nextL ? ((m.wins - prev) / (nextL.wins - prev)) * 100 : 100}%` }} />
                      </div>
                    </div>
                    {claimable > 0 && (
                      <button className="pg-btn du-mclaim" onClick={() => collectMastery(c.id)} data-testid={`mastery-claim-${c.id}`}>
                        {t("duel.masteryClaim", { n: coins })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {tab === "deck" && (
          <section className="du-deck">
            <div className="pg-head">
              <h2 className="pg-h2">{t("duel.deck")}</h2>
              <span className={deckOk ? "du-count" : "du-count is-bad"}>{t("duel.deckCount", { n: deck.length })}</span>
            </div>
            <div className="du-slots" role="tablist">
              {Array.from({ length: DECK_SLOTS }, (_, i) => (
                <button key={i} role="tab" aria-selected={duel.activeDeck === i} className={`du-slot${duel.activeDeck === i ? " is-on" : ""}`} onClick={() => pickSlot(i)} data-testid={`deck-slot-${i}`}>
                  {t("duel.deckSlot", { n: i + 1 })}
                </button>
              ))}
              <span className="du-avg" data-testid="deck-avg">
                {t("duel.avgCost", { n: deckAverageCost(deck).toLocaleString(language === "ptBR" ? "pt-BR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
              </span>
            </div>
            <p className="pg-sub">{deckOk ? t("duel.deckHint") : t("duel.deckInvalid")}</p>
            <p className="pg-sub">{t("duel.collectionHint")}</p>
            <div className="du-cards">
              {DUEL_CARDS.map((c) => {
                const on = deck.includes(c.id);
                const lvl = cardMasteryLevel(duel.mastery[c.id]?.wins ?? 0);
                const lock = CARD_UNLOCKS[c.id];
                if (lock && !ownsCard(duel, c.id))
                  return (
                    <div key={c.id} className="du-cardbtn is-locked" data-testid={`deck-${c.id}`}>
                      <span className="du-lock" aria-hidden="true">
                        🔒
                      </span>
                      <CardFace id={c.id} dim />
                      <span className="du-desc">{t(`duel.card.${c.id}.desc` as TranslationKey)}</span>
                      <span className="du-unlock">{t("duel.cardUnlockAt", { arena: t(`duel.arenas.${lock.arenaId}` as TranslationKey) })}</span>
                      <button
                        className="du-buycard"
                        disabled={duel.coins < lock.price}
                        onClick={() => {
                          const cur = loadSave();
                          const next = buyCard(cur.duel, c.id);
                          if (!next) return;
                          setSave(updateSave({ duel: next }));
                          setNotice(t("duel.cardBought", { name: t(`duel.card.${c.id}.name` as TranslationKey) }));
                        }}
                        data-testid={`buy-card-${c.id}`}
                      >
                        <MaterialIcon kind="DUEL_COINS" size={15} /> {t("duel.cardBuy", { n: lock.price })}
                      </button>
                    </div>
                  );
                return (
                  <button key={c.id} className={`du-cardbtn${on ? " is-on" : ""}`} onClick={() => toggleCard(c.id)} aria-pressed={on} data-testid={`deck-${c.id}`}>
                    {lvl > 0 && (
                      <span className="du-mbadge" title={t("duel.masteryBadge", { n: lvl })}>
                        <MasteryStars level={lvl} />
                      </span>
                    )}
                    <CardFace id={c.id} dim={!on} />
                    <span className="du-desc">{t(`duel.card.${c.id}.desc` as TranslationKey)}</span>
                  </button>
                );
              })}
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** The AI's deck per arena — always valid, a little meaner in higher arenas. */
function aiDeck(arenaId: string): DuelCardId[] {
  if (arenaId === "ARENA_FOREST") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SHIELDS"];
  if (arenaId === "ARENA_VOLCANO") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_SWARM", "S_BRUTE", "X_RAGE"];
  if (arenaId === "ARENA_TUNDRA") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_RUNNERS", "S_SWARM", "S_SHIELDS", "X_FREEZE"];
  if (arenaId === "ARENA_ABYSS") return ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "S_RUNNERS", "S_SWARM", "S_SHIELDS", "S_IRONCLAD", "X_METEOR"];
  return ["T_IRONWOOD", "T_INFERNO", "T_STORMCALLER", "S_REGEN", "S_DISABLER", "S_SWARM", "X_WARD", "X_METEOR"];
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

/** The match intro: the VS card, then 3-2-1, then "Fight!" while the match is already running. */
const INTRO_VS_MS = 1800;
const INTRO_COUNT_MS = 1200;
const INTRO_FIGHT_MS = 700;

function DuelMatch({ engine, arenaId, biome, banner, frame, result, rankName, onFinish, onAgain, onLobby }: DuelMatchProps) {
  const { t } = useLanguage();
  const commander = commanderFor(arenaId);
  const foeName = `${t(`duel.commander.${commander.id}.name` as TranslationKey)} · ${t("duel.aiTag")}`;
  // ms since the match screen opened (drives the intro overlay); the clock only starts after the countdown
  const [introT, setIntroT] = useState(0);
  const introRunning = introT < INTRO_VS_MS + INTRO_COUNT_MS;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snap, setSnap] = useState<DuelSnapshot>(() => engine.snapshot());
  const [picked, setPicked] = useState<DuelCardId | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [aimPt, setAimPt] = useState<Pt | null>(null);
  const aimRef = useRef(aimPt);
  aimRef.current = aimPt;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const finishedRef = useRef(false);

  useEffect(() => {
    setSpriteBiome(biome);
    if (import.meta.env.DEV) (window as unknown as { __hordenovaDuel?: DuelEngine }).__hordenovaDuel = engine;
    const sound = new DuelAudio();
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const opened = performance.now();
    const holdUntil = opened + INTRO_VS_MS + INTRO_COUNT_MS;
    let fightSaid = false;
    const loop = (now: number) => {
      const since = now - opened;
      if (since < INTRO_VS_MS + INTRO_COUNT_MS + INTRO_FIGHT_MS + 50) setIntroT(since);
      if (now < holdUntil) {
        last = now;
      } else if (!fightSaid) {
        fightSaid = true;
        audioManager.play("wave_start", { volume: 0.9 });
      }
      acc += Math.min(1000, now - last);
      last = now;
      if (acc >= 50) {
        const steps = Math.floor(acc / 50) * 50;
        engine.advance(steps);
        acc -= steps;
      }
      const s = engine.snapshot();
      sound.update(s);
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
        const pc = pickedRef.current ? getDuelCard(pickedRef.current) : null;
        const ap = aimRef.current;
        const aim = pc?.kind === "SPELL" && pc.aimed && ap ? { x: ap.x, y: ap.y, radius: pc.radius ?? 60, ok: DuelEngine.onOwnLane(0, ap) } : null;
        drawDuelFrame(ctx, s, arenaId, biome, now, pc?.kind === "TOWER", hoverRef.current, banner, aim);
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
  const left = snap.overtime ? Math.max(0, DUEL_LENGTH_MS + DUEL_OVERTIME_MS - snap.timeMs) : Math.max(0, DUEL_LENGTH_MS - snap.timeMs);
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

  const boardPt = (ev: React.MouseEvent<HTMLCanvasElement>): Pt => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  };

  const onCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picked) return;
    const card = getDuelCard(picked);
    if (card?.kind === "SPELL" && card.aimed) {
      if (engine.play(0, picked, undefined, boardPt(ev))) {
        setPicked(null);
        setAimPt(null);
      }
      return;
    }
    if (card?.kind !== "TOWER") return;
    const slot = slotAt(ev);
    if (slot !== null && engine.play(0, picked, slot)) setPicked(null);
  };

  const onCard = (id: DuelCardId) => {
    const card = getDuelCard(id)!;
    if (card.kind === "SEND" || (card.kind === "SPELL" && !card.aimed)) {
      engine.play(0, id);
      setPicked(null);
    } else setPicked((p) => (p === id ? null : id));
  };

  return (
    <div style={{ ...matchRoot, ...(frame ? { ["--fr1" as string]: frame.color, ["--fr2" as string]: frame.color2 } : null) }} className={`dm-match${frame ? " has-frame" : ""}`}>
      <style>{MATCH_CSS}</style>
      <div className="dm-top">
        <div className="dm-side">
          <span className="dm-crest is-you" aria-hidden="true">⚔</span>
          <div>
            <strong>{t("duel.you")}</strong>
            <CastleBar hp={me.castle} />
          </div>
        </div>
        <div
          className={`dm-clock${snap.overtime ? " is-overtime" : snap.doubleMana ? " is-double" : ""}`}
          style={{ ["--p" as string]: `${(snap.overtime ? (snap.timeMs - DUEL_LENGTH_MS) / DUEL_OVERTIME_MS : snap.timeMs / DUEL_LENGTH_MS) * 360}deg` }}
          data-testid="duel-clock"
        >
          <div className="dm-clock-face">
            <span>{clock}</span>
          </div>
          {snap.overtime ? <small>{t("duel.overtime")}</small> : snap.doubleMana && <small>{t("duel.doubleMana")}</small>}
        </div>
        <div className="dm-side is-foe">
          <div>
            <strong>{foeName}</strong>
            <CastleBar hp={foe.castle} foe />
          </div>
          <span className="dm-crest is-foe" aria-hidden="true" style={{ color: commander.color, borderColor: commander.color }}>
            {commander.crest}
          </span>
        </div>
      </div>
      <div className="dm-stage">
        {introT < INTRO_VS_MS + INTRO_COUNT_MS + INTRO_FIGHT_MS && (
          <div className="dm-intro" aria-live="polite" data-testid="duel-intro">
            {introT < INTRO_VS_MS ? (
              <div className="dm-vs">
                <div className="dm-vs-side is-you">
                  <span className="dm-vs-crest">⚔</span>
                  <strong>{t("duel.you")}</strong>
                </div>
                <span className="dm-vs-mark">{t("duel.introVs")}</span>
                <div className="dm-vs-side is-foe" style={{ ["--cc" as string]: commander.color }}>
                  <span className="dm-vs-crest">{commander.crest}</span>
                  <strong>{t(`duel.commander.${commander.id}.name` as TranslationKey)}</strong>
                  <small>
                    {t(`duel.commander.${commander.id}.title` as TranslationKey)} · {t("duel.aiTag")}
                  </small>
                </div>
              </div>
            ) : introT < INTRO_VS_MS + INTRO_COUNT_MS ? (
              <span key={Math.floor((introT - INTRO_VS_MS) / 400)} className="dm-count">
                {3 - Math.floor((introT - INTRO_VS_MS) / 400)}
              </span>
            ) : (
              <span className="dm-count is-fight">{t("duel.introFight")}</span>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="dm-canvas"
          style={{ cursor: picked ? "pointer" : "default" }}
          onClick={onCanvasClick}
          onMouseMove={(e) => {
            setHover(picked ? slotAt(e) : null);
            setAimPt(picked && getDuelCard(picked)?.kind === "SPELL" ? boardPt(e) : null);
          }}
          onMouseLeave={() => setAimPt(null)}
          data-testid="duel-canvas"
        />
        {picked && getDuelCard(picked)?.kind === "TOWER" && <div className="dm-hint">{t("duel.pickSlot")}</div>}
        {picked && getDuelCard(picked)?.kind === "SPELL" && <div className="dm-hint">{t("duel.pickSpot")}</div>}
        {!picked && snap.overtime && !snap.over && <div className="dm-hint is-ot">{t("duel.overtimeHint")}</div>}
        <EmoteLayer snap={snap} />
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
            {result.tourneyWon && <p className="dm-tag is-gold">{t("duel.tourneyChampion")}</p>}
            {!result.tourneyWon && result.tourneyRound ? <p className="dm-tag">{t("duel.tourneyNext", { n: result.tourneyRound + 1 })}</p> : null}
            {result.unlocked && result.unlocked.length > 0 && (
              <p className="dm-tag is-gold">{t("duel.unlockedTag", { list: result.unlocked.map((id) => t(`duel.shop.${id}` as TranslationKey)).join(", ") })}</p>
            )}
            {result.cardsUnlocked && result.cardsUnlocked.length > 0 && (
              <p className="dm-tag is-gold" data-testid="cards-unlocked">
                {t("duel.cardsUnlockedTag", { list: result.cardsUnlocked.map((id) => t(`duel.card.${id}.name` as TranslationKey)).join(", ") })}
              </p>
            )}
            {result.firstWin && <p className="dm-tag">{t("duel.firstWinTag")}</p>}
            {result.streakBonus && <p className="dm-tag">{t("duel.streakTag", { n: result.streakBonus })}</p>}
            {(result.prize.coins || result.prize.gems || result.prize.shards) > 0 && (
              <p>
                <PrizeLine prize={result.prize} />
              </p>
            )}
            <MatchStats engine={engine} />
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
          <span key={Math.floor(me.mana)} className="dm-mana-orb">
            <b>{Math.floor(me.mana)}</b>
          </span>
          <div className="dm-mana-bar">
            {Array.from({ length: DUEL_MAX_MANA }, (_, i) => (
              <i key={i} className={i < me.mana ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="dm-cards">
          {me.hand.map((id, i) => {
            const card = getDuelCard(id)!;
            const can = me.mana >= card.cost && !snap.over && !introRunning;
            // how far the mana is towards this card: drawn as a filling veil while it's not yet playable
            const fill = Math.min(1, me.mana / card.cost);
            return (
              <button
                key={`${id}-${i}`}
                className={`dm-card is-${card.kind}${picked === id ? " is-picked" : ""}${can ? " is-ready" : ""}`}
                style={{ ["--i" as string]: i, ["--fill" as string]: fill } as CSSProperties}
                disabled={!can}
                onClick={() => onCard(id)}
                title={t(`duel.card.${id}.desc` as TranslationKey)}
                data-testid={`hand-${id}`}
              >
                <span className="dm-card-body">
                  <CardFace id={id} dim={!can} />
                  {me.mana < card.cost && !snap.over && <span className="dm-card-charge" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
          <div className="dm-next">
            <small>{t("duel.next")}</small>
            <span key={me.next} className="dm-next-card">
              <CardFace id={me.next} small />
            </span>
          </div>
        </div>
        <EmoteButton />
        {!snap.over && (
          <button className="dm-btn is-ghost dm-quit" onClick={() => engine.surrender()}>
            {t("duel.surrender")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── EMOTES ────────────────────────────────────────────────────────────
const EMOTES = ["GG", "WOW", "HAHA", "ANGRY", "THANKS", "OOPS"] as const;
type EmoteId = (typeof EMOTES)[number];
const EMOTE_ICON: Record<EmoteId, string> = { GG: "🤝", WOW: "😮", HAHA: "😂", ANGRY: "😡", THANKS: "👍", OOPS: "😅" };
const EMOTE_SHOW_MS = 2200;
const EMOTE_COOLDOWN_MS = 3000;

/** A tiny bus so the hand's emote button and the board's bubbles talk without prop threading. */
const emoteBus = new EventTarget();
function say(side: 0 | 1, id: EmoteId) {
  emoteBus.dispatchEvent(new CustomEvent("emote", { detail: { side, id } }));
}

/** Speech bubbles over each castle, and the AI's replies (it reacts to hits, your emotes and the result). Not part of the match itself. */
function EmoteLayer({ snap }: { snap: DuelSnapshot }) {
  const { t } = useLanguage();
  const [bubbles, setBubbles] = useState<{ side: 0 | 1; id: EmoteId; key: number }[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const lastFoeEmote = useRef(0);
  const seenBreach = useRef(new Set<string>());
  const endSaid = useRef(false);

  useEffect(() => {
    const on = (e: Event) => {
      const { side, id } = (e as CustomEvent<{ side: 0 | 1; id: EmoteId }>).detail;
      if (side === 1 && mutedRef.current) return;
      audioManager.play("loot_common", { volume: side === 0 ? 0.5 : 0.35, pitch: side === 0 ? 1.1 : 0.9 });
      const key = Date.now() + Math.random();
      setBubbles((b) => [...b.filter((x) => x.side !== side), { side, id, key }]);
      window.setTimeout(() => setBubbles((b) => b.filter((x) => x.key !== key)), EMOTE_SHOW_MS);
      // the AI sometimes answers you
      if (side === 0 && Math.random() < 0.45) {
        const reply: EmoteId = id === "GG" ? "GG" : id === "HAHA" ? (Math.random() < 0.5 ? "ANGRY" : "HAHA") : id === "ANGRY" ? "HAHA" : id === "THANKS" ? "THANKS" : "WOW";
        window.setTimeout(() => foeSay(reply), 900 + Math.random() * 900);
      }
    };
    emoteBus.addEventListener("emote", on);
    return () => emoteBus.removeEventListener("emote", on);
  }, []);

  function foeSay(id: EmoteId) {
    const now = Date.now();
    if (now - lastFoeEmote.current < 4000) return;
    lastFoeEmote.current = now;
    say(1, id);
  }

  // react to castle hits and to the end of the match
  useEffect(() => {
    for (const b of snap.breaches) {
      const k = `${b.side}:${b.at}`;
      if (seenBreach.current.has(k)) continue;
      seenBreach.current.add(k);
      if (b.side === 0 && Math.random() < 0.3) foeSay("HAHA");
      else if (b.side === 1 && Math.random() < 0.25) foeSay(Math.random() < 0.5 ? "ANGRY" : "OOPS");
    }
    if (snap.over && !endSaid.current) {
      endSaid.current = true;
      lastFoeEmote.current = 0;
      if (Math.random() < 0.75) foeSay(snap.outcome === "WIN" ? "GG" : snap.outcome === "LOSS" ? "HAHA" : "WOW");
    }
  });

  return (
    <>
      {bubbles.map((b) => (
        <div key={b.key} className={`dm-emote is-side${b.side}`} role="status" data-testid={`emote-${b.side}`}>
          <span className="dm-emote-ico" aria-hidden="true">
            {EMOTE_ICON[b.id]}
          </span>
          <span>{t(`duel.emote.${b.id}` as TranslationKey)}</span>
        </div>
      ))}
      <button className={`dm-mute${muted ? " is-on" : ""}`} onClick={() => setMuted((m) => !m)} aria-pressed={muted} title={muted ? "🔇" : "🔈"}>
        {muted ? "🔇" : "🔈"}
      </button>
    </>
  );
}

function EmoteButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [coolUntil, setCoolUntil] = useState(0);
  const [, force] = useState(0);
  useEffect(() => {
    if (coolUntil <= Date.now()) return;
    const id = window.setTimeout(() => force((n) => n + 1), coolUntil - Date.now() + 20);
    return () => window.clearTimeout(id);
  }, [coolUntil]);
  const cooling = coolUntil > Date.now();
  return (
    <div className="dm-emotes">
      <button className="dm-btn is-ghost dm-emote-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("duel.emotes")} data-testid="emote-open">
        💬
      </button>
      {open && (
        <div className="dm-emote-menu" role="menu">
          {EMOTES.map((id) => (
            <button
              key={id}
              role="menuitem"
              disabled={cooling}
              onClick={() => {
                say(0, id);
                setCoolUntil(Date.now() + EMOTE_COOLDOWN_MS);
                setOpen(false);
              }}
              data-testid={`emote-${id}`}
            >
              <span aria-hidden="true">{EMOTE_ICON[id]}</span>
              {t(`duel.emote.${id}` as TranslationKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The result screen's "your cards this match": damage and castle damage per card, best one marked MVP. */
function MatchStats({ engine }: { engine: DuelEngine }) {
  const { t, language } = useLanguage();
  const rows = engine.matchStats(0).filter((r) => r.damage > 0 || r.breach > 0).slice(0, 4);
  if (!rows.length) return null;
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  return (
    <div className="dm-stats" data-testid="duel-stats">
      <small>{t("duel.statsTitle")}</small>
      <ul>
        {rows.map((r, i) => (
          <li key={r.card} className={i === 0 ? "is-mvp" : undefined}>
            <CardFace id={r.card} small />
            <span className="dm-stats-name">
              {t(`duel.card.${r.card}.name` as TranslationKey)}
              {i === 0 && <b className="dm-mvp">{t("duel.statsMvp")}</b>}
            </span>
            <span className="dm-stats-val">{r.breach > 0 ? t("duel.statsBreach", { n: r.breach }) : t("duel.statsDamage", { n: fmt(r.damage) })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── lobby: game modes + tabs ─────────────────────────────────────────────
const DUEL_TABS = ["deck", "missions", "rewards", "collection", "history", "shop"] as const;
type DuelTab = (typeof DUEL_TABS)[number];
const TAB_KEY = "hordenova.duel.tab";
const TAB_ICON: Record<DuelTab, string> = { deck: "🃏", missions: "🎯", rewards: "🏆", collection: "⭐", history: "📜", shop: "🛒" };
const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

interface DuelModeCard {
  id: "RANKED" | "EVENT" | "TOURNEY" | "WEEKLY";
  kicker: string;
  title: string;
  pitch: string;
  /** Duel board art (sprites/duel/<art>.webp). */
  art: string;
  status: string;
  prize: DuelPrize | null;
  prizeLabel?: string;
  cta: string;
  disabled: boolean;
  onPlay: () => void;
  testId: string;
  hot?: boolean;
  badge?: string;
  rounds?: ("done" | "lost" | "open")[];
  deck?: DuelCardId[];
}

/** The four ways to play, as big illustrated cards at the top of the lobby. */
function DuelModesGrid({ cards }: { cards: DuelModeCard[] }) {
  const { t } = useLanguage();
  return (
    <section className="dmo" aria-labelledby="dmo-title" data-testid="duel-modes">
      <h2 className="pg-h2" id="dmo-title">
        {t("duel.modesTitle")}
      </h2>
      <div className="dmo-grid">
        {cards.map((c) => (
          <article key={c.id} className={`dmo-card is-${c.id}${c.hot ? " is-hot" : ""}`} data-testid={`duel-mode-${c.id}`}>
            <div className="dmo-art" style={{ backgroundImage: `url(${assetBase}sprites/duel/${c.art}.webp)` }} onClick={c.disabled ? undefined : c.onPlay} aria-hidden="true">
              {c.badge && <span className="dmo-badge">{c.badge}</span>}
              <span className="dmo-glyph">{c.id === "RANKED" ? "⚔" : c.id === "EVENT" ? "✦" : c.id === "TOURNEY" ? "♛" : "⚑"}</span>
            </div>
            <div className="dmo-body">
              <p className="dmo-kicker">{c.kicker}</p>
              <h3 className="dmo-title">{c.title}</h3>
              <p className="dmo-pitch">{c.pitch}</p>
              {c.rounds && (
                <div className="dmo-rounds" aria-label={c.status}>
                  {c.rounds.map((r, i) => (
                    <span key={i} className={`is-${r}`}>{r === "done" ? "✓" : r === "lost" ? "✕" : i + 1}</span>
                  ))}
                </div>
              )}
              {c.deck && (
                <div className="dmo-deck">
                  {c.deck.map((id) => (
                    <CardFace key={id} id={id} small />
                  ))}
                </div>
              )}
              <p className="dmo-status">{c.status}</p>
              {c.prize && (
                <p className="dmo-prize">
                  {c.prizeLabel && <span>{c.prizeLabel} </span>}
                  <PrizeLine prize={c.prize} />
                </p>
              )}
              <button className="dmo-play" disabled={c.disabled} onClick={c.onPlay} data-testid={c.testId}>
                {c.cta}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MasteryStars({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span className={`du-stars is-l${level}`} aria-label={`${level}`}>
      {"★".repeat(level)}
    </span>
  );
}

/** REPLAY — plays a past match again from its seed and your plays (the AI decides the same way). */
function DuelReplay({ entry, onBack }: { entry: DuelHistoryEntry; onBack: () => void }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [snap, setSnap] = useState<DuelSnapshot | null>(null);

  useEffect(() => {
    setSpriteBiome(entry.biome);
    const engine = new DuelEngine(entry.seed, [entry.decks[0], entry.decks[1]], entry.ai, {}, entry.doubleMana ? { doubleMana: true } : {});
    const sound = new DuelAudio();
    let next = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      if (!pausedRef.current) acc += Math.min(1000, now - last) * speedRef.current;
      last = now;
      while (acc >= 50 && !engine.over) {
        acc -= 50;
        engine.advance(50);
        while (next < entry.plays.length && entry.plays[next]!.t <= engine.timeMs) {
          const p = entry.plays[next++]!;
          engine.play(0, p.card, p.slot, p.at);
        }
      }
      const s = engine.snapshot();
      sound.update(s);
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth;
        if (cv.width !== Math.round(w * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(((w * H) / W) * dpr);
        }
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        drawDuelFrame(ctx, s, entry.arenaId, entry.biome, now, false, null, null);
      }
      setSnap(s);
      if (!s.over) raf = requestAnimationFrame(loop);
    };
    // plays made at time 0 (before the first tick)
    while (next < entry.plays.length && entry.plays[next]!.t <= 0) {
      const p = entry.plays[next++]!;
      engine.play(0, p.card, p.slot, p.at);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [entry, run]);

  const me = snap?.players[0];
  const foe = snap?.players[1];
  const tm = snap?.timeMs ?? 0;
  const left = snap?.overtime ? Math.max(0, DUEL_LENGTH_MS + DUEL_OVERTIME_MS - tm) : Math.max(0, DUEL_LENGTH_MS - tm);
  const clock = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <div style={matchRoot} data-testid="duel-replay">
      <style>{MATCH_CSS}</style>
      <div className="dm-top">
        <div className="dm-side">
          <span className="dm-crest is-you" aria-hidden="true">⚔</span>
          <div>
            <strong>{t("duel.you")}</strong>
            <CastleBar hp={me?.castle ?? 20} />
          </div>
        </div>
        <div className={`dm-clock${snap?.overtime ? " is-overtime" : snap?.doubleMana ? " is-double" : ""}`} style={{ ["--p" as string]: `${(snap?.overtime ? (tm - DUEL_LENGTH_MS) / DUEL_OVERTIME_MS : tm / DUEL_LENGTH_MS) * 360}deg` }}>
          <div className="dm-clock-face">
            <span>{clock}</span>
          </div>
          <small>{t("duel.replayTitle")}</small>
        </div>
        <div className="dm-side is-foe">
          <div>
            <strong>{t("duel.foe")}</strong>
            <CastleBar hp={foe?.castle ?? 20} foe />
          </div>
          <span className="dm-crest is-foe" aria-hidden="true">☠</span>
        </div>
      </div>
      <div className="dm-stage">
        <canvas ref={canvasRef} className="dm-canvas" data-testid="replay-canvas" />
        {snap?.over && (
          <div className="dm-result" role="dialog">
            <h2 className={`is-${snap.outcome}`}>{t(snap.outcome === "WIN" ? "duel.win" : snap.outcome === "LOSS" ? "duel.loss" : "duel.draw")}</h2>
            <div className="dm-result-actions">
              <button className="dm-btn" onClick={() => setRun((n) => n + 1)}>
                {t("duel.replayRestart")}
              </button>
              <button className="dm-btn is-ghost" onClick={onBack}>
                {t("duel.replayBack")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="dm-hand dm-replaybar">
        <button className="dm-btn" onClick={() => setPaused((p) => !p)} data-testid="replay-pause">
          {paused ? `▶ ${t("duel.replayPlay")}` : `⏸ ${t("duel.replayPause")}`}
        </button>
        {[1, 2, 4].map((n) => (
          <button key={n} className={`dm-btn${speed === n ? "" : " is-ghost"}`} onClick={() => setSpeed(n)} aria-pressed={speed === n} data-testid={`replay-speed-${n}`}>
            {t("duel.replaySpeed", { n })}
          </button>
        ))}
        <button className="dm-btn is-ghost" onClick={onBack}>
          {t("duel.replayBack")}
        </button>
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

const matchRoot: CSSProperties = { position: "fixed", inset: 0, display: "grid", gridTemplateRows: "auto 1fr auto", gridTemplateColumns: "minmax(0, 1fr)", background: "#0d0a07", color: "#efe4cf" };

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
.du-prize { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; color: var(--bone); font-weight: 600; vertical-align: middle; }
.du-pz { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.du-coins { display: inline-flex; align-items: center; gap: 6px; }
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
.du-unlock { color: #ffd56a; font-weight: 700; font-size: 12.5px; }
.du-step-tag { font-size: 20px; color: #9be37a; font-weight: 800; }
.du-streaks { margin: 6px 0 0; padding-left: 18px; color: var(--ash); font-size: 14px; display: grid; gap: 4px; }
.du-coins { font-size: 18px; font-weight: 800; color: #8ae0d0; }
.du-shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-top: 14px; }
.du-item { display: grid; justify-items: start; gap: 6px; padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); font-size: 13px; }
.du-item strong { font-size: 15px; color: var(--bone); }
.du-item small { color: #d8a8ff; }
.du-item small.du-item-tower { color: var(--ash); }
.du-item.is-skin { border-color: rgba(232,176,75,0.4); }
.du-skinart { width: 110px; height: 110px; border-radius: 10px; background: radial-gradient(circle at 50% 60%, rgba(255,214,140,0.12), rgba(0,0,0,0.35)); display: grid; place-items: center; }
.du-fxprev { border-radius: 10px; background: radial-gradient(circle at 50% 70%, rgba(255,255,255,0.06), rgba(0,0,0,0.4)); }
.du-shop-group { margin-top: 18px; }
.du-shop-h { margin: 0; font-family: var(--display); font-size: 20px; color: var(--bone); }
.du-shop-group .pg-sub { margin: 2px 0 0; }
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
.du-tourney { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; margin-top: 28px; padding: 20px 22px; border-radius: 12px; border: 1px solid rgba(255,213,106,0.5); background: linear-gradient(100deg, rgba(255,213,106,0.12), rgba(24,18,12,0.6) 60%); }
.du-tourney .pg-sub { margin: 4px 0 0; max-width: 62ch; }
.du-rounds { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 0; padding: 0; list-style: none; }
.du-rounds li { display: grid; gap: 4px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0,0,0,0.3); font-size: 13px; }
.du-rounds li.is-done { border-color: rgba(155,227,122,0.6); }
.du-rounds li.is-lost { border-color: rgba(224,100,75,0.6); opacity: 0.7; }
.du-rounds strong { color: var(--bone); }
.du-rounds small { color: #ffd56a; }
.du-weekly { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; margin-top: 28px; padding: 20px 22px; border-radius: 12px; border: 1px solid rgba(180,124,255,0.45); background: linear-gradient(100deg, rgba(180,124,255,0.12), rgba(24,18,12,0.6) 60%); }
.du-weekly .pg-sub { margin: 4px 0 0; max-width: 60ch; }
.du-weekly-decks { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: var(--ash); }
.du-count { font-size: 14px; color: var(--ash); }
.du-count.is-bad { color: #ff9a85; }
.du-event { display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; margin-top: 28px; padding: 20px 22px; border-radius: 12px; border: 1px solid rgba(160,120,255,0.5); background: linear-gradient(110deg, rgba(110,70,200,0.22), rgba(24,18,12,0.6) 60%); }
.du-event.is-DOUBLE_MANA { border-color: rgba(197,139,255,0.6); }
.du-event.is-DRAFT { border-color: rgba(120,200,255,0.55); background: linear-gradient(110deg, rgba(60,140,210,0.22), rgba(24,18,12,0.6) 60%); }
.du-event.is-MIRROR { border-color: rgba(220,220,240,0.5); background: linear-gradient(110deg, rgba(170,170,200,0.2), rgba(24,18,12,0.6) 60%); }
.du-event.is-RANDOM { border-color: rgba(255,160,90,0.55); background: linear-gradient(110deg, rgba(220,120,50,0.22), rgba(24,18,12,0.6) 60%); }
.du-event > div { max-width: 70ch; display: grid; gap: 6px; }
.du-event .pg-sub { margin: 0; }
.du-event .pg-h2 { margin: 0; }
.du-event-kicker { font-size: 12.5px; color: #d8c6ff; font-weight: 700; }
.du-draft { padding-top: 40px; padding-bottom: 40px; display: grid; gap: 16px; justify-items: start; }
.du-draft-opts { display: flex; flex-wrap: wrap; gap: 16px; }
.du-draft-opt { width: 190px; }
.du-draft-deck { display: flex; flex-wrap: wrap; gap: 8px; }
.du-draft-empty { width: 64px; height: 84px; border-radius: 10px; border: 1px dashed var(--line); }
.du-cardbtn.is-locked { cursor: default; border-style: dashed; }
.dmo { padding: 34px 0 6px; }
.dmo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 14px; }
.dmo-card { --c1: #e8b04b; --glow: rgba(232,176,75,0.35); display: grid; grid-template-rows: auto 1fr; border-radius: 16px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--c1) 50%, transparent); background: linear-gradient(180deg, color-mix(in srgb, var(--c1) 14%, #120d08), #0f0b07 70%); box-shadow: 0 10px 28px rgba(0,0,0,0.45); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.dmo-card:hover { transform: translateY(-3px); border-color: var(--c1); box-shadow: 0 16px 36px rgba(0,0,0,0.55), 0 0 28px var(--glow); }
.dmo-card.is-RANKED { --c1: #ffcf5a; --glow: rgba(255,207,90,0.4); }
.dmo-card.is-EVENT { --c1: #6ff0e0; --glow: rgba(111,240,224,0.35); }
.dmo-card.is-TOURNEY { --c1: #c48bff; --glow: rgba(196,139,255,0.38); }
.dmo-card.is-WEEKLY { --c1: #ff7a4a; --glow: rgba(255,122,74,0.38); }
.dmo-card.is-hot { box-shadow: 0 10px 28px rgba(0,0,0,0.45), 0 0 0 1px var(--c1), 0 0 26px var(--glow); }
.dmo-art { position: relative; aspect-ratio: 16 / 8; background-size: cover; background-position: center; cursor: pointer; }
.dmo-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.05), rgba(12,9,6,0.9)); }
.dmo-glyph { position: absolute; left: 50%; top: 50%; z-index: 1; transform: translate(-50%, -55%); font-size: 46px; color: #fff6e0; text-shadow: 0 0 14px var(--c1), 0 0 34px var(--c1), 0 3px 0 rgba(0,0,0,0.6); transition: transform 0.25s ease; }
.dmo-card:hover .dmo-glyph { transform: translate(-50%, -55%) scale(1.12); }
.dmo-badge { position: absolute; top: 10px; left: 10px; z-index: 2; padding: 4px 9px; border-radius: 20px; background: var(--c1); color: #10221f; font-size: 11.5px; font-weight: 800; }
.dmo-body { display: grid; align-content: start; gap: 7px; padding: 14px 16px 16px; }
.dmo-kicker { margin: 0; font-size: 12px; font-weight: 700; color: var(--c1); }
.dmo-title { margin: 0; font-family: var(--display); font-size: 23px; line-height: 1.1; color: #fbefd6; }
.dmo-pitch { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ash); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.dmo-status { margin: 2px 0 0; font-size: 13px; font-weight: 700; color: #fbefd6; }
.dmo-prize { margin: 0; font-size: 12.5px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.dmo-rounds { display: flex; gap: 6px; }
.dmo-rounds span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c1); font-size: 12px; font-weight: 800; color: #fbefd6; }
.dmo-rounds .is-done { background: var(--c1); color: #1a0f04; }
.dmo-rounds .is-lost { border-color: #ff7a6a; color: #ff7a6a; }
.dmo-deck { display: flex; flex-wrap: wrap; gap: 4px; }
.dmo-deck .dc-face.is-small { width: 34px; padding: 2px; }
.dmo-deck .dc-face.is-small canvas { width: 26px !important; height: 26px !important; }
.dmo-deck .dc-face.is-small .dc-name, .dmo-deck .dc-face.is-small .dc-kind, .dmo-deck .dc-face.is-small .dc-cost { display: none; }
.dmo-play { margin-top: 4px; padding: 11px 16px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--c1) 80%, #fff); cursor: pointer; font-weight: 800; font-size: 15px; color: #1a0f04 !important; background: linear-gradient(180deg, color-mix(in srgb, var(--c1) 65%, #fff), var(--c1)); box-shadow: 0 6px 18px var(--glow); }
.dmo-play:hover:not(:disabled) { filter: brightness(1.08); }
.dmo-play:disabled { opacity: 0.45; cursor: default; box-shadow: none; }
.dmo-play:focus-visible { outline: 2px solid #fff3d0; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .dmo-card, .dmo-glyph { transition: none; } }
@media (max-width: 1100px) { .dmo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) {
  .dmo-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .dmo-card { grid-template-rows: none; grid-template-columns: 92px minmax(0, 1fr); }
  .dmo-art { aspect-ratio: auto; min-height: 100%; }
  .dmo-glyph { font-size: 34px; }
  .dmo-badge { top: 6px; left: 6px; font-size: 10.5px; padding: 3px 7px; }
  .dmo-body { padding: 12px 14px 14px; gap: 5px; }
  .dmo-title { font-size: 20px; }
  .dmo-pitch { -webkit-line-clamp: 2; font-size: 12.5px; }
}
.du-tabs { position: sticky; top: 0; z-index: 5; display: flex; gap: 6px; margin: 28px 0 0; padding: 10px 0; overflow-x: auto; scrollbar-width: none; background: linear-gradient(180deg, var(--night) 80%, transparent); }
.du-tab { position: relative; flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(24,18,12,0.6); color: var(--ash); font-weight: 700; font-size: 14px; cursor: pointer; white-space: nowrap; }
.du-tab:hover { color: #fbefd6; border-color: rgba(232,176,75,0.6); }
.du-tab.is-on { color: #1a0f04; background: linear-gradient(180deg, #ffe08a, #e8b04b); border-color: #ffd56a; }
.du-tab:focus-visible { outline: 2px solid #fff3d0; outline-offset: 2px; }
.du-tab-dot { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ff5a4a; color: #fff; font-size: 11px; display: inline-grid; place-items: center; }
.du-lock { position: absolute; top: 8px; right: 10px; z-index: 1; font-size: 16px; }
.du-unlock { font-size: 11.5px; color: var(--ash-2); text-align: center; }
.du-buycard { display: inline-flex; align-items: center; justify-content: center; gap: 5px; margin-top: 2px; padding: 6px 10px; border-radius: 8px; border: 1px solid #e8b04b; background: rgba(232,176,75,0.12); color: #ffe7b0 !important; font-weight: 800; font-size: 12.5px; cursor: pointer; }
.du-buycard:disabled { opacity: 0.45; cursor: default; }
.du-buycard:focus-visible { outline: 2px solid #fff3d0; outline-offset: 2px; }
.du-slots { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 2px; }
.du-slot { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); color: var(--ash); font-weight: 700; cursor: pointer; }
.du-slot.is-on { border-color: rgba(232,176,75,0.8); color: var(--gold-hi); background: linear-gradient(180deg, rgba(232,176,75,0.16), rgba(24,18,12,0.6)); }
.du-slot:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.du-avg { margin-left: auto; font-size: 14px; color: #c9a6ff; font-weight: 700; }
.du-cardbtn { position: relative; }
.du-mbadge { position: absolute; top: 6px; right: 8px; z-index: 1; }
.du-stars { font-size: 12px; letter-spacing: 1px; color: #ffd56a; text-shadow: 0 0 6px rgba(255,200,80,0.6); white-space: nowrap; }
.du-stars.is-l5 { color: #ffb0ff; text-shadow: 0 0 8px rgba(255,140,255,0.8); }
.du-mastery { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; margin-top: 14px; }
.du-mcard { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.du-mcard > div { flex: 1; min-width: 0; display: grid; gap: 5px; }
.du-mcard > .dc-face, .du-mcard .dc-face.is-small { flex: none; width: 60px; }
.du-mcard strong { font-size: 14px; color: var(--bone); }
.du-mcard small { font-size: 12px; color: var(--ash); }
.du-mclaim { padding: 7px 12px; font-size: 13px; white-space: nowrap; }
.du-history { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; max-width: 860px; }
.du-hrow { display: grid; grid-template-columns: 96px 70px 1fr auto auto; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); border-left-width: 4px; background: rgba(24,18,12,0.55); font-size: 13.5px; }
.du-hrow.is-WIN { border-left-color: #6fd36f; }
.du-hrow.is-LOSS { border-left-color: #ff7a6a; }
.du-hrow.is-DRAW { border-left-color: #c9b48a; }
.du-hres { font-weight: 800; color: var(--bone); }
.du-hscore { font-family: var(--display); font-size: 18px; color: var(--gold-hi); font-variant-numeric: tabular-nums; }
.du-hmeta { color: var(--ash); }
.du-hmeta b.is-up { color: #8fe08f; }
.du-hmeta b.is-down { color: #ff9a85; }
.du-hdate { color: var(--ash-2); font-size: 12.5px; white-space: nowrap; }
.du-hbtn { padding: 6px 12px; font-size: 13px; white-space: nowrap; }
.du-hold { color: var(--ash-2); font-size: 12px; }
@media (max-width: 640px) { .du-hrow { grid-template-columns: 1fr auto; } .du-hdate, .du-hmeta { grid-column: 1 / -1; } }
.du-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 14px; }
.du-cardbtn { display: grid; justify-items: center; align-content: start; gap: 6px; padding: 14px 10px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); color: var(--bone); cursor: pointer; }
.du-cardbtn.is-on { border-color: rgba(232,176,75,0.7); background: linear-gradient(180deg, rgba(232,176,75,0.14), rgba(24,18,12,0.6)); }
.du-cardbtn:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.du-desc { font-size: 12px; color: var(--ash); text-align: center; line-height: 1.35; }
`;

const MATCH_CSS = `
/* PHONE HELD SIDEWAYS: the hand moves to a column on the right (two cards a row) and the battlefield takes the rest of the screen */
@media (max-height: 520px) and (orientation: landscape) {
  .dm-match { grid-template-rows: auto minmax(0, 1fr) !important; grid-template-columns: minmax(0, 1fr) auto !important; }
  .dm-match .dm-top { grid-column: 1 / -1; padding: 3px 12px calc(3px) max(12px, env(safe-area-inset-left)); gap: 10px; }
  .dm-match .dm-crest { display: none; }
  .dm-match .dm-side strong { font-size: 13px; }
  .dm-match .dm-hp-segs i { width: 6px; height: 8px; }
  .dm-match .dm-clock-face { width: 44px; height: 44px; padding: 3px; }
  .dm-match .dm-clock-face span { font-size: 14px; }
  .dm-match .dm-stage { grid-row: 2; grid-column: 1; padding: 4px; }
  .dm-match .dm-canvas { width: min(100%, calc((100dvh - 64px) * ${W / H})); }
  .dm-match .dm-hand { grid-row: 2; grid-column: 2; flex-direction: column; flex-wrap: nowrap; justify-content: flex-start; align-items: stretch; gap: 6px; width: 172px; padding: 6px 8px max(6px, env(safe-area-inset-bottom)) 8px; padding-right: max(8px, env(safe-area-inset-right)); border-top: none; border-left: 2px solid #5a4226; overflow-y: auto; }
  .dm-match .dm-mana { grid-auto-flow: column; align-items: center; justify-content: start; }
  .dm-match .dm-mana > span { width: 30px; height: 30px; font-size: 14px; }
  .dm-match .dm-mana-bar i { width: 8px; height: 7px; }
  .dm-match .dm-cards { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .dm-match .dc-face { width: 74px; padding: 4px 2px; }
  .dm-match .dc-face canvas { width: 42px !important; height: 42px !important; }
  .dm-match .dc-name { font-size: 10.5px !important; line-height: 1.1; }
  .dm-match .dc-kind { font-size: 8px !important; }
}
@media (pointer: coarse) { .dm-match .dm-btn { min-height: 40px; } }
.has-frame .dc-face { box-shadow: 0 0 0 1px var(--fr2), 0 0 14px color-mix(in srgb, var(--fr1) 45%, transparent), inset 0 1px 0 rgba(255,230,180,0.15) !important; }
.dm-tr { font-size: 20px !important; font-weight: 700; }
.dm-rankchange { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-radius: 12px; background: rgba(0,0,0,0.45); font-family: Georgia, serif; font-size: 22px; font-weight: 700; animation: dmIn 0.6s ease-out; }
.dm-rankchange.is-up { color: #ffd56a; box-shadow: 0 0 30px rgba(255,213,106,0.35); }
.dm-rankchange.is-down { color: #e0a090; }
.dm-tag { font-size: 14px !important; font-weight: 800; color: #ff9a5a; }
.dm-tag.is-gold { color: #ffd56a; font-size: 18px !important; }
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
.dc-name { font-size: 12px; font-weight: 700; text-align: center; line-height: 1.15; max-width: 100%; overflow-wrap: anywhere; }
.dm-next { display: grid; justify-items: center; gap: 3px; font-size: 11px; color: #a89a84; padding-left: 6px; }
.dm-btn { padding: 10px 20px; border-radius: 9px; border: 1px solid #e8c06a; background: linear-gradient(180deg, #b0382a, #741c12); color: #fff; font-weight: 700; cursor: pointer; }
.dm-btn.is-ghost { background: rgba(0,0,0,0.3); border-color: rgba(232,192,106,0.5); color: #efe4cf; }
.dm-quit { font-size: 12px; padding: 6px 12px; }
.dm-intro { position: absolute; inset: 0; z-index: 6; display: grid; place-items: center; pointer-events: none; background: radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0.25) 60%, transparent); }
.dm-vs { display: flex; align-items: center; gap: clamp(16px, 5vw, 64px); animation: dmVsIn 0.35s ease-out; }
.dm-vs-side { display: grid; justify-items: center; gap: 6px; padding: 18px 26px; border-radius: 16px; background: rgba(12,9,6,0.85); border: 2px solid #6aa8ff; box-shadow: 0 0 30px rgba(106,168,255,0.45); min-width: 160px; }
.dm-vs-side.is-foe { border-color: var(--cc); box-shadow: 0 0 30px color-mix(in srgb, var(--cc) 55%, transparent); }
.dm-vs-side strong { font-family: Georgia, serif; font-size: clamp(20px, 3vw, 30px); color: #fff3d8; }
.dm-vs-side small { font-size: 13px; color: #d9c7a4; }
.dm-vs-crest { font-size: clamp(34px, 5vw, 54px); line-height: 1; }
.dm-vs-mark { font-family: Georgia, serif; font-weight: 900; font-size: clamp(44px, 7vw, 86px); color: #fff3e0; text-shadow: 0 0 18px #ff5a4a, 0 0 40px #ff5a4a, 0 4px 0 #6a1410; transform: rotate(-6deg); }
.dm-count { font-family: Georgia, serif; font-weight: 900; font-size: clamp(80px, 14vw, 160px); color: #fff3d0; text-shadow: 0 0 30px rgba(255,200,90,0.9), 0 6px 0 #6a4214; animation: dmCount 0.4s ease-out; }
.dm-count.is-fight { color: #ffdf8a; font-size: clamp(60px, 10vw, 120px); animation: dmCount 0.5s ease-out; }
@keyframes dmVsIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes dmCount { from { transform: scale(1.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dm-vs, .dm-count { animation: none; } }
@media (max-width: 520px) { .dm-vs { flex-direction: column; gap: 10px; } .dm-vs-side { padding: 10px 16px; min-width: 0; } }
.dm-stats { width: 100%; max-width: 380px; margin: 4px auto 6px; text-align: left; }
.dm-stats > small { display: block; font-size: 12px; color: #d9c7a4; margin-bottom: 6px; text-align: center; }
.dm-stats ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.dm-stats li { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 10px; padding: 4px 10px 4px 4px; border-radius: 10px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); }
.dm-stats li.is-mvp { border-color: #ffd56a; box-shadow: 0 0 14px rgba(255,213,106,0.35); }
.dm-stats .dc-face.is-small { width: 40px; padding: 2px; }
.dm-stats .dc-face.is-small canvas { width: 32px !important; height: 32px !important; }
.dm-stats .dc-face.is-small .dc-name, .dm-stats .dc-face.is-small .dc-kind { display: none; }
.dm-stats-name { font-weight: 700; font-size: 13.5px; color: #fff3d8; display: flex; gap: 8px; align-items: center; }
.dm-mvp { font-size: 10.5px; padding: 2px 6px; border-radius: 6px; background: #ffd56a; color: #2b1906; }
.dm-stats-val { font-size: 12.5px; color: #d9c7a4; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dm-replaybar { gap: 10px; }
.dm-clock.is-overtime .dm-clock-face { background: conic-gradient(#ff5a4a var(--p), rgba(255,255,255,0.08) 0); box-shadow: 0 0 0 2px #a8281c, 0 0 26px rgba(255,90,74,0.6); animation: dmOt 0.9s ease-in-out infinite alternate; }
.dm-clock.is-overtime small { color: #ff9a8a; }
@keyframes dmOt { from { transform: scale(1); } to { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .dm-clock.is-overtime .dm-clock-face { animation: none; } }
.dm-hint.is-ot { color: #ffb0a4; border-color: #a8281c; }
.dm-emote { position: absolute; bottom: 20%; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 16px; background: #fff7e6; color: #2b1906; font-weight: 800; font-size: 15px; box-shadow: 0 6px 18px rgba(0,0,0,0.45); transform: translateX(-50%); animation: dmPop 0.22s ease-out; pointer-events: none; white-space: nowrap; }
.dm-emote::after { content: ""; position: absolute; bottom: -8px; left: 50%; margin-left: -8px; border: 8px solid transparent; border-top-color: #fff7e6; border-bottom: 0; }
.dm-emote.is-side0 { left: 25%; }
.dm-emote.is-side1 { left: 75%; background: #ffe6e1; }
.dm-emote.is-side1::after { border-top-color: #ffe6e1; }
.dm-emote-ico { font-size: 24px; }
@keyframes dmPop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
.dm-mute { position: absolute; top: 16px; right: 18px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #8a6a3a; background: rgba(0,0,0,0.6); cursor: pointer; font-size: 15px; }
.dm-emotes { position: relative; }
.dm-emote-btn { font-size: 18px; padding: 6px 12px; }
.dm-emote-menu { position: absolute; bottom: calc(100% + 8px); right: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; border-radius: 12px; background: #1c140c; border: 1px solid #8a6a3a; box-shadow: 0 10px 30px rgba(0,0,0,0.6); z-index: 5; }
.dm-emote-menu button { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 8px; border: 1px solid #4a3620; background: #2a1f14; color: #f3e6cc; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; }
.dm-emote-menu button span { font-size: 18px; }
.dm-emote-menu button:disabled { opacity: 0.45; cursor: default; }
.dm-emote-menu button:hover:not(:disabled) { border-color: #e8b04b; }
@media (max-width: 720px) { .dc-face { width: 80px; } .dm-crest { display: none; } .dm-hp-segs i { width: 6px; } }
@media (max-width: 520px) {
  .dm-top { gap: 8px; padding: 6px 10px; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .dm-side { min-width: 0; font-size: 12px; }
  .dm-side > div { min-width: 0; flex: 1; }
  .dm-side strong { font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dm-hp-segs i { flex: 1 1 0; width: auto; min-width: 2px; height: 9px; }
  .dm-clock-face { width: 56px; height: 56px; }
  .dm-clock-face span { font-size: 16px; }
  .dm-stage { padding: 6px; }
  .dm-hand { gap: 8px 10px; padding: 8px 6px 10px; }
  .dm-mana > span { width: 34px; height: 34px; font-size: 16px; }
  .dm-mana-bar i { width: 10px; height: 8px; }
  .dm-cards { gap: 6px; }
  .dc-face { width: 68px; padding: 6px 3px; }
  .dc-face canvas { width: 54px !important; height: 54px !important; }
  .dc-face.is-small canvas { width: 36px !important; height: 36px !important; }
  .dc-name { font-size: 10.5px; }
  .dc-kind { font-size: 8.5px; }
  .dc-cost { width: 22px; height: 22px; font-size: 12px; left: -6px; top: -6px; }
  .dm-next { padding-left: 0; }
  .dm-emote { font-size: 13px; padding: 6px 10px; }
  .dm-emote-ico { font-size: 18px; }
}

/* ---------------- CARDS IN MOTION ----------------
 * A new card is dealt into its slot (flies up and flips face-up); playable
 * cards breathe and catch a foil glint; a card not yet affordable shows the
 * mana filling it up from below and flashes when it becomes playable; hover
 * lifts and tilts toward you; the picked card floats with a turning ring of
 * light. The mana orb holds a moving liquid and pops each time it grows. */
.dm-cards { perspective: 900px; }
.dm-card { position: relative; transition: transform 220ms cubic-bezier(.2,.8,.2,1), filter 200ms ease; transform-style: preserve-3d;
  --tone: #e8b04b; }
.dm-card.is-TOWER { --tone: #7fb0ff; } .dm-card.is-SPELL { --tone: #ffd56a; } .dm-card.is-SEND { --tone: #ff8a5a; }
.dm-card-body { position: relative; display: block; border-radius: 12px; transform-style: preserve-3d;
  animation: dcDeal 560ms cubic-bezier(.2,.9,.25,1.15) backwards, dcBob 3.2s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * 70ms), calc(var(--i, 0) * -0.7s); animation-play-state: running, paused; }
@keyframes dcDeal {
  0% { opacity: 0; transform: translate(110px, 60px) rotate(18deg) rotateY(90deg) scale(0.6); }
  55% { opacity: 1; transform: translate(0, -14px) rotate(-3deg) rotateY(0) scale(1.04); }
  100% { transform: none; }
}
/* only the play-state changes when a card becomes playable, so the deal never replays */
.dm-card.is-ready .dm-card-body { animation-play-state: running, running; }
@keyframes dcBob { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(calc((var(--i, 0) - 1.5) * 0.6deg)); } }
/* foil glint over playable cards */
.dm-card.is-ready .dm-card-body::after { content: ""; position: absolute; inset: 0; border-radius: 12px; pointer-events: none; z-index: 1; mix-blend-mode: screen;
  background: linear-gradient(105deg, transparent 38%, rgba(255,250,230,0.34) 48%, rgba(255,215,140,0.14) 54%, transparent 62%) no-repeat;
  background-size: 320% 100%; background-position: 130% 0; animation: dcFoil 4.5s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 0.9s + 0.6s); }
@keyframes dcFoil { 0%, 68% { background-position: 130% 0; } 100% { background-position: -40% 0; } }
/* playable: a soft glow in the card's own colour; the cost gem pulses */
.dm-card.is-ready .dc-face { box-shadow: inset 0 1px 0 rgba(255,230,180,0.15), 0 6px 14px rgba(0,0,0,0.5), 0 0 12px color-mix(in srgb, var(--tone) 40%, transparent); animation: dcReady 520ms ease-out; }
@keyframes dcReady { 0% { filter: brightness(1.9); box-shadow: 0 0 0 3px var(--tone), 0 0 30px var(--tone); } 100% { filter: none; } }
.dm-card.is-ready .dc-cost { animation: dcGem 1.6s ease-in-out infinite; }
@keyframes dcGem { 0%,100% { box-shadow: 0 2px 6px rgba(0,0,0,0.6), 0 0 0 0 rgba(211,139,255,0.7); } 50% { box-shadow: 0 2px 6px rgba(0,0,0,0.6), 0 0 0 5px rgba(211,139,255,0); } }
/* not yet: the mana fills the card from below */
.dm-card-charge { position: absolute; inset: 2px; border-radius: 10px; pointer-events: none; overflow: hidden; }
.dm-card-charge::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--fill, 0) * 100%);
  background: linear-gradient(0deg, rgba(160,90,255,0.3), rgba(200,150,255,0.06)); border-top: 2px solid rgba(230,200,255,0.85);
  box-shadow: 0 -4px 10px rgba(200,150,255,0.45); transition: height 260ms linear; }
.dm-card-charge::after { content: ""; position: absolute; left: -20%; right: -20%; height: 8px; bottom: calc(var(--fill, 0) * 100% - 4px);
  background: radial-gradient(ellipse at 50% 0%, rgba(240,220,255,0.6), transparent 70%); animation: dcRipple 1.4s ease-in-out infinite alternate; transition: bottom 260ms linear; }
@keyframes dcRipple { from { transform: translateX(-8%) scaleY(0.7); } to { transform: translateX(8%) scaleY(1.2); } }
/* hand: hover lifts and tilts, picked floats in a ring of light */
.dm-card:not(:disabled):hover { transform: translateY(-14px) rotateX(10deg) scale(1.07); z-index: 2; filter: brightness(1.08); }
.dm-card:not(:disabled):hover .dc-face { box-shadow: 0 16px 26px rgba(0,0,0,0.6), 0 0 22px color-mix(in srgb, var(--tone) 65%, transparent); }
.dm-card:not(:disabled):hover .dc-art { animation: dcArt 1.2s ease-in-out infinite alternate; }
@keyframes dcArt { from { transform: scale(1); } to { transform: scale(1.08) translateY(-2px); } }
.dm-card:not(:disabled):active { transform: translateY(-6px) scale(0.97); transition-duration: 70ms; }
.dm-card.is-picked { transform: translateY(-18px) scale(1.08); z-index: 3; }
.dm-card.is-picked .dc-face { animation: dcPicked 1.1s ease-in-out infinite; }
@keyframes dcPicked { 0%,100% { box-shadow: 0 0 0 2px #ffd56a, 0 0 18px rgba(255,213,106,0.5), 0 14px 24px rgba(0,0,0,0.55); } 50% { box-shadow: 0 0 0 3px #fff0b8, 0 0 34px rgba(255,213,106,0.85), 0 14px 24px rgba(0,0,0,0.55); } }
.dm-card.is-picked .dm-card-body::before { content: ""; position: absolute; inset: -5px; border-radius: 15px; pointer-events: none; z-index: -1;
  background: conic-gradient(from var(--a, 0deg), transparent 0 60%, #ffd56a 78%, #fff8d8 84%, transparent 92%); animation: dcRing 1.4s linear infinite; }
@property --a { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
@keyframes dcRing { to { --a: 360deg; } }
/* the next card waits, gently floating; it slides in when it changes */
.dm-next-card { display: block; animation: dcNext 420ms cubic-bezier(.2,.9,.25,1.2) backwards, dcFloat 2.6s ease-in-out 420ms infinite; }
@keyframes dcNext { from { opacity: 0; transform: translateX(26px) rotate(12deg) scale(0.7); } }
@keyframes dcFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-3px) rotate(2deg); } }
/* the mana orb: liquid inside, pops when it grows */
.dm-mana > .dm-mana-orb { position: relative; overflow: hidden; animation: dcOrbPop 360ms cubic-bezier(.34,1.56,.64,1); }
.dm-mana-orb b { position: relative; z-index: 1; text-shadow: 0 1px 3px rgba(40,0,80,0.8); }
.dm-mana-orb::before, .dm-mana-orb::after { content: ""; position: absolute; left: -50%; width: 200%; height: 200%; top: 48%; border-radius: 42%;
  background: rgba(240,200,255,0.28); animation: dcLiquid 5s linear infinite; }
.dm-mana-orb::after { top: 54%; border-radius: 45%; background: rgba(120,40,200,0.45); animation-duration: 7s; animation-direction: reverse; }
@keyframes dcLiquid { to { transform: rotate(360deg); } }
@keyframes dcOrbPop { 0% { transform: scale(1.22); box-shadow: 0 0 30px rgba(220,160,255,0.95); } 100% { transform: scale(1); } }
.dm-mana-bar i { transition: background 200ms ease, box-shadow 200ms ease, transform 200ms ease; }
.dm-mana-bar i.on { animation: dcPip 340ms cubic-bezier(.34,1.56,.64,1); }
@keyframes dcPip { from { transform: scaleY(0.2); } }
/* lobby: deck/collection/draft cards */
.du-cardbtn { transition: transform 220ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease, border-color 200ms ease; transform-style: preserve-3d; }
.du-cardbtn:not(.is-locked):hover { transform: translateY(-6px) rotateX(6deg); box-shadow: 0 14px 24px rgba(0,0,0,0.5), 0 0 18px rgba(232,176,75,0.25); }
.du-cardbtn:not(.is-locked):hover .dc-art { animation: dcArt 1.2s ease-in-out infinite alternate; }
.du-cardbtn:not(.is-locked):active { transform: translateY(-2px) scale(0.97); transition-duration: 70ms; }
.du-draft-opt { animation: dcDeal 620ms cubic-bezier(.2,.9,.25,1.15) backwards; }
.du-draft-opt:nth-child(2) { animation-delay: 110ms; } .du-draft-opt:nth-child(3) { animation-delay: 220ms; }

/* ---------------- CARD FRAMES ----------------
 * Each card is set in a forged frame: a bevelled metal border (steel-blue
 * for towers, gold for spells, copper for creatures), an inner gilt line,
 * filigree in the four corners, a framed art window and a name plate.
 * A cosmetic frame from the shop (has-frame) recolours the metal. */
.dc-face { --m1: #f6dc9c; --m2: #b8863a; --m3: #4a2e0e; --plate: #2a1c0e;
  border: 2px solid transparent;
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(255,230,170,0.10), transparent 60%) padding-box,
    linear-gradient(180deg, #3a2a1a, #1a120a) padding-box,
    linear-gradient(155deg, var(--m1) 0%, var(--m2) 28%, var(--m3) 52%, var(--m2) 76%, var(--m1) 100%) border-box;
  box-shadow: inset 0 1px 0 rgba(255,236,190,0.18), inset 0 0 0 1px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.5); }
.dc-face.is-TOWER { --m1: #eef4ff; --m2: #7d9cd0; --m3: #1e2c48; --plate: #16223a;
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(190,215,255,0.12), transparent 60%) padding-box,
    linear-gradient(180deg, #24324a, #10161f) padding-box,
    linear-gradient(155deg, var(--m1) 0%, var(--m2) 28%, var(--m3) 52%, var(--m2) 76%, var(--m1) 100%) border-box; }
.dc-face.is-SPELL { --m1: #fff2c0; --m2: #d8a440; --m3: #5a3a0c; --plate: #33220a;
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(255,220,140,0.16), transparent 60%) padding-box,
    linear-gradient(180deg, #3e2c16, #1a1208) padding-box,
    linear-gradient(155deg, var(--m1) 0%, var(--m2) 28%, var(--m3) 52%, var(--m2) 76%, var(--m1) 100%) border-box; }
.dc-face.is-SEND { --m1: #ffd8bc; --m2: #c06a3e; --m3: #4a160a; --plate: #3a160c;
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(255,180,140,0.12), transparent 60%) padding-box,
    linear-gradient(180deg, #4a2418, #1e0e08) padding-box,
    linear-gradient(155deg, var(--m1) 0%, var(--m2) 28%, var(--m3) 52%, var(--m2) 76%, var(--m1) 100%) border-box; }
.has-frame .dc-face { --m1: color-mix(in srgb, var(--fr1) 45%, #fff); --m2: var(--fr1); --m3: color-mix(in srgb, var(--fr2) 60%, #000); border-color: transparent !important; }
/* inner gilt line and corner filigree */
.dc-face::before { content: ""; position: absolute; inset: 3px; border-radius: 9px; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--m1) 55%, transparent); box-shadow: inset 0 0 8px rgba(0,0,0,0.45); }
.dc-face::after { content: ""; position: absolute; inset: 1px; pointer-events: none; opacity: 0.85;
  background-color: var(--m1);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%280 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") top left / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%2890 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") top right / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%28270 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") bottom left / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%28180 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") bottom right / 15px 15px no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%280 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") top left / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%2890 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") top right / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%28270 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") bottom left / 15px 15px no-repeat, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cg transform='rotate%28180 10 10%29' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2 14V6a4 4 0 0 1 4-4h8'/%3E%3Cpath d='M5 11c0-3 3-6 6-6' opacity='.75'/%3E%3Ccircle cx='5.2' cy='5.2' r='1.6' fill='white' stroke='none'/%3E%3C/g%3E%3C/svg%3E") bottom right / 15px 15px no-repeat; }
.dc-face:not(.is-small) { border-width: 3px; grid-template-rows: auto auto 1fr; }
/* a card never stretches to its neighbours' height (deck grid, hand) */
.du-cardbtn > .dc-face, .dm-card-body > .dc-face { align-self: start; }
.dc-face:not(.is-small) .dc-name { display: flex; align-items: center; justify-content: center; }
.dc-face.is-small::before { inset: 2px; border-radius: 6px; }
.dc-face.is-small::after { -webkit-mask-size: 9px 9px; mask-size: 9px 9px; }
/* framed art window */
.dc-face:not(.is-small) .dc-art { position: relative; z-index: 1; margin-top: 2px; padding: 2px; border-radius: 8px;
  background: radial-gradient(circle at 50% 60%, rgba(255,255,255,0.12), rgba(0,0,0,0.35)) padding-box, linear-gradient(160deg, var(--m1), var(--m3)) border-box;
  border: 1px solid transparent; box-shadow: inset 0 0 10px rgba(0,0,0,0.6), 0 1px 0 rgba(255,236,190,0.12); }
/* type label between two small gems, name on a plate */
.dc-kind { position: relative; z-index: 1; display: flex; align-items: center; gap: 4px; text-transform: uppercase; letter-spacing: 0.1em; font-size: 8.5px; color: color-mix(in srgb, var(--m1) 80%, #fff); }
.dc-kind::before, .dc-kind::after { content: ""; width: 4px; height: 4px; transform: rotate(45deg); background: var(--m2); box-shadow: 0 0 4px var(--m2); }
.dc-name { position: relative; z-index: 1; width: calc(100% + 8px); max-width: none; margin-left: -4px; margin-right: -4px; padding: 3px 2px 4px; overflow-wrap: normal; word-break: normal; hyphens: none; letter-spacing: -0.01em; margin-top: 1px; border-radius: 4px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--plate) 70%, #000), var(--plate)) padding-box, linear-gradient(90deg, transparent, var(--m2), transparent) border-box;
  border-top: 1px solid transparent; border-bottom: 1px solid transparent; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.dc-cost { z-index: 2; border-color: var(--m1); box-shadow: 0 2px 6px rgba(0,0,0,0.6), 0 0 0 1px var(--m3); }
@media (prefers-reduced-motion: reduce) {
  .dm-card, .dm-card-body, .dm-card .dc-face, .dm-card-body::after, .dm-card .dc-cost, .dm-card .dc-art, .dm-card-charge::after, .dm-card.is-picked .dm-card-body::before,
  .dm-next-card, .dm-mana > .dm-mana-orb, .dm-mana-orb::before, .dm-mana-orb::after, .dm-mana-bar i.on, .du-cardbtn, .du-draft-opt { animation: none !important; transition: none !important; }
  .dm-card:not(:disabled):hover, .dm-card.is-picked, .du-cardbtn:hover { transform: none !important; }
}
`;
