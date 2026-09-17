import { drawContactShadow, drawEnergyCrack, rimHighlight } from "../lighting";
import { bankAngle, breathe, drawFlightShadow, flightLift, gaitBounce, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath, wingBeat } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Vale das Cinzas Mortas (waves 251-270) — an ancient-catastrophe
 * wasteland, deliberately NOT a volcanic biome: no lava, no flame
 * monsters. Everything here reads as charred/petrified REMAINS — cold
 * ash-grey, dull ember accents used sparingly, never a full-body fire
 * glow. FASE 2: Petrified Stalker mixes two materials (HIDE + STONE) on
 * the SAME body to show the petrification spreading; Ash Hound uses the
 * CHARRED material recipe (dry, matte, porous) instead of a flat brown.
 */

// Ash Hound — quadruped predator, hide partially charred (CHARRED
// material), thin smoke wisping off its back, volumetric jointed legs.
const ASH_HOUND_STRIDE = 11;
const drawAshHound: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, ASH_HOUND_STRIDE);
  drawContactShadow(ctx, 10, 4, 0.32);

  for (let i = 0; i < 4; i++) {
    const phase = gaitSwing(stridePhase, speedRatio, 1, i % 2 === 0 ? 0 : Math.PI);
    const baseX = i < 2 ? -6 : 6;
    const kneeX = baseX + phase * 1.2;
    const kneeY = 3.5;
    const footX = baseX + phase * 2.4;
    const footY = 7;
    const legGrad = materialFill(ctx, "CHARRED", baseX, 0, footX, footY, "#8a7c6c", theme.body, theme.dark);
    limbSegment(ctx, baseX, 0, kneeX, kneeY, 1.4, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.6, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 0.8, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 950, 0.02));
  const bodyGrad = materialFill(ctx, "CHARRED", -9, -5, 10, 3, "#8a7c6c", theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-6, -5],
    [5, -5],
    [10, -1],
    [8, 3],
    [-8, 3],
  ]);
  ctx.fill();
  // charred cracked patches — thin dark fissures with a faint ember tint.
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(-1, -1);
  ctx.lineTo(-2, 1);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [9, -2],
    [14, -1.5],
    [13, 1],
    [9, 1.5],
  ]);
  ctx.fill();
  ctx.globalAlpha = 0.28 + 0.12 * Math.sin(timeMs / 400);
  ctx.fillStyle = "#999089";
  ctx.beginPath();
  ctx.arc(-1, -7 - Math.sin(timeMs / 500) * 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
};

// Petrified Stalker — a deer-like stalker whose hindquarters have already
// turned to stone while the forequarters are still living hide — the two
// materials meeting mid-body is the whole point of this design.
const PETRIFIED_STALKER_STRIDE = 13;
const drawPetrifiedStalker: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, PETRIFIED_STALKER_STRIDE);
  const stride = gaitSwing(stridePhase, speedRatio, 1);
  drawContactShadow(ctx, 10, 4.5, 0.34);

  // living forelegs (hide)
  for (const [hx, sign] of [
    [3, 1],
    [7, -1],
  ] as const) {
    const kneeX = hx - sign * stride * 1.6;
    const kneeY = 4;
    const footX = hx - sign * stride * 3.2;
    const footY = 8;
    const legGrad = materialFill(ctx, "HIDE", hx, 0, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, hx, 0, kneeX, kneeY, 1.3, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.7, theme.dark);
  }
  // petrified stone hindlegs
  for (const [hx, sign] of [
    [-6, 1],
    [-3, -1],
  ] as const) {
    const kneeX = hx + sign * stride * 1.6;
    const kneeY = 4;
    const footX = hx + sign * stride * 3.2;
    const footY = 8;
    const legGrad = materialFill(ctx, "STONE", hx, 0, footX, footY, "#8a8278", "#5a544a", "#2c2822");
    limbSegment(ctx, hx, 0, kneeX, kneeY, 1.5, 1.3, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.3, 1.4, "#2c2822");
  }

  // hindquarters — stone, angular.
  ctx.fillStyle = materialFill(ctx, "STONE", -9, -6, -1, 3, "#8a8278", "#5a544a", "#2c2822");
  polygonPath(ctx, [
    [-8, -1],
    [-6, -6],
    [-1, -6],
    [-2, 2],
    [-8, 3],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-5, 0);
  ctx.stroke();

  // forequarters — still living hide.
  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1000, 0.015));
  ctx.fillStyle = materialFill(ctx, "HIDE", -1, -6, 10, 3, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [-1, -6],
    [6, -6],
    [10, -2],
    [8, 3],
    [-2, 2],
  ]);
  ctx.fill();
  ctx.strokeStyle = "#9a9288";
  ctx.lineWidth = 1;
  for (const s of [1, -1] as const) {
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(6 + s, -10 + s);
    ctx.stroke();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [8, -4],
    [12, -3],
    [11, 0],
    [8, -1],
  ]);
  ctx.fill();
  ctx.restore();
};

