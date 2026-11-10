import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";
import { MusicControl } from "./MusicControl";
import { SiteWordmark } from "./SiteWordmark";
import { SITE, SITE_TEXT_FONT } from "./siteFonts";
import { getPassView } from "@/engine/SeasonPassService";
import { PASS_CHANGED_EVENT } from "./SeasonPassSection";

export type NavView = "HOME" | "SEASON" | "PASS" | "RANKING" | "WIKI" | "NOVIDADES" | "MARKETPLACE" | "STORE";

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
        <SiteWordmark fontSize={30} decorative />
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
        <LanguageSelector inline />
        <MusicControl />
        <button className="tn-play" onClick={onPlay}>
          {t("nav.play")}
        </button>
      </div>
    </nav>
  );
}

/**
 * The bar is a wall: solid pine with a row of merlons hanging from its lower
 * edge. The page you are on is a pennant hung on it — ember cloth with a
 * swallowtail cut — and "Jogar" is a block of cut stone, chamfered instead
 * of rounded.
 */
const TOP_NAV_CSS = `
.tn {
  --tn-bg: ${SITE.pine};
  position: relative; z-index: 5; flex-shrink: 0; box-sizing: border-box; width: 100%;
  display: flex; align-items: stretch; gap: 0 clamp(12px, 2vw, 28px);
  min-height: 62px; padding: 0 clamp(14px, 2.4vw, 32px);
  background: var(--tn-bg); color: ${SITE.bone};
  font-family: ${SITE_TEXT_FONT};
}
.tn::after {
  content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 7px; pointer-events: none;
  background: var(--tn-bg);
  -webkit-mask: repeating-linear-gradient(90deg, #000 0 16px, transparent 16px 30px);
  mask: repeating-linear-gradient(90deg, #000 0 16px, transparent 16px 30px);
}
.tn button { font-family: inherit; }
.tn :focus-visible { outline: 2px solid ${SITE.emberHi}; outline-offset: 2px; }
.tn-brand { display: flex; align-items: center; padding: 0 4px 0 0; background: none; border: none; cursor: pointer; color: ${SITE.bone}; }
.tn-brand:hover { color: #fff; }
.tn-links { display: flex; align-items: stretch; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tn-links::-webkit-scrollbar { display: none; }
.tn-link {
  position: relative; flex-shrink: 0; display: flex; align-items: center;
  padding: 0 clamp(9px, 1.1vw, 15px); background: none; border: none; cursor: pointer;
  font-size: 15px; font-weight: 600; color: ${SITE.sage}; white-space: nowrap;
  transition: color 140ms ease;
}
.tn-link:hover { color: ${SITE.bone}; }
.tn-link.is-active {
  color: ${SITE.emberInk}; font-weight: 800; background: ${SITE.ember};
  padding-bottom: 9px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 9px), 0 100%);
}
.tn-dot { position: absolute; top: 16px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: ${SITE.sun}; }
.tn-tools { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tn-tools > div button, .tn-tools > button:not(.tn-play) {
  background: transparent !important; border-color: rgba(159,196,180,0.3) !important; color: ${SITE.bone} !important; box-shadow: none !important;
}
.tn-play {
  margin-left: 6px; padding: 10px 22px; border: none; cursor: pointer;
  background: ${SITE.ember}; color: ${SITE.emberInk}; font-size: 15px; font-weight: 800;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: background 140ms ease, transform 140ms ease;
}
.tn-play:hover { background: ${SITE.emberHi}; transform: translateY(-1px); }
.tn-play:active { transform: translateY(1px); }
@media (max-width: 860px) {
  .tn { flex-wrap: wrap; padding-top: 8px; }
  .tn-brand { min-height: 44px; }
  .tn-tools { margin-left: auto; }
  .tn-links { order: 3; flex-basis: 100%; min-height: 44px; margin: 4px -14px 0; padding: 0 6px; }
}
`;
