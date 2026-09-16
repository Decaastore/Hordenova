import { drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Ilhas Flutuantes (waves 171-190) — an entirely aerial roster; every
 * creature here (including the mini/main boss) uses the flightLift +
 * drawFlightShadow treatment from helpers.ts. FASE 2: three genuinely
 * different flier body plans — Cloudfang (slender four-limbed feline-
 * reptile with dragon-style back wings and a whip tail), Sky Manta (a
 * single flat ray-body, no head silhouette at all), Storm Talon (bird
 * skeleton: taloned legs hanging below, a hooked beak, real feather-fringe
 * trailing the wing edge) — distinguishable in silhouette alone.
 */

// Cloudfang — sleek feline-reptilian flier: tucked limbs, a whip tail, a
// fanged head, dragon-style membrane wings sprouting from the shoulders.
const drawCloudfang: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 1.3, 7, 1500);
  drawFlightShadow(ctx, lift, 7, 9, 3.6);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 150);

  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = materialFill(ctx, "HIDE", 0, -1, 9, -5 - flap * 4, theme.accent, theme.body, theme.dark);
    ctx.globalAlpha = 0.92;
    polygonPath(ctx, [
      [0, -1],
      [9, -5 - flap * 4],
      [7, 0 - flap],
      [3, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(9, -5 - flap * 4);
    ctx.stroke();
    ctx.restore();
  }

  // tucked forelimbs
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(1, 1.5);
  ctx.lineTo(-1, 4);
  ctx.moveTo(-4, 1.5);
  ctx.lineTo(-5, 4);
  ctx.stroke();

  // slender body
  ctx.fillStyle = materialFill(ctx, "HIDE", -9, -2, 4, 3, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [-9, 0],
    [-2, -2],
    [4, -1],
    [3, 2],
    [-6, 3],
  ]);
  ctx.fill();

  // whip tail
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, 1);
  ctx.quadraticCurveTo(-13, 2 + flap * 2, -16, -1 + idleSway(timeMs, 0, 700, 1.6));
  ctx.stroke();

  // fanged head
  ctx.fillStyle = materialFill(ctx, "HIDE", 4, -2, 8, 1.5, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [4, -2],
    [8, -1.5],
    [7, 1],
    [3, 1.5],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [7, 0.4],
    [9, 1.2],
    [7, 1.6],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, -1, 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Sky Manta — a single broad flat ray-body, no head silhouette, undulating
// like it's riding the high air currents.
const drawSkyManta: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 2.7, 5, 2400);
  drawFlightShadow(ctx, lift, 5, 13, 5);
  ctx.save();
  ctx.translate(0, -lift);
  const undulate = Math.sin(timeMs / 500);
  const bodyGrad = materialFill(ctx, "HIDE", -14, -2, 14, 3, theme.dark, theme.body, theme.dark);
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
  // subtle sheen band along the leading edge — smooth rubbery skin, not chitin.
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // two small spiracle vents (no head, no eyes — reinforces the "no head silhouette" read)
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(-4, 0.5, 0.7, 0, Math.PI * 2);
  ctx.arc(4, 0.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(-2, 8, 1, 13 + undulate * 2);
  ctx.stroke();
  ctx.restore();
};

// Storm Talon — a true bird skeleton: taloned legs hanging below in
// flight, a hooked beak head, feather-fringe trailing the wing's edge,
// crackling with static.
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
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(9, -4 - flap * 5);
    ctx.stroke();
    ctx.fillStyle = materialFill(ctx, "HIDE", 1, 0, 9, -4 - flap * 5, theme.accent, theme.dark, theme.dark);
    ctx.globalAlpha = 0.85;
    polygonPath(ctx, [
      [1, 0],
      [9, -4 - flap * 5],
      [5, -1 - flap * 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    // feather-fringe along the trailing edge — short notched triangles.
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const fx = 1 + (9 - 1) * t;
      const fy = (-4 - flap * 5) * t;
      ctx.fillStyle = theme.dark;
      polygonPath(ctx, [
        [fx, fy],
        [fx - 1.4, fy + 2.2],
        [fx + 0.6, fy + 1.4],
      ]);
      ctx.fill();
    }
    ctx.restore();
  }

  // dangling taloned legs.
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 0.9;
  for (const s of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 1.5, 1);
    ctx.lineTo(s * 2, 4 + Math.abs(flap));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 2, 4 + Math.abs(flap));
    ctx.lineTo(s * 1.2, 5.5 + Math.abs(flap));
    ctx.lineTo(s * 3, 5.5 + Math.abs(flap));
    ctx.stroke();
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
  // hooked beak
  ctx.fillStyle = theme.accent;
  polygonPath(ctx, [
    [5, -0.5],
    [9, 0.2],
    [7.5, 1.4],
    [4, 1.5],
  ]);
  ctx.fill();
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
// wings, overlapping diamond scutes down the spine, a real horned head
// with jaw and glowing eye. Fully aerial. The main boss adds a fourth
// wing pair and a pair of curling horns — a genuinely larger anatomy.
const drawAetherDrake: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.6;
  const maxLift = isMain ? 16 : 11;
  const lift = flightLift(timeMs, 0.4, maxLift, enraged ? 900 : 1700);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const wingPairs = isMain ? 4 : 2;

  drawFlightShadow(ctx, lift, maxLift, 20 * scale, 8 * scale);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.scale(scale, scale);
  const flap = Math.sin(timeMs / (enraged ? 110 : 170));

  for (let i = 0; i < wingPairs; i++) {
    const along = -8 + i * (16 / Math.max(1, wingPairs - 1));
    for (const side of [1, -1] as const) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.translate(along, 0);
      const wingGrad = materialFill(ctx, "HIDE", 0, 0, 13, -7 - flap * 6, "#4a4658", "#2c2a38", color);
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

  // serpentine segmented body with overlapping diamond scutes.
  const bodyGrad = materialFill(ctx, "CHITIN", -17, -3, 15, 3, "#5a5668", "#3a3648", "#1c1a24");
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
  for (let i = 0; i < 5; i++) {
    const sx = -12 + i * 5.5;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    polygonPath(ctx, [
      [sx, -3],
      [sx + 2.2, -1.2],
      [sx, 0.6],
      [sx - 2.2, -1.2],
    ]);
    ctx.fill();
  }
  drawEnergyCrack(ctx, -4, -1, 0, -4, 4, -1, color, 0.5 + damageIntensity * 0.45 + (enraged ? 0.2 : 0));

  // horned head with hinged jaw.
  ctx.fillStyle = materialFill(ctx, "CHITIN", 12, -3, 21, 3, "#5a5668", "#242030", "#1c1a24");
  polygonPath(ctx, [
    [13, -2],
    [20, -1],
    [18, 2],
    [12, 2.5],
  ]);
  ctx.fill();
  ctx.fillStyle = "#1a1822";
  polygonPath(ctx, [
    [17, 1.5],
    [22, 2.6],
    [17, 3.4],
  ]);
  ctx.fill();
  glowBlob(ctx, 17, 0, isMain ? 3.4 : 2.4, color);

  // horn(s)
  ctx.fillStyle = "#c8c0d8";
  polygonPath(ctx, [
    [14, -2.4],
    [15.4, -6],
    [16, -2],
  ]);
  ctx.fill();

  if (isMain) {
    // Main-boss-only: a second curling horn plus a tail-fin flourish — a genuinely bigger anatomy, not a scaled copy.
    ctx.fillStyle = "#c8c0d8";
    polygonPath(ctx, [
      [17, -2.6],
      [19, -5.6],
      [19, -2],
    ]);
    ctx.fill();
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
