import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import {
  TOWER_DEFINITIONS,
  TOWER_TYPES,
  MAX_TOWER_LEVEL,
  TOWER_VISUAL_STAGE_COUNT,
  getTowerLevelStats,
  getTowerSpecialAtLevel,
  getTowerVisualStage,
  getUpgradeCost,
  getMilestoneUnlockForLevel,
  type TowerType,
} from "@/config/towerStats";
import { SPECIALIZATIONS_BY_TOWER, SPECIALIZATION_UNLOCK_TOWER_LEVEL } from "@/config/specializations";
import { dualGemPrice } from "@/config/gemsEconomy";
import { PRESTIGE_MILESTONE_REWARDS } from "@/config/prestige";
import { TowerPortrait } from "@/ui/TowerPortrait";
import { skinsForTower } from "./wikiData";

type Translate = ReturnType<typeof useLanguage>["t"];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;

/** The tower's own special numbers at a level, as labelled, formatted rows. */
function specialRows(type: TowerType, level: number, t: Translate): [string, string][] {
  const s = getTowerSpecialAtLevel(type, level);
  const L = (k: string) => t(`wiki.special.${k}` as TranslationKey);
  switch (s.type) {
    case "IRONWOOD":
      return [
        [L("critChance"), pct(s.critChance)],
        [L("critMultiplier"), `×${s.critMultiplier}`],
        [L("bossDamageMultiplier"), s.bossDamageMultiplier > 1 ? `+${Math.round((s.bossDamageMultiplier - 1) * 100)}%` : "—"],
      ];
    case "INFERNO":
      return [
        [L("aoeRadius"), String(Math.round(s.aoeRadius))],
        [L("burnDamagePerSecond"), String(s.burnDamagePerSecond)],
        [L("burnDurationMs"), secs(s.burnDurationMs)],
        [L("burnMaxStacks"), String(s.burnMaxStacks)],
      ];
    case "FROSTBORN":
      return [
        [L("slowPercent"), pct(s.slowPercent)],
        [L("slowDurationMs"), secs(s.slowDurationMs)],
        [L("freezeChance"), s.freezeChance > 0 ? pct(s.freezeChance) : "—"],
        [L("freezeDurationMs"), s.freezeChance > 0 ? secs(s.freezeDurationMs) : "—"],
      ];
    case "STORMCALLER":
      return [
        [L("chainTargets"), String(s.chainTargets)],
        [L("chainFalloff"), pct(s.chainFalloff)],
        [L("armorPenetration"), s.armorPenetration > 0 ? pct(s.armorPenetration) : "—"],
      ];
  }
}

function milestonesFor(type: TowerType) {
  const out: { level: number; key: string }[] = [];
  for (let l = 1; l <= MAX_TOWER_LEVEL; l++) {
    const m = getMilestoneUnlockForLevel(type, l);
    if (m) out.push({ level: m.level, key: m.key });
  }
  return out;
}

const PRESTIGE_SKIN_LEVEL = PRESTIGE_MILESTONE_REWARDS.find((r) => r.type === "TOWER_SKIN")?.level ?? 50;

const STAGE_MARKS = Array.from({ length: TOWER_VISUAL_STAGE_COUNT }, (_, i) => i * 10 + 1);

