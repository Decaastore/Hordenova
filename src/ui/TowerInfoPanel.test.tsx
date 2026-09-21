import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// React 18's act() only suppresses its "not configured" warning when this
// global is set — jsdom doesn't set it automatically the way a full
// testing-library setup would (see HUD.test.tsx's own copy of this note).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { TowerInfoPanel } from "./TowerInfoPanel";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { createTowerInstance, type TowerInstance } from "@/entities/Tower";
import { SPECIALIZATION_CHANGE_GEM_PRICE } from "@/config/specializations";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import type { DualGemPrice, GemCurrency } from "@/config/gemsEconomy";

function makeTower(overrides: Partial<TowerInstance> = {}): TowerInstance {
  const tower = createTowerInstance(
    "slot-1",
    "IRONWOOD",
    { x: 0, y: 0 },
    10,
    "IRONWOOD_EXECUTIONER",
    3,
    null,
    0,
    false,
  );
  return { ...tower, ...overrides };
}

function renderPanel(props: {
  tower: TowerInstance;
  gold?: number;
  freeGems?: number;
  purchasedGems?: number;
  unlockedSpecializationIdsForType?: readonly string[];
  onSwitchSpecialization?: (id: string, currency: GemCurrency) => void;
  itemSlots?: readonly (ItemInstance | null)[];
  inventory?: readonly ItemInstance[];
  canEquipToSlot?: (instanceId: string, slotIndex: number) => boolean;
  onEquipItem?: (instanceId: string, slotIndex: number) => void;
  onUnequipItem?: (slotIndex: number) => void;
  unlockedSlots?: readonly boolean[];
  getSlotUnlockPrice?: (slotIndex: number) => DualGemPrice | null;
  canUnlockSlot?: (slotIndex: number, currency: GemCurrency) => boolean;
  onUnlockSlot?: (slotIndex: number, currency: GemCurrency) => void;
}): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LanguageProvider>
        <TowerInfoPanel
          tower={props.tower}
          gold={props.gold ?? 999999}
          freeGems={props.freeGems ?? 999999}
          purchasedGems={props.purchasedGems ?? 999999}
          onUpgrade={() => {}}
          onClose={() => {}}
          onChooseSpecialization={() => {}}
          onUpgradeSpecialization={() => {}}
          onEquipSkin={() => {}}
          onPurchaseSkin={() => {}}
          isSkinOwned={() => false}
          onUnlockMastery={() => {}}
          onUpgradeMastery={() => {}}
          unlockedSpecializationIdsForType={(props.unlockedSpecializationIdsForType ?? ["IRONWOOD_EXECUTIONER"]) as never}
          onSwitchSpecialization={(props.onSwitchSpecialization ?? (() => {})) as never}
          repositionFreeAvailable={true}
          onStartReposition={() => {}}
          itemSlots={props.itemSlots ?? [null, null, null]}
          inventory={props.inventory ?? []}
          canEquipToSlot={props.canEquipToSlot ?? (() => false)}
          onEquipItem={props.onEquipItem ?? (() => {})}
          onUnequipItem={props.onUnequipItem ?? (() => {})}
          unlockedSlots={props.unlockedSlots ?? [true, true, true]}
          getSlotUnlockPrice={props.getSlotUnlockPrice ?? (() => null)}
          canUnlockSlot={props.canUnlockSlot ?? (() => true)}
          onUnlockSlot={props.onUnlockSlot ?? (() => {})}
        />
      </LanguageProvider>,
    );
  });
  return { container, root };
}

function findButtonByText(container: HTMLDivElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text)) ?? null;
}

