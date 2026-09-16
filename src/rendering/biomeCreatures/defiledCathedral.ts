import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Catedral Profanada (waves 291-310) — an enormous destroyed gothic
 * cathedral taken by supernatural forces. Cathedral Abomination is
 * explicitly NOT "just a giant humanoid": its silhouette fuses broken
 * architectural elements (a jagged arch-shaped torso, column-like limbs)
 * with flesh and armor, asymmetric rather than a mirrored humanoid body.
 */

// Grave Knight — a monstrous, NON-human-proportioned figure in ancient
// armor: elongated limbs, a hunched oversized torso, a small sunken head.
const drawGraveKnight: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 9, 4, 0.36);
  const stride = Math.sin(timeMs / 260);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.lineTo(-5 - stride * 3, 11);
  ctx.moveTo(3, 1);
  ctx.lineTo(5 + stride * 3, 11);
  ctx.stroke();
  // oversized hunched torso, disproportionately wide for its short legs
  const bodyGrad = ctx.createLinearGradient(0, -11, 0, 2);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-8, 0],
    [-9, -8],
    [0, -12],
    [9, -8],
    [8, 0],
    [3, 2],
    [-3, 2],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // one long, elongated arm dragging low
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(7, -6);
  ctx.lineTo(13 + Math.sin(timeMs / 300) * 2, 6);
  ctx.stroke();
  // tiny sunken head
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(0, -13, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timeMs / 300);
  ctx.beginPath();
  ctx.arc(0.8, -13, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

// Gargoyle Beast — quadruped fusion of stone and flesh, small folded stone wings.
const drawGargoyleBeast: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 11, 5, 0.38);
  const lumber = Math.sin(timeMs / 320);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  for (const [lx, sign] of [
    [-6, 1],
    [6, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(lx, 2);
    ctx.lineTo(lx + lumber * sign * 2, 8);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -7, 0, 4);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-10, 0],
    [-7, -6],
    [4, -7],
    [11, -1],
    [8, 4],
    [-9, 4],
  ]);
  ctx.fill();
  // folded stone wings on the back
  for (const s of [1, -1] as const) {
    ctx.fillStyle = theme.dark;
    polygonPath(ctx, [
      [s * 1, -6],
      [s * 7, -10],
      [s * 6, -4],
      [s * 1, -3],
    ]);
    ctx.fill();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [15, -1],
    [13, 2],
    [8, 1.5],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(12, -0.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

// Bell Wraith — a floating mist-wrapped entity, bell-shaped body, no limbs.
const drawBellWraith: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 9.4, 4, 2400);
  drawFlightShadow(ctx, lift, 4, 8, 3);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.globalAlpha = 0.75;
  const bellGrad = ctx.createLinearGradient(0, -8, 0, 4);
  bellGrad.addColorStop(0, theme.dark);
  bellGrad.addColorStop(1, theme.body);
  ctx.fillStyle = bellGrad;
  polygonPath(ctx, [
    [0, -8],
    [5, -2],
    [7, 4],
    [-7, 4],
    [-5, -2],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;
  // swaying mist tendrils beneath
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(timeMs / 450 + i * 2) * 2.5;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.ellipse(-3 + i * 3, 6 + i, 2 + i * 0.4, 4, sway * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  glowBlob(ctx, 0, -4, 2.4, theme.accent);
  // bell toll ripple
  if (Math.sin(timeMs / 800) > 0.85) {
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, -2, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

registerEnemyRenderers({
  GRAVE_KNIGHT: drawGraveKnight,
  GARGOYLE_BEAST: drawGargoyleBeast,
  BELL_WRAITH: drawBellWraith,
});

/**
 * Cathedral Abomination — an asymmetric fusion of broken cathedral
 * architecture with flesh and armor: a jagged arch-shaped torso (echoing
 * a gothic window frame), one column-like rigid limb and one fleshy
 * clawed limb, a cracked rose-window "eye" instead of a head. Explicitly
 * NOT a mirrored humanoid silhouette.
 */
const drawCathedralAbomination: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));
  const twitch = Math.sin(timeMs / (enraged ? 200 : 420)) * 1.4;

  drawContactShadow(ctx, 18 * scale, 8 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);

  // Rigid stone column-limb (left) — architecture, not a leg.
  ctx.fillStyle = "#544c56";
  polygonPath(ctx, [
    [-11, -2],
    [-6, -3],
    [-5, 13],
    [-12, 13],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) ctx.strokeRect(-11, 0 + i * 4, 6, 3.4);

  // Fleshy clawed limb (right) — asymmetric counterpart, twitching.
  ctx.strokeStyle = "#3a2c34";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(7, -1);
  ctx.lineTo(12 + twitch, 12);
  ctx.stroke();
  ctx.fillStyle = "#241a20";
  for (const cx of [-2, 0, 2]) {
    polygonPath(ctx, [
      [12 + twitch + cx - 1, 12],
      [12 + twitch + cx + 1, 12],
      [12 + twitch + cx, 16],
    ]);
    ctx.fill();
  }

  // Jagged arch-shaped torso — a gothic window frame come alive, the
  // silhouette's core identity, deliberately not a rounded chest.
  const bodyGrad = ctx.createLinearGradient(0, -20, 0, 4);
  bodyGrad.addColorStop(0, "#463a48");
  bodyGrad.addColorStop(1, "#1a1418");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -20],
    [9, -12],
    [9, 4],
    [4, 6],
    [-4, 6],
    [-9, 4],
    [-9, -12],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  drawEnergyCrack(ctx, -6, -2, -2, -10, 3, -4, color, 0.45 + damageIntensity * 0.4 + (enraged ? 0.2 : 0));

  // Armor plate fragments fused unevenly across the torso.
  ctx.fillStyle = "#5a5058";
  polygonPath(ctx, [
    [-8, -10],
    [-2, -12],
    [-3, -6],
    [-8, -5],
  ]);
  ctx.fill();

  // Cracked rose-window "eye" in place of a head, centered high on the arch.
  glowBlob(ctx, 0, -14, (5 + damageIntensity * 3) * (enraged ? 1.25 : 1), color);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, -14, 3.4, 0, Math.PI * 2);
  ctx.moveTo(0, -17.4);
  ctx.lineTo(0, -10.6);
  ctx.moveTo(-3.4, -14);
  ctx.lineTo(3.4, -14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (isMain) {
    // Main-boss-only: a broken flying buttress jutting from the back — the fuller "apex" ruin silhouette.
    ctx.fillStyle = "#3a323c";
    polygonPath(ctx, [
      [-9, -8],
      [-16, -2],
      [-14, 2],
      [-9, -3],
    ]);
    ctx.fill();
  }
  ctx.restore();
};

registerBossCreature(["cathedral-abomination", "cathedral-abomination-apex"], drawCathedralAbomination);
