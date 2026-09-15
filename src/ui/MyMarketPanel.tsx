import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { getCurrentBidAmount, type AuctionListing, type AuctionStatus } from "@/entities/Auction";
import { isDemoBidder } from "@/config/marketplace";
import { formatCountdownClock } from "@/utils/formatDuration";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./ItemGlyph";

interface MyMarketPanelProps {
  listings: readonly AuctionListing[];
  nowMs: number;
  onOpen: (auctionId: string) => void;
  onCancel: (auctionId: string) => void;
}

/**
 * MY MARKET — spec section 18. "leilões que estou ganhando" / "fui
 * superado" / "itens comprados" describe being a BIDDER on someone ELSE's
 * listing — structurally impossible in this local build (every listing's
 * sellerId is always this save's own playerId, and AuctionManager.placeBid
 * always rejects a same-identity bid as self-bidding — see that file's own
 * header). Rather than silently drop those sections or fake data into
 * them, this panel shows them honestly empty with a one-line explanation,
 * the same "no fake counterpart" stance TradeScreen.tsx already takes.
 */
export function MyMarketPanel({ listings, nowMs, onOpen, onCancel }: MyMarketPanelProps) {
  const { t } = useLanguage();
  const active = listings.filter((l) => l.status === "ACTIVE");
  const sold = listings.filter((l) => l.status === "SOLD");
  const unsold = listings.filter((l) => l.status === "UNSOLD");
  const cancelled = listings.filter((l) => l.status === "CANCELLED");

  return (
    <div>
      <Group title={t("marketplace.myMarket.activeListings", { count: active.length })}>
        {active.length === 0 ? (
          <Empty text={t("marketplace.myMarket.noActiveListings")} />
        ) : (
          active.map((l) => (
            <ListingRow key={l.id} listing={l} nowMs={nowMs} onOpen={() => onOpen(l.id)}>
              {l.bids.length === 0 && (
                <button onClick={() => onCancel(l.id)} style={cancelButtonStyle}>
                  {t("marketplace.myMarket.cancel")}
                </button>
              )}
            </ListingRow>
          ))
        )}
      </Group>

      <Group title={t("marketplace.myMarket.soldListings", { count: sold.length })}>
        {sold.length === 0 ? <Empty text={t("marketplace.myMarket.noSoldListings")} /> : sold.map((l) => <ListingRow key={l.id} listing={l} nowMs={nowMs} onOpen={() => onOpen(l.id)} />)}
      </Group>

      <Group title={t("marketplace.myMarket.unsoldListings", { count: unsold.length })}>
        {unsold.length === 0 ? <Empty text={t("marketplace.myMarket.noUnsoldListings")} /> : unsold.map((l) => <ListingRow key={l.id} listing={l} nowMs={nowMs} onOpen={() => onOpen(l.id)} />)}
      </Group>

      {cancelled.length > 0 && (
        <Group title={t("marketplace.myMarket.cancelledListings", { count: cancelled.length })}>
          {cancelled.map((l) => (
            <ListingRow key={l.id} listing={l} nowMs={nowMs} onOpen={() => onOpen(l.id)} />
          ))}
        </Group>
      )}

      <Group title={t("marketplace.myMarket.biddingTitle")}>
        <Empty text={t("marketplace.myMarket.biddingHonestNote")} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={groupStyle}>
      <div style={groupTitleStyle}>{title}</div>
      <div style={groupBodyStyle}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyStyle}>{text}</div>;
}

function statusColor(status: AuctionStatus): string {
  switch (status) {
    case "ACTIVE":
      return PALETTE.gold;
    case "SOLD":
      return PALETTE.success;
    case "UNSOLD":
      return PALETTE.uiTextDim;
    case "CANCELLED":
      return PALETTE.danger;
  }
}

function ListingRow({ listing, nowMs, onOpen, children }: { listing: AuctionListing; nowMs: number; onOpen: () => void; children?: React.ReactNode }) {
  const { t } = useLanguage();
  const def = getItemDefinition(listing.itemDefinitionId);
  if (!def) return null;
  const rarity = getRarityDefinition(def.rarity);
  const remainingMs = listing.endsAt - nowMs;
  const winningBid = listing.bids[listing.bids.length - 1] ?? null;

  return (
    <div style={rowStyle}>
      <button onClick={onOpen} style={rowClickableStyle}>
        <ItemGlyph category={def.category} rarity={rarity} size={38} />
        <div style={rowInfoStyle}>
          <div style={rowNameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
          <RarityBadge rarity={def.rarity} />
        </div>
        <div style={rowMetaStyle}>
          <span style={{ ...rowStatusStyle, color: statusColor(listing.status) }}>{t(`marketplace.status.${listing.status}` as TranslationKey)}</span>
          {listing.status === "ACTIVE" ? (
            <span style={rowSubMetaStyle}>{formatCountdownClock(remainingMs)}</span>
          ) : listing.status === "SOLD" && winningBid ? (
            <span style={rowSubMetaStyle}>
              {getCurrentBidAmount(listing).toLocaleString()} 💎{isDemoBidder(winningBid.bidderId) ? ` (${t("marketplace.demo.badge")})` : ""}
            </span>
          ) : (
            <span style={rowSubMetaStyle}>{t("marketplace.myMarket.feeForfeited")}</span>
          )}
        </div>
      </button>
      {children}
    </div>
  );
}

const groupStyle: CSSProperties = {
  marginBottom: 20,
};

const groupTitleStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 8,
};

const groupBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const emptyStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  padding: "10px 4px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.2)",
  padding: "6px 10px 6px 6px",
};

const rowClickableStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "none",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  padding: "4px 0",
  color: "inherit",
  minWidth: 0,
};

const rowInfoStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const rowNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.uiText,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 2,
  flexShrink: 0,
};

const rowStatusStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const rowSubMetaStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  fontFamily: "monospace",
};

const cancelButtonStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.danger}`,
  background: "transparent",
  color: PALETTE.danger,
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  cursor: "pointer",
};
