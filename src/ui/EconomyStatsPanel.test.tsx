import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { EconomyStatsPanel } from "./EconomyStatsPanel";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { getPrestigeBonuses, getPrestigeUpgradeCost, PRESTIGE_FUNCTIONAL_CAP_LEVEL, PRESTIGE_MIN_BEST_WAVE } from "@/config/prestige";

const SUMMARY = { bossesDefeatedTotal: 0, miniBossesDefeatedTotal: 0, itemsOwnedTotal: 0, itemsFoundTotal: 0 };

function renderPanel(props: { gems?: number; prestigeLevel?: number; bestWave?: number; onUpgradePrestige?: () => void }): {
  container: HTMLDivElement;
  root: Root;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LanguageProvider>
        <EconomyStatsPanel
          summary={SUMMARY}
          gems={props.gems ?? 0}
          prestigeLevel={props.prestigeLevel ?? 0}
          bestWave={props.bestWave ?? 0}
          onUpgradePrestige={props.onUpgradePrestige ?? (() => {})}
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
 * HORDENOVA — Prestige presentation on the player Profile (Inventory
 * "Stats" tab): every number here must come straight from config/prestige.ts
 * (no hand-typed duplicate) so the UI can never drift from the real cost/
 * benefit curve. These tests pin that contract, plus the three required
 * visual states (locked / affordable / not affordable).
 */
describe("EconomyStatsPanel — Prestige presentation", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows the locked state with the real requirement and the player's real bestWave when bestWave < PRESTIGE_MIN_BEST_WAVE", () => {
    ({ container, root } = renderPanel({ bestWave: 40 }));
    expect(container.textContent).toContain(String(PRESTIGE_MIN_BEST_WAVE));
    expect(container.textContent).toContain("40");
    expect(container.querySelector("button")).toBeNull(); // no upgrade action while locked
  });

  it("unlocks at exactly PRESTIGE_MIN_BEST_WAVE and shows the current level + real cumulative benefits", () => {
    ({ container, root } = renderPanel({ bestWave: PRESTIGE_MIN_BEST_WAVE, prestigeLevel: 12, gems: 999_999 }));
    const bonuses = getPrestigeBonuses(12);
    const goldPct = Math.round((bonuses.goldMultiplier - 1) * 1000) / 10;
    const shardPct = Math.round((bonuses.gemShardMultiplier - 1) * 1000) / 10;
    expect(container.textContent).toContain(`+${goldPct}% Gold`);
    expect(container.textContent).toContain(`+${shardPct}% Gem Shards`);
  });

  it("shows the real next-level cost from getPrestigeUpgradeCost — never a hand-typed number", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, gems: 999_999 }));
    const realCost = getPrestigeUpgradeCost(5);
    expect(container.textContent).toContain(String(realCost));
  });

  it("enables the upgrade button and shows no missing-Gems message when Gems are sufficient", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, gems: getPrestigeUpgradeCost(5) }));
    const button = findButtonByText(container, "MELHORAR PRESTÍGIO") ?? findButtonByText(container, "UPGRADE PRESTIGE");
    expect(button).not.toBeNull();
    expect(button!.disabled).toBe(false);
    expect(container.textContent).not.toContain("Faltam");
  });

  it("disables the upgrade button and shows exactly how many Gems are missing when Gems are insufficient", () => {
    const cost = getPrestigeUpgradeCost(5);
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, gems: cost - 10 }));
    const button = findButtonByText(container, "MELHORAR PRESTÍGIO") ?? findButtonByText(container, "UPGRADE PRESTIGE");
    expect(button!.disabled).toBe(true);
    expect(container.textContent).toContain("10 more Gems needed");
  });

  it("calls onUpgradePrestige when the (affordable) button is clicked", () => {
    const onUpgradePrestige = vi.fn();
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, gems: getPrestigeUpgradeCost(5), onUpgradePrestige }));
    const button = findButtonByText(container, "MELHORAR PRESTÍGIO") ?? findButtonByText(container, "UPGRADE PRESTIGE");
    act(() => button!.click());
    expect(onUpgradePrestige).toHaveBeenCalledTimes(1);
  });

  it("past the functional cap level, the next level shows no additional economic bonus instead of a fake +0%", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: PRESTIGE_FUNCTIONAL_CAP_LEVEL + 5, gems: 999_999 }));
    expect(container.textContent).toContain("No additional economic bonus");
    expect(container.textContent).not.toContain("+0% Gold");
  });

  it("the progression list always covers at least the full 1..PRESTIGE_FUNCTIONAL_CAP_LEVEL range", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 1, gems: 0 }));
    expect(container.textContent).toContain(`Level ${PRESTIGE_FUNCTIONAL_CAP_LEVEL}`);
  });
});
