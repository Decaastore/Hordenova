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
