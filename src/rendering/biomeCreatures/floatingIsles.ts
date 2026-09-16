import { drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Ilhas Flutuantes (waves 171-190) — an entirely aerial roster; every
 * creature here (including the mini/main boss) uses the flightLift +
 * drawFlightShadow treatment from helpers.ts. Distinct silhouettes: a
 * sleek feline-reptile striker, a broad flat glider, a narrow-bodied
 * storm-bird, and a multi-winged serpentine drake for the boss role.
 */

// Cloudfang — sleek feline-reptilian flier, narrow body, fanged head, long tail.
const drawCloudfang: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 1.3, 7, 1500);
  drawFlightShadow(ctx, lift, 7, 9, 3.6);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 150);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    const wingGrad = ctx.createLinearGradient(0, 0, 10, -4 - flap * 4);
    wingGrad.addColorStop(0, theme.body);
    wingGrad.addColorStop(1, theme.dark);
    ctx.fillStyle = wingGrad;
    polygonPath(ctx, [
      [0, -1],
      [9, -5 - flap * 4],
      [7, 0 - flap],
      [3, 2],
    ]);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = theme.body;
  polygonPath(ctx, [
    [-9, 0],
    [-2, -2],
    [4, -1],
    [3, 2],
    [-6, 3],
  ]);
  ctx.fill();
  // tail
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, 1);
  ctx.quadraticCurveTo(-13, 2 + flap * 2, -15, -1);
  ctx.stroke();
  // fanged head
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [4, -2],
    [8, -1.5],
    [7, 1],
    [3, 1.5],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, -1, 0.7, 0, Math.PI * 2);
  ctx.fill();
};

// Sky Manta — broad, flat manta-like glider with a long tail streamer.
const drawSkyManta: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 2.7, 5, 2400);
  drawFlightShadow(ctx, lift, 5, 13, 5);
  ctx.save();
  ctx.translate(0, -lift);
  const undulate = Math.sin(timeMs / 500);
  const bodyGrad = ctx.createLinearGradient(-14, 0, 14, 0);
  bodyGrad.addColorStop(0, theme.dark);
  bodyGrad.addColorStop(0.5, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -2],
    [14, -1 + undulate * 3],
    [8, 3],
    [0, 2],
    [-8, 3],
    [-14, -1 - undulate * 3],
  ]);
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(-2, 8, 1, 13 + undulate * 2);
  ctx.stroke();
  ctx.restore();
};

// Storm Talon — narrow predatory sky-bird crackling with static discharge.
const drawStormTalon: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 5.5, 8, 1400);
  drawFlightShadow(ctx, lift, 8, 8, 3.4);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 130);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.strokeStyle = theme.body;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(9, -4 - flap * 5);
    ctx.stroke();
    ctx.fillStyle = theme.dark;
    ctx.globalAlpha = 0.8;
    polygonPath(ctx, [
      [1, 0],
      [9, -4 - flap * 5],
      [5, -1 - flap * 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-7, 0],
    [-1, -2],
    [5, -0.5],
    [3, 2],
    [-5, 2.5],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.body;
  polygonPath(ctx, [
    [5, -0.5],
    [9, -0.2],
    [8, 1.2],
    [4, 1.5],
  ]);
  ctx.fill();
  // electric static crackle
  if (Math.sin(timeMs / 90) > 0.6) {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.lineTo(0, -3);
    ctx.lineTo(1, -1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

registerEnemyRenderers({
  CLOUDFANG: drawCloudfang,
  SKY_MANTA: drawSkyManta,
  STORM_TALON: drawStormTalon,
});

// Aether Drake — a serpentine sky-drake with THREE pairs of membranous
// wings (the multi-wing silhouette the biome calls for), fully aerial.
const drawAetherDrake: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.6;
  const maxLift = isMain ? 16 : 11;
  const lift = flightLift(timeMs, 0.4, maxLift, enraged ? 900 : 1700);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const wingPairs = isMain ? 3 : 2;

  drawFlightShadow(ctx, lift, maxLift, 20 * scale, 8 * scale);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.scale(scale, scale);
  const flap = Math.sin(timeMs / (enraged ? 110 : 170));

  for (let i = 0; i < wingPairs; i++) {
    const along = -6 + i * 7;
    for (const side of [1, -1] as const) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.translate(along, 0);
      const wingGrad = ctx.createLinearGradient(0, 0, 14, -6 - flap * 6);
      wingGrad.addColorStop(0, "#2c2a38");
      wingGrad.addColorStop(1, color);
      ctx.fillStyle = wingGrad;
      ctx.globalAlpha = 0.88;
      polygonPath(ctx, [
        [0, 0],
        [13, -7 - flap * 6],
        [10, -1 - flap * 2],
        [4, 2],
      ]);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // serpentine segmented body
  const bodyGrad = ctx.createLinearGradient(-16, 0, 16, 0);
  bodyGrad.addColorStop(0, "#1c1a24");
  bodyGrad.addColorStop(0.5, "#3a3648");
  bodyGrad.addColorStop(1, "#1c1a24");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-17, 1],
    [-8, -3],
    [6, -3],
    [15, 0],
    [10, 3],
    [-6, 3.5],
  ]);
  ctx.fill();
  drawEnergyCrack(ctx, -4, -1, 0, -4, 4, -1, color, 0.5 + damageIntensity * 0.45 + (enraged ? 0.2 : 0));

  // head with glowing eye
  ctx.fillStyle = "#242030";
  polygonPath(ctx, [
    [13, -2],
    [20, -1],
    [18, 2],
    [12, 2.5],
  ]);
  ctx.fill();
  glowBlob(ctx, 17, 0, isMain ? 3.4 : 2.4, color);

  if (isMain) {
    // Main-boss-only tail-fin flourish.
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    polygonPath(ctx, [
      [-17, 1],
      [-24, -3],
      [-21, 2],
      [-24, 5],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

registerBossCreature(["aether-drake", "aether-drake-elder"], drawAetherDrake);
