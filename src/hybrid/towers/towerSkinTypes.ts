/**
 * PROVA DE CONCEITO — SKIN LAB. This is the contract a future paid Tower
 * Skin would fill in. The point of typing it this explicitly (rather than
 * just "color: string") is to force every skin to answer for SEVEN
 * independent axes — base, body, ornaments, core, side elements, and
 * effects — instead of one color swap. A skin that only changes
 * `body.textureBase`/`textureDark` and leaves every `variant` field alone
 * IS a recolor, and should read as one; the two skins built for this lab
 * (`ironwoodBaseSkin` / `ironwoodEmberSkin`) deliberately change the
 * `variant` on every part precisely so the difference is never just color.
 */

export type BaseShapeVariant = "broken-rock" | "obsidian-shard-cluster";
export type BodyProfileVariant = "gnarled-trunk" | "twisted-spire";
export type OrnamentVariant = "curled-iron-prongs" | "jagged-horn-vents";
export type CoreVariant = "faceted-rune-crystal" | "molten-ember-core";

export interface TowerSkinDefinition {
  id: string;
  name: string;
  /** One-line pitch — what a store listing would say. */
  description: string;

  base: {
    variant: BaseShapeVariant;
    color: number;
    roughness: number;
    metalness: number;
    /** Emissive vein/crack color running through the base — 0 disables. */
    veinColor: number;
  };

  body: {
    variant: BodyProfileVariant;
    textureBase: number;
    textureDark: number;
    /** The structural drum's own stone tone — deliberately separate from
     * `base.color` (the ground-level foundation rock). Without its own
     * value, the drum and foundation render as the same dark tone and
     * visually fuse into one undifferentiated mass. */
    stoneColor: number;
    roughness: number;
    metalness: number;
    bandColor: number;
    bandRoughness: number;
    bandMetalness: number;
  };

  ornaments: {
    variant: OrnamentVariant;
    count: number;
    color: number;
    roughness: number;
    metalness: number;
    /** Emissive tip color — 0 disables the glowing-tip look. */
    tipGlow: number;
  };

  core: {
    variant: CoreVariant;
    shellColor: number;
    emissive: number;
    emissiveIntensity: number;
    crackColor: number;
    scale: number;
    pulseSpeed: number;
  };

  sideElements: {
    chainColor: number;
    chainCount: number;
    glowColor: number;
  };

  effects: {
    boltColor: number;
    impactColor: number;
  };
}
