import {
  getTowerLevelStats,
  getUpgradeCost,
  MAX_TOWER_LEVEL,
  type TowerLevelStats,
  type TowerType,
} from "@/config/towerStats";
import {
  getSpecializationUpgradeCost,
  isSpecializationForTower,
  SPECIALIZATION_UNLOCK_TOWER_LEVEL,
  type SpecializationId,
} from "@/config/specializations";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { getTowerSpecialCooldownMs } from "@/config/towerSpecials";
import { getMasteryBonuses, getMasteryUpgradeCost } from "@/config/towerMastery";
import { getTowerSurvivalDefinition } from "@/config/towerSurvival";
import { DEFAULT_UNLOCKED_ITEM_SLOTS, getItemSlotUnlockCost, TOWER_ITEM_SLOT_COUNT } from "@/config/towerItemSlots";
import { getItemDefinition } from "@/config/itemDefinitions";
import type { ItemInstance } from "./Item";
import type { Vector2 } from "@/utils/geometry";

export interface TowerInstance {
  id: string;
  slotId: string;
  type: TowerType;
  level: number;
  position: Vector2;
  cooldownRemainingMs: number;
  /**
   * Master Implementation spec section 26-28 — Special Attack: a SECOND,
   * fully independent cooldown timer from `cooldownRemainingMs`. The normal
   * attack keeps firing at its attack-speed-driven cadence exactly as
   * before; this one ticks down on a fixed per-tower-type interval (see
   * config/towerSpecials.ts) and fires a distinct, more impactful attack
   * when it reaches 0, without ever touching or resetting the normal
   * cooldown. Deliberately NOT derived from attackSpeed — it's a rhythm of
   * its own, the way a real "ultimate" reads differently from a basic
   * attack.
   */
  specialCooldownRemainingMs: number;
  /** >0 while jammed by a DISABLER-archetype enemy/mini-boss — see CombatSystem.tickEnemyDisableAbilities. */
  disabledRemainingMs: number;
  /** Progression 2.0 — the player's chosen build-identity path, null until chosen. Permanent once set (see chooseSpecialization). */
  specializationId: SpecializationId | null;
  /** 0 = not chosen yet. 1..MAX_SPECIALIZATION_LEVEL once chosen — a second, independent gold-sink track from the tower's own level. */
  specializationLevel: number;
  /** Progression 2.0 — cosmetic-only equipped skin id, or null for the default look. Never read by combat code. */
  equippedSkinId: string | null;
  /** Master Implementation Pass spec section 4-6 — TOWER MASTERY: an uncapped, independent gold-sink track past MAX_TOWER_LEVEL. HORDENOVA Season/Progression v1.0: this is now purely the SEASON-scoped level (resets to 0 every Season) — see `masteryUnlocked` below for the permanent ownership half. See config/towerMastery.ts for the bonus/cost formulas. */
  masteryLevel: number;
  /** HORDENOVA Season/Progression v1.0 — permanent, account-wide-by-type Mastery OWNERSHIP (the one-time 400 Gems purchase), denormalized onto each tower instance exactly like `masteryLevel` is, kept in sync by GameEngine whenever it changes. Gates whether `masteryLevel` can be raised with Gold at all — see `canUpgradeMastery`. Never reset by a Season boundary. */
  masteryUnlocked: boolean;

  // -------------------------------------------------------------------
  // Master Implementation Pass spec section 12-13 — TOWER SURVIVAL /
  // BOSS SIEGE ATTACK. Deliberately TRANSIENT (not part of
  // TowerLoadoutEntry / SaveData): a tower's current battle HP resets to
  // full on every retryPhase(), exactly like Castle HP already does (see
  // GameEngine.resetAttemptState) — never a lingering, unrecoverable
  // "damaged" state carried into a fresh attempt. Level/Mastery/
  // Specialization stay the only permanent parts of a tower.
  // -------------------------------------------------------------------
  hp: number;
  maxHp: number;
  /** 0 for a tower type with no shield identity (see config/towerSurvival.ts) — always <= its type's maxShield. */
  shieldHp: number;

