import type { EnemyType } from "@/config/enemyStats";
import { PHASES } from "@/config/phaseConfig";
import type { LocomotionState } from "./locomotion";
import { BIOME_ENEMY_SHEETS } from "./biomeEnemySheets";
import { BOSS_SHEETS, type BossSheetEntry } from "./bossSheets";

/**
 * ENEMY ART — every creature on the road is a rigged, animated 3D monster
 * (Quaternius "Ultimate Monsters" / "Bestiary", free for commercial use)
 * baked into a sprite sheet: rows are views (side, front = walking toward
 * the camera, back = walking away; all facing right, mirrored for left) and
 * columns are the frames of one full walk/flight cycle. Bosses add a 4th
 * row, their attack (see bossSheets.ts).
 *
 * Every biome has its own sheet for every archetype that walks it
 * (biomeEnemySheets.ts); only the biome on screen is loaded. The first
 * biome's sheets load at startup so a creature whose own biome sheet is
 * still downloading borrows that same archetype's first-biome sheet for a
 * moment — never a blank or an old placeholder body.
 *
 * The frame comes from the distance the enemy really travelled, so feet
 * plant instead of sliding, a slowed enemy animates slower and a frozen one
 * holds its pose. Freeze/burn tint the creature itself.
 */

interface SheetDef {
  file: string;
  frames: number;
  /** Rows in the sheet (3 walk views, +1 attack row for bosses). */
  rows: number;
  /** Visible creature height on screen, world units (before the caller's scale). */
  worldHeight: number;
  /** World units travelled per full animation cycle (keeps feet from sliding). */
  stride: number;
  /** Fliers: how high above the ground shadow the body floats, world units. */
  hover?: number;
  /** Per row, where the feet land in the cell (fraction from the top); defaults to the baker's tight framing. */
  rowFoot?: readonly number[];
}

export interface LoadedSprite {
  def: SheetDef;
  image: HTMLImageElement;
  /** Pre-tinted copies for status effects (null if offscreen canvas isn't available). */
  ice: HTMLCanvasElement | null;
  fire: HTMLCanvasElement | null;
  /** Bosses only: a copy tinted in the boss's glow color, drawn behind the body as its aura outline. */
  glow: HTMLCanvasElement | null;
}

/** Fraction of a sheet cell (from the top) where the creature's top and feet land — fixed by the baker's tight framing. */
const SHEET_TOP = 0.02;
const SHEET_FOOT = 0.98;
/** Where the sprite's feet sit relative to the enemy's position (fraction of its height below the anchor point). */
const FOOT_ANCHOR = 0.36;

/** The biome whose sheets are always loaded first and lend a placeholder while another biome's are on their way. */
const DEFAULT_BIOME = "ANCIENT_FOREST";

const ICE = "rgba(150,225,255,0.9)";
const FIRE = "rgba(255,120,30,0.9)";

let activeBiome: string | null = null;
const biomeLoaded = new Map<string, LoadedSprite>();
const biomeRequested = new Set<string>();
const bossLoaded = new Map<string, LoadedSprite>();
const bossRequested = new Set<string>();
let startupStarted = false;

