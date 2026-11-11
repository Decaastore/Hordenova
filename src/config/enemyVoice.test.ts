import { describe, expect, it } from "vitest";
import { ENEMY_TYPES } from "./enemyStats";
import { ENEMY_VOICE_FAMILY } from "./enemyVoice";
import { SFX_ASSETS } from "@/audio/sfxCatalog";

describe("enemy voices", () => {
  it("every enemy has a voice family with both takes in the catalog", () => {
    for (const type of ENEMY_TYPES) {
      const family = ENEMY_VOICE_FAMILY[type];
      expect(family, type).toBeDefined();
      expect(SFX_ASSETS[`death_${family}_1` as keyof typeof SFX_ASSETS]).toBeDefined();
      expect(SFX_ASSETS[`death_${family}_2` as keyof typeof SFX_ASSETS]).toBeDefined();
    }
  });
});
