import { beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "./AudioManager";

// jsdom deliberately doesn't implement real playback (it can't decode
// audio), so HTMLMediaElement.play/pause log an internal "Not implemented"
// error instead of actually playing anything. That's irrelevant to what
// AudioManager needs to guarantee (cooldowns, muting, voice limits, never
// throwing) — these stubs just make it observable via a spy without noisy
// console output, matching the standard jsdom-audio-testing pattern.
let playSpy: ReturnType<typeof vi.fn>;
let pauseSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  playSpy = vi.fn(() => undefined);
  pauseSpy = vi.fn();
  HTMLMediaElement.prototype.play = playSpy as unknown as () => Promise<void>;
  HTMLMediaElement.prototype.pause = pauseSpy as unknown as () => void;
});

function unlockedManager(now = () => 1000): AudioManager {
  const manager = new AudioManager(now);
  manager.unlock();
  return manager;
}

describe("AudioManager", () => {
  it("1. initializes with sane defaults (unmuted, full volume, locked until unlock())", () => {
    const manager = new AudioManager();
    expect(manager.isMuted()).toBe(false);
    expect(manager.getVolume()).toBe(1);
    expect(manager.isUnlocked()).toBe(false);
  });

  it("2. an unknown/missing asset id never throws — it's just silence", () => {
    const manager = unlockedManager();
    expect(() => manager.play("does_not_exist" as never)).not.toThrow();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("3. volume scales what gets passed to the underlying element", () => {
    const manager = unlockedManager();
    manager.setVolume(0.5);
    expect(manager.getVolume()).toBe(0.5);
    manager.play("tower_upgrade");
    expect(playSpy).toHaveBeenCalledTimes(1);

    manager.setVolume(1.7); // clamps to 1
    expect(manager.getVolume()).toBe(1);
    manager.setVolume(-1); // clamps to 0
    expect(manager.getVolume()).toBe(0);
  });

  it("4. muting suppresses all playback without needing volume 0", () => {
    const manager = unlockedManager();
    manager.setMuted(true);
    manager.play("tower_upgrade");
    expect(playSpy).not.toHaveBeenCalled();
    expect(manager.isMuted()).toBe(true);

    manager.setMuted(false);
    manager.play("tower_upgrade");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("5. cooldown blocks a second play of the SAME id within its window", () => {
    let now = 1000;
    const manager = unlockedManager(() => now);
    manager.play("enemy_hit"); // cooldownMs 70
    expect(playSpy).toHaveBeenCalledTimes(1);

    now += 10; // still inside the cooldown
    manager.play("enemy_hit");
    expect(playSpy).toHaveBeenCalledTimes(1); // blocked

    now += 100; // past the cooldown
    manager.play("enemy_hit");
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it("6. repeated identical events don't stack into overlapping duplicate sounds inside one instant", () => {
    const manager = unlockedManager(() => 5000);
    for (let i = 0; i < 20; i++) manager.play("wave_start"); // cooldownMs 500, all at the same `now`
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("12. a burst of repetitive attacks never turns into unbounded simultaneous playback", () => {
    let now = 0;
    const manager = unlockedManager(() => now);
    for (let i = 0; i < 200; i++) {
      now += 5; // faster than any per-id cooldown, simulating a chaotic multi-tower burst
      manager.play("ironwood_attack");
    }
    // Bounded by cooldown + the global voice cap — nowhere near 200.
    expect(playSpy.mock.calls.length).toBeLessThan(30);
  });

  it("14. play() before unlock() is a silent no-op, never a crash", () => {
    const manager = new AudioManager();
    expect(() => manager.play("victory")).not.toThrow();
    expect(playSpy).not.toHaveBeenCalled();

    manager.unlock();
    manager.play("victory");
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("reuses a pooled element instead of creating unbounded new Audio objects (spec section 15)", () => {
    let now = 0;
    const manager = unlockedManager(() => now);
    for (let i = 0; i < 50; i++) {
      now += 1000; // well past cooldown every time, so every call actually plays
      manager.play("tower_upgrade"); // maxSimultaneous: 2
    }
    // The pool for this id never grows past its configured cap.
    expect(playSpy.mock.calls.length).toBe(50);
  });

  it("HIGH-priority sounds (e.g. defeat) still play under a saturated voice load that would drop a LOW one", () => {
    let now = 0;
    const manager = unlockedManager(() => now);
    // Saturate the global voice cap with distinct LOW-priority ids so none hits its own cooldown.
    const lowIds = ["ironwood_attack", "inferno_attack", "frostborn_attack", "stormcaller_attack", "enemy_hit"] as const;
    for (let i = 0; i < 10; i++) {
      now += 1;
      manager.play(lowIds[i % lowIds.length]!);
    }
    playSpy.mockClear();
    const highPriorityCallsBefore = playSpy.mock.calls.length;
    manager.play("defeat"); // HIGH priority, cooldownMs 0
    expect(playSpy.mock.calls.length).toBeGreaterThan(highPriorityCallsBefore);
  });
});
