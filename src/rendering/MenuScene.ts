import type { Vector2 } from "@/utils/geometry";
import { ACTIVE_BIOME } from "./biomes";
import { drawFortress, drawMagicPortal, drawTree } from "./MapRenderer";
import { drawCrawler, drawIronwood } from "./EntityRenderer";
import { TOWER_THEME, ENEMY_THEME, LIGHT_DIRECTION } from "./theme";
import type { Decoration } from "./mapDecorations";

/**
 * The main menu's cinematic backdrop — a purpose-built scene sharing the
 * game's own draw functions (fortress, portal, tower, enemy) but composed
 * for a game-trailer opening: a slow autonomous camera (drift + breathing
 * zoom + event-driven shake), six clearly separated parallax depths, a
 * restrained baseline of ambient life (smoke, mist, a few motes/leaves/
 * embers — deliberately NOT dozens of particles), and exactly THREE large
 * choreographed events that rotate in a fixed order on irregular spacing:
 * a portal energy surge, a beast passing through the midground, and a
 * distant magic-combat impact. Nothing here is tied to WORLD_SIZE or the
 * real ENEMY_PATH — the caller fits this fixed virtual canvas to the
 * viewport (see MenuBackground.tsx).
 */
export const MENU_SCENE_SIZE = { width: 1600, height: 900 } as const;

