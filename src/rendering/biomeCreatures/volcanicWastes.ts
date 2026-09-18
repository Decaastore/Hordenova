import { drawContactShadow } from "../lighting";
import { breathe, gaitBounce, gaitPhase, glowBlob, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Volcanic Wastes' Molten Colossus (wave 50).
 * Deliberately NOT a recolor of Ashen Colossus (`ashenValley.ts`) — that
 * creature is a gaunt, ash-grey ancestral husk with an exposed torn chest.
 * Molten Colossus is the opposite kind of "big rock creature": a squat,
 * wide, extremely heavy mineral mass that never fully cooled. Its body is
 * built from several separate angular plate segments that do NOT meet
 * flush — the gaps between them glow with magma, so the heat visibly
 * lives INSIDE the rock rather than being a crack painted on its surface.
 * No visible neck (head fused into the shoulder mass) and short stump
 * limbs read as "mass over reach", the opposite of Hollow Warden's tall,
 * narrow, hollow silhouette.
 */
const MOLTEN_STRIDE = 24;
const drawMoltenColossus: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, MOLTEN_STRIDE);
  const stomp = gaitBounce(phase, speedRatio, 1.6);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const heat = 0.55 + 0.45 * Math.sin(timeMs / (enraged ? 220 : 480));

  drawContactShadow(ctx, 18, 8, 0.5);
  ctx.save();
  ctx.translate(0, -stomp * 1.2);

  // Short, thick stump legs — mass over reach.
  for (const [lx, offset] of [[-8, 0], [8, Math.PI]] as const) {
    const swing = Math.sin(phase + offset) * 0.8 * speedRatio;
    ctx.fillStyle = materialFill(ctx, "STONE", lx, 6, lx, 15, "#5a4c42", "#2e251e", "#120e0a");
    polygonPath(ctx, [[lx - 3, 6], [lx + 3, 6], [lx + 3.6 + swing, 15], [lx - 3.6 + swing, 15]]);
    ctx.fill();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 900, enraged ? 0.028 : 0.016));

  // Body plates — 4 separate angular segments with visible gaps between
  // them, each gap glowing like exposed magma seams.
  const plateColorLight = "#6a5850";
  const plateColorDark = "#150f0b";
  const plates: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[-16, 4], [-14, -8], [-6, -10], [-6, 4]],
    [[-4, -10], [4, -11], [4, 4], [-4, 4]],
    [[6, -10], [14, -8], [16, 4], [6, 4]],
    [[-13, 4], [13, 4], [10, 11], [-10, 11]],
  ];
  for (const plate of plates) {
    ctx.fillStyle = materialFill(ctx, "STONE", plate[0]![0], plate[0]![1], plate[2]![0], plate[2]![1], plateColorLight, "#382d26", plateColorDark);
    polygonPath(ctx, plate);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Magma glowing through the seams between plates — wide gaps, not thin
  // cracks: the heat reads as living inside the rock, not decorating it.
  ctx.save();
  ctx.globalAlpha = 0.55 + heat * 0.35 + damageIntensity * 0.2;
  const magmaGrad = ctx.createLinearGradient(0, -10, 0, 4);
  magmaGrad.addColorStop(0, "#ffdf8a");
  magmaGrad.addColorStop(0.5, color);
  magmaGrad.addColorStop(1, "#5a1a08");
  ctx.fillStyle = magmaGrad;
  polygonPath(ctx, [[-6, -9], [-4, -10], [-4, 4], [-6, 4]]);
  ctx.fill();
  polygonPath(ctx, [[4, -10], [6, -9], [6, 4], [4, 4]]);
  ctx.fill();
  ctx.globalAlpha = 0.4 + heat * 0.3;
  polygonPath(ctx, [[-13, 4], [13, 4], [12, 6.5], [-12, 6.5]]);
  ctx.fill();
  ctx.restore();

  // Core glow bleeding faintly through the central seam.
  glowBlob(ctx, 0, -3, (9 + damageIntensity * 4) * (enraged ? 1.25 : 1), color);

  // Fused head — no neck, a single glowing fissure standing in for a face.
  ctx.fillStyle = materialFill(ctx, "STONE", -6, -18, 6, -9, "#6a5850", "#382d26", "#150f0b");
  polygonPath(ctx, [[-6, -10], [-4, -17], [4, -17], [6, -10], [3, -8], [-3, -8]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.6 + heat * 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-3.5, -13);
  ctx.lineTo(0, -11.5);
  ctx.lineTo(3.5, -13.5);
  ctx.stroke();
  ctx.restore();

  // Short, thick stump arms.
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", side * 14, -4, side * 18, 4, "#5a4c42", "#2e251e", "#120e0a");
    polygonPath(ctx, [[side * 12, -6], [side * 19, -3], [side * 20, 3], [side * 13, 5]]);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
};

registerBossCreature(["molten-colossus"], drawMoltenColossus);
