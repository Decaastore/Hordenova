import { drawContactShadow, drawEnergyCrack, rimHighlight } from "../lighting";
import { breathe, gaitBounce, gaitPhase, gaitSwing, glowBlob, jointBulge, limbSegment, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Cidade Subterrânea dos Anões (waves 131-150) — an abandoned dwarven
 * mining civilization. FASE 2 art pass: every creature here now has
 * volumetric jointed limbs (limbSegment, not stroked lines), material-
 * distinct shading (CHITIN vs HIDE vs STONE vs METAL vs CRYSTAL — never
 * one shading technique reused for everything), a real 3-shape anatomy
 * (head/jaw distinct from torso distinct from limbs), and constant subtle
 * idle motion (breathing/sway) so nothing reads as a static icon.
 *
 * Silhouette test: Forgecrawler (low 4-legged insectoid, tapering rear
 * abdomen, forward mandibles) vs Deepdelver (upright 2-legged hunched
 * humanoid, one oversized arm) vs Magmajaw (squat wide 4-legged reptile,
 * head dominated by a huge hinged jaw) — three completely different body
 * plans, distinguishable with the color removed.
 */

// Forgecrawler — low, fast, four-legged armored insectoid. Chitin shell
// riveted with mineral (metal) plates, a forward mandible head with a
// glowing sensor-slit instead of round eyes (kept deliberately alien/
// eyeless rather than "cute").
const FORGECRAWLER_STRIDE = 9;
const drawForgecrawler: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const legPhase = gaitPhase(locomotion?.distance ?? 0, FORGECRAWLER_STRIDE);
  const bob = gaitBounce(legPhase, speedRatio, 0.55);
  drawContactShadow(ctx, 9, 3.8, 0.36);
  ctx.save();
  ctx.translate(0, -bob);

  const legs: ReadonlyArray<readonly [number, number, number]> = [
    [-5, -2.5, 0],
    [-5, 2.5, Math.PI],
    [3, -2.5, Math.PI],
    [3, 2.5, 0],
  ];
  for (const [hx, hy, offset] of legs) {
    const swing = gaitSwing(legPhase, speedRatio, 1, offset);
    const side = hy > 0 ? 1 : -1;
    const kneeX = hx + swing * 2.2;
    const kneeY = hy + side * 4.5 - Math.max(0, swing) * 1.6;
    const footX = hx + swing * 4.4;
    const footY = hy + side * 8;
    const legGrad = materialFill(ctx, "CHITIN", hx, hy, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, hx, hy, kneeX, kneeY, 1.5, 1, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1, 0.4, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 0.9, theme.dark);
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + swing * 1.4, footY + side * 1.6);
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(breathe(timeMs, 0, 900, 0.02), 1);

  // Segmented carapace: tapering rear abdomen fused to a narrower cephalothorax.
  const bodyGrad = materialFill(ctx, "CHITIN", -8, -6, 6, 5, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-7, -4.5],
    [-2, -5.5],
    [3, -4.5],
    [6, -1],
    [5, 3],
    [-3, 4.2],
    [-8, 3],
  ]);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.moveTo(-7, -4.5);
      ctx.lineTo(3, -4.5);
    },
    theme.accent,
    0.9,
    0.35,
  );

  // dorsal ridge spikes
  for (const sx of [-4, -1, 2]) {
    ctx.fillStyle = theme.dark;
    polygonPath(ctx, [
      [sx - 0.9, -4.5],
      [sx + 0.9, -4.5],
      [sx, -7.2],
    ]);
    ctx.fill();
  }

  // riveted mineral (metal) plates along the flank — a different material than the chitin shell.
  for (const px of [-4, 0]) {
    ctx.fillStyle = materialFill(ctx, "METAL", px - 1.4, -2, px + 1.4, 1.5, "#d8cba8", theme.accent, theme.dark);
    polygonPath(ctx, [
      [px - 1.4, -2],
      [px + 1.4, -2],
      [px + 1, 1.5],
      [px - 1, 1.5],
    ]);
    ctx.fill();
  }

  // forward mandible head, jutting past the cephalothorax.
  ctx.fillStyle = materialFill(ctx, "CHITIN", 5, -3, 13, 2, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [5, -3],
    [11, -2.6],
    [13, -0.3],
    [11, 1.8],
    [5, 2],
  ]);
  ctx.fill();
  const mandibleOpen = 0.5 + 0.5 * Math.sin(timeMs / 260);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, -1);
  ctx.lineTo(15, -2.4 - mandibleOpen);
  ctx.moveTo(12, 1);
  ctx.lineTo(15, 2.4 + mandibleOpen);
  ctx.stroke();
  // glowing sensor-slit — deliberately not a round "cute" eye.
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timeMs / 240);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(8, -1);
  ctx.lineTo(10.5, -1);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
  ctx.restore();
};

