/**
 * BOSS FURY (owner's call, Nov 2026: "efeitos no boss e mini boss, que de
 * stun na torre, mais animações e complicações para matar ambos").
 *
 * STUN ROAR — every boss and mini-boss: after a readable wind-up (a ring on
 * the ground grows to the exact radius it will hit), it roars and stuns the
 * nearest towers inside that ring. Fair by rule: a tower stunned by a roar
 * can't be roar-stunned again for ROAR_IMMUNITY_MS, the number of towers hit
 * is capped, and enraged bosses only stun a little longer.
 *
 * PHASE BARRIER — a main boss, the first time it drops to BARRIER.hpFraction,
 * raises a near-unbreakable barrier for a moment, calls guards and roars at
 * once. MINI-BOSS HARDEN — a mini-boss at half HP hardens its hide briefly.
 * Both make the kill a fight with beats instead of a bigger HP bar.
 */
export interface RoarConfig {
  /** Time between roars (from the end of one to the start of the next wind-up). */
  intervalMs: number;
  /** First roar after the boss appears. */
  firstMs: number;
  /** Wind-up: the warning ring on the ground. */
  telegraphMs: number;
  /** World units: towers inside this radius can be stunned. */
  radius: number;
  stunMs: number;
  /** At most this many towers (the nearest) per roar. */
  maxTowers: number;
}

export const ROAR: Record<"main" | "mini", RoarConfig> = {
  main: { intervalMs: 13_000, firstMs: 7_000, telegraphMs: 1_400, radius: 240, stunMs: 2_200, maxTowers: 4 },
  mini: { intervalMs: 17_000, firstMs: 9_000, telegraphMs: 1_100, radius: 190, stunMs: 1_400, maxTowers: 3 },
};
/** An enraged boss's roar stuns this much longer. */
export const ROAR_ENRAGED_STUN_MULT = 1.3;
/** After a roar stun ends a tower can't be roar-stunned again for this long — no stun-lock. */
export const ROAR_IMMUNITY_MS = 3_500;

export const BARRIER = { hpFraction: 0.6, durationMs: 3_500, damageReduction: 0.9, guards: 2 } as const;
export const MINI_HARDEN = { hpFraction: 0.5, durationMs: 2_200, damageReduction: 0.7 } as const;
