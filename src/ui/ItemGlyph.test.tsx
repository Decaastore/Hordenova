import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ItemGlyph } from "./ItemGlyph";
import { ITEM_VISUAL_ASSETS } from "@/config/itemAssets";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(itemDefinitionId: string, size?: number): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ItemGlyph itemDefinitionId={itemDefinitionId} size={size} />);
  });
  return { container, root };
}

/**
 * IDENTIDADE VISUAL DEFINITIVA — ItemGlyph is the single component every
 * item touchpoint (Inventory, tooltip, item modal, boss-drop banner, tower
 * equipment, Marketplace) renders through. This locks in its two-mode
 * contract: real art from the registry wins when supplied, and a generic
 * hand-drawn category icon is the graceful fallback when it isn't (or the
 * file fails to load) — nothing ever renders broken or blank.
 *
 * mosswood_charm and hollow_sigil have real supplied artwork registered by
 * default (see itemAssets.ts); wardens_eye is still honestly empty, so the
 * manually-injected-registry scenarios below use it to stay independent of
 * whether any given item currently has real art.
 */
describe("ui/ItemGlyph — real-art vs fallback-icon contract", () => {
  afterEach(() => {
    // Never leak a test-only imageSrc into another test — the registry is a shared module singleton.
    delete ITEM_VISUAL_ASSETS.wardens_eye!.imageSrc;
  });

  it("renders the fallback hand-drawn icon (no <img>) for an item with no real art registered", () => {
    const { container } = render("wardens_eye");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders mosswood_charm's real supplied artwork via <img>, not the fallback icon", () => {
    const { container } = render("mosswood_charm");
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/items/amulets/mosswood_charm.png");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders hollow_sigil's real supplied artwork via <img>, not the fallback icon", () => {
    const { container } = render("hollow_sigil");
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/items/amulets/hollow_sigil.png");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders real artwork via <img> once one is registered for any item's visualAssetId", () => {
    ITEM_VISUAL_ASSETS.wardens_eye!.imageSrc = "/items/amulets/wardens_eye.png";
    const { container } = render("wardens_eye");
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/items/amulets/wardens_eye.png");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to the hand-drawn icon if the registered image fails to load (404), never leaving a broken image", () => {
    ITEM_VISUAL_ASSETS.wardens_eye!.imageSrc = "/items/amulets/does-not-exist.png";
    const { container } = render("wardens_eye");
    const img = container.querySelector("img")!;
    act(() => img.dispatchEvent(new Event("error")));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("returns null for an unknown item id instead of throwing", () => {
    const { container } = render("not-a-real-item");
    expect(container.innerHTML).toBe("");
  });

  it("real art never bakes in a rarity color — the wrapper's rarity border/glow applies identically with or without registered art", () => {
    const withoutArt = render("wardens_eye", 48);
    const wrapperNoArt = withoutArt.container.firstElementChild as HTMLElement;
    const borderNoArt = wrapperNoArt.style.border;

    ITEM_VISUAL_ASSETS.wardens_eye!.imageSrc = "/items/amulets/wardens_eye.png";
    const withArt = render("wardens_eye", 48);
    const wrapperWithArt = withArt.container.firstElementChild as HTMLElement;
    expect(wrapperWithArt.style.border).toBe(borderNoArt);
  });
});
