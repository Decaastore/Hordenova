import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { AUCTION_DURATION_HOURS, getAuctionListingFeeDualPrice, getAuctionMinBid, type AuctionDurationHours } from "@/config/marketplace";
import { gemPriceForCurrency, type GemCurrency } from "@/config/gemsEconomy";
import type { ItemInstance } from "@/entities/Item";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./ItemGlyph";
import { DualGemPriceButtons } from "./DualGemPriceButtons";
import type { CreateListingResult } from "@/engine/MarketplaceService";

interface CreateAuctionModalProps {
  eligibleItems: readonly ItemInstance[];
  /** GEMS ECONOMY v2 — listing (selling) accepts EITHER currency; a pure F2P seller pays this fee entirely from freeGems. */
  freeGemsBalance: number;
  purchasedGemsBalance: number;
  onClose: () => void;
  onCreate: (instanceId: string, minBid: number, durationHours: AuctionDurationHours, currency: GemCurrency) => CreateListingResult;
}

type Step = "PICK" | "CONFIGURE";

/** CREATE AUCTION flow — spec section 17: item, minimum bid, duration selector (12/24/48/72h), dual fee/total display, and the mandatory "your item will be locked" notice BEFORE confirmation. */
export function CreateAuctionModal({ eligibleItems, freeGemsBalance, purchasedGemsBalance, onClose, onCreate }: CreateAuctionModalProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("PICK");
  const [selected, setSelected] = useState<ItemInstance | null>(null);
  const [minBidInput, setMinBidInput] = useState<string | null>(null);
  const [duration, setDuration] = useState<AuctionDurationHours>(24);
  const [confirmCurrency, setConfirmCurrency] = useState<GemCurrency | null>(null);
  const [error, setError] = useState<string | null>(null);

  const def = selected ? getItemDefinition(selected.itemDefinitionId) : null;
  const rarity = def ? getRarityDefinition(def.rarity) : null;
  const floor = def ? getAuctionMinBid(def.rarity) : 0;
  const feePrice = def ? getAuctionListingFeeDualPrice(def.rarity) : { free: 0, purchased: 0 };
  const minBid = minBidInput !== null ? Number(minBidInput) : floor;
  const canAffordFee = freeGemsBalance >= feePrice.free || purchasedGemsBalance >= feePrice.purchased;
  const validMinBid = Number.isFinite(minBid) && minBid >= floor;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
        <div style={titleStyle}>{t("marketplace.create.title")}</div>

        {step === "PICK" && (
          <>
            {eligibleItems.length === 0 ? (
              <div style={emptyStyle}>{t("marketplace.create.noEligibleItems")}</div>
            ) : (
              <div style={pickGridStyle}>
                {eligibleItems.map((item) => {
                  const itemDef = getItemDefinition(item.itemDefinitionId);
                  if (!itemDef) return null;
                  const itemRarity = getRarityDefinition(itemDef.rarity);
                  return (
                    <button
                      key={item.instanceId}
                      onClick={() => {
                        setSelected(item);
                        setMinBidInput(null);
                        setStep("CONFIGURE");
                      }}
                      style={{ ...pickTileStyle, borderColor: itemRarity.color }}
                    >
                      <ItemGlyph itemDefinitionId={itemDef.id} size={40} />
                      <div style={pickTileNameStyle}>{t(`items.${itemDef.i18nKey}.name` as TranslationKey)}</div>
                      <RarityBadge rarity={itemDef.rarity} />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === "CONFIGURE" && selected && def && rarity && (
          <div>
            <button onClick={() => setStep("PICK")} style={backLinkStyle}>
              {t("marketplace.create.backToPick")}
            </button>

            <div style={selectedRowStyle}>
              <ItemGlyph itemDefinitionId={def.id} size={52} />
              <div>
                <div style={selectedNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
                <RarityBadge rarity={def.rarity} />
              </div>
            </div>

            <label style={fieldLabelStyle}>{t("marketplace.create.minBidLabel")}</label>
            <input
              type="number"
              min={floor}
              value={minBidInput ?? floor}
              onChange={(e) => setMinBidInput(e.target.value)}
              style={fieldInputStyle}
            />
            <div style={fieldHintStyle}>{t("marketplace.create.minBidHint", { floor })}</div>

            <label style={fieldLabelStyle}>{t("marketplace.create.durationLabel")}</label>
            <div style={durationRowStyle}>
              {AUCTION_DURATION_HOURS.map((hours) => (
                <button
                  key={hours}
                  onClick={() => setDuration(hours)}
                  style={{
                    ...durationButtonStyle,
                    borderColor: duration === hours ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
                    color: duration === hours ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
                    background: duration === hours ? "rgba(255,210,87,0.14)" : "transparent",
                  }}
                >
                  {t("marketplace.create.durationHours", { hours })}
                </button>
              ))}
            </div>

            <div style={summaryBoxStyle}>
              <div style={summaryRowStyle}>
                <span>{t("marketplace.create.feeLabel")}</span>
                <span style={{ fontWeight: 700 }}>
                  <span style={{ color: freeGemsBalance >= feePrice.free ? PALETTE.uiText : PALETTE.danger }}>
                    🔒 {feePrice.free.toLocaleString()}
                  </span>
                  {"  "}
                  {t("marketplace.create.feeOr")}
                  {"  "}
                  <span style={{ color: purchasedGemsBalance >= feePrice.purchased ? PALETTE.uiText : PALETTE.danger }}>
                    💎 {feePrice.purchased.toLocaleString()}
                  </span>
                </span>
              </div>
              {!canAffordFee && <div style={insufficientStyle}>{t("marketplace.create.insufficientGems")}</div>}
            </div>

            <div style={lockNoticeStyle}>{t("marketplace.create.lockWarning")}</div>

            {error && <div style={insufficientStyle}>{error}</div>}

            {confirmCurrency !== null ? (
              <div style={confirmBoxStyle}>
                <div style={confirmTextStyle}>
                  {t("marketplace.create.confirmPrompt", {
                    amount: gemPriceForCurrency(feePrice, confirmCurrency),
                    icon: confirmCurrency === "FREE" ? "🔒" : "💎",
                  })}
                </div>
                <button
                  onClick={() => {
                    const result = onCreate(selected.instanceId, Math.floor(minBid), duration, confirmCurrency);
                    if (result.ok) {
                      onClose();
                    } else {
                      setError(t("marketplace.create.createFailed"));
                      setConfirmCurrency(null);
                    }
                  }}
                  style={confirmYesStyle}
                >
                  {t("marketplace.create.confirmYes")}
                </button>
                <button onClick={() => setConfirmCurrency(null)} style={confirmNoStyle}>
                  {t("marketplace.create.confirmNo")}
                </button>
              </div>
            ) : (
              validMinBid && (
                <DualGemPriceButtons
                  price={feePrice}
                  freeBalance={freeGemsBalance}
                  purchasedBalance={purchasedGemsBalance}
                  onPay={(currency) => setConfirmCurrency(currency)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(6,4,2,0.82)",
  zIndex: 20,
  padding: 16,
  boxSizing: "border-box",
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 400,
  maxWidth: "100%",
  maxHeight: "88vh",
  overflowY: "auto",
  padding: "24px 24px 20px",
  borderRadius: 16,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(165deg, rgba(28,18,10,0.98), rgba(10,7,4,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 14,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 22,
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
  marginBottom: 16,
};

const emptyStyle: CSSProperties = {
  fontSize: 12.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  padding: "20px 0",
  textAlign: "center",
};

const pickGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
  gap: 10,
};

const pickTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "12px 8px",
  borderRadius: 10,
  border: "1px solid",
  background: "rgba(0,0,0,0.25)",
  cursor: "pointer",
};

const pickTileNameStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: PALETTE.uiText,
  textAlign: "center",
};

const backLinkStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 10.5,
  letterSpacing: 0.4,
  cursor: "pointer",
  marginBottom: 10,
  padding: 0,
  textDecoration: "underline",
};

const selectedRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const selectedNameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 4,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 9.5,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginTop: 12,
  marginBottom: 5,
};

const fieldInputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.3)",
  color: PALETTE.uiText,
  fontSize: 14,
  fontWeight: 700,
  boxSizing: "border-box",
};

const fieldHintStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  marginTop: 4,
};

const durationRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 6,
};

const durationButtonStyle: CSSProperties = {
  padding: "8px 0",
  borderRadius: 7,
  border: "1px solid",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const summaryBoxStyle: CSSProperties = {
  marginTop: 16,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.2)",
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
};

const insufficientStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.danger,
  marginTop: 4,
  fontWeight: 700,
};

const lockNoticeStyle: CSSProperties = {
  marginTop: 12,
  padding: "8px 10px",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.danger}`,
  background: "rgba(200,60,50,0.08)",
  fontSize: 10.5,
  lineHeight: 1.5,
  color: PALETTE.uiText,
};

const confirmBoxStyle: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(255,255,255,0.03)",
};

const confirmTextStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiText,
  lineHeight: 1.5,
  marginBottom: 8,
};

const confirmYesStyle: CSSProperties = {
  width: "100%",
  padding: "9px 0",
  borderRadius: 7,
  border: `1px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 11.5,
  letterSpacing: 0.5,
  cursor: "pointer",
  marginBottom: 6,
};

const confirmNoStyle: CSSProperties = {
  width: "100%",
  padding: "8px 0",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 10.5,
  cursor: "pointer",
};
