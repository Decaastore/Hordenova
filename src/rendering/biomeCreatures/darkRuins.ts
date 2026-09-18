import { drawContactShadow, rimHighlight } from "../lighting";
import { breathe, gaitBounce, gaitPhase, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Dark Ruins' Grave Tyrant (wave 110). Not a
 * generic skeleton: a dominant, upright funerary sovereign — wide ornate
 * pauldrons wider than any other boss in this batch, a torn breastplate
 * revealing real bone underneath (jagged/organic, unlike Hollow Warden's
 * clean geometric cavity), a tattered burial cloak that lags behind the
 * body's own motion, and a broken crown with one snapped spike. The wide
 * planted stance and forward-leaning chest are what read as "Tyrant" even
 * standing still, before the cloak or crown are even noticed.
 */
const GRAVE_STRIDE = 22;
const drawGraveTyrant: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, GRAVE_STRIDE);
  const stomp = gaitBounce(phase, speedRatio, 1.1);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 280 : 640));

  drawContactShadow(ctx, 15, 6.5, 0.46);
  ctx.save();
  ctx.translate(0, -stomp * 0.7);

  // Tattered cloak, drawn FIRST so it hangs behind the body — three ragged
  // tapered panels, each lagging the body's own idle sway on its own delay.
  for (const [ox, delay, len] of [[-3, 0, 20], [1, 260, 23], [5, 500, 19]] as const) {
    const sway = idleSway(timeMs - delay, ox, 2600, 3.2);
    ctx.fillStyle = materialFill(ctx, "CHARRED", ox, -6, ox + sway, 6 + len, "#3a2c3a", "#1c1420", "#08060a");
    ctx.globalAlpha = 0.9;
    polygonPath(ctx, [[ox - 4, -8], [ox + 4, -8], [ox + 5 + sway, 6 + len], [ox - 5 + sway, 6 + len]]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Wide planted stance — thick legs, feet apart.
  for (const [lx, offset] of [[-7, 0], [7, Math.PI]] as const) {
    const swing = Math.sin(phase + offset) * 1 * speedRatio;
    ctx.strokeStyle = materialFill(ctx, "METAL", lx, 6, lx + swing, 16, "#8a8a92", "#403f48", "#1a1a20");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, 6);
    ctx.lineTo(lx + swing, 16);
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1300, enraged ? 0.026 : 0.016));

  // Wide ornate pauldrons — the widest shoulder silhouette in this batch.
  const armorGrad = materialFill(ctx, "METAL", -13, -14, 13, -6, "#9a9aa2", "#48474e", "#1a1920");
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = armorGrad;
    polygonPath(ctx, [[side * 4, -13], [side * 13, -11], [side * 14, -4], [side * 8, -3], [side * 4, -6]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Chest breastplate, torn open — jagged, organic edges around exposed bone.
  ctx.fillStyle = materialFill(ctx, "METAL", -8, -12, 8, 6, "#8a8a92", "#3a3940", "#161519");
  polygonPath(ctx, [[-8, -10], [8, -10], [9, -1], [3, 6], [-3, 6], [-9, -1]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The tear itself.
  ctx.fillStyle = materialFill(ctx, "BONE", -3, -6, 3, 2, "#e8e0cc", "#b8ae94", "#786e56");
  polygonPath(ctx, [[-3, -6], [2, -7], [4, -3], [1, 1], [-2, 2], [-4, -2]]);
  ctx.fill();
  ctx.strokeStyle = "#2a2620";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-2 + i * 2, -5);
    ctx.lineTo(-2 + i * 2, 0);
    ctx.stroke();
  }
  glowBlob(ctx, -0.5, -3, (5 + damageIntensity * 2.5) * (enraged ? 1.25 : 1), color);
  ctx.globalAlpha = 0.5 + 0.3 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-0.5, -3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head — a broken crown, one spike snapped off.
  ctx.save();
  ctx.translate(0, -17);
  ctx.fillStyle = materialFill(ctx, "BONE", -3, -3, 3, 3, "#d8d0ba", "#8a8270", "#4a463c");
  polygonPath(ctx, [[-3, -1], [-2, -4], [2, -4], [3, -1], [2, 3], [-2, 3]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (const [cx, full] of [[-2, true], [0, false], [2, true]] as const) {
    if (!full) continue;
    ctx.fillStyle = "#6a6258";
    polygonPath(ctx, [[cx - 0.9, -4], [cx + 0.9, -4], [cx, -8]]);
    ctx.fill();
  }
  // The broken stub, deliberately short — asymmetric crown.
  ctx.fillStyle = "#4a463c";
  polygonPath(ctx, [[-1, -4], [1, -4], [0.4, -5.4]]);
  ctx.fill();
  ctx.restore();

  rimHighlight(ctx, () => { ctx.moveTo(-13, -11); ctx.lineTo(-4, -13); }, "#d8d4e8", 0.8, 0.45 + 0.2 * pulse);

  ctx.restore();
  ctx.restore();
};

registerBossCreature(["grave-tyrant"], drawGraveTyrant);
