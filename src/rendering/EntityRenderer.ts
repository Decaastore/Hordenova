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

function drawIronwood(
  ctx: CanvasRenderingContext2D,
  theme: (typeof TOWER_THEME)["IRONWOOD"],
  level: number,
  timeMs: number,
): void {
  // Round timber deck — the tower's own base, distinct from the buildable
  // platform beneath it.
  const deckGradient = ctx.createLinearGradient(0, 6, 0, -4);
  deckGradient.addColorStop(0, "#6b4a2f");
  deckGradient.addColorStop(1, "#8a6238");
  ctx.fillStyle = deckGradient;
  ctx.beginPath();
  ctx.ellipse(0, 2, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a3018";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Four corner posts holding up a small watchtower canopy.
  const sway = Math.sin(timeMs / 1600) * 0.04;
  ctx.fillStyle = theme.secondary;
  const postPositions: [number, number][] = [
    [-13, 4],
    [13, 4],
    [-10, -6],
    [10, -6],
  ];
  for (const [px, py] of postPositions) {
    ctx.fillRect(px - 1.6, py - 20, 3.2, 22);
  }

  // Living canopy roof — glows brighter and gains leaf clusters with level.
  glowBlob(ctx, 0, -24, 15 + level * 1.1, theme.glow);
  ctx.save();
  ctx.rotate(sway);
  ctx.fillStyle = theme.secondary;
  ctx.beginPath();
  ctx.moveTo(0, -34 - level);
  ctx.lineTo(17, -18);
  ctx.lineTo(-17, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.primary;
  const clusters = 3 + Math.min(level, 5);
  for (let i = 0; i < clusters; i++) {
    const angle = (i / clusters) * Math.PI * 2 + timeMs / 3000;
    const r = 5.5 + (i % 2) * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 15, -19 + Math.sin(angle) * 3, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, -33 - level, 3, 0, Math.PI * 2);
  ctx.fill();

  // The archer standing watch beneath the canopy — a simple top-down
  // figure with a visible bow, not just a colored blob.
  const bowSway = Math.sin(timeMs / 500) * 0.15;
  ctx.save();
  ctx.translate(0, -3);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(1, 6, 5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.secondary;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e8c090";
  ctx.beginPath();
  ctx.arc(0, -11, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.arc(0, -12.5, 3.6, Math.PI, 0);
  ctx.fill();

  ctx.save();
  ctx.rotate(bowSway);
  ctx.strokeStyle = "#c8a878";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(6, -3, 6, Math.PI * 0.65, Math.PI * 1.35);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(6, -8.6);
  ctx.lineTo(6, 2.6);
  ctx.stroke();
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
