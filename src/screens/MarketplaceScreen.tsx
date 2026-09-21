import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { loadSave } from "@/engine/SaveSystem";
import {
  cancelMyAuctionListing,
  createAuctionListingForItem,
  getActiveAuctionListings,
  getMyAuctionListings,
  getPriceHistoryForItemDefinition,
  getTradeUnlockPrice,
  placeDemoBid,
  refreshMarketplace,
  unlockTrade,
} from "@/engine/MarketplaceService";
import { DualGemPriceButtons } from "@/ui/DualGemPriceButtons";
import { canListItemForAuction } from "@/engine/AuctionManager";
import { getCurrentBidAmount, type AuctionListing } from "@/entities/Auction";
import { getItemDefinition, type ItemCategory } from "@/config/itemDefinitions";
import { RARITIES, type Rarity } from "@/config/rarity";
import { AuctionCard } from "@/ui/AuctionCard";
import { AuctionDetailModal } from "@/ui/AuctionDetailModal";
import { CreateAuctionModal } from "@/ui/CreateAuctionModal";
import { MyMarketPanel } from "@/ui/MyMarketPanel";
import { RarityBadge } from "@/ui/RarityBadge";

interface MarketplaceScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

type Tab = "BROWSE" | "MY_MARKET";
type SortBy = "ENDING_SOON" | "HIGHEST_BID" | "LOWEST_BID" | "MOST_CONTESTED" | "MOST_RECENT";

/**
 * MARKETPLACE / LEILÃO — the auction house, reached from the same top nav
 * as Home/Season/Ranking/Wiki/Novidades (see TopNav.tsx's NavView union).
 * State reads directly through engine/MarketplaceService.ts (loadSave/
 * updateSave), exactly like SeasonScreen/RankingScreen/WikiScreen already
 * do — no live GameEngine instance is needed here, since `new GameEngine()`
 * only exists inside useGameEngine (mounted by GameScreen for actual
 * combat); see MarketplaceService.ts's own header for the full rationale.
 *
 * HONESTY NOTE (matches TradeScreen.tsx's and RankingScreen.tsx's existing
 * precedent): HORDENOVA has no multiplayer backend yet, so every bid a
 * player can place here is registered under a single, clearly-labeled
 * local demonstration identity (see config/marketplace.ts's DEMO_BIDDER_ID
 * and AuctionManager.ts's own header) — never a fabricated "other player".
 */
