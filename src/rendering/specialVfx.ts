import type { Vector2 } from "@/utils/geometry";
import type { TowerType } from "@/config/towerStats";

/**
 * TOWER MAGIC VFX — each tower's Special Attack ("magia") gets its own
 * signature, longer-lived visual instead of just a bigger copy of the
 * normal shot:
 *
 * - IRONWOOD "Piercing Shot": a golden lance that tears straight THROUGH
 *   the target and keeps going, with a shockwave and armor shards where it
 *   punches through.
 * - INFERNO "Firestorm": a meteor dropping onto the target, a ring of fire
 *   sweeping out to the REAL blast radius, flame tongues, and a scorched,
 *   ember-dotted crater that lingers.
 * - FROSTBORN "Absolute Zero": a frost nova sweeping out from the tower to
 *   its REAL range, leaving a crown of ice spikes, a frozen ground disc and
 *   a turning snowflake sigil for as long as the freeze actually lasts.
 * - STORMCALLER "Chain Overload": bolts slamming down from the sky onto
 *   every chained enemy, with electric impact rings and lingering arcs.
 *
 * Every special also lights a short rotating rune circle under the tower
 * that cast it, in that tower's color — the "a spell was cast here" beat.
 *
 * Purely cosmetic: spawned by CanvasRenderer the first frame it sees a new
 * special projectile in the snapshot, with radii read from the same tower
 * stats the combat code uses, so the visual covers exactly the area that
 * was really affected. Never feeds anything back into gameplay. Bounded
 * pool + short lifetimes, same performance strategy as VfxManager.
 */

export interface SpecialCast {
  type: TowerType;
  towerPosition: Vector2;
  from: Vector2;
  to: Vector2;
  chainTargets: readonly Vector2[];
  /** INFERNO: the real blast radius. FROSTBORN: the real nova radius (tower range). Unused otherwise. */
  radius: number;
}

interface ActiveCast extends SpecialCast {
  ageMs: number;
  totalMs: number;
  /** Per-cast random values fixed at spawn so the effect never jitters frame to frame. */
  seeds: number[];
  /** True when the screen was already busy at cast time — only the core beat is drawn (see FULL_EFFECT_BUDGET). */
  reduced: boolean;
}

/**
 * ANTI-CLUTTER — kept deliberately short: the magic should be a strong
 * MOMENT, not something that keeps covering the map afterwards. The first
 * cut lingered up to 2.4s (frozen ground, ember crater), which with a full
 * map of towers meant there was almost always a big effect sitting on the
 * battlefield.
 */
const LIFETIME_MS: Record<TowerType, number> = {
  IRONWOOD: 600,
  INFERNO: 1300,
  FROSTBORN: 1300,
  STORMCALLER: 750,
};

/** Lifetime of the reduced (busy-screen) version of each magic. */
const REDUCED_LIFETIME_MS: Record<TowerType, number> = {
  IRONWOOD: 420,
  INFERNO: 600,
  FROSTBORN: 600,
  STORMCALLER: 450,
};

/**
 * ANTI-CLUTTER — at most this many magics play their FULL version at the
 * same time. Any magic cast while the screen is already this busy plays a
 * reduced version (rune circle + the core hit only — no lingering crater,
 * frozen ground, shards or arcs), so a late-game map full of towers never
 * turns into a wall of effects.
 */
const FULL_EFFECT_BUDGET = 3;

const CAST_COLOR: Record<TowerType, string> = {
  IRONWOOD: "#ffd36a",
  INFERNO: "#ff7a2e",
  FROSTBORN: "#9eeeff",
  STORMCALLER: "#c08cff",
};

const MAX_ACTIVE = 8;

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** 0->1 over [a,b] of the cast's life. */
const span = (ms: number, a: number, b: number) => clamp01((ms - a) / (b - a));

export class SpecialVfxLayer {
  private casts: ActiveCast[] = [];

