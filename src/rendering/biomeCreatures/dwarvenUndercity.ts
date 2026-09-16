import { drawContactShadow, drawEnergyCrack, rimHighlight } from "../lighting";
import { glowBlob, polygonPath } from "./helpers";
import { registerBossCreature, registerEnemyRenderers, type BossCreatureDrawFn, type EnemyDrawFn } from "./registry";

/**
 * Cidade Subterrânea dos Anões (waves 131-150) — an abandoned dwarven
 * mining civilization. All three creatures read as mineral/mechanical
 * hybrids native to a forge-lit underground: armored plating, ember-glow
 * joints, angular rock-plate silhouettes — none of them share anatomy with
 * any pre-existing archetype (no legs-count reuse, no body-shape reuse).
 */

// Forgecrawler — low, fast, six-legged armored insectoid skittering close
// to the ground, mineral plates riveted along its back.
const drawForgecrawler: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 9, 4, 0.34);
  const legPhase = timeMs / 130;
  for (let i = 0; i < 3; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const baseX = -6 + i * 6;
    const swing = Math.sin(legPhase + i * 2.1) * 3;
    ctx.strokeStyle = theme.dark;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const side of [1, -1] as const) {
      ctx.beginPath();
      ctx.moveTo(baseX, side * 3);
      ctx.lineTo(baseX + swing * sign * 0.4, side * (6 + Math.abs(swing)));
      ctx.stroke();
    }
  }
  const bodyGrad = ctx.createLinearGradient(0, -5, 0, 5);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-9, 0],
    [-5, -5],
    [4, -5],
    [9, -1],
    [7, 3],
    [-6, 4],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // riveted mineral plates
  for (const px of [-4, 0, 4]) {
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timeMs / 300 + px);
    ctx.beginPath();
    ctx.arc(px, -2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // mandible head
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [8, -1],
    [13, -2],
    [12, 1],
    [8, 2],
  ]);
  ctx.fill();
};

// Deepdelver — hunched bipedal miner dragging a heavy pickmace, a lantern
// glowing at its belt.
const drawDeepdelver: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 8, 4, 0.36);
  const stride = Math.sin(timeMs / 220);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-3 - stride * 3, 9);
  ctx.moveTo(2, 2);
  ctx.lineTo(3 + stride * 3, 9);
  ctx.stroke();
  // hunched torso
  const bodyGrad = ctx.createLinearGradient(0, -9, 0, 3);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-6, -1],
    [-5, -8],
    [3, -9],
    [7, -3],
    [5, 3],
    [-5, 3],
  ]);
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.moveTo(-5, -8);
      ctx.lineTo(3, -9);
    },
    theme.accent,
    1,
    0.4,
  );
  // arm + pickmace
  const swing = Math.sin(timeMs / 260) * 0.5;
  ctx.save();
  ctx.translate(6, -4);
  ctx.rotate(0.6 + swing);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 11);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  polygonPath(ctx, [
    [-4, 10],
    [4, 10],
    [2, 14],
    [-2, 14],
  ]);
  ctx.fill();
  ctx.restore();
  // helmet lantern glow
  glowBlob(ctx, -1, -10, 4, theme.accent);
  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(-1, -10, 2.6, 0, Math.PI * 2);
  ctx.fill();
};

