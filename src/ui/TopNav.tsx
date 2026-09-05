import type { CSSProperties, ReactNode } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";

export type NavView = "HOME" | "SEASON" | "RANKING" | "WIKI" | "NOVIDADES";

interface TopNavProps {
  active: NavView;
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
  /** Optional utility controls (LanguageSelector/MusicControl) rendered at the far right — only the Home screen currently uses this, so other screens stay unchanged. */
  rightSlot?: ReactNode;
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
export function TopNav({ active, onNavigate, onPlay, rightSlot }: TopNavProps) {
  const { t } = useLanguage();

  return (
    <nav style={navStyle}>
      <button style={brandStyle} onClick={() => onNavigate("HOME")} aria-label={t("nav.home")}>
        HORDENOVA
      </button>
      <div style={linksStyle}>
        <button style={playLinkStyle} onClick={onPlay}>
          {t("nav.play")}
        </button>
        <NavLink label={t("nav.season")} isActive={active === "SEASON"} onClick={() => onNavigate("SEASON")} />
        <NavLink label={t("nav.ranking")} isActive={active === "RANKING"} onClick={() => onNavigate("RANKING")} />
        <NavLink label={t("nav.wiki")} isActive={active === "WIKI"} onClick={() => onNavigate("WIKI")} />
        <NavLink label={t("nav.novidades")} isActive={active === "NOVIDADES"} onClick={() => onNavigate("NOVIDADES")} />
        {rightSlot && <div style={rightSlotStyle}>{rightSlot}</div>}
      </div>
    </nav>
  );
}

function NavLink({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...linkStyle,
        color: isActive ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
        borderBottomColor: isActive ? PALETTE.uiAccent : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.color = PALETTE.uiAccentBright;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.color = PALETTE.uiTextDim;
      }}
    >
      {label}
    </button>
  );
}

const navStyle: CSSProperties = {
  position: "relative",
  zIndex: 5,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  rowGap: 8,
  padding: "14px 20px",
  background: "linear-gradient(180deg, rgba(20,14,7,0.82), rgba(20,14,7,0.4) 80%, transparent)",
  boxSizing: "border-box",
  width: "100%",
  flexShrink: 0,
};

const brandStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 14px ${PALETTE.uiAccent}88`,
  padding: 0,
};

const linksStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "clamp(12px, 2vw, 26px)",
};

const linkStyle: CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  padding: "6px 2px",
  transition: "color 140ms ease, border-color 140ms ease",
};

const playLinkStyle: CSSProperties = {
  ...linkStyle,
  borderBottom: "none",
  color: "#3a2408",
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  padding: "8px 18px",
  borderRadius: 8,
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};

const rightSlotStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginLeft: "clamp(4px, 1vw, 10px)",
};
