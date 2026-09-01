import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerStats } from "@/entities/Tower";
import { ENEMY_THEME, STATUS_COLORS, TOWER_THEME } from "./theme";
import { drawContactShadow, drawMagicCore, rimHighlight } from "./lighting";

/**
 * Each tower/enemy is drawn as several layered shapes with a thematic
 * identity (Phase 2 spec section 6/8) instead of one colored circle.
 * Level growth (towers) reads through scale + glow intensity + particle
 * density rather than a redesign per level, per the Phase 1 agreement
 * that assets can be swapped for real art later without touching engine
 * code — everything here only reads TowerInstance/EnemyInstance data.
 */

// ---------------------------------------------------------------------------
// Towers.
// ---------------------------------------------------------------------------

export function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: TowerInstance,
  selected: boolean,
  timeMs: number,
  attackFlashMs = Infinity,
): void {
  const stats = getTowerStats(tower);
  const theme = TOWER_THEME[tower.type];
  const growth = 1 + (stats.level - 1) * 0.09; // subtle scale growth per level
  const cooldownTotalMs = 1000 / stats.attackSpeed;
  const readiness = 1 - Math.max(0, Math.min(1, tower.cooldownRemainingMs / cooldownTotalMs));

  ctx.save();
  ctx.translate(tower.position.x, tower.position.y);
  ctx.scale(growth, growth);

  if (tower.type !== "IRONWOOD") drawPlinth(ctx);

  switch (tower.type) {
    case "IRONWOOD":
      drawIronwood(ctx, theme, stats.level, timeMs, attackFlashMs, readiness);
      break;
    case "INFERNO":
      drawInferno(ctx, theme, stats.level, timeMs);
      break;
    case "FROSTBORN":
      drawFrostborn(ctx, theme, stats.level, timeMs);
      break;
    case "STORMCALLER":
      drawStormcaller(ctx, theme, stats.level, timeMs);
      break;
  }

  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.translate(tower.position.x, tower.position.y);
    ctx.strokeStyle = "#ffe9a8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27 * growth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Small, unobtrusive level badge — the main "it got stronger" signal is
  // the scale/glow growth above; this just gives an exact number on demand.
  ctx.save();
  ctx.translate(tower.position.x + 17 * growth, tower.position.y + 18 * growth);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(43,29,18,0.88)";
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#fdf6e8";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(stats.level), 0, 0.5);
  ctx.restore();
}

