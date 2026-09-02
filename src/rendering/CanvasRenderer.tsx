import { useEffect, useRef } from "react";
import type { GameEngine, RenderSnapshot } from "@/engine/GameEngine";
import type { TowerType } from "@/config/towerStats";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { WORLD_SIZE } from "@/config/gameBalance";
import { distance, type Vector2 } from "@/utils/geometry";
import { getTowerStats } from "@/entities/Tower";
import { PALETTE, TOWER_THEME, ENEMY_THEME } from "./theme";
import { getBiome } from "./biomes";
import {
  drawAmbientParticles,
  drawBackground,
  drawDecorations,
  drawFog,
  drawPath,
  drawPathEndpoints,
  drawRangeCircle,
  drawSlot,
  drawVignette,
} from "./MapRenderer";
import { drawBossAura, drawEliteAura, drawEnemy, drawProjectile, drawTower } from "./EntityRenderer";
import { VfxManager } from "./vfx";
import type { EnemyType } from "@/config/enemyStats";

const SLOT_HIT_RADIUS = 22;
const TOWER_HIT_RADIUS = 20;

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface CanvasRendererProps {
  engine: GameEngine;
  pendingTowerType: TowerType | null;
  onSlotClick: (slotId: string) => void;
  onTowerClick: (towerId: string) => void;
  onBackgroundClick: () => void;
}

interface PrevEnemyState {
  hp: number;
  position: Vector2;
  type: EnemyType;
  direction: Vector2;
  /** World-clock timestamp (rAF time) this enemy was last hit — drives the Crawler hit-flash. */
  lastHitTimestamp: number;
  /** A boss/mini-boss death gets the same premium burst treatment as the Crawler proof piece — an event, not a routine kill. */
  isBoss: boolean;
}

/**
 * Owns the <canvas>. Runs its own requestAnimationFrame draw loop reading
 * engine.getRenderSnapshot() directly — this never goes through React
 * state/re-renders, so the visual frame rate is independent of how often
 * the HUD (a separate component) re-renders.
 *
 * It also owns a VfxManager (see ./vfx) that is fed by diffing this
 * frame's snapshot against the previous one — a purely cosmetic layer
 * (damage numbers, death bursts, build/upgrade/gold feedback) with no
 * connection back to GameEngine.
 */
export function CanvasRenderer({
  engine,
  pendingTowerType,
  onSlotClick,
  onTowerClick,
  onBackgroundClick,
}: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<Transform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const latestSnapshotRef = useRef<RenderSnapshot | null>(null);
  const pendingTowerTypeRef = useRef<TowerType | null>(pendingTowerType);
  pendingTowerTypeRef.current = pendingTowerType;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const vfx = new VfxManager();
    let prevEnemies = new Map<string, PrevEnemyState>();
    let prevTowerLevels = new Map<string, number>();
    let prevTowerCooldowns = new Map<string, number>();
    const towerAttackTimestamps = new Map<string, number>();
    let prevGold: number | null = null;
    let lastFrameTimestamp: number | null = null;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = parent.clientWidth;
      const cssHeight = parent.clientHeight;

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const scale = Math.min(cssWidth / WORLD_SIZE.width, cssHeight / WORLD_SIZE.height);
      const offsetX = (cssWidth - WORLD_SIZE.width * scale) / 2;
      const offsetY = (cssHeight - WORLD_SIZE.height * scale) / 2;
      transformRef.current = { scale: scale * dpr, offsetX: offsetX * dpr, offsetY: offsetY * dpr };
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    const gateHomePosition = ENEMY_PATH[ENEMY_PATH.length - 1]!;

    const draw = (timestamp: number) => {
      const frameDt = lastFrameTimestamp === null ? 16 : Math.min(timestamp - lastFrameTimestamp, 100);
      lastFrameTimestamp = timestamp;

      const snapshot = engine.getRenderSnapshot();
      const hud = engine.getHudSnapshot();
      latestSnapshotRef.current = snapshot;

      detectVfxEvents(snapshot, hud.gold, vfx, prevEnemies, prevTowerLevels, prevGold, gateHomePosition);

      // Attack detection: a tower's cooldown only ever counts down during
      // normal play — it can only go UP when an attack just reset it. That
      // jump is the one reliable "this tower just fired" signal available
      // from the engine's own data, no extra event plumbing needed.
      for (const tower of snapshot.towers) {
        if (tower.type !== "IRONWOOD") continue;
        const prevCooldown = prevTowerCooldowns.get(tower.id);
        if (prevCooldown !== undefined && tower.cooldownRemainingMs > prevCooldown + 50) {
          towerAttackTimestamps.set(tower.id, timestamp);
        }
      }
      prevTowerCooldowns = new Map(snapshot.towers.map((t) => [t.id, t.cooldownRemainingMs]));

      prevEnemies = new Map(
        snapshot.enemies.map((e) => {
          const prior = prevEnemies.get(e.id);
          const hit = prior !== undefined && e.hp < prior.hp;
          return [
            e.id,
            {
              hp: e.hp,
              position: e.position,
              type: e.type,
              direction: e.direction,
              lastHitTimestamp: hit ? timestamp : (prior?.lastHitTimestamp ?? -Infinity),
              isBoss: e.boss !== undefined,
            },
          ];
        }),
      );
      prevTowerLevels = new Map(snapshot.towers.map((t) => [t.id, t.level]));
      prevGold = hud.gold;
      vfx.update(frameDt);

      const biome = getBiome(snapshot.biomeId);

      const { scale, offsetX, offsetY } = transformRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

      drawBackground(ctx, biome);
      drawDecorations(ctx, biome, timestamp);
      drawPath(ctx, ENEMY_PATH, biome);
      drawPathEndpoints(ctx, ENEMY_PATH, biome, timestamp);

      const occupiedSlotIds = new Set(snapshot.towers.map((t) => t.slotId));
      TOWER_SLOTS.forEach((slot, index) => {
        drawSlot(
          ctx,
          slot,
          index,
          occupiedSlotIds.has(slot.id),
          pendingTowerTypeRef.current !== null,
          biome,
          timestamp,
        );
      });

      for (const tower of snapshot.towers) {
        const attackFlashMs =
          tower.type === "IRONWOOD" ? timestamp - (towerAttackTimestamps.get(tower.id) ?? -Infinity) : Infinity;
        drawTower(ctx, tower, tower.id === snapshot.selectedTowerId, timestamp, attackFlashMs);
        if (tower.id === snapshot.selectedTowerId) {
          drawRangeCircle(ctx, tower.position, getTowerStats(tower).range);
        }
      }

      for (const enemy of snapshot.enemies) {
        const hitFlashMs =
          enemy.type === "CRAWLER" ? timestamp - (prevEnemies.get(enemy.id)?.lastHitTimestamp ?? -Infinity) : Infinity;
        if (enemy.boss) drawBossAura(ctx, enemy, timestamp);
        else if (enemy.elite) drawEliteAura(ctx, enemy, timestamp);
        const archetypeScale = enemy.type === "SWARMLING" ? 0.65 : enemy.type === "IRONCLAD" ? 1.15 : 1;
        const scale = enemy.boss ? (enemy.boss.isMainBoss ? 1.9 : 1.4) : enemy.elite ? 1.3 : archetypeScale;
        drawEnemy(ctx, enemy, timestamp, hitFlashMs, scale);
      }
      for (const projectile of snapshot.projectiles) drawProjectile(ctx, projectile);

      vfx.draw(ctx);

      drawFog(ctx, biome, timestamp);
      drawAmbientParticles(ctx, biome, timestamp);
      drawVignette(ctx, biome);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [engine]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { scale, offsetX, offsetY } = transformRef.current;

    const canvasX = (event.clientX - rect.left) * dpr;
    const canvasY = (event.clientY - rect.top) * dpr;
    const worldPoint: Vector2 = {
      x: (canvasX - offsetX) / scale,
      y: (canvasY - offsetY) / scale,
    };

    const snapshot = latestSnapshotRef.current;
    if (!snapshot) return;

    for (const tower of snapshot.towers) {
      if (distance(worldPoint, tower.position) <= TOWER_HIT_RADIUS) {
        onTowerClick(tower.id);
        return;
      }
    }

    for (const slot of TOWER_SLOTS) {
      if (distance(worldPoint, slot.position) <= SLOT_HIT_RADIUS) {
        onSlotClick(slot.id);
        return;
      }
    }

    onBackgroundClick();
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "pointer",
        backgroundColor: PALETTE.mapBackgroundFallback,
      }}
    />
  );
}

