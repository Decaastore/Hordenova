import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// React 18's act() only suppresses its "not configured" warning when this
// global is set — jsdom doesn't set it automatically the way a full
// testing-library setup would.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { HUD } from "./HUD";
import { LanguageProvider } from "@/i18n/LanguageContext";
import type { HudSnapshot } from "@/engine/GameEngine";

function makeHud(overrides: Partial<HudSnapshot> = {}): HudSnapshot {
  return {
    phase: "RUNNING",
    wave: 14,
    phaseId: "whispering-woods",
    phaseI18nKey: "whispering-woods",
    gold: 1000,
    gems: 125,
    gemShards: 5,
    baseHp: 100,
    maxBaseHp: 100,
    speed: 1,
    bestWave: 14,
    seasonBestWave: 14,
    enemiesDefeated: 0,
    selectedTowerId: null,
    bossNameKey: null,
    bossHp: null,
    bossMaxHp: null,
    bossIntroRemainingMs: null,
    bossLastReward: null,
    pendingDiscoveryType: null,
    pendingItemReward: null,
    pendingRouletteResult: null,
    pendingRouletteSpinWave: null,
    ...overrides,
  };
}

function renderHud(hud: HudSnapshot): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <HUD hud={hud} onSetSpeed={() => {}} onOpenInventory={() => {}} />
    </LanguageProvider>,
  );
}

function renderInteractive(initialHud: HudSnapshot): { container: HTMLDivElement; root: Root; rerender: (hud: HudSnapshot) => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const renderWith = (hud: HudSnapshot) =>
    act(() => {
      root.render(
        <LanguageProvider>
          <HUD hud={hud} onSetSpeed={() => {}} onOpenInventory={() => {}} />
        </LanguageProvider>,
      );
    });
  renderWith(initialHud);
  return { container, root, rerender: renderWith };
}

/**
 * P2 UX fix regression test: the HUD used to render Gems and Gem Shards as
 * ONE combined stat (`${gems} (+${gemShards})` under a single "GEMS"
 * label/icon) — a "+5" that was actually 5 Gem Shards (GameEngine's
 * GEM_SHARD_TO_GEM_RATE = 10, i.e. 10 Shards = 1 Gem) read as if 5 more
 * Gems had just been granted. These tests prove the two currencies are now
 * impossible to conflate at a glance: separate labels, separate values,
 * and the Gems value never carries a "+" suffix that could be misread as
 * itself having just increased by that amount.
 */
describe("HUD — Gems vs Gem Shards are visually and textually unambiguous (P2 UX fix)", () => {
  it("renders Gems and Gem Shards as two separate, independently labeled stats", () => {
    const html = renderHud(makeHud({ gems: 125, gemShards: 5 }));

    expect(html).toContain("GEMS");
    expect(html).toContain("SHARDS"); // en.ts hud.gemShards label
    expect(html).toContain("125"); // the real Gems value, on its own
    expect(html).toContain("+5"); // the real Gem Shards value, clearly a different number/currency
  });

  it("never renders the old ambiguous combined pattern '<gems> (+<shards>)' under one label", () => {
    const html = renderHud(makeHud({ gems: 125, gemShards: 5 }));
    expect(html).not.toContain("125 (+5)");
  });

  it("the Gems value itself never carries a '+' prefix (only the Shards stat does) — Gems is never shown as if it just changed by the Shards amount", () => {
    const html = renderHud(makeHud({ gems: 125, gemShards: 5 }));
    // Isolate the two Stat blocks' rendered value text via their distinct
    // labels ("GEMS" / "SHARDS") rather than raw substring search, since
    // "125" alone could coincidentally appear inside a "+125" for shards.
    const gemsValueMatch = html.match(/GEMS<\/div><div[^>]*>([^<]+)</);
    expect(gemsValueMatch?.[1]).toBe("125");
  });

  it("the Gem Shards stat doesn't render at all when the balance is 0 — nothing ambiguous to show", () => {
    const html = renderHud(makeHud({ gems: 125, gemShards: 0 }));
    expect(html).not.toContain("SHARDS");
    expect(html).toContain("GEMS");
    expect(html).toContain("125");
  });

  it("a real tooltip on the Shards stat states the actual conversion rate (10 Shards = 1 Gem) — no invented number", () => {
    const html = renderHud(makeHud({ gems: 0, gemShards: 30 }));
    expect(html).toContain("10 Shards can be converted into 1 Gem");
  });
});

/**
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — Gold feedback fix. Gold
 * gain no longer spawns a world-space canvas popup (rendering/vfx.ts's old
 * spawnGoldPopup, removed) — it's a small HUD-anchored "+N" next to the
 * existing Gold stat, diffing hud.gold across renders. Zero economy change:
 * these tests only assert the presentational badge, never hud.gold itself.
 */
describe("HUD — Gold gain indicator (Gold feedback fix)", () => {
  let containers: HTMLDivElement[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    containers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const c of containers) c.remove();
  });

  function setup(gold: number) {
    const { container, rerender } = renderInteractive(makeHud({ gold, gemShards: 0 }));
    containers.push(container);
    return { container, rerender };
  }

  it("shows nothing on the very first render (no prior gold to compare against)", () => {
    const { container } = setup(1000);
    expect(container.textContent).not.toMatch(/\+\d/);
  });

  it("shows +N right after gold increases, and clears again after the display window", () => {
    const { container, rerender } = setup(1000);
    rerender(makeHud({ gold: 1125, gemShards: 0 }));
    expect(container.textContent).toContain("+125");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).not.toMatch(/\+\d/);
  });

  it("aggregates multiple gains within the display window into ONE running total, not separate stacked badges", () => {
    const { container, rerender } = setup(1000);
    rerender(makeHud({ gold: 1050, gemShards: 0 }));
    expect(container.textContent).toContain("+50");

    act(() => {
      vi.advanceTimersByTime(300); // still well inside the display window
    });
    rerender(makeHud({ gold: 1090, gemShards: 0 }));
    // Aggregated: 50 (first gain) + 40 (second gain) = 90, shown as one badge.
    expect(container.textContent).toContain("+90");
    expect(container.textContent).not.toContain("+50");
  });

  it("never shows a gain indicator when Gold decreases (a purchase) or stays the same", () => {
    const { container, rerender } = setup(1000);
    rerender(makeHud({ gold: 800, gemShards: 0 }));
    expect(container.textContent).not.toMatch(/\+\d/);

    rerender(makeHud({ gold: 800, gemShards: 0 }));
    expect(container.textContent).not.toMatch(/\+\d/);
  });
});
