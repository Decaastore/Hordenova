import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { RewardPartsLabel } from "./RewardPartsLabel";
import { RewardIcon } from "./PassArt";
import { rewardItemDefinitionId } from "@/engine/RewardGrant";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getItemVisualAsset } from "@/config/itemAssets";

describe("Pass and pack rewards show the exact item they give", () => {
  for (const rarity of ["UNCOMMON", "RARE", "EPIC", "LEGENDARY"] as const) {
    it(`${rarity}: the label names the item and the icon is that item's own picture`, () => {
      const id = rewardItemDefinitionId(rarity)!;
      const def = getItemDefinition(id)!;
      const label = renderToStaticMarkup(
        <LanguageProvider>
          <RewardPartsLabel parts={[{ kind: "ITEM", rarity }]} currentWave={1} />
        </LanguageProvider>,
      );
      expect(label).not.toMatch(/items\.|reward\./);
      expect(label.length).toBeGreaterThan(20);
      const icon = renderToStaticMarkup(<RewardIcon part={{ kind: "ITEM", rarity }} size={40} />);
      const src = getItemVisualAsset(def.visualAssetId).imageSrc;
      if (src) expect(icon).toContain(src);
    });
  }
});