export interface Parallax {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Six named parallax depths (spec: "foreground; personagens/objetos;
// castelo; árvores; fundo; atmosfera") — every layer below picks one of
// these instead of inventing its own multiplier, so "closer = moves more"
// stays consistent across the whole scene.
// ---------------------------------------------------------------------------
const PARALLAX = {
  ATMOSPHERE: 3,
  CASTLE: 6,
  TREES_FAR: 10,
  TREES_NEAR: 15,
  CHARACTERS: 18,
  FOREGROUND: 26,
} as const;

function smoothstep(edgeStart: number, edgeEnd: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edgeStart) / (edgeEnd - edgeStart)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Scene state — smoke puffs, ambient magic motes, and the single active
// hero event (only one at a time, by design: "poucos eventos, porém
// grandes"). Owned by the caller (one instance per mounted
// <MenuBackground>) and passed in each frame.
// ---------------------------------------------------------------------------

type HeroEventType = "PORTAL_SURGE" | "CREATURE_PASS" | "DISTANT_COMBAT";

interface HeroEvent {
  type: HeroEventType;
  startTime: number;
  duration: number;
  seed: number;
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
  cycleIndex: number;
  activeEvent: HeroEvent | null;
  smoke: SmokePuff[];
  motes: Mote[];
  /** 0 = no transition; ramps 0→1 while the click-to-play sequence plays. */
  transitionProgress: number;
}

const MOTE_COUNT = 10;

export function createSceneState(startTime: number): SceneState {
  return {
    // First big event fairly soon — inside the "10-15s and it should
    // already feel alive" window from the direction.
    nextEventTime: startTime + 2800 + Math.random() * 1200,
    cycleIndex: 0,
    activeEvent: null,
    smoke: [],
    motes: Array.from({ length: MOTE_COUNT }, (_, i) => ({
      baseX: (i * 233) % MENU_SCENE_SIZE.width,
      baseY: (i * 179 + 80) % MENU_SCENE_SIZE.height,
      speed: 4 + (i % 5),
      phase: i,
      pullPhase: (i % 4) * 0.15,
    })),
    transitionProgress: 0,
  };
}

/** Fixed rotation (not random type-picking) so a viewer reliably sees all three, spaced with a randomized gap so the rhythm doesn't feel mechanical. */
const EVENT_SEQUENCE: readonly HeroEventType[] = ["PORTAL_SURGE", "CREATURE_PASS", "DISTANT_COMBAT"];
const EVENT_DURATIONS: Record<HeroEventType, number> = {
  PORTAL_SURGE: 4200,
  CREATURE_PASS: 3600,
  DISTANT_COMBAT: 2600,
};

function updateHeroEvent(state: SceneState, timeMs: number): void {
  if (state.activeEvent) {
    if (timeMs - state.activeEvent.startTime >= state.activeEvent.duration) {
      state.activeEvent = null;
      state.nextEventTime = timeMs + 4200 + Math.random() * 3200;
    }
    return;
  }
  if (timeMs >= state.nextEventTime) {
    const type = EVENT_SEQUENCE[state.cycleIndex % EVENT_SEQUENCE.length]!;
    state.cycleIndex++;
    state.activeEvent = { type, startTime: timeMs, duration: EVENT_DURATIONS[type], seed: Math.random() };
  }
}

interface EventPhase {
  type: HeroEventType;
  t: number;
  seed: number;
}

function currentEventPhase(state: SceneState, timeMs: number): EventPhase | null {
  const e = state.activeEvent;
  if (!e) return null;
  return { type: e.type, t: Math.min(1, Math.max(0, (timeMs - e.startTime) / e.duration)), seed: e.seed };
}

// ---------------------------------------------------------------------------
// Camera: slow autonomous drift + breathing zoom + a short shake spike
// during each event's "impact" beat, always easing back to neutral.
// Deliberately separate from the per-layer pointer parallax below (that
// stays a per-layer effect; this is one transform wrapping everything).
// ---------------------------------------------------------------------------

interface Camera {
  x: number;
  y: number;
  scale: number;
}

function computeCamera(timeMs: number, state: SceneState): Camera {
  const driftX = Math.sin(timeMs / 19000) * 9;
  const driftY = Math.cos(timeMs / 25000) * 4;
  const breathe = 1 + Math.sin(timeMs / 27000) * 0.012;

  const ev = currentEventPhase(state, timeMs);
  let impact = 0;
  if (ev?.type === "PORTAL_SURGE" && ev.t > 0.26 && ev.t < 0.5) {
    impact = Math.sin(((ev.t - 0.26) / 0.24) * Math.PI);
  } else if (ev?.type === "DISTANT_COMBAT" && ev.t > 0.32 && ev.t < 0.56) {
    impact = Math.sin(((ev.t - 0.32) / 0.24) * Math.PI) * 0.75;
  }
  const transitionShake = state.transitionProgress > 0.6 ? (state.transitionProgress - 0.6) / 0.4 : 0;
  const totalImpact = Math.max(impact, transitionShake * 0.5);

  const shakeX = totalImpact > 0 ? (Math.sin(timeMs * 0.09) + Math.sin(timeMs * 0.13)) * 2.4 * totalImpact : 0;
  const shakeY = totalImpact > 0 ? (Math.cos(timeMs * 0.08) + Math.sin(timeMs * 0.11)) * 1.7 * totalImpact : 0;

  // The click-to-play push-in: a fast zoom toward the portal on top of the idle breathing.
  const transitionZoom = 1 + smoothstep(0, 1, state.transitionProgress) * 0.5;

  return { x: driftX + shakeX, y: driftY + shakeY, scale: breathe * transitionZoom };
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
  updateHeroEvent(state, timeMs);
  const ev = currentEventPhase(state, timeMs);

  // --- Portal Surge sub-curves (also drive fortress torch/banner reactivity). ---
  const surgeT = ev?.type === "PORTAL_SURGE" ? ev.t : 0;
  const surgeBoost = ev?.type === "PORTAL_SURGE" ? (surgeT < 0.48 ? smoothstep(0, 0.48, surgeT) * 2.4 : 2.4 * (1 - smoothstep(0.48, 1, surgeT))) : 0;
  const surgeReact = surgeBoost / 2.4;

  // --- Distant Combat impact intensity (also reacts on the fortress). ---
  const combatT = ev?.type === "DISTANT_COMBAT" ? ev.t : 0;
  const combatImpact = ev?.type === "DISTANT_COMBAT" && combatT > 0.35 && combatT < 0.85 ? Math.sin(((combatT - 0.35) / 0.5) * Math.PI) : 0;

  const fortressReact = Math.max(surgeReact, combatImpact * 0.4);

  const camera = computeCamera(timeMs, state);
  const cx = MENU_SCENE_SIZE.width / 2;
  const cy = MENU_SCENE_SIZE.height / 2;

  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.translate(cx, cy);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-cx, -cy);

  drawSky(ctx);
  drawDistantRidge(ctx, parallax);
  if (surgeReact > 0.02) drawAmbientLightReact(ctx, surgeReact * 0.7, "146,86,220");
  if (combatImpact > 0.02) drawAmbientLightReact(ctx, combatImpact * 0.6, "255,120,70");
  drawGodRays(ctx, timeMs);

  ctx.save();
  ctx.translate(parallax.x * PARALLAX.CASTLE, parallax.y * (PARALLAX.CASTLE * 0.5));
  const fortressAnchors = drawFortress(ctx, FORTRESS_POS, ACTIVE_BIOME, timeMs, FORTRESS_SCALE, fortressReact);
  ctx.restore();
  drawAtmosphericHaze(ctx, MENU_SCENE_SIZE.height * 0.48, 150, "rgba(205,217,190,0.16)");

  const torchScenePoints: Vector2[] = fortressAnchors.torches.map((pt) => ({
    x: FORTRESS_POS.x + parallax.x * PARALLAX.CASTLE + pt.x * FORTRESS_SCALE,
    y: FORTRESS_POS.y + parallax.y * (PARALLAX.CASTLE * 0.5) + pt.y * FORTRESS_SCALE,
  }));
  updateSmoke(state, timeMs, dtMs, torchScenePoints);
  drawSmoke(ctx, state, timeMs);
  if (fortressReact > 0.05) drawFlameFlare(ctx, torchScenePoints, fortressReact);

  drawMidgroundTrees(ctx, parallax, timeMs);

  if (ev?.type === "CREATURE_PASS") drawCreaturePass(ctx, timeMs, ev, parallax);

  const portalScenePos = {
    x: PORTAL_POS.x + parallax.x * PARALLAX.CHARACTERS,
    y: PORTAL_POS.y + parallax.y * (PARALLAX.CHARACTERS * 0.4),
  };
  const pointerPortalDist = pointerScene ? Math.hypot(pointerScene.x - portalScenePos.x, pointerScene.y - portalScenePos.y) : Infinity;
  const pointerPortalBoost = Math.max(0, 1 - pointerPortalDist / 260) * 0.4;
  const transitionBoost = smoothstep(0, 0.75, state.transitionProgress) * 3.2;
  const portalBoost = Math.max(surgeBoost, transitionBoost) + pointerPortalBoost;

  ctx.save();
  ctx.translate(portalScenePos.x, portalScenePos.y);
  ctx.scale(PORTAL_SCALE, PORTAL_SCALE);
  drawMagicPortal(ctx, { x: 0, y: 0 }, timeMs, portalBoost);
  ctx.restore();
  if (surgeT > 0.24 && surgeT < 0.75) drawPortalShockwave(ctx, portalScenePos, (surgeT - 0.24) / 0.51);

  ctx.save();
  const ironwoodReadiness = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(timeMs / 2600));
  const ironwoodCycle = (timeMs / 4400) % 1;
  const ironwoodAttackFlash = ironwoodCycle < 0.06 ? ironwoodCycle * (4400 * 0.06) : Infinity;
  ctx.translate(
    MENU_SCENE_SIZE.width * 0.3 + parallax.x * PARALLAX.CHARACTERS,
    MENU_SCENE_SIZE.height * 0.79 + parallax.y * (PARALLAX.CHARACTERS * 0.4),
  );
  ctx.scale(2.3, 2.3);
  drawIronwood(ctx, TOWER_THEME.IRONWOOD, 3, timeMs, ironwoodAttackFlash, ironwoodReadiness);
  ctx.restore();

