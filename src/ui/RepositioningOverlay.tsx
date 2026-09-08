import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { GemIcon } from "./icons";

/**
 * BALANCEAMENTO DEFINITIVO spec section 6/8 — the map-click half of Tower
 * Repositioning. screens/GameScreen.tsx owns the actual state machine
 * (picking a destination slot, then confirming a paid move); this
 * component only ever RENDERS one of its 3 possible visible states:
 *  - "picking": a top-center hint while the player is choosing a
 *    destination slot on the map (no Gems at risk yet).
 *  - a Gems confirmation prompt (spec: "antes de gastar Gems, mostrar uma
 *    confirmação clara... nunca gastar sem confirmação explícita").
 *  - a blocked "not enough Gems" message showing the cost clearly (spec:
 *    "bloquear a ação e mostrar claramente o custo").
 * The free case (cost === 0) never reaches the confirm state at all —
 * GameScreen executes it immediately on the destination click, matching
 * the spec's confirmation requirement being specifically about spending
 * Gems, not about the free daily use.
 */

interface RepositioningPickingProps {
  mode: "picking";
  onCancel: () => void;
}

interface RepositioningConfirmProps {
  mode: "confirm";
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}

interface RepositioningBlockedProps {
  mode: "blocked";
  cost: number;
  onClose: () => void;
}

type RepositioningOverlayProps = RepositioningPickingProps | RepositioningConfirmProps | RepositioningBlockedProps;

export function RepositioningOverlay(props: RepositioningOverlayProps) {
  const { t } = useLanguage();

  if (props.mode === "picking") {
    return (
      <div style={pickingBarStyle}>
        <span style={pickingTitleStyle}>{t("reposition.pickingTitle")}</span>
        <span style={pickingHintStyle}>{t("reposition.pickingHint")}</span>
        <button onClick={props.onCancel} style={cancelButtonStyle}>
          {t("reposition.cancel")}
        </button>
      </div>
    );
  }

  if (props.mode === "confirm") {
    return (
      <div style={modalBackdropStyle}>
        <div style={modalStyle}>
          <div style={modalTitleStyle}>{t("reposition.confirmTitle")}</div>
          <div style={modalBodyStyle}>
            {t("reposition.confirmBody", { cost: props.cost })}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6 }}>
              <GemIcon size={11} color={PALETTE.gem} />
              {props.cost}
            </span>
          </div>
          <div style={modalButtonRowStyle}>
            <button onClick={props.onCancel} style={secondaryButtonStyle}>
              {t("reposition.cancel")}
            </button>
            <button onClick={props.onConfirm} style={primaryButtonStyle}>
              {t("reposition.confirm")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalStyle}>
        <div style={{ ...modalTitleStyle, color: PALETTE.danger }}>{t("reposition.insufficientTitle")}</div>
        <div style={modalBodyStyle}>{t("reposition.insufficientBody", { cost: props.cost })}</div>
        <div style={modalButtonRowStyle}>
          <button onClick={props.onClose} style={primaryButtonStyle}>
            {t("reposition.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

const pickingBarStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 14px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  color: PALETTE.uiText,
  zIndex: 6,
  maxWidth: "90%",
};

const pickingTitleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
  whiteSpace: "nowrap",
};

const pickingHintStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
};

const cancelButtonStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 6,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiText,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const modalBackdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,7,4,0.55)",
  zIndex: 7,
};

const modalStyle: CSSProperties = {
  width: 300,
  padding: "18px 20px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(52,37,22,0.98), rgba(30,20,10,0.98))",
  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
};

const modalTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
};

const modalBodyStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: PALETTE.uiText,
};

const modalButtonRowStyle: CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const secondaryButtonStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "7px 14px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiText,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "7px 14px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: PALETTE.uiAccent,
  color: "#1a1206",
  cursor: "pointer",
};
