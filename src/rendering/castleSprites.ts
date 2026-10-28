import type { Vector2 } from "@/utils/geometry";

/**
 * REALISTIC CASTLE — the fortress at the end of the road is a detailed 3D
 * model (cut-stone walls, crenellations, round flanking towers with slate
 * roofs, a gatehouse with doors and an iron portcullis, a lit keep) rendered
 * offline into one image per biome look and per damage tier, in
 * public/sprites/castle/<dressing>_<tier>.webp. Same layout as the original
 * hand-drawn fortress: tall keep behind, two round towers, the gate between.
 *
 * The images carry the static structure (and the baked damage: cracks from
 * tier 2, a broken tower and lowered portcullis from tier 3, a collapsed keep
 * roof at tier 4). Everything that moves — banners, torch flames, window
 * flicker, the keystone crystal's pulse, smoke and fire — is still drawn live
 * on top in 2D, positioned with the anchor points exported by the renderer.
 */

/** Which of the six rendered looks each biome uses. */
const DRESSING_FOR_BIOME: Record<string, string> = {
  ANCIENT_FOREST: "ancient_forest",
  VOLCANIC_WASTES: "volcanic_wastes",
  FROZEN_TUNDRA: "frozen_tundra",
  CURSED_DESERT: "cursed_desert",
  DARK_RUINS: "dark_ruins",
  ABYSS: "abyss",
  DWARVEN_UNDERCITY: "volcanic_wastes",
  ASHEN_VALLEY: "volcanic_wastes",
  COLOSSUS_GRAVEYARD: "dark_ruins",
  DEFILED_CATHEDRAL: "dark_ruins",
  FLOATING_ISLES: "ancient_forest",
  MOON_GARDENS: "ancient_forest",
  LEVIATHAN_COAST: "ancient_forest",
  LOST_SUN_TEMPLE: "cursed_desert",
  CRYSTAL_SEA: "frozen_tundra",
  ABYSSAL_FORTRESS: "abyss",
};

/** World-space size the rendered square image is drawn at (the render framed 148x148 model units; drawn ~16% larger so the castle keeps the presence of the old one). */
export const CASTLE_SPRITE_SIZE = 172;
/** Local y (fortress space) where the castle's ground center sits — matches the old platform. */
const BASE_LOCAL_Y = 12;

type Anchors = Record<string, [number, number]>;
const ANCHORS_INTACT: Anchors = { keepWindow: [0.5121, 0.3967], bannerKeep: [0.5335, 0.0561], core: [0.4752, 0.63], bannerGate: [0.4851, 0.5053], torchL: [0.4167, 0.6728], torchR: [0.5271, 0.6877], gate: [0.4726, 0.7357], towerWindowL: [0.2475, 0.5937], bannerTowerL: [0.268, 0.2547], towerWindowR: [0.6892, 0.6532], bannerTowerR: [0.7097, 0.3142], base: [0.5, 0.7386] };
const ANCHORS_BROKEN: Anchors = { keepWindow: [0.5121, 0.3967], bannerKeep: [0.5335, 0.0561], core: [0.4752, 0.63], bannerGate: [0.4851, 0.5053], torchL: [0.4167, 0.6728], torchR: [0.5271, 0.6877], gate: [0.4726, 0.7357], towerWindowL: [0.2475, 0.5937], bannerTowerL: [0.268, 0.4707], towerWindowR: [0.6892, 0.6532], bannerTowerR: [0.7097, 0.3142], base: [0.5, 0.7386] };

const images = new Map<string, HTMLImageElement>();
const requested = new Set<string>();

function base(): string {
  return (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
}

/** The loaded castle image for this biome + tier (1..4), or undefined while loading / unavailable (caller falls back to the 2D drawing). */
export function getCastleSprite(biomeId: string, tier: number): HTMLImageElement | undefined {
  const dressing = DRESSING_FOR_BIOME[biomeId] ?? "ancient_forest";
  if (!requested.has(dressing) && typeof Image !== "undefined") {
    requested.add(dressing);
    for (let t = 1; t <= 4; t++) {
      const img = new Image();
      img.decoding = "async";
      const key = `${dressing}_${t}`;
      img.onload = () => images.set(key, img);
      img.src = `${base()}sprites/castle/${key}.webp`;
    }
  }
  return images.get(`${dressing}_${Math.min(4, Math.max(1, tier))}`);
}

/** Top-left of the image in fortress-local space. */
export function castleSpriteOrigin(): Vector2 {
  const b = ANCHORS_INTACT.base!;
  return { x: -CASTLE_SPRITE_SIZE * b[0], y: BASE_LOCAL_Y - CASTLE_SPRITE_SIZE * b[1] };
}

/** An anchor point (banner pole tip, torch, window, gate, crystal...) in fortress-local space. */
export function castleAnchor(name: string, tier: number): Vector2 {
  const set = tier >= 3 ? ANCHORS_BROKEN : ANCHORS_INTACT;
  const a = set[name] ?? ANCHORS_INTACT[name] ?? [0.5, 0.5];
  const o = castleSpriteOrigin();
  return { x: o.x + a[0] * CASTLE_SPRITE_SIZE, y: o.y + a[1] * CASTLE_SPRITE_SIZE };
}
