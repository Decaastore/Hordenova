import { ENEMY_DEFINITIONS, getScaledEnemyStats, type EnemyType } from "@/config/enemyStats";
import { getPointAtDistance, type Vector2 } from "@/utils/geometry";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";

export interface SlowEffect {
  percent: number; // 0..1
  remainingMs: number;
}

export interface BurnEffect {
  damagePerSecond: number;
  remainingMs: number;
  /** How many overlapping applications contributed to the current damagePerSecond — see applyBurn. */
  stacks: number;
}

/**
 * Optional boss/mini-boss metadata. Undefined for every regular enemy —
 * bosses are otherwise a normal EnemyInstance (same movement, damage,
 * status-effect pipeline), so combat/rendering code that doesn't care about
 * bosses needs zero special-casing. See engine/BossManager.ts.
 */
export interface BossState {
  bossId: string;
  /** i18n key (bosses.<nameKey>.name) — NOT a display string, see config/bossConfig.ts BossDefinition.i18nKey. */
  nameKey: string;
  isMainBoss: boolean;
  ability: "SUMMON" | "SHIELD" | "REGEN" | "DISABLE" | "BERSERKER" | "NONE";
  abilityIntervalMs: number;
  /** The enemy's normal damageReduction, restored once a SHIELD window ends. */
  baseDamageReduction: number;
  /** World-clock (performance.now()) timestamp a SHIELD window ends, or null when inactive. */
  shieldUntilMs: number | null;
  /** World-clock timestamp the next ability trigger is due. */
  nextAbilityAtMs: number;
  /** Set once the boss crosses its enrage HP threshold — see BossManager.tickBossAbilities. */
  enraged: boolean;

  // -------------------------------------------------------------------
  // Master Implementation Pass spec section 13 — Boss Siege Attack. A
  // separate cadence from `nextAbilityAtMs`/`ability` above (SUMMON/
  // SHIELD/DISABLE/etc never compete with this for the same cooldown).
  // Only main bosses have this (nextSiegeAtMs is null for a mini-boss) —
  // see config/bossSiege.ts's own doc comment for why the scope stops
  // there for this first pass.
  // -------------------------------------------------------------------
  /** World-clock timestamp the next siege attack may begin telegraphing, or null if this boss never sieges. */
  nextSiegeAtMs: number | null;
  /** > 0 while a siege hit is telegraphed and about to land — see BossManager.tickBossSiege. */
  siegeTelegraphRemainingMs: number;
  /** The tower a telegraphed siege will hit, or null when no siege is telegraphing right now. */
  siegeTargetTowerId: string | null;
}

/** DISABLER-archetype enemies (regular or mini-boss) periodically jam the nearest tower — see CombatSystem.tickEnemyDisableAbilities. */
export interface DisablerState {
  nextTriggerAtMs: number;
}

export interface EnemyInstance {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  damageToBase: number;
  goldReward: number;
  damageReduction: number;
  /** Fraction of maxHp healed per second while alive. 0 for most enemies (REGENERATOR archetype, some mini-bosses). */
  regenPerSecond: number;
  distanceTraveled: number;
  position: Vector2;
  direction: Vector2;
  slow: SlowEffect | null;
  burn: BurnEffect | null;
  boss?: BossState;
  disablerState?: DisablerState;
  /** Elite modifier applied at spawn — see BossManager-style creation in GameEngine.maybeSpawnElite. Purely a marker for rendering/rewards; its stat bumps are already baked into hp/damageToBase/goldReward. */
  elite?: boolean;
}

let nextEnemyId = 1;

export function createEnemyInstance(type: EnemyType, waveNumber: number): EnemyInstance {
  const stats = getScaledEnemyStats(type, waveNumber);
  const def = ENEMY_DEFINITIONS[type];
  const start = getPointAtDistance(ENEMY_PATH, 0);
  return {
    id: `enemy-${nextEnemyId++}`,
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    baseSpeed: stats.speed,
    damageToBase: stats.damageToBase,
    goldReward: stats.goldReward,
    damageReduction: stats.damageReduction,
    regenPerSecond: stats.regenPerSecond,
    distanceTraveled: 0,
    position: start.position,
    direction: start.direction,
    slow: null,
    burn: null,
    disablerState: def.disablerIntervalMs !== undefined ? { nextTriggerAtMs: 0 } : undefined,
  };
}

export function getEffectiveSpeed(enemy: EnemyInstance): number {
  if (!enemy.slow) return enemy.baseSpeed;
  return enemy.baseSpeed * (1 - enemy.slow.percent);
}

export interface AdvanceResult {
  reachedEnd: boolean;
  burnDamageDealt: number;
}

/** Mutates `enemy` in place: moves it along the path and ticks status effects. */
export function advanceEnemy(enemy: EnemyInstance, dtMs: number): AdvanceResult {
  const dtSeconds = dtMs / 1000;
  let burnDamageDealt = 0;

  if (enemy.burn) {
    const tickDamage = enemy.burn.damagePerSecond * dtSeconds;
    enemy.hp = Math.max(0, enemy.hp - tickDamage);
    burnDamageDealt = tickDamage;
    enemy.burn.remainingMs -= dtMs;
    if (enemy.burn.remainingMs <= 0) enemy.burn = null;
  }

  if (enemy.regenPerSecond > 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenPerSecond * dtSeconds);
  }

  if (enemy.slow) {
    enemy.slow.remainingMs -= dtMs;
    // `!(remainingMs > 0)` rather than `remainingMs <= 0`: also catches
    // NaN (NaN <= 0 is false, which would otherwise let a corrupted
    // duration — see applySlow's guard below — leave the enemy stuck
    // "frozen" forever, since NaN can never satisfy a <= comparison).
    if (!(enemy.slow.remainingMs > 0)) enemy.slow = null;
  }

  const distanceDelta = getEffectiveSpeed(enemy) * dtSeconds;
  enemy.distanceTraveled += distanceDelta;

  const sample = getPointAtDistance(ENEMY_PATH, enemy.distanceTraveled);
  enemy.position = sample.position;
  enemy.direction = sample.direction;

  return { reachedEnd: sample.finished, burnDamageDealt };
}

