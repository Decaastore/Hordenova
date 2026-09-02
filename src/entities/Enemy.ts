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
    if (enemy.slow.remainingMs <= 0) enemy.slow = null;
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

export function applySlow(enemy: EnemyInstance, percent: number, durationMs: number): void {
  if (!enemy.slow || percent >= enemy.slow.percent) {
    enemy.slow = { percent, remainingMs: durationMs };
  } else {
    enemy.slow.remainingMs = Math.max(enemy.slow.remainingMs, durationMs);
  }
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