// Deepdelver — hunched, asymmetric bipedal miner: one massive corded arm
// wielding a pickmace, one withered arm, exposed ribs under torn hide, an
// iron mining helmet with a lantern glow (not an eye).
const DEEPDELVER_STRIDE = 11;
const drawDeepdelver: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const stridePhase = gaitPhase(locomotion?.distance ?? 0, DEEPDELVER_STRIDE);
  drawContactShadow(ctx, 8, 3.6, 0.38);

  for (const [hx, side] of [
    [-2, 1],
    [2, -1],
  ] as const) {
    const phase = gaitSwing(stridePhase, speedRatio, 1, side > 0 ? 0 : Math.PI);
    const kneeX = hx + phase * 1.6;
    const kneeY = 4.5;
    const footX = hx + phase * 3.2;
    const footY = 9;
    const legGrad = materialFill(ctx, "HIDE", hx, 1, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, hx, 1, kneeX, kneeY, 1.7, 1.3, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 1.3, 1.5, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 1.1, theme.dark);
  }

  const bodyGrad = materialFill(ctx, "HIDE", -5, -9, 6, 3, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-6, -1],
    [-5, -8],
    [2, -10],
    [7, -4],
    [6, 2],
    [-5, 3],
  ]);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.moveTo(-5, -8);
      ctx.lineTo(2, -10);
    },
    theme.accent,
    1,
    0.35,
  );
  // exposed ribs
  ctx.strokeStyle = theme.dark;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    const y = -6 + i * 2.4;
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.quadraticCurveTo(0, y + 1.6, 4, y - 0.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // withered small arm, hanging limp.
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-7, 1 + Math.sin(timeMs / 400));
  ctx.stroke();

  // massive corded arm + pickmace, swinging.
  const swing = Math.sin(timeMs / 260) * 0.5;
  ctx.save();
  ctx.translate(6, -5);
  ctx.rotate(0.5 + swing);
  const armGrad = materialFill(ctx, "HIDE", 0, 0, 0, 10, theme.accent, theme.body, theme.dark);
  limbSegment(ctx, 0, 0, 0, 7, 2.4, 1.6, armGrad);
  jointBulge(ctx, 0, 7, 1.4, theme.dark);
  ctx.strokeStyle = "#5a5248";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(0, 15);
  ctx.stroke();
  ctx.fillStyle = materialFill(ctx, "METAL", -4, 14, 4, 18, "#d8cba8", "#8a8072", "#3a342c");
  polygonPath(ctx, [
    [-4, 14],
    [4, 14],
    [2, 18],
    [-2, 18],
  ]);
  ctx.fill();
  ctx.restore();

  // iron mining helmet + lantern glow.
  ctx.fillStyle = materialFill(ctx, "METAL", -3, -13, 3, -8, "#d8cba8", "#8a8072", "#3a342c");
  polygonPath(ctx, [
    [-3, -9],
    [-3, -12],
    [3, -12],
    [3, -9],
  ]);
  ctx.fill();
  glowBlob(ctx, 0, -10.5, 3.6, theme.accent);
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(0, -10.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
};

