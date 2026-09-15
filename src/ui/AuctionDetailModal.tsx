import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { getDropTable } from "@/config/dropTables";
import { getBossDefinitionById } from "@/config/bossConfig";
import { getCurrentBidAmount, getLeadingBidderId, type AuctionListing } from "@/entities/Auction";
import { getMinimumNextBid, isDemoBidder } from "@/config/marketplace";
import { formatCountdownClock } from "@/utils/formatDuration";
import type { PriceHistory } from "@/engine/MarketplaceService";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./AuctionCard";

interface AuctionDetailModalProps {
  listing: AuctionListing;
  nowMs: number;
  gemsBalance: number;
  priceHistory: PriceHistory;
  onClose: () => void;
  onPlaceDemoBid: (amount: number) => { ok: true } | { ok: false; reason: string };
}

/** Item detail — spec: large art, name, rarity, origin Boss, description, stats, drop chance, ownership history (real, per-instance, via the listed item's own ItemHistoryEntry array is NOT shown here since the listing only tracks the item DEFINITION for browsing purposes; the real per-copy history lives on ItemDetailsModal for owned items), current/next bid, countdown, bid count, recent bid history, BID NOW. */
export function AuctionDetailModal({ listing, nowMs, gemsBalance, priceHistory, onClose, onPlaceDemoBid }: AuctionDetailModalProps) {
  const { t } = useLanguage();
  const [bidInput, setBidInput] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const def = getItemDefinition(listing.itemDefinitionId);
  if (!def) return null;
  const rarity = getRarityDefinition(def.rarity);
  const currentBid = getCurrentBidAmount(listing);
  const nextBid = getMinimumNextBid(currentBid);
  const leaderId = getLeadingBidderId(listing);
  const remainingMs = listing.endsAt - nowMs;
  const expired = remainingMs <= 0;
  const boss = def.source.type !== "PHASE_MILESTONE" ? getBossDefinitionById(def.source.refId) : null;
  const dropTable = def.source.type !== "PHASE_MILESTONE" ? getDropTable(def.source.refId) : null;
  const dropEntry = dropTable?.entries.find((e) => e.itemId === def.id) ?? null;

  const bidValue = bidInput !== null ? Number(bidInput) : nextBid;
  const canAffordDemo = true; // demo bids never spend real Gems, see config/marketplace.ts

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>

        <div style={headerRowStyle}>
          <ItemGlyph rarity={rarity} size={84} />
          <div>
            <div style={nameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
            <RarityBadge rarity={def.rarity} size="md" />
            {boss && <div style={originStyle}>{t("marketplace.detail.origin", { boss: t(`bosses.${boss.i18nKey}.name` as TranslationKey) })}</div>}
          </div>
        </div>

        <p style={descriptionStyle}>{t(`items.${def.i18nKey}.description` as TranslationKey)}</p>

        {def.effects.length > 0 && (
          <Section label={t("inventory.effects")}>
            {def.effects.map((effect, i) => (
              <div key={i} style={effectLineStyle}>
                {t(`itemEffect.${effect.kind}` as TranslationKey, { value: effect.value })}
              </div>
            ))}
          </Section>
        )}

        {dropEntry && (
          <Section label={t("marketplace.detail.dropChance")}>
            <div style={mutedLineStyle}>{t("marketplace.detail.dropChanceValue", { percent: dropEntry.weightPercent })}</div>
          </Section>
        )}

        <div style={auctionBoxStyle}>
          <div style={auctionStatRowStyle}>
            <span style={auctionLabelStyle}>{t("marketplace.card.currentBid")}</span>
            <span style={auctionGoldValueStyle}>{currentBid.toLocaleString()} 💎</span>
          </div>
          <div style={auctionStatRowStyle}>
            <span style={auctionLabelStyle}>{t("marketplace.card.nextBid")}</span>
            <span style={auctionValueStyle}>{nextBid.toLocaleString()} 💎</span>
          </div>
          <div style={auctionStatRowStyle}>
            <span style={auctionLabelStyle}>{t("marketplace.card.timeRemaining")}</span>
            <span style={{ ...auctionValueStyle, fontFamily: "monospace" }}>{expired ? "00:00:00" : formatCountdownClock(remainingMs)}</span>
          </div>
          <div style={auctionStatRowStyle}>
            <span style={auctionLabelStyle}>{t("marketplace.card.bidCount", { count: listing.bids.length })}</span>
            <span style={auctionValueStyle}>{leaderId ? (isDemoBidder(leaderId) ? t("marketplace.demo.leaderLabel") : leaderId.slice(0, 10)) : "—"}</span>
          </div>
        </div>

        {listing.bids.length > 0 && (
          <Section label={t("marketplace.detail.recentBids")}>
            {[...listing.bids]
              .reverse()
              .slice(0, 8)
              .map((bid) => (
                <div key={bid.id} style={bidHistoryRowStyle}>
                  <span>{isDemoBidder(bid.bidderId) ? t("marketplace.demo.leaderLabel") : bid.bidderId.slice(0, 10)}</span>
                  <span style={{ color: PALETTE.gold, fontWeight: 700 }}>{bid.amount.toLocaleString()} 💎</span>
                </div>
              ))}
          </Section>
        )}

        <PriceHistorySection history={priceHistory} />

        {listing.status === "ACTIVE" && !expired ? (
          <div style={bidFormStyle}>
            <div style={demoNoticeStyle}>{t("marketplace.demo.bidExplainer")}</div>
            <input
              type="number"
              min={nextBid}
              value={bidInput ?? nextBid}
              onChange={(e) => setBidInput(e.target.value)}
              style={bidInputStyle}
            />
            {feedback && <div style={feedbackStyle}>{feedback}</div>}
            <button
              onClick={() => {
                const outcome = onPlaceDemoBid(Math.floor(bidValue));
                if (outcome.ok) {
                  setFeedback(t("marketplace.detail.bidPlaced"));
                  setBidInput(null);
                } else {
                  setFeedback(t("marketplace.detail.bidRejected", { minimum: nextBid }));
                }
              }}
              disabled={!canAffordDemo || bidValue < nextBid}
              style={{ ...bidNowButtonStyle, opacity: bidValue < nextBid ? 0.5 : 1 }}
            >
              {t("marketplace.detail.bidNow")}
            </button>
          </div>
        ) : (
          <div style={closedNoticeStyle}>{t("marketplace.detail.auctionClosed")}</div>
        )}

        <div style={gemsFooterStyle}>{t("hud.gems")}: {gemsBalance.toLocaleString()}</div>
      </div>
    </div>
  );
}

