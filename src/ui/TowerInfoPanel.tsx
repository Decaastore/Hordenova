import type { CSSProperties, ReactNode } from "react";
import type { TowerInstance } from "@/entities/Tower";
import {
  canChooseSpecialization,
  canUpgradeMastery,
  canUpgradeSpecialization,
  getMasteryUpgradeCostFor,
  getSpecializationUpgradeCostFor,
  getTowerStats,
  getTowerUpgradeCost,
} from "@/entities/Tower";
import { getMasteryCosmeticTier, getNextMasteryCosmeticTier, MASTERY_UNLOCK_GEM_COST } from "@/config/towerMastery";
import { getTowerSurvivalDefinition } from "@/config/towerSurvival";
import {
  getMilestoneUnlockForLevel,
  getTowerLevelStats,
  getTowerSpecialAtLevel,
  MAX_TOWER_LEVEL,
  type TowerType,
} from "@/config/towerStats";
import {
  getSpecializationsForTower,
  SPECIALIZATION_CHANGE_GEM_COST,
  SPECIALIZATION_UNLOCK_GEM_COST,
  SPECIALIZATION_UNLOCK_TOWER_LEVEL,
  type SpecializationId,
} from "@/config/specializations";
import { getSkinsForTower } from "@/config/towerSkins";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { CoinIcon, GemIcon } from "./icons";

interface TowerInfoPanelProps {
  tower: TowerInstance;
  gold: number;
  gems: number;
  onUpgrade: () => void;
  onClose: () => void;
  onChooseSpecialization: (id: SpecializationId) => void;
  onUpgradeSpecialization: () => void;
  onEquipSkin: (skinId: string | null) => void;
  /** CORREÇÃO DE REQUISITOS — Gems-only permanent purchase, separate from equip. */
  onPurchaseSkin: (skinId: string) => void;
  /** Whether `skinId` is already permanently owned — reused so this component never needs its own copy of the ownership set. */
  isSkinOwned: (skinId: string) => boolean;
  /** HORDENOVA Season/Progression v1.0 — one-time, PERMANENT Gems unlock, mirroring onChooseSpecialization. Never touches the current (Season-scoped) Mastery level. */
  onUnlockMastery: () => void;
  /** Gold-funded, uncapped upgrade (0 -> 1 -> 2 -> ... forever, resetting to 0 every Season), mirroring onUpgradeSpecialization. */
  onUpgradeMastery: () => void;
  /** Every SpecializationId this account has ever purchased for the selected tower's TYPE — permanent, never reset. A path in this list is free to (re-)choose or switch to. */
  unlockedSpecializationIdsForType: readonly SpecializationId[];
  /** "Trocar Especialização" — 200 Gems, switches to a DIFFERENT path already in `unlockedSpecializationIdsForType`. */
  onSwitchSpecialization: (id: SpecializationId) => void;
}

type Translate = ReturnType<typeof useLanguage>["t"];

/**
 * Upgrade UX — spec section 7. Beyond the current stats, this shows a real
 * "what do I actually get" comparison (current -> next Damage/Attack Speed)
 * and, when the next level is a named unlock (see towerStats.ts
 * MILESTONE_UNLOCKS), a highlighted banner instead of just another number —
 * that's the moment meant to create expectation.
 */
