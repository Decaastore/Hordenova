import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENEMY_PATH, PATH_DEFINITION } from "./mapWhisperingWoods";
import { getPointAtDistance, getPathLength } from "@/utils/geometry";

/**
 * Progression 2.0 spec section 24 — flagged CRITICAL PRIORITY: "definir
 * UMA fonte de verdade... NÃO duplicar o caminho". This suite guards that
 * guarantee directly, rather than trusting a code comment.
 */
describe("PathDefinition — single source of truth (spec section 24)", () => {
  it("PATH_DEFINITION.centerline is the EXACT SAME array reference as ENEMY_PATH, not a copy", () => {
    expect(PATH_DEFINITION.centerline).toBe(ENEMY_PATH);
  });

  it("start/end match the centerline's own first/last points", () => {
    expect(PATH_DEFINITION.start).toEqual(ENEMY_PATH[0]);
    expect(PATH_DEFINITION.end).toEqual(ENEMY_PATH[ENEMY_PATH.length - 1]);
  });

  it("walking the full path length via getPointAtDistance lands exactly on the defined end point", () => {
    const length = getPathLength(PATH_DEFINITION.centerline);
    const sample = getPointAtDistance(PATH_DEFINITION.centerline, length);
    expect(sample.position.x).toBeCloseTo(PATH_DEFINITION.end.x, 5);
    expect(sample.position.y).toBeCloseTo(PATH_DEFINITION.end.y, 5);
    expect(sample.finished).toBe(true);
  });

  /**
   * The real regression guard: both the enemy-movement code and the
   * renderer's path-drawing code must import ENEMY_PATH from this exact
   * module rather than defining or hardcoding their own coordinate array.
   * Reads source text directly (not behavior) because the whole point is
   * to catch a future accidental FORK of the path — e.g. someone pasting
   * a second, slightly-different array literal into one of these files —
   * which a purely behavioral test could easily miss if the fork happened
   * to still be numerically close.
   */
  it("Enemy.ts (movement) and CanvasRenderer.tsx (drawing) both import ENEMY_PATH from this module — no forked copy", () => {
    const here = fileURLToPath(import.meta.url);
    const srcDir = here.slice(0, here.indexOf("/src/") + 5);

    const enemySource = readFileSync(`${srcDir}entities/Enemy.ts`, "utf-8");
    const rendererSource = readFileSync(`${srcDir}rendering/CanvasRenderer.tsx`, "utf-8");

    expect(enemySource).toMatch(/import\s*\{[^}]*ENEMY_PATH[^}]*\}\s*from\s*["']@\/data\/mapWhisperingWoods["']/);
    expect(rendererSource).toMatch(/import\s*\{[^}]*ENEMY_PATH[^}]*\}\s*from\s*["']@\/data\/mapWhisperingWoods["']/);

    // Neither file should contain a second, hardcoded coordinate array
    // (a tell-tale sign of a forked path) — this map's own points are
    // distinctive enough (e.g. y: 480) that a copy would show up here.
    for (const source of [enemySource, rendererSource]) {
      expect(source).not.toMatch(/\{\s*x:\s*0,\s*y:\s*120\s*\}/);
    }
  });
});