function assetBase(): string {
  return (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
}

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

function loadSheet(file: string, onLoad: (image: HTMLImageElement) => void): void {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => onLoad(image);
  image.src = `${assetBase()}sprites/enemies/${file}`;
}

export function setSpriteBiome(biomeId: string): void {
  if (activeBiome === biomeId) return;
  activeBiome = biomeId;
  preloadSpriteBiome(biomeId);
}

/** Starts loading a biome's creature sheets (and its bosses') without switching to it (idempotent). */
export function preloadSpriteBiome(biomeId: string): void {
  if (biomeRequested.has(biomeId) || typeof Image === "undefined") return;
  biomeRequested.add(biomeId);
  const entries = BIOME_ENEMY_SHEETS[biomeId];
  if (entries) {
    for (const [type, entry] of Object.entries(entries) as [EnemyType, NonNullable<(typeof entries)[EnemyType]>][]) {
      loadSheet(entry.file, (image) => {
        const def: SheetDef = { file: entry.file, frames: entry.frames, rows: 3, worldHeight: entry.worldHeight, stride: entry.stride, hover: entry.hover };
        biomeLoaded.set(`${biomeId}:${type}`, { def, image, ice: tinted(image, ICE), fire: tinted(image, FIRE), glow: null });
      });
    }
  }
  for (const phase of PHASES) {
    if (phase.biomeId !== biomeId) continue;
    preloadBossSheet(phase.mainBossId);
    if (phase.miniBossId) preloadBossSheet(phase.miniBossId);
  }
}

/** Starts loading one boss's sheet (idempotent). */
export function preloadBossSheet(bossId: string): void {
  if (bossRequested.has(bossId) || typeof Image === "undefined") return;
  const entry = BOSS_SHEETS[bossId];
  if (!entry) return;
  bossRequested.add(bossId);
  loadSheet(entry.file, (image) => {
    bossLoaded.set(bossId, { def: bossDef(entry), image, ice: tinted(image, ICE), fire: tinted(image, FIRE), glow: tinted(image, entry.glow) });
  });
}

function bossDef(entry: BossSheetEntry): SheetDef {
  return { file: entry.file, frames: entry.frames, rows: entry.rows, worldHeight: entry.worldHeight, stride: entry.stride, hover: entry.hover, rowFoot: entry.feet };
}

/** Starts the always-on loads once (idempotent, safe to call every frame): the first biome's creatures and the shared mini-bosses that roam several biomes. */
export function ensureEnemySpritesLoading(): void {
  if (startupStarted || typeof Image === "undefined") return;
  startupStarted = true;
  preloadSpriteBiome(DEFAULT_BIOME);
  for (const id of Object.keys(BOSS_SHEETS)) {
    if (!PHASES.some((p) => p.mainBossId === id || p.miniBossId === id)) preloadBossSheet(id);
  }
}

/** The loaded sheet for this creature in the biome on screen, or the same archetype's sheet from any biome already loaded while that one downloads. */
export function getEnemySprite(type: EnemyType): LoadedSprite | undefined {
  if (activeBiome) {
    const own = biomeLoaded.get(`${activeBiome}:${type}`);
    if (own) return own;
  }
  const fallback = biomeLoaded.get(`${DEFAULT_BIOME}:${type}`);
  if (fallback) return fallback;
  for (const [key, sprite] of biomeLoaded) if (key.endsWith(`:${type}`)) return sprite;
  return undefined;
}

export function getBossSprite(bossId: string): LoadedSprite | undefined {
  const sprite = bossLoaded.get(bossId);
  if (!sprite) preloadBossSheet(bossId);
  return sprite;
}

/** True when some biome has an animated sheet for this archetype. */
export function hasEnemySpriteArt(type: EnemyType): boolean {
  return Object.values(BIOME_ENEMY_SHEETS).some((sheets) => sheets[type] !== undefined);
}

function sheetEntryFor(type: EnemyType) {
  return (activeBiome ? BIOME_ENEMY_SHEETS[activeBiome]?.[type] : undefined) ?? BIOME_ENEMY_SHEETS[DEFAULT_BIOME]?.[type] ?? Object.values(BIOME_ENEMY_SHEETS).find((s) => s[type])?.[type];
}

/**
 * Height above the enemy's position where the top of its sprite sits (world
 * units, positive = up), for a given render scale — lets the HP bar sit just
 * above the creature's head instead of overlapping it.
 */
export function spriteHeadroom(type: EnemyType, scale: number): number | null {
  const entry = sheetEntryFor(type);
  if (!entry) return null;
  return (entry.worldHeight * (1 - FOOT_ANCHOR) + (entry.hover ?? 0)) * scale;
}

export function bossHeadroom(bossId: string, scale: number): number | null {
  const entry = BOSS_SHEETS[bossId];
  if (!entry) return null;
  return (entry.worldHeight * (1 - FOOT_ANCHOR) + (entry.hover ?? 0)) * scale;
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

export interface SheetDrawOptions {
  slowPercent: number;
  burning: boolean;
  /** Bosses: 0..1 through their attack animation (plays the attack row in side view), or null while walking. */
  attackProgress?: number | null;
  /** Bosses: alpha of the glow-tinted aura copy drawn behind the body (0 = none). */
  glowAlpha?: number;
  /** Bosses: how far the aura copy is blown up around the body (1.06 = 6% bigger). */
  glowScale?: number;
}

/** Where the drawn frame's feet and cell size land for this sprite at the current origin — shared by the body and its effects. */
export function sheetFootprint(sprite: LoadedSprite, timeMs: number, enemyId: string): { cellWorld: number; footY: number; hover: number } {
  const { def } = sprite;
  const visible = SHEET_FOOT - SHEET_TOP;
  const cellWorld = def.worldHeight / visible;
  const hover = def.hover ? def.hover + Math.sin(timeMs / 380 + enemyId.length) * 1.2 : 0;
  return { cellWorld, footY: def.worldHeight * FOOT_ANCHOR - hover, hover };
}

/**
 * Draws the animated creature centered on the current origin (the caller has
 * already translated/scaled to the enemy). Must be called in UNROTATED space
 * — the art is a three-quarter view, so it mirrors to face its direction
 * rather than spinning with the path.
 */
export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  sprite: LoadedSprite,
  enemyId: string,
  angle: number,
  locomotion: LocomotionState,
  timeMs: number,
  options: SheetDrawOptions,
): void {
  const { def, image } = sprite;
  const cell = image.naturalHeight / def.rows;
  const { cellWorld, footY } = sheetFootprint(sprite, timeMs, enemyId);
  const facing = facingFor(enemyId, angle);
  const attacking = options.attackProgress !== undefined && options.attackProgress !== null && def.rows > 3;

  let frame: number;
  let row: number;
  if (attacking) {
    frame = Math.min(def.frames - 1, Math.floor(options.attackProgress! * def.frames));
    row = 3;
  } else {
    const cycle = (((locomotion.distance / def.stride) % 1) + 1) % 1;
    frame = Math.floor(cycle * def.frames) % def.frames;
    row = viewFor(enemyId, angle);
  }
  const sx = frame * cell;
  const sy = row * cell;
  const dy = footY - cellWorld * (def.rowFoot?.[row] ?? SHEET_FOOT);

  ctx.save();
  ctx.scale(facing, 1);
  const blit = (src: CanvasImageSource, alpha: number, grow = 1) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const w = cellWorld * grow;
    const pivotY = footY - cellWorld * 0.45; // grow around the body's middle
    ctx.drawImage(src, sx, sy, cell, cell, -w / 2, pivotY + (dy - pivotY) * grow, w, w);
  };
  if (sprite.glow && (options.glowAlpha ?? 0) > 0) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    blit(sprite.glow, options.glowAlpha!, options.glowScale ?? 1.08);
    ctx.globalCompositeOperation = prev;
  }
  blit(image, 1);
  if (options.slowPercent > 0 && sprite.ice) blit(sprite.ice, options.slowPercent >= 1 ? 0.55 : 0.28);
  if (options.burning && sprite.fire) blit(sprite.fire, 0.18 + 0.12 * Math.sin(timeMs / 70));
  ctx.restore();
}
