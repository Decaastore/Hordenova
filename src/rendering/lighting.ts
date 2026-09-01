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

export { LIGHT_DIRECTION };
