import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DualGemPrice, GemCurrency } from "@/config/gemsEconomy";

/**
 * GEMS ECONOMY v2 — the ONE shared control every dual-priced system
 * (Skins, Specialization unlock/change, Reposition, Item Slot unlock,
 * Prestige, Trade Unlock) renders through, so the "never auto-select,
 * always show both currencies explicitly, never allow a mixed/partial
 * payment" rule (spec) is enforced by construction in a single place
 * instead of re-implemented per system. Two independent buttons — 🔒 Free
 * Gems / 💎 Purchased Gems — each individually enabled/disabled by its OWN
 * balance; clicking one spends ONLY that currency, in full, never both.
 */
interface DualGemPriceButtonsProps {
  price: DualGemPrice;
  freeBalance: number;
  purchasedBalance: number;
  onPay: (currency: GemCurrency) => void;
  /** Extra eligibility gate beyond affordability (e.g. level not yet reached) — disables BOTH buttons when true. */
  disabled?: boolean;
  compact?: boolean;
}

export function DualGemPriceButtons({ price, freeBalance, purchasedBalance, onPay, disabled, compact }: DualGemPriceButtonsProps) {
  const { t } = useLanguage();
  const canFree = !disabled && freeBalance >= price.free;
  const canPurchased = !disabled && purchasedBalance >= price.purchased;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button
        onClick={() => canFree && onPay("FREE")}
        disabled={!canFree}
        title={!canFree && !disabled ? t("gems.insufficientFree", { have: freeBalance, need: price.free }) : undefined}
        style={{ ...priceButtonStyle(compact), borderColor: PALETTE.uiPanelBorder, opacity: canFree ? 1 : 0.45 }}
      >
        🔒 {price.free.toLocaleString()}
      </button>
      <button
        onClick={() => canPurchased && onPay("PURCHASED")}
        disabled={!canPurchased}
        title={!canPurchased && !disabled ? t("gems.insufficientPurchased", { have: purchasedBalance, need: price.purchased }) : undefined}
        style={{ ...priceButtonStyle(compact), borderColor: PALETTE.gem, opacity: canPurchased ? 1 : 0.45 }}
      >
        💎 {price.purchased.toLocaleString()}
      </button>
    </div>
  );
}

function priceButtonStyle(compact?: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: compact ? 9.5 : 10.5,
    fontWeight: 700,
    padding: compact ? "4px 8px" : "6px 11px",
    borderRadius: 7,
    border: `1px solid ${PALETTE.uiPanelBorder}`,
    background: "rgba(0,0,0,0.28)",
    color: PALETTE.uiText,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
