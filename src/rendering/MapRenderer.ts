import type { TowerSlotDefinition } from "@/data/mapWhisperingWoods";
import { distance, type Vector2 } from "@/utils/geometry";
import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";
import { PALETTE } from "./theme";
import type { BiomeDefinition } from "./biomes";
import { MAP_DECORATIONS, type Decoration } from "./mapDecorations";

/**
 * Pure drawing helpers — world-space coordinates in, pixels on screen out
 * (the caller has already applied the world->canvas transform to `ctx`).
 * Nothing in this file reads or mutates game state; it only takes plain
 * data plus a `BiomeDefinition` (see ./biomes) and paints it. `timeMs` is
 * wall-clock time used only for slow cosmetic animation — never gameplay
 * time.
 *
 * Every terrain color comes from the `biome` parameter now, not a
 * hardcoded palette — that's what lets a future level swap in Terras
 * Vulcânicas/Tundra/Deserto/Ruínas without touching this file, only
 * adding a new biomes/*.ts data file.
 */

// ---------------------------------------------------------------------------
// Background: layered, uneven terrain — several ground tones blotched
// together (not one flat gradient), so the ground reads as real material.
// ---------------------------------------------------------------------------

function hashPoint(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function drawBackground(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const p = biome.palette;
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_SIZE.height);
  gradient.addColorStop(0, p.skyTop);
  gradient.addColorStop(0.16, p.groundAccentA);
  gradient.addColorStop(0.55, p.groundBase);
  gradient.addColorStop(1, p.groundShadowed);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);

  // Irregular ground-tone blotches, deterministic per-cell — this is what
  // stops the terrain from reading as a flat color swatch.
  const cell = 70;
  const cols = Math.ceil(WORLD_SIZE.width / cell);
  const rows = Math.ceil(WORLD_SIZE.height / cell);
  const blotchColors = [p.groundAccentA, p.groundAccentB, p.groundShadowed];
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const h = hashPoint(cx, cy, 4.1);
      if (h < 0.42) continue;
      const color = blotchColors[Math.floor(h * blotchColors.length) % blotchColors.length]!;
      const px = cx * cell + hashPoint(cx, cy, 1.2) * cell;
      const py = cy * cell + hashPoint(cx, cy, 2.6) * cell;
      const r = cell * (0.5 + hashPoint(cx, cy, 3.4) * 0.5);
      const blotch = ctx.createRadialGradient(px, py, 0, px, py, r);
      blotch.addColorStop(0, color);
      blotch.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = blotch;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  drawTreeline(ctx, 0, p.vegetationSecondary, 0.55);
  drawTreeline(ctx, 34, p.vegetationDark, 0.65);
}

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

export function drawVignette(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const cx = WORLD_SIZE.width / 2;
  const cy = WORLD_SIZE.height / 2;
  const radius = Math.max(WORLD_SIZE.width, WORLD_SIZE.height) * 0.78;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, biome.palette.vignette);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
}

// ---------------------------------------------------------------------------
// Scenery: trees, rocks, roots, ruins, crystals, flowers, water, torches —
// all recolored from the active biome's palette.
// ---------------------------------------------------------------------------

export function drawDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  for (const deco of MAP_DECORATIONS) {
    ctx.save();
    ctx.translate(deco.position.x, deco.position.y);
    if (deco.kind !== "WATER") {
      ctx.rotate(deco.rotation);
      ctx.scale(deco.scale, deco.scale);
    }

    switch (deco.kind) {
      case "TREE":
        drawTree(ctx, deco, biome);
        break;
      case "ROCK":
        drawRock(ctx, deco, biome);
        break;
      case "ROOT":
        drawRoot(ctx, biome);
        break;
      case "RUIN":
        drawRuinDecor(ctx, biome);
        break;
      case "CRYSTAL":
        drawCrystalDecor(ctx, timeMs, biome);
        break;
      case "GRASS":
        drawGrassTuft(ctx, biome);
        break;
      case "FLOWER":
        drawFlower(ctx, deco.variant);
        break;
      case "WATER":
        drawWaterPond(ctx, deco, timeMs, biome);
        break;
      case "TORCH":
        drawTorch(ctx, timeMs, biome);
        break;
    }
    ctx.restore();
  }
}