// Cinderwing — flies on damaged wings shedding ash particles, erratic path.
const drawCinderwing: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lift = flightLift(timeMs, 8.2, 5.5, 1300);
  drawFlightShadow(ctx, lift, 5.5, 8, 3.2);
  ctx.save();
  ctx.translate(0, -lift);
  ctx.rotate(bankAngle(locomotion?.turnRate ?? 0, 45, 0.6));
  const flap = wingBeat(timeMs, 0, speedRatio, 140);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = materialFill(ctx, "CHARRED", 0, 0, 9, -1 - flap * 5, "#8a7c6c", theme.body, theme.dark);
    ctx.globalAlpha = 0.72;
    polygonPath(ctx, [
      [0, 0],
      [7, -4 - flap * 5],
      [9, -1],
      [4, 2],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    polygonPath(ctx, [
      [6, -1 - flap * 3],
      [8, 0 - flap * 2],
      [6.5, 1],
    ]);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const t = (timeMs / 300 + i * 7) % 10;
    ctx.globalAlpha = Math.max(0, 0.5 - t * 0.05);
    ctx.fillStyle = "#a89a88";
    ctx.beginPath();
    ctx.arc(-4 - t, 1 + Math.sin(t) * 1.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

registerEnemyRenderers({
  ASH_HOUND: drawAshHound,
  PETRIFIED_STALKER: drawPetrifiedStalker,
  CINDERWING: drawCinderwing,
});

/**
 * Ashen Colossus — an ancestral mass of petrified, half-collapsed remains:
 * not a stone golem, not a fire elemental. Its own anatomy: a single massive
 * dragging forelimb on one side (the silhouette-breaker — no living creature
 * this shape reads as "just a bigger Brute"), a hunched spine of broken
 * stone plates, and a torso torn open at the chest where the original
 * organic mass has collapsed inward around its own molten core — the core
 * is something the body FAILED to contain, not a decoration bolted onto it.
 * `color` (biome accent) only ever appears inside the cavity/cracks — the
 * body itself stays dull charcoal/ash, lit with a real warm rim so it reads
 * as a silhouette even with the glow and color removed.
 */
// FASE 4 (Boss Identity Pass): full silhouette/material/gait rebuild — the
// previous version was a symmetric quadruped, roughly Brute-body-sized, with
// almost no light/dark contrast (a single mid-grey polygon), which is
// exactly why it read as "a bigger Brute" instead of a bespoke Colossus (see
// Full Scene Visual Audit P0 #1). Fixes, in order of the brief's own
// priority: (1) silhouette first — asymmetric single dragging forelimb +
// hunched broken-spine torso + fused low head, no clean bilateral symmetry;
// (2) real proportion — legs now carry a third of the total height instead
// of a third of the TORSO height, so the stance reads as load-bearing, not
// stubby; (3) material contrast — a genuine lit "hot ash" tone plus
// `rimHighlight` on every top/light-facing edge, so the body pops off a dark
// biome instead of blending into it; (4) the core sits inside a torn-open
// chest cavity it visibly escapes from, not a dot painted on the chest.
const drawAshenColossus: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lurchPhase = gaitPhase(locomotion?.distance ?? 0, 24);
  const sway = gaitSwing(lurchPhase, speedRatio, 1.4);
  // A heavy footfall compress — the torso briefly settles/squashes twice per
  // stride (real weight landing), then releases, instead of a pure sideways
  // sway (spec section 8: "o jogador precisa sentir MASSA"). Zero at a full
  // stop, exactly like every other gait-driven value here.
  const stomp = gaitBounce(lurchPhase, speedRatio, 0.05);
  const litAsh = "#a89a86";
  const midAsh = "#3c352d";
  const deepAsh = "#120e0a";

  drawContactShadow(ctx, 24, 10, 0.55);

  // Dust kicked up at the planting foot — reuses the existing glow primitive
  // with a neutral ash tone instead of the core color, peaking exactly when
  // a foot lands (stomp near its max) and fading otherwise. No pooled
  // particle state, fully procedural like every other creature VFX here.
  const footPulse = Math.max(0, Math.sin(lurchPhase * 2)) ** 6 * speedRatio;
  if (footPulse > 0.05) {
    glowBlob(ctx, sway * 2.2, 15, 7 * footPulse, "rgba(170,158,140,0.5)");
  }

  ctx.save();
  ctx.translate(sway, 0);
  ctx.scale(1, 1 - stomp);

  // Hind legs — thick, load-bearing, genuinely long relative to the torso
  // (feet plant at y=19, vs the torso's own -20..10 span) instead of the
  // stubby short legs the audit flagged.
  for (const [lx, phaseOffset, bulk] of [
    [-7, 0, 1] as const,
    [5, 2.3, 0.85] as const,
  ]) {
    const drag = gaitSwing(lurchPhase, speedRatio, 1.3, phaseOffset);
    const legGrad = materialFill(ctx, "STONE", lx, 7, lx, 19, litAsh, midAsh, deepAsh);
    limbSegment(ctx, lx, 7, lx + drag * 0.6, 13, 3.1 * bulk, 2.6 * bulk, legGrad);
    limbSegment(ctx, lx + drag * 0.6, 13, lx + drag, 19, 2.6 * bulk, 2.9 * bulk, deepAsh);
    jointBulge(ctx, lx + drag * 0.6, 13, 2 * bulk, deepAsh);
  }

  // The single massive dragging forelimb — the deliberate asymmetry break.
  // Reaches low and forward, well outside the torso's own bounding box, with
  // three blunt stone knuckles instead of a hand.
  const armDrag = gaitSwing(lurchPhase, speedRatio, 1.6, 3.1);
  const armGrad = materialFill(ctx, "STONE", 10, -8, 20, 12, litAsh, midAsh, deepAsh);
  limbSegment(ctx, 9, -6, 17 + armDrag, 4, 3.6, 3, armGrad);
  limbSegment(ctx, 17 + armDrag, 4, 15 + armDrag * 1.3, 13, 3, 3.4, deepAsh);
  jointBulge(ctx, 17 + armDrag, 4, 2.6, deepAsh);
  for (const [kx, ky] of [
    [12, 12],
    [16, 14],
    [19, 11],
  ] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", kx + armDrag * 1.3, ky - 2, kx + armDrag * 1.3, ky + 2, litAsh, midAsh, deepAsh);
    polygonPath(ctx, [
      [kx + armDrag * 1.3 - 1.6, ky - 1.6],
      [kx + armDrag * 1.3 + 1.6, ky - 1.6],
      [kx + armDrag * 1.3 + 1.3, ky + 1.8],
      [kx + armDrag * 1.3 - 1.3, ky + 1.8],
    ]);
    ctx.fill();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 2, 1050, 0.012));

  // Hunched torso — wide, top-heavy shoulders tapering to a narrow, twisted
  // waist (the "matéria carbonizada colapsando sobre si mesma" read), pulled
  // forward/down rather than standing upright.
  const bodyGrad = materialFill(ctx, "CHARRED", -14, -20, 8, 10, litAsh, midAsh, deepAsh);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-2, -21],
    [9, -16],
    [13, -4],
    [9, 6],
    [-1, 10],
    [-10, 5],
    [-14, -6],
    [-11, -16],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Warm rim light on the shoulder's top-left edge (matches LIGHT_DIRECTION)
  // — the single biggest fix for "blends into the dark background": this
  // gives the body a bright edge that reads as a silhouette even before any
  // color/VFX is considered.
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-11, -16);
      ctx.lineTo(-2, -21);
      ctx.lineTo(9, -16);
    },
    litAsh,
    1.6,
    0.65,
  );

  // Broken spine plates — uneven sizes/offsets (damaged, not a decorative
  // row) climbing the hunched back.
  for (const [px, py, w, h] of [
    [-6, -18, 3.2, 5] as const,
    [1, -20, 4, 6.5] as const,
    [7, -15, 2.6, 4] as const,
  ]) {
    ctx.fillStyle = materialFill(ctx, "STONE", px, py, px, py + h, litAsh, midAsh, deepAsh);
    polygonPath(ctx, [
      [px - w * 0.5, py + h],
      [px - w * 0.3, py],
      [px + w * 0.3, py - h * 0.15],
      [px + w * 0.5, py + h * 0.9],
    ]);
    ctx.fill();
  }

  // Torn-open chest cavity — a dark jagged hole the core sits INSIDE and
  // escapes from, not a circle painted on the surface.
  ctx.fillStyle = deepAsh;
  polygonPath(ctx, [
    [-5, -8],
    [1, -10],
    [6, -5],
    [4, 2],
    [-3, 3],
    [-7, -2],
  ]);
  ctx.fill();
  const coreRadius = 5.5 + damageIntensity * 3.5;
  glowBlob(ctx, -1, -3, coreRadius * (enraged ? 1.25 : 1), color);
  // Cracked cavity rim — thin bright edge so the hole itself reads as
  // physical geometry, not a flat dark patch.
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-5, -8);
      ctx.lineTo(1, -10);
      ctx.lineTo(6, -5);
    },
    "#5a4f42",
    1,
    0.5,
  );

  // Fissures radiating from the cavity through the surrounding plates — the
  // ONLY place the biome accent color shows outside the core itself.
  drawEnergyCrack(ctx, -5, -6, -9, -11, -12, -16, color, (0.34 + damageIntensity * 0.32 + (enraged ? 0.16 : 0)) * 0.85);
  drawEnergyCrack(ctx, 4, -3, 8, 1, 11, 6, color, (0.3 + damageIntensity * 0.28) * 0.85);
  drawEnergyCrack(ctx, 0, -9, 3, -15, 5, -19, color, (0.26 + damageIntensity * 0.24) * 0.85);

  // Low, fused head — no neck, jutting forward out of the shoulder mass,
  // with one intact horn and one broken stub (asymmetric, not a clean pair).
  ctx.fillStyle = materialFill(ctx, "STONE", -6, -22, 4, -14, litAsh, midAsh, deepAsh);
  polygonPath(ctx, [
    [-6, -18],
    [-3, -23],
    [4, -22],
    [5, -17],
    [1, -14],
    [-5, -15],
  ]);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-6, -18);
      ctx.lineTo(-3, -23);
      ctx.lineTo(4, -22);
    },
    litAsh,
    1.1,
    0.6,
  );
  // intact horn (left)
  ctx.fillStyle = deepAsh;
  polygonPath(ctx, [
    [-4, -22],
    [-6, -29],
    [-2, -23],
  ]);
  ctx.fill();
  // broken horn stub (right) — an asymmetric detail, not a mirrored pair.
  ctx.fillStyle = midAsh;
  polygonPath(ctx, [
    [2, -22],
    [4, -25],
    [4.5, -21.5],
  ]);
  ctx.fill();
  // a single ember-lit eye socket — restrained, not a bright glowing pair.
  ctx.fillStyle = "#0a0806";
  ctx.beginPath();
  ctx.ellipse(0, -18, 1.3, 0.9, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + damageIntensity * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -18, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // A crest plate over the brow — the clearest at-a-glance "this one
  // outranks the mini" tell besides raw scale (the mini-boss's own
  // silhouette below has no equivalent piece).
  ctx.fillStyle = materialFill(ctx, "STONE", -7, -26, 5, -21, litAsh, midAsh, deepAsh);
  polygonPath(ctx, [
    [-7, -22],
    [-2, -27],
    [5, -23],
    [3, -20],
    [-5, -20],
  ]);
  ctx.fill();

  ctx.restore();
  ctx.restore();
};

