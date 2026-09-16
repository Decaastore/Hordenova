import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Fortaleza Abissal (waves 231-250) — a fortress built inside a giant
 * abyss. Abyssal Warden is explicitly its OWN design (not a Brute reskin,
 * not another shared Colossus): a low, wide, heavily natural-armored
 * guardian silhouette, distinct from every other boss in this pack.
 */

// Abyss Crawler — many-limbed, wall/cliff-adapted climber; a wide, flat, splayed stance.
const drawAbyssCrawler: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 11, 4, 0.34);
  const legPhase = timeMs / 110;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const wig = Math.sin(legPhase + i * 1.9) * 3;
    for (const side of [1, -1] as const) {
      const x = -7 + i * 4.6;
      ctx.beginPath();
      ctx.moveTo(x, side * 2);
      ctx.lineTo(x + wig, side * (5 + Math.abs(wig) * 0.6));
      ctx.lineTo(x + wig * 1.3, side * (8 + Math.abs(wig) * 0.4));
      ctx.stroke();
    }
  }
  const bodyGrad = ctx.createLinearGradient(0, -3, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
};

// Chainbound — a heavy, deformed captive dragging rusted chains, hunched low.
const drawChainbound: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 11, 5, 0.4);
  const drag = Math.sin(timeMs / 400);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, 3);
  ctx.lineTo(-5 - drag, 10);
  ctx.moveTo(4, 3);
  ctx.lineTo(5 + drag, 10);
  ctx.stroke();
  const bodyGrad = ctx.createLinearGradient(0, -9, 0, 4);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  // dragging chain trailing behind, swinging with the gait
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  for (let i = 0; i < 4; i++) {
    const x = -6 - i * 3;
    const y = -2 + Math.sin(timeMs / 260 + i) * 2 + i * 1.5;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const x = -6 - i * 3;
    const y = -2 + Math.sin(timeMs / 260 + i) * 2 + i * 1.5;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.3, 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // slumped, bound head
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [3, -9],
    [8, -8],
    [7, -5],
    [3, -5.5],
  ]);
  ctx.fill();
};

// Void Bat — huge-winged cave flier, small body, erratic flapping.
const drawVoidBat: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 6.6, 5, 1100);
  drawFlightShadow(ctx, lift, 5, 8, 3.2);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 110);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = theme.body;
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

// Abyssal Warden — a colossal, LOW and WIDE ancient guardian, thick
// natural (organic hide, not mechanical/crystal) armor plating fused
// along its back, four short braced legs. Deliberately not a Brute
// silhouette and not a repaint of any other boss in this pack — reads
// as an immovable, silent wall rather than a limb-swinging aggressor.
const drawAbyssalWarden: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const breathe = 1 + Math.sin(timeMs / 1100) * 0.02;

  drawContactShadow(ctx, 22 * scale, 8 * scale, 0.5);
  ctx.save();
  ctx.scale(scale, scale * breathe);

  // Four short, braced legs — planted, not striding.
  ctx.fillStyle = "#22282c";
  for (const lx of [-14, -6, 6, 14]) {
    polygonPath(ctx, [
      [lx - 2.6, 5],
      [lx + 2.6, 5],
      [lx + 3.4, 11],
      [lx - 3.4, 11],
    ]);
    ctx.fill();
  }

  // Broad, low, heavily plated back — the "wall" silhouette.
  const bodyGrad = ctx.createLinearGradient(0, -13, 0, 6);
  bodyGrad.addColorStop(0, "#4a5458");
  bodyGrad.addColorStop(1, "#181c1e");
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

  // Overlapping organic armor plates (not mechanical rivets, not crystal facets).
  for (const px of [-11, -4, 3, 10]) {
    const plateGrad = ctx.createLinearGradient(px, -11, px, -3);
    plateGrad.addColorStop(0, "#5c666a");
    plateGrad.addColorStop(1, "#2a3134");
    ctx.fillStyle = plateGrad;
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

  // Low, wide head sunk between the shoulder plates — a single steady glow, no eyes.
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
    // Main-boss-only: a heavier double-plate ridge — the "eternal" reading.
    ctx.fillStyle = "#3a4144";
    polygonPath(ctx, [
      [-8, -12],
      [8, -12],
      [5, -16],
      [-5, -16],
    ]);
    ctx.fill();
  }
  ctx.restore();
};

registerBossCreature(["abyssal-warden", "abyssal-warden-eternal"], drawAbyssalWarden);
