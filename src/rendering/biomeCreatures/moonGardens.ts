import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Jardins da Lua (waves 271-290) — a nocturnal, supernatural vegetation
 * realm. Deliberately mysterious/elegant/dark rather than a bright
 * childish garden: dark silver-blue fur, deep foliage, cold luminous
 * accents used sparingly (eyes, wing patterns, bloom cores) against
 * near-black bodies, never a saturated cartoon palette.
 */

// Moonfang — quadruped predator, dark silver-blue fur, faintly luminous eyes.
const drawMoonfang: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4, 0.32);
  const stride = timeMs / 160;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const phase = i % 2 === 0 ? Math.sin(stride) : -Math.sin(stride);
    const baseX = i < 2 ? -6 : 6;
    ctx.beginPath();
    ctx.moveTo(baseX, 1);
    ctx.lineTo(baseX + phase * 2.6, 7);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -5, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 0.6;
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
  glowBlob(ctx, 12, -1, 1.6, theme.accent);
};

// Bloom Horror — a hunched carnivorous plant creature: flowers and roots
// grown into its own anatomy, a flytrap-like maw, slow swaying gait.
const drawBloomHorror: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4.5, 0.36);
  const sway = Math.sin(timeMs / 500);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (const rx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(rx, 2);
    ctx.quadraticCurveTo(rx + sway * 2, 6, rx + sway, 9);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -8, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  // vine limbs
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 5, -3);
    ctx.quadraticCurveTo(s * 9 + sway * 2, -1, s * 8, 2);
    ctx.stroke();
  }
  // flytrap-like maw, opening/closing slowly
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
};

// Lunamoth — large-winged moth, luminous natural wing patterns.
const drawLunamoth: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 3.9, 6, 2000);
  drawFlightShadow(ctx, lift, 6, 9, 3.6);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 260);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    const wingGrad = ctx.createLinearGradient(0, 0, 10, -8 - flap * 3);
    wingGrad.addColorStop(0, theme.dark);
    wingGrad.addColorStop(1, theme.body);
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
    // luminous wing-pattern ring
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(timeMs / 400);
    ctx.lineWidth = 0.8;
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

// Moonroot Matriarch — a giant animal/plant hybrid: root-limbs, a broad
// blooming crown of giant flowers, elegant posture but a threatening
// bladed-petal maw — the "elegant AND threatening" brief.
const drawMoonrootMatriarch: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const sway = Math.sin(timeMs / (enraged ? 400 : 800)) * 2;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 600));

  drawContactShadow(ctx, 19 * scale, 8 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);

  // Gnarled root-limbs, planted wide.
  ctx.strokeStyle = "#241c30";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const [rx, sign] of [
    [-9, -1],
    [9, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(rx, 4);
    ctx.quadraticCurveTo(rx + sign * 3 + sway, 9, rx + sign * 5, 13);
    ctx.stroke();
  }

  // Elegant elongated torso, dark foliage gradient.
  const bodyGrad = ctx.createLinearGradient(0, -18, 0, 5);
  bodyGrad.addColorStop(0, "#40365a");
  bodyGrad.addColorStop(1, "#161022");
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

  // Trailing thin root-tendrils, swaying.
  for (const [tx, phase] of [
    [-6, 0],
    [6, 1.4],
  ] as const) {
    ctx.strokeStyle = "#2c2440";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(tx, -2);
    ctx.quadraticCurveTo(tx + Math.sin(timeMs / 500 + phase) * 4, 4, tx + Math.sin(timeMs / 500 + phase) * 6, 9);
    ctx.stroke();
  }

  // Giant blooming flower-crown, petals fanned like a threatening collar.
  const petalCount = isMain ? 7 : 5;
  for (let i = 0; i < petalCount; i++) {
    const a = -Math.PI / 2 + (i / (petalCount - 1) - 0.5) * 2.6;
    const len = 11 + (isMain ? 3 : 0);
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate(a);
    const petalGrad = ctx.createLinearGradient(0, 0, 0, -len);
    petalGrad.addColorStop(0, "#5a3a70");
    petalGrad.addColorStop(1, color);
    ctx.fillStyle = petalGrad;
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
    // Main-boss-only: a second, lower ring of smaller petals — fuller elder bloom.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 4 - 0.5) * 3.4;
      ctx.save();
      ctx.translate(0, -12);
      ctx.rotate(a);
      ctx.fillStyle = "#7a5a94";
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
};

registerBossCreature(["moonroot-matriarch", "moonroot-matriarch-elder"], drawMoonrootMatriarch);