/**
 * Ashen Colossus, Spawn — shares material/theme/family with the main boss
 * (per spec section 14: same "linguagem", different creature) but reads as
 * its own thing: a low, hunched quadruped prowling on all four limbs rather
 * than the main boss's bipedal-hunched stance with its one massive dragging
 * arm. No crest, no horn, a single small plate instead of a spine row, and a
 * narrower chest crack around a visibly smaller core — a lesser, feral
 * offshoot, not "Boss at 0.6 scale".
 */
const drawAshenColossusSpawn: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lurchPhase = gaitPhase(locomotion?.distance ?? 0, 13);
  const litAsh = "#9c8f7c";
  const midAsh = "#332c26";
  const deepAsh = "#120e0a";

  drawContactShadow(ctx, 13, 5.5, 0.5);

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 900, 0.016));

  for (const [lx, ly, phaseOffset] of [
    [-6, -1, 0] as const,
    [-3, 3, 1.4] as const,
    [3, -2, 2.6] as const,
    [6, 2, 0.7] as const,
  ]) {
    const drag = gaitSwing(lurchPhase, speedRatio, 1, phaseOffset);
    const legGrad = materialFill(ctx, "STONE", lx, ly, lx, ly + 8, litAsh, midAsh, deepAsh);
    limbSegment(ctx, lx, ly, lx + drag * 0.7, ly + 5, 1.8, 1.5, legGrad);
    limbSegment(ctx, lx + drag * 0.7, ly + 5, lx + drag, ly + 9, 1.5, 1.7, deepAsh);
    jointBulge(ctx, lx + drag * 0.7, ly + 5, 1.1, deepAsh);
  }

  const bodyGrad = materialFill(ctx, "CHARRED", -9, -8, 8, 4, litAsh, midAsh, deepAsh);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, -3],
    [-4, -9],
    [6, -8],
    [9, -2],
    [6, 4],
    [-6, 4],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.lineTo(6, -8);
    },
    litAsh,
    1.2,
    0.6,
  );

  ctx.fillStyle = deepAsh;
  polygonPath(ctx, [
    [-2, -4],
    [2, -5],
    [4, -1],
    [1, 2],
    [-3, 1],
  ]);
  ctx.fill();
  const coreRadius = 2.8 + damageIntensity * 1.8;
  glowBlob(ctx, 0, -1.5, coreRadius * (enraged ? 1.25 : 1), color);
  drawEnergyCrack(ctx, -2, -3, -5, -6, -8, -8, color, (0.3 + damageIntensity * 0.28 + (enraged ? 0.14 : 0)) * 0.85);

  ctx.fillStyle = materialFill(ctx, "STONE", -3, -10, 2, -6, litAsh, midAsh, deepAsh);
  polygonPath(ctx, [
    [-1, -8],
    [3, -6],
    [1, -3],
    [-2, -4],
  ]);
  ctx.fill();

  // low, forward-jutting snout — no horns, no crest, deliberately smaller
  // and more feral-looking than the main boss's fused skull.
  ctx.fillStyle = materialFill(ctx, "STONE", 4, -6, 10, -2, litAsh, midAsh, deepAsh);
  polygonPath(ctx, [
    [4, -6],
    [10, -5],
    [9, -2],
    [4, -3],
  ]);
  ctx.fill();
  ctx.fillStyle = "#0a0806";
  ctx.beginPath();
  ctx.ellipse(6, -5, 0.9, 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + damageIntensity * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(6, -5, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
};

registerBossCreature(["ashen-colossus-forsaken"], drawAshenColossus);
registerBossCreature(["ashen-colossus"], drawAshenColossusSpawn);
