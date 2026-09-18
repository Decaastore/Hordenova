import { drawContactShadow, rimHighlight } from "../lighting";
import { breathe, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Frozen Tundra's Glacial Sovereign (wave 70).
 * The tallest and most rigid of the six: a crystalline entity with no
 * visible legs at all — its lower body is a jagged skirt of ice shards
 * that it glides on, a deliberately different locomotion silhouette from
 * every walking/stomping boss in this batch. Elongated angular limbs and a
 * crown of ice spikes read as "sovereign", not "big blue Brute" — the
 * silhouette is sharp and vertical where Molten Colossus (this file's
 * sibling in the roster) is wide and squat.
 */
const drawGlacialSovereign: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const glide = Math.sin(timeMs / (enraged ? 380 : 620)) * 0.8 * Math.max(0.25, speedRatio);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));

  drawContactShadow(ctx, 12, 5, 0.4);
  ctx.save();
  ctx.translate(0, -Math.abs(glide) * 0.6);

  // Jagged ice-shard skirt — no legs, the creature glides along the ground.
  const skirtGrad = materialFill(ctx, "CRYSTAL", -10, 4, 10, 16, "#eafcff", "#a8d8e8", "#3a5868");
  ctx.fillStyle = skirtGrad;
  ctx.globalAlpha = 0.92;
  polygonPath(ctx, [[-10, 4], [-6, 15], [-2, 8], [0, 17], [2, 8], [6, 15], [10, 4]]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1700, 0.012));
  ctx.rotate(glide * 0.02);

  // Elongated, thin, angular limbs — longer than any other boss's.
  for (const side of [-1, 1] as const) {
    ctx.strokeStyle = materialFill(ctx, "CRYSTAL", side * 8, -10, side * 14, 6, "#eafcff", "#9ecbdc", "#3a5868");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * 7, -9);
    ctx.lineTo(side * 12 + idleSway(timeMs, side, 2400, 0.9), -1);
    ctx.lineTo(side * 15 + idleSway(timeMs, side, 2400, 0.9), 5);
    ctx.stroke();
  }

  // Torso — translucent crystal facets, narrow and vertical.
  const bodyGrad = materialFill(ctx, "CRYSTAL", -8, -16, 8, 4, "#eafcff", "#bcdcec", "#4a6a7a");
  ctx.fillStyle = bodyGrad;
  ctx.globalAlpha = 0.94;
  polygonPath(ctx, [[0, -18], [7, -12], [8, 0], [4, 4], [-4, 4], [-8, 0], [-7, -12]]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "rgba(30,60,80,0.4)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 4);
  ctx.moveTo(-7, -12);
  ctx.lineTo(-1, -4);
  ctx.moveTo(7, -12);
  ctx.lineTo(1, -4);
  ctx.stroke();

  // Frozen hexagonal core — pale, cold, thin inner glow (frozen, not blazing).
  glowBlob(ctx, 0, -6, (6 + damageIntensity * 3) * (enraged ? 1.2 : 1), color);
  ctx.fillStyle = "#f4fbff";
  polygonPath(ctx, [[0, -9.5], [3, -7.5], [3, -3.5], [0, -1.5], [-3, -3.5], [-3, -7.5]]);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5 + 0.3 * pulse;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Crown of ice spikes on the shoulders/back — the "sovereign" read.
  for (const [sx, sy, ang, len] of [[-4, -18, -2.4, 8], [4, -18, -0.75, 8], [0, -20, -1.57, 9.5], [-8, -12, -2.8, 5], [8, -12, -0.35, 5]] as const) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    const shardGrad = ctx.createLinearGradient(0, 0, 0, -len);
    shardGrad.addColorStop(0, "#bcdcec");
    shardGrad.addColorStop(1, "#ffffff");
    ctx.fillStyle = shardGrad;
    ctx.globalAlpha = 0.95;
    polygonPath(ctx, [[-1.3, 0], [0, -len], [1.3, 0]]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  rimHighlight(ctx, () => { ctx.moveTo(-7, -12); ctx.lineTo(0, -18); ctx.lineTo(7, -12); }, "#ffffff", 0.9, 0.5 + 0.25 * pulse);

  ctx.restore();
  ctx.restore();

  // Small falling ice-fragment motes — the opposite of a rising-ember field.
  for (let i = 0; i < 5; i++) {
    const t = ((timeMs / 2200 + i / 5) % 1 + 1) % 1;
    const fx = -8 + i * 4 + Math.sin(timeMs / 900 + i) * 1.5;
    const fy = -20 + t * 26;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.5;
    ctx.fillStyle = "#dff4ff";
    ctx.fillRect(fx - 0.4, fy - 0.4, 0.8, 0.8);
  }
  ctx.globalAlpha = 1;
};

registerBossCreature(["glacial-sovereign"], drawGlacialSovereign);