export function TowersPage({ tower, onTower }: { tower: TowerType; onTower: (t: TowerType) => void }) {
  const { t, language } = useLanguage();
  const locale = language === "ptBR" ? "pt-BR" : "en-US";
  const [level, setLevel] = useState(MAX_TOWER_LEVEL);
  const def = TOWER_DEFINITIONS[tower];
  const stats = getTowerLevelStats(tower, level);
  const next = getUpgradeCost(tower, level);
  const stage = getTowerVisualStage(level);

  return (
    <div>
      <div className="wk-tower-tabs" role="tablist">
        {TOWER_TYPES.map((type) => (
          <button key={type} role="tab" aria-selected={type === tower} className={`wk-tower-tab${type === tower ? " is-active" : ""}`} onClick={() => onTower(type)}>
            <TowerPortrait type={type} level={MAX_TOWER_LEVEL} width={64} height={64} zoom={1.2} baseY={0.8} />
            <span>{t(`towers.${type}.name` as TranslationKey)}</span>
          </button>
        ))}
      </div>

      <article className="wk-tower" id={`tower-${tower}`}>
        <div className="wk-tower-stage">
          <TowerPortrait key={tower} type={tower} level={level} width={300} height={300} zoom={3.1} baseY={0.74} />
          <label className="wk-slider">
            <span className="wk-slider-head">
              <span>{t("wiki.towerLevel")}</span>
              <strong>{level}</strong>
            </span>
            <input type="range" min={1} max={MAX_TOWER_LEVEL} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label={t("wiki.towerLevel")} />
            <span className="wk-slider-marks" aria-hidden="true">
              {STAGE_MARKS.map((m) => (
                <button key={m} type="button" tabIndex={-1} onClick={() => setLevel(m)} className={getTowerVisualStage(m) === stage ? "is-on" : ""}>
                  {m}
                </button>
              ))}
            </span>
            <span className="wk-slider-note">{t("wiki.visualStage", { stage, total: TOWER_VISUAL_STAGE_COUNT })}</span>
          </label>
        </div>

        <div className="wk-tower-info">
          <h2>{t(`towers.${tower}.name` as TranslationKey)}</h2>
          <p className="wk-role">{t(`towers.${tower}.role` as TranslationKey)}</p>
          <p className="wk-lead">{t(`towers.${tower}.description` as TranslationKey)}</p>

          <h3 className="wk-h3">{t("wiki.atLevel", { level })}</h3>
          <dl className="wk-figures">
            <div>
              <dt>{t("wiki.damage")}</dt>
              <dd>{stats.damage.toFixed(1)}</dd>
            </div>
            <div>
              <dt>{t("wiki.attackSpeed")}</dt>
              <dd>{stats.attackSpeed.toFixed(2)}</dd>
            </div>
            <div>
              <dt>{t("wiki.range")}</dt>
              <dd>{Math.round(stats.range)}</dd>
            </div>
            {specialRows(tower, level, t).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="wk-meta">
            {t("wiki.buildCostValue", { gold: def.buildCost })}
            {"  "}
            <span className="wk-sep" aria-hidden="true" />
            {next !== null ? t("wiki.nextUpgradeValue", { gold: next }) : t("wiki.maxLevelReached")}
          </p>
        </div>
      </article>

      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.milestones")}</h3>
        <ol className="wk-timeline">
          {milestonesFor(tower).map((m) => (
            <li key={m.key} className={level >= m.level ? "is-reached" : ""}>
              <span className="wk-timeline-level">{t("wiki.levelShort", { level: m.level })}</span>
              <span className="wk-timeline-name">{t(`towerInfo.unlocks.${m.key}.name` as TranslationKey)}</span>
              <span className="wk-timeline-desc">{t(`towerInfo.unlocks.${m.key}.description` as TranslationKey)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.specializationPaths")}</h3>
        <p className="wk-note">{t("wiki.specializationHint", { level: SPECIALIZATION_UNLOCK_TOWER_LEVEL })}</p>
        <div className="wk-specs">
          {SPECIALIZATIONS_BY_TOWER[tower].map((spec) => (
            <div key={spec.id} id={`spec-${spec.id}`} className="wk-spec">
              <h4>{t(`specializations.${spec.id}.name` as TranslationKey)}</h4>
              <p>{t(`specializations.${spec.id}.description` as TranslationKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.skins")}</h3>
        <p className="wk-note">{t("wiki.towerSkinsHint")}</p>
        <div className="wk-skins">
          {skinsForTower(tower).map((skin) => {
            const price = dualGemPrice(skin.gemCost);
            return (
              <div key={skin.id} id={`skin-${skin.id}`} className="wk-skin">
                <div className="wk-skin-art">
                  <TowerPortrait type={tower} level={MAX_TOWER_LEVEL} skinId={skin.id} width={180} height={180} zoom={2} baseY={0.7} />
                </div>
                <span className={`wk-tier is-${skin.tier.toLowerCase()}`}>{t(`wiki.skinTier.${skin.tier}` as TranslationKey)}</span>
                <h4>{t(`towerSkins.${skin.i18nKey}.name` as TranslationKey)}</h4>
                <p className="wk-skin-price">
                  {skin.tier === "PRESTIGE"
                    ? t("wiki.prestigeSkinUnlock", { level: PRESTIGE_SKIN_LEVEL })
                    : t("wiki.skinPrice", { purchased: price.purchased.toLocaleString(locale), free: price.free.toLocaleString(locale), level: skin.unlockLevel })}
                </p>
                <p className="wk-skin-desc">{t(`towerSkins.${skin.i18nKey}.description` as TranslationKey)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
