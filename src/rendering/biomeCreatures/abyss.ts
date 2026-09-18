import { drawContactShadow } from "../lighting";
import { drawEye, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Abyss's Abyssal Maw (wave 130). The most
 * completely non-humanoid boss in the whole roster on purpose: no head, no
 * arms, no legs — an asymmetric organic mass whose entire front IS a huge
 * jagged mouth, with a few irregular-length tentacles trailing from the
 * back instead of limbs. Deliberately avoids the "generic kraken" trap by
 * keeping the tentacles few, short, and asymmetric (never a full radial
 * ring of identical arms) so the eye reads the MOUTH first, always.
 */
const drawAbyssalMaw: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const writhe = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 560));
  const jawOpen = 0.4 + 0.6 * Math.max(0.2, Math.sin(timeMs / (enraged ? 340 : 780)) * 0.5 + 0.5);
  const crawl = idleSway(timeMs, 0, 1800, 1.2) * Math.max(0.3, speedRatio);

  drawContactShadow(ctx, 16, 7, 0.48);
  ctx.save();
  ctx.translate(0, crawl * 0.4);

  // Asymmetric trailing tentacles — irregular count/length, drawn BEHIND the mass.
  const tentacles: ReadonlyArray<readonly [number, number, number]> = [
    [-11, 2, 13],
    [-6, 7, 9],
    [9, 6, 15],
  ];
  for (const [ox, oy, len] of tentacles) {
    const wave = idleSway(timeMs, ox, 700, 3.5) * Math.max(0.25, speedRatio);
    ctx.strokeStyle = materialFill(ctx, "CHITIN", ox, oy, ox, oy + len, "#5a3a6a", "#2a1830", "#0a0610");
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.quadraticCurveTo(ox + wave, oy + len * 0.6, ox + wave * 1.6, oy + len);
    ctx.stroke();
  }

  // The body mass — pulsing/bulging, never a smooth static blob.
  ctx.save();
  ctx.scale(1 + writhe * 0.03, 1 - writhe * 0.02);
  const bodyGrad = materialFill(ctx, "CHITIN", -13, -12, 13, 10, "#6a4a7a", "#2e1c38", "#0e0814");
  ctx.fillStyle = bodyGrad;
  ctx.globalAlpha = 0.95;
  polygonPath(ctx, [
    [-13, -2],
    [-9, -10],
    [-1, -12],
    [8, -9],
    [12, -1],
    [9, 7],
    [-2, 10],
    [-11, 6],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Wet glossy sheen — a tight bright band near the light-facing edge.
  ctx.strokeStyle = "rgba(220,190,255,0.35)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.lineTo(-1, -12);
  ctx.lineTo(8, -9);
  ctx.stroke();

  // The maw — the dominant feature, front and center, a wide jagged opening.
  const spread = 1.5 + jawOpen * 5;
  ctx.save();
  ctx.translate(3, 0);
  ctx.fillStyle = "#1c1018";
  polygonPath(ctx, [
    [-9, -2 - spread * 0.55],
    [3, -3 - spread],
    [10, -1 - spread * 0.7],
    [10, 1 + spread * 0.7],
    [3, 3 + spread],
    [-9, 2 + spread * 0.55],
  ]);
  ctx.fill();
  ctx.fillStyle = "#f0e8f4";
  const teeth = 5;
  for (let i = 0; i < teeth; i++) {
    const t = i / (teeth - 1);
    const tx = -7 + t * 15;
    const topY = -1.5 - spread * (1 - t * 0.3);
    const botY = 1.5 + spread * (1 - t * 0.3);
    ctx.beginPath();
    ctx.moveTo(tx, topY);
    ctx.lineTo(tx + 1.2, topY + 2);
    ctx.lineTo(tx - 0.6, topY + 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, botY);
    ctx.lineTo(tx + 1.2, botY - 2);
    ctx.lineTo(tx - 0.6, botY - 2);
    ctx.fill();
  }
  // Energy glowing from within the throat.
  glowBlob(ctx, 0, 0, (5 + damageIntensity * 3 + jawOpen * 2) * (enraged ? 1.3 : 1), color);
  ctx.restore();

  // One single asymmetric eye off to a side — unsettling, never a mirrored pair.
  drawEye(ctx, -8, -8, 1, color, true);

  ctx.restore();
  ctx.restore();

  // Sparse dark organic particulate drifting off the mass — never bright sparkles.
  for (let i = 0; i < 4; i++) {
    const t = ((timeMs / 1500 + i / 4) % 1 + 1) % 1;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.3;
    ctx.fillStyle = "#4a2e5a";
    ctx.beginPath();
    ctx.arc(-6 + i * 4, -4 - t * 10, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

registerBossCreature(["abyssal-maw"], drawAbyssalMaw);
