import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TOWER_TYPES, MAX_TOWER_LEVEL, getTowerLevelStats } from "@/config/towerStats";
import { CASTLE_TIERS } from "@/config/castleConfig";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { ITEM_DEFINITIONS, ITEM_TYPES } from "@/config/itemDefinitions";
import { RARITIES, getRarityDefinition } from "@/config/rarity";
import { getMasteryUnlockGoldCost, getMasteryUpgradeCost, MASTERY_COSMETIC_TIERS } from "@/config/towerMastery";
import { GOLD_SINKS } from "@/config/goldSinks";
import { GEM_SINKS } from "@/config/gemSinks";
import { getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";
import { SEASON_DURATION_MS } from "@/engine/SeasonClock";
import { ItemGlyph } from "@/ui/ItemGlyph";
import { bossesDroppingItem } from "./wikiData";

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export function CastlePage() {
  const { t } = useLanguage();
  return (
    <div>
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.hpTiers")}</h3>
        <p className="wk-note">{t("wiki.hpTiersHint")}</p>
        <ol className="wk-castle-tiers">
          {CASTLE_TIERS.map((tier, i) => {
            const lower = CASTLE_TIERS[i + 1]?.maxHpPercent;
            const range =
              tier.maxHpPercent === 0
                ? t("wiki.castleCollapsed")
                : t("wiki.castleRange", { from: lower === undefined ? 0 : Math.round(lower * 100) + 1, to: Math.round(tier.maxHpPercent * 100) });
            return (
              <li key={tier.tier}>
                <div className="wk-castle-art">
                  {tier.tier <= 4 ? <img src={`${assetBase}sprites/castle/ancient_forest_${tier.tier}.webp`} alt="" loading="lazy" /> : <span className="wk-castle-ruin" aria-hidden="true" />}
                </div>
                <h4>{t(`castleTiers.${tier.i18nKey}` as TranslationKey)}</h4>
                <p>{range}</p>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.skins")}</h3>
        <p className="wk-note">{t("wiki.skinsHint")}</p>
        <ul className="wk-list">
          {CASTLE_SKINS.map((skin) => (
            <li key={skin.id}>
              <span className="wk-swatch" style={{ background: `linear-gradient(135deg, ${skin.paletteOverride.rock ?? "#8a7a64"}, ${skin.paletteOverride.rockDark ?? "#3a3026"})` }} aria-hidden="true" />
              <div>
                <h4>{t(`castleSkins.${skin.i18nKey}.name` as TranslationKey)}</h4>
                <p>{t(`castleSkins.${skin.i18nKey}.description` as TranslationKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ItemsPage() {
  const { t } = useLanguage();
  const order = [...RARITIES].reverse();
  const items = [...ITEM_TYPES].sort((a, b) => order.indexOf(ITEM_DEFINITIONS[a].rarity) - order.indexOf(ITEM_DEFINITIONS[b].rarity));
  return (
    <div className="wk-rows is-top">
      {items.map((id) => {
        const def = ITEM_DEFINITIONS[id];
        const rarity = getRarityDefinition(def.rarity);
        const sources = bossesDroppingItem(id);
        return (
          <article key={id} id={`item-${id}`} className="wk-row is-item">
            <div className="wk-row-art is-item">
              <ItemGlyph itemDefinitionId={id} size={64} />
            </div>
            <div className="wk-row-main">
              <p className="wk-rarity" style={{ color: rarity.color }}>
                {t(`rarity.${rarity.id}` as TranslationKey)}, {t(`itemCategory.${def.category}` as TranslationKey)}
              </p>
              <h4>{t(`items.${id}.name` as TranslationKey)}</h4>
              <p>{t(`items.${id}.description` as TranslationKey)}</p>
              <p className="wk-effects">
                {def.effects.map((e) => (
                  <span key={e.kind}>{t(`itemEffect.${e.kind}` as TranslationKey, { value: e.value })}</span>
                ))}
              </p>
              <p className="wk-note">
                {sources.length > 0
                  ? t("wiki.droppedBy", { names: sources.map((b) => t(`bosses.${b.i18nKey}.name` as TranslationKey)).join(", ") })
                  : t("wiki.noSource")}
              </p>
            </div>
            <dl className="wk-row-stats is-narrow">
              <div>
                <dt>{t("wiki.trade")}</dt>
                <dd>{def.tradable ? t("wiki.tradable") : t("wiki.notTradable")}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

const MASTERY_SAMPLE_LEVELS = [1, 5, 10, 20, 30, 60, 100];

export function ProgressionPage() {
  const { t } = useLanguage();
  return (
    <div>
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.masteryTitle")}</h3>
        <p className="wk-prose">{t("wiki.masteryHint")}</p>
        <div className="wk-table-wrap">
          <table className="wk-table">
            <thead>
              <tr>
                <th scope="col">{t("wiki.masteryLevelCol")}</th>
                {TOWER_TYPES.map((type) => (
                  <th key={type} scope="col">
                    {t(`towers.${type}.name` as TranslationKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="is-strong">
                <th scope="row">{t("wiki.masteryUnlockRow")}</th>
                {TOWER_TYPES.map((type) => (
                  <td key={type}>{getMasteryUnlockGoldCost(type).toLocaleString()}</td>
                ))}
              </tr>
              {MASTERY_SAMPLE_LEVELS.map((level) => (
                <tr key={level}>
                  <th scope="row">{t("wiki.masteryStep", { from: level, to: level + 1 })}</th>
                  {TOWER_TYPES.map((type) => (
                    <td key={type}>{getMasteryUpgradeCost(type, level).toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wk-note">{t("wiki.goldNote")}</p>
      </section>
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.masteryCosmeticTiersTitle")}</h3>
        <ol className="wk-timeline">
          {MASTERY_COSMETIC_TIERS.map((tier) => (
            <li key={tier.id} className="is-reached">
              <span className="wk-timeline-level">{t("wiki.levelShort", { level: tier.level })}</span>
              <span className="wk-timeline-name">{t(`towerInfo.masteryCosmetic.${tier.nameKey}` as TranslationKey)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function EconomyPage() {
  const { t } = useLanguage();
  return (
    <div className="wk-two">
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.goldSinksTitle")}</h3>
        <ul className="wk-list">
          {GOLD_SINKS.map((sink) => (
            <li key={sink.id}>
              <div>
                <h4>
                  {t(`goldSinks.${sink.i18nKey}.name` as TranslationKey)} <span className="wk-pill">{sink.uncapped ? t("wiki.uncapped") : t("wiki.finite")}</span>
                </h4>
                <p>{t(`goldSinks.${sink.i18nKey}.description` as TranslationKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="wk-block">
        <h3 className="wk-h3">{t("wiki.gemSinksTitle")}</h3>
        <ul className="wk-list">
          {GEM_SINKS.map((sink) => (
            <li key={sink.id}>
              <div>
                <h4>
                  {t(`gemSinks.${sink.i18nKey}.name` as TranslationKey)}{" "}
                  <span className={`wk-pill${sink.implemented ? "" : " is-dim"}`}>
                    {sink.implemented ? (sink.uncapped ? t("wiki.uncapped") : t("wiki.finite")) : t("wiki.underDevelopment")}
                  </span>
                </h4>
                <p>{t(`gemSinks.${sink.i18nKey}.description` as TranslationKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AscensionPage() {
  const { t } = useLanguage();
  const ranks: AscensionRank[] = [1, 2, 3, 4, 5];
  const days = Math.round(SEASON_DURATION_MS / (24 * 60 * 60 * 1000));
  return (
    <div>
      <dl className="wk-figures is-wide">
        <div>
          <dt>{t("wiki.seasonLength")}</dt>
          <dd>{t("wiki.daysValue", { days })}</dd>
        </div>
      </dl>
      <p className="wk-prose">{t("wiki.top5Rewards")}</p>
      <div className="wk-table-wrap">
        <table className="wk-table">
          <thead>
            <tr>
              <th scope="col">{t("wiki.rankCol")}</th>
              <th scope="col">{t("wiki.titleCol")}</th>
              <th scope="col">{t("wiki.gemsCol")}</th>
              <th scope="col">{t("wiki.cosmeticsCol")}</th>
            </tr>
          </thead>
          <tbody>
            {ranks.map((rank) => {
              const bundle = getSeasonRewardBundle(1, rank);
              return (
                <tr key={rank}>
                  <th scope="row">#{rank}</th>
                  <td>{t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)}</td>
                  <td>{bundle.gems}</td>
                  <td>{bundle.cosmetics.length > 0 ? bundle.cosmetics.map((c) => t(`ascension.cosmeticTypes.${c.type}` as TranslationKey)).join(", ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PROJECTION_LEVELS = [1, 5, 10, 15, 20, 25, 30, 40, 50, MAX_TOWER_LEVEL];

export function ProjectionsPage() {
  const { t } = useLanguage();
  return (
    <div className="wk-two">
      {TOWER_TYPES.map((type) => (
        <section key={type} className="wk-block">
          <h3 className="wk-h3">{t(`towers.${type}.name` as TranslationKey)}</h3>
          <div className="wk-table-wrap">
            <table className="wk-table is-numeric">
              <thead>
                <tr>
                  <th scope="col">{t("wiki.level")}</th>
                  <th scope="col">{t("wiki.damage")}</th>
                  <th scope="col">{t("wiki.attackSpeed")}</th>
                  <th scope="col">{t("wiki.range")}</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTION_LEVELS.map((level) => {
                  const s = getTowerLevelStats(type, level);
                  return (
                    <tr key={level}>
                      <th scope="row">{level}</th>
                      <td>{s.damage.toFixed(1)}</td>
                      <td>{s.attackSpeed.toFixed(2)}</td>
                      <td>{s.range.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
