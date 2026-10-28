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
}

const SPRITE_DEFS: Partial<Record<EnemyType, SpriteDef>> = {
  CRAWLER: { file: "crawler.png", worldHeight: 21, stride: 13, legSplit: 0.55, legSkew: 0.28, bobAmp: 0.9, lean: 0.03 },
  RUNNER: { file: "runner.png", worldHeight: 27, stride: 24, legSplit: 0.5, legSkew: 0.32, bobAmp: 1.6, lean: 0.07 },
  BRUTE: { file: "brute.png", worldHeight: 30, stride: 20, legSplit: 0.68, legSkew: 0.16, bobAmp: 1.3, lean: 0.03 },
  SHIELDBEARER: { file: "shieldbearer.png", worldHeight: 29, stride: 17, legSplit: 0.72, legSkew: 0.18, bobAmp: 1.0, lean: 0.03 },
};

/** Where the sprite's feet sit relative to the enemy's position (fraction of its height below the anchor point). */
const FOOT_ANCHOR = 0.36;

interface LoadedSprite {
  def: SpriteDef;
  image: HTMLImageElement;
  /** Pre-tinted copies for status effects (null if offscreen canvas isn't available). */
  ice: HTMLCanvasElement | null;
  fire: HTMLCanvasElement | null;
}

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
  for (const [type, def] of Object.entries(SPRITE_DEFS) as [EnemyType, SpriteDef][]) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      loaded.set(type, {
        def,
        image,
        ice: tinted(image, "rgba(150,225,255,0.9)"),
        fire: tinted(image, "rgba(255,120,30,0.9)"),
      });
    };
    image.src = `${base}sprites/enemies/${def.file}`;
  }
}

export function getEnemySprite(type: EnemyType): LoadedSprite | undefined {
  return loaded.get(type);
}

/** Types that have painted art (whether or not it has finished loading). */
export function hasEnemySpriteArt(type: EnemyType): boolean {
  return SPRITE_DEFS[type] !== undefined;
}

/**
 * Height above the enemy's position where the top of its painted sprite
 * sits (world units, positive = up), for a given render scale — lets the
 * HP bar sit just above the creature's head instead of overlapping it.
 */
export function spriteHeadroom(type: EnemyType, scale: number): number | null {
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
  const squash = Math.cos(phase * 2) * 0.035 * gait;
  const rock = Math.sin(phase) * 0.035 * gait;

  const top = -h * (1 - FOOT_ANCHOR);
  const split = def.legSplit;
  const splitY = top + h * split;

  const drawSlices = (src: CanvasImageSource, alpha: number) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    // Body slice (bobs and rocks with the stride).
    ctx.drawImage(src, 0, 0, iw, ih * split + 1, -w / 2, top, w, h * split + 0.6);
    // Legs slice — swings from the hips.
    ctx.save();
    ctx.translate(0, splitY);
    ctx.transform(1, 0, step * def.legSkew * gait, 1, 0, 0);
    ctx.translate(0, -splitY);
    ctx.drawImage(src, 0, ih * split, iw, ih * (1 - split), -w / 2, splitY, w, h * (1 - split));
    ctx.restore();
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
