import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Mar de Cristal (waves 211-230) — giant mineral crystal formations.
 * Deliberately NOT all-neon: crystal facets read as cold, hard, real
 * mineral (sharp faceted polygons, a two-tone gradient, not a flat glow),
 * with color used only as a sparing inner accent. Prism Wraith uses a
 * genuinely different movement read (drifting fragment cluster, no legs)
 * per the biome brief's "movimento diferenciado".
 */

// Shardcrawler — eight-legged arachnid with a cluster of crystal shards grown from its back.
const drawShardcrawler: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 9, 4, 0.32);
  const legPhase = timeMs / 120;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const wig = Math.sin(legPhase + i * 1.4) * 2.6;
    for (const side of [1, -1] as const) {
      const x = -6 + i * 4;
      ctx.beginPath();
      ctx.moveTo(x, side * 2);
      ctx.lineTo(x + wig * 0.5, side * (6 + Math.abs(wig)));
      ctx.stroke();
    }
  }
  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // crystal shard cluster on the back
  for (const [sx, sy, ang, len] of [
    [-2, -3, -0.3, 5],
    [1, -4, 0.2, 6.4],
    [3, -2.5, 0.7, 4],
  ] as const) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    const shard = ctx.createLinearGradient(0, 0, 0, -len);
    shard.addColorStop(0, theme.dark);
    shard.addColorStop(1, theme.accent);
    ctx.fillStyle = shard;
    polygonPath(ctx, [
      [-1.4, 0],
      [1.4, 0],
      [0, -len],
    ]);
    ctx.fill();
    ctx.restore();
  }
};

// Crystal Maw — quadruped with a crushing crystalline jaw and natural crystal armor plates.
const drawCrystalMaw: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 12, 5, 0.4);
  const lumber = Math.sin(timeMs / 340);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  for (const [lx, sign] of [
    [-7, 1],
    [6, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(lx, 2);
    ctx.lineTo(lx + lumber * sign * 2, 8);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -7, 0, 5);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-11, 1],
    [-8, -6],
    [3, -7],
    [12, -1],
    [9, 4],
    [-9, 5],
  ]);
  ctx.fill();
  // faceted crystal armor plates along the spine
  for (const px of [-5, 0, 5]) {
    const facet = ctx.createLinearGradient(px, -7, px, -3);
    facet.addColorStop(0, theme.accent);
    facet.addColorStop(1, theme.dark);
    ctx.fillStyle = facet;
    polygonPath(ctx, [
      [px - 2, -6],
      [px + 2, -6],
      [px + 1, -2],
      [px - 1, -2],
    ]);
    ctx.fill();
  }
  // crystalline lower jaw
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [11, -1],
    [17, 1],
    [13, 4],
    [9, 2],
  ]);
  ctx.fill();
  glowBlob(ctx, 13, 1, 2.6, theme.accent);
};

// Prism Wraith — a hovering, partially incorporeal cluster of drifting
// mineral fragments orbiting a faint core; no legs, no ground contact.
const drawPrismWraith: EnemyDrawFn = (ctx, theme, timeMs) => {
  const hover = Math.sin(timeMs / 900) * 2;
  ctx.save();
  ctx.translate(0, hover - 3);
  ctx.globalAlpha = 0.5;
  drawContactShadow(ctx, 7, 3, 0.2);
  ctx.globalAlpha = 1;
  glowBlob(ctx, 0, 0, 6, theme.accent);
  for (let i = 0; i < 6; i++) {
    const a = timeMs / 1000 + (i / 6) * Math.PI * 2;
    const r = 6 + (i % 2) * 3;
    const fx = Math.cos(a) * r;
    const fy = Math.sin(a) * r * 0.6;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(a * 1.5);
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(timeMs / 400 + i);
    const grad = ctx.createLinearGradient(0, -2.4, 0, 2.4);
    grad.addColorStop(0, theme.accent);
    grad.addColorStop(1, theme.body);
    ctx.fillStyle = grad;
    polygonPath(ctx, [
      [0, -2.4],
      [1.6, 0],
      [0, 2.4],
      [-1.6, 0],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
};

registerEnemyRenderers({
  SHARDCRAWLER: drawShardcrawler,
  CRYSTAL_MAW: drawCrystalMaw,
  PRISM_WRAITH: drawPrismWraith,
});

// Crystal Behemoth — a hulking quadruped completely overtaken by organic
// crystal growth; reads as a breathing, pulsing LIVING creature (a slow
// scale-breathing cycle), not an inert statue.
const drawCrystalBehemoth: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const breathe = 1 + Math.sin(timeMs / 900) * 0.03;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));

  drawContactShadow(ctx, 20 * scale, 8.5 * scale, 0.46);
  ctx.save();
  ctx.scale(scale * breathe, scale);

  ctx.strokeStyle = "#2a3844";
  ctx.lineWidth = 4.4;
  ctx.lineCap = "round";
  for (const lx of [-9, -3, 3, 9]) {
    ctx.beginPath();
    ctx.moveTo(lx, 4);
    ctx.lineTo(lx, 12);
    ctx.stroke();
  }

  const bodyGrad = ctx.createRadialGradient(-3, -6, 2, 0, -2, 18);
  bodyGrad.addColorStop(0, "#5a7a86");
  bodyGrad.addColorStop(0.6, "#2e4854");
  bodyGrad.addColorStop(1, "#111c22");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-16, 4],
    [-13, -8],
    [0, -12],
    [14, -8],
    [17, 4],
    [8, 7],
    [-8, 7],
  ]);
  ctx.fill();

  drawEnergyCrack(ctx, -8, -1, -3, -6, 2, -2, color, 0.5 + damageIntensity * 0.4 + (enraged ? 0.25 : 0));

  // organic crystal growths jutting at irregular angles across the back
  const shardSpots: Array<[number, number, number, number]> = [
    [-9, -8, -2.4, 8],
    [-2, -11, -1.7, 10],
    [5, -10, -1.1, 8.5],
    [11, -6, -0.5, 6],
  ];
  for (const [sx, sy, ang, len] of shardSpots) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    const shard = ctx.createLinearGradient(0, 0, 0, -len);
    shard.addColorStop(0, "#3a5864");
    shard.addColorStop(1, color);
    ctx.fillStyle = shard;
    ctx.globalAlpha = 0.85 + 0.15 * pulse;
    polygonPath(ctx, [
      [-2.2, 0],
      [2.2, 0],
      [0, -len],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // pulsing core visible through a crystalline chest facet
  glowBlob(ctx, 1, -2, (5 + damageIntensity * 4) * (enraged ? 1.3 : 1), color);

  if (isMain) {
    // Main-boss-only: a crown of larger crystal spires — the "prime" reading.
    for (const [sx, sy, ang] of [
      [-1, -13, -1.9],
      [4, -13, -1.3],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      const shard = ctx.createLinearGradient(0, 0, 0, -13);
      shard.addColorStop(0, "#4a6874");
      shard.addColorStop(1, color);
      ctx.fillStyle = shard;
      polygonPath(ctx, [
        [-2.4, 0],
        [2.4, 0],
        [0, -13],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
};

registerBossCreature(["crystal-behemoth", "crystal-behemoth-prime"], drawCrystalBehemoth);
