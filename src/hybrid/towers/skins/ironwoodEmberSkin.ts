import type { TowerSkinDefinition } from "../towerSkinTypes";

/**
 * IRONWOOD — NÚCLEO DE BRASA (premium variant, the "would this sell for
 * Gems" test case). Every axis changes shape or material, not just hue:
 * the rock skirt becomes a cluster of jagged obsidian shards instead of a
 * flat broken-rock plate; the gnarled wood trunk becomes a taller,
 * helically twisted obsidian spire; the curled iron prongs become
 * outward-jutting horn-vents with glowing tips; the faceted green crystal
 * becomes a cracked molten-shell orb. Original design — deliberately NOT
 * a reskin of any existing game's "fire tower," just HORDENOVA's own
 * volcanic/abyssal palette applied to a genuinely different silhouette.
 */
export const ironwoodEmberSkin: TowerSkinDefinition = {
  id: "ironwood-ember-core",
  name: "Ironwood — Núcleo de Brasa",
  description: "Variante premium: espinhos de obsidiana, um pilar torcido e um núcleo de rocha derretida.",
  base: {
    variant: "obsidian-shard-cluster",
    color: 0x14100e,
    roughness: 0.55,
    metalness: 0.15,
    veinColor: 0xff5a1f,
  },
  body: {
    variant: "twisted-spire",
    textureBase: 0x1c1512,
    textureDark: 0x080605,
    roughness: 0.4,
    metalness: 0.35,
    bandColor: 0x2b211c,
    bandRoughness: 0.5,
    bandMetalness: 0.6,
  },
  ornaments: {
    variant: "jagged-horn-vents",
    count: 5,
    color: 0x1a1310,
    roughness: 0.45,
    metalness: 0.3,
    tipGlow: 0xff8a3c,
  },
  core: {
    variant: "molten-ember-core",
    shellColor: 0x1a0d08,
    emissive: 0xff5a1f,
    emissiveIntensity: 3.2,
    crackColor: 0xffb454,
    scale: 1.15,
    pulseSpeed: 2.6,
  },
  sideElements: {
    chainColor: 0x231512,
    chainCount: 3,
    glowColor: 0xff8a3c,
  },
  effects: {
    boltColor: 0xff6a2c,
    impactColor: 0xffb454,
  },
};
