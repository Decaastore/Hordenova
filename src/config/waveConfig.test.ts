import { describe, expect, it } from "vitest";
import { generateWaveSpawns, isBonusEliteWave } from "./waveConfig";
import { PHASES } from "./phaseConfig";

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

/**
 * 10-biome expansion regression contract — REAL bug this catches: every
 * new phase's enemyPool is exclusively 3 brand-new archetypes with no
 * overlap with the original 8-archetype roster `tierWeightsForWave`
 * hardcodes. Before weightsForWave() got an exclusive-pool branch, every
 * wave in these phases silently fell through to the "empty weight table"
 * safety net and spawned nothing but CRAWLER — the new creatures were
 * registered, drawn, and balanced, but structurally UNREACHABLE in real
 * play. Caught via live browser verification (waves actually spawning
 * only Crawler in a Dwarven Undercity wave), not by any prior test.
 */
describe("waveConfig — 10-biome expansion exclusive pools are actually reachable", () => {
  const expansionPhaseIds = [
    "DWARVEN_UNDERCITY", "COLOSSUS_GRAVEYARD", "FLOATING_ISLES", "LOST_SUN_TEMPLE", "CRYSTAL_SEA",
    "ABYSSAL_FORTRESS", "ASHEN_VALLEY", "MOON_GARDENS", "DEFILED_CATHEDRAL", "LEVIATHAN_COAST",
  ];

  it("every wave in every 10-biome-expansion phase spawns ONLY that phase's own exclusive archetypes — never CRAWLER or any other original-roster type", () => {
    for (const id of expansionPhaseIds) {
      const phase = PHASES.find((p) => p.id === id)!;
      const allowed = new Set(phase.enemyPool);
      for (let wave = phase.startWave; wave < phase.endWave; wave++) {
        const spawns = generateWaveSpawns(wave);
        expect(spawns.length, `wave ${wave}`).toBeGreaterThan(0);
        for (const type of spawns) {
          expect(allowed.has(type), `wave ${wave} spawned ${type}, not in ${id}'s pool`).toBe(true);
        }
      }
    }
  });

  it("every archetype in a 10-biome-expansion phase's pool actually appears at least once across its 20 waves (no dead/unreachable archetype)", () => {
    for (const id of expansionPhaseIds) {
      const phase = PHASES.find((p) => p.id === id)!;
      const seen = new Set<string>();
      for (let wave = phase.startWave; wave < phase.endWave; wave++) {
        for (const type of generateWaveSpawns(wave)) seen.add(type);
      }
      for (const type of phase.enemyPool) {
        expect(seen.has(type), `${id}'s ${type} never spawned across its whole phase`).toBe(true);
      }
    }
  });

  it("a SWARM-tagged wave in a 10-biome-expansion phase still generates a real, non-empty spawn list", () => {
    for (const id of expansionPhaseIds) {
      const phase = PHASES.find((p) => p.id === id)!;
      const swarmWave = Object.entries(phase.waveTags).find(([, tag]) => tag === "SWARM")?.[0];
      expect(swarmWave, `${id} has no SWARM wave configured`).toBeDefined();
      const spawns = generateWaveSpawns(Number(swarmWave));
      expect(spawns.length).toBeGreaterThan(0);
    }
  });
});
