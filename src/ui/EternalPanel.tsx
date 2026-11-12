import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { MaterialIcon } from "./MaterialIcon";
import type { TranslationKey } from "@/i18n/translate";
import {
  DEPTH_EVERY,
  depthOfWave,
  depthReward,
  MERCHANT_OFFERS,
  MILESTONE_EVERY,
  milestoneReward,
  romanDepth,
  SHARD_POUCH_AMOUNT,
  type ContractDef,
  type MerchantOfferId,
} from "@/config/eternal";

type Contract = ContractDef & { progress: number; done: boolean; claimed: boolean };

interface EternalPanelProps {
  marks: number;
  record: number;
  currentWave: number;
  contracts: readonly Contract[];
  milestonesClaimed: number;
  onClaim: (id: string) => void;
  onBuy: (id: MerchantOfferId) => void;
  onClose: () => void;
}

const VIOLET = "#c9a2ff";

/** MODO ETERNO — weekly contracts, record milestones/depths and the Eternal Merchant (config/eternal.ts). */
export function EternalPanel({ marks, record, currentWave, contracts, milestonesClaimed, onClaim, onBuy, onClose }: EternalPanelProps) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<"contracts" | "milestones" | "merchant">("contracts");
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const nextN = milestonesClaimed + 1;
  const nextMs = milestoneReward(nextN);
  const depth = depthOfWave(Math.max(1, currentWave));
  const nextDepth = depthOfWave(Math.max(1, record)) + 1;

  return (
    <div style={panelStyle} role="dialog" aria-label={t("eternal.panelTitle")} data-testid="eternal-panel">
      <button onClick={onClose} style={closeStyle} aria-label={t("bestiary.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("eternal.panelTitle")}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: VIOLET, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <MaterialIcon kind="MARKS" size={20} /> {t("eternal.marksBalance", { n: fmt(marks) })}
      </div>
      <div role="tablist" style={tabsStyle}>
        {(["contracts", "milestones", "merchant"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...tabStyle, ...(tab === id ? tabOnStyle : null) }}>
            {t(id === "contracts" ? "eternal.tabContracts" : id === "milestones" ? "eternal.tabMilestones" : "eternal.tabMerchant")}
          </button>
        ))}
      </div>

      {tab === "contracts" && (
        <>
          <div style={subStyle}>{t("eternal.contractsLead")}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {contracts.map((c) => {
              const text = t(`eternal.contract.${c.kind}` as TranslationKey, {
                target: fmt(c.target),
                family: c.family ? t(`bestiary.family.${c.family}` as TranslationKey) : "",
                curses: c.minCurses ?? 0,
              });
              return (
                <div key={c.id} style={rowStyle} data-testid={`contract-${c.kind}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{text}</div>
                    <div style={barTrack}>
                      <div style={{ ...barFill, width: `${Math.min(100, (c.progress / c.target) * 100)}%` }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2 }}>{t("eternal.progress", { cur: fmt(c.progress), target: fmt(c.target) })}</div>
                  </div>
                  {c.claimed ? (
                    <span style={{ fontSize: 11, color: PALETTE.uiTextDim }}>{t("eternal.claimed")}</span>
                  ) : (
                    <button onClick={() => onClaim(c.id)} disabled={!c.done} style={{ ...btnStyle, opacity: c.done ? 1 : 0.45 }}>
                      {t("eternal.claim", { n: c.marks })}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "milestones" && (
        <>
          <div style={subStyle}>{t("eternal.milestonesLead")}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <div style={rowStyle}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t("eternal.reachedDepth", { d: romanDepth(depth) })}</div>
            </div>
            <div style={rowStyle}>
              <div style={{ fontSize: 12.5 }}>
                {t("eternal.nextMilestone", { wave: nextN * MILESTONE_EVERY, marks: nextMs.marks, shards: nextMs.shards })}
                <div style={barTrack}>
                  <div style={{ ...barFill, width: `${Math.min(100, ((record - (nextN - 1) * MILESTONE_EVERY) / MILESTONE_EVERY) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div style={rowStyle}>
              <div style={{ fontSize: 12.5 }}>{t("eternal.nextDepth", { d: romanDepth(nextDepth), wave: nextDepth * DEPTH_EVERY + 1, marks: depthReward(nextDepth) })}</div>
            </div>
          </div>
        </>
      )}

      {tab === "merchant" && (
        <>
          <div style={subStyle}>{t("eternal.merchantLead")}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {MERCHANT_OFFERS.map((o) => {
              const can = marks >= o.price;
              return (
                <div key={o.id} style={rowStyle} data-testid={`offer-${o.id}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t(`eternal.offer.${o.id}.name` as TranslationKey)}</div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{t(`eternal.offer.${o.id}.desc` as TranslationKey, { n: SHARD_POUCH_AMOUNT })}</div>
                  </div>
                  <button onClick={() => onBuy(o.id)} disabled={!can} style={{ ...btnStyle, opacity: can ? 1 : 0.45 }} title={can ? undefined : t("eternal.notEnough")}>
                    {t("eternal.buy", { price: o.price })}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 360,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: "1px solid rgba(180,124,255,0.45)",
  background: "linear-gradient(160deg, rgba(40,24,52,0.98), rgba(20,12,28,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
  zIndex: 30,
};
const closeStyle: CSSProperties = { position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const titleStyle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, color: "#e3cdff" };
const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 8, lineHeight: 1.45 };
const tabsStyle: CSSProperties = { display: "flex", gap: 4, marginTop: 10, borderBottom: "1px solid rgba(180,124,255,0.3)", flexWrap: "wrap" };
const tabStyle: CSSProperties = { padding: "6px 8px", background: "none", border: "none", borderBottom: "2px solid transparent", color: PALETTE.uiTextDim, fontWeight: 700, fontSize: 11.5, cursor: "pointer", marginBottom: -1 };
const tabOnStyle: CSSProperties = { color: "#e3cdff", borderBottomColor: "#b47cff" };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(180,124,255,0.25)", background: "rgba(0,0,0,0.22)" };
const btnStyle: CSSProperties = { padding: "6px 10px", borderRadius: 7, border: "1px solid #b47cff", background: "linear-gradient(180deg, #6a3aa8, #432270)", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" };
const barTrack: CSSProperties = { height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", marginTop: 5, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", background: "#b47cff" };
