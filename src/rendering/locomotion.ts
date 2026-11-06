/**
 * Real-locomotion data every enemy draw reads: animation is driven by the
 * distance an enemy actually travelled (feet plant instead of sliding, a
 * slowed enemy walks slower, a frozen one stops), not by the wall clock.
 */
export interface LocomotionState {
  /** Cumulative world-space distance traveled along the path. Drives every gait-cycle phase. */
  distance: number;
  /** effective speed / base speed, 0..1 (exactly 0 while fully frozen). Scales gait amplitude. */
  speedRatio: number;
  /** Signed smoothed heading turn rate (radians/ms), ~0 on straight stretches. */
  turnRate: number;
}

/** Converts distance into a repeating 0..2π gait phase — one full stride every `strideLength` world units. */
export function gaitPhase(distance: number, strideLength: number): number {
  return ((distance / strideLength) % 1) * Math.PI * 2;
}

/** A single limb swing value, zero exactly when the creature is stopped. */
export function gaitSwing(phase: number, speedRatio: number, amplitude: number, phaseOffset = 0): number {
  return Math.sin(phase + phaseOffset) * amplitude * speedRatio;
}

/** A footfall bounce (two bumps per stride, like a real gait) — zero when stopped. */
export function gaitBounce(phase: number, speedRatio: number, amplitude: number): number {
  return Math.abs(Math.sin(phase)) * amplitude * speedRatio;
}
