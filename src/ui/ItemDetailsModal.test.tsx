import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ItemDetailsModal } from "./ItemDetailsModal";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { createItemInstance } from "@/entities/Item";
import { rewardItemDefinitionId } from "@/engine/RewardGrant";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(source: "SEASON_PASS" | "BOSS_DROP") {
  const item = createItemInstance(rewardItemDefinitionId("UNCOMMON")!, "me", { type: source, refId: "x" });
  if (source === "SEASON_PASS") item.tradable = false;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LanguageProvider>
        <ItemDetailsModal item={item} onClose={() => undefined} />
      </LanguageProvider>,
    );
  });
  const passTag = !!container.querySelector("[data-testid=item-pass-only]");
  act(() => root.unmount());
  container.remove();
  return { passTag };
}

describe("ItemDetailsModal — Season Pass items", () => {
  it("tells the player a Pass item can't be sold or traded", () => {
    expect(render("SEASON_PASS").passTag).toBe(true);
    expect(render("BOSS_DROP").passTag).toBe(false);
  });
});
