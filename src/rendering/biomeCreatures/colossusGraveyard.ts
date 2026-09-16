import { drawContactShadow, drawEnergyCrack } from "../lighting";
import { drawFlightShadow, flightLift, glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Cemitério dos Colossos (waves 151-170) — a field of ancient giant-
 * creature remains. Bone Stalker and Ribcrawler are built from visible
 * jointed bone segments (not flesh silhouettes with a bone palette
 * slapped on); Gravewing is a true flier (membrane stretched over a bone
 * frame, see helpers.ts flightLift). Colossus Spawn is a young, LIVING
 * giant born of the graveyard, not another skeleton.
 */

// Bone Stalker — lean quadruped predator, jointed bone limbs, a bare skull.
const drawBoneStalker: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 10, 4, 0.3);
  const stride = timeMs / 150;
  ctx.strokeStyle = theme.body;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const phase = i % 2 === 0 ? Math.sin(stride) : -Math.sin(stride);
    const baseX = i < 2 ? -6 : 6;
    const sign = i % 2 === 0 ? 1 : -1;
    const kneeY = 3 + Math.abs(phase);
    ctx.beginPath();
    ctx.moveTo(baseX, 0);
    ctx.lineTo(baseX + phase * 2, kneeY);
    ctx.lineTo(baseX + phase * 3.5 + sign, kneeY + 5);
    ctx.stroke();
    ctx.fillStyle = theme.dark;
    ctx.beginPath();
    ctx.arc(baseX + phase * 2, kneeY, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // ribcage-and-spine torso, thin bone segments not a solid mass
  ctx.strokeStyle = theme.body;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.lineTo(9, -2);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 3.4;
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.quadraticCurveTo(x, 2, x - 1.5, 3.5);
    ctx.stroke();
  }
  // skull head with a faint moss-glow eye socket
  ctx.fillStyle = theme.body;
  polygonPath(ctx, [
    [9, -4],
    [15, -3],
    [15, 0],
    [11, 1],
    [8, -1],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timeMs / 260);
  ctx.beginPath();
  ctx.arc(12.5, -2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

// Ribcrawler — low crawler sheltering under an arched ribcage shell, many
// short legs beneath.
const drawRibcrawler: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 11, 4.5, 0.36);
  const legPhase = timeMs / 110;
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const x = -8 + i * 3.2;
    const wig = Math.sin(legPhase + i) * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + wig, 7);
    ctx.stroke();
  }
  // arched ribcage shell over the back
  ctx.strokeStyle = theme.body;
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 5; i++) {
    const x = -7 + i * 3.6;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.quadraticCurveTo(x, -8, x + 1.8, -6);
    ctx.stroke();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-10, 3],
    [-8, -3],
    [9, -3],
    [11, 3],
  ]);
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
  // small hunched head peeking from under the shell
  ctx.fillStyle = theme.body;
  polygonPath(ctx, [
    [9, 0],
    [14, -1],
    [13, 2],
    [9, 2.5],
  ]);
  ctx.fill();
};

// Gravewing — flies on a bone-strutted membrane, a true aerial silhouette.
const drawGravewing: EnemyDrawFn = (ctx, theme, timeMs) => {
  const lift = flightLift(timeMs, 4.1, 6, 1600);
  drawFlightShadow(ctx, lift, 6, 10, 4);
  ctx.save();
  ctx.translate(0, -lift);
  const flap = Math.sin(timeMs / 180);
  for (const side of [1, -1] as const) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.fillStyle = theme.body;
    ctx.globalAlpha = 0.85;
    polygonPath(ctx, [
      [0, 0],
      [7, -3 - flap * 3],
      [13, 1 - flap * 2],
      [8, 3],
      [3, 2],
    ]);
    ctx.fill();
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -3 - flap * 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(13, 1 - flap * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [-1, -2],
    [3, -2],
    [2, 3],
    [-2, 3],
  ]);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(1.5, -1, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
};

registerEnemyRenderers({
  BONE_STALKER: drawBoneStalker,
  RIBCRAWLER: drawRibcrawler,
  GRAVEWING: drawGravewing,
});

// Colossus Spawn — a young, LIVING giant born of the graveyard: stone-grey
// hide, a chest of exposed bone plating (inherited, not its own skeleton
// showing), oversized fists, a hunched aggressive charge stance.
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

  // Thick stomping legs.
  ctx.strokeStyle = "#4a463e";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.lineTo(-7, 14 + stomp * 2);
  ctx.moveTo(5, 6);
  ctx.lineTo(7, 14 - stomp * 2);
  ctx.stroke();

  // Hunched torso, stone-grey hide.
  const bodyGrad = ctx.createRadialGradient(-2, -6, 2, 0, 0, 15);
  bodyGrad.addColorStop(0, "#6a655a");
  bodyGrad.addColorStop(1, "#2a2720");
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

  // Exposed inherited ribcage on the chest.
  ctx.strokeStyle = "#d8d0bc";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const y = -6 + i * 3.4;
    ctx.beginPath();
    ctx.moveTo(-6, y);
    ctx.quadraticCurveTo(0, y + 2.4, 6, y);
    ctx.stroke();
  }
  drawEnergyCrack(ctx, -6, 2, -2, -3, 3, -7, color, 0.4 + damageIntensity * 0.5 + (enraged ? 0.25 : 0));

  // Oversized fists, swinging with the stomp cadence.
  for (const [fx, sign] of [
    [-11, -1],
    [11, 1],
  ] as const) {
    ctx.save();
    ctx.translate(fx, -3 + Math.sin(timeMs / 300 + sign) * 2);
    const fistGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5);
    fistGrad.addColorStop(0, "#7a7568");
    fistGrad.addColorStop(1, "#2a2720");
    ctx.fillStyle = fistGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 4.4 * rage, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Small feral head, low-set, jaw jutting forward.
  ctx.fillStyle = "#4a463e";
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
    // Main-boss-only: a second, larger set of back growths (spikes of
    // fused ancestral bone) — the fully grown reading of the same spawn.
    for (const [sx, sy, ang] of [
      [-4, -14, -2.6],
      [3, -15, -0.5],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = "#c8c0a8";
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
};

registerBossCreature(["colossus-spawn", "ancestral-colossus"], drawColossusSpawn);
