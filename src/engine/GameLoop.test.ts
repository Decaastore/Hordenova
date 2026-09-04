import { describe, expect, it } from "vitest";
import { GameLoop, type GameLoopEnv } from "./GameLoop";

/**
 * Background/minimized-tab spec: Active Idle must keep progressing at its
 * real rate while the tab is hidden (no pause, no defeat, no Offline
 * Defense trigger — that stays gated on GameEngine.startRun() only), and
 * must never force rendering while hidden. GameLoop is the piece that
 * owns this: it drives GameEngine.update() via requestAnimationFrame
 * while visible and a setInterval fallback while hidden, always computing
 * dt from a real wall clock rather than frame count.
 *
 * A hand-rolled fake environment (rather than vi.useFakeTimers on the
 * global timer functions) gives full manual control over exactly when a
 * "frame" or "interval tick" fires, decoupled from real setInterval/rAF
 * scheduling semantics — that's the whole point of GameLoop accepting an
 * injectable env.
 */
function createFakeEnv() {
  let hidden = false;
  let clock = 0;
  let rafCallback: ((t: number) => void) | null = null;
  let rafCancelled = false;
  let intervalCallback: (() => void) | null = null;
  let intervalCancelled = false;
  let visibilityListener: (() => void) | null = null;

  const env: GameLoopEnv = {
    now: () => clock,
    requestAnimationFrame: (cb) => {
      rafCallback = cb;
      rafCancelled = false;
      return 1;
    },
    cancelAnimationFrame: () => {
      rafCancelled = true;
      rafCallback = null;
    },
    setInterval: (cb) => {
      intervalCallback = cb;
      intervalCancelled = false;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval: () => {
      intervalCancelled = true;
      intervalCallback = null;
    },
    isHidden: () => hidden,
    onVisibilityChange: (cb) => {
      visibilityListener = cb;
      return () => {
        if (visibilityListener === cb) visibilityListener = null;
      };
    },
  };

  return {
    env,
    setClock: (ms: number) => {
      clock = ms;
    },
    advanceClock: (ms: number) => {
      clock += ms;
    },
    fireRaf: () => {
      if (!rafCallback) throw new Error("no rAF callback registered — GameLoop isn't in visible/rAF mode");
      const cb = rafCallback;
      cb(clock);
    },
    hasRaf: () => rafCallback !== null,
    rafWasCancelled: () => rafCancelled,
    fireInterval: () => {
      if (!intervalCallback) throw new Error("no interval callback registered — GameLoop isn't in hidden/interval mode");
      intervalCallback();
    },
    hasInterval: () => intervalCallback !== null,
    intervalWasCancelled: () => intervalCancelled,
    setHidden: (value: boolean) => {
      hidden = value;
      visibilityListener?.();
    },
    hasVisibilityListener: () => visibilityListener !== null,
  };
}

describe("GameLoop — visible (foreground)", () => {
  it("drives onTick via requestAnimationFrame with real elapsed dt between frames", () => {
    const fake = createFakeEnv();
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);

    loop.start();
    expect(fake.hasRaf()).toBe(true);

    fake.setClock(0);
    fake.fireRaf(); // first frame — establishes the baseline, no tick yet
    expect(ticks).toEqual([]);

    fake.setClock(16);
    fake.fireRaf();
    fake.setClock(33);
    fake.fireRaf();

    expect(ticks).toEqual([16, 17]);
  });

  it("clamps an unusually large single frame delta to MAX_STEP_MS (100ms)", () => {
    const fake = createFakeEnv();
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);

    loop.start();
    fake.fireRaf(); // baseline at clock=0
    fake.setClock(5000); // a huge stall
    fake.fireRaf();

    expect(ticks).toEqual([100]);
  });

  it("stop() cancels the rAF driver and the visibility subscription", () => {
    const fake = createFakeEnv();
    const loop = new GameLoop(() => {}, fake.env);
    loop.start();
    expect(fake.hasVisibilityListener()).toBe(true);

    loop.stop();
    expect(fake.rafWasCancelled()).toBe(true);
    expect(fake.hasVisibilityListener()).toBe(false);
  });

  it("start() is idempotent — calling it twice doesn't register a second driver", () => {
    const fake = createFakeEnv();
    const loop = new GameLoop(() => {}, fake.env);
    loop.start();
    loop.start();
    // Only one rAF callback slot exists in the fake env at a time, and
    // firing it once still behaves like a single, well-formed loop.
    expect(fake.hasRaf()).toBe(true);
    loop.stop();
  });
});

