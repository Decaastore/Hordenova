import { describe, expect, it } from "vitest";
import { isBonusEliteWave } from "./waveConfig";

describe("waveConfig — isBonusEliteWave (Master Implementation Pass spec section 9-10 elite density)", () => {
  it("never fires before wave 300 — early/mid-game is completely unaffected", () => {
    for (const wave of [1, 50, 130, 200, 299, 300]) {
      expect(isBonusEliteWave(wave)).toBe(false);
    }
  });

  it("fires at some real cadence past wave 300", () => {
    let count = 0;
    for (let wave = 301; wave <= 1000; wave++) {
      if (isBonusEliteWave(wave)) count++;
    }
    expect(count).toBeGreaterThan(0);
  });

  it("never fires more often than every ELITE_DENSITY_MIN_INTERVAL (5) waves, even at extreme wave numbers", () => {
    for (const start of [301, 10_000, 100_000, 1_000_000]) {
      let lastHit = -Infinity;
      for (let wave = start; wave < start + 200; wave++) {
        if (isBonusEliteWave(wave)) {
          expect(wave - lastHit).toBeGreaterThanOrEqual(5);
          lastHit = wave;
        }
      }
    }
  });

  it("never throws or misbehaves at extreme wave numbers (spec section 47 numerical safety)", () => {
    for (const wave of [100_000, 1_000_000, 3_000_000, 10_000_000]) {
      expect(() => isBonusEliteWave(wave)).not.toThrow();
      expect(typeof isBonusEliteWave(wave)).toBe("boolean");
    }
  });
});