  /**
   * BALANCEAMENTO DEFINITIVO spec section 7 — Tower Equipment Slots.
   * Fixed-length (TOWER_ITEM_SLOT_COUNT) array; each entry is either an
   * owned ItemInstance.instanceId (equipped) or null (empty). Permanent —
   * carried in TowerLoadoutEntry, never reset by a Season boundary or a
   * retryPhase() (equipping is a build decision, not battle state).
   */
  equippedItemInstanceIds: (string | null)[];

  /**
   * SISTEMA DE SLOTS DE EQUIPAMENTO — permanent, per-TOWER-TYPE slot
   * ownership (mirrors `masteryUnlocked`'s pattern exactly, but per-slot
   * rather than a single boolean). Fixed-length (TOWER_ITEM_SLOT_COUNT);
   * index 0 is always true (the free slot). Denormalized onto every tower
   * instance of the same type, kept in sync by GameEngine whenever it
   * changes. Never reset by a Season boundary. Independent from
   * `equippedItemInstanceIds` — a slot can be unlocked with nothing equipped
   * in it, and unequipping/swapping an item never re-locks its slot.
   */
  unlockedItemSlots: boolean[];
}

/**
 * Persistent shape of a tower — what survives across attempts/reloads in
 * SaveData. Deliberately excludes runtime-only fields (id, position,
 * cooldown) that get regenerated by `createTowerInstance` on resume.
 */
export interface TowerLoadoutEntry {
  slotId: string;
  type: TowerType;
  level: number;
  /** Optional so existing fixtures/tests written before Progression 2.0 still typecheck — SaveSystem.parseTowerLoadout and GameEngine.persist() always populate these on real data. */
  specializationId?: SpecializationId | null;
  specializationLevel?: number;
  equippedSkinId?: string | null;
  /** Optional for the same reason as the specialization fields above — self-heals to 0 on load for a save written before Mastery existed. */
  masteryLevel?: number;
  /** Optional for the same reason — self-heals to an all-empty (TOWER_ITEM_SLOT_COUNT nulls) array on load for a save written before Item Slots existed. */
  equippedItemInstanceIds?: (string | null)[];
}

let nextTowerId = 1;

export function createTowerInstance(
  slotId: string,
  type: TowerType,
  position: Vector2,
  initialLevel = 1,
  specializationId: SpecializationId | null = null,
  specializationLevel = 0,
  equippedSkinId: string | null = null,
  masteryLevel = 0,
  masteryUnlocked = false,
  equippedItemInstanceIds: (string | null)[] = Array(TOWER_ITEM_SLOT_COUNT).fill(null),
  unlockedItemSlots: boolean[] = [...DEFAULT_UNLOCKED_ITEM_SLOTS],
): TowerInstance {
  return {
    id: `tower-${nextTowerId++}`,
    slotId,
    type,
    level: Math.min(Math.max(initialLevel, 1), MAX_TOWER_LEVEL),
    position,
    cooldownRemainingMs: 0,
    // A freshly-built tower must charge up before its first Special Attack
    // — the ultimate meter starts empty, not full — both thematically (an
    // "ultimate" firing before a single normal shot feels wrong) and
    // mechanically (keeps the special's much bigger cooldown from ever
    // colliding with the normal attack's own instant-ready-at-0 on the
    // very same first tick).
    specialCooldownRemainingMs: getTowerSpecialCooldownMs(type),
    disabledRemainingMs: 0,
    specializationId,
    specializationLevel,
    equippedSkinId,
    masteryLevel,
    masteryUnlocked,
    equippedItemInstanceIds,
    unlockedItemSlots,
    ...survivalStatsForFreshTower(type),
  };
}

function survivalStatsForFreshTower(type: TowerType): Pick<TowerInstance, "hp" | "maxHp" | "shieldHp"> {
  const def = getTowerSurvivalDefinition(type);
  return { hp: def.maxHp, maxHp: def.maxHp, shieldHp: def.maxShield };
}

/** Restores a tower's battle HP/shield to full — called once per tower at the start of every attempt (see GameEngine.resetAttemptState), the same "fresh attempt" treatment Castle HP already gets. */
export function resetTowerSurvival(tower: TowerInstance): void {
  const fresh = survivalStatsForFreshTower(tower.type);
  tower.hp = fresh.hp;
  tower.maxHp = fresh.maxHp;
  tower.shieldHp = fresh.shieldHp;
}

