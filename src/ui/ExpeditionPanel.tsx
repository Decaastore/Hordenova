import { useEffect, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { GemCurrency } from "@/config/gemsEconomy";
import { ITEM_DEFINITIONS } from "@/config/itemDefinitions";
import { MaterialIcon, type MaterialKind } from "./MaterialIcon";
import {
  ESSENCE_RARITIES,
  EXPEDITION_HOURS,
  EXTRA_GROUP_PRICE,
  expeditionPrize,
  expeditionRegions,
  FORGE_RECIPES,
  MAX_SCOUT_GROUPS,
  recipeRarity,
  rushPrice,
  unlockedRegions,
  type ExpeditionHours,
  type ExpeditionPrize,
  type ExpeditionState,
} from "@/config/expeditions";

interface ExpeditionPanelProps {
  /** Which panel: the Expeditions or the Forge — each has its own button in the HUD. */
  view: "trips" | "forge";
  state: ExpeditionState;
  /** Groups usable now (owned, plus one while VIP). */
  groupsNow: number;
  record: number;
  freeGems: number;
  purchasedGems: number;
  onSend: (regionIndex: number, hours: ExpeditionHours) => void;
  onCollect: (i: number) => void;
  onRush: (i: number, currency: GemCurrency) => void;
  onBuyGroup: (currency: GemCurrency) => void;
  onForge: (itemId: string) => void;
  onCollectForge: () => void;
  onRushForge: (currency: GemCurrency) => void;
  onClose: () => void;
}

const GOLD = "#e8c06a";
const RARITY_COLOR: Record<string, string> = { UNCOMMON: "#7fcf6a", RARE: "#6aa8ff", EPIC: "#b47cff", LEGENDARY: "#ffb347", MYTHIC: "#ff5a5a" };

function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** EXPEDIÇÕES E FORJA — send scouts for a prize shown up front, and forge the item you choose (config/expeditions.ts). */
export function ExpeditionPanel(p: ExpeditionPanelProps) {
  const { t, language } = useLanguage();
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const tab = p.view;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const regions = unlockedRegions(p.record);
  const [regionIndex, setRegionIndex] = useState<number>(() => regions[regions.length - 1]?.index ?? -1);
  const [hours, setHours] = useState<ExpeditionHours>(4);
  const region = expeditionRegions()[regionIndex];
  const s = p.state;
  const regionName = (i: number) => t(`phases.${expeditionRegions()[i]!.i18nKey}.name` as TranslationKey);
  const rarityName = (r: string) => t(`expeditions.essenceShort.${r}` as TranslationKey);

  /** A row of icon + amount chips. */
  const chips = (list: [MaterialKind, number | string, string][]) => (
    <span style={chipsRow}>
      {list.map(([k, n, label]) => (
        <span key={k} style={chipStyleI} title={label}>
          <MaterialIcon kind={k} size={15} title={label} /> {n}
        </span>
      ))}
    </span>
  );
  const prizeChips = (pr: ExpeditionPrize) =>
    chips([
      ["GOLD", fmt(pr.gold), t("expeditions.gold", { n: fmt(pr.gold) })],
      ...(pr.shards > 0 ? ([["SHARDS", pr.shards, t("expeditions.shards", { n: pr.shards })]] as [MaterialKind, number, string][]) : []),
      ["SPLINTERS", pr.splinters, t("expeditions.splinters", { n: pr.splinters })],
      ...ESSENCE_RARITIES.filter((r) => pr.essences[r] > 0).map((r) => [r, pr.essences[r], t(`expeditions.essenceName.${r}` as TranslationKey)] as [MaterialKind, number, string]),
    ]);

  const rushButtons = (msLeft: number, onRush: (c: GemCurrency) => void) => {
    const price = rushPrice(msLeft);
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button style={ghostBtn} disabled={p.freeGems < price.free} onClick={() => onRush("FREE")} title={t("expeditions.rushFree")}>
          {price.free} 🔒
        </button>
        <button style={ghostBtn} disabled={p.purchasedGems < price.purchased} onClick={() => onRush("PURCHASED")} title={t("expeditions.rushPaid")}>
          {price.purchased} 💎
        </button>
      </div>
    );
  };

  return (
    <div style={panelStyle} role="dialog" aria-label={t(tab === "forge" ? "expeditions.tabForge" : "expeditions.tabTrips")} data-testid={tab === "forge" ? "forge-panel" : "expedition-panel"}>
      <button onClick={p.onClose} style={closeStyle} aria-label={t("bestiary.close")}>
        ×
      </button>
      <div style={titleStyle}>{t(tab === "forge" ? "expeditions.tabForge" : "expeditions.tabTrips")}</div>

      {tab === "trips" && (
        <>
          <div style={subStyle}>{t("expeditions.lead")}</div>
          <div style={{ ...subStyle, color: PALETTE.uiText, fontWeight: 700 }}>{t("expeditions.groups", { used: s.active.length, total: p.groupsNow })}</div>

          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {s.active.map((e, i) => {
              const left = e.endsAt - now;
              const done = left <= 0;
              const pr = expeditionPrize(expeditionRegions()[e.regionIndex]!.tier, e.hours);
              return (
                <div key={`${e.startedAt}-${i}`} style={rowStyle} data-testid="expedition-active">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {regionName(e.regionIndex)} · {t("expeditions.hours", { n: e.hours })}
                    </div>
                    <div style={barTrack}>
                      <div style={{ ...barFill, width: `${Math.min(100, ((now - e.startedAt) / (e.endsAt - e.startedAt)) * 100)}%` }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: done ? "#9be37a" : PALETTE.uiTextDim, marginTop: 2 }}>{done ? t("expeditions.ready") : t("expeditions.timeLeft", { t: fmtLeft(left) })}</div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 3 }}>{prizeChips(pr)}</div>
                  </div>
                  {done ? (
                    <button style={btnStyle} onClick={() => p.onCollect(i)}>
                      {t("expeditions.collect")}
                    </button>
                  ) : (
                    rushButtons(left, (c) => p.onRush(i, c))
                  )}
                </div>
              );
            })}
          </div>

          {regions.length === 0 ? (
            <div style={{ ...subStyle, marginTop: 12 }}>{t("expeditions.noRegion")}</div>
          ) : (
            <div style={{ ...rowStyle, display: "block", marginTop: 10 }}>
              <label style={labelStyle}>
                {t("expeditions.pickRegion")}
                <select value={regionIndex} onChange={(e) => setRegionIndex(Number(e.target.value))} style={selectStyle} data-testid="expedition-region">
                  {regions.map((r) => (
                    <option key={r.index} value={r.index}>
                      {regionName(r.index)} {"★".repeat(r.tier)}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ ...labelStyle, marginTop: 8 }}>{t("expeditions.pickTime")}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {EXPEDITION_HOURS.map((h) => (
                  <button key={h} onClick={() => setHours(h)} style={{ ...chipStyle, ...(hours === h ? chipOnStyle : null) }} aria-pressed={hours === h}>
                    {t("expeditions.hours", { n: h })}
                  </button>
                ))}
              </div>
              {region && (
                <div style={{ marginTop: 8, fontSize: 11.5 }}>
                  <span style={{ color: GOLD, fontWeight: 700 }}>{t("expeditions.prize")}: </span>
                  {prizeChips(expeditionPrize(region.tier, hours))}
                </div>
              )}
              <button
                style={{ ...btnStyle, marginTop: 10, width: "100%", opacity: s.active.length < p.groupsNow ? 1 : 0.45 }}
                disabled={s.active.length >= p.groupsNow}
                onClick={() => p.onSend(regionIndex, hours)}
                data-testid="expedition-send"
              >
                {s.active.length < p.groupsNow ? t("expeditions.send") : t("expeditions.noGroupFree")}
              </button>
            </div>
          )}

          {s.groups < MAX_SCOUT_GROUPS && (
            <div style={{ ...rowStyle, marginTop: 10 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{t("expeditions.buyGroup", { n: s.groups + 1 })}</div>
              <button style={ghostBtn} disabled={p.freeGems < EXTRA_GROUP_PRICE.free} onClick={() => p.onBuyGroup("FREE")}>
                {EXTRA_GROUP_PRICE.free} 🔒
              </button>
              <button style={ghostBtn} disabled={p.purchasedGems < EXTRA_GROUP_PRICE.purchased} onClick={() => p.onBuyGroup("PURCHASED")}>
                {EXTRA_GROUP_PRICE.purchased} 💎
              </button>
            </div>
          )}
        </>
      )}

      {tab === "forge" && (
        <>
          <div style={subStyle}>{t("expeditions.forgeLead")}</div>
          <div style={{ ...rowStyle, marginTop: 8, flexWrap: "wrap", gap: 8, fontSize: 11.5 }}>
            <strong style={{ width: "100%", fontSize: 11 }}>{t("expeditions.materials")}</strong>
            <span style={matStyle} title={t("expeditions.splintersLabel")}>
              <MaterialIcon kind="SPLINTERS" size={24} /> <b>{fmt(s.splinters)}</b>
            </span>
            {ESSENCE_RARITIES.map((r) => (
              <span key={r} style={{ ...matStyle, color: RARITY_COLOR[r] }} title={t(`expeditions.essenceName.${r}` as TranslationKey)}>
                <MaterialIcon kind={r} size={24} /> <b>{s.essences[r]}</b>
              </span>
            ))}
          </div>

          {s.forging && (
            <div style={{ ...rowStyle, marginTop: 8, borderColor: "#e8c06a" }} data-testid="forge-active">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t("expeditions.forging", { item: t(`items.${ITEM_DEFINITIONS[s.forging.itemId].i18nKey}.name` as TranslationKey) })}</div>
                <div style={{ fontSize: 10.5, color: s.forging.endsAt <= now ? "#9be37a" : PALETTE.uiTextDim }}>
                  {s.forging.endsAt <= now ? t("expeditions.ready") : t("expeditions.timeLeft", { t: fmtLeft(s.forging.endsAt - now) })}
                </div>
              </div>
              {s.forging.endsAt <= now ? (
                <button style={btnStyle} onClick={p.onCollectForge}>
                  {t("expeditions.takeItem")}
                </button>
              ) : (
                rushButtons(s.forging.endsAt - now, p.onRushForge)
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {FORGE_RECIPES.map((r) => {
              const rarity = recipeRarity(r);
              const missing = [
                ...(s.splinters < r.splinters ? [`${r.splinters - s.splinters} ${t("expeditions.splintersLabel")}`] : []),
                ...ESSENCE_RARITIES.filter((k) => s.essences[k] < r.essences[k]).map((k) => `${r.essences[k] - s.essences[k]} ${rarityName(k)}`),
              ];
              const can = missing.length === 0 && !s.forging;
              return (
                <div key={r.itemId} style={{ ...rowStyle, borderColor: `${RARITY_COLOR[rarity]}66` }} data-testid={`recipe-${r.itemId}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: RARITY_COLOR[rarity] }}>{t(`items.${ITEM_DEFINITIONS[r.itemId].i18nKey}.name` as TranslationKey)}</div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {chips([
                        ["SPLINTERS", r.splinters, t("expeditions.splintersLabel")],
                        ...ESSENCE_RARITIES.filter((k) => r.essences[k] > 0).map((k) => [k, r.essences[k], t(`expeditions.essenceName.${k}` as TranslationKey)] as [MaterialKind, number, string]),
                      ])}
                      <span>⏱ {t("expeditions.hours", { n: r.hours })}</span>
                    </div>
                    {missing.length > 0 && <div style={{ fontSize: 10.5, color: "#e58a7a" }}>{t("expeditions.missing", { list: missing.join(", ") })}</div>}
                  </div>
                  <button style={{ ...btnStyle, opacity: can ? 1 : 0.45 }} disabled={!can} onClick={() => p.onForge(r.itemId)} title={s.forging ? t("expeditions.busy") : undefined}>
                    {t("expeditions.forge")}
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
  width: 380,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: "1px solid rgba(232,192,106,0.45)",
  background: "linear-gradient(160deg, rgba(44,32,20,0.98), rgba(22,16,10,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
  zIndex: 30,
};
const closeStyle: CSSProperties = { position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const titleStyle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, color: "#f1dcae" };
const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 8, lineHeight: 1.45 };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(232,192,106,0.22)", background: "rgba(0,0,0,0.22)" };
const btnStyle: CSSProperties = { padding: "6px 10px", borderRadius: 7, border: `1px solid ${GOLD}`, background: "linear-gradient(180deg, #9a6a24, #6a4512)", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" };
const ghostBtn: CSSProperties = { padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(232,192,106,0.5)", background: "rgba(0,0,0,0.3)", color: PALETTE.uiText, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" };
const chipStyle: CSSProperties = { flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid rgba(232,192,106,0.3)", background: "rgba(0,0,0,0.25)", color: PALETTE.uiTextDim, fontWeight: 700, fontSize: 11.5, cursor: "pointer" };
const chipOnStyle: CSSProperties = { borderColor: GOLD, color: "#f1dcae", background: "rgba(232,192,106,0.15)" };
const labelStyle: CSSProperties = { display: "block", fontSize: 11, color: PALETTE.uiTextDim, fontWeight: 700 };
const selectStyle: CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "5px 6px", borderRadius: 6, background: "#1c140c", color: PALETTE.uiText, border: "1px solid rgba(232,192,106,0.4)", fontSize: 12 };
const chipsRow: CSSProperties = { display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center" };
const chipStyleI: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px 1px 3px", borderRadius: 10, background: "rgba(0,0,0,0.3)", color: PALETTE.uiText, fontWeight: 700 };
const matStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 };
const barTrack: CSSProperties = { height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", marginTop: 5, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", background: GOLD };
