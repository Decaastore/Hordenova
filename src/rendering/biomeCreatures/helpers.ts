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
