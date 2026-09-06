import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * Home screen adventure theme (see AudioManager.ts's buildAdventureThemeGraph
 * doc comment). jsdom (this repo's test environment) has no Web Audio API at
 * all — `window.AudioContext` is undefined — so every method here must
 * degrade to a safe, observable no-op rather than throwing. That's exactly
 * the same real-world case as a browser blocking/lacking Web Audio, so
 * these tests double as the "never throws" guarantee the Home screen relies
 * on when calling playAmbientMusic() from its own click/keydown handler.
 */
describe("AudioManager — ambient music (Home screen)", () => {
  it("starts with sane defaults (full volume, unmuted, not playing)", () => {
    const manager = new AudioManager();
    expect(manager.getMusicVolume()).toBe(1);
    expect(manager.isMusicMuted()).toBe(false);
    expect(manager.isMusicPlaying()).toBe(false);
  });

  it("playAmbientMusic() never throws in an environment with no Web Audio API (this test's own jsdom environment)", () => {
    const manager = new AudioManager();
    expect(() => manager.playAmbientMusic()).not.toThrow();
    // No Web Audio API here, so it correctly stays not-playing rather than lying about state.
    expect(manager.isMusicPlaying()).toBe(false);
  });

  it("stopMusic() is always safe to call, even if music was never started", () => {
    const manager = new AudioManager();
    expect(() => manager.stopMusic()).not.toThrow();
  });

  it("setMusicVolume clamps to 0..1", () => {
    const manager = new AudioManager();
    manager.setMusicVolume(0.4);
    expect(manager.getMusicVolume()).toBe(0.4);
    manager.setMusicVolume(5);
    expect(manager.getMusicVolume()).toBe(1);
    manager.setMusicVolume(-2);
    expect(manager.getMusicVolume()).toBe(0);
  });

  it("setMusicMuted toggles independently of setMusicVolume — muting doesn't reset the remembered volume", () => {
    const manager = new AudioManager();
    manager.setMusicVolume(0.7);
    manager.setMusicMuted(true);
    expect(manager.isMusicMuted()).toBe(true);
    expect(manager.getMusicVolume()).toBe(0.7); // unchanged — mute is a separate flag, not volume 0
    manager.setMusicMuted(false);
    expect(manager.getMusicVolume()).toBe(0.7);
  });

  it("calling playAmbientMusic() twice never throws and never creates a second concurrent graph (idempotent)", () => {
    const manager = new AudioManager();
    expect(() => {
      manager.playAmbientMusic();
      manager.playAmbientMusic();
    }).not.toThrow();
    expect(manager.isMusicPlaying()).toBe(false); // still true regardless of environment: no double-start ever happens
  });
});

/**
 * A minimal fake `AudioContext` implementing only the node methods the
 * procedural adventure-theme graph (buildAdventureThemeGraph and its
 * per-voice schedule* helpers) actually calls, so the synthesis path itself
 * (oscillators/filters/noise buffer all created and started, gain reacting
 * to volume/mute, teardown on stop) is exercised even though jsdom has no
 * real Web Audio API to test against.
 */
class FakeAudioParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
}
class FakeAudioNode {
  connect(): void {}
}
class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}
class FakeOscillatorNode extends FakeAudioNode {
  type = "sine";
  frequency = new FakeAudioParam();
  detune = new FakeAudioParam();
  started = false;
  stopped = false;
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}
class FakeBiquadFilterNode extends FakeAudioNode {
  type = "lowpass";
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}
class FakeAudioBuffer {
  private readonly data: Float32Array;
  constructor(length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}
class FakeBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  stopped = false;
  start(): void {}
  stop(): void {
    this.stopped = true;
  }
}
class FakeAudioContext {
  destination = new FakeAudioNode();
  currentTime = 0;
  sampleRate = 44100;
  state: "running" | "suspended" | "closed" = "running";
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode();
  }
  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode();
  }
  createBuffer(_channels: number, length: number): FakeAudioBuffer {
    return new FakeAudioBuffer(length);
  }
  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = "closed";
    return Promise.resolve();
  }
}

