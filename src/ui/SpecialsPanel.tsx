import { useEffect, useState, type CSSProperties } from "react";
import type { GameEngine, HudSnapshot } from "@/engine/GameEngine";
import { MANA_MAX, MANA_OVERCHARGE_MAX } from "@/config/towerMana";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TowerType } from "@/config/towerStats";

interface SpecialsPanelProps {
  engine: GameEngine;
  hud: HudSnapshot;
}

interface Pip {
  id: string;
  type: TowerType;
  mana: number;
  overcharged: boolean;
}

/**
 * TOWER MANA (config/towerMana.ts) — the specials control in the bottom bar.
 * One mana gauge per tower, a count of the ones ready, and a single
 * fixed-size button: HOLD keeps every special charging past full (up to +50%
 * damage), RELEASE ALL fires them together. Always mounted with the same
 * size, so the bar (and the map above it) never resizes when it changes
 * state; outside a wave or boss fight it is simply disabled. "E" on the
 * keyboard does the same as the button.
 */
export function SpecialsPanel({ engine, hud }: SpecialsPanelProps) {
  const { t } = useLanguage();
  const [pips, setPips] = useState<Pip[]>([]);

  useEffect(() => {
    const read = () => {
      const towers = engine.getRenderSnapshot().towers;
      setPips(
        [...towers]
          .sort((a, b) => a.slotId.localeCompare(b.slotId, undefined, { numeric: true }))
          .map((tw) => ({ id: tw.id, type: tw.type, mana: Math.round(tw.mana), overcharged: tw.overcharged })),
      );
    };
    read();
    const timer = window.setInterval(read, 150);
    return () => window.clearInterval(timer);
  }, [engine]);

  const fighting = hud.phase === "RUNNING" || hud.phase === "BOSS_INTRO" || hud.phase === "BOSS_BATTLE";
  const held = hud.specialsHeld;
  const boss = hud.phase === "BOSS_INTRO" || hud.phase === "BOSS_BATTLE";
  const ready = pips.filter((p) => p.mana >= MANA_MAX).length;
  const charged = pips.filter((p) => p.mana >= MANA_MAX);
  const avgOvercharge = charged.length ? charged.reduce((a, p) => a + (p.overcharged ? Math.min(MANA_OVERCHARGE_MAX, p.mana) - MANA_MAX : 0), 0) / charged.length / MANA_MAX : 0;

  const toggle = () => {
    if (held) engine.setSpecialsHeld(false);
    else if (fighting) engine.setSpecialsHeld(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "e" && event.key !== "E") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ ...panelStyle, opacity: fighting || held ? 1 : 0.55, borderColor: held ? "rgba(255,214,90,0.7)" : boss ? "rgba(255,214,140,0.45)" : PALETTE.uiPanelBorder }} data-testid="specials-panel">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <div style={headStyle}>
          <span style={titleStyle}>{t("specials.title")}</span>
          <span style={{ ...statusStyle, color: held ? PALETTE.gold : PALETTE.uiTextDim }}>
            {held ? t("specials.holding", { pct: Math.round(avgOvercharge * 100) }) : t("specials.ready", { n: ready, total: pips.length })}
          </span>
        </div>
        <div style={pipRowStyle} aria-hidden>
          {pips.map((p) => {
            const fill = Math.min(1, p.mana / MANA_MAX);
            const over = p.overcharged ? Math.max(0, Math.min(1, (p.mana - MANA_MAX) / (MANA_OVERCHARGE_MAX - MANA_MAX))) : 0;
            const theme = TOWER_THEME[p.type];
            return (
              <span key={p.id} style={pipStyle} title={t(`towers.${p.type}.name`)}>
                <span style={{ ...pipFillStyle, height: `${fill * 100}%`, background: fill >= 1 ? theme.accent : "#6f7dff", boxShadow: fill >= 1 ? `0 0 6px ${theme.glow}` : "none" }} />
                {over > 0 && <span style={{ ...pipFillStyle, height: `${over * 100}%`, background: "#ffd75e" }} />}
              </span>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={!fighting && !held}
        aria-pressed={held}
        title={t(held ? "hud.releaseSpecialsHint" : "hud.holdSpecialsHint")}
        data-testid="specials-button"
        style={{
          ...buttonStyle,
          cursor: fighting || held ? "pointer" : "default",
          color: held ? "#2b1906" : PALETTE.uiText,
          background: held ? "linear-gradient(180deg,#ffe58a,#e2ab32)" : "linear-gradient(180deg,#4a3520,#33240f)",
          borderColor: held ? "#fff0b8" : "rgba(255,214,140,0.45)",
        }}
      >
        <span>{held ? t("hud.releaseSpecials") : t("hud.holdSpecials")}</span>
        <span style={{ ...keyStyle, borderColor: held ? "rgba(43,25,6,0.45)" : "rgba(255,240,210,0.3)" }}>E</span>
      </button>
    </div>
  );
}

const panelStyle: CSSProperties = {
  marginLeft: "auto",
  width: 330,
  height: 54,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "7px 8px 7px 12px",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  background: "rgba(0,0,0,0.28)",
  flexShrink: 0,
};

const headStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
};

const titleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: PALETTE.uiText,
};

const statusStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const pipRowStyle: CSSProperties = {
  display: "flex",
  gap: 3,
  height: 16,
};

const pipStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  maxWidth: 12,
  borderRadius: 2,
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,214,140,0.18)",
  overflow: "hidden",
};

const pipFillStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  transition: "height 140ms linear",
};

const buttonStyle: CSSProperties = {
  width: 132,
  height: 38,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: "solid",
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: 0.6,
  whiteSpace: "nowrap",
};

const keyStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  padding: "1px 5px",
  borderRadius: 3,
  borderWidth: 1,
  borderStyle: "solid",
  opacity: 0.85,
};
