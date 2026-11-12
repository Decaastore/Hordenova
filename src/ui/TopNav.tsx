import { useEffect, useState } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";
import { MusicControl } from "./MusicControl";
import { BrandLogo } from "./BrandLogo";
import { getPassView } from "@/engine/SeasonPassService";
import { PASS_CHANGED_EVENT } from "./SeasonPassSection";

export type NavView = "HOME" | "SEASON" | "PASS" | "RANKING" | "WIKI" | "NOVIDADES" | "MARKETPLACE" | "STORE" | "ACCOUNT";

interface TopNavProps {
  active: NavView;
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

/**
 * Persistent top navigation shown on every non-gameplay screen (Home,
 * Season, Ranking, Wiki, Novidades — see App.tsx) — spec rule "tudo que
 * possui uma abertura/página própria deve estar acessível diretamente na
 * navegação superior da Home" now includes RANKING alongside the
 * pre-existing destinations. Deliberately NOT shown during GAME, which
 * keeps its own HUD chrome untouched.
 *
 * "Jogar" (`onPlay`) is wired differently per screen by App.tsx —
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA): from Home/Ranking/Wiki/
 * Novidades it navigates to the Season screen first (never straight into
 * gameplay — the player must see the current Season's name/theme/timer/
 * best/ranking before a run starts), while from the Season screen itself
 * it starts the run directly (INICIAR/CONTINUAR RUN), since "SEASON ATUAL"
 * is already satisfied by being there. There is a single permanent save —
 * never re-triggering Home's own portal transition a second time.
 */
export function TopNav({ active, onNavigate, onPlay }: TopNavProps) {
  const { t } = useLanguage();
  // Free Pass levels reached but not claimed yet — a dot on PASSE says there's something to pick up.
  const [, refresh] = useState(0);
  useEffect(() => {
    const onChange = () => refresh((n) => n + 1);
    window.addEventListener(PASS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PASS_CHANGED_EVENT, onChange);
  }, []);
  const passClaimable = getPassView().claimable.length;

  const link = (view: NavView, label: string, extra?: { dot?: boolean; dotTitle?: string }) => (
    <button
      key={view}
      className={`tn-link${active === view ? " is-active" : ""}`}
      aria-current={active === view ? "page" : undefined}
      title={extra?.dot ? extra.dotTitle : undefined}
      onClick={() => onNavigate(view)}
    >
      {label}
      {extra?.dot && <span aria-hidden="true" className="tn-dot" />}
    </button>
  );

  return (
    <nav className="tn">
      <style>{TOP_NAV_CSS}</style>
      <button className="tn-brand" onClick={() => onNavigate("HOME")} aria-label={t("nav.home")}>
        <BrandLogo height={30} decorative />
      </button>
      <div className="tn-links">
        {link("SEASON", t("nav.season"))}
        {link("PASS", t("nav.pass"), { dot: passClaimable > 0, dotTitle: t("nav.passReady", { n: passClaimable }) })}
        {link("RANKING", t("nav.ranking"))}
        {link("STORE", t("nav.store"))}
        {link("MARKETPLACE", t("nav.marketplace"))}
        {link("WIKI", t("nav.wiki"))}
        {link("NOVIDADES", t("nav.novidades"))}
      </div>
      {/* MÚSICA GLOBAL spec section 22 — the music control and the language
          selector must be reachable from every page the global track plays
          on, so they live here unconditionally. */}
      <div className="tn-tools">
        <button className={`tn-acct${active === "ACCOUNT" ? " is-active" : ""}`} onClick={() => onNavigate("ACCOUNT")} aria-current={active === "ACCOUNT" ? "page" : undefined} title={t("nav.account")} data-testid="nav-account">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="8" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3.8 21c1.2-4.4 4.4-6.4 8.2-6.4s7 2 8.2 6.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>{t("nav.account")}</span>
        </button>
        <LanguageSelector inline />
        <MusicControl />
        <button className="tn-play" onClick={onPlay}>
          {t("nav.play")}
        </button>
      </div>
      <span className="tn-rule" aria-hidden="true" />
    </nav>
  );
}

/**
 * The same black-and-gold identity, finished like a big dark-fantasy title:
 * a solid bar closed by a gold rule with a diamond at its center, the
 * current page marked by a small gold diamond, and "Jogar" as the one
 * crimson, gold-framed button on the page.
 */
const TOP_NAV_CSS = `
.tn {
  position: relative; z-index: 5; flex-shrink: 0; box-sizing: border-box; width: 100%;
  display: flex; align-items: center; gap: 0 clamp(14px, 2.2vw, 34px);
  min-height: 68px; padding: 0 clamp(14px, 2.4vw, 32px);
  background: linear-gradient(180deg, rgba(14,9,5,0.97), rgba(20,14,7,0.9));
}
.tn-rule { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(232,176,75,0.55) 18%, #f7dc9c 50%, rgba(232,176,75,0.55) 82%, transparent); }
.tn-rule::after { content: ""; position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; background: #f7dc9c;
  transform: translate(-50%, -50%) rotate(45deg); box-shadow: 0 0 10px rgba(247,220,156,0.8), 0 0 0 3px #140e07; }
.tn :focus-visible { outline: 2px solid #f7dc9c; outline-offset: 3px; }
nav.tn .tn-brand { display: flex; align-items: center; padding: 0; background: none; border: none; cursor: pointer; filter: drop-shadow(0 0 10px rgba(232,176,75,0.25)); }
nav.tn .tn-links { display: flex; align-items: center; justify-content: safe center; gap: clamp(4px, 1vw, 14px); flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; align-self: stretch; }
nav.tn .tn-links::-webkit-scrollbar { display: none; }
nav.tn .tn-link {
  position: relative; flex-shrink: 0; align-self: stretch; display: flex; align-items: center;
  padding: 0 8px; background: none; border: none; cursor: pointer;
  font: 700 12.5px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; letter-spacing: 1.6px; text-transform: uppercase; white-space: nowrap;
  color: ${PALETTE.uiTextDim}; transition: color 140ms ease, text-shadow 140ms ease;
}
nav.tn .tn-link:hover { color: ${PALETTE.uiAccentBright}; text-shadow: 0 0 12px rgba(255,207,94,0.5); }
nav.tn .tn-link.is-active { color: ${PALETTE.uiAccentBright}; text-shadow: 0 0 12px rgba(255,207,94,0.45); }
nav.tn .tn-link.is-active::after { content: ""; position: absolute; left: 50%; bottom: 10px; width: 6px; height: 6px; background: ${PALETTE.uiAccent};
  transform: translateX(-50%) rotate(45deg); box-shadow: 0 0 8px ${PALETTE.uiAccent}; }
.tn-dot { position: absolute; top: 20px; right: -2px; width: 7px; height: 7px; border-radius: 50%; background: ${PALETTE.uiAccentBright}; box-shadow: 0 0 6px ${PALETTE.uiAccent}; }
.tn-tools { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tn-acct { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(232,176,75,0.5); background: rgba(0,0,0,0.35); color: #f1dcae; font: inherit; font-weight: 700; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.tn-acct:hover, .tn-acct.is-active { border-color: #e8b04b; background: rgba(232,176,75,0.14); }
.tn-acct:focus-visible { outline: 2px solid #e8b04b; outline-offset: 2px; }
@media (max-width: 1560px) { .tn-acct span { display: none; } .tn-acct { padding: 0 8px; } }
nav.tn .tn-play {
  margin-left: 8px; padding: 10px 26px; cursor: pointer; border-radius: 6px;
  font: 800 13px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; letter-spacing: 2px; text-transform: uppercase; color: #fff2c9;
  border: 1px solid #e8b04b;
  background: linear-gradient(180deg, #e2313f 0%, #b3121f 55%, #7d0a14 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(0,0,0,0.35), 0 0 18px rgba(226,49,63,0.45), 0 2px 0 #3d0508;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  transition: filter 140ms ease, transform 140ms ease, box-shadow 140ms ease;
}
nav.tn .tn-play:hover { filter: brightness(1.15); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 0 0 1px rgba(0,0,0,0.35), 0 0 28px rgba(226,49,63,0.7), 0 2px 0 #3d0508; }
nav.tn .tn-play:active { transform: translateY(1px); }
@media (max-width: 900px) {
  .tn { flex-wrap: wrap; padding-top: 8px; }
  .tn-tools { margin-left: auto; }
  nav.tn .tn-links { order: 3; flex: 0 0 100%; justify-content: flex-start; min-height: 44px; }
  nav.tn .tn-brand img { height: 24px !important; }
}
`;
