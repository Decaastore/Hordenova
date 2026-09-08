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
import { SPECIALIZATION_CHANGE_GEM_COST } from "@/config/specializations";

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
  gems?: number;
  unlockedSpecializationIdsForType?: readonly string[];
  onSwitchSpecialization?: (id: string) => void;
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
          gems={props.gems ?? 999999}
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
 * showed for them). These tests pin the actual rendering contract.
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

  it("shows a clearly labeled switch action, with the 200 Gems cost, once a 2nd path is owned", () => {
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
    }));
    expect(container.textContent).toContain("SWITCH SPECIALIZATION");
    const switchButton = findButtonByText(container, "Breaker");
    expect(switchButton).not.toBeNull();
    expect(switchButton!.textContent).toContain(String(SPECIALIZATION_CHANGE_GEM_COST));
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

  it("clicking a switch target shows a confirmation prompt WITHOUT spending Gems yet", () => {
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
    expect(findButtonByText(container, "CONFIRM")).not.toBeNull();
    expect(findButtonByText(container, "CANCEL")).not.toBeNull();
  });

  it("confirming the switch calls onSwitchSpecialization exactly once with the chosen id", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    act(() => findButtonByText(container, "Breaker")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findButtonByText(container, "CONFIRM")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("IRONWOOD_BREAKER");
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
    expect(findButtonByText(container, "CONFIRM")).toBeNull();
    expect(findButtonByText(container, "Breaker")).not.toBeNull(); // back to the plain target button
  });

  it("disables the switch action when the account cannot afford the 200 Gems cost, and it stays inert", () => {
    const onSwitch = vi.fn();
    ({ container, root } = renderPanel({
      tower: makeTower(),
      gems: SPECIALIZATION_CHANGE_GEM_COST - 1,
      unlockedSpecializationIdsForType: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"],
      onSwitchSpecialization: onSwitch,
    }));
    const switchButton = findButtonByText(container, "Breaker")!;
    expect(switchButton.disabled).toBe(true);

    act(() => switchButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(findButtonByText(container, "CONFIRM")).toBeNull(); // never reached the confirm step
  });
});
