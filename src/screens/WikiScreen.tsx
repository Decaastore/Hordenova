import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav } from "@/ui/TopNav";
import { TOWER_DEFINITIONS, TOWER_TYPES, TOWER_SPECIALS, getTowerLevelStats, MAX_TOWER_LEVEL, type TowerType } from "@/config/towerStats";
import { SPECIALIZATIONS_BY_TOWER, SPECIALIZATION_UNLOCK_TOWER_LEVEL } from "@/config/specializations";
import { getMasteryBonusMultipliers, getMasteryUpgradeCost } from "@/config/towerMastery";
import { ENEMY_DEFINITIONS, ENEMY_TYPES } from "@/config/enemyStats";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { CASTLE_TIERS } from "@/config/castleConfig";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { ITEM_DEFINITIONS, ITEM_TYPES } from "@/config/itemDefinitions";
import { DROP_TABLES } from "@/config/dropTables";
import { GOLD_SINKS } from "@/config/goldSinks";
import { GEM_SINKS } from "@/config/gemSinks";
import { getRarityDefinition } from "@/config/rarity";
import { ASCENSION_GEM_REWARDS, getSeasonRewardBundle, type AscensionRank } from "@/config/ascension";
import { SEASON_DURATION_MS } from "@/engine/SeasonClock";

type Category = "TOWERS" | "BESTIARY" | "CASTLE" | "ITEMS" | "PROGRESSION" | "ECONOMY" | "ASCENSION" | "PROJECTIONS";
const CATEGORIES: readonly Category[] = ["TOWERS", "BESTIARY", "CASTLE", "ITEMS", "PROGRESSION", "ECONOMY", "ASCENSION", "PROJECTIONS"];

interface WikiScreenProps {
  onNavigate: (view: "HOME" | "WIKI" | "NOVIDADES") => void;
  onPlay: () => void;
}

/**
 * Data-driven Wiki — every number/name shown comes directly from a real
 * config/*.ts module (imported above), never hand-typed here. Structurally
 * inspired by depth/categories/navigation patterns seen on similar
 * tower-defense wikis (categories as a left rail, a detail pane per
 * category) — no visual identity, text, or content copied from anywhere.
 * If a real field genuinely doesn't exist yet, this shows
 * wiki.underDevelopment rather than inventing one (e.g. there is no Life
 * Leech mechanic anywhere in the codebase, so no such page exists here).
 */
export function WikiScreen({ onNavigate, onPlay }: WikiScreenProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<Category>("TOWERS");

  return (
    <div style={rootStyle}>
      <style>{RESPONSIVE_CSS}</style>
      <TopNav active="WIKI" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="wiki-body" style={bodyStyle}>
        <aside className="wiki-rail" style={railStyle}>
          <div style={railTitleStyle}>{t("wiki.title")}</div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="wiki-rail-item"
              style={{
                ...railItemStyle,
                background: category === cat ? "rgba(255,207,94,0.14)" : "transparent",
                color: category === cat ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
                borderLeftColor: category === cat ? PALETTE.uiAccent : "transparent",
              }}
            >
              {t(`wiki.categories.${cat}` as TranslationKey)}
            </button>
          ))}
        </aside>
        <main className="wiki-content" style={contentStyle}>
          <p style={subtitleStyle}>{t("wiki.subtitle")}</p>
          {category === "TOWERS" && <TowersSection />}
          {category === "BESTIARY" && <BestiarySection />}
          {category === "CASTLE" && <CastleSection />}
          {category === "ITEMS" && <ItemsSection />}
          {category === "PROGRESSION" && <ProgressionSection />}
          {category === "ECONOMY" && <EconomySection />}
          {category === "ASCENSION" && <AscensionSection />}
          {category === "PROJECTIONS" && <ProjectionsSection />}
        </main>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={cardTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={statRowStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </div>
  );
}

