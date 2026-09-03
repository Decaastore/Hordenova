import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getDropTable } from "@/config/dropTables";
import { getItemHistory } from "@/engine/EconomyLedger";
import type { ItemInstance } from "@/entities/Item";
import { RarityBadge } from "./RarityBadge";
import { DropTableView } from "./DropTableView";

interface ItemDetailsModalProps {
  item: ItemInstance;
  onClose: () => void;
}

/** Item Details — Item System spec sections 8/13/22: rarity, category, lore, effects (declarative, see itemDefinitions.ts header), source, tradable/soulbound, and full trade history for this exact instance. */
export function ItemDetailsModal({ item, onClose }: ItemDetailsModalProps) {
  const { t } = useLanguage();
  const [showDropTable, setShowDropTable] = useState(false);
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;

  // grantBossDrop logs THREE internal ledger events per drop (CREATED,
  // DROPPED, ACQUIRED — spec section 20's full audit trail), but showing
  // all three to the player as separate "history" lines reads as three
  // near-duplicate events for one acquisition. User-facing history only
  // needs the moments that actually change who owns the item: the
  // original acquisition and any later trade.
  const history = getItemHistory(item.instanceId).filter((e) => e.eventType === "ITEM_ACQUIRED" || e.eventType === "ITEM_TRADED");
  const sourceTable = def.source.type !== "PHASE_MILESTONE" ? getDropTable(def.source.refId) : null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>

        <RarityBadge rarity={def.rarity} size="md" />
        <div style={nameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
        <div style={categoryStyle}>{t(`itemCategory.${def.category}` as TranslationKey)}</div>
        <div style={descriptionStyle}>{t(`items.${def.i18nKey}.description` as TranslationKey)}</div>
        <div style={loreStyle}>{t(`items.${def.i18nKey}.lore` as TranslationKey)}</div>

        <Section label={t("inventory.effects")}>
          {def.effects.length === 0 ? (
            <div style={mutedLineStyle}>{t("inventory.noEffects")}</div>
          ) : (
            def.effects.map((effect, i) => (
              <div key={i} style={effectLineStyle}>
                {t(`itemEffect.${effect.kind}` as TranslationKey, { value: effect.value })}
              </div>
            ))
          )}
        </Section>

        <Section label={t("inventory.tradable")}>
          <div style={mutedLineStyle}>{item.tradable ? t("inventory.tradable") : t("inventory.soulbound")}</div>
        </Section>

        <Section label={t("inventory.acquiredAt")}>
          <div style={mutedLineStyle}>{new Date(item.acquiredAt).toLocaleDateString()}</div>
        </Section>

        {history.length > 0 && (
          <Section label={t("inventory.history")}>
            {history.map((entry) => (
              <div key={entry.eventId} style={mutedLineStyle}>
                {entry.eventType === "ITEM_TRADED" && entry.toOwner
                  ? t("inventory.historyTraded", { owner: entry.toOwner.slice(0, 12) })
                  : t("inventory.historyAcquired")}
                {" — "}
                {new Date(entry.timestamp).toLocaleDateString()}
              </div>
            ))}
          </Section>
        )}

        {sourceTable && (
          <button onClick={() => setShowDropTable((v) => !v)} style={linkButtonStyle}>
            {t("inventory.viewDropTable")}
          </button>
        )}
        {showDropTable && sourceTable && (
          <div style={{ marginTop: 10 }}>
            <DropTableView table={sourceTable} />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,7,4,0.75)",
  zIndex: 8,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 320,
  maxHeight: "80%",
  overflowY: "auto",
  padding: "20px 22px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  right: 12,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 18,
  cursor: "pointer",
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 19,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginTop: 8,
};

const categoryStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const descriptionStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: PALETTE.uiText,
  marginTop: 10,
};

const loreStyle: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.5,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  marginTop: 6,
};

const sectionStyle: CSSProperties = {
  marginTop: 14,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 4,
};

const mutedLineStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiText,
};

const effectLineStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.success,
  fontWeight: 700,
};

const linkButtonStyle: CSSProperties = {
  marginTop: 16,
  width: "100%",
  padding: "9px 0",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.12)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 11.5,
  letterSpacing: 0.6,
  cursor: "pointer",
};
