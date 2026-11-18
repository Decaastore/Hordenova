import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { GARRISON_DPS_PCT_PER_LEVEL, GARRISON_HUNT_FACTOR, GARRISON_MAX_LEVEL, GARRISON_STUN_MS, garrisonSoldiers } from "@/config/garrison";
import { Medallion } from "./gameIcons";

interface GarrisonPanelProps {
  level: number;
  nextCost: number | null;
  gold: number;
  mode: "SEASON" | "ETERNAL" | "HUNT";
  onUpgrade: () => void;
  onClose: () => void;
}

/**
 * GUARNIÇÃO — the castle's soldiers: what they do (only Bosses and
 * Mini-Bosses near the gate), how strong they are now and at the next
 * level, and the Gold to raise them.
 */
export function GarrisonPanel({ level, nextCost, gold, mode, onUpgrade, onClose }: GarrisonPanelProps) {
  const { t, language } = useLanguage();
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const pct = (l: number) => (GARRISON_DPS_PCT_PER_LEVEL * l * (mode === "HUNT" ? GARRISON_HUNT_FACTOR : 1)).toLocaleString(language === "ptBR" ? "pt-BR" : "en-US", { maximumFractionDigits: 2 });
  const canPay = nextCost !== null && gold >= nextCost;

  return (
    <div className="hn-pop" style={panel} role="dialog" aria-label={t("garrison.title")} data-testid="garrison-panel">
      <style>{CSS}</style>
      <button onClick={onClose} style={close} aria-label={t("garrison.close")}>
        ×
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Medallion name="swords" color="#7a8a9a" size={56} />
        <div>
          <div style={title}>{t("garrison.title")}</div>
          <div style={{ fontSize: 12, color: PALETTE.uiTextDim }}>{t("garrison.level", { n: level, max: GARRISON_MAX_LEVEL })}</div>
        </div>
      </div>
      <div style={lead}>{t("garrison.lead")}</div>

      <div className="gar-ranks" aria-hidden="true">
        {Array.from({ length: GARRISON_MAX_LEVEL }, (_, i) => (
          <span key={i} className={`gar-pip${i < level ? " is-on" : ""}`} />
        ))}
      </div>

      <div style={grid}>
        <Stat label={t("garrison.soldiers")} now={String(garrisonSoldiers(level))} next={nextCost !== null ? String(garrisonSoldiers(level + 1)) : null} />
        <Stat label={t("garrison.damage")} now={t("garrison.damageValue", { pct: pct(level) })} next={nextCost !== null ? t("garrison.damageValue", { pct: pct(level + 1) }) : null} />
      </div>

      <ul style={rules}>
        <li>{t("garrison.ruleTargets")}</li>
        <li>{t("garrison.ruleRange")}</li>
        <li>{t("garrison.ruleStun", { s: GARRISON_STUN_MS / 1000 })}</li>
        <li>{mode === "ETERNAL" ? t("garrison.ruleEternal") : mode === "HUNT" ? t("garrison.ruleHunt", { pct: Math.round(GARRISON_HUNT_FACTOR * 100) }) : t("garrison.ruleSeason")}</li>
      </ul>

      {mode === "HUNT" ? (
        <div style={{ fontSize: 11.5, color: PALETTE.uiTextDim, marginTop: 10 }}>{t("garrison.huntNoUpgrade")}</div>
      ) : nextCost !== null ? (
        <button className="gar-up" onClick={onUpgrade} disabled={!canPay} data-testid="garrison-upgrade">
          {t("garrison.upgrade", { n: level + 1 })} · <span style={{ color: canPay ? "#ffd27a" : "#e8a090" }}>🪙 {fmt(nextCost)}</span>
        </button>
      ) : (
        <div style={{ fontSize: 12, fontWeight: 800, color: PALETTE.uiAccentBright, marginTop: 10 }}>{t("garrison.maxed")}</div>
      )}
    </div>
  );
}

function Stat({ label, now, next }: { label: string; now: string; next: string | null }) {
  return (
    <div style={stat}>
      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>
        {now}
        {next && <span style={{ fontSize: 12, color: "#9ad07a", marginLeft: 6 }}>→ {next}</span>}
      </div>
    </div>
  );
}

const CSS = `
.gar-ranks{display:flex;gap:4px;margin:12px 0 4px}
.gar-pip{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.1)}
.gar-pip.is-on{background:linear-gradient(90deg,#9aa8b8,#e8eef4);box-shadow:0 0 6px rgba(200,220,240,.4)}
.gar-up{margin-top:12px;width:100%;padding:10px 14px;border-radius:9px;border:1px solid #c8b080;background:linear-gradient(180deg,#5a4a30,#2e2416);color:#fff2d0;font-weight:800;font-size:13px;cursor:pointer}
.gar-up:hover:not(:disabled){filter:brightness(1.2)}
.gar-up:disabled{opacity:.55;cursor:not-allowed}
`;

const panel: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  width: 420,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 18px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(40,44,52,0.98), rgba(18,18,22,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 14px 36px rgba(0,0,0,0.6)",
  zIndex: 30,
};
const close: CSSProperties = { position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const title: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 700, color: "#e8eef4" };
const lead: CSSProperties = { fontSize: 12, color: PALETTE.uiTextDim, marginTop: 10, lineHeight: 1.5 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 };
const stat: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.25)" };
const rules: CSSProperties = { margin: "10px 0 0", paddingLeft: 18, fontSize: 11.5, lineHeight: 1.55, color: PALETTE.uiText };
