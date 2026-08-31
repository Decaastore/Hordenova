import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerStats } from "@/entities/Tower";
import { ENEMY_THEME, TOWER_THEME } from "./theme";

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
): void {
  const stats = getTowerStats(tower);
  const theme = TOWER_THEME[tower.type];
  const growth = 1 + (stats.level - 1) * 0.09; // subtle scale growth per level

  ctx.save();
  ctx.translate(tower.position.x, tower.position.y);
  ctx.scale(growth, growth);

  drawPlinth(ctx);

  switch (tower.type) {
    case "IRONWOOD":
      drawIronwood(ctx, theme, stats.level, timeMs);
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
    ctx.arc(0, 0, 19 * growth, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Small, unobtrusive level badge — the main "it got stronger" signal is
  // the scale/glow growth above; this just gives an exact number on demand.
  ctx.save();
  ctx.translate(tower.position.x + 12 * growth, tower.position.y + 12 * growth);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(10,8,16,0.85)";
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f1ecff";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(stats.level), 0, 0.5);
  ctx.restore();
}

function drawPlinth(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 5, 0, 0, Math.PI * 2);
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

function drawIronwood(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["IRONWOOD"],
  level: number,
  timeMs: number,
): void {
  // Gnarled roots at the base.
  ctx.strokeStyle = theme.secondary;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const angle of [-2.4, -0.7, 0.7, 2.4]) {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.quadraticCurveTo(Math.cos(angle) * 6, 10, Math.cos(angle) * 13, 12);
    ctx.stroke();
  }

  // Trunk.
  const trunkGradient = ctx.createLinearGradient(0, 8, 0, -16);
  trunkGradient.addColorStop(0, theme.secondary);
  trunkGradient.addColorStop(1, theme.primary);
  ctx.fillStyle = trunkGradient;
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.quadraticCurveTo(-8, -6, -3, -16);
  ctx.lineTo(3, -16);
  ctx.quadraticCurveTo(8, -6, 6, 8);
  ctx.closePath();
  ctx.fill();

  // Living canopy — glows brighter and gains extra leaf clusters with level.
  glowBlob(ctx, 0, -18, 14 + level * 1.2, theme.glow);
  ctx.fillStyle = theme.primary;
  const clusters = 2 + Math.min(level, 5);
  for (let i = 0; i < clusters; i++) {
    const angle = (i / clusters) * Math.PI * 2 + timeMs / 3000;
    const r = 6 + (i % 2) * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 6, -18 + Math.sin(angle) * 5, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, -19, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawInferno(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["INFERNO"],
  level: number,
  timeMs: number,
): void {
  // Volcanic rock base.
  ctx.fillStyle = theme.secondary;
  ctx.beginPath();
  ctx.moveTo(-10, 8);
  ctx.lineTo(-7, -4);
  ctx.lineTo(-2, -8);
  ctx.lineTo(3, -6);
  ctx.lineTo(8, -2);
  ctx.lineTo(9, 8);
  ctx.closePath();
  ctx.fill();

  glowBlob(ctx, 0, -12, 16 + level * 1.4, theme.glow);

  // Flickering flame plume.
  const flicker = Math.sin(timeMs / 140) * 2;
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.quadraticCurveTo(-6 + flicker, -16, 0, -24 - level);
  ctx.quadraticCurveTo(6 - flicker, -16, 5, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(-2.5, -8);
  ctx.quadraticCurveTo(-3 + flicker * 0.6, -14, 0, -19 - level * 0.6);
  ctx.quadraticCurveTo(3 - flicker * 0.6, -14, 2.5, -8);
  ctx.closePath();
  ctx.fill();

  // Rising embers.
  ctx.fillStyle = "rgba(255,180,90,0.8)";
  for (let i = 0; i < 3 + Math.min(level, 3); i++) {
    const cycle = ((timeMs / 900 + i * 0.33) % 1);
    const y = -6 - cycle * 22;
    const x = Math.sin(timeMs / 500 + i * 2) * (4 + cycle * 4);
    ctx.globalAlpha = 1 - cycle;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
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
  ctx.fillStyle = "rgba(180,225,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  glowBlob(ctx, 0, -12, 15 + level * 1.2, theme.glow);

  // Central spire + two smaller flanking crystals, taller with level.
  const crystalHeight = 16 + level * 1.6;
  drawCrystalShard(ctx, 0, -crystalHeight, 6, theme);
  drawCrystalShard(ctx, -7, -6 - level, 4, theme);
  drawCrystalShard(ctx, 7, -6 - level, 4, theme);

  // Sparkle twinkles.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2 + Math.min(level, 3); i++) {
    const twinkle = (Math.sin(timeMs / 300 + i * 5) + 1) / 2;
    if (twinkle < 0.7) continue;
    const angle = i * 2.1;
    ctx.globalAlpha = (twinkle - 0.7) / 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 9, -10 + Math.sin(angle) * 8, 1.2, 0, Math.PI * 2);
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
  const baseY = 6;
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
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function drawStormcaller(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["STORMCALLER"],
  level: number,
  timeMs: number,
): void {
  // Stone pillar with glowing rune bands.
  ctx.fillStyle = "#2a2436";
  ctx.fillRect(-5, -20, 10, 26);
  ctx.fillStyle = theme.primary;
  for (let i = 0; i < 3; i++) {
    const bandPulse = 0.4 + 0.4 * Math.sin(timeMs / 500 + i * 1.4);
    ctx.globalAlpha = bandPulse;
    ctx.fillRect(-5, -17 + i * 7, 10, 2);
  }
  ctx.globalAlpha = 1;

  const orbY = -26 - level;
  glowBlob(ctx, 0, orbY, 13 + level * 1.3, theme.glow);
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, orbY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Crackling arcs jumping between the orb and the pillar top.
  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 1.2;
  const arcCount = 2 + Math.min(level, 3);
  for (let i = 0; i < arcCount; i++) {
    const seed = Math.floor(timeMs / 110) + i * 17;
    const jitter = (n: number) => (((n * 9301 + 49297) % 233280) / 233280 - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(0, orbY + 4);
    const midX = jitter(seed);
    const midY = orbY + (10 - orbY) / 2 + jitter(seed + 1) * 0.4;
    ctx.lineTo(midX, midY);
    ctx.lineTo(jitter(seed + 2) * 0.6, -18);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Enemies.
// ---------------------------------------------------------------------------

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyInstance, timeMs: number): void {
  const theme = ENEMY_THEME[enemy.type];
  const angle = Math.atan2(enemy.direction.y, enemy.direction.x);

  ctx.save();
  ctx.translate(enemy.position.x, enemy.position.y);
  ctx.rotate(angle);

  switch (enemy.type) {
    case "CRAWLER":
      drawCrawler(ctx, theme, timeMs);
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

  drawHpBar(ctx, enemy);
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

function drawCrawler(ctx: CanvasRenderingContext2D, theme: (typeof ENEMY_THEME)["CRAWLER"], timeMs: number): void {
  const legPhase = Math.sin(timeMs / 110);

  ctx.strokeStyle = theme.dark;
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, side * 5);
      ctx.lineTo(i * 3 + legPhase * side, side * (8 + Math.abs(legPhase) * 2));
      ctx.stroke();
    }
  }

  ctx.fillStyle = theme.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.dark;
  for (const x of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.arc(x, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(6, -2, 2, 0, Math.PI * 2);
  ctx.fill();
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
}

// ---------------------------------------------------------------------------
// Projectiles / attack effects.
// ---------------------------------------------------------------------------

export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance): void {
  const progress = 1 - projectile.remainingMs / projectile.totalMs;
  const theme = TOWER_THEME[projectile.towerType];

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
