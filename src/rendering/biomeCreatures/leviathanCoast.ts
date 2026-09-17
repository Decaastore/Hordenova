import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { breathe, gaitBounce, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Península dos Leviatãs (waves 311-330) — a rocky coast where giant sea
 * creatures died eons ago. Deliberately coastal/leviathan-remains rather
 * than a beach: slick amphibious hides, bioluminescent abyssal accents,
 * bony fin structures. FASE 2: Bonefin mixes HIDE (living fish-flesh) and
 * BONE (exposed skeletal ridge) on the same small body — the concrete
 * "partially bony" read the name promises.
 */

// Tide Ripper — low, muscular amphibious predator, volumetric clawed legs.
// FASE 3: gait phase comes from real distance traveled (see helpers.ts's
// gaitPhase doc comment) instead of wall-clock time, so the legs/tail only
// ever move as fast as the creature is actually displacing on screen — at
// 4x they scuttle visibly faster, and a full Frostborn freeze (speedRatio 0)
// settles it into a planted, non-marching pose instead of running in place.
const TIDE_RIPPER_STRIDE = 13;
const drawTideRipper: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, TIDE_RIPPER_STRIDE);
  const crawl = gaitSwing(phase, speedRatio, 1);
  const bounce = gaitBounce(phase, speedRatio, 0.5);
  drawContactShadow(ctx, 10, 4, 0.34);

  for (const [lx, sign] of [
    [-6, 1],
    [6, -1],
  ] as const) {
    const kneeX = lx + crawl * sign * 1.4;
    const kneeY = 3;
    const footX = lx + crawl * sign * 3;
    const footY = 6.5;
    const legGrad = materialFill(ctx, "HIDE", lx, 0, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, lx, 0, kneeX, kneeY, 1.8, 1.4, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.4, 0.8, theme.dark);
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX - 2, footY + 2);
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + 2, footY + 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, -bounce);
  ctx.scale(1, breathe(timeMs, 0, 900, 0.02));
  const bodyGrad = materialFill(ctx, "HIDE", -10, -4, 11, 3, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-10, 0],
    [-7, -4],
    [6, -4],
    [11, -1],
    [8, 3],
    [-9, 3],
  ]);
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.4 + 0.2 * Math.sin(timeMs / 300);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(4, -2.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Tail fin — lags one stride phase behind the legs (a delayed swing, not
  // an independent sine) so it visibly whips through after the body moves.
  const tailLag = gaitSwing(phase, speedRatio, 1.6, -1.1);
  ctx.save();
  ctx.translate(11.5, -0.5);
  ctx.rotate(tailLag * 0.05);
  ctx.translate(-11.5, 0.5);
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [15, -1.5 + tailLag * 0.4],
    [13, 1.5 + tailLag * 0.4],
    [8, 1],
  ]);
  ctx.fill();
  ctx.restore();
  ctx.restore();
};

// Deepmaw — an abyssal-predator marine creature hauling itself onto land,
// bioluminescent dots along the spine, a huge hinged jaw. FASE 3: both
// flippers pull together (a real amphibious drag-crawl, not an alternating
// walk) — `drag` is the distance-synced version of the same single gait
// value, so the haul-forward motion is exactly as fast as the creature is
// actually moving.
const DEEPMAW_STRIDE = 16;
const drawDeepmaw: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, DEEPMAW_STRIDE);
  const drag = gaitSwing(phase, speedRatio, 1);
  const haulBounce = gaitBounce(phase, speedRatio, 0.7);
  drawContactShadow(ctx, 13, 5.5, 0.42);

  const legGradL = materialFill(ctx, "HIDE", -5, 3, -8 + drag * 2, 9, theme.accent, theme.body, theme.dark);
  limbSegment(ctx, -5, 3, -8 + drag * 2, 9, 2.2, 1.8, legGradL);
  const legGradR = materialFill(ctx, "HIDE", 5, 3, 8 - drag * 2, 9, theme.accent, theme.body, theme.dark);
  limbSegment(ctx, 5, 3, 8 - drag * 2, 9, 2.2, 1.8, legGradR);

  ctx.save();
  ctx.translate(0, -haulBounce);
  ctx.scale(1, breathe(timeMs, 1, 1000, 0.016));
  const bodyGrad = materialFill(ctx, "HIDE", -12, -7, 12, 5, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-12, 1],
    [-9, -6],
    [3, -7],
    [12, -2],
    [10, 4],
    [-10, 5],
  ]);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const x = -7 + i * 4.5;
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(timeMs / 350 + i);
    ctx.beginPath();
    ctx.arc(x, -4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const jawOpen = 1 + Math.max(0, Math.sin(timeMs / 500)) * 2;
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [11, -2],
    [19, 0 + jawOpen],
    [15, 3 + jawOpen],
    [9, 2],
  ]);
  ctx.fill();
  glowBlob(ctx, 14, 0.5 + jawOpen * 0.5, 2.6, theme.accent);
  ctx.restore();
};

