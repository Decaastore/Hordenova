import type { Vector2 } from "@/utils/geometry";
import { ACTIVE_BIOME } from "./biomes";
import { drawFortress, drawMagicPortal, drawTree } from "./MapRenderer";
import { drawCrawler, drawIronwood } from "./EntityRenderer";
import { TOWER_THEME, ENEMY_THEME, LIGHT_DIRECTION } from "./theme";
import type { Decoration } from "./mapDecorations";

/**
 * The main menu's cinematic backdrop — a purpose-built scene sharing the
 * game's own draw functions (fortress, portal, tower, enemy) but composed
 * freely for drama, plus a layer of constant ambient motion (fire, smoke,
 * mist, banners, sway) and occasional randomized "moments" (a light
 * sweep, a wind gust, a distant burst, a creature dashing past, the
 * portal surging, a flame flaring, motes pulled inward) so the scene
 * reads as alive without ever needing the viewer to do anything.
 *
 * Nothing here is tied to WORLD_SIZE or the real ENEMY_PATH — the caller
 * fits this fixed virtual canvas to the viewport (see MenuBackground.tsx).
 */
export const MENU_SCENE_SIZE = { width: 1600, height: 900 } as const;

export interface Parallax {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Scene state — smoke puffs, ambient magic motes, the rare background
// creature, and the randomized-event scheduler. Owned by the caller
// (one instance per mounted <MenuBackground>) and passed in each frame;
// nothing here is module-level so remounting the menu starts fresh.
// ---------------------------------------------------------------------------

type SceneEventType =
  | "LIGHT_SWEEP"
  | "WIND_GUST"
  | "DISTANT_BURST"
  | "CREATURE_DASH"
  | "PORTAL_SURGE"
  | "FLAME_FLARE"
  | "MAGIC_PULL";

interface SceneEvent {
  type: SceneEventType;
  startTime: number;
  duration: number;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  startTime: number;
  life: number;
  size: number;
}

interface Mote {
  baseX: number;
  baseY: number;
  speed: number;
  phase: number;
  pullPhase: number;
}

export interface SceneState {
  nextEventTime: number;
  activeEvents: SceneEvent[];
  smoke: SmokePuff[];
  motes: Mote[];
  birdFromLeft: boolean;
  /** 0 = no transition; ramps 0→1 while the click-to-play sequence plays. */
  transitionProgress: number;
}

const MOTE_COUNT = 16;

export function createSceneState(startTime: number): SceneState {
  return {
    // First event fairly soon so the scene doesn't feel dead on load.
    nextEventTime: startTime + 2200 + Math.random() * 1800,
    activeEvents: [],
    smoke: [],
    motes: Array.from({ length: MOTE_COUNT }, (_, i) => ({
      baseX: (i * 233) % MENU_SCENE_SIZE.width,
      baseY: (i * 179 + 80) % MENU_SCENE_SIZE.height,
      speed: 4 + (i % 5),
      phase: i,
      pullPhase: (i % 4) * 0.15,
    })),
    birdFromLeft: Math.random() < 0.5,
    transitionProgress: 0,
  };
}

const EVENT_TYPES: readonly SceneEventType[] = [
  "LIGHT_SWEEP",
  "WIND_GUST",
  "DISTANT_BURST",
  "CREATURE_DASH",
  "PORTAL_SURGE",
  "FLAME_FLARE",
  "MAGIC_PULL",
];

const EVENT_DURATIONS: Record<SceneEventType, [number, number]> = {
  LIGHT_SWEEP: [1900, 2600],
  WIND_GUST: [2600, 4200],
  DISTANT_BURST: [900, 1300],
  CREATURE_DASH: [2400, 2400],
  PORTAL_SURGE: [2200, 3200],
  FLAME_FLARE: [1300, 2000],
  MAGIC_PULL: [2600, 3600],
};

function updateSceneEvents(state: SceneState, timeMs: number): void {
  state.activeEvents = state.activeEvents.filter((e) => timeMs - e.startTime < e.duration);
  if (timeMs >= state.nextEventTime && state.activeEvents.length < 2) {
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]!;
    const [minD, maxD] = EVENT_DURATIONS[type];
    const duration = minD + Math.random() * (maxD - minD);
    state.activeEvents.push({ type, startTime: timeMs, duration });
    if (type === "CREATURE_DASH") state.birdFromLeft = Math.random() < 0.5;
    // Variable spacing (5-13s) so the scene never settles into a visible rhythm.
    state.nextEventTime = timeMs + 5000 + Math.random() * 8000;
  }
}

