import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Península dos Leviatãs (waves 311-330) — a rocky coast where giant sea
 * creatures died eons ago. Deliberately coastal/leviathan-remains rather
 * than a beach: slick amphibious hides, bioluminescent abyssal accents,
 * bony fin structures — never a bright tropical read.
 */

// Tide Ripper — low, muscular amphibious predator, built to claw through surf and sand.
const drawTideRipper: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4, 0.34);
  const crawl = Math.sin(timeMs / 180);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  for (const [lx, sign] of [
    [-6, 1],
    [6, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(lx, 1);
    ctx.lineTo(lx + crawl * sign * 3, 6);
    ctx.stroke();
    // claw
    ctx.beginPath();
    ctx.moveTo(lx + crawl * sign * 3, 6);
    ctx.lineTo(lx + crawl * sign * 3 - 2, 8);
    ctx.moveTo(lx + crawl * sign * 3, 6);
    ctx.lineTo(lx + crawl * sign * 3 + 2, 8);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -4, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [15, -1.5],
    [13, 1.5],
    [8, 1],
  ]);
  ctx.fill();
};

// Deepmaw — an abyssal-predator marine creature hauling itself onto land, huge jaw.
const drawDeepmaw: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 13, 5.5, 0.42);
  const drag = Math.sin(timeMs / 340);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.lineTo(-8 + drag * 2, 9);
  ctx.moveTo(5, 3);
  ctx.lineTo(8 - drag * 2, 9);
  ctx.stroke();
  const bodyGrad = ctx.createLinearGradient(0, -7, 0, 5);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  // bioluminescent dots along the spine
  for (let i = 0; i < 4; i++) {
    const x = -7 + i * 4.5;
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(timeMs / 350 + i);
    ctx.beginPath();
    ctx.arc(x, -4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // huge hinged jaw
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
};

// Bonefin — fast, partially bony fish-predator hybrid, low profile.
const drawBonefin: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 8, 3.4, 0.3);
  const dash = Math.sin(timeMs / 130);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(s * 2, 1);
    ctx.lineTo(s * 5 + dash * s, 6);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(-9, 0, 9, 0);
  bodyGrad.addColorStop(0, theme.dark);
  bodyGrad.addColorStop(0.5, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
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
  // exposed bone ridge along the back
  ctx.strokeStyle = "#d8d0c0";
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-6, -1.5);
  ctx.lineTo(4, -1.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // dorsal fin
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-2, -3],
    [1, -7],
    [3, -2],
  ]);
  ctx.fill();
  // tail fin flicking
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
// hauls itself forward on stubby flipper-limbs.
const drawLeviathanSpawn: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const undulate = Math.sin(timeMs / (enraged ? 350 : 650));
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));

  drawContactShadow(ctx, 22 * scale, 9 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, undulate * 1.2);

  // Stubby flipper-limbs.
  ctx.fillStyle = "#1c3038";
  for (const fx of [-11, 11]) {
    polygonPath(ctx, [
      [fx - 4, 4],
      [fx + 4, 4],
      [fx + 2, 11],
      [fx - 2, 11],
    ]);
    ctx.fill();
  }

  // Long undulating body, slick abyssal hide.
  const bodyGrad = ctx.createLinearGradient(-18, 0, 18, 0);
  bodyGrad.addColorStop(0, "#0e2228");
  bodyGrad.addColorStop(0.5, "#264a52");
  bodyGrad.addColorStop(1, "#0e2228");
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

  // Bony dorsal plates echoing the leviathan bones scattered along the coast.
  for (const px of [-9, -2, 5, 12]) {
    ctx.fillStyle = "#d8d2c0";
    ctx.globalAlpha = 0.85;
    polygonPath(ctx, [
      [px - 2.2, -6],
      [px + 2.2, -6],
      [px, -12],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Bioluminescent throat glow, huge jaw.
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
    // Main-boss-only: a larger crest of fused ancestral bone spikes — the "elder" reading.
    for (const [sx, sy, ang] of [
      [-4, -10, -2.2],
      [3, -11, -0.9],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = "#e8e2d0";
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
};

registerBossCreature(["leviathan-spawn", "leviathan-elder"], drawLeviathanSpawn);