// Magmajaw — squat, wide, heavy quadruped reptile whose massive hinged jaw
// dominates the silhouette. Overlapping stone plate armor across the back.
const MAGMAJAW_STRIDE = 17;
const drawMagmajaw: EnemyDrawFn = (ctx, theme, timeMs, _hitFlashMs, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const lumberPhase = gaitPhase(locomotion?.distance ?? 0, MAGMAJAW_STRIDE);
  const lumber = gaitSwing(lumberPhase, speedRatio, 1);
  drawContactShadow(ctx, 13, 5, 0.44);

  const legs: ReadonlyArray<readonly [number, number]> = [
    [-8, 1],
    [-3, -1],
    [3, 1],
    [8, -1],
  ];
  for (const [lx, sign] of legs) {
    const swing = lumber * sign;
    const kneeX = lx + swing * 1.2;
    const kneeY = 5;
    const footX = lx + swing * 2.4;
    const footY = 9.5;
    const legGrad = materialFill(ctx, "STONE", lx, 2, footX, footY, theme.accent, theme.body, theme.dark);
    limbSegment(ctx, lx, 2, kneeX, kneeY, 2.4, 2, legGrad);
    limbSegment(ctx, kneeX, kneeY, footX, footY, 2, 2.2, theme.dark);
    jointBulge(ctx, kneeX, kneeY, 1.6, theme.dark);
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 1, 1200, 0.018));

  const bodyGrad = materialFill(ctx, "STONE", -13, -8, 10, 6, theme.accent, theme.body, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-13, 1],
    [-10, -7],
    [2, -9],
    [11, -3],
    [10, 5],
    [-11, 6],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // overlapping stone back-plates.
  for (const [px, py, w] of [
    [-8, -7, 3],
    [-3, -8.5, 3.4],
    [2, -8, 3.4],
    [7, -6.5, 2.8],
  ] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", px - w, py, px + w, py + 4, "#8a8072", theme.body, theme.dark);
    polygonPath(ctx, [
      [px - w, py],
      [px + w, py],
      [px + w - 1, py + 4],
      [px - w + 1, py + 4],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // small tail stub.
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-13, 0],
    [-17, -2],
    [-16, 3],
  ]);
  ctx.fill();

  // massive crushing jaw, hinging open.
  const jawOpen = 1.2 + Math.max(0, Math.sin(timeMs / 480)) * 2.2;
  ctx.fillStyle = materialFill(ctx, "STONE", 9, -8, 20, 4, theme.accent, theme.body, theme.dark);
  polygonPath(ctx, [
    [9, -8],
    [17, -7],
    [20, -2],
    [16, 0],
    [9, -1],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [10, 0],
    [18, 1 + jawOpen],
    [14, 3 + jawOpen],
    [9, 1.5],
  ]);
  ctx.fill();
  ctx.fillStyle = "#d8cba8";
  for (let i = 0; i < 3; i++) {
    const tx = 12 + i * 2.6;
    polygonPath(ctx, [
      [tx, -1],
      [tx + 1, -1],
      [tx + 0.5, 1.5 + jawOpen * 0.3],
    ]);
    ctx.fill();
  }
  glowBlob(ctx, 14, 0.5 + jawOpen * 0.5, 3, theme.accent);

  ctx.restore();
};

registerEnemyRenderers({
  FORGECRAWLER: drawForgecrawler,
  DEEPDELVER: drawDeepdelver,
  MAGMAJAW: drawMagmajaw,
});

