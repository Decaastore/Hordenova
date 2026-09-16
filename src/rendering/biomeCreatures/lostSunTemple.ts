import { drawContactShadow, drawEnergyCrack, rimHighlight } from "../lighting";
import { breathe, glowBlob, idleSway, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Templo Solar Perdido (waves 191-210) — a monumental lost sun-temple
 * civilization, deliberately not "just another desert" roster. FASE 2:
 * Sunscarab is a domed armored beetle (CHITIN+METAL gold rim); Temple
 * Guardian stays fully architectural — stacked rectangular stone/metal
 * blocks, NO organic curves anywhere, so it never reads as a generic
 * golem; Solar Serpent is a long scaled body with luminous internal veins.
 * Raithar (mini/main) is a couched, sphinx-postured monumental statue-
 * guardian with volumetric stone limbs and a concentrated solar core.
 */

// Sunscarab — domed armored beetle, aged golden carapace, six volumetric legs.
const drawSunscarab: EnemyDrawFn = (ctx, theme, timeMs) => {
  const legPhase = timeMs / 140;
  drawContactShadow(ctx, 9, 4, 0.34);

  const legs: ReadonlyArray<readonly [number, number, number]> = [
    [-5, -3, 0],
    [-5, 3, Math.PI],
    [0, -3.4, Math.PI],
    [0, 3.4, 0],
    [5, -3, 0],
    [5, 3, Math.PI],
  ];
  for (const [hx, hy, offset] of legs) {
    const wig = Math.sin(legPhase + offset) * 2.4;
    const side = hy > 0 ? 1 : -1;
    const legGrad = materialFill(ctx, "CHITIN", hx, hy, hx + wig, hy + side * 7, "#d8b85a", theme.body, theme.dark);
    limbSegment(ctx, hx, hy, hx + wig * 0.5, hy + side * 3.5, 1, 0.7, legGrad);
    limbSegment(ctx, hx + wig * 0.5, hy + side * 3.5, hx + wig, hy + side * 7, 0.7, 0.4, theme.dark);
  }

  ctx.save();
  ctx.scale(breathe(timeMs, 0, 950, 0.018), 1);
  const domeGrad = materialFill(ctx, "METAL", -2, -7, 2, 4, "#f0d888", theme.accent, theme.dark);
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.ellipse(0, -1, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.ellipse(0, -1, 9, 6, 0, -2.4, -0.7);
    },
    "#f0d888",
    1,
    0.5,
  );
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 5);
  ctx.stroke();
  for (const rx of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(rx, -5);
    ctx.quadraticCurveTo(rx * 1.2, 0, rx, 5);
    ctx.stroke();
  }
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(8, -1, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 0.8;
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(9, -2);
    ctx.quadraticCurveTo(12, -3 - s, 13, -1 + s * 2);
    ctx.stroke();
  }
  ctx.restore();
};

// Temple Guardian — a fully architectural construct: stacked rectangular
// stone/metal blocks, bronze band seams, a single glowing slit "eye". No
// organic curves anywhere in the silhouette.
const drawTempleGuardian: EnemyDrawFn = (ctx, theme, timeMs) => {
  const march = Math.sin(timeMs / 380);
  drawContactShadow(ctx, 13, 5.5, 0.42);
  ctx.fillStyle = materialFill(ctx, "STONE", -6, 3, -6, 11, "#8a7248", theme.dark, "#1c150a");
  ctx.fillRect(-6 + march * 2, 3, 4, 8);
  ctx.fillRect(3 - march * 2, 3, 4, 8);

  const blocks: ReadonlyArray<readonly [number, number, number, number]> = [
    [-9, -14, 18, 7],
    [-7, -7, 14, 6],
    [-10, -1, 20, 5],
  ];
  for (const [bx, by, bw, bh] of blocks) {
    ctx.fillStyle = materialFill(ctx, "STONE", bx, by, bx, by + bh, "#a88c54", theme.body, theme.dark);
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    // vertical mortar seams
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.6;
    for (let sx = bx + bw / 3; sx < bx + bw; sx += bw / 3) {
      ctx.beginPath();
      ctx.moveTo(sx, by);
      ctx.lineTo(sx, by + bh);
      ctx.stroke();
    }
  }

  for (const seamY of [-7, -1]) {
    ctx.strokeStyle = materialFill(ctx, "METAL", -10, seamY, 10, seamY, "#f0d888", theme.accent, theme.dark);
    ctx.globalAlpha = 0.6 + 0.25 * Math.sin(timeMs / 400 + seamY);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-10, seamY);
    ctx.lineTo(10, seamY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = materialFill(ctx, "STONE", -4, -20, 4, -14, "#8a7248", theme.dark, "#1c150a");
  ctx.fillRect(-4, -20, 8, 6);
  glowBlob(ctx, 0, -17, 3, theme.accent);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(-2.5, -18, 5, 1.3);
};

// Solar Serpent — long sinuous body, pale scales overlapping down the
// spine, glowing internal veins instead of a flat highlight line.
const drawSolarSerpent: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 12, 4, 0.3);
  const wave = (t: number) => Math.sin(timeMs / 220 + t) * 4;
  const bodyGrad = materialFill(ctx, "CHITIN", -16, -2, 14, 2, "#f0e8c0", theme.body, theme.dark);
  ctx.strokeStyle = bodyGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, wave(0));
  ctx.quadraticCurveTo(-8, wave(1), 0, wave(2));
  ctx.quadraticCurveTo(8, wave(3), 14, wave(4));
  ctx.stroke();
  // overlapping scales
  for (let i = 0; i < 6; i++) {
    const t = i * 5;
    const x = -14 + i * 5;
    const y = wave(t / 5 + 0.3);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    polygonPath(ctx, [
      [x, y - 2.4],
      [x + 2, y],
      [x, y + 2.4],
      [x - 2, y],
    ]);
    ctx.fill();
  }
  drawEnergyCrack(ctx, -12, wave(0.2), -4, wave(1) - 2, 4, wave(2.2), theme.accent, 0.55 + 0.25 * Math.sin(timeMs / 260));
  ctx.fillStyle = theme.body;
  polygonPath(ctx, [
    [14, wave(4) - 3],
    [20, wave(4)],
    [14, wave(4) + 3],
  ]);
  ctx.fill();
  glowBlob(ctx, 17, wave(4), 2, theme.accent);
};

