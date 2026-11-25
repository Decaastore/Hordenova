import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { CLOUD_ENABLED } from "@/net/cloud";
import { REAL_MONEY_PAYMENTS_ENABLED } from "@/config/store";
import { PURCHASE_MIN_AGE } from "@/config/ageGate";
import { FREE_GEMS_PRICE_MULTIPLIER } from "@/config/gemsEconomy";
import { SEASON_DURATION_MS } from "@/engine/SeasonClock";
import { COLOSSUS_ATTEMPTS_PER_DAY, COLOSSUS_ROOM_SIZE } from "@/config/colossus";
import { PASS_LEVELS } from "@/config/seasonPass";

interface FaqScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

/** Each answer is one i18n key; the values that can change (prices, rules, what's switched on) come from the game's own config. */
const QUESTIONS = ["INSTALL", "FREE", "PHONE", "SAVE", "SEASON", "GEMS", "PAYMENTS", "GLOBAL_BOSS", "RANKING", "SUPPORT"] as const;
type QuestionId = (typeof QUESTIONS)[number];

/**
 * PERGUNTAS FREQUENTES (owner's call, Nov 2026, inspired by other game
 * sites' FAQs): the questions a new player asks, answered in plain words.
 * Every answer that depends on something switchable (online account, real
 * money) reads the real switch, so the page never promises what isn't on.
 */
export function FaqScreen({ onNavigate, onPlay }: FaqScreenProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<QuestionId | null>("INSTALL");
  const values: Record<string, string | number> = {
    days: Math.round(SEASON_DURATION_MS / 86_400_000),
    levels: PASS_LEVELS,
    mult: String(FREE_GEMS_PRICE_MULTIPLIER).replace(".", t("faq.decimal")),
    age: PURCHASE_MIN_AGE,
    attempts: COLOSSUS_ATTEMPTS_PER_DAY,
    room: COLOSSUS_ROOM_SIZE,
  };
  const answer = (id: QuestionId) => {
    if (id === "SAVE") return t(CLOUD_ENABLED ? "faq.items.SAVE.aCloud" : "faq.items.SAVE.aLocal", values);
    if (id === "PAYMENTS") return t(REAL_MONEY_PAYMENTS_ENABLED ? "faq.items.PAYMENTS.aOn" : "faq.items.PAYMENTS.aOff", values);
    return t(`faq.items.${id}.a` as TranslationKey, values);
  };
  const link: Partial<Record<QuestionId, NavView>> = { SEASON: "SEASON", GEMS: "STORE", GLOBAL_BOSS: "BOSSES", RANKING: "RANKING", SUPPORT: "SUPPORT", SAVE: "ACCOUNT" };

  return (
    <div className="pg-root">
      <style>{PAGE_CSS + FAQ_CSS}</style>
      <TopNav active="FAQ" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-inner">
            <div>
              <h1 className="pg-h1">{t("faq.title")}</h1>
              <p className="pg-lead">{t("faq.lead")}</p>
            </div>
          </div>
        </header>
        <div className="pg-wrap fq-wrap">
          <div className="fq-list" data-testid="faq-list">
            {QUESTIONS.map((id) => {
              const isOpen = open === id;
              const to = link[id];
              return (
                <section key={id} className={`fq-item${isOpen ? " is-open" : ""}`} data-testid={`faq-${id}`}>
                  <h2>
                    <button aria-expanded={isOpen} aria-controls={`faq-a-${id}`} onClick={() => setOpen(isOpen ? null : id)}>
                      <span>{t(`faq.items.${id}.q` as TranslationKey)}</span>
                      <i aria-hidden="true" />
                    </button>
                  </h2>
                  <div id={`faq-a-${id}`} className="fq-a" hidden={!isOpen}>
                    <p>{answer(id)}</p>
                    {to && (
                      <button className="pg-link" onClick={() => onNavigate(to)}>
                        {t(`faq.items.${id}.link` as TranslationKey)}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <aside className="fq-aside">
            <h2 className="pg-h2">{t("faq.moreTitle")}</h2>
            <p className="pg-sub">{t("faq.moreLead")}</p>
            <button className="pg-btn" onClick={() => onNavigate("SUPPORT")}>
              {t("faq.moreCta")}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

const FAQ_CSS = `
.fq-wrap { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 48px; padding-top: 36px; padding-bottom: 80px; align-items: start; }
.fq-list { border-top: 1px solid var(--line); }
.fq-item { border-bottom: 1px solid var(--line); }
.fq-item h2 { margin: 0; }
.fq-item h2 button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 2px; background: none; border: 0; cursor: pointer; text-align: left;
  font-family: var(--display); font-weight: 700; font-size: clamp(20px, 2vw, 24px); line-height: 1.2; color: var(--bone); }
.fq-item h2 button:hover, .fq-item.is-open h2 button { color: var(--gold-hi); }
.fq-item h2 i { position: relative; flex: none; width: 14px; height: 14px; }
.fq-item h2 i::before, .fq-item h2 i::after { content: ""; position: absolute; left: 0; right: 0; top: 6px; height: 2px; border-radius: 1px; background: var(--gold); transition: transform 200ms var(--hn-ease-out, ease); }
.fq-item h2 i::after { transform: rotate(90deg); }
.fq-item.is-open h2 i::after { transform: rotate(0deg); }
.fq-a { padding: 0 2px 22px; }
.fq-a p { margin: 0; max-width: 68ch; font-size: 15px; line-height: 1.7; color: #d9cdb6; }
.fq-a .pg-link { margin-top: 10px; }
.fq-item.is-open .fq-a { animation: hn-rise 260ms var(--hn-ease-out, ease) backwards; }
.fq-aside { position: sticky; top: 20px; padding-top: 18px; }
.fq-aside .pg-btn { margin-top: 6px; }
@media (max-width: 860px) {
  .fq-wrap { grid-template-columns: 1fr; gap: 28px; }
  .fq-aside { position: static; }
}
@media (max-width: 520px) {
  .fq-aside .pg-btn { width: 100%; }
}
`;
