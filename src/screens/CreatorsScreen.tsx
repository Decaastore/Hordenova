import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { CREATOR_MIN_AGE, CREATOR_PURCHASE_BONUS_PCT, CREATOR_SHARE_TIERS, approvedCreators, creatorMonthlyPayout } from "@/config/creators";
import { LIVE_REWARDS_ENABLED } from "@/config/liveRewards";
import { prefillSupportDraft } from "./SupportScreen";
import { SUPPORT_ENABLED } from "@/net/support";
import { LiveRewardsPanel } from "@/ui/LiveRewardsPanel";

interface CreatorsScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const EXAMPLE_SALES = 2000;

/**
 * PROGRAMA DE CRIADORES — the page a streamer reads before applying, and
 * where players see the approved creators. Every number comes from
 * config/creators.ts; what still waits for the online server (real-money
 * purchases, live rewards) reads its real switch, so the page never promises
 * what isn't on.
 */
export function CreatorsScreen({ onNavigate, onPlay }: CreatorsScreenProps) {
  const { t, language } = useLanguage();
  const brl = new Intl.NumberFormat(language === "ptBR" ? "pt-BR" : "en-US", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const apply = () => {
    prefillSupportDraft({ topic: "OTHER", area: null, subject: t("creators.applySubject"), body: t("creators.applyBody", { age: CREATOR_MIN_AGE }) });
    onNavigate("SUPPORT");
  };
  return (
    <div className="pg-root">
      <style>{PAGE_CSS + CREATORS_CSS}</style>
      <TopNav active="CREATORS" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("creators.title")}</h1>
              <p className="pg-lead">{t("creators.lead")}</p>
              <button className="pg-btn cr8-cta" onClick={apply} disabled={!SUPPORT_ENABLED} data-testid="creators-apply">
                {t("creators.applyCta")}
              </button>
              {!SUPPORT_ENABLED && <p className="cr8-soon" data-testid="creators-apply-soon">{t("creators.applySoon")}</p>}
            </div>
          </div>
        </header>

        <div className="pg-wrap cr8-wrap">
          <section className="cr8-block" aria-labelledby="cr8-how">
            <h2 id="cr8-how" className="pg-h2">{t("creators.howTitle")}</h2>
            <ol className="cr8-steps">
              {(["1", "2", "3"] as const).map((n) => (
                <li key={n}>
                  <h3>{t(`creators.step${n}Title` as TranslationKey)}</h3>
                  <p>{t(`creators.step${n}Text` as TranslationKey, { age: CREATOR_MIN_AGE })}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="cr8-block" aria-labelledby="cr8-earn">
            <h2 id="cr8-earn" className="pg-h2">{t("creators.earnTitle")}</h2>
            <p className="pg-sub">{t("creators.earnLead")}</p>
            <table className="cr8-table" data-testid="creators-tiers">
              <thead>
                <tr>
                  <th>{t("creators.tierCol")}</th>
                  <th>{t("creators.salesCol")}</th>
                  <th>{t("creators.shareCol")}</th>
                </tr>
              </thead>
              <tbody>
                {CREATOR_SHARE_TIERS.map((tier, i) => {
                  const next = CREATOR_SHARE_TIERS[i + 1];
                  return (
                    <tr key={tier.id}>
                      <td>{t(`creators.tier.${tier.id}` as TranslationKey)}</td>
                      <td>{next ? t("creators.salesRange", { from: brl.format(tier.minMonthlySalesBrl), to: brl.format(next.minMonthlySalesBrl) }) : t("creators.salesFrom", { from: brl.format(tier.minMonthlySalesBrl) })}</td>
                      <td className="cr8-pct">{tier.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="cr8-example">{t("creators.example", { sales: brl.format(EXAMPLE_SALES), payout: brl.format(creatorMonthlyPayout(EXAMPLE_SALES)) })}</p>
          </section>

          <section className="cr8-block" aria-labelledby="cr8-fans">
            <h2 id="cr8-fans" className="pg-h2">{t("creators.fansTitle")}</h2>
            <ul className="cr8-perks">
              <li>{t("creators.fansGems", { pct: CREATOR_PURCHASE_BONUS_PCT })}</li>
              <li>{t("creators.fansLooks")}</li>
              <li>{t("creators.fansFree")}</li>
            </ul>
            <button className="pg-link" onClick={() => onNavigate("STORE")}>
              {t("creators.fansCta")}
            </button>
          </section>

          {LIVE_REWARDS_ENABLED && <LiveRewardsPanel onNavigate={onNavigate} />}

          {approvedCreators().length > 0 && (
            <section className="cr8-block" aria-labelledby="cr8-list">
              <h2 id="cr8-list" className="pg-h2">{t("creators.listTitle")}</h2>
              <ul className="cr8-list" data-testid="creators-list">
                {approvedCreators().map((c) => (
                  <li key={c.code}>
                    <strong>{c.name}</strong>
                    <span>{t(`creators.platform.${c.platform}` as TranslationKey)}</span>
                    <code>{c.code}</code>
                    <a href={c.channelUrl} target="_blank" rel="noopener noreferrer">
                      {t("creators.channel")}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="cr8-block" aria-labelledby="cr8-rules">
            <h2 id="cr8-rules" className="pg-h2">{t("creators.rulesTitle")}</h2>
            <ul className="cr8-rules">
              <li>{t("creators.rule1", { age: CREATOR_MIN_AGE })}</li>
              <li>{t("creators.rule2")}</li>
              <li>{t("creators.rule3")}</li>
              <li>{t("creators.rule4")}</li>
              <li>{t(REAL_MONEY_PAYMENTS_ENABLED ? "creators.rulePayOn" : "creators.rulePayOff")}</li>
            </ul>
            {SUPPORT_ENABLED && (
              <button className="pg-btn" onClick={apply}>
                {t("creators.applyCta")}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const CREATORS_CSS = `
.cr8-cta { margin-top: 18px; }
.cr8-cta:disabled { opacity: 0.55; cursor: not-allowed; filter: saturate(0.6); }
.cr8-soon { margin: 10px 0 0; max-width: 52ch; font-size: 14px; line-height: 1.55; color: var(--ash); }
.cr8-wrap { display: grid; gap: 44px; padding-top: 36px; padding-bottom: 80px; max-width: 980px; }
.cr8-block .pg-sub { margin-bottom: 14px; }
.cr8-steps { list-style: none; counter-reset: cr8; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 14px 0 0; padding: 0; }
.cr8-steps li { counter-increment: cr8; position: relative; padding: 18px 18px 18px 58px; border-radius: 12px; background: var(--night-2); border: 1px solid var(--line-soft); }
.cr8-steps li::before { content: counter(cr8); position: absolute; left: 16px; top: 16px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%;
  font-family: var(--display); font-weight: 700; font-size: 17px; color: #1a1208; background: var(--gold); }
.cr8-steps h3 { margin: 0; font-family: var(--display); font-size: 20px; color: var(--bone); }
.cr8-steps p { margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: #d9cdb6; }
.cr8-table { width: 100%; max-width: 640px; border-collapse: collapse; font-size: 15px; }
.cr8-table th { text-align: left; font-size: 12.5px; font-weight: 600; color: var(--ash-2); padding: 8px 12px; border-bottom: 1px solid var(--line); }
.cr8-table td { padding: 12px; border-bottom: 1px solid var(--line-soft); color: #e9dcc4; }
.cr8-pct { font-family: var(--display); font-weight: 700; font-size: 22px; color: var(--gold-hi); }
.cr8-example { margin: 12px 0 0; font-size: 14px; color: var(--ash); }
.cr8-perks, .cr8-rules { margin: 10px 0 14px; padding-left: 20px; display: grid; gap: 8px; font-size: 15px; line-height: 1.6; color: #d9cdb6; max-width: 70ch; }
.cr8-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.cr8-list li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 16px; border-radius: 10px; background: var(--night-2); border: 1px solid var(--line-soft); }
.cr8-list strong { color: var(--bone); font-size: 16px; }
.cr8-list span { color: var(--ash); font-size: 13px; }
.cr8-list code { padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.35); color: var(--gold-hi); font-size: 14px; }
.cr8-list a { color: var(--gold); font-size: 14px; }
@media (max-width: 760px) {
  .cr8-steps { grid-template-columns: 1fr; }
}
`;
