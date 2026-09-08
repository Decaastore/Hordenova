import type { TowerSpecial, TowerType } from "./towerStats";
import { TOWER_DEFINITIONS } from "./towerStats";

/**
 * Progression 2.0 — Specialization / Upgrade Slot architecture (spec
 * section 5/6). This is the fix for the root cause behind "reaches phase 46
 * in 20 minutes": MAX_TOWER_LEVEL=30 (config/towerStats.ts) is a FINITE
 * gold sink — once a tower is maxed there is nothing further to spend gold
 * on, so a build "finishes" fast and coasts through phases on nothing but
 * raw enemy-scaling friction.
 *
 * LEVEL (towerStats.ts) stays pure growth: damage/attack-speed/range climb
 * smoothly and automatically, exactly as before — nothing here changes that
 * curve or any level-driven milestone unlock (multiShot/giantSlayer/
 * wildfire/deepFreeze/arcaneSurge/etc. all keep working unmodified).
 *
 * SPECIALIZATION is a separate, optional, player-CHOSEN identity slot:
 * once a tower reaches SPECIALIZATION_UNLOCK_TOWER_LEVEL, the player picks
 * exactly one of that tower's paths (permanent for that tower instance —
 * a real, mutually-exclusive decision, not a toggle) and can then invest
 * gold into it independently of the tower's own level, each level buying a
 * real behavior bonus (see `applySpecializationToSpecial`). This is what
 * gives a maxed-level build genuine, ongoing decisions and a genuine,
 * ongoing gold sink past level 30.
 *
 * INFINITE BALANCE OVERHAUL — NO LEVEL CAP AND NO EFFECT CAP. A previous
 * pass split the two: the LEVEL was uncapped (so Gold always had a sink) but
 * `applySpecializationToSpecial` clamped the level it actually read to 5, so
 * a fully-built army's DPS was a hard constant. Against an ever-growing enemy
 * HP curve that made a permanent wall inevitable — and real simulation found
 * it at wave ~450-460.
 *
 * Both caps are now gone. The level is uncapped (cost keeps climbing forever,
 * see getSpecializationUpgradeCost) AND the combat effect is uncapped, but
 * the effect is routed through `specializationEffectScale` — a strictly
 * increasing, never-flat, diminishing-returns curve. "Cada level exige mais e
 * entrega um ganho cuidadosamente menor", forever, instead of "levels are
 * free money with no effect past 5".
 *
 * Each tower ships 3 of the 4 example paths named in the spec (a
 * deliberately-scoped subset, not the full catalog) — the architecture
 * (one more entry in SPECIALIZATIONS_BY_TOWER + one more case in
 * `applySpecializationToSpecial`) supports adding a 4th, or a 5th, later
 * without touching CombatSystem.ts's call site.
 */

export type SpecializationId =
  | "IRONWOOD_EXECUTIONER"
  | "IRONWOOD_BREAKER"
  | "IRONWOOD_VANGUARD"
  | "INFERNO_WILDFIRE"
  | "INFERNO_CORE"
  | "INFERNO_DETONATOR"
  | "FROSTBORN_DEEP_FREEZE"
  | "FROSTBORN_PERMAFROST"
  | "FROSTBORN_SHATTER"
  | "STORMCALLER_CHAINBREAKER"
  | "STORMCALLER_ARCANE_SURGE"
  | "STORMCALLER_STORMLORD";

export const SPECIALIZATION_UNLOCK_TOWER_LEVEL = 10;