export function drawTree(ctx: CanvasRenderingContext2D, deco: Decoration, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.fillStyle = "rgba(10,14,6,0.32)";
  ctx.beginPath();
  ctx.ellipse(2, 5, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.rockDark;
  ctx.fillRect(-2.5, -2, 5, 16);

  const canopyColors = [p.vegetationPrimary, p.vegetationSecondary, p.vegetationDark];
  ctx.fillStyle = canopyColors[deco.variant] ?? canopyColors[0]!;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 6, -8 - i * 4, 13 - i * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `${p.vegetationHighlight}2e`;
  ctx.beginPath();
  ctx.arc(-8, -14, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, deco: Decoration, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.fillStyle = "rgba(10,10,4,0.28)";
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = deco.variant === 0 ? p.rock : p.rockDark;
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(-4, -6);
  ctx.lineTo(4, -7);
  ctx.lineTo(9, 1);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(2, 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.lineTo(3, -3);
  ctx.stroke();
}

function drawRoot(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  ctx.strokeStyle = biome.palette.vegetationDark;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-4, 6, 6, -2);
  ctx.quadraticCurveTo(12, -6, 18, 2);
  ctx.stroke();
}

function drawRuinDecor(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.fillStyle = "rgba(10,10,4,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.rock;
  ctx.fillRect(-10, -14, 7, 22);
  ctx.fillRect(2, -8, 8, 16);
  ctx.fillStyle = p.rockDark;
  ctx.fillRect(-10, -14, 7, 4);

  ctx.fillStyle = `${p.vegetationPrimary}66`;
  ctx.beginPath();
  ctx.arc(-6, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, 2, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrystalDecor(ctx: CanvasRenderingContext2D, timeMs: number, biome: BiomeDefinition): void {
  const color = biome.palette.accentGlow;
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 900);
  ctx.save();
  ctx.globalAlpha = pulse;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  glow.addColorStop(0, hexToRgba(color, 0.45));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(10,10,4,0.28)";
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
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(2, -2);
  ctx.lineTo(0, 6);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  ctx.strokeStyle = biome.palette.vegetationPrimary;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2, 4);
    ctx.quadraticCurveTo(i * 2 + 1, -2, i * 3, -7);
    ctx.stroke();
  }
}

const FLOWER_COLORS = ["#e0546a", "#e0b23a", "#8a5cc4", "#e8e2cf", "#c95fa0"];

function drawFlower(ctx: CanvasRenderingContext2D, variant: number): void {
  ctx.strokeStyle = "#2a3018";
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

function drawWaterPond(ctx: CanvasRenderingContext2D, deco: Decoration, timeMs: number, biome: BiomeDefinition): void {
  const p = biome.palette;
  const radiusX = 34 * deco.scale;
  const radiusY = 20 * deco.scale;

  ctx.fillStyle = "rgba(10,14,6,0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 4, radiusX + 4, radiusY + 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.rockDark;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX + 4, radiusY + 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const waterGradient = ctx.createLinearGradient(0, -radiusY, 0, radiusY);
  waterGradient.addColorStop(0, p.waterLight);
  waterGradient.addColorStop(1, p.waterDeep);
  ctx.fillStyle = waterGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const t = (timeMs / 1800 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * t * 0.8, radiusY * t * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = p.vegetationSecondary;
  ctx.beginPath();
  ctx.ellipse(radiusX * 0.4, radiusY * 0.3, 5, 3.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorch(ctx: CanvasRenderingContext2D, timeMs: number, biome: BiomeDefinition): void {
  ctx.fillStyle = "rgba(10,10,4,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = biome.palette.rockDark;
  ctx.fillRect(-1.6, -4, 3.2, 16);

  const flicker = Math.sin(timeMs / 130) * 1.4;
  const glow = ctx.createRadialGradient(0, -10, 0, 0, -10, 22);
  glow.addColorStop(0, "rgba(255,176,74,0.55)");
  glow.addColorStop(1, "rgba(255,176,74,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -10, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = biome.palette.accentWarm;
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
// Organic road — the gameplay path (ENEMY_PATH, straight rectilinear
// segments) is untouched; everything below only builds a VISUAL spline for
// drawing. Enemy movement still uses the original waypoints via
// getPointAtDistance, completely independent of this.
// ---------------------------------------------------------------------------

function catmullRom(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: number): Vector2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Smooths the straight-segment gameplay path into a curved visual-only spline. */
function buildSmoothedPath(path: readonly Vector2[], samplesPerSegment = 14): Vector2[] {
  if (path.length < 2) return [...path];
  const first = path[0]!;
  const second = path[1]!;
  const last = path[path.length - 1]!;
  const secondLast = path[path.length - 2]!;
  const extended: Vector2[] = [
    { x: first.x - (second.x - first.x), y: first.y - (second.y - first.y) },
    ...path,
    { x: last.x + (last.x - secondLast.x), y: last.y + (last.y - secondLast.y) },
  ];

  const result: Vector2[] = [];
  for (let i = 1; i < extended.length - 2; i++) {
    const p0 = extended[i - 1]!;
    const p1 = extended[i]!;
    const p2 = extended[i + 1]!;
    const p3 = extended[i + 2]!;
    for (let s = 0; s < samplesPerSegment; s++) {
      result.push(catmullRom(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  result.push(last);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface OrganicRoad {
  smoothed: Vector2[];
  left: Vector2[];
  right: Vector2[];
}

/**
 * Builds the road's visual edges from the smoothed spline: width breathes
 * along its length and each edge is independently jittered, so the road
 * reads as a worn trail cut through terrain instead of a uniform painted
 * ribbon. `widthOffset` lets the caller nest several passes (soft dirt
 * halo, dark edge, bright fill) around the same centerline.
 */
function buildOrganicRoad(path: readonly Vector2[], baseWidth: number, widthOffset: number, seed: number): OrganicRoad {
  const smoothed = buildSmoothedPath(path);
  const n = smoothed.length;
  const cumulative: number[] = [0];
  for (let i = 1; i < n; i++) {
    cumulative.push(cumulative[i - 1]! + distance(smoothed[i - 1]!, smoothed[i]!));
  }

  const left: Vector2[] = [];
  const right: Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = smoothed[Math.max(0, i - 1)]!;
    const next = smoothed[Math.min(n - 1, i + 1)]!;
    const tangentLength = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const tangent = { x: (next.x - prev.x) / tangentLength, y: (next.y - prev.y) / tangentLength };
    const normal = { x: -tangent.y, y: tangent.x };

    const s = cumulative[i]!;
    const widthNoise = 1 + 0.16 * Math.sin(s * 0.018 + seed) + 0.08 * Math.sin(s * 0.045 + seed * 2.3);
    const halfWidth = (baseWidth * clamp(widthNoise, 0.72, 1.32)) / 2 + widthOffset;
    const jitterL = 3 * Math.sin(s * 0.09 + seed * 3.1);
    const jitterR = 3 * Math.sin(s * 0.11 + seed * 5.7 + 1.7);

    const point = smoothed[i]!;
    left.push({ x: point.x + normal.x * (halfWidth + jitterL), y: point.y + normal.y * (halfWidth + jitterL) });
    right.push({ x: point.x - normal.x * (halfWidth + jitterR), y: point.y - normal.y * (halfWidth + jitterR) });
  }

  return { smoothed, left, right };
}

function fillRibbon(ctx: CanvasRenderingContext2D, left: readonly Vector2[], right: readonly Vector2[]): void {
  ctx.beginPath();
  ctx.moveTo(left[0]!.x, left[0]!.y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i]!.x, left[i]!.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]!.x, right[i]!.y);
  ctx.closePath();
  ctx.fill();
}

function strokeSmoothedCenterline(ctx: CanvasRenderingContext2D, smoothed: readonly Vector2[]): void {
  ctx.beginPath();
  ctx.moveTo(smoothed[0]!.x, smoothed[0]!.y);
  for (let i = 1; i < smoothed.length; i++) ctx.lineTo(smoothed[i]!.x, smoothed[i]!.y);
  ctx.stroke();
}

const ROAD_SEED = 11;

export function drawPath(ctx: CanvasRenderingContext2D, path: readonly Vector2[], biome: BiomeDefinition): void {
  if (path.length < 2) return;
  const p = biome.palette;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const halo = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 9, ROAD_SEED);
  ctx.fillStyle = "rgba(15,11,6,0.32)";
  fillRibbon(ctx, halo.left, halo.right);

  const edge = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 3, ROAD_SEED);
  ctx.fillStyle = p.roadEdge;
  fillRibbon(ctx, edge.left, edge.right);

  const fill = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 0, ROAD_SEED);
  const roadGradient = ctx.createLinearGradient(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
  roadGradient.addColorStop(0, p.roadFillLight);
  roadGradient.addColorStop(1, p.roadFill);
  ctx.fillStyle = roadGradient;
  fillRibbon(ctx, fill.left, fill.right);

  // Worn centerline rut, following the same curve.
  ctx.strokeStyle = p.roadRut;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([9, 13]);
  strokeSmoothedCenterline(ctx, fill.smoothed);
  ctx.setLineDash([]);

  drawRoadSurfaceDetail(ctx, fill, biome);
  drawRoadEdgeGrowth(ctx, fill, biome);

  ctx.restore();
}

/**
 * Worn dirt patches + fallen leaves scattered ON the road surface itself
 * (clipped to the road polygon) — the difference between "a flat colored
 * ribbon" and "a trail people/monsters have actually walked", per the
 * direction's "pequenas áreas desgastadas" / "folhas" requirements.
 */
function drawRoadSurfaceDetail(ctx: CanvasRenderingContext2D, fill: OrganicRoad, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.save();
  fillRibbon(ctx, fill.left, fill.right);
  ctx.clip();

  const step = 5;
  for (let i = 2; i < fill.smoothed.length - 2; i += step) {
    const left = fill.left[i]!;
    const right = fill.right[i]!;
    const h1 = hashPoint(i, 1, 21.7);
    const h2 = hashPoint(i, 2, 33.1);
    const h3 = hashPoint(i, 3, 47.9);

    // Worn dirt patch — soft, irregular, darker than the road fill.
    if (h1 > 0.62) {
      const t = h2;
      const px = left.x + (right.x - left.x) * t;
      const py = left.y + (right.y - left.y) * t;
      const r = 6 + h3 * 7;
      const patch = ctx.createRadialGradient(px, py, 0, px, py, r);
      patch.addColorStop(0, hexToRgba(p.roadEdge, 0.4));
      patch.addColorStop(1, hexToRgba(p.roadEdge, 0));
      ctx.fillStyle = patch;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A fallen leaf, biome-colored, resting on the path.
    if (h2 > 0.75) {
      const t = h1;
      const px = left.x + (right.x - left.x) * t;
      const py = left.y + (right.y - left.y) * t;
      const leafColors = [p.vegetationPrimary, p.vegetationSecondary, p.accentWarm];
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(h3 * Math.PI * 2);
      ctx.fillStyle = leafColors[Math.floor(h3 * leafColors.length) % leafColors.length]!;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.6, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Small rocks/roots/grass planted straddling the road's edge at sparse,
 * deterministic points — this is what makes the path read as "terrain
 * with a trail worn through it" instead of "a road drawn on top of a
 * green rectangle". Grass tufts are nudged slightly INWARD onto the road
 * fill itself (not just sitting beside it) so vegetation visibly
 * encroaches on the trail in a few spots, per the direction's
 * "vegetação invadindo algumas bordas".
 */
function drawRoadEdgeGrowth(ctx: CanvasRenderingContext2D, road: OrganicRoad, biome: BiomeDefinition): void {
  const step = 7;
  for (let i = 4; i < road.smoothed.length - 4; i += step) {
    const side = i % (step * 2) < step ? "left" : "right";
    const edgePoint = side === "left" ? road.left[i]! : road.right[i]!;
    const center = road.smoothed[i]!;
    const h = hashPoint(i, side === "left" ? 1 : 2, 8.3);
    const kind = h > 0.68 ? "ROOT" : h > 0.4 ? "ROCK" : "GRASS";

    ctx.save();
    if (kind === "GRASS") {
      // Pull 30% of the way toward the road center — this tuft visibly
      // grows onto the path surface, not just beside it.
      const gx = edgePoint.x + (center.x - edgePoint.x) * 0.3;
      const gy = edgePoint.y + (center.y - edgePoint.y) * 0.3;
      ctx.translate(gx, gy);
      ctx.rotate(h * Math.PI * 2);
      ctx.scale(0.55 + h * 0.25, 0.55 + h * 0.25);
      drawGrassTuft(ctx, biome);
    } else {
      ctx.translate(edgePoint.x, edgePoint.y);
      ctx.rotate(h * Math.PI * 2);
      ctx.scale(0.45 + h * 0.25, 0.45 + h * 0.25);
      if (kind === "ROOT") drawRoot(ctx, biome);
      else drawRock(ctx, { kind: "ROCK", position: { x: 0, y: 0 }, scale: 1, rotation: 0, variant: Math.floor(h * 2) }, biome);
    }
    ctx.restore();
  }
}

/**
 * The portal/gate graphics sit slightly inboard of the path's literal
 * start/end waypoints (not moved — just where the ornate set-piece is
 * drawn) so they stay comfortably inside frame on a "cover"-fit
 * cinematic background instead of getting clipped at the world's edge.
 * The portal keeps a fixed, biome-independent magic identity (violet,
 * gold trim) since it's the game's own landmark, not terrain — the
 * fortress's stonework and vegetation pull from the biome so it still
 * looks built from (and reclaimed by) the local ground.
 */
const ENDPOINT_INSET = 130;

export function drawPathEndpoints(
  ctx: CanvasRenderingContext2D,
  path: readonly Vector2[],
  biome: BiomeDefinition,
  timeMs: number,
): void {
  if (path.length < 2) return;
  const start = path[0]!;
  const startDir = normalize(path[1]!.x - start.x, path[1]!.y - start.y);
  drawMagicPortal(ctx, { x: start.x + startDir.x * ENDPOINT_INSET, y: start.y + startDir.y * ENDPOINT_INSET }, timeMs);

  const end = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const endDir = normalize(end.x - prev.x, end.y - prev.y);
  drawFortress(ctx, { x: end.x - endDir.x * ENDPOINT_INSET, y: end.y - endDir.y * ENDPOINT_INSET }, biome, timeMs, 1);
}

function normalize(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/**
 * `boost` (0 = gameplay default, up to ~1.6 used by the menu's portal-surge
 * moment and the click-to-play transition) scales glow radius/opacity and
 * ring speed without changing the portal's identity colors.
 */
export function drawMagicPortal(
  ctx: CanvasRenderingContext2D,
  position: Vector2,
  timeMs: number,
  boost = 0,
): void {
  ctx.save();
  ctx.translate(position.x, position.y);

  const pulse = (0.75 + 0.25 * Math.sin(timeMs / 700)) * (1 + boost * 0.5);
  const glowRadius = 52 + boost * 34;
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, glowRadius);
  glow.addColorStop(0, `rgba(192,96,245,${Math.min(1, 0.6 * pulse)})`);
  glow.addColorStop(0.6, `rgba(150,80,230,${Math.min(1, 0.25 * pulse)})`);
  glow.addColorStop(1, "rgba(192,96,245,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();

  const swirl = ctx.createRadialGradient(0, 0, 2, 0, 0, 21);
  swirl.addColorStop(0, "#f0d8ff");
  swirl.addColorStop(0.4, "#c060f5");
  swirl.addColorStop(1, "#3a1258");
  ctx.fillStyle = swirl;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();

  const ringSpeed = 1 + boost * 1.8;
  ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, 0.55 * pulse)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14, (timeMs / 900) * ringSpeed, (timeMs / 900) * ringSpeed + Math.PI * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 9, (-timeMs / 700) * ringSpeed, (-timeMs / 700) * ringSpeed + Math.PI * 1.5);
  ctx.stroke();

  ctx.restore();
}

/**
 * An ancient fortress, half-reclaimed by the forest — the map's other
 * major landmark alongside the portal, now built to actually earn that
 * role (imposing scale, a tall rear keep, broken/weathered stonework,
 * ivy climbing the walls, torchlight, banners). `scale` lets the same
 * set piece serve both the small in-game endpoint (scale 1) and a much
 * larger cinematic version in the main menu.
 *
 * Biome-driven (stone + vegetation colors), so this reads as "built from
 * the local ground" in any biome without changing shape — a true
 * per-biome fortress silhouette (e.g. obsidian spires for Terras
 * Vulcânicas, ice-locked towers for Tundra) is a natural next step: swap
 * this function for a `biome.id`-keyed dispatch the same way tower/enemy
 * types already dispatch on `type`, without touching any caller.
 */
export interface FortressAnchors {
  /** Torch/flame positions in the fortress's own local space (pre translate+scale) — for callers that spawn extra effects (smoke, flare bursts) at exactly the same points the fortress draws its own flames. */
  torches: readonly Vector2[];
}

export function drawFortress(
  ctx: CanvasRenderingContext2D,
  position: Vector2,
  biome: BiomeDefinition,
  timeMs: number,
  scale: number,
  /** 0 = calm (gameplay default). Above 0 exaggerates banner flutter — used by the menu's occasional "wind gust" moment. */
  windIntensity = 0,
): FortressAnchors {
  const p = biome.palette;
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.scale(scale, scale);

  // Stone platform the fortress stands on, with roots breaking through cracks.
  ctx.fillStyle = "rgba(8,8,3,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 58, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.rock;
  ctx.beginPath();
  ctx.ellipse(0, 12, 54, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  for (const [sx, sy, ex, ey] of [
    [-40, 10, -28, 16],
    [22, 8, 36, 14],
    [-6, 16, 4, 20],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.strokeStyle = biome.palette.vegetationDark;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-46, 14);
  ctx.quadraticCurveTo(-52, 18, -58, 15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(44, 13);
  ctx.quadraticCurveTo(50, 17, 57, 14);
  ctx.stroke();

  const wallGradient = ctx.createLinearGradient(0, -58, 0, 22);
  wallGradient.addColorStop(0, p.rock);
  wallGradient.addColorStop(1, p.rockDark);

  // --- Rear keep: a tall tower rising behind the gate, drawn first so the
  // front walls occlude its base — this is what gives the fortress real
  // height/grandeur instead of reading as a single flat gate. ---
  ctx.save();
  ctx.globalAlpha = 0.92;
  const keepGradient = ctx.createLinearGradient(-14, -108, 14, -30);
  keepGradient.addColorStop(0, p.rock);
  keepGradient.addColorStop(1, p.rockDark);
  ctx.fillStyle = keepGradient;
  ctx.beginPath();
  ctx.moveTo(-15, -28);
  ctx.lineTo(-13, -95);
  ctx.lineTo(0, -110);
  ctx.lineTo(13, -95);
  ctx.lineTo(15, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.rock;
  for (let i = -1; i <= 1; i++) ctx.fillRect(-11 + (i + 1) * 8 - 3, -92, 5, 7);
  const keepFlicker = 0.55 + 0.4 * Math.sin(timeMs / 500);
  ctx.fillStyle = `rgba(255,190,110,${keepFlicker})`;
  ctx.beginPath();
  ctx.arc(0, -60, 2.6, 0, Math.PI * 2);
  ctx.fill();
  drawBanner(ctx, 0, -110, biome, timeMs, 1.1, 0, windIntensity);
  ctx.restore();

  // --- Two flanking towers, weathered — irregular crenellations instead
  // of a uniform comb, so the silhouette reads as ancient/broken. ---
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * 34, 0);

    ctx.fillStyle = wallGradient;
    ctx.fillRect(-12, -42, 24, 58);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-12, -42, 24, 58);

    // Broken crenellations: heights vary, one tooth missing entirely.
    ctx.fillStyle = p.rock;
    const teeth = [7, 5, 0, 6, 7];
    for (let i = 0; i < teeth.length; i++) {
      const h = teeth[i]!;
      if (h === 0) continue;
      ctx.fillRect(-12 + i * 5, -42 - h, 4.2, h + 1);
    }

    ctx.fillStyle = "#5a1f16";
    ctx.beginPath();
    ctx.moveTo(-14, -42);
    ctx.lineTo(0, -60);
    ctx.lineTo(14, -42);
    ctx.closePath();
    ctx.fill();

    const flicker = 0.6 + 0.4 * Math.sin(timeMs / 400 + side);
    const torchGlow = ctx.createRadialGradient(0, -22, 0, 0, -22, 16);
    torchGlow.addColorStop(0, `rgba(255,180,90,${0.5 * flicker})`);
    torchGlow.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = torchGlow;
    ctx.beginPath();
    ctx.arc(0, -22, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,190,110,${flicker})`;
    ctx.beginPath();
    ctx.arc(0, -22, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // A second, lower window.
    ctx.fillStyle = `rgba(255,170,80,${0.4 + 0.3 * Math.sin(timeMs / 350 + side * 2)})`;
    ctx.beginPath();
    ctx.arc(0, 2, 2, 0, Math.PI * 2);
    ctx.fill();

    drawIvy(ctx, side, biome);
    drawBanner(ctx, 0, -60, biome, timeMs, 0.85, side * 0.3, windIntensity);

    ctx.restore();
  }

  // --- Central wall + gate arch. ---
  ctx.fillStyle = wallGradient;
  ctx.fillRect(-22, -26, 44, 46);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-22, -26, 44, 46);
  ctx.fillStyle = p.rock;
  for (let i = 0; i < 4; i++) ctx.fillRect(-22 + i * 11.5, -30, 8, 6);

  const doorGradient = ctx.createLinearGradient(0, -18, 0, 20);
  doorGradient.addColorStop(0, PALETTE.gold);
  doorGradient.addColorStop(1, "#6a3f16");
  ctx.fillStyle = doorGradient;
  ctx.beginPath();
  ctx.moveTo(-15, 20);
  ctx.lineTo(-15, -5);
  ctx.quadraticCurveTo(0, -22, 15, -5);
  ctx.lineTo(15, 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3a220c";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Iron banding across the door.
  ctx.strokeStyle = "rgba(30,25,20,0.6)";
  ctx.lineWidth = 1.2;
  for (const y of [-2, 8]) {
    ctx.beginPath();
    ctx.moveTo(-14, y);
    ctx.lineTo(14, y);
    ctx.stroke();
  }

  // Torch flanking the gate.
  const gateFlicker = 0.6 + 0.4 * Math.sin(timeMs / 320);
  const gateTorchGlow = ctx.createRadialGradient(0, -24, 0, 0, -24, 20);
  gateTorchGlow.addColorStop(0, `rgba(255,180,90,${0.5 * gateFlicker})`);
  gateTorchGlow.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = gateTorchGlow;
  ctx.beginPath();
  ctx.arc(0, -24, 20, 0, Math.PI * 2);
  ctx.fill();

  // Ivy climbing the central wall + moss at the base — the "reclaimed by
  // the forest" cue the direction explicitly asked for.
  ctx.strokeStyle = biome.palette.vegetationPrimary;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-20, 18);
  ctx.quadraticCurveTo(-23, 4, -19, -10);
  ctx.quadraticCurveTo(-16, -18, -19, -24);
  ctx.stroke();
  ctx.fillStyle = biome.palette.vegetationSecondary;
  for (const [lx, ly] of [
    [-22, 2],
    [-18, -8],
    [-20, -18],
  ] as const) {
    ctx.beginPath();
    ctx.arc(lx, ly, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBanner(ctx, 0, -26, biome, timeMs, 1, 0, windIntensity);

  ctx.restore();

  return {
    torches: [
      { x: 0, y: -60 },
      { x: -34, y: -22 },
      { x: 34, y: -22 },
      { x: 0, y: -24 },
    ],
  };
}

/** A small vine climbing a tower's outer edge — reused on both flanking towers. */
function drawIvy(ctx: CanvasRenderingContext2D, side: 1 | -1, biome: BiomeDefinition): void {
  const edgeX = side * 11;
  ctx.strokeStyle = biome.palette.vegetationPrimary;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(edgeX, 14);
  ctx.quadraticCurveTo(edgeX + side * 4, -4, edgeX, -20);
  ctx.stroke();
  ctx.fillStyle = biome.palette.vegetationSecondary;
  for (const t of [0.15, 0.45, 0.7]) {
    const ly = 14 - t * 34;
    ctx.beginPath();
    ctx.arc(edgeX + side * (1.5 + Math.sin(t * 10) * 1.5), ly, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A cloth banner with a gentle idle flutter, hung from a pole at `(x, topY)`. */
function drawBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  biome: BiomeDefinition,
  timeMs: number,
  scale: number,
  phase = 0,
  windIntensity = 0,
): void {
  const gustFreq = 480 / (1 + windIntensity * 1.6);
  const flutter = Math.sin(timeMs / gustFreq + phase * 6 + x) * 1.6 * (1 + windIntensity * 2.2);
  ctx.save();
  ctx.translate(x, topY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = biome.palette.rockDark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(2, 16);
  ctx.stroke();
  ctx.fillStyle = "#8a2a22";
  ctx.beginPath();
  ctx.moveTo(2, -5);
  ctx.lineTo(9 + flutter, -3);
  ctx.lineTo(8 + flutter * 1.4, 5);
  ctx.lineTo(9 + flutter, 12);
  ctx.lineTo(2, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(5.5, 4, 1.6, 0, Math.PI * 2);
  ctx.fill();
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
  biome: BiomeDefinition,
  timeMs: number,
): void {
  const style = styleForSlot(index);
  ctx.save();
  ctx.translate(slot.position.x, slot.position.y);

  ctx.fillStyle = "rgba(10,10,4,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 4, PLATFORM_RADIUS + 3, (PLATFORM_RADIUS + 3) * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (style === "CLEARING") drawClearingPlatform(ctx, biome);
  else if (style === "STONE") drawStonePlatform(ctx, biome);
  else if (style === "WOOD") drawWoodPlatform(ctx);
  else if (style === "RUIN") drawRuinPlatform(ctx, biome);
  else if (style === "ALTAR") drawAltarPlatform(ctx, biome, timeMs);
  else drawElevatedPlatform(ctx, biome);

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

function drawClearingPlatform(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  ctx.fillStyle = biome.palette.slotClearing;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = biome.palette.vegetationDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawGrassTuft(ctx, biome);
}

function drawStonePlatform(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  ctx.fillStyle = biome.palette.slotStone;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = biome.palette.rockDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, -4);
  ctx.lineTo(4, 3);
  ctx.moveTo(-3, 7);
  ctx.lineTo(3, -7);
  ctx.stroke();
}

function drawWoodPlatform(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#5a4326";
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b1f12";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(43,31,18,0.6)";
  ctx.lineWidth = 1;
  for (let r = PLATFORM_RADIUS - 4; r > 2; r -= 4) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRuinPlatform(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  ctx.fillStyle = biome.palette.slotRuin;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = biome.palette.rockDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = `${biome.palette.vegetationPrimary}59`;
  ctx.beginPath();
  ctx.arc(-4, 4, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = biome.palette.rockDark;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-9, -1);
  ctx.lineTo(-4, -11);
  ctx.stroke();
}

function drawAltarPlatform(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  ctx.fillStyle = biome.palette.slotMagic;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 800);
  const glowColor = biome.palette.accentGlow;
  ctx.strokeStyle = hexToRgba(glowColor, 0.45 + 0.35 * pulse);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, PLATFORM_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = hexToRgba(glowColor, 0.55 + 0.3 * pulse);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + timeMs / 4000;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
    ctx.lineTo(Math.cos(angle) * PLATFORM_RADIUS, Math.sin(angle) * PLATFORM_RADIUS);
    ctx.stroke();
  }
}

function drawElevatedPlatform(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const p = biome.palette;
  ctx.fillStyle = p.groundAccentB;
  ctx.beginPath();
  ctx.ellipse(0, 2, PLATFORM_RADIUS + 2, PLATFORM_RADIUS * 0.55 + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  const moundGradient = ctx.createRadialGradient(0, -3, 2, 0, 0, PLATFORM_RADIUS);
  moundGradient.addColorStop(0, p.groundAccentA);
  moundGradient.addColorStop(1, p.vegetationPrimary);
  ctx.fillStyle = moundGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, PLATFORM_RADIUS, PLATFORM_RADIUS * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.rock;
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
// Distant landmarks + atmosphere.
// ---------------------------------------------------------------------------

export function drawDistantSilhouettes(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const positions = [
    { x: WORLD_SIZE.width * 0.16, y: 70 },
    { x: WORLD_SIZE.width * 0.82, y: 62 },
  ];
  ctx.save();
  for (const pos of positions) {
    const glow = 0.5 + 0.3 * Math.sin(timeMs / 800 + pos.x);
    ctx.fillStyle = "rgba(90,80,60,0.55)";
    ctx.fillRect(pos.x - 4, pos.y - 18, 8, 20);
    ctx.fillStyle = "#5a1f16";
    ctx.beginPath();
    ctx.moveTo(pos.x - 5, pos.y - 18);
    ctx.lineTo(pos.x, pos.y - 27);
    ctx.lineTo(pos.x + 5, pos.y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,190,100,${glow})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 12, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFog(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const t = timeMs / 22000 + i * 3.1;
    const x = (Math.sin(t) * 0.5 + 0.5) * WORLD_SIZE.width;
    const y = 100 + i * 170 + Math.cos(t * 0.7) * 40;
    const radius = 240;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, biome.palette.fogColor);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
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

export function drawAmbientParticles(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  ctx.save();
  for (const mote of ambientMoteSeeds) {
    const y = (mote.baseY - (timeMs / 1000) * mote.speed) % WORLD_SIZE.height;
    const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
    const x = mote.baseX + Math.sin(timeMs / 2000 + mote.phase) * 12;
    const alpha = 0.18 + 0.18 * Math.sin(timeMs / 1500 + mote.phase * 2);
    ctx.fillStyle = hexToRgba(biome.palette.vegetationHighlight, Math.max(alpha, 0.05));
    ctx.beginPath();
    ctx.arc(x, wrappedY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
