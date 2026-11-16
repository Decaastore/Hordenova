import * as THREE from "three";
import { WORLD_SIZE, PATH_VISUAL_WIDTH } from "@/config/gameBalance";
import { distanceToPolyline, type Vector2 } from "@/utils/geometry";
import { fbmNoise2D } from "@/lab3d/noise";
import type { BiomeDefinition } from "@/rendering/biomes/types";
import { TERRAIN_DEPTH, TERRAIN_MARGIN_X, TERRAIN_MARGIN_Z, TERRAIN_WIDTH } from "./coords";

/**
 * CAMPO DE BATALHA 3D — the ground: one height-mapped mesh covering the
 * playable rectangle plus a margin, with the road carved in and the tower
 * pads levelled. Everything is derived from the same ENEMY_PATH / slot
 * positions the gameplay uses, so the road the creatures walk is exactly the
 * road that is drawn.
 *
 * The surface colour is painted once into a canvas (ground variation, the
 * worn road, ruts, leaf litter); fine detail comes from a tiled bump map so
 * it stays crisp up close. Real photo-scanned textures can replace both
 * later without touching the shape.
 */

const SEG = 4; // world units between height samples
export const GRID_X = Math.round(TERRAIN_WIDTH / SEG) + 1;
export const GRID_Z = Math.round(TERRAIN_DEPTH / SEG) + 1;

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  albedo: THREE.CanvasTexture;
  detail: THREE.CanvasTexture;
  /** Ground height at a world (x, y) point. */
  heightAt: (p: Vector2) => number;
  /** Distance from the road's centre line, world units. */
  roadDistance: (p: Vector2) => number;
}

