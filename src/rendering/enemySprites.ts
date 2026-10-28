import type { EnemyType } from "@/config/enemyStats";
import type { LocomotionState } from "./biomeCreatures/helpers";

/**
 * PAINTED ENEMY SPRITES — hand-painted creature art (generated for
 * HORDENOVA, cut out to transparent PNGs in public/sprites/enemies/)
 * replacing the code-drawn bodies of the core roster. Only the types listed
 * here use art; every other creature keeps its vector body, and any type
 * whose image hasn't loaded yet (or can't — tests, no canvas support) falls
 * straight back to the vector body too, so nothing can ever render blank.
 *
 * MOVEMENT — a static picture sliding along the path would read as a
 * cardboard cut-out, so each sprite is animated procedurally, driven by the
 * enemy's REAL `distanceTraveled` (the gait slows when the enemy is slowed
 * and stops completely when it's frozen):
 * - the sprite is split into a body slice and a legs slice; the legs slice
 *   swings back and forth (skew pivoting at the hips) in step with the gait,
 * - the body bobs up on every step, with a slight squash/stretch,
 * - the creature leans into its stride and gently rocks side to side,
 * - it faces its travel direction (mirrored left/right, with hysteresis so
 *   it doesn't flicker on vertical stretches of the road),
 * - when standing still it just breathes.
 * Freeze/burn status tints the creature itself (icy blue / flickering
 * orange) instead of only drawing a ring around it.
 */

interface SpriteDef {
  file: string;
  /** On-screen height in world units, before the global enemy display scale. */
  worldHeight: number;
  /** World units travelled per full gait cycle (two steps). */
  stride: number;
  /** Fraction of the image height (from the top) where the legs slice starts. */
  legSplit: number;
  /** Max sideways skew of the legs slice per step. */
  legSkew: number;
  /** Vertical bob per step, world units. */
  bobAmp: number;
  /** Forward lean while moving, radians. */
  lean: number;
  /** Whole-body side-to-side sway, fraction of width (the wave that runs down the body, head lagging behind). */
  sway: number;
  /** Opposite-phase swing of the two halves of the upper body (arms/shoulders, or front/back of a beast), fraction of width. */
  limbSwing: number;
  /** Weight shift: the two halves rise and fall alternately, fraction of height. */
  weightShift: number;
  /** Head nod (top of the sprite, delayed behind the step), fraction of height. */
  headNod: number;
}

const SPRITE_DEFS: Partial<Record<EnemyType, SpriteDef>> = {
  // Insect: little sway, strong alternating rise/fall of front vs back (tripod gait feel).
  CRAWLER: { file: "crawler.png", worldHeight: 21, stride: 11, legSplit: 0.55, legSkew: 0.42, bobAmp: 1.2, lean: 0.04, sway: 0.02, limbSwing: 0.02, weightShift: 0.045, headNod: 0.02 },
  // Sprinter: big bob, strong forward lean, body undulates hard.
  RUNNER: { file: "runner.png", worldHeight: 27, stride: 22, legSplit: 0.5, legSkew: 0.5, bobAmp: 2.2, lean: 0.09, sway: 0.035, limbSwing: 0.03, weightShift: 0.04, headNod: 0.035 },
  // Marching biped behind a shield: steady march, shield arm swings less, body rocks.
  SHIELDBEARER: { file: "shieldbearer.png", worldHeight: 29, stride: 16, legSplit: 0.7, legSkew: 0.34, bobAmp: 1.5, lean: 0.04, sway: 0.028, limbSwing: 0.035, weightShift: 0.03, headNod: 0.03 },
};

/** How high a foot lifts while it swings forward, as a fraction of the sprite's height. */
const LEG_LIFT = 0.045;

/** Where the sprite's feet sit relative to the enemy's position (fraction of its height below the anchor point). */
const FOOT_ANCHOR = 0.36;

/**
 * ANIMATED SHEETS — real frame-by-frame animation baked from rigged,
 * animated 3D monsters (Quaternius "Bestiary" + "Universal Animation
 * Library" and "Ultimate Monsters", both free for commercial use) into
 * sprite sheets in public/sprites/enemies/anim/. Each sheet has 3 rows —
 * side, front (walking toward the camera) and back (walking away), all
 * facing right; the game mirrors for left — and `frames` columns of one
 * full walk/flight cycle. Unlike the painted sprites above (one picture
 * deformed procedurally), these are genuine animations: every limb, the
 * head and the torso move like a real walk. Takes priority over SPRITE_DEFS.
 */
