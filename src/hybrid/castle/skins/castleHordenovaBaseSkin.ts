import { FOREST, GOLD } from "@/lab3d/palette";
import type { CastleSkinDefinition } from "../castleSkinTypes";

/**
 * CASTELO — BASE (fortaleza HORDENOVA). The only skin implemented for
 * this lab step, on purpose ("não implemente todas") — its job is to
 * prove the `CastleSkinDefinition` shape can drive a real, detailed
 * keep, not to ship every conceptual variant from the brief.
 */
export const castleHordenovaBaseSkin: CastleSkinDefinition = {
  id: "castle-hordenova-base",
  name: "Fortaleza Hordenova",
  description: "A última bastião: pedra escura, torres gêmeas, um cristal de guarda arcano sobre o portão.",
  foundation: { textureBase: 0x4a4438, textureDark: FOREST.rockDark, roughness: 0.95 },
  wall: { textureBase: 0x5a5145, textureDark: 0x241b12, roughness: 0.92, crenelColor: 0x453d32 },
  keep: { textureBase: 0x5a5145, textureDark: 0x241b12, roughness: 0.88, bandColor: 0x2f2a22, bandMetalness: 0.35 },
  roof: { color: 0x241a10, roughness: 0.8, metalness: 0.05 },
  wardCrystal: { shellColor: 0x0c1420, emissive: FOREST.accentGlow, emissiveIntensity: 2.4, crackColor: FOREST.accentGlow },
  banner: { color: GOLD },
  torchColor: FOREST.accentWarm,
  buttressColor: 0x2f2a22,
};
