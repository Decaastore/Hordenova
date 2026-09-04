/**
 * Drives GameEngine.update() with the correct wall-clock-derived dt,
 * whether the tab is visible (foreground) or hidden/minimized
 * (background). Active Idle must keep progressing at its real rate for as
 * long as the page stays open — a hidden tab is not a pause, a defeat, or
 * a trigger for Offline Defense (that stays gated purely on
 * GameEngine.startRun()'s own lastPlayedAt check, i.e. actually
 * closing/reloading — untouched by this file).
 *
 * VISIBLE: requestAnimationFrame, exactly as before — smooth ticking tied
 * to the render loop. A single frame's dt is clamped to MAX_STEP_MS so an
 * unusually slow/stalled frame can't produce one giant, correctness-
 * breaking tick (see the comment on MAX_STEP_MS).
 *
 * HIDDEN: browsers suspend requestAnimationFrame entirely once the
 * document isn't visible — that's standard behavior this class doesn't
 * control and shouldn't fight (spec: "do not attempt to force full
 * rendering while hidden"). A setInterval fallback takes over instead,
 * driving ONLY the simulation (onTick), never rendering. It measures REAL
 * elapsed wall-clock time via `now()` (Date.now() by default — never
 * frame count, which would simply stop advancing while backgrounded) and
 * replays it as a sequence of MAX_STEP_MS-sized onTick() calls, so combat
 * fidelity (targeting/attack-cadence/movement — see CombatSystem.ts, which
 * only lets a tower fire at most once per tick regardless of dt size)
 * stays identical to foreground play, no matter how infrequently the
 * browser actually lets the interval fire (background tabs are commonly
 * throttled to ~1/second, and further to ~1/minute after several minutes
 * hidden in some browsers — this self-corrects either way, since dt is
 * always measured from the real clock, not assumed from the nominal
 * interval).
 *
 * A single firing's catch-up is bounded by BACKGROUND_CATCHUP_CAP_MS so a
 * truly extreme gap (the OS suspending the whole process, e.g. laptop
 * sleep with the tab still open) can't block the main thread replaying a
 * huge number of ticks synchronously; time beyond that cap in one firing
 * is simply not replayed, the same conservative fallback the old flat
 * 100ms clamp already used for any large gap — just far more generous,
 * and only reachable in that rare case rather than on every ordinary
 * minimize.
 *
 * Switching between the two drivers (on every visibilitychange) never
 * calls onTick with a stale or double-counted delta: whichever driver
 * was active simply stops, and the other starts fresh from `now()` at
 * that exact moment — the elapsed-time bookkeeping for the driver that's
 * stopping is discarded, not carried over, because it already fully
 * caught up (via onTick) everything real up to that instant. There is
 * nothing left to "reconcile" when the tab becomes visible again: the
 * same onTick(engine.update) path never stopped being driven, so no
 * reward/wave/damage/boss-transition/timer can ever be double-applied —
 * there is only ever one path, one call site, whichever clock is driving it.
 */
const MAX_STEP_MS = 100;
const BACKGROUND_TICK_INTERVAL_MS = 1000;
const BACKGROUND_CATCHUP_CAP_MS = 10 * 60 * 1000; // 10 minutes of real time per single background firing

export interface GameLoopEnv {
  now: () => number;
  requestAnimationFrame: (cb: (t: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
  setInterval: (cb: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearInterval: (id: ReturnType<typeof setInterval>) => void;
  /** True while the document is hidden/minimized/backgrounded. */
  isHidden: () => boolean;
  /** Subscribes to visibility changes; returns an unsubscribe function. */
  onVisibilityChange: (cb: () => void) => () => void;
}

function defaultEnv(): GameLoopEnv {
  return {
    now: () => Date.now(),
    requestAnimationFrame: (cb) => requestAnimationFrame(cb),
    cancelAnimationFrame: (id) => cancelAnimationFrame(id),
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (id) => clearInterval(id),
    isHidden: () => document.hidden,
    onVisibilityChange: (cb) => {
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
  };
}

export class GameLoop {
  private readonly env: GameLoopEnv;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTickAtMs: number | null = null;
  private unsubscribeVisibility: (() => void) | null = null;
  private running = false;

  constructor(private readonly onTick: (dtMs: number) => void, env?: Partial<GameLoopEnv>) {
    this.env = { ...defaultEnv(), ...env };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTickAtMs = null;
    this.unsubscribeVisibility = this.env.onVisibilityChange(this.handleVisibilityChange);
    this.startDriverForCurrentVisibility();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.stopRaf();
    this.stopInterval();
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = null;
    this.lastTickAtMs = null;
  }

  private startDriverForCurrentVisibility(): void {
    if (this.env.isHidden()) {
      this.startInterval();
    } else {
      this.startRaf();
    }
  }

  private handleVisibilityChange = (): void => {
    if (!this.running) return;
    // Switch drivers immediately; each driver resets its own elapsed-time
    // bookkeeping to "start fresh from now()" on its next tick, so no dt
    // is ever computed across the boundary between the two clocks.
    if (this.env.isHidden()) {
      this.stopRaf();
      this.startInterval();
    } else {
      this.stopInterval();
      this.startRaf();
    }
  };

  private startRaf(): void {
    if (this.rafId !== null) return;
    this.lastTickAtMs = null;
    this.rafId = this.env.requestAnimationFrame(this.rafStep);
  }

  private stopRaf(): void {
    if (this.rafId !== null) this.env.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private rafStep = (timestamp: number): void => {
    if (this.lastTickAtMs !== null) {
      const rawDt = timestamp - this.lastTickAtMs;
      this.onTick(Math.min(rawDt, MAX_STEP_MS));
    }
    this.lastTickAtMs = timestamp;
    this.rafId = this.env.requestAnimationFrame(this.rafStep);
  };

  private startInterval(): void {
    if (this.intervalId !== null) return;
    this.lastTickAtMs = this.env.now();
    this.intervalId = this.env.setInterval(this.intervalStep, BACKGROUND_TICK_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.intervalId !== null) this.env.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private intervalStep = (): void => {
    const now = this.env.now();
    if (this.lastTickAtMs === null) {
      this.lastTickAtMs = now;
      return;
    }
    let remaining = Math.min(now - this.lastTickAtMs, BACKGROUND_CATCHUP_CAP_MS);
    this.lastTickAtMs = now;

    while (remaining > 0) {
      const step = Math.min(remaining, MAX_STEP_MS);
      this.onTick(step);
      remaining -= step;
    }
  };
}
