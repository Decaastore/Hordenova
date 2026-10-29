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

/** Screen-space sine of the bake camera's elevation — turns a ground direction into the on-screen turret heading. */
export const TOWER_VIEW_SIN_ELEV = Math.sin((38 * Math.PI) / 180);

/** Current turret heading per tower id (radians, 0 = screen-right, clockwise), written by the renderer each frame. */
const towerAim = new Map<string, number>();
export function setTowerAim(towerId: string, heading: number): void {
  towerAim.set(towerId, heading);
}
export function getTowerAim(towerId: string): number | undefined {
  return towerAim.get(towerId);
}
export function pruneTowerAims(liveIds: ReadonlySet<string>): void {
  for (const id of towerAim.keys()) if (!liveIds.has(id)) towerAim.delete(id);
}

export interface LoadedTowerTurret {
  image: HTMLImageElement;
  frames: number;
  /** Frame-local anchor in tower-local coordinates, interpolated between the two frames nearest `heading`. */
  anchorAt(name: string, heading: number): { x: number; y: number } | null;
}

export interface LoadedTowerSprite {
  image: HTMLImageElement;
  entry: TowerSpriteEntry;
  turret: LoadedTowerTurret | null;
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
      for (const file of [other.file, other.turret?.file]) {
        if (!file || cache.has(file)) continue;
        const pre = new Image();
        pre.src = `${import.meta.env.BASE_URL}sprites/${file}`;
        cache.set(file, pre);
      }
    }
  }
  if (!img.complete || img.naturalWidth === 0) return null;
  let turretImg: HTMLImageElement | null = null;
  if (entry.turret) {
    turretImg = cache.get(entry.turret.file) ?? null;
    if (!turretImg) {
      turretImg = new Image();
      turretImg.decoding = "async";
      turretImg.src = `${import.meta.env.BASE_URL}sprites/${entry.turret.file}`;
      cache.set(entry.turret.file, turretImg);
    }
    // Never draw a turreted tower without its turret.
    if (!turretImg.complete || turretImg.naturalWidth === 0) return null;
  }
  const size = TOWER_SPRITE_WORLD_SIZE;
  const [bx, by] = entry.anchors.base ?? [0.5, 0.7];
  const ox = -size * bx;
  const oy = TOWER_BASE_LOCAL_Y - size * by;
  const t = entry.turret;
  const turret: LoadedTowerTurret | null =
    t && turretImg
      ? {
          image: turretImg,
          frames: t.frames,
          anchorAt(name: string, heading: number) {
            const f = (((heading / (Math.PI * 2)) * t.frames) % t.frames + t.frames) % t.frames;
            const i0 = Math.floor(f) % t.frames;
            const i1 = (i0 + 1) % t.frames;
            const k = f - Math.floor(f);
            const a = t.anchors[i0]?.[name];
            const b = t.anchors[i1]?.[name];
            if (!a || !b) return null;
            return { x: ox + size * (a[0] + (b[0] - a[0]) * k), y: oy + size * (a[1] + (b[1] - a[1]) * k) };
          },
        }
      : null;
  return {
    image: img,
    entry,
    turret,
    origin: { x: ox, y: oy, size },
    anchor(name: string) {
      const a = entry.anchors[name];
      return a ? { x: ox + size * a[0], y: oy + size * a[1] } : null;
    },
  };
}
