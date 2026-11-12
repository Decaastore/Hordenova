import { useEffect, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { MOMENT_OFFERS } from "@/config/shopOffers";
import { PURCHASE_MIN_AGE } from "@/config/ageGate";

interface MomentOfferCardProps {
  offerId: string;
  expiresAt: number;
  onOpenStore?: () => void;
  onDismiss: () => void;
}

/** OFERTAS DE MOMENTO — the small in-game card that points to the offer in the Store (config/shopOffers.ts). */
export function MomentOfferCard({ offerId, expiresAt, onOpenStore, onDismiss }: MomentOfferCardProps) {
  const { t, language } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const offer = MOMENT_OFFERS.find((o) => o.id === offerId);
  if (!offer) return null;
  const m = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  const time = `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  const brl = new Intl.NumberFormat(language === "ptBR" ? "pt-BR" : "en-US", { style: "currency", currency: "BRL" });
  return (
    <div style={cardStyle} role="complementary" aria-label={t(`store.moment.${offer.id}.name` as TranslationKey)} data-testid="moment-card">
      <button onClick={onDismiss} style={closeStyle} aria-label={t("bestiary.close")}>
        ×
      </button>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#ff9a85" }}>{t("store.momentKicker", { time })}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#ffd2c4", marginTop: 2 }}>{t(`store.moment.${offer.id}.name` as TranslationKey)}</div>
      <div style={{ fontSize: 11.5, color: PALETTE.uiTextDim, marginTop: 3, lineHeight: 1.4 }}>{t(`store.moment.${offer.id}.why` as TranslationKey)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <strong style={{ fontSize: 14 }}>{brl.format(offer.priceBrl)}</strong>
        <span style={{ fontSize: 10.5, color: PALETTE.uiTextDim, whiteSpace: "nowrap" }}>{PURCHASE_MIN_AGE}+</span>
        {onOpenStore && (
          <button style={btnStyle} onClick={onOpenStore}>
            {t("store.momentSee")}
          </button>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: "absolute",
  left: 12,
  bottom: 72,
  width: 280,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(224,100,75,0.6)",
  background: "linear-gradient(160deg, rgba(60,24,18,0.97), rgba(24,12,10,0.98))",
  color: PALETTE.uiText,
  boxShadow: "0 10px 26px rgba(0,0,0,0.55)",
  zIndex: 25,
};
const closeStyle: CSSProperties = { position: "absolute", top: 4, right: 8, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 16, cursor: "pointer" };
const btnStyle: CSSProperties = { marginLeft: "auto", padding: "5px 10px", borderRadius: 7, border: "1px solid #e0644b", background: "linear-gradient(180deg, #a8402c, #6e2418)", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" };
