import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PATCH_NOTES, type PatchNoteType } from "@/config/patchNotes";

interface NovidadesScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const TYPE_COLOR: Record<PatchNoteType, string> = {
  NEW: PALETTE.success,
  CHANGE: PALETTE.uiAccent,
  FIX: PALETTE.danger,
  BALANCE: PALETTE.gem,
  REMOVAL: PALETTE.uiTextDim,
};

/**
 * Real, ongoing changelog — every item rendered here comes from
 * config/patchNotes.ts, which documents only changes that actually
 * shipped (cross-referenced against this repo's own commit history).
 * Spec: "Não inventar histórico."
 */
export function NovidadesScreen({ onNavigate, onPlay }: NovidadesScreenProps) {
  const { t } = useLanguage();

  return (
    <div style={rootStyle}>
      <TopNav active="NOVIDADES" onNavigate={onNavigate} onPlay={onPlay} />
      <div style={bodyStyle}>
        <h1 style={titleStyle}>{t("novidades.title")}</h1>
        <p style={subtitleStyle}>{t("novidades.subtitle")}</p>

        {PATCH_NOTES.map((version, index) => (
          <section key={version.id} style={versionStyle}>
            <div style={versionHeaderStyle}>
              <span style={versionIdStyle}>{version.id}</span>
              {index === 0 && <span style={latestBadgeStyle}>{t("novidades.latest")}</span>}
              {version.dateIso && <span style={dateStyle}>{version.dateIso}</span>}
            </div>
            <ul style={itemListStyle}>
              {version.items.map((item) => (
                <li key={item.i18nKey} style={itemRowStyle}>
                  <span style={{ ...typeChipStyle, color: TYPE_COLOR[item.type], borderColor: TYPE_COLOR[item.type] }}>
                    {t(`novidades.types.${item.type}` as TranslationKey)}
                  </span>
                  <span style={categoryChipStyle}>{t(`novidades.categories.${item.category}` as TranslationKey)}</span>
                  <span style={itemTextStyle}>{t(`novidades.entries.${version.id}.${item.i18nKey}` as TranslationKey)}</span>
                </li>
              ))}
            </ul>
          </section>
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

const versionStyle: CSSProperties = {
  marginBottom: 30,
  paddingBottom: 20,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
};

const versionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const versionIdStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  fontWeight: 700,
  color: PALETTE.gold,
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

const dateStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
};

const itemListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const itemRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  fontSize: 13,
  lineHeight: 1.5,
  flexWrap: "wrap",
};

const typeChipStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid",
};

const categoryChipStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 9.5,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const itemTextStyle: CSSProperties = {
  color: PALETTE.uiText,
};