// Bonefin — fast, partially bony fish-predator hybrid: living HIDE flesh
// fused with an exposed BONE dorsal ridge — two materials, one small body.
const BONEFIN_STRIDE = 9;
const drawBonefin: EnemyDrawFn = (ctx, theme, _timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, BONEFIN_STRIDE);
  const dash = gaitSwing(phase, speedRatio, 1);
  drawContactShadow(ctx, 8, 3.4, 0.3);

  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 2, 1);
    ctx.lineTo(s * 5 + dash * s, 6);
    ctx.stroke();
  }

  const bodyGrad = materialFill(ctx, "HIDE", -9, -1, 9, 1, theme.dark, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-3, -3],
    [7, -1],
    [10, 0],
    [7, 1],
    [-3, 3],
  ]);
  ctx.fill();

  // exposed bone ridge along the back — a real second material, not a highlight line.
  ctx.fillStyle = materialFill(ctx, "BONE", -6, -3.6, 4, -1, "#e8e0cc", "#c8c0a8", "#8a8270");
  polygonPath(ctx, [
    [-6, -1.6],
    [-2, -3.6],
    [2, -3.2],
    [4, -1.4],
    [-2, -1],
  ]);
  ctx.fill();

  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-2, -3],
    [1, -7],
    [3, -2],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-9, 0],
    [-13, -3 - dash],
    [-13, 3 + dash],
  ]);
  ctx.fill();
};

registerEnemyRenderers({
  TIDE_RIPPER: drawTideRipper,
  DEEPMAW: drawDeepmaw,
  BONEFIN: drawBonefin,
});

// Leviathan Spawn — a giant, partially terrestrial marine creature, its
// bony plating echoing the scattered leviathan remains along the coast;
// hauls itself forward on volumetric stubby flippers. The main boss adds
// a full crest of larger fused bone spikes — a genuinely elder anatomy.
// FASE 3: the main boss's own locomotor trait is a slower, longer, heavier
// haul (a bigger stride length + slower flipper paddle) than its mini-boss —
// "movimentação de criatura marinha/amphibia gigante" reading as genuinely
// bigger and heavier, not just a scaled-up copy of the same motion.
const drawLeviathanSpawn: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, isMain ? 34 : 22);
  // Distance-synced haul (real locomotion) plus a small enraged-only
  // wall-clock tremor layered on top for aggression flavor — the tremor
  // never substitutes for the real gait, it only adds a jitter while the
  // creature IS actually moving (scaled by speedRatio too).
  const undulate = gaitSwing(phase, speedRatio, isMain ? 1.5 : 1.1) + (enraged ? Math.sin(timeMs / 220) * 0.3 * speedRatio : 0);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));

  drawContactShadow(ctx, 22 * scale, 9 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, undulate * 1.2);

  for (const [fx, phaseOffset] of [
    [-11, 0],
    [11, Math.PI],
  ] as const) {
    const paddle = gaitSwing(phase, speedRatio, 1.4, phaseOffset);
    const flipperGrad = materialFill(ctx, "HIDE", fx, 2, fx, 11, "#264e58", "#1c3038", "#0a1518");
    limbSegment(ctx, fx, 2, fx + paddle, 7, 4, 3.2, flipperGrad);
    limbSegment(ctx, fx + paddle, 7, fx + paddle * 1.4, 11, 3.2, 4, "#0a1518");
    jointBulge(ctx, fx + paddle, 7, 2.4, "#12232a");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 2, 1100, 0.015));

  const bodyGrad = materialFill(ctx, "HIDE", -18, -10, 18, 6, "#264e58", "#0e2228", "#050d10");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-18, 2],
    [-14, -7],
    [0, -10],
    [14, -6],
    [18, 2],
    [8, 6],
    [-8, 6],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  drawEnergyCrack(ctx, -8, -2, -3, -6, 3, -3, color, 0.4 + damageIntensity * 0.4 + (enraged ? 0.2 : 0));

  for (const px of [-9, -2, 5, 12]) {
    ctx.fillStyle = materialFill(ctx, "BONE", px, -12, px, -6, "#e8e0cc", "#c8c0a8", "#8a8270");
    ctx.globalAlpha = 0.9;
    polygonPath(ctx, [
      [px - 2.2, -6],
      [px + 2.2, -6],
      [px, -12],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  glowBlob(ctx, 15, 0, (4 + damageIntensity * 3) * (enraged ? 1.25 : 1), color);
  ctx.fillStyle = "#0e2228";
  polygonPath(ctx, [
    [14, -3],
    [22, 0],
    [17, 5],
    [11, 3],
  ]);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.beginPath();
  ctx.arc(16, 1, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isMain) {
    for (const [sx, sy, ang] of [
      [-4, -10, -2.2],
      [3, -11, -0.9],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = materialFill(ctx, "BONE", 0, 0, 0, -9, "#e8e0cc", "#c8c0a8", "#8a8270");
      polygonPath(ctx, [
        [-2, 0],
        [2, 0],
        [0, -9],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["leviathan-spawn", "leviathan-elder"], drawLeviathanSpawn);