interface SheetDef {
  file: string;
  frames: number;
  /** Visible creature height on screen, world units (before the caller's scale). */
  worldHeight: number;
  /** World units travelled per full animation cycle (keeps feet from sliding). */
  stride: number;
  /** Fliers: how high above the ground shadow the body floats, world units. */
  hover?: number;
}

/** Fraction of a sheet cell (from the top) where the creature's top and feet land — fixed by the baker's tight framing. */
const SHEET_TOP = 0.02;
const SHEET_FOOT = 0.98;

const SHEET_DEFS: Partial<Record<EnemyType, SheetDef>> = {
  BRUTE: { file: "anim/brute_walk.png", frames: 12, worldHeight: 33, stride: 30 },
  REGENERATOR: { file: "anim/regenerator_walk.png", frames: 12, worldHeight: 27, stride: 24 },
  DISABLER: { file: "anim/disabler_walk.png", frames: 12, worldHeight: 25, stride: 26, hover: 6 },
  SWARMLING: { file: "anim/swarmling_walk.png", frames: 12, worldHeight: 24, stride: 9, hover: 7 },
};

type LoadedSprite =
  | {
      kind: "painted";
      def: SpriteDef;
      image: HTMLImageElement;
      /** Pre-tinted copies for status effects (null if offscreen canvas isn't available). */
      ice: HTMLCanvasElement | null;
      fire: HTMLCanvasElement | null;
    }
  | {
      kind: "sheet";
      def: SheetDef;
      image: HTMLImageElement;
      ice: HTMLCanvasElement | null;
      fire: HTMLCanvasElement | null;
    };

const loaded = new Map<EnemyType, LoadedSprite>();
let loadingStarted = false;

function tinted(image: HTMLImageElement, color: string): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(image, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  } catch {
    return null;
  }
}

/** Starts loading every sprite once (idempotent). Safe to call every frame. */
export function ensureEnemySpritesLoading(): void {
  if (loadingStarted || typeof Image === "undefined") return;
  loadingStarted = true;
  const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
  const load = (type: EnemyType, file: string, make: (image: HTMLImageElement) => LoadedSprite) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => loaded.set(type, make(image));
    image.src = `${base}sprites/enemies/${file}`;
  };
  const ICE = "rgba(150,225,255,0.9)";
  const FIRE = "rgba(255,120,30,0.9)";
  for (const [type, def] of Object.entries(SHEET_DEFS) as [EnemyType, SheetDef][]) {
    load(type, def.file, (image) => ({ kind: "sheet", def, image, ice: tinted(image, ICE), fire: tinted(image, FIRE) }));
  }
  for (const [type, def] of Object.entries(SPRITE_DEFS) as [EnemyType, SpriteDef][]) {
    if (SHEET_DEFS[type]) continue;
    load(type, def.file, (image) => ({ kind: "painted", def, image, ice: tinted(image, ICE), fire: tinted(image, FIRE) }));
  }
}

export function getEnemySprite(type: EnemyType): LoadedSprite | undefined {
  return loaded.get(type);
}

/** Types that have painted art (whether or not it has finished loading). */
export function hasEnemySpriteArt(type: EnemyType): boolean {
  return SPRITE_DEFS[type] !== undefined || SHEET_DEFS[type] !== undefined;
}

/** True when the type uses a real frame-by-frame animated sheet (not a single painted picture). */
export function hasAnimatedSheet(type: EnemyType): boolean {
  return SHEET_DEFS[type] !== undefined;
}

/**
 * Height above the enemy's position where the top of its painted sprite
 * sits (world units, positive = up), for a given render scale — lets the
 * HP bar sit just above the creature's head instead of overlapping it.
 */
export function spriteHeadroom(type: EnemyType, scale: number): number | null {
  const sheet = SHEET_DEFS[type];
  if (sheet) return (sheet.worldHeight * (1 - FOOT_ANCHOR) + (sheet.hover ?? 0)) * scale;
  const def = SPRITE_DEFS[type];
  if (!def) return null;
  return def.worldHeight * (1 - FOOT_ANCHOR) * scale + def.bobAmp * scale;
}

// Facing memory per enemy (with hysteresis) — bounded, cleared if it grows.
const facingMemory = new Map<string, 1 | -1>();

