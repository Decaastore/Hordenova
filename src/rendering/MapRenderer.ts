import type { TowerSlotDefinition } from "@/data/mapWhisperingWoods";
import type { Vector2 } from "@/utils/geometry";
import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";
import { PALETTE } from "./theme";
import { MAP_DECORATIONS, type Decoration } from "./mapDecorations";

/**
 * Pure drawing helpers — world-space coordinates in, pixels on screen out
 * (the caller has already applied the world->canvas transform to `ctx`).
 * Nothing in this file reads or mutates game state; it only takes plain
 * data and paints it. `timeMs` is wall-clock time used only for slow
 * cosmetic animation (fog drift, crystal pulse) — never gameplay time.
 */

// ---------------------------------------------------------------------------
// Background: sky, distant treeline, vignette.
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_SIZE.height);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.55, PALETTE.forestFar);
  gradient.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);

  drawTreeline(ctx, 0, 0.85);
  drawTreeline(ctx, 42, 1);
}

/** A soft, repeating silhouette of tree canopies along the top edge for depth. */
function drawTreeline(ctx: CanvasRenderingContext2D, yOffset: number, opacity: number): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = PALETTE.forestNear;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const bumpWidth = 70;
  for (let x = 0; x <= WORLD_SIZE.width + bumpWidth; x += bumpWidth) {
    const h = yOffset + 30 + ((x * 37) % 40);
    ctx.quadraticCurveTo(x + bumpWidth / 2, h, x + bumpWidth, yOffset + 20);
  }
  ctx.lineTo(WORLD_SIZE.width, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A few dark, distant humanoid shapes at the treeline — used by the main menu background for mood. */
export function drawDistantSilhouettes(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const positions = [
    { x: WORLD_SIZE.width * 0.18, y: 92 },
    { x: WORLD_SIZE.width * 0.34, y: 78 },
    { x: WORLD_SIZE.width * 0.78, y: 88 },
  ];
  ctx.save();
  ctx.fillStyle = "rgba(5,3,8,0.55)";
  positions.forEach((pos, i) => {
    const bob = Math.sin(timeMs / 1400 + i * 2) * 1.5;
    const x = pos.x;
    const y = pos.y + bob;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D): void {
  const cx = WORLD_SIZE.width / 2;
  const cy = WORLD_SIZE.height / 2;
  const radius = Math.max(WORLD_SIZE.width, WORLD_SIZE.height) * 0.72;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, PALETTE.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
}

// ---------------------------------------------------------------------------
// Scenery: trees, rocks, roots, ruins, crystals.
// ---------------------------------------------------------------------------

export function drawDecorations(ctx: CanvasRenderingContext2D, timeMs: number): void {
  for (const deco of MAP_DECORATIONS) {
    ctx.save();
    ctx.translate(deco.position.x, deco.position.y);
    ctx.rotate(deco.rotation);
    ctx.scale(deco.scale, deco.scale);

    switch (deco.kind) {
      case "TREE":
        drawTree(ctx, deco);
        break;
      case "ROCK":
        drawRock(ctx, deco);
        break;
      case "ROOT":
        drawRoot(ctx);
        break;
      case "RUIN":
        drawRuinDecor(ctx);
        break;
      case "CRYSTAL":
        drawCrystalDecor(ctx, timeMs);
        break;
      case "GRASS":
        drawGrassTuft(ctx);
        break;
    }
    ctx.restore();
  }
}

function drawTree(ctx: CanvasRenderingContext2D, deco: Decoration): void {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(2, 4, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#241a1a";
  ctx.fillRect(-2.5, -2, 5, 16);

  const canopyColors = ["#1e2a1a", "#22331e", "#1a2416"];
  ctx.fillStyle = canopyColors[deco.variant] ?? canopyColors[0]!;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 6, -8 - i * 4, 13 - i * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRock(ctx: CanvasRenderingContext2D, deco: Decoration): void {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = deco.variant === 0 ? "#3a3644" : "#332f3c";
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(-4, -6);
  ctx.lineTo(4, -7);
  ctx.lineTo(9, 1);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(2, 2);
  ctx.stroke();
}

function drawRoot(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#2a2032";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-4, 6, 6, -2);
  ctx.quadraticCurveTo(12, -6, 18, 2);
  ctx.stroke();
}

function drawRuinDecor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4a4238";
  ctx.fillRect(-10, -14, 7, 22);
  ctx.fillRect(2, -8, 8, 16);
  ctx.fillStyle = "#3a332b";
  ctx.fillRect(-10, -14, 7, 4);

  ctx.fillStyle = "rgba(120,200,140,0.15)";
  ctx.beginPath();
  ctx.arc(-6, -10, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrystalDecor(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 900);
  ctx.save();
  ctx.globalAlpha = pulse;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
  glow.addColorStop(0, "rgba(138,217,255,0.45)");
  glow.addColorStop(1, "rgba(138,217,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.crystal;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, -2);
  ctx.lineTo(2, 6);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-5, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(2, -2);
  ctx.lineTo(0, 6);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();
}

function drawGrassTuft(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#2f3f24";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2, 4);
    ctx.quadraticCurveTo(i * 2 + 1, -2, i * 3, -7);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Road.
// ---------------------------------------------------------------------------

export function drawPath(ctx: CanvasRenderingContext2D, path: readonly Vector2[]): void {
  if (path.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = PATH_VISUAL_WIDTH + 14;
  strokePath(ctx, path);

  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = PATH_VISUAL_WIDTH + 6;
  strokePath(ctx, path);

  const roadGradient = ctx.createLinearGradient(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
  roadGradient.addColorStop(0, PALETTE.roadFillDark);
  roadGradient.addColorStop(1, PALETTE.roadFill);
  ctx.strokeStyle = roadGradient;
  ctx.lineWidth = PATH_VISUAL_WIDTH;
  strokePath(ctx, path);

  // Worn ruts down the middle for texture without needing a bitmap.
  ctx.strokeStyle = PALETTE.roadRut;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 14]);
  strokePath(ctx, path);
  ctx.setLineDash([]);

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

/** VOID PORTAL at the path's start and LAST BASTION gate at its end. */
export function drawPathEndpoints(ctx: CanvasRenderingContext2D, path: readonly Vector2[], timeMs: number): void {
  if (path.length < 2) return;
  drawVoidPortal(ctx, path[0]!, timeMs);
  drawLastBastion(ctx, path[path.length - 1]!);
}

function drawVoidPortal(ctx: CanvasRenderingContext2D, position: Vector2, timeMs: number): void {
  ctx.save();
  ctx.translate(position.x, position.y);

  const pulse = 0.7 + 0.3 * Math.sin(timeMs / 700);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  glow.addColorStop(0, `rgba(160,90,220,${0.55 * pulse})`);
  glow.addColorStop(1, "rgba(160,90,220,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2a1a3a";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0.4, Math.PI * 2 - 0.4);
  ctx.stroke();

  ctx.fillStyle = "#0d0616";
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(200,150,255,${0.7 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 19, timeMs / 1000, timeMs / 1000 + Math.PI * 1.3);
  ctx.stroke();

  ctx.restore();
}

function drawLastBastion(ctx: CanvasRenderingContext2D, position: Vector2): void {
  ctx.save();
  ctx.translate(position.x, position.y);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#332c3f";
  ctx.fillRect(-36, -30, 14, 40);
  ctx.fillRect(22, -30, 14, 40);
  ctx.fillStyle = "#241f2e";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-36 + i * 2, -34, 4, 6);
    ctx.fillRect(22 + i * 2, -34, 4, 6);
  }

  const doorGradient = ctx.createLinearGradient(0, -20, 0, 12);
  doorGradient.addColorStop(0, "#e8c15a");
  doorGradient.addColorStop(1, "#8a6a2a");
  ctx.fillStyle = doorGradient;
  ctx.beginPath();
  ctx.moveTo(-20, 14);
  ctx.lineTo(-20, -6);
  ctx.quadraticCurveTo(0, -22, 20, -6);
  ctx.lineTo(20, 14);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tower slots — each buildable position reads as a real platform, not a dot.
// ---------------------------------------------------------------------------

type PlatformStyle = "CLEARING" | "STONE" | "RUIN" | "MAGIC";

function styleForSlot(slot: TowerSlotDefinition, index: number): PlatformStyle {
  if (slot.distanceCategory === "CLOSE") return "CLEARING";
  if (slot.distanceCategory === "MEDIUM") return "STONE";
  return index % 2 === 0 ? "RUIN" : "MAGIC";
}

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: TowerSlotDefinition,
  index: number,
  occupied: boolean,
  highlighted: boolean,
  timeMs: number,
): void {
  const style = styleForSlot(slot, index);
  ctx.save();
  ctx.translate(slot.position.x, slot.position.y);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (style === "CLEARING") drawClearingPlatform(ctx);
  else if (style === "STONE") drawStonePlatform(ctx);
  else if (style === "RUIN") drawRuinPlatform(ctx);
  else drawMagicPlatform(ctx, timeMs);

  if (!occupied && highlighted) {
    ctx.strokeStyle = "rgba(201,168,255,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (occupied) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawClearingPlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotClearing;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1c2916";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawGrassTuft(ctx);
}

function drawStonePlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotStone;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2734";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(6, 4);
  ctx.moveTo(-4, 10);
  ctx.lineTo(4, -10);
  ctx.stroke();
}

function drawRuinPlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotRuin;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#332b22";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(80,110,80,0.3)";
  ctx.beginPath();
  ctx.arc(-6, 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#241d18";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.lineTo(-6, -16);
  ctx.stroke();
}

function drawMagicPlatform(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.fillStyle = PALETTE.slotMagic;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();

  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 800);
  ctx.strokeStyle = `rgba(201,168,255,${0.35 + 0.35 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(201,168,255,${0.5 + 0.3 * pulse})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + timeMs / 4000;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
    ctx.lineTo(Math.cos(angle) * 21, Math.sin(angle) * 21);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Range indicator.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Atmosphere: drifting fog + ambient motes.
// ---------------------------------------------------------------------------

export function drawFog(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const t = timeMs / 20000 + i * 3.1;
    const x = (Math.sin(t) * 0.5 + 0.5) * WORLD_SIZE.width;
    const y = 120 + i * 160 + Math.cos(t * 0.7) * 40;
    const radius = 260;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, PALETTE.fog);
    gradient.addColorStop(1, "rgba(150,140,200,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const AMBIENT_MOTE_COUNT = 22;
const ambientMoteSeeds = Array.from({ length: AMBIENT_MOTE_COUNT }, (_, i) => ({
  baseX: (i * 137) % WORLD_SIZE.width,
  baseY: (i * 71 + 40) % WORLD_SIZE.height,
  speed: 6 + (i % 5),
  phase: i,
}));

export function drawAmbientParticles(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.save();
  for (const mote of ambientMoteSeeds) {
    const y = (mote.baseY - (timeMs / 1000) * mote.speed) % WORLD_SIZE.height;
    const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
    const x = mote.baseX + Math.sin(timeMs / 2000 + mote.phase) * 12;
    const alpha = 0.15 + 0.15 * Math.sin(timeMs / 1500 + mote.phase * 2);
    ctx.fillStyle = `rgba(200,190,255,${Math.max(alpha, 0.05)})`;
    ctx.beginPath();
    ctx.arc(x, wrappedY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
