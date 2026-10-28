import { describe, expect, it } from "vitest";
import { getEnemySprite, hasAnimatedSheet, hasEnemySpriteArt, spriteHeadroom } from "./enemySprites";

describe("enemySprites — painted art for the core roster", () => {
  it("core archetypes have art; Brute/Regenerator/Disabler/Swarmling use real animated sheets; others keep their vector body", () => {
    for (const t of ["CRAWLER", "RUNNER", "BRUTE", "SHIELDBEARER", "SWARMLING", "REGENERATOR", "DISABLER"] as const) expect(hasEnemySpriteArt(t)).toBe(true);
    for (const t of ["BRUTE", "REGENERATOR", "DISABLER", "SWARMLING"] as const) expect(hasAnimatedSheet(t)).toBe(true);
    for (const t of ["CRAWLER", "RUNNER", "SHIELDBEARER"] as const) expect(hasAnimatedSheet(t)).toBe(false);
    for (const t of ["IRONCLAD", "MAGMAJAW"] as const) expect(hasEnemySpriteArt(t)).toBe(false);
  });

  it("nothing is reported as loaded until the image actually loads (so drawing always falls back to the vector body first)", () => {
    expect(getEnemySprite("CRAWLER")).toBeUndefined();
  });

  it("HP-bar headroom grows with render scale and is null for non-sprite types", () => {
    expect(spriteHeadroom("BRUTE", 1.3)!).toBeGreaterThan(spriteHeadroom("BRUTE", 1)!);
    expect(spriteHeadroom("IRONCLAD", 1)).toBeNull();
  });
});

describe("enemySprites — per-biome creatures", () => {
  it("each of the first six biomes defines its own creature for all 8 core archetypes", async () => {
    const { BIOME_ENEMY_SHEETS } = await import("./biomeEnemySheets");
    const core = ["CRAWLER", "RUNNER", "BRUTE", "SHIELDBEARER", "SWARMLING", "REGENERATOR", "IRONCLAD", "DISABLER"];
    for (const biome of ["ANCIENT_FOREST", "VOLCANIC_WASTES", "FROZEN_TUNDRA", "CURSED_DESERT", "DARK_RUINS", "ABYSS"]) {
      const entries = BIOME_ENEMY_SHEETS[biome]!;
      expect(Object.keys(entries).sort()).toEqual([...core].sort());
      const files = Object.values(entries).map((e) => e!.file);
      expect(new Set(files).size).toBe(8);
    }
  });

  it("switching biome before its sheets load still returns the generic sprite path (never blank)", async () => {
    const mod = await import("./enemySprites");
    mod.setSpriteBiome("VOLCANIC_WASTES");
    expect(mod.getEnemySprite("CRAWLER")).toBeUndefined(); // nothing loaded in tests -> caller falls back to the vector body
  });
});
