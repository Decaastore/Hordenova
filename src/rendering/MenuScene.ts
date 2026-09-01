import { ACTIVE_BIOME } from "./biomes";
import { drawFortress, drawMagicPortal, drawTree } from "./MapRenderer";
import { drawCrawler, drawIronwood } from "./EntityRenderer";
import { TOWER_THEME, ENEMY_THEME, LIGHT_DIRECTION } from "./theme";
import type { Decoration } from "./mapDecorations";

/**
 * The main menu's cinematic backdrop — a purpose-built scene, not the
 * top-down gameplay map reused at a different zoom. It shares the game's
 * art identity (Ancient Forest palette, the same fortress/portal/tower/
 * enemy draw functions) but is composed freely for drama: layered depth,
 * a hazed background fortress, dramatic light, drifting atmosphere. None
 * of this is tied to WORLD_SIZE or the real ENEMY_PATH — it's a fixed
 * virtual canvas the caller fits to the viewport.
 */
export const MENU_SCENE_SIZE = { width: 1600, height: 900 } as const;

export interface Parallax {
  x: number;
  y: number;
}

export function drawMenuScene(ctx: CanvasRenderingContext2D, timeMs: number, parallax: Parallax): void {
  drawSky(ctx);
  drawDistantRidge(ctx, parallax);
  drawGodRays(ctx, timeMs);

  ctx.save();
  ctx.translate(parallax.x * 6, parallax.y * 3);
  drawFortress(ctx, { x: MENU_SCENE_SIZE.width * 0.68, y: MENU_SCENE_SIZE.height * 0.62 }, ACTIVE_BIOME, timeMs, 3.1);
  ctx.restore();
  drawAtmosphericHaze(ctx, MENU_SCENE_SIZE.height * 0.48, 150, "rgba(205,217,190,0.16)");

  drawMidgroundTrees(ctx, parallax);

  ctx.save();
  const portalX = MENU_SCENE_SIZE.width * 0.17 + parallax.x * 14;
  const portalY = MENU_SCENE_SIZE.height * 0.74 + parallax.y * 6;
  ctx.translate(portalX, portalY);
  ctx.scale(1.9, 1.9);
  drawMagicPortal(ctx, { x: 0, y: 0 }, timeMs);
  ctx.restore();

  ctx.save();
  ctx.translate(MENU_SCENE_SIZE.width * 0.3 + parallax.x * 18, MENU_SCENE_SIZE.height * 0.79 + parallax.y * 8);
  ctx.scale(2.3, 2.3);
  drawIronwood(ctx, TOWER_THEME.IRONWOOD, 3, timeMs, Infinity, 0.7);
  ctx.restore();

  ctx.save();
  ctx.translate(MENU_SCENE_SIZE.width * 0.6 + parallax.x * 24, MENU_SCENE_SIZE.height * 0.87 + parallax.y * 10);
  ctx.scale(1.9, 1.9);
  ctx.rotate(-0.35);
  drawCrawler(ctx, ENEMY_THEME.CRAWLER, timeMs, Infinity);
  ctx.restore();

  drawForegroundGround(ctx);
  drawMistBands(ctx, timeMs, parallax);
  drawFallingLeaves(ctx, timeMs);
  drawEmbers(ctx, timeMs);
  drawForegroundFraming(ctx, parallax);
  drawSceneVignette(ctx);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawSky(ctx: CanvasRenderingContext2D): void {
  const { width, height } = MENU_SCENE_SIZE;
  const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.78);
  gradient.addColorStop(0, "#182a1c");
  gradient.addColorStop(0.4, "#2c4326");
  gradient.addColorStop(0.72, "#5f7d3c");
  gradient.addColorStop(1, "#cbb35e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawDistantRidge(ctx: CanvasRenderingContext2D, parallax: Parallax): void {
  const { width, height } = MENU_SCENE_SIZE;
  const bands = [
    { y: height * 0.42, color: "rgba(70,95,60,0.5)", amp: 18, drift: 4 },
    { y: height * 0.5, color: "rgba(38,58,36,0.7)", amp: 24, drift: 8 },
  ];
  for (const band of bands) {
    ctx.save();
    ctx.fillStyle = band.color;
    ctx.beginPath();
    ctx.moveTo(-40, height);
    const bump = 140;
    const offset = parallax.x * band.drift;
    for (let x = -bump; x <= width + bump; x += bump) {
      const h = band.y + Math.sin((x + offset) * 0.01 + band.y) * band.amp;
      ctx.lineTo(x, h);
    }
    ctx.lineTo(width + 40, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawGodRays(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const { height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const originX = MENU_SCENE_SIZE.width * 0.22;
  const originY = -60;
  const angle = Math.atan2(-LIGHT_DIRECTION.y, -LIGHT_DIRECTION.x);
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.15;
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 3000 + i);
    const rayAngle = angle + spread;
    const length = height * 1.3;
    const endX = originX + Math.cos(rayAngle) * length;
    const endY = originY + Math.sin(rayAngle) * length;
    const widthAtEnd = 100 + i * 22;
    const grad = ctx.createLinearGradient(originX, originY, endX, endY);
    grad.addColorStop(0, `rgba(255,238,190,${0.1 + 0.05 * pulse})`);
    grad.addColorStop(1, "rgba(255,238,190,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(originX - 6, originY);
    ctx.lineTo(originX + 6, originY);
    ctx.lineTo(endX + widthAtEnd / 2, endY);
    ctx.lineTo(endX - widthAtEnd / 2, endY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawAtmosphericHaze(ctx: CanvasRenderingContext2D, centerY: number, thickness: number, color: string): void {
  const { width } = MENU_SCENE_SIZE;
  const grad = ctx.createLinearGradient(0, centerY - thickness, 0, centerY + thickness);
  grad.addColorStop(0, "rgba(205,217,190,0)");
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, "rgba(205,217,190,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, centerY - thickness, width, thickness * 2);
}

const MIDGROUND_TREES = [
  { x: -30, y: 0.72, scale: 5.6, depth: 10, variant: 2 },
  { x: 100, y: 0.63, scale: 3.8, depth: 15, variant: 1 },
  { x: MENU_SCENE_SIZE.width + 30, y: 0.7, scale: 5.9, depth: 10, variant: 2 },
  { x: MENU_SCENE_SIZE.width - 120, y: 0.61, scale: 4, depth: 15, variant: 1 },
] as const;

function drawMidgroundTrees(ctx: CanvasRenderingContext2D, parallax: Parallax): void {
  for (const tree of MIDGROUND_TREES) {
    ctx.save();
    ctx.translate(tree.x + parallax.x * tree.depth, MENU_SCENE_SIZE.height * tree.y + parallax.y * tree.depth * 0.4);
    ctx.scale(tree.scale, tree.scale);
    const deco: Decoration = { kind: "TREE", position: { x: 0, y: 0 }, scale: 1, rotation: 0, variant: tree.variant };
    drawTree(ctx, deco, ACTIVE_BIOME);
    ctx.restore();
  }
}

function drawForegroundGround(ctx: CanvasRenderingContext2D): void {
  const { width, height } = MENU_SCENE_SIZE;
  const groundY = height * 0.86;
  const grad = ctx.createLinearGradient(0, groundY, 0, height);
  grad.addColorStop(0, "rgba(20,17,11,0)");
  grad.addColorStop(0.35, ACTIVE_BIOME.palette.groundShadowed);
  grad.addColorStop(1, "#0c0a06");
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, width, height - groundY);

  ctx.save();
  ctx.globalAlpha = 0.55;
  const pathGrad = ctx.createLinearGradient(width * 0.5, height, width * 0.17, height * 0.78);
  pathGrad.addColorStop(0, ACTIVE_BIOME.palette.roadFillLight);
  pathGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = pathGrad;
  ctx.lineWidth = 74;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.52, height + 50);
  ctx.quadraticCurveTo(width * 0.34, height * 0.93, width * 0.19, height * 0.79);
  ctx.stroke();
  ctx.restore();
}

const MIST_BANDS = [
  { y: 0.55, speed: 6, alpha: 0.11 },
  { y: 0.68, speed: -9, alpha: 0.15 },
  { y: 0.81, speed: 4, alpha: 0.09 },
] as const;

function drawMistBands(ctx: CanvasRenderingContext2D, timeMs: number, parallax: Parallax): void {
  const { width, height } = MENU_SCENE_SIZE;
  const span = width + 400;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const band of MIST_BANDS) {
    const rawX = ((timeMs / 1000) * band.speed) % span;
    const x1 = (rawX < 0 ? rawX + span : rawX) - 200 + parallax.x * 10;
    const x2 = x1 - span * Math.sign(band.speed || 1);
    const y = height * band.y + parallax.y * 4;
    for (const x of [x1, x2]) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 320);
      grad.addColorStop(0, `rgba(210,220,195,${band.alpha})`);
      grad.addColorStop(1, "rgba(210,220,195,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 320, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const LEAF_SEEDS = Array.from({ length: 14 }, (_, i) => ({
  baseX: (i * 173) % MENU_SCENE_SIZE.width,
  baseY: (i * 97) % MENU_SCENE_SIZE.height,
  speed: 10 + (i % 5) * 4,
  drift: 8 + (i % 3) * 6,
  phase: i,
  size: 2 + (i % 3),
}));

function drawFallingLeaves(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const { height } = MENU_SCENE_SIZE;
  const colors = [ACTIVE_BIOME.palette.vegetationPrimary, ACTIVE_BIOME.palette.vegetationSecondary, ACTIVE_BIOME.palette.accentWarm];
  ctx.save();
  for (const leaf of LEAF_SEEDS) {
    const y = ((leaf.baseY + (timeMs / 1000) * leaf.speed) % (height + 40)) - 20;
    const x = leaf.baseX + Math.sin(timeMs / 1400 + leaf.phase) * leaf.drift;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(timeMs / 600 + leaf.phase);
    ctx.fillStyle = colors[leaf.phase % colors.length]!;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

const EMBER_SEEDS = Array.from({ length: 18 }, (_, i) => ({
  baseX: (i * 211) % MENU_SCENE_SIZE.width,
  baseY: (i * 151 + 60) % MENU_SCENE_SIZE.height,
  speed: 5 + (i % 4),
  phase: i,
}));

function drawEmbers(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const { height } = MENU_SCENE_SIZE;
  ctx.save();
  for (const mote of EMBER_SEEDS) {
    const y = (mote.baseY - (timeMs / 1000) * mote.speed) % height;
    const wrappedY = y < 0 ? y + height : y;
    const x = mote.baseX + Math.sin(timeMs / 1800 + mote.phase) * 14;
    const alpha = 0.2 + 0.25 * Math.sin(timeMs / 1300 + mote.phase * 2);
    ctx.fillStyle = hexToRgba(ACTIVE_BIOME.palette.accentWarm, Math.max(alpha, 0.06));
    ctx.beginPath();
    ctx.arc(x, wrappedY, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawForegroundFraming(ctx: CanvasRenderingContext2D, parallax: Parallax): void {
  const { width, height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.fillStyle = ACTIVE_BIOME.palette.vegetationDark;
  ctx.globalAlpha = 0.92;

  ctx.beginPath();
  ctx.moveTo(-20 + parallax.x * 20, height + 20);
  ctx.quadraticCurveTo(60, height * 0.78, 230, height * 0.7);
  ctx.quadraticCurveTo(140, height * 0.9, 40, height + 20);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(width + 20 + parallax.x * 20, height + 20);
  ctx.quadraticCurveTo(width - 60, height * 0.76, width - 210, height * 0.68);
  ctx.quadraticCurveTo(width - 120, height * 0.9, width - 40, height + 20);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSceneVignette(ctx: CanvasRenderingContext2D): void {
  const { width, height } = MENU_SCENE_SIZE;
  const grad = ctx.createRadialGradient(width / 2, height * 0.42, height * 0.22, width / 2, height * 0.42, height * 0.92);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(5,6,3,0.58)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
