import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { appendLedgerEvent } from "@/engine/EconomyLedger";
import { DuelEngine, LANE_SLOTS, slotPos, type DuelSnapshot } from "@/engine/DuelEngine";
import {
  applyDuelResult,
  arenaFor,
  DECK_SIZE,
  DUEL_ARENAS,
  DUEL_CARDS,
  DUEL_LENGTH_MS,
  DUEL_MAX_MANA,
  DUEL_REWARDED_WINS_PER_DAY,
  DUEL_WIN_SHARDS,
  getDuelCard,
  isValidDeck,
  TROPHIES_LOSS,
  TROPHIES_WIN,
  duelWeek,
  WEEKLY_CHALLENGE_AI,
  WEEKLY_CHALLENGE_SHARDS,
  weeklyChallenge,
  type DuelCardId,
  type DuelOutcome,
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
export function DuelScreen({ onExit }: DuelScreenProps) {
  const { t, language } = useLanguage();
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [deck, setDeck] = useState<DuelCardId[]>(() => [...save.duel.deck]);
  const [match, setMatch] = useState<DuelEngine | null>(null);
  /** Bumped every new match so the match view starts fresh (its end-of-match latch included). */
  const [matchNo, setMatchNo] = useState(0);
  const [result, setResult] = useState<{ outcome: DuelOutcome; trophies: number; shards: number } | null>(null);
  const [challenge, setChallenge] = useState(false);
  const week = duelWeek(Date.now());
  const weekly = useMemo(() => weeklyChallenge(week), [week]);
  const weeklyDone = save.duel.weeklyWonWeek === week;
  const arena = arenaFor(save.duel.trophies);
  const nextArena = DUEL_ARENAS.find((a) => a.minTrophies > save.duel.trophies);
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const deckOk = isValidDeck(deck);

  const toggleCard = (id: DuelCardId) => {
    setDeck((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < DECK_SIZE ? [...d, id] : d));
  };

  const start = () => {
    if (!deckOk) return;
    const next = updateSave({ duel: { ...save.duel, deck } });
    setSave(next);
    setResult(null);
    setChallenge(false);
    setMatchNo((n) => n + 1);
    setMatch(new DuelEngine((Date.now() & 0x7fffffff) | 1, [deck, aiDeck(arena.id)], arena.ai, next.equippedTowerSkinByType));
  };

  const startWeekly = () => {
    setResult(null);
    setChallenge(true);
    setMatchNo((n) => n + 1);
    setMatch(new DuelEngine(weekly.seed, [weekly.myDeck, weekly.foeDeck], WEEKLY_CHALLENGE_AI, save.equippedTowerSkinByType));
  };

  const finish = (outcome: DuelOutcome) => {
    const cur = loadSave();
    if (challenge) {
      const paid = outcome === "WIN" && cur.duel.weeklyWonWeek !== week;
      if (paid) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source: "duel_weekly", amount: WEEKLY_CHALLENGE_SHARDS });
      const next = updateSave({ duel: { ...cur.duel, weeklyWonWeek: paid ? week : cur.duel.weeklyWonWeek }, gemShards: cur.gemShards + (paid ? WEEKLY_CHALLENGE_SHARDS : 0) });
      setSave(next);
      setResult({ outcome, trophies: 0, shards: paid ? WEEKLY_CHALLENGE_SHARDS : 0 });
      return;
    }
    const { profile, shards } = applyDuelResult(cur.duel, outcome, Date.now());
    if (shards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source: "duel_win", amount: shards });
    const next = updateSave({ duel: profile, gemShards: cur.gemShards + shards });
    setSave(next);
    setResult({ outcome, trophies: profile.trophies - cur.duel.trophies, shards });
  };

  if (match)
    return (
      <DuelMatch
        key={matchNo}
        engine={match}
        arenaId={challenge ? "ARENA_ABYSS" : arena.id}
        biome={challenge ? "ABYSS" : arena.biome}
        result={result}
        onFinish={finish}
        onAgain={challenge ? startWeekly : start}
        onLobby={() => setMatch(null)}
      />
    );

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
              <p className="pg-lead">{t("duel.lead")}</p>
            </div>
            <dl className="du-figs">
              <div>
                <dt>{t("duel.trophies")}</dt>
                <dd>🏆 {fmt(save.duel.trophies)}</dd>
              </div>
              <div>
                <dt>{t("duel.arena")}</dt>
                <dd className="is-arena">{t(`duel.arenas.${arena.id}` as TranslationKey)}</dd>
              </div>
            </dl>
          </div>
        </header>
        <div className="pg-wrap">
          <section className="du-play">
            <div>
              <p className="pg-sub">{nextArena ? t("duel.nextArena", { name: t(`duel.arenas.${nextArena.id}` as TranslationKey), n: nextArena.minTrophies }) : t("duel.maxArena")}</p>
              <p className="pg-sub">{t("duel.rewards", { win: TROPHIES_WIN, loss: TROPHIES_LOSS, shards: DUEL_WIN_SHARDS, max: DUEL_REWARDED_WINS_PER_DAY })}</p>
              <p className="pg-sub">{t("duel.rules")}</p>
            </div>
            <button className="pg-btn" disabled={!deckOk} onClick={start} data-testid="duel-start">
              {t("duel.play")}
            </button>
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
  result: { outcome: DuelOutcome; trophies: number; shards: number } | null;
  onFinish: (o: DuelOutcome) => void;
  onAgain: () => void;
  onLobby: () => void;
}

function DuelMatch({ engine, arenaId, biome, result, onFinish, onAgain, onLobby }: DuelMatchProps) {
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
        drawDuelFrame(ctx, s, arenaId, biome, now, !!pickedRef.current && getDuelCard(pickedRef.current)?.kind === "TOWER", hoverRef.current);
      }
      setSnap(s);
      if (s.over && !finishedRef.current) {
        finishedRef.current = true;
        onFinish(s.outcome!);
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
    <div style={matchRoot}>
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
            <p>{t("duel.trophiesDelta", { n: (result.trophies > 0 ? "+" : "") + result.trophies })}</p>
            {result.shards > 0 && <p>{t("duel.shardsWon", { n: result.shards })}</p>}
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
