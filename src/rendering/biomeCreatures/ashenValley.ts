import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { bankAngle, breathe, drawFlightShadow, flightLift, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath, wingBeat } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Vale das Cinzas Mortas (waves 251-270) — an ancient-catastrophe
 * wasteland, deliberately NOT a volcanic biome: no lava, no flame
 * monsters. Everything here reads as charred/petrified REMAINS — cold
 * ash-grey, dull ember accents used sparingly, never a full-body fire
 * glow. FASE 2: Petrified Stalker mixes two materials (HIDE + STONE) on
 * the SAME body to show the petrification spreading; Ash Hound uses the
 * CHARRED material recipe (dry, matte, porous) instead of a flat brown.
 */

// Ash Hound — quadruped predator, hide partially charred (CHARRED
// material), thin smoke wisping off its back, volumetric jointed legs.
const ASH_HOUND_STRIDE = 11;
const drawAshHound: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, ASH_HOUND_STRIDE);
  drawContactShadow(ctx, 10, 4, 0.32);

  for (let i = 0; i < 4; i++) {
    const phase = gaitSwing(stridePhase, speedRatio, 1, i % 2 === 0 ? 0 : Math.PI);
    const baseX = i < 2 ? -6 : 6;
    const kneeX = baseX + phase * 1.2;
    const kneeY = 3.5;
    const footX = baseX + phase * 2.4;
    const footY = 7;
    const legGrad = materialFill(ctx, "CHARRED", baseX, 0, footX, footY, "#8a7c6c", theme.body, theme.dark);
    limbSegment(ctx, baseX, 0, kneeX, kneeY, 1.4, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.6, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 0.8, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 950, 0.02));
  const bodyGrad = materialFill(ctx, "CHARRED", -9, -5, 10, 3, "#8a7c6c", theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-6, -5],
    [5, -5],
    [10, -1],
    [8, 3],
    [-8, 3],
  ]);
  ctx.fill();
  // charred cracked patches — thin dark fissures with a faint ember tint.
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(-1, -1);
  ctx.lineTo(-2, 1);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [14, -1.5],
    [13, 1],
    [9, 1.5],
  ]);
  ctx.fill();
  ctx.globalAlpha = 0.28 + 0.12 * Math.sin(timeMs / 400);
  ctx.fillStyle = "#999089";
  ctx.beginPath();
  ctx.arc(-1, -7 - Math.sin(timeMs / 500) * 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Petrified Stalker — a deer-like stalker whose hindquarters have already
// turned to stone while the forequarters are still living hide — the two
// materials meeting mid-body is the whole point of this design.
const PETRIFIED_STALKER_STRIDE = 13;
const drawPetrifiedStalker: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, PETRIFIED_STALKER_STRIDE);
  const stride = gaitSwing(stridePhase, speedRatio, 1);
  drawContactShadow(ctx, 10, 4.5, 0.34);

  // living forelegs (hide)
  for (const [hx, sign] of [
    [3, 1],
    [7, -1],
  ] as const) {
    const kneeX = hx - sign * stride * 1.6;
    const kneeY = 4;
    const footX = hx - sign * stride * 3.2;
    const footY = 8;
    const legGrad = materialFill(ctx, "HIDE", hx, 0, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, hx, 0, kneeX, kneeY, 1.3, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.7, theme.dark);
  }
  // petrified stone hindlegs
  for (const [hx, sign] of [
    [-6, 1],
    [-3, -1],
  ] as const) {
    const kneeX = hx + sign * stride * 1.6;
    const kneeY = 4;
    const footX = hx + sign * stride * 3.2;
    const footY = 8;
    const legGrad = materialFill(ctx, "STONE", hx, 0, footX, footY, "#8a8278", "#5a544a", "#2c2822");
    limbSegment(ctx, hx, 0, kneeX, kneeY, 1.5, 1.3, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.3, 1.4, "#2c2822");
  }

  // hindquarters — stone, angular.
  ctx.fillStyle = materialFill(ctx, "STONE", -9, -6, -1, 3, "#8a8278", "#5a544a", "#2c2822");
  polygonPath(ctx, [
    [-8, -1],
    [-6, -6],
    [-1, -6],
    [-2, 2],
    [-8, 3],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-5, 0);
  ctx.stroke();

  // forequarters — still living hide.
  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1000, 0.015));
  ctx.fillStyle = materialFill(ctx, "HIDE", -1, -6, 10, 3, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [-1, -6],
    [6, -6],
    [10, -2],
    [8, 3],
    [-2, 2],
  ]);
  ctx.fill();
  ctx.strokeStyle = "#9a9288";
  ctx.lineWidth = 1;
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(6 + s, -10 + s);
    ctx.stroke();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [8, -4],
    [12, -3],
    [11, 0],
    [8, -1],
  ]);
  ctx.fill();
  ctx.restore();
};

