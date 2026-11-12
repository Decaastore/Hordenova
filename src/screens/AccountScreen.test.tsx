import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AccountScreen } from "./AccountScreen";
import { updateSave } from "@/engine/SaveSystem";

describe("AccountScreen", () => {
  beforeEach(() => window.localStorage.clear());
  it("shows every currency and material of the account, with no raw keys", () => {
    updateSave({ freeGems: 340, gemShards: 27 });
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <AccountScreen onNavigate={() => {}} onPlay={() => {}} />
      </LanguageProvider>,
    );
    for (const k of ["freeGems", "purchasedGems", "gemShards", "goldSeason", "goldEternal", "marks", "duelCoins", "splinters", "rare", "epic", "legendary", "mythic"]) expect(html).toContain(`data-testid="wallet-${k}"`);
    expect(html).toContain("340");
    expect(html).not.toMatch(/account\.\w|undefined/);
  });
});