  ctx.save();
  const crawlerLungePhase = (timeMs / 3600) % 1;
  const lunge = crawlerLungePhase < 0.18 ? Math.sin((crawlerLungePhase / 0.18) * Math.PI) : 0;
  const crawlerIntensity = 1 + lunge * 1.6;
  ctx.translate(
    MENU_SCENE_SIZE.width * 0.6 + parallax.x * PARALLAX.CHARACTERS + lunge * 6,
    MENU_SCENE_SIZE.height * 0.87 + parallax.y * (PARALLAX.CHARACTERS * 0.5),
  );
  ctx.scale(1.9, 1.9);
  ctx.rotate(-0.35);
  drawCrawler(ctx, ENEMY_THEME.CRAWLER, timeMs, Infinity, crawlerIntensity);
  ctx.restore();

  drawForegroundGround(ctx, parallax);
  drawMistBands(ctx, timeMs, parallax);
  drawFallingLeaves(ctx, timeMs);
  drawEmbers(ctx, timeMs);

  const magicPull = Math.max(surgeT > 0 && surgeT < 0.7 ? smoothstep(0, 0.35, surgeT) * (1 - smoothstep(0.5, 0.7, surgeT)) : 0, state.transitionProgress);
  drawMotes(ctx, state, timeMs, portalScenePos, magicPull, pointerScene);

