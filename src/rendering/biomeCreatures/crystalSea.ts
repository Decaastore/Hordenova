import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { breathe, gaitBounce, gaitPhase, gaitSwing, glowBlob, idleSway, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Mar de Cristal (waves 211-230) — giant mineral crystal formations.
 * Deliberately NOT all-neon: crystal facets read as cold, hard, real
 * mineral (sharp faceted polygons, a two-tone/CRYSTAL-material gradient,
 * not a flat glow), with color used only as a sparing inner accent.
 * Prism Wraith uses a genuinely different movement read (a drifting
 * fragment cluster orbiting a hovering core, no legs at all).
 */

// Shardcrawler — eight-legged arachnid, volumetric jointed legs, a real
// multi-facet crystal cluster grown from its back (not two flat triangles).
const SHARDCRAWLER_STRIDE = 10;
const drawShardcrawler: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const legPhase = gaitPhase(locomotion?.distance ?? 0, SHARDCRAWLER_STRIDE);
  drawContactShadow(ctx, 9, 4, 0.32);

  for (let i = 0; i < 4; i++) {
    const wig = gaitSwing(legPhase, speedRatio, 2.6, i * 1.4);
    for (const side of [1, -1] as const) {
      const x = -6 + i * 4;
      const kneeX = x + wig * 0.5;
      const kneeY = side * 3.5;
      const footX = x + wig;
      const footY = side * 7;
      const legGrad = materialFill(ctx, "CHITIN", x, side * 1, footX, footY, theme.accent, theme.body, theme.dark);
      limbSegment(ctx, x, side * 1, kneeX, kneeY, 1, 0.6, legGrad);
      limbSegment(ctx, kneeX, kneeY, footX, footY, 0.6, 0.3, theme.dark);
    }
  }

  ctx.save();
  ctx.scale(breathe(timeMs, 0, 1000, 0.015), 1);
  ctx.fillStyle = materialFill(ctx, "CHITIN", -7, -4, 7, 4, theme.accent, theme.body, theme.dark);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // multi-facet crystal cluster on the back — several overlapping shards, not two flat triangles.
  for (const [sx, sy, ang, len, w] of [
    [-2, -3, -0.3, 5, 1.3],
    [1, -4.4, 0.15, 6.8, 1.6],
    [3, -2.6, 0.7, 4.2, 1.2],
    [-0.5, -3.6, -0.9, 3.6, 1],
  ] as const) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = materialFill(ctx, "CRYSTAL", 0, 0, 0, -len, "#eaf6ff", theme.dark, theme.accent);
    polygonPath(ctx, [
      [-w, 0],
      [w, 0],
      [w * 0.4, -len],
      [-w * 0.4, -len],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

// Crystal Maw — quadruped with a crushing crystalline jaw and faceted
// crystal armor plates fused directly into its hide.
const CRYSTAL_MAW_STRIDE = 15;
const drawCrystalMaw: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, CRYSTAL_MAW_STRIDE);
  const lumber = gaitSwing(phase, speedRatio, 1);
  const stomp = gaitBounce(phase, speedRatio, 0.4);
  drawContactShadow(ctx, 12, 5, 0.4);

  for (const [lx, sign] of [
    [-7, 1],
    [6, -1],
  ] as const) {
    const kneeX = lx + lumber * sign * 1;
    const kneeY = 5;
    const footX = lx + lumber * sign * 2;
    const footY = 8;
    const legGrad = materialFill(ctx, "STONE", lx, 2, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, lx, 2, kneeX, kneeY, 2.2, 1.8, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.8, 1.6, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 1.4, theme.dark);
  }

  ctx.save();
  ctx.translate(0, -stomp);
  ctx.scale(1, breathe(timeMs, 1, 1100, 0.016));
  const bodyGrad = materialFill(ctx, "STONE", -11, -7, 12, 4, theme.accent, theme.body, theme.dark);
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

  for (const px of [-5, 0, 5]) {
    ctx.fillStyle = materialFill(ctx, "CRYSTAL", px - 2, -7, px + 2, -2, "#eaf6ff", theme.accent, theme.dark);
    polygonPath(ctx, [
      [px - 2, -6],
      [px + 2, -6],
      [px + 1, -2],
      [px - 1, -2],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
  }

  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [11, -1],
    [17, 1],
    [13, 4],
    [9, 2],
  ]);
  ctx.fill();
  glowBlob(ctx, 13, 1, 2.6, theme.accent);
  ctx.restore();
};

// Prism Wraith — a hovering, partially incorporeal cluster of drifting
// crystal fragments orbiting a faint core; no legs, no ground contact.
const drawPrismWraith: EnemyDrawFn = (ctx, theme, timeMs) => {
  const hover = Math.sin(timeMs / 900) * 2;
  ctx.save();
  ctx.translate(0, hover - 3);
  ctx.globalAlpha = 0.5;
  drawContactShadow(ctx, 7, 3, 0.2);
  ctx.globalAlpha = 1;
  glowBlob(ctx, 0, 0, 6 * breathe(timeMs, 0, 700, 0.08), theme.accent);
  for (let i = 0; i < 6; i++) {
    const a = timeMs / 1000 + (i / 6) * Math.PI * 2;
    const r = 6 + (i % 2) * 3;
    const fx = Math.cos(a) * r;
    const fy = Math.sin(a) * r * 0.6;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(a * 1.5);
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(timeMs / 400 + i);
    ctx.fillStyle = materialFill(ctx, "CRYSTAL", 0, -2.4, 0, 2.4, "#eaf6ff", theme.accent, theme.body);
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
// crystal growth; reads as a breathing, pulsing LIVING creature, not an
// inert statue. Volumetric limbs, real crystal-facet material shading.
// FASE 3: the main boss's locomotor trait is a heavier, longer-strided
// lumber than the mini-boss — each of its 4 legs plants at a different
// gait phase (a real quadruped sequence, not all 4 moving in lockstep) —
// plus its crystal growths sway a touch harder with every footfall via the
// same phase, reading as their weight actually responding to the impact.
const drawCrystalBehemoth: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const breatheScale = breathe(timeMs, 3, 900, 0.03);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, isMain ? 24 : 17);
  const stomp = gaitBounce(phase, speedRatio, isMain ? 0.5 : 0.35);

  drawContactShadow(ctx, 20 * scale, 8.5 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);

  for (let i = 0; i < 4; i++) {
    const lx = [-9, -3, 3, 9][i]!;
    // Diagonal quadruped sequence: legs 0&3 share a phase, 1&2 share the
    // opposite phase — a real alternating gait instead of 4 legs in lockstep.
    const legPhaseOffset = i === 0 || i === 3 ? 0 : Math.PI;
    const kneeSwing = gaitSwing(phase, speedRatio, 0.8, legPhaseOffset);
    const legGrad = materialFill(ctx, "STONE", lx, 4, lx, 12, "#5a7a86", "#2e4854", "#111c22");
    limbSegment(ctx, lx, 4, lx + kneeSwing, 8, 2.4, 2, legGrad);
    limbSegment(ctx, lx + kneeSwing, 8, lx + kneeSwing * 1.3, 12, 2, 2.2, "#111c22");
    jointBulge(ctx, lx + kneeSwing, 8, 1.8, "#1a2a30");
  }

  ctx.save();
  ctx.translate(0, -stomp);
  ctx.scale(breatheScale, 1);

  const bodyGrad = materialFill(ctx, "STONE", -16, -12, 17, 7, "#5a7a86", "#2e4854", "#111c22");
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

  const shardSpots: ReadonlyArray<readonly [number, number, number, number]> = [
    [-9, -8, -2.4, 8],
    [-2, -11, -1.7, 10],
    [5, -10, -1.1, 8.5],
    [11, -6, -0.5, 6],
  ];
  for (const [sx, sy, ang, len] of shardSpots) {
    ctx.save();
    ctx.translate(sx, sy + idleSway(timeMs, sx, 1400, 0.4) + stomp * 0.3);
    ctx.rotate(ang);
    ctx.fillStyle = materialFill(ctx, "CRYSTAL", 0, 0, 0, -len, "#eaf6ff", "#3a5864", color);
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

  glowBlob(ctx, 1, -2, (5 + damageIntensity * 4) * (enraged ? 1.3 : 1), color);

  if (isMain) {
    for (const [sx, sy, ang] of [
      [-1, -13, -1.9],
      [4, -13, -1.3],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = materialFill(ctx, "CRYSTAL", 0, 0, 0, -13, "#eaf6ff", "#4a6874", color);
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
  ctx.restore();
};

registerBossCreature(["crystal-behemoth", "crystal-behemoth-prime"], drawCrystalBehemoth);
