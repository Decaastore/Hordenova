import { drawContactShadow, rimHighlight } from "../lighting";
import { breathe, drawEye, gaitBounce, gaitPhase, gaitSwing, glowBlob, idleSway, materialFill, polygonPath } from "./helpers";
import { registerBossCreature, type BossCreatureDrawFn } from "./registry";

/**
 * ORIGINAL BOSSES REDESIGN — the six original mini-bosses (Ashfen Warlord,
 * Briar Summoner, Mossback Regenerator, Gloom Jammer, Stonebound Sentinel,
 * Ferocious Berserker). Unlike the 10-biome expansion's mini-bosses, these
 * six are NOT pinned to one biome each — config/bossConfig.ts's
 * MINI_BOSS_ROSTER rotates all six through EVERY original phase by
 * `waveNumber % 6` (see getMiniBossIdForWave), so "Ashfen Warlord" can turn
 * up during a Frozen Tundra mini-boss wave just as easily as an Ashen one.
 * They therefore can NOT be designed as "the main boss's biome, smaller" —
 * there is no such pairing at runtime. Each is instead its own creature
 * with its own identity drawn from its OWN name and combat ability
 * (Shield/Summon/Regen/Disable/none/Berserker), grouped in this one file
 * because they share that rotation, not because they share a look. Every
 * one of the six uses a genuinely different body plan from every other
 * mini-boss here AND from all six main bosses (`ancientForest.ts`,
 * `volcanicWastes.ts`, `frozenTundra.ts`, `cursedDesert.ts`, `darkRuins.ts`,
 * `abyss.ts`) — never a boss scaled down, never a common enemy scaled up.
 */