/**
 * HORDENOVA "Trocar Especialização" UI fix — the action was already fully
 * implemented at the engine level (GameEngine.switchTowerSpecialization),
 * but was never verified end-to-end at the component level, which is
 * exactly where the reported "it doesn't appear" bug turned out to live in
 * spirit (a real player almost never naturally owns 2+ specializations for
 * one tower type, so the — correctly gated — action legitimately never
 * showed for them). These tests pin the actual rendering contract, updated
 * for GEMS ECONOMY v2's dual 🔒 Free / 💎 Purchased price buttons — paying
 * with either currency now switches specialization directly from the
 * confirmation box (there is no separate single "CONFIRM" step).
 */
describe("TowerInfoPanel — \"Trocar Especialização\" (HORDENOVA Season/Progression v1.0)", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("does NOT show the switch action when the account owns only the currently-equipped path — no useless offer", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER"],
    }));
    expect(container.textContent).not.toContain("SWITCH TO");
    expect(container.textContent).not.toContain("SWITCH SPECIALIZATION");
  });

  it("shows a clearly labeled switch action, with the real dual (Free/Purchased) price, once a 2nd path is owned", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
    }));
    expect(container.textContent).toContain("SWITCH SPECIALIZATION");
    const switchButton = findButtonByText(container, "Breaker");
    expect(switchButton).not.toBeNull();
    expect(switchButton!.textContent).toContain(String(SPECIALIZATION_CHANGE_GEM_PRICE.free));
    expect(switchButton!.textContent).toContain(String(SPECIALIZATION_CHANGE_GEM_PRICE.purchased));
    expect(switchButton!.disabled).toBe(false);
  });

  it("never offers switching to a path the account has not unlocked", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
    }));
    // IRONWOOD_VANGUARD is a real path for this tower type but was never
    // included in unlockedSpecializationIdsForType above.
    expect(findButtonByText(container, "Vanguard")).toBeNull();
  });

  it("clicking a switch target shows a confirmation prompt with BOTH currency options, WITHOUT spending Gems yet", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    const switchButton = findButtonByText(container, "Breaker")!;
    act(() => switchButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onSwitch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Breaker");
    expect(findButtonByText(container, "🔒")).not.toBeNull();
    expect(findButtonByText(container, "💎")).not.toBeNull();
    expect(findButtonByText(container, "CANCEL")).not.toBeNull();
  });

  it("confirming the switch by paying with PURCHASED Gems calls onSwitchSpecialization exactly once with the chosen id and currency", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    act(() => findButtonByText(container, "Breaker")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findButtonByText(container, "💎")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("IRONWOOD_BREAKER", "PURCHASED");
  });

  it("confirming the switch by paying with FREE Gems calls onSwitchSpecialization exactly once with the chosen id and currency", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    act(() => findButtonByText(container, "Breaker")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findButtonByText(container, "🔒")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("IRONWOOD_BREAKER", "FREE");
  });

  it("canceling the confirmation calls onSwitchSpecialization zero times and returns to the target list", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    act(() => findButtonByText(container, "Breaker")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findButtonByText(container, "CANCEL")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onSwitch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Switch specialization to"); // confirm box gone
    expect(findButtonByText(container, "CANCEL")).toBeNull();
    expect(findButtonByText(container, "Breaker")).not.toBeNull(); // back to the plain target button
  });

  it("disables the switch action when the account cannot afford EITHER currency's price, and it stays inert", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      freeGems: SPECIALIZATION_CHANGE_GEM_PRICE.free - 1,
      purchasedGems: SPECIALIZATION_CHANGE_GEM_PRICE.purchased - 1,
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    const switchButton = findButtonByText(container, "Breaker")!;
    expect(switchButton.disabled).toBe(true);

    act(() => switchButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Switch specialization to"); // never reached the confirm step
  });

  it("stays enabled when only ONE currency is affordable — the account can still switch by paying with that currency", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      freeGems: 0,
      purchasedGems: SPECIALIZATION_CHANGE_GEM_PRICE.purchased,
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
    }));
    const switchButton = findButtonByText(container, "Breaker")!;
    expect(switchButton.disabled).toBe(false);
  });
});