  spawn(cast: SpecialCast): void {
    const fullActive = this.casts.filter((c) => !c.reduced).length;
    const reduced = fullActive >= FULL_EFFECT_BUDGET;
    this.casts.push({
      ...cast,
      ageMs: 0,
      totalMs: reduced ? REDUCED_LIFETIME_MS[cast.type] : LIFETIME_MS[cast.type],
      seeds: Array.from({ length: 96 }, () => Math.random()),
      reduced,
    });
    if (this.casts.length > MAX_ACTIVE) this.casts.shift();
  }

  update(dtMs: number): void {
    for (const c of this.casts) c.ageMs += dtMs;
    this.casts = this.casts.filter((c) => c.ageMs < c.totalMs);
  }

  get activeCount(): number {
    return this.casts.length;
  }

  /** Under towers/enemies: rune circles, scorched crater, frozen ground. */
  drawGround(ctx: CanvasRenderingContext2D, timeMs: number): void {
    for (const c of this.casts) {
      // Fire and ice announce themselves with their own element at the
      // tower (flame flare / frost burst, see drawFirestorm/drawAbsoluteZero)
      // instead of a geometric rune ring.
      if (c.type === "IRONWOOD" || c.type === "STORMCALLER") drawRuneCircle(ctx, c, timeMs);
      if (c.reduced) continue;
      if (c.type === "INFERNO") drawScorch(ctx, c, timeMs);
      else if (c.type === "FROSTBORN") drawFrostGround(ctx, c);
    }
  }

