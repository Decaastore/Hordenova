/**
 * PROVA DE CONCEITO — SKIN LAB. Same idea as `towerSkinTypes.ts` applied to
 * the castle: separate axes for the parts a future paid Castle Skin would
 * plausibly replace — foundation, walls, keep, roof, the ward crystal
 * (the castle's "core", equivalent to a tower's crystal), banners,
 * torches and buttress ribs — so a "Castelo Infernal"/"Glacial"/
 * "Corrompido" pass later only needs a new object of this shape, not new
 * component code.
 */
export interface CastleSkinDefinition {
  id: string;
  name: string;
  description: string;

  foundation: { textureBase: number; textureDark: number; roughness: number };
  wall: { textureBase: number; textureDark: number; roughness: number; crenelColor: number };
  keep: { textureBase: number; textureDark: number; roughness: number; bandColor: number; bandMetalness: number };
  roof: { color: number; roughness: number; metalness: number };
  wardCrystal: { shellColor: number; emissive: number; emissiveIntensity: number; crackColor: number };
  banner: { color: number };
  torchColor: number;
  buttressColor: number;
}