export function MarketplaceScreen({ onNavigate, onPlay }: MarketplaceScreenProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("BROWSE");
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("ENDING_SOON");
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    refreshMarketplace();
    const settleId = setInterval(() => setRefreshTick((n) => n + 1), 5000);
    const clockId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(settleId);
      clearInterval(clockId);
    };
  }, []);

  const save = useMemo(() => loadSave(), [refreshTick]);
  const activeListings = useMemo(() => getActiveAuctionListings(), [refreshTick]);
  const myListings = useMemo(() => getMyAuctionListings(), [refreshTick]);

  const eligibleItems = useMemo(
    () => save.inventory.filter((item) => canListItemForAuction(item, save.playerId)),
    [save],
  );

  // Filter chips built ONLY from real tradable-catalog categories/rarities
  // actually present (spec's own "não inventar" rule) — a "Boss"/"Mini-Boss"
  // filter would have zero real backing today (see config/itemDefinitions.ts:
  // every current item is a BOSS_DROP from one source; no MINI_BOSS_DROP
  // entry exists yet), so it isn't fabricated here just to look complete.
  const availableCategories = useMemo(() => {
    const set = new Set<ItemCategory>();
    for (const listing of activeListings) {
      const def = getItemDefinition(listing.itemDefinitionId);
      if (def) set.add(def.category);
    }
    return Array.from(set);
  }, [activeListings]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = activeListings.filter((listing) => {
      const def = getItemDefinition(listing.itemDefinitionId);
      if (!def) return false;
      if (rarityFilter !== "ALL" && def.rarity !== rarityFilter) return false;
      if (categoryFilter !== "ALL" && def.category !== categoryFilter) return false;
      if (query) {
        const name = t(`items.${def.i18nKey}.name` as TranslationKey).toLowerCase();
        if (!name.includes(query)) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "ENDING_SOON":
          return a.endsAt - b.endsAt;
        case "HIGHEST_BID":
          return getCurrentBidAmount(b) - getCurrentBidAmount(a);
        case "LOWEST_BID":
          return getCurrentBidAmount(a) - getCurrentBidAmount(b);
        case "MOST_CONTESTED":
          return b.bids.length - a.bids.length;
        case "MOST_RECENT":
          return b.createdAt - a.createdAt;
      }
    });
    return result;
  }, [activeListings, search, rarityFilter, categoryFilter, sortBy, t]);

  const featured = useMemo(() => {
    return [...activeListings]
      .sort((a, b) => b.bids.length - a.bids.length || getCurrentBidAmount(b) - getCurrentBidAmount(a))
      .slice(0, 3);
  }, [activeListings]);

  const selectedListing: AuctionListing | null = selectedAuctionId
    ? [...activeListings, ...myListings].find((l) => l.id === selectedAuctionId) ?? null
    : null;

  return (
    <div style={rootStyle}>
      <style>{RESPONSIVE_CSS}</style>
      <TopNav active="MARKETPLACE" onNavigate={onNavigate} onPlay={onPlay} />

      <div className="mkt-body" style={bodyStyle}>
        <div style={heroStyle}>
          <div style={heroKickerStyle}>{t("marketplace.hero.kicker")}</div>
          <div style={heroTitleStyle}>{t("marketplace.hero.title")}</div>
          <p style={heroTaglineStyle}>{t("marketplace.hero.tagline")}</p>
          <div style={heroRowStyle}>
            <div style={gemsBadgeStyle}>
              {t("hud.purchasedGems")}: <strong>{save.purchasedGems.toLocaleString()}</strong>
            </div>
            {save.tradeUnlocked && (
              <button onClick={() => setCreating(true)} style={createCtaStyle}>
                {t("marketplace.create.title")}
              </button>
            )}
          </div>
        </div>

        {!save.tradeUnlocked ? (
          <div style={tradeLockedBoxStyle}>
            <div style={tradeLockedTitleStyle}>{t("marketplace.trade.lockedTitle")}</div>
            <p style={tradeLockedExplainerStyle}>{t("marketplace.trade.lockedExplainer")}</p>
            <p style={tradeLockedExplainerStyle}>
              {t("marketplace.trade.unlockPrompt", { free: getTradeUnlockPrice().free, purchased: getTradeUnlockPrice().purchased })}
            </p>
            <DualGemPriceButtons
              price={getTradeUnlockPrice()}
              freeBalance={save.freeGems}
              purchasedBalance={save.purchasedGems}
              onPay={(currency) => {
                unlockTrade(currency);
                setRefreshTick((n) => n + 1);
              }}
            />
          </div>
        ) : (
          <>
        <div style={tabRowStyle}>
          <TabButton active={tab === "BROWSE"} label={t("marketplace.tabs.browse")} onClick={() => setTab("BROWSE")} />
          <TabButton active={tab === "MY_MARKET"} label={t("marketplace.tabs.myMarket")} onClick={() => setTab("MY_MARKET")} />
        </div>

        {tab === "BROWSE" ? (
          <>
            {featured.length > 0 && (
              <>
                <div style={sectionTitleStyle}>🔥 {t("marketplace.featured.title")}</div>
                <div className="mkt-grid" style={gridStyle}>
                  {featured.map((listing) => (
                    <AuctionCard key={listing.id} listing={listing} nowMs={nowMs} onOpen={() => setSelectedAuctionId(listing.id)} />
                  ))}
                </div>
              </>
            )}

            <div style={sectionTitleStyle}>{t("marketplace.browse.allAuctions")}</div>

            <div className="mkt-filters" style={filterRowStyle}>
              <input
                type="text"
                placeholder={t("marketplace.filters.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInputStyle}
              />
              <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as Rarity | "ALL")} style={selectStyle}>
                <option value="ALL">{t("marketplace.filters.allRarities")}</option>
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {t(`rarity.${r}` as TranslationKey)}
                  </option>
                ))}
              </select>
              {availableCategories.length > 0 && (
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ItemCategory | "ALL")} style={selectStyle}>
                  <option value="ALL">{t("marketplace.filters.allCategories")}</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {t(`itemCategory.${c}` as TranslationKey)}
                    </option>
                  ))}
                </select>
              )}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} style={selectStyle}>
                <option value="ENDING_SOON">{t("marketplace.filters.sortEndingSoon")}</option>
                <option value="HIGHEST_BID">{t("marketplace.filters.sortHighestBid")}</option>
                <option value="LOWEST_BID">{t("marketplace.filters.sortLowestBid")}</option>
                <option value="MOST_CONTESTED">{t("marketplace.filters.sortMostContested")}</option>
                <option value="MOST_RECENT">{t("marketplace.filters.sortMostRecent")}</option>
              </select>
            </div>

            {filteredListings.length === 0 ? (
              <div style={emptyStateStyle}>
                <RarityBadge rarity="COMMON" />
                <p style={emptyTextStyle}>{activeListings.length === 0 ? t("marketplace.browse.noAuctionsYet") : t("marketplace.browse.noMatches")}</p>
              </div>
            ) : (
              <div className="mkt-grid" style={gridStyle}>
                {filteredListings.map((listing) => (
                  <AuctionCard key={listing.id} listing={listing} nowMs={nowMs} onOpen={() => setSelectedAuctionId(listing.id)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <MyMarketPanel
            listings={myListings}
            nowMs={nowMs}
            onOpen={(id) => setSelectedAuctionId(id)}
            onCancel={(id) => {
              cancelMyAuctionListing(id);
              setRefreshTick((n) => n + 1);
            }}
          />
        )}
          </>
        )}
      </div>

      {selectedListing && (
        <AuctionDetailModal
          listing={selectedListing}
          nowMs={nowMs}
          purchasedGemsBalance={save.purchasedGems}
          priceHistory={getPriceHistoryForItemDefinition(selectedListing.itemDefinitionId)}
          onClose={() => setSelectedAuctionId(null)}
          onPlaceDemoBid={(amount) => {
            const ok = placeDemoBid(selectedListing.id, amount);
            setRefreshTick((n) => n + 1);
            return ok ? { ok: true } : { ok: false, reason: "REJECTED" };
          }}
        />
      )}

      {creating && (
        <CreateAuctionModal
          eligibleItems={eligibleItems}
          purchasedGemsBalance={save.purchasedGems}
          onClose={() => setCreating(false)}
          onCreate={(instanceId, minBid, durationHours) => {
            const result = createAuctionListingForItem(instanceId, minBid, durationHours);
            setRefreshTick((n) => n + 1);
            return result;
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tabButtonStyle,
        color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
        borderBottomColor: active ? PALETTE.uiAccent : "transparent",
      }}
    >
      {label}
    </button>
  );
}

const RESPONSIVE_CSS = `
.hordenova-auction-card:hover { transform: translateY(-3px); }
@media (max-width: 720px) {
  .mkt-body { padding: 16px !important; }
  .mkt-grid { grid-template-columns: 1fr !important; }
  .mkt-filters { flex-direction: column !important; align-items: stretch !important; }
  .mkt-filters select, .mkt-filters input { width: 100% !important; }
}
`;

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: `radial-gradient(ellipse at top, #241610 0%, #120b06 55%, #0a0604 100%)`,
  color: PALETTE.uiText,
  overflow: "hidden",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "28px 32px 60px",
  maxWidth: 1100,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const heroStyle: CSSProperties = {
  textAlign: "center",
  marginBottom: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
};

const heroKickerStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: PALETTE.danger,
};

const heroTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "clamp(28px, 5vw, 40px)",
  fontWeight: 800,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 30px ${PALETTE.uiAccent}55`,
};

const heroTaglineStyle: CSSProperties = {
  fontSize: 12.5,
  color: PALETTE.uiTextDim,
  maxWidth: 480,
  lineHeight: 1.6,
  margin: 0,
};

const heroRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginTop: 10,
};

const gemsBadgeStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.gem}`,
  background: "rgba(200,138,255,0.1)",
  color: PALETTE.uiText,
  fontSize: 12,
};

const createCtaStyle: CSSProperties = {
  padding: "9px 20px",
  borderRadius: 999,
  border: `2px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const tradeLockedBoxStyle: CSSProperties = {
  maxWidth: 480,
  margin: "0 auto 24px",
  padding: "20px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.gem}`,
  background: "rgba(200,138,255,0.06)",
  textAlign: "center",
};

const tradeLockedTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
  marginBottom: 8,
};

const tradeLockedExplainerStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.6,
  marginBottom: 10,
};

const tabRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
  marginBottom: 20,
};

const tabButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "8px 4px",
  marginRight: 18,
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 16,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 12,
  marginTop: 8,
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 16,
};

const searchInputStyle: CSSProperties = {
  flex: "1 1 200px",
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.3)",
  color: PALETTE.uiText,
  fontSize: 12,
};

const selectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.3)",
  color: PALETTE.uiText,
  fontSize: 11.5,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 30,
};

const emptyStateStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "50px 20px",
  textAlign: "center",
};

const emptyTextStyle: CSSProperties = {
  fontSize: 12.5,
  color: PALETTE.uiTextDim,
  maxWidth: 380,
  lineHeight: 1.6,
};