// Cinderwing — flies on damaged wings shedding ash particles, erratic path.
const drawCinderwing: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lift = flightLift(timeMs, 8.2, 5.5, 1300);
  drawFlightShadow(ctx, lift, 5.5, 8, 3.2);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(bankAngle(locomotion?.turnRate ?? 0, 45, 0.6));
  const flap = wingBeat(timeMs, 0, speedRatio, 140);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = materialFill(ctx, "CHARRED", 0, 0, 9, -1 - flap * 5, "#8a7c6c", theme.body, theme.dark);
    ctx.globalAlpha = 0.72;
    polygonPath(ctx, [
      [0, 0],
      [7, -4 - flap * 5],
      [9, -1],
      [4, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    polygonPath(ctx, [
      [6, -1 - flap * 3],
      [8, 0 - flap * 2],
      [6.5, 1],
    ]);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const t = (timeMs / 300 + i * 7) % 10;
    ctx.globalAlpha = Math.max(0, 0.5 - t * 0.05);
    ctx.fillStyle = "#a89a88";
    ctx.beginPath();
    ctx.arc(-4 - t, 1 + Math.sin(t) * 1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

registerEnemyRenderers({
  ASH_HOUND: drawAshHound,
  PETRIFIED_STALKER: drawPetrifiedStalker,
  CINDERWING: drawCinderwing,
});

/**
 * Ashen Colossus — a heavy fusion of charred organic matter and stone,
 * deliberately built to read as a smoldering DEAD husk, not a fire
 * elemental: the body is dull ash-grey/charcoal throughout via the
 * CHARRED material recipe, `color` (the biome accent) only ever appears
 * as a faint ember glow deep inside cracks — never a body-wide flame
 * silhouette, never orange skin.
 */
// FASE 3: a heavy, irregular, uneven gait — a genuinely petrified body
// dragging itself forward rather than a clean walk cycle (spec example:
// "corpo pesado e irregular, como matéria carbonizada petrificada").
const drawAshenColossus: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lurchPhase = gaitPhase(locomotion?.distance ?? 0, isMain ? 21 : 15);
  const sway = gaitSwing(lurchPhase, speedRatio, 1.2);

  drawContactShadow(ctx, 20 * scale, 8.5 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(sway, 0);

  for (const [lx, phaseOffset] of [
    [-6, 0],
    [6, 1.9],
  ] as const) {
    // Uneven phase offsets (not a clean π apart) — one leg visibly drags a
    // beat behind the other, reading as damaged/irregular rather than a
    // smooth quadruped trot.
    const drag = gaitSwing(lurchPhase, speedRatio, 1.1, phaseOffset);
    const legGrad = materialFill(ctx, "CHARRED", lx, 6, lx, 14, "#5a5248", "#26221e", "#100e0b");
    limbSegment(ctx, lx, 6, lx + drag, 10, 2.6, 2.2, legGrad);
    limbSegment(ctx, lx + drag, 10, lx + drag * 0.6, 14, 2.2, 2.6, "#100e0b");
    jointBulge(ctx, lx + drag, 10, 1.8, "#1a1712");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 2, 1000, 0.014));

  const bodyGrad = materialFill(ctx, "CHARRED", -12, -16, 12, 8, "#524a42", "#2c2620", "#100e0b");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -16],
    [10, -10],
    [12, 2],
    [7, 8],
    [-7, 8],
    [-12, 2],
    [-10, -10],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // deep charcoal fissures — the ONLY place the biome accent color shows,
  // and only as a dim ember glow, never a body-wide fire silhouette.
  drawEnergyCrack(ctx, -7, -1, -3, -6, 2, -2, color, (0.32 + damageIntensity * 0.3 + (enraged ? 0.15 : 0)) * 0.8);
  drawEnergyCrack(ctx, 4, 3, 7, -1, 9, -5, color, (0.28 + damageIntensity * 0.25) * 0.8);

  for (const [px, py] of [
    [-7, -8],
    [0, -11],
    [7, -8],
  ] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", px, py, px, py + 4, "#4a443c", "#2c2822", "#100e0b");
    polygonPath(ctx, [
      [px - 3, py],
      [px + 3, py],
      [px + 2, py + 4],
      [px - 2, py + 4],
    ]);
    ctx.fill();
  }

  glowBlob(ctx, 0, -1, (3.5 + damageIntensity * 2.5) * (enraged ? 1.2 : 1), color);

  ctx.fillStyle = "#221e1a";
  polygonPath(ctx, [
    [-3, -16],
    [3, -17],
    [4, -13],
    [-4, -12],
  ]);
  ctx.fill();

  if (isMain) {
    ctx.fillStyle = materialFill(ctx, "STONE", -11, -14, 9, -6, "#5a5248", "#2c2822", "#100e0b");
    polygonPath(ctx, [
      [-11, -9],
      [-1, -14],
      [9, -9],
      [6, -6],
      [-8, -6],
    ]);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["ashen-colossus", "ashen-colossus-forsaken"], drawAshenColossus);
