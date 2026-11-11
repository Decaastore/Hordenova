import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import {
  canRaiseTalent,
  TALENT_BRANCHES,
  TALENTS,
  talentPointsEarned,
  talentRequirement,
  WAVES_PER_TALENT_POINT,
  type TalentBranch,
  type TalentId,
  type TalentRanks,
  type TalentStat,
} from "@/config/talents";

interface TalentPanelProps {
  ranks: Readonly<TalentRanks>;
  free: number;
  seasonBestWave: number;
  onRaise: (id: TalentId) => void;
  onReset: () => void;
  onClose: () => void;
}

type T = ReturnType<typeof useLanguage>["t"];

/** "+3% tower damage" / "−2% gold per enemy" — sign first, value, then what it changes. */
function statLine(t: T, stat: TalentStat, value: number): string {
  const v = Math.round(Math.abs(value) * 10) / 10;
  return `${value >= 0 ? "+" : "−"}${v}% ${t(`talents.stat.${stat}` as TranslationKey)}`;
}

const BRANCH_COLOR: Record<TalentBranch, string> = { WAR: "#e0644b", GOLD: "#e8c15a", WALL: "#7fb6ff" };

/** ÁRVORE DE TALENTOS — three paths, one point every 10 waves of the Season record (config/talents.ts). */
export function TalentPanel({ ranks, free, seasonBestWave, onRaise, onReset, onClose }: TalentPanelProps) {
  const { t } = useLanguage();
  const earned = talentPointsEarned(seasonBestWave);
  const nextAt = (Math.floor(seasonBestWave / WAVES_PER_TALENT_POINT) + 1) * WAVES_PER_TALENT_POINT;

  return (
    <div style={panelStyle} role="dialog" aria-label={t("talents.title")} data-testid="talent-panel">
      <button onClick={onClose} style={closeStyle} aria-label={t("talents.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("talents.title")}</div>
      <div style={subStyle}>{t("talents.lead", { n: WAVES_PER_TALENT_POINT })}</div>
      <div style={headerRow}>
        <span style={{ fontWeight: 700 }}>
          {t("talents.free", { n: free })} <span style={{ color: PALETTE.uiTextDim, fontWeight: 400 }}>{t("talents.earned", { n: earned, wave: nextAt })}</span>
        </span>
        <button onClick={onReset} style={resetBtn} data-testid="talent-reset" title={t("talents.resetHint")}>
          {t("talents.reset")}
        </button>
      </div>

      <div style={gridStyle}>
        {TALENT_BRANCHES.map((branch) => (
          <div key={branch} style={columnStyle}>
            <div style={{ ...branchTitle, color: BRANCH_COLOR[branch] }}>{t(`talents.branches.${branch}` as TranslationKey)}</div>
            {TALENTS.filter((d) => d.branch === branch)
              .sort((a, b) => a.tier - b.tier)
              .map((d, i, list) => {
                const rank = ranks[d.id] ?? 0;
                const req = talentRequirement(d.id);
                const locked = req !== null && !(ranks[req] ?? 0);
                const can = canRaiseTalent(ranks, d.id, seasonBestWave);
                const color = BRANCH_COLOR[branch];
                return (
                  <div key={d.id} style={{ display: "grid", justifyItems: "stretch" }}>
                    <button
                      onClick={() => can && onRaise(d.id)}
                      disabled={!can}
                      style={{
                        ...nodeStyle,
                        borderColor: rank > 0 ? color : PALETTE.uiPanelBorder,
                        background: rank > 0 ? `linear-gradient(180deg, ${color}22, rgba(0,0,0,0.3))` : "rgba(0,0,0,0.25)",
                        opacity: locked ? 0.45 : 1,
                        cursor: can ? "pointer" : "default",
                        boxShadow: can ? `0 0 0 1px ${color}55, 0 0 12px ${color}33` : "none",
                      }}
                      title={locked ? t("talents.locked") : undefined}
                      data-testid={`talent-${d.id}`}
                    >
                      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: PALETTE.uiText, textAlign: "left" }}>
                          {locked && <span aria-hidden="true">🔒 </span>}
                          {t(`talents.nodes.${d.id}.name` as TranslationKey)}
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: rank > 0 ? color : PALETTE.uiTextDim, whiteSpace: "nowrap" }}>
                          {rank}/{d.maxRank}
                        </span>
                      </span>
                      <span style={{ fontSize: 10.5, lineHeight: 1.35, textAlign: "left", color: "#9fe08a" }}>{statLine(t, d.stat, d.perRank)}</span>
                      <span style={{ fontSize: 10.5, lineHeight: 1.35, textAlign: "left", color: "#ff8f7a" }}>{statLine(t, d.downStat, d.downPerRank)}</span>
                      <span style={{ fontSize: 10, color: PALETTE.uiTextDim, textAlign: "left" }}>
                        {rank > 0 ? t("talents.nowTotal", { up: statLine(t, d.stat, d.perRank * rank), down: statLine(t, d.downStat, d.downPerRank * rank) }) : t("talents.perPoint")}
                      </span>
                      <span style={{ display: "flex", gap: 3, marginTop: 2 }}>
                        {Array.from({ length: d.maxRank }, (_, k) => (
                          <span key={k} style={{ width: 14, height: 4, borderRadius: 1, background: k < rank ? color : "rgba(255,255,255,0.12)" }} />
                        ))}
                      </span>
                    </button>
                    {i < list.length - 1 && <span aria-hidden="true" style={{ ...linkStyle, background: rank > 0 ? color : "rgba(255,255,255,0.12)" }} />}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <div style={{ ...subStyle, marginTop: 10 }}>{t("talents.rules")}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  width: 640,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(26,17,10,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 14px 36px rgba(0,0,0,0.6)",
  zIndex: 30,
};
const closeStyle: CSSProperties = { position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const titleStyle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, color: PALETTE.uiAccentBright };
const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 4, lineHeight: 1.45 };
const headerRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, fontSize: 13, flexWrap: "wrap" };
const resetBtn: CSSProperties = { padding: "5px 10px", borderRadius: 6, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.3)", color: PALETTE.uiText, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 };
const columnStyle: CSSProperties = { display: "grid", alignContent: "start" };
const branchTitle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, textAlign: "center" };
const nodeStyle: CSSProperties = { display: "grid", gap: 3, padding: "8px 9px", borderRadius: 8, border: "1px solid", color: "inherit", font: "inherit" };
const linkStyle: CSSProperties = { width: 2, height: 10, justifySelf: "center" };