// Ashfen Warlord — a squat armored sentinel, asymmetric: one arm fused to
// a heavy curved plate (a shield silhouette), the other bare. Ember-singed
// tattered banners hang off the plated shoulder. SHIELD ability.
const drawAshfenWarlord: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, 14);
  const stomp = gaitBounce(phase, speedRatio, 0.8);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / (enraged ? 240 : 560));

  drawContactShadow(ctx, 8, 4, 0.4);
  ctx.save();
  ctx.translate(0, -stomp * 0.5);
  for (const [lx, offset] of [[-3, 0], [3, Math.PI]] as const) {
    const swing = Math.sin(phase + offset) * 0.8 * speedRatio;
    ctx.strokeStyle = materialFill(ctx, "CHARRED", lx, 4, lx + swing, 10, "#8a5a3a", "#3a241a", "#160e08");
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, 4);
    ctx.lineTo(lx + swing, 10);
    ctx.stroke();
  }
  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1100, 0.02));

  // Bare arm.
  ctx.strokeStyle = materialFill(ctx, "HIDE", -6, -6, -6, 2, "#7a5a3a", "#3a2418", "#160e08");
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-6 + idleSway(timeMs, 0, 2000, 0.5), 2);
  ctx.stroke();

  // Squat torso, ember-singed banner strip hanging from the plated side.
  ctx.fillStyle = materialFill(ctx, "CHARRED", -6, -9, 6, 5, "#6a4a34", "#2e1e14", "#100a06");
  polygonPath(ctx, [[-6, -8], [6, -8], [7, 0], [4, 5], [-4, 5], [-7, 0]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#2a1610";
  const bannerSway = idleSway(timeMs, 3, 1600, 1.4);
  polygonPath(ctx, [[4, 3], [6, 3], [5.5 + bannerSway, 10], [3.6 + bannerSway, 10]]);
  ctx.fill();

  // The fused shield-plate arm — the silhouette's defining asymmetry.
  const plateGrad = materialFill(ctx, "METAL", 5, -8, 10, 4, "#9a8a72", "#4a4034", "#1e1a14");
  ctx.fillStyle = plateGrad;
  polygonPath(ctx, [[4, -8], [10, -6], [11, 1], [8, 5], [4, 4]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  rimHighlight(ctx, () => { ctx.moveTo(4, -8); ctx.lineTo(10, -6); }, "#e0d4b8", 0.7, 0.5 + 0.25 * pulse);

  // Head — small, wrapped, an ember-glow visor slit.
  ctx.fillStyle = materialFill(ctx, "HIDE", -3, -13, 3, -8, "#6a4a34", "#2e1e14", "#100a06");
  polygonPath(ctx, [[-3, -9], [-2, -13], [2, -13], [3, -9], [1, -7], [-1, -7]]);
  ctx.fill();
  glowBlob(ctx, 0, -10, (3 + damageIntensity * 1.5) * (enraged ? 1.3 : 1), color);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6 + 0.3 * pulse;
  ctx.fillRect(-1.3, -10.4, 2.6, 0.8);
  ctx.globalAlpha = 1;

  ctx.restore();
  ctx.restore();
};

// Briar Summoner — a slender plant-hybrid: a gnarled trunk-body, thorny
// vine-arms ending in bramble clusters, a small orb floating just above
// (not attached to) the head — the summon read. A dragging root hem
// stands in for legs. SUMMON ability.
const drawBriarSummoner: BossCreatureDrawFn = (ctx, color, timeMs, _enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const sway = idleSway(timeMs, 0, 2400, 2) * Math.max(0.3, speedRatio);
  const orbFloat = Math.sin(timeMs / 900) * 1.2;

  drawContactShadow(ctx, 7, 3.5, 0.36);
  ctx.save();

  // Root hem dragging along the ground instead of legs.
  ctx.strokeStyle = materialFill(ctx, "PLANT", -5, 4, 5, 10, "#3a2c1a", "#1c140c", "#0a0806");
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const rx of [-4, -1, 2, 5]) {
    ctx.beginPath();
    ctx.moveTo(rx, 3);
    ctx.quadraticCurveTo(rx + sway * 0.4, 7, rx + sway, 10);
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(1, breathe(timeMs, 0, 1600, 0.02));

  // Gnarled trunk-body, narrow and twisted.
  ctx.strokeStyle = materialFill(ctx, "PLANT", -3, -12, 3, 3, "#4a3a20", "#241a10", "#0e0a06");
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1.5, 3);
  ctx.quadraticCurveTo(2, -4, -1, -12);
  ctx.stroke();

  // Thorny vine-arms ending in bramble clusters.
  for (const side of [-1, 1] as const) {
    const armSway = idleSway(timeMs, side, 1800, 3);
    ctx.strokeStyle = materialFill(ctx, "PLANT", side * 2, -6, side * 8, -1, "#4a3a20", "#241a10", "#0e0a06");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(side * 1.5, -7);
    ctx.quadraticCurveTo(side * 6 + armSway, -8, side * 8 + armSway, -2);
    ctx.stroke();
    ctx.save();
    ctx.translate(side * 8 + armSway, -2);
    ctx.fillStyle = "#2a2010";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 2.2, Math.sin(a) * 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Small vine-wreathed head.
  ctx.fillStyle = materialFill(ctx, "PLANT", -2, -15, 2, -10, "#4a3a20", "#241a10", "#0e0a06");
  polygonPath(ctx, [[-2, -11], [-1.6, -14.5], [1.6, -14.5], [2, -11], [0, -9.5]]);
  ctx.fill();
  drawEye(ctx, -0.8, -12, 0.5, color, false);
  drawEye(ctx, 0.8, -12, 0.5, color, false);

  ctx.restore();

  // The floating summon orb — detached from the body, hovering just above.
  glowBlob(ctx, 0, -19 + orbFloat, (3.5 + damageIntensity * 1.5), color);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, -19 + orbFloat, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
};

// Mossback Regenerator — low, wide, a rounded mossy shell over a slow
// waddling tank. The shell's crack-glow pulses on a long, slow "healing"
// rhythm tied directly to its REGEN ability.
const drawMossbackRegenerator: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, 10);
  const waddle = gaitSwing(phase, speedRatio, 1, 0);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const healPulse = 0.5 + 0.5 * Math.sin(timeMs / 1900);

  drawContactShadow(ctx, 9, 4, 0.42);
  ctx.save();
  ctx.rotate(waddle * 0.02);

  // Short stubby legs.
  for (const lx of [-5, -1.6, 1.6, 5]) {
    const legPhase = gaitSwing(phase, speedRatio, 0.8, lx > 0 ? 0 : Math.PI);
    ctx.fillStyle = materialFill(ctx, "STONE", lx, 3, lx, 8, "#7a7a68", "#3a3a2e", "#181812");
    polygonPath(ctx, [[lx - 1, 3], [lx + 1, 3], [lx + 1.2 + legPhase, 8], [lx - 1.2 + legPhase, 8]]);
    ctx.fill();
  }

  // Domed shell — the defining silhouette.
  const shellGrad = materialFill(ctx, "STONE", -8, -9, 8, 4, "#8a9270", "#454a34", "#1c1e14");
  ctx.fillStyle = shellGrad;
  ctx.beginPath();
  ctx.ellipse(0, -2, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Moss patches scattered on the shell.
  ctx.fillStyle = "#4a6a34";
  for (const [mx, my, mr] of [[-4, -5, 1.6], [2, -7, 1.3], [4, -2, 1.8], [-2, -1, 1.2]] as const) {
    ctx.save();
    ctx.translate(mx, my);
    for (let i = -2; i <= 2; i++) {
      ctx.strokeStyle = "#4a6a34";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(i * 0.7, mr);
      ctx.lineTo(i * 0.9, -1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cracks in the shell glowing on the slow "healing" rhythm.
  ctx.save();
  ctx.globalAlpha = 0.35 + healPulse * 0.4 + damageIntensity * 0.25 + (enraged ? 0.15 : 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(-1, -1);
  ctx.lineTo(2, -5);
  ctx.stroke();
  ctx.restore();
  glowBlob(ctx, 0, -2, 4 + healPulse * 2, color);

  // Small head tucked low in front.
  ctx.fillStyle = materialFill(ctx, "STONE", 6, -2, 12, 2, "#8a9270", "#454a34", "#1c1e14");
  polygonPath(ctx, [[6, -3], [11, -3], [12, 0], [10, 2], [6, 1]]);
  ctx.fill();
  drawEye(ctx, 9.5, -1, 0.6, "#1a1a12", false);

  ctx.restore();
};

// Gloom Jammer — lean and angular, wrapped in flickering static ribbons,
// thin metal jamming-antenna spikes on the back. Small jittery movements
// layered on top of a normal gait — the "interference" read. DISABLE.
const drawGloomJammer: BossCreatureDrawFn = (ctx, color, timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, 11);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const jitter = (Math.sin(timeMs / 55) * 0.35 + Math.sin(timeMs / 137) * 0.25) * (0.5 + speedRatio * 0.5);
  const flicker = Math.sin(timeMs / 90 + Math.sin(timeMs / 310) * 3) * 0.5 + 0.5;

  drawContactShadow(ctx, 7, 3.2, 0.34);
  ctx.save();
  ctx.translate(jitter, 0);

  for (const [lx, offset] of [[-3, 0], [3, Math.PI]] as const) {
    const swing = Math.sin(phase + offset) * 1.4 * speedRatio;
    ctx.strokeStyle = materialFill(ctx, "CHITIN", lx, 3, lx + swing, 9, "#3a2c4a", "#181022", "#08060c");
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, 3);
    ctx.lineTo(lx + swing, 9);
    ctx.stroke();
  }

  // Lean angular torso.
  ctx.fillStyle = materialFill(ctx, "CHITIN", -4, -10, 4, 4, "#4a3a5e", "#221a30", "#0a0812");
  polygonPath(ctx, [[-4, -8], [4, -9], [5, -1], [2, 4], [-3, 4], [-5, -1]]);
  ctx.fill();

  // Flickering static ribbons streaming off one shoulder.
  for (let i = 0; i < 3; i++) {
    const rflicker = Math.sin(timeMs / 45 + i * 5) > 0.3 ? 1 : 0.3;
    ctx.globalAlpha = 0.5 * rflicker;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(4, -6 + i * 2);
    ctx.lineTo(9 + i * 1.5, -4 + i * 3 + Math.sin(timeMs / 60 + i) * 1.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Thin jamming-antenna spikes on the back, at different angles.
  ctx.strokeStyle = "#7a7a88";
  ctx.lineWidth = 0.7;
  for (const [ax, ay, ang, len] of [[-2, -9, -2.2, 5], [1, -10, -1.4, 6.5], [3, -8, -0.6, 4]] as const) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(ang) * len, ay + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Featureless head, one asymmetric glowing slit-eye.
  ctx.fillStyle = materialFill(ctx, "CHITIN", -2, -13, 2, -8, "#3a2c4a", "#181022", "#08060c");
  polygonPath(ctx, [[-2, -9], [-1.5, -13], [1.5, -13], [2, -9], [0, -7]]);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.4 + flicker * 0.5 + (enraged ? 0.2 : 0);
  ctx.fillStyle = color;
  ctx.fillRect(0.2, -11, 1.4, 0.5);
  ctx.restore();
  glowBlob(ctx, 0, -3, (3 + damageIntensity * 1.5) * (0.6 + flicker * 0.4), color);

  ctx.restore();
};

// Stonebound Sentinel — the most rigid, blocky, symmetric body in the
// roster on purpose (no ability = a pure wall). Flat slab "shields" fused
// to both forearms, a plain featureless slab head, near-zero idle motion,
// heavy single-beat stomps rather than a lively gait.
const drawStoneboundSentinel: BossCreatureDrawFn = (ctx, color, timeMs, _enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, 16);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const stomp = Math.max(0, Math.sin(phase)) ** 3 * speedRatio * 1.4;
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 900);

  drawContactShadow(ctx, 8.5, 4, 0.46);
  ctx.save();
  ctx.translate(0, -stomp);

  for (const lx of [-3.5, 3.5]) {
    ctx.fillStyle = materialFill(ctx, "STONE", lx, 3, lx, 9, "#8a8a80", "#454540", "#1a1a18");
    polygonPath(ctx, [[lx - 1.6, 3], [lx + 1.6, 3], [lx + 1.6, 9], [lx - 1.6, 9]]);
    ctx.fill();
  }

  // Thick rectangular torso, blocky shoulders — no breathing, deliberately still.
  ctx.fillStyle = materialFill(ctx, "STONE", -7, -12, 7, 4, "#9a9a90", "#4a4a44", "#1e1e1a");
  polygonPath(ctx, [[-7, -11], [7, -11], [7, 3], [-7, 3]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Thin etched rune-line down the center — the only accent color.
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.25 * pulse + damageIntensity * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 2);
  ctx.stroke();
  ctx.restore();
  glowBlob(ctx, 0, -4, 3 + damageIntensity * 1.5, color);

  // Rigid arms ending in flat stone slab "shields", not hands.
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = materialFill(ctx, "STONE", side * 7, -8, side * 11, 2, "#8a8a80", "#454540", "#1a1a18");
    polygonPath(ctx, [[side * 7, -8], [side * 9, -8], [side * 9, 2], [side * 7, 2]]);
    ctx.fill();
    ctx.fillStyle = "#5a5a52";
    polygonPath(ctx, [[side * 9, -6], [side * 12, -6], [side * 12, 3], [side * 9, 3]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Plain featureless slab head.
  ctx.fillStyle = materialFill(ctx, "STONE", -3, -16, 3, -11, "#9a9a90", "#4a4a44", "#1e1e1a");
  polygonPath(ctx, [[-3, -11], [-3, -16], [3, -16], [3, -11]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
};

// Ferocious Berserker — a low, lean quadruped built for speed, hunched
// forward with a jaw-first head and a ridge of spine spikes. The fastest,
// most energetic gait of any creature in this batch. BERSERKER ability.
const FEROCIOUS_STRIDE = 9;
const drawFerociousBerserker: BossCreatureDrawFn = (ctx, color, _timeMs, enraged, hpPercent, _variant, locomotion) => {
  const speedRatio = locomotion?.speedRatio ?? 1;
  const phase = gaitPhase(locomotion?.distance ?? 0, FEROCIOUS_STRIDE);
  const bounce = gaitBounce(phase, speedRatio, 1.4);
  const damageIntensity = Math.max(0, 1 - hpPercent);
  const rage = enraged ? 1.4 : 1;

  drawContactShadow(ctx, 8, 3.5, 0.4);
  ctx.save();
  ctx.translate(0, -bounce);

  const legs: ReadonlyArray<readonly [number, number, number]> = [[-5, -1.5, 0], [-5, 1.5, Math.PI], [4, -1.5, Math.PI], [4, 1.5, 0]];
  for (const [hx, hy, offset] of legs) {
    const swing = gaitSwing(phase, speedRatio, 2.2, offset);
    const footX = hx + swing;
    ctx.strokeStyle = materialFill(ctx, "HIDE", hx, hy, footX, hy + 6, "#8a5a4a", "#3a2018", "#160c08");
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + swing * 0.5, hy + 3);
    ctx.lineTo(footX, hy + 6);
    ctx.stroke();
  }

  // Low, lean body — hunched forward.
  ctx.fillStyle = materialFill(ctx, "HIDE", -7, -5, 6, 2, "#9a6a54", "#4a2c1e", "#1c120a");
  polygonPath(ctx, [[-7, -1], [-5, -5], [4, -4], [6, 0], [4, 2], [-5, 2]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Spine ridge — spikes bristle further when enraged.
  for (let i = 0; i < 4; i++) {
    const sx = -4 + i * 2.6;
    const h = (1.6 + (i % 2) * 0.6) * rage;
    ctx.fillStyle = "#5a3a2c";
    polygonPath(ctx, [[sx - 0.6, -3.5], [sx + 0.6, -3.5], [sx, -3.5 - h]]);
    ctx.fill();
  }

  // Jaw-forward head, low, teeth visible even closed.
  ctx.fillStyle = materialFill(ctx, "HIDE", 4, -6, 11, 1, "#9a6a54", "#4a2c1e", "#1c120a");
  polygonPath(ctx, [[4, -3], [9, -5], [11, -2], [10, 1], [4, 0]]);
  ctx.fill();
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.moveTo(10, -1.5);
  ctx.lineTo(11.5, -0.3);
  ctx.lineTo(9.8, 0.3);
  ctx.fill();
  drawEye(ctx, 6.5, -3.5, 0.55, color, true);
  glowBlob(ctx, 6.5, -3.5, (2.5 + damageIntensity * 1.2) * rage, color);

  ctx.restore();
};

registerBossCreature(["ashfen-warlord"], drawAshfenWarlord);
registerBossCreature(["briar-summoner"], drawBriarSummoner);
registerBossCreature(["mossback-regenerator"], drawMossbackRegenerator);
registerBossCreature(["gloom-jammer"], drawGloomJammer);
registerBossCreature(["stonebound-sentinel"], drawStoneboundSentinel);
registerBossCreature(["ferocious-berserker"], drawFerociousBerserker);
