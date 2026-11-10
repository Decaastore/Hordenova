import type { CityBuildingId } from "@/config/city";
import type { CityPlot } from "@/data/cityPlots";
import { castleDressingFor } from "./castleSprites";
import { drawEmbers, drawFire, drawSmokeColumn, n01 } from "./fireFx";

/**
 * O CASTELO VIRA CIDADE — draws the city that grows behind the castle walls
 * (config/city.ts, data/cityPlots.ts). Each building is a 3D model rendered
 * offline in the castle's own style, per biome look, intact and burnt
 * (public/sprites/city/<dressing>_<building>_<state>.webp). What moves —
 * chimney smoke, the forge and crystal glow, flames on a burning building,
 * the rise of a new one — is drawn live on top.
 */

/** World-space size the square image is drawn at (same model-to-world scale as the castle). */
export const CITY_SPRITE_SIZE = 90;
/** Where the plot's ground center sits in the image (fraction, y down) — fixed camera, same for every building. */
const BASE: readonly [number, number] = [0.5, 0.7355];
/** Live-effect anchors (fraction of the image), measured by the baker. */
const ANCHORS: Partial<Record<CityBuildingId, Partial<Record<"smoke" | "forge" | "crystal", readonly [number, number]>>>> = {
  HOUSES: { smoke: [0.3582, 0.4219] },
  SMITHY: { smoke: [0.3948, 0.4216], forge: [0.6293, 0.6836] },
  TAVERN: { smoke: [0.6237, 0.3972] },
  MAGE_TOWER: { crystal: [0.5, 0.0585] },
};
/** Where flames sit on a burning building (fractions) — over its roofline. */
const FIRE_POINTS: readonly (readonly [number, number])[] = [
  [0.42, 0.5],
  [0.58, 0.47],
  [0.5, 0.58],
];
/** How long a newly raised building takes to rise out of the ground (ms). */
const RISE_MS = 1400;

const images = new Map<string, HTMLImageElement>();
const requested = new Set<string>();

function base(): string {
  return (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
}

function getImage(dressing: string, id: CityBuildingId, burnt: boolean): HTMLImageElement | undefined {
  const key = `${dressing}_${id.toLowerCase()}_${burnt ? "burnt" : "intact"}`;
  if (!requested.has(key) && typeof Image !== "undefined") {
    requested.add(key);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => images.set(key, img);
    img.src = `${base()}sprites/city/${key}.webp`;
  }
  return images.get(key);
}

export interface CityDrawState {
  built: ReadonlySet<CityBuildingId>;
  burning: Readonly<Partial<Record<CityBuildingId, number>>>;
  /** Wall-clock time (ms) each building was first seen built this session — drives the rise animation. */
  raisedAt: ReadonlyMap<CityBuildingId, number>;
}

/**
 * Draws the built buildings whose plot is above (`front=false`) or below
 * (`front=true`) the castle's base line, so the castle and the city overlap
 * in the right order.
 */
export function drawCity(
  ctx: CanvasRenderingContext2D,
  biomeId: string,
  plots: readonly CityPlot[],
  castleY: number,
  state: CityDrawState,
  timeMs: number,
  front: boolean,
): void {
  const dressing = castleDressingFor(biomeId);
  const ordered = [...plots].sort((a, b) => a.position.y - b.position.y);
  for (const plot of ordered) {
    if (!state.built.has(plot.id)) continue;
    if (plot.position.y >= castleY !== front) continue;
    const burnt = (state.burning[plot.id] ?? 0) > 0;
    const img = getImage(dressing, plot.id, burnt) ?? (burnt ? getImage(dressing, plot.id, false) : undefined);
    if (!img) continue;
    const size = CITY_SPRITE_SIZE;
    const ox = plot.position.x - size * BASE[0];
    const oy = plot.position.y - size * BASE[1];
    const raisedAt = state.raisedAt.get(plot.id);
    const rise = raisedAt === undefined ? 1 : Math.min(1, (timeMs - raisedAt) / RISE_MS);
    const at = (f: readonly [number, number]) => ({ x: ox + (plot.flip ? 1 - f[0] : f[0]) * size, y: oy + f[1] * size });

    ctx.save();
    if (rise < 1) {
      // grows up out of the ground, with a puff of dust
      const e = 1 - Math.pow(1 - rise, 3);
      ctx.globalAlpha = Math.min(1, rise * 2);
      ctx.translate(plot.position.x, plot.position.y);
      ctx.scale(1, 0.2 + 0.8 * e);
      ctx.translate(-plot.position.x, -plot.position.y);
    }
    if (plot.flip) {
      ctx.translate(plot.position.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-plot.position.x, 0);
    }
    ctx.drawImage(img, ox, oy, size, size);
    ctx.restore();

    if (rise < 1) {
      ctx.save();
      const a = (1 - rise) * 0.5;
      const g = ctx.createRadialGradient(plot.position.x, plot.position.y, 0, plot.position.x, plot.position.y, 34);
      g.addColorStop(0, `rgba(200,180,140,${a})`);
      g.addColorStop(1, "rgba(200,180,140,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(plot.position.x, plot.position.y - 6, 42, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    const seed = plot.position.x * 0.37 + plot.position.y;
    const anchors = ANCHORS[plot.id] ?? {};
    if (burnt) {
      FIRE_POINTS.forEach((f, i) => {
        const p = at(f);
        drawFire(ctx, p.x + (n01(seed + i) - 0.5) * 6, p.y, timeMs + i * 211, 0.55 + n01(seed + i * 7) * 0.25, seed + i);
      });
      const top = at([0.5, 0.42]);
      drawSmokeColumn(ctx, top.x, top.y, timeMs, 0.75, seed);
      drawEmbers(ctx, top.x, top.y + 6, timeMs, 6, seed);
      continue;
    }
    if (anchors.smoke) {
      const p = at(anchors.smoke);
      drawChimneySmoke(ctx, p.x, p.y, timeMs, seed);
    }
    if (anchors.forge) {
      const p = at(anchors.forge);
      glow(ctx, p.x, p.y, 9 + Math.sin(timeMs / 140 + seed) * 1.5, "255,130,40", 0.45 + 0.15 * Math.sin(timeMs / 90 + seed));
    }
    if (anchors.crystal) {
      const p = at(anchors.crystal);
      glow(ctx, p.x, p.y + Math.sin(timeMs / 700) * 1.5, 11, "200,170,255", 0.35 + 0.15 * Math.sin(timeMs / 500));
    }
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A thin, pale wisp from a chimney — calmer than the dark smoke of a fire. */
function drawChimneySmoke(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, seed: number): void {
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cycle = (timeMs / 4200 + i / 5 + n01(seed + i) * 0.05) % 1;
    const px = x + cycle * cycle * 12 + Math.sin(timeMs / 1500 + i) * 1.5;
    const py = y - cycle * 26;
    const r = 1.6 + cycle * 5;
    const a = Math.sin(cycle * Math.PI) * 0.28;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(215,212,205,${a})`);
    g.addColorStop(1, "rgba(215,212,205,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
