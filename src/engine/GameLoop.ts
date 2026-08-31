/**
 * Wraps requestAnimationFrame into a start/stop-able ticker. Clamps a
 * single frame's delta so a backgrounded tab (huge dt on refocus) can't
 * instantly wipe the base HP or skip dozens of waves in one tick.
 */
const MAX_FRAME_DT_MS = 100;

export class GameLoop {
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;

  constructor(private readonly onTick: (dtMs: number) => void) {}

  start(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = null;
    this.rafId = requestAnimationFrame(this.step);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastTimestamp = null;
  }

  private step = (timestamp: number): void => {
    if (this.lastTimestamp !== null) {
      const rawDt = timestamp - this.lastTimestamp;
      this.onTick(Math.min(rawDt, MAX_FRAME_DT_MS));
    }
    this.lastTimestamp = timestamp;
    this.rafId = requestAnimationFrame(this.step);
  };
}
