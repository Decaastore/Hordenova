import { useEffect, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { RarityBadge } from "./RarityBadge";

interface ItemRewardBannerProps {
  itemDefinitionId: string;
  onAcknowledge: () => void;
  onOpenInventory: () => void;
}

const AUTO_DISMISS_MS = 6000;

/**
 * The "CARALHO, VEIO UM EPIC" moment (Item System spec's own stated
 * objective loop) — fires once per boss/mini-boss drop. Sits top-right so
 * it never collides with EnemyDiscoveryBanner (top-left) or BossBanner
 * (centered), and never blocks the canvas long enough to interrupt Active
 * Idle combat.
 */
export function ItemRewardBanner({ itemDefinitionId, onAcknowledge, onOpenInventory }: ItemRewardBannerProps) {
  const { t } = useLanguage();
  const def = getItemDefinition(itemDefinitionId);

  useEffect(() => {
    const timer = setTimeout(onAcknowledge, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [itemDefinitionId, onAcknowledge]);

  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);

  return (
    <div
      style={{ ...containerStyle, borderColor: rarityDef.color, boxShadow: `0 0 26px ${rarityDef.glow}, 0 8px 24px rgba(0,0,0,0.5)` }}
      onClick={() => {
        onOpenInventory();
        onAcknowledge();
      }}
      role="button"
    >
      <div style={eyebrowStyle}>{t("itemReward.gotItem")}</div>
      <div style={nameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
      <RarityBadge rarity={def.rarity} size="md" />
      <div style={tapStyle}>{t("itemReward.tapToView")}</div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAcknowledge();
        }}
        style={closeButtonStyle}
      >
        ×
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 210,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid",
  background: "linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))",
  color: PALETTE.uiText,
  zIndex: 5,
  cursor: "pointer",
  textAlign: "center",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.6,
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  textTransform: "uppercase",
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  margin: "3px 0 7px",
};

const tapStyle: CSSProperties = {
  fontSize: 9,
  color: PALETTE.uiTextDim,
  marginTop: 6,
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 15,
  lineHeight: 1,
  cursor: "pointer",
};
