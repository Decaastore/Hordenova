import { drawContactShadow, drawEnergyCrack, rimHighlight } from "../lighting";
import { glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Templo Solar Perdido (waves 191-210) — a monumental lost sun-temple
 * civilization, deliberately not "just another desert" roster: an
 * armored scarab, a BLOCKY ARCHITECTURAL construct (no organic curves —
 * reads as living temple stonework, not a generic golem), a sinuous pale
 * serpent, and a statue-inspired monumental feline/reptilian mini/main boss.
 */

// Sunscarab — domed armored beetle, aged golden carapace, six legs.
const drawSunscarab: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 9, 4, 0.34);
  const legPhase = timeMs / 140;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const x = -6 + i * 6;
    const wig = Math.sin(legPhase + i * 1.7) * 2.4;
    for (const side of [1, -1] as const) {
      ctx.beginPath();
      ctx.moveTo(x, side * 3);
      ctx.lineTo(x + wig, side * 7);
      ctx.stroke();
    }
  }
  const domeGrad = ctx.createRadialGradient(-2, -4, 1, 0, -1, 10);
  domeGrad.addColorStop(0, theme.accent);
  domeGrad.addColorStop(0.55, theme.body);
  domeGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.ellipse(0, -1, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 5);
  ctx.stroke();
  // aged carapace ridges
  for (const rx of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(rx, -5);
    ctx.quadraticCurveTo(rx * 1.2, 0, rx, 5);
    ctx.stroke();
  }
  // head + antennae
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
};

// Temple Guardian — an angular construct of fused stone blocks and bronze
// bands, no organic curves; rune joints glow like the temple's own magic.
const drawTempleGuardian: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 13, 5.5, 0.42);
  const march = Math.sin(timeMs / 380);
  ctx.fillStyle = theme.dark;
  ctx.fillRect(-6 + march * 2, 3, 4, 8);
  ctx.fillRect(3 - march * 2, 3, 4, 8);
  // stacked rectangular torso blocks
  const blocks: Array<[number, number, number, number]> = [
    [-9, -14, 18, 7],
    [-7, -7, 14, 6],
    [-10, -1, 20, 5],
  ];
  for (const [bx, by, bw, bh] of blocks) {
    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, theme.body);
    grad.addColorStop(1, theme.dark);
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  }
  // bronze bands at each block seam, glowing rune facets
  for (const seamY of [-7, -1]) {
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(timeMs / 400 + seamY);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-10, seamY);
    ctx.lineTo(10, seamY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // rectangular block head, single glowing slit "eye"
  ctx.fillStyle = theme.dark;
  ctx.fillRect(-4, -20, 8, 6);
  glowBlob(ctx, 0, -17, 3, theme.accent);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(-2.5, -18, 5, 1.3);
};

// Solar Serpent — long sinuous body, pale scales, faint inner glow veins.
const drawSolarSerpent: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 12, 4, 0.3);
  const wave = (t: number) => Math.sin(timeMs / 220 + t) * 4;
  ctx.strokeStyle = theme.body;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, wave(0));
  ctx.quadraticCurveTo(-8, wave(1), 0, wave(2));
  ctx.quadraticCurveTo(8, wave(3), 14, wave(4));
  ctx.stroke();
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(-16, wave(0));
  ctx.quadraticCurveTo(-8, wave(1), 0, wave(2));
  ctx.quadraticCurveTo(8, wave(3), 14, wave(4));
  ctx.stroke();
  ctx.globalAlpha = 1;
  // subtle inner luminous scale-line
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(timeMs / 260);
  ctx.beginPath();
  ctx.moveTo(-14, wave(0));
  ctx.quadraticCurveTo(-6, wave(1), 2, wave(2));
  ctx.stroke();
  ctx.globalAlpha = 1;
  // head
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

// Raithar — a monumental feline/reptilian statue-guardian, sphinx-like
// posture, stone cracks glowing with concentrated solar energy.
const drawRaithar: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 600));
  const damageIntensity = Math.max(0, 1 - hpPercent);

  drawContactShadow(ctx, 21 * scale, 9 * scale, 0.48);
  ctx.save();
  ctx.scale(scale, scale);

  // Sphinx-like couched forelegs, stone paws forward.
  ctx.fillStyle = "#7a6440";
  for (const fx of [-6, 6]) {
    polygonPath(ctx, [
      [fx - 3, 4],
      [fx + 3, 4],
      [fx + 4, 11],
      [fx - 4, 11],
    ]);
    ctx.fill();
  }

  // Broad couched body, statue-stone gradient.
  const bodyGrad = ctx.createRadialGradient(-3, -6, 2, 0, -2, 18);
  bodyGrad.addColorStop(0, "#a88c54");
  bodyGrad.addColorStop(0.6, "#6a5636");
  bodyGrad.addColorStop(1, "#2c2416");
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

  // Regal statue head, feline-reptilian profile.
  ctx.fillStyle = "#8a7248";
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
  // solar core between the "eyes"
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
      ctx.fillStyle = "#c8a860";
      polygonPath(ctx, [
        [rx - 1.4, ry],
        [rx + 1.4, ry],
        [rx, ry - 6],
      ]);
      ctx.fill();
    }
  }
  ctx.restore();
};

registerBossCreature(["raithar", "raithar-ascendant"], drawRaithar);
