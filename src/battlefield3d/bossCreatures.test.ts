import { describe, expect, it } from "vitest";
import { BOSS_CREATURE, CREATURE_FILES, creatureFor } from "./creatures";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { PHASES } from "@/config/phaseConfig";

describe("boss creatures", () => {
  it("gives every Boss and Mini-Boss one of the Mixamo monsters", () => {
    for (const id of [...Object.keys(MAIN_BOSSES), ...Object.keys(MINI_BOSSES)]) {
      expect(BOSS_CREATURE[id], id).toBeDefined();
      expect(CREATURE_FILES[BOSS_CREATURE[id]!]).toBeDefined();
    }
  });

  it("uses the whole roster, not just two bodies", () => {
    expect(new Set(Object.values(BOSS_CREATURE)).size).toBe(Object.keys(CREATURE_FILES).length);
  });

  it("never repeats a body between neighbouring regions' bosses, nor between a region's Boss and its Mini-Boss", () => {
    const phases = PHASES.filter((p) => MAIN_BOSSES[p.mainBossId]);
    phases.forEach((p, i) => {
      if (i > 0) expect(BOSS_CREATURE[p.mainBossId]).not.toBe(BOSS_CREATURE[phases[i - 1]!.mainBossId]);
      if (p.miniBossId) expect(BOSS_CREATURE[p.miniBossId]).not.toBe(BOSS_CREATURE[p.mainBossId]);
    });
  });

  it("creatureFor picks the boss's own body", () => {
    expect(creatureFor("BRUTE", true, true, "glacial-sovereign")).toBe("brute2");
    expect(creatureFor("BRUTE", true, false, "unknown")).toBe("pumpkin");
  });
});