/** 0→1→0 smooth envelope for however far through its window an event is; 0 if inactive. */
function eventIntensity(state: SceneState, type: SceneEventType, timeMs: number): number {
  const ev = state.activeEvents.find((e) => e.type === type);
  if (!ev) return 0;
  const t = Math.min(1, Math.max(0, (timeMs - ev.startTime) / ev.duration));
  return Math.sin(t * Math.PI);
}

// ---------------------------------------------------------------------------
// Orchestrator.
// ---------------------------------------------------------------------------

const FORTRESS_POS = { x: MENU_SCENE_SIZE.width * 0.68, y: MENU_SCENE_SIZE.height * 0.62 };
const FORTRESS_SCALE = 3.1;
const PORTAL_POS = { x: MENU_SCENE_SIZE.width * 0.17, y: MENU_SCENE_SIZE.height * 0.74 };
const PORTAL_SCALE = 1.9;

export function drawMenuScene(
  ctx: CanvasRenderingContext2D,
  timeMs: number,
  dtMs: number,
  parallax: Parallax,
  pointerScene: Vector2 | null,
  state: SceneState,
): void {
  updateSceneEvents(state, timeMs);

  const windGust = eventIntensity(state, "WIND_GUST", timeMs);
  const lightSweep = eventIntensity(state, "LIGHT_SWEEP", timeMs);
  const distantBurst = eventIntensity(state, "DISTANT_BURST", timeMs);
  const flameFlare = eventIntensity(state, "FLAME_FLARE", timeMs);
  const magicPull = Math.max(eventIntensity(state, "MAGIC_PULL", timeMs), state.transitionProgress);
  const portalEventBoost = eventIntensity(state, "PORTAL_SURGE", timeMs);

  const portalScenePos = {
    x: PORTAL_POS.x + parallax.x * 14,
    y: PORTAL_POS.y + parallax.y * 6,
  };
  const pointerPortalDist = pointerScene ? Math.hypot(pointerScene.x - portalScenePos.x, pointerScene.y - portalScenePos.y) : Infinity;
  const pointerPortalBoost = Math.max(0, 1 - pointerPortalDist / 260) * 0.4;
  const portalBoost = Math.min(1.6, portalEventBoost * 0.9 + pointerPortalBoost + state.transitionProgress * 1.4);

  drawSky(ctx);
  drawDistantRidge(ctx, parallax);
  drawDistantBurst(ctx, distantBurst);
  drawGodRays(ctx, timeMs, lightSweep);

  ctx.save();
  ctx.translate(parallax.x * 6, parallax.y * 3);
  const fortressAnchors = drawFortress(ctx, FORTRESS_POS, ACTIVE_BIOME, timeMs, FORTRESS_SCALE, windGust);
  ctx.restore();
  drawAtmosphericHaze(ctx, MENU_SCENE_SIZE.height * 0.48, 150, "rgba(205,217,190,0.16)");

  const torchScenePoints: Vector2[] = fortressAnchors.torches.map((pt) => ({
    x: FORTRESS_POS.x + parallax.x * 6 + pt.x * FORTRESS_SCALE,
    y: FORTRESS_POS.y + parallax.y * 3 + pt.y * FORTRESS_SCALE,
  }));
  updateSmoke(state, timeMs, dtMs, torchScenePoints);
  drawSmoke(ctx, state, timeMs);
  if (flameFlare > 0) drawFlameFlare(ctx, torchScenePoints, flameFlare);

  drawMidgroundTrees(ctx, parallax, timeMs, windGust);

  ctx.save();
  ctx.translate(portalScenePos.x, portalScenePos.y);
  ctx.scale(PORTAL_SCALE, PORTAL_SCALE);
  drawMagicPortal(ctx, { x: 0, y: 0 }, timeMs, portalBoost);
  ctx.restore();

  ctx.save();
  const ironwoodReadiness = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(timeMs / 2600));
  const ironwoodCycle = (timeMs / 4400) % 1;
  const ironwoodAttackFlash = ironwoodCycle < 0.06 ? ironwoodCycle * (4400 * 0.06) : Infinity;
  ctx.translate(MENU_SCENE_SIZE.width * 0.3 + parallax.x * 18, MENU_SCENE_SIZE.height * 0.79 + parallax.y * 8);
  ctx.scale(2.3, 2.3);
  drawIronwood(ctx, TOWER_THEME.IRONWOOD, 3, timeMs, ironwoodAttackFlash, ironwoodReadiness);
  ctx.restore();

  ctx.save();
  const crawlerLungePhase = (timeMs / 3600) % 1;
  const lunge = crawlerLungePhase < 0.18 ? Math.sin((crawlerLungePhase / 0.18) * Math.PI) : 0;
  const crawlerIntensity = 1 + lunge * 1.6;
  ctx.translate(
    MENU_SCENE_SIZE.width * 0.6 + parallax.x * 24 + lunge * 6,
    MENU_SCENE_SIZE.height * 0.87 + parallax.y * 10,
  );
  ctx.scale(1.9, 1.9);
  ctx.rotate(-0.35);
  drawCrawler(ctx, ENEMY_THEME.CRAWLER, timeMs, Infinity, crawlerIntensity);
  ctx.restore();

  drawForegroundGround(ctx);
  drawBird(ctx, state, timeMs);
  drawMistBands(ctx, timeMs, parallax);
  drawFallingLeaves(ctx, timeMs, windGust);
  drawEmbers(ctx, timeMs);
  drawMotes(ctx, state, timeMs, portalScenePos, magicPull, pointerScene);
  drawForegroundFraming(ctx, parallax);
  drawSceneVignette(ctx);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const parse = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ra, ga, ba] = parse(hexA);
  const [rb, gb, bb] = parse(hexB);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(ra, rb)},${mix(ga, gb)},${mix(ba, bb)})`;
}

// ---------------------------------------------------------------------------
// Sky / ridge / god rays / distant burst.
// ---------------------------------------------------------------------------

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

const DISTANT_BURST_POS = { x: MENU_SCENE_SIZE.width * 0.86, y: MENU_SCENE_SIZE.height * 0.36 };

/** An occasional flash on the horizon — a magical detonation happening somewhere else in the world. */
function drawDistantBurst(ctx: CanvasRenderingContext2D, intensity: number): void {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const radius = 40 + intensity * 90;
  const glow = ctx.createRadialGradient(DISTANT_BURST_POS.x, DISTANT_BURST_POS.y, 0, DISTANT_BURST_POS.x, DISTANT_BURST_POS.y, radius);
  glow.addColorStop(0, `rgba(230,200,255,${0.5 * intensity})`);
  glow.addColorStop(0.4, `rgba(180,110,240,${0.3 * intensity})`);
  glow.addColorStop(1, "rgba(180,110,240,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(DISTANT_BURST_POS.x, DISTANT_BURST_POS.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGodRays(ctx: CanvasRenderingContext2D, timeMs: number, sweep: number): void {
  const { height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const originX = MENU_SCENE_SIZE.width * 0.22;
  const originY = -60;
  const baseAngle = Math.atan2(-LIGHT_DIRECTION.y, -LIGHT_DIRECTION.x);
  const rayCount = sweep > 0 ? 5 : 4;
  for (let i = 0; i < rayCount; i++) {
    const isSweepRay = sweep > 0 && i === rayCount - 1;
    const spread = isSweepRay ? -0.5 + sweep * 1.3 : (i - 1.5) * 0.15;
    const pulse = isSweepRay ? sweep : 0.5 + 0.5 * Math.sin(timeMs / 3000 + i);
    const rayAngle = baseAngle + spread;
    const length = height * 1.3;
    const endX = originX + Math.cos(rayAngle) * length;
    const endY = originY + Math.sin(rayAngle) * length;
    const widthAtEnd = isSweepRay ? 150 : 100 + i * 22;
    const alpha = isSweepRay ? 0.22 * sweep : 0.1 + 0.05 * pulse;
    const grad = ctx.createLinearGradient(originX, originY, endX, endY);
    grad.addColorStop(0, `rgba(255,238,190,${alpha})`);
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

// ---------------------------------------------------------------------------
// Smoke rising from the fortress's torches.
// ---------------------------------------------------------------------------

function updateSmoke(state: SceneState, timeMs: number, dtMs: number, anchors: readonly Vector2[]): void {
  for (const anchor of anchors) {
    if (Math.random() < dtMs * 0.00055) {
      state.smoke.push({
        x: anchor.x,
        y: anchor.y,
        vx: (Math.random() - 0.5) * 5,
        startTime: timeMs,
        life: 3200 + Math.random() * 1600,
        size: 3 + Math.random() * 2.5,
      });
    }
  }
  state.smoke = state.smoke.filter((s) => timeMs - s.startTime < s.life);
  if (state.smoke.length > 36) state.smoke.splice(0, state.smoke.length - 36);
}

function drawSmoke(ctx: CanvasRenderingContext2D, state: SceneState, timeMs: number): void {
  ctx.save();
  for (const s of state.smoke) {
    const t = (timeMs - s.startTime) / s.life;
    const y = s.y - t * 50;
    const x = s.x + s.vx * t * 10 + Math.sin(timeMs / 900 + s.startTime) * 4 * t;
    const alpha = (1 - t) * 0.26;
    const r = s.size + t * 11;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(205,203,196,${alpha})`);
    grad.addColorStop(1, "rgba(205,203,196,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A brief, brighter flare at each torch — the "uma chama aumenta e depois volta ao normal" moment. */
function drawFlameFlare(ctx: CanvasRenderingContext2D, anchors: readonly Vector2[], intensity: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const a of anchors) {
    const r = 14 + intensity * 26;
    const glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
    glow.addColorStop(0, `rgba(255,190,110,${0.55 * intensity})`);
    glow.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Midground trees — gentle idle sway, boosted during a wind gust.
// ---------------------------------------------------------------------------

const MIDGROUND_TREES = [
  { x: -30, y: 0.72, scale: 5.6, depth: 10, variant: 2, phase: 0 },
  { x: 100, y: 0.63, scale: 3.8, depth: 15, variant: 1, phase: 1.4 },
  { x: MENU_SCENE_SIZE.width + 30, y: 0.7, scale: 5.9, depth: 10, variant: 2, phase: 2.6 },
  { x: MENU_SCENE_SIZE.width - 120, y: 0.61, scale: 4, depth: 15, variant: 1, phase: 3.8 },
] as const;

function drawMidgroundTrees(ctx: CanvasRenderingContext2D, parallax: Parallax, timeMs: number, windGust: number): void {
  for (const tree of MIDGROUND_TREES) {
    ctx.save();
    ctx.translate(tree.x + parallax.x * tree.depth, MENU_SCENE_SIZE.height * tree.y + parallax.y * tree.depth * 0.4);
    const sway = Math.sin(timeMs / 2600 + tree.phase) * (0.015 + windGust * 0.05);
    ctx.rotate(sway);
    ctx.scale(tree.scale, tree.scale);
    const deco: Decoration = { kind: "TREE", position: { x: 0, y: 0 }, scale: 1, rotation: 0, variant: tree.variant };
    drawTree(ctx, deco, ACTIVE_BIOME);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Foreground ground + a short trodden-path hint toward the portal.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// A rare background creature crossing the sky during CREATURE_DASH.
// ---------------------------------------------------------------------------

function drawBird(ctx: CanvasRenderingContext2D, state: SceneState, timeMs: number): void {
  const ev = state.activeEvents.find((e) => e.type === "CREATURE_DASH");
  if (!ev) return;
  const t = Math.min(1, Math.max(0, (timeMs - ev.startTime) / ev.duration));
  const { width } = MENU_SCENE_SIZE;
  const y = 130 + Math.sin(t * Math.PI) * -20 + 40;
  const x = state.birdFromLeft ? -60 + t * (width + 120) : width + 60 - t * (width + 120);
  const dir = state.birdFromLeft ? 1 : -1;
  const flap = Math.sin(timeMs / 90) * 0.5;

  ctx.save();
  ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8 + 0.15;
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = "rgba(20,22,14,0.8)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -6 - flap * 6, -16, -2 - flap * 3);
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8, -6 - flap * 6, 16, -2 - flap * 3);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Mist / leaves / embers / magic motes.
// ---------------------------------------------------------------------------

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

const LEAF_SEEDS = Array.from({ length: 16 }, (_, i) => ({
  baseX: (i * 173) % MENU_SCENE_SIZE.width,
  baseY: (i * 97) % MENU_SCENE_SIZE.height,
  speed: 10 + (i % 5) * 4,
  drift: 8 + (i % 3) * 6,
  phase: i,
  size: 2 + (i % 3),
}));

function drawFallingLeaves(ctx: CanvasRenderingContext2D, timeMs: number, windGust: number): void {
  const { height } = MENU_SCENE_SIZE;
  const colors = [ACTIVE_BIOME.palette.vegetationPrimary, ACTIVE_BIOME.palette.vegetationSecondary, ACTIVE_BIOME.palette.accentWarm];
  const speedMul = 1 + windGust * 2.4;
  const driftMul = 1 + windGust * 1.8;
  ctx.save();
  for (const leaf of LEAF_SEEDS) {
    const y = ((leaf.baseY + (timeMs / 1000) * leaf.speed * speedMul) % (height + 40)) - 20;
    const x = leaf.baseX + Math.sin(timeMs / 1400 + leaf.phase) * leaf.drift * driftMul + windGust * 60;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(timeMs / (600 / speedMul) + leaf.phase);
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

/**
 * Ambient magic motes that drift on their own, and — during a MAGIC_PULL
 * moment, or the click-to-play transition — smoothly bias toward the
 * portal, brightening and shifting toward its violet as they approach.
 * Also nudged gently away from the cursor so the mouse feels part of the
 * scene without any exaggerated cursor-chasing.
 */
function drawMotes(
  ctx: CanvasRenderingContext2D,
  state: SceneState,
  timeMs: number,
  portalPos: Vector2,
  pullStrength: number,
  pointerScene: Vector2 | null,
): void {
  const { width, height } = MENU_SCENE_SIZE;
  ctx.save();
  for (const mote of state.motes) {
    const driftX = mote.baseX + Math.sin(timeMs / 2200 + mote.phase) * 30;
    const driftY = (mote.baseY - (timeMs / 1000) * mote.speed * 2) % height;
    const ambientY = driftY < 0 ? driftY + height : driftY;

    const localPull = Math.min(1, pullStrength * (0.7 + mote.pullPhase));
    let x = driftX + (portalPos.x - driftX) * localPull;
    let y = ambientY + (portalPos.y - ambientY) * localPull;

    if (pointerScene) {
      const dx = x - pointerScene.x;
      const dy = y - pointerScene.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110 && dist > 0.01) {
        const push = (1 - dist / 110) * 14;
        x += (dx / dist) * push;
        y += (dy / dist) * push;
      }
    }
    if (x < -10 || x > width + 10) continue;

    const color = lerpColor(ACTIVE_BIOME.palette.accentGlow, "#f0d8ff", localPull);
    const size = 1.3 + localPull * 1.4;
    const alpha = 0.35 + 0.35 * Math.sin(timeMs / 900 + mote.phase) + localPull * 0.35;
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, Math.max(0.08, alpha));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Foreground framing + vignette.
// ---------------------------------------------------------------------------

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
