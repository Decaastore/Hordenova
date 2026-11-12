import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadEternalCastle, loadSave, updateSave, type SaveData } from "@/engine/SaveSystem";
import { appendLedgerEvent } from "@/engine/EconomyLedger";
import { ColossusEngine, COLOSSUS_SLOTS, MOVE_COOLDOWN_MS, type ColossusSnapshot } from "@/engine/ColossusEngine";
import {
  applyAttempt,
  attemptsLeft,
  claimWorldPrize,
  COLOSSUS_ATTEMPTS_PER_DAY,
  COLOSSUS_DAILY_GEMS,
  COLOSSUS_LENGTH_MS,
  COLOSSUS_MARK_GOALS,
  COLOSSUS_ROOM_SIZE,
  COLOSSUS_WORLD_GEMS,
  colossusPhaseAt,
  placePrize,
  raidPower,
  rollColossus,
  spendAttempt,
  toggleColossusCosmetic,
  weekEndsAt,
  worldState,
  type ColossusCosmeticId,
  type ColossusPrize,
} from "@/config/colossus";
import { createTowerInstance, getTowerStats, type TowerInstance } from "@/entities/Tower";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { ColossusFxLayer, COLOSSUS_VIEW_H, COLOSSUS_VIEW_W, drawColossusFrame, drawColossusShowcase, formatShort } from "@/rendering/colossusRenderer";
import { drawEclipseOver, drawEclipseUnder } from "@/rendering/eclipseAura";
import { drawTower } from "@/rendering/EntityRenderer";
import { PAGE_CSS } from "@/ui/pageChrome";
import { MaterialIcon, type MaterialKind } from "@/ui/MaterialIcon";
import { TowerPortrait } from "@/ui/TowerPortrait";

const W = COLOSSUS_VIEW_W;
const H = COLOSSUS_VIEW_H;

interface BestTower {
  type: TowerType;
  level: number;
  dps: number;
  power: number;
  skin: string | null;
  mastery: number;
}

/** The account's strongest single tower, from the Season castle and the Eternal one. A new account gets a recruit tower so nobody is left out. */
export function bestTower(save: SaveData): BestTower {
  const castles = [save, loadEternalCastle()].filter(Boolean) as Pick<SaveData, "towerLoadout" | "towerMasteryLevels">[];
  let best: BestTower | null = null;
  for (const c of castles) {
    for (const e of c.towerLoadout) {
      const mastery = c.towerMasteryLevels[e.type] ?? 0;
      const inst = createTowerInstance("x", e.type, { x: 0, y: 0 }, e.level, e.specializationId ?? null, e.specializationLevel ?? 0, null, mastery, save.masteryUnlocked[e.type] === true);
      const st = getTowerStats(inst);
      const dps = st.damage * st.attackSpeed;
      if (!best || dps > best.dps) best = { type: e.type, level: inst.level, dps, power: raidPower(dps), skin: save.equippedTowerSkinByType[e.type] ?? null, mastery };
    }
  }
  if (best) return best;
  const inst = createTowerInstance("x", "IRONWOOD", { x: 0, y: 0 }, 5);
  const st = getTowerStats(inst);
  return { type: "IRONWOOD", level: 5, dps: st.damage * st.attackSpeed, power: raidPower(st.damage * st.attackSpeed), skin: null, mastery: 0 };
}

function grant(cur: SaveData, prize: ColossusPrize, source: string): Partial<SaveData> {
  // Free Gems won against the Serpent — earned by playing, never a purchase
  if (prize.gems > 0) appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: prize.gems, currency: "FREE" });
  const e = cur.expeditions;
  return {
    freeGems: cur.freeGems + prize.gems,
    expeditions: {
      ...e,
      splinters: e.splinters + prize.splinters,
      essences: { ...e.essences, RARE: e.essences.RARE + prize.rare, EPIC: e.essences.EPIC + prize.epic, LEGENDARY: e.essences.LEGENDARY + prize.legendary },
    },
  };
}