registerEnemyRenderers({
  SUNSCARAB: drawSunscarab,
  TEMPLE_GUARDIAN: drawTempleGuardian,
  SOLAR_SERPENT: drawSolarSerpent,
});

// Raithar — a monumental feline/reptilian statue-guardian in a couched
// sphinx pose, volumetric stone forelegs, a regal maned head, and a
// concentrated solar core burning through cracked stone. The main boss
// adds a full crown ridge and a second, larger core halo.
const drawRaithar: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 600));
  const damageIntensity = Math.max(0, 1 - hpPercent);

  drawContactShadow(ctx, 21 * scale, 9 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);

  // Sphinx-like couched forelegs, volumetric.
  for (const fx of [-6, 6]) {
    const pawGrad = materialFill(ctx, "STONE", fx, 4, fx, 11, "#a88c54", "#6a5636", "#2c2416");
    limbSegment(ctx, fx, 4, fx, 11, 3, 4, pawGrad);
    jointBulge(ctx, fx, 4, 2.6, "#7a6440");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 2, 1000, 0.015));

  const bodyGrad = materialFill(ctx, "STONE", -15, -13, 17, 6, "#a88c54", "#6a5636", "#2c2416");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-15, 4],
    [-13, -8],
    [0, -13],
    [14, -9],
    [17, 2],
    [10, 6],
    [-8, 6],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  drawEnergyCrack(ctx, -8, -2, -3, -7, 2, -3, color, 0.5 + damageIntensity * 0.4 + (enraged ? 0.25 : 0));
  drawEnergyCrack(ctx, 4, -6, 8, -9, 12, -5, color, 0.4 + damageIntensity * 0.35);

  // mane ridge — regal, feline.
  for (let i = 0; i < 4; i++) {
    const sx = -3 + i * 2.2;
    ctx.fillStyle = materialFill(ctx, "STONE", sx, -13, sx, -17, "#c8a860", "#8a7248", "#3a2e1a");
    polygonPath(ctx, [
      [sx - 1.4, -12],
      [sx + 1.4, -12],
      [sx, -17 - idleSway(timeMs, i, 900, 1)],
    ]);
    ctx.fill();
  }

  // Regal statue head, feline-reptilian profile.
  ctx.fillStyle = materialFill(ctx, "STONE", 12, -9, 20, -1, "#8a7248", "#6a5636", "#2c2416");
  polygonPath(ctx, [
    [12, -9],
    [20, -11],
    [22, -5],
    [17, -1],
    [11, -3],
  ]);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.moveTo(12, -9);
      ctx.lineTo(20, -11);
    },
    "#ffdf9a",
    1,
    0.4,
  );
  glowBlob(ctx, 17, -7, (4 + damageIntensity * 3) * (enraged ? 1.3 : 1), color);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85 + 0.15 * pulse;
  ctx.beginPath();
  ctx.arc(17, -7, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isMain) {
    // Main-boss-only crown ridge — the fully ascended reading of the same statue.
    for (const [rx, ry] of [
      [2, -13],
      [-4, -12],
      [8, -13],
    ] as const) {
      ctx.fillStyle = materialFill(ctx, "METAL", rx, ry, rx, ry - 6, "#f0d888", "#c8a860", "#6a5230");
      polygonPath(ctx, [
        [rx - 1.4, ry],
        [rx + 1.4, ry],
        [rx, ry - 6],
      ]);
      ctx.fill();
    }
    glowBlob(ctx, 17, -7, 8, color);
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["raithar", "raithar-ascendant"], drawRaithar);
