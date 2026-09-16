import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { breathe, drawEye, drawFlightShadow, flightLift, glowBlob, idleSway, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Cemitério dos Colossos (waves 151-170) — a field of ancient giant-
 * creature remains. FASE 2 art pass: Bone Stalker reads as an open, gaunt
 * bone frame (mostly negative space between ribs/limbs); Ribcrawler hides
 * its body entirely under a low arched ribcage canopy; Gravewing is a
 * true bone-and-membrane flier. Three different silhouettes even with
 * color removed — none of them share a body plan.
 */

// Bone Stalker — a gaunt, open bone-frame quadruped predator: thin
// skeletal limbs with visible knuckle joints, a real ribcage (struts, not
// a filled torso), a fanged skull with empty eye sockets faintly lit.
const drawBoneStalker: EnemyDrawFn = (ctx, theme, timeMs) => {
  const stridePhase = timeMs / 150;
  drawContactShadow(ctx, 10, 3.6, 0.28);

  const legs: ReadonlyArray<readonly [number, number, number]> = [
    [-6, -2, 0],
    [-6, 2, Math.PI],
    [5, -2, Math.PI],
    [5, 2, 0],
  ];
  for (const [hx, hy, offset] of legs) {
    const swing = Math.sin(stridePhase + offset);
    const side = hy > 0 ? 1 : -1;
    const kneeX = hx + swing * 2.4;
    const kneeY = hy + side * 3.5;
    const footX = hx + swing * 4.6;
    const footY = hy + side * 7.5;
    const boneGrad = materialFill(ctx, "BONE", hx, hy, footX, footY, "#e8e0cc", theme.body, theme.dark);
    limbSegment(ctx, hx, hy, kneeX, kneeY, 1.1, 0.7, boneGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 0.7, 0.5, boneGrad);
    jointBulge(ctx, kneeX, kneeY, 1.1, "#d8d0ba");
    jointBulge(ctx, hx, hy, 1.2, "#d8d0ba");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1100, 0.02));

  // Spine + open ribcage — struts, not a filled body mass.
  ctx.strokeStyle = materialFill(ctx, "BONE", -8, -2, 9, -2, "#e8e0cc", theme.body, theme.dark);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.lineTo(9, -2);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 3.4;
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.quadraticCurveTo(x, 2.4, x - 1.5, 4);
    ctx.stroke();
  }
  jointBulge(ctx, -8, -1, 1, "#d8d0ba");

  // fanged skull with dim eye-socket glow.
  ctx.fillStyle = materialFill(ctx, "BONE", 9, -4, 15, 1, "#e8e0cc", theme.body, theme.dark);
  polygonPath(ctx, [
    [9, -4],
    [15, -3],
    [15, 0],
    [11, 1],
    [8, -1],
  ]);
  ctx.fill();
  drawEye(ctx, 12, -2, 0.7, theme.accent, true);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(13.5, -1);
  ctx.lineTo(15, 1.2);
  ctx.moveTo(12.5, -0.6);
  ctx.lineTo(13.6, 1.6);
  ctx.stroke();

  // whip-like bone tail
  ctx.strokeStyle = theme.body;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.quadraticCurveTo(-12, 0 + idleSway(timeMs, 0, 500, 2), -15, -2 + idleSway(timeMs, 1, 500, 2));
  ctx.stroke();

  ctx.restore();
};

// Ribcrawler — its whole body hidden beneath a low arched ribcage canopy,
// many short crawling legs peeking out from underneath.
const drawRibcrawler: EnemyDrawFn = (ctx, theme, timeMs) => {
  const legPhase = timeMs / 110;
  drawContactShadow(ctx, 11, 4, 0.34);

  for (let i = 0; i < 6; i++) {
    const x = -8 + i * 3.2;
    const wig = Math.sin(legPhase + i) * 1.6;
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + wig, 6.5);
    ctx.stroke();
  }

  // hidden body silhouette peeking at the front, low and dark.
  ctx.fillStyle = materialFill(ctx, "HIDE", -6, 0, 9, 3, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [-9, 3],
    [-7, 0],
    [8, -1],
    [10, 3],
  ]);
  ctx.fill();

  // arched ribcage canopy — the silhouette's defining shape.
  const boneGrad = materialFill(ctx, "BONE", -7, -8, 8, 2, "#e8e0cc", theme.body, theme.dark);
  for (let i = 0; i < 5; i++) {
    const x = -7 + i * 3.6;
    ctx.strokeStyle = boneGrad;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.quadraticCurveTo(x, -8, x + 1.8, -6);
    ctx.stroke();
  }
  // spine ridge along the top of the canopy
  ctx.strokeStyle = "#d8d0ba";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -6.4);
  ctx.lineTo(6, -6.8);
  ctx.stroke();

  // small hunched head peeking from under the shell.
  ctx.fillStyle = materialFill(ctx, "HIDE", 8, -2, 15, 3, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [9, 0],
    [14, -1],
    [13, 2],
    [9, 2.5],
  ]);
  ctx.fill();
  drawEye(ctx, 12, 0.5, 0.6, theme.accent, false);
};

