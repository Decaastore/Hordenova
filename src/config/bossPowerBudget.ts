/**
 * v1.0 Infinite Progression Mathematical Specification — U1: the smallest
 * real-engine-verified power-budget correction for the Main Boss across
 * waves 300-800 (the one wave range where real Boss Kill Margin dipped
 * below the frozen 1.5x contract for a realistic F2P-paced build). A
 * "windowed Gaussian" bump applied as a direct multiplier on the player's
 * EFFECTIVE DAMAGE against the Main Boss only — never on Boss HP, never on
 * any mini-boss or normal enemy. Identically 1 for every wave outside
 * [WINDOW_START, WINDOW_END] by construction, so it cannot leak into or
 * shift any other measured checkpoint, exponent, or asymptotic behavior
 * (HP=0.72, Specialization=0.50, Mastery=0.45, Boss lap=0.15, Gold=1.00 all
 * stay untouched).
 */

const WINDOW_START = 300;
const WINDOW_END = 800;
const GAUSSIAN_MU = 300;
const GAUSSIAN_SIGMA = 460;
const GAUSSIAN_EXTRA = 2.556;
// The gate's internal edges sit one wave inside the window boundary so the
// smoothstep ramp reaches full strength exactly AT wave 300 and wave 800 —
// a bare `(wave-300)/1` ramp would instead evaluate to 0 exactly at wave
// 300, the single checkpoint that needs the largest boost.
const GATE_EDGE_IN = WINDOW_START - 1;
const GATE_EDGE_OUT = WINDOW_END + 1;

function smoothstep(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

function gate(wave: number): number {
  return Math.min(smoothstep((wave - GATE_EDGE_IN) / 1), smoothstep((GATE_EDGE_OUT - wave) / 1), 1);
}

/**
 * Multiplier on the player's effective damage against the Main Boss only.
 * Exactly 1 for wave < 300 or wave > 800.
 */
export function windowedBossDamageBump(wave: number): number {
  if (wave < WINDOW_START || wave > WINDOW_END) return 1;
  const gaussian = Math.exp(-((wave - GAUSSIAN_MU) ** 2) / (2 * GAUSSIAN_SIGMA ** 2));
  return 1 + GAUSSIAN_EXTRA * gaussian * gate(wave);
}
