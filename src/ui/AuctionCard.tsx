import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { getCurrentBidAmount, getLeadingBidderId, type AuctionListing } from "@/entities/Auction";
import { getMinimumNextBid, isDemoBidder } from "@/config/marketplace";
import { formatCountdownClock } from "@/utils/formatDuration";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./ItemGlyph";

interface AuctionCardProps {
  listing: AuctionListing;
  onOpen: () => void;
  nowMs: number;
}

/** Auction card — spec's own worked example: item/rarity/current bid/next bid/time remaining/bid count/leading player, "PLACE BID" CTA. */
export function AuctionCard({ listing, onOpen, nowMs }: AuctionCardProps) {
  const { t } = useLanguage();
  const def = getItemDefinition(listing.itemDefinitionId);
  if (!def) return null;
  const rarity = getRarityDefinition(def.rarity);
  const currentBid = getCurrentBidAmount(listing);
  const nextBid = getMinimumNextBid(currentBid);
  const leaderId = getLeadingBidderId(listing);
  const remainingMs = listing.endsAt - nowMs;
  const endingSoon = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  const contested = listing.bids.length >= 5;

  return (
    <button
      onClick={onOpen}
      style={{
        ...cardStyle,
        borderColor: contested ? PALETTE.gold : rarity.color + "66",
        boxShadow: contested ? `0 0 22px ${PALETTE.gold}44, 0 10px 28px rgba(0,0,0,0.5)` : `0 10px 28px rgba(0,0,0,0.5)`,
      }}
      className="hordenova-auction-card"
    >
      {contested && <div style={hotBadgeStyle}>{t("marketplace.card.hotBadge")}</div>}
      <div style={cardTopRowStyle}>
        <ItemGlyph itemDefinitionId={def.id} />
        <div style={cardTitleColStyle}>
          <div style={cardNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
          <RarityBadge rarity={def.rarity} />
        </div>
      </div>

      <div style={statBlockStyle}>
        <StatLine label={t("marketplace.card.currentBid")} value={`${currentBid.toLocaleString()} 💎`} accent={PALETTE.gold} />
        <StatLine label={t("marketplace.card.nextBid")} value={`${nextBid.toLocaleString()} 💎`} />
      </div>

      <div style={countdownRowStyle}>
        <span style={{ ...countdownStyle, color: endingSoon ? PALETTE.danger : PALETTE.uiAccentBright }}>
          {formatCountdownClock(remainingMs)}
        </span>
        {endingSoon && <span style={endingSoonTagStyle}>{t("marketplace.card.endingSoon")}</span>}
      </div>

      <div style={metaRowStyle}>
        <span>{t("marketplace.card.bidCount", { count: listing.bids.length })}</span>
        {leaderId && <span>{isDemoBidder(leaderId) ? t("marketplace.demo.leaderLabel") : leaderId.slice(0, 10)}</span>}
      </div>

      <div style={bidButtonStyle}>{t("marketplace.card.placeBid")}</div>
    </button>
  );
}

function StatLine({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={statLineStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={{ ...statValueStyle, color: accent ?? PALETTE.uiText }}>{value}</span>
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "16px 16px 14px",
  borderRadius: 14,
  border: "1px solid",
  background: "linear-gradient(165deg, rgba(24,16,10,0.96), rgba(10,7,4,0.98))",
  textAlign: "left",
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};

const hotBadgeStyle: CSSProperties = {
  position: "absolute",
  top: -9,
  right: 12,
  padding: "2px 9px",
  borderRadius: 999,
  background: `linear-gradient(180deg, #ffb14a, ${PALETTE.gold})`,
  color: "#3a2408",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
};

const cardTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const cardTitleColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
};

const cardNameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 14.5,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  paddingTop: 8,
  borderTop: `1px solid rgba(255,255,255,0.06)`,
};

const statLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const statLabelStyle: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const statValueStyle: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 800,
};

const countdownRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const countdownStyle: CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const endingSoonTagStyle: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: PALETTE.danger,
  border: `1px solid ${PALETTE.danger}`,
  borderRadius: 4,
  padding: "1px 5px",
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10,
  color: PALETTE.uiTextDim,
};

const bidButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: "8px 0",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.12)",
  color: PALETTE.uiAccentBright,
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: 1,
  textAlign: "center",
  textTransform: "uppercase",
};