// Gravewing — flies on membrane stretched over a bone-strut wing frame; a
// true aerial silhouette with a skull head and hooked wing-claws.
const drawGravewing: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 4.1, 6, 1600);
  drawFlightShadow(ctx, lift, 6, 10, 4);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 180);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    // bone struts
    ctx.strokeStyle = materialFill(ctx, "BONE", 0, 0, 13, -3 - flap * 3, "#e8e0cc", theme.body, theme.dark);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -3 - flap * 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(13, 1 - flap * 2);
    ctx.stroke();
    // translucent membrane between struts
    ctx.fillStyle = theme.dark;
    ctx.globalAlpha = 0.72;
    polygonPath(ctx, [
      [0, 0],
      [7, -3 - flap * 3],
      [13, 1 - flap * 2],
      [8, 3],
      [3, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    // hooked wing-claw at the tip
    ctx.strokeStyle = "#d8d0ba";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(13, 1 - flap * 2);
    ctx.lineTo(15, -0.5 - flap * 2);
    ctx.stroke();
    ctx.restore();
  }
  // skull head
  ctx.fillStyle = materialFill(ctx, "BONE", -3, -3, 4, 3, "#e8e0cc", theme.body, theme.dark);
  polygonPath(ctx, [
    [-2, -2],
    [3, -2],
    [2, 3],
    [-2, 3],
  ]);
  ctx.fill();
  drawEye(ctx, 1.4, -1, 0.6, theme.accent, true);
  ctx.restore();
};

registerEnemyRenderers({
  BONE_STALKER: drawBoneStalker,
  RIBCRAWLER: drawRibcrawler,
  GRAVEWING: drawGravewing,
});

// Colossus Spawn — a young, LIVING giant: stone-grey hide over a heavy
// brutish frame, a chest plate of inherited ancestral bone, oversized
// fists on volumetric arms, a hunched aggressive charge stance. The main
// boss adds a second bone-crest ridge and thicker fused shoulder armor —
// a genuinely bulkier anatomy, not the same body scaled up.
const drawColossusSpawn: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.6;
  const rage = enraged ? 1.4 : 1;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const stomp = Math.abs(Math.sin(timeMs / (enraged ? 260 : 480)));

  drawContactShadow(ctx, 19 * scale, 8 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -stomp * 1.5);

  // Thick stomping legs — volumetric.
  for (const [lx, sign] of [
    [-5, -1],
    [5, 1],
  ] as const) {
    const kneeX = lx + sign * stomp * 2;
    const kneeY = 10;
    const footX = lx + sign * (2 + stomp * 2);
    const footY = 15;
    const legGrad = materialFill(ctx, "HIDE", lx, 6, footX, footY, "#8a857a", "#4a463e", "#221f1a");
    limbSegment(ctx, lx, 6, kneeX, kneeY, 3, 2.4, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 2.4, 2.8, "#221f1a");
    jointBulge(ctx, kneeX, kneeY, 2, "#2a2720");
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 900, enraged ? 0.03 : 0.015));

  // Hunched torso, stone-grey hide.
  const bodyGrad = materialFill(ctx, "HIDE", -11, -15, 11, 8, "#6a655a", "#3a362e", "#161410");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -15],
    [9, -10],
    [11, 2],
    [6, 8],
    [-6, 8],
    [-11, 2],
    [-9, -10],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Exposed inherited ribcage plating on the chest — real bone material, distinct from the hide body.
  ctx.strokeStyle = materialFill(ctx, "BONE", -6, -6, 6, 6, "#e8e0cc", "#c8c0a8", "#8a8270");
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const y = -6 + i * 3.4;
    ctx.beginPath();
    ctx.moveTo(-6, y);
    ctx.quadraticCurveTo(0, y + 2.4, 6, y);
    ctx.stroke();
  }
  drawEnergyCrack(ctx, -6, 2, -2, -3, 3, -7, color, 0.4 + damageIntensity * 0.5 + (enraged ? 0.25 : 0));

  // Oversized fists on volumetric upper arms.
  for (const [fx, sign] of [
    [-11, -1],
    [11, 1],
  ] as const) {
    const swingY = -3 + Math.sin(timeMs / 300 + sign) * 2;
    const armGrad = materialFill(ctx, "HIDE", 0, -6, fx, swingY, "#8a857a", "#4a463e", "#221f1a");
    limbSegment(ctx, fx * 0.55, -6, fx, swingY, 2.4, 3, armGrad);
    ctx.save();
    ctx.translate(fx, swingY);
    const fistGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5);
    fistGrad.addColorStop(0, "#7a7568");
    fistGrad.addColorStop(1, "#2a2720");
    ctx.fillStyle = fistGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 4.4 * rage, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Small feral head, low-set, jaw jutting forward, no eyes (pure brute instinct read).
  ctx.fillStyle = materialFill(ctx, "HIDE", -4, -18, 6, -9, "#6a655a", "#3a362e", "#161410");
  polygonPath(ctx, [
    [-3, -15],
    [4, -16],
    [6, -12],
    [2, -9],
    [-4, -10],
  ]);
  ctx.fill();
  glowBlob(ctx, 1, -13, 3, color);

  if (isMain) {
    // Main-boss-only: a heavier bone-crest ridge plus fused shoulder armor — a genuinely bulkier anatomy.
    ctx.fillStyle = materialFill(ctx, "STONE", -9, -12, 9, -6, "#8a8072", "#4a463e", "#221f1a");
    polygonPath(ctx, [
      [-10, -9],
      [-7, -13],
      [7, -13],
      [10, -9],
      [7, -6],
      [-7, -6],
    ]);
    ctx.fill();
    for (const [sx, sy, ang] of [
      [-4, -16, -2.6],
      [3, -17, -0.5],
      [0, -19, -1.57],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = materialFill(ctx, "BONE", 0, 0, 0, -9, "#e8e0cc", "#c8c0a8", "#8a8270");
      polygonPath(ctx, [
        [-1.6, 0],
        [1.6, 0],
        [0, -9],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["colossus-spawn", "ancestral-colossus"], drawColossusSpawn);
