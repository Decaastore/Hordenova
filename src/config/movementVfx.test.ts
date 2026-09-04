import { describe, expect, it } from "vitest";
import { getMovementVfxCategory } from "./movementVfx";
import { ENEMY_TYPES } from "./enemyStats";

describe("movementVfx (AUDITORIA E CORREÇÃO GERAL spec sections 33-38)", () => {
  it("CRAWLER stays plain (null) — the deliberate baseline every other archetype is compared against", () => {
    expect(getMovementVfxCategory("CRAWLER")).toBeNull();
  });

  it("not every archetype gets a category — spec section 34's 'não colocar tudo em todos os inimigos'", () => {
    const withCategory = ENEMY_TYPES.filter((t) => getMovementVfxCategory(t) !== null);
    expect(withCategory.length).toBeLessThan(ENEMY_TYPES.length);
    expect(withCategory.length).toBeGreaterThan(0);
  });

  it("heavy archetypes (BRUTE/SHIELDBEARER/IRONCLAD) get the DUST category", () => {
    expect(getMovementVfxCategory("BRUTE")).toBe("DUST");
    expect(getMovementVfxCategory("SHIELDBEARER")).toBe("DUST");
    expect(getMovementVfxCategory("IRONCLAD")).toBe("DUST");
  });

  it("fast archetypes (RUNNER/SWARMLING) get the TRAIL category", () => {
    expect(getMovementVfxCategory("RUNNER")).toBe("TRAIL");
    expect(getMovementVfxCategory("SWARMLING")).toBe("TRAIL");
  });

  it("every returned category is one of the defined enum values (never garbage)", () => {
    const valid = new Set(["DUST", "TRAIL", "WISP", "SHADOW"]);
    for (const type of ENEMY_TYPES) {
      const category = getMovementVfxCategory(type);
      if (category !== null) expect(valid.has(category)).toBe(true);
    }
  });

  it("is a pure, deterministic function — same type always returns the same category", () => {
    for (const type of ENEMY_TYPES) {
      expect(getMovementVfxCategory(type)).toBe(getMovementVfxCategory(type));
    }
  });
});
