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
      seeds: Array.from({ length: 24 }, () => Math.random()),
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
      drawRuneCircle(ctx, c, timeMs);
      if (c.reduced) continue;
      if (c.type === "INFERNO") drawScorch(ctx, c, timeMs);
      else if (c.type === "FROSTBORN") drawFrostGround(ctx, c, timeMs);
    }
  }

  /** Over towers/enemies: beams, explosions, nova rings, sky strikes. */
  drawAir(ctx: CanvasRenderingContext2D): void {
    for (const c of this.casts) {
      switch (c.type) {
        case "IRONWOOD":
          drawPiercingShot(ctx, c);
          break;
        case "INFERNO":
          drawFirestorm(ctx, c);
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
// ---------------------------------------------------------------------------

function drawScorch(ctx: CanvasRenderingContext2D, c: ActiveCast, timeMs: number): void {
  const appear = span(c.ageMs, 140, 320);
  const fade = 1 - span(c.ageMs, c.totalMs * 0.45, c.totalMs);
  const alpha = appear * fade * 0.8;
  if (alpha <= 0) return;
  // Smaller than the blast itself — a mark where it landed, not a second blast area.
  const R = c.radius * 0.5;
  ctx.save();
  ctx.translate(c.to.x, c.to.y);
  ctx.scale(1, 0.7);
  const crater = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  crater.addColorStop(0, `rgba(18,6,2,${0.55 * alpha})`);
  crater.addColorStop(0.7, `rgba(40,12,4,${0.35 * alpha})`);
  crater.addColorStop(1, "rgba(40,12,4,0)");
  ctx.fillStyle = crater;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  // Glowing embers smouldering in the crater.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) {
    const a = c.seeds[i]! * Math.PI * 2;
    const d = Math.sqrt(c.seeds[i + 12]!) * R * 0.85;
    const flicker = 0.55 + 0.45 * Math.sin(timeMs / 90 + i * 1.7);
    ctx.fillStyle = rgba(i % 3 === 0 ? "#ffd27a" : "#ff6a2e", 0.8 * alpha * flicker);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.4 + (i % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFirestorm(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const R = c.radius;
  const { x, y } = c.to;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Detonation flash.
  const flash = 1 - span(c.ageMs, 0, 260);
  if (flash > 0) {
    const fr = R * (0.35 + (1 - flash) * 0.4);
    const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
    g.addColorStop(0, `rgba(255,250,230,${0.9 * flash})`);
    g.addColorStop(0.4, `rgba(255,190,90,${0.7 * flash})`);
    g.addColorStop(1, "rgba(255,106,46,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ring of fire sweeping out to the real blast radius.
  const sweep = span(c.ageMs, 0, Math.min(520, c.totalMs));
  if (sweep > 0 && sweep < 1) {
    const rr = easeOut(sweep) * R;
    ctx.strokeStyle = `rgba(255,120,40,${0.75 * (1 - sweep)})`;
    ctx.lineWidth = 10 * (1 - sweep) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,220,140,${0.9 * (1 - sweep)})`;
    ctx.lineWidth = 2.2 * (1 - sweep) + 0.4;
    ctx.stroke();
  }

  // Flame tongues bursting outward.
  const tongues = span(c.ageMs, 30, 520);
  if (!c.reduced && tongues > 0 && tongues < 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + c.seeds[i]! * 0.4;
      const reach = easeOut(tongues) * R * (0.55 + c.seeds[i + 10]! * 0.35);
      const tx = x + Math.cos(a) * reach;
      const ty = y + Math.sin(a) * reach * 0.7;
      // Elongated flame streak pointing outward along its own direction.
      const size = (8 + c.seeds[i]! * 5) * (1 - tongues * 0.7);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(Math.atan2(Math.sin(a) * 0.7, Math.cos(a)));
      ctx.scale(2.4, 0.7);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      g.addColorStop(0, `rgba(255,224,140,${0.9 * (1 - tongues)})`);
      g.addColorStop(0.5, `rgba(255,120,40,${0.6 * (1 - tongues)})`);
      g.addColorStop(1, "rgba(255,90,30,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Embers drifting up from the crater for the rest of its life.
  const drift = span(c.ageMs, 300, c.totalMs);
  if (!c.reduced && drift > 0 && drift < 1) {
    for (let i = 0; i < 5; i++) {
      const local = (drift * 2.2 + c.seeds[i]!) % 1;
      const a = c.seeds[i + 8]! * Math.PI * 2;
      const d = c.seeds[i + 16]! * R * 0.6;
      const ex = x + Math.cos(a) * d + Math.sin(local * 6 + i) * 3;
      const ey = y + Math.sin(a) * d * 0.7 - local * 34;
      ctx.fillStyle = `rgba(255,170,70,${0.8 * (1 - local) * (1 - drift)})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// FROSTBORN — Absolute Zero
// ---------------------------------------------------------------------------

function drawFrostGround(ctx: CanvasRenderingContext2D, c: ActiveCast, timeMs: number): void {
  // ANTI-CLUTTER — no filled disc any more (it covered the tower's whole
  // range for seconds): just a faint frost rim that fades out quickly, a
  // few frost flecks, and the small snowflake sigil at the tower's feet.
  const R = c.radius;
  const reach = easeOut(span(c.ageMs, 0, 420));
  const fade = 1 - span(c.ageMs, 350, c.totalMs);
  if (fade <= 0 || reach <= 0) return;
  const r = R * reach;
  const { x, y } = c.towerPosition;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(170,236,255,${0.35 * fade})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(220,250,255,${0.55 * fade})`;
  for (let i = 0; i < 8; i++) {
    const a = c.seeds[i]! * Math.PI * 2;
    const d = (0.55 + c.seeds[(i + 7) % 24]! * 0.45) * r;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.9 + (i % 3) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x, y + 8);
  ctx.scale(1, 0.55);
  ctx.rotate(timeMs / 2400);
  ctx.strokeStyle = `rgba(190,245,255,${0.7 * fade})`;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  const s = 20 * reach;
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 0.75, -s * 0.2);
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 0.75, s * 0.2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawAbsoluteZero(ctx: CanvasRenderingContext2D, c: ActiveCast): void {
  const R = c.radius;
  const { x, y } = c.towerPosition;
  const sweep = span(c.ageMs, 0, Math.min(420, c.totalMs));
  const fade = 1 - span(c.ageMs, c.totalMs * 0.5, c.totalMs);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // The nova front itself.
  if (sweep < 1) {
    const rr = easeOut(sweep) * R;
    ctx.strokeStyle = `rgba(200,248,255,${0.85 * (1 - sweep)})`;
    ctx.lineWidth = 8 * (1 - sweep) + 1;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${1 - sweep})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();

  // Crown of ice spikes left standing at the edge of the freeze.
  if (fade <= 0 || c.reduced) return;
  ctx.save();
  const spikes = 12;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + c.seeds[i]! * 0.15;
    const grow = easeOut(span(c.ageMs, 300 + c.seeds[i]! * 120, 520 + c.seeds[i]! * 120));
    if (grow <= 0) continue;
    const h = (6 + c.seeds[i]! * 6) * grow * fade;
    const bx = x + Math.cos(a) * R;
    const by = y + Math.sin(a) * R;
    ctx.fillStyle = `rgba(214,248,255,${0.85 * fade})`;
    ctx.strokeStyle = `rgba(120,200,235,${0.8 * fade})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx - 2.6, by);
    ctx.lineTo(bx + 2.6, by);
    ctx.lineTo(bx + (c.seeds[i]! - 0.5) * 3, by - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