  /** Over towers/enemies: beams, fire, ice, sky strikes. */
  drawAir(ctx: CanvasRenderingContext2D, timeMs = 0): void {
    for (const c of this.casts) {
      switch (c.type) {
        case "IRONWOOD":
          drawPiercingShot(ctx, c);
          break;
        case "INFERNO":
          drawFirestorm(ctx, c, timeMs);
          break;
        case "FROSTBORN":
          drawAbsoluteZero(ctx, c);
          break;
        case "STORMCALLER":
          drawChainOverload(ctx, c);
          break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Shared: the caster's rune circle.
// ---------------------------------------------------------------------------

function drawRuneCircle(ctx: CanvasRenderingContext2D, c: ActiveCast, timeMs: number): void {
  const life = Math.min(c.totalMs, 600);
  if (c.ageMs > life) return;
  const appear = easeOut(span(c.ageMs, 0, 160));
  const fade = 1 - span(c.ageMs, life * 0.55, life);
  const alpha = appear * fade * 0.85;
  if (alpha <= 0) return;
  const color = CAST_COLOR[c.type];
  const { x, y } = c.towerPosition;
  const r = 20 + appear * 5;

  ctx.save();
  ctx.translate(x, y + 10);
  ctx.scale(1, 0.5); // lies flat on the ground under the tower
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.3);
  glow.addColorStop(0, rgba(color, 0.28 * alpha));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(timeMs / 600);
  ctx.strokeStyle = rgba(color, 0.85 * alpha);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // Six runic ticks between the two rings.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.76, -2.5);
    ctx.lineTo(r * 0.94, 0);
    ctx.lineTo(r * 0.76, 2.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// IRONWOOD — Piercing Shot
// ---------------------------------------------------------------------------

function drawPiercingShot(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const color = CAST_COLOR.IRONWOOD;
  const dx = c.to.x - c.from.x;
  const dy = c.to.y - c.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // The lance keeps going past the target — "pierces through".
  const exit = { x: c.to.x + ux * 80, y: c.to.y + uy * 80 };

  const reach = easeOut(span(c.ageMs, 0, 90));
  const fade = 1 - span(c.ageMs, 110, c.totalMs * 0.75);
  const headX = c.from.x + (exit.x - c.from.x) * reach;
  const headY = c.from.y + (exit.y - c.from.y) * reach;

  ctx.save();
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "lighter";
  if (fade > 0) {
    ctx.strokeStyle = rgba(color, 0.35 * fade);
    ctx.lineWidth = 12 * fade;
    ctx.beginPath();
    ctx.moveTo(c.from.x, c.from.y);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.9 * fade);
    ctx.lineWidth = 4.5 * fade;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,252,236,${fade})`;
    ctx.lineWidth = 1.6 * fade;
    ctx.stroke();
  }

  // Punch-through: shockwave ring + armor shards flying onward.
  const hit = span(c.ageMs, 50, c.totalMs);
  if (hit > 0 && hit < 1) {
    const ringR = 6 + easeOut(hit) * 34;
    ctx.strokeStyle = rgba(color, 0.8 * (1 - hit));
    ctx.lineWidth = 3 * (1 - hit) + 0.5;
    ctx.beginPath();
    ctx.ellipse(c.to.x, c.to.y, ringR, ringR * 0.75, Math.atan2(uy, ux), 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba("#e8dcc0", 1 - hit);
    const base = Math.atan2(uy, ux);
    for (let i = 0; i < (c.reduced ? 0 : 6); i++) {
      const a = base + (c.seeds[i]! - 0.5) * 1.6;
      const d = easeOut(hit) * (22 + c.seeds[i + 8]! * 28);
      const sx = c.to.x + Math.cos(a) * d;
      const sy = c.to.y + Math.sin(a) * d;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + hit * 6);
      ctx.beginPath();
      ctx.moveTo(-2.4, -1);
      ctx.lineTo(2.6, 0);
      ctx.lineTo(-2.4, 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// INFERNO — Firestorm
//
// Reworked (feedback: "não apenas esse círculo piscando") — no geometric
// rings: the blast is built from billowing fire puffs that cool from white
// to orange to dark smoke as they rise, plus real flames licking up from
// the ground all across the blast area.
// ---------------------------------------------------------------------------

/** Flame silhouette (teardrop with a flickering tip) rising from (x,y). */
function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, width: number, sway: number, alpha: number): void {
  if (height <= 0.5 || alpha <= 0) return;
  const g = ctx.createLinearGradient(x, y, x, y - height);
  g.addColorStop(0, `rgba(255,90,20,${0.85 * alpha})`);
  g.addColorStop(0.45, `rgba(255,170,60,${0.8 * alpha})`);
  g.addColorStop(1, `rgba(255,240,170,0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.bezierCurveTo(x - width * 1.1, y - height * 0.45, x - width * 0.3 + sway, y - height * 0.7, x + sway * 1.4, y - height);
  ctx.bezierCurveTo(x + width * 0.3 + sway, y - height * 0.7, x + width * 1.1, y - height * 0.45, x + width, y);
  ctx.closePath();
  ctx.fill();
  // Hot inner core.
  const core = ctx.createLinearGradient(x, y, x, y - height * 0.6);
  core.addColorStop(0, `rgba(255,236,160,${0.9 * alpha})`);
  core.addColorStop(1, "rgba(255,236,160,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(x - width * 0.45, y);
  ctx.quadraticCurveTo(x + sway * 0.6, y - height * 0.55, x + width * 0.45, y);
  ctx.closePath();
  ctx.fill();
}

function drawScorch(ctx: CanvasRenderingContext2D, c: ActiveCast, timeMs: number): void {
  const appear = span(c.ageMs, 120, 300);
  const fade = 1 - span(c.ageMs, c.totalMs * 0.5, c.totalMs);
  const alpha = appear * fade * 0.8;
  if (alpha <= 0) return;
  const R = c.radius * 0.45;
  ctx.save();
  ctx.translate(c.to.x, c.to.y);
  ctx.scale(1, 0.7);
  const crater = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  crater.addColorStop(0, `rgba(18,6,2,${0.5 * alpha})`);
  crater.addColorStop(1, "rgba(40,12,4,0)");
  ctx.fillStyle = crater;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const a = c.seeds[i]! * Math.PI * 2;
    const d = Math.sqrt(c.seeds[i + 12]!) * R * 0.8;
    const flicker = 0.55 + 0.45 * Math.sin(timeMs / 90 + i * 1.7);
    ctx.fillStyle = `rgba(255,140,50,${0.8 * alpha * flicker})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFirestorm(ctx: CanvasRenderingContext2D, c: ActiveCast, timeMs: number): void {
  const R = c.radius;
  const { x, y } = c.to;
  const life = c.totalMs;

  ctx.save();

  // Flame flare at the casting tower — the "spell cast" beat, in fire.
  const flare = 1 - span(c.ageMs, 0, 380);
  if (flare > 0) {
    ctx.globalCompositeOperation = "lighter";
    drawFlame(ctx, c.from.x, c.from.y + 6, 26 * (1 - flare * 0.4), 6, Math.sin(timeMs / 60) * 2, flare);
    ctx.globalCompositeOperation = "source-over";
  }

  // Short hot flash at the point of impact.
  const flash = 1 - span(c.ageMs, 0, 180);
  if (flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    const fr = R * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
    g.addColorStop(0, `rgba(255,248,220,${0.85 * flash})`);
    g.addColorStop(0.5, `rgba(255,170,70,${0.5 * flash})`);
    g.addColorStop(1, "rgba(255,106,46,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Billowing fireball: puffs burst outward and upward, cooling from
  // white-hot to orange to dark smoke.
  const puffCount = c.reduced ? 7 : 16;
  for (let i = 0; i < puffCount; i++) {
    const delay = c.seeds[i]! * 90;
    const t = span(c.ageMs, delay, delay + life * 0.8);
    if (t <= 0 || t >= 1) continue;
    const a = c.seeds[i + 16]! * Math.PI * 2;
    const reach = easeOut(t) * R * (0.25 + c.seeds[i + 32]! * 0.45);
    const px = x + Math.cos(a) * reach;
    const py = y + Math.sin(a) * reach * 0.6 - easeOut(t) * (18 + c.seeds[i + 48]! * 22);
    const size = (7 + c.seeds[i + 64]! * 8) * (0.6 + easeOut(t) * 1.1);
    if (t < 0.45) {
      // Burning phase — additive fire.
      const heat = 1 - t / 0.45;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(px, py, 0, px, py, size);
      g.addColorStop(0, `rgba(255,${200 + Math.round(50 * heat)},${110 + Math.round(120 * heat)},${0.75})`);
      g.addColorStop(0.55, `rgba(255,${100 + Math.round(60 * heat)},30,0.5)`);
      g.addColorStop(1, "rgba(200,40,10,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Smoke phase — dark, soft, fading as it rises.
      const smoke = (1 - t) / 0.55;
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(px, py, 0, px, py, size);
      g.addColorStop(0, `rgba(48,30,24,${0.42 * smoke})`);
      g.addColorStop(1, "rgba(48,30,24,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flames licking up from the ground across the whole blast area —
  // "everything nearby burns". Flames nearer the impact ignite first.
  if (!c.reduced) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i++) {
      const dist = Math.sqrt(c.seeds[i + 80]!) * R * 0.85;
      const a = c.seeds[i + 70]! * Math.PI * 2;
      const fx = x + Math.cos(a) * dist;
      const fy = y + Math.sin(a) * dist * 0.65;
      const delay = (dist / Math.max(1, R)) * 220;
      const t = span(c.ageMs, delay, delay + life * 0.6);
      if (t <= 0 || t >= 1) continue;
      const h = (18 + c.seeds[i + 40]! * 14) * Math.sin(t * Math.PI);
      const sway = Math.sin(timeMs / 70 + i * 2.3) * 2.6;
      drawFlame(ctx, fx, fy, h, 5 + c.seeds[i + 50]! * 2.5, sway, 1 - t * 0.3);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// FROSTBORN — Absolute Zero
//
// Reworked (feedback: "não apenas esse círculo piscando") — no rings: frost
// cracks race outward through the ground from the tower, ice crystals burst
// up out of the ground as the cold reaches them, a low cold mist rolls out
// and snow swirls through it, then the crystals shatter and melt away.
// ---------------------------------------------------------------------------

function drawFrostGround(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const R = c.radius;
  const reach = easeOut(span(c.ageMs, 0, 380));
  const fade = 1 - span(c.ageMs, c.totalMs * 0.45, c.totalMs);
  if (reach <= 0 || fade <= 0) return;
  const { x, y } = c.towerPosition;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  // Frost cracks spreading outward through the ground, with side branches.
  const cracks = 7;
  for (let k = 0; k < cracks; k++) {
    const base = (k / cracks) * Math.PI * 2 + c.seeds[k]! * 0.6;
    const len = R * (0.55 + c.seeds[k + 8]! * 0.35) * reach;
    const pts: Vector2[] = [{ x, y }];
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const wobble = (c.seeds[(k * 6 + i) % 96]! - 0.5) * 0.22;
      pts.push({ x: x + Math.cos(base + wobble) * len * t, y: y + Math.sin(base + wobble) * len * t * 0.75 });
    }
    const stroke = (width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.stroke();
    };
    // Soft, pale frost veins (kept dimmer than lightning so they never read as a Stormcaller bolt).
    stroke(5, `rgba(120,200,235,${0.1 * fade})`);
    stroke(1, `rgba(225,248,255,${0.42 * fade})`);
    // Two short side branches off each crack.
    for (let b = 0; b < 2; b++) {
      const from = pts[2 + b * 2]!;
      const ba = base + (b === 0 ? 0.8 : -0.8);
      const bl = 8 + c.seeds[k + 20 + b]! * 8;
      ctx.strokeStyle = `rgba(215,246,255,${0.32 * fade})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(from.x + Math.cos(ba) * bl, from.y + Math.sin(ba) * bl * 0.75);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A cluster of 3 ice shards bursting up out of the ground at (x,y). */
function drawIceCluster(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, seedA: number, seedB: number, alpha: number): void {
  if (scale <= 0.02 || alpha <= 0) return;
  const shards = [
    { dx: 0, h: 15, w: 3.6, tilt: (seedA - 0.5) * 0.3 },
    { dx: -4.5, h: 9 + seedB * 4, w: 2.8, tilt: -0.45 - seedA * 0.2 },
    { dx: 4.5, h: 8 + seedA * 5, w: 2.6, tilt: 0.4 + seedB * 0.25 },
  ];
  for (const sh of shards) {
    ctx.save();
    ctx.translate(x + sh.dx * scale, y);
    ctx.rotate(sh.tilt);
    const h = sh.h * scale;
    const w = sh.w * scale;
    const g = ctx.createLinearGradient(0, 0, 0, -h);
    g.addColorStop(0, `rgba(120,200,235,${0.85 * alpha})`);
    g.addColorStop(1, `rgba(240,253,255,${0.95 * alpha})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.6, -h * 0.7);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.6, -h * 0.7);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    // Facet highlight.
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * alpha})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, -h * 0.1);
    ctx.lineTo(0, -h * 0.92);
    ctx.stroke();
    ctx.strokeStyle = `rgba(70,150,190,${0.6 * alpha})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.6, -h * 0.7);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.6, -h * 0.7);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAbsoluteZero(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const R = c.radius;
  const { x, y } = c.towerPosition;
  const life = c.totalMs;
  ctx.save();

  // Frost burst at the tower — the "spell cast" beat, in ice.
  const burst = 1 - span(c.ageMs, 0, 420);
  if (burst > 0) {
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(c.from.x, c.from.y, 0, c.from.x, c.from.y, 22);
    g.addColorStop(0, `rgba(235,252,255,${0.8 * burst})`);
    g.addColorStop(1, "rgba(140,220,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.from.x, c.from.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Cold mist rolling outward, low over the ground.
  const mistCount = c.reduced ? 5 : 9;
  for (let i = 0; i < mistCount; i++) {
    const t = span(c.ageMs, c.seeds[i]! * 80, life * 0.9);
    if (t <= 0 || t >= 1) continue;
    const a = (i / mistCount) * Math.PI * 2 + c.seeds[i + 10]! * 0.5;
    const d = easeOut(t) * R * (0.55 + c.seeds[i + 20]! * 0.35);
    const mx = x + Math.cos(a) * d;
    const my = y + Math.sin(a) * d * 0.7;
    const mr = 14 + easeOut(t) * 14;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    g.addColorStop(0, `rgba(200,236,255,${0.22 * Math.sin(t * Math.PI)})`);
    g.addColorStop(1, "rgba(200,236,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(mx, my, mr, mr * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ice crystals bursting up out of the ground as the cold reaches them,
  // then cracking apart and melting away.
  if (!c.reduced) {
    const clusters = 12;
    for (let i = 0; i < clusters; i++) {
      const dist = (0.3 + Math.sqrt(c.seeds[i + 30]!) * 0.7) * R * 0.92;
      const a = c.seeds[i + 45]! * Math.PI * 2;
      const cx = x + Math.cos(a) * dist;
      const cy = y + Math.sin(a) * dist * 0.75;
      const appearAt = (dist / Math.max(1, R)) * 340;
      const grow = easeOut(span(c.ageMs, appearAt, appearAt + 140));
      const melt = span(c.ageMs, life * 0.55 + c.seeds[i + 60]! * 150, life);
      drawIceCluster(ctx, cx, cy, grow * (0.75 + c.seeds[i + 75]! * 0.5) * (1 - melt * 0.4), c.seeds[i]!, c.seeds[i + 1]!, 1 - melt);
    }
  }

  // Snow swirling outward through the mist.
  ctx.globalCompositeOperation = "lighter";
  const flakes = c.reduced ? 6 : 16;
  for (let i = 0; i < flakes; i++) {
    const t = span(c.ageMs, 0, life);
    const a = c.seeds[i + 50]! * Math.PI * 2 + t * 1.6;
    const d = easeOut(t) * R * (0.3 + c.seeds[i + 80]! * 0.7);
    ctx.fillStyle = `rgba(240,252,255,${0.85 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - t * 10, 1 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// STORMCALLER — Chain Overload
// ---------------------------------------------------------------------------

function jagged(ctx: CanvasRenderingContext2D, from: Vector2, to: Vector2, amp: number): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = Math.max(5, Math.round(len / 16));
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const j = (Math.random() - 0.5) * amp;
    ctx.lineTo(from.x + dx * t + nx * j, from.y + dy * t + ny * j);
  }
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawChainOverload(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const color = CAST_COLOR.STORMCALLER;
  // Busy screen: only the main target gets the sky strike, no chain arcs afterwards.
  const points = c.reduced ? [c.to] : [c.to, ...c.chainTargets];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  points.forEach((p, i) => {
    // Each strike lands a beat after the previous one, down the chain.
    const t = span(c.ageMs, i * 55, i * 55 + Math.min(420, c.totalMs - i * 55));
    if (t <= 0 || t >= 1) return;
    const strike = 1 - t;
    const sky = { x: p.x + (c.seeds[i]! - 0.5) * 30, y: p.y - 170 };
    if (t < 0.55) {
      ctx.strokeStyle = rgba(color, 0.4 * strike);
      ctx.lineWidth = 10 * strike;
      jagged(ctx, sky, p, 16);
      ctx.strokeStyle = `rgba(246,240,255,${strike})`;
      ctx.lineWidth = 2.2 * strike + 0.6;
      jagged(ctx, sky, p, 12);
    }
    // Electric impact ring + crackle sparks on the ground.
    const rr = 6 + easeOut(t) * 26;
    ctx.strokeStyle = rgba(color, 0.85 * strike);
    ctx.lineWidth = 2.4 * strike + 0.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rr, rr * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(236,212,255,${0.9 * strike})`;
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * rr;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Lingering arcs flickering along the chain after the main bolt.
  const linger = 1 - span(c.ageMs, 200, c.totalMs);
  if (!c.reduced && linger > 0 && points.length > 1 && Math.random() < 0.6) {
    ctx.strokeStyle = rgba(color, 0.7 * linger);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < points.length - 1; i++) jagged(ctx, points[i]!, points[i + 1]!, 9);
  }
  ctx.restore();
}
