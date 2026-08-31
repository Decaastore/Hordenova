import type { TowerSlotDefinition } from "@/data/mapWhisperingWoods";
import type { Vector2 } from "@/utils/geometry";
import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";

/**
 * Pure drawing helpers — world-space coordinates in, pixels on screen out
 * (the caller has already applied the world->canvas transform to `ctx`).
 * Nothing in this file reads or mutates game state; it only takes plain
 * data and paints it. Placeholder shapes for now — swappable for real art
 * later without touching the engine.
 */

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_SIZE.height);
  gradient.addColorStop(0, "#151321");
  gradient.addColorStop(1, "#0d0b14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
}

export function drawPath(ctx: CanvasRenderingContext2D, path: readonly Vector2[]): void {
  if (path.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "#3a2f4a";
  ctx.lineWidth = PATH_VISUAL_WIDTH + 8;
  strokePath(ctx, path);

  ctx.strokeStyle = "#453b58";
  ctx.lineWidth = PATH_VISUAL_WIDTH;
  strokePath(ctx, path);

  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, path: readonly Vector2[]): void {
  ctx.beginPath();
  ctx.moveTo(path[0]!.x, path[0]!.y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i]!.x, path[i]!.y);
  }
  ctx.stroke();
}

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: TowerSlotDefinition,
  occupied: boolean,
  highlighted: boolean,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(slot.position.x, slot.position.y, 20, 0, Math.PI * 2);
  ctx.fillStyle = occupied ? "rgba(60,50,40,0.4)" : highlighted ? "#5b4a7a" : "#332a44";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = highlighted ? "#c9a8ff" : "#6a5a8a";
  ctx.stroke();
  ctx.restore();
}

export function drawRangeCircle(ctx: CanvasRenderingContext2D, center: Vector2, range: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(200,180,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200,180,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.restore();
}
