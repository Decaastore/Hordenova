import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { EconomyStatsPanel } from "./EconomyStatsPanel";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { getPrestigeBonuses, getPrestigeUpgradeDualPrice, PRESTIGE_FUNCTIONAL_CAP_LEVEL, PRESTIGE_MIN_BEST_WAVE } from "@/config/prestige";
import type { GemCurrency } from "@/config/gemsEconomy";

const SUMMARY = { bossesDefeatedTotal: 0, miniBossesDefeatedTotal: 0, itemsOwnedTotal: 0, itemsFoundTotal: 0 };

function renderPanel(props: {
  freeGems?: number;
  purchasedGems?: number;
  prestigeLevel?: number;
  bestWave?: number;
  onUpgradePrestige?: (currency: GemCurrency) => void;
}): {
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
          freeGems={props.freeGems ?? 0}
          purchasedGems={props.purchasedGems ?? 0}
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
 * visual states (locked / affordable / not affordable), now expressed as
 * the shared GEMS ECONOMY v2 dual 🔒/💎 price buttons instead of a single
 * "UPGRADE PRESTIGE" button.
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
    ({ container, root } = renderPanel({ bestWave: PRESTIGE_MIN_BEST_WAVE, prestigeLevel: 12, freeGems: 999_999, purchasedGems: 999_999 }));
    const bonuses = getPrestigeBonuses(12);
    const goldPct = Math.round((bonuses.goldMultiplier - 1) * 1000) / 10;
    const shardPct = Math.round((bonuses.gemShardMultiplier - 1) * 1000) / 10;
    expect(container.textContent).toContain(`+${goldPct}% Gold`);
    expect(container.textContent).toContain(`+${shardPct}% Gem Shards`);
  });

  it("shows the real next-level dual price (Free and Purchased) from getPrestigeUpgradeDualPrice — never a hand-typed number", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, freeGems: 999_999, purchasedGems: 999_999 }));
    const realPrice = getPrestigeUpgradeDualPrice(5);
    expect(container.textContent).toContain(String(realPrice.free));
    expect(container.textContent).toContain(String(realPrice.purchased));
  });

  it("enables both the Free and Purchased upgrade buttons when both balances are sufficient", () => {
    const price = getPrestigeUpgradeDualPrice(5);
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, freeGems: price.free, purchasedGems: price.purchased }));
    const freeButton = findButtonByText(container, "🔒");
    const purchasedButton = findButtonByText(container, "💎");
    expect(freeButton).not.toBeNull();
    expect(purchasedButton).not.toBeNull();
    expect(freeButton!.disabled).toBe(false);
    expect(purchasedButton!.disabled).toBe(false);
  });

  it("disables the Free button (with the exact shortfall in its tooltip) while the Purchased button stays enabled when only Purchased is sufficient", () => {
    const price = getPrestigeUpgradeDualPrice(5);
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, freeGems: price.free - 10, purchasedGems: price.purchased }));
    const freeButton = findButtonByText(container, "🔒");
    const purchasedButton = findButtonByText(container, "💎");
    expect(freeButton!.disabled).toBe(true);
    expect(freeButton!.title).toContain(`${price.free - 10} / ${price.free}`);
    expect(purchasedButton!.disabled).toBe(false);
  });

  it("calls onUpgradePrestige with the PURCHASED currency when the Purchased button is clicked", () => {
    const onUpgradePrestige = vi.fn();
    const price = getPrestigeUpgradeDualPrice(5);
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, freeGems: 0, purchasedGems: price.purchased, onUpgradePrestige }));
    const purchasedButton = findButtonByText(container, "💎");
    act(() => purchasedButton!.click());
    expect(onUpgradePrestige).toHaveBeenCalledTimes(1);
    expect(onUpgradePrestige).toHaveBeenCalledWith("PURCHASED");
  });

  it("calls onUpgradePrestige with the FREE currency when the Free button is clicked", () => {
    const onUpgradePrestige = vi.fn();
    const price = getPrestigeUpgradeDualPrice(5);
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 5, freeGems: price.free, purchasedGems: 0, onUpgradePrestige }));
    const freeButton = findButtonByText(container, "🔒");
    act(() => freeButton!.click());
    expect(onUpgradePrestige).toHaveBeenCalledTimes(1);
    expect(onUpgradePrestige).toHaveBeenCalledWith("FREE");
  });

  it("past the functional cap level, the next level shows no additional economic bonus instead of a fake +0%", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: PRESTIGE_FUNCTIONAL_CAP_LEVEL + 5, freeGems: 999_999, purchasedGems: 999_999 }));
    expect(container.textContent).toContain("No additional economic bonus");
    expect(container.textContent).not.toContain("+0% Gold");
  });

  it("the progression list always covers at least the full 1..PRESTIGE_FUNCTIONAL_CAP_LEVEL range", () => {
    ({ container, root } = renderPanel({ bestWave: 200, prestigeLevel: 1, freeGems: 0, purchasedGems: 0 }));
    expect(container.textContent).toContain(`Level ${PRESTIGE_FUNCTIONAL_CAP_LEVEL}`);
  });
});