/**
 * ============================================================================
 * INFINITE BALANCE OVERHAUL — Specialization effect scaling.
 * ============================================================================
 *
 * The old `SPECIALIZATION_EFFECT_LEVEL_CAP = 5` hard clamp is GONE. It was a
 * literal `Math.min` inside `applySpecializationToSpecial`, and it is the
 * single reason a maxed build's DPS was a fixed constant — which, against an
 * ever-growing enemy HP curve, made a permanent wall unavoidable.
 *
 * Every path's bonus is now driven by `specializationEffectScale(level)`
 * instead of by the raw level:
 *
 *   scale(L) = (L0 / s) * ((1 + L / L0) ^ s - 1)
 *
 * with s = SPECIALIZATION_EFFECT_EXPONENT (< 1) and L0 =
 * SPECIALIZATION_EFFECT_SCALE. Two properties make this the right shape:
 *
 *  1. scale(L) -> L as L -> 0 (a first-order Taylor identity), so levels 1-5
 *     keep almost EXACTLY the bonuses this system originally shipped with —
 *     nothing about the hand-tuned early game changes perceptibly.
 *  2. scale(L) ~ (L0^(1-s)/s) * L^s as L -> infinity: never flat, never
 *     capped, but every further level delivers a carefully smaller increment
 *     than the one before it. Level 1000 and level 10000 both still buy real
 *     power; the 10000th just buys much less than the 10th did.
 *
 * WHY s ~ 0.5 SPECIFICALLY: cumulative Gold income grows ~quadratically with
 * wave number, and the Gold cost of a Specialization level is asymptotically
 * LINEAR in the level (see getSpecializationUpgradeCost), so the level a
 * player can afford grows ~linearly with wave number. A sqrt-shaped effect
 * therefore grows ~sqrt(wave) per track; Specialization and Mastery stack
 * multiplicatively, so combined player power grows ~wave^0.95 — comfortably
 * above enemy HP's wave^0.72 (config/enemyStats.ts). That inequality, not a
 * tuned constant, is what makes the wall structurally impossible.
 *
 * A few branches below still clamp a specific FIELD (critChance,
 * freezeChance, slowPercent, armorPenetration). Those are not power caps —
 * they are probabilities/fractions that are mechanically meaningless above
 * their bound (a 130% chance to freeze is not a thing). Every one of those
 * paths also scales an UNBOUNDED companion field (duration, penetration
 * carrier, extra projectiles), so no path ever stops rewarding investment.
 */
export const SPECIALIZATION_EFFECT_EXPONENT = 0.5;
export const SPECIALIZATION_EFFECT_SCALE = 10;

/**
 * Diminishing-returns multiplier applied in place of the raw specialization
 * level everywhere in `applySpecializationToSpecial`. Strictly increasing and
 * unbounded in `level`; never NaN/Infinity for any finite level.
 */
export function specializationEffectScale(level: number): number {
  const l = Math.max(0, level);
  const s = SPECIALIZATION_EFFECT_EXPONENT;
  const l0 = SPECIALIZATION_EFFECT_SCALE;
  return (l0 / s) * (Math.pow(1 + l / l0, s) - 1);
}

/**
 * HORDENOVA Season/Progression v1.0 — Ownership vs. Level split.
 *
 * Specialization is now explicitly two SEPARATE things, never conflated:
 *
 *   OWNERSHIP (`unlockedSpecializationIds`, SaveData/GameEngine, permanent,
 *   keyed by TOWER TYPE -> array of owned SpecializationId) — a one-time
 *   SPECIALIZATION_UNLOCK_GEM_COST Gems purchase per path. NEVER resets at
 *   a Season boundary and is NEVER charged again for a path already owned —
 *   picking an already-owned path again in a future Season (the tower's own
 *   `specializationId` is Season-scoped and resets to null) is free.
 *
 *   PROGRESSION (`specializationLevel`, on the tower instance itself,
 *   Season-scoped) — resets to 0 at the start of every Season along with
 *   the active choice, raised entirely with Gold via
 *   getSpecializationUpgradeCost below.
 *
 * The CHOICE of a path a tower doesn't yet own costs SPECIALIZATION_UNLOCK_
 * GEM_COST Gems (a strategic decision Gems can unlock, never a stat Gems can
 * buy); every LEVEL of that path after the choice stays on Gold, unchanged.
 * Tuned against real Gem Shard income (see config/prestige.ts and
 * GameEngine's boss/mini-boss shard grants) so a single specialization
 * unlock is a genuine goal, not an instant spend.
 */
export const SPECIALIZATION_UNLOCK_GEM_COST = 500;

