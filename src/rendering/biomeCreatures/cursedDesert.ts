import { drawContactShadow } from "../lighting";
import { drawEye, gaitPhase, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Cursed Desert's Sand Devourer (wave 90). The
 * one boss in this batch that deliberately breaks the humanoid silhouette
 * every other original boss uses: a low, segmented, serpentine body with
 * no legs at all, bursting up out of a mound of sand it never fully
 * leaves (the mound doubles as its ground contact — it reads as erupting
 * from the earth, not standing on it). The head is built AS a wide gaping
 * jaw rather than a jaw attached to a head — "Devourer" is a body-language
 * fact, not a name.
 */
const SAND_STRIDE = 26;
const drawSandDevourer: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, SAND_STRIDE);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const jawOpen = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 300 : 700));

  // The sand mound IS the contact shadow — wider and sandier than a plain shadow ellipse.
  drawContactShadow(ctx, 20, 7, 0.4);
  ctx.save();
  const moundGrad = materialFill(ctx, "STONE", -18, 4, 18, 12, "#c9ab6e", "#8a7048", "#4a3a24");
  ctx.fillStyle = moundGrad;
  polygonPath(ctx, [[-18, 8], [-10, 3], [0, 6], [10, 2], [18, 8], [12, 12], [-12, 12]]);
  ctx.fill();

  // Segmented serpentine body, rippling side to side — no legs at all.
  const segments: ReadonlyArray<readonly [number, number]> = [[-16, 4], [-11, 2], [-6, 0], [-1, -1]];
  let prevRadius = 4;
  for (let i = 0; i < segments.length; i++) {
    const [sx, sy] = segments[i]!;
    const wave = Math.sin(phase * 0.6 + i * 0.8) * 2.4 * speedRatio;
    const radius = 4.6 - i * 0.5;
    ctx.fillStyle = materialFill(ctx, "STONE", sx, sy - radius, sx, sy + radius, "#e0c78a", "#a8895a", "#4a3a24");
    ctx.beginPath();
    ctx.ellipse(sx, sy + wave, radius + 1.5, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    prevRadius = radius;
  }
  void prevRadius;

  // Wide jaw head — the segments taper directly into an open mouth, the
  // silhouette's dominant, unmistakable feature.
  const jawSpread = 2 + jawOpen * 3.5;
  ctx.save();
  ctx.translate(-1, -1);
  ctx.fillStyle = materialFill(ctx, "STONE", -4, -8, 8, 8, "#e0c78a", "#a8895a", "#4a3a24");
  polygonPath(ctx, [
    [-4, -4],
    [4, -6 - jawSpread * 0.4],
    [11, -2 - jawSpread],
    [12, 1],
    [11, 2 + jawSpread],
    [4, 5 + jawSpread * 0.4],
    [-4, 4],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // Zigzag teeth along both jaws.
  ctx.fillStyle = "#f4ead0";
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const tx = 2 + t * 8;
    ctx.beginPath();
    ctx.moveTo(tx, -1 - jawSpread * (1 - t * 0.3));
    ctx.lineTo(tx + 1.4, -1 - jawSpread * (1 - t * 0.3) + 1.6);
    ctx.lineTo(tx - 0.3, -1 - jawSpread * (1 - t * 0.3) + 1.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, 1 + jawSpread * (1 - t * 0.3));
    ctx.lineTo(tx + 1.4, 1 + jawSpread * (1 - t * 0.3) - 1.6);
    ctx.lineTo(tx - 0.3, 1 + jawSpread * (1 - t * 0.3) - 1.6);
    ctx.fill();
  }

  // Energy glowing faintly inside the open throat.
  glowBlob(ctx, 6, 0, (4 + damageIntensity * 2 + jawOpen * 2) * (enraged ? 1.3 : 1), color);

  // No proper eyes — a single dim buried socket, purely predatory.
  drawEye(ctx, -2, -2, 0.7, "#2a2016", false);
  ctx.restore();

  // Tail tip trailing behind, half-buried.
  ctx.strokeStyle = "#8a7048";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, 4);
  ctx.quadraticCurveTo(-20, 5 + idleSway(timeMs, 0, 900, 1), -23, 3 + idleSway(timeMs, 1, 900, 1));
  ctx.stroke();

  // Loose sand kicked up around the base — sparse, grounded, never floating high.
  for (let i = 0; i < 4; i++) {
    const t = ((timeMs / 1100 + i / 4) % 1 + 1) % 1;
    ctx.globalAlpha = (1 - t) * 0.35;
    ctx.fillStyle = "#c9ab6e";
    ctx.beginPath();
    ctx.arc(-6 + i * 5, 9 - t * 4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
};

registerBossCreature(["sand-devourer"], drawSandDevourer);