// Magmajaw — heavy quadruped reptile with a huge crushing lower jaw and
// overlapping stone back-plates.
const drawMagmajaw: EnemyDrawFn = (ctx, theme, timeMs) => {
  drawContactShadow(ctx, 13, 5.5, 0.42);
  const lumber = Math.sin(timeMs / 340);
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [lx, sign] of [
    [-8, 1],
    [7, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(lx, 2);
    ctx.lineTo(lx + lumber * sign * 2, 9);
    ctx.stroke();
  }
  const bodyGrad = ctx.createLinearGradient(0, -8, 0, 6);
  bodyGrad.addColorStop(0, theme.body);
  bodyGrad.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGrad;
  polygonPath(ctx, [
    [-12, 1],
    [-9, -7],
    [4, -8],
    [13, -2],
    [11, 5],
    [-10, 6],
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // overlapping stone plates on the back
  for (const [px, py] of [
    [-6, -6],
    [-1, -7],
    [4, -6.5],
  ] as const) {
    ctx.fillStyle = theme.dark;
    polygonPath(ctx, [
      [px - 2.5, py],
      [px + 2.5, py],
      [px + 1.5, py + 3],
      [px - 1.5, py + 3],
    ]);
    ctx.fill();
  }
  // huge lower jaw hinging open slightly with an ember glow
  const jawOpen = 1.5 + Math.max(0, Math.sin(timeMs / 500)) * 1.5;
  ctx.fillStyle = theme.dark;
  polygonPath(ctx, [
    [12, -1],
    [19, 1 + jawOpen],
    [15, 3 + jawOpen],
    [10, 2],
  ]);
  ctx.fill();
  glowBlob(ctx, 15, 1 + jawOpen * 0.5, 3, theme.accent);
};

registerEnemyRenderers({
  FORGECRAWLER: drawForgecrawler,
  DEEPDELVER: drawDeepdelver,
  MAGMAJAW: drawMagmajaw,
});

// Iron Burrower — a huge fused mineral/mechanical guardian: a drill-shaped
// burrowing head, riveted iron plating, four splayed digging limbs. Shared
// body for both the mini-boss and main-boss role (see registry.ts doc).
const drawIronBurrower: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, variant) => {
  const isMain = variant === "MAIN";
  const scale = isMain ? 1 : 0.62;
  const limbCount = isMain ? 4 : 3;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 520));
  const damageIntensity = Math.max(0, 1 - hpPercent);

  drawContactShadow(ctx, 20 * scale, 9 * scale, 0.46);
  ctx.save();
  ctx.scale(scale, scale);

  // Splayed digging limbs, iron with a mineral claw tip.
  for (let i = 0; i < limbCount; i++) {
    const a = -Math.PI / 2 + (i / (limbCount - 1)) * Math.PI * 0.9 - Math.PI * 0.45;
    const lx = Math.cos(a) * 16;
    const ly = 8 + Math.sin(a) * 6;
    ctx.strokeStyle = "#3a342e";
    ctx.lineWidth = 4.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 5, 4 + Math.sin(a) * 2);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.fillStyle = "#b8ac94";
    polygonPath(ctx, [
      [lx - 2, ly],
      [lx + 2, ly],
      [lx, ly + 5],
    ]);
    ctx.fill();
  }

  // Drill-shaped burrowing head/body, riveted plating.
  const bodyGrad = ctx.createLinearGradient(0, -16, 0, 8);
  bodyGrad.addColorStop(0, "#5a5248");
  bodyGrad.addColorStop(1, "#221e18");
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

  drawEnergyCrack(ctx, -6, -4, -2, -8, 3, -12, color, 0.5 + damageIntensity * 0.4);

  // rivets
  for (const [rx, ry] of [
    [-5, 2],
    [5, 2],
    [-3, -6],
    [3, -6],
  ] as const) {
    ctx.fillStyle = "#8a7e68";
    ctx.beginPath();
    ctx.arc(rx, ry, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // drill tip core, glowing hotter as it's damaged / enraged
  glowBlob(ctx, 0, -16, (6 + damageIntensity * 4) * (enraged ? 1.3 : 1), color);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85 + 0.15 * pulse;
  polygonPath(ctx, [
    [0, -20],
    [3, -15],
    [0, -12],
    [-3, -15],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isMain) {
    // Main-boss-only shoulder crystal growths — the "sovereign" upgrade.
    for (const [sx, sy, ang] of [
      [-8, -9, -2.4],
      [8, -9, -0.7],
    ] as const) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      const shard = ctx.createLinearGradient(0, 0, 0, -7);
      shard.addColorStop(0, "#7a7264");
      shard.addColorStop(1, color);
      ctx.fillStyle = shard;
      polygonPath(ctx, [
        [-1.6, 0],
        [1.6, 0],
        [0, -7],
      ]);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
};

registerBossCreature(["iron-burrower", "iron-burrower-sovereign"], drawIronBurrower);
