import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Vale das Cinzas Mortas (waves 251-270) — an ancient-catastrophe
 * wasteland, deliberately NOT a volcanic biome: no lava, no flame
 * monsters. Everything here reads as charred/petrified REMAINS — cold
 * ash-grey, dull ember accents used sparingly, never a full-body fire
 * glow (see Ashen Colossus's own doc comment for the explicit contrast
 * with a fire-elemental read).
 */

// Ash Hound — quadruped predator, hide partially charred, thin smoke wisping off its back.
const drawAshHound: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4, 0.32);
  const stride = timeMs / 150;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const phase = i % 2 === 0 ? Math.sin(stride) : -Math.sin(stride);
    const baseX = i < 2 ? -6 : 6;
    ctx.beginPath();
    ctx.moveTo(baseX, 1);
    ctx.lineTo(baseX + phase * 2.4, 7);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -5, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  // charred cracked patches
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(-1, -1);
  ctx.lineTo(-2, 1);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // head
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [14, -1.5],
    [13, 1],
    [9, 1.5],
  ]);
  ctx.fill();
  // faint smoke wisp
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(timeMs / 400);
  ctx.fillStyle = "#999089";
  ctx.beginPath();
  ctx.arc(-1, -7 - Math.sin(timeMs / 500) * 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

// Petrified Stalker — deer-like stalker, parts of its body turned to stone.
const drawPetrifiedStalker: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4.5, 0.34);
  const stride = Math.sin(timeMs / 200);
  ctx.strokeStyle = "#8a8278";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8 + stride * 2, 8);
  ctx.moveTo(6, 0);
  ctx.lineTo(8 - stride * 2, 8);
  ctx.stroke();
  ctx.strokeStyle = theme.dark;
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.lineTo(-4 - stride * 2, 8);
  ctx.moveTo(3, 1);
  ctx.lineTo(4 + stride * 2, 8);
  ctx.stroke();
  const bodyGrad = ctx.createLinearGradient(0, -6, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-8, -1],
    [-6, -6],
    [6, -6],
    [10, -2],
    [8, 3],
    [-8, 3],
  ]);
  ctx.fill();
  // stone-petrified hindquarters patch (grey, angular)
  ctx.fillStyle = "#8a8278";
  polygonPath(ctx, [
    [-8, -1],
    [-6, -6],
    [-1, -6],
    [-2, 2],
    [-8, 3],
  ]);
  ctx.fill();
  // small stone antlers
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
};

// Cinderwing — flies on damaged wings shedding ash particles, erratic path.
const drawCinderwing: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 8.2, 5.5, 1300);
  drawFlightShadow(ctx, lift, 5.5, 8, 3.2);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 140);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = theme.body;
    ctx.globalAlpha = 0.7;
    polygonPath(ctx, [
      [0, 0],
      [7, -4 - flap * 5],
      [9, -1],
      [4, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    // torn wing edge notch — "damaged wings"
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
  // trailing ash motes
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
 * elemental: the body is dull ash-grey/charcoal throughout, `color`
 * (the biome accent) only ever appears as a faint ember glow deep inside
 * cracks — never a body-wide flame silhouette, never orange skin.
 */
const drawAshenColossus: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const sway = Math.sin(timeMs / 700) * 1.2;

  drawContactShadow(ctx, 20 * scale, 8.5 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(sway, 0);

  ctx.strokeStyle = "#26221e";
  ctx.lineWidth = 4.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.lineTo(-8, 14);
  ctx.moveTo(6, 6);
  ctx.lineTo(8, 14);
  ctx.stroke();

  const bodyGrad = ctx.createRadialGradient(-3, -6, 2, 0, -2, 17);
  bodyGrad.addColorStop(0, "#524a42");
  bodyGrad.addColorStop(0.65, "#2c2620");
  bodyGrad.addColorStop(1, "#100e0b");
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

  // brittle ash-stone plating fused across the shoulders
  for (const [px, py] of [
    [-7, -8],
    [0, -11],
    [7, -8],
  ] as const) {
    ctx.fillStyle = "#3a352e";
    polygonPath(ctx, [
      [px - 3, py],
      [px + 3, py],
      [px + 2, py + 4],
      [px - 2, py + 4],
    ]);
    ctx.fill();
  }

  // low ember glow deep in the chest crack — subtle, never overpowering the ash silhouette.
  glowBlob(ctx, 0, -1, (3.5 + damageIntensity * 2.5) * (enraged ? 1.2 : 1), color);

  // hollow, faceless head
  ctx.fillStyle = "#221e1a";
  polygonPath(ctx, [
    [-3, -16],
    [3, -17],
    [4, -13],
    [-4, -12],
  ]);
  ctx.fill();

  if (isMain) {
    // Main-boss-only: heavier fused stone mantle across the shoulders — the "forsaken" reading, still ash-grey.
    ctx.fillStyle = "#4a443c";
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
};

registerBossCreature(["ashen-colossus", "ashen-colossus-forsaken"], drawAshenColossus);
