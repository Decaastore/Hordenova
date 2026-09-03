import { useEffect, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import type { ItemInstance } from "@/entities/Item";
import { RarityBadge } from "./RarityBadge";
import { ItemDetailsModal } from "./ItemDetailsModal";
import { TradeScreen } from "./TradeScreen";
import { EconomyStatsPanel } from "./EconomyStatsPanel";

interface InventoryPanelProps {
  inventory: readonly ItemInstance[];
  localEconomyTotals: { bossesDefeatedTotal: number; miniBossesDefeatedTotal: number };
  onClose: () => void;
  /** Progression 2.0 spec section 36/39 — usable slots and the never-deletes-anything overflow waiting area. */
  inventoryCapacity: number;
  overflowInventory: readonly ItemInstance[];
  onClaimOverflowItem: (instanceId: string) => void;
  /** Progression 2.0 spec section 34 — manual, player-triggered Shards -> Gems conversion. */
  gemShards: number;
  onConvertGemShards: () => void;
}

type Tab = "items" | "trade" | "stats";

/**
 * Item System spec section 32 — the one entry point for Inventory / Item
 * Details / Drop Table / Trade / Stats, opened from a single HUD button.
 *
 * This is a PURE UI OVERLAY: it renders on top of GameScreen while the
 * engine keeps running underneath exactly as it would with the panel
 * closed. Nothing here reads or writes engine state beyond the read-only
 * `inventory`/`localEconomyTotals` props GameScreen passes in — opening or
 * closing it can never reset a wave, an enemy, a tower, a boss, a timer,
 * or Active Idle progression, because it has no way to touch any of that.
 * Closes via the X button, the same HUD toggle, clicking the backdrop, or
 * Escape (LanguageSelector is the only other Escape listener in the app,
 * and it's scoped to the main menu, so there's no conflict here).
 */
export function InventoryPanel({
  inventory,
  localEconomyTotals,
  onClose,
  inventoryCapacity,
  overflowInventory,
  onClaimOverflowItem,
  gemShards,
  onConvertGemShards,
}: InventoryPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("items");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const selectedItem = selectedInstanceId ? inventory.find((i) => i.instanceId === selectedInstanceId) ?? null : null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
        <div style={titleStyle}>{t("inventory.title")}</div>

        <div style={tabRowStyle}>
          <TabButton active={tab === "items"} onClick={() => setTab("items")} label={t("inventory.tabs.items")} />
          <TabButton active={tab === "trade"} onClick={() => setTab("trade")} label={t("inventory.tabs.trade")} />
          <TabButton active={tab === "stats"} onClick={() => setTab("stats")} label={t("inventory.tabs.stats")} />
        </div>

        {tab === "items" && (
          <>
            <div style={capacityRowStyle}>
              <span>{t("inventory.capacity", { used: inventory.length, capacity: inventoryCapacity })}</span>
              {gemShards > 0 && (
                <button onClick={onConvertGemShards} style={convertButtonStyle}>
                  {t("gems.convert")} ({gemShards})
                </button>
              )}
            </div>

            {inventory.length === 0 ? (
              <div style={emptyStyle}>{t("inventory.empty")}</div>
            ) : (
              <div style={gridStyle}>
                {inventory.map((item) => (
                  <ItemTile key={item.instanceId} item={item} onClick={() => setSelectedInstanceId(item.instanceId)} />
                ))}
              </div>
            )}

            {overflowInventory.length > 0 && (
              <>
                <div style={overflowTitleStyle}>{t("inventory.overflowTitle")}</div>
                <div style={overflowHintStyle}>{t("inventory.overflowHint")}</div>
                <div style={gridStyle}>
                  {overflowInventory.map((item) => (
                    <OverflowItemTile key={item.instanceId} item={item} onClaim={() => onClaimOverflowItem(item.instanceId)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "trade" && <TradeScreen />}

        {tab === "stats" && (
          <EconomyStatsPanel
            summary={{
              bossesDefeatedTotal: localEconomyTotals.bossesDefeatedTotal,
              miniBossesDefeatedTotal: localEconomyTotals.miniBossesDefeatedTotal,
              itemsOwnedTotal: inventory.length,
              itemsFoundTotal: inventory.length,
            }}
          />
        )}
      </div>

      {selectedItem && <ItemDetailsModal item={selectedItem} onClose={() => setSelectedInstanceId(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tabButtonStyle,
        borderColor: active ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
        color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
        background: active ? "rgba(255,210,87,0.14)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function ItemTile({ item, onClick }: { item: ItemInstance; onClick: () => void }) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);

  return (
    <button
      onClick={onClick}
      style={{ ...tileStyle, borderColor: rarityDef.color, boxShadow: `0 0 12px ${rarityDef.glow}` }}
    >
      <div style={tileNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
      <RarityBadge rarity={def.rarity} />
    </button>
  );
}

function OverflowItemTile({ item, onClaim }: { item: ItemInstance; onClaim: () => void }) {
  const { t } = useLanguage();
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);

  return (
    <button onClick={onClaim} style={{ ...tileStyle, borderColor: rarityDef.color, opacity: 0.85 }}>
      <div style={tileNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
      <RarityBadge rarity={def.rarity} />
      <span style={claimLabelStyle}>{t("inventory.claim")}</span>
    </button>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,7,4,0.8)",
  zIndex: 7,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 460,
  maxWidth: "90%",
  maxHeight: "82%",
  overflowY: "auto",
  padding: "22px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 14,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 20,
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 2,
  color: PALETTE.uiAccentBright,
  marginBottom: 14,
};

const tabRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 16,
};

const tabButtonStyle: CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 10,
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid",
  background: "rgba(0,0,0,0.25)",
  textAlign: "left",
  cursor: "pointer",
};

const tileNameStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiText,
};

const emptyStyle: CSSProperties = {
  fontSize: 12.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  padding: "20px 0",
  textAlign: "center",
};

const capacityRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 11,
  color: PALETTE.uiTextDim,
  marginBottom: 10,
};

const convertButtonStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: `1px solid #c88aff`,
  background: "rgba(200,138,255,0.12)",
  color: "#e8d4ff",
  fontWeight: 700,
  fontSize: 10.5,
  cursor: "pointer",
};

const overflowTitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: 700,
  color: PALETTE.danger,
  marginTop: 16,
  marginBottom: 3,
};

const overflowHintStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginBottom: 10,
  lineHeight: 1.4,
};

const claimLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: PALETTE.uiAccent,
  letterSpacing: 0.4,
};
