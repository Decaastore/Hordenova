import { LIGHT_DIRECTION } from "./theme";

/**
 * Shared Visual Design System primitives (see theme.ts LIGHT_DIRECTION).
 * Every premium-tier entity draw function should build its shading from
 * these instead of inventing its own ad-hoc gradient angles, so a light
 * flip or contact-shadow tweak stays consistent across every element that
 * opts in. Currently consumed by the Ironwood tower + Crawler enemy (the
 * Etapa 4 visual proof); intended to be reused as the rest of the roster
 * is upgraded later.
 */

// Contact shadow is cast opposite the light: down-right.
const SHADOW_OFFSET = { x: -LIGHT_DIRECTION.x * 4, y: -LIGHT_DIRECTION.y * 3.2 };

/** A soft, layered ground-contact shadow — reads as "this sits on the ground", not "floats". */
export function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  radiusX: number,
  radiusY: number,
  opacity = 0.4,
): void {
  ctx.save();
  ctx.translate(SHADOW_OFFSET.x * (radiusX / 16), SHADOW_OFFSET.y * (radiusX / 16));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  gradient.addColorStop(0, `rgba(15,10,5,${opacity})`);
  gradient.addColorStop(0.7, `rgba(15,10,5,${opacity * 0.55})`);
  gradient.addColorStop(1, "rgba(15,10,5,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * White-hot core + colored halo — the shared "magic energy" look (spec:
 * "efeitos mágicos com núcleo branco-quente + halo colorido"). Used for
 * impact bursts, muzzle glow, and can back any future spell VFX.
 */
export function drawMagicCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  haloColor: string,
): void {
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  halo.addColorStop(0, "#ffffff");
  halo.addColorStop(0.25, "#fff6dd");
  halo.addColorStop(0.55, haloColor);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** A thin bright stroke on the light-facing edge of a shape, to read material bevel/roundness. */
export function rimHighlight(
  ctx: CanvasRenderingContext2D,
  drawPath: () => void,
  color: string,
  width: number,
  alpha = 0.55,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  drawPath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Identidade Visual HORDENOVA — CAMADA 1 (Veios de Energia). A single crack
 * running through dark structural material, glowing in the object's own
 * elemental color — the "power contained within the material" read, never a
 * decal on top. Two-pass stroke: a soft 3.2px glow underneath (low alpha, so
 * it reads as light escaping through the crack, not a colored line) plus a
 * tight 0.9px bright core on top (the crack itself). `mx,my` bends the crack
 * through a midpoint so it reads as a jagged fissure, not a straight scratch.
 * `intensity` (0..~1.6) lets callers tie brightness to level/attack state
 * without duplicating the draw call.
 */
export function drawEnergyCrack(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  mx: number,
  my: number,
  x2: number,
  y2: number,
  color: string,
  intensity = 1,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = Math.min(1, 0.22 * intensity);
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  ctx.globalAlpha = Math.min(1, 0.85 * intensity);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  ctx.restore();
}

export interface FloatingMoteStyle {
  /** How many motes drift in the field at once. */
  count: number;
  /** Horizontal wander radius (px) around the anchor. */
  spreadX: number;
  /** Vertical travel range (px) — a mote rises/loops through this span before recycling. */
  spreadY: number;
  color: string;
  /** ms for one full rise-and-recycle cycle — lower = faster (e.g. embers/sparks), higher = slower (e.g. spores/snow). */
  periodMs: number;
  /** 0..1 extra high-frequency jitter on top of the base drift — sparks/ash use this, snow/spores stay near 0. */
  flicker?: number;
  /** Base mote radius in px. */
  size?: number;
}

/**
 * Identidade Visual HORDENOVA — CAMADA 4 (Partículas de Energia Flutuante).
 * A small field of luminous motes drifting slowly and continuously around an
 * anchor point (a tower core, the castle keep) — deterministic per-frame
 * from `timeMs` alone (no stored particle state, so it can never leak or
 * desync), differentiated purely by `style` (spread/speed/color/flicker) so
 * the same function serves every biome's "snowflake / ember-ash / spore /
 * spark" behavior without a fork per biome.
 */
export function drawFloatingMotes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  timeMs: number,
  seed: number,
  style: FloatingMoteStyle,
): void {
  const { count, spreadX, spreadY, color, periodMs, flicker = 0, size = 1.3 } = style;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const cycle = ((timeMs / periodMs + i / count) % 1 + 1) % 1;
    const wander = Math.sin(timeMs / 1400 + i * 2.3 + seed) * spreadX * (0.35 + cycle * 0.65);
    const jitter = flicker > 0 ? Math.sin(timeMs / 90 + i * 7 + seed) * flicker * 3 : 0;
    const x = cx + wander + jitter;
    const y = cy + spreadY * 0.5 - cycle * spreadY;
    const alpha = Math.sin(cycle * Math.PI) * (0.55 + flicker * 0.3);
    if (alpha <= 0.02) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, size * (0.7 + (1 - cycle) * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export { LIGHT_DIRECTION };
