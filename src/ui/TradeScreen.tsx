import { useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { getTradeUnlockPrice, unlockTrade } from "@/engine/MarketplaceService";
import {
  addItemToMyTradeOffer,
  cancelActiveTrade,
  confirmMyTradeOffer,
  getActiveTradeSession,
  getEligibleTradeItems,
  removeItemFromMyTradeOffer,
  setMyTradePurchasedGemsOffer,
} from "@/engine/TradeService";
import type { TradeSession } from "@/engine/TradeManager";
import { getItemDefinition } from "@/config/itemDefinitions";
import { DualGemPriceButtons } from "./DualGemPriceButtons";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./ItemGlyph";

/**
 * PLAYER ECONOMY UNIFICATION — Direct Inventory Trade. Gated behind the
 * exact SAME single unlock as the Marketplace (MarketplaceService.ts's
 * isTradeUnlocked/unlockTrade/getTradeUnlockPrice — imported directly, not
 * re-implemented, so there is structurally only ever one gate).
 *
 * HONESTY NOTE (matches engine/TradeManager.ts's and engine/TradeService.ts's
 * own headers): once unlocked, this screen shows a real, fully-built,
 * fully-tested offer-building UI — but there is no live multiplayer backend
 * yet, so `activeTradeSession` is null in practice and the screen says so
 * plainly instead of faking a counterpart. The moment a future matchmaking
 * layer creates a real session (TradeManager.createTradeSession + persisting
 * it as activeTradeSession), everything below already works.
 */
export function TradeScreen() {
  const { t } = useLanguage();
  const [refreshTick, setRefreshTick] = useState(0);
  const [gemsInput, setGemsInput] = useState<string | null>(null);

  const save = useMemo(() => loadSave(), [refreshTick]);
  const session = useMemo(() => getActiveTradeSession(), [refreshTick]);
  const eligibleItems = useMemo(() => getEligibleTradeItems(), [refreshTick]);

  const bump = () => setRefreshTick((n) => n + 1);

  if (!save.tradeUnlocked) {
    const price = getTradeUnlockPrice();
    return (
      <div style={lockedBoxStyle}>
        <div style={lockedTitleStyle}>{t("trade.lockedTitle")}</div>
        <p style={lockedTextStyle}>{t("trade.lockedExplainer")}</p>
        <ul style={checklistStyle}>
          {(
            [
              "marketplace",
              "auctions",
              "directTrade",
              "itemForItem",
              "itemForGems",
              "selling",
              "buying",
            ] as const
          ).map((key) => (
            <li key={key}>✓ {t(`trade.unlockChecklist.${key}` as TranslationKey)}</li>
          ))}
        </ul>
        <DualGemPriceButtons
          price={price}
          freeBalance={save.freeGems}
          purchasedBalance={save.purchasedGems}
          onPay={(currency) => {
            unlockTrade(currency);
            bump();
          }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={noticeStyle}>
        <div style={noticeTitleStyle}>{t("trade.unavailableTitle")}</div>
        <div style={noticeBodyStyle}>{t("trade.unavailableBody")}</div>
      </div>
    );
  }

  const myKey: "offerA" | "offerB" | null = session.playerAId === save.playerId ? "offerA" : session.playerBId === save.playerId ? "offerB" : null;
  const theirKey: "offerA" | "offerB" | null = myKey === "offerA" ? "offerB" : myKey === "offerB" ? "offerA" : null;
  if (!myKey || !theirKey) return null;
  const myOffer = session[myKey];
  const theirOffer = session[theirKey];

  const renderOfferItems = (offer: TradeSession["offerA"]) =>
    offer.itemInstanceIds.map((instanceId) => {
      const item = save.inventory.find((i) => i.instanceId === instanceId);
      const def = item ? getItemDefinition(item.itemDefinitionId) : null;
      if (!item || !def) return null;
      return (
        <div key={instanceId} style={offerItemRowStyle}>
          <ItemGlyph itemDefinitionId={def.id} size={28} />
          <span style={offerItemNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</span>
          <RarityBadge rarity={def.rarity} />
          {offer === myOffer && !myOffer.confirmed && (
            <button onClick={() => { removeItemFromMyTradeOffer(instanceId); bump(); }} style={removeItemButtonStyle}>
              ×
            </button>
          )}
        </div>
      );
    });

  return (
    <div>
      <div style={previewRowStyle}>
        <div style={offerColumnStyle}>
          <div style={offerLabelStyle}>{t("trade.yourOffer")}</div>
          <div style={offerBoxStyle}>
            {renderOfferItems(myOffer)}
            <div style={gemsRowStyle}>
              <span>💎</span>
              <input
                type="number"
                min={0}
                disabled={myOffer.confirmed}
                value={gemsInput ?? myOffer.purchasedGems}
                onChange={(e) => setGemsInput(e.target.value)}
                onBlur={() => {
                  const amount = Number(gemsInput);
                  if (Number.isFinite(amount)) setMyTradePurchasedGemsOffer(Math.max(0, Math.floor(amount)));
                  setGemsInput(null);
                  bump();
                }}
                style={gemsInputStyle}
              />
            </div>
            <div style={noFreeGemsNoteStyle}>{t("trade.noFreeGemsNote")}</div>
          </div>
          {myOffer.confirmed ? (
            <div style={confirmedBadgeStyle}>{t("trade.confirmed")}</div>
          ) : (
            <button onClick={() => { confirmMyTradeOffer(); bump(); }} style={confirmButtonStyle}>
              {t("trade.confirm")}
            </button>
          )}
        </div>

        <div style={offerColumnStyle}>
          <div style={offerLabelStyle}>{t("trade.theirOffer")}</div>
          <div style={offerBoxStyle}>
            {renderOfferItems(theirOffer)}
            <div style={gemsRowStyle}>
              <span>💎 {theirOffer.purchasedGems.toLocaleString()}</span>
            </div>
          </div>
          <div style={theirOffer.confirmed ? confirmedBadgeStyle : waitingBadgeStyle}>
            {theirOffer.confirmed ? t("trade.confirmed") : t("trade.waitingForOther")}
          </div>
        </div>
      </div>

      {!myOffer.confirmed && eligibleItems.length > 0 && (
        <div style={pickerBoxStyle}>
          <div style={pickerTitleStyle}>{t("trade.addItem")}</div>
          <div style={pickerGridStyle}>
            {eligibleItems
              .filter((item) => !myOffer.itemInstanceIds.includes(item.instanceId))
              .map((item) => {
                const def = getItemDefinition(item.itemDefinitionId)!;
                return (
                  <button
                    key={item.instanceId}
                    onClick={() => { addItemToMyTradeOffer(item.instanceId); bump(); }}
                    style={pickerTileStyle}
                  >
                    <ItemGlyph itemDefinitionId={def.id} size={30} />
                    <span style={pickerTileNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <button onClick={() => { cancelActiveTrade(); bump(); }} style={cancelButtonStyle}>
        {t("trade.cancel")}
      </button>
    </div>
  );
}

const lockedBoxStyle: CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "20px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.gem}`,
  background: "rgba(200,138,255,0.06)",
  textAlign: "center",
};

const lockedTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
  marginBottom: 8,
};

const lockedTextStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.6,
  marginBottom: 10,
};

const checklistStyle: CSSProperties = {
  listStyle: "none",
  margin: "0 0 16px",
  padding: 0,
  textAlign: "left",
  display: "inline-flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: PALETTE.uiText,
};

const noticeStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 8,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.2)",
  marginBottom: 16,
};

const noticeTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 6,
};

const noticeBodyStyle: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.5,
  color: PALETTE.uiTextDim,
};

const previewRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
};

const offerColumnStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const offerLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const offerBoxStyle: CSSProperties = {
  minHeight: 90,
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const offerItemRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
};

const offerItemNameStyle: CSSProperties = {
  flex: 1,
  color: PALETTE.uiText,
};

const removeItemButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: PALETTE.danger,
  cursor: "pointer",
  fontSize: 14,
  padding: 0,
};

const gemsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: PALETTE.uiText,
};