function detectVfxEvents(
  snapshot: RenderSnapshot,
  gold: number,
  vfx: VfxManager,
  prevEnemies: Map<string, PrevEnemyState>,
  prevTowerLevels: Map<string, number>,
  prevGold: number | null,
  gatePosition: Vector2,
): void {
  // Enemies still alive: damage numbers when their hp dropped since last frame.
  // The Crawler proof piece additionally gets the premium white-hot impact
  // burst (spec: "impacto" + "partículas") instead of just a number popping.
  for (const enemy of snapshot.enemies) {
    const prev = prevEnemies.get(enemy.id);
    if (prev && enemy.hp < prev.hp) {
      const damage = prev.hp - enemy.hp;
      vfx.spawnDamageNumber(enemy.position, damage, damage >= 15);
      if (enemy.type === "CRAWLER") {
        vfx.spawnHitImpact(enemy.position, ENEMY_THEME.CRAWLER.accent, enemy.direction);
      }
    }
  }

  // Enemies that vanished since last frame: hp<=0 means a kill (engine only
  // removes on hp<=0 OR on reaching the base) — reaching the base normally
  // leaves an enemy with most of its hp intact, so this split is reliable.
  const currentIds = new Set(snapshot.enemies.map((e) => e.id));
  const killPositionsThisFrame: Vector2[] = [];
  for (const [id, prev] of prevEnemies) {
    if (currentIds.has(id)) continue;
    if (prev.hp <= 0.01) {
      const premium = prev.type === "CRAWLER" || prev.isBoss;
      vfx.spawnDeathBurst(prev.position, ENEMY_THEME[prev.type].accent, premium ? prev.direction : undefined, premium);
      killPositionsThisFrame.push(prev.position);
    } else {
      vfx.spawnBaseHitFlash(gatePosition);
    }
  }

  // Towers array only ever grows via an explicit placeTower() call (never
  // pre-populated), so a tower id absent from the previous frame is always
  // a genuine new build, never a startup artifact.
  for (const tower of snapshot.towers) {
    const prevLevel = prevTowerLevels.get(tower.id);
    if (prevLevel === undefined) {
      vfx.spawnBuildRing(tower.position, TOWER_THEME[tower.type].accent);
    } else if (tower.level > prevLevel) {
      vfx.spawnUpgradeBurst(tower.position, TOWER_THEME[tower.type].accent);
    }
  }

  if (prevGold !== null && gold > prevGold) {
    const goldOrigin = killPositionsThisFrame[0] ?? gatePosition;
    vfx.spawnGoldPopup(goldOrigin, gold - prevGold);
  }
}
