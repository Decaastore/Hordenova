import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { ENEMY_DEFINITIONS, ENEMY_TYPES, type EnemyType } from "@/config/enemyStats";
import { MAIN_BOSSES, MINI_BOSSES, type BossDefinition } from "@/config/bossConfig";
import { PHASES } from "@/config/phaseConfig";
import { DROP_TABLES } from "@/config/dropTables";
import { ENRAGE_SHIELD_DAMAGE_REDUCTION } from "@/config/enrageShield";
import { CreaturePortrait, hasCreatureArt } from "@/ui/CreaturePortrait";
import { ItemGlyph } from "@/ui/ItemGlyph";
import { CORE_PHASE_COUNT, phaseOfMainBoss, phaseOfMiniBoss } from "./wikiData";

const ENRAGE_HP_PERCENT = 30;
const ENRAGE_SPEED_BONUS = 40;

type Filter = "ALL" | "CORE" | string;

const CORE_TYPES: EnemyType[] = ENEMY_TYPES.filter((type) => PHASES.slice(0, CORE_PHASE_COUNT).some((p) => p.enemyPool.includes(type)));
const EXPANSION = PHASES.slice(CORE_PHASE_COUNT);

export function BestiaryPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>("ALL");
  const phaseName = (i18nKey: string) => t(`phases.${i18nKey}.name` as TranslationKey);

  const groups = [
    { id: "core", key: "CORE", title: t("wiki.corePhases", { from: 1, to: CORE_PHASE_COUNT }), subtitle: PHASES.slice(0, CORE_PHASE_COUNT).map((p) => phaseName(p.i18nKey)).join(", "), types: CORE_TYPES, biome: null as string | null },
    ...EXPANSION.map((p, i) => ({
      id: p.id,
      key: p.id,
      title: t("wiki.phaseTitle", { number: CORE_PHASE_COUNT + i + 1, name: phaseName(p.i18nKey) }),
      subtitle: t(`phases.${p.i18nKey}.tagline` as TranslationKey),
      types: [...p.enemyPool],
      biome: p.biomeId as string | null,
    })),
  ];
  const shown = groups.filter((g) => filter === "ALL" || filter === g.key);

  return (
    <div>
      <div className="wk-chips" role="toolbar" aria-label={t("wiki.filterPhase")}>
        <button className={filter === "ALL" ? "is-on" : ""} onClick={() => setFilter("ALL")}>
          {t("wiki.filterAll")}
        </button>
        <button className={filter === "CORE" ? "is-on" : ""} onClick={() => setFilter("CORE")}>
          {t("wiki.filterCore", { from: 1, to: CORE_PHASE_COUNT })}
        </button>
        {EXPANSION.map((p, i) => (
          <button key={p.id} className={filter === p.id ? "is-on" : ""} onClick={() => setFilter(p.id)}>
            {CORE_PHASE_COUNT + i + 1}. {phaseName(p.i18nKey)}
          </button>
        ))}
      </div>

      {shown.map((g) => (
        <section key={g.id} id={`phase-${g.id}`} className="wk-group">
          <header className="wk-group-head">
            <h3>{g.title}</h3>
            <p>{g.subtitle}</p>
          </header>
          {g.id === "core" && <p className="wk-note">{t("wiki.coreVariantsHint")}</p>}
          <div className="wk-rows">
            {g.types.map((type) => (
              <CreatureRow key={type} type={type} biome={g.biome} showVariants={g.id === "core"} />
            ))}
          </div>
        </section>
      ))}

      <section className="wk-group" id="bosses">
        <header className="wk-group-head">
          <h3>{t("wiki.mainBosses")}</h3>
          <p>{t("wiki.enrageNote", { hp: ENRAGE_HP_PERCENT, speed: ENRAGE_SPEED_BONUS, reduction: Math.round(ENRAGE_SHIELD_DAMAGE_REDUCTION.MAIN_BOSS * 100) })}</p>
        </header>
        <div className="wk-rows">
          {Object.values(MAIN_BOSSES).map((boss) => (
            <BossRow key={boss.id} boss={boss} />
          ))}
        </div>
      </section>

      <section className="wk-group">
        <header className="wk-group-head">
          <h3>{t("wiki.miniBosses")}</h3>
          <p>{t("wiki.miniBossesHint", { reduction: Math.round(ENRAGE_SHIELD_DAMAGE_REDUCTION.MINI_BOSS * 100) })}</p>
        </header>
        <div className="wk-rows">
          {Object.values(MINI_BOSSES).map((boss) => (
            <BossRow key={boss.id} boss={boss} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CreatureRow({ type, biome, showVariants }: { type: EnemyType; biome: string | null; showVariants: boolean }) {
  const { t } = useLanguage();
  const def = ENEMY_DEFINITIONS[type];
  const name = t(`enemies.${type}.name` as TranslationKey);
  return (
    <article className="wk-row hn-walk-trigger" id={`enemy-${type}`} tabIndex={0}>
      <div className="wk-row-art">
        <CreaturePortrait type={type} biomeId={biome} size={84} />
      </div>
      <div className="wk-row-main">
        <h4>{name}</h4>
        <p>{t(`enemies.${type}.description` as TranslationKey)}</p>
        <p className="wk-weak">
          <span>{t("wiki.weakness")}</span> {t(`enemies.${type}.weakness` as TranslationKey)}
        </p>
        {showVariants && (
          <div className="wk-variants">
            {PHASES.slice(0, CORE_PHASE_COUNT)
              .filter((p) => hasCreatureArt(type, p.biomeId))
              .map((p) => (
                <CreaturePortrait key={p.id} type={type} biomeId={p.biomeId} size={40} title={t(`phases.${p.i18nKey}.name` as TranslationKey)} />
              ))}
          </div>
        )}
      </div>
      <dl className="wk-row-stats">
        <div>
          <dt>{t("wiki.hp")}</dt>
          <dd>{def.baseHp}</dd>
        </div>
        <div>
          <dt>{t("wiki.speed")}</dt>
          <dd>{def.baseSpeed}</dd>
        </div>
        <div>
          <dt>{t("wiki.armor")}</dt>
          <dd>{def.damageReduction > 0 ? `${Math.round(def.damageReduction * 100)}%` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.regen")}</dt>
          <dd>{def.regenPercentPerSecond > 0 ? `${(def.regenPercentPerSecond * 100).toFixed(1)}%/s` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.goldShort")}</dt>
          <dd>{def.goldReward}</dd>
        </div>
      </dl>
    </article>
  );
}

function BossRow({ boss }: { boss: BossDefinition }) {
  const { t } = useLanguage();
  const drops = boss.dropTableId ? (DROP_TABLES[boss.dropTableId]?.entries ?? []) : [];
  const home = boss.isMainBoss ? phaseOfMainBoss(boss.id) : phaseOfMiniBoss(boss.id);
  const where = home
    ? t(boss.isMainBoss ? "wiki.bossOfPhase" : "wiki.miniBossOfPhase", { number: home.number, name: t(`phases.${home.phase.i18nKey}.name` as TranslationKey) })
    : t("wiki.miniBossRotation", { from: 1, to: CORE_PHASE_COUNT });
  return (
    <article className="wk-row is-boss" id={`boss-${boss.id}`}>
      <div className="wk-row-main">
        <p className="wk-where">{where}</p>
        <h4>{t(`bosses.${boss.i18nKey}.name` as TranslationKey)}</h4>
        <p>
          <strong>{t(`wiki.abilities.${boss.ability}.name` as TranslationKey)}.</strong>{" "}
          {t(`wiki.abilities.${boss.ability}.description` as TranslationKey, { seconds: Math.round(boss.abilityIntervalMs / 100) / 10 })}
        </p>
        {drops.length > 0 ? (
          <div className="wk-drops">
            {drops.map((entry) => (
              <span key={entry.itemId} className="wk-drop" title={t(`items.${entry.itemId}.name` as TranslationKey)}>
                <ItemGlyph itemDefinitionId={entry.itemId} size={28} />
                <span>{t(`items.${entry.itemId}.name` as TranslationKey)}</span>
                <small>{entry.weightPercent}%</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="wk-note">{t("wiki.noDropTable")}</p>
        )}
      </div>
      <dl className="wk-row-stats">
        <div>
          <dt>{t("wiki.hpShort")}</dt>
          <dd>×{boss.hpMultiplierVsBrute}</dd>
        </div>
        <div>
          <dt>{t("wiki.speed")}</dt>
          <dd>{boss.speed}</dd>
        </div>
        <div>
          <dt>{t("wiki.resistance")}</dt>
          <dd>{boss.resistance > 0 ? `${Math.round(boss.resistance * 100)}%` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.regen")}</dt>
          <dd>{boss.regenPercentPerSecond > 0 ? `${(boss.regenPercentPerSecond * 100).toFixed(1)}%/s` : "—"}</dd>
        </div>
        <div>
          <dt>{t("wiki.goldShort")}</dt>
          <dd>{boss.goldReward}</dd>
        </div>
      </dl>
    </article>
  );
}