function PrizeLine({ prize }: { prize: ColossusPrize }) {
  const { t } = useLanguage();
  const items: [MaterialKind | "MARKS_ECLIPSE", number, string][] = [
    ["GEMS_FREE", prize.gems, t("colossus.prize.gems")],
    ["SPLINTERS", prize.splinters, t("colossus.prize.splinters")],
    ["RARE", prize.rare, t("colossus.prize.rare")],
    ["EPIC", prize.epic, t("colossus.prize.epic")],
    ["LEGENDARY", prize.legendary, t("colossus.prize.legendary")],
    ["MARKS_ECLIPSE", prize.marks, t("colossus.prize.marks")],
  ];
  return (
    <span className="co-prize">
      {items
        .filter(([, n]) => n > 0)
        .map(([k, n, label]) => (
          <span key={k} className="co-pz" title={label}>
            {k === "MARKS_ECLIPSE" ? <EclipseMark size={16} /> : <MaterialIcon kind={k} size={16} />} +{n} <small>{label}</small>
          </span>
        ))}
    </span>
  );
}

function EclipseMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ verticalAlign: "-3px" }}>
      <defs>
        <radialGradient id="emk" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#ffd98a" />
          <stop offset="100%" stopColor="#a66bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#emk)" />
      <circle cx="12.6" cy="11.4" r="6" fill="#0a0612" stroke="#ffe3a0" strokeWidth="1" />
    </svg>
  );
}

/** A tower wearing an Eclipse look, for the lobby's cosmetic cards. */
function CosmeticPreview({ id, type }: { id: ColossusCosmeticId; type: TowerType }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 130 * dpr;
    cv.height = 120 * dpr;
    const tower = createTowerInstance("p", type, { x: 0, y: 0 }, 21);
    let raf = 0;
    const loop = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 130, 120);
      ctx.save();
      ctx.translate(65, 78);
      ctx.scale(1.25, 1.25);
      drawEclipseUnder(ctx, now, id);
      ctx.restore();
      ctx.save();
      ctx.translate(65 - 0, 78 - 0);
      ctx.scale(1.25 / 1.15, 1.25 / 1.15);
      tower.position = { x: 0, y: 0 };
      drawTower(ctx, tower, false, now, Infinity, true);
      ctx.restore();
      ctx.save();
      ctx.translate(65, 78);
      ctx.scale(1.25, 1.25);
      drawEclipseOver(ctx, now, -34, id);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, type]);
  return <canvas ref={ref} className="co-cosprev" style={{ width: 130, height: 120 }} aria-hidden="true" />;
}

