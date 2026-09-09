/**
 * SHIELD DURANTE O MODO ENFURECIDO — a Boss or Mini-Boss gains a damage
 * reduction buff for as long as it is Enraged (config/../engine/BossManager.ts's
 * `state.enraged`, the ONE real Enraged flag — a main boss's permanent
 * phase-2 transition below ENRAGE_HP_THRESHOLD, or a BERSERKER-ability
 * mini-boss's own equivalent trigger). This is purely a damage-received
 * reduction, applied alongside the enemy's existing `damageReduction` in
 * entities/Enemy.ts's `applyDamageToEnemy` — it never touches HP, maxHp, a
 * second HP bar, wave progression, Boss HP formulas, rewards, or any
 * economy system (Prestige/Mastery/Specialization/Gold/Gems).
 *
 * The reduction is tied ENTIRELY to the live `enraged` flag: it is active
 * exactly while `enraged` is true and disappears the instant it reads
 * false again — there is no separate timer, no cached value, no second
 * parallel state to keep in sync.
 */
export const ENRAGE_SHIELD_DAMAGE_REDUCTION = {
  MAIN_BOSS: 0.3,
  MINI_BOSS: 0.2,
} as const;

/**
 * Returns the fraction (0..1) of incoming damage the Enraged Shield
 * absorbs right now:
 * - 0 for a normal (non-boss) enemy, always.
 * - 0 for a Boss/Mini-Boss that is not currently Enraged.
 * - ENRAGE_SHIELD_DAMAGE_REDUCTION.MAIN_BOSS (0.30) for an Enraged main Boss.
 * - ENRAGE_SHIELD_DAMAGE_REDUCTION.MINI_BOSS (0.20) for an Enraged Mini-Boss.
 *
 * Takes primitives rather than an EnemyInstance — same convention as
 * config/ccResistance.ts's getCcResistanceTier — so this config module
 * never needs to import the entities layer.
 */
export function getEnragedShieldReduction(isBoss: boolean, isMainBoss: boolean, enraged: boolean): number {
  if (!isBoss || !enraged) return 0;
  return isMainBoss ? ENRAGE_SHIELD_DAMAGE_REDUCTION.MAIN_BOSS : ENRAGE_SHIELD_DAMAGE_REDUCTION.MINI_BOSS;
}