const gemsInputStyle: CSSProperties = {
  width: 90,
  padding: "4px 6px",
  borderRadius: 6,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.3)",
  color: PALETTE.uiText,
  fontSize: 12,
};

const noFreeGemsNoteStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
};

const confirmButtonStyle: CSSProperties = {
  padding: "8px 0",
  borderRadius: 7,
  border: `2px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const confirmedBadgeStyle: CSSProperties = {
  textAlign: "center",
  padding: "6px 0",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  color: PALETTE.uiAccentBright,
  fontSize: 10.5,
  fontWeight: 700,
};

const waitingBadgeStyle: CSSProperties = {
  textAlign: "center",
  padding: "6px 0",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  color: PALETTE.uiTextDim,
  fontSize: 10.5,
};

const pickerBoxStyle: CSSProperties = {
  marginTop: 14,
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.15)",
};

const pickerTitleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const pickerGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
  gap: 8,
};

const pickerTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "8px 6px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.2)",
  cursor: "pointer",
};

const pickerTileNameStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: PALETTE.uiText,
  textAlign: "center",
};

const cancelButtonStyle: CSSProperties = {
  marginTop: 14,
  width: "100%",
  padding: "8px 0",
  borderRadius: 7,
  border: `1px dashed ${PALETTE.danger}`,
  background: "transparent",
  color: PALETTE.danger,
  fontWeight: 700,
  fontSize: 10.5,
  cursor: "pointer",
};