function PriceHistorySection({ history }: { history: PriceHistory }) {
  const { t } = useLanguage();
  if (history.sales.length === 0) {
    return (
      <Section label={t("marketplace.detail.priceHistory")}>
        <div style={mutedLineStyle}>{t("marketplace.detail.noRealSales")}</div>
      </Section>
    );
  }
  return (
    <Section label={t("marketplace.detail.priceHistory")}>
      <div style={priceStatsRowStyle}>
        <PriceStat label={t("marketplace.detail.average")} value={history.averageAmount!} />
        <PriceStat label={t("marketplace.detail.median")} value={history.medianAmount!} />
        <PriceStat label={t("marketplace.detail.lowest")} value={history.lowestAmount!} />
        <PriceStat label={t("marketplace.detail.highest")} value={history.highestAmount!} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {history.sales.slice(0, 6).map((sale, i) => (
          <span key={i} style={salePillStyle}>
            {sale.amount.toLocaleString()} 💎{sale.isDemo ? ` (${t("marketplace.demo.badge")})` : ""}
          </span>
        ))}
      </div>
    </Section>
  );
}

function PriceStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={priceStatStyle}>
      <div style={priceStatLabelStyle}>{label}</div>
      <div style={priceStatValueStyle}>{Math.round(value).toLocaleString()} 💎</div>
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
  width: 420,
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

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 16,
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 20,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 6,
};

const originStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginTop: 6,
};

const descriptionStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.55,
  color: PALETTE.uiText,
  marginTop: 14,
};

const effectLineStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.success,
  fontWeight: 700,
};

const sectionStyle: CSSProperties = {
  marginTop: 14,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 5,
};

const mutedLineStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
};

const auctionBoxStyle: CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const auctionStatRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11.5,
};

const auctionLabelStyle: CSSProperties = {
  color: PALETTE.uiTextDim,
};

const auctionValueStyle: CSSProperties = {
  fontWeight: 700,
  color: PALETTE.uiText,
};

const auctionGoldValueStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: PALETTE.gold,
};

const bidHistoryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  padding: "3px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const priceStatsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 6,
};

const priceStatStyle: CSSProperties = {
  padding: "6px 4px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
};

const priceStatLabelStyle: CSSProperties = {
  fontSize: 8,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const priceStatValueStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
  marginTop: 2,
};

const salePillStyle: CSSProperties = {
  fontSize: 9.5,
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  color: PALETTE.uiTextDim,
};

const bidFormStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
};

const demoNoticeStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  marginBottom: 8,
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
};

const bidInputStyle: CSSProperties = {
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

const feedbackStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.gold,
  marginTop: 6,
};

const bidNowButtonStyle: CSSProperties = {
  marginTop: 10,
  width: "100%",
  padding: "11px 0",
  borderRadius: 9,
  border: `2px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: 1,
  cursor: "pointer",
};

const closedNoticeStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  textAlign: "center",
};

const gemsFooterStyle: CSSProperties = {
  marginTop: 12,
  fontSize: 10,
  color: PALETTE.uiTextDim,
  textAlign: "right",
};