function facingFor(enemyId: string, angle: number): 1 | -1 {
  const c = Math.cos(angle);
  let f = facingMemory.get(enemyId) ?? (c >= 0 ? 1 : -1);
  if (c > 0.25) f = 1;
  else if (c < -0.25) f = -1;
  if (facingMemory.size > 600) facingMemory.clear();
  facingMemory.set(enemyId, f);
  return f;
}

/**
 * Draws the painted, animated creature centered on the current origin
 * (the caller has already translated/scaled to the enemy). Must be called
 * in UNROTATED space — the art is a side/three-quarter view, so it mirrors
 * to face its direction rather than spinning with the path.
 */
export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  sprite: LoadedSprite,
  enemyId: string,
  angle: number,
  locomotion: LocomotionState,
  timeMs: number,
  status: { slowPercent: number; burning: boolean },
): void {
  if (sprite.kind === "sheet") {
    drawSheetSprite(ctx, sprite, enemyId, angle, locomotion, timeMs, status);
    return;
  }
  const { def, image } = sprite;
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const h = def.worldHeight;
  const w = (h * iw) / ih;
  const facing = facingFor(enemyId, angle);

  const gait = Math.min(1, locomotion.speedRatio * 1.4);
  const phase = (locomotion.distance / def.stride) * Math.PI * 2;
  const step = Math.sin(phase);
  const bob = -Math.abs(step) * def.bobAmp * gait;
  const breathe = Math.sin(timeMs / 520) * 0.018 * (1 - gait);
  const squash = Math.cos(phase * 2) * 0.05 * gait;
  const rock = Math.sin(phase) * 0.06 * gait;

  const top = -h * (1 - FOOT_ANCHOR);
  const split = def.legSplit;
  const splitY = top + h * split;

  // Legs are drawn as TWO independent halves (left/right of the image) in
  // opposite phase — one foot swings forward and lifts while the other
  // pushes back on the ground — so it reads as real alternating steps, not
  // the whole lower body sliding as one piece. They're drawn first, from a
  // little above the hip line, so the body slice drawn over them hides the
  // joint.
  const legTop = Math.max(0, split - 0.06);
  const legSrcY = ih * legTop;
  const legSrcH = ih * (1 - legTop);
  const legDstY = top + h * legTop;
  const legDstH = h * (1 - legTop);
  const hipY = splitY;
  const drawLegs = (src: CanvasImageSource) => {
    for (let side = 0; side < 2; side++) {
      const p = phase + side * Math.PI;
      const swing = Math.sin(p) * def.legSkew * gait;
      const lift = -Math.max(0, Math.cos(p)) * LEG_LIFT * h * gait;
      const sx = side === 0 ? 0 : iw / 2 - 1;
      const sw = iw / 2 + 1;
      const dx = side === 0 ? -w / 2 : -0.5;
      const dw = w / 2 + 0.5;
      ctx.save();
      ctx.translate(0, hipY);
      ctx.transform(1, 0, swing, 1, 0, 0);
      ctx.translate(0, lift - hipY);
      ctx.drawImage(src, sx, legSrcY, sw, legSrcH, dx, legDstY, dw, legDstH);
      ctx.restore();
    }
  };
  // WHOLE-BODY MOTION — the body is drawn as a grid of horizontal bands,
  // each split into a left and a right half, and every cell gets its own
  // offset so the entire creature moves, not just its feet:
  // - sway: a side-to-side wave travelling down the body, with the top
  //   (head) lagging behind the hips — follow-through,
  // - limb swing: the two halves of the upper body swing in OPPOSITE phase
  //   to the legs (arms/shoulders, or front/back of a beast),
  // - weight shift: the left and right halves rise and fall alternately as
  //   the weight moves from one foot to the other,
  // - head nod: the top of the sprite dips a beat after each footfall.
  // Cells overlap by a pixel so no seams open up between them.
  // The grid's columns get a CONTINUOUS offset across the body's width
  // (left edge one way, right edge the other, smoothly in between), so the
  // body bends and twists without ever tearing apart at a seam.
  const BANDS = 6;
  const COLS = 6;
  const drawBody = (src: CanvasImageSource) => {
    const sinP = Math.sin(phase);
    for (let b = 0; b < BANDS; b++) {
      const t0 = (b / BANDS) * split;
      const t1 = ((b + 1) / BANDS) * split;
      const t = (t0 + t1) / 2 / Math.max(0.01, split); // 0 = top of the head, 1 = hips
      const sway = Math.sin(phase - (1 - t) * 1.1) * def.sway * w * gait;
      const nod = t < 0.3 ? Math.cos(phase * 2 - 0.9) * def.headNod * h * gait * (1 - t / 0.3) : 0;
      const limbWeight = Math.sin(Math.min(1, t) * Math.PI);
      const sy = ih * t0;
      const sh = ih * (t1 - t0) + 1;
      const baseDy = top + h * t0 + nod;
      const dh = h * (t1 - t0) + 0.6;
      for (let c = 0; c < COLS; c++) {
        const u = (c + 0.5) / COLS;
        const k = Math.cos(u * Math.PI); // +1 at the left edge, -1 at the right edge, smooth in between
        const swing = sinP * k * def.limbSwing * w * gait * limbWeight;
        const shift = -sinP * k * def.weightShift * h * gait * (0.4 + 0.6 * t);
        const sx = (iw * c) / COLS;
        const sw = iw / COLS + 1;
        const dx = -w / 2 + (w * c) / COLS + sway + swing;
        const dw = w / COLS + 0.6;
        ctx.drawImage(src, sx, sy, sw, sh, dx, baseDy + shift, dw, dh);
      }
    }
  };
  const drawSlices = (src: CanvasImageSource, alpha: number) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    drawLegs(src);
    drawBody(src);
  };

  ctx.save();
  ctx.scale(facing, 1);
  // Pivot the lean/rock around the feet so the creature tips over its own footing.
  const footY = h * FOOT_ANCHOR;
  ctx.translate(0, footY + bob);
  ctx.rotate(def.lean * gait + rock);
  ctx.scale(1 - squash + breathe, 1 + squash + breathe);
  ctx.translate(0, -footY);

  drawSlices(image, 1);
  // Status tints — on the creature itself.
  if (status.slowPercent > 0 && sprite.ice) {
    drawSlices(sprite.ice, status.slowPercent >= 1 ? 0.55 : 0.28);
  }
  if (status.burning && sprite.fire) {
    drawSlices(sprite.fire, 0.18 + 0.12 * Math.sin(timeMs / 70));
  }
  ctx.restore();
}