const ROAD_HALF = PATH_VISUAL_WIDTH / 2 + 4;
const PAD_RADIUS = 26;

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildTerrain(biome: BiomeDefinition, path: readonly Vector2[], pads: readonly Vector2[], castle: Vector2): TerrainData {
  const W = WORLD_SIZE.width;
  const H = WORLD_SIZE.height;
  const x0 = -TERRAIN_MARGIN_X;
  const y0 = -TERRAIN_MARGIN_Z;

  // ---- distance-to-road field on the height grid (bilinear lookups elsewhere)
  const dist = new Float32Array(GRID_X * GRID_Z);
  for (let j = 0; j < GRID_Z; j++)
    for (let i = 0; i < GRID_X; i++) dist[j * GRID_X + i] = distanceToPolyline({ x: x0 + i * SEG, y: y0 + j * SEG }, path);
  const sampleGrid = (field: Float32Array, p: Vector2): number => {
    const fx = Math.min(GRID_X - 1.001, Math.max(0, (p.x - x0) / SEG));
    const fz = Math.min(GRID_Z - 1.001, Math.max(0, (p.y - y0) / SEG));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = field[j * GRID_X + i]!;
    const b = field[j * GRID_X + i + 1]!;
    const c = field[(j + 1) * GRID_X + i]!;
    const d = field[(j + 1) * GRID_X + i + 1]!;
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  };
  const roadDistance = (p: Vector2) => sampleGrid(dist, p);

  // ---- heights
  const rawHeight = (x: number, y: number, d: number): number => {
    let h = (fbmNoise2D(x * 0.012 + 3.1, y * 0.012 + 7.7, 4) - 0.5) * 9;
    h += (fbmNoise2D(x * 0.05, y * 0.05, 3) - 0.5) * 2.2;
    // the world's edge rises into wooded slopes so the play area reads as a clearing
    const out = Math.max(-x, x - W, -y, y - H, 0);
    h += smooth(0, 220, out) * 46 + smooth(-60, 40, out) * 6;
    // the road is worn into the ground
    const road = 1 - smooth(ROAD_HALF - 6, ROAD_HALF + 14, d);
    h = h * (1 - road) + (-1.4 + (fbmNoise2D(x * 0.08, y * 0.08, 2) - 0.5) * 0.6) * road;
    // tower pads and the castle sit on level ground
    for (const pad of pads) {
      const k = 1 - smooth(PAD_RADIUS - 4, PAD_RADIUS + 18, Math.hypot(x - pad.x, y - pad.y));
      if (k > 0) h = h * (1 - k) + 0.6 * k;
    }
    const kc = 1 - smooth(70, 130, Math.hypot(x - castle.x, y - castle.y));
    if (kc > 0) h = h * (1 - kc) + 0.4 * kc;
    return h;
  };
  const heights = new Float32Array(GRID_X * GRID_Z);
  for (let j = 0; j < GRID_Z; j++)
    for (let i = 0; i < GRID_X; i++) heights[j * GRID_X + i] = rawHeight(x0 + i * SEG, y0 + j * SEG, dist[j * GRID_X + i]!);
  const heightAt = (p: Vector2) => sampleGrid(heights, p);

  // ---- mesh
  const geometry = new THREE.PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH, GRID_X - 1, GRID_Z - 1);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const i = k % GRID_X;
    const j = Math.floor(k / GRID_X);
    pos.setY(k, heights[j * GRID_X + i]!);
  }
  geometry.translate(TERRAIN_WIDTH / 2 - TERRAIN_MARGIN_X - W / 2, 0, TERRAIN_DEPTH / 2 - TERRAIN_MARGIN_Z - H / 2);
  geometry.computeVertexNormals();

  // ---- painted colour
  const P = biome.palette;
  const TEX_W = 2048;
  const TEX_H = Math.round((TEX_W * TERRAIN_DEPTH) / TERRAIN_WIDTH);
  const lowW = TEX_W / 2;
  const lowH = TEX_H / 2;
  const low = document.createElement("canvas");
  low.width = lowW;
  low.height = lowH;
  const lctx = low.getContext("2d")!;
  const img = lctx.createImageData(lowW, lowH);
  const base = hexToRgb(P.groundBase);
  const shade = hexToRgb(P.groundShadowed);
  const accA = hexToRgb(P.groundAccentA);
  const accB = hexToRgb(P.groundAccentB);
  const road = hexToRgb(P.roadFill).map((v) => v * 0.78) as [number, number, number];
  const roadL = hexToRgb(P.roadFillLight).map((v) => v * 0.8) as [number, number, number];
  const roadE = hexToRgb(P.roadEdge);
  const moss = hexToRgb(P.vegetationDark);
  for (let py = 0; py < lowH; py++) {
    for (let px = 0; px < lowW; px++) {
      const wx = x0 + (px / lowW) * TERRAIN_WIDTH;
      const wy = y0 + (py / lowH) * TERRAIN_DEPTH;
      const d = sampleGrid(dist, { x: wx, y: wy });
      const n1 = fbmNoise2D(wx * 0.02, wy * 0.02, 4);
      const n2 = fbmNoise2D(wx * 0.07 + 11, wy * 0.07 + 5, 3);
      const n3 = fbmNoise2D(wx * 0.25 + 2, wy * 0.25 + 9, 2);
      let r = base[0], g = base[1], b = base[2];
      const mixIn = (c: [number, number, number], t: number) => {
        r += (c[0] - r) * t;
        g += (c[1] - g) * t;
        b += (c[2] - b) * t;
      };
      mixIn(shade, smooth(0.35, 0.75, n1) * 0.8);
      mixIn(accA, smooth(0.55, 0.8, n2) * 0.55);
      mixIn(accB, smooth(0.6, 0.85, 1 - n2) * 0.45);
      mixIn(moss, smooth(0.5, 0.9, n3) * 0.25);
      // road: worn dirt with a lighter crown and darker shoulders
      const rk = 1 - smooth(ROAD_HALF - 8 + n2 * 8, ROAD_HALF + 6 + n2 * 8, d);
      if (rk > 0) {
        const crown = 1 - smooth(0, ROAD_HALF * 0.7, d);
        const rc: [number, number, number] = [road[0] + (roadL[0] - road[0]) * crown * n3, road[1] + (roadL[1] - road[1]) * crown * n3, road[2] + (roadL[2] - road[2]) * crown * n3];
        mixIn(rc, rk);
        const shoulder = smooth(ROAD_HALF - 10, ROAD_HALF - 2, d) * (1 - smooth(ROAD_HALF, ROAD_HALF + 8, d));
        mixIn(roadE, shoulder * 0.6);
      }
      const o = (py * lowW + px) * 4;
      const v = 0.82 + n3 * 0.3;
      img.data[o] = Math.min(255, r * v);
      img.data[o + 1] = Math.min(255, g * v);
      img.data[o + 2] = Math.min(255, b * v);
      img.data[o + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(low, 0, 0, TEX_W, TEX_H);
  const sx = TEX_W / TERRAIN_WIDTH;
  const toPx = (p: Vector2) => [(p.x - x0) * sx, (p.y - y0) * sx] as const;

  // wheel/foot ruts along the road
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const off of [-7, 7]) {
    ctx.beginPath();
    path.forEach((p, i) => {
      const nx = i < path.length - 1 ? path[i + 1]!.y - p.y : p.y - path[i - 1]!.y;
      const ny = i < path.length - 1 ? -(path[i + 1]!.x - p.x) : -(p.x - path[i - 1]!.x);
      const l = Math.hypot(nx, ny) || 1;
      const [cx, cy] = toPx({ x: p.x + (nx / l) * off, y: p.y + (ny / l) * off });
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.strokeStyle = `rgba(${roadE[0] * 0.6},${roadE[1] * 0.6},${roadE[2] * 0.6},0.14)`;
    ctx.lineWidth = 3.2 * sx;
    ctx.filter = "blur(2px)";
    ctx.stroke();
    ctx.filter = "none";
  }
  // scattered pebbles on the road, leaf litter and twigs off it
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 9000; k++) {
    const p = { x: x0 + rnd() * TERRAIN_WIDTH, y: y0 + rnd() * TERRAIN_DEPTH };
    const d = sampleGrid(dist, p);
    const [cx, cy] = toPx(p);
    if (d < ROAD_HALF) {
      const s = (0.6 + rnd() * 1.4) * sx;
      ctx.fillStyle = `rgba(${150 + rnd() * 50},${140 + rnd() * 40},${120 + rnd() * 30},${0.35 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s, s * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (rnd() < 0.7) {
      const s = (1 + rnd() * 2.2) * sx;
      const leaf = rnd() < 0.5 ? accA : accB;
      ctx.fillStyle = `rgba(${leaf[0] * 1.2},${leaf[1] * 1.05},${leaf[2] * 0.9},${0.25 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s, s * 0.5, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 8;

  // ---- tiled micro-detail (bump)
  const D = 256;
  const dc = document.createElement("canvas");
  dc.width = dc.height = D;
  const dctx = dc.getContext("2d")!;
  const dimg = dctx.createImageData(D, D);
  for (let y = 0; y < D; y++)
    for (let x = 0; x < D; x++) {
      // tileable: sample noise on a torus
      const a = (x / D) * Math.PI * 2;
      const b2 = (y / D) * Math.PI * 2;
      const v = fbmNoise2D(Math.cos(a) * 3 + Math.sin(b2) * 5 + 10, Math.sin(a) * 3 + Math.cos(b2) * 5 + 10, 5);
      const o = (y * D + x) * 4;
      const c = Math.round(v * 255);
      dimg.data[o] = dimg.data[o + 1] = dimg.data[o + 2] = c;
      dimg.data[o + 3] = 255;
    }
  dctx.putImageData(dimg, 0, 0);
  const detail = new THREE.CanvasTexture(dc);
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  detail.repeat.set(TERRAIN_WIDTH / 28, TERRAIN_DEPTH / 28);

  return { geometry, albedo, detail, heightAt, roadDistance };
}
