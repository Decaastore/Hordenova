import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PATCH_NOTES, type PatchNoteCategory } from "@/config/patchNotes";

interface NovidadesScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const CATEGORY_COLOR: Record<PatchNoteCategory, string> = {
  CONTENT: PALETTE.success,
  TOWERS: PALETTE.uiAccent,
  BOSSES: PALETTE.danger,
  CASTLE: PALETTE.gold,
  ITEMS: PALETTE.gem,
  ASCENSION: PALETTE.gem,
  INTERFACE: PALETTE.uiAccent,
  SYSTEMS: PALETTE.uiAccentBright,
  BALANCE: PALETTE.gold,
  FIXES: PALETTE.danger,
};

/**
 * Real, ongoing changelog — every entry rendered here comes straight from
 * config/patchNotes.ts, the single source of truth for both this screen
 * and the Home teaser (MainMenu.tsx). Each entry documents only a change
 * that actually shipped, already implemented/tested/validated before it
 * was added there (see patchNotes.ts's own header and CLAUDE.md's
 * "Novidades / Changelog" section for the exact contract). Spec: "Não
 * inventar histórico."
 */
export function NovidadesScreen({ onNavigate, onPlay }: NovidadesScreenProps) {
  const { t, language } = useLanguage();

  return (
    <div style={rootStyle}>
      <TopNav active="NOVIDADES" onNavigate={onNavigate} onPlay={onPlay} />
      <div style={bodyStyle}>
        <h1 style={titleStyle}>{t("novidades.title")}</h1>
        <p style={subtitleStyle}>{t("novidades.subtitle")}</p>

        {PATCH_NOTES.map((entry, index) => (
          <article key={entry.id} style={entryStyle}>
            <div style={entryHeaderStyle}>
              {entry.dateIso && <span style={dateStyle}>{entry.dateIso}</span>}
              {index === 0 && <span style={latestBadgeStyle}>{t("novidades.latest")}</span>}
              <span
                style={{
                  ...categoryChipStyle,
                  color: CATEGORY_COLOR[entry.category],
                  borderColor: CATEGORY_COLOR[entry.category],
                }}
              >
                {t(`novidades.categories.${entry.category}` as TranslationKey)}
              </span>
            </div>
            <h2 style={entryTitleStyle}>{entry.title[language]}</h2>
            <p style={entryDescriptionStyle}>{entry.description[language]}</p>
            {entry.highlights.length > 0 && (
              <ul style={highlightListStyle}>
                {entry.highlights.map((highlight, i) => (
                  <li key={i} style={highlightRowStyle}>
                    • {highlight[language]}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: `linear-gradient(180deg, #241a10, #150f09)`,
  color: PALETTE.uiText,
  overflow: "hidden",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 32px 60px",
  maxWidth: 780,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  color: PALETTE.uiAccentBright,
  margin: "0 0 4px",
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiTextDim,
  marginBottom: 28,
};

const entryStyle: CSSProperties = {
  marginBottom: 30,
  paddingBottom: 22,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
};

const entryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};

const dateStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const latestBadgeStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 5,
  background: PALETTE.success,
  color: "#0e2a0a",
};

const categoryChipStyle: CSSProperties = {
  marginLeft: "auto",
  flexShrink: 0,
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  padding: "1px 7px",
  borderRadius: 4,
  border: "1px solid",
};

const entryTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  fontWeight: 700,
  color: PALETTE.gold,
  margin: "0 0 8px",
};

const entryDescriptionStyle: CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.55,
  color: PALETTE.uiText,
  margin: "0 0 10px",
};

const highlightListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const highlightRowStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: PALETTE.uiTextDim,
};
