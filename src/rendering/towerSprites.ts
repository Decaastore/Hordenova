import { TOWER_SPRITES, TOWER_SPRITE_WORLD_SIZE, type TowerSpriteEntry } from "./towerSpriteMeta";

/**
 * Pre-rendered 3D tower bodies (see towerSpriteMeta.ts), loaded lazily per
 * tower type + skin the first time one is drawn. Until an image has loaded
 * (or for a type/skin with no bake yet) `getTowerSprite` returns null and
 * the caller keeps drawing the original vector tower.
 */

/** Local y (tower space, before TOWER_PRESENTATION_SCALE) of the ground point under the tower — matches the build platform's centre. */
export const TOWER_BASE_LOCAL_Y = 3.9;

const cache = new Map<string, HTMLImageElement>();

export interface LoadedTowerSprite {
  image: HTMLImageElement;
  entry: TowerSpriteEntry;
  /** Converts an anchor name to tower-local coordinates (null if the bake has no such anchor). */
  anchor(name: string): { x: number; y: number } | null;
  /** Top-left corner and size to pass to drawImage in tower-local coordinates. */
  origin: { x: number; y: number; size: number };
}

export function getTowerSprite(type: string, skinId: string | null, stage: number): LoadedTowerSprite | null {
  const bySkin = TOWER_SPRITES[type]?.[skinId ?? "base"];
  const entry = bySkin?.[stage];
  if (!entry || typeof Image === "undefined") return null;
  let img = cache.get(entry.file);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = `${import.meta.env.BASE_URL}sprites/${entry.file}`;
    cache.set(entry.file, img);
    // Warm the other stages of this type/skin so levelling up never flashes the old art.
    for (const other of Object.values(bySkin!)) {
      if (cache.has(other.file)) continue;
      const pre = new Image();
      pre.src = `${import.meta.env.BASE_URL}sprites/${other.file}`;
      cache.set(other.file, pre);
    }
  }
  if (!img.complete || img.naturalWidth === 0) return null;
  const size = TOWER_SPRITE_WORLD_SIZE;
  const [bx, by] = entry.anchors.base ?? [0.5, 0.7];
  const ox = -size * bx;
  const oy = TOWER_BASE_LOCAL_Y - size * by;
  return {
    image: img,
    entry,
    origin: { x: ox, y: oy, size },
    anchor(name: string) {
      const a = entry.anchors[name];
      return a ? { x: ox + size * a[0], y: oy + size * a[1] } : null;
    },
  };
}
