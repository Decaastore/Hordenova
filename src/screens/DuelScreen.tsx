import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { appendLedgerEvent } from "@/engine/EconomyLedger";
import { CASTLE_AT, DuelEngine, LANE_H, LANE_SLOTS, LANE_W, lanePath, slotPos, type DuelSnapshot, type Side } from "@/engine/DuelEngine";
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
  MAX_DUEL_TOWER_LEVEL,
  TROPHIES_LOSS,
  TROPHIES_WIN,
  type DuelCardId,
  type DuelOutcome,
} from "@/config/duel";
import { drawEnemy, drawEnemyHpBar, drawTower } from "@/rendering/EntityRenderer";
import { ensureEnemySpritesLoading, setSpriteBiome } from "@/rendering/enemySprites";
import { createEnemyInstance } from "@/entities/Enemy";
import type { EnemyType } from "@/config/enemyStats";
import { getCastleSprite } from "@/rendering/castleSprites";
import { TowerPortrait } from "@/ui/TowerPortrait";
import { PAGE_CSS } from "@/ui/pageChrome";

const W = LANE_W * 2;
const H = LANE_H;
const SHOT_COLOR: Record<string, string> = { IRONWOOD: "255,224,150", INFERNO: "255,120,40", FROSTBORN: "140,220,255", STORMCALLER: "190,140,255" };
const ARENA_TINT: Record<string, [string, string]> = {
  ARENA_FOREST: ["#1f2a17", "#11170c"],
  ARENA_VOLCANO: ["#2e1a12", "#170c08"],
  ARENA_TUNDRA: ["#1c2632", "#0e141c"],
  ARENA_ABYSS: ["#211a2e", "#0f0b17"],
};

