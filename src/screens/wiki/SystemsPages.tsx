import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { MAX_TOWERS_ON_MAP, MAX_TOWERS_PER_TYPE } from "@/data/mapLayouts";
import { WAVES_PER_PHASE } from "@/config/wavePhase";
import { FREE_REPOSITIONS_PER_DAY, REPOSITION_GEM_COST } from "@/config/repositioning";
import { BOSS_RETREAT_RECOVERY, FIRST_ASSAULT_BONUS_SHARDS, FIRST_ASSAULT_GOLD_MULTIPLIER, SIEGE_WAVES, WEAKNESS_DAMAGE_MULTIPLIER } from "@/config/bossAssault";
import { SIEGE_DAMAGE_FRACTION_OF_MAX_HP, SIEGE_INTERVAL_MS } from "@/config/bossSiege";
import { MANA_OVERCHARGE_MAX, MANA_MAX, MANA_UPGRADE_GAIN_PER_LEVEL, MANA_UPGRADE_MAX_LEVEL, SKIN_MANA_GAIN_BONUS } from "@/config/towerMana";
import { ROULETTE_ENTRIES, ROULETTE_MILESTONE_INTERVAL } from "@/config/roulette";
import { MAX_OFFLINE_CAPACITY_MS, OFFLINE_GOLD_SHARE, OFFLINE_PACE } from "@/engine/OfflineDefense";
import { MISSION_POOL, MISSION_REWARD_KILLS_WORTH_OF_GOLD, MISSION_REWARD_SHARDS, MISSIONS_PER_DAY } from "@/config/dailyMissions";
import { freeRewardForLevel, PASS_LEVELS, PASS_XP, PASS_XP_PER_LEVEL, premiumRewardForLevel, PREMIUM_PASS_PRICE_BRL } from "@/config/seasonPass";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS, gemPackTotal, REAL_MONEY_PAYMENTS_ENABLED, STARTER_PACK } from "@/config/store";
import { SKIN_REWARD_BONUS_PER_TYPE } from "@/config/towerSkins";
import { seasonClock } from "@/engine/SeasonClock";
import { RewardPartsLabel } from "@/ui/RewardPartsLabel";
import { ADAPTATION_FAIR_SHARE, ADAPTATION_MAX_RESIST, ADAPTATION_START_WAVE, ADAPTATION_WEAKNESS_RATIO } from "@/config/hordeAdaptation";
import { CITY_BUILDINGS, CITY_REBUILD_WAVES } from "@/config/city";

const pct = (x: number) => Math.round(x * 100);

/**
 * BATALHA — the rules of a run, all read from the game's own config: the
 * map limits, phases and checkpoints, the boss siege, specials and mana,
 * the milestone Roulette and what happens while the game is closed.
 */
