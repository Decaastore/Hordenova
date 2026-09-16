import type { EnemyType } from "@/config/enemyStats";
import type { ENEMY_THEME } from "../theme";

/**
 * 10-biome expansion — registration point that lets each new biome's
 * creature-draw functions plug into EntityRenderer.drawEnemy WITHOUT that
 * file's switch/dispatch needing a hardcoded case per new archetype and
 * WITHOUT the 6 pre-existing biomes' bosses changing at all: a bossId with
 * no registered renderer here falls through to the original
 * drawMainBossColossus/drawMiniBossColossus exactly as before (see
 * EntityRenderer.ts's drawEnemy).
 */

export type EnemyDrawFn = (
  ctx: CanvasRenderingContext2D,
  theme: (typeof ENEMY_THEME)[EnemyType],
  timeMs: number,
  hitFlashMs: number,
) => void;

export type BossVariant = "MINI" | "MAIN";

/** One shared bespoke creature per biome, drawn differently for its MINI vs MAIN boss role — mirrors the existing Colossus/Colossus-Jr relationship, never a separate unrelated monster per role. */
export type BossCreatureDrawFn = (
  ctx: CanvasRenderingContext2D,
  color: string,
  timeMs: number,
  enraged: boolean,
  hpPercent: number,
  variant: BossVariant,
) => void;

export const NEW_ENEMY_RENDERERS: Partial<Record<EnemyType, EnemyDrawFn>> = {};
export const BOSS_CREATURE_RENDERERS: Record<string, BossCreatureDrawFn> = {};

/** A regular (non-boss) archetype's draw function that flies (bob + shrinking shadow) — see helpers.ts. */
export function registerEnemyRenderers(entries: Partial<Record<EnemyType, EnemyDrawFn>>): void {
  Object.assign(NEW_ENEMY_RENDERERS, entries);
}

/** Registers the SAME creature function under both a biome's mini-boss id and main-boss id — the dispatch call site passes which variant it is. */
export function registerBossCreature(ids: readonly string[], fn: BossCreatureDrawFn): void {
  for (const id of ids) BOSS_CREATURE_RENDERERS[id] = fn;
}
