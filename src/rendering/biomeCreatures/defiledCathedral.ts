import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { breathe, drawEye, drawFlightShadow, flightLift, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Catedral Profanada (waves 291-310) — an enormous destroyed gothic
 * cathedral taken by supernatural forces. Cathedral Abomination is
 * explicitly NOT "just a giant humanoid": its silhouette fuses broken
 * architectural elements (a jagged arch-shaped torso, column-like limbs)
 * with flesh and armor, asymmetric rather than a mirrored humanoid body.
 * FASE 2: Grave Knight's armor (METAL) and exposed flesh (HIDE) are two
 * distinct materials on the same body; Gargoyle Beast fuses STONE wings
 * with a HIDE underbelly.
 */

// Grave Knight — a monstrous, NON-human-proportioned figure in ancient
// armor: elongated limbs, a hunched oversized torso, a small sunken head.
const GRAVE_KNIGHT_STRIDE = 13;
const drawGraveKnight: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, GRAVE_KNIGHT_STRIDE);
  const stride = gaitSwing(stridePhase, speedRatio, 1);
  drawContactShadow(ctx, 9, 4, 0.36);

  const legGradL = materialFill(ctx, "METAL", -3, 1, -5 - stride * 3, 11, "#8a8290", theme.body, theme.dark);
  limbSegment(ctx, -3, 1, -5 - stride * 3, 11, 1.6, 1.2, legGradL);
  const legGradR = materialFill(ctx, "METAL", 3, 1, 5 + stride * 3, 11, "#8a8290", theme.body, theme.dark);
  limbSegment(ctx, 3, 1, 5 + stride * 3, 11, 1.6, 1.2, legGradR);

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1300, 0.012));
  const bodyGrad = materialFill(ctx, "METAL", -9, -12, 9, 2, "#8a8290", theme.body, theme.dark);
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

  // exposed flesh at the joints — a second material on the same body.
  ctx.fillStyle = materialFill(ctx, "HIDE", -2, -4, 2, 0, theme.accent, theme.dark, theme.dark);
  polygonPath(ctx, [
    [-2, -4],
    [2, -4],
    [1.6, 0],
    [-1.6, 0],
  ]);
  ctx.fill();

  // one long, elongated flesh arm dragging low.
  const armGrad = materialFill(ctx, "HIDE", 7, -6, 13 + Math.sin(timeMs / 300) * 2, 6, theme.accent, theme.dark, theme.dark);
  limbSegment(ctx, 7, -6, 13 + Math.sin(timeMs / 300) * 2, 6, 1.6, 1, armGrad);

  ctx.fillStyle = materialFill(ctx, "METAL", -3, -15, 3, -11, "#8a8290", theme.body, theme.dark);
  ctx.beginPath();
  ctx.arc(0, -13, 2.6, 0, Math.PI * 2);
  ctx.fill();
  drawEye(ctx, 0.8, -13, 0.6, theme.accent, true);
  ctx.restore();
};

// Gargoyle Beast — quadruped fusion of stone and flesh: STONE folded
// wings on the back, a HIDE underbelly, volumetric legs.
const GARGOYLE_BEAST_STRIDE = 15;
const drawGargoyleBeast: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lumberPhase = gaitPhase(locomotion?.distance ?? 0, GARGOYLE_BEAST_STRIDE);
  const lumber = gaitSwing(lumberPhase, speedRatio, 1);
  drawContactShadow(ctx, 11, 5, 0.38);

  for (const [lx, sign] of [
    [-6, 1],
    [6, -1],
  ] as const) {
    const kneeX = lx + lumber * sign * 1;
    const kneeY = 4.5;
    const footX = lx + lumber * sign * 2;
    const footY = 8;
    const legGrad = materialFill(ctx, "STONE", lx, 2, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, lx, 2, kneeX, kneeY, 2, 1.6, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.6, 1.8, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 1.2, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1200, 0.018));
  const bodyGrad = materialFill(ctx, "HIDE", -10, -6, 11, 4, theme.accent, theme.body, theme.dark);
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

  for (const s of [1, -1] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", s * 1, -10, s * 7, -3, "#8a8890", theme.dark, theme.dark);
    polygonPath(ctx, [
      [s * 1, -6],
      [s * 7, -10],
      [s * 6, -4],
      [s * 1, -3],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [15, -1],
    [13, 2],
    [8, 1.5],
  ]);
  ctx.fill();
  drawEye(ctx, 12, -0.5, 0.6, theme.accent, false);
  ctx.restore();
};