export function TowerInfoPanel({
  tower,
  gold,
  gems,
  onUpgrade,
  onClose,
  onChooseSpecialization,
  onUpgradeSpecialization,
  onEquipSkin,
  onPurchaseSkin,
  isSkinOwned,
  onUnlockMastery,
  onUpgradeMastery,
  unlockedSpecializationIdsForType,
  onSwitchSpecialization,
}: TowerInfoPanelProps) {
  const { t } = useLanguage();
  const theme = TOWER_THEME[tower.type];
  const stats = getTowerStats(tower);
  const survival = getTowerSurvivalDefinition(tower.type);
  const upgradeCost = getTowerUpgradeCost(tower);
  const canAfford = upgradeCost !== null && gold >= upgradeCost;
  const nextLevel = upgradeCost !== null ? tower.level + 1 : null;
  const nextStats = nextLevel !== null ? getTowerLevelStats(tower.type, nextLevel) : null;
  const unlock = nextLevel !== null ? getMilestoneUnlockForLevel(tower.type, nextLevel) : null;

  return (
    <div style={{ ...panelStyle, borderColor: theme.primary, boxShadow: `0 0 22px ${theme.glow}, 0 8px 24px rgba(0,0,0,0.5)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...dotStyle, background: theme.primary, boxShadow: `0 0 8px ${theme.glow}` }} />
          <strong style={{ fontSize: 14, color: PALETTE.uiText, letterSpacing: 0.5 }}>
            {t(`towers.${tower.type}.name`)}
          </strong>
        </div>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: PALETTE.uiTextDim }}>
        {t("towerInfo.level", { level: stats.level, max: MAX_TOWER_LEVEL })}
      </div>
      <div style={{ fontSize: 10.5, color: theme.accent, marginTop: 1 }}>{t(`towers.${tower.type}.role`)}</div>

      <div style={dividerStyle} />
      <Row label={t("towerInfo.damage")} value={stats.damage.toFixed(1)} />
      <Row label={t("towerInfo.attackSpeed")} value={`${stats.attackSpeed.toFixed(2)}/s`} />
      <Row label={t("towerInfo.range")} value={stats.range.toFixed(0)} />
      <Row label={t("towerInfo.hp")} value={`${Math.ceil(tower.hp)} / ${tower.maxHp}`} />
      {survival.maxShield > 0 && <Row label={t("towerInfo.shield")} value={`${Math.ceil(tower.shieldHp)} / ${survival.maxShield}`} />}

      <div style={{ ...sectionLabelStyle, marginTop: 4 }}>{t("towerInfo.special")}</div>
      {renderSpecialLines(tower.type, tower.level, t).map((line) => (
        <div key={line.label}>
          <Row label={line.label} value={line.value} dim={line.locked} />
          {line.note && <div style={{ fontSize: 9.5, color: PALETTE.uiTextDim, marginTop: 1, fontStyle: "italic" }}>{line.note}</div>}
        </div>
      ))}

      {nextStats && upgradeCost !== null ? (
        <>
          <div style={dividerStyle} />
          <div style={sectionLabelStyle}>{t("towerInfo.nextLevel")}</div>
          <ComparisonRow label={t("towerInfo.damage")} from={stats.damage.toFixed(1)} to={nextStats.damage.toFixed(1)} />
          <ComparisonRow
            label={t("towerInfo.attackSpeed")}
            from={`${stats.attackSpeed.toFixed(2)}/s`}
            to={`${nextStats.attackSpeed.toFixed(2)}/s`}
          />

          {unlock && (
            <div style={{ ...unlockBannerStyle, borderColor: theme.primary }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: theme.accent, fontWeight: 700 }}>
                {t("towerInfo.unlockBanner", { level: unlock.level })}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.uiText, marginTop: 2 }}>
                {t(`towerInfo.unlocks.${unlock.key}.name`)}
              </div>
              <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2, lineHeight: 1.35 }}>
                {t(`towerInfo.unlocks.${unlock.key}.description`)}
              </div>
            </div>
          )}

          <button
            onClick={onUpgrade}
            disabled={!canAfford}
            style={{
              ...upgradeButtonStyle,
              borderColor: theme.primary,
              opacity: canAfford ? 1 : 0.5,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {t("towerInfo.upgrade")}
              <span style={{ opacity: 0.6 }}>·</span>
              {t("towerInfo.cost")} <CoinIcon size={11} color={PALETTE.gold} /> {upgradeCost}
            </span>
          </button>
        </>
      ) : (
        <button disabled style={{ ...upgradeButtonStyle, borderColor: theme.primary, opacity: 0.5, marginTop: 10 }}>
          {t("towerInfo.maxLevel")}
        </button>
      )}

      <MasterySection
        tower={tower}
        gold={gold}
        gems={gems}
        theme={theme}
        t={t}
        onUnlock={onUnlockMastery}
        onUpgrade={onUpgradeMastery}
      />

      <SpecializationSection
        tower={tower}
        gold={gold}
        gems={gems}
        theme={theme}
        t={t}
        onChoose={onChooseSpecialization}
        onUpgrade={onUpgradeSpecialization}
        unlockedSpecializationIdsForType={unlockedSpecializationIdsForType}
        onSwitch={onSwitchSpecialization}
      />

      <SkinSection
        tower={tower}
        gems={gems}
        theme={theme}
        t={t}
        onEquip={onEquipSkin}
        onPurchase={onPurchaseSkin}
        isSkinOwned={isSkinOwned}
      />
    </div>
  );
}

/**
 * Master Implementation Pass spec sections 3-6 — TOWER MASTERY: the
 * uncapped sink past MAX_TOWER_LEVEL. Always shown (not gated behind level
 * 30) — a player is free to start investing early if they'd rather spread
 * spending out, exactly like Specialization already allows once its own
 * level gate passes.
 *
 * HORDENOVA Season/Progression v1.0 — Ownership (`tower.masteryUnlocked`,
 * permanent, a one-time Gems purchase) and progression (`tower.
 * masteryLevel`, Season-scoped, Gold-funded, resets to 0 every Season) are
 * fully separate. Unlocking grants ownership FOREVER without touching the
 * level at all — the Gold-upgrade track below then works starting from
 * whatever the level currently is, 0 at the start of every Season, owned or
 * not. Mastery grants real, small, bounded-weighted combat bonuses (see
 * config/towerMastery.ts's getMasteryBonuses — range/gold-efficiency/
 * siege-resistance lead, damage is deliberately the smallest), on top of
 * the cosmetic-tier rewards below.
 */
function MasterySection({
  tower,
  gold,
  gems,
  theme,
  t,
  onUnlock,
  onUpgrade,
}: {
  tower: TowerInstance;
  gold: number;
  gems: number;
  theme: (typeof TOWER_THEME)[TowerType];
  t: Translate;
  onUnlock: () => void;
  onUpgrade: () => void;
}) {
  const currentTier = getMasteryCosmeticTier(tower.masteryLevel);
  const nextTier = getNextMasteryCosmeticTier(tower.masteryLevel);

  if (!tower.masteryUnlocked) {
    const affordable = gems >= MASTERY_UNLOCK_GEM_COST;
    return (
      <>
        <div style={dividerStyle} />
        <div style={sectionLabelStyle}>{t("towerInfo.masterySection")}</div>
        <div style={{ fontSize: 9.5, color: PALETTE.uiTextDim, marginTop: 1, fontStyle: "italic" }}>{t("towerInfo.masteryPrestigeNote")}</div>
        <button
          onClick={onUnlock}
          disabled={!affordable}
          style={{ ...upgradeButtonStyle, borderColor: theme.primary, opacity: affordable ? 1 : 0.5 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {t("towerInfo.masteryUnlock")}
            <span style={{ opacity: 0.6 }}>·</span>
            {t("towerInfo.cost")} <GemIcon size={11} color={PALETTE.gem} /> {MASTERY_UNLOCK_GEM_COST}
          </span>
        </button>
      </>
    );
  }

  const cost = getMasteryUpgradeCostFor(tower);
  const affordable = gold >= cost;
  const canUpgrade = canUpgradeMastery(tower);

  return (
    <>
      <div style={dividerStyle} />
      <div style={sectionLabelStyle}>{t("towerInfo.masterySection")}</div>
      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{t("towerInfo.masteryLevel", { level: tower.masteryLevel })}</div>
      {currentTier && (
        <div style={{ fontSize: 10, color: theme.accent, marginTop: 1 }}>
          {t("towerInfo.masteryCosmeticActive", { name: t(`towerInfo.masteryCosmetic.${currentTier.nameKey}` as TranslationKey) })}
        </div>
      )}
      {nextTier && (
        <div style={{ fontSize: 9.5, color: PALETTE.uiTextDim, marginTop: 1 }}>
          {t("towerInfo.masteryCosmeticNext", {
            name: t(`towerInfo.masteryCosmetic.${nextTier.nameKey}` as TranslationKey),
            level: nextTier.level,
          })}
        </div>
      )}
      {canUpgrade && (
        <button
          onClick={onUpgrade}
          disabled={!affordable}
          style={{ ...upgradeButtonStyle, borderColor: theme.primary, opacity: affordable ? 1 : 0.5 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {t("towerInfo.masteryUpgrade")}
            <span style={{ opacity: 0.6 }}>·</span>
            {t("towerInfo.cost")} <CoinIcon size={11} color={PALETTE.gold} /> {cost}
          </span>
        </button>
      )}
    </>
  );
}

/**
 * HORDENOVA Season/Progression v1.0 — the CHOICE of a path (this section's
 * top half) is free the moment this account already OWNS that path
 * (`unlockedSpecializationIdsForType`, permanent — most commonly true at
 * the start of a new Season, when `specializationId` just reset to null but
 * ownership didn't); choosing a path never owned before still costs
 * SPECIALIZATION_UNLOCK_GEM_COST Gems and grants permanent ownership from
 * then on. Everything past the choice — the specialization's own levels
 * (bottom half) — is unchanged: an independent Gold sink from the tower's
 * own level, well past MAX_TOWER_LEVEL. "Trocar Especialização" (200 Gems)
 * switches between two paths already owned, replacing the old Respec Token
 * system entirely.
 */
function SpecializationSection({
  tower,
  gold,
  gems,
  theme,
  t,
  onChoose,
  onUpgrade,
  unlockedSpecializationIdsForType,
  onSwitch,
}: {
  tower: TowerInstance;
  gold: number;
  gems: number;
  theme: (typeof TOWER_THEME)[TowerType];
  t: Translate;
  onChoose: (id: SpecializationId) => void;
  onUpgrade: () => void;
  unlockedSpecializationIdsForType: readonly SpecializationId[];
  onSwitch: (id: SpecializationId) => void;
}) {
  if (!tower.specializationId) {
    if (!canChooseSpecialization(tower)) {
      if (tower.level >= SPECIALIZATION_UNLOCK_TOWER_LEVEL) return null; // already chosen elsewhere / shouldn't happen
      return (
        <>
          <div style={dividerStyle} />
          <div style={sectionLabelStyle}>{t("towerInfo.specializationSection")}</div>
          <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, fontStyle: "italic" }}>
            {t("towerInfo.specializationLocked", { level: SPECIALIZATION_UNLOCK_TOWER_LEVEL })}
          </div>
        </>
      );
    }

    const options = getSpecializationsForTower(tower.type);
    return (
      <>
        <div style={dividerStyle} />
        <div style={sectionLabelStyle}>{t("towerInfo.specializationSection")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {options.map((option) => {
            const owned = unlockedSpecializationIdsForType.includes(option.id);
            const affordable = owned || gems >= SPECIALIZATION_UNLOCK_GEM_COST;
            return (
              <button
                key={option.id}
                onClick={() => onChoose(option.id)}
                disabled={!affordable}
                style={{ ...specOptionButtonStyle, borderColor: theme.primary, opacity: affordable ? 1 : 0.5 }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: PALETTE.uiText }}>{t(`specializations.${option.id}.name`)}</div>
                <div style={{ fontSize: 9.5, color: PALETTE.uiTextDim, marginTop: 1, lineHeight: 1.3 }}>
                  {t(`specializations.${option.id}.description`)}
                </div>
                <div style={{ fontSize: 10, color: theme.accent, marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {owned ? (
                    t("towerInfo.specializationReactivate")
                  ) : (
                    <>
                      {t("towerInfo.specializationChoose")} · <GemIcon size={10} color={PALETTE.gem} /> {SPECIALIZATION_UNLOCK_GEM_COST}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  const specCost = getSpecializationUpgradeCostFor(tower);
  const specAffordable = specCost !== null && gold >= specCost;
  const canUpgrade = canUpgradeSpecialization(tower);
  const switchTargets = unlockedSpecializationIdsForType.filter((id) => id !== tower.specializationId);
  const switchAffordable = gems >= SPECIALIZATION_CHANGE_GEM_COST;

  return (
    <>
      <div style={dividerStyle} />
      <div style={sectionLabelStyle}>{t("towerInfo.specializationSection")}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{t(`specializations.${tower.specializationId}.name`)}</div>
      <div style={{ fontSize: 10, color: PALETTE.uiTextDim, marginTop: 1, lineHeight: 1.3 }}>
        {t(`specializations.${tower.specializationId}.description`)}
      </div>
      <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2 }}>
        {t("towerInfo.specializationLevel", { level: tower.specializationLevel })}
      </div>
      {canUpgrade && (
        <button
          onClick={onUpgrade}
          disabled={!specAffordable}
          style={{ ...upgradeButtonStyle, borderColor: theme.primary, opacity: specAffordable ? 1 : 0.5 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {t("towerInfo.specializationUpgrade")}
            <span style={{ opacity: 0.6 }}>·</span>
            {t("towerInfo.cost")} <CoinIcon size={11} color={PALETTE.gold} /> {specCost}
          </span>
        </button>
      )}

      {switchTargets.map((id) => (
        <button
          key={id}
          onClick={() => onSwitch(id)}
          disabled={!switchAffordable}
          style={{ ...switchButtonStyle, borderColor: theme.accent, opacity: switchAffordable ? 1 : 0.5 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {t("towerInfo.specializationSwitch", { name: t(`specializations.${id}.name`) })}
            <span style={{ opacity: 0.6 }}>·</span>
            <GemIcon size={10} color={PALETTE.gem} /> {SPECIALIZATION_CHANGE_GEM_COST}
          </span>
        </button>
      ))}
    </>
  );
}

/**
 * Progression 2.0 — Tower Skins (spec section 10/11). Cosmetic only:
 * equipping/clearing never appears in this component's gold math.
 *
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE): a skin now has 3 distinct
 * states instead of 2 — LOCKED (tower hasn't reached unlockLevel this
 * Season yet), PURCHASABLE (level reached, not yet bought — costs Gems),
 * and OWNED (bought once, permanent forever after, equippable any Season
 * regardless of the tower's current level).
 */
function SkinSection({
  tower,
  gems,
  theme,
  t,
  onEquip,
  onPurchase,
  isSkinOwned,
}: {
  tower: TowerInstance;
  gems: number;
  theme: (typeof TOWER_THEME)[TowerType];
  t: Translate;
  onEquip: (skinId: string | null) => void;
  onPurchase: (skinId: string) => void;
  isSkinOwned: (skinId: string) => boolean;
}) {
  const skins = getSkinsForTower(tower.type);
  if (skins.length === 0) return null;

  return (
    <>
      <div style={dividerStyle} />
      <div style={sectionLabelStyle}>{t("towerInfo.skinSection")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        <button
          onClick={() => onEquip(null)}
          style={{
            ...skinChipStyle,
            borderColor: tower.equippedSkinId === null ? theme.accent : PALETTE.uiPanelBorder,
            opacity: 1,
          }}
        >
          {t("towerInfo.skinDefault")}
        </button>
        {skins.map((skin) => {
          const owned = isSkinOwned(skin.id);
          const equipped = tower.equippedSkinId === skin.id;
          const reachedLevel = tower.level >= skin.unlockLevel;
          const affordable = gems >= skin.gemCost;

          if (owned) {
            return (
              <button
                key={skin.id}
                onClick={() => onEquip(skin.id)}
                title={t(`towerSkins.${skin.id}.description` as TranslationKey)}
                style={{ ...skinChipStyle, borderColor: equipped ? theme.accent : PALETTE.uiPanelBorder, opacity: 1 }}
              >
                {t(`towerSkins.${skin.id}.name` as TranslationKey)}
              </button>
            );
          }

          if (reachedLevel) {
            return (
              <button
                key={skin.id}
                onClick={() => affordable && onPurchase(skin.id)}
                disabled={!affordable}
                title={t(`towerSkins.${skin.id}.description` as TranslationKey)}
                style={{ ...skinChipStyle, borderColor: PALETTE.uiPanelBorder, opacity: affordable ? 1 : 0.55 }}
              >
                {t(`towerSkins.${skin.id}.name` as TranslationKey)}
                <span style={{ marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  <GemIcon size={9} color={PALETTE.gem} /> {skin.gemCost}
                </span>
              </button>
            );
          }

          return (
            <button
              key={skin.id}
              disabled
              title={t(`towerSkins.${skin.id}.description` as TranslationKey)}
              style={{ ...skinChipStyle, borderColor: PALETTE.uiPanelBorder, opacity: 0.45 }}
            >
              {t(`towerSkins.${skin.id}.name` as TranslationKey)}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>({t("towerInfo.skinLockedUntil", { level: skin.unlockLevel })})</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

interface SpecialLine {
  label: string;
  value: string;
  locked?: boolean;
  /** Optional short, non-prescriptive context line shown under this stat (e.g. why Boss Damage matters) — never a "you must build N of these" instruction. */
  note?: string;
}

/** Per-type dynamic specialization readout — real current values, not just the static role blurb. */
function renderSpecialLines(type: TowerType, level: number, t: Translate): SpecialLine[] {
  const special = getTowerSpecialAtLevel(type, level);

  switch (special.type) {
    case "IRONWOOD":
      return [
        { label: t("towerInfo.specialLines.IRONWOOD.critChance"), value: `${Math.round(special.critChance * 100)}%` },
        { label: t("towerInfo.specialLines.IRONWOOD.critMultiplier"), value: `${special.critMultiplier.toFixed(2)}x` },
        special.bossDamageMultiplier > 1
          ? {
              label: t("towerInfo.specialLines.IRONWOOD.bossDamageMultiplier"),
              value: `+${Math.round((special.bossDamageMultiplier - 1) * 100)}%`,
              note: t("towerInfo.specialLines.IRONWOOD.bossDamageNote"),
            }
          : {
              label: t("towerInfo.specialLines.IRONWOOD.bossDamageMultiplier"),
              value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 15 }),
              locked: true,
              note: t("towerInfo.specialLines.IRONWOOD.bossDamageNote"),
            },
      ];
    case "INFERNO":
      return [
        { label: t("towerInfo.specialLines.INFERNO.burnDamagePerSecond"), value: special.burnDamagePerSecond.toFixed(1) },
        { label: t("towerInfo.specialLines.INFERNO.aoeRadius"), value: special.aoeRadius.toFixed(0) },
        { label: t("towerInfo.specialLines.INFERNO.burnMaxStacks"), value: `x${special.burnMaxStacks}` },
      ];
    case "FROSTBORN":
      return [
        { label: t("towerInfo.specialLines.FROSTBORN.slowPercent"), value: `${Math.round(special.slowPercent * 100)}%` },
        special.freezeChance > 0
          ? { label: t("towerInfo.specialLines.FROSTBORN.freezeChance"), value: `${Math.round(special.freezeChance * 100)}%` }
          : { label: t("towerInfo.specialLines.FROSTBORN.freezeChance"), value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 10 }), locked: true },
      ];
    case "STORMCALLER":
      return [
        { label: t("towerInfo.specialLines.STORMCALLER.chainTargets"), value: String(special.chainTargets) },
        special.armorPenetration > 0
          ? { label: t("towerInfo.specialLines.STORMCALLER.armorPenetration"), value: `${Math.round(special.armorPenetration * 100)}%` }
          : { label: t("towerInfo.specialLines.STORMCALLER.armorPenetration"), value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 10 }), locked: true },
      ];
  }
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ color: dim ? PALETTE.uiTextDim : PALETTE.uiText, fontWeight: dim ? 500 : 600, fontStyle: dim ? "italic" : "normal" }}>
        {value}
      </span>
    </div>
  );
}

function ComparisonRow({ label, from, to }: { label: string; from: string; to: string }): ReactNode {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: PALETTE.uiTextDim }}>{from}</span>
        <span style={{ color: PALETTE.uiTextDim }}>→</span>
        <span style={{ color: PALETTE.success, fontWeight: 700 }}>{to}</span>
      </span>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 232,
  padding: 14,
  borderRadius: 10,
  border: "1px solid",
  background: `linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))`,
  color: PALETTE.uiText,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxHeight: "calc(100% - 32px)",
  overflowY: "auto",
};

const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: PALETTE.uiPanelBorder,
  margin: "4px 0 2px",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 2,
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};

const upgradeButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
};

const switchButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px dashed",
  background: "rgba(255,255,255,0.02)",
  color: PALETTE.uiText,
  fontWeight: 600,
  fontSize: 10.5,
  letterSpacing: 0.4,
};

const unlockBannerStyle: CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid",
  background: "rgba(255,210,87,0.1)",
};

const specOptionButtonStyle: CSSProperties = {
  padding: "7px 9px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  textAlign: "left",
  cursor: "pointer",
};

const skinChipStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  fontSize: 10.5,
  fontWeight: 600,
  cursor: "pointer",
};