const groundCache = new Map<string, HTMLImageElement>();
function groundImage(biome: string): HTMLImageElement | null {
  const key = biome.toLowerCase();
  let img = groundCache.get(key);
  if (!img) {
    img = new Image();
    img.src = `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}sprites/ground/${key}.webp`;
    groundCache.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function drawArena(ctx: CanvasRenderingContext2D, snap: DuelSnapshot, arenaId: string, biome: string, timeMs: number, pickingSlot: boolean, hoverSlot: number | null): void {
  const [c1, c2] = ARENA_TINT[arenaId] ?? ARENA_TINT.ARENA_FOREST!;
  for (const side of [0, 1] as Side[]) {
    const x0 = side * LANE_W;
    const g = ctx.createLinearGradient(x0, 0, x0, H);
    g.addColorStop(0, c2);
    g.addColorStop(0.5, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, LANE_W, H);
    const ground = groundImage(biome);
    if (ground) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(ground, side * 700, 300, 1100, 1100 * (H / LANE_W), x0, 0, LANE_W, H);
      ctx.restore();
    }
    // speckle
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let i = 0; i < 160; i++) {
      const x = x0 + ((i * 97 + side * 31) % LANE_W);
      const y = (i * 53) % H;
      ctx.fillRect(x, y, 2, 2);
    }
    // road
    const path = lanePath(side);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const [w, col] of [
      [58, "rgba(0,0,0,0.35)"],
      [50, "#4a3a28"],
      [40, "#6a5236"],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    // slots
    LANE_SLOTS.forEach((_, i) => {
      const p = slotPos(side, i);
      const taken = snap.towers.some((t) => t.side === side && t.slot === i);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, 26, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!taken) {
        ctx.strokeStyle = side === 0 && pickingSlot ? `rgba(255,220,140,${hoverSlot === i ? 0.95 : 0.55 + 0.25 * Math.sin(timeMs / 250)})` : "rgba(200,180,140,0.25)";
        ctx.lineWidth = side === 0 && pickingSlot ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 6, 24, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // castle
    const img = getCastleSprite(biome, 2);
    const cx = CASTLE_AT.x + x0;
    const hit = snap.breaches.some((b) => b.side === side && snap.timeMs - b.at < 400);
    if (img) {
      const size = 170;
      ctx.save();
      if (hit) ctx.filter = "brightness(1.8) saturate(0.4)";
      ctx.drawImage(img, cx - size / 2, CASTLE_AT.y - size * 0.62, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(cx - 40, CASTLE_AT.y - 50, 80, 60);
    }
  }
  // divider
  const dg = ctx.createLinearGradient(LANE_W - 6, 0, LANE_W + 6, 0);
  dg.addColorStop(0, "rgba(0,0,0,0)");
  dg.addColorStop(0.5, "rgba(255,200,120,0.55)");
  dg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = dg;
  ctx.fillRect(LANE_W - 6, 0, 12, H);
}

function drawDuel(ctx: CanvasRenderingContext2D, snap: DuelSnapshot, arenaId: string, biome: string, timeMs: number, pickingSlot: boolean, hoverSlot: number | null): void {
  drawArena(ctx, snap, arenaId, biome, timeMs, pickingSlot, hoverSlot);
  // towers and units sorted by y for depth
  const items: { y: number; draw: () => void }[] = [];
  for (const t of snap.towers) {
    items.push({
      y: t.inst.position.y,
      draw: () => {
        const { x, y } = t.inst.position;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1.55, 1.55);
        ctx.translate(-x, -y);
        drawTower(ctx, t.inst, false, timeMs, snap.timeMs - t.lastShotAt);
        ctx.restore();
        // level pips
        for (let k = 0; k < MAX_DUEL_TOWER_LEVEL; k++) {
          ctx.fillStyle = k < t.level ? "#ffd56a" : "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.arc(t.inst.position.x - 12 + k * 12, t.inst.position.y + 30, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    });
  }
  for (const u of snap.units) {
    if (u.dist < 0) continue;
    items.push({
      y: u.inst.position.y,
      draw: () => {
        drawEnemy(ctx, u.inst, timeMs, Infinity, 1.45, undefined, u.angle, 0);
        drawEnemyHpBar(ctx, u.inst);
      },
    });
  }
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  // shots
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of snap.shots) {
    const age = (snap.timeMs - s.at) / 400;
    const col = SHOT_COLOR[s.type] ?? "255,255,255";
    ctx.strokeStyle = `rgba(${col},${0.9 * (1 - age)})`;
    ctx.lineWidth = s.type === "STORMCALLER" ? 2.5 : 3;
    ctx.beginPath();
    ctx.moveTo(s.from.x, s.from.y - 26);
    ctx.lineTo(s.to.x, s.to.y - 8);
    for (const h of s.hops ?? []) ctx.lineTo(h.x, h.y - 8);
    ctx.stroke();
    ctx.fillStyle = `rgba(${col},${0.7 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(s.to.x, s.to.y - 8, s.type === "INFERNO" ? 22 * (0.5 + age) : 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function CardFace({ id, small, dim }: { id: DuelCardId; small?: boolean; dim?: boolean }) {
  const { t } = useLanguage();
  const card = getDuelCard(id)!;
  return (
    <div style={{ opacity: dim ? 0.45 : 1, display: "grid", justifyItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: small ? 52 : 74, height: small ? 52 : 74, display: "grid", placeItems: "center" }}>
        {card.kind === "TOWER" ? (
          <TowerPortrait type={card.tower} level={21} width={small ? 52 : 74} height={small ? 52 : 74} zoom={1.7} baseY={0.74} />
        ) : (
          <EnemyPortrait type={card.enemy} size={small ? 52 : 74} />
        )}
        <span style={costBadge}>{card.cost}</span>
      </div>
      {!small && <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>{t(`duel.card.${id}.name` as TranslationKey)}</span>}
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
  const [result, setResult] = useState<{ outcome: DuelOutcome; trophies: number; shards: number } | null>(null);
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
    setMatch(new DuelEngine((Date.now() & 0x7fffffff) | 1, [deck, aiDeck(arena.id)], arena.ai, next.equippedTowerSkinByType));
  };

  const finish = (outcome: DuelOutcome) => {
    const cur = loadSave();
    const { profile, shards } = applyDuelResult(cur.duel, outcome, Date.now());
    if (shards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source: "duel_win", amount: shards });
    const next = updateSave({ duel: profile, gemShards: cur.gemShards + shards });
    setSave(next);
    setResult({ outcome, trophies: profile.trophies - cur.duel.trophies, shards });
  };

  if (match) return <DuelMatch engine={match} arenaId={arena.id} biome={arena.biome} result={result} onFinish={finish} onAgain={start} onLobby={() => setMatch(null)} />;

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + LOBBY_CSS}</style>
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
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(250, now - last);
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
        drawDuel(ctx, s, arenaId, biome, now, !!pickedRef.current && getDuelCard(pickedRef.current)?.kind === "TOWER", hoverRef.current);
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
          <strong>{t("duel.you")}</strong>
          <CastleBar hp={me.castle} />
        </div>
        <div className={`dm-clock${snap.doubleMana ? " is-double" : ""}`}>
          {clock}
          {snap.doubleMana && <small>{t("duel.doubleMana")}</small>}
        </div>
        <div className="dm-side is-foe">
          <strong>{t("duel.foe")}</strong>
          <CastleBar hp={foe.castle} />
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

function CastleBar({ hp }: { hp: number }) {
  const pct = Math.max(0, hp) / 20;
  return (
    <div className="dm-hp">
      <div style={{ width: `${pct * 100}%`, background: pct > 0.5 ? "#7fd36a" : pct > 0.25 ? "#e8c06a" : "#e0644b" }} />
      <span>{Math.max(0, hp)}</span>
    </div>
  );
}

const costBadge: CSSProperties = {
  position: "absolute",
  left: -4,
  top: -4,
  width: 22,
  height: 22,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at 35% 35%, #d38bff, #6a2ab0)",
  border: "1.5px solid #f0d6ff",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
};
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
.du-count { font-size: 14px; color: var(--ash); }
.du-count.is-bad { color: #ff9a85; }
.du-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 14px; }
.du-cardbtn { display: grid; justify-items: center; gap: 6px; padding: 14px 10px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); color: var(--bone); cursor: pointer; }
.du-cardbtn.is-on { border-color: rgba(232,176,75,0.7); background: linear-gradient(180deg, rgba(232,176,75,0.14), rgba(24,18,12,0.6)); }
.du-cardbtn:focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 2px; }
.du-desc { font-size: 12px; color: var(--ash); text-align: center; line-height: 1.35; }
`;

const MATCH_CSS = `
.dm-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 10px 18px; border-bottom: 1px solid rgba(232,176,75,0.25); background: linear-gradient(180deg, #1c150e, #120d08); }
.dm-side { display: grid; gap: 4px; font-size: 14px; }
.dm-side.is-foe { justify-items: end; text-align: right; }
.dm-hp { position: relative; width: min(260px, 100%); height: 14px; border-radius: 7px; background: rgba(0,0,0,0.5); overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
.dm-hp div { height: 100%; transition: width 0.2s; }
.dm-hp span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10.5px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px #000; }
.dm-side.is-foe .dm-hp div { margin-left: auto; }
.dm-clock { font-family: Georgia, serif; font-size: 28px; font-weight: 700; color: #f1dcae; text-align: center; font-variant-numeric: tabular-nums; display: grid; }
.dm-clock.is-double { color: #d8a8ff; }
.dm-clock small { font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; }
.dm-stage { position: relative; display: grid; place-items: center; min-height: 0; padding: 8px; }
.dm-canvas { width: min(100%, calc((100vh - 230px) * ${W / H})); aspect-ratio: ${W} / ${H}; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
.dm-hint { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); padding: 6px 14px; border-radius: 20px; background: rgba(0,0,0,0.7); color: #ffd56a; font-weight: 700; font-size: 13px; pointer-events: none; }
.dm-result { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; background: rgba(8,6,4,0.72); }
.dm-result h2 { margin: 0; font-family: Georgia, serif; font-size: 54px; }
.dm-result h2.is-WIN { color: #ffd56a; }
.dm-result h2.is-LOSS { color: #e0644b; }
.dm-result h2.is-DRAW { color: #cfc4b0; }
.dm-result p { margin: 0; font-size: 16px; }
.dm-result-actions { display: flex; gap: 10px; margin-top: 12px; }
.dm-hand { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 10px 16px 14px; border-top: 1px solid rgba(232,176,75,0.25); background: linear-gradient(0deg, #1c150e, #120d08); flex-wrap: wrap; }
.dm-mana { display: grid; justify-items: center; gap: 4px; font-weight: 800; color: #e3b8ff; font-size: 20px; }
.dm-mana-bar { display: flex; gap: 3px; }
.dm-mana-bar i { width: 13px; height: 18px; border-radius: 3px; background: rgba(255,255,255,0.08); }
.dm-mana-bar i.on { background: linear-gradient(180deg, #d38bff, #7a2ad0); }
.dm-cards { display: flex; gap: 10px; align-items: flex-end; }
.dm-card { width: 102px; padding: 10px 6px 8px; border-radius: 12px; border: 1px solid rgba(232,176,75,0.35); background: linear-gradient(180deg, #2a2016, #18120c); color: #efe4cf; cursor: pointer; transition: transform 0.12s; }
.dm-card:not(:disabled):hover { transform: translateY(-4px); }
.dm-card.is-picked { border-color: #ffd56a; box-shadow: 0 0 0 2px rgba(255,213,106,0.5); transform: translateY(-6px); }
.dm-card:disabled { cursor: default; }
.dm-next { display: grid; justify-items: center; gap: 2px; font-size: 11px; color: #a89a84; padding-left: 6px; }
.dm-btn { padding: 9px 18px; border-radius: 9px; border: 1px solid #e8c06a; background: linear-gradient(180deg, #b0382a, #741c12); color: #fff; font-weight: 700; cursor: pointer; }
.dm-btn.is-ghost { background: rgba(0,0,0,0.3); border-color: rgba(232,192,106,0.5); color: #efe4cf; }
.dm-quit { font-size: 12px; padding: 6px 12px; }
@media (max-width: 720px) { .dm-card { width: 78px; } .dm-clock { font-size: 22px; } }
`;
