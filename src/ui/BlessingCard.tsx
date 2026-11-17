import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { PALETTE } from "@/rendering/theme";
import { BEATS, BLESSING_MULT, BLESSING_WAVES, WAVE_ELEMENTS, counterOf, type WaveElement } from "@/config/waveElements";

export const ELEMENT_UI_COLOR: Record<WaveElement, string> = { FIRE: "#ff7a2a", ICE: "#8fe6ff", STORM: "#c49bff", NATURE: "#9adf6a" };
export const ELEMENT_GLYPH: Record<WaveElement, string> = { FIRE: "🔥", ICE: "❄", STORM: "⚡", NATURE: "🌿" };

/** One upcoming wave as the card shows it: its number and its element (null = boss or plain wave). */
export interface UpcomingWave {
  wave: number;
  element: WaveElement | null;
}

function Badge({ el, size = 22 }: { el: WaveElement; size?: number }) {
  const c = ELEMENT_UI_COLOR[el];
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.58,
        background: `radial-gradient(circle at 35% 30%, ${c}66, ${c}22 70%)`,
        border: `1.5px solid ${c}`,
        boxShadow: `0 0 8px ${c}55`,
      }}
    >
      {ELEMENT_GLYPH[el]}
    </span>
  );
}

/**
 * BÊNÇÃO ELEMENTAL — offered every 5 waves cleared: pick one element and its
 * towers hit harder for the next 5 waves. So the choice is an informed one,
 * the card shows the elements of the coming waves, the cycle of who beats
 * whom, how many towers of each element the player has, and on how many of
 * the coming waves each element is the strong one. Never blocks the game: it
 * can be folded away ("Later") and reopened from the small tab it leaves.
 */
export function BlessingCard({
  onChoose,
  upcoming,
  towerCounts,
}: {
  onChoose: (el: WaveElement) => void;
  upcoming: readonly UpcomingWave[];
  towerCounts: Record<WaveElement, number>;
}) {
  const { t } = useLanguage();
  const [folded, setFolded] = useState(false);
  const name = (el: WaveElement) => t(`hud.element.names.${el}` as TranslationKey);
  const bonus = Math.round((BLESSING_MULT - 1) * 100);

  if (folded)
    return (
      <button type="button" onClick={() => setFolded(false)} style={{ ...wrap, padding: "6px 12px", cursor: "pointer", color: PALETTE.uiText, fontWeight: 700, fontSize: 12 }}>
        ✦ {t("blessing.title")}
      </button>
    );

  return (
    <div style={{ ...wrap, padding: "10px 12px", width: 330 }} data-testid="blessing-card">
      <div style={{ fontSize: 13, fontWeight: 800, color: PALETTE.uiText }}>✦ {t("blessing.title")}</div>
      <div style={{ fontSize: 11, color: PALETTE.uiTextDim, marginTop: 3, lineHeight: 1.35 }}>{t("blessing.lead")}</div>

      {/* the coming waves, so the player sees which element they will face */}
      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 8 }}>{t("blessing.upcoming")}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }} data-testid="blessing-upcoming">
        {upcoming.map(({ wave, element }) => (
          <div
            key={wave}
            title={element ? name(element) : t("blessing.noElement")}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "4px 0",
              borderRadius: 6,
              background: element ? `${ELEMENT_UI_COLOR[element]}14` : "rgba(255,255,255,0.03)",
              border: `1px solid ${element ? `${ELEMENT_UI_COLOR[element]}55` : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {element ? (
              <Badge el={element} size={20} />
            ) : (
              <span style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", color: PALETTE.uiTextDim, fontSize: 11 }}>—</span>
            )}
            <span style={{ fontSize: 9.5, color: PALETTE.uiTextDim }}>{t("blessing.wave", { wave })}</span>
          </div>
        ))}
      </div>

      {/* the cycle: who beats whom */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 8, fontSize: 10, color: PALETTE.uiTextDim }} title={t("blessing.cycle")}>
        {(["FIRE", "NATURE", "STORM", "ICE", "FIRE"] as const).map((el, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <span aria-hidden="true">›</span>}
            <Badge el={el} size={16} />
          </span>
        ))}
        <span style={{ marginLeft: 4 }}>{t("blessing.cycleShort")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        {WAVE_ELEMENTS.map((el) => {
          const strong = upcoming.filter((u) => u.element && counterOf(u.element) === el).length;
          const owned = towerCounts[el] ?? 0;
          return (
            <button
              key={el}
              type="button"
              onClick={() => onChoose(el)}
              data-element={el}
              style={{
                padding: "7px 7px",
                borderRadius: 6,
                border: `1px solid ${ELEMENT_UI_COLOR[el]}`,
                background: `${ELEMENT_UI_COLOR[el]}1f`,
                color: PALETTE.uiText,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
              }}
            >
              <Badge el={el} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 800, fontSize: 12, color: ELEMENT_UI_COLOR[el] }}>{name(el)}</span>
                <span style={{ display: "block", fontSize: 10.5, color: PALETTE.uiText }}>
                  {t(`blessing.towers.${el}` as TranslationKey)} +{bonus}%
                </span>
                <span style={{ display: "block", fontSize: 9.5, color: owned > 0 ? PALETTE.uiTextDim : "#ff8a7a" }}>{t("blessing.owned", { count: owned })}</span>
                <span style={{ display: "block", fontSize: 9.5, color: strong > 0 ? "#9ef08a" : PALETTE.uiTextDim }}>
                  {t("blessing.strongOn", { count: strong, total: upcoming.length, beats: name(BEATS[el]) })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
        <button type="button" onClick={() => setFolded(true)} style={{ background: "none", border: "none", color: PALETTE.uiTextDim, fontSize: 11, cursor: "pointer", padding: 0 }}>
          {t("blessing.later")}
        </button>
        <span style={{ fontSize: 9.5, color: PALETTE.uiTextDim }}>{t("blessing.lasts", { waves: BLESSING_WAVES })}</span>
      </div>
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
  background: "rgba(20,14,10,0.94)",
  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
};
