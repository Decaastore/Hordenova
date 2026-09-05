import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HUD } from "./HUD";
import { LanguageProvider } from "@/i18n/LanguageContext";
import type { HudSnapshot } from "@/engine/GameEngine";

function makeHud(overrides: Partial<HudSnapshot> = {}): HudSnapshot {
  return {
    phase: "RUNNING",
    wave: 14,
    phaseId: "whispering-woods",
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