/** Flat HP/shield regeneration per second (Recovery — spec section 12), ticked every combat frame alongside tickTowerCooldown. */
export function tickTowerSurvivalRegen(tower: TowerInstance, dtMs: number): void {
  const def = getTowerSurvivalDefinition(tower.type);
  const dtSeconds = dtMs / 1000;
  if (def.maxShield > 0 && tower.shieldHp < def.maxShield) {
    tower.shieldHp = Math.min(def.maxShield, tower.shieldHp + def.shieldRegenPerSecond * dtSeconds);
  }
  if (tower.hp < tower.maxHp) {
    tower.hp = Math.min(tower.maxHp, tower.hp + def.hpRegenPerSecond * dtSeconds);
  }
}

export interface SiegeDamageResult {
  /** Actual amount subtracted from HP (after shield absorption and armor reduction) — 0 if the shield fully absorbed the hit. */
  damageToHp: number;
  /** True the instant this hit brought the tower's HP to exactly 0 (was above 0 before). */
  towerJustDisabled: boolean;
}

/**
 * Resolves one Boss Siege Attack hit against `tower` — Mastery's
 * siegeResistance (a bounded fraction, see config/towerMastery.ts) shrinks
 * the raw hit first, then shield absorbs, then armor reduces what's left,
 * remainder comes off HP. Reaching 0 HP disables the tower (reuses the
 * exact same disabledRemainingMs mechanic a DISABLER enemy already uses)
 * for `disableDurationMs` rather than destroying it — a tower is never
 * permanently lost to this.
 */
export function applySiegeDamage(tower: TowerInstance, rawDamage: number, disableDurationMs: number): SiegeDamageResult {
  const def = getTowerSurvivalDefinition(tower.type);
  const siegeResistance = tower.masteryLevel > 0 ? getMasteryBonuses(tower.masteryLevel).siegeResistance : 0;
  let remaining = rawDamage * (1 - siegeResistance);

  if (tower.shieldHp > 0) {
    const absorbed = Math.min(tower.shieldHp, remaining);
    tower.shieldHp -= absorbed;
    remaining -= absorbed;
  }

  const afterArmor = remaining * (1 - def.armor);
  const wasAboveZero = tower.hp > 0;
  tower.hp = Math.max(0, tower.hp - afterArmor);
  const towerJustDisabled = wasAboveZero && tower.hp === 0;
  if (towerJustDisabled) disableTower(tower, disableDurationMs);

  return { damageToHp: afterArmor, towerJustDisabled };
}

/**
 * The single choke point every combat call site reads a tower's effective
 * damage/attack-speed/range from (CombatSystem.ts's resolveNormalAttack,
 * resolveSpecialAttack, and every chain/crit/frozen-bonus damage
 * calculation).
 *
 * INFINITE BALANCE OVERHAUL — masteryLevel IS read here again, but not the
 * way the old (now-removed) uniform "+X% DPS" version did it. Mastery's
 * combat effect is now small, deliberately damage-weighted last of its five
 * dimensions (see config/towerMastery.ts's getMasteryBonuses doc comment —
 * range is the largest per-point effect, damage the smallest), diminishing-
 * returns shaped (masteryEffectScale), and funded entirely by Gold after a
 * one-time Gems unlock — never a recurring Gems purchase. That is why this
 * no longer violates the NEVER-P2W contract: Gems buy access to the track,
 * Gold buys every point of power in it, exactly like Specialization.
 */
