import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Item System spec sections 15/16/23/36 — the TradeManager engine module
 * (engine/TradeManager.ts) is fully built and unit-tested (session/offer/
 * confirm/execute, atomic ownership transfer, double-spend/soulbound/
 * wrong-owner validation). What does NOT exist yet is a second real
 * player to trade with — no multiplayer backend, per spec sections 23/31.
 *
 * This screen tells the player that honestly instead of faking a
 * counterpart or a "demo trade" that pretends to be real (spec section 36:
 * no fake players). "YOUR OFFER / THEIR OFFER" is shown as a preview of
 * the exact interaction that will exist once the server does.
 */
export function TradeScreen() {
  const { t } = useLanguage();

  return (
    <div>
      <div style={noticeStyle}>
        <div style={noticeTitleStyle}>{t("trade.unavailableTitle")}</div>
        <div style={noticeBodyStyle}>{t("trade.unavailableBody")}</div>
      </div>

      <div style={previewRowStyle}>
        <div style={offerColumnStyle}>
          <div style={offerLabelStyle}>{t("trade.yourOffer")}</div>
          <div style={offerBoxStyle} />
        </div>
        <div style={offerColumnStyle}>
          <div style={offerLabelStyle}>{t("trade.theirOffer")}</div>
          <div style={offerBoxStyle} />
        </div>
      </div>

      <button style={disabledButtonStyle} disabled>
        {t("trade.confirm")}
      </button>
    </div>
  );
}

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
  opacity: 0.4,
};

const offerColumnStyle: CSSProperties = {
  flex: 1,
};

const offerLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 6,
};

const offerBoxStyle: CSSProperties = {
  height: 90,
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
};

const disabledButtonStyle: CSSProperties = {
  marginTop: 14,
  width: "100%",
  padding: "10px 0",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.6,
  cursor: "not-allowed",
  opacity: 0.5,
};