// Iron Burrower — a huge fused mineral/mechanical guardian: a spiral-
// grooved drill head, riveted metal plating with real seams/rivets, and
// splayed volumetric digging limbs. Shared body for mini-boss and main
// boss (see registry.ts doc) — the main boss adds a full armored shoulder
// collar and a 3-shard crystal crown, not just a bigger drill.
// FASE 3: its own locomotor trait is a heavy, subterranean burrowing
// motion — the digging limbs plunge/retract in sequence (rather than a
// normal walk-cycle) and the whole body has a low tremor synced to real
// distance, reading as "movimento subterrâneo/pesado" rather than a
// creature that merely slides across the surface.
const drawIronBurrower: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant, locomotion) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const limbCount = isMain ? 4 : 3;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 520));
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const speedRatio = locomotion?.speedRatio ?? 1;
  const burrowPhase = gaitPhase(locomotion?.distance ?? 0, isMain ? 20 : 14);
  const tremor = gaitBounce(burrowPhase, speedRatio, isMain ? 0.7 : 0.5);

  drawContactShadow(ctx, 20 * scale, 9 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -tremor);

  // Splayed digging limbs — volumetric (upper limb + forearm), metal with a mineral claw tip.
  // Each limb plunges/retracts on its own offset phase, like a real
  // burrowing sequence rather than every limb moving in lockstep.
  for (let i = 0; i < limbCount; i++) {
    const a = -Math.PI / 2 + (i / (limbCount - 1)) * Math.PI * 0.9 - Math.PI * 0.45;
    const dig = gaitSwing(burrowPhase, speedRatio, 1.6, (i / limbCount) * Math.PI * 2);
    const hipX = Math.cos(a) * 5;
    const hipY = 4 + Math.sin(a) * 2;
    const kneeX = Math.cos(a) * 11;
    const kneeY = 6 + Math.sin(a) * 4 + dig;
    const lx = Math.cos(a) * 16;
    const ly = 8 + Math.sin(a) * 6 + dig * 1.4;
    const limbGrad = materialFill(ctx, "METAL", hipX, hipY, lx, ly, "#9a8e78", "#5a5248", "#221e18");
    limbSegment(ctx, hipX, hipY, kneeX, kneeY, 2.6, 2, limbGrad);
    limbSegment(ctx, kneeX, kneeY, lx, ly, 2, 1.3, "#2a251e");
    jointBulge(ctx, kneeX, kneeY, 1.8, "#3a342c");
    ctx.fillStyle = "#b8ac94";
    polygonPath(ctx, [
      [lx - 2, ly],
      [lx + 2, ly],
      [lx, ly + 5],
    ]);
    ctx.fill();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 3, 900, enraged ? 0.03 : 0.015));

  // Drill-shaped burrowing body, riveted metal plating.
  const bodyGrad = materialFill(ctx, "METAL", -10, -17, 10, 8, "#8a7e68", "#5a5248", "#221e18");
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [0, -17],
    [8, -10],
    [10, 0],
    [6, 8],
    [-6, 8],
    [-10, 0],
    [-8, -10],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  drawEnergyCrack(ctx, -6, -4, -2, -8, 3, -12, color, 0.5 + damageIntensity * 0.4 + (enraged ? 0.2 : 0));

  for (const seamY of [-4, 2]) {
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-9, seamY);
    ctx.lineTo(9, seamY);
    ctx.stroke();
  }
  for (const [rx, ry] of [
    [-5, 2],
    [5, 2],
    [-3, -6],
    [3, -6],
    [-7, -2],
    [7, -2],
  ] as const) {
    ctx.fillStyle = "#c8bc9e";
    ctx.beginPath();
    ctx.arc(rx, ry, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // spiral-grooved drill bit head, tapering to a point.
  const drillGrad = materialFill(ctx, "METAL", -4, -22, 4, -12, "#c8bc9e", "#6a6050", "#1a1712");
  ctx.fillStyle = drillGrad;
  polygonPath(ctx, [
    [0, -23],
    [4, -14],
    [0, -11],
    [-4, -14],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    ctx.beginPath();
    ctx.moveTo(-3.5 + t * 3, -14 + t * 2);
    ctx.lineTo(3.5 - t * 3, -14 + t * 2);
    ctx.stroke();
  }

  glowBlob(ctx, 0, -16, (6 + damageIntensity * 4) * (enraged ? 1.3 : 1), color);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85 + 0.15 * pulse;
  polygonPath(ctx, [
    [0, -20],
    [2.4, -16],
    [0, -13],
    [-2.4, -16],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isMain) {
    // Main-boss-only: a full armored shoulder collar plus a 3-shard crystal
    // crown — a genuine anatomical addition, the "estágio superior da
    // espécie" reading, not the mini-boss body simply scaled up.
    ctx.fillStyle = materialFill(ctx, "METAL", -10, -9, 10, -3, "#9a8e78", "#5a5248", "#221e18");
    polygonPath(ctx, [
      [-10, -8],
      [-6, -11],
      [6, -11],
      [10, -8],
      [8, -4],
      [-8, -4],
    ]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const [sx, sy, ang] of [
      [-9, -9, -2.4],
      [9, -9, -0.7],
      [0, -12, -1.57],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = materialFill(ctx, "CRYSTAL", 0, 0, 0, -8, "#e8e0ff", "#7a7264", color);
      polygonPath(ctx, [
        [-1.8, 0],
        [1.8, 0],
        [0, -8],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
};

registerBossCreature(["iron-burrower", "iron-burrower-sovereign"], drawIronBurrower);