export function getTowerStats(tower: TowerInstance): TowerLevelStats {
  const levelStats = getTowerLevelStats(tower.type, tower.level);
  if (tower.masteryLevel <= 0) return levelStats;

  const bonuses = getMasteryBonuses(tower.masteryLevel);
  return {
    ...levelStats,
    damage: round2(levelStats.damage * bonuses.damageMultiplier),
    attackSpeed: round2(levelStats.attackSpeed * bonuses.attackSpeedMultiplier),
    range: round2(levelStats.range * bonuses.rangeMultiplier),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Master Implementation Pass spec sections 3-6 — Tower Mastery.
// ---------------------------------------------------------------------------

/**
 * HORDENOVA Season/Progression v1.0 — Mastery ownership (`masteryUnlocked`,
 * permanent) is now fully separate from Mastery progression (`masteryLevel`,
 * Season-scoped). The one-time Gems unlock is a pure GameEngine/account-
 * level concern (it flips `masteryUnlocked` for a TOWER TYPE, permanently —
 * see GameEngine.unlockSelectedTowerMastery) and no longer mutates
 * `masteryLevel` at all: unlocking grants ACCESS to the Gold-upgrade track
 * below, not a free first level. `canUnlockMastery`/`unlockMastery` (which
 * used to live here, gated on `masteryLevel <= 0`) are gone — there is no
 * tower-instance-local notion of "unlocked" left to check or mutate.
 */

/** No max level (spec: "SEM CAP REAL") — purchasable once the tower TYPE's Mastery ownership has ever been purchased, regardless of the current (Season-scoped) masteryLevel value — including a freshly Season-reset 0. */
export function canUpgradeMastery(tower: TowerInstance): boolean {
  return tower.masteryUnlocked === true;
}

/** GOLD cost for the selected tower's NEXT mastery level. Only meaningful once unlocked (masteryLevel >= 1) — the 0 -> 1 step uses the flat MASTERY_UNLOCK_GEM_COST instead. */
export function getMasteryUpgradeCostFor(tower: TowerInstance): number {
  return getMasteryUpgradeCost(tower.type, tower.masteryLevel);
}

/** Mutates `tower` in place, incrementing its mastery level (caller owns gold deduction, exactly like upgradeTower above). */
export function upgradeMastery(tower: TowerInstance): void {
  tower.masteryLevel += 1;
}

/**
 * "Trocar Especialização" — HORDENOVA Season/Progression v1.0. Replaces the
 * old Specialization Respec Token system entirely (removed): switching is
 * now a flat, unconditional 200 Gems purchase (see config/specializations.ts's
 * SPECIALIZATION_CHANGE_GEM_COST), never something earned by leveling
 * Mastery. Requires a specialization already chosen — GameEngine is
 * responsible for checking the NEW path is one this account already owns
 * (see unlockedSpecializationIds) and for the Gems deduction before calling
 * `switchSpecialization` below.
 */
export function canSwitchSpecialization(tower: TowerInstance): boolean {
  return tower.specializationId !== null;
}

/**
 * Mutates `tower` in place: switches the active specialization to `newId`,
 * starting its level fresh at 1 for this tower instance (the ABANDONED
 * path's level progress on this instance is not preserved — the same
 * limitation the old Respec Token system already had). Touches ONLY
 * specializationId/specializationLevel — level, masteryLevel, HP, equipped
 * skin, and every other field are left completely untouched. Caller owns
 * checking canSwitchSpecialization, verifying `newId` is already owned, and
 * the Gems deduction.
 */
export function switchSpecialization(tower: TowerInstance, newId: SpecializationId): void {
  tower.specializationId = newId;
  tower.specializationLevel = 1;
}

export function canUpgradeTower(tower: TowerInstance): boolean {
  return tower.level < MAX_TOWER_LEVEL;
}

export function getTowerUpgradeCost(tower: TowerInstance): number | null {
  const raw = getUpgradeCost(tower.type, tower.level);
  return raw === null ? null : applyMasteryGoldDiscount(tower, raw);
}

/**
 * Mastery's goldCostReduction (see config/towerMastery.ts's getMasteryBonuses
 * doc comment: "every Gold price a tower of this type charges — level,
 * specialization") shaves a bounded fraction off both of those prices, never
 * off Mastery's own price (that would be self-referential). Rounds up so a
 * heavily-discounted price never floors to 0 and becomes a free upgrade.
 */
function applyMasteryGoldDiscount(tower: TowerInstance, rawCost: number): number {
  if (tower.masteryLevel <= 0) return rawCost;
  const discount = getMasteryBonuses(tower.masteryLevel).goldCostReduction;
  return Math.max(1, Math.ceil(rawCost * (1 - discount)));
}

/** Mutates `tower` in place, incrementing its level (caller owns gold deduction). */
export function upgradeTower(tower: TowerInstance): void {
  if (canUpgradeTower(tower)) tower.level += 1;
}

/** Mutates `tower` in place, ticking its attack cooldown, special cooldown, and any active jam down. */
export function tickTowerCooldown(tower: TowerInstance, dtMs: number): void {
  tower.cooldownRemainingMs = Math.max(0, tower.cooldownRemainingMs - dtMs);
  tower.specialCooldownRemainingMs = Math.max(0, tower.specialCooldownRemainingMs - dtMs);
  tower.disabledRemainingMs = Math.max(0, tower.disabledRemainingMs - dtMs);
}

export function isTowerReadyToAttack(tower: TowerInstance): boolean {
  return tower.cooldownRemainingMs <= 0 && tower.disabledRemainingMs <= 0;
}

/** Special Attack readiness — completely independent of the normal-attack cooldown above; only shares the disable-jam gate (a disabled tower can't fire either attack). */
export function isTowerReadyForSpecial(tower: TowerInstance): boolean {
  return tower.specialCooldownRemainingMs <= 0 && tower.disabledRemainingMs <= 0;
}

/** Jams the tower for `durationMs` (a DISABLER-archetype hit) — refreshes rather than stacks. */
export function disableTower(tower: TowerInstance, durationMs: number): void {
  tower.disabledRemainingMs = Math.max(tower.disabledRemainingMs, durationMs);
}

/** Resets the cooldown based on the tower's current attack speed (attacks/second). */
export function resetTowerCooldown(tower: TowerInstance): void {
  const stats = getTowerStats(tower);
  tower.cooldownRemainingMs = 1000 / stats.attackSpeed;
}

/** Resets the Special Attack cooldown to its fixed per-tower-type interval (config/towerSpecials.ts) — never derived from attackSpeed/level. */
export function resetTowerSpecialCooldown(tower: TowerInstance): void {
  tower.specialCooldownRemainingMs = getTowerSpecialCooldownMs(tower.type);
}

// ---------------------------------------------------------------------------
// Progression 2.0 — Specialization / Upgrade Slot.
// ---------------------------------------------------------------------------

export function canChooseSpecialization(tower: TowerInstance): boolean {
  return tower.specializationId === null && tower.level >= SPECIALIZATION_UNLOCK_TOWER_LEVEL;
}

/** Mutates `tower` in place. A no-op if a specialization is already chosen, the tower isn't high enough level yet, or `id` doesn't belong to this tower's type. Caller owns gold deduction (choosing costs the level-0->1 specialization price). */
export function chooseSpecialization(tower: TowerInstance, id: SpecializationId): boolean {
  if (!canChooseSpecialization(tower)) return false;
  if (!isSpecializationForTower(id, tower.type)) return false;
  tower.specializationId = id;
  tower.specializationLevel = 1;
  return true;
}

/**
 * INFINITE BALANCE OVERHAUL — both the level AND the combat effect are
 * genuinely uncapped now (see config/specializations.ts's specializationEffectScale
 * — diminishing returns, never flat). So "can upgrade" is simply "has a path
 * chosen" — there is no level at which this returns false.
 */
export function canUpgradeSpecialization(tower: TowerInstance): boolean {
  return tower.specializationId !== null;
}

export function getSpecializationUpgradeCostFor(tower: TowerInstance): number | null {
  if (!tower.specializationId) return null;
  return applyMasteryGoldDiscount(tower, getSpecializationUpgradeCost(tower.type, tower.specializationLevel));
}

/** Mutates `tower` in place, incrementing its specialization level (caller owns gold deduction). */
export function upgradeSpecialization(tower: TowerInstance): void {
  if (canUpgradeSpecialization(tower)) tower.specializationLevel += 1;
}

// ---------------------------------------------------------------------------
// Progression 2.0 — Skins (cosmetic only, never read by combat code).
// ---------------------------------------------------------------------------

/**
 * SEASON-RESET-CORRECTION — skin ownership, not live tower level, is the
 * gate. Tower level is Season-scoped (resets to 0 every Season), but a skin
 * bought/unlocked with real Gems must stay equippable forever afterward
 * (spec example: "Skin Astral" unlocked at Lv15 in Season 1 stays equippable
 * in Season 2 even though the tower is back at level 0). `ownedSkinIds` is
 * the permanent SaveData.ownedTowerSkinIds set — see GameEngine for how a
 * skin actually enters it (getNewlyUnlockedSkinIds below).
 */
export function canEquipSkin(tower: TowerInstance, skinId: string, ownedSkinIds: ReadonlySet<string>): boolean {
  const def = getTowerSkinDefinition(skinId);
  return !!def && def.towerType === tower.type && ownedSkinIds.has(skinId);
}

/** Mutates `tower` in place. `skinId` of null clears back to the default look. Purely cosmetic — never touches level/specialization/stats. */
export function equipSkin(tower: TowerInstance, skinId: string | null, ownedSkinIds: ReadonlySet<string>): boolean {
  if (skinId === null) {
    tower.equippedSkinId = null;
    return true;
  }
  if (!canEquipSkin(tower, skinId, ownedSkinIds)) return false;
  tower.equippedSkinId = skinId;
  return true;
}

/**
 * Whether `skinId` is currently purchasable for `tower` — reached the
 * required level (this Season or a prior one; level itself doesn't persist,
 * but the fact that a tower of this type has been leveled enough IS
 * re-earnable every Season) and not already owned. Caller (GameEngine)
 * still owns checking/deducting Gems — see towerSkins.ts's gemCost.
 */
export function canPurchaseSkin(tower: TowerInstance, skinId: string, ownedSkinIds: ReadonlySet<string>): boolean {
  const def = getTowerSkinDefinition(skinId);
  return !!def && def.towerType === tower.type && tower.level >= def.unlockLevel && !ownedSkinIds.has(skinId);
}

// ---------------------------------------------------------------------------
// BALANCEAMENTO DEFINITIVO spec section 7 — Tower Equipment Slots (architecture
// only — see config/towerItemSlots.ts's own doc comment for the full scope
// note). GameEngine owns cross-tower bookkeeping (an item can't be equipped
// on two towers at once, and must actually be in the account's inventory);
// these functions only ever touch the ONE tower passed in, mirroring the
// equipSkin/canEquipSkin split above.
// ---------------------------------------------------------------------------

/**
 * Whether `item` can go into `tower`'s slot `slotIndex` right now. Callers
 * (GameEngine) are responsible for `alreadyEquippedElsewhere` — whether this
 * exact ItemInstance is currently equipped on any OTHER tower (this tower's
 * own other slots don't count; re-equipping into a different slot on the
 * same tower is just a slot change, not a duplication).
 */
export function canEquipItem(
  tower: TowerInstance,
  slotIndex: number,
  item: Pick<ItemInstance, "itemDefinitionId" | "pendingTrade">,
  alreadyEquippedElsewhere: boolean,
): boolean {
  if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return false;
  if (!tower.unlockedItemSlots[slotIndex]) return false;
  if (alreadyEquippedElsewhere) return false;
  if (item.pendingTrade) return false;
  const def = getItemDefinition(item.itemDefinitionId);
  return !!def && def.category !== "COSMETIC";
}

/** Mutates `tower` in place — caller owns the canEquipItem check beforehand. */
export function equipItem(tower: TowerInstance, slotIndex: number, instanceId: string): void {
  tower.equippedItemInstanceIds[slotIndex] = instanceId;
}

/** Mutates `tower` in place. A no-op if `slotIndex` is out of range or already empty. */
export function unequipItem(tower: TowerInstance, slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return;
  tower.equippedItemInstanceIds[slotIndex] = null;
}

/**
 * SISTEMA DE SLOTS DE EQUIPAMENTO — whether `slotIndex` is purchasable right
 * now: in range, not already unlocked, and not the always-free slot 0
 * (which is never "purchasable" — it's already unlocked). Gems-sufficiency
 * is a GameEngine concern (mirrors canUnlockSelectedTowerMastery's split:
 * this function only knows tower-instance state).
 */
export function canUnlockItemSlot(tower: TowerInstance, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return false;
  if (getItemSlotUnlockCost(slotIndex) <= 0) return false;
  return tower.unlockedItemSlots[slotIndex] !== true;
}

/** Mutates `tower` in place — caller (GameEngine) owns the Gems check/deduction and confirmation step beforehand. Permanent: never call this to "re-lock" a slot. */
export function unlockItemSlot(tower: TowerInstance, slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return;
  tower.unlockedItemSlots[slotIndex] = true;
}
