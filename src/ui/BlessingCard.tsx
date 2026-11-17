import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { PALETTE } from "@/rendering/theme";
import { WAVE_ELEMENTS, type WaveElement } from "@/config/waveElements";

const COLORS: Record<WaveElement, string> = { FIRE: "#ff7a2a", ICE: "#8fe6ff", STORM: "#c49bff", NATURE: "#9adf6a" };

/**
 * BÊNÇÃO ELEMENTAL — offered every 5 waves cleared: pick one element and its
 * towers hit harder for the next 5 waves. Never blocks the game: it can be
 * folded away ("Later") and reopened from the small tab it leaves behind.
 */
export function BlessingCard({ onChoose }: { onChoose: (el: WaveElement) => void }) {
  const { t } = useLanguage();
  const [folded, setFolded] = useState(false);
  if (folded)
    return (
      <button type="button" onClick={() => setFolded(false)} style={{ ...wrap, padding: "6px 12px", cursor: "pointer", color: PALETTE.uiText, fontWeight: 700, fontSize: 12 }}>
        ✦ {t("blessing.title")}
      </button>
    );
  return (
    <div style={{ ...wrap, padding: "10px 12px", width: 300 }} data-testid="blessing-card">
      <div style={{ fontSize: 13, fontWeight: 800, color: PALETTE.uiText }}>✦ {t("blessing.title")}</div>
      <div style={{ fontSize: 11, color: PALETTE.uiTextDim, marginTop: 3, lineHeight: 1.35 }}>{t("blessing.lead")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        {WAVE_ELEMENTS.map((el) => (
          <button
            key={el}
            type="button"
            onClick={() => onChoose(el)}
            style={{ padding: "7px 6px", borderRadius: 6, border: `1px solid ${COLORS[el]}`, background: `${COLORS[el]}22`, color: PALETTE.uiText, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ fontWeight: 800, fontSize: 12, color: COLORS[el] }}>{t(`hud.element.names.${el}` as TranslationKey)}</div>
            <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{t(`blessing.towers.${el}` as TranslationKey)} +15%</div>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setFolded(true)} style={{ marginTop: 7, background: "none", border: "none", color: PALETTE.uiTextDim, fontSize: 11, cursor: "pointer", padding: 0 }}>
        {t("blessing.later")}
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "absolute",
  left: 16,
  top: 132,
  zIndex: 30,
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(20,14,10,0.92)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
};
