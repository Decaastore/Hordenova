import { useEffect, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";

interface AscensionPanelProps {
  onClose: () => void;
}

/**
 * Master Implementation spec sections 19-22 — minimal Top 5 / Collection /
 * History views, plus the permanent profile records (section 21). All data
 * here comes straight from the PERMANENT (Infinite) SaveData's ascension*
 * fields (see SaveSystem.ts) — nothing fabricated, nothing simulated.
 *
 * The Collection checklist is deliberately scoped to each played season's
 * CHAMPION-tier (rank 1) bundle rather than all 5 ranks — a real, honest
 * "own vs. missing" checklist for the account's actual history, sized for
 * a first pass; extending it to every rank is a data-only change (iterate
 * ranks 1-5 per season instead of just rank 1), not an architecture one.
 */
export function AscensionPanel({ onClose }: AscensionPanelProps) {
  const { t } = useLanguage();
  const save = loadSave();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const historyDesc = [...save.ascensionHistory].sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>

        <div style={recordsRowStyle}>
          <Record label={t("ascension.records.seasonsWon")} value={save.ascensionSeasonsWon} />
          <Record label={t("ascension.records.top3")} value={save.ascensionTop3} />
          <Record label={t("ascension.records.top5")} value={save.ascensionTop5} />
        </div>

        <div style={sectionTitleStyle}>{t("ascension.topFive.title")}</div>
        <div style={honestNoteStyle}>{t("ascension.topFive.honestNote")}</div>

        <div style={sectionTitleStyle}>{t("ascension.history.title")}</div>
        {historyDesc.length === 0 ? (
          <div style={emptyStyle}>{t("ascension.history.empty")}</div>
        ) : (
          <div style={listStyle}>
            {historyDesc.map((entry) => (
              <div key={entry.seasonNumber} style={historyRowStyle}>
                <div>
                  <div style={historySeasonStyle}>
                    {t(`ascension.seasonThemes.${entry.seasonThemeNameKey}` as TranslationKey)} — S{entry.seasonNumber}
                  </div>
                  <div style={historyWaveStyle}>{entry.bestWave}</div>
                </div>
                <div style={{ ...historyRankStyle, color: entry.rank !== null ? PALETTE.gold : PALETTE.uiTextDim }}>
                  {entry.rank !== null ? t("ascension.history.rank", { rank: entry.rank }) : t("ascension.history.didNotParticipate")}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={sectionTitleStyle}>{t("ascension.collection.title")}</div>
        {historyDesc.length === 0 ? (
          <div style={emptyStyle}>{t("ascension.collection.empty")}</div>
        ) : (
          <div style={listStyle}>
            {historyDesc.map((entry) => {
              const rank: AscensionRank = 1;
              const bundle = getSeasonRewardBundle(entry.seasonNumber, rank);
              const owned = entry.rank === 1;
              return (
                <div key={entry.seasonNumber} style={collectionSeasonStyle}>
                  <div style={historySeasonStyle}>
                    {/* Uses the entry's OWN recorded theme (not a fresh getSeasonTheme() recomputation) so this label always agrees with the History section above for the same season — the ground truth is what was recorded at finalization time. */}
                    {t(`ascension.seasonThemes.${entry.seasonThemeNameKey}` as TranslationKey)} — S{entry.seasonNumber} ({t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)})
                  </div>
                  <div style={cosmeticGridStyle}>
                    {bundle.cosmetics.map((c) => (
                      <div key={c.id} style={{ ...cosmeticChipStyle, opacity: owned ? 1 : 0.45 }}>
                        {t(`ascension.cosmeticTypes.${c.type}` as TranslationKey)}
                        {owned && <span style={ownedTagStyle}>{t("ascension.collection.owned")}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Record({ label, value }: { label: string; value: number }) {
  return (
    <div style={recordStyle}>
      <div style={recordValueStyle}>{value}</div>
      <div style={recordLabelStyle}>{label}</div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,7,4,0.8)",
  zIndex: 8,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 480,
  maxWidth: "92%",
  maxHeight: "84%",
  overflowY: "auto",
  padding: "22px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.gem}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 14,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 20,
  cursor: "pointer",
};

const recordsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-around",
  marginBottom: 18,
  paddingBottom: 14,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
};

const recordStyle: CSSProperties = {
  textAlign: "center",
};

const recordValueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: PALETTE.gold,
};

const recordLabelStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 1.4,
  color: PALETTE.uiAccentBright,
  marginTop: 16,
  marginBottom: 8,
};

const honestNoteStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
};

const emptyStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const historyRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.22)",
};

const historySeasonStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiText,
};

const historyWaveStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const historyRankStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
};

const collectionSeasonStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.22)",
};

const cosmeticGridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 6,
};

const cosmeticChipStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 6,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  fontSize: 9.5,
  color: PALETTE.uiText,
};

const ownedTagStyle: CSSProperties = {
  color: PALETTE.success,
  fontWeight: 700,
};
