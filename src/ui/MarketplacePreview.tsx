import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { AUCTION_DURATION_HOURS, AUCTION_SALE_TAX_PERCENT, AUCTION_WEEKLY_LISTING_LIMIT, getAuctionListingFee, getAuctionMinBid, MARKETPLACE_SERVER_ONLINE } from "@/config/marketplace";
import { RARITIES, RARITY_DEFINITIONS } from "@/config/rarity";

/**
 * MARKETPLACE — the page shown while the auction house can't be used: today
 * because the online server doesn't exist yet, and later for anyone without
 * an active VIP (the Marketplace is for VIP players only). It explains the
 * auction house as it will work — every figure read from
 * config/marketplace.ts — and says plainly who it is for and when it opens.
 * Nothing here invents listings or other players.
 */

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

interface Props {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
  vipActive: boolean;
  eligibleCount: number;
}

export function MarketplacePreview({ onNavigate, onPlay, vipActive, eligibleCount }: Props) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const n = (v: number) => v.toLocaleString(locale);
  const hours = AUCTION_DURATION_HOURS.join(", ");

  const steps = [
    { title: t("marketplace.preview.step1Title"), body: t("marketplace.preview.step1Body", { hours }) },
    { title: t("marketplace.preview.step2Title"), body: t("marketplace.preview.step2Body") },
    { title: t("marketplace.preview.step3Title"), body: t("marketplace.preview.step3Body", { tax: AUCTION_SALE_TAX_PERCENT }) },
  ];

  return (
    <div className="pg-root" data-testid="market-preview">
      <style>{PAGE_CSS + MP_CSS}</style>
      <TopNav active="MARKETPLACE" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-art" style={{ backgroundImage: `url(${assetBase}sprites/ground/dwarven_undercity.webp)` }} aria-hidden="true" />
          <div className="pg-hero-inner">
            <div>
              <p className="pg-kicker">{t("marketplace.hero.kicker")}</p>
              <h1 className="pg-h1">{t("marketplace.preview.title")}</h1>
              <p className="pg-lead">{t("marketplace.preview.lead")}</p>
            </div>
            <dl className="pg-score mp-status">
              <dt>{t("marketplace.preview.statusLabel")}</dt>
              <dd>
                <span className="mp-dot" aria-hidden="true" />
                {MARKETPLACE_SERVER_ONLINE ? t("marketplace.preview.statusVip") : t("marketplace.preview.statusSoon")}
              </dd>
              <p data-testid="market-offline">
                {MARKETPLACE_SERVER_ONLINE ? t("marketplace.preview.statusVipBody") : t("marketplace.preview.statusSoonBody")} {vipActive ? t("marketplace.preview.youAreVip") : ""}
              </p>
            </dl>
          </div>
        </header>

        <div className="pg-wrap">
          <section className="mp-steps-wrap" aria-labelledby="mp-how">
            <h2 className="pg-h2" id="mp-how">
              {t("marketplace.preview.howTitle")}
            </h2>
            <ol className="mp-steps">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="mp-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="pg-cols">
            <section>
              <h2 className="pg-h2">{t("marketplace.preview.rulesTitle")}</h2>
              <p className="pg-sub">{t("marketplace.preview.rulesSub")}</p>
              <div className="pg-table-wrap">
                <table className="pg-table mp-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("marketplace.preview.colRarity")}</th>
                      <th scope="col" className="is-num">
                        {t("marketplace.preview.colMinBid")}
                      </th>
                      <th scope="col" className="is-num">
                        {t("marketplace.preview.colFee")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {RARITIES.map((r) => {
                      const fee = getAuctionListingFee(r);
                      return (
                        <tr key={r}>
                          <th scope="row">
                            <span className="mp-rarity" style={{ ["--rc" as string]: RARITY_DEFINITIONS[r].color }}>
                              {t(`rarity.${r}` as TranslationKey)}
                            </span>
                          </th>
                          <td className="is-num">{t("marketplace.preview.gems", { n: n(getAuctionMinBid(r)) })}</td>
                          <td className="is-num">{t("marketplace.preview.feeValue", { purchased: n(fee) })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="pg-note">{t("marketplace.preview.rulesNote")}</p>
            </section>

            <aside className="pg-aside">
              <div className="pg-block mp-vip">
                <h3>{t("marketplace.preview.vipTitle")}</h3>
                <p>{t("marketplace.preview.vipBody")}</p>
                <button className="pg-link" onClick={() => onNavigate("STORE")}>
                  {t("marketplace.preview.vipLink")}
                </button>
              </div>
              <div className="pg-block">
                <h3>{t("marketplace.preview.taxTitle")}</h3>
                <p>{t("marketplace.preview.taxBody", { tax: AUCTION_SALE_TAX_PERCENT, limit: AUCTION_WEEKLY_LISTING_LIMIT })}</p>
              </div>
              <div className="pg-block">
                <h3>{t("marketplace.preview.yoursTitle")}</h3>
                <p>{eligibleCount > 0 ? t("marketplace.preview.yoursBody", { n: eligibleCount }) : t("marketplace.preview.yoursNone")}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

const MP_CSS = `
.mp-status dd { display: inline-flex; align-items: center; gap: 12px; }
.mp-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 4px rgba(232,176,75,0.16); }
.mp-steps-wrap { padding: 44px 0 4px; }
.mp-steps { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--line); }
.mp-steps li { padding: 24px 28px 24px 0; }
.mp-steps li + li { padding-left: 28px; border-left: 1px solid var(--line-soft); }
.mp-step-n { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(232,176,75,0.5); color: var(--gold-hi); font-family: var(--display); font-weight: 700; font-size: 16px; }
.mp-steps h3 { margin: 14px 0 0; font-family: var(--display); font-weight: 700; font-size: 22px; color: var(--bone); }
.mp-steps p { margin: 8px 0 0; font-size: 14px; line-height: 1.65; color: var(--ash); max-width: 40ch; }
.mp-table tbody th { font-family: inherit; font-size: 14.5px; }
.mp-rarity { display: inline-flex; align-items: center; gap: 10px; color: var(--rc); font-weight: 600; }
.mp-rarity::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--rc); transform: rotate(45deg); }
.mp-vip h3 { color: var(--gold-hi); }
@media (max-width: 860px) {
  .mp-steps { grid-template-columns: minmax(0, 1fr); }
  .mp-steps li, .mp-steps li + li { padding: 20px 0; border-left: 0; }
  .mp-steps li + li { border-top: 1px solid var(--line-soft); }
}
`;
