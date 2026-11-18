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
import { BossPortrait, CreaturePortrait } from "./CreaturePortrait";
import { ALL_BOSSES, BOSS_STARS, bossBestiaryStats, bossStars, type BossKills } from "@/config/bossBestiary";
import { PHASES } from "@/config/phaseConfig";
import { canHuntPhase, HUNT_BREACH_MULT, HUNT_HP_MULT, HUNT_SPEED_MULT } from "@/config/hunt";
import { MAIN_BOSSES } from "@/config/bossConfig";

interface BestiaryPanelProps {
  kills: Readonly<BestiaryKills>;
  /** BESTIÁRIO DOS CHEFES — defeats per boss id. */
  bossKills: Readonly<BossKills>;
  /** CAÇADA — the Season castle's record and current wave (what decides which phases can be hunted and how strong the hunt is). */
  hunt: { seasonBestWave: number; seasonWave: number; wins: Readonly<Record<string, number>>; activePhase: number | null };
  onStartHunt: (phaseIndex: number) => void;
  stats: AchievementStats;
  unlocked: readonly AchievementId[];
  title: AchievementId | null;
  onEquipTitle: (id: AchievementId | null) => void;
  onClose: () => void;
}

const STAR_COLORS = ["#c08a4a", "#cfd6e0", "#ffcf5e"];