/**
 * BALANCEAMENTO DEFINITIVO spec section 7/8 — "Tower > Equipment > [Slot 1]
 * [Slot 2] [Slot 3]" component-level rendering contract.
 */
describe("TowerInfoPanel — Equipment slots (BALANCEAMENTO DEFINITIVO spec section 7/8)", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function makeItem(itemDefinitionId: string): ItemInstance {
    return createItemInstance(itemDefinitionId, "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
  }

  it("shows all 3 slots as empty when nothing is equipped", () => {
    ({ container, root } = renderPanel({ tower: makeTower() }));
    expect(container.textContent).toContain("EQUIPMENT");
    const equipButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "EQUIP");
    expect(equipButtons).toHaveLength(3);
  });

  it("shows the item's name and a REMOVE action for a filled slot", () => {
    const item = makeItem("mosswood_charm");
    ({ container, root } = renderPanel({ tower: makeTower(), itemSlots: [item, null, null] }));
    expect(container.textContent).toContain("Mosswood Charm");
    expect(findButtonByText(container, "REMOVE")).not.toBeNull();
  });

  it("clicking EQUIP on an empty slot opens a picker of eligible inventory items, and picking one calls onEquipItem with the right slot index", () => {
    const item = makeItem("ancient_core");
    const onEquip = vi.fn();
    ({
      container,
      root,
    } = renderPanel({
      tower: makeTower(),
      inventory: [item],
      canEquipToSlot: () => true,
      onEquipItem: onEquip,
    }));

    const equipButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "EQUIP");
    act(() => equipButtons[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("Ancient Core");

    const itemButton = findButtonByText(container, "Ancient Core")!;
    act(() => itemButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onEquip).toHaveBeenCalledWith(item.instanceId, 1);
  });

  it("clicking REMOVE on a filled slot calls onUnequipItem with the right slot index", () => {
    const item = makeItem("hollow_sigil");
    const onUnequip = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      itemSlots: [null, item, null],
      onUnequipItem: onUnequip,
    }));
    act(() => findButtonByText(container, "REMOVE")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUnequip).toHaveBeenCalledWith(1);
  });

  it("the picker shows a clear message instead of an empty list when no inventory item is eligible", () => {
    ({ container, root } = renderPanel({ tower: makeTower(), inventory: [], canEquipToSlot: () => false }));
    const equipButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "EQUIP");
    act(() => equipButtons[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("No compatible items");
  });
});

/**
 * SISTEMA DE SLOTS DE EQUIPAMENTO — the lock/unlock UI itself, updated for
 * GEMS ECONOMY v2: Slot 1 always reads unlocked; Slot 2/3 show their real
 * dual (Free/Purchased) price and a mandatory confirmation step — rendered
 * as the shared DualGemPriceButtons — before any Gems are spent (onUnlockSlot
 * must never fire from the initial click).
 */