export function BattlePage() {
  const { t } = useLanguage();
  return (
    <div>
      <section className="wk-block" id="battle-map">
        <h3 className="wk-h3">{t("wiki.battle.mapTitle")}</h3>
        <dl className="wk-figures is-wide">
          <div>
            <dt>{t("wiki.battle.maxTowers")}</dt>
            <dd>{MAX_TOWERS_ON_MAP}</dd>
          </div>
          <div>
            <dt>{t("wiki.battle.maxPerType")}</dt>
            <dd>{MAX_TOWERS_PER_TYPE}</dd>
          </div>
          <div>
            <dt>{t("wiki.battle.freeMoves")}</dt>
            <dd>{t("wiki.battle.perDay", { n: FREE_REPOSITIONS_PER_DAY })}</dd>
          </div>
        </dl>
        <p className="wk-prose">{t("wiki.battle.mapBody", { max: MAX_TOWERS_ON_MAP, perType: MAX_TOWERS_PER_TYPE, free: FREE_REPOSITIONS_PER_DAY, gems: REPOSITION_GEM_COST })}</p>
      </section>

      <section className="wk-block" id="battle-phases">
        <h3 className="wk-h3">{t("wiki.battle.phasesTitle")}</h3>
        <p className="wk-prose">{t("wiki.battle.phasesBody", { block: WAVES_PER_PHASE })}</p>
      </section>

      <section className="wk-block" id="battle-siege">
        <h3 className="wk-h3">{t("wiki.battle.siegeTitle")}</h3>
        <ul className="wk-list">
          {(
            [
              ["siegeWounds", { pct: pct(BOSS_RETREAT_RECOVERY), waves: SIEGE_WAVES }],
              ["siegeWeakness", { pct: pct(WEAKNESS_DAMAGE_MULTIPLIER - 1) }],
              ["siegeFirst", { gold: FIRST_ASSAULT_GOLD_MULTIPLIER, shards: FIRST_ASSAULT_BONUS_SHARDS }],
              ["siegeEnrage", {}],
              ["siegeStrike", { seconds: Math.round(SIEGE_INTERVAL_MS / 1000), pct: pct(SIEGE_DAMAGE_FRACTION_OF_MAX_HP) }],
            ] as const
          ).map(([key, vars]) => (
            <li key={key}>
              <div>
                <h4>{t(`wiki.battle.${key}Title` as TranslationKey)}</h4>
                <p>{t(`wiki.battle.${key}` as TranslationKey, vars)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="wk-block" id="battle-mana">
        <h3 className="wk-h3">{t("wiki.battle.manaTitle")}</h3>
        <p className="wk-prose">
          {t("wiki.battle.manaBody", {
            over: pct(MANA_OVERCHARGE_MAX / MANA_MAX - 1),
            levels: MANA_UPGRADE_MAX_LEVEL,
            per: pct(MANA_UPGRADE_GAIN_PER_LEVEL),
            top: pct(MANA_UPGRADE_GAIN_PER_LEVEL * MANA_UPGRADE_MAX_LEVEL),
            skin: pct(SKIN_MANA_GAIN_BONUS),
          })}
        </p>
      </section>

      <section className="wk-block" id="battle-horde">
        <h3 className="wk-h3">{t("wiki.battle.hordeTitle")}</h3>
        <p className="wk-prose">
          {t("wiki.battle.hordeBody", {
            wave: ADAPTATION_START_WAVE,
            fair: pct(ADAPTATION_FAIR_SHARE),
            max: pct(ADAPTATION_MAX_RESIST),
            max2: pct(ADAPTATION_MAX_RESIST * ADAPTATION_WEAKNESS_RATIO),
          })}
        </p>
      </section>

      <section className="wk-block" id="battle-city">
        <h3 className="wk-h3">{t("wiki.battle.cityTitle")}</h3>
        <p className="wk-prose">{t("wiki.battle.cityBody", { n: CITY_REBUILD_WAVES })}</p>
        <div className="wk-table-wrap">
          <table className="wk-table">
            <thead>
              <tr>
                <th scope="col">{t("wiki.battle.cityBuildingCol")}</th>
                <th scope="col">{t("wiki.battle.cityWaveCol")}</th>
                <th scope="col">{t("wiki.battle.cityGoldCol")}</th>
              </tr>
            </thead>
            <tbody>
              {CITY_BUILDINGS.map((b) => (
                <tr key={b.id}>
                  <th scope="row">{t(`city.buildings.${b.id}` as TranslationKey)}</th>
                  <td>{b.unlockWave}</td>
                  <td>+{pct(b.goldShare)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wk-block" id="battle-clip">
        <h3 className="wk-h3">{t("wiki.battle.clipTitle")}</h3>
        <p className="wk-prose">{t("wiki.battle.clipBody")}</p>
      </section>

      <section className="wk-block" id="battle-roulette">
        <h3 className="wk-h3">{t("wiki.battle.rouletteTitle")}</h3>
        <p className="wk-prose">{t("wiki.battle.rouletteBody", { every: ROULETTE_MILESTONE_INTERVAL })}</p>
        <div className="wk-table-wrap">
          <table className="wk-table">
            <thead>
              <tr>
                <th scope="col">{t("wiki.battle.outcomeCol")}</th>
                <th scope="col">{t("wiki.battle.chanceCol")}</th>
              </tr>
            </thead>
            <tbody>
              {ROULETTE_ENTRIES.map((entry) => (
                <tr key={entry.type}>
                  <th scope="row">{t(`roulette.outcomes.${entry.type}` as TranslationKey)}</th>
                  <td>{entry.weightPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wk-block" id="battle-offline">
        <h3 className="wk-h3">{t("wiki.battle.offlineTitle")}</h3>
        <p className="wk-prose">
          {t("wiki.battle.offlineBody", {
            pace: pct(OFFLINE_PACE),
            gold: pct(OFFLINE_GOLD_SHARE),
            hours: Math.round(MAX_OFFLINE_CAPACITY_MS / 3_600_000),
          })}
        </p>
      </section>
    </div>
  );
}

/** MISSÕES E PASSE — the three daily missions and the 30-level Season Pass, both tracks. */
export function DailyPage() {
  const { t } = useLanguage();
  const season = seasonClock.getCurrentSeasonWindow().seasonNumber;
  const levels = Array.from({ length: PASS_LEVELS }, (_, i) => i + 1);
  return (
    <div>
      <section className="wk-block" id="daily-missions">
        <h3 className="wk-h3">{t("wiki.daily.missionsTitle")}</h3>
        <p className="wk-prose">
          {t("wiki.daily.missionsBody", { n: MISSIONS_PER_DAY, shards: MISSION_REWARD_SHARDS, kills: MISSION_REWARD_KILLS_WORTH_OF_GOLD, xp: PASS_XP.MISSION_CLAIMED })}
        </p>
        <ul className="wk-list">
          {MISSION_POOL.map((m) => (
            <li key={m.kind}>
              <div>
                <h4>{t(`missions.kinds.${m.kind}` as TranslationKey, { n: m.target })}</h4>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="wk-block" id="daily-pass">
        <h3 className="wk-h3">{t("wiki.daily.passTitle")}</h3>
        <dl className="wk-figures is-wide">
          <div>
            <dt>{t("wiki.daily.passLevels")}</dt>
            <dd>{PASS_LEVELS}</dd>
          </div>
          <div>
            <dt>{t("wiki.daily.xpPerLevel")}</dt>
            <dd>{PASS_XP_PER_LEVEL}</dd>
          </div>
          <div>
            <dt>{t("wiki.daily.premiumPrice")}</dt>
            <dd>R$ {PREMIUM_PASS_PRICE_BRL.toFixed(2).replace(".", ",")}</dd>
          </div>
        </dl>
        <p className="wk-prose">
          {t("wiki.daily.passBody", { wave: PASS_XP.WAVE_CLEARED, mini: PASS_XP.MINI_BOSS, boss: PASS_XP.MAIN_BOSS, mission: PASS_XP.MISSION_CLAIMED })}
        </p>
        {!REAL_MONEY_PAYMENTS_ENABLED && <p className="wk-note">{t("wiki.daily.premiumSoon")}</p>}
        <div className="wk-table-wrap">
          <table className="wk-table">
            <thead>
              <tr>
                <th scope="col">{t("wiki.level")}</th>
                <th scope="col">{t("pass.freeTrack")}</th>
                <th scope="col">{t("pass.premiumTrack")}</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level}>
                  <th scope="row">{level}</th>
                  <td className="wk-rewards">
                    <RewardPartsLabel parts={freeRewardForLevel(level)} currentWave={1} />
                  </td>
                  <td className="wk-rewards">
                    <RewardPartsLabel parts={premiumRewardForLevel(level, season)} currentWave={1} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wk-note">{t("wiki.daily.goldNote")}</p>
      </section>
    </div>
  );
}

/** LOJA — Gem packs, the starter pack, the daily gift and what a paid skin gives. */
export function StorePage() {
  const { t, language } = useLanguage();
  const money = (v: number) => (language === "ptBR" ? `R$ ${v.toFixed(2).replace(".", ",")}` : `R$ ${v.toFixed(2)}`);
  return (
    <div>
      <section className="wk-block" id="store-gems">
        <h3 className="wk-h3">{t("wiki.store.gemTypesTitle")}</h3>
        <p className="wk-prose">{t("wiki.store.gemTypesBody")}</p>
        {!REAL_MONEY_PAYMENTS_ENABLED && <p className="wk-note">{t("wiki.store.paymentsSoon")}</p>}
        <div className="wk-table-wrap">
          <table className="wk-table">
            <thead>
              <tr>
                <th scope="col">{t("wiki.store.packCol")}</th>
                <th scope="col">{t("wiki.store.bonusCol")}</th>
                <th scope="col">{t("wiki.store.priceCol")}</th>
              </tr>
            </thead>
            <tbody>
              {GEM_PACKS.map((pack) => (
                <tr key={pack.id}>
                  <th scope="row">{t("wiki.store.packGems", { n: gemPackTotal(pack) })}</th>
                  <td>{pack.bonusGems > 0 ? `+${pack.bonusGems}` : "—"}</td>
                  <td>{money(pack.priceBrl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wk-block" id="store-starter">
        <h3 className="wk-h3">{t("store.starterTitle")}</h3>
        <p className="wk-prose">{t("wiki.store.starterBody", { price: money(STARTER_PACK.priceBrl) })}</p>
        <p className="wk-rewards is-list">
          <RewardPartsLabel parts={STARTER_PACK.contents} currentWave={1} />
        </p>
      </section>

      <section className="wk-block" id="store-gift">
        <h3 className="wk-h3">{t("store.giftTitle")}</h3>
        <p className="wk-prose">{t("wiki.store.giftBody", { n: DAILY_GIFT_FREE_GEMS })}</p>
      </section>

      <section className="wk-block" id="store-skins">
        <h3 className="wk-h3">{t("wiki.store.skinsTitle")}</h3>
        <p className="wk-prose">
          {t("wiki.store.skinsBody", { each: pct(SKIN_REWARD_BONUS_PER_TYPE), top: pct(SKIN_REWARD_BONUS_PER_TYPE * 4), mana: pct(SKIN_MANA_GAIN_BONUS) })}
        </p>
      </section>
    </div>
  );
}