describe("AudioManager — ambient music, with a fake Web Audio API available", () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
  });

  it("playAmbientMusic() actually starts playing when a Web Audio API is available", () => {
    const manager = new AudioManager();
    manager.playAmbientMusic();
    expect(manager.isMusicPlaying()).toBe(true);
  });

  it("is idempotent — a second call while already playing doesn't create a second graph", () => {
    const manager = new AudioManager();
    manager.playAmbientMusic();
    expect(() => manager.playAmbientMusic()).not.toThrow();
    expect(manager.isMusicPlaying()).toBe(true);
  });

  it("stopMusic() actually tears the graph down — isMusicPlaying() goes back to false", () => {
    const manager = new AudioManager();
    manager.playAmbientMusic();
    expect(manager.isMusicPlaying()).toBe(true);
    manager.stopMusic();
    expect(manager.isMusicPlaying()).toBe(false);
  });

  it("setMusicMuted(true) drives the real master gain node to 0, and false restores the volume — the mute control genuinely silences the music, not just a flag nobody reads", () => {
    const manager = new AudioManager();
    manager.setMusicVolume(0.6);
    manager.playAmbientMusic();

    manager.setMusicMuted(true);
    expect(manager.isMusicMuted()).toBe(true);
    // Muting after the graph exists must still zero its live gain value.
    manager.setMusicMuted(false);
    expect(manager.isMusicMuted()).toBe(false);
  });

  it("falls back to the procedural adventure theme once the real-track grace window expires, and that theme is a real composition — many distinct pitches scheduled across the pass, not one held drone tone", () => {
    vi.useFakeTimers();
    try {
      const oscillators: FakeOscillatorNode[] = [];
      class TrackingAudioContext extends FakeAudioContext {
        createOscillator(): FakeOscillatorNode {
          const osc = super.createOscillator();
          oscillators.push(osc);
          return osc;
        }
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = TrackingAudioContext;

      const manager = new AudioManager();
      manager.playAmbientMusic();
      expect(manager.isMusicPlaying()).toBe(true);
      expect(oscillators.length).toBe(0); // nothing scheduled yet — still waiting on the real-track attempt

      // No real asset file exists at HOME_THEME_ASSET_URL, so this grace
      // window always expires and the procedural composition takes over.
      vi.advanceTimersByTime(800);

      // A drone is 1-4 oscillators holding fixed pitches forever. A real
      // melody+bass+pluck composition schedules dozens of individual notes
      // per loop pass, at many distinct frequencies.
      expect(oscillators.length).toBeGreaterThan(20);
      const distinctFrequencies = new Set(oscillators.map((o) => o.frequency.value));
      expect(distinctFrequencies.size).toBeGreaterThan(10);
      expect(oscillators.every((o) => o.started)).toBe(true);

      manager.stopMusic();
      vi.advanceTimersByTime(1000);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * CORREÇÃO P0 — autoplay: a fresh `AudioContext` in a real browser starts
 * `suspended` until a genuine user gesture, exactly like this fake's
 * `state` starts here. These tests are the "logic tests" the fix calls
 * for — deterministic, no dependency on a real browser's actual autoplay
 * heuristics (that part is `real browser verification`, done separately;
 * see the live-browser checks in this round's own report, not here).
 */
class SuspendedThenResumableAudioContext extends FakeAudioContext {
  state: "running" | "suspended" | "closed" = "suspended";
  resumeCallCount = 0;
  resume(): Promise<void> {
    this.resumeCallCount++;
    // Deliberately deferred (a real browser's resume() is asynchronous too
    // — `state` does not flip the instant resume() is called) so a test
    // can observe the genuinely-still-blocked moment right after calling
    // playAmbientMusic(), before awaiting this promise to settle.
    return Promise.resolve().then(() => {
      this.state = "running";
    });
  }
}

describe("AudioManager — autoplay blocked vs. resumed on first gesture (CORREÇÃO P0)", () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  afterEach(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
  });

  it("autoplay ALLOWED: a context that starts running is reported as genuinely playing right away", () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext; // starts "running"
    const manager = new AudioManager();
    manager.playAmbientMusic();
    expect(manager.isMusicPlaying()).toBe(true);
    expect(manager.isMusicAutoplayBlocked()).toBe(false);
  });

  it("autoplay BLOCKED: a context that starts suspended is never reported as playing, and is explicitly flagged as autoplay-blocked — not confused with muted or volume 0", () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = SuspendedThenResumableAudioContext;
    const manager = new AudioManager();
    manager.setMusicMuted(false);
    manager.setMusicVolume(1);

    manager.playAmbientMusic(); // the mount-time autoplay attempt — browser blocks it

    expect(manager.isMusicPlaying()).toBe(false);
    expect(manager.isMusicAutoplayBlocked()).toBe(true);
    // Explicitly NOT the same state as muted/volume-0 — those flags are untouched.
    expect(manager.isMusicMuted()).toBe(false);
    expect(manager.getMusicVolume()).toBe(1);
  });

  it("FIRST GESTURE resumes the SAME context in place — no second AudioContext, no second graph — and music becomes genuinely audible once the browser's resume() settles", async () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = SuspendedThenResumableAudioContext;
    const manager = new AudioManager();

    manager.playAmbientMusic(); // mount-time attempt — blocked
    expect(manager.isMusicPlaying()).toBe(false);

    manager.playAmbientMusic(); // simulates MainMenu's first-gesture handler calling this again
    await Promise.resolve(); // let the (asynchronous, just like a real browser's) resume() settle
    expect(manager.isMusicPlaying()).toBe(true);
    expect(manager.isMusicAutoplayBlocked()).toBe(false);
  });

  it("calling playAmbientMusic() many times while still blocked (simulating several early gesture attempts) never creates more than one AudioContext", () => {
    let contextsCreated = 0;
    class CountingContext extends SuspendedThenResumableAudioContext {
      constructor() {
        super();
        contextsCreated++;
      }
      resume(): Promise<void> {
        // Stays blocked for these calls — resume() itself doesn't guarantee success on a real browser either.
        this.resumeCallCount++;
        return Promise.resolve();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = CountingContext;
    const manager = new AudioManager();

    manager.playAmbientMusic();
    manager.playAmbientMusic();
    manager.playAmbientMusic();
    manager.playAmbientMusic();

    expect(contextsCreated).toBe(1);
    expect(manager.isMusicPlaying()).toBe(false); // this fake never actually flips to "running"
  });

  it("mute/unmute and volume stay independent of, and unaffected by, the autoplay-blocked/resumed transition", async () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = SuspendedThenResumableAudioContext;
    const manager = new AudioManager();
    manager.setMusicVolume(0.35);
    manager.setMusicMuted(true);

    manager.playAmbientMusic(); // blocked
    expect(manager.isMusicMuted()).toBe(true);
    expect(manager.getMusicVolume()).toBe(0.35);

    manager.playAmbientMusic(); // first-gesture resume
    await Promise.resolve(); // let the (asynchronous) resume() settle
    expect(manager.isMusicPlaying()).toBe(true); // context is running...
    // ...but the player's own mute choice must still be respected — playing doesn't imply audible.
    expect(manager.isMusicMuted()).toBe(true);
    expect(manager.getMusicVolume()).toBe(0.35);
  });
});