/**
 * "Trocar Especialização" — HORDENOVA Season/Progression v1.0. A flat,
 * unconditional Gems purchase that switches a tower's ACTIVE specialization
 * from one it already owns to a DIFFERENT path it already owns (see
 * GameEngine.switchTowerSpecialization). Replaces the old Specialization
 * Respec Token system entirely — there is no free/earned respec anymore,
 * only this flat Gems purchase. Switching to a path NOT yet owned still
 * costs the full SPECIALIZATION_UNLOCK_GEM_COST above, not this discounted
 * rate — this price is specifically the "flexibility fee" for moving
 * between paths already paid for once.
 */
export const SPECIALIZATION_CHANGE_GEM_COST = 200;

export interface SpecializationDefinition {
  id: SpecializationId;
  towerType: TowerType;
  /** i18n key: towerInfo.specializations.<id>.name / .description */
  i18nKey: string;
}

export const SPECIALIZATIONS_BY_TOWER: Record<TowerType, readonly SpecializationDefinition[]> = {
  IRONWOOD: [
    { id: "IRONWOOD_EXECUTIONER", towerType: "IRONWOOD", i18nKey: "IRONWOOD_EXECUTIONER" },
    { id: "IRONWOOD_BREAKER", towerType: "IRONWOOD", i18nKey: "IRONWOOD_BREAKER" },
    { id: "IRONWOOD_VANGUARD", towerType: "IRONWOOD", i18nKey: "IRONWOOD_VANGUARD" },
  ],
  INFERNO: [
    { id: "INFERNO_WILDFIRE", towerType: "INFERNO", i18nKey: "INFERNO_WILDFIRE" },
    { id: "INFERNO_CORE", towerType: "INFERNO", i18nKey: "INFERNO_CORE" },
    { id: "INFERNO_DETONATOR", towerType: "INFERNO", i18nKey: "INFERNO_DETONATOR" },
  ],
  FROSTBORN: [
    { id: "FROSTBORN_DEEP_FREEZE", towerType: "FROSTBORN", i18nKey: "FROSTBORN_DEEP_FREEZE" },
    { id: "FROSTBORN_PERMAFROST", towerType: "FROSTBORN", i18nKey: "FROSTBORN_PERMAFROST" },
    { id: "FROSTBORN_SHATTER", towerType: "FROSTBORN", i18nKey: "FROSTBORN_SHATTER" },
  ],
  STORMCALLER: [
    { id: "STORMCALLER_CHAINBREAKER", towerType: "STORMCALLER", i18nKey: "STORMCALLER_CHAINBREAKER" },
    { id: "STORMCALLER_ARCANE_SURGE", towerType: "STORMCALLER", i18nKey: "STORMCALLER_ARCANE_SURGE" },
    { id: "STORMCALLER_STORMLORD", towerType: "STORMCALLER", i18nKey: "STORMCALLER_STORMLORD" },
  ],
};

const ALL_SPECIALIZATIONS: ReadonlyMap<SpecializationId, SpecializationDefinition> = new Map(
  Object.values(SPECIALIZATIONS_BY_TOWER)
    .flat()
    .map((def) => [def.id, def]),
);

export function getSpecializationsForTower(type: TowerType): readonly SpecializationDefinition[] {
  return SPECIALIZATIONS_BY_TOWER[type];
}

export function getSpecializationDefinition(id: SpecializationId): SpecializationDefinition {
  const def = ALL_SPECIALIZATIONS.get(id);
  if (!def) throw new Error(`Unknown specialization id: ${id}`);
  return def;
}

export function isSpecializationForTower(id: SpecializationId, type: TowerType): boolean {
  return getSpecializationDefinition(id).towerType === type;
}

