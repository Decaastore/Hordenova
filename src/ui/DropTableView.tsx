import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { DropTable } from "@/config/dropTables";
import { itemDefinitionForEntry } from "@/config/dropTables";
import { RarityBadge } from "./RarityBadge";

interface DropTableViewProps {
  table: DropTable;
}

/**
 * Item System spec section 12 — literally renders `entry.weightPercent`,
 * the exact same field rollDropTable() sums and walks. There is no
 * separate "display percent" computed differently from the "real" one;
 * this component and the roller read the same DropTableEntry objects.
 */
export function DropTableView({ table }: DropTableViewProps) {
  const { t } = useLanguage();
  const sorted = [...table.entries].sort((a, b) => b.weightPercent - a.weightPercent);

  return (
    <div>
      <div style={titleStyle}>{t("dropTable.title")}</div>
      <div style={subtitleStyle}>{t("dropTable.subtitle")}</div>
      <div style={rowsStyle}>
        {sorted.map((entry) => {
          const def = itemDefinitionForEntry(entry);
          if (!def) return null;
          return (
            <div key={entry.itemId} style={rowStyle}>
              <div style={nameCellStyle}>
                <span>{t(`items.${def.i18nKey}.name` as TranslationKey)}</span>
                <RarityBadge rarity={def.rarity} />
              </div>
              <div style={percentStyle}>{entry.weightPercent.toFixed(2)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
};

const subtitleStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
  marginBottom: 10,
};

const rowsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 6,
  background: "rgba(0,0,0,0.25)",
  border: `1px solid ${PALETTE.uiPanelBorder}`,
};

const nameCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12.5,
  color: PALETTE.uiText,
};

const percentStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: PALETTE.gold,
  fontVariantNumeric: "tabular-nums",
};
