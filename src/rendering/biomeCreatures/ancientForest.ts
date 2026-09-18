import { drawContactShadow, drawFloatingMotes, rimHighlight } from "../lighting";
import { breathe, gaitBounce, gaitPhase, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — Ancient Forest's Hollow Warden (waves 1-30) was
 * the single most-seen boss in the game (every player's first) and, until
 * now, rendered through the shared generic "Void Colossus" body every other
 * un-redesigned original boss also used — see registry.test.ts's old
 * "original 6 biomes... fall through to the shared Colossus body" contract,
 * now replaced by this real bespoke registration.
 *
 * Concept: a GUARDIAN, not a monster — the "Hollow" in its name is a
 * structural fact of its body, not a color. Its torso is deliberately left
 * UNFILLED between an upper shoulder-yoke plate and a lower hip plate: the
 * gap between them, with the accent-colored core floating inside it and a
 * few motes drifting out, IS the cavity. Nothing is painted over it to fake
 * volume — the emptiness is the point. Asymmetric shoulder plates (one
 * taller and cracked) and a featureless, slightly downward-tilted helm read
 * as an ancient sentinel that has stood still for a very long time, not an
 * active predator. Arms are thin fused stubs (no hands) at rest.
 */
const HOLLOW_STRIDE = 20;
const drawHollowWarden: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, HOLLOW_STRIDE);
  const stomp = gaitBounce(phase, speedRatio, 1.2);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 260 : 620));

  drawContactShadow(ctx, 11, 5.5, 0.44);
  ctx.save();
  ctx.translate(0, -stomp * 0.8);

  // Thin stump legs, minimal swing — a guardian's controlled, heavy pace.
  for (const [lx, offset] of [[-4, 0], [4, Math.PI]] as const) {
    const swing = Math.sin(phase + offset) * 1.1 * speedRatio;
    const legGrad = materialFill(ctx, "STONE", lx, 6, lx + swing, 17, "#8a8578", "#4a463c", "#221f18");
    ctx.strokeStyle = legGrad;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, 6);
    ctx.lineTo(lx + swing * 0.6, 12);
    ctx.lineTo(lx + swing, 17);
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1500, 0.015));

  // Fused arm stubs, resting — thin, no hands.
  for (const side of [-1, 1] as const) {
    ctx.strokeStyle = materialFill(ctx, "STONE", side * 8, -10, side * 8, 2, "#8a8578", "#453f34", "#1c1914");
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * 8, -9);
    ctx.lineTo(side * 9.5 + idleSway(timeMs, side, 2600, 0.6), 2);
    ctx.stroke();
  }

  // Lower hip plate.
  const hipGrad = materialFill(ctx, "STONE", -7, 0, 7, 6, "#9a9488", "#4a453a", "#221f18");
  ctx.fillStyle = hipGrad;
  polygonPath(ctx, [[-6, 0], [6, 0], [7, 5], [3, 7], [-3, 7], [-7, 5]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Thin spine strut bridging the cavity — the ONLY thing connecting the
  // two plates, so the space either side of it reads as genuinely empty.
  ctx.strokeStyle = "#332f26";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // --- The cavity: the core sits IN the gap between hip and shoulder
  // plates, not painted over a filled chest. ---
  glowBlob(ctx, 0, -4, (7 + damageIntensity * 3) * (enraged ? 1.3 : 1), color);
  ctx.save();
  ctx.globalAlpha = 0.75 + 0.2 * pulse;
  ctx.fillStyle = color;
  polygonPath(ctx, [[0, -8], [2.6, -4], [0, 0], [-2.6, -4]]);
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const t = ((timeMs / 1300 + i / 3) % 1 + 1) % 1;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-2 + i * 2, -4 - t * 6, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Upper shoulder-yoke — deliberately asymmetric: the left plate stands
  // taller and carries a crack, the right plate is lower/plain.
  const yokeGrad = materialFill(ctx, "STONE", -9, -16, 9, -8, "#9a9488", "#4a453a", "#221f18");
  ctx.fillStyle = yokeGrad;
  polygonPath(ctx, [[-9, -8], [-8, -16], [-2, -18], [-2, -8]]);
  ctx.fill();
  ctx.stroke();
  polygonPath(ctx, [[2, -8], [2, -15], [7, -14], [9, -8]]);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-7, -15);
  ctx.lineTo(-5, -11);
  ctx.lineTo(-6.5, -8.5);
  ctx.stroke();
  rimHighlight(ctx, () => { ctx.moveTo(-8, -16); ctx.lineTo(-2, -18); }, "#e8e4d8", 0.8, 0.5 + 0.2 * pulse);

  // Featureless helm, tilted slightly down — a sentinel, not a hunter.
  ctx.save();
  ctx.translate(0, -18);
  ctx.rotate(0.12);
  ctx.fillStyle = materialFill(ctx, "STONE", -4, -4, 4, 4, "#a8a296", "#524d40", "#221f18");
  polygonPath(ctx, [[-4, -3], [0, -5], [4, -3], [3, 3], [0, 4], [-3, 3]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.35 + 0.25 * pulse;
  polygonPath(ctx, [[-1.6, -0.5], [1.6, -0.5], [0.8, 1.6], [-0.8, 1.6]]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.restore();

  // Motes drifting out of the cavity — the sentinel's own contained energy,
  // never a decal placed on top of it.
  drawFloatingMotes(ctx, 0, -5, timeMs, 2.4, { count: 4, spreadX: 3.5, spreadY: 10, color, periodMs: 2600, size: 0.9 });

  ctx.restore();
};

registerBossCreature(["hollow-warden"], drawHollowWarden);