/** BESTIÁRIO E CONQUISTAS — your defeats per creature (with stars) and your account's achievements and titles. Never reset by the Season. */
export function BestiaryPanel({ kills, bossKills, hunt, onStartHunt, stats, unlocked, title, onEquipTitle, onClose }: BestiaryPanelProps) {
  const { t, language } = useLanguage();
  const fmt = (n: number) => n.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US");
  const [tab, setTab] = useState<"bestiary" | "bosses" | "hunts" | "achievements">("bestiary");
  const b = bestiaryStats(kills);
  const bb = bossBestiaryStats(bossKills);
  const tabLabel = (id: typeof tab) =>
    id === "bestiary"
      ? t("bestiary.tabCreatures", { met: b.met, total: ENEMY_TYPES.length })
      : id === "bosses"
        ? t("bestiary.tabBosses", { met: bb.met, total: ALL_BOSSES.length })
        : id === "hunts"
          ? t("bestiary.tabHunts")
          : t("bestiary.tabAchievements", { n: unlocked.length, total: ACHIEVEMENTS.length });

  return (
    <div className="hn-pop" style={panelStyle} role="dialog" aria-label={t("bestiary.title")} data-testid="bestiary-panel">
      <style>{`.hn-walk-trigger:hover .hn-creature, .hn-walk-trigger:focus-visible .hn-creature { animation-play-state: running; }`}</style>
      <button onClick={onClose} style={closeStyle} aria-label={t("bestiary.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("bestiary.title")}</div>
      <div role="tablist" style={tabsStyle}>
        {(["bestiary", "bosses", "hunts", "achievements"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...tabStyle, ...(tab === id ? tabOnStyle : null) }} data-testid={`bestiary-tab-${id}`}>
            {tabLabel(id)}
          </button>
        ))}
      </div>

      {tab === "bestiary" ? (
        <>
          <div style={subStyle}>{t("bestiary.lead", { a: BESTIARY_STARS[0], b: BESTIARY_STARS[1], c: fmt(BESTIARY_STARS[2]) })}</div>
          <AlbumGoal
            label={t("bestiary.albumCreatures", { stars: fmt(BESTIARY_STARS[1]) })}
            reward={t("castleSkins.VOID_SPIRE.name")}
            have={b.mastered}
            total={ENEMY_TYPES.length}
            onHunt={() => setTab("hunts")}
            huntLabel={t("bestiary.goHunt")}
          />
          <div style={statRow}>
            <span>{t("bestiary.totalKills", { n: fmt(b.total) })}</span>
            <span>{t("bestiary.goldStars", { n: b.goldStars })}</span>
          </div>
          <div className="hn-stagger" style={gridStyle}>
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
                      <Stars stars={stars} label={t("bestiary.stars", { n: stars })} />
                      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>
                        {next ? t("bestiary.killsNext", { n: fmt(n), next: fmt(next) }) : t("bestiary.killsDone", { n: fmt(n) })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      ) : tab === "bosses" ? (
        <>
          <div style={subStyle}>{t("bestiary.bossLead", { a: BOSS_STARS[0], b: BOSS_STARS[1], c: BOSS_STARS[2] })}</div>
          <AlbumGoal
            label={t("bestiary.albumBosses", { n: BOSS_STARS[1] })}
            reward={t("castleSkins.HUNTER_THRONE.name")}
            have={bb.mastered}
            total={ALL_BOSSES.length}
            onHunt={() => setTab("hunts")}
            huntLabel={t("bestiary.goHunt")}
          />
          <div style={statRow}>
            <span>{t("bestiary.bossTotal", { n: fmt(bb.total) })}</span>
          </div>
          <div className="hn-stagger" style={gridStyle}>
            {[...ALL_BOSSES]
              .sort((x, y) => Number(y.isMainBoss) - Number(x.isMainBoss) || (bossKills[y.id] ?? 0) - (bossKills[x.id] ?? 0))
              .map((boss) => {
                const n = bossKills[boss.id] ?? 0;
                const stars = bossStars(n);
                const next = BOSS_STARS.find((v) => n < v);
                const met = n > 0;
                return (
                  <div key={boss.id} className="hn-walk-trigger" tabIndex={0} style={{ ...cardStyle, opacity: met ? 1 : 0.55, borderColor: boss.isMainBoss ? "rgba(255,120,60,0.45)" : PALETTE.uiPanelBorder }} data-testid={`boss-bestiary-${boss.id}`}>
                    <div style={{ filter: met ? "none" : "brightness(0) opacity(0.5)" }}>
                      <BossPortrait bossId={boss.id} size={52} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.uiText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {met ? t(`bosses.${boss.i18nKey}.name` as TranslationKey) : "???"}
                      </div>
                      <div style={{ fontSize: 10, color: boss.isMainBoss ? "#ff9a6a" : PALETTE.uiTextDim }}>{boss.isMainBoss ? t("bestiary.mainBoss") : t("bestiary.miniBoss")}</div>
                      <Stars stars={stars} label={t("bestiary.stars", { n: stars })} />
                      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>
                        {next ? t("bestiary.killsNext", { n: fmt(n), next: fmt(next) }) : t("bestiary.killsDone", { n: fmt(n) })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      ) : tab === "hunts" ? (
        <>
          <div style={subStyle}>{t("bestiary.huntLead")}</div>
          <div style={huntRulesStyle}>
            {t("bestiary.huntRules", { wave: fmt(Math.max(1, hunt.seasonWave)), hp: Math.round((HUNT_HP_MULT - 1) * 100), speed: Math.round((HUNT_SPEED_MULT - 1) * 100), breach: Math.round((HUNT_BREACH_MULT - 1) * 100) })}
          </div>
          <div className="hn-stagger" style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {PHASES.map((phase, i) => {
              const open = canHuntPhase(phase, hunt.seasonBestWave);
              const boss = MAIN_BOSSES[phase.mainBossId];
              const bossN = boss ? (bossKills[boss.id] ?? 0) : 0;
              const wins = hunt.wins[phase.id] ?? 0;
              const active = hunt.activePhase === i;
              return (
                <div key={phase.id} style={{ ...huntRowStyle, opacity: open ? 1 : 0.55, borderColor: active ? PALETTE.uiAccentBright : PALETTE.uiPanelBorder }} data-testid={`hunt-${phase.id}`}>
                  {boss && <BossPortrait bossId={boss.id} size={46} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800 }}>{t(`phases.${phase.i18nKey}.name` as TranslationKey)}</div>
                    <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>
                      {t("bestiary.huntWaves", { from: phase.startWave, to: phase.endWave })}
                      {boss ? ` · ${t(`bosses.${boss.i18nKey}.name` as TranslationKey)} ${"★".repeat(bossStars(bossN))}${"☆".repeat(3 - bossStars(bossN))}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                      {[...new Set(phase.enemyPool)].map((type) => {
                        const st = bestiaryStars(kills[type] ?? 0);
                        return (
                          <span key={type} title={t(`enemies.${type}.name` as TranslationKey)} style={{ ...poolChipStyle, borderColor: st >= 2 ? "#cfd6e0" : PALETTE.uiPanelBorder }}>
                            <CreaturePortrait type={type} size={18} />
                            <span style={{ color: st > 0 ? STAR_COLORS[st - 1] : "rgba(255,255,255,0.25)" }}>{"★".repeat(Math.max(1, st))}</span>
                          </span>
                        );
                      })}
                    </div>
                    {wins > 0 && <div style={{ fontSize: 10, color: PALETTE.uiAccentBright, marginTop: 2 }}>{t("bestiary.huntWins", { n: wins })}</div>}
                  </div>
                  {active ? (
                    <button style={{ ...huntBtnStyle, background: "linear-gradient(180deg,#d8a02a,#8a5a10)", borderColor: "#ffd27a" }} onClick={() => onStartHunt(i)} data-testid={`hunt-resume-${phase.id}`}>
                      {t("bestiary.huntNow")}
                    </button>
                  ) : open ? (
                    <button style={huntBtnStyle} onClick={() => onStartHunt(i)} data-testid={`hunt-start-${phase.id}`}>
                      {t("bestiary.huntStart")}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10.5, color: PALETTE.uiTextDim, maxWidth: 110, textAlign: "right" }}>{t("bestiary.huntLocked", { wave: phase.endWave })}</span>
                  )}
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
          <div className="hn-stagger" style={{ display: "grid", gap: 6, marginTop: 8 }}>
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

function Stars({ stars, label }: { stars: number; label: string }) {
  return (
    <div style={{ display: "flex", gap: 2, margin: "3px 0" }} aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ fontSize: 12, color: i < stars ? STAR_COLORS[i] : "rgba(255,255,255,0.15)" }}>
          ★
        </span>
      ))}
    </div>
  );
}

/** An album's progress towards its castle skin, with a shortcut to the Hunts. */
function AlbumGoal({ label, reward, have, total, onHunt, huntLabel }: { label: string; reward: string; have: number; total: number; onHunt: () => void; huntLabel: string }) {
  const pct = total > 0 ? Math.min(100, (have / total) * 100) : 0;
  return (
    <div style={albumStyle} data-testid="bestiary-album-goal">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: PALETTE.uiText }}>
          {label} <b style={{ color: PALETTE.uiAccentBright }}>{reward}</b>
        </div>
        <div style={barTrack}>
          <div style={{ ...barFill, width: `${pct}%`, background: "linear-gradient(90deg,#cfd6e0,#ffcf5e)" }} />
        </div>
        <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2 }}>{`${have} / ${total}`}</div>
      </div>
      <button style={smallBtn} onClick={onHunt}>
        {huntLabel}
      </button>
    </div>
  );
}

const albumStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,207,94,0.35)", background: "rgba(255,207,94,0.06)" };
const huntRulesStyle: CSSProperties = { marginTop: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,90,60,0.4)", background: "rgba(255,60,30,0.08)", fontSize: 11, lineHeight: 1.45, color: "#ffd2c0" };
const huntRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid", background: "rgba(0,0,0,0.25)" };
const poolChipStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 2, padding: "1px 4px 1px 1px", borderRadius: 6, border: "1px solid", fontSize: 9, background: "rgba(0,0,0,0.25)" };
const huntBtnStyle: CSSProperties = { padding: "7px 14px", borderRadius: 7, border: "1px solid #ff7a4a", background: "linear-gradient(180deg,#c8401e,#7a1e0c)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

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
