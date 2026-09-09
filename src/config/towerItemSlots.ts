/**
 * BALANCEAMENTO DEFINITIVO spec section 7 — Tower Equipment Slots.
 *
 * ARCHITECTURE ONLY, exactly as scoped: this does not invent new items, a
 * drop system, or a Gems-for-power economy. It reuses the item system that
 * already exists in full (entities/Item.ts's ItemInstance, config/
 * itemDefinitions.ts's real Boss-dropped catalog — warden_fragment through
 * crown_of_the_hollow_king, all already dropping from Hollow Warden per
 * config/dropTables.ts) and gives towers somewhere to actually EQUIP a copy
 * a player already owns. itemDefinitions.ts's own header note ("nothing in
 * CombatSystem reads ItemEffect yet... a deliberate scope cut") still
 * applies unchanged here: equipping an item does not grant its declared
 * ItemEffect any combat power in this pass — that wiring, and any new item
 * catalog, is explicitly future work per the task's own instruction not to
 * invent large multipliers now.
 *
 * Compatibility rule (the one the spec explicitly asks be validated): a
 * slot accepts any item whose category is NOT "COSMETIC" — COSMETIC is
 * reserved for actual cosmetic-equip slots elsewhere (tower skins already
 * cover that), never a combat-equipment slot. All 3 slots are otherwise
 * uniform (no per-slot type restriction) — the smallest defensible shape
 * given nothing in the current 6-item catalog is itself slot-typed.
 */
export const TOWER_ITEM_SLOT_COUNT = 3;

/**
 * SISTEMA DE SLOTS DE EQUIPAMENTO — unlock economy. Slot 0 is free and
 * always unlocked (structurally, not by spending anything). Slots 1 and 2
 * (the "Slot 2"/"Slot 3" the player sees, 1-indexed in UI copy) each cost a
 * one-time, PERMANENT Gems purchase — never re-locked by a Season Reset,
 * never re-purchasable, never priced in any other currency. These numbers
 * are final per the task spec and are not a balance lever.
 */
export const TOWER_ITEM_SLOT_UNLOCK_GEM_COST: readonly number[] = [0, 250, 500];

/** Gems cost to unlock `slotIndex` (0-indexed). Slot 0 is always 0 (already unlocked). Throws on an out-of-range index — callers must check bounds via TOWER_ITEM_SLOT_COUNT first. */
export function getItemSlotUnlockCost(slotIndex: number): number {
  const cost = TOWER_ITEM_SLOT_UNLOCK_GEM_COST[slotIndex];
  if (cost === undefined) throw new Error(`getItemSlotUnlockCost: slotIndex ${slotIndex} out of range`);
  return cost;
}

/** Fresh-tower default: only slot 0 (the free slot) starts unlocked. */
export const DEFAULT_UNLOCKED_ITEM_SLOTS: readonly boolean[] = [true, false, false];
