import { describe, expect, it } from "vitest";
import { getEnemySprite, hasEnemySpriteArt, spriteHeadroom } from "./enemySprites";

describe("enemySprites — painted art for the core roster", () => {
  it("the four core archetypes have painted art; others keep their vector body", () => {
    for (const t of ["CRAWLER", "RUNNER", "BRUTE", "SHIELDBEARER"] as const) expect(hasEnemySpriteArt(t)).toBe(true);
    for (const t of ["SWARMLING", "REGENERATOR", "IRONCLAD", "DISABLER", "MAGMAJAW"] as const) expect(hasEnemySpriteArt(t)).toBe(false);
  });

  it("nothing is reported as loaded until the image actually loads (so drawing always falls back to the vector body first)", () => {
    expect(getEnemySprite("CRAWLER")).toBeUndefined();
  });

  it("HP-bar headroom grows with render scale and is null for non-sprite types", () => {
    expect(spriteHeadroom("BRUTE", 1.3)!).toBeGreaterThan(spriteHeadroom("BRUTE", 1)!);
    expect(spriteHeadroom("SWARMLING", 1)).toBeNull();
  });
});
