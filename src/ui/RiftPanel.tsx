import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import {
  MAX_RIFT_CHARGES,
  RIFT_BASE_GOLD_SHARE,
  RIFT_CHARGE_EVERY,
  RIFT_DROP_TABLE_ID,
  RIFT_MODS,
  riftReward,
  riftRewardPct,
  type RiftModId,
} from "@/config/rifts";
import { getDropTable } from "@/config/dropTables";
import { DropTableView } from "./DropTableView";

interface RiftPanelProps {
  charges: number;
  armed: readonly RiftModId[] | null;
  active: { wave: number; mods: readonly RiftModId[] } | null;
  onOpen: (mods: RiftModId[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

/** FENDAS — choose the curses for your next regular wave and see exactly what clearing it pays (config/rifts.ts). */
export function RiftPanel({ charges, armed, active, onOpen, onCancel, onClose }: RiftPanelProps) {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<RiftModId[]>(armed ? [...armed] : ["HASTE"]);
  const [showTable, setShowTable] = useState(false);
  const mods = armed ?? active?.mods ?? picked;
  const pct = riftRewardPct(mods);
  const reward = riftReward(mods, 100);
  const table = getDropTable(RIFT_DROP_TABLE_ID);
  const locked = !!armed || !!active;

  return (
    <div style={panelStyle} role="dialog" aria-label={t("rift.title")} data-testid="rift-panel">
      <button onClick={onClose} style={closeStyle} aria-label={t("rift.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("rift.title")}</div>
      <div style={subStyle}>{t("rift.lead")}</div>

      <div style={chargeRowStyle}>
        <span>{t("rift.charges")}</span>
        <span style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: MAX_RIFT_CHARGES }, (_, i) => (
            <span key={i} style={{ ...chargePip, background: i < charges ? "#b47cff" : "rgba(255,255,255,0.1)", boxShadow: i < charges ? "0 0 8px #b47cff" : "none" }} />
          ))}
        </span>
      </div>
      <div style={{ ...subStyle, marginTop: 4 }}>{t("rift.chargeRule", { n: RIFT_CHARGE_EVERY, max: MAX_RIFT_CHARGES })}</div>

      <div style={sectionLabel}>{t("rift.curses")}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {RIFT_MODS.map((m) => {
          const on = mods.includes(m.id);
          return (
            <button
              key={m.id}
              disabled={locked}
              onClick={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))}
              style={{ ...modStyle, borderColor: on ? "#b47cff" : PALETTE.uiPanelBorder, background: on ? "rgba(180,124,255,0.14)" : "rgba(0,0,0,0.22)", cursor: locked ? "default" : "pointer" }}
              aria-pressed={on}
              data-testid={`rift-mod-${m.id}`}
            >
              <span style={{ ...checkStyle, background: on ? "#b47cff" : "transparent" }}>{on ? "✓" : ""}</span>
              <span style={{ minWidth: 0, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: PALETTE.uiText }}>{t(`rift.mods.${m.id}.name` as TranslationKey)}</span>
                <span style={{ display: "block", fontSize: 10.5, color: PALETTE.uiTextDim, lineHeight: 1.3 }}>{t(`rift.mods.${m.id}.desc` as TranslationKey)}</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#d5b3ff", whiteSpace: "nowrap" }}>+{m.rewardPct}%</span>
            </button>
          );
        })}
      </div>

      <div style={rewardBox}>
        <div style={{ fontWeight: 700, color: "#e3cdff" }}>{t("rift.rewardTitle", { pct })}</div>
        <div>{t("rift.rewardShards", { n: reward.shards })}</div>
        <div>{t("rift.rewardGold", { pct: Math.round(RIFT_BASE_GOLD_SHARE * (1 + pct / 100) * 100) })}</div>
        <div>{t("rift.rewardItems", { n: reward.itemRolls })}</div>
        {table && (
          <button onClick={() => setShowTable((v) => !v)} style={linkStyle}>
            {t("rift.viewTable")}
          </button>
        )}
        {showTable && table && (
          <div style={{ marginTop: 6 }}>
            <DropTableView table={table} />
          </div>
        )}
      </div>

      {active ? (
        <div style={stateStyle}>{t("rift.activeNow", { wave: active.wave })}</div>
      ) : armed ? (
        <>
          <div style={stateStyle}>{t("rift.armed")}</div>
          <button onClick={onCancel} style={secondaryBtn} data-testid="rift-cancel">
            {t("rift.cancel")}
          </button>
        </>
      ) : (
        <button
          onClick={() => onOpen(picked)}
          disabled={charges <= 0}
          style={{ ...primaryBtn, opacity: charges > 0 ? 1 : 0.5, cursor: charges > 0 ? "pointer" : "default" }}
          data-testid="rift-open"
        >
          {charges > 0 ? t("rift.open") : t("rift.noCharge")}
        </button>
      )}
      <div style={{ ...subStyle, marginTop: 8 }}>{t("rift.rules")}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 320,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: "1px solid rgba(180,124,255,0.45)",
  background: "linear-gradient(160deg, rgba(40,24,52,0.98), rgba(20,12,28,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 24px rgba(140,80,220,0.18)",
  zIndex: 30,
};
const closeStyle: CSSProperties = { position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const titleStyle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, letterSpacing: 0.5, color: "#e3cdff" };
const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 4, lineHeight: 1.45 };
const sectionLabel: CSSProperties = { fontSize: 10, letterSpacing: 1.2, color: PALETTE.uiTextDim, textTransform: "uppercase", margin: "12px 0 6px" };
const chargeRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12.5, fontWeight: 700 };
const chargePip: CSSProperties = { width: 12, height: 12, borderRadius: 3, transform: "rotate(45deg)", display: "inline-block", margin: "0 3px" };
const modStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid", color: "inherit", font: "inherit" };
const checkStyle: CSSProperties = { width: 16, height: 16, flex: "none", borderRadius: 4, border: "1px solid #b47cff", color: "#1a0f24", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
const rewardBox: CSSProperties = { marginTop: 12, padding: "9px 11px", borderRadius: 8, background: "rgba(180,124,255,0.1)", border: "1px solid rgba(180,124,255,0.35)", fontSize: 12, display: "grid", gap: 3 };
const linkStyle: CSSProperties = { justifySelf: "start", background: "none", border: "none", color: "#d5b3ff", textDecoration: "underline", fontSize: 11, cursor: "pointer", padding: 0, marginTop: 2 };
const stateStyle: CSSProperties = { marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "#e3cdff" };
const primaryBtn: CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #b47cff",
  background: "linear-gradient(180deg, #6a3aa8, #432270)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
};
const secondaryBtn: CSSProperties = { ...primaryBtn, background: "rgba(0,0,0,0.3)", border: `1px solid ${PALETTE.uiPanelBorder}`, color: PALETTE.uiText, cursor: "pointer" };
