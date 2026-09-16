/**
 * Shared drawing primitives for the 10-biome expansion's bespoke creatures.
 * Kept separate from EntityRenderer.ts's own helpers (which stay private to
 * that file) so every new biome file can reuse the same small toolkit
 * without a dependency on EntityRenderer.ts internals — the point being
 * that this whole content pack (biomeCreatures/) is additive and isolated:
 * it never edits an existing draw* function, only registers new ones.
 */

/** Same recipe as EntityRenderer's private glowBlob — a soft radial falloff used for cores/eyes/energy accents. */
export function glowBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Flying-creature support (10-biome expansion). The core movement model
 * (entities/Enemy.ts advanceEnemy) stays purely 1D distance-along-path — no
 * altitude axis was added there, per the "não alterar o core do jogo sem
 * necessidade" constraint. Instead, "flight" is a pure rendering-layer
 * illusion: a deterministic vertical bob computed from time + a seed (no
 * per-enemy stored state, so it can never desync or leak), combined with a
 * ground contact shadow that shrinks/fades as the bob lifts the body —
 * exactly the "sombra/indicador de posição quando apropriado" requirement.
 */
export function flightLift(timeMs: number, seed: number, amplitude = 7, periodMs = 1900): number {
  return amplitude * (0.5 + 0.5 * Math.sin(timeMs / periodMs + seed));
}

/** Call BEFORE translating up by the lift amount — the shadow always stays pinned to the ground. */
export function drawFlightShadow(
  ctx: CanvasRenderingContext2D,
  lift: number,
  maxLift: number,
  baseRx = 10,
  baseRy = 4,
): void {
  const t = Math.max(0, Math.min(1, lift / maxLift));
  const scale = 1 - t * 0.45;
  const alpha = 0.34 * (1 - t * 0.55);
  ctx.save();
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRx * scale);
  gradient.addColorStop(0, `rgba(10,8,6,${alpha})`);
  gradient.addColorStop(1, "rgba(10,8,6,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, baseRx * scale, baseRy * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A jagged angular polygon path helper — most new creatures use hard mineral/bone/armor edges instead of smooth ellipses. */
export function polygonPath(ctx: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]![0], points[i]![1]);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// FASE 2 — premium creature toolkit. Everything below is additive: existing
// callers (helpers.ts's own exports above, and every FASE 1 draw function)
// keep working unchanged. These exist so 50 creatures can all get real
// volume/material/animation without duplicating the same gradient/joint math
// by hand in every single draw function.
// ---------------------------------------------------------------------------

/**
 * Distinct shading recipes per physical material — the concrete answer to
 * "materiais diferentes precisam parecer diferentes, não usar uma única
 * técnica de shading para tudo". METAL/CRYSTAL get a narrow, high-contrast
 * specular band (glossy); BONE/STONE/CHARRED get a slow matte falloff
 * (porous, dry); CHITIN gets a tight oily sheen near the light edge;
 * HIDE/PLANT get the plainest two-tone falloff (organic, non-reflective).
 * `light`/`base`/`dark` are the caller's own 3 tones (usually derived from
 * that creature's ENEMY_THEME entry), so the biome/creature keeps its own
 * color identity — only the STOPS pattern (how contrast is distributed)
 * changes per material.
 */
export type MaterialKind = "BONE" | "STONE" | "METAL" | "CRYSTAL" | "HIDE" | "CHITIN" | "PLANT" | "CHARRED";

export function materialFill(
  ctx: CanvasRenderingContext2D,
  kind: MaterialKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  light: string,
  base: string,
  dark: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  switch (kind) {
    case "METAL":
    case "CRYSTAL":
      g.addColorStop(0, light);
      g.addColorStop(0.2, base);
      g.addColorStop(0.5, dark);
      g.addColorStop(0.76, base);
      g.addColorStop(1, dark);
      break;
    case "CHITIN":
      g.addColorStop(0, light);
      g.addColorStop(0.16, base);
      g.addColorStop(1, dark);
      break;
    case "BONE":
    case "STONE":
    case "CHARRED":
      g.addColorStop(0, light);
      g.addColorStop(0.55, base);
      g.addColorStop(1, dark);
      break;
    case "HIDE":
    case "PLANT":
    default:
      g.addColorStop(0, base);
      g.addColorStop(1, dark);
      break;
  }
  return g;
}

/**
 * A tapered, volumetric limb SEGMENT (a filled quad, not a stroked line) —
 * the concrete fix for "não desenhar apenas uma forma preenchida" on legs.
 * Chain two of these (thigh then shin, `widthFar` of the first feeding into
 * `widthNear` of the second) for a jointed leg that reads as having real
 * mass instead of a wire skeleton.
 */
export function limbSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  widthNear: number,
  widthFar: number,
  fill: string | CanvasGradient,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.fillStyle = fill;
  polygonPath(ctx, [
    [x0 + nx * widthNear, y0 + ny * widthNear],
    [x1 + nx * widthFar, y1 + ny * widthFar],
    [x1 - nx * widthFar, y1 - ny * widthFar],
    [x0 - nx * widthNear, y0 - ny * widthNear],
  ]);
  ctx.fill();
}

/** A small joint bulge (knee/elbow/shoulder) — hides the seam between two limbSegment calls and reads as an actual articulation. */
export function jointBulge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Subtle idle breathing — a near-1 scale factor. Apply to a whole torso group via ctx.scale so the creature never looks frozen even at a dead stop. */
export function breathe(timeMs: number, seed = 0, period = 1400, amplitude = 0.025): number {
  return 1 + amplitude * Math.sin(timeMs / period + seed);
}

/** Subtle idle body sway — a small x/y-style offset (use on one axis, or both with different periods) for shoulders/head/tail while otherwise stationary. */
export function idleSway(timeMs: number, seed = 0, period = 2200, amplitude = 1.5): number {
  return Math.sin(timeMs / period + seed) * amplitude;
}

/** A small eye: dark socket + iris, with an optional faint glow — deliberately restrained (no "excesso de olhos brilhantes"): most creatures should pass `glow: false` or skip eyes entirely in favor of a more monstrous, eyeless read. */
export function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow = false): void {
  if (glow) glowBlob(ctx, x, y, r * 2.4, color);
  ctx.fillStyle = "#0c0a08";
  ctx.beginPath();
  ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
