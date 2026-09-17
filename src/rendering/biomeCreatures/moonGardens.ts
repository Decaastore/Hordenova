import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { bankAngle, breathe, drawEye, drawFlightShadow, flightLift, gaitPhase, gaitSwing, glowBlob, idleSway, jointBulge, limbSegment, materialFill, polygonPath, wingBeat } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Jardins da Lua (waves 271-290) — a nocturnal, supernatural vegetation
 * realm. Deliberately mysterious/elegant/dark rather than a bright
 * childish garden: dark silver-blue fur, deep foliage, cold luminous
 * accents used sparingly (eyes, wing patterns, bloom cores) against
 * near-black bodies. FASE 2: Bloom Horror's limbs use the PLANT material
 * recipe (matte, non-reflective, organic) so its vine anatomy reads
 * distinctly from Moonfang's HIDE fur.
 */

// Moonfang — quadruped predator, dark silver-blue fur, one subtle
// luminous eye pair (restrained — not an "excesso de olhos brilhantes").
const MOONFANG_STRIDE = 12;
const drawMoonfang: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, MOONFANG_STRIDE);
  drawContactShadow(ctx, 10, 4, 0.32);

  for (let i = 0; i < 4; i++) {
    const phase = gaitSwing(stridePhase, speedRatio, 1, i % 2 === 0 ? 0 : Math.PI);
    const baseX = i < 2 ? -6 : 6;
    const kneeX = baseX + phase * 1.3;
    const kneeY = 3.5;
    const footX = baseX + phase * 2.6;
    const footY = 7;
    const legGrad = materialFill(ctx, "HIDE", baseX, 0, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, baseX, 0, kneeX, kneeY, 1.4, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.6, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 0.8, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1000, 0.018));
  const bodyGrad = materialFill(ctx, "HIDE", -9, -5.5, 10, 3, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-6, -5],
    [5, -5.5],
    [10, -1],
    [8, 3],
    [-8, 3],
  ]);
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(3, -3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2.5],
    [15, -2],
    [14, 1],
    [9, 1.5],
  ]);
  ctx.fill();
  drawEye(ctx, 12, -1, 0.85, theme.accent, true);
  ctx.restore();
};

