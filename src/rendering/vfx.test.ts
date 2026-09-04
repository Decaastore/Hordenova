import { describe, expect, it } from "vitest";
import { VfxManager } from "./vfx";

/**
 * Camera Shake spec: normal attacks/hits/kills/builds/upgrades/gold must
 * produce ZERO camera shake — shake is reserved for castle damage and
 * boss entrance only, must be short/bounded, and must never accumulate
 * from repeated triggers.
 */
describe("VfxManager — camera shake gating", () => {
  it("produces zero shake offset with nothing triggered", () => {
    const vfx = new VfxManager();
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnBaseHitFlash never triggers shake", () => {
    const vfx = new VfxManager();
    vfx.spawnBaseHitFlash({ x: 0, y: 0 });
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnDamageNumber never triggers shake", () => {
    const vfx = new VfxManager();
    vfx.spawnDamageNumber({ x: 0, y: 0 }, 25, true);
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnGoldPopup never triggers shake", () => {
    const vfx = new VfxManager();
    vfx.spawnGoldPopup({ x: 0, y: 0 }, 50);
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnDeathBurst (a normal kill, even a premium one) never triggers shake", () => {
    const vfx = new VfxManager();
    vfx.spawnDeathBurst({ x: 0, y: 0 }, "#fff", { x: 1, y: 0 }, true);
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnHitImpact (a normal hit) never triggers shake", () => {
    const vfx = new VfxManager();
    vfx.spawnHitImpact({ x: 0, y: 0 }, "#fff", { x: 1, y: 0 });
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnBuildRing / spawnUpgradeBurst (placing/upgrading a tower) never trigger shake", () => {
    const vfx = new VfxManager();
    vfx.spawnBuildRing({ x: 0, y: 0 }, "#fff");
    vfx.spawnUpgradeBurst({ x: 0, y: 0 }, "#fff");
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("spawnCastleImpact (enemy reaches the castle) DOES trigger shake, escalating with HP tier", () => {
    const low = new VfxManager();
    low.spawnCastleImpact({ x: 0, y: 0 }, 1);
    const lowOffset = low.getShakeOffset();
    expect(lowOffset.x !== 0 || lowOffset.y !== 0).toBe(true);

    const high = new VfxManager();
    high.spawnCastleImpact({ x: 0, y: 0 }, 4);
    // Can't compare instantaneous jittered offsets directly (randomized),
    // but the underlying magnitude driving them must be strictly larger.
    expect((high as unknown as { shakeMagnitude: number }).shakeMagnitude).toBeGreaterThan(
      (low as unknown as { shakeMagnitude: number }).shakeMagnitude,
    );
  });

  it("shake decays to exactly zero after its duration elapses (short, bounded, no continuous tremor)", () => {
    const vfx = new VfxManager();
    vfx.triggerShake(5, 200);
    expect(vfx.getShakeOffset()).not.toEqual({ x: 0, y: 0 });

    vfx.update(199);
    expect(vfx.getShakeOffset()).not.toEqual({ x: 0, y: 0 });

    vfx.update(1);
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("a new WEAKER trigger while shake is already active does not override or extend the current, stronger one", () => {
    const vfx = new VfxManager();
    vfx.triggerShake(10, 300);
    vfx.triggerShake(2, 5000); // weaker but much longer — must be ignored while the stronger one is active
    expect((vfx as unknown as { shakeMagnitude: number }).shakeMagnitude).toBe(10);
    expect((vfx as unknown as { shakeTotalMs: number }).shakeTotalMs).toBe(300);
  });

  it("repeated triggers never accumulate into a growing/compounding magnitude", () => {
    const vfx = new VfxManager();
    for (let i = 0; i < 20; i++) vfx.triggerShake(3, 100);
    expect((vfx as unknown as { shakeMagnitude: number }).shakeMagnitude).toBe(3);
  });

  it("spawnFreezeShatter never triggers shake (it's a status-effect-expiry beat, not a castle/boss event)", () => {
    const vfx = new VfxManager();
    vfx.spawnFreezeShatter({ x: 0, y: 0 });
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("a stronger trigger while one is active replaces it outright (renews, doesn't stack)", () => {
    const vfx = new VfxManager();
    vfx.triggerShake(2, 100);
    vfx.triggerShake(8, 400);
    expect((vfx as unknown as { shakeMagnitude: number }).shakeMagnitude).toBe(8);
    expect((vfx as unknown as { shakeTotalMs: number }).shakeTotalMs).toBe(400);
  });
});
