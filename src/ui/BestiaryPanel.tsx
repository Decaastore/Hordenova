import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { ENEMY_TYPES } from "@/config/enemyStats";
import { ENEMY_VOICE_FAMILY } from "@/config/enemyVoice";
import {
  ACHIEVEMENTS,
  BESTIARY_STARS,
  bestiaryStars,
  bestiaryStats,
  type AchievementId,
  type AchievementStats,
  type BestiaryKills,
} from "@/config/achievements";
import { CreaturePortrait } from "./CreaturePortrait";

interface BestiaryPanelProps {
  kills: Readonly<BestiaryKills>;
  stats: AchievementStats;
  unlocked: readonly AchievementId[];
  title: AchievementId | null;
  onEquipTitle: (id: AchievementId | null) => void;
  onClose: () => void;
}

const STAR_COLORS = ["#c08a4a", "#cfd6e0", "#ffcf5e"];
const fmt = (n: number) => n.toLocaleString();

/** BESTIÁRIO E CONQUISTAS — your defeats per creature (with stars) and your account's achievements and titles. Never reset by the Season. */
export function BestiaryPanel({ kills, stats, unlocked, title, onEquipTitle, onClose }: BestiaryPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"bestiary" | "achievements">("bestiary");
  const b = bestiaryStats(kills);

  return (
    <div style={panelStyle} role="dialog" aria-label={t("bestiary.title")} data-testid="bestiary-panel">
      <style>{`.hn-walk-trigger:hover .hn-creature, .hn-walk-trigger:focus-visible .hn-creature { animation-play-state: running; }`}</style>
      <button onClick={onClose} style={closeStyle} aria-label={t("bestiary.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("bestiary.title")}</div>
      <div role="tablist" style={tabsStyle}>
        {(["bestiary", "achievements"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...tabStyle, ...(tab === id ? tabOnStyle : null) }}>
            {id === "bestiary" ? t("bestiary.tabCreatures", { met: b.met, total: ENEMY_TYPES.length }) : t("bestiary.tabAchievements", { n: unlocked.length, total: ACHIEVEMENTS.length })}
          </button>
        ))}
      </div>

      {tab === "bestiary" ? (
        <>
          <div style={subStyle}>{t("bestiary.lead", { a: BESTIARY_STARS[0], b: BESTIARY_STARS[1], c: fmt(BESTIARY_STARS[2]) })}</div>
          <div style={statRow}>
            <span>{t("bestiary.totalKills", { n: fmt(b.total) })}</span>
            <span>{t("bestiary.goldStars", { n: b.goldStars })}</span>
          </div>
          <div style={gridStyle}>
            {[...ENEMY_TYPES]
              .sort((x, y) => (kills[y] ?? 0) - (kills[x] ?? 0))
              .map((type) => {
                const n = kills[type] ?? 0;
                const stars = bestiaryStars(n);
                const next = BESTIARY_STARS.find((s) => n < s);
                const met = n > 0;
                return (
                  <div key={type} className="hn-walk-trigger" tabIndex={0} style={{ ...cardStyle, opacity: met ? 1 : 0.5 }} data-testid={`bestiary-${type}`}>
                    <div style={{ filter: met ? "none" : "brightness(0) opacity(0.5)" }}>
                      <CreaturePortrait type={type} size={52} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.uiText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {met ? t(`enemies.${type}.name` as TranslationKey) : "???"}
                      </div>
                      <div style={{ fontSize: 10, color: PALETTE.uiTextDim }}>{t(`bestiary.family.${ENEMY_VOICE_FAMILY[type]}` as TranslationKey)}</div>
                      <div style={{ display: "flex", gap: 2, margin: "3px 0" }} aria-label={t("bestiary.stars", { n: stars })}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} style={{ fontSize: 12, color: i < stars ? STAR_COLORS[i] : "rgba(255,255,255,0.15)" }}>
                            ★
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>
                        {next ? t("bestiary.killsNext", { n: fmt(n), next: fmt(next) }) : t("bestiary.killsDone", { n: fmt(n) })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <>
          <div style={subStyle}>{t("achievements.lead")}</div>
          <div style={{ ...statRow, alignItems: "center" }}>
            <span>{title ? t("achievements.wearing", { title: t(`achievements.list.${title}.title` as TranslationKey) }) : t("achievements.noTitle")}</span>
            {title && (
              <button onClick={() => onEquipTitle(null)} style={smallBtn}>
                {t("achievements.takeOff")}
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {ACHIEVEMENTS.map((a) => {
              const done = unlocked.includes(a.id);
              const [cur, target] = a.progress(stats);
              const worn = title === a.id;
              return (
                <div key={a.id} style={{ ...achStyle, borderColor: done ? PALETTE.uiAccent : PALETTE.uiPanelBorder, opacity: done ? 1 : 0.8 }} data-testid={`achievement-${a.id}`}>
                  <span style={{ fontSize: 18, color: done ? PALETTE.uiAccentBright : "rgba(255,255,255,0.2)" }} aria-hidden="true">
                    {done ? "♛" : "♔"}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t(`achievements.list.${a.id}.name` as TranslationKey)}</div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{t(`achievements.list.${a.id}.desc` as TranslationKey)}</div>
                    <div style={{ fontSize: 10.5, color: done ? PALETTE.uiAccentBright : PALETTE.uiTextDim, marginTop: 2 }}>
                      {t("achievements.titleReward", { title: t(`achievements.list.${a.id}.title` as TranslationKey) })}
                    </div>
                    {!done && (
                      <div style={barTrack}>
                        <div style={{ ...barFill, width: `${(cur / target) * 100}%` }} />
                      </div>
                    )}
                    {!done && <div style={{ fontSize: 10, color: PALETTE.uiTextDim, marginTop: 2 }}>{`${fmt(cur)} / ${fmt(target)}`}</div>}
                  </div>
                  {done && (
                    <button onClick={() => onEquipTitle(worn ? null : a.id)} style={{ ...smallBtn, ...(worn ? { borderColor: PALETTE.uiAccent, color: PALETTE.uiAccentBright } : null) }} data-testid={`wear-${a.id}`}>
                      {worn ? t("achievements.worn") : t("achievements.wear")}
                    </button>
                  )}
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
const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 8, lineHeight: 1.45 };
const tabsStyle: CSSProperties = { display: "flex", gap: 6, marginTop: 10, borderBottom: `1px solid ${PALETTE.uiPanelBorder}` };
const tabStyle: CSSProperties = { padding: "6px 10px", background: "none", border: "none", borderBottom: "2px solid transparent", color: PALETTE.uiTextDim, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: -1 };
const tabOnStyle: CSSProperties = { color: PALETTE.uiAccentBright, borderBottomColor: PALETTE.uiAccent };
const statRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, fontSize: 12, fontWeight: 700, flexWrap: "wrap" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginTop: 10 };
const cardStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 8, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.25)" };
const achStyle: CSSProperties = { display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, border: "1px solid", background: "rgba(0,0,0,0.22)" };
const smallBtn: CSSProperties = { padding: "4px 9px", borderRadius: 6, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.3)", color: PALETTE.uiText, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" };
const barTrack: CSSProperties = { height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", marginTop: 4, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", background: PALETTE.uiAccent };