// Bloom Horror — a hunched carnivorous plant creature: PLANT-material vine
// limbs, a woven root-and-flower torso, a flytrap-like maw.
const BLOOM_HORROR_STRIDE = 15;
const drawBloomHorror: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const rootPhase = gaitPhase(locomotion?.distance ?? 0, BLOOM_HORROR_STRIDE);
  const sway = gaitSwing(rootPhase, speedRatio, 1);
  drawContactShadow(ctx, 10, 4.5, 0.36);

  for (const rx of [-5, 5]) {
    const rootGrad = materialFill(ctx, "PLANT", rx, 2, rx + sway * 2, 9, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, rx, 2, rx + sway, 6, 1.6, 1.2, rootGrad);
    limbSegment(ctx, rx + sway, 6, rx + sway * 2, 9, 1.2, 0.8, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1300, 0.02));
  const bodyGrad = materialFill(ctx, "PLANT", -7, -8, 8, 3, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-7, 0],
    [-5, -7],
    [5, -8],
    [8, -2],
    [5, 3],
    [-6, 3],
  ]);
  ctx.fill();

  ctx.strokeStyle = materialFill(ctx, "PLANT", -9, -1, 9, 2, theme.accent, theme.body, theme.dark);
  ctx.lineWidth = 1.2;
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 5, -3);
    ctx.quadraticCurveTo(s * 9 + sway * 2, -1, s * 8, 2);
    ctx.stroke();
  }

  const open = 1.5 + Math.max(0, Math.sin(timeMs / 700)) * 2.5;
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.85;
  polygonPath(ctx, [
    [3, -9],
    [8, -9 - open],
    [10, -6],
    [5, -6 + open * 0.3],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
};

// Lunamoth — large-winged moth, luminous natural wing venation.
const drawLunamoth: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lift = flightLift(timeMs, 3.9, 6, 2000);
  drawFlightShadow(ctx, lift, 6, 9, 3.6);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(bankAngle(locomotion?.turnRate ?? 0, 40, 0.45));
  const flap = wingBeat(timeMs, 0, speedRatio, 260);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    const wingGrad = materialFill(ctx, "HIDE", 0, 0, 12, -7 - flap * 3, theme.dark, theme.body, theme.dark);
    ctx.fillStyle = wingGrad;
    ctx.globalAlpha = 0.85;
    polygonPath(ctx, [
      [0, 0],
      [9, -7 - flap * 3],
      [12, 0 - flap],
      [7, 4],
      [2, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(timeMs / 400);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(1, -0.5);
    ctx.lineTo(8, -5 - flap * 2);
    ctx.moveTo(2, 1);
    ctx.lineTo(9, -1 - flap);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -3 - flap * 2, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

registerEnemyRenderers({
  MOONFANG: drawMoonfang,
  BLOOM_HORROR: drawBloomHorror,
  LUNAMOTH: drawLunamoth,
});

// Moonroot Matriarch — a giant animal/plant hybrid: PLANT-material
// root-limbs, a broad blooming crown of giant flowers, elegant posture
// but a threatening bladed-petal maw.
// FASE 3: "raízes e estruturas vegetais acompanhando o deslocamento" — the
// root-limbs plant/lift in a slow alternating shuffle synced to real
// distance instead of a shared wall-clock sway.
const drawMoonrootMatriarch: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const rootPhase = gaitPhase(locomotion?.distance ?? 0, isMain ? 20 : 14);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 600));

  drawContactShadow(ctx, 19 * scale, 8 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);

  for (const [rx, sign, phaseOffset] of [
    [-9, -1, 0],
    [9, 1, Math.PI],
  ] as const) {
    const sway = gaitSwing(rootPhase, speedRatio, 2, phaseOffset);
    const rootGrad = materialFill(ctx, "PLANT", rx, 4, rx + sign * 5, 13, "#5a3a70", "#2c2440", "#100c18");
    limbSegment(ctx, rx, 4, rx + sign * 3 + sway, 9, 3, 2.2, rootGrad);
    limbSegment(ctx, rx + sign * 3 + sway, 9, rx + sign * 5, 13, 2.2, 2.6, "#100c18");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 3, 1100, 0.014));

  const bodyGrad = materialFill(ctx, "PLANT", -8, -18, 8, 5, "#40365a", "#241c34", "#0e0a16");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -18],
    [7, -12],
    [8, 0],
    [5, 5],
    [-5, 5],
    [-8, 0],
    [-7, -12],
  ]);
  ctx.fill();

  drawEnergyCrack(ctx, -5, -6, -2, -10, 2, -6, color, 0.4 + damageIntensity * 0.4 + (enraged ? 0.2 : 0));

  for (const [tx, phase] of [
    [-6, 0],
    [6, 1.4],
  ] as const) {
    ctx.strokeStyle = materialFill(ctx, "PLANT", tx, -2, tx, 9, "#2c2440", "#1c1730", "#0e0a16");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tx, -2);
    ctx.quadraticCurveTo(tx + Math.sin(timeMs / 500 + phase) * 4, 4, tx + Math.sin(timeMs / 500 + phase) * 6, 9);
    ctx.stroke();
  }

  const petalCount = isMain ? 7 : 5;
  for (let i = 0; i < petalCount; i++) {
    const a = -Math.PI / 2 + (i / (petalCount - 1) - 0.5) * 2.6;
    const len = 11 + (isMain ? 3 : 0);
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate(a + idleSway(timeMs, i, 1600, 0.04));
    ctx.fillStyle = materialFill(ctx, "PLANT", 0, 0, 0, -len, "#5a3a70", "#3a2a54", color);
    ctx.globalAlpha = 0.85 + 0.15 * pulse;
    polygonPath(ctx, [
      [-2.6, 0],
      [2.6, 0],
      [0, -len],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  glowBlob(ctx, 0, -16, (5 + damageIntensity * 3) * (enraged ? 1.25 : 1), color);

  if (isMain) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 4 - 0.5) * 3.4;
      ctx.save();
      ctx.translate(0, -12);
      ctx.rotate(a);
      ctx.fillStyle = materialFill(ctx, "PLANT", 0, 0, 0, -6, "#7a5a94", "#4a3868", "#100c18");
      polygonPath(ctx, [
        [-1.8, 0],
        [1.8, 0],
        [0, -6],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["moonroot-matriarch", "moonroot-matriarch-elder"], drawMoonrootMatriarch);