/** HORDENOVA Season/Progression v1.0 — retuned 7->40, validated by a real GameEngine Season simulation across F2P/payer profiles (specializationLevel now resets to 0 every Season, so the old permanent-account-lifetime tuning no longer fits). */
const SPECIALIZATION_LINEAR_COST_MULTIPLIER = 40;
/**
 * INFINITE BALANCE OVERHAUL — Gold cost curve.
 *
 * Same STRUCTURE config/prestige.ts's getPrestigeUpgradeCost established for
 * this codebase (compounding growth capped at a level-index ceiling, then a
 * purely linear tail beyond it — see that file for why: a raw Math.pow over
 * an unbounded level would eventually overflow to Infinity, which would make
 * the sink literally unbuyable rather than merely expensive), with constants
 * tuned for this system instead of copied.
 *
 * The tuning target is the ASYMPTOTIC SHAPE, and it is deliberate: past
 * SPECIALIZATION_COST_COMPOUND_LEVEL_CAP the cost grows LINEARLY in the
 * level forever. Cumulative Gold income grows ~quadratically with wave
 * number, so a linear per-level cost means the affordable level grows
 * ~linearly with wave number, which is precisely the input the sqrt-shaped
 * effect curve above needs to keep player power ahead of enemy HP forever.
 * A convex (quadratic-or-worse) tail here would break that inequality and
 * quietly re-introduce a wall thousands of waves later. This asymptotic
 * property is NOT part of the frozen Infinite Progression spec (only
 * SPECIALIZATION_EFFECT_EXPONENT above is) — retuning the constants below
 * for the new Season cadence does not reopen any frozen contract.
 *
 * SPECIALIZATION_COST_LINEAR_TAIL_GROWTH is set to ln(GROWTH_FACTOR) so the
 * curve's slope is continuous at the ceiling — no price cliff at the cap.
 *
 * HORDENOVA Season/Progression v1.0 — growth factor retuned 1.06->1.07,
 * compound cap retuned 50->40, matching the approved Season simulation.
 */
const SPECIALIZATION_COST_GROWTH_FACTOR = 1.07;
const SPECIALIZATION_COST_COMPOUND_LEVEL_CAP = 40;
const SPECIALIZATION_COST_LINEAR_TAIL_GROWTH = Math.log(SPECIALIZATION_COST_GROWTH_FACTOR);

/**
 * Gold cost to raise a specialization from `currentSpecLevel` to
 * `currentSpecLevel + 1`. Never returns null and never stops growing — Gold
 * always has somewhere to go (see hasUncappedGoldSink in goldSinks.ts), at
 * any specialization level a save could ever reach.
 */
