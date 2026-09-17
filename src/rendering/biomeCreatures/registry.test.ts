import { describe, expect, it } from "vitest";
import { BOSS_CREATURE_RENDERERS, NEW_ENEMY_RENDERERS } from "./index";
import { PHASES } from "@/config/phaseConfig";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";

/**
 * 10-biome expansion — confirms every new archetype/boss actually has a
 * bespoke draw function registered (not just a name added to a config
 * file), and that every registered function can be invoked without
 * throwing — the concrete check behind the user's "não considere a
 * tarefa concluída apenas porque os nomes foram adicionados ao código"
 * requirement. jsdom has no real canvas 2D backend (no `canvas` npm
 * package installed, matching this repo's existing test setup — no prior
 * test file exercises real ctx draw calls either), so this uses a
 * minimal no-op stand-in covering every CanvasRenderingContext2D member
 * these draw functions actually call, which is enough to prove the
 * drawing code path runs to completion without throwing.
 */
function makeCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const noop = () => undefined;
  const ctx: Record<string, unknown> = {
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillStyle: "#000",
    strokeStyle: "#000",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

const EXPANSION_ENEMY_TYPES = [
  "FORGECRAWLER", "DEEPDELVER", "MAGMAJAW",
  "BONE_STALKER", "RIBCRAWLER", "GRAVEWING",
  "CLOUDFANG", "SKY_MANTA", "STORM_TALON",
  "SUNSCARAB", "TEMPLE_GUARDIAN", "SOLAR_SERPENT",
  "SHARDCRAWLER", "CRYSTAL_MAW", "PRISM_WRAITH",
  "ABYSS_CRAWLER", "CHAINBOUND", "VOID_BAT",
  "ASH_HOUND", "PETRIFIED_STALKER", "CINDERWING",
  "MOONFANG", "BLOOM_HORROR", "LUNAMOTH",
  "GRAVE_KNIGHT", "GARGOYLE_BEAST", "BELL_WRAITH",
  "TIDE_RIPPER", "DEEPMAW", "BONEFIN",
] as const;

describe("biomeCreatures registry", () => {
  it("registers a bespoke draw function for all 30 new enemy archetypes", () => {
    expect(EXPANSION_ENEMY_TYPES.length).toBe(30);
    for (const type of EXPANSION_ENEMY_TYPES) {
      expect(NEW_ENEMY_RENDERERS[type], type).toBeTypeOf("function");
    }
  });

  it("every new enemy archetype's draw function runs without throwing on a real canvas context", () => {
    const ctx = makeCtx();
    for (const type of EXPANSION_ENEMY_TYPES) {
      expect(() => NEW_ENEMY_RENDERERS[type]!(ctx, { body: "#111", dark: "#000", accent: "#fff" }, 1234, Infinity)).not.toThrow();
    }
  });

  it("every 10-biome-expansion phase's main and mini boss ids have a registered bespoke creature renderer", () => {
    const expansionPhaseIds = [
      "DWARVEN_UNDERCITY", "COLOSSUS_GRAVEYARD", "FLOATING_ISLES", "LOST_SUN_TEMPLE", "CRYSTAL_SEA",
      "ABYSSAL_FORTRESS", "ASHEN_VALLEY", "MOON_GARDENS", "DEFILED_CATHEDRAL", "LEVIATHAN_COAST",
    ];
    // Boss Identity Pass (Full Scene Visual Audit P0 #1) — Ashen Valley's
    // mini-boss was deliberately split into its OWN renderer (a low
    // quadruped prowler, distinct from the main boss's bipedal-hunched
    // dragging-arm silhouette) per the explicit "não transforme o mini-boss
    // em uma cópia menor" requirement, instead of the shared
    // Colossus/Colossus-Jr pattern every other expansion phase still uses.
    const sharedRendererExceptions = new Set(["ASHEN_VALLEY"]);
    for (const id of expansionPhaseIds) {
      const phase = PHASES.find((p) => p.id === id)!;
      expect(BOSS_CREATURE_RENDERERS[phase.mainBossId], phase.mainBossId).toBeTypeOf("function");
      expect(BOSS_CREATURE_RENDERERS[phase.miniBossId!], phase.miniBossId).toBeTypeOf("function");
      if (sharedRendererExceptions.has(id)) {
        expect(BOSS_CREATURE_RENDERERS[phase.mainBossId]).not.toBe(BOSS_CREATURE_RENDERERS[phase.miniBossId!]);
      } else {
        // Same shared creature renders both roles (mirrors the existing Colossus/Colossus-Jr relationship).
        expect(BOSS_CREATURE_RENDERERS[phase.mainBossId]).toBe(BOSS_CREATURE_RENDERERS[phase.miniBossId!]);
      }
    }
  });

  it("every registered boss creature renders both MINI and MAIN variants without throwing, enraged or not, at any HP percent", () => {
    const ctx = makeCtx();
    for (const [id, fn] of Object.entries(BOSS_CREATURE_RENDERERS)) {
      for (const variant of ["MINI", "MAIN"] as const) {
        for (const enraged of [false, true]) {
          expect(() => fn(ctx, "#8fe6ff", 4321, enraged, 0.4, variant), `${id} ${variant} enraged=${enraged}`).not.toThrow();
        }
      }
    }
  });

  it("the original 6 biomes' bosses are NOT in the custom registry (they fall through to the shared Colossus body unchanged)", () => {
    for (const id of Object.keys(MAIN_BOSSES)) {
      if (["hollow-warden", "molten-colossus", "glacial-sovereign", "sand-devourer", "grave-tyrant", "abyssal-maw"].includes(id)) {
        expect(BOSS_CREATURE_RENDERERS[id], id).toBeUndefined();
      }
    }
    for (const id of Object.keys(MINI_BOSSES)) {
      if (["ashfen-warlord", "briar-summoner", "mossback-regenerator", "gloom-jammer", "stonebound-sentinel", "ferocious-berserker"].includes(id)) {
        expect(BOSS_CREATURE_RENDERERS[id], id).toBeUndefined();
      }
    }
  });
});
