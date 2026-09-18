/**
 * Side-effect entry point: importing this module registers every 10-biome
 * expansion creature into ./registry's NEW_ENEMY_RENDERERS /
 * BOSS_CREATURE_RENDERERS. EntityRenderer.ts imports this once; each biome
 * file below is otherwise completely independent of the others.
 */
import "./dwarvenUndercity";
import "./colossusGraveyard";
import "./floatingIsles";
import "./lostSunTemple";
import "./crystalSea";
import "./abyssalFortress";
import "./ashenValley";
import "./moonGardens";
import "./defiledCathedral";
import "./leviathanCoast";
import "./ancientForest";
import "./volcanicWastes";
import "./frozenTundra";
import "./cursedDesert";
import "./darkRuins";
import "./abyss";
import "./originalMiniBosses";

export { NEW_ENEMY_RENDERERS, BOSS_CREATURE_RENDERERS } from "./registry";