// View memory per enemy (side / front / back) with hysteresis, so a creature
// walking along a gentle diagonal doesn't flicker between views.
const viewMemory = new Map<string, 0 | 1 | 2>();

function viewFor(enemyId: string, angle: number): 0 | 1 | 2 {
  const dy = Math.sin(angle); // +down the screen (toward the camera)
  let v = viewMemory.get(enemyId) ?? (dy > 0.45 ? 1 : dy < -0.45 ? 2 : 0);
  if (dy > 0.55) v = 1;
  else if (dy < -0.55) v = 2;
  else if (Math.abs(dy) < 0.3) v = 0;
  if (viewMemory.size > 600) viewMemory.clear();
  viewMemory.set(enemyId, v);
  return v;
}

function drawSheetSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Extract<LoadedSprite, { kind: "sheet" }>,
  enemyId: string,
  angle: number,
  locomotion: LocomotionState,
  timeMs: number,
  status: { slowPercent: number; burning: boolean },
): void {
  const { def, image } = sprite;
  const cell = image.naturalHeight / 3;
  const visible = SHEET_FOOT - SHEET_TOP;
  const cellWorld = def.worldHeight / visible;
  const facing = facingFor(enemyId, angle);
  const view = viewFor(enemyId, angle);

  // Frame from distance actually travelled: feet plant instead of sliding,
  // slowed enemies animate slower, frozen ones hold their pose.
  const cycle = (((locomotion.distance / def.stride) % 1) + 1) % 1;
  const frame = Math.floor(cycle * def.frames) % def.frames;
  const sx = frame * cell;
  const sy = view * cell;

  const hover = def.hover ? def.hover + Math.sin(timeMs / 380 + enemyId.length) * 1.2 : 0;
  const footY = def.worldHeight * FOOT_ANCHOR - hover;
  const dy = footY - cellWorld * SHEET_FOOT;

  ctx.save();
  ctx.scale(facing, 1);
  const blit = (src: CanvasImageSource, alpha: number) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, sx, sy, cell, cell, -cellWorld / 2, dy, cellWorld, cellWorld);
  };
  blit(image, 1);
  if (status.slowPercent > 0 && sprite.ice) blit(sprite.ice, status.slowPercent >= 1 ? 0.55 : 0.28);
  if (status.burning && sprite.fire) blit(sprite.fire, 0.18 + 0.12 * Math.sin(timeMs / 70));
  ctx.restore();
}
