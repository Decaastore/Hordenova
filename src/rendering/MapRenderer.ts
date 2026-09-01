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
 * cosmetic animation (torch flicker, crystal pulse) — never gameplay time.
 *
 * Art direction: EPIC FANTASY / MEDIEVAL ADVENTURE — bright forest greens,
 * warm golden light, natural stone/earth tones, vivid colorful magic.
 * Deliberately not dark-fantasy: no near-black grounds, no heavy grey.
 */

// ---------------------------------------------------------------------------
// Background: sunlit forest floor, distant canopy, gentle framing.
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_SIZE.height);
  gradient.addColorStop(0, PALETTE.skyGlow);
  gradient.addColorStop(0.18, PALETTE.canopyLight);
  gradient.addColorStop(0.55, PALETTE.canopyMid);
  gradient.addColorStop(1, PALETTE.canopyDark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);

  drawTreeline(ctx, 0, PALETTE.canopyMid, 0.5);
  drawTreeline(ctx, 34, PALETTE.canopyDark, 0.6);
}

/** A soft, repeating silhouette of tree canopies along the top edge for depth. */
function drawTreeline(ctx: CanvasRenderingContext2D, yOffset: number, color: string, opacity: number): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const bumpWidth = 70;
  for (let x = 0; x <= WORLD_SIZE.width + bumpWidth; x += bumpWidth) {
    const h = yOffset + 26 + ((x * 37) % 34);
    ctx.quadraticCurveTo(x + bumpWidth / 2, h, x + bumpWidth, yOffset + 18);
  }
  ctx.lineTo(WORLD_SIZE.width, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D): void {
  const cx = WORLD_SIZE.width / 2;
  const cy = WORLD_SIZE.height / 2;
  const radius = Math.max(WORLD_SIZE.width, WORLD_SIZE.height) * 0.78;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, PALETTE.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
}

// ---------------------------------------------------------------------------
// Scenery: trees, rocks, roots, ruins, crystals, flowers, water, torches.
// ---------------------------------------------------------------------------

export function drawDecorations(ctx: CanvasRenderingContext2D, timeMs: number): void {
  for (const deco of MAP_DECORATIONS) {
    ctx.save();
    ctx.translate(deco.position.x, deco.position.y);
    if (deco.kind !== "WATER") {
      ctx.rotate(deco.rotation);
      ctx.scale(deco.scale, deco.scale);
    }

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
        drawCrystalDecor(ctx, timeMs, deco.variant);
        break;
      case "GRASS":
        drawGrassTuft(ctx);
        break;
      case "FLOWER":
        drawFlower(ctx, deco.variant);
        break;
      case "WATER":
        drawWaterPond(ctx, deco, timeMs);
        break;
      case "TORCH":
        drawTorch(ctx, timeMs);
        break;
    }
    ctx.restore();
  }
}