describe("TowerInfoPanel — Equipment slot unlock UI (SISTEMA DE SLOTS DE EQUIPAMENTO)", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The panel's Mastery section also renders an "UNLOCK MASTERY" button, so
  // an .includes() search for "UNLOCK" would match the WRONG button (it
  // renders earlier in the DOM) — this requires an EXACT match, the same
  // way the existing EQUIP/REMOVE assertions above already do.
  function findExactButton(text: string): HTMLButtonElement | null {
    return Array.from(container.querySelectorAll("button")).find((b) => b.textContent === text) ?? null;
  }

  const SLOT_2_PRICE: DualGemPrice = { free: 375, purchased: 250 };
  const SLOT_3_PRICE: DualGemPrice = { free: 750, purchased: 500 };
  const pricesByIndex: (DualGemPrice | null)[] = [null, SLOT_2_PRICE, SLOT_3_PRICE];

  it("Slot 1 shows as unlocked and never shows an unlock action", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
    }));
    expect(container.textContent).toContain("Unlocked");
    const equipButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "EQUIP");
    // Only slot 1 (unlocked) offers EQUIP — slots 2/3 are locked.
    expect(equipButtons).toHaveLength(1);
  });

  it("a locked slot (2/3) shows its real dual price and an UNLOCK action instead of EQUIP", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
    }));
    expect(container.textContent).toContain(String(SLOT_2_PRICE.free));
    expect(container.textContent).toContain(String(SLOT_2_PRICE.purchased));
    expect(container.textContent).toContain(String(SLOT_3_PRICE.free));
    expect(container.textContent).toContain(String(SLOT_3_PRICE.purchased));
    expect(findExactButton("UNLOCK")).not.toBeNull();
  });

  it("insufficient Gems in BOTH currencies disables the UNLOCK button entirely", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      freeGems: 0,
      purchasedGems: 0,
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: () => false,
    }));
    const unlockButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "UNLOCK");
    expect(unlockButtons.length).toBeGreaterThan(0);
    expect(unlockButtons.every((b) => b.disabled)).toBe(true);
  });

  it("with only Purchased Gems sufficient, UNLOCK stays enabled and the confirmation step disables the Free button with the exact shortfall in its tooltip", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      freeGems: 100,
      purchasedGems: 999999,
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: (_slotIndex, currency) => currency === "PURCHASED",
    }));
    const unlockButton = findExactButton("UNLOCK")!;
    expect(unlockButton.disabled).toBe(false);
    act(() => unlockButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const freeButton = findButtonByText(container, "🔒")!;
    const purchasedButton = findButtonByText(container, "💎")!;
    expect(freeButton.disabled).toBe(true);
    expect(freeButton.title).toContain(`100 / ${SLOT_2_PRICE.free}`);
    expect(purchasedButton.disabled).toBe(false);
  });

  it("clicking UNLOCK only arms a confirmation step — onUnlockSlot is NOT called from the initial click", () => {
    const onUnlockSlot = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: () => true,
      onUnlockSlot,
    }));
    const unlockButton = findExactButton("UNLOCK")!;
    act(() => unlockButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUnlockSlot).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Unlock Slot 2?");
    expect(findButtonByText(container, "🔒")).not.toBeNull();
    expect(findButtonByText(container, "💎")).not.toBeNull();
  });

  it("confirming the unlock by paying with PURCHASED Gems calls onUnlockSlot exactly once with the right slot index and currency", () => {
    const onUnlockSlot = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: () => true,
      onUnlockSlot,
    }));
    const unlockButton = findExactButton("UNLOCK")!;
    act(() => unlockButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const purchasedButton = findButtonByText(container, "💎")!;
    act(() => purchasedButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUnlockSlot).toHaveBeenCalledTimes(1);
    expect(onUnlockSlot).toHaveBeenCalledWith(1, "PURCHASED");
  });

  it("confirming the unlock by paying with FREE Gems calls onUnlockSlot exactly once with the right slot index and currency", () => {
    const onUnlockSlot = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: () => true,
      onUnlockSlot,
    }));
    const unlockButton = findExactButton("UNLOCK")!;
    act(() => unlockButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const freeButton = findButtonByText(container, "🔒")!;
    act(() => freeButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUnlockSlot).toHaveBeenCalledTimes(1);
    expect(onUnlockSlot).toHaveBeenCalledWith(1, "FREE");
  });

  it("canceling the confirmation calls onUnlockSlot zero times and returns to the locked row", () => {
    const onUnlockSlot = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSlots: [true, false, false],
      getSlotUnlockPrice: (i) => pricesByIndex[i] ?? null,
      canUnlockSlot: () => true,
      onUnlockSlot,
    }));
    const unlockButton = findExactButton("UNLOCK")!;
    act(() => unlockButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const cancelButton = findButtonByText(container, "CANCEL")!;
    act(() => cancelButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUnlockSlot).not.toHaveBeenCalled();
    expect(findExactButton("UNLOCK")).not.toBeNull();
  });
});
