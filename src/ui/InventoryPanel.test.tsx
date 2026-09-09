import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { InventoryPanel } from "./InventoryPanel";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import type { FusionEligibility, FusionOutcome } from "@/engine/ItemFusion";

function makeItem(itemDefinitionId: string): ItemInstance {
  return createItemInstance(itemDefinitionId, "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
}

function renderPanel(props: {
  inventory: ItemInstance[];
  getFusionEligibility?: (ids: string[]) => FusionEligibility;
  onAttemptFusion?: (ids: string[]) => FusionOutcome;
}): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LanguageProvider>
        <InventoryPanel
          inventory={props.inventory}
          localEconomyTotals={{ bossesDefeatedTotal: 0, miniBossesDefeatedTotal: 0 }}
          onClose={() => {}}
          inventoryCapacity={20}
          overflowInventory={[]}
          onClaimOverflowItem={() => {}}
          gemShards={0}
          onConvertGemShards={() => {}}
          gems={0}
          prestigeLevel={0}
          bestWave={0}
          onUpgradePrestige={() => {}}
          getFusionEligibility={props.getFusionEligibility ?? (() => ({ ok: false, reason: "WRONG_COUNT" }))}
          onAttemptFusion={props.onAttemptFusion ?? (() => ({ status: "BLOCKED", reason: "WRONG_COUNT" }))}
        />
      </LanguageProvider>,
    );
  });
  return { container, root };
}

function findExactButton(container: HTMLDivElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent === text) ?? null;
}

/**
 * SISTEMA DE FUSÃO DE ITENS — the "FUSÃO DE ITENS" section inside the
 * existing Inventory screen. Confirmation must be impossible with fewer
 * than 3 items selected, and onAttemptFusion (the only place Gems/items are
 * ever actually spent) must never fire before the explicit CONFIRMAR click.
 */
describe("InventoryPanel — Item Fusion section (SISTEMA DE FUSÃO DE ITENS)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the FUSÃO section with an empty selection by default", () => {
    const item = makeItem("warden_fragment");
    const { container } = renderPanel({ inventory: [item] });
    expect(container.textContent).toContain("ITEM FUSION");
    expect(container.textContent).toContain("0/3 selected");
  });

  it("selecting fewer than 3 items keeps CONFIRMAR FUSÃO disabled", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment")];
    const { container } = renderPanel({ inventory: items });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    expect(checkboxes).toHaveLength(2);
    act(() => checkboxes[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("1/3 selected");
    const confirmButton = findExactButton(container, "CONFIRM FUSION");
    expect(confirmButton).not.toBeNull();
    expect(confirmButton!.disabled).toBe(true);
  });

  it("selecting exactly 3 eligible items enables CONFIRMAR FUSÃO and shows the success chance", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const eligibility: FusionEligibility = { ok: true, rarity: "COMMON", nextRarity: "UNCOMMON" };
    const { container } = renderPanel({ inventory: items, getFusionEligibility: () => eligibility });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("3/3 selected");
    expect(container.textContent).toContain("40.00%"); // COMMON's chance
    expect(container.textContent).toContain("destroyed"); // warning text fragment
    const confirmButton = findExactButton(container, "CONFIRM FUSION");
    expect(confirmButton!.disabled).toBe(false);
  });

  it("clicking CONFIRMAR FUSÃO only arms a confirmation step — onAttemptFusion is NOT called from the initial click", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const onAttemptFusion = vi.fn();
    const { container } = renderPanel({
      inventory: items,
      getFusionEligibility: () => ({ ok: true, rarity: "COMMON", nextRarity: "UNCOMMON" }),
      onAttemptFusion,
    });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findExactButton(container, "CONFIRM FUSION")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onAttemptFusion).not.toHaveBeenCalled();
    expect(findExactButton(container, "CONFIRM")).not.toBeNull();
    expect(findExactButton(container, "CANCEL")).not.toBeNull();
  });

  it("confirming the fusion calls onAttemptFusion exactly once with the 3 selected instanceIds", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const onAttemptFusion = vi.fn((_ids: string[]) => ({ status: "FAILURE", rarity: "COMMON", nextRarity: "UNCOMMON" }) as FusionOutcome);
    const { container } = renderPanel({
      inventory: items,
      getFusionEligibility: () => ({ ok: true, rarity: "COMMON", nextRarity: "UNCOMMON" }),
      onAttemptFusion,
    });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findExactButton(container, "CONFIRM FUSION")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findExactButton(container, "CONFIRM")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onAttemptFusion).toHaveBeenCalledTimes(1);
    expect(onAttemptFusion.mock.calls[0]![0]).toEqual(items.map((i) => i.instanceId));
    expect(container.textContent).toContain("Fusion failed");
  });

  it("shows the exact success message with the new item's name after a successful fusion", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const resultItem = createItemInstance("mosswood_charm", "player-1", { type: "FUSION", refId: "fusion" });
    const onAttemptFusion = vi.fn(
      () => ({ status: "SUCCESS", rarity: "COMMON", nextRarity: "UNCOMMON", resultItem }) as FusionOutcome,
    );
    const { container } = renderPanel({
      inventory: items,
      getFusionEligibility: () => ({ ok: true, rarity: "COMMON", nextRarity: "UNCOMMON" }),
      onAttemptFusion,
    });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findExactButton(container, "CONFIRM FUSION")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => findExactButton(container, "CONFIRM")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("Fusion complete");
    expect(container.textContent).toContain("Mosswood Charm");
  });

  it("mixed rarities are blocked and the reason is shown instead of a success chance", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("mosswood_charm")];
    const { container } = renderPanel({
      inventory: items,
      getFusionEligibility: () => ({ ok: false, reason: "MIXED_RARITY" }),
    });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("same rarity");
    expect(findExactButton(container, "CONFIRM FUSION")!.disabled).toBe(true);
  });

  it("selecting a 4th item is a no-op — the extra checkbox stays unselected and the count never exceeds 3", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const { container } = renderPanel({ inventory: items });

    const checkboxes = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title === "Select for fusion",
    );
    for (const box of checkboxes) act(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container.textContent).toContain("3/3 selected");
  });
});