function Showcase() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth;
        if (cv.width !== Math.round(w * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(((w * H) / W) * dpr);
        }
        ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        drawColossusShowcase(ctx, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="co-show" data-testid="colossus-showcase" />;
}

interface ColossusScreenProps {
  onExit: () => void;
}

interface AttemptSummary {
  place: number;
  damage: number;
  roomDamage: number;
  prize: ColossusPrize;
  dailyGem: boolean;
  newCosmetics: ColossusCosmeticId[];
}

/** CHEFE GLOBAL — the Serpent of the Eclipse: lobby (world life, attempts, prizes, Eclipse looks) and the raid itself. */
export function ColossusScreen({ onExit }: ColossusScreenProps) {
  const { t, language } = useLanguage();
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [raid, setRaid] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);
  const profile = rollColossus(save.colossus, now);
  const world = worldState(profile, now);
  const left = attemptsLeft(profile, now);
  const best = useMemo(() => bestTower(save), [save]);
  const hoursLeft = Math.max(0, Math.floor((weekEndsAt(now) - now) / 3_600_000));
  const world_prize = claimWorldPrize(profile, now);
  const [notice, setNotice] = useState<string | null>(null);

  const claimWorld = () => {
    const cur = loadSave();
    const r = claimWorldPrize(cur.colossus, Date.now());
    if (!r) return;
    setSave(updateSave({ ...grant(cur, { splinters: 0, rare: 0, epic: 0, legendary: 0, marks: 0, gems: r.gems }, "colossus_world"), colossus: r.profile }));
    setNotice(t("colossus.worldClaimed", { n: r.gems }));
  };

  const wear = (id: ColossusCosmeticId) => {
    const cur = loadSave();
    const p = toggleColossusCosmetic(rollColossus(cur.colossus, Date.now()), id);
    if (p) setSave(updateSave({ colossus: p }));
  };

  if (raid)
    return (
      <ColossusRaid
        best={best}
        onDone={() => {
          setSave(loadSave());
          setRaid(false);
        }}
      />
    );

  const goalTop = COLOSSUS_MARK_GOALS[COLOSSUS_MARK_GOALS.length - 1]!.marks;

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + LOBBY_CSS}</style>
      <div className="pg-scroll">
        <header className="pg-hero co-hero">
          <div className="pg-hero-inner co-hero-inner">
            <div>
              <button className="pg-link" onClick={onExit}>
                ← {t("colossus.back")}
              </button>
              <p className="co-kicker">{t("colossus.kicker")}</p>
              <h1 className="pg-h1">{t("colossus.title")}</h1>
              <p className="pg-lead">{t("colossus.lead")}</p>
            </div>
          </div>
          <Showcase />
        </header>
        <div className="pg-wrap">
          <section className="co-world" data-testid="colossus-world">
            <div className="co-world-head">
              <h2 className="pg-h2">{world.defeated ? t("colossus.worldDefeated") : t("colossus.worldLife")}</h2>
              <span>{t("colossus.weekEnds", { h: hoursLeft })}</span>
            </div>
            <div className="co-hp">
              <div style={{ width: `${(world.fraction * 100).toFixed(2)}%` }} />
              <span>
                {fmt(world.hpLeft)} / {fmt(5_000_000_000)}
              </span>
            </div>
            <p className="co-sim">{t("colossus.simNote", { n: COLOSSUS_ROOM_SIZE - 1 })}</p>
            {world_prize && (
              <button className="pg-btn" onClick={claimWorld} data-testid="colossus-claim-world">
                {t("colossus.claimWorld", { n: world_prize.gems })}
              </button>
            )}
            {notice && <p className="co-notice">{notice}</p>}
          </section>

          <section className="co-play">
            <div className="co-tower">
              <TowerPortrait type={best.type} level={Math.max(1, best.level)} skinId={best.skin} width={92} height={92} zoom={1.6} baseY={0.74} />
              <div>
                <small>{t("colossus.yourTower")}</small>
                <strong>
                  {t(`towers.${best.type}.name` as TranslationKey)} · {t("colossus.level", { n: best.level })}
                </strong>
                <span>{t("colossus.power", { n: fmt(best.power) })}</span>
              </div>
            </div>
            <div className="co-start">
              <button className="pg-btn" disabled={left <= 0} onClick={() => setRaid(true)} data-testid="colossus-start">
                {left > 0 ? t("colossus.start") : t("colossus.noAttempts")}
              </button>
              <small>{t("colossus.attempts", { n: left, max: COLOSSUS_ATTEMPTS_PER_DAY })}</small>
            </div>
          </section>

          <section className="co-block">
            <h2 className="pg-h2">{t("colossus.howTitle")}</h2>
            <ol className="co-how">
              <li>
                <strong>{t("colossus.phase.AWAKEN")}</strong> {t("colossus.how1")}
              </li>
              <li>
                <strong>{t("colossus.phase.STARFALL")}</strong> {t("colossus.how2")}
              </li>
              <li>
                <strong>{t("colossus.phase.ECLIPSE")}</strong> {t("colossus.how3")}
              </li>
            </ol>
            <p className="pg-sub">{t("colossus.howFair")}</p>
          </section>

          <section className="co-block" data-testid="colossus-prizes">
            <h2 className="pg-h2">{t("colossus.prizesTitle")}</h2>
            <p className="pg-sub">{t("colossus.prizesLead", { gems: COLOSSUS_DAILY_GEMS, world: COLOSSUS_WORLD_GEMS })}</p>
            <div className="co-places">
              {[1, 2, 3, 6, 12].map((p, i, arr) => (
                <div key={p} className="co-place">
                  <strong>{i === 0 ? t("colossus.place1") : i === 3 ? t("colossus.placeRange", { a: 4, b: 6 }) : i === 4 ? t("colossus.placeRange", { a: 7, b: 12 }) : t("colossus.placeN", { n: p })}</strong>
                  <PrizeLine prize={placePrize(p)} />
                  {void arr}
                </div>
              ))}
            </div>
          </section>

          <section className="co-block" data-testid="colossus-marks">
            <h2 className="pg-h2">
              {t("colossus.marksTitle")} <EclipseMark size={22} /> {profile.weekMarks}
            </h2>
            <p className="pg-sub">{t("colossus.marksLead")}</p>
            <div className="co-mbar">
              <div style={{ width: `${Math.min(100, (profile.weekMarks / goalTop) * 100)}%` }} />
              {COLOSSUS_MARK_GOALS.map((g) => (
                <i key={g.marks} style={{ left: `${(g.marks / goalTop) * 100}%` }} className={profile.weekMarks >= g.marks ? "on" : ""}>
                  {g.marks}
                </i>
              ))}
            </div>
            <div className="co-goals">
              {COLOSSUS_MARK_GOALS.map((g, i) => {
                const done = profile.goalsPaid.includes(i);
                return (
                  <div key={g.marks} className={`co-goal${done ? " is-done" : ""}`}>
                    {g.cosmetic ? <CosmeticPreview id={g.cosmetic} type={best.type} /> : <MaterialIcon kind="LEGENDARY" size={44} />}
                    <div>
                      <strong>{t("colossus.goalAt", { n: g.marks })}</strong>
                      {g.cosmetic ? <span>{t(`colossus.cos.${g.cosmetic}` as TranslationKey)}</span> : <PrizeLine prize={g.prize} />}
                      <small>{g.cosmetic ? t("colossus.cosNote") : t("colossus.weeklyRepeat")}</small>
                      {g.cosmetic && profile.owned.includes(g.cosmetic) && (
                        <button className="pg-btn-ghost co-wear" onClick={() => wear(g.cosmetic!)} data-testid={`colossus-wear-${g.cosmetic}`}>
                          {profile.equipped === g.cosmetic ? t("colossus.wearing") : t("colossus.wear")}
                        </button>
                      )}
                    </div>
                    <span className="co-check">{done ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="co-block co-stats">
            <dl>
              <div>
                <dt>{t("colossus.weekDamage")}</dt>
                <dd>{formatShort(profile.weekDamage)}</dd>
              </div>
              <div>
                <dt>{t("colossus.bestDamage")}</dt>
                <dd>{formatShort(profile.bestDamage)}</dd>
              </div>
              <div>
                <dt>{t("colossus.bestPlace")}</dt>
                <dd>{profile.bestPlace ? `${profile.bestPlace}º` : "—"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function ColossusRaid({ best, onDone }: { best: BestTower; onDone: () => void }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<ColossusEngine | null>(null);
  const [snap, setSnap] = useState<ColossusSnapshot | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const engineRef = useRef<ColossusEngine | null>(null);
  engineRef.current = engine;
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const towersRef = useRef<TowerInstance[]>([]);
  const finishedRef = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const fxRef = useRef<ColossusFxLayer | null>(null);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const e = engineRef.current;
      if (e && countdownRef.current === null) {
        acc += Math.min(1000, now - last);
        if (acc >= 50) {
          const steps = Math.floor(acc / 50) * 50;
          e.advance(steps);
          acc -= steps;
        }
      }
      const frameDt = Math.min(100, now - last);
      last = now;
      const s = e ? e.snapshot() : null;
      if (s && towersRef.current.length === 0) {
        towersRef.current = s.players.map((p, i) => {
          const lvl = p.isYou ? best.level : 12 + Math.floor((Math.sin(i * 91.7) * 0.5 + 0.5) * 18);
          return createTowerInstance(`c${i}`, p.type, { x: 0, y: 0 }, lvl, null, 0, p.isYou ? best.skin : null, p.isYou ? best.mastery : 0);
        });
      }
      if (s) {
        if (!fxRef.current) fxRef.current = new ColossusFxLayer();
        fxRef.current.sync(s, towersRef.current, frameDt);
      }
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (cv && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth;
        const h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(h * dpr);
        }
        const sc = Math.min(cv.width / W, cv.height / H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#05030a";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.setTransform(sc, 0, 0, sc, (cv.width - W * sc) / 2, (cv.height - H * sc) / 2);
        const you = s?.players.find((p) => p.isYou);
        const canMove = !!s && !!you && s.timeMs >= you.moveReadyAt && s.timeMs >= you.stunnedUntil && s.timeMs < COLOSSUS_LENGTH_MS;
        drawColossusFrame(ctx, s, towersRef.current, now, { pickMode: !e, hoverSlot: hoverRef.current, canMove, youLabel: t("colossus.you"), fx: fxRef.current });
      }
      if (s) setSnap(s);
      if (s?.over && !finishedRef.current && e) {
        finishedRef.current = true;
        const place = e.placeOf(0);
        const damage = s.players[0]!.damage;
        const cur = loadSave();
        const r = applyAttempt(cur.colossus, place, damage, Date.now());
        updateSave({ ...grant(cur, r.prize, "colossus_attempt"), colossus: r.profile });
        setSummary({ place, damage, roomDamage: s.roomDamage, prize: r.prize, dailyGem: r.dailyGem, newCosmetics: r.newCosmetics });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  countdownRef.current = countdown;
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 700);
    return () => window.clearTimeout(id);
  }, [countdown]);

  const toWorld = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = ev.currentTarget;
    const r = cv.getBoundingClientRect();
    const sc = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * sc) / 2;
    const oy = (r.height - H * sc) / 2;
    return { x: (ev.clientX - r.left - ox) / sc, y: (ev.clientY - r.top - oy) / sc };
  };
  const slotAt = (ev: React.MouseEvent<HTMLCanvasElement>): number | null => {
    const p = toWorld(ev);
    let bestI: number | null = null;
    let bd = 42;
    COLOSSUS_SLOTS.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, (s.y - p.y) * 1.3);
      if (d < bd) {
        bd = d;
        bestI = i;
      }
    });
    return bestI;
  };

  const begin = (slot: number) => {
    const cur = loadSave();
    const spent = spendAttempt(cur.colossus, Date.now());
    if (!spent) return;
    updateSave({ colossus: spent });
    const e = new ColossusEngine({ seed: (Date.now() & 0x7fffffff) | 1, you: { name: t("colossus.you"), type: best.type, power: best.power, skin: best.skin }, slot });
    if (import.meta.env.DEV) (window as unknown as { __hordenovaColossus?: ColossusEngine }).__hordenovaColossus = e;
    setEngine(e);
    setCountdown(3);
  };

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const slot = slotAt(ev);
    if (slot === null) return;
    if (!engine) begin(slot);
    else engine.moveTo(slot);
  };

  const you = snap?.players.find((p) => p.isYou) ?? null;
  const time = snap?.timeMs ?? 0;
  const phase = colossusPhaseAt(Math.min(time, COLOSSUS_LENGTH_MS - 1));
  const clockLeft = Math.max(0, COLOSSUS_LENGTH_MS - time);
  const clock = `${Math.floor(clockLeft / 60000)}:${String(Math.floor((clockLeft % 60000) / 1000)).padStart(2, "0")}`;
  const ranking = snap ? [...snap.players].sort((a, b) => b.damage - a.damage) : [];
  const shielded = !!snap && time < snap.shieldUntil;
  const moveIn = you ? Math.max(0, you.moveReadyAt - time) : 0;
  const stunned = !!you && time < you.stunnedUntil;
  const marked = !!snap && !!you && snap.stars.some((s) => s.slot === you.slot);

  return (
    <div style={raidRoot}>
      <style>{RAID_CSS}</style>
      <div className="cr-top">
        <div className="cr-boss">
          <strong>{t("colossus.bossName")}</strong>
          <span className={`cr-phase is-${phase}`}>{engine ? t(`colossus.phase.${phase}` as TranslationKey) : t("colossus.pickTitle")}</span>
        </div>
        <div className="cr-clock" style={{ ["--p" as string]: `${(time / COLOSSUS_LENGTH_MS) * 360}deg` }}>
          <div>
            <span>{clock}</span>
          </div>
        </div>
        <div className="cr-mine">
          <small>{t("colossus.yourDamage")}</small>
          <strong data-testid="colossus-my-damage">{formatShort(you?.damage ?? 0)}</strong>
          <small>{t("colossus.roomDamage", { n: formatShort(snap?.roomDamage ?? 0) })}</small>
        </div>
      </div>
      <div className="cr-stage">
        <canvas
          ref={canvasRef}
          className="cr-canvas"
          onClick={onClick}
          onMouseMove={(e) => setHover(slotAt(e))}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: hover !== null ? "pointer" : "default" }}
          data-testid="colossus-canvas"
        />
        {!engine && (
          <div className="cr-pick">
            <strong>{t("colossus.pickTitle")}</strong>
            <span>{t("colossus.pickHint")}</span>
          </div>
        )}
        {countdown !== null && countdown > 0 && <div className="cr-count">{countdown}</div>}
        {engine && !summary && (
          <ol className="cr-rank" data-testid="colossus-ranking">
            {ranking.map((p, i) => (
              <li key={p.name} className={p.isYou ? "is-you" : ""}>
                <span>{i + 1}</span>
                <em>{p.isYou ? t("colossus.you") : p.name}</em>
                <b>{formatShort(p.damage)}</b>
              </li>
            ))}
          </ol>
        )}
        {engine && !summary && (shielded || marked || stunned) && (
          <div className={`cr-alert${marked ? " is-danger" : ""}`}>{stunned ? t("colossus.alertStunned") : marked ? t("colossus.alertStar") : t("colossus.alertShield")}</div>
        )}
        {summary && (
          <div className="cr-result" role="dialog" data-testid="colossus-result">
            <p className="cr-res-kicker">{t("colossus.resultKicker")}</p>
            <h2>{t("colossus.resultPlace", { n: summary.place, of: COLOSSUS_ROOM_SIZE })}</h2>
            <p>{t("colossus.resultDamage", { n: formatShort(summary.damage), room: formatShort(summary.roomDamage) })}</p>
            {summary.dailyGem && <p className="cr-tag">{t("colossus.dailyGemTag", { n: COLOSSUS_DAILY_GEMS })}</p>}
            {summary.newCosmetics.map((c) => (
              <p key={c} className="cr-tag is-gold">
                {t("colossus.cosUnlocked", { name: t(`colossus.cos.${c}` as TranslationKey) })}
              </p>
            ))}
            <PrizeLine prize={summary.prize} />
            <div className="cr-actions">
              <button className="cr-btn" onClick={onDone} data-testid="colossus-back">
                {t("colossus.toLobby")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="cr-bottom">
        {engine && you && (
          <>
            <button
              className={`cr-strike${you.charge >= 1 ? " is-ready" : ""}`}
              disabled={you.charge < 1 || stunned || !!summary}
              onClick={() => engine.strike()}
              style={{ ["--c" as string]: `${you.charge * 360}deg` }}
              data-testid="colossus-strike"
            >
              <span>✦</span>
              <div>
                <strong>{t("colossus.strike")}</strong>
                <small>{you.charge >= 1 ? (shielded ? t("colossus.strikeShield") : t("colossus.strikeReady")) : `${Math.floor(you.charge * 100)}%`}</small>
              </div>
            </button>
            <div className="cr-move">
              <strong>{t("colossus.moveTitle")}</strong>
              <small>{moveIn > 0 ? t("colossus.moveIn", { s: Math.ceil(moveIn / 1000) }) : t("colossus.moveHint", { s: MOVE_COOLDOWN_MS / 1000 })}</small>
            </div>
          </>
        )}
        {!engine && (
          <button className="cr-btn is-ghost" onClick={onDone}>
            {t("colossus.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

// keep the type list referenced for tree-shaking clarity
void TOWER_TYPES;

const raidRoot: CSSProperties = { position: "fixed", inset: 0, display: "grid", gridTemplateRows: "auto 1fr auto", background: "#05030a", color: "#efe4cf", fontFamily: "system-ui, sans-serif" };

const LOBBY_CSS = `
.co-hero { position: relative; overflow: hidden; padding-bottom: 0 !important; }
.co-hero-inner { position: relative; z-index: 1; }
.co-kicker { margin: 14px 0 0; color: #c79bff; font-weight: 700; letter-spacing: 0.02em; }
.co-show { display: block; width: 100%; max-width: 1100px; aspect-ratio: ${W} / ${H}; margin: 18px auto 0; border-radius: 16px; border: 1px solid rgba(199,155,255,0.35); box-shadow: 0 30px 80px rgba(80,30,160,0.35); }
.co-world { padding: 30px 0 10px; }
.co-world-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; }
.co-world-head span { color: var(--ash); font-size: 14px; }
.co-hp { position: relative; height: 26px; border-radius: 8px; background: rgba(255,255,255,0.07); overflow: hidden; margin-top: 12px; border: 1px solid rgba(199,155,255,0.35); }
.co-hp div { height: 100%; background: linear-gradient(90deg, #5b1f8f, #b06aff 60%, #ffd36b); box-shadow: 0 0 20px rgba(176,106,255,0.6); transition: width 0.6s; }
.co-hp span { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff; text-shadow: 0 1px 3px #000; }
.co-sim { margin: 10px 0 0; font-size: 13px; color: var(--ash); max-width: 80ch; }
.co-notice { color: #9be37a; font-weight: 700; }
.co-world .pg-btn { margin-top: 14px; }
.co-play { display: flex; flex-wrap: wrap; gap: 18px 40px; align-items: center; justify-content: space-between; padding: 26px 0; border-bottom: 1px solid var(--line); }
.co-tower { display: flex; gap: 16px; align-items: center; }
.co-tower > div { display: grid; gap: 3px; }
.co-tower small { color: var(--ash); font-size: 13px; }
.co-tower strong { font-family: var(--display); font-size: 22px; color: var(--bone); }
.co-tower span { color: #c79bff; font-weight: 700; }
.co-start { display: grid; justify-items: end; gap: 8px; }
.co-start small { color: var(--ash); }
.co-start .pg-btn:disabled { opacity: 0.45; cursor: default; }
.co-block { padding: 30px 0 6px; }
.co-block .pg-sub { margin: 6px 0 0; max-width: 78ch; }
.co-how { display: grid; gap: 10px; padding-left: 20px; margin: 14px 0 0; color: var(--bone); line-height: 1.5; max-width: 80ch; }
.co-how strong { color: #ffd36b; margin-right: 6px; }
.co-places { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-top: 14px; }
.co-place { display: grid; gap: 8px; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.co-place strong { font-family: var(--display); font-size: 18px; color: var(--bone); }
.co-prize { display: inline-flex; flex-wrap: wrap; gap: 6px 6px; color: var(--bone); font-weight: 700; }
.co-pz { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; padding: 3px 9px 3px 5px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }
.co-pz small { color: var(--ash); font-weight: 500; }
.co-mbar { position: relative; height: 12px; border-radius: 6px; background: rgba(255,255,255,0.08); margin: 26px 0 30px; }
.co-mbar > div { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #6a2fb0, #ffd36b); }
.co-mbar i { position: absolute; top: 16px; transform: translateX(-50%); font-style: normal; font-size: 12px; color: var(--ash); }
.co-mbar i::before { content: ""; position: absolute; left: 50%; top: -22px; width: 2px; height: 18px; background: rgba(255,255,255,0.3); }
.co-mbar i.on { color: #ffd36b; font-weight: 800; }
.co-goals { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.co-goal { display: flex; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(24,18,12,0.55); }
.co-goal > div { flex: 1; display: grid; gap: 4px; }
.co-goal strong { color: var(--bone); font-size: 15px; }
.co-goal span { color: #c79bff; font-weight: 700; }
.co-goal small { color: var(--ash); font-size: 12px; }
.co-goal.is-done { border-color: rgba(155,227,122,0.5); }
.co-check { color: #9be37a; font-size: 22px; font-weight: 800; }
.co-cosprev { border-radius: 10px; background: radial-gradient(circle at 50% 70%, rgba(160,100,255,0.16), rgba(0,0,0,0.4)); flex: none; }
.co-wear { justify-self: start; padding: 7px 14px !important; font-size: 13px !important; }
.co-stats dl { display: flex; flex-wrap: wrap; gap: 20px 44px; margin: 0 0 80px; }
.co-stats dt { font-size: 13px; color: var(--ash); }
.co-stats dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: 32px; color: var(--gold-hi); }
`;

const RAID_CSS = `
.cr-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 10px 18px; background: linear-gradient(180deg, rgba(40,20,70,0.85), rgba(10,6,18,0.9)); border-bottom: 1px solid rgba(199,155,255,0.3); }
.cr-boss { display: grid; gap: 2px; }
.cr-boss strong { font-family: "Cinzel", Georgia, serif; font-size: 20px; color: #f3e1b5; letter-spacing: 0.02em; }
.cr-phase { font-size: 13px; font-weight: 700; color: #c79bff; }
.cr-phase.is-STARFALL { color: #ff9a6a; }
.cr-phase.is-ECLIPSE { color: #ff5a4a; }
.cr-clock { width: 62px; height: 62px; border-radius: 50%; background: conic-gradient(#ffd36b var(--p), rgba(255,255,255,0.1) 0); display: grid; place-items: center; }
.cr-clock > div { width: 52px; height: 52px; border-radius: 50%; background: #0c0716; display: grid; place-items: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.cr-mine { display: grid; justify-items: end; gap: 1px; }
.cr-mine small { color: #b8a8d0; font-size: 12px; }
.cr-mine strong { font-size: 24px; color: #ffd36b; font-variant-numeric: tabular-nums; }
.cr-stage { position: relative; min-height: 0; }
.cr-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.cr-pick { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); display: grid; gap: 4px; text-align: center; padding: 12px 22px; border-radius: 12px; background: rgba(10,6,18,0.82); border: 1px solid rgba(255,211,107,0.5); pointer-events: none; }
.cr-pick strong { color: #ffd36b; font-size: 18px; }
.cr-pick span { color: #d9cdea; font-size: 13px; max-width: 46ch; }
.cr-count { position: absolute; inset: 0; display: grid; place-items: center; font-size: 120px; font-weight: 900; color: #ffd36b; text-shadow: 0 0 40px rgba(255,180,80,0.8); pointer-events: none; }
.cr-rank { position: absolute; right: 12px; top: 12px; margin: 0; padding: 8px; list-style: none; width: 210px; border-radius: 12px; background: rgba(10,6,18,0.72); border: 1px solid rgba(199,155,255,0.25); font-size: 12px; display: grid; gap: 2px; }
.cr-rank li { display: grid; grid-template-columns: 20px 1fr auto; gap: 6px; padding: 3px 6px; border-radius: 6px; color: #d9cdea; }
.cr-rank li span { color: #8a7aa8; font-weight: 700; }
.cr-rank li em { font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cr-rank li b { font-variant-numeric: tabular-nums; }
.cr-rank li.is-you { background: rgba(255,211,107,0.16); color: #ffd36b; font-weight: 800; }
.cr-alert { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 10px 20px; border-radius: 10px; font-weight: 800; background: rgba(40,90,140,0.85); color: #e6f6ff; border: 1px solid rgba(150,230,255,0.7); pointer-events: none; }
.cr-alert.is-danger { background: rgba(140,30,20,0.9); border-color: #ff8a6a; color: #fff; animation: cr-blink 0.5s infinite alternate; }
@keyframes cr-blink { to { filter: brightness(1.35); } }
.cr-result { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, 92vw); display: grid; gap: 10px; justify-items: center; text-align: center; padding: 26px 24px; border-radius: 16px; background: rgba(12,7,22,0.94); border: 1px solid rgba(255,211,107,0.55); box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
.cr-result h2 { margin: 0; font-family: "Cinzel", Georgia, serif; font-size: 34px; color: #ffd36b; }
.cr-result p { margin: 0; color: #e6dcf2; }
.cr-res-kicker { color: #c79bff !important; font-weight: 700; }
.cr-tag { font-weight: 700; color: #9be37a !important; }
.cr-tag.is-gold { color: #ffd36b !important; }
.cr-result .co-prize { justify-content: center; }
.cr-actions { display: flex; gap: 10px; margin-top: 6px; }
.cr-btn { padding: 11px 20px; border-radius: 10px; border: 1px solid rgba(255,211,107,0.7); background: linear-gradient(180deg, #ffd36b, #c98b2a); color: #2a1606; font-weight: 800; cursor: pointer; }
.cr-btn.is-ghost { background: rgba(20,12,32,0.8); color: #e6dcf2; border-color: rgba(199,155,255,0.45); }
.cr-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px 26px; padding: 10px 18px; background: linear-gradient(0deg, rgba(40,20,70,0.85), rgba(10,6,18,0.9)); border-top: 1px solid rgba(199,155,255,0.3); min-height: 64px; }
.cr-strike { display: flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 40px; border: 1px solid rgba(255,211,107,0.5); background: rgba(20,12,32,0.9); color: #efe4cf; cursor: pointer; }
.cr-strike > span { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; color: #ffd36b; background: radial-gradient(#1a0f2a 58%, transparent 60%), conic-gradient(#ffd36b var(--c), rgba(255,255,255,0.12) 0); }
.cr-strike > div { display: grid; text-align: left; }
.cr-strike small { color: #b8a8d0; }
.cr-strike.is-ready { box-shadow: 0 0 24px rgba(255,211,107,0.55); border-color: #ffd36b; }
.cr-strike:disabled { cursor: default; }
.cr-move { display: grid; gap: 1px; font-size: 13px; }
.cr-move small { color: #b8a8d0; }
@media (max-width: 720px) { .cr-rank { width: 150px; font-size: 11px; } .cr-top { padding: 8px 10px; } .cr-boss strong { font-size: 15px; } }
`;