// Bell Wraith — a floating mist-wrapped entity, bell-shaped body, no limbs.
const drawBellWraith: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 9.4, 4, 2400);
  drawFlightShadow(ctx, lift, 4, 8, 3);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.globalAlpha = 0.75;
  const bellGrad = materialFill(ctx, "METAL", 0, -8, 0, 4, "#c8c4d8", theme.body, theme.dark);
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
 * a gothic window frame), one column-like rigid limb (STONE) and one
 * fleshy clawed limb (HIDE), a cracked rose-window "eye" instead of a
 * head. Explicitly NOT a mirrored humanoid silhouette. The main boss adds
 * a broken flying buttress AND a second armored spire on the opposite
 * shoulder — real architectural growth, not a bigger copy.
 */
// FASE 3: the rigid stone column-limb plants/lifts in a real step cycle
// synced to distance (it does not just stand fixed while the body glides),
// and the fleshy claw's reach is likewise distance-driven instead of a
// pure wall-clock twitch.
const drawCathedralAbomination: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stepPhase = gaitPhase(locomotion?.distance ?? 0, isMain ? 19 : 13);
  const columnStep = gaitSwing(stepPhase, speedRatio, 1.3);
  const twitch = gaitSwing(stepPhase, speedRatio, 1.4, 1.6) + (enraged ? Math.sin(timeMs / 200) * 0.4 * speedRatio : 0);

  drawContactShadow(ctx, 18 * scale, 8 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -Math.abs(columnStep) * 0.4);

  ctx.fillStyle = materialFill(ctx, "STONE", -12, -2, -5, 13, "#6a6470", "#3a3440", "#161418");
  polygonPath(ctx, [
    [-11 + columnStep, -2],
    [-6 + columnStep, -3],
    [-5, 13],
    [-12, 13],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) ctx.strokeRect(-11, 0 + i * 4, 6, 3.4);

  const clawGrad = materialFill(ctx, "HIDE", 7, -1, 12 + twitch, 12, "#7a3a4a", "#3a2c34", "#160f13");
  limbSegment(ctx, 7, -1, 12 + twitch, 12, 2.2, 1.6, clawGrad);
  ctx.fillStyle = "#241a20";
  for (const cx of [-2, 0, 2]) {
    polygonPath(ctx, [
      [12 + twitch + cx - 1, 12],
      [12 + twitch + cx + 1, 12],
      [12 + twitch + cx, 16],
    ]);
    ctx.fill();
  }

  const bodyGrad = materialFill(ctx, "STONE", -9, -20, 9, 4, "#5a5460", "#241f28", "#100d10");
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

  ctx.fillStyle = materialFill(ctx, "METAL", -8, -12, -2, -5, "#c8c4d8", "#5a5460", "#241f28");
  polygonPath(ctx, [
    [-8, -10],
    [-2, -12],
    [-3, -6],
    [-8, -5],
  ]);
  ctx.fill();

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
    ctx.fillStyle = materialFill(ctx, "STONE", -16, -8, -9, 2, "#5a5460", "#241f28", "#100d10");
    polygonPath(ctx, [
      [-9, -8],
      [-16, -2],
      [-14, 2],
      [-9, -3],
    ]);
    ctx.fill();
    ctx.fillStyle = materialFill(ctx, "METAL", 4, -18, 9, -10, "#c8c4d8", "#5a5460", "#241f28");
    polygonPath(ctx, [
      [4, -14],
      [7, -19],
      [9, -12],
      [5, -10],
    ]);
    ctx.fill();
  }
  ctx.restore();
};

registerBossCreature(["cathedral-abomination", "cathedral-abomination-apex"], drawCathedralAbomination);
