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
