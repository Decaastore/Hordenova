import { useState, type CSSProperties } from "react";
import { getItemDefinition, type ItemCategory } from "@/config/itemDefinitions";
import { getItemVisualAsset } from "@/config/itemAssets";
import { getRarityDefinition } from "@/config/rarity";
import { AmuletIcon, GemIcon } from "./icons";

/**
 * IDENTIDADE VISUAL DEFINITIVA — the ONE component that renders an item's
 * picture anywhere in the app (Inventory tiles, item details, the boss-drop
 * reward banner, tower equipment slots, and every Marketplace surface).
 * This is the single source of truth the item-asset pipeline funnels into:
 *
 *   ItemDefinition.visualAssetId -> itemAssets.ts registry -> ItemGlyph
 *
 * Real per-item art (see itemAssets.ts's header for the file convention and
 * exact contract) always wins when supplied. When it isn't — or the file
 * 404s at runtime — this falls back to a generic, hand-drawn category icon
 * (AmuletIcon for AMULET, GemIcon otherwise) so nothing ever renders
 * broken or blank. That fallback is a placeholder, never the intended
 * final look for a shipped item — see itemAssets.ts.
 *
 * The rarity-colored frame/glow/background below is drawn by THIS
 * wrapper, identically whether it's showing real art or the fallback icon
 * — real artwork must never bake its own rarity color in (see
 * itemAssets.ts), so the exact same image reads correctly at whatever
 * rarity treatment the UI applies around it.
 */
function iconForCategory(category: ItemCategory) {
  switch (category) {
    case "AMULET":
      return AmuletIcon;
    default:
      return GemIcon;
  }
}

interface ItemGlyphProps {
  /** The item's definition id (ItemDefinition.id) — everything else (art, rarity, fallback icon) is derived from it. */
  itemDefinitionId: string;
  size?: number;
}

export function ItemGlyph({ itemDefinitionId, size = 56 }: ItemGlyphProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const def = getItemDefinition(itemDefinitionId);
  if (!def) return null;

  const rarity = getRarityDefinition(def.rarity);
  const asset = getItemVisualAsset(def.visualAssetId);
  const showRealArt = !!asset.imageSrc && !imageFailed;
  const Icon = iconForCategory(def.category);

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: `radial-gradient(circle at 35% 30%, ${rarity.color}33, rgba(8,6,4,0.9))`,
    border: `1px solid ${rarity.color}`,
    boxShadow: `0 0 ${size * 0.35}px ${rarity.glow}`,
    overflow: "hidden",
  };

  return (
    <div style={wrapperStyle}>
      {showRealArt ? (
        <img
          src={asset.imageSrc}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
          style={{ width: size * 0.82, height: size * 0.82, objectFit: "contain" }}
        />
      ) : (
        <Icon size={size * 0.55} color={rarity.color} />
      )}
    </div>
  );
}