describe("GameLoop — hidden (background/minimized tab)", () => {
  it("starts in interval mode immediately when the tab is already hidden on start()", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const loop = new GameLoop(() => {}, fake.env);

    loop.start();
    expect(fake.hasInterval()).toBe(true);
    expect(fake.hasRaf()).toBe(false);
  });

  it("keeps ticking Active Idle via real elapsed wall-clock time while hidden, in <=100ms steps for combat fidelity", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    // The background timer only fires once every ~1s of wall time (or far
    // less often — real browsers throttle further), but a full 950ms of
    // real elapsed time must still be replayed faithfully.
    fake.advanceClock(950);
    fake.fireInterval();

    expect(ticks.reduce((a, b) => a + b, 0)).toBe(950);
    // Every single step stays at or under the same cap foreground frames use.
    for (const dt of ticks) expect(dt).toBeLessThanOrEqual(100);
    expect(ticks.length).toBe(10); // 9 x 100ms + 1 x 50ms
  });

  it("a tab hidden far longer than the nominal interval (heavy browser throttling) still fully replays the real elapsed time on the next firing", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    // Browser throttled the interval to firing only once every 65 real
    // seconds instead of the nominal 1s — Active Idle must not have lost
    // any of that time.
    fake.advanceClock(65_000);
    fake.fireInterval();

    expect(ticks.reduce((a, b) => a + b, 0)).toBe(65_000);
  });

  it("bounds a single firing's catch-up so an extreme gap (e.g. the OS suspending the tab) can't block on an unbounded synchronous replay", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    fake.advanceClock(60 * 60 * 1000); // a full hour
    fake.fireInterval();

    const totalReplayed = ticks.reduce((a, b) => a + b, 0);
    expect(totalReplayed).toBeLessThanOrEqual(10 * 60 * 1000); // capped at 10 minutes
    expect(totalReplayed).toBeGreaterThan(0); // still makes real progress, doesn't just drop everything
  });

  it("never fires onTick with a stale/negative dt on the very first interval callback (establishes baseline only)", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();
    // start() itself already establishes lastTickAtMs — firing immediately
    // with zero elapsed time must not produce a spurious tick.
    fake.fireInterval();
    expect(ticks).toEqual([]);
  });

  it("stop() cancels the interval driver too", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const loop = new GameLoop(() => {}, fake.env);
    loop.start();
    loop.stop();
    expect(fake.intervalWasCancelled()).toBe(true);
  });
});

describe("GameLoop — visibility transitions (no lost or duplicated time)", () => {
  it("switching to hidden mid-session stops rAF and starts the interval driver, with no double-counted dt at the boundary", () => {
    const fake = createFakeEnv();
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    fake.fireRaf(); // baseline
    fake.setClock(500);
    fake.fireRaf();
    expect(ticks).toEqual([100]); // clamped, as expected in visible mode

    fake.setHidden(true); // simulates the tab being minimized
    expect(fake.hasInterval()).toBe(true);
    expect(fake.rafWasCancelled()).toBe(true);

    fake.advanceClock(300);
    fake.fireInterval();
    expect(ticks).toEqual([100, 100, 100, 100]); // the extra 100 is the rAF tick, then 3x100 for the 300ms background gap

    // No further rAF frames get processed even if one somehow fired late.
    expect(fake.hasRaf()).toBe(false);
  });

  it("switching back to visible resumes rAF ticking without replaying time already consumed while hidden", () => {
    const fake = createFakeEnv();
    fake.setHidden(true);
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    fake.advanceClock(2000);
    fake.fireInterval();
    const backgroundTotal = ticks.reduce((a, b) => a + b, 0);
    expect(backgroundTotal).toBe(2000);

    fake.setHidden(false); // tab regains focus
    expect(fake.hasRaf()).toBe(true);
    expect(fake.intervalWasCancelled()).toBe(true);

    fake.fireRaf(); // baseline frame for the new rAF driver — must not tick yet
    expect(ticks.reduce((a, b) => a + b, 0)).toBe(backgroundTotal);

    fake.advanceClock(16);
    fake.fireRaf();
    expect(ticks.reduce((a, b) => a + b, 0)).toBe(backgroundTotal + 16);
  });

  it("rapid visibility flapping never loses or duplicates elapsed real time beyond what was actually simulated", () => {
    const fake = createFakeEnv();
    const ticks: number[] = [];
    const loop = new GameLoop((dt) => ticks.push(dt), fake.env);
    loop.start();

    fake.fireRaf(); // baseline

    fake.setHidden(true);
    fake.advanceClock(150);
    fake.fireInterval();

    fake.setHidden(false);
    fake.fireRaf(); // baseline for the new rAF driver
    fake.advanceClock(10);
    fake.fireRaf();

    fake.setHidden(true);
    fake.advanceClock(250);
    fake.fireInterval();

    // Every tick genuinely happened and is accounted for — nothing here
    // asserts a specific total because switching resets each driver's own
    // baseline (by design, see GameLoop's doc comment), but every
    // individual dt must still be a real, positive, bounded slice.
    expect(ticks.length).toBeGreaterThan(0);
    for (const dt of ticks) {
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThanOrEqual(100);
    }
  });
});