function TowersSection() {
  const { t } = useLanguage();
  return (
    <div style={gridStyle}>
      {TOWER_TYPES.map((type) => {
        const def = TOWER_DEFINITIONS[type];
        const special = TOWER_SPECIALS[type];
        const paths = SPECIALIZATIONS_BY_TOWER[type];
        return (
          <Card key={type} title={t(`towers.${type}.name` as TranslationKey)}>
            <div style={roleStyle}>{t(`towers.${type}.role` as TranslationKey)}</div>
            <p style={descStyle}>{t(`towers.${type}.description` as TranslationKey)}</p>
            <div style={sectionLabelStyle}>{t("wiki.baseStats")}</div>
            <StatRow label={t("wiki.buildCost")} value={def.buildCost} />
            <StatRow label={t("wiki.damage")} value={def.baseDamage} />
            <StatRow label={t("wiki.attackSpeed")} value={def.baseAttackSpeed} />
            <StatRow label={t("wiki.range")} value={def.baseRange} />
            <StatRow label={t("wiki.upgradeCostBase")} value={def.upgradeCostBase} />
            {renderSpecialBaseline(type, special as unknown as Record<string, number>)}
            {paths.length > 0 && (
              <>
                <div style={sectionLabelStyle}>
                  {t("wiki.specializationPaths")} — {t("wiki.unlocksAtLevel", { level: SPECIALIZATION_UNLOCK_TOWER_LEVEL })}
                </div>
                {paths.map((path) => (
                  <div key={path.id} style={pathRowStyle}>
                    <strong>{t(`specializations.${path.id}.name` as TranslationKey)}</strong>
                    <div style={descStyle}>{t(`specializations.${path.id}.description` as TranslationKey)}</div>
                  </div>
                ))}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function renderSpecialBaseline(type: TowerType, special: Record<string, number>) {
  const entries = Object.entries(special);
  if (entries.length === 0) return null;
  return (
    <>
      <div style={sectionLabelStyle}>{type === "IRONWOOD" ? "Crit / Boss Damage" : type === "INFERNO" ? "AoE / Burn" : type === "FROSTBORN" ? "Slow / Freeze" : "Chain / Armor Penetration"}</div>
      {entries.map(([key, value]) => (
        <StatRow key={key} label={key} value={value} />
      ))}
    </>
  );
}

function BestiarySection() {
  const { t } = useLanguage();
  return (
    <>
      <div style={gridStyle}>
        {ENEMY_TYPES.map((type) => {
          const def = ENEMY_DEFINITIONS[type];
          return (
            <Card key={type} title={t(`enemies.${type}.name` as TranslationKey)}>
              <p style={descStyle}>{t(`enemies.${type}.description` as TranslationKey)}</p>
              <StatRow label={t("wiki.hp")} value={def.baseHp} />
              <StatRow label={t("wiki.speed")} value={def.baseSpeed} />
              <StatRow label={t("wiki.damageToBase")} value={def.baseDamageToBase} />
              <StatRow label={t("wiki.goldReward")} value={def.goldReward} />
              {def.damageReduction > 0 && <StatRow label={t("wiki.damageReduction")} value={`${Math.round(def.damageReduction * 100)}%`} />}
              {def.regenPercentPerSecond > 0 && <StatRow label={t("wiki.regenPerSecond")} value={`${(def.regenPercentPerSecond * 100).toFixed(1)}%`} />}
              <div style={weaknessStyle}>
                {t("wiki.weakness")}: {t(`enemies.${type}.weakness` as TranslationKey)}
              </div>
            </Card>
          );
        })}
      </div>

      <h3 style={groupHeaderStyle}>{t("wiki.mainBosses")}</h3>
      <div style={gridStyle}>
        {Object.values(MAIN_BOSSES).map((boss) => (
          <BossCard key={boss.id} boss={boss} />
        ))}
      </div>

      <h3 style={groupHeaderStyle}>{t("wiki.miniBosses")}</h3>
      <div style={gridStyle}>
        {Object.values(MINI_BOSSES).map((boss) => (
          <BossCard key={boss.id} boss={boss} />
        ))}
      </div>
    </>
  );
}

function BossCard({ boss }: { boss: (typeof MAIN_BOSSES)[string] }) {
  const { t } = useLanguage();
  const dropTable = boss.dropTableId ? DROP_TABLES[boss.dropTableId] : null;
  return (
    <Card title={t(`bosses.${boss.i18nKey}.name` as TranslationKey)}>
      <StatRow label={t("wiki.hpVsBrute")} value={`×${boss.hpMultiplierVsBrute}`} />
      <StatRow label={t("wiki.damageToBase")} value={boss.damageToBase} />
      <StatRow label={t("wiki.speed")} value={boss.speed} />
      <StatRow label={t("wiki.goldReward")} value={boss.goldReward} />
      <StatRow label={t("wiki.ability")} value={boss.ability} />
      <StatRow label={t("wiki.resistance")} value={`${Math.round(boss.resistance * 100)}%`} />
      {boss.regenPercentPerSecond > 0 && <StatRow label={t("wiki.regenPerSecond")} value={`${(boss.regenPercentPerSecond * 100).toFixed(1)}%`} />}
      <div style={sectionLabelStyle}>{t("wiki.dropTable")}</div>
      {dropTable ? (
        dropTable.entries.map((entry) => (
          <StatRow key={entry.itemId} label={t(`items.${entry.itemId}.name` as TranslationKey)} value={`${entry.weightPercent}%`} />
        ))
      ) : (
        <div style={descStyle}>{t("wiki.noDropTable")}</div>
      )}
    </Card>
  );
}

function CastleSection() {
  const { t } = useLanguage();
  return (
    <>
      <h3 style={groupHeaderStyle}>{t("wiki.hpTiers")}</h3>
      <p style={descStyle}>{t("wiki.hpTiersHint")}</p>
      <div style={gridStyle}>
        {CASTLE_TIERS.map((tier) => (
          <Card key={tier.tier} title={t(`castleTiers.${tier.i18nKey}` as TranslationKey)}>
            <StatRow label="Tier" value={tier.tier} />
            <StatRow label="Max HP %" value={`${Math.round(tier.maxHpPercent * 100)}%`} />
          </Card>
        ))}
      </div>

      <h3 style={groupHeaderStyle}>{t("wiki.skins")}</h3>
      <p style={descStyle}>{t("wiki.skinsHint")}</p>
      <div style={gridStyle}>
        {CASTLE_SKINS.map((skin) => (
          <Card key={skin.id} title={t(`castleSkins.${skin.id}.name` as TranslationKey)}>
            <p style={descStyle}>{t(`castleSkins.${skin.id}.description` as TranslationKey)}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

function ItemsSection() {
  const { t } = useLanguage();
  return (
    <div style={gridStyle}>
      {ITEM_TYPES.map((id) => {
        const def = ITEM_DEFINITIONS[id];
        const rarity = getRarityDefinition(def.rarity);
        return (
          <Card key={id} title={t(`items.${id}.name` as TranslationKey)}>
            <p style={descStyle}>{t(`items.${id}.description` as TranslationKey)}</p>
            <StatRow label={t("wiki.rarity")} value={t(`rarity.${rarity.id}` as TranslationKey)} />
            <StatRow label={t("wiki.category")} value={t(`itemCategory.${def.category}` as TranslationKey)} />
            <StatRow label={t("wiki.tradable")} value={def.tradable ? t("wiki.tradable") : t("wiki.notTradable")} />
          </Card>
        );
      })}
    </div>
  );
}

function ProgressionSection() {
  const { t } = useLanguage();
  return (
    <>
      <h3 style={groupHeaderStyle}>{t("wiki.masteryTitle")}</h3>
      <p style={descStyle}>{t("wiki.masteryHint")}</p>
      <div style={gridStyle}>
        {[1, 10, 50, 100].map((level) => {
          const bonus = getMasteryBonusMultipliers(level);
          return (
            <Card key={level} title={t("wiki.level") + " " + level}>
              <StatRow label={t("wiki.damage")} value={`+${((bonus.damage - 1) * 100).toFixed(1)}%`} />
              <StatRow label={t("wiki.attackSpeed")} value={`+${((bonus.attackSpeed - 1) * 100).toFixed(1)}%`} />
              <StatRow label={t("wiki.range")} value={`+${((bonus.range - 1) * 100).toFixed(1)}%`} />
              <StatRow label={t("wiki.upgradeCostBase")} value={getMasteryUpgradeCost("IRONWOOD", level)} />
            </Card>
          );
        })}
      </div>
    </>
  );
}

function EconomySection() {
  const { t } = useLanguage();
  return (
    <>
      <h3 style={groupHeaderStyle}>{t("wiki.goldSinksTitle")}</h3>
      <div style={gridStyle}>
        {GOLD_SINKS.map((sink) => (
          <Card key={sink.id} title={t(`goldSinks.${sink.i18nKey}.name` as TranslationKey)}>
            <p style={descStyle}>{t(`goldSinks.${sink.i18nKey}.description` as TranslationKey)}</p>
            <StatRow label="" value={sink.uncapped ? t("wiki.uncapped") : t("wiki.finite")} />
          </Card>
        ))}
      </div>

      <h3 style={groupHeaderStyle}>{t("wiki.gemSinksTitle")}</h3>
      <div style={gridStyle}>
        {GEM_SINKS.map((sink) => (
          <Card key={sink.id} title={t(`gemSinks.${sink.i18nKey}.name` as TranslationKey)}>
            <p style={descStyle}>{t(`gemSinks.${sink.i18nKey}.description` as TranslationKey)}</p>
            <StatRow label="" value={sink.implemented ? (sink.uncapped ? t("wiki.uncapped") : t("wiki.finite")) : t("wiki.underDevelopment")} />
          </Card>
        ))}
      </div>
    </>
  );
}

function AscensionSection() {
  const { t } = useLanguage();
  const ranks: AscensionRank[] = [1, 2, 3, 4, 5];
  const days = Math.round(SEASON_DURATION_MS / (24 * 60 * 60 * 1000));
  return (
    <>
      <StatRow label={t("wiki.seasonLength")} value={`${days} ${days === 1 ? "day" : "days"}`} />
      <p style={descStyle}>{t("wiki.top5Rewards")}</p>
      <div style={gridStyle}>
        {ranks.map((rank) => {
          const bundle = getSeasonRewardBundle(1, rank);
          return (
            <Card key={rank} title={`#${rank} — ${t(`ascension.rankTitles.${bundle.rankTitleKey}` as TranslationKey)}`}>
              <StatRow label="Gems" value={ASCENSION_GEM_REWARDS[rank]} />
              <StatRow label="Cosmetics" value={bundle.cosmetics.length} />
            </Card>
          );
        })}
      </div>
    </>
  );
}

function ProjectionsSection() {
  const { t } = useLanguage();
  const sampleLevels = [1, 5, 10, 15, 20, 25, MAX_TOWER_LEVEL];
  return (
    <>
      <p style={descStyle}>{t("wiki.levelProjection")}</p>
      {TOWER_TYPES.map((type) => (
        <div key={type} style={{ marginBottom: 24 }}>
          <h3 style={groupHeaderStyle}>{t(`towers.${type}.name` as TranslationKey)}</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("wiki.level")}</th>
                  <th style={thStyle}>{t("wiki.damage")}</th>
                  <th style={thStyle}>{t("wiki.attackSpeed")}</th>
                  <th style={thStyle}>{t("wiki.range")}</th>
                </tr>
              </thead>
              <tbody>
                {sampleLevels.map((level) => {
                  const stats = getTowerLevelStats(type, level);
                  return (
                    <tr key={level}>
                      <td style={tdStyle}>{level}</td>
                      <td style={tdStyle}>{stats.damage.toFixed(1)}</td>
                      <td style={tdStyle}>{stats.attackSpeed.toFixed(2)}</td>
                      <td style={tdStyle}>{stats.range.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Small-screen layout (spec: Wiki must stay functional on tablet/mobile):
 * the rail collapses into a horizontally-scrollable pill row above the
 * content instead of a fixed-width side column, and the card grid drops
 * to one column — both avoid the page ever needing to scroll sideways.
 */
const RESPONSIVE_CSS = `
@media (max-width: 720px) {
  .wiki-body { flex-direction: column; }
  .wiki-rail { width: 100%; display: flex; overflow-x: auto; padding: 10px; gap: 4px; border-right: none; border-bottom: 1px solid ${PALETTE.uiPanelBorder}; }
  .wiki-rail-item { border-left: none !important; border-bottom: 3px solid transparent; white-space: nowrap; padding: 8px 12px !important; }
  .wiki-content { padding: 16px !important; }
}
`;

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: `linear-gradient(180deg, #241a10, #150f09)`,
  color: PALETTE.uiText,
  overflow: "hidden",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  minHeight: 0,
};

const railStyle: CSSProperties = {
  width: 200,
  flexShrink: 0,
  borderRight: `1px solid ${PALETTE.uiPanelBorder}`,
  padding: "16px 0",
  overflowY: "auto",
};

const railTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 2,
  color: PALETTE.uiTextDim,
  padding: "0 18px 10px",
};

const railItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  borderLeft: "3px solid transparent",
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: "20px 28px 40px",
  overflowY: "auto",
};

const subtitleStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  marginTop: 0,
  marginBottom: 20,
};

const groupHeaderStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  color: PALETTE.uiAccentBright,
  marginTop: 28,
  marginBottom: 8,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 14,
};

const cardStyle: CSSProperties = {
  background: PALETTE.uiPanelBg,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  borderRadius: 10,
  padding: "14px 16px",
};

const cardTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 4,
};

const roleStyle: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: 0.6,
  color: PALETTE.gold,
  fontWeight: 700,
  marginBottom: 6,
};

const descStyle: CSSProperties = {
  fontSize: 11.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  margin: "0 0 8px",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginTop: 10,
  marginBottom: 4,
};

const statRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  padding: "2px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const statLabelStyle: CSSProperties = {
  color: PALETTE.uiTextDim,
};

const statValueStyle: CSSProperties = {
  color: PALETTE.uiText,
  fontWeight: 700,
};

const pathRowStyle: CSSProperties = {
  fontSize: 11.5,
  marginBottom: 8,
};

const weaknessStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.success,
  marginTop: 8,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 12,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  color: PALETTE.uiTextDim,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
  fontSize: 10.5,
  letterSpacing: 0.6,
};

const tdStyle: CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};
