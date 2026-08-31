import { useEffect, useRef } from "react";
import type { GameEngine, RenderSnapshot } from "@/engine/GameEngine";
import type { TowerType } from "@/config/towerStats";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { WORLD_SIZE } from "@/config/gameBalance";
import { distance, type Vector2 } from "@/utils/geometry";
import { getTowerStats } from "@/entities/Tower";
import { drawBackground, drawPath, drawRangeCircle, drawSlot } from "./MapRenderer";
import { drawEnemy, drawProjectile, drawTower } from "./EntityRenderer";

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

/**
 * Owns the <canvas>. Runs its own requestAnimationFrame draw loop reading
 * engine.getRenderSnapshot() directly — this never goes through React
 * state/re-renders, so the visual frame rate is independent of how often
 * the HUD (a separate component) re-renders.
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

    const draw = () => {
      const snapshot = engine.getRenderSnapshot();
      latestSnapshotRef.current = snapshot;

      const { scale, offsetX, offsetY } = transformRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

      drawBackground(ctx);
      drawPath(ctx, ENEMY_PATH);

      const occupiedSlotIds = new Set(snapshot.towers.map((t) => t.slotId));
      for (const slot of TOWER_SLOTS) {
        drawSlot(ctx, slot, occupiedSlotIds.has(slot.id), pendingTowerTypeRef.current !== null);
      }

      for (const tower of snapshot.towers) {
        drawTower(ctx, tower, tower.id === snapshot.selectedTowerId);
        if (tower.id === snapshot.selectedTowerId) {
          drawRangeCircle(ctx, tower.position, getTowerStats(tower).range);
        }
      }

      for (const enemy of snapshot.enemies) drawEnemy(ctx, enemy);
      for (const projectile of snapshot.projectiles) drawProjectile(ctx, projectile);

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
      style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }}
    />
  );
}
