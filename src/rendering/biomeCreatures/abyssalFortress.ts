import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { bankAngle, breathe, drawFlightShadow, flightLift, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath, wingBeat } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Fortaleza Abissal (waves 231-250) — a fortress built inside a giant
 * abyss. Abyssal Warden is explicitly its OWN design (not a Brute reskin,
 * not another shared Colossus): a low, wide, heavily natural-armored
 * guardian silhouette. FASE 2: real chain-link geometry for Chainbound
 * (not a stroked squiggle), a genuinely flat splayed climbing stance for
 * Abyss Crawler, and volumetric legs throughout.
 */

// Abyss Crawler — many-limbed, wall/cliff-adapted climber; a wide, flat,
// splayed stance with real jointed limbs on both sides.
const ABYSS_CRAWLER_STRIDE = 9;
const drawAbyssCrawler: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const legPhase = gaitPhase(locomotion?.distance ?? 0, ABYSS_CRAWLER_STRIDE);
  drawContactShadow(ctx, 11, 4, 0.34);

  for (let i = 0; i < 4; i++) {
    const wig = gaitSwing(legPhase, speedRatio, 3, i * 1.9);
    for (const side of [1, -1] as const) {
      const x = -7 + i * 4.6;
      const kneeX = x + wig * 0.6;
      const kneeY = side * 4;
      const footX = x + wig;
      const footY = side * 8;
      const legGrad = materialFill(ctx, "CHITIN", x, side, footX, footY, theme.accent, theme.body, theme.dark);
      limbSegment(ctx, x, side * 1.5, kneeX, kneeY, 1.2, 0.8, legGrad);
      limbSegment(ctx, kneeX, kneeY, footX, footY, 0.8, 0.4, theme.dark);
      jointBulge(ctx, kneeX, kneeY, 0.7, theme.dark);
    }
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1000, 0.02));
  const bodyGrad = materialFill(ctx, "CHITIN", -10, -3.4, 11, 3.4, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-10, 0],
    [-6, -3.4],
    [7, -3],
    [11, 0],
    [7, 3],
    [-7, 3.4],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(timeMs / 240);
  for (const ex of [-3, 3]) {
    ctx.beginPath();
    ctx.arc(ex + 7, -0.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Chainbound — a heavy, deformed captive dragging REAL rusted chain links
// (overlapping ellipse pairs, not a stroked squiggle), hunched low.
const CHAINBOUND_STRIDE = 14;
const drawChainbound: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const dragPhase = gaitPhase(locomotion?.distance ?? 0, CHAINBOUND_STRIDE);
  const drag = gaitSwing(dragPhase, speedRatio, 1);
  drawContactShadow(ctx, 11, 5, 0.4);

  const legGradL = materialFill(ctx, "HIDE", -4, 3, -5 - drag, 10, theme.accent, theme.body, theme.dark);
  limbSegment(ctx, -4, 3, -5 - drag, 10, 2, 1.6, legGradL);
  const legGradR = materialFill(ctx, "HIDE", 4, 3, 5 + drag, 10, theme.accent, theme.body, theme.dark);
  limbSegment(ctx, 4, 3, 5 + drag, 10, 2, 1.6, legGradR);

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1200, 0.02));
  const bodyGrad = materialFill(ctx, "HIDE", -7, -9, 8, 4, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-7, -1],
    [-5, -9],
    [4, -8],
    [8, -2],
    [6, 4],
    [-6, 4],
  ]);
  ctx.fill();

  // real chain links trailing behind, each an overlapping ellipse pair.
  ctx.strokeStyle = materialFill(ctx, "METAL", -6, -2, -18, 4, "#c8bc9e", "#8a7e68", "#2a251e");
  ctx.lineWidth = 1.4;
  let cx = -6;
  let cy = -2;
  for (let i = 0; i < 4; i++) {
    const nx = cx - 3 - Math.sin(timeMs / 260 + i) * 0.6;
    const ny = cy + 1.4 + i * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 1.6, 1, i % 2 === 0 ? 0.5 : -0.5, 0, Math.PI * 2);
    ctx.stroke();
    cx = nx;
    cy = ny;
  }

  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [3, -9],
    [8, -8],
    [7, -5],
    [3, -5.5],
  ]);
  ctx.fill();
  ctx.restore();
};