  if (ev?.type === "DISTANT_COMBAT") drawDistantCombat(ctx, ev);
  if (state.transitionProgress > 0.55) drawWarpStreaks(ctx, portalScenePos, (state.transitionProgress - 0.55) / 0.45);

  drawForegroundFraming(ctx, parallax);
  drawSceneVignette(ctx);

  ctx.restore();
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
// Sky / ridge / ambient light reaction / god rays.
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
    { y: height * 0.42, color: "rgba(70,95,60,0.5)", amp: 18, drift: PARALLAX.ATMOSPHERE },
    { y: height * 0.5, color: "rgba(38,58,36,0.7)", amp: 24, drift: PARALLAX.ATMOSPHERE * 2 },
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

/** A brief, subtle screen-wide tint — "a luz ambiente reage" to a big event, without washing anything out. */
function drawAmbientLightReact(ctx: CanvasRenderingContext2D, intensity: number, rgb: string): void {
  const { width, height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(${rgb},${Math.min(0.16, intensity * 0.16)})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawGodRays(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const { height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const originX = MENU_SCENE_SIZE.width * 0.22;
  const originY = -60;
  const baseAngle = Math.atan2(-LIGHT_DIRECTION.y, -LIGHT_DIRECTION.x);
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.15;
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 3000 + i);
    const rayAngle = baseAngle + spread;
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

// ---------------------------------------------------------------------------
// Smoke rising from the fortress's torches + a brief flare during a
// reacting event.
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
  if (state.smoke.length > 30) state.smoke.splice(0, state.smoke.length - 30);
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

function drawFlameFlare(ctx: CanvasRenderingContext2D, anchors: readonly Vector2[], intensity: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const a of anchors) {
    const r = 14 + intensity * 26;
    const glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
    glow.addColorStop(0, `rgba(255,190,110,${0.5 * intensity})`);
    glow.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Midground trees — gentle constant idle sway.
// ---------------------------------------------------------------------------

const MIDGROUND_TREES = [
  { x: -30, y: 0.72, scale: 5.6, depth: PARALLAX.TREES_NEAR, variant: 2, phase: 0 },
  { x: 100, y: 0.63, scale: 3.8, depth: PARALLAX.TREES_FAR, variant: 1, phase: 1.4 },
  { x: MENU_SCENE_SIZE.width + 30, y: 0.7, scale: 5.9, depth: PARALLAX.TREES_NEAR, variant: 2, phase: 2.6 },
  { x: MENU_SCENE_SIZE.width - 120, y: 0.61, scale: 4, depth: PARALLAX.TREES_FAR, variant: 1, phase: 3.8 },
] as const;

function drawMidgroundTrees(ctx: CanvasRenderingContext2D, parallax: Parallax, timeMs: number): void {
  for (const tree of MIDGROUND_TREES) {
    ctx.save();
    ctx.translate(tree.x + parallax.x * tree.depth, MENU_SCENE_SIZE.height * tree.y + parallax.y * tree.depth * 0.4);
    ctx.rotate(Math.sin(timeMs / 2600 + tree.phase) * 0.016);
    ctx.scale(tree.scale, tree.scale);
    const deco: Decoration = { kind: "TREE", position: { x: 0, y: 0 }, scale: 1, rotation: 0, variant: tree.variant };
    drawTree(ctx, deco, ACTIVE_BIOME);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Foreground ground + a short trodden-path hint toward the portal.
// ---------------------------------------------------------------------------

function drawForegroundGround(ctx: CanvasRenderingContext2D, parallax: Parallax): void {
  const { width, height } = MENU_SCENE_SIZE;
  ctx.save();
  ctx.translate(parallax.x * PARALLAX.FOREGROUND, parallax.y * (PARALLAX.FOREGROUND * 0.3));
  const groundY = height * 0.86;
  const grad = ctx.createLinearGradient(0, groundY, 0, height);
  grad.addColorStop(0, "rgba(20,17,11,0)");
  grad.addColorStop(0.35, ACTIVE_BIOME.palette.groundShadowed);
  grad.addColorStop(1, "#0c0a06");
  ctx.fillStyle = grad;
  ctx.fillRect(-40, groundY, width + 80, height - groundY + 40);

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
// HERO EVENT 1 — Portal Surge: charge -> shockwave -> release. Boost/
// react curves are computed in drawMenuScene (surgeBoost/surgeReact/
// magicPull); this file only draws the ring itself.
// ---------------------------------------------------------------------------

function drawPortalShockwave(ctx: CanvasRenderingContext2D, portalPos: Vector2, localT: number): void {
  const radius = 20 + localT * 260;
  const alpha = (1 - localT) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(220,180,255,${Math.max(0, alpha)})`;
  ctx.lineWidth = 4 * (1 - localT) + 1;
  ctx.beginPath();
  ctx.arc(portalPos.x, portalPos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// HERO EVENT 2 — Creature Pass: a large beast emerges near a tree, holds,
// then dashes across the midground and fades — not a static decoration.
// ---------------------------------------------------------------------------

const BEAST_ANCHOR = { x: MENU_SCENE_SIZE.width * 0.42, y: MENU_SCENE_SIZE.height * 0.665 };
const BEAST_EXIT = { x: MENU_SCENE_SIZE.width * 0.8, y: MENU_SCENE_SIZE.height * 0.7 };

function drawCreaturePass(ctx: CanvasRenderingContext2D, timeMs: number, ev: EventPhase, parallax: Parallax): void {
  const t = ev.t;
  let scale = 0;
  let alpha = 0;
  let x = BEAST_ANCHOR.x;
  let y = BEAST_ANCHOR.y;
  let facing: 1 | -1 = 1;

  if (t < 0.28) {
    const local = smoothstep(0, 0.28, t);
    scale = 0.4 + local * 0.6;
    alpha = local * 0.88;
  } else if (t < 0.55) {
    scale = 1;
    alpha = 0.88;
    y = BEAST_ANCHOR.y + Math.sin(timeMs / 260) * 1.6;
  } else if (t < 0.85) {
    const local = smoothstep(0.55, 0.85, t);
    scale = 1;
    alpha = 0.88;
    x = BEAST_ANCHOR.x + (BEAST_EXIT.x - BEAST_ANCHOR.x) * local;
    y = BEAST_ANCHOR.y + (BEAST_EXIT.y - BEAST_ANCHOR.y) * local;
    facing = 1;
  } else {
    const local = smoothstep(0.85, 1, t);
    scale = 1;
    alpha = 0.88 * (1 - local);
    x = BEAST_EXIT.x;
    y = BEAST_EXIT.y;
  }

  ctx.save();
  ctx.translate(x + parallax.x * PARALLAX.CHARACTERS, y + parallax.y * (PARALLAX.CHARACTERS * 0.4));
  drawBeastSilhouette(ctx, timeMs, scale, alpha, facing);
  ctx.restore();
}

function drawBeastSilhouette(ctx: CanvasRenderingContext2D, timeMs: number, scale: number, alpha: number, facing: 1 | -1): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.scale(scale * facing, scale);
  const bob = Math.sin(timeMs / 180) * 1.5;
  ctx.translate(0, bob);

  ctx.fillStyle = "rgba(6,7,4,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 30, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = "#0c0f07";
  ctx.strokeStyle = body;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const lx of [-20, -6, 10, 24]) {
    const legPhase = Math.sin(timeMs / 160 + lx) * 4;
    ctx.beginPath();
    ctx.moveTo(lx, 8);
    ctx.lineTo(lx + legPhase, 26);
    ctx.stroke();
  }

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-32, -2);
  ctx.quadraticCurveTo(-46, -10 + Math.sin(timeMs / 300) * 4, -52, 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(36, -4);
  ctx.rotate(Math.sin(timeMs / 900) * 0.08);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.lineTo(8, -19);
  ctx.lineTo(10, -7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(0, -20);
  ctx.lineTo(4, -8);
  ctx.closePath();
  ctx.fill();

  const eyeGlow = 0.6 + 0.4 * Math.sin(timeMs / 220);
  ctx.fillStyle = hexToRgba(ACTIVE_BIOME.palette.accentGlow, eyeGlow);
  ctx.beginPath();
  ctx.arc(7, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// HERO EVENT 3 — Distant Combat: a bolt streaks in and impacts with a
// burst, sparks, and a momentary light reaction on the environment
// (handled by drawAmbientLightReact in the orchestrator).
// ---------------------------------------------------------------------------

const COMBAT_ORIGIN = { x: MENU_SCENE_SIZE.width * 0.98, y: -30 };
const COMBAT_IMPACT = { x: MENU_SCENE_SIZE.width * 0.79, y: MENU_SCENE_SIZE.height * 0.53 };

function drawDistantCombat(ctx: CanvasRenderingContext2D, ev: EventPhase): void {
  const t = ev.t;
  if (t < 0.35) {
    const local = t / 0.35;
    const x = COMBAT_ORIGIN.x + (COMBAT_IMPACT.x - COMBAT_ORIGIN.x) * local;
    const y = COMBAT_ORIGIN.y + (COMBAT_IMPACT.y - COMBAT_ORIGIN.y) * local;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const trailGrad = ctx.createLinearGradient(COMBAT_ORIGIN.x, COMBAT_ORIGIN.y, x, y);
    trailGrad.addColorStop(0, "rgba(255,120,80,0)");
    trailGrad.addColorStop(1, "rgba(255,160,110,0.85)");
    ctx.strokeStyle = trailGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(COMBAT_ORIGIN.x, COMBAT_ORIGIN.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "#fff2e0";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (t >= 0.85) return;

  const local = (t - 0.35) / 0.5;
  const burstRadius = 10 + local * 95;
  const alpha = (1 - local) * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(COMBAT_IMPACT.x, COMBAT_IMPACT.y, 0, COMBAT_IMPACT.x, COMBAT_IMPACT.y, burstRadius);
  g.addColorStop(0, `rgba(255,240,220,${alpha})`);
  g.addColorStop(0.4, `rgba(255,120,70,${alpha * 0.7})`);
  g.addColorStop(1, "rgba(255,90,50,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(COMBAT_IMPACT.x, COMBAT_IMPACT.y, burstRadius, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + ev.seed * 6;
    const dist = local * 42;
    ctx.fillStyle = `rgba(255,200,150,${alpha})`;
    ctx.beginPath();
    ctx.arc(COMBAT_IMPACT.x + Math.cos(angle) * dist, COMBAT_IMPACT.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Mist / leaves / embers / magic motes — restrained counts (spec: "não
// poluir"), enough for baseline life without competing with the hero
// events.
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
    const x1 = (rawX < 0 ? rawX + span : rawX) - 200 + parallax.x * (PARALLAX.ATMOSPHERE + 3);
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

const LEAF_SEEDS = Array.from({ length: 8 }, (_, i) => ({
  baseX: (i * 193) % MENU_SCENE_SIZE.width,
  baseY: (i * 113) % MENU_SCENE_SIZE.height,
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
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

const EMBER_SEEDS = Array.from({ length: 10 }, (_, i) => ({
  baseX: (i * 241) % MENU_SCENE_SIZE.width,
  baseY: (i * 167 + 60) % MENU_SCENE_SIZE.height,
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
 * Ambient magic motes that drift on their own, and — during the Portal
 * Surge event's mid-window, or the click-to-play transition — smoothly
 * bias toward the portal, brightening and shifting toward its violet as
 * they approach. Also nudged gently away from the cursor.
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
// Click-to-play warp streaks — radiating lines from the portal during the
// final phase of the transition, a cheap "flying into it" cue.
// ---------------------------------------------------------------------------

function drawWarpStreaks(ctx: CanvasRenderingContext2D, portalPos: Vector2, intensity: number): void {
  if (intensity <= 0) return;
  const clamped = Math.min(1, intensity);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const length = 120 + clamped * 900;
    const endX = portalPos.x + Math.cos(angle) * length;
    const endY = portalPos.y + Math.sin(angle) * length;
    const grad = ctx.createLinearGradient(portalPos.x, portalPos.y, endX, endY);
    grad.addColorStop(0, `rgba(240,220,255,${0.5 * clamped})`);
    grad.addColorStop(1, "rgba(240,220,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 + clamped * 2;
    ctx.beginPath();
    ctx.moveTo(portalPos.x, portalPos.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
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
  ctx.translate(parallax.x * PARALLAX.FOREGROUND, 0);

  ctx.beginPath();
  ctx.moveTo(-20, height + 20);
  ctx.quadraticCurveTo(60, height * 0.78, 230, height * 0.7);
  ctx.quadraticCurveTo(140, height * 0.9, 40, height + 20);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(width + 20, height + 20);
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