export function getSpecializationUpgradeCost(type: TowerType, currentSpecLevel: number): number {
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = Math.max(1, currentSpecLevel + 1);
  const base = def.upgradeCostBase * SPECIALIZATION_LINEAR_COST_MULTIPLIER;

  const cappedLevel = Math.min(targetLevel, SPECIALIZATION_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(SPECIALIZATION_COST_GROWTH_FACTOR, cappedLevel - 1);
  const tailLevels = Math.max(0, targetLevel - SPECIALIZATION_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * SPECIALIZATION_COST_LINEAR_TAIL_GROWTH;
  return Math.round(base * compound * linearTail) + targetLevel;
}

/**
 * Layers a chosen specialization's bonuses on top of the level-driven
 * baseline from `getTowerSpecialAtLevel`. Returns `base` unchanged when no
 * specialization is chosen (specializationLevel 0) — every existing call
 * site's behavior is bit-for-bit identical until a player actually picks a
 * path, so nothing that already worked changes on its own.
 */
export function applySpecializationToSpecial(
  base: TowerSpecial,
  specializationId: SpecializationId | null,
  specializationLevel: number,
): TowerSpecial {
  if (!specializationId || specializationLevel <= 0) return base;
  // INFINITE BALANCE OVERHAUL — the old `Math.min(level, 5)` power clamp is
  // gone. `lvl` is the diminishing-returns SCALE of the invested level, not
  // the level itself: it equals the level almost exactly for the first few
  // levels (so the original tuning is preserved) and keeps growing forever
  // afterwards, just more and more slowly. See specializationEffectScale.
  const lvl = specializationEffectScale(specializationLevel);
  // Extra targets/stacks are integer step unlocks, so they read the RAW level
  // (a scale of 2.98 at level 3 would otherwise silently miss its own gate).
  const rawLvl = specializationLevel;

  switch (specializationId) {
    case "IRONWOOD_EXECUTIONER": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      // Balance audit (waves 100-5000, real GameEngine): the crit coefficient
      // now matches IRONWOOD_BREAKER's own (0.04) so the two paths' margin
      // ratio stays flat across waves instead of drifting apart forever —
      // the boss-killer identity comes entirely from the capped companion
      // field below, not from out-growing the sibling path's own scaling.
      return {
        ...b,
        critMultiplier: round2(b.critMultiplier + lvl * 0.04),
        bossDamageMultiplier: round2((b.bossDamageMultiplier || 1) + Math.min(0.75, lvl * 0.1)),
      };
    }
    case "IRONWOOD_BREAKER": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      return {
        ...b,
        // Armor penetration is a fraction — mechanically meaningless above 1.
        // The unbounded companion (flat crit multiplier) is what keeps this
        // path rewarding investment once penetration is effectively total.
        bonusArmorPenetration: round2(Math.min(0.95, lvl * 0.1)),
        critMultiplier: round2(b.critMultiplier + lvl * 0.04),
      };
    }
    case "IRONWOOD_VANGUARD": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      return {
        ...b,
        critChance: round2(Math.min(0.75, b.critChance + lvl * 0.02)),
        // One extra projectile at level 3, then one more every time the
        // diminishing-returns scale crosses another VANGUARD_PROJECTILE_STEP
        // — genuinely unbounded, but ever slower to earn.
        bonusProjectiles: rawLvl >= 3 ? 1 + Math.floor(lvl / VANGUARD_PROJECTILE_STEP) : 0,
      };
    }
    case "INFERNO_WILDFIRE": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return {
        ...b,
        burnDamagePerSecond: round2(b.burnDamagePerSecond * (1 + lvl * 0.15)),
        burnMaxStacks: rawLvl >= 4 ? b.burnMaxStacks + 1 + Math.floor(lvl / WILDFIRE_STACK_STEP) : b.burnMaxStacks,
      };
    }
    case "INFERNO_CORE": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return {
        ...b,
        aoeRadius: round2(b.aoeRadius * (1 + lvl * 0.1)),
        burnDamagePerSecond: round2(b.burnDamagePerSecond * (1 + lvl * 0.05)),
      };
    }
    case "INFERNO_DETONATOR": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return { ...b, burningComboDamageMultiplier: round2(lvl * 0.18) };
    }
    case "FROSTBORN_DEEP_FREEZE": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return {
        ...b,
        freezeChance: round2(Math.min(0.7, b.freezeChance + lvl * 0.05)),
        freezeDurationMs: Math.round(b.freezeDurationMs + lvl * 150),
        // Unbounded companion: a frozen target takes ever more damage, so
        // investment keeps paying once the freeze CHANCE itself is saturated.
        frozenBonusDamageMultiplier: round2(lvl * 0.06),
      };
    }
    case "FROSTBORN_PERMAFROST": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return {
        ...b,
        slowPercent: round2(Math.min(0.85, b.slowPercent + lvl * 0.03)),
        slowDurationMs: Math.round(b.slowDurationMs + lvl * 200),
        frozenBonusDamageMultiplier: round2(lvl * 0.04),
      };
    }
    case "FROSTBORN_SHATTER": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return { ...b, frozenBonusDamageMultiplier: round2(lvl * 0.1) };
    }
    case "STORMCALLER_CHAINBREAKER": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return {
        ...b,
        chainTargets: rawLvl >= 3 ? b.chainTargets + 1 + Math.floor(lvl / CHAINBREAKER_TARGET_STEP) : b.chainTargets,
        chainFalloff: round2(Math.min(0.92, b.chainFalloff + lvl * 0.03)),
      };
    }
    case "STORMCALLER_ARCANE_SURGE": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return { ...b, bonusFlatDamage: round2(lvl * 2) };
    }
    case "STORMCALLER_STORMLORD": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return {
        ...b,
        armorPenetration: round2(Math.min(0.9, b.armorPenetration + lvl * 0.06)),
        bonusFlatDamage: round2(lvl * 0.8),
      };
    }
  }
}

/**
 * How much diminishing-returns SCALE each further step of an integer-valued
 * bonus costs. These are the only "step" unlocks left in the system; every
 * other field grows continuously. Deliberately large, because an extra
 * projectile/chain/burn-stack is worth far more than a linear stat point.
 */
const VANGUARD_PROJECTILE_STEP = 25;
const WILDFIRE_STACK_STEP = 30;
const CHAINBREAKER_TARGET_STEP = 25;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
