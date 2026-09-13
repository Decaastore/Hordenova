import { describe, expect, it } from "vitest";
import { VfxManager } from "./vfx";

/**
 * Floating Damage Numbers rewrite — these tests exercise `reportEnemyDamage`,
 * the ONLY entry point the real damage pipeline uses (see engine/
 * CombatVfxEvents.ts / GameEngine.drainCombatVfxEvents / CanvasRenderer's
 * detectVfxEvents). They verify the batching/aggregation, per-enemy cap,
 * crit differentiation, DOT separation, and "the number always matches real
 * damage" guarantees the user's spec requires — independent of the camera
 * shake tests already in vfx.test.ts.
 */
interface InspectableFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  remainingMs: number;
  totalMs: number;
  amount: number;
  kind: "HIT" | "DOT" | "OTHER";
  enemyId?: string;
  isCrit: boolean;
  fontSizePx: number;
}

function texts(vfx: VfxManager): InspectableFloatingText[] {
  return (vfx as unknown as { floatingTexts: InspectableFloatingText[] }).floatingTexts;
}

describe("VfxManager.reportEnemyDamage — batching/aggregation", () => {
  it("aggregates several real hits landing on the same enemy within the short batch window into a single number (the exact 120+87+94+115 example from spec)", () => {
    const vfx = new VfxManager();
    vfx.reportEnemyDamage("bossA", { x: 0, y: 0 }, 120, false, "HIT");
    vfx.reportEnemyDamage("bossA", { x: 0, y: 0 }, 87, false, "HIT");
    vfx.reportEnemyDamage("bossA", { x: 0, y: 0 }, 94, false, "HIT");
    vfx.reportEnemyDamage("bossA", { x: 0, y: 0 }, 115, false, "HIT");

    // Still inside the window — nothing visible yet (no premature number).
    vfx.update(10);
    expect(texts(vfx).filter((t) => t.enemyId === "bossA")).toHaveLength(0);

    // Window elapses — exactly one aggregated number appears.
    vfx.update(100);
    const hits = texts(vfx).filter((t) => t.enemyId === "bossA" && t.kind === "HIT");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBe(120 + 87 + 94 + 115);
    expect(hits[0]!.text).toBe("-416");
  });

  it("multiple towers hitting the same target in the same short window produce one number, not one per tower", () => {
    const vfx = new VfxManager();
    // Simulates Ironwood + Inferno + Stormcaller all landing a hit on the
    // same enemy within the same ~90ms window.
    vfx.reportEnemyDamage("e1", { x: 10, y: 10 }, 18, false, "HIT");
    vfx.reportEnemyDamage("e1", { x: 10, y: 10 }, 24, false, "HIT");
    vfx.reportEnemyDamage("e1", { x: 10, y: 10 }, 31, false, "HIT");
    vfx.update(100);
    expect(texts(vfx).filter((t) => t.enemyId === "e1" && t.kind === "HIT")).toHaveLength(1);
  });

  it("marks the aggregated number as crit if ANY real hit in the batch actually rolled a crit, and gives it distinctive (bigger) styling than a normal hit", () => {
    const vfx = new VfxManager();
    vfx.reportEnemyDamage("e1", { x: 0, y: 0 }, 50, false, "HIT");
    vfx.reportEnemyDamage("e1", { x: 0, y: 0 }, 200, true, "HIT"); // the real crit roll
    vfx.update(100);
    const t = texts(vfx).find((entry) => entry.enemyId === "e1" && entry.kind === "HIT");
    expect(t?.isCrit).toBe(true);
    expect(t?.amount).toBe(250);

    const normal = new VfxManager();
    normal.reportEnemyDamage("e2", { x: 0, y: 0 }, 50, false, "HIT");
    normal.update(100);
    const normalText = texts(normal).find((entry) => entry.enemyId === "e2");
    expect(t!.fontSizePx).toBeGreaterThan(normalText!.fontSizePx);
  });

  it("never fabricates a number for zero/negligible damage — no attack-attempt or purely visual event ever spawns one", () => {
    const vfx = new VfxManager();
    vfx.reportEnemyDamage("e1", { x: 0, y: 0 }, 0, false, "HIT");
    vfx.update(300);
    expect(texts(vfx).filter((t) => t.enemyId === "e1")).toHaveLength(0);
  });

  it("tracks each enemy independently — damage on one enemy never merges into another enemy's number (many-simultaneous-enemies scenario)", () => {
    const vfx = new VfxManager();
    vfx.reportEnemyDamage("e1", { x: 0, y: 0 }, 10, false, "HIT");
    vfx.reportEnemyDamage("e2", { x: 100, y: 0 }, 20, false, "HIT");
    vfx.reportEnemyDamage("e3", { x: 200, y: 0 }, 30, false, "HIT");
    vfx.update(100);
    expect(texts(vfx).find((t) => t.enemyId === "e1")?.amount).toBe(10);
    expect(texts(vfx).find((t) => t.enemyId === "e2")?.amount).toBe(20);
    expect(texts(vfx).find((t) => t.enemyId === "e3")?.amount).toBe(30);
  });

  it("never loses or invents damage — the displayed running total always equals the exact sum of every real amount reported for that enemy (mini-boss/boss sustained-fire scenario)", () => {
    const vfx = new VfxManager();
    const amounts = [12, 45, 3, 78, 21, 9];
    let total = 0;
    for (const amt of amounts) {
      vfx.reportEnemyDamage("miniBoss1", { x: 5, y: 5 }, amt, false, "HIT");
      total += amt;
      vfx.update(30); // repeatedly inside/crossing the window, forcing intermediate flushes+merges
    }
    vfx.update(100);
    const t = texts(vfx).find((entry) => entry.enemyId === "miniBoss1" && entry.kind === "HIT");
    expect(t?.amount).toBe(total);
    expect(t?.text).toBe(`-${total}`);
  });

  it("never allows more than one live HIT number and one live DOT number per enemy, however many real hits land in rapid succession (boss-must-stay-visible guarantee)", () => {
    const vfx = new VfxManager();
    for (let i = 0; i < 50; i++) {
      vfx.reportEnemyDamage("boss", { x: 0, y: 0 }, 5, false, "HIT");
      vfx.reportEnemyDamage("boss", { x: 0, y: 0 }, 1, false, "DOT");
      vfx.update(20);
    }
    const bossHits = texts(vfx).filter((t) => t.enemyId === "boss" && t.kind === "HIT");
    const bossDots = texts(vfx).filter((t) => t.enemyId === "boss" && t.kind === "DOT");
    expect(bossHits.length).toBeLessThanOrEqual(1);
    expect(bossDots.length).toBeLessThanOrEqual(1);
  });

  it("DOT (burn/poison) ticks are aggregated separately from discrete HIT damage and never spam one number per tick", () => {
    const vfx = new VfxManager();
    // Simulates ~30 engine ticks (roughly half a second) of continuous burn.
    for (let i = 0; i < 30; i++) {
      vfx.reportEnemyDamage("e1", { x: 0, y: 0 }, 2, false, "DOT");
      vfx.update(16);
    }
    const dotTexts = texts(vfx).filter((t) => t.enemyId === "e1" && t.kind === "DOT");
    // At most one DOT number ever live at once, never one per tick (30 ticks).
    expect(dotTexts.length).toBeLessThanOrEqual(1);
  });

  it("HIT and DOT are visually distinguishable and positioned so they never overlap when both are live for the same enemy", () => {
    const vfx = new VfxManager();
    vfx.reportEnemyDamage("e1", { x: 50, y: 50 }, 40, false, "HIT");
    vfx.reportEnemyDamage("e1", { x: 50, y: 50 }, 3, false, "DOT");
    vfx.update(500); // both windows (90ms HIT, 450ms DOT) have elapsed
    const hit = texts(vfx).find((t) => t.enemyId === "e1" && t.kind === "HIT");
    const dot = texts(vfx).find((t) => t.enemyId === "e1" && t.kind === "DOT");
    expect(hit).toBeDefined();
    expect(dot).toBeDefined();
    expect(hit!.x !== dot!.x || hit!.y !== dot!.y).toBe(true);
    expect(dot!.color).not.toBe(hit!.color);
    expect(dot!.fontSizePx).toBeLessThan(hit!.fontSizePx);
  });

  it("spawnDamageNumber's original 3-arg direct-spawn behavior (no enemyId) is unchanged — always spawns immediately, never batched", () => {
    const vfx = new VfxManager();
    vfx.spawnDamageNumber({ x: 1, y: 2 }, 33, false);
    expect(texts(vfx)).toHaveLength(1);
    expect(texts(vfx)[0]!.text).toBe("-33");
  });
});
