import type { CSSProperties } from "react";
import type { ItemCategory } from "@/config/itemDefinitions";
import type { getRarityDefinition } from "@/config/rarity";
import { AmuletIcon, GemIcon } from "./icons";

/**
 * ITENS COMO ITENS REAIS — a real, rarity-colored, CATEGORY-AWARE glyph for
 * an item's icon, reused everywhere an item shows up (Inventory tiles, item
 * detail, the boss-drop reward banner, tower equipment slots, and the
 * Marketplace). Every icon is a hand-drawn SVG from ui/icons.tsx — the same
 * no-emoji/no-fabricated-image rule the rest of this codebase already
 * follows — never a generic box with the word "Amulet" written on it.
 *
 * Extensible on purpose: adding a real WEAPON/ARMOR category later is one
 * more case in `iconForCategory` below, not a parallel glyph system.
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
  category: ItemCategory;
  rarity: ReturnType<typeof getRarityDefinition>;
  size?: number;
}

export function ItemGlyph({ category, rarity, size = 56 }: ItemGlyphProps) {
  const Icon = iconForCategory(category);
  const style: CSSProperties = {
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
  };
  return (
    <div style={style}>
      <Icon size={size * 0.55} color={rarity.color} />
    </div>
  );
}
