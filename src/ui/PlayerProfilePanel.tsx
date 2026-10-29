import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { drawTower } from "@/rendering/EntityRenderer";
import { createTowerInstance } from "@/entities/Tower";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { getPrestigeTier } from "@/config/prestige";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import { countOwnedSkins, TOTAL_TOWER_SKINS, DISPLAY_NAME_MAX, type PublicPlayerProfile, type PublicTowerSnapshot } from "@/profile/playerProfile";
import { getProfileService, setMyDisplayName } from "@/profile/profileService";

interface PlayerProfilePanelProps {
  playerId: string;
  onClose: () => void;
}

/**
 * A player's public profile, opened from the Ranking: their records, and
 * each of the four towers with a live preview (their level's visual stage
 * and equipped skin), mastery, specialization, equipped items and the
 * skins they own. Read-only for everyone except the player themself, who
 * can set the name shown in the ranking.
 */
export function PlayerProfilePanel({ playerId, onClose }: PlayerProfilePanelProps) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PublicPlayerProfile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const service = getProfileService();
  const isMe = service.getMyProfile().playerId === playerId;

  useEffect(() => {
    let alive = true;
    service
      .getProfile(playerId)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveName = () => {
    if (!profile) return;
    setMyDisplayName(nameDraft, profile.playerId);
    setProfile(service.getMyProfile());
    setEditing(false);
    void service.publishMyProfile().catch(() => undefined);
  };

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeStyle} onClick={onClose} aria-label={t("profile.close")}>
          ×
        </button>
        {profile === undefined && <p style={dimStyle}>{t("profile.loading")}</p>}
        {profile === null && <p style={dimStyle}>{t("profile.notFound")}</p>}
        {profile && (
          <>
            <Header
              profile={profile}
              isMe={isMe}
              editing={editing}
              nameDraft={nameDraft}
              onEdit={() => {
                setNameDraft(profile.displayName);
                setEditing(true);
              }}
              onDraft={setNameDraft}
              onSave={saveName}
            />
            <Stats profile={profile} />
            <h3 style={sectionTitleStyle}>{t("profile.towersTitle")}</h3>
            <div style={towerGridStyle}>
              {profile.towers.map((tw) => (
                <TowerCard key={tw.type} tower={tw} />
              ))}
            </div>
            {profile.updatedAt > 0 && (
              <p style={updatedStyle}>{t("profile.updated", { date: new Date(profile.updatedAt).toLocaleString() })}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Header(props: {
  profile: PublicPlayerProfile;
  isMe: boolean;
  editing: boolean;
  nameDraft: string;
  onEdit: () => void;
  onDraft: (v: string) => void;
  onSave: () => void;
}) {
  const { t } = useLanguage();
  const { profile } = props;
  const tier = getPrestigeTier(profile.prestigeLevel);
  const tierLabel = t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : "");
  return (
    <div style={headerStyle}>
      <div style={{ ...emblemStyle, borderColor: tier.color, boxShadow: `0 0 18px ${tier.color}55` }}>{profile.displayName.charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {props.editing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={props.nameDraft}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={t("profile.namePlaceholder")}
              onChange={(e) => props.onDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.onSave()}
              style={inputStyle}
            />
            <button style={smallButtonStyle} onClick={props.onSave}>
              {t("profile.saveName")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={nameStyle}>{profile.displayName}</h2>
            {props.isMe && (
              <button style={linkButtonStyle} onClick={props.onEdit}>
                {t("profile.editName")}
              </button>
            )}
          </div>
        )}
        <div style={{ color: tier.color, fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
          {tierLabel} · {t("prestige.level", { level: profile.prestigeLevel })}
        </div>
      </div>
    </div>
  );
}

function Stats({ profile }: { profile: PublicPlayerProfile }) {
  const { t } = useLanguage();
  const wave = (w: number) => t("hud.phaseWaveValue", { phase: phaseNumberFromWave(Math.max(1, w)), onda: waveInPhase(Math.max(1, w)) });
  const stats: [string, string][] = [
    [t("profile.seasonBest"), wave(profile.seasonBestWave)],
    [t("profile.allTimeBest"), String(profile.bestWave)],
    [t("profile.seasonsWon"), String(profile.seasonsWon)],
    [t("profile.bosses"), String(profile.bossesDefeated)],
    [t("profile.miniBosses"), String(profile.miniBossesDefeated)],
    [t("profile.skinsOwned"), `${countOwnedSkins(profile)} / ${TOTAL_TOWER_SKINS}`],
  ];
  return (
    <div style={statsGridStyle}>
      {stats.map(([label, value]) => (
        <div key={label} style={statStyle}>
          <div style={statValueStyle}>{value}</div>
          <div style={statLabelStyle}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function TowerCard({ tower }: { tower: PublicTowerSnapshot }) {
  const { t } = useLanguage();
  const built = tower.bestLevel > 0;
  const specName = tower.specializationId ? t(`specializations.${tower.specializationId}.name` as TranslationKey) : null;
  return (
    <div style={{ ...towerCardStyle, opacity: built ? 1 : 0.7 }}>
      <TowerPreview tower={tower} />
      <div style={towerInfoStyle}>
        <div style={towerNameStyle}>{t(`towers.${tower.type}.name` as TranslationKey)}</div>
        <div style={towerLevelStyle}>
          {built ? t("profile.level", { level: tower.bestLevel }) : t("profile.notBuilt")}
          {tower.placed > 1 && <span style={dimInlineStyle}> · {t("profile.placed", { count: tower.placed })}</span>}
        </div>
        <Row label={t("profile.mastery")} value={tower.masteryUnlocked ? t("profile.masteryLevel", { level: tower.masteryLevel }) : t("profile.masteryLocked")} />
        <Row
          label={t("profile.specialization")}
          value={specName ? t("profile.specializationLevel", { name: specName, level: tower.specializationLevel }) : t("profile.noSpecialization")}
        />
        <div style={rowLabelStyle}>{t("profile.items")}</div>
        <div style={chipRowStyle}>
          {tower.equippedItemIds.length === 0 && <span style={dimInlineStyle}>{t("profile.noItems")}</span>}
          {tower.equippedItemIds.map((id, i) => {
            const def = getItemDefinition(id);
            if (!def) return null;
            const rarity = getRarityDefinition(def.rarity);
            return (
              <span key={`${id}-${i}`} style={{ ...chipStyle, borderColor: rarity.color, color: rarity.color }}>
                {t(`items.${def.i18nKey}.name` as TranslationKey)}
              </span>
            );
          })}
        </div>
        <div style={rowLabelStyle}>{t("profile.skins")}</div>
        <div style={chipRowStyle}>
          {tower.ownedSkinIds.length === 0 && <span style={dimInlineStyle}>{t("profile.defaultSkin")}</span>}
          {tower.ownedSkinIds.map((id) => {
            const def = getTowerSkinDefinition(id);
            const accent = def?.paletteOverride.accent ?? PALETTE.gold;
            const isEquipped = tower.equippedSkinId === id;
            return (
              <span key={id} style={{ ...chipStyle, borderColor: accent, color: accent, background: isEquipped ? `${accent}22` : "transparent" }}>
                {t(`towerSkins.${id}.name` as TranslationKey)}
                {isEquipped && <b style={{ marginLeft: 6, fontSize: 9 }}>{t("profile.equipped")}</b>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const PREVIEW_PX = 120;
const PREVIEW_ZOOM = 1.4;

/** Live preview of the tower exactly as it looks in battle at that level, with the equipped skin. */
function TowerPreview({ tower }: { tower: PublicTowerSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_PX * dpr;
    canvas.height = PREVIEW_PX * dpr;
    ctx.scale(dpr * PREVIEW_ZOOM, dpr * PREVIEW_ZOOM);
    const view = PREVIEW_PX / PREVIEW_ZOOM;
    const instance = createTowerInstance(
      "profile-preview",
      tower.type,
      { x: view / 2, y: view * 0.72 },
      Math.max(1, tower.bestLevel),
      tower.specializationId,
      tower.specializationLevel,
      tower.equippedSkinId,
      tower.masteryLevel,
      tower.masteryUnlocked,
    );
    let raf = 0;
    const loop = (time: number) => {
      ctx.clearRect(0, 0, view, view);
      ctx.save();
      if (tower.bestLevel === 0) ctx.globalAlpha = 0.45;
      drawTower(ctx, instance, false, time);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tower]);
  return <canvas ref={ref} style={previewStyle} />;
}

// ---------------------------------------------------------------------------
const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,5,3,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};
const panelStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 760,
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: 16,
  border: `1px solid ${PALETTE.gold}`,
  background: "linear-gradient(165deg, rgba(48,32,20,0.98), rgba(22,15,9,0.99))",
  boxShadow: `0 0 40px ${PALETTE.gold}22`,
  color: PALETTE.uiText,
  padding: "22px 24px 18px",
  boxSizing: "border-box",
};
const closeStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  right: 14,
  background: "none",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 26,
  cursor: "pointer",
};
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 };
const emblemStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  border: "2px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Georgia, serif",
  fontSize: 26,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
  background: "rgba(0,0,0,0.3)",
  flexShrink: 0,
};
const nameStyle: CSSProperties = { margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, color: PALETTE.uiAccentBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.35)",
  color: PALETTE.uiText,
  fontSize: 14,
};
const smallButtonStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.gold}`,
  background: "rgba(255,210,87,0.12)",
  color: PALETTE.gold,
  fontWeight: 800,
  fontSize: 11,
  cursor: "pointer",
};
const linkButtonStyle: CSSProperties = { background: "none", border: "none", color: PALETTE.uiTextDim, textDecoration: "underline", cursor: "pointer", fontSize: 11 };
const statsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 18 };
const statStyle: CSSProperties = { textAlign: "center", padding: "10px 6px", borderRadius: 10, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.25)" };
const statValueStyle: CSSProperties = { fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 800, color: PALETTE.gold };
const statLabelStyle: CSSProperties = { fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color: PALETTE.uiTextDim, marginTop: 2 };
const sectionTitleStyle: CSSProperties = { margin: "0 0 10px", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: PALETTE.uiTextDim };
const towerGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 10 };
const towerCardStyle: CSSProperties = { display: "flex", gap: 12, padding: 10, borderRadius: 12, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.22)" };
const previewStyle: CSSProperties = {
  width: PREVIEW_PX,
  height: PREVIEW_PX,
  flexShrink: 0,
  borderRadius: 10,
  background: "radial-gradient(circle at 50% 72%, rgba(70,54,38,0.6), rgba(0,0,0,0.35))",
};
const towerInfoStyle: CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 };
const towerNameStyle: CSSProperties = { fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 15, color: PALETTE.uiAccentBright };
const towerLevelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: PALETTE.gold, marginBottom: 2 };
const rowLabelStyle: CSSProperties = { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: PALETTE.uiTextDim, marginTop: 4 };
const chipRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4 };
const chipStyle: CSSProperties = { fontSize: 10.5, padding: "2px 7px", borderRadius: 999, border: "1px solid", whiteSpace: "nowrap" };
const dimStyle: CSSProperties = { color: PALETTE.uiTextDim, textAlign: "center", padding: 30 };
const dimInlineStyle: CSSProperties = { color: PALETTE.uiTextDim, fontSize: 11 };
const updatedStyle: CSSProperties = { marginTop: 12, fontSize: 10, color: PALETTE.uiTextDim, textAlign: "right" };
