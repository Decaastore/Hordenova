import type { CSSProperties } from "react";
import { getRarityDefinition, type Rarity } from "@/config/rarity";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";

interface RarityBadgeProps {
  rarity: Rarity;
  size?: "sm" | "md";
}

/** Small colored pill labeling an item's rarity — reused across the reward banner, inventory grid, item details, and drop table view so rarity always reads the same way everywhere. */
export function RarityBadge({ rarity, size = "sm" }: RarityBadgeProps) {
  const { t } = useLanguage();
  const def = getRarityDefinition(rarity);
  const small = size === "sm";

  const style: CSSProperties = {
    display: "inline-block",
    padding: small ? "2px 8px" : "4px 12px",
    borderRadius: 999,
    fontSize: small ? 9 : 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: def.color,
    border: `1px solid ${def.color}`,
    background: def.glow,
    textShadow: `0 0 8px ${def.color}88`,
  };

  return <span style={style}>{t(`rarity.${def.i18nKey}` as TranslationKey)}</span>;
}