function drawTree(ctx: CanvasRenderingContext2D, deco: Decoration): void {
  ctx.fillStyle = "rgba(30,45,15,0.28)";
  ctx.beginPath();
  ctx.ellipse(2, 5, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(-2.5, -2, 5, 16);

  const canopyColors = [PALETTE.canopyLight, PALETTE.canopyMid, "#7bc44a"];
  ctx.fillStyle = canopyColors[deco.variant] ?? canopyColors[0]!;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 6, -8 - i * 4, 13 - i * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(-8, -14, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, deco: Decoration): void {
  ctx.fillStyle = "rgba(40,30,10,0.22)";
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = deco.variant === 0 ? "#b8ac8e" : "#a89876";
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(-4, -6);
  ctx.lineTo(4, -7);
  ctx.lineTo(9, 1);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(2, 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(80,60,30,0.3)";
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.lineTo(3, -3);
  ctx.stroke();
}

function drawRoot(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#7a5735";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-4, 6, 6, -2);
  ctx.quadraticCurveTo(12, -6, 18, 2);
  ctx.stroke();
}

function drawRuinDecor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(40,30,10,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c9b790";
  ctx.fillRect(-10, -14, 7, 22);
  ctx.fillRect(2, -8, 8, 16);
  ctx.fillStyle = "#a89268";
  ctx.fillRect(-10, -14, 7, 4);

  ctx.fillStyle = "rgba(120,190,90,0.4)";
  ctx.beginPath();
  ctx.arc(-6, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrystalDecor(ctx: CanvasRenderingContext2D, timeMs: number, variant: number): void {
  const color = variant % 2 === 0 ? PALETTE.crystal : PALETTE.crystalWarm;
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 900);
  ctx.save();
  ctx.globalAlpha = pulse;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  glow.addColorStop(0, hexToRgba(color, 0.5));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(40,30,10,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, -2);
  ctx.lineTo(2, 6);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-5, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(2, -2);
  ctx.lineTo(0, 6);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();
}

function drawGrassTuft(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = PALETTE.canopyMid;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2, 4);
    ctx.quadraticCurveTo(i * 2 + 1, -2, i * 3, -7);
    ctx.stroke();
  }
}

const FLOWER_COLORS = ["#ff6a6a", "#ffd257", "#c060f5", "#ffffff", "#ff9ecf"];

function drawFlower(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.strokeStyle = PALETTE.canopyDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -2);
  ctx.stroke();

  const color = FLOWER_COLORS[variant % FLOWER_COLORS.length]!;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 2.6, -2 + Math.sin(angle) * 2.6, 2, 1.3, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, -2, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawWaterPond(ctx: CanvasRenderingContext2D, deco: Decoration, timeMs: number): void {
  const radiusX = 34 * deco.scale;
  const radiusY = 20 * deco.scale;

  ctx.fillStyle = "rgba(30,45,15,0.2)";
  ctx.beginPath();
  ctx.ellipse(2, 4, radiusX + 4, radiusY + 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7a6544";
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX + 4, radiusY + 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const waterGradient = ctx.createLinearGradient(0, -radiusY, 0, radiusY);
  waterGradient.addColorStop(0, PALETTE.waterLight);
  waterGradient.addColorStop(1, PALETTE.water);
  ctx.fillStyle = waterGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const t = (timeMs / 1800 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * t * 0.8, radiusY * t * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#4a8a3a";
  ctx.beginPath();
  ctx.ellipse(radiusX * 0.4, radiusY * 0.3, 5, 3.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorch(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.fillStyle = "rgba(40,30,10,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(-1.6, -4, 3.2, 16);

  const flicker = Math.sin(timeMs / 130) * 1.4;
  const glow = ctx.createRadialGradient(0, -10, 0, 0, -10, 22);
  glow.addColorStop(0, "rgba(255,166,58,0.55)");
  glow.addColorStop(1, "rgba(255,166,58,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -10, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.torchFlame;
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.quadraticCurveTo(-3 + flicker, -12, 0, -18);
  ctx.quadraticCurveTo(3 - flicker, -12, 3, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.moveTo(-1.4, -6);
  ctx.quadraticCurveTo(-1.4 + flicker * 0.6, -11, 0, -14);
  ctx.quadraticCurveTo(1.4 - flicker * 0.6, -11, 1.4, -6);
  ctx.closePath();
  ctx.fill();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Road.
// ---------------------------------------------------------------------------

export function drawPath(ctx: CanvasRenderingContext2D, path: readonly Vector2[]): void {
  if (path.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(50,38,18,0.35)";
  ctx.lineWidth = PATH_VISUAL_WIDTH + 14;
  strokePath(ctx, path);

  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = PATH_VISUAL_WIDTH + 6;
  strokePath(ctx, path);

  const roadGradient = ctx.createLinearGradient(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
  roadGradient.addColorStop(0, PALETTE.roadFillLight);
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

/** A vibrant magic portal at the path's start and an imposing fortress gate at its end. */
/**
 * The portal/gate graphics sit slightly inboard of the path's literal
 * start/end waypoints (not moved — just where the ornate set-piece is
 * drawn) so they stay comfortably inside frame on a "cover"-fit
 * cinematic background instead of getting clipped at the world's edge.
 */
const ENDPOINT_INSET = 130;

export function drawPathEndpoints(ctx: CanvasRenderingContext2D, path: readonly Vector2[], timeMs: number): void {
  if (path.length < 2) return;
  const start = path[0]!;
  const startDir = normalize(path[1]!.x - start.x, path[1]!.y - start.y);
  drawMagicPortal(ctx, { x: start.x + startDir.x * ENDPOINT_INSET, y: start.y + startDir.y * ENDPOINT_INSET }, timeMs);

  const end = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const endDir = normalize(end.x - prev.x, end.y - prev.y);
  drawFortressGate(ctx, { x: end.x - endDir.x * ENDPOINT_INSET, y: end.y - endDir.y * ENDPOINT_INSET }, timeMs);
}

function normalize(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function drawMagicPortal(ctx: CanvasRenderingContext2D, position: Vector2, timeMs: number): void {
  ctx.save();
  ctx.translate(position.x, position.y);

  const pulse = 0.75 + 0.25 * Math.sin(timeMs / 700);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
  glow.addColorStop(0, `rgba(192,96,245,${0.6 * pulse})`);
  glow.addColorStop(0.6, `rgba(150,80,230,${0.25 * pulse})`);
  glow.addColorStop(1, "rgba(192,96,245,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();

  // Gold rune ring.
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();

  // Swirling violet gateway.
  const swirl = ctx.createRadialGradient(0, 0, 2, 0, 0, 21);
  swirl.addColorStop(0, "#f0d8ff");
  swirl.addColorStop(0.4, PALETTE.portal);
  swirl.addColorStop(1, "#5a1f8a");
  ctx.fillStyle = swirl;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255,255,255,${0.55 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14, timeMs / 900, timeMs / 900 + Math.PI * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 9, -timeMs / 700, -timeMs / 700 + Math.PI * 1.5);
  ctx.stroke();

  ctx.restore();
}

function drawFortressGate(ctx: CanvasRenderingContext2D, position: Vector2, timeMs: number): void {
  ctx.save();
  ctx.translate(position.x, position.y);

  ctx.fillStyle = "rgba(40,30,10,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 46, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const wallGradient = ctx.createLinearGradient(0, -46, 0, 20);
  wallGradient.addColorStop(0, "#e8dcc0");
  wallGradient.addColorStop(1, "#b8a680");
  ctx.fillStyle = wallGradient;

  // Two flanking towers.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 30, 0);
    ctx.fillStyle = wallGradient;
    ctx.fillRect(-11, -38, 22, 54);
    // Crenellations.
    ctx.fillStyle = "#c9b790";
    for (let i = -1; i <= 1; i++) ctx.fillRect(-11 + (i + 1) * 7 - 3, -42, 5, 6);
    // Roof cone.
    ctx.fillStyle = "#a8442f";
    ctx.beginPath();
    ctx.moveTo(-13, -38);
    ctx.lineTo(0, -54);
    ctx.lineTo(13, -38);
    ctx.closePath();
    ctx.fill();
    // Window glow.
    const flicker = 0.6 + 0.4 * Math.sin(timeMs / 400 + side);
    ctx.fillStyle = `rgba(255,200,100,${flicker})`;
    ctx.beginPath();
    ctx.arc(0, -20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Central wall + gold-trimmed arch door.
  ctx.fillStyle = wallGradient;
  ctx.fillRect(-19, -24, 38, 40);
  ctx.fillStyle = "#c9b790";
  for (let i = 0; i < 3; i++) ctx.fillRect(-19 + i * 13, -28, 8, 6);

  const doorGradient = ctx.createLinearGradient(0, -18, 0, 16);
  doorGradient.addColorStop(0, "#ffd257");
  doorGradient.addColorStop(1, "#a8702a");
  ctx.fillStyle = doorGradient;
  ctx.beginPath();
  ctx.moveTo(-14, 16);
  ctx.lineTo(-14, -4);
  ctx.quadraticCurveTo(0, -20, 14, -4);
  ctx.lineTo(14, 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7a4a1a";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Banner.
  ctx.fillStyle = "#c9432f";
  ctx.beginPath();
  ctx.moveTo(-2, -46);
  ctx.lineTo(6, -46);
  ctx.lineTo(6, -30);
  ctx.lineTo(2, -34);
  ctx.lineTo(-2, -30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6b4a2f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, -52);
  ctx.lineTo(2, -30);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tower slots — a small, deliberately modest buildable spot. The tower
// built on it is the dominant element; the platform only has to read as
// "you may build here", not compete with it.
// ---------------------------------------------------------------------------

type PlatformStyle = "CLEARING" | "STONE" | "WOOD" | "RUIN" | "ALTAR" | "ELEVATED";

const PLATFORM_STYLES: readonly PlatformStyle[] = ["CLEARING", "STONE", "WOOD", "RUIN", "ALTAR", "ELEVATED"];

function styleForSlot(index: number): PlatformStyle {
  return PLATFORM_STYLES[index % PLATFORM_STYLES.length]!;
}

const PLATFORM_RADIUS = 15;

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: TowerSlotDefinition,
  index: number,
  occupied: boolean,
  highlighted: boolean,
  timeMs: number,
): void {
  const style = styleForSlot(index);
  ctx.save();
  ctx.translate(slot.position.x, slot.position.y);

  ctx.fillStyle = "rgba(40,30,10,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 4, PLATFORM_RADIUS + 3, (PLATFORM_RADIUS + 3) * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (style === "CLEARING") drawClearingPlatform(ctx);
  else if (style === "STONE") drawStonePlatform(ctx);
  else if (style === "WOOD") drawWoodPlatform(ctx);
  else if (style === "RUIN") drawRuinPlatform(ctx);
  else if (style === "ALTAR") drawAltarPlatform(ctx, timeMs);
  else drawElevatedPlatform(ctx);

  if (!occupied && highlighted) {
    ctx.strokeStyle = "rgba(255,210,87,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, PLATFORM_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawClearingPlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotClearing;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.canopyDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawGrassTuft(ctx);
}

function drawStonePlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotStone;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a7a5a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,105,75,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, -4);
  ctx.lineTo(4, 3);
  ctx.moveTo(-3, 7);
  ctx.lineTo(3, -7);
  ctx.stroke();
}

function drawWoodPlatform(ctx: CanvasRenderingContext2D): void {
  // Round wooden deck — cross-section log rings, like a cut tree stump base.
  ctx.fillStyle = "#8a6238";
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a3f22";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(90,63,34,0.6)";
  ctx.lineWidth = 1;
  for (let r = PLATFORM_RADIUS - 4; r > 2; r -= 4) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRuinPlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.slotRuin;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6a42";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(110,180,80,0.35)";
  ctx.beginPath();
  ctx.arc(-4, 4, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a4530";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-9, -1);
  ctx.lineTo(-4, -11);
  ctx.stroke();
}

function drawAltarPlatform(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.fillStyle = PALETTE.slotMagic;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 800);
  ctx.strokeStyle = `rgba(255,210,87,${0.5 + 0.35 * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,210,87,${0.6 + 0.3 * pulse})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + timeMs / 4000;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
    ctx.lineTo(Math.cos(angle) * PLATFORM_RADIUS, Math.sin(angle) * PLATFORM_RADIUS);
    ctx.stroke();
  }
}

function drawElevatedPlatform(ctx: CanvasRenderingContext2D): void {
  // A small earthen mound with a rocky rim — reads as "raised ground".
  ctx.fillStyle = "#7a6238";
  ctx.beginPath();
  ctx.ellipse(0, 2, PLATFORM_RADIUS + 2, PLATFORM_RADIUS * 0.55 + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  const moundGradient = ctx.createRadialGradient(0, -3, 2, 0, 0, PLATFORM_RADIUS);
  moundGradient.addColorStop(0, "#9fc464");
  moundGradient.addColorStop(1, "#6f9c40");
  ctx.fillStyle = moundGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, PLATFORM_RADIUS, PLATFORM_RADIUS * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#a89876";
  for (const [px, py] of [
    [-11, 3],
    [10, 4],
    [0, 8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Range indicator.
// ---------------------------------------------------------------------------

export function drawRangeCircle(ctx: CanvasRenderingContext2D, center: Vector2, range: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,210,87,0.09)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,224,138,0.7)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Distant landmarks + atmosphere: light haze + golden magical motes.
// ---------------------------------------------------------------------------

/** A couple of small distant watchtower silhouettes near the treeline — used by the main menu for depth. */
export function drawDistantSilhouettes(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const positions = [
    { x: WORLD_SIZE.width * 0.16, y: 70 },
    { x: WORLD_SIZE.width * 0.82, y: 62 },
  ];
  ctx.save();
  for (const pos of positions) {
    const glow = 0.5 + 0.3 * Math.sin(timeMs / 800 + pos.x);
    ctx.fillStyle = "rgba(140,110,70,0.55)";
    ctx.fillRect(pos.x - 4, pos.y - 18, 8, 20);
    ctx.fillStyle = "#a8442f";
    ctx.beginPath();
    ctx.moveTo(pos.x - 5, pos.y - 18);
    ctx.lineTo(pos.x, pos.y - 27);
    ctx.lineTo(pos.x + 5, pos.y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,200,110,${glow})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 12, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFog(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const t = timeMs / 22000 + i * 3.1;
    const x = (Math.sin(t) * 0.5 + 0.5) * WORLD_SIZE.width;
    const y = 100 + i * 170 + Math.cos(t * 0.7) * 40;
    const radius = 240;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, PALETTE.fog);
    gradient.addColorStop(1, "rgba(255,248,225,0)");
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
    const alpha = 0.25 + 0.25 * Math.sin(timeMs / 1500 + mote.phase * 2);
    ctx.fillStyle = `rgba(255,224,150,${Math.max(alpha, 0.08)})`;
    ctx.beginPath();
    ctx.arc(x, wrappedY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
