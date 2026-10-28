import type { TowerSlotDefinition } from "@/data/mapWhisperingWoods";
import { distance, type Vector2 } from "@/utils/geometry";
import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";
import { getCastleHpTier } from "@/config/castleConfig";
import type { CastleSkinDefinition } from "@/config/castleSkins";
import { PALETTE } from "./theme";
import { drawEnergyCrack, drawFloatingMotes } from "./lighting";
import type { AtmosphereKind, BiomeDefinition } from "./biomes";
import { getMapDecorations, type Decoration, type DecorationKind } from "./mapDecorations";
import { castleAnchor, castleSpriteOrigin, CASTLE_SPRITE_SIZE, getCastleSprite } from "./castleSprites";

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

/** The world-space rectangle actually visible on screen (can extend past WORLD_SIZE on screens whose aspect ratio isn't 5:3 — the letterbox margins). */
export interface VisibleBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const WORLD_BOUNDS: VisibleBounds = { x0: 0, y0: 0, x1: WORLD_SIZE.width, y1: WORLD_SIZE.height };

export function drawBackground(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, bounds: VisibleBounds = WORLD_BOUNDS): void {
  const p = biome.palette;
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_SIZE.height);
  gradient.addColorStop(0, p.skyTop);
  gradient.addColorStop(0.16, p.groundAccentA);
  gradient.addColorStop(0.55, p.groundBase);
  gradient.addColorStop(1, p.groundShadowed);
  ctx.fillStyle = gradient;
  // Fills the whole visible area (letterbox margins included), not just the world rectangle, so there are never empty bars beside the map.
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);

  // Irregular ground-tone blotches, deterministic per-cell — this is what
  // stops the terrain from reading as a flat color swatch.
  const cell = 70;
  const blotchColors = [p.groundAccentA, p.groundAccentB, p.groundShadowed];
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let cy = Math.floor(bounds.y0 / cell); cy < Math.ceil(bounds.y1 / cell); cy++) {
    for (let cx = Math.floor(bounds.x0 / cell); cx < Math.ceil(bounds.x1 / cell); cx++) {
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

export function drawVignette(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, bounds: VisibleBounds = WORLD_BOUNDS): void {
  const cx = WORLD_SIZE.width / 2;
  const cy = WORLD_SIZE.height / 2;
  const radius = Math.max(WORLD_SIZE.width, WORLD_SIZE.height) * 0.78;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, biome.palette.vignette);
  ctx.fillStyle = gradient;
  // Covers the full visible area so the darkening continues smoothly into the letterbox margins instead of stopping in a hard seam at the world edge.
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
}

// ---------------------------------------------------------------------------
// Scenery: trees, rocks, roots, ruins, crystals, flowers, water, torches —
// all recolored from the active biome's palette.
// ---------------------------------------------------------------------------

/**
 * MUNDO 3D — FASE 2 `skipKinds` lets the caller omit specific decoration
 * kinds entirely (optional, defaults to none skipped so every existing
 * caller — the menu preview, any test — is byte-for-byte unchanged). When
 * the 3D world layer is active, `CanvasRenderer.tsx` passes TREE/ROCK/RUIN
 * here because `rendering3d/world/worldVegetation.ts` now draws a REAL 3D
 * counterpart at these exact same positions (same per-biome decoration
 * layout, from `getMapDecorations(biome)`) — this is what stops each of
 * those three kinds from being drawn twice (once flat in 2D, once with
 * real height/shadow in 3D) rather than adding a second, competing
 * decoration system.
 */
export function drawDecorations(
  ctx: CanvasRenderingContext2D,
  biome: BiomeDefinition,
  timeMs: number,
  skipKinds?: ReadonlySet<DecorationKind>,
): void {
  for (const deco of getMapDecorations(biome)) {
    if (skipKinds?.has(deco.kind)) continue;
    ctx.save();
    ctx.translate(deco.position.x, deco.position.y);
    if (deco.kind !== "WATER") {
      // VISUAL POLISH (fase 260 feedback) — torches were spun to a random
      // angle like every other prop, so a pole+brazier+flame lying sideways
      // read as an arrow flying across the map. Torches now always stand
      // upright and crystals only lean a little.
      if (deco.kind === "CRYSTAL") ctx.rotate((deco.rotation / Math.PI - 1) * 0.35);
      else if (deco.kind !== "TORCH") ctx.rotate(deco.rotation);
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
        drawCrystalCluster(ctx, deco, timeMs, biome);
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
        drawBrazierTorch(ctx, deco, timeMs, biome);
        break;
      case "FISSURE":
        drawFissure(ctx, deco, timeMs, biome);
        break;
    }
    ctx.restore();
  }
}

/**
 * FISSURE — a glowing crack in the ground (lava seam in Volcanic Wastes,
 * frost fracture in Frozen Tundra): a dark split in the terrain with the
 * biome's accent light bleeding out of it and slowly breathing. The shape
 * is a deterministic jagged main crack with two side branches derived from
 * the decoration's own variant, so every fissure differs but never changes
 * between frames.
 */
function drawFissure(ctx: CanvasRenderingContext2D, deco: Decoration, timeMs: number, biome: BiomeDefinition): void {
  const p = biome.palette;
  const seed = deco.variant * 13.7 + deco.position.x * 0.31 + deco.position.y * 0.17;
  const length = 46;
  const main: Vector2[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    main.push({ x: -length / 2 + t * length, y: (hashPoint(i, 1, seed) - 0.5) * 9 * Math.sin(t * Math.PI) });
  }
  const branches: Vector2[][] = [];
  for (let b = 0; b < 2; b++) {
    const start = main[2 + b * 3]!;
    const dir = b === 0 ? -1 : 1;
    const branch: Vector2[] = [start];
    for (let i = 1; i <= 3; i++) {
      branch.push({ x: start.x + i * 4 + (hashPoint(b, i, seed) - 0.5) * 4, y: start.y + dir * i * 4.5 });
    }
    branches.push(branch);
  }
  const all = [main, ...branches];
  const stroke = (pts: Vector2[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.stroke();
  };
  const breathe = 0.75 + 0.25 * Math.sin(timeMs / 900 + seed);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Scorched/darkened lip around the crack.
  ctx.strokeStyle = hexToRgba(p.rockDark, 0.38);
  ctx.lineWidth = 5;
  all.forEach(stroke);
  // Light bleeding out of it.
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hexToRgba(p.accentGlow, 0.18 * breathe);
  ctx.lineWidth = 9;
  stroke(main);
  ctx.strokeStyle = hexToRgba(p.accentGlow, 0.55 * breathe);
  ctx.lineWidth = 2.4;
  all.forEach(stroke);
  ctx.strokeStyle = hexToRgba(p.accentWarm, 0.8 * breathe);
  ctx.lineWidth = 0.9;
  stroke(main);
  ctx.restore();
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

  if (biome.liquidGlows) {
    // Self-lit liquid (lava): a hot additive halo that slowly breathes, and
    // a brighter molten center — no white water ripples or lily pad.
    const breathe = 0.8 + 0.2 * Math.sin(timeMs / 1100 + deco.position.x);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(0, 0, radiusY * 0.4, 0, 0, radiusX * 1.5);
    halo.addColorStop(0, hexToRgba(p.accentGlow, 0.35 * breathe));
    halo.addColorStop(1, hexToRgba(p.accentGlow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * 1.5, radiusY * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX * 0.7);
    core.addColorStop(0, hexToRgba(p.accentWarm, 0.7 * breathe));
    core.addColorStop(1, hexToRgba(p.accentWarm, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * 0.7, radiusY * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Thin dark cooling-crust seams drifting slowly across the surface
    // (slender arcs, not round spots — round blobs read as cartoon toppings).
    ctx.strokeStyle = hexToRgba(p.rockDark, 0.5);
    ctx.lineCap = "round";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = timeMs / 14000 + i * 2.1 + deco.variant;
      const sx = Math.cos(a) * radiusX * 0.45;
      const sy = Math.sin(a) * radiusY * 0.4;
      ctx.beginPath();
      ctx.moveTo(sx - 7, sy);
      ctx.quadraticCurveTo(sx, sy - 3 + i, sx + 7, sy + 1);
      ctx.stroke();
    }
    return;
  }

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

/**
 * Standing torch: a timber post with iron bands and a forged brazier, lit
 * from the same side as the baked ground and castle, burning with the same
 * layered fire, embers and smoke as the castle (never a flat glow blob).
 */
function drawBrazierTorch(ctx: CanvasRenderingContext2D, deco: Decoration, timeMs: number, biome: BiomeDefinition): void {
  const seed = deco.variant * 7 + Math.round(deco.position.x * 0.37 + deco.position.y * 0.11);
  // Shadow cast up-right on the ground, plus the warm pool of light the fire throws.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.moveTo(-2, 13);
  ctx.lineTo(9, 2);
  ctx.lineTo(11, 3.5);
  ctx.lineTo(2, 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  const flick = 0.85 + 0.15 * Math.sin(timeMs / 90 + seed) * Math.sin(timeMs / 37 + seed * 2);
  const pool = ctx.createRadialGradient(0, 10, 0, 0, 10, 26);
  pool.addColorStop(0, `rgba(255,150,60,${0.26 * flick})`);
  pool.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(0, 10, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Stone footing.
  ctx.fillStyle = biome.palette.rockDark;
  ctx.beginPath();
  ctx.ellipse(0, 13, 4.2, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba(biome.palette.rock, 0.85);
  ctx.beginPath();
  ctx.ellipse(-0.8, 12.4, 3.2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Timber post: lit on the left, shadowed on the right, slight taper.
  const post = ctx.createLinearGradient(-1.8, 0, 1.8, 0);
  post.addColorStop(0, "#8a6a44");
  post.addColorStop(0.45, "#5a4028");
  post.addColorStop(1, "#24180e");
  ctx.fillStyle = post;
  ctx.beginPath();
  ctx.moveTo(-1.9, 12.5);
  ctx.lineTo(-1.4, -3);
  ctx.lineTo(1.4, -3);
  ctx.lineTo(1.9, 12.5);
  ctx.closePath();
  ctx.fill();
  // Firelight catching the top of the post.
  ctx.fillStyle = `rgba(255,170,80,${0.35 * flick})`;
  ctx.fillRect(-1.4, -3, 2.8, 3);
  // Iron bands.
  ctx.fillStyle = "#2a2a2c";
  for (const y of [1.5, 8]) ctx.fillRect(-1.8, y, 3.6, 1);

  // Forged brazier bowl with a rim highlight.
  const bowl = ctx.createLinearGradient(-4.5, 0, 4.5, 0);
  bowl.addColorStop(0, "#5a5654");
  bowl.addColorStop(0.5, "#2e2c2c");
  bowl.addColorStop(1, "#121112");
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(-4.6, -6.6);
  ctx.lineTo(4.6, -6.6);
  ctx.lineTo(2.4, -2.6);
  ctx.lineTo(-2.4, -2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a1818";
  ctx.beginPath();
  ctx.ellipse(0, -6.6, 4.6, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glowing coals inside the bowl.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(255,110,30,${0.75 * flick})`;
  ctx.beginPath();
  ctx.ellipse(0, -6.5, 3.6, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,200,140,0.35)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4.6, -6.6);
  ctx.lineTo(-2.4, -2.6);
  ctx.stroke();

  drawFire(ctx, 0, -6.4, timeMs, 0.5, seed);
  drawEmbers(ctx, 0, -10, timeMs, 3, seed + 3);
  drawSmokeColumn(ctx, 0, -16, timeMs, 0.28, seed + 5);
}

/**
 * Crystal outcrop: a cluster of faceted prisms breaking out of the ground,
 * each with a lit face, a shadowed face and a bright edge, glowing from
 * inside in the biome's accent colour (slow breathing + a rare glint at a
 * tip). The ground glow stays small so the shape always reads first.
 */
function drawCrystalCluster(ctx: CanvasRenderingContext2D, deco: Decoration, timeMs: number, biome: BiomeDefinition): void {
  const color = biome.palette.accentGlow;
  const seed = deco.variant * 13 + Math.round(deco.position.x * 0.41 + deco.position.y * 0.23);
  const rnd = (k: number) => {
    const x = Math.sin((seed + k) * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const breathe = 0.65 + 0.35 * Math.sin(timeMs / 1400 + seed);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(3, 5.5, 9, 3, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(0, 4, 0, 0, 4, 14);
  pool.addColorStop(0, hexToRgba(color, 0.22 * breathe));
  pool.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Prisms, back to front: [x offset, height, width, lean]
  const n = 3 + Math.floor(rnd(1) * 3);
  const prisms: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const main = i === Math.floor(n / 2);
    prisms.push([(i - (n - 1) / 2) * 3.2 + (rnd(i + 10) - 0.5) * 1.5, main ? 15 + rnd(i) * 3 : 6 + rnd(i + 20) * 7, main ? 3.4 : 2 + rnd(i + 30) * 1.2, (i - (n - 1) / 2) * 0.22 + (rnd(i + 40) - 0.5) * 0.15]);
  }
  prisms.sort((a, b) => a[1] - b[1]);
  for (const [px, ph, pw, lean] of prisms) {
    ctx.save();
    ctx.translate(px, 4);
    ctx.rotate(lean);
    const tipY = -ph;
    // Lit (left) face.
    const lit = ctx.createLinearGradient(0, 0, 0, tipY);
    lit.addColorStop(0, hexToRgba(color, 0.55));
    lit.addColorStop(1, hexToRgba("#ffffff", 0.85));
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(-pw, 0);
    ctx.lineTo(-pw, tipY + pw * 1.8);
    ctx.lineTo(0, tipY);
    ctx.lineTo(0, 0.6);
    ctx.closePath();
    ctx.fill();
    // Shadowed (right) face.
    const dark = ctx.createLinearGradient(0, 0, 0, tipY);
    dark.addColorStop(0, "rgba(10,8,20,0.9)");
    dark.addColorStop(1, hexToRgba(color, 0.7));
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, 0.6);
    ctx.lineTo(0, tipY);
    ctx.lineTo(pw, tipY + pw * 1.8);
    ctx.lineTo(pw, 0);
    ctx.closePath();
    ctx.fill();
    // Inner glow breathing up the core.
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexToRgba(color, 0.35 * breathe);
    ctx.lineWidth = pw * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, tipY + pw * 1.6);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    // Bright ridge edge.
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, tipY);
    ctx.stroke();
    ctx.restore();
  }
  // Rocky base the crystals break out of.
  ctx.fillStyle = biome.palette.rockDark;
  ctx.beginPath();
  ctx.moveTo(-8, 5);
  ctx.lineTo(-5, 2.5);
  ctx.lineTo(-1, 3.6);
  ctx.lineTo(3, 2.4);
  ctx.lineTo(7.5, 4.2);
  ctx.lineTo(6, 6.4);
  ctx.lineTo(-6, 6.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hexToRgba(biome.palette.rock, 0.7);
  ctx.beginPath();
  ctx.moveTo(-7, 4.6);
  ctx.lineTo(-5, 3);
  ctx.lineTo(-2, 4);
  ctx.lineTo(-4, 5.2);
  ctx.closePath();
  ctx.fill();

  // A rare glint travelling across the tallest tip.
  const cycle = ((timeMs + seed * 397) % 5200) / 5200;
  if (cycle < 0.08) {
    const a = Math.sin((cycle / 0.08) * Math.PI);
    const tall = prisms[prisms.length - 1]!;
    const gx = tall[0] + Math.sin(tall[3]) * tall[1];
    const gy = 4 - Math.cos(tall[3]) * tall[1] + 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(gx - 3 * a, gy);
    ctx.lineTo(gx + 3 * a, gy);
    ctx.moveTo(gx, gy - 3 * a);
    ctx.lineTo(gx, gy + 3 * a);
    ctx.stroke();
    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Organic road. `path` here is ALWAYS data/mapWhisperingWoods.ts's
// ENEMY_PATH — the same dense, already-curved polyline entities/Enemy.ts
// walks via getPointAtDistance. This file does NOT re-smooth it: there
// used to be a second, private Catmull-Rom pass right here that produced
// its own curve purely for drawing, independent of the one enemies
// actually walked — at sharp turns the two curves diverged, so the drawn
// road could visibly not contain the enemy's real position ("inimigos
// saem do mapa nas curvas"). Building the road ribbon directly around the
// SAME array both sides already share is what makes "path visual = path
// real de movimentação" an actual invariant instead of a coincidence.
// Everything below only adds cosmetic width-breathing/edge jitter AROUND
// that one real centerline — see the half-width floor in
// buildOrganicRoad, which guarantees the jitter can never shrink the road
// thin enough for the walked centerline point to end up outside it.
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface OrganicRoad {
  smoothed: readonly Vector2[];
  left: Vector2[];
  right: Vector2[];
}

/**
 * Builds the road's visual edges directly around `path` (the real,
 * already-curved centerline both rendering and movement share — see the
 * file header above): width breathes along its length and each edge is
 * independently jittered, so the road reads as a worn trail cut through
 * terrain instead of a uniform painted ribbon. `widthOffset` lets the
 * caller nest several passes (soft dirt halo, dark edge, bright fill)
 * around the same centerline. `MIN_HALF_WIDTH` floors how thin any single
 * pass can get even at the noise/jitter's most extreme combination, so
 * the real walked centerline point is ALWAYS strictly inside every pass's
 * polygon, corners included — not just "usually".
 */
const MIN_HALF_WIDTH = 10;

export function buildOrganicRoad(path: readonly Vector2[], baseWidth: number, widthOffset: number, seed: number): OrganicRoad {
  const smoothed = path;
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
    // Floor each edge's distance from the real centerline independently of
    // the jitter's sign/magnitude — this is what guarantees the walked
    // point can never end up outside the drawn road, not just "usually".
    const leftWidth = Math.max(halfWidth + jitterL, MIN_HALF_WIDTH);
    const rightWidth = Math.max(halfWidth + jitterR, MIN_HALF_WIDTH);

    const point = smoothed[i]!;
    left.push({ x: point.x + normal.x * leftWidth, y: point.y + normal.y * leftWidth });
    right.push({ x: point.x - normal.x * rightWidth, y: point.y - normal.y * rightWidth });
  }

  return { smoothed, left, right };
}

/** Builds the ribbon path on `ctx` without painting it — shared by `fillRibbon` (which fills it) and the surface-detail clip below (which only ever needs the shape, not a visible paint). */
function ribbonPath(ctx: CanvasRenderingContext2D, left: readonly Vector2[], right: readonly Vector2[]): void {
  ctx.beginPath();
  ctx.moveTo(left[0]!.x, left[0]!.y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i]!.x, left[i]!.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]!.x, right[i]!.y);
  ctx.closePath();
}

function fillRibbon(ctx: CanvasRenderingContext2D, left: readonly Vector2[], right: readonly Vector2[]): void {
  ribbonPath(ctx, left, right);
  ctx.fill();
}

function strokeSmoothedCenterline(ctx: CanvasRenderingContext2D, smoothed: readonly Vector2[]): void {
  ctx.beginPath();
  ctx.moveTo(smoothed[0]!.x, smoothed[0]!.y);
  for (let i = 1; i < smoothed.length; i++) ctx.lineTo(smoothed[i]!.x, smoothed[i]!.y);
  ctx.stroke();
}

const ROAD_SEED = 11;

/**
 * MUNDO 3D — FASE 2 `skipFill`: when the 3D world layer is active, its own
 * road mesh (`rendering3d/world/worldTerrainGeometry.ts`'s
 * `buildRoadGeometry`, built from this exact SAME `path` array) already
 * paints the actual road surface — lit, shadowed, sitting on the real
 * terrain elevation. Passing `skipFill=true` here skips only the three
 * flat, opaque 2D fills (halo/edge/fill ribbon) that would otherwise paint
 * over and hide it completely, while every 2D readability/detail pass
 * (worn centerline rut, dirt patches, fallen leaves, edge rocks/roots/
 * grass) still draws normally on top — the road stays exactly as legible,
 * it's just the 3D layer's own material providing the base surface color/
 * shading instead of a second, competing flat fill. Defaults to false, so
 * every existing caller (menu preview, tests) is unchanged.
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  path: readonly Vector2[],
  biome: BiomeDefinition,
  skipFill = false,
): void {
  if (path.length < 2) return;
  const p = biome.palette;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (!skipFill) {
    const halo = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 9, ROAD_SEED);
    ctx.fillStyle = "rgba(15,11,6,0.32)";
    fillRibbon(ctx, halo.left, halo.right);

    const edge = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 3, ROAD_SEED);
    ctx.fillStyle = p.roadEdge;
    fillRibbon(ctx, edge.left, edge.right);

    const roadGradient = ctx.createLinearGradient(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
    roadGradient.addColorStop(0, p.roadFillLight);
    roadGradient.addColorStop(1, p.roadFill);
    ctx.fillStyle = roadGradient;
  }
  const fill = buildOrganicRoad(path, PATH_VISUAL_WIDTH, 0, ROAD_SEED);
  if (!skipFill) fillRibbon(ctx, fill.left, fill.right);

  // VISUAL POLISH (fase 260 feedback) — the centerline used to be a dashed
  // stroke, which read as a highway lane marking. It's now a soft,
  // continuous worn band (wide + faint, then a narrower brighter core), and
  // the trail gets a darkened lip plus a faint accent-colored edge light so
  // it separates clearly from the surrounding ground in every biome.
  ctx.strokeStyle = p.roadRut;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 16;
  strokeSmoothedCenterline(ctx, fill.smoothed);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = hexToRgba(p.roadEdge, 0.7);
  ctx.lineWidth = 3.2;
  strokeSmoothedCenterline(ctx, fill.left);
  strokeSmoothedCenterline(ctx, fill.right);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hexToRgba(p.accentGlow, 0.16);
  ctx.lineWidth = 1.4;
  strokeSmoothedCenterline(ctx, fill.left);
  strokeSmoothedCenterline(ctx, fill.right);
  ctx.restore();

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
  ribbonPath(ctx, fill.left, fill.right);
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

/**
 * MUNDO 3D — FASE 3 gameplay-integration test: the exact same anchor
 * `drawPathEndpoints` computes for the fortress, pulled out so a 3D castle
 * test layer (`rendering3d/world/WorldGameplayTestLayer.tsx`) can position
 * itself there too, from the SAME `ENEMY_PATH`-derived math — never a
 * second, independently-guessed castle position.
 */
export function getFortressAnchor(path: readonly Vector2[]): { position: Vector2; facingDir: Vector2 } {
  const end = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const endDir = normalize(end.x - prev.x, end.y - prev.y);
  return { position: { x: end.x - endDir.x * ENDPOINT_INSET, y: end.y - endDir.y * ENDPOINT_INSET }, facingDir: endDir };
}

export function drawPathEndpoints(
  ctx: CanvasRenderingContext2D,
  path: readonly Vector2[],
  biome: BiomeDefinition,
  timeMs: number,
  /** 0..1 — baseHp/maxBaseHp for the current attempt. Defaults to 1 (pristine) for callers with no gameplay HP concept (e.g. the main menu). */
  hpPercent = 1,
  /**
   * MUNDO 3D — FASE 3: true while `WorldGameplayTestLayer`'s 3D castle body
   * is mounted, so this skips ONLY the fortress's own wall/tower/gate
   * drawing (`drawFortress`'s `skipBody`) — the HP-tier damage overlay
   * (cracks/smoke/fire, `drawFortressDamageOverlay`) keeps drawing on top
   * of the 3D model at the exact same anchor, since that's real gameplay
   * state (Castle HP) that must never silently stop being shown. Defaults
   * to false, so every existing caller (main menu's cinematic fortress,
   * any test) is pixel-identical to before this param existed.
   */
  skipCastleBody = false,
): void {
  if (path.length < 2) return;
  const start = path[0]!;
  const startDir = normalize(path[1]!.x - start.x, path[1]!.y - start.y);
  drawMagicPortal(ctx, { x: start.x + startDir.x * ENDPOINT_INSET, y: start.y + startDir.y * ENDPOINT_INSET }, timeMs);

  const { position: fortressPos } = getFortressAnchor(path);
  drawFortress(ctx, fortressPos, biome, timeMs, 1, 0, hpPercent, null, skipCastleBody);
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
  /** 0..1 — baseHp/maxBaseHp. Drives the Castle Visual State damage overlay (config/castleConfig.ts). Defaults to 1 (pristine) so every existing caller (the menu's cinematic fortress) is visually unchanged. */
  hpPercent = 1,
  /** Castle Skin architecture (spec section 20, config/castleSkins.ts) — overrides only the fortress's own stonework colors (rock/rockDark), never any other biome-driven element (terrain, decorations, path stay biome-accurate). Defaults to null so every existing caller is pixel-identical to before. */
  skin: CastleSkinDefinition | null = null,
  /** MUNDO 3D — FASE 3: true while a 3D castle body is rendered in its place — skips every wall/tower/gate draw call below, but `drawFortressDamageOverlay` (called unconditionally further down, in this same translate+scale space) still runs, so the HP-tier damage read never silently disappears. Defaults to false — every existing caller unaffected. */
  skipBody = false,
): FortressAnchors {
  const p = { ...biome.palette, ...skin?.paletteOverride };
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.scale(scale, scale);

  // REALISTIC CASTLE (castleSprites.ts) — the rendered 3D fortress for this
  // biome and damage tier, with every animated element drawn live on top.
  // Falls back to the original hand-drawn fortress below while the image is
  // loading (or wherever images can't load).
  const castleTier = getCastleHpTier(hpPercent);
  const castleImage = skipBody ? undefined : getCastleSprite(biome.id, castleTier);
  if (castleImage) {
    drawRealisticCastle(ctx, castleImage, castleTier, biome, p.accentGlow, timeMs, windIntensity, hpPercent);
    ctx.restore();
    return {
      torches: [castleAnchor("keepWindow", castleTier), castleAnchor("torchL", castleTier), castleAnchor("torchR", castleTier), castleAnchor("core", castleTier)],
    };
  }

  if (!skipBody) {
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

  // IDENTIDADE VISUAL HORDENOVA — the fortress gets the same 4-layer magic
  // read as every tower, using the active BIOME's own accent color (the
  // castle is the one structure that already reads terrain-biome palette,
  // per this file's header) rather than a fixed elemental theme.
  const castleAccent = p.accentGlow;
  const damageIntensity = Math.max(0, 1 - hpPercent); // CAMADA 3: runes burn brighter as the castle takes real damage.
  const castlePulse = 0.5 + 0.5 * Math.sin(timeMs / 700);

  // CAMADA 1 (Veios de Energia): glowing cracks through the central wall's
  // own stonework, brighter the more damaged the castle is — the wall's
  // remaining power visibly straining to hold.
  drawEnergyCrack(ctx, -14, 16, -17, 2, -10, -18, castleAccent, 0.35 + damageIntensity * 0.5);
  drawEnergyCrack(ctx, 14, 16, 17, 4, 11, -14, castleAccent, 0.3 + damageIntensity * 0.5);

  // CAMADA 2 (Núcleo): a crystal heart set in the gate's keystone — the
  // fortress's own focal power source, the same role a tower's core plays.
  const keystoneHalo = ctx.createRadialGradient(0, -22, 0, 0, -22, 9 + damageIntensity * 4);
  keystoneHalo.addColorStop(0, castleAccent);
  keystoneHalo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = keystoneHalo;
  ctx.beginPath();
  ctx.arc(0, -22, 9 + damageIntensity * 4, 0, Math.PI * 2);
  ctx.fill();
  const keystoneGrad = ctx.createRadialGradient(-0.5, -22.8, 0, 0, -22, 3.2);
  keystoneGrad.addColorStop(0, "#ffffff");
  keystoneGrad.addColorStop(0.55, castleAccent);
  keystoneGrad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = keystoneGrad;
  ctx.beginPath();
  ctx.arc(0, -22, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // CAMADA 3 (Runas Gravadas): engraved marks flanking the keystone on the
  // central wall — pulse continuously, flare further with real damage.
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.25 * castlePulse + damageIntensity * 0.4;
  ctx.strokeStyle = castleAccent;
  ctx.lineWidth = 1;
  for (const rx of [-16, 16]) {
    ctx.beginPath();
    ctx.moveTo(rx, -8);
    ctx.lineTo(rx, -18);
    ctx.moveTo(rx - 2.4, -13);
    ctx.lineTo(rx + 2.4, -13);
    ctx.stroke();
  }
  ctx.restore();

  // CAMADA 4 (Partículas Flutuantes): motes drifting slowly around the rear
  // keep, biome-colored — the same continuous "alive with magic" read a
  // tower's core gets, scaled up to the fortress's own height.
  drawFloatingMotes(ctx, 0, -70, timeMs, 61, {
    count: 6,
    spreadX: 26,
    spreadY: 60,
    color: castleAccent,
    periodMs: 4600,
    size: 1.2,
  });
  }

  drawFortressDamageOverlay(ctx, timeMs, hpPercent);

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

/**
 * Castle Visual State (Progression 2.0 spec section 12-15) — additive
 * damage read layered on TOP of the fortress' normal draw, gated purely by
 * `getCastleHpTier(hpPercent)`. Never touches the base geometry above (so
 * it works unmodified for any future castle skin, per section 15), only
 * paints cracks/smoke/embers/danger-lighting over it. Called from inside
 * drawFortress's own translate+scale block, so coordinates here are local
 * fortress space, matching every other draw call in that function.
 */
function drawRealisticCastle(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tier: number,
  biome: BiomeDefinition,
  accent: string,
  timeMs: number,
  windIntensity: number,
  hpPercent: number,
): void {
  const o = castleSpriteOrigin();
  // Ground shadow so the mound sits on the terrain.
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 70, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(image, o.x, o.y, CASTLE_SPRITE_SIZE, CASTLE_SPRITE_SIZE);

  const A = (name: string) => castleAnchor(name, tier);
  const damage = Math.max(0, 1 - hpPercent);

  // Windows: soft warm flicker over the baked lit windows.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [name, phase] of [
    ["keepWindow", 0],
    ["towerWindowL", 1.7],
    ["towerWindowR", 3.1],
  ] as const) {
    if (tier >= 3 && name === "towerWindowL") continue;
    const w = A(name);
    const f = 0.5 + 0.5 * Math.sin(timeMs / 420 + phase) * Math.sin(timeMs / 170 + phase * 2);
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 7);
    g.addColorStop(0, `rgba(255,180,90,${0.22 + 0.18 * f})`);
    g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gate torches: real little flames on the iron brackets + a light pool.
  for (const [name, phase] of [
    ["torchL", 0],
    ["torchR", 2.3],
  ] as const) {
    const t = A(name);
    const flick = Math.sin(timeMs / 90 + phase) * 0.8 + Math.sin(timeMs / 37 + phase) * 0.4;
    const glow = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 16);
    glow.addColorStop(0, "rgba(255,170,80,0.42)");
    glow.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,150,50,0.9)";
    ctx.beginPath();
    ctx.moveTo(t.x - 1.8, t.y);
    ctx.quadraticCurveTo(t.x - 2 + flick, t.y - 4, t.x + flick * 0.6, t.y - 7.5);
    ctx.quadraticCurveTo(t.x + 2 + flick, t.y - 4, t.x + 1.8, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,240,180,0.95)";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y - 1.6, 0.9, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Keystone crystal — the castle's magic core, pulsing in the biome's accent
  // color and flaring brighter the more damage the castle has taken.
  const core = A("core");
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 700);
  const haloR = 6 + pulse * 1.5;
  const halo = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, haloR);
  halo.addColorStop(0, hexToRgba(accent, 0.45 + damage * 0.15));
  halo.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(core.x, core.y, haloR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Waving banners on the real flag poles.
  drawBanner(ctx, A("bannerKeep").x - 2, A("bannerKeep").y + 4, biome, timeMs, 1.15, 0, windIntensity);
  drawBanner(ctx, A("bannerGate").x - 2, A("bannerGate").y + 4, biome, timeMs, 0.85, 0.5, windIntensity);
  if (tier < 3) drawBanner(ctx, A("bannerTowerL").x - 2, A("bannerTowerL").y + 4, biome, timeMs, 0.9, -0.3, windIntensity);
  drawBanner(ctx, A("bannerTowerR").x - 2, A("bannerTowerR").y + 4, biome, timeMs, 0.9, 0.3, windIntensity);

  // Magic motes drifting around the keep.
  const keep = A("keepWindow");
  drawFloatingMotes(ctx, keep.x, keep.y - 6, timeMs, 61, { count: 6, spreadX: 26, spreadY: 50, color: accent, periodMs: 4600, size: 1.2 });

  // Live damage on top of the baked damage (cracks / broken tower / fallen
  // roof are in the image): real fire, smoke columns, rising embers and
  // crumbling stone — never a flat tinted circle.
  if (tier >= 2) {
    // Dust and pebbles crumbling off the walls.
    drawCrumble(ctx, A("bannerGate"), timeMs, tier >= 3 ? 3 : 1, 11);
    if (tier >= 3) drawCrumble(ctx, A("towerWindowR"), timeMs, 2, 29);
  }
  if (tier >= 3) {
    const towerTop = A("bannerTowerL");
    drawSmokeColumn(ctx, towerTop.x, towerTop.y - 2, timeMs, tier >= 4 ? 1.35 : 1, 3);
    drawFire(ctx, towerTop.x, towerTop.y + 2, timeMs, tier >= 4 ? 1.3 : 0.9, 5);
    drawEmbers(ctx, towerTop.x, towerTop.y, timeMs, tier >= 4 ? 12 : 6, 7);
  }
  if (tier >= 4) {
    const keepWin = A("keepWindow");
    drawSmokeColumn(ctx, keepWin.x, keepWin.y - 4, timeMs, 1.1, 17);
    drawFire(ctx, keepWin.x, keepWin.y + 1, timeMs, 1, 23);
    drawEmbers(ctx, keepWin.x, keepWin.y - 2, timeMs, 8, 31);
    const gate = A("bannerGate");
    drawFire(ctx, gate.x - 7, gate.y + 3, timeMs, 0.7, 41);
    drawFire(ctx, gate.x + 7, gate.y + 3, timeMs, 0.6, 43);
    drawEmbers(ctx, gate.x, gate.y, timeMs, 6, 47);
    // The keystone crystal flickers unstably, crackling with its own light.
    const c = A("core");
    const unstable = Math.max(0, Math.sin(timeMs / 47) * Math.sin(timeMs / 113));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexToRgba(accent, 0.5 + 0.5 * unstable);
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 3; k++) {
      const a = timeMs / 400 + k * 2.1;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(a) * 4 + Math.sin(timeMs / 30 + k) * 1.5, c.y + Math.sin(a) * 4);
      ctx.lineTo(c.x + Math.cos(a + 0.4) * 8, c.y + Math.sin(a + 0.4) * 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Seeded 0..1 noise from an integer-ish input. */
function n01(v: number): number {
  const x = Math.sin(v * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Layered, flickering flames rooted at (x,y): dark-red outer tongues, orange body, yellow-white core, plus a warm light pool. */
function drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, size: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(x, y - 4 * size, 0, x, y - 4 * size, 22 * size);
  pool.addColorStop(0, "rgba(255,140,50,0.28)");
  pool.addColorStop(1, "rgba(255,100,30,0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(x, y - 4 * size, 22 * size, 0, Math.PI * 2);
  ctx.fill();
  const tongues = 5;
  const layers: [string, string, number, number][] = [
    ["rgba(200,40,10,0.55)", "rgba(200,40,10,0)", 1.0, 1.0],
    ["rgba(255,120,30,0.75)", "rgba(255,150,40,0)", 0.75, 0.8],
    ["rgba(255,230,150,0.9)", "rgba(255,240,190,0)", 0.42, 0.55],
  ];
  for (const [c0, c1, wMul, hMul] of layers) {
    for (let k = 0; k < tongues; k++) {
      const off = (k - (tongues - 1) / 2) * 2.6 * size;
      const t = timeMs / (90 + n01(seed + k) * 60) + n01(seed * 3 + k) * 6;
      const h = (9 + 6 * Math.abs(Math.sin(t)) + 4 * n01(seed + k * 7)) * size * hMul * (1 - Math.abs(off) / (10 * size));
      if (h <= 1) continue;
      const w = 2.4 * size * wMul;
      const sway = Math.sin(t * 1.7) * 1.8 * size;
      const g = ctx.createLinearGradient(x + off, y, x + off, y - h);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + off - w, y);
      ctx.bezierCurveTo(x + off - w, y - h * 0.4, x + off + sway - w * 0.4, y - h * 0.7, x + off + sway, y - h);
      ctx.bezierCurveTo(x + off + sway + w * 0.4, y - h * 0.7, x + off + w, y - h * 0.4, x + off + w, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A rising, widening, drifting smoke column made of soft puffs. */
function drawSmokeColumn(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, size: number, seed: number): void {
  ctx.save();
  const puffs = 9;
  for (let i = 0; i < puffs; i++) {
    const cycle = (timeMs / 3400 + i / puffs + n01(seed + i) * 0.05) % 1;
    const drift = cycle * cycle * 26 * size + Math.sin(timeMs / 1300 + i + seed) * 3;
    const px = x + drift;
    const py = y - cycle * 70 * size;
    const r = (4 + cycle * 14) * size;
    const a = Math.sin(cycle * Math.PI) * 0.42;
    const shade = 30 + Math.round(cycle * 50);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${shade},${shade - 4},${shade - 8},${a})`);
    g.addColorStop(1, `rgba(${shade},${shade - 4},${shade - 8},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bright embers spiralling up out of a fire. */
function drawEmbers(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, count: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const life = 1600 + n01(seed + i) * 1400;
    const cycle = ((timeMs + n01(seed * 5 + i) * life) % life) / life;
    const ex = x + (n01(seed + i * 3) - 0.5) * 12 + Math.sin(timeMs / 260 + i) * 4 * cycle;
    const ey = y - cycle * (40 + n01(seed + i * 9) * 30);
    const a = (1 - cycle) * (0.6 + 0.4 * Math.sin(timeMs / 60 + i));
    ctx.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - cycle))},60,${Math.max(0, a)})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 0.8 + (1 - cycle) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Grit and small stones periodically breaking off a wall and falling, with a little dust puff where they land. */
function drawCrumble(ctx: CanvasRenderingContext2D, from: Vector2, timeMs: number, count: number, seed: number): void {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const period = 2600 + n01(seed + i) * 2200;
    const phase = ((timeMs + n01(seed * 2 + i) * period) % period) / period;
    if (phase > 0.45) continue;
    const t = phase / 0.45;
    const sx = from.x + (n01(seed + i * 5) - 0.5) * 18;
    const fall = 16 + n01(seed + i * 11) * 14;
    const py = from.y + t * t * fall;
    ctx.fillStyle = "rgba(70,62,54,0.9)";
    ctx.beginPath();
    ctx.arc(sx, py, 0.9 + n01(seed + i) * 0.7, 0, Math.PI * 2);
    ctx.fill();
    if (t > 0.85) {
      const d = (t - 0.85) / 0.15;
      ctx.fillStyle = `rgba(150,140,125,${0.35 * (1 - d)})`;
      ctx.beginPath();
      ctx.ellipse(sx, from.y + fall, 2 + d * 5, 1 + d * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawFortressDamageOverlay(ctx: CanvasRenderingContext2D, timeMs: number, hpPercent: number): void {
  const tier = getCastleHpTier(hpPercent);
  if (tier === 1) return; // 100-75%: mostly intact, no overlay needed.

  // Cracks across the central wall — present from tier 2 (75-50%) onward,
  // getting darker/more numerous as HP drops.
  ctx.save();
  ctx.strokeStyle = "rgba(10,8,6,0.55)";
  ctx.lineWidth = 1;
  const crackSets: readonly (readonly [number, number, number, number][])[] = [
    [[-10, -20, -6, 4]],
    [
      [-10, -20, -6, 4],
      [8, -24, 14, -4],
    ],
    [
      [-10, -20, -6, 4],
      [8, -24, 14, -4],
      [-2, -30, 2, -8],
      [-30, -6, -18, 6],
    ],
  ];
  const crackTier = Math.min(tier - 2, crackSets.length - 1);
  if (crackTier >= 0) {
    for (const [x1, y1, x2, y2] of crackSets[crackTier]!) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo((x1 + x2) / 2 + 2, (y1 + y2) / 2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (tier === 2) return;

  // Tier 3+ (50-25% and below): a broken chunk out of the left flanking
  // tower plus a real smoke plume — "partes quebradas" from the spec.
  ctx.save();
  ctx.fillStyle = "rgba(6,5,4,0.9)";
  ctx.beginPath();
  ctx.moveTo(-46, -30);
  ctx.lineTo(-38, -38);
  ctx.lineTo(-30, -28);
  ctx.lineTo(-36, -20);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < (tier >= 4 ? 4 : 2); i++) {
    const cycle = (timeMs / 2400 + i * 0.4) % 1;
    const smokeX = -38 + Math.sin(timeMs / 900 + i) * 5 + cycle * 4;
    const smokeY = -42 - cycle * 30;
    ctx.globalAlpha = (1 - cycle) * 0.4;
    ctx.fillStyle = tier >= 4 ? "rgba(60,20,14,1)" : "rgba(90,86,80,1)";
    ctx.beginPath();
    ctx.arc(smokeX, smokeY, 4 + cycle * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (tier === 3) return;

  // Tier 4 (25-1%): critical — real flames and embers from the broken tower
  // and the keep, plus more debris (no flat tinted overlay).
  drawFire(ctx, -38, -24, timeMs, 1.1, 5);
  drawEmbers(ctx, -38, -28, timeMs, 10, 7);
  drawFire(ctx, 4, -52, timeMs, 0.8, 23);
  drawSmokeColumn(ctx, 4, -58, timeMs, 1, 17);
  ctx.save();
  ctx.fillStyle = "rgba(20,16,12,0.85)";
  ctx.beginPath();
  ctx.moveTo(30, -6);
  ctx.lineTo(38, -12);
  ctx.lineTo(44, -4);
  ctx.lineTo(36, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (tier < 5) return;

  // Tier 5 (0%): destruction — a heavy smoke column, everything dimmed
  // toward embers. The engine hands off to the existing defeat overlay the
  // instant baseHp hits 0, so this state is only ever visible for at most
  // one render frame — still implemented for correctness/completeness.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#0a0806";
  ctx.beginPath();
  ctx.ellipse(0, -20, 70, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
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
/** Build platform footprint (matches the baked ground's platforms): towers draw their own base centred ~4.5 units below the slot point, in a slightly oblique view. */
const SLOT_BASE_OFFSET_Y = 4.5;
const SLOT_BASE_RX = 21;
const SLOT_BASE_RY = 13;

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  slot: TowerSlotDefinition,
  index: number,
  occupied: boolean,
  highlighted: boolean,
  biome: BiomeDefinition,
  timeMs: number,
  /** True when the platform is already painted into the biome's baked ground (only the highlight ring is drawn live). */
  platformBaked = false,
): void {
  const style = styleForSlot(index);
  ctx.save();
  ctx.translate(slot.position.x, slot.position.y);

  if (!platformBaked) {
    // Same footprint as the baked platforms: an oblique ellipse centred just
    // below the slot point, right under where every tower draws its base.
    ctx.save();
    ctx.translate(0, SLOT_BASE_OFFSET_Y);
    ctx.scale(SLOT_BASE_RX / PLATFORM_RADIUS, SLOT_BASE_RY / PLATFORM_RADIUS);
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
    ctx.restore();
  }

  if (!occupied && highlighted) {
    ctx.strokeStyle = "rgba(255,210,87,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(0, SLOT_BASE_OFFSET_Y, SLOT_BASE_RX + 4, SLOT_BASE_RY + 3, 0, 0, Math.PI * 2);
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

/**
 * 10-biome expansion — DEEP_FOG (Fortaleza Abissal) gets bigger, darker,
 * slower-rolling blobs instead of the original 3-blob drift; every other
 * atmosphere (the 5 original values + the other 9 new ones) keeps the exact
 * original fog formula unchanged, since fog itself is a background-wash
 * effect that doesn't need per-atmosphere variety the way foreground
 * particles do (see drawAmbientParticles below for the real per-biome
 * distinction).
 */
export function drawFog(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  const deep = biome.atmosphere === "DEEP_FOG";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const t = timeMs / (deep ? 34000 : 22000) + i * 3.1;
    const x = (Math.sin(t) * 0.5 + 0.5) * WORLD_SIZE.width;
    const y = 100 + i * 170 + Math.cos(t * 0.7) * 40;
    const radius = deep ? 340 : 240;
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

interface MoteFrame {
  x: number;
  y: number;
  alpha: number;
  size: number;
  /** True to draw a short streak (a line, for wind/spray) instead of a dot. */
  streak?: boolean;
}

type MoteSeed = (typeof ambientMoteSeeds)[number];

/** The ORIGINAL, unmodified formula — every one of the 5 original AtmosphereKind values (and any future one not listed in ATMOSPHERE_MOTION below) still resolves here, so the 6 existing biomes render byte-for-byte as before. */
function defaultMoteFrame(mote: MoteSeed, timeMs: number): MoteFrame {
  const y = (mote.baseY - (timeMs / 1000) * mote.speed) % WORLD_SIZE.height;
  const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
  const x = mote.baseX + Math.sin(timeMs / 2000 + mote.phase) * 12;
  const alpha = 0.18 + 0.18 * Math.sin(timeMs / 1500 + mote.phase * 2);
  return { x, y: wrappedY, alpha: Math.max(alpha, 0.05), size: 1.4 };
}

/** Downward drift with side-to-side sway — shared shape for snow-like/ash-like/dust-like "falling" atmospheres. */
function fallingMoteFrame(mote: MoteSeed, timeMs: number, swayPx: number, alphaBase: number, alphaAmp: number, size: number): MoteFrame {
  const y = (mote.baseY + (timeMs / 1000) * mote.speed) % WORLD_SIZE.height;
  const x = mote.baseX + Math.sin(timeMs / 1800 + mote.phase) * swayPx;
  const alpha = alphaBase + alphaAmp * Math.sin(timeMs / 1200 + mote.phase * 1.7);
  return { x, y, alpha: Math.max(alpha, 0.03), size };
}

/**
 * 10-biome expansion — ONE genuinely distinct motion per new atmosphere,
 * built from the SAME fixed mote-seed array (still AMBIENT_MOTE_COUNT=22,
 * still zero per-frame allocation) — reads as a different weather/particle
 * identity per biome instead of the same recolored mote for everything.
 */
const ATMOSPHERE_MOTION: Partial<Record<AtmosphereKind, (mote: MoteSeed, timeMs: number) => MoteFrame>> = {
  // CIDADE SUBTERRÂNEA — rising steam puffs from forges, with the occasional
  // brighter spark riding on top (every 7th mote reads as a spark instead).
  STEAM: (mote, timeMs) => {
    const y = (mote.baseY - (timeMs / 1000) * (mote.speed * 1.4)) % WORLD_SIZE.height;
    const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
    const x = mote.baseX + Math.sin(timeMs / 900 + mote.phase) * 6;
    const isSpark = mote.phase % 7 === 0;
    const alpha = isSpark ? 0.35 + 0.35 * Math.sin(timeMs / 300 + mote.phase) : 0.12 + 0.14 * Math.sin(timeMs / 2200 + mote.phase);
    return { x, y: wrappedY, alpha: Math.max(alpha, 0.04), size: isSpark ? 1 : 2.6 };
  },
  // CEMITÉRIO DOS COLOSSOS — heavy, slow-settling bone dust; barely drifts.
  SETTLING_DUST: (mote, timeMs) => fallingMoteFrame(mote, timeMs * 0.35, 5, 0.08, 0.06, 1.6),
  // ILHAS FLUTUANTES — fast diagonal wind streaks (drawn as short lines, not dots).
  HIGH_WIND: (mote, timeMs) => {
    const t = timeMs / 1000;
    const x = (mote.baseX + t * (mote.speed * 9)) % WORLD_SIZE.width;
    const y = (mote.baseY + t * (mote.speed * 3)) % WORLD_SIZE.height;
    return { x, y, alpha: 0.14 + 0.1 * Math.sin(timeMs / 900 + mote.phase), size: 10, streak: true };
  },
  // TEMPLO SOLAR PERDIDO — slow-falling motes lit warm, catching light.
  SUNDUST: (mote, timeMs) => fallingMoteFrame(mote, timeMs, 10, 0.1, 0.16, 1.3),
  // MAR DE CRISTAL — near-static twinkling facets; brief flash-alpha spikes.
  MINERAL_GLINT: (mote, timeMs) => {
    const flash = Math.pow(Math.max(0, Math.sin(timeMs / 700 + mote.phase * 2.3)), 6);
    return { x: mote.baseX, y: mote.baseY, alpha: 0.08 + flash * 0.7, size: 1.1 + flash * 1.4 };
  },
  // FORTALEZA ABISSAL — sparse, dim motes (the real atmosphere work here is drawFog's DEEP_FOG branch).
  DEEP_FOG: (mote, timeMs) => ({
    x: mote.baseX + Math.sin(timeMs / 3000 + mote.phase) * 8,
    y: (mote.baseY - (timeMs / 1000) * (mote.speed * 0.3)) % WORLD_SIZE.height,
    alpha: 0.06 + 0.05 * Math.sin(timeMs / 2600 + mote.phase),
    size: 1.2,
  }),
  // VALE DAS CINZAS MORTAS — irregular gray ash flakes falling, more sway than snow.
  ASH: (mote, timeMs) => fallingMoteFrame(mote, timeMs, 16, 0.12, 0.1, 1.8),
  // JARDINS DA LUA — gentle upward-floating luminous motes, slow strong pulse.
  LUMINOUS_SPORES: (mote, timeMs) => {
    const y = (mote.baseY - (timeMs / 1000) * (mote.speed * 0.5)) % WORLD_SIZE.height;
    const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
    const x = mote.baseX + Math.sin(timeMs / 2400 + mote.phase) * 14;
    const alpha = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(timeMs / 1100 + mote.phase * 1.3));
    return { x, y: wrappedY, alpha, size: 1.6 };
  },
  // CATEDRAL PROFANADA — thin upward smoke wisps swaying through broken light shafts.
  INCENSE_SMOKE: (mote, timeMs) => {
    const y = (mote.baseY - (timeMs / 1000) * (mote.speed * 0.8)) % WORLD_SIZE.height;
    const wrappedY = y < 0 ? y + WORLD_SIZE.height : y;
    const x = mote.baseX + Math.sin(timeMs / 1500 + mote.phase) * 20;
    return { x, y: wrappedY, alpha: 0.1 + 0.08 * Math.sin(timeMs / 1900 + mote.phase), size: 2.2 };
  },
  // PENÍNSULA DOS LEVIATÃS — parabolic spray arcs (up then down) instead of a straight drift.
  SEA_SPRAY: (mote, timeMs) => {
    const cycle = ((timeMs / 1000) * (mote.speed * 0.6) + mote.phase * 13) % 100;
    const arcT = cycle / 100;
    const x = mote.baseX + arcT * 40 - 20;
    const y = mote.baseY - Math.sin(arcT * Math.PI) * 30;
    const alpha = 0.12 + 0.22 * Math.sin(arcT * Math.PI);
    return { x, y, alpha: Math.max(alpha, 0.03), size: 1.5 };
  },
};

export function drawAmbientParticles(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number): void {
  const motion = ATMOSPHERE_MOTION[biome.atmosphere] ?? defaultMoteFrame;
  ctx.save();
  for (const mote of ambientMoteSeeds) {
    const frame = motion(mote, timeMs);
    ctx.fillStyle = hexToRgba(biome.palette.vegetationHighlight, frame.alpha);
    if (frame.streak) {
      ctx.strokeStyle = hexToRgba(biome.palette.vegetationHighlight, frame.alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(frame.x - frame.size, frame.y - frame.size * 0.35);
      ctx.lineTo(frame.x, frame.y);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.arc(frame.x, frame.y, frame.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