/**
 * Applies `rawDamage` after the enemy's damage reduction. `armorPenetration`
 * (0..1, default 0 — every existing caller is unaffected) ignores that
 * fraction of the reduction for this hit only, without touching the
 * enemy's actual `damageReduction` field — Stormcaller's Arcane Surge is
 * the only caller that passes a non-zero value. Returns actual damage dealt.
 */
export function applyDamageToEnemy(enemy: EnemyInstance, rawDamage: number, armorPenetration = 0): number {
  const effectiveReduction = enemy.damageReduction * (1 - armorPenetration);
  const actualDamage = rawDamage * (1 - effectiveReduction);
  enemy.hp = Math.max(0, enemy.hp - actualDamage);
  return actualDamage;
}

export function isEnemyDead(enemy: EnemyInstance): boolean {
  return enemy.hp <= 0;
}

/**
 * Applies a slow (percent 0..1; 1 = a full freeze — Frostborn's Deep Freeze
 * reuses this exact plumbing, see CombatSystem.ts). Percent-or-stronger
 * reapplications refresh/replace the effect outright — that's the intended
 * "renew on a fresh hit" behavior.
 *
 * BUGFIX (permanent-freeze): a WEAKER reapplication landing on an already
 * more-slowed/frozen target must be a complete no-op — it must NOT touch
 * `remainingMs` at all. The previous code took `Math.max(remainingMs,
 * durationMs)` here, which extended the STRONGER effect's timer using the
 * WEAKER hit's own (unrelated) duration. Because a frozen enemy has 0
 * effective speed, it can never leave tower range to break the cycle: every
 * later hit — freeze-roll or not — kept re-extending the freeze before it
 * could expire, so a target that got frozen once next to an active tower
 * stayed frozen indefinitely. Ignoring weaker reapplications outright
 * removes that self-sustaining refresh loop while leaving every
 * same-or-stronger case (the normal, intended path) unchanged.
 *
 * Also guards against an invalid `durationMs` (undefined/NaN/Infinity/<=0)
 * ever being able to create an effect at all, and clamps `percent` to
 * 0..1 — neither should be reachable from real callers today, but a
 * corrupted value here is exactly the kind of thing that must never
 * produce a permanent status effect.
 */
export function applySlow(enemy: EnemyInstance, percent: number, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const clampedPercent = Math.min(Math.max(percent, 0), 1);

  if (!enemy.slow || clampedPercent >= enemy.slow.percent) {
    enemy.slow = { percent: clampedPercent, remainingMs: durationMs };
  }
  // else: strictly weaker than the active effect — no-op, see doc comment above.
}

/**
 * Applies a burn. `maxStacks` (default 1 — every existing caller is
 * unaffected) lets Inferno's Wildfire unlock overlap burn applications: a
 * fresh hit while an under-cap burn is still active adds its DPS on top
 * (and refreshes duration) instead of just replacing it; at or above the
 * cap it only refreshes duration.
 */
export function applyBurn(enemy: EnemyInstance, damagePerSecond: number, durationMs: number, maxStacks = 1): void {
  const current = enemy.burn;
  if (current && current.stacks < maxStacks) {
    enemy.burn = { damagePerSecond: current.damagePerSecond + damagePerSecond, remainingMs: durationMs, stacks: current.stacks + 1 };
  } else if (current) {
    enemy.burn = { ...current, remainingMs: durationMs };
  } else {
    enemy.burn = { damagePerSecond, remainingMs: durationMs, stacks: 1 };
  }
}

/**
 * Elite variant of a regular enemy — spec section 5: NOT just a bigger HP
 * number. Stat multipliers are baked into the instance at creation (hp,
 * speed, damage-to-base, gold reward); regen is the one "special ability"
 * currently wired up, reusing the exact same passive-heal mechanism as the
 * Regenerator archetype rather than inventing an elite-only system.
 */
export interface EliteModifier {
  hpMultiplier: number;
  speedMultiplier: number;
  damageMultiplier: number;
  rewardMultiplier: number;
  regenPercentPerSecond: number;
}

export function createEliteEnemyInstance(type: EnemyType, waveNumber: number, modifier: EliteModifier): EnemyInstance {
  const enemy = createEnemyInstance(type, waveNumber);
  enemy.hp = Math.round(enemy.hp * modifier.hpMultiplier);
  enemy.maxHp = enemy.hp;
  enemy.baseSpeed *= modifier.speedMultiplier;
  enemy.damageToBase = Math.round(enemy.damageToBase * modifier.damageMultiplier);
  enemy.goldReward = Math.round(enemy.goldReward * modifier.rewardMultiplier);
  enemy.regenPerSecond = enemy.maxHp * modifier.regenPercentPerSecond;
  enemy.elite = true;
  return enemy;
}
