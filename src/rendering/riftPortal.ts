import type { Vector2 } from "@/utils/geometry";
import type { BiomeDefinition } from "./biomes";

/**
 * The enemies' entry point: a rift torn open in the ground right where the
 * road begins. Creatures don't walk in from off-screen past it any more —
 * each one climbs out of the rift (see `emergenceProgress`), with a burst of
 * sparks and dust the moment it appears. The crater and its ring of runed
 * standing stones are baked into the biome's ground where a bake exists;
 * this file draws everything that moves: the swirling void, the light
 * rising out of it, orbiting debris, crackling arcs and the spawn bursts.
 */

/** How far along the road (world units) the rift's centre sits. Enemies covering this first stretch are shown climbing out of it. */
export const PORTAL_PATH_DISTANCE = 26;
const RX = 26;
const RY = 18;

/** 0..1 — how far an enemy has climbed out of the rift (1 = fully out and walking). */
export function emergenceProgress(distanceTraveled: number): number {
  return Math.max(0, Math.min(1, distanceTraveled / PORTAL_PATH_DISTANCE));
}

const burstStarts = new Map<string, number>();
const BURST_MS = 900;

function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param emerging ids of enemies currently climbing out (progress < 1); a new id triggers one spawn burst.
 * @param rimBaked true when the crater rim/standing stones are already in the baked ground.
 */
export function drawRiftPortal(
  ctx: CanvasRenderingContext2D,
  pos: Vector2,
  biome: BiomeDefinition,
  timeMs: number,
  emerging: readonly string[],
  rimBaked: boolean,
): void {
  for (const id of emerging) if (!burstStarts.has(id)) burstStarts.set(id, timeMs);
  for (const [id, t0] of burstStarts) if (timeMs - t0 > BURST_MS * 4) burstStarts.delete(id);
  let activity = 0;
  for (const t0 of burstStarts.values()) {
    const k = (timeMs - t0) / BURST_MS;
    if (k >= 0 && k < 1) activity = Math.max(activity, 1 - k);
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);

  if (!rimBaked) drawRim(ctx, biome);

  // --- The void itself: dark, deep, with swirling arms of energy. ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.clip();
  const deep = ctx.createRadialGradient(0, 0, 0, 0, 0, RX);
  deep.addColorStop(0, "#05020a");
  deep.addColorStop(0.65, "#1a0830");
  deep.addColorStop(1, "#4a1a78");
  ctx.fillStyle = deep;
  ctx.fillRect(-RX, -RY, RX * 2, RY * 2);
  ctx.globalCompositeOperation = "lighter";
  const spin = timeMs / 1600 + activity * 0.8;
  for (let arm = 0; arm < 4; arm++) {
    const base = spin + (arm * Math.PI) / 2;
    for (const [w, a] of [
      [5, 0.12],
      [2.2, 0.35],
      [0.8, 0.7],
    ] as const) {
      ctx.strokeStyle = `rgba(${arm % 2 ? 200 : 170},${arm % 2 ? 110 : 80},255,${a * (0.75 + 0.5 * activity)})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const f = k / 24;
        const ang = base + f * 3.4;
        const r = 2 + f * (RX - 2);
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r * (RY / RX);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // Bright heart deep inside, flaring when something comes through.
  const heart = ctx.createRadialGradient(0, 0, 0, 0, 0, 9 + activity * 6);
  heart.addColorStop(0, `rgba(255,230,255,${0.55 + 0.4 * activity})`);
  heart.addColorStop(1, "rgba(190,90,255,0)");
  ctx.fillStyle = heart;
  ctx.fillRect(-RX, -RY, RX * 2, RY * 2);
  ctx.restore();

  // Inner lip catching the light from below.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(200,120,255,${0.45 + 0.3 * Math.sin(timeMs / 900) * 0.5 + activity * 0.3})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0.6, RX - 0.5, RY - 0.4, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();

  // Light rising out of the rift: a soft, wavering column.
  const colH = 46 + activity * 26;
  const col = ctx.createLinearGradient(0, 0, 0, -colH);
  col.addColorStop(0, `rgba(190,110,255,${0.22 + 0.25 * activity})`);
  col.addColorStop(1, "rgba(190,110,255,0)");
  ctx.fillStyle = col;
  const sway = Math.sin(timeMs / 700) * 2;
  ctx.beginPath();
  ctx.moveTo(-RX * 0.7, 0);
  ctx.quadraticCurveTo(-RX * 0.45 + sway, -colH * 0.5, -RX * 0.2 + sway * 1.5, -colH);
  ctx.lineTo(RX * 0.2 + sway * 1.5, -colH);
  ctx.quadraticCurveTo(RX * 0.45 + sway, -colH * 0.5, RX * 0.7, 0);
  ctx.closePath();
  ctx.fill();

  // Crackling arcs jumping from the void to the rim now and then.
  for (let i = 0; i < 2; i++) {
    const slot = Math.floor(timeMs / 380) + i * 7;
    if (rnd(slot) > 0.45 + activity * 0.4) continue;
    const ang = rnd(slot + 1) * Math.PI * 2;
    ctx.strokeStyle = `rgba(235,200,255,${0.5 + 0.4 * rnd(slot + 2)})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      const j = (rnd(slot * 3 + k) - 0.5) * 5;
      ctx.lineTo(Math.cos(ang) * RX * f + j, Math.sin(ang) * RY * f + j * 0.6);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Debris torn loose, orbiting and bobbing above the rift.
  for (let i = 0; i < 7; i++) {
    const a = timeMs / (2600 + i * 310) + i * 0.9;
    const r = RX * (0.6 + 0.45 * rnd(i));
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * (RY / RX) - 6 - 5 * rnd(i + 9) - Math.sin(timeMs / 800 + i) * 2;
    const s = 1.2 + rnd(i + 3) * 1.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(timeMs / (900 + i * 100) + i);
    ctx.fillStyle = "#2a2430";
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.5);
    ctx.lineTo(s * 0.2, -s);
    ctx.lineTo(s, s * 0.3);
    ctx.lineTo(-s * 0.3, s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(200,140,255,0.65)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
  }

  // Spawn bursts: sparks thrown out and dust kicked up as a creature climbs out.
  for (const [id, t0] of burstStarts) {
    const k = (timeMs - t0) / BURST_MS;
    if (k < 0 || k >= 1) continue;
    const seed = id.length * 31 + (id.charCodeAt(id.length - 1) || 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) {
      const ang = rnd(seed + i) * Math.PI * 2;
      const sp = 18 + rnd(seed + i + 40) * 22;
      const d = sp * k;
      const x = Math.cos(ang) * d;
      const y = Math.sin(ang) * d * 0.7 - 10 * Math.sin(k * Math.PI) * rnd(seed + i + 80);
      ctx.fillStyle = `rgba(225,170,255,${(1 - k) * 0.9})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.9 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const ang = rnd(seed + i + 120) * Math.PI * 2;
      const d = RX * (0.8 + k * 0.6);
      const x = Math.cos(ang) * d;
      const y = Math.sin(ang) * d * (RY / RX);
      const r = 3 + k * 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(120,105,120,${0.3 * (1 - k)})`);
      g.addColorStop(1, "rgba(120,105,120,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Fallback rim for biomes without a baked ground: broken stone lip + a few standing stones. */
function drawRim(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 1.5, RX + 6, RY + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * (RX + 2.5);
    const y = Math.sin(a) * (RY + 2);
    ctx.fillStyle = i % 3 ? p.rockDark : p.rock;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + rnd(i) * 1.5, 2 + rnd(i + 5), a, 0, Math.PI * 2);
    ctx.fill();
  }
}
