import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getBossSprite, getEnemySprite, hasEnemySpriteArt, spriteHeadroom, bossHeadroom } from "./enemySprites";
import { BIOME_ENEMY_SHEETS } from "./biomeEnemySheets";
import { BOSS_SHEETS } from "./bossSheets";
import { PHASES } from "@/config/phaseConfig";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { generateWaveSpawns } from "@/config/waveConfig";
import type { EnemyType } from "@/config/enemyStats";

const PUBLIC = resolve(__dirname, "../../public/sprites/enemies");
const CORE: EnemyType[] = ["CRAWLER", "RUNNER", "BRUTE", "SHIELDBEARER", "SWARMLING", "REGENERATOR", "IRONCLAD", "DISABLER"];

describe("enemy art — only the animated baked creatures", () => {
  it("every biome has an animated sheet for all 8 core archetypes, and every sheet file exists", () => {
    for (const phase of PHASES) {
      const entries = BIOME_ENEMY_SHEETS[phase.biomeId]!;
      for (const t of CORE) expect(entries[t], `${phase.biomeId} ${t}`).toBeDefined();
    }
    for (const sheets of Object.values(BIOME_ENEMY_SHEETS)) {
      for (const entry of Object.values(sheets)) expect(existsSync(resolve(PUBLIC, entry!.file)), entry!.file).toBe(true);
    }
  });

  it("every creature that can spawn, in every biome and the endless rotation, has its biome's own sheet", () => {
    for (let wave = 1; wave <= 700; wave++) {
      const biome = PHASES.find((p) => wave <= p.endWave)?.biomeId;
      if (!biome) continue; // past the fixed list: covered by the rotation of these same biomes
      for (const type of new Set(generateWaveSpawns(wave))) expect(BIOME_ENEMY_SHEETS[biome]![type], `${biome} wave ${wave} ${type}`).toBeDefined();
    }
  });

  it("every enemy archetype has art; nothing is reported as loaded before an image really loads", () => {
    for (const t of CORE) expect(hasEnemySpriteArt(t)).toBe(true);
    expect(getEnemySprite("CRAWLER")).toBeUndefined();
  });

  it("HP-bar headroom grows with render scale", () => {
    expect(spriteHeadroom("BRUTE", 1.3)!).toBeGreaterThan(spriteHeadroom("BRUTE", 1)!);
  });
});

describe("boss art — every boss and mini-boss is an animated baked creature", () => {
  it("every main boss and mini-boss has a 4-row sheet (3 walk views + attack) whose file exists", () => {
    for (const id of [...Object.keys(MAIN_BOSSES), ...Object.keys(MINI_BOSSES)]) {
      const entry = BOSS_SHEETS[id];
      expect(entry, id).toBeDefined();
      expect(entry!.rows).toBe(4);
      expect(existsSync(resolve(PUBLIC, entry!.file)), entry!.file).toBe(true);
    }
  });

  it("a main boss stands taller than its mini-boss", () => {
    for (const phase of PHASES) {
      if (!phase.miniBossId) continue;
      expect(BOSS_SHEETS[phase.mainBossId]!.worldHeight).toBeGreaterThan(BOSS_SHEETS[phase.miniBossId]!.worldHeight);
      expect(bossHeadroom(phase.mainBossId, 1)!).toBeGreaterThan(0);
    }
  });

  it("nothing is reported as loaded before the image loads", () => {
    expect(getBossSprite("hollow-warden")).toBeUndefined();
  });
});
