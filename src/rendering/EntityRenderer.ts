import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerStats } from "@/entities/Tower";
import type { TowerType } from "@/config/towerStats";

/** Placeholder palette — swap for real sprites/art later without touching game logic. */
const TOWER_COLORS: Record<TowerType, string> = {
  IRONWOOD: "#8a9a5b",
  INFERNO: "#e2572b",
  FROSTBORN: "#4fb3d9",
  STORMCALLER: "#a05bd9",
};

const ENEMY_COLORS: Record<EnemyInstance["type"], string> = {
  CRAWLER: "#6fbf6f",
  RUNNER: "#e0d35a",
  BRUTE: "#b23a3a",
  SHIELDBEARER: "#7a8aa8",
};

export function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: TowerInstance,
  selected: boolean,
): void {
  const stats = getTowerStats(tower);
  const radius = 14 + stats.level * 1.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(tower.position.x, tower.position.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = TOWER_COLORS[tower.type];
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? "#ffe9a8" : "#1a1420";
  ctx.stroke();

  // Level pips.
  ctx.fillStyle = "#1a1420";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(stats.level), tower.position.x, tower.position.y);
  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyInstance): void {
  const radius = enemy.type === "BRUTE" ? 13 : enemy.type === "SHIELDBEARER" ? 11 : 9;

  ctx.save();
  ctx.beginPath();
  ctx.arc(enemy.position.x, enemy.position.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = ENEMY_COLORS[enemy.type];
  ctx.fill();

  if (enemy.slow) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#bfe9ff";
    ctx.stroke();
  }
  if (enemy.burn) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffb14a";
    ctx.stroke();
  }

  // HP bar.
  const hpRatio = Math.max(enemy.hp / enemy.maxHp, 0);
  const barWidth = radius * 2.2;
  const barX = enemy.position.x - barWidth / 2;
  const barY = enemy.position.y - radius - 8;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(barX, barY, barWidth, 4);
  ctx.fillStyle = hpRatio > 0.4 ? "#7be07b" : "#e05a5a";
  ctx.fillRect(barX, barY, barWidth * hpRatio, 4);

  ctx.restore();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: ProjectileInstance): void {
  const progress = 1 - projectile.remainingMs / projectile.totalMs;
  const color = TOWER_COLORS[projectile.towerType];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1 - progress * 0.3;

  drawImpactLine(ctx, projectile.from, projectile.to);

  let originForChain = projectile.to;
  for (const target of projectile.chainTargets) {
    drawImpactLine(ctx, originForChain, target);
    originForChain = target;
  }

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