// Void Bat — huge-winged cave flier, small body, erratic flapping.
const drawVoidBat: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lift = flightLift(timeMs, 6.6, 5, 1100);
  drawFlightShadow(ctx, lift, 5, 8, 3.2);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(bankAngle(locomotion?.turnRate ?? 0, 55, 0.55));
  const flap = wingBeat(timeMs, 0, speedRatio, 110);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = materialFill(ctx, "HIDE", 0, 0, 12, -1 - flap * 3, theme.accent, theme.body, theme.dark);
    ctx.globalAlpha = 0.82;
    polygonPath(ctx, [
      [0, 0],
      [6, -5 - flap * 6],
      [11, -1 - flap * 3],
      [12, 3 - flap],
      [5, 3],
      [2, 1],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6, -5 - flap * 6);
    ctx.lineTo(11, -1 - flap * 3);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(1, -0.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
};

registerEnemyRenderers({
  ABYSS_CRAWLER: drawAbyssCrawler,
  CHAINBOUND: drawChainbound,
  VOID_BAT: drawVoidBat,
});

/**
 * Abyssal Warden — a colossal, LOW and WIDE ancient guardian, thick
 * natural (organic hide, not mechanical/crystal) armor plating fused
 * along its back, four short braced volumetric legs. Deliberately not a
 * Brute silhouette and not a repaint of any other boss in this pack —
 * reads as an immovable, silent wall. The main boss adds a heavier
 * double-plate ridge and thicker leg bracing, not a scaled copy.
 */
// FASE 3: an immovable-feeling, threatening heavy tread — legs plant in a
// slow diagonal sequence with almost no swing amplitude (it does not
// scurry), just enough to read as genuinely bearing its own mass forward.
const drawAbyssalWarden: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const breatheScale = breathe(timeMs, 4, 1100, 0.015);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const treadPhase = gaitPhase(locomotion?.distance ?? 0, isMain ? 26 : 18);

  drawContactShadow(ctx, 22 * scale, 8 * scale, 0.5);
  ctx.save();
  ctx.scale(scale, scale);

  for (let i = 0; i < 4; i++) {
    const lx = [-14, -6, 6, 14][i]!;
    const tread = gaitSwing(treadPhase, speedRatio, 0.9, i % 2 === 0 ? 0 : Math.PI);
    const legGrad = materialFill(ctx, "HIDE", lx, 3, lx, 11, "#4a5458", "#22282c", "#0e1012");
    limbSegment(ctx, lx, 3, lx + tread, 7, 2.8, 2.6, legGrad);
    limbSegment(ctx, lx + tread, 7, lx + tread * 1.2, 11, 2.6, 3.4, "#0e1012");
    jointBulge(ctx, lx + tread, 7, 2.2, "#181c1e");
  }

  ctx.save();
  ctx.scale(1, breatheScale);

  const bodyGrad = materialFill(ctx, "HIDE", -19, -12, 19, 8, "#4a5458", "#22282c", "#0e1012");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-19, 5],
    [-17, -6],
    [-8, -12],
    [8, -12],
    [17, -6],
    [19, 5],
    [10, 8],
    [-10, 8],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (const px of [-11, -4, 3, 10]) {
    ctx.fillStyle = materialFill(ctx, "STONE", px, -11, px, -2, "#5c666a", "#3a4144", "#0e1012");
    polygonPath(ctx, [
      [px - 3.4, -10],
      [px + 3.4, -10],
      [px + 2.4, -2],
      [px - 2.4, -2],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  drawEnergyCrack(ctx, -6, -4, -2, -8, 3, -4, color, 0.4 + damageIntensity * 0.45 + (enraged ? 0.2 : 0));

  ctx.fillStyle = "#22282c";
  polygonPath(ctx, [
    [15, -6],
    [23, -4],
    [22, 0],
    [15, -1],
  ]);
  ctx.fill();
  glowBlob(ctx, 20, -3, isMain ? 3.8 : 2.6, color);

  if (isMain) {
    ctx.fillStyle = materialFill(ctx, "STONE", -8, -16, 8, -10, "#5c666a", "#3a4144", "#0e1012");
    polygonPath(ctx, [
      [-8, -12],
      [8, -12],
      [5, -16],
      [-5, -16],
    ]);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["abyssal-warden", "abyssal-warden-eternal"], drawAbyssalWarden);