function drawPlinth(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 19, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function glowBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * PREMIUM TIER — Visual Design System proof piece (Etapa 4). This is the
 * one tower drawn with the full material/lighting/animation treatment;
 * the other three keep their Phase-2 look until the direction is approved.
 *
 * `readiness` (0 = just fired, 1 = fully charged) comes straight from the
 * tower's real cooldown state, so the bow visibly draws tighter as the
 * next shot approaches — no guessing, no separate animation clock.
 * `attackFlashMs` is milliseconds since the last actual shot (detected by
 * the renderer from a cooldown reset) and drives the short release flash
 * + recoil kick, independent of the slower charging tell.
 */
function drawIronwood(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["IRONWOOD"],
  level: number,
  timeMs: number,
  attackFlashMs: number,
  readiness: number,
): void {
  drawContactShadow(ctx, 19, 8, 0.4);

  // --- Deck: timber, matte, grain-lined, shaded top-left → bottom-right. ---
  const deckGradient = ctx.createLinearGradient(-14, -6, 11, 8);
  deckGradient.addColorStop(0, "#a9855a");
  deckGradient.addColorStop(0.5, "#7a5433");
  deckGradient.addColorStop(1, "#54371e");
  ctx.fillStyle = deckGradient;
  ctx.beginPath();
  ctx.ellipse(0, 2, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2412";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = "rgba(58,36,18,0.35)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 2, 13 - i * 4, 7.4 - i * 2.2, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  rimHighlight(
    ctx,
    () => ctx.ellipse(0, 2, 17, 10, 0, Math.PI * 1.05, Math.PI * 1.65),
    "#f0d7a8",
    1.3,
    0.5,
  );

  // --- Corner posts: wood shaft + iron collar (a visibly different material). ---
  const sway = Math.sin(timeMs / 1600) * 0.04;
  const postPositions: [number, number][] = [
    [-13, 4],
    [13, 4],
    [-10, -6],
    [10, -6],
  ];
  for (const [px, py] of postPositions) {
    ctx.fillStyle = theme.secondary;
    ctx.fillRect(px - 1.6, py - 20, 3.2, 22);
    ctx.fillStyle = "rgba(232,222,196,0.4)";
    ctx.fillRect(px - 1.6, py - 20, 1, 22);
    ctx.fillStyle = "#382a1c";
    ctx.fillRect(px - 1.9, py - 5, 3.8, 2.4);
    ctx.fillStyle = "rgba(210,200,175,0.5)";
    ctx.fillRect(px - 1.9, py - 5, 3.8, 0.7);
  }

  // A small level-lit rune on the front-right post — the only per-level
  // ornament change beyond scale, so growth still reads as "stronger".
  const runeGlow = 0.2 + Math.min(level, 5) * 0.13;
  ctx.fillStyle = `rgba(212,247,154,${runeGlow})`;
  ctx.beginPath();
  ctx.arc(10, -14, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // --- Living canopy roof — two-tone foliage shaded against the light. ---
  glowBlob(ctx, 0, -24, 15 + level * 1.1, theme.glow);
  ctx.save();
  ctx.rotate(sway);
  const roofGradient = ctx.createLinearGradient(-17, -34, 17, -18);
  roofGradient.addColorStop(0, "#3f7a28");
  roofGradient.addColorStop(1, theme.secondary);
  ctx.fillStyle = roofGradient;
  ctx.beginPath();
  ctx.moveTo(0, -34 - level);
  ctx.lineTo(17, -18);
  ctx.lineTo(-17, -18);
  ctx.closePath();
  ctx.fill();
  rimHighlight(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(0, -34 - level);
      ctx.lineTo(-17, -18);
    },
    "#c9f78f",
    1.1,
    0.5,
  );

  const clusters = 3 + Math.min(level, 5);
  for (let i = 0; i < clusters; i++) {
    const angle = (i / clusters) * Math.PI * 2 + timeMs / 3000;
    const r = 5.5 + (i % 2) * 2;
    const facingLight = Math.cos(angle - 2.4) > 0.1;
    ctx.fillStyle = facingLight ? theme.accent : theme.primary;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 15, -19 + Math.sin(angle) * 3, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, -33 - level, 3, 0, Math.PI * 2);
  ctx.fill();

  // --- The archer standing watch beneath the canopy. ---
  const firing = attackFlashMs < 160;
  const recoil = firing ? 1 - attackFlashMs / 160 : 0;
  const releaseFlash = attackFlashMs < 90 ? 1 - attackFlashMs / 90 : 0;
  const drawTension = 0.25 + Math.max(0, Math.min(1, readiness)) * 0.85;
  const idleSway = Math.sin(timeMs / 500) * 0.05;
  const breath = Math.sin(timeMs / 900) * 0.03;

  ctx.save();
  ctx.translate(-recoil * 1.4, -3 + recoil * 0.5);
  ctx.scale(1, 1 + breath);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(1, 6, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak — cloth material: matte, shaded, with fold lines.
  const cloakGradient = ctx.createLinearGradient(-5, -9, 5, 6);
  cloakGradient.addColorStop(0, theme.primary);
  cloakGradient.addColorStop(1, theme.secondary);
  ctx.fillStyle = cloakGradient;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-1.5, -4);
  ctx.lineTo(-2.4, 5);
  ctx.moveTo(1.6, -3);
  ctx.lineTo(2.5, 5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(-3.8, 3);
  ctx.stroke();

  ctx.fillStyle = "#e8c090";
  ctx.beginPath();
  ctx.arc(0, -11, 3.4, 0, Math.PI * 2);
  ctx.fill();
  const hoodGradient = ctx.createLinearGradient(-3.6, -15, 3.6, -9);
  hoodGradient.addColorStop(0, theme.primary);
  hoodGradient.addColorStop(1, theme.secondary);
  ctx.fillStyle = hoodGradient;
  ctx.beginPath();
  ctx.arc(0, -12.5, 3.6, Math.PI, 0);
  ctx.fill();

  ctx.save();
  ctx.rotate(idleSway);
  const nockPullback = 1.5 * drawTension;
  ctx.strokeStyle = "#c8a878";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(6, -3, 6, Math.PI * 0.65, Math.PI * 1.35);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(6, -8.6);
  ctx.lineTo(6 - nockPullback, -3);
  ctx.lineTo(6, 2.6);
  ctx.stroke();

  if (releaseFlash > 0) {
    ctx.save();
    ctx.globalAlpha = releaseFlash;
    drawMagicCore(ctx, 6 - nockPullback, -3, 7 * releaseFlash, theme.accent);
    ctx.restore();
  } else if (readiness > 0.92) {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 220);
    ctx.fillStyle = STATUS_COLORS.readyPulse;
    ctx.globalAlpha = 0.35 + 0.5 * pulse;
    ctx.beginPath();
    ctx.arc(6 - nockPullback, -3, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.restore();
}

function drawInferno(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["INFERNO"],
  level: number,
  timeMs: number,
): void {
  // Round stone furnace ring.
  const stoneGradient = ctx.createRadialGradient(-3, -4, 2, 0, 0, 18);
  stoneGradient.addColorStop(0, "#8a7a62");
  stoneGradient.addColorStop(1, theme.secondary);
  ctx.fillStyle = stoneGradient;
  ctx.beginPath();
  ctx.ellipse(0, 4, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a2410";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glowing cracks across the stone.
  ctx.strokeStyle = `rgba(255,140,50,${0.5 + 0.3 * Math.sin(timeMs / 260)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, 3);
  ctx.lineTo(-4, 6);
  ctx.moveTo(9, 1);
  ctx.lineTo(13, 6);
  ctx.stroke();

  // Furnace opening.
  const openingGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
  openingGlow.addColorStop(0, "#fff0c0");
  openingGlow.addColorStop(0.5, theme.primary);
  openingGlow.addColorStop(1, theme.secondary);
  ctx.fillStyle = openingGlow;
  ctx.beginPath();
  ctx.ellipse(0, 1, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  glowBlob(ctx, 0, -14, 17 + level * 1.4, theme.glow);

  // Flickering flame plume.
  const flicker = Math.sin(timeMs / 140) * 2.4;
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.quadraticCurveTo(-7 + flicker, -18, 0, -30 - level * 1.2);
  ctx.quadraticCurveTo(7 - flicker, -18, 6, -2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(-3, -4);
  ctx.quadraticCurveTo(-3.5 + flicker * 0.6, -16, 0, -24 - level * 0.8);
  ctx.quadraticCurveTo(3.5 - flicker * 0.6, -16, 3, -4);
  ctx.closePath();
  ctx.fill();

  // Smoke wisps drifting up and away.
  ctx.fillStyle = "rgba(140,130,120,0.28)";
  for (let i = 0; i < 2; i++) {
    const cycle = (timeMs / 2200 + i * 0.5) % 1;
    ctx.beginPath();
    ctx.arc(4 + i * 3 + cycle * 6, -26 - cycle * 16, 3 + cycle * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rising embers.
  ctx.fillStyle = "rgba(255,180,90,0.85)";
  for (let i = 0; i < 3 + Math.min(level, 3); i++) {
    const cycle = (timeMs / 900 + i * 0.33) % 1;
    const y = -8 - cycle * 26;
    const x = Math.sin(timeMs / 500 + i * 2) * (4 + cycle * 5);
    ctx.globalAlpha = 1 - cycle;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFrostborn(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
  level: number,
  timeMs: number,
): void {
  ctx.fillStyle = "rgba(180,225,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hexagonal ice pedestal.
  const pedestalGradient = ctx.createLinearGradient(0, 6, 0, -6);
  pedestalGradient.addColorStop(0, "#5a92b8");
  pedestalGradient.addColorStop(1, "#a8dcf5");
  ctx.fillStyle = pedestalGradient;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(angle) * 15;
    const py = Math.sin(angle) * 9 + 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  glowBlob(ctx, 0, -16, 17 + level * 1.3, theme.glow);

  // Central spire + two smaller flanking crystals, taller with level.
  const crystalHeight = 22 + level * 2;
  drawCrystalShard(ctx, 0, -crystalHeight, 8, theme);
  drawCrystalShard(ctx, -9, -8 - level * 1.2, 5, theme);
  drawCrystalShard(ctx, 9, -8 - level * 1.2, 5, theme);

  // A small shard orbiting the cluster.
  const orbitAngle = timeMs / 1400;
  const ox = Math.cos(orbitAngle) * 13;
  ctx.save();
  ctx.translate(ox, -12 + Math.sin(orbitAngle) * 4);
  ctx.rotate(orbitAngle * 2);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(1.6, 0);
  ctx.lineTo(0, 3);
  ctx.lineTo(-1.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Sparkle twinkles.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2 + Math.min(level, 3); i++) {
    const twinkle = (Math.sin(timeMs / 300 + i * 5) + 1) / 2;
    if (twinkle < 0.7) continue;
    const angle = i * 2.1;
    ctx.globalAlpha = (twinkle - 0.7) / 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 11, -12 + Math.sin(angle) * 9, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCrystalShard(
  ctx: CanvasRenderingContext2D,
  x: number,
  tipY: number,
  width: number,
  theme: (typeof TOWER_THEME)["FROSTBORN"],
): void {
  const baseY = 4;
  const gradient = ctx.createLinearGradient(0, tipY, 0, baseY);
  gradient.addColorStop(0, theme.accent);
  gradient.addColorStop(1, theme.primary);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x + width, (tipY + baseY) / 2);
  ctx.lineTo(x + width * 0.6, baseY);
  ctx.lineTo(x - width * 0.6, baseY);
  ctx.lineTo(x - width, (tipY + baseY) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawStormcaller(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["STORMCALLER"],
  level: number,
  timeMs: number,
): void {
  // Two-tier stone plinth.
  ctx.fillStyle = "#4a3f30";
  ctx.beginPath();
  ctx.ellipse(0, 7, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a4a38";
  ctx.beginPath();
  ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rune pillar.
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(-6, -26, 12, 30);
  ctx.fillStyle = theme.primary;
  for (let i = 0; i < 3; i++) {
    const bandPulse = 0.4 + 0.4 * Math.sin(timeMs / 500 + i * 1.4);
    ctx.globalAlpha = bandPulse;
    ctx.fillRect(-6, -22 + i * 8, 12, 2.4);
  }
  ctx.globalAlpha = 1;

  const orbY = -32 - level * 1.4;
  glowBlob(ctx, 0, orbY, 16 + level * 1.3, theme.glow);

  // A rotating arcane ring around the orb (drawn as a squashed ellipse for
  // a top-down "ring" read).
  ctx.save();
  ctx.translate(0, orbY);
  ctx.rotate(timeMs / 2000);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, orbY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Crackling arcs jumping between the orb and the pillar top.
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 1.3;
  const arcCount = 2 + Math.min(level, 3);
  for (let i = 0; i < arcCount; i++) {
    const seed = Math.floor(timeMs / 110) + i * 17;
    const jitter = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 12;
    ctx.beginPath();
    ctx.moveTo(0, orbY + 5);
    const midX = jitter(seed);
    const midY = orbY + (-24 - orbY) / 2 + jitter(seed + 1) * 0.4;
    ctx.lineTo(midX, midY);
    ctx.lineTo(jitter(seed + 2) * 0.6, -24);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Enemies.
// ---------------------------------------------------------------------------

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyInstance,
  timeMs: number,
  hitFlashMs = Infinity,
): void {
  const theme = ENEMY_THEME[enemy.type];
  const angle = Math.atan2(enemy.direction.y, enemy.direction.x);

  ctx.save();
  ctx.translate(enemy.position.x, enemy.position.y);

  // Contact shadow is cast in world space, drawn BEFORE the body rotates to
  // face its travel direction — otherwise the shadow would swing around
  // with the enemy at every turn instead of staying anchored to the fixed
  // top-left light source.
  if (enemy.type === "CRAWLER") drawContactShadow(ctx, 10, 4.5, 0.32);

  ctx.save();
  ctx.rotate(angle);
  switch (enemy.type) {
    case "CRAWLER":
      drawCrawler(ctx, theme, timeMs, hitFlashMs);
      break;
    case "RUNNER":
      drawRunner(ctx, theme, timeMs);
      break;
    case "BRUTE":
      drawBrute(ctx, theme);
      break;
    case "SHIELDBEARER":
      drawShieldbearer(ctx, theme);
      break;
  }
  ctx.restore();

  if (enemy.slow) {
    ctx.strokeStyle = "rgba(150,220,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.burn) {
    ctx.strokeStyle = "rgba(255,150,60,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (enemy.type === "CRAWLER") drawHpBarPremium(ctx, enemy);
  else drawHpBar(ctx, enemy);
}

function drawHpBar(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
  const radius = enemy.type === "BRUTE" ? 13 : enemy.type === "SHIELDBEARER" ? 11 : 9;
  const hpRatio = Math.max(enemy.hp / enemy.maxHp, 0);
  const barWidth = radius * 2.2;
  const barX = enemy.position.x - barWidth / 2;
  const barY = enemy.position.y - radius - 8;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(barX, barY, barWidth, 4);
  ctx.fillStyle = hpRatio > 0.4 ? "#7be07b" : "#e05a5a";
  ctx.fillRect(barX, barY, barWidth * hpRatio, 4);
}

/**
 * PREMIUM TIER (Etapa 4 proof) — rounded, gradient-filled bar using the
 * Design System's exclusive status colors (never reused as a body/material
 * color elsewhere), so HP reads as a distinct state signal at a glance,
 * including while the enemy is moving (drawn unrotated, always upright).
 */
function drawHpBarPremium(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
  const radius = 9;
  const hpRatio = Math.max(enemy.hp / enemy.maxHp, 0);
  const barWidth = radius * 2.4;
  const barHeight = 4.2;
  const barX = enemy.position.x - barWidth / 2;
  const barY = enemy.position.y - radius - 9;
  const fillColor =
    hpRatio > 0.6 ? STATUS_COLORS.hpHealthy : hpRatio > 0.3 ? STATUS_COLORS.hpWounded : STATUS_COLORS.hpCritical;

  const r = barHeight / 2;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundedRect(ctx, barX + 0.6, barY + 1, barWidth, barHeight, r);
  ctx.fill();

  ctx.fillStyle = STATUS_COLORS.hpTrack;
  roundedRect(ctx, barX, barY, barWidth, barHeight, r);
  ctx.fill();

  if (hpRatio > 0) {
    const fillGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    fillGradient.addColorStop(0, fillColor);
    fillGradient.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.save();
    roundedRect(ctx, barX, barY, barWidth, barHeight, r);
    ctx.clip();
    ctx.fillStyle = fillGradient;
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(20,14,8,0.6)";
  ctx.lineWidth = 0.8;
  roundedRect(ctx, barX, barY, barWidth, barHeight, r);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * PREMIUM TIER — Visual Design System proof piece (Etapa 4). Chitin body
 * shaded against the fixed top-left light, rim-lit shell segments, a
 * white hit-flash pop on `hitFlashMs`, and a livelier idle cycle (legs +
 * antenna twitch + body bob) than the Phase-2 version.
 */
function drawCrawler(
  ctx: CanvasRenderingContext2D,
  theme: (typeof ENEMY_THEME)["CRAWLER"],
  timeMs: number,
  hitFlashMs: number,
): void {
  const legPhase = Math.sin(timeMs / 110);
  const bob = Math.sin(timeMs / 220) * 0.4;
  const antennaTwitch = Math.sin(timeMs / 260) * 0.25;
  const hitFlash = hitFlashMs < 120 ? 1 - hitFlashMs / 120 : 0;

  ctx.save();
  ctx.translate(0, bob);

  // Legs — matte chitin, darker than the shell.
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, side * 5);
      ctx.lineTo(i * 3 + legPhase * side, side * (8 + Math.abs(legPhase) * 2));
      ctx.stroke();
    }
  }

  // Antennae — small idle-only detail, not present on the Phase-2 version.
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, -3);
  ctx.quadraticCurveTo(9, -6 + antennaTwitch, 10.5, -5 + antennaTwitch);
  ctx.moveTo(6, 1);
  ctx.quadraticCurveTo(9, 3 - antennaTwitch, 10.5, 4 - antennaTwitch);
  ctx.stroke();

  // Body — glossy chitin, shaded top-left (lit) to bottom-right (shadow).
  const bodyGradient = ctx.createRadialGradient(-3, -2.5, 1, 0, 0, 10);
  bodyGradient.addColorStop(0, theme.accent);
  bodyGradient.addColorStop(0.45, theme.body);
  bodyGradient.addColorStop(1, theme.dark);
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  rimHighlight(ctx, () => ctx.ellipse(0, 0, 9, 6.5, 0, Math.PI * 1.1, Math.PI * 1.7), "#ffffff", 1, 0.35);

  // Overlapping shell segments — each with its own tiny lit/shadow split,
  // the "material" cue that distinguishes this from a flat blob.
  for (const x of [-4, 0, 4]) {
    ctx.fillStyle = theme.dark;
    ctx.beginPath();
    ctx.arc(x, -1, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.arc(x - 0.5, -1.6, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(6.6, -2.6, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = hitFlash * 0.85;
    ctx.fillStyle = STATUS_COLORS.hitFlash;
    ctx.beginPath();
    ctx.ellipse(0, bob, 9.4, 6.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRunner(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["RUNNER"], timeMs: number): void {
  ctx.strokeStyle = `rgba(217,194,70,${0.35 + 0.15 * Math.sin(timeMs / 80)})`;
  ctx.lineWidth = 1.4;
  for (const offset of [-3, 0, 3]) {
    ctx.beginPath();
    ctx.moveTo(-6, offset);
    ctx.lineTo(-13, offset * 1.4);
    ctx.stroke();
  }

  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrute(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["BRUTE"]): void {
  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.ellipse(-2, -7, 6, 3.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2, 7, 6, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Riveted chest plate — armored bulk, not just a bigger blob.
  ctx.fillStyle = "#8a8272";
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, -5);
  ctx.lineTo(4, 6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.dark;
  for (const [px, py] of [
    [-4, -3],
    [3, -2],
    [-2, 3],
    [2, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(13, -3);
  ctx.lineTo(19, 0);
  ctx.lineTo(13, 3);
  ctx.closePath();
  ctx.fill();
}

function drawShieldbearer(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["SHIELDBEARER"]): void {
  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 8, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Large shield facing the direction of travel.
  const shieldGradient = ctx.createLinearGradient(6, -9, 6, 9);
  shieldGradient.addColorStop(0, theme.accent);
  shieldGradient.addColorStop(1, theme.dark);
  ctx.fillStyle = shieldGradient;
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.lineTo(11, -5);
  ctx.lineTo(11, 5);
  ctx.lineTo(4, 9);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = theme.dark;
  ctx.beginPath();
  ctx.arc(-4, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(-4, -1.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Projectiles / attack effects.
// ---------------------------------------------------------------------------

export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance): void {
  const progress = 1 - projectile.remainingMs / projectile.totalMs;
  const theme = TOWER_THEME[projectile.towerType];

  if (projectile.towerType === "IRONWOOD") {
    drawIronwoodArrow(ctx, projectile, progress);
  } else {
    ctx.save();
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 1 - progress * 0.35;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 6;

    drawImpactLine(ctx, projectile.from, projectile.to);

    let originForChain = projectile.to;
    for (const target of projectile.chainTargets) {
      drawImpactLine(ctx, originForChain, target);
      originForChain = target;
    }

    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = Math.max(1 - progress * 1.4, 0);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(projectile.to.x, projectile.to.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawImpactLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function quadPoint(p0: number, p1: number, p2: number, t: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

/**
 * PREMIUM TIER — a lofted, curved arrow arc for the Ironwood proof piece
 * (spec: "trails curvos"), replacing the shared straight impact-line used
 * by the other three towers. Fading trail behind a rotated arrow head that
 * tracks the curve's tangent, so it visibly flies rather than teleports.
 */
function drawIronwoodArrow(
  ctx: CanvasRenderingContext2D,
  projectile: ProjectileInstance,
  progress: number,
): void {
  const { from, to } = projectile;
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const arcHeight = Math.min(16, dist * 0.2);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - arcHeight;

  const currentX = quadPoint(from.x, midX, to.x, progress);
  const currentY = quadPoint(from.y, midY, to.y, progress);
  const tangentX = 2 * (1 - progress) * (midX - from.x) + 2 * progress * (to.x - midX);
  const tangentY = 2 * (1 - progress) * (midY - from.y) + 2 * progress * (to.y - midY);
  const angle = Math.atan2(tangentY, tangentX);

  ctx.save();
  const trailGradient = ctx.createLinearGradient(from.x, from.y, currentX, currentY);
  trailGradient.addColorStop(0, "rgba(212,247,154,0)");
  trailGradient.addColorStop(1, "rgba(212,247,154,0.6)");
  ctx.strokeStyle = trailGradient;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, currentX, currentY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.rotate(angle);
  ctx.strokeStyle = "#5a3f22";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(3, 0);
  ctx.stroke();
  ctx.fillStyle = "#e8e0c8";
  ctx.beginPath();
  ctx.moveTo(4.5, 0);
  ctx.lineTo(1, -1.7);
  ctx.lineTo(1, 1.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#c9b790";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8.5, -2.2);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8.5, 2.2);
  ctx.stroke();
  ctx.restore();
}
