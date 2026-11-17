import type { TowerType } from "@/config/towerStats";
import { ELEMENT_COLOR, FUSION_COLORS, getFusionId } from "@/config/towerFusion";

/**
 * TORRES DE FUSÃO on the 2D map — a fused tower wears both its elements: a
 * ring on the ground turning in the colours of the two, and a small core of
 * the absorbed element hovering beside the tower (a flame, an ice shard, a
 * crackling orb or a glowing arrowhead). Drawn in the tower's own local,
 * already-scaled space, like the Mastery effects.
 */

const GROUND_Y = 4;

export function drawFusionUnder(ctx: CanvasRenderingContext2D, host: TowerType, fused: TowerType, timeMs: number): void {
  const id = getFusionId(host, fused);
  if (!id) return;
  const [c1, c2] = FUSION_COLORS[id];
  const t = timeMs / 1000;
  ctx.save();
  ctx.translate(0, GROUND_Y);
  ctx.scale(1, 0.42);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 2.6;
  // two half-rings chasing each other round the tower
  for (let k = 0; k < 2; k++) {
    ctx.strokeStyle = k ? c2 : c1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    const a0 = t * 1.6 + k * Math.PI;
    ctx.arc(0, 0, 31, a0, a0 + Math.PI * 0.85);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  g.addColorStop(0, `${c2}55`);
  g.addColorStop(1, `${c1}00`);
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The absorbed element's core, hovering at the tower's shoulder. */
export function drawFusionOver(ctx: CanvasRenderingContext2D, fused: TowerType, topY: number, timeMs: number): void {
  const t = timeMs / 1000;
  const col = ELEMENT_COLOR[fused];
  const x = 20 + Math.cos(t * 1.3) * 2;
  const y = topY + 14 + Math.sin(t * 2) * 2.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, 13);
  g.addColorStop(0, `${col}cc`);
  g.addColorStop(1, `${col}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = col;
  ctx.strokeStyle = "rgba(20,12,6,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (fused === "INFERNO") {
    // a flame
    const f = 1 + 0.12 * Math.sin(t * 12);
    ctx.moveTo(x, y - 7 * f);
    ctx.quadraticCurveTo(x + 5, y - 1, x + 3.5, y + 3.5);
    ctx.quadraticCurveTo(x, y + 6, x - 3.5, y + 3.5);
    ctx.quadraticCurveTo(x - 5, y - 1, x, y - 7 * f);
  } else if (fused === "FROSTBORN") {
    // an ice shard
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 3.2, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 3.2, y);
    ctx.closePath();
  } else if (fused === "STORMCALLER") {
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  } else {
    // an arrowhead
    ctx.moveTo(x, y - 6.5);
    ctx.lineTo(x + 3.6, y + 2.5);
    ctx.lineTo(x, y + 0.8);
    ctx.lineTo(x - 3.6, y + 2.5);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  if (fused === "STORMCALLER") {
    // little sparks crawling off the orb
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) {
      const a = t * 9 + i * 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      ctx.lineTo(x + Math.cos(a + 0.4) * 7.5, y + Math.sin(a - 0.3) * 7.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}
