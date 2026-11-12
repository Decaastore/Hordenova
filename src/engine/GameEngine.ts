import { claimableMilestones, contractsForWeek, depthOfWave, depthReward, MERCHANT_OFFERS, milestoneReward, rollWeek, SHARD_POUCH_AMOUNT, type EternalState, type MerchantOfferId, createEternalState } from "@/config/eternal";
import { ETERNAL_STORAGE_KEY } from "./SaveSystem";
import { bestiaryStats, reachedAchievements, type AchievementId, type AchievementStats, type BestiaryKills } from "@/config/achievements";
import { RARITY_DEFINITIONS } from "@/config/rarity";
import { canRaiseTalent, LAST_STAND_HP_FRACTION, sanitizeTalentRanks, talentBonus, talentPointsFree, type TalentId, type TalentRanks } from "@/config/talents";
import { chargeAfterWave, MAX_RIFT_CHARGES, createRiftState, riftReward, RIFT_DROP_TABLE_ID, RIFT_FRAGILE_BREACH, RIFT_HASTE_SPEED, RIFT_TOUGH_HP, withHordeExtra, type RiftModId, type RiftReward, type RiftState } from "@/config/rifts";
import { ELITE_SHARD_DROP_AMOUNT, ELITE_SHARD_DROP_CHANCE, MAX_RECENT_LOOT, shardPileRarity, type LootDrop } from "@/config/loot";
import { getItemDefinition } from "@/config/itemDefinitions";
import { phaseNumberFromWave, phaseStartWave } from "@/config/wavePhase";
import { ENEMY_VOICE_FAMILY } from "@/config/enemyVoice";
import { waveGoldFactor, waveHpFactor } from "@/config/waveBudget";
import { deviceId, recordBalanceEvent, type DefenceSnapshot } from "@/telemetry/balanceTelemetry";
import {
  BOSS_INTRO_DURATION_MS,
  BOSS_VICTORY_DURATION_MS,
  GAME_SPEEDS,
  OFFLINE_RETURN_MIN_ELAPSED_MS,
  RUN_START,
  SAVE_STORAGE_KEY,
  type GameSpeed,
} from "@/config/gameBalance";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { getMapLayout, getSite, MAX_TOWERS_ON_MAP, MAX_TOWERS_PER_TYPE, setActiveMapLayout, type MapLayout } from "@/data/mapLayouts";
import { autoArrange } from "./MapDeployment";
import { enemyCountForWave, isBossMilestone, isBonusEliteWave } from "@/config/waveConfig";
import { isMiniBossWave, getMainBossForWave, getMiniBossForWave, getBossDefinitionById } from "@/config/bossConfig";
import { getMilestoneBonus, getPhaseForWave, getWaveTag } from "@/config/phaseConfig";
import { computeCastleDamage, type CastleDamageCategory } from "@/config/castleDamage";
import {
  castleHpForReward,
  rollRoulette,
  ROULETTE_CASTLE_SKIN_FALLBACK_GEMS,
  ROULETTE_GEM_REWARD_AMOUNT,
  ROULETTE_MILESTONE_INTERVAL,
  type RouletteRewardType,
} from "@/config/roulette";
import { CASTLE_SKINS, PRESTIGE_CASTLE_SKIN_ID } from "@/config/castleSkins";
import {
  canUnlockPrestige,
  getPrestigeBonuses,
  getPrestigeUpgradeDualPrice,
  PRESTIGE_MILESTONE_REWARDS,
  type PrestigeBonuses,
} from "@/config/prestige";
import { getScaledEnemyStats, type EnemyType } from "@/config/enemyStats";
import { getDropTable, rollDropTable } from "@/config/dropTables";
import { itemBonusFrom, rerollCost, rollItemEffects } from "@/config/itemRolls";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { addItemWithCapacity, claimFromOverflow, DEFAULT_INVENTORY_CAPACITY, findItem } from "./InventoryManager";
import { appendLedgerEvent } from "./EconomyLedger";
import {
  checkFusionEligibility,
  pickFusionResultDefinitionId,
  rollFusion,
  type FusionOutcome,
} from "./ItemFusion";
import { FUSION_ITEM_COUNT } from "@/config/itemFusion";
import type { Rarity } from "@/config/rarity";
import { checkLocalFirst, type LocalFirstDiscoveries } from "./WorldFirst";
import {
  createTowerInstance,
  getTowerUpgradeCost,
  upgradeTower as upgradeTowerEntity,
  canChooseSpecialization,
  chooseSpecialization as chooseSpecializationEntity,
  canUpgradeSpecialization,
  getSpecializationUpgradeCostFor,
  upgradeSpecialization as upgradeSpecializationEntity,
  equipSkin as equipSkinEntity,
  canPurchaseSkin as canPurchaseSkinEntity,
  canUpgradeMastery,
  getMasteryUpgradeCostFor,
  upgradeMastery as upgradeMasteryEntity,
  canSwitchSpecialization,
  switchSpecialization as switchSpecializationEntity,
  applySiegeDamage,
  resetTowerSurvival,
  canEquipItem,
  equipItem as equipItemEntity,
  unequipItem as unequipItemEntity,
  canUnlockItemSlot,
  unlockItemSlot as unlockItemSlotEntity,
  type TowerInstance,
  type TowerLoadoutEntry,
} from "@/entities/Tower";
import { getItemSlotUnlockCost, getItemSlotUnlockPrice, TOWER_ITEM_SLOT_COUNT } from "@/config/towerItemSlots";
import { getMasteryUnlockGoldCost } from "@/config/towerMastery";
import { getManaUpgradeCost, MANA_MAX } from "@/config/towerMana";
import { getSkinRewardMultiplier, getTowerSkinDefinition, getTowerSkinDualPrice, PRESTIGE_TOWER_SKINS } from "@/config/towerSkins";
import {
  SPECIALIZATION_CHANGE_GEM_PRICE,
  SPECIALIZATION_UNLOCK_GEM_PRICE,
  type SpecializationId,
} from "@/config/specializations";
import { REPOSITION_GEM_PRICE } from "@/config/repositioning";
import { gemPriceForCurrency, TRADE_UNLOCK_PRICE, type DualGemPrice, type GemCurrency } from "@/config/gemsEconomy";
import { getCurrentDayIndex } from "./DailyClock";
import { freshPassState, PASS_XP, type PassXpSource, type SeasonPassState } from "@/config/seasonPass";
import { seasonClock } from "./SeasonClock";
import { freshMissionsState, MISSION_REWARD_KILLS_WORTH_OF_GOLD, MISSION_REWARD_SHARDS, missionsForDay, type DailyMissionsState, type MissionKind } from "@/config/dailyMissions";
import {
  advanceEnemy,
  createEliteEnemyInstance,
  createEnemyInstance,
  isEnemyDead,
  type BossState,
  type EliteModifier,
  type EnemyInstance,
} from "@/entities/Enemy";
import { isProjectileExpired, tickProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { tickCombat, tickEnemyDisableAbilities } from "./CombatSystem";
import {
  activateNextWave,
  createWaveManagerState,
  retryCurrentWave,
  tickWaveManager,
  type WaveManagerState,
} from "./WaveManager";
import { createBossInstance, ENRAGE_HP_THRESHOLD, tickBossAbilities, tickBossSiege } from "./BossManager";
import {
  BOSS_RETREAT_RECOVERY,
  bossWeakness,
  FIRST_ASSAULT_BONUS_SHARDS,
  FIRST_ASSAULT_GOLD_MULTIPLIER,
  SIEGE_WAVES,
  type BossRecords,
  type BossSiegeState,
} from "@/config/bossAssault";
import { SIEGE_DISABLE_ON_DEPLETION_MS } from "@/config/bossSiege";
import {
  createBattleStats,
  finalizeBattleStats,
  generateFailureReport,
  recordBaseHit,
  recordBossSnapshot,
  recordDamageEvents,
  recordKill,
  type BattleStats,
  type FailureReport,
} from "./BattleDiagnostics";
import { computeOfflineCapacityMs, FROZEN_TAB_INEFFICIENCY_MULTIPLIER, OFFLINE_GOLD_SHARE, MAX_OFFLINE_CAPACITY_MS, simulateOfflineDefense, type OfflineSimulationResult } from "./OfflineDefense";
import { loadSave, recordRunResult, updateSave } from "./SaveSystem";
import type { RunPhase } from "./types";
import type { CombatVfxEvent } from "./CombatVfxEvents";
import { getMilestoneUnlockForLevel } from "@/config/towerStats";
import { adaptAfterWave, createHordeAdaptation, emptyShares, strongestResistance, ADAPTATION_ANNOUNCE_STEP, type DamageShares, type HordeAdaptation } from "@/config/hordeAdaptation";
import { advanceRebuild, builtBuildings, createCityState, cityGoldShare, CITY_FIRES_PER_BOSS_BREACH, CITY_FIRES_PER_LEAKED_WAVE, igniteBuildings, type CityBuildingId, type CityState } from "@/config/city";
import type { EnemyAudioTier, GameAudioEvent } from "./AudioEvents";
import { setEvolvedSkins } from "@/rendering/skinEvolution";
import { setDuelLooks } from "@/rendering/duelLooks";
import { duelKillFx, duelSkinLooks } from "@/config/duel";
import { getSeasonRule, type SeasonRule } from "@/config/seasonRules";
import {
  addEssences,
  BOSS_SPLINTERS,
  canAffordRecipe,
  createExpeditionState,
  EXTRA_GROUP_PRICE,
  expeditionPrize,
  expeditionRegions,
  getRecipe,
  MAX_SCOUT_GROUPS,
  MINI_BOSS_SPLINTERS,
  NO_ESSENCES,
  RIFT_SPLINTERS,
  rushPrice,
  unlockedRegions,
  type ExpeditionHours,
  type ExpeditionPrize,
  type ExpeditionState,
} from "@/config/expeditions";
import { activeMomentOffer, createMomentOfferState, createVipState, isVipActive, triggerMomentOffer, VIP_EXTRA_SCOUT_GROUPS, type MomentOfferState, type MomentTrigger, type VipState } from "@/config/shopOffers";

/** Elite spec (section 5): real stat multipliers plus a passive-regen "special ability", not just a bigger HP number. */
const ELITE_MODIFIER: EliteModifier = {
  hpMultiplier: 1.4,
  speedMultiplier: 1.2,
  rewardMultiplier: 1.6,
  regenPercentPerSecond: 0.015,
};
/** Elites are always built on the Brute silhouette — a consistent "this one's different" read across every phase without needing a bespoke archetype per elite. */
const ELITE_BASE_TYPE: EnemyType = "BRUTE";


/** CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — this many consecutive boss escapes with zero kills in between is treated as a genuine wall, not bad luck (see EndgameWallReport's own doc comment). */
const ENDGAME_WALL_ESCAPE_THRESHOLD = 8;

/** Audio/VFX event queues are drained every frame by the game screen; when nothing drains them they stay this short. */
const MAX_QUEUED_EVENTS = 2000;

export interface HudSnapshot {
  phase: RunPhase;
  wave: number;
  /** Current phase's id (config/phaseConfig.ts) — unique per rendered phase INSTANCE (a post-130 endgame lap gets its own suffixed id, e.g. `VOLCANIC_WASTES_ENDGAME_LAP1`), so this is NOT a valid i18n key on its own — see `phaseI18nKey` for that. */
  phaseId: string;
  /** The stable, hand-authored i18n key (`phases.<phaseI18nKey>.name`) — always one of the original PHASES entries' own id, even during an endgame rotation lap that reuses it under a suffixed `phaseId`. Use this, never `phaseId`, for any translated phase name/tagline. */
  phaseI18nKey: string;
  gold: number;
  /** GEMS ECONOMY v2 — 🔒 earned exclusively through gameplay. Never spendable on power; valid for every Gems-priced system. */
  freeGems: number;
  /** GEMS ECONOMY v2 — 💎 bought from the store. Never spendable on power; valid for every Gems-priced system PLUS the Marketplace (Purchased-Gems-only). */
  purchasedGems: number;
  gemShards: number;
  baseHp: number;
  maxBaseHp: number;
  speed: GameSpeed;
  bestWave: number;
  /** This Season's own high-water mark — see SaveData.seasonBestWave's doc comment. */
  seasonBestWave: number;
  enemiesDefeated: number;
  /** Enemies still to come this wave: alive on the map plus not yet spawned. */
  enemiesLeft: number;
  /** Whole seconds until the next wave starts while between waves, else null. */
  nextWaveInS: number | null;
  selectedTowerId: string | null;
  /** i18n key (bosses.<bossNameKey>.name) — NOT a display string. */
  bossNameKey: string | null;
  bossHp: number | null;
  bossMaxHp: number | null;
  bossIntroRemainingMs: number | null;
  /** Set only while the VICTORY beat plays — the gold the just-defeated boss dropped. */
  bossLastReward: number | null;
  /** The oldest not-yet-acknowledged newly-discovered enemy type, or null — see GameEngine.acknowledgeDiscovery. */
  pendingDiscoveryType: EnemyType | null;
  /** The most recent still-unacknowledged item drop, or null — see GameEngine.acknowledgeItemReward. Item System spec section 25/32. */
  pendingItemReward: { instanceId: string; itemDefinitionId: string } | null;
  /** The most recent still-unacknowledged Roulette spin, or null — see GameEngine.acknowledgeRouletteResult. Master Implementation spec section 46-48. */
  pendingRouletteResult: RouletteResult | null;
  /**
   * AUDITORIA E CORREÇÃO GERAL spec sections 1-3, 9, 11-13 — the oldest wave
   * milestone whose Roulette has NOT been spun yet, or null. Its reward is
   * NOT granted and its result is NOT known until the player explicitly
   * calls GameEngine.spinPendingRoulette() — crossing the milestone only
   * ever gets it into this queue, never resolves it. A UI must show a
   * "Roulette available" prompt whenever this is non-null, and keep showing
   * it (even across F5) until the player actually spins.
   */
  pendingRouletteSpinWave: number | null;
  /** BALANCEAMENTO DEFINITIVO spec section 6 — whether the account's one free Tower Repositioning for TODAY (see engine/DailyClock.ts) is still available. false means the next reposition costs REPOSITION_GEM_COST Gems (config/repositioning.ts). */
  repositionFreeAvailable: boolean;
  /** The map being played (data/mapLayouts.ts). */
  mapLayoutId: string;
  /** Towers currently on the map (at most MAX_TOWERS_ON_MAP). */
  towerCount: number;
  /** DEPLOY: towers still waiting to be placed on this map. */
  deployBench: readonly { id: string; type: TowerType; level: number }[];
  /** BOSS SIEGE: the main boss besieging this map (HP left as a fraction, assaults so far, waves until it attacks again), or null. */
  bossSiege: { wave: number; hpFraction: number; assaults: number; wavesUntilBoss: number } | null;
  /** TOWER MANA — true while the player holds every special (config/towerMana.ts). */
  specialsHeld: boolean;
  /** Towers whose mana bar is full (their special is ready or held). */
  specialsReady: number;
  /** Towers of each type on the map + bench, for the per-type build limit (MAX_TOWERS_PER_TYPE). */
  towersByType: Record<TowerType, number>;
  /** BOSS SIEGE: about the main boss being announced/fought now — its weakness, which assault this is, and its state. Null outside a boss fight. */
  bossFight: { weakness: TowerType | null; assault: number; enraged: boolean; exhausted: boolean } | null;
  /** Set during VICTORY: how many assaults the boss took (1 = first-assault kill, which pays a bonus). */
  bossVictoryAssaults: number | null;
  /** Daily missions: changes whenever any progress/claim changes (for re-rendering), and how many are done but not yet claimed. */
  missionsKey: string;
  missionsClaimable: number;
  /** A HORDA QUE APRENDE — damage-taken multiplier per element for the current wave, plus a counter bumped on every change worth announcing. */
  horde: { multipliers: Readonly<Record<TowerType, number>>; changeSeq: number };
  /** O CASTELO VIRA CIDADE — burning buildings (clean waves left) and the latest city event (seq bumps on each). */
  city: {
    burning: Readonly<Partial<Record<CityBuildingId, number>>>;
    goldShare: number;
    lastEvent: { seq: number; kind: "BUILT" | "BURNED" | "REBUILT" | "INCOME"; ids: readonly CityBuildingId[]; amount: number } | null;
  };
  /** MODO ETERNO — whether this is the Eternal castle, its marks, depth and the latest depth/milestone reward (seq bumps). */
  eternal: {
    active: boolean;
    marks: number;
    depth: number;
    lastEvent: { seq: number; kind: "DEPTH" | "MILESTONE"; value: number; marks: number; shards: number } | null;
    contractsReady: number;
  };
  /** EXPEDIÇÕES E FORJA — trips and forge ready to collect, and trips under way. */
  expeditions: { ready: number; away: number; forging: boolean; splinters: number; forgeReady: boolean };
  /** OFERTAS DE MOMENTO — the offer on screen, if any. */
  momentOffer: { id: string; expiresAt: number } | null;
  /** CONQUISTAS — the latest achievement unlocked (seq bumps) and the title worn. */
  achievement: { last: { seq: number; id: AchievementId } | null; title: AchievementId | null; count: number };
  /** ÁRVORE DE TALENTOS — ranks and points still free. */
  talents: { ranks: Readonly<TalentRanks>; free: number };
  /** FENDAS — charges, the curses armed for the next eligible wave, the Rift being fought, and the latest result (seq bumps). */
  rift: {
    charges: number;
    armed: readonly RiftModId[] | null;
    active: { wave: number; mods: readonly RiftModId[] } | null;
    lastResult: { seq: number; won: boolean; reward: RiftReward | null } | null;
  };
}

/** The Welcome Back summary: the offline simulation plus everything it was turned into. */
export interface OfflineReturnSummary extends OfflineSimulationResult {
  /** Real time away that was simulated (capped by MAX_OFFLINE_CAPACITY_MS). */
  awayMs: number;
  /** "CLOSED": the game was closed and reopened. "HIDDEN_TAB": the tab stayed open but the browser stopped running it. */
  source: "CLOSED" | "HIDDEN_TAB";
  /** Gold actually received (with the paid-skin bonus). */
  goldEarned: number;
  gemShardsEarned: number;
  passXpEarned: number;
  /** Today's missions that moved forward while away. */
  missions: { kind: MissionKind; progress: number; target: number }[];
}

export interface DailyMissionView {
  kind: MissionKind;
  target: number;
  progress: number;
  claimed: boolean;
  rewardShards: number;
  rewardGold: number;
}

/**
 * One resolved Roulette spin (spec sections 46-48) — the reward was already
 * genuinely rolled (config/roulette.ts's real weighted rollRoulette) and
 * already granted (Castle HP raised / Gems added / skin unlocked) by the
 * time this exists; a UI's "spin" animation only ever reveals this value,
 * never determines it, per spec section 47's anti-fake-pity requirement.
 */
export interface RouletteResult {
  wave: number;
  rewardType: RouletteRewardType;
  /** > 0 only for a CASTLE_HP_* outcome. */
  castleHpGranted: number;
  /** > 0 for the GEM outcome, or for a CASTLE_SKIN roll that fell back to Gems because every real skin was already owned. GEMS ECONOMY v2 — always Free Gems (a gameplay reward), never Purchased. */
  gemsGranted: number;
  /** Set only when a real, previously-unowned Castle Skin was granted. */
  castleSkinId: string | null;
}

/**
 * CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — surfaced once
 * `ENDGAME_WALL_ESCAPE_THRESHOLD` boss fights in a row all end in an
 * ESCAPE (boss reaches the base) rather than a KILL. Distinguishes a
 * genuine "this build cannot beat any boss it's currently facing" state
 * from an ordinary, occasional escape — never freezes the game (the run
 * keeps ticking underneath exactly as before), this is purely an
 * informational banner the UI can show and dismiss (acknowledgeEndgameWallReport)
 * without blocking anything, the same "pending banner" shape as
 * pendingItemReward/pendingRouletteResult above.
 */
export interface EndgameWallReport {
  bossId: string;
  bossNameKey: string;
  wave: number;
  bestWave: number;
  /** Best fraction (0..1) of the boss's HP actually brought down across the whole streak, not just the last attempt. */
  bestDamageFraction: number;
  consecutiveEscapes: number;
  /** Reuses the exact same rule-based diagnosis PROGRESSION_STOPPED shows — real recorded battle data, never randomized. */
  diagnosis: FailureReport;
}

export interface RenderSnapshot {
  phase: RunPhase;
  towers: readonly TowerInstance[];
  enemies: readonly EnemyInstance[];
  projectiles: readonly ProjectileInstance[];
  selectedTowerId: string | null;
  biomeId: string;
  /** The map being played — draw its road and sites (never derive them from biomeId alone). */
  mapLayoutId: string;
  /** Recent loot that fell on the map (config/loot.ts), newest last. */
  lootDrops: readonly LootDrop[];
  /** MODO ETERNO — the depth being fought (0 outside the Eternal castle); deeper maps are drawn corrupted. */
  depth: number;
}

function hudSnapshotsEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.wave === b.wave &&
    a.phaseId === b.phaseId &&
    a.gold === b.gold &&
    a.freeGems === b.freeGems &&
    a.purchasedGems === b.purchasedGems &&
    a.gemShards === b.gemShards &&
    a.expeditions.ready === b.expeditions.ready &&
    a.expeditions.away === b.expeditions.away &&
    a.expeditions.forging === b.expeditions.forging &&
    a.expeditions.forgeReady === b.expeditions.forgeReady &&
    a.expeditions.splinters === b.expeditions.splinters &&
    a.momentOffer?.id === b.momentOffer?.id &&
    a.momentOffer?.expiresAt === b.momentOffer?.expiresAt &&
    a.baseHp === b.baseHp &&
    a.maxBaseHp === b.maxBaseHp &&
    a.speed === b.speed &&
    a.bestWave === b.bestWave &&
    a.seasonBestWave === b.seasonBestWave &&
    a.enemiesDefeated === b.enemiesDefeated &&
    a.enemiesLeft === b.enemiesLeft &&
    a.nextWaveInS === b.nextWaveInS &&
    a.selectedTowerId === b.selectedTowerId &&
    a.bossNameKey === b.bossNameKey &&
    a.bossHp === b.bossHp &&
    a.bossMaxHp === b.bossMaxHp &&
    a.bossIntroRemainingMs === b.bossIntroRemainingMs &&
    a.bossLastReward === b.bossLastReward &&
    a.pendingDiscoveryType === b.pendingDiscoveryType &&
    a.pendingItemReward?.instanceId === b.pendingItemReward?.instanceId &&
    a.pendingRouletteResult?.wave === b.pendingRouletteResult?.wave &&
    a.pendingRouletteResult?.rewardType === b.pendingRouletteResult?.rewardType &&
    a.pendingRouletteSpinWave === b.pendingRouletteSpinWave &&
    a.repositionFreeAvailable === b.repositionFreeAvailable &&
    a.mapLayoutId === b.mapLayoutId &&
    a.towerCount === b.towerCount &&
    a.bossSiege?.wave === b.bossSiege?.wave &&
    a.bossSiege?.hpFraction === b.bossSiege?.hpFraction &&
    a.bossSiege?.assaults === b.bossSiege?.assaults &&
    a.bossSiege?.wavesUntilBoss === b.bossSiege?.wavesUntilBoss &&
    a.bossFight?.assault === b.bossFight?.assault &&
    a.bossFight?.enraged === b.bossFight?.enraged &&
    a.bossFight?.exhausted === b.bossFight?.exhausted &&
    a.bossFight?.weakness === b.bossFight?.weakness &&
    a.bossVictoryAssaults === b.bossVictoryAssaults &&
    a.specialsHeld === b.specialsHeld &&
    a.specialsReady === b.specialsReady &&
    TOWER_TYPES.every((type) => a.towersByType[type] === b.towersByType[type]) &&
    a.missionsKey === b.missionsKey &&
    a.horde.changeSeq === b.horde.changeSeq &&
    TOWER_TYPES.every((type) => a.horde.multipliers[type] === b.horde.multipliers[type]) &&
    a.city.lastEvent?.seq === b.city.lastEvent?.seq &&
    a.rift.charges === b.rift.charges &&
    a.talents.ranks === b.talents.ranks &&
    a.talents.free === b.talents.free &&
    a.achievement.last?.seq === b.achievement.last?.seq &&
    a.achievement.title === b.achievement.title &&
    a.achievement.count === b.achievement.count &&
    a.eternal.marks === b.eternal.marks &&
    a.eternal.depth === b.eternal.depth &&
    a.eternal.lastEvent?.seq === b.eternal.lastEvent?.seq &&
    a.eternal.contractsReady === b.eternal.contractsReady &&
    JSON.stringify(a.rift.armed) === JSON.stringify(b.rift.armed) &&
    a.rift.active?.wave === b.rift.active?.wave &&
    a.rift.lastResult?.seq === b.rift.lastResult?.seq &&
    a.city.goldShare === b.city.goldShare &&
    JSON.stringify(a.city.burning) === JSON.stringify(b.city.burning) &&
    a.deployBench.length === b.deployBench.length &&
    a.deployBench.every((t, i) => t.id === b.deployBench[i]!.id && t.level === b.deployBench[i]!.level)
  );
}

/**
 * Single source of truth for progression. Owns all mutable game state and
 * the only public methods allowed to change it. Rendering code only ever
 * READS via getRenderSnapshot()/getHudSnapshot() — see rendering/ layer.
 *
 * Core Gameplay + Progression + Active Idle model: towers, gold and the
 * current wave/phase are PERSISTENT (see engine/SaveSystem.ts) — they
 * survive across attempts and reloads. Only the moment-to-moment battle
 * state (live enemies/projectiles, baseHp for the current attempt) resets
 * on startRun()/retryPhase(). Combat itself is fully automatic — nothing
 * in this class waits on a per-wave or per-target player action; the only
 * player-driven calls are build/upgrade decisions and retryPhase().
 *
 * Content Progression layer (phases/biomes/archetypes/elites) is entirely
 * DATA-DRIVEN from config/phaseConfig.ts + config/bossConfig.ts — this
 * class only asks "what wave is this / what spawns here", never encodes a
 * wave range or a boss identity itself.
 */
export class GameEngine {
  private phase: RunPhase = "PRE_RUN";
  /**
   * MAP LAYOUTS — the map the run is currently being played on (its road and
   * build sites, see data/mapLayouts.ts). Follows the current wave's phase;
   * see syncMapLayout() for what happens when it changes.
   */
  private layout: MapLayout = getMapLayout("ANCIENT_FOREST");
  /** When true (the real game screen), moving onto a new map pauses in DEPLOY so the player can arrange towers; headless engines (tests, sims) just auto-arrange and keep going. */
  private deployPauseEnabled = false;
  /** First-run tutorial: the run waits while a new player places their first tower. */
  private tutorialHold = false;
  /** What the run was about to do when DEPLOY interrupted it. */
  private deployResumePhase: RunPhase | null = null;
  /**
   * Towers waiting to be placed on the current map (DEPLOY). When the run
   * reaches a new map every tower comes off the old one and lands here; the
   * player puts each one on a site ONCE (deployPlaceTower) — after that,
   * moving it is the regular reposition (one free move a day, then Gems).
   * Saved in towerLoadout with an empty slotId, so a reload mid-DEPLOY
   * loses nothing.
   */
  private deployBench: TowerInstance[] = [];
  private speed: GameSpeed = GAME_SPEEDS[0];
  private gold = 0;
  private baseHp = RUN_START.baseHp;
  /** RUN_START.baseHp plus every permanent CASTLE_HP_* Roulette win ever landed (this.castleHpBonus) — no longer a fixed constant, see triggerRouletteSpin. */
  private maxBaseHp = RUN_START.baseHp;
  private wave: WaveManagerState = createWaveManagerState();
  private towers: TowerInstance[] = [];
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private enemiesDefeated = 0;
  private selectedTowerId: string | null = null;
  private bestWave = 0;
  /** This Season's own high-water mark — separate from `bestWave` (the account's all-time record), reset to 0 only at a Season boundary. See SaveData.seasonBestWave's doc comment. */
  private seasonBestWave = 0;

  private bossIntroRemainingMs = 0;
  private bossIntroNameKey: string | null = null;
  private victoryRemainingMs = 0;
  private activeBossId: string | null = null;
  /** This attempt's own simulated clock (accumulates scaledDt, so it scales with game speed) — see update()'s comment. Boss/mini-boss ability timing reads this instead of a real wall-clock. */
  private simClockMs = 0;
  private miniBossSpawnedForWave: number | null = null;
  private eliteSpawnedForWave: number | null = null;
  /** Gold the main boss dropped, kept around through the VICTORY beat so the banner can show it after the boss enemy itself is gone. */
  private lastBossReward: number | null = null;

  /**
   * CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B — explicit Progression
   * Wall). The boss-escape branch below (`boss === null`) intentionally
   * keeps the run going instead of ever freezing (see its own doc comment)
   * — but a KILL and an ESCAPE are very different outcomes for the player
   * to understand, and a long unbroken streak of escapes is a genuinely
   * different situation from one unlucky fight. This counts consecutive
   * escapes with ZERO kill in between; any real kill resets it to 0 (proof
   * the current build/boss matchup isn't actually a wall). Purely in-memory
   * — like `pendingRouletteResults` above, nothing here is a reward that
   * could be "lost" on reload, only a diagnostic banner.
   */
  private consecutiveBossEscapesWithoutKill = 0;
  /** BOSS SIEGE (config/bossAssault.ts): the main boss besieging the map and the wounds it carries; persisted. */
  private bossSiege: BossSiegeState | null = null;
  private bossRecords: BossRecords | null = null;
  private lastBossHpFraction = 1;
  private lastBossAssaults: number | null = null;
  /** Balance telemetry is recorded only by the real game screen (see enableTelemetry), never by tests or simulations. */
  private telemetryEnabled = false;
  /** Best fraction of THIS streak's boss HP actually brought down (0..1) — reset alongside the streak counter above. */
  private bestBossDamageFractionInStreak = 0;
  private endgameWallReport: EndgameWallReport | null = null;

  private discoveredEnemyTypes = new Set<EnemyType>();
  private pendingDiscoveries: EnemyType[] = [];

  /** This save's stable local identity — see SaveSystem.SaveData.playerId. */
  private playerId = "";
  private inventory: ItemInstance[] = [];
  private bossesDefeatedTotal = 0;
  private miniBossesDefeatedTotal = 0;
  private localFirstDiscoveries: LocalFirstDiscoveries = {};
  private pendingItemRewards: ItemInstance[] = [];

  // Progression 2.0 / GEMS ECONOMY v2 — Gem Economy. `freeGems`/
  // `purchasedGems`/`gemShards` are private exactly like `gold` above:
  // every read/write goes through this class's own methods
  // (getFreeGemBalance/getPurchasedGemBalance/addFreeGems/addPurchasedGems/
  // spendGems/convertGemShards below), which is what satisfies spec section
  // 37's "GemManager... não pode permitir player.gems += 100 direto na UI"
  // — there simply is no path from UI code to these fields except through
  // those methods, the same guarantee `gold` already has. The two balances
  // are NEVER blended into one number anywhere, and there is no code path
  // that moves value from one into the other (see config/gemsEconomy.ts's
  // own header for the full no-conversion contract).
  private freeGems = 0;
  private purchasedGems = 0;
  private gemShards = 0;
  /** Fractions of Gold / Gem Shards left over by the paid-skin reward bonus, carried to the next grant so small per-kill bonuses aren't rounded away. */
  private skinGoldCarry = 0;
  private dailyMissions: DailyMissionsState = freshMissionsState(getCurrentDayIndex());
  private seasonPass: SeasonPassState = freshPassState(seasonClock.getCurrentSeasonWindow().seasonNumber);
  private skinShardCarry = 0;
  /** GEMS ECONOMY v2 — the permanent, one-time Trade Unlock gate (see canUnlockTrade/unlockTrade below). */
  private tradeUnlocked = false;
  private inventoryCapacity = DEFAULT_INVENTORY_CAPACITY;
  private overflowInventory: ItemInstance[] = [];

  // HORDENOVA Season/Progression v1.0 — "Season resets progression, not
  // ownership." towerMasteryLevels is now SEASON-scoped (resets to {} at
  // every Season boundary, see AscensionManager.syncSeasonIfNeeded);
  // masteryUnlocked/unlockedSpecializationIds/Tower Skin ownership are the
  // permanent, account-wide, never-reset halves, keyed by TOWER TYPE (every
  // placed tower of a type shares its type's Mastery level/ownership and
  // equipped skin). See SaveData's doc comment for the full split.
  private towerMasteryLevels: Partial<Record<TowerType, number>> = {};
  /** TOWER MANA — SEASON-scoped per-TYPE Gold mana upgrade level (config/towerMana.ts), exactly like towerMasteryLevels. */
  private towerManaLevels: Partial<Record<TowerType, number>> = {};
  /** TOWER MANA — the player is holding every special; cleared when the wave it started in ends. */
  private specialsHeld = false;
  /** A HORDA QUE APRENDE — see config/hordeAdaptation.ts. */
  private hordeAdaptation: HordeAdaptation = createHordeAdaptation();
  /** Damage each tower element dealt in the wave in progress (fed into the horde's memory when it ends). */
  private waveDamageByType: DamageShares = emptyShares();
  /** Bumped whenever the horde's strongest resistance changes enough to tell the player. */
  private hordeChangeSeq = 0;
  /** O CASTELO VIRA CIDADE — see config/city.ts. */
  private city: CityState = createCityState();
  private rift: RiftState = createRiftState();
  private talents: TalentRanks = {};
  private eternal: EternalState = createEternalState();
  private expeditions: ExpeditionState = createExpeditionState();
  private momentOffers: MomentOfferState = createMomentOfferState();
  private vip: VipState = createVipState();
  /** REGRA DA SEASON — this Season's rule, or null in the Eternal castle (config/seasonRules.ts). */
  private seasonRule: SeasonRule | null = null;
  private lastEternalEvent: { seq: number; kind: "DEPTH" | "MILESTONE"; value: number; marks: number; shards: number } | null = null;
  private bestiaryKills: BestiaryKills = {};
  private achievements: AchievementId[] = [];
  private equippedTitle: AchievementId | null = null;
  private riftsCleared = 0;
  private bestRarityFound = -1;
  private lastAchievement: { seq: number; id: AchievementId } | null = null;
  private lastRiftResult: { seq: number; won: boolean; reward: RiftReward | null } | null = null;
  /** Gold from kills in the wave in progress — the city pays a share of it when the wave is cleared. */
  private waveKillGold = 0;
  /** True once any creature reached the castle during the wave in progress. */
  private waveLeaked = false;
  /** Last wave whose end was already processed (adaptation + city), so it's never applied twice. */
  private lastFinishedWave: number | null = null;
  private cityEventSeq = 0;
  private lastCityEvent: { seq: number; kind: "BUILT" | "BURNED" | "REBUILT" | "INCOME"; ids: CityBuildingId[]; amount: number } | null = null;
  private specialsHeldWave = 0;
  /** Permanent per-TYPE Mastery ownership (the one-time Gold purchase, FASE 6) — never reset by a Season boundary. */
  private masteryUnlocked: Partial<Record<TowerType, boolean>> = {};
  /** SISTEMA DE SLOTS DE EQUIPAMENTO — permanent per-TYPE slot ownership (mirrors masteryUnlocked exactly, but an array per type instead of a single boolean). A one-time, per-slot Gems purchase — never reset by a Season boundary, never re-locked by removing/swapping an equipped item. */
  private unlockedItemSlots: Partial<Record<TowerType, boolean[]>> = {};
  private ownedTowerSkinIds = new Set<string>();
  private equippedTowerSkinByType: Partial<Record<TowerType, string>> = {};

  /** Permanent per-TYPE record of every Specialization path ever purchased (the one-time 500 Gems unlock) — never reset by a Season boundary, never re-charged for a path already in this list. See config/specializations.ts's SPECIALIZATION_UNLOCK_GEM_COST/SPECIALIZATION_CHANGE_GEM_COST. */
  private unlockedSpecializationIds: Partial<Record<TowerType, SpecializationId[]>> = {};

  // Master Implementation spec sections 46-48, and AUDITORIA E CORREÇÃO
  // GERAL spec sections 1-13 — the every-10-wave Roulette.
  // `castleHpBonus`/`unlockedCastleSkinIds` are the persistent halves (see
  // SaveSystem.ts); `pendingRouletteResults` is a purely in-memory display
  // queue exactly like `pendingItemRewards` above — the reward itself is
  // already granted and persisted by the time an entry lands here, so
  // losing this queue to a reload loses only the banner, never the reward.
  //
  // `pendingRouletteSpinWaves` is the opposite: a PERSISTED queue of wave
  // milestones whose Roulette has NOT been spun/granted yet. Crossing a
  // milestone (in advanceBestWave, or a batch of them inside an Offline
  // Defense return) only ever pushes here — nothing is rolled or granted
  // until spinPendingRoulette() is explicitly called (the player's own
  // ROLETAR click). This MUST be persisted (unlike pendingRouletteResults)
  // because losing it to a reload would mean losing a reward the player
  // never got the chance to claim, not just losing a toast.
  private castleHpBonus = 0;
  private unlockedCastleSkinIds: string[] = [];
  private pendingRouletteResults: RouletteResult[] = [];
  private pendingRouletteSpinWaves: number[] = [];

  /** Master Implementation Pass spec section 7-8 — PROFILE PRESTIGE: the recurring, uncapped, purely-cosmetic Gem sink (config/prestige.ts). */
  private prestigeLevel = 0;

  /** BALANCEAMENTO DEFINITIVO spec section 6/13 — see SaveData.lastFreeRepositionDayIndex's own doc comment. */
  private lastFreeRepositionDayIndex: number | null = null;

  /** Audio spec sections 1/16 — plain data queue, drained once per tick by audio/GameAudioBridge.ts. GameEngine never imports anything from src/audio/. */
  private audioEvents: GameAudioEvent[] = [];
  /** Floating Damage Numbers rewrite — same queue pattern as audioEvents above, drained every render frame by CanvasRenderer.tsx. Each entry describes damage that was REALLY just subtracted from an enemy's hp this tick (see CombatVfxEvents.ts) — never a projectile fired or an hp-diff guess. GameEngine never imports anything from src/rendering/. */
  private combatVfxEvents: CombatVfxEvent[] = [];
  private waveCompleteAudioFiredForWave: number | null = null;
  private enrageAudioFired = new Set<string>();

  private battleStats: BattleStats = createBattleStats();
  private lastFailureReport: FailureReport | null = null;
  private offlineSummary: OfflineReturnSummary | null = null;

  private readonly listeners = new Set<() => void>();

  /**
   * PRÓXIMA GRANDE FASE spec — "DECISÃO DEFINITIVA SOBRE PROGRESSÃO": there
   * is now exactly one permanent, never-reset save (SAVE_STORAGE_KEY); the
   * separate Ascension/Infinite dual-mode split (a second GameEngine
   * pointed at ASCENSION_STORAGE_KEY, with its own temporary
   * wave/gold/towers reset every season) no longer exists in the real app
   * flow. `storageKey` stays overridable — GameEngineDualMode.test.ts still
   * exercises this constructor's namespace-isolation guarantee directly,
   * a real and still-useful property of the engine — but nothing under
   * src/screens/ constructs a second instance anymore. Season-scoped
   * competitive state (`seasonBestWave`) lives as an ordinary field on THIS
   * SAME permanent save (see SaveData.seasonBestWave), not a second
   * namespace.
   */
  constructor(private readonly storageKey: string = SAVE_STORAGE_KEY) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Resumes persistent progression from the save (or starts fresh on a
   * brand-new save). This is the ONLY entry point that loads from
   * SaveSystem — everything after it works off in-memory state, persisted
   * back out via `persist()` at meaningful checkpoints.
   */
  startRun(): void {
    // Idempotent by design: GameScreen calls this from a mount effect, which
    // React's development StrictMode invokes twice — without this guard the
    // second call would re-resume from the (already-persisted) post-offline-
    // sim save with a fresh lastPlayedAt, silently clobbering the OFFLINE_
    // RETURN summary before the player ever saw it.
    if (this.phase !== "PRE_RUN") return;

    const save = loadSave(this.storageKey);
    this.bestWave = save.bestWave;
    this.seasonBestWave = save.seasonBestWave;
    this.gold = save.gold;
    // Permanent Mastery/Skin state must be loaded BEFORE instantiating towers
    // from the (Season-scoped) loadout below — instantiateTowerFromLoadout
    // reads these maps to give each tower its permanent-by-type Mastery
    // level and equipped skin.
    this.towerMasteryLevels = { ...save.towerMasteryLevels };
    this.towerManaLevels = { ...save.towerManaLevels };
    this.hordeAdaptation = { memory: { ...save.hordeAdaptation.memory }, multipliers: { ...save.hordeAdaptation.multipliers } };
    this.city = { burning: { ...save.city.burning }, firesStarted: save.city.firesStarted };
    this.talents = sanitizeTalentRanks(save.talents, save.seasonBestWave);
    this.eternal = rollWeek(save.eternal, Date.now());
    this.expeditions = save.expeditions;
    this.momentOffers = save.momentOffers;
    this.vip = save.vip;
    setEvolvedSkins(save.evolvedSkinIds);
    // DUELO cosmetics show in the Eternal castle only — the Season castle keeps its own looks
    setDuelLooks(this.isEternal ? duelSkinLooks(save.duel) : null, this.isEternal ? duelKillFx(save.duel) : null);
    this.bestiaryKills = { ...save.bestiaryKills };
    this.achievements = [...save.achievements];
    this.equippedTitle = save.equippedTitle;
    this.riftsCleared = save.riftsCleared;
    this.bestRarityFound = save.bestRarityFound;
    this.rift = { charges: save.rift.charges, armed: save.rift.armed ? [...save.rift.armed] : null, active: save.rift.active ? { wave: save.rift.active.wave, mods: [...save.rift.active.mods] } : null };
    this.cityBuiltCount = builtBuildings(save.seasonBestWave).length;
    this.masteryUnlocked = { ...save.masteryUnlocked };
    // Deep-copy each per-type array for the same reason as
    // unlockedSpecializationIds below — a shallow spread would leave every
    // type's array as the SAME reference as the loaded save's.
    this.unlockedItemSlots = Object.fromEntries(
      Object.entries(save.unlockedItemSlots).map(([type, slots]) => [type, [...(slots ?? [])]]),
    ) as Partial<Record<TowerType, boolean[]>>;
    this.ownedTowerSkinIds = new Set(save.ownedTowerSkinIds);
    this.equippedTowerSkinByType = { ...save.equippedTowerSkinByType };
    // Deep-copy each per-type array — a shallow spread would leave every
    // type's array as the SAME reference as the loaded save's, so pushing a
    // newly-unlocked id in chooseTowerSpecialization would mutate the save
    // object this engine is supposed to be an independent working copy of.
    this.unlockedSpecializationIds = Object.fromEntries(
      Object.entries(save.unlockedSpecializationIds).map(([type, ids]) => [type, [...(ids ?? [])]]),
    ) as Partial<Record<TowerType, SpecializationId[]>>;
    // The saved loadout's slot ids belong to the map it was arranged on
    // (pre-layout saves: the original map) — load that map first so every
    // tower comes back exactly where it was; syncMapLayout() below then
    // moves the run onto the current phase's map if that's a different one.
    this.layout = getMapLayout(save.mapLayoutId ?? "ANCIENT_FOREST");
    setActiveMapLayout(this.layout);
    const loadedTowers = save.towerLoadout.map((entry) => this.instantiateTowerFromLoadout(entry));
    this.towers = loadedTowers.filter((t) => getSite(this.layout, t.slotId) !== undefined);
    this.deployBench = loadedTowers.filter((t) => getSite(this.layout, t.slotId) === undefined);
    this.discoveredEnemyTypes = new Set(save.discoveredEnemyTypes);
    this.playerId = save.playerId;
    this.inventory = save.inventory;
    this.bossesDefeatedTotal = save.bossesDefeatedTotal;
    this.miniBossesDefeatedTotal = save.miniBossesDefeatedTotal;
    this.localFirstDiscoveries = save.localFirstDiscoveries;
    this.freeGems = save.freeGems;
    this.purchasedGems = save.purchasedGems;
    this.gemShards = save.gemShards;
    this.tradeUnlocked = save.tradeUnlocked;
    this.inventoryCapacity = save.inventoryCapacity;
    this.overflowInventory = save.overflowInventory;
    this.castleHpBonus = save.castleHpBonus;
    this.unlockedCastleSkinIds = save.unlockedCastleSkinIds;
    this.prestigeLevel = save.prestigeLevel;
    // Retroactive safety net — see grantEarnedPrestigeMilestoneRewards's own
    // doc comment: a save that already met a milestone threshold before
    // this system existed is granted it here, once, on load, rather than
    // only on its next future upgradePrestige() call.
    this.grantEarnedPrestigeMilestoneRewards();
    this.pendingRouletteSpinWaves = [...save.pendingRouletteSpinWaves];
    this.lastFreeRepositionDayIndex = save.lastFreeRepositionDayIndex;
    this.dailyMissions = save.dailyMissions ?? freshMissionsState(getCurrentDayIndex());
    this.seasonPass = save.seasonPass ?? freshPassState(seasonClock.getCurrentSeasonWindow().seasonNumber);
    this.bossSiege = save.bossSiege;
    this.bossRecords = save.bossRecords;
    this.seasonRule = this.isEternal ? null : getSeasonRule(seasonClock.getCurrentSeasonWindow().seasonNumber);
    this.maxBaseHp = Math.round((RUN_START.baseHp + this.castleHpBonus) * (1 + (this.seasonRule?.castleHpPct ?? 0) / 100));
    this.wave = createWaveManagerState();
    this.resetAttemptState();
    this.wave.currentWave = save.currentWave;

    const elapsed = save.lastPlayedAt !== null ? Date.now() - save.lastPlayedAt : 0;
    if (save.currentWave > 0 && save.towerLoadout.length > 0 && elapsed >= OFFLINE_RETURN_MIN_ELAPSED_MS) {
      const capacityMs = computeOfflineCapacityMs(save.lastPlayedAt as number, Date.now());
      const result = simulateOfflineDefense({
        startingWave: save.currentWave,
        towerLoadout: save.towerLoadout,
        capacityMs,
      });
      if (result.phasesCleared > 0) {
        this.applyOfflineResult(result, capacityMs, "CLOSED");
        return;
      }
    }

    this.beginCurrentOrNextWave();
    this.syncMapLayout();
    this.persist();
    this.notify();
  }

  /**
   * Turns an offline simulation into real progress and shows the Welcome
   * Back summary. Shared by reopening the game and by a tab the browser
   * stopped running for a long time (catchUpHiddenTime).
   */
  private applyOfflineResult(result: OfflineSimulationResult, awayMs: number, source: OfflineReturnSummary["source"]): void {
    // AUDITORIA E CORREÇÃO GERAL spec section 12 — Offline Defense can
    // jump `currentWave`/`bestWave` across several ROULETTE_MILESTONE_
    // INTERVAL boundaries in one shot (this never happens in live play,
    // where advanceBestWave is called once per single wave crossed).
    // Every milestone crossed while offline is queued as pending here —
    // NEVER auto-resolved — exactly like a milestone crossed live.
    const oldBestWave = this.bestWave;
    // Same milestone bonuses live play pays for reaching a new best wave.
    let milestoneGold = 0;
    let milestoneShards = 0;
    for (let w = oldBestWave + 1; w <= result.endingWave; w++) {
      const bonus = getMilestoneBonus(w);
      if (bonus > 0) {
        milestoneGold += bonus;
        milestoneShards += Math.max(1, Math.round(bonus / 150));
      }
    }
    // a besieging boss that the simulation got past is beaten
    if (this.bossSiege && result.endingWave > this.bossSiege.wave) this.bossSiege = null;
    const goldShare = source === "CLOSED" ? OFFLINE_GOLD_SHARE : 1;
    const goldEarned = this.withSkinGoldBonus(Math.round((result.resourcesEarned + milestoneGold) * goldShare));
    this.gold += goldEarned;
    this.wave.currentWave = result.endingWave;
    this.bestWave = Math.max(this.bestWave, result.endingWave);
    if (result.endingWave > this.seasonBestWave) this.seasonBestWave = result.endingWave;
    for (let w = oldBestWave + 1; w <= this.bestWave; w++) {
      if (w % ROULETTE_MILESTONE_INTERVAL === 0) this.pendingRouletteSpinWaves.push(w);
    }

    // The same rewards live play gives for what was cleared: boss/mini-boss
    // Gem Shards, Season Pass XP, and today's missions.
    const bossKills = result.bossesCleared + result.miniBossesCleared;
    const shardsBefore = this.gemShards;
    if (milestoneShards > 0) this.addGemShards(this.withSkinShardBonus(milestoneShards), "offline_milestones");
    if (bossKills > 0) {
      const perKill = Math.round(2 * getPrestigeBonuses(this.prestigeLevel).gemShardMultiplier);
      this.addGemShards(this.withSkinShardBonus(perKill * bossKills), "offline_boss_kills");
    }
    const passXpBefore = this.seasonPass.xp;
    const missionsBefore = this.getDailyMissions().map((m) => m.progress);
    let kills = 0;
    for (let w = result.startingWave + 1; w <= result.endingWave; w++) kills += enemyCountForWave(w);
    const waves = result.endingWave - result.startingWave;
    for (let i = 0; i < waves; i++) this.addPassXp("WAVE_CLEARED");
    for (let i = 0; i < result.miniBossesCleared; i++) this.addPassXp("MINI_BOSS");
    for (let i = 0; i < result.bossesCleared; i++) this.addPassXp("MAIN_BOSS");
    this.trackMission("CLEAR_WAVES", waves);
    this.trackMission("KILL_ENEMIES", kills);
    if (result.miniBossesCleared > 0) this.trackMission("DEFEAT_MINI_BOSSES", result.miniBossesCleared);
    const missionsAfter = this.getDailyMissions();

    this.offlineSummary = {
      ...result,
      awayMs,
      source,
      goldEarned,
      gemShardsEarned: this.gemShards - shardsBefore,
      passXpEarned: this.seasonPass.xp - passXpBefore,
      missions: missionsAfter.filter((m, i) => m.progress > (missionsBefore[i] ?? 0)).map((m) => ({ kind: m.kind, progress: m.progress, target: m.target })),
    };
    this.phase = "OFFLINE_RETURN";
    this.persist();
    this.notify();
  }

  /**
   * A tab left open in the background normally keeps playing (see
   * GameLoop's hidden-tab driver). But browsers can freeze a background tab
   * entirely; when it wakes up, the time it couldn't replay arrives here
   * and is covered the same way as closing and reopening the game: the
   * Offline Defense simulation and a Welcome Back summary. Short gaps are
   * ignored, like the offline return's own minimum.
   */
  catchUpHiddenTime(ms: number): boolean {
    if (ms < OFFLINE_RETURN_MIN_ELAPSED_MS || this.towers.length === 0) return false;
    if (this.phase === "PRE_RUN" || this.phase === "OFFLINE_RETURN" || this.phase === "PROGRESSION_STOPPED" || this.phase === "DEPLOY") return false;
    const capacityMs = Math.min(ms, MAX_OFFLINE_CAPACITY_MS);
    const result = simulateOfflineDefense({
      startingWave: this.wave.currentWave,
      towerLoadout: this.towers.map((t) => this.loadoutEntryOf(t)),
      capacityMs,
      inefficiency: FROZEN_TAB_INEFFICIENCY_MULTIPLIER,
    });
    if (result.phasesCleared === 0) return false;
    this.resetAttemptState();
    this.applyOfflineResult(result, capacityMs, "HIDDEN_TAB");
    return true;
  }

  /** Dismisses the Welcome Back summary and resumes automatic combat. */
  dismissOfflineSummary(): void {
    if (this.phase !== "OFFLINE_RETURN") return;
    this.offlineSummary = null;
    this.beginCurrentOrNextWave();
    this.syncMapLayout();
    this.persist();
    this.notify();
  }

  getOfflineSummary(): OfflineReturnSummary | null {
    return this.offlineSummary;
  }

  /**
   * Player intervention after PROGRESSION_STOPPED: plays the phase that
   * failed again from its first wave (stopProgression already moved the
   * run back there), after the player upgrades towers or changes their
   * build. Towers, gold and the best-wave record are kept.
   */
  retryPhase(): void {
    if (this.phase !== "PROGRESSION_STOPPED") return;
    this.resetAttemptState();
    this.beginCurrentOrNextWave();
    this.persist();
    this.notify();
  }

  private resetAttemptState(): void {
    this.enemies = [];
    this.projectiles = [];
    this.specialsHeld = false;
    this.baseHp = this.maxBaseHp;
    this.enemiesDefeated = 0;
    this.selectedTowerId = null;
    this.battleStats = createBattleStats();
    this.lastFailureReport = null;
    this.miniBossSpawnedForWave = null;
    this.eliteSpawnedForWave = null;
    this.activeBossId = null;
    this.bossIntroNameKey = null;
    this.lastBossReward = null;
    this.simClockMs = 0;
    this.waveCompleteAudioFiredForWave = null;
    this.enrageAudioFired = new Set();
    // Master Implementation Pass spec section 12-13 — Tower Survival HP/
    // Shield are transient battle state, restored to full on every fresh
    // attempt exactly like Castle HP (baseHp) above — never a lingering
    // "damaged from last attempt" state carried into a retry.
    for (const tower of this.towers) resetTowerSurvival(tower);
  }

  /** Starts Wave 1 (fresh save) or resumes/retries the current wave — intercepting into BOSS_INTRO if that wave is a main-boss milestone. */
  private beginCurrentOrNextWave(): void {
    const targetWave = this.wave.currentWave === 0 ? 1 : this.wave.currentWave;
    if (isBossMilestone(targetWave)) {
      this.enterBossIntro(targetWave);
      return;
    }
    if (this.wave.currentWave === 0) activateNextWave(this.wave);
    else retryCurrentWave(this.wave);
    this.phase = "RUNNING";
    this.emitAudio({ type: "wave_start" });
  }

  /** `announce: false` skips the intro stinger — used when an escaped boss loops back, so the same fanfare doesn't replay every lap. */
  private enterBossIntro(waveNumber: number, announce = true): void {
    this.wave.currentWave = waveNumber;
    this.wave.phase = "IDLE";
    this.wave.spawnQueue = [];
    this.phase = "BOSS_INTRO";
    this.bossIntroRemainingMs = BOSS_INTRO_DURATION_MS;
    this.bossIntroNameKey = getMainBossForWave(waveNumber).i18nKey;
    if (announce) this.emitAudio({ type: "boss_intro" });
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.notify();
  }

  getAvailableSlotIds(): string[] {
    const occupied = new Set(this.towers.map((t) => t.slotId));
    // Nothing is buildable once the map already holds MAX_TOWERS_ON_MAP towers.
    if (this.towers.length + this.deployBench.length >= MAX_TOWERS_ON_MAP) return [];
    return this.layout.sites.filter((slot) => !occupied.has(slot.id)).map((slot) => slot.id);
  }

  /**
   * Towers as the center of progression (spec section 3): allowed during
   * active combat — boss fights included, since a boss now has to be beaten
   * to move on and upgrading mid-fight is how a player turns it around —
   * and while PROGRESSION_STOPPED/DEPLOY, when the build is expected to change.
   */
  private canModifyLoadout(): boolean {
    return (
      this.phase === "RUNNING" ||
      this.phase === "WAVE_TRANSITION" ||
      this.phase === "BOSS_INTRO" ||
      this.phase === "BOSS_BATTLE" ||
      this.phase === "PROGRESSION_STOPPED" ||
      this.phase === "DEPLOY" ||
      // the Welcome Back screen offers spending the gold right away
      this.phase === "OFFLINE_RETURN"
    );
  }

  /**
   * Mastery level and equipped skin are sourced from the PERMANENT,
   * per-type maps (this.towerMasteryLevels/this.equippedTowerSkinByType),
   * never from the loadout entry itself — the entry's own equivalent
   * fields are legacy/unused now that both became account-wide-by-type
   * state instead of per-slot state (see SEASON-RESET-CORRECTION doc
   * comment on those fields above).
   */
  private instantiateTowerFromLoadout(entry: TowerLoadoutEntry): TowerInstance {
    const slot = getSite(this.layout, entry.slotId);
    const tower = createTowerInstance(
      entry.slotId,
      entry.type,
      slot ? slot.position : { x: 0, y: 0 },
      entry.level,
      entry.specializationId,
      entry.specializationLevel,
      this.equippedTowerSkinByType[entry.type] ?? null,
      this.towerMasteryLevels[entry.type] ?? 0,
      this.masteryUnlocked[entry.type] === true,
      entry.equippedItemInstanceIds,
      this.unlockedItemSlots[entry.type] ? [...this.unlockedItemSlots[entry.type]!] : undefined,
      this.towerManaLevels[entry.type] ?? 0,
    );
    tower.siteTrait = slot?.trait ?? "NONE";
    return tower;
  }

  /** Towers of `type` on the map plus on the deploy bench — what MAX_TOWERS_PER_TYPE counts. */
  countTowersOfType(type: TowerType): number {
    let n = 0;
    for (const t of this.towers) if (t.type === type) n++;
    for (const t of this.deployBench) if (t.type === type) n++;
    return n;
  }

  placeTower(slotId: string, type: TowerType): boolean {
    if (!this.canModifyLoadout()) return false;
    if (this.towers.some((t) => t.slotId === slotId)) return false;
    if (this.towers.length + this.deployBench.length >= MAX_TOWERS_ON_MAP) return false;
    if (this.countTowersOfType(type) >= MAX_TOWERS_PER_TYPE) return false;

    const slot = getSite(this.layout, slotId);
    if (!slot) return false;

    const cost = TOWER_DEFINITIONS[type].buildCost;
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.towers.push(
      createTowerInstance(
        slotId,
        type,
        slot.position,
        1,
        null,
        0,
        this.equippedTowerSkinByType[type] ?? null,
        this.towerMasteryLevels[type] ?? 0,
        this.masteryUnlocked[type] === true,
        undefined,
        this.unlockedItemSlots[type] ? [...this.unlockedItemSlots[type]!] : undefined,
        this.towerManaLevels[type] ?? 0,
      ),
    );
    this.towers[this.towers.length - 1]!.siteTrait = slot.trait;
    this.persist();
    this.notify();
    return true;
  }

  // ---------------------------------------------------------------------
  // BALANCEAMENTO DEFINITIVO spec section 6/13 — Tower Repositioning. See
  // config/repositioning.ts's own doc comment for the "1 change = 1 pick-
  // tower-then-pick-destination-slot action" definition (a swap with an
  // occupied slot still counts as one), and engine/DailyClock.ts for why
  // the daily boundary is a day-INDEX comparison rather than a stored flag.
  // ---------------------------------------------------------------------

  /** Whether the account's one free reposition for the CURRENT day is still unused. */
  isFreeRepositionAvailable(): boolean {
    return this.lastFreeRepositionDayIndex !== getCurrentDayIndex();
  }

  /** {free:0, purchased:0} when the free daily reposition is still available, REPOSITION_GEM_PRICE otherwise. UI must show BOTH prices and get an explicit currency choice before ever calling repositionTower with a non-zero cost. */
  getRepositionPrice(): DualGemPrice {
    return this.isFreeRepositionAvailable() ? { free: 0, purchased: 0 } : REPOSITION_GEM_PRICE;
  }

  /**
   * Moves the tower currently at `fromSlotId` to `toSlotId` — one of the
   * map's fixed TOWER_SLOTS positions, never an arbitrary coordinate (the
   * structural min-spacing rule from FIX-5 is preserved unchanged: every
   * legal destination is already a pre-vetted slot). If `toSlotId` already
   * holds a different tower, the two SWAP positions atomically as part of
   * this SAME call — still exactly one reposition for cost/allowance
   * purposes. Touches ONLY slotId/position on the affected tower(s): level,
   * Mastery, Specialization, ownership, HP and every other field are
   * completely untouched, on both towers.
   *
   * Spends REPOSITION_GEM_PRICE Gems (in whichever `currency` the caller
   * chose) when the day's free use is already spent — the caller (UI) is
   * responsible for showing a confirmation with BOTH prices, and passing
   * the player's explicit choice, before calling this whenever
   * getRepositionPrice() > 0 in either currency, exactly like every other
   * Gems purchase in this engine (switchTowerSpecialization,
   * purchaseTowerSkin, ...): this method performs the action unconditionally
   * once called, it never itself prompts, and never auto-picks a currency.
   * `currency` is ignored (may be omitted) when the free daily use applies.
   */
  repositionTower(fromSlotId: string, toSlotId: string, currency?: GemCurrency): boolean {
    if (!this.canModifyLoadout()) return false;
    if (fromSlotId === toSlotId) return false;

    const fromTower = this.towers.find((t) => t.slotId === fromSlotId);
    const toSlot = getSite(this.layout, toSlotId);
    if (!fromTower || !toSlot) return false;

    const isFree = this.isFreeRepositionAvailable();
    const cost = isFree ? 0 : gemPriceForCurrency(REPOSITION_GEM_PRICE, currency ?? "PURCHASED");
    if (!isFree && (!currency || !this.canAffordGemsInCurrency(cost, currency))) return false;

    const toTower = this.towers.find((t) => t.slotId === toSlotId);
    const fromSlot = getSite(this.layout, fromSlotId)!;

    fromTower.slotId = toSlotId;
    fromTower.position = toSlot.position;
    fromTower.siteTrait = toSlot.trait;
    if (toTower) {
      toTower.slotId = fromSlotId;
      toTower.position = fromSlot.position;
      toTower.siteTrait = fromSlot.trait;
    }

    if (isFree) {
      this.lastFreeRepositionDayIndex = getCurrentDayIndex();
    } else {
      this.spendGems(cost, "tower_reposition", currency!);
    }

    this.persist();
    this.notify();
    return true;
  }

  // ---------------------------------------------------------------------
  // MAP LAYOUTS / DEPLOY — every phase has its own map (data/mapLayouts.ts).
  // When the run moves onto a different map, every tower keeps its level,
  // Mastery, specialization, skin and items and comes off the old map onto
  // the deploy bench. On the real game screen the run pauses in DEPLOY and
  // the player places each tower once; headless engines (offline progress,
  // simulations) place them with autoArrange() and keep going.
  // ---------------------------------------------------------------------

  /** The real game screen opts in to the DEPLOY pause (headless engines auto-arrange and keep going). */
  enableDeployPause(enabled = true): void {
    this.deployPauseEnabled = enabled;
  }

  getMapLayout(): MapLayout {
    return this.layout;
  }

  /** The real game screen opts in to anonymous balance telemetry (telemetry/balanceTelemetry.ts). */
  enableTelemetry(enabled = true): void {
    this.telemetryEnabled = enabled;
  }

  private defenceSnapshot(): DefenceSnapshot {
    const byType: DefenceSnapshot["towersByType"] = {};
    for (const t of [...this.towers, ...this.deployBench]) byType[t.type] = (byType[t.type] ?? 0) + 1;
    const all = [...this.towers, ...this.deployBench];
    return {
      towerCount: all.length,
      towersByType: byType,
      avgTowerLevel: all.length ? Math.round((all.reduce((a, t) => a + t.level, 0) / all.length) * 10) / 10 : 0,
      maxTowerLevel: all.reduce((m, t) => Math.max(m, t.level), 0),
      castleMaxHp: this.maxBaseHp,
    };
  }

  private telemetryBase(wave: number) {
    return {
      device: deviceId(),
      at: Date.now(),
      mode: this.storageKey === SAVE_STORAGE_KEY ? "main" : "other",
      wave,
      phase: phaseNumberFromWave(wave),
      map: this.layout.id,
    };
  }

  /** Holds the run (no enemy moves, nothing spawns) while the first-run tutorial waits on the player. */
  setTutorialHold(held: boolean): void {
    this.tutorialHold = held;
  }

  /**
   * Moves the run onto the current wave's map if it isn't already on it:
   * every tower comes off the old map onto the deploy bench, and the real
   * game screen pauses in DEPLOY until the player has placed them all.
   * Headless engines (no player to ask) place the bench automatically.
   * Returns true when the map changed or DEPLOY began.
   */
  private syncMapLayout(): boolean {
    const target = getMapLayout(getPhaseForWave(Math.max(1, this.wave.currentWave)).biomeId);
    let changed = false;
    if (target.id !== this.layout.id) {
      this.layout = target;
      // Anything still on the old road would be walking the wrong path.
      this.enemies = [];
      this.projectiles = [];
      this.selectedTowerId = null;
      this.deployBench.push(...this.towers);
      this.towers = [];
      changed = true;
    }
    setActiveMapLayout(this.layout);
    let enteredDeploy = false;
    if (this.deployBench.length > 0) {
      const canAskPlayer = this.deployPauseEnabled && this.phase !== "PROGRESSION_STOPPED" && this.phase !== "OFFLINE_RETURN";
      if (!canAskPlayer) this.autoPlaceBench();
      else if (this.phase !== "DEPLOY") {
        this.deployResumePhase = this.phase;
        this.phase = "DEPLOY";
        enteredDeploy = true;
      }
    }
    if (!changed && !enteredDeploy) return false;
    this.persist();
    this.notify();
    return true;
  }

  /** Places every benched tower on the free site that suits it best (headless runs only — a player always chooses). */
  private autoPlaceBench(): void {
    const used = new Set(this.towers.map((t) => t.slotId));
    const freeLayout: MapLayout = { ...this.layout, sites: this.layout.sites.filter((s) => !used.has(s.id)) };
    const assignment = autoArrange(this.deployBench, freeLayout);
    const spare = freeLayout.sites.filter((s) => ![...assignment.values()].includes(s.id));
    const stillBenched: TowerInstance[] = [];
    for (const tower of this.deployBench) {
      const siteId = assignment.get(tower.id) ?? spare.shift()?.id;
      const site = siteId ? getSite(this.layout, siteId) : undefined;
      if (!site) {
        stillBenched.push(tower); // never lose a tower, even if the map were somehow full
        continue;
      }
      this.towers.push(this.reinstantiateOnSite(tower, site.id));
    }
    this.deployBench = stillBenched;
  }

  /** Rebuilds a tower on `siteId` from its own progress, picking up any type-wide change (skin, Mastery, item slots) made while it was benched. */
  private reinstantiateOnSite(tower: TowerInstance, siteId: string): TowerInstance {
    return this.instantiateTowerFromLoadout({ ...this.loadoutEntryOf(tower), slotId: siteId });
  }

  private loadoutEntryOf(t: TowerInstance): TowerLoadoutEntry {
    return {
      slotId: t.slotId,
      type: t.type,
      level: t.level,
      specializationId: t.specializationId,
      specializationLevel: t.specializationLevel,
      equippedSkinId: t.equippedSkinId,
      masteryLevel: t.masteryLevel,
      equippedItemInstanceIds: t.equippedItemInstanceIds,
    };
  }

  /** Towers still waiting to be placed on this map (DEPLOY). */
  getDeployBench(): readonly TowerInstance[] {
    return this.deployBench;
  }

  /**
   * DEPLOY only: puts a benched tower on a free site. Once per tower per map
   * — a placed tower can't be picked up again here; moving it afterwards is
   * the regular reposition (the daily free move, then Gems).
   */
  deployPlaceTower(towerId: string, siteId: string): boolean {
    if (this.phase !== "DEPLOY") return false;
    const index = this.deployBench.findIndex((t) => t.id === towerId);
    const site = getSite(this.layout, siteId);
    if (index < 0 || !site || this.towers.some((t) => t.slotId === siteId)) return false;
    const [tower] = this.deployBench.splice(index, 1);
    this.towers.push(this.reinstantiateOnSite(tower!, site.id));
    this.persist();
    this.notify();
    return true;
  }

  /** Ends DEPLOY and lets the phase begin. */
  confirmDeployment(): void {
    // every tower has to be on the map first
    if (this.phase !== "DEPLOY" || this.deployBench.length > 0) return;
    this.phase = this.deployResumePhase ?? "RUNNING";
    this.deployResumePhase = null;
    this.selectedTowerId = null;
    this.persist();
    this.notify();
  }

  selectTower(towerId: string | null): void {
    this.selectedTowerId = towerId;
    this.notify();
  }

  upgradeSelectedTower(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;

    const cost = getTowerUpgradeCost(tower);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    upgradeTowerEntity(tower);
    this.trackMission("UPGRADE_TOWERS");
    const unlock = getMilestoneUnlockForLevel(tower.type, tower.level);
    this.emitAudio(unlock ? { type: "level_unlock" } : { type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  /**
   * HORDENOVA Season/Progression v1.0 — TOWER MASTERY: the uncapped sink
   * past MAX_TOWER_LEVEL. Deliberately available at ANY tower level (not
   * gated behind a specific level) — a player free to invest earlier if
   * they'd rather spread spending out, exactly like Specialization already
   * works once its own level gate is passed.
   *
   * Ownership (`this.masteryUnlocked`, permanent per TYPE) and progression
   * (`this.towerMasteryLevels`, SEASON-scoped per TYPE) are fully separate:
   * a one-time GOLD purchase (getMasteryUnlockGoldCost, handled by
   * unlockSelectedTowerMastery below) grants ownership FOREVER — it does
   * NOT touch the level at all, including on the very first purchase. Every
   * level, in every Season including the first, is also bought with Gold
   * via upgradeSelectedTowerMastery, which requires ownership but reads from
   * whatever the CURRENT (Season-scoped) level happens to be — 0 at the
   * start of every Season, owned or not. FASE 6 (currency division): Mastery
   * is entirely Gold-funded now, unlock included — Gems never buy any part
   * of it, and are reserved for Prestige and Specialization path
   * unlock/change instead. See config/towerMastery.ts's getMasteryBonuses
   * doc comment for why this is still not "Gold buys unlimited power":
   * every effect is routed through masteryEffectScale's diminishing returns.
   */
  canUnlockSelectedTowerMastery(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && this.masteryUnlocked[tower.type] !== true;
  }

  /** Pays the one-time, permanent Gold cost (getMasteryUnlockGoldCost) to grant the selected tower's TYPE Mastery ownership forever. Never re-charged for this type again, in any future Season. Does NOT touch the current (Season-scoped) Mastery level. */
  unlockSelectedTowerMastery(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || this.masteryUnlocked[tower.type] === true) return false;
    const cost = getMasteryUnlockGoldCost(tower.type);
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.masteryUnlocked[tower.type] = true;
    for (const other of this.towers) {
      if (other.type === tower.type) other.masteryUnlocked = true;
    }
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  /** GOLD-funded, uncapped upgrade of the selected tower's TYPE mastery level (0 -> 1 -> 2 -> ... forever, resetting to 0 every Season) — requires Mastery ownership (see unlockSelectedTowerMastery), never re-checks or re-charges it. */
  upgradeSelectedTowerMastery(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canUpgradeMastery(tower)) return false;

    const cost = getMasteryUpgradeCostFor(tower);
    if (this.gold < cost) return false;

    this.gold -= cost;
    upgradeMasteryEntity(tower);
    this.towerMasteryLevels[tower.type] = tower.masteryLevel;
    for (const other of this.towers) {
      if (other.type === tower.type && other.id !== tower.id) other.masteryLevel = tower.masteryLevel;
    }
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // TOWER MANA (config/towerMana.ts) — hold/release the specials and the
  // per-type Gold mana upgrade (Season-scoped, like Mastery).
  // -------------------------------------------------------------------

  /** Holds every special (towers keep charging past full, for a stronger hit) or lets them go. Only while a wave or boss fight is on. */
  setSpecialsHeld(held: boolean): boolean {
    if (held && this.phase !== "RUNNING" && this.phase !== "BOSS_INTRO" && this.phase !== "BOSS_BATTLE") return false;
    this.specialsHeld = held;
    this.specialsHeldWave = this.wave.currentWave;
    this.notify();
    return true;
  }

  isSpecialsHeld(): boolean {
    return this.specialsHeld;
  }

  /** Gold for the selected tower TYPE's next mana level, or null when there's no selection or it's at the top. */
  getSelectedTowerManaUpgradeCost(): number | null {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return tower ? getManaUpgradeCost(tower.type, tower.manaLevel) : null;
  }

  upgradeSelectedTowerMana(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const cost = getManaUpgradeCost(tower.type, tower.manaLevel);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    const level = tower.manaLevel + 1;
    this.towerManaLevels[tower.type] = level;
    for (const other of this.towers) if (other.type === tower.type) other.manaLevel = level;
    for (const other of this.deployBench) if (other.type === tower.type) other.manaLevel = level;
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Specialization / Upgrade Slot (spec section 5/6).
  // The fix for "reaches phase 46 in 20 minutes": a genuine, player-chosen
  // gold sink that keeps mattering well past MAX_TOWER_LEVEL. See
  // config/specializations.ts for the full design rationale.
  //
  // HORDENOVA Season/Progression v1.0 — ownership (`this.
  // unlockedSpecializationIds`, permanent per TYPE) and progression
  // (`specializationId`/`specializationLevel`, on the tower instance,
  // SEASON-scoped) are fully separate, exactly mirroring Mastery above.
  // -------------------------------------------------------------------

  canChooseSpecializationForSelectedTower(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && canChooseSpecialization(tower);
  }

  /** Every SpecializationId this account has ever purchased for `type` — permanent, never reset. Used by the UI to show an already-owned path as a free re-activation instead of another SPECIALIZATION_UNLOCK_GEM_PRICE charge. */
  getUnlockedSpecializationIdsForType(type: TowerType): readonly SpecializationId[] {
    return this.unlockedSpecializationIds[type] ?? [];
  }

  isSpecializationUnlocked(type: TowerType, id: SpecializationId): boolean {
    return this.getUnlockedSpecializationIdsForType(type).includes(id);
  }

  getSpecializationUnlockPrice(): DualGemPrice {
    return SPECIALIZATION_UNLOCK_GEM_PRICE;
  }

  getSpecializationChangePrice(): DualGemPrice {
    return SPECIALIZATION_CHANGE_GEM_PRICE;
  }

  /**
   * The CHOICE of a specialization path (null -> an active pick, for THIS
   * Season) is free the moment the account already owns that exact path
   * (see isSpecializationUnlocked) — re-activating something already paid
   * for never charges Gems again. Choosing a path this account has NEVER
   * owned costs SPECIALIZATION_UNLOCK_GEM_PRICE Gems (in the caller's
   * explicitly chosen `currency`), once, and grants PERMANENT ownership of
   * it from that point on. Every level after the choice (via
   * upgradeSelectedTowerSpecialization below) always costs Gold.
   */
  chooseTowerSpecialization(specializationId: SpecializationId, currency: GemCurrency = "PURCHASED"): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canChooseSpecialization(tower)) return false;

    const alreadyOwned = this.isSpecializationUnlocked(tower.type, specializationId);
    const cost = gemPriceForCurrency(SPECIALIZATION_UNLOCK_GEM_PRICE, currency);
    if (!alreadyOwned && !this.canAffordGemsInCurrency(cost, currency)) return false;

    const applied = chooseSpecializationEntity(tower, specializationId);
    if (!applied) return false;

    if (!alreadyOwned) {
      this.spendGems(cost, `specialization:${specializationId}`, currency);
      const owned = this.unlockedSpecializationIds[tower.type] ?? [];
      this.unlockedSpecializationIds[tower.type] = [...owned, specializationId];
    }
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  /**
   * "Trocar Especialização" — a flat, unconditional SPECIALIZATION_CHANGE_
   * GEM_PRICE Gems purchase (in the caller's explicitly chosen `currency`)
   * that switches the selected tower's ACTIVE specialization to a DIFFERENT
   * path this account already owns. Replaces the old Specialization Respec
   * Token system entirely: there is no free or earned respec anymore, only
   * this flat Gems purchase, and it only ever moves between paths already
   * paid for once — picking a brand-new path still goes through
   * chooseTowerSpecialization instead.
   */
  canSwitchSelectedTowerSpecialization(newId: SpecializationId): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canSwitchSpecialization(tower) || newId === tower.specializationId) return false;
    return this.isSpecializationUnlocked(tower.type, newId);
  }

  switchTowerSpecialization(newId: SpecializationId, currency: GemCurrency = "PURCHASED"): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !this.canSwitchSelectedTowerSpecialization(newId)) return false;
    const cost = gemPriceForCurrency(SPECIALIZATION_CHANGE_GEM_PRICE, currency);
    if (!this.canAffordGemsInCurrency(cost, currency)) return false;

    this.spendGems(cost, `specialization_change:${newId}`, currency);
    switchSpecializationEntity(tower, newId);
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  upgradeSelectedTowerSpecialization(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canUpgradeSpecialization(tower)) return false;

    const cost = getSpecializationUpgradeCostFor(tower);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    upgradeSpecializationEntity(tower);
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // BALANCEAMENTO DEFINITIVO spec section 7 — Tower Equipment Slots.
  // Architecture only: equipping never grants combat power in this pass
  // (see config/towerItemSlots.ts's own doc comment). GameEngine is the
  // only place that can see EVERY tower's equipped items at once, so the
  // "not already equipped on a DIFFERENT tower" duplication guard lives
  // here rather than in entities/Tower.ts.
  // -------------------------------------------------------------------

  /** The selected tower's equipment slots as real ItemInstance objects (null for an empty slot), for UI rendering. */
  getSelectedTowerItemSlots(): (ItemInstance | null)[] {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return Array(TOWER_ITEM_SLOT_COUNT).fill(null);
    return tower.equippedItemInstanceIds.map((id) => (id ? findItem(this.inventory, id) : null));
  }

  /** Whether `instanceId` (an item this account owns) can be equipped into the selected tower's `slotIndex` right now. */
  canEquipItemOnSelectedTower(instanceId: string, slotIndex: number): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const item = findItem(this.inventory, instanceId);
    if (!item) return false;
    const equippedElsewhere = this.towers.some(
      (t) => t.id !== tower.id && t.equippedItemInstanceIds.includes(instanceId),
    );
    return canEquipItem(tower, slotIndex, item, equippedElsewhere);
  }

  /** Equips `instanceId` into the selected tower's `slotIndex`. Auto-unequips it from wherever else it currently sits on THIS same tower (an item can occupy only one slot at a time), and refuses if it's already equipped on a different tower or mid-trade. */
  equipItemOnSelectedTower(instanceId: string, slotIndex: number): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    if (!this.canEquipItemOnSelectedTower(instanceId, slotIndex)) return false;

    const currentSlot = tower.equippedItemInstanceIds.indexOf(instanceId);
    if (currentSlot !== -1) unequipItemEntity(tower, currentSlot);
    equipItemEntity(tower, slotIndex, instanceId);
    this.itemBonusDirty = true;
    this.persist();
    this.notify();
    return true;
  }

  /** Empties the selected tower's `slotIndex` — a no-op if it was already empty. */
  unequipItemFromSelectedTower(slotIndex: number): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    unequipItemEntity(tower, slotIndex);
    this.itemBonusDirty = true;
    this.persist();
    this.notify();
    return true;
  }

  /**
   * SISTEMA DE SLOTS DE EQUIPAMENTO — the selected tower's per-slot
   * unlocked state, for UI rendering (index 0 is always true). Independent
   * from getSelectedTowerItemSlots — a slot can read unlocked here with a
   * null entry there (nothing equipped yet).
   */
  getSelectedTowerUnlockedSlots(): boolean[] {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return Array(TOWER_ITEM_SLOT_COUNT).fill(false);
    return [...tower.unlockedItemSlots];
  }

  /** Gems cost to unlock `slotIndex` on the selected tower's TYPE, for UI display before purchase. Returns null for an out-of-range index. */
  getItemSlotUnlockGemCost(slotIndex: number): number | null {
    if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return null;
    return getItemSlotUnlockCost(slotIndex);
  }

  /** GEMS ECONOMY v2 — dual price to unlock `slotIndex`, for UI display before purchase. Returns null for an out-of-range index. */
  getItemSlotUnlockDualPrice(slotIndex: number): DualGemPrice | null {
    if (slotIndex < 0 || slotIndex >= TOWER_ITEM_SLOT_COUNT) return null;
    return getItemSlotUnlockPrice(slotIndex);
  }

  /** Whether `slotIndex` is purchasable on the selected tower right now with `currency` — not already unlocked, in range, and this account can afford that currency's price. UI is responsible for the mandatory confirmation step before calling unlockItemSlotOnSelectedTower. */
  canUnlockItemSlotOnSelectedTower(slotIndex: number, currency: GemCurrency): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canUnlockItemSlot(tower, slotIndex)) return false;
    return this.canAffordGemsInCurrency(gemPriceForCurrency(getItemSlotUnlockPrice(slotIndex), currency), currency);
  }

  /**
   * Pays the one-time, PERMANENT Gems price (in the caller's explicitly
   * chosen `currency`) to unlock `slotIndex` on the selected tower's TYPE,
   * forever — never re-charged for this type/slot again, never re-locked by
   * a Season Reset (unlockedItemSlots is never touched by AscensionManager's
   * season-reset updateSave call). Synced across every placed tower of the
   * same type, exactly like unlockSelectedTowerMastery.
   */
  unlockItemSlotOnSelectedTower(slotIndex: number, currency: GemCurrency): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !this.canUnlockItemSlotOnSelectedTower(slotIndex, currency)) return false;

    const cost = gemPriceForCurrency(getItemSlotUnlockPrice(slotIndex), currency);
    this.spendGems(cost, `item_slot:${tower.type}:${slotIndex}`, currency);
    unlockItemSlotEntity(tower, slotIndex);
    const updated = [...tower.unlockedItemSlots];
    this.unlockedItemSlots[tower.type] = updated;
    for (const other of this.towers) {
      if (other.type === tower.type && other.id !== tower.id) other.unlockedItemSlots = [...updated];
    }
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // SISTEMA DE FUSÃO DE ITENS — a large, intentional ITEM SINK. Select
  // exactly FUSION_ITEM_COUNT (3) items of the SAME rarity for one attempt
  // at exactly 1 item of the next tier. See config/itemFusion.ts for the
  // final chance table (never a balance lever) and engine/ItemFusion.ts for
  // the pure eligibility/roll functions this method calls into.
  // -------------------------------------------------------------------

  /** Read-only pre-check for the UI (enables/disables CONFIRMAR FUSÃO, and explains why when blocked) — re-validated again, unconditionally, at the top of attemptFusion itself. */
  getFusionEligibility(selectedInstanceIds: readonly string[]): ReturnType<typeof checkFusionEligibility> {
    return checkFusionEligibility(this.inventory, selectedInstanceIds, this.playerId);
  }

  /**
   * ATOMIC 8-step fusion operation, exactly per spec: 1) validate the 3
   * items; 2) validate ownership; 3) validate rarity; 4) validate
   * eligibility — steps 1-4 are checkFusionEligibility, re-run here against
   * the REAL, current this.inventory rather than trusting an earlier UI
   * read, so a BLOCKED result (steps 1-4 failing) leaves the inventory
   * completely untouched — no consumption, no roll, no persist. Steps 5-8
   * (consume the 3 items, roll, create exactly 1 superior item ONLY on
   * success, persist) always run together as one synchronous call, so
   * there is no window where 3 items are consumed but the operation hasn't
   * finished — no duplication, no double-consumption, no phantom item.
   *
   * The success chance is FINAL (config/itemFusion.ts) and is never
   * increased by Prestige, Mastery, Specialization, or by paying extra
   * Gems — this method reads nothing from any of those systems. On
   * failure the 3 items are gone with ZERO compensation — INTENCIONAL, no
   * pity, no guarantee-after-N-attempts state anywhere.
   */
  attemptFusion(selectedInstanceIds: readonly string[]): FusionOutcome {
    // Steps 1-4.
    const eligibility = checkFusionEligibility(this.inventory, selectedInstanceIds, this.playerId);
    if (!eligibility.ok) return { status: "BLOCKED", reason: eligibility.reason! };
    if (!this.canModifyLoadout()) return { status: "BLOCKED", reason: "NOT_ELIGIBLE" };

    const rarity = eligibility.rarity as Rarity;
    const nextRarity = eligibility.nextRarity as Rarity;

    // Step 5 — consume exactly the 3 items. Any of them currently equipped
    // on a tower is unequipped FIRST, so no dangling equippedItemInstanceIds
    // reference (an "item fantasma") is ever left pointing at a now-gone
    // instanceId — the exact gap TradeManager.ts's own doc comment notes as
    // pre-existing and out of scope to fix generally, never replicated here.
    const consumedIds = new Set(selectedInstanceIds);
    for (const tower of this.towers) {
      for (let slotIndex = 0; slotIndex < tower.equippedItemInstanceIds.length; slotIndex++) {
        if (tower.equippedItemInstanceIds[slotIndex] && consumedIds.has(tower.equippedItemInstanceIds[slotIndex]!)) {
          unequipItemEntity(tower, slotIndex);
        }
      }
    }
    // account-bound inputs (Season Pass / Store rewards) make an account-bound result
    const allInputsTradable = this.inventory.filter((item) => consumedIds.has(item.instanceId)).every((item) => item.tradable);
    this.inventory = this.inventory.filter((item) => !consumedIds.has(item.instanceId));

    for (const instanceId of selectedInstanceIds) {
      appendLedgerEvent({
        itemInstanceId: instanceId,
        source: "fusion",
        eventType: "ITEM_CONSUMED",
        fromOwner: this.playerId,
        toOwner: null,
      });
    }

    // Step 6.
    const success = rollFusion(rarity);

    if (!success) {
      appendLedgerEvent({
        source: "fusion",
        eventType: "ITEM_DESTROYED",
        fromOwner: this.playerId,
        toOwner: null,
        amount: FUSION_ITEM_COUNT,
      });
      this.persist(); // Step 8.
      this.notify();
      return { status: "FAILURE", rarity, nextRarity };
    }

    // Step 7 — create exactly 1 superior item, ONLY on success.
    const resultDefinitionId = pickFusionResultDefinitionId(nextRarity);
    if (!resultDefinitionId) {
      // Structurally unreachable (checkFusionEligibility already confirmed
      // nextRarity is a real tier with a real item definition) — treated
      // defensively as a failure rather than ever risking a phantom result.
      this.persist();
      this.notify();
      return { status: "FAILURE", rarity, nextRarity };
    }

    const resultItem = createItemInstance(resultDefinitionId, this.playerId, { type: "FUSION", refId: "fusion" });
    if (!allInputsTradable) resultItem.tradable = false;
    const addResult = addItemWithCapacity(this.inventory, this.overflowInventory, resultItem, this.inventoryCapacity);
    this.inventory = addResult.inventory;
    this.overflowInventory = addResult.overflow;

    appendLedgerEvent({
      itemInstanceId: resultItem.instanceId,
      itemDefinitionId: resultItem.itemDefinitionId,
      source: "fusion",
      eventType: "ITEM_CREATED",
      fromOwner: null,
      toOwner: this.playerId,
    });

    this.persist(); // Step 8.
    this.notify();
    return { status: "SUCCESS", rarity, nextRarity, resultItem };
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Tower Skins (spec section 10/11). Purely cosmetic:
  // never touches gold, level, specialization, or combat.
  //
  // CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE): a skin must be PURCHASED
  // with Gems (purchaseTowerSkin below) before it can ever be equipped —
  // reaching its unlockLevel only makes it purchasable, it no longer grants
  // it for free. Ownership (this.ownedTowerSkinIds) and the equipped choice
  // (this.equippedTowerSkinByType, keyed by TYPE) are both PERMANENT and
  // survive every Season boundary untouched, unlike tower level itself.
  // -------------------------------------------------------------------

  /** Gems cost to buy `skinId`, or null if the id isn't a real skin — read by UI before calling purchaseTowerSkin. */
  getTowerSkinGemCost(skinId: string): number | null {
    return getTowerSkinDefinition(skinId)?.gemCost ?? null;
  }

  /** GEMS ECONOMY v2 — dual price to buy `skinId` (🔒 1,200 / 💎 800 for every PREMIUM commercial skin), or null if the id isn't a real skin. */
  getTowerSkinDualGemPrice(skinId: string): DualGemPrice | null {
    const def = getTowerSkinDefinition(skinId);
    return def ? getTowerSkinDualPrice(def) : null;
  }

  isTowerSkinOwned(skinId: string): boolean {
    return this.ownedTowerSkinIds.has(skinId);
  }

  canPurchaseSkinForSelectedTower(skinId: string): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && canPurchaseSkinEntity(tower, skinId, this.ownedTowerSkinIds);
  }

  /** Debits Gems atomically (spendGems already guards insufficient balance) and grants PERMANENT ownership — never revoked by a future Season's tower-level reset. */
  purchaseTowerSkin(skinId: string, currency: GemCurrency): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canPurchaseSkinEntity(tower, skinId, this.ownedTowerSkinIds)) return false;

    const def = getTowerSkinDefinition(skinId);
    if (!def) return false;
    const cost = gemPriceForCurrency(getTowerSkinDualPrice(def), currency);
    if (!this.spendGems(cost, `tower_skin:${skinId}`, currency)) return false;

    this.ownedTowerSkinIds.add(skinId);
    this.persist();
    this.notify();
    return true;
  }

  equipSkinOnSelectedTower(skinId: string | null): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const applied = equipSkinEntity(tower, skinId, this.ownedTowerSkinIds);
    if (applied) {
      if (skinId === null) delete this.equippedTowerSkinByType[tower.type];
      else this.equippedTowerSkinByType[tower.type] = skinId;
      for (const other of this.towers) {
        if (other.type === tower.type && other.id !== tower.id) other.equippedSkinId = skinId;
      }
      this.persist();
      this.notify();
    }
    return applied;
  }

  // -------------------------------------------------------------------
  // GEMS ECONOMY v2 — dual-currency Gem Economy. Every mutation routes
  // through here and appends a ledger event (engine/EconomyLedger.ts,
  // tagged with `currency`) — see the field-level comment on `freeGems`/
  // `purchasedGems`/`gemShards` above for why this already satisfies the
  // "no direct UI mutation" requirement. NO method in this block ever
  // blends the two balances or moves value from one into the other — see
  // config/gemsEconomy.ts's own header for the full no-conversion contract.
  // -------------------------------------------------------------------

  getFreeGemBalance(): number {
    return this.freeGems;
  }

  getPurchasedGemBalance(): number {
    return this.purchasedGems;
  }

  getGemShardBalance(): number {
    return this.gemShards;
  }

  /** 🔒 Grants Free Gems — used ONLY for gameplay rewards (Gem Shard conversion, Roulette, Prestige/Ascension/Season milestones). Never called for a real-money purchase. */
  private addFreeGems(amount: number, source: string): void {
    if (amount <= 0) return;
    this.freeGems += amount;
    appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: this.playerId, source, amount, currency: "FREE" });
  }

  /**
   * 💎 Grants Purchased Gems — PUBLIC (unlike addFreeGems) because this is
   * the one real entry point a future real-money IAP integration would
   * call. No payment gateway exists in this local client (see config/
   * gemsEconomy.ts's header) — nothing in this codebase calls this today —
   * but the architecture must not block a real purchase flow from plugging
   * in here later. Never called for a gameplay reward.
   */
  addPurchasedGems(amount: number, source: string): void {
    if (amount <= 0) return;
    this.purchasedGems += amount;
    appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: this.playerId, source, amount, currency: "PURCHASED" });
    this.persist();
    this.notify();
  }

  // -------------------------------------------------------------------
  // DAILY MISSIONS (config/dailyMissions.ts)
  // -------------------------------------------------------------------

  /** Rolls the state over to a fresh set when the day changed. */
  private currentMissions(): DailyMissionsState {
    const today = getCurrentDayIndex();
    if (this.dailyMissions.dayIndex !== today) this.dailyMissions = freshMissionsState(today);
    return this.dailyMissions;
  }

  private missionRewardGold(): number {
    return getScaledEnemyStats("CRAWLER", Math.max(1, this.wave.currentWave)).goldReward * MISSION_REWARD_KILLS_WORTH_OF_GOLD;
  }

  getDailyMissions(): DailyMissionView[] {
    const state = this.currentMissions();
    const gold = this.missionRewardGold();
    return missionsForDay(state.dayIndex).map((def, i) => ({
      kind: def.kind,
      target: def.target,
      progress: Math.min(def.target, state.progress[i] ?? 0),
      claimed: state.claimed[i] === true,
      rewardShards: MISSION_REWARD_SHARDS,
      rewardGold: gold,
    }));
  }

  private missionsKey(): string {
    const state = this.currentMissions();
    return `${state.dayIndex}:${state.progress.join(",")}:${state.claimed.map((c) => (c ? 1 : 0)).join("")}`;
  }

  /** Season Pass XP (config/seasonPass.ts) — a new Season starts the pass over. */
  private addPassXp(source: PassXpSource): void {
    const season = seasonClock.getCurrentSeasonWindow().seasonNumber;
    if (this.seasonPass.seasonNumber !== season) this.seasonPass = freshPassState(season);
    this.seasonPass.xp += PASS_XP[source];
  }

  /** Counts a real gameplay event toward today's missions of that kind. */
  private trackMission(kind: MissionKind, amount = 1): void {
    const state = this.currentMissions();
    missionsForDay(state.dayIndex).forEach((def, i) => {
      if (def.kind === kind && !state.claimed[i]) state.progress[i] = Math.min(def.target, (state.progress[i] ?? 0) + amount);
    });
  }

  /** Grants a finished mission's reward (Gem Shards + Gold) once. */
  claimDailyMission(index: number): boolean {
    const state = this.currentMissions();
    const def = missionsForDay(state.dayIndex)[index];
    if (!def || state.claimed[index] || (state.progress[index] ?? 0) < def.target) return false;
    state.claimed[index] = true;
    this.gold += this.missionRewardGold();
    this.addGemShards(MISSION_REWARD_SHARDS, `daily_mission:${def.kind}`);
    this.addPassXp("MISSION_CLAIMED");
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  /** Paid tower skins' reward bonus (config/towerSkins.ts — SKIN_REWARD_BONUS_PER_TYPE): +5% Gold and Gem Shards per tower type in play wearing a paid skin. Never affects combat. */
  getSkinRewardMultiplier(): number {
    return getSkinRewardMultiplier(this.equippedTowerSkinByType, this.towers.map((t) => t.type));
  }

  private withSkinGoldBonus(amount: number): number {
    const extra = amount * (this.getSkinRewardMultiplier() - 1) + this.skinGoldCarry;
    const whole = Math.floor(extra);
    this.skinGoldCarry = extra - whole;
    return amount + whole;
  }

  private withSkinShardBonus(amount: number): number {
    const extra = amount * (this.getSkinRewardMultiplier() - 1) + this.skinShardCarry;
    const whole = Math.floor(extra);
    this.skinShardCarry = extra - whole;
    return amount + whole;
  }

  private addGemShards(amount: number, source: string): void {
    if (amount <= 0) return;
    this.gemShards += amount;
    appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: this.playerId, source, amount });
  }

  canAffordFreeGems(amount: number): boolean {
    return this.freeGems >= amount;
  }

  canAffordPurchasedGems(amount: number): boolean {
    return this.purchasedGems >= amount;
  }

  /** Reads whichever balance `currency` names — the one place every dual-priced method below decides "can I afford this", so no call site hand-rolls the branch differently. */
  canAffordGemsInCurrency(amount: number, currency: GemCurrency): boolean {
    return currency === "FREE" ? this.canAffordFreeGems(amount) : this.canAffordPurchasedGems(amount);
  }

  /**
   * Spends EXACTLY `amount` from the ONE bucket `currency` names — never
   * blends Free+Purchased, never auto-selects, never allows a partial
   * payment split across both (spec: "pagamento não pode ser dividido
   * automaticamente"). Gems are only ever spent on Convenience and
   * Cosmetics — never damage/HP/level/victory/phase directly (spec section
   * 23's forbidden list). Callers are responsible for applying whatever the
   * purchase unlocks; this method only owns the balance mutation + ledger
   * record.
   */
  spendGems(amount: number, reason: string, currency: GemCurrency): boolean {
    if (amount <= 0) return false;
    if (currency === "FREE") {
      if (this.freeGems < amount) return false;
      this.freeGems -= amount;
    } else {
      if (this.purchasedGems < amount) return false;
      this.purchasedGems -= amount;
    }
    appendLedgerEvent({ eventType: "GEMS_SPENT", fromOwner: this.playerId, toOwner: null, source: reason, amount, currency });
    this.persist();
    this.notify();
    return true;
  }

  /** Gem Shards -> Gems conversion (spec section 34: "se a conversão não fizer sentido, deixe a arquitetura preparada sem inventar uma economia arbitrária"). A conservative fixed rate, player-triggered — never automatic. GEMS ECONOMY v2: lands ONLY in `freeGems` — Fragments are a gameplay-earned resource, so their converted value is gameplay-earned too; this conversion must never inflate `purchasedGems`. */
  static readonly GEM_SHARD_TO_GEM_RATE = 10;

  /**
   * AUDITORIA E CORREÇÃO GERAL spec section 15 — "a mesma função/regra deve
   * ser usada por: UI, clique, validação. Não criar regras diferentes." This
   * static, pure, side-effect-free predicate is the ONE place that decides
   * eligibility — both convertGemShards() below and the InventoryPanel UI's
   * button-disabled state call this exact function, so they can never drift
   * apart (which was the real root cause of the reported bug: the UI used
   * to show the convert button for ANY gemShards > 0 with no disabled state
   * at all, so a balance below GEM_SHARD_TO_GEM_RATE looked clickable but
   * silently did nothing when clicked — indistinguishable from "the button
   * doesn't work" even when the underlying engine logic was already correct).
   */
  static canConvertGemShards(gemShards: number): boolean {
    return gemShards >= GameEngine.GEM_SHARD_TO_GEM_RATE;
  }

  /**
   * REFAZER ATRIBUTOS — pays this item's re-roll price in Gem Shards
   * (config/itemRolls.ts) and rolls new values for every effect, uniform
   * inside the ranges the item shows. Refused for items without effects,
   * items listed in a trade or auction, or not enough Shards. Returns the
   * new values, or null when refused.
   */
  rerollItem(instanceId: string): number[] | null {
    const index = this.inventory.findIndex((item) => item.instanceId === instanceId);
    if (index === -1) return null;
    const item = this.inventory[index]!;
    if (item.pendingTrade || item.pendingAuction) return null;
    const def = getItemDefinition(item.itemDefinitionId);
    const cost = rerollCost(item);
    if (!def || cost === null || this.gemShards < cost) return null;
    this.gemShards -= cost;
    const rolls = rollItemEffects(def);
    this.inventory = this.inventory.map((it, i) => (i === index ? { ...it, rolls } : it));
    this.itemBonusDirty = true;
    this.persist();
    this.notify();
    return rolls;
  }

  convertGemShards(): boolean {
    if (!GameEngine.canConvertGemShards(this.gemShards)) return false;
    const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;
    const shardsToConvert = Math.floor(this.gemShards / rate) * rate;
    const gemsGained = shardsToConvert / rate;
    this.gemShards -= shardsToConvert;
    this.addFreeGems(gemsGained, "gem_shard_conversion");
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // GEMS ECONOMY v2 — TRADE UNLOCK. The gate before the Marketplace
  // (listing OR bidding) becomes usable at all — see MarketplaceService.ts,
  // which enforces the SAME gate on its own side (Marketplace screens read
  // SaveData directly rather than through a live GameEngine instance, per
  // that file's own header). Exposed here too so live gameplay UI (the
  // Wallet) can show Trade status without a Marketplace screen mounted.
  // -------------------------------------------------------------------

  isTradeUnlocked(): boolean {
    return this.tradeUnlocked;
  }

  getTradeUnlockPrice(): DualGemPrice {
    return TRADE_UNLOCK_PRICE;
  }

  canUnlockTrade(currency: GemCurrency): boolean {
    if (this.tradeUnlocked) return false;
    return this.canAffordGemsInCurrency(gemPriceForCurrency(TRADE_UNLOCK_PRICE, currency), currency);
  }

  /** Spends the chosen currency's Trade Unlock price in full — never converts currency, only flips the permanent `tradeUnlocked` gate. */
  unlockTrade(currency: GemCurrency): boolean {
    if (!this.canUnlockTrade(currency)) return false;
    if (!this.spendGems(gemPriceForCurrency(TRADE_UNLOCK_PRICE, currency), "trade_unlock", currency)) return false;
    this.tradeUnlocked = true;
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // HORDENOVA Season/Progression v1.0 — PROFILE PRESTIGE. Permanent,
  // account-wide, uncapped Gem sink, gated behind PRESTIGE_MIN_BEST_WAVE.
  // Grants small, permanently-bounded Gold/Gem Shard bonuses (see
  // config/prestige.ts's getPrestigeBonuses) — never a combat-power lever,
  // and never touches damage/HP/attack speed.
  // -------------------------------------------------------------------

  getPrestigeLevel(): number {
    return this.prestigeLevel;
  }

  /** Whether this account's all-time bestWave has ever reached PRESTIGE_MIN_BEST_WAVE — a permanent, monotonic gate (see config/prestige.ts). */
  canUpgradePrestige(): boolean {
    return canUnlockPrestige(this.bestWave);
  }

  /** Current Gold/Gem Shard income multipliers from Prestige — see config/prestige.ts's getPrestigeBonuses doc comment for why these are permanently bounded rather than another infinite economic track. */
  getCurrentPrestigeBonuses(): PrestigeBonuses {
    return getPrestigeBonuses(this.prestigeLevel);
  }

  getPrestigeUpgradeDualPrice(): DualGemPrice {
    return getPrestigeUpgradeDualPrice(this.prestigeLevel);
  }

  upgradePrestige(currency: GemCurrency): boolean {
    if (!canUnlockPrestige(this.bestWave)) return false;
    const cost = gemPriceForCurrency(getPrestigeUpgradeDualPrice(this.prestigeLevel), currency);
    if (!this.spendGems(cost, "profile_prestige", currency)) return false;
    this.prestigeLevel += 1;
    this.grantEarnedPrestigeMilestoneRewards();
    this.persist();
    this.notify();
    return true;
  }

  /**
   * FASE 6 — grants every milestone reward (config/prestige.ts's
   * PRESTIGE_MILESTONE_REWARDS) this.prestigeLevel has ever reached but not
   * yet actually been granted. PROFILE_FRAME/TITLE rewards need no grant at
   * all — prestigeLevel itself is permanent and only ever increases, so
   * "prestigeLevel >= milestone.level" IS the permanent unlock check (see
   * config/prestige.ts's getEarnedPrestigeMilestoneRewards, used by the UI).
   * TOWER_SKIN/CASTLE_SKIN reuse the existing ownedTowerSkinIds/
   * unlockedCastleSkinIds architecture and are idempotent by construction
   * (re-adding an already-owned id is a no-op) — safe to call on every
   * upgrade AND once on load, so a save that already met a threshold before
   * this system existed is granted retroactively instead of only on its
   * NEXT future upgrade.
   */
  private grantEarnedPrestigeMilestoneRewards(): void {
    for (const reward of PRESTIGE_MILESTONE_REWARDS) {
      if (this.prestigeLevel < reward.level) continue;
      if (reward.type === "TOWER_SKIN") {
        for (const skin of PRESTIGE_TOWER_SKINS) this.ownedTowerSkinIds.add(skin.id);
      } else if (reward.type === "CASTLE_SKIN") {
        if (!this.unlockedCastleSkinIds.includes(PRESTIGE_CASTLE_SKIN_ID)) {
          this.unlockedCastleSkinIds = [...this.unlockedCastleSkinIds, PRESTIGE_CASTLE_SKIN_ID];
        }
      }
      // PROFILE_FRAME / TITLE: nothing to grant, see doc comment above.
    }
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Inventory Capacity + Overflow (spec section 36/39).
  // -------------------------------------------------------------------

  getInventoryCapacity(): number {
    return this.inventoryCapacity;
  }

  getOverflowInventory(): readonly ItemInstance[] {
    return this.overflowInventory;
  }

  /** Moves one item from the overflow waiting area into the usable inventory, if there's room. Never deletes anything either way. */
  claimOverflowItem(instanceId: string): boolean {
    const before = this.inventory.length;
    const result = claimFromOverflow(this.inventory, this.overflowInventory, instanceId, this.inventoryCapacity);
    this.inventory = result.inventory;
    this.overflowInventory = result.overflow;
    const claimed = this.inventory.length > before;
    if (claimed) {
      this.persist();
      this.notify();
    }
    return claimed;
  }

  /** CONQUISTAS — unlocks every achievement whose target is now reached and announces the newest one. */
  private checkAchievements(): void {
    const b = bestiaryStats(this.bestiaryKills);
    const reached = reachedAchievements({
      totalKills: b.total,
      bossesDefeated: this.bossesDefeatedTotal,
      miniBossesDefeated: this.miniBossesDefeatedTotal,
      riftsCleared: this.riftsCleared,
      bestWave: this.bestWave,
      bestRarityFound: this.bestRarityFound,
      goldStarCreatures: b.goldStars,
      creaturesMet: b.met,
    });
    const fresh = reached.filter((id) => !this.achievements.includes(id));
    if (fresh.length === 0) return;
    this.achievements = [...this.achievements, ...fresh];
    this.lastAchievement = { seq: (this.lastAchievement?.seq ?? 0) + 1, id: fresh[fresh.length - 1]! };
    this.emitAudio({ type: "loot_drop", rarity: "LEGENDARY" });
    this.persist();
  }

  /** Wears an unlocked achievement's title (null takes it off). */
  equipTitle(id: AchievementId | null): boolean {
    if (id !== null && !this.achievements.includes(id)) return false;
    this.equippedTitle = id;
    this.persist();
    this.notify();
    return true;
  }

  getBestiaryKills(): Readonly<BestiaryKills> {
    return this.bestiaryKills;
  }

  getAchievementStats(): AchievementStats {
    const b = bestiaryStats(this.bestiaryKills);
    return {
      totalKills: b.total,
      bossesDefeated: this.bossesDefeatedTotal,
      miniBossesDefeated: this.miniBossesDefeatedTotal,
      riftsCleared: this.riftsCleared,
      bestWave: this.bestWave,
      bestRarityFound: this.bestRarityFound,
      goldStarCreatures: b.goldStars,
      creaturesMet: b.met,
    };
  }

  getUnlockedAchievements(): readonly AchievementId[] {
    return this.achievements;
  }

  /** ÁRVORE DE TALENTOS — spends one free point on `id` (refused if locked, maxed or no point free). */
  raiseTalent(id: TalentId): boolean {
    if (!canRaiseTalent(this.talents, id, this.seasonBestWave)) return false;
    this.talents = { ...this.talents, [id]: (this.talents[id] ?? 0) + 1 };
    this.itemBonusDirty = true;
    this.persist();
    this.notify();
    return true;
  }

  /** Gives every talent point back, free, to spend again. */
  resetTalents(): void {
    this.talents = {};
    this.itemBonusDirty = true;
    this.persist();
    this.notify();
  }

  /** FENDAS — opens a Rift with these curses for the next eligible wave, spending a charge when that wave starts. */
  openRift(mods: readonly RiftModId[]): boolean {
    if (this.rift.charges <= 0 || this.rift.armed || this.rift.active) return false;
    this.rift = { ...this.rift, armed: [...new Set(mods)] };
    this.persist();
    this.notify();
    return true;
  }

  /** Takes back an opened Rift before its wave starts (the charge was never spent). */
  cancelRift(): boolean {
    if (!this.rift.armed) return false;
    this.rift = { ...this.rift, armed: null };
    this.persist();
    this.notify();
    return true;
  }

  /** A Rift only takes a regular wave — never a main boss or mini-boss wave. */
  private static riftEligible(wave: number): boolean {
    return !isBossMilestone(wave) && !isMiniBossWave(wave);
  }

  /** The city's gold share plus the Tithe talent. */
  private cityShare(): number {
    return cityGoldShare(this.seasonBestWave, this.city) + talentBonus(this.talents).cityShareP / 100;
  }

  private onWaveStarted(wave: number): void {
    if (!this.rift.armed || !GameEngine.riftEligible(wave)) return;
    const mods = this.rift.armed;
    this.rift = { charges: this.rift.charges - 1, armed: null, active: { wave, mods } };
    if (mods.includes("HORDE")) this.wave.spawnQueue = withHordeExtra(this.wave.spawnQueue);
    this.emitAudio({ type: "boss_enrage" });
    this.persist();
  }

  /** REGRA DA SEASON — the Season's rule on a fresh enemy (life, speed, gold). */
  private applySeasonRuleToSpawn(enemy: EnemyInstance): void {
    const r = this.seasonRule;
    if (!r) return;
    if (r.enemyHpPct) {
      enemy.maxHp = Math.round(enemy.maxHp * (1 + r.enemyHpPct / 100));
      enemy.hp = enemy.maxHp;
    }
    if (r.enemySpeedPct) enemy.baseSpeed *= 1 + r.enemySpeedPct / 100;
    if (r.killGoldPct) enemy.goldReward = Math.round(enemy.goldReward * (1 + r.killGoldPct / 100));
  }

  getSeasonRule(): SeasonRule | null {
    return this.seasonRule;
  }

  private applyRiftToSpawn(enemy: EnemyInstance): void {
    const moat = talentBonus(this.talents).enemySlowPct;
    if (moat > 0) enemy.baseSpeed *= 1 - moat / 100;
    const active = this.rift.active;
    if (!active || active.wave !== this.wave.currentWave) return;
    if (active.mods.includes("TOUGH")) {
      enemy.maxHp = Math.round(enemy.maxHp * RIFT_TOUGH_HP);
      enemy.hp = Math.round(enemy.hp * RIFT_TOUGH_HP);
    }
    if (active.mods.includes("HASTE")) enemy.baseSpeed *= RIFT_HASTE_SPEED;
  }

  /** Pays a cleared Rift: Shards, bonus Gold and item rolls, dropped in front of the castle. */
  private completeRift(): void {
    const active = this.rift.active!;
    const base = riftReward(active.mods, this.waveKillGold);
    const k = 1 + talentBonus(this.talents).riftRewardPct / 100;
    const reward = { ...base, shards: Math.round(base.shards * k), gold: Math.round(base.gold * k) };
    this.rift = { ...this.rift, active: null };
    const gate = this.layout.path[this.layout.path.length - 1] ?? { x: 900, y: 450 };
    const at = (i: number) => ({ x: gate.x - 90 + i * 34, y: gate.y - 70 + (i % 2) * 14 });
    let slot = 0;
    this.addGemShards(reward.shards, "rift_reward");
    this.dropLoot({ kind: "shards", rarity: shardPileRarity(reward.shards), amount: reward.shards, ...at(slot++) });
    this.addForgeMaterials(RIFT_SPLINTERS, { ...NO_ESSENCES, RARE: active.mods.length });
    this.gold += reward.gold;
    const table = getDropTable(RIFT_DROP_TABLE_ID);
    for (let i = 0; table && i < reward.itemRolls; i++) {
      const item = createItemInstance(rollDropTable(table), this.playerId, { type: "MINI_BOSS_DROP", refId: "rift" });
      const result = addItemWithCapacity(this.inventory, this.overflowInventory, item, this.inventoryCapacity);
      this.inventory = result.inventory;
      this.overflowInventory = result.overflow;
      appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "rift", eventType: "ITEM_CREATED", fromOwner: null, toOwner: this.playerId });
      appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "rift", eventType: "ITEM_ACQUIRED", fromOwner: null, toOwner: this.playerId });
      const def = getItemDefinition(item.itemDefinitionId);
      if (def) this.dropLoot({ kind: "item", rarity: def.rarity, itemDefinitionId: item.itemDefinitionId, amount: 1, ...at(slot++) });
    }
    this.itemBonusDirty = true;
    this.lastRiftResult = { seq: (this.lastRiftResult?.seq ?? 0) + 1, won: true, reward };
    this.riftsCleared += 1;
    this.bumpContract("RIFTS", 1, (c) => active.mods.length >= (c.minCurses ?? 0));
    this.checkAchievements();
  }

  /** MODO ETERNO — this engine plays the Eternal castle (see SaveSystem's ETERNAL_STORAGE_KEY). */
  get isEternal(): boolean {
    return this.storageKey === ETERNAL_STORAGE_KEY;
  }

  private bumpContract(kind: string, amount = 1, match?: (c: ReturnType<typeof contractsForWeek>[number]) => boolean): void {
    if (!this.isEternal) return;
    this.eternal = rollWeek(this.eternal, Date.now());
    for (const c of contractsForWeek(this.eternal.week)) {
      if (c.kind !== kind || (match && !match(c))) continue;
      const cur = this.eternal.progress[c.id] ?? 0;
      if (cur >= c.target) continue;
      this.eternal = { ...this.eternal, progress: { ...this.eternal.progress, [c.id]: Math.min(c.target, cur + amount) } };
    }
  }

  /** This week's three contracts with progress, done and claimed flags. */
  getEternalContracts() {
    const week = rollWeek(this.eternal, Date.now()).week;
    return contractsForWeek(week).map((c) => {
      const progress = week === this.eternal.week ? (this.eternal.progress[c.id] ?? 0) : 0;
      return { ...c, progress, done: progress >= c.target, claimed: week === this.eternal.week && this.eternal.claimed.includes(c.id) };
    });
  }

  getEternalState(): Readonly<EternalState> {
    return this.eternal;
  }

  /** Pays a finished contract's Eternal Marks (once). */
  claimEternalContract(id: string): boolean {
    if (!this.isEternal) return false;
    this.eternal = rollWeek(this.eternal, Date.now());
    const c = this.getEternalContracts().find((x) => x.id === id);
    if (!c || !c.done || c.claimed) return false;
    this.eternal = { ...this.eternal, marks: this.eternal.marks + c.marks, claimed: [...this.eternal.claimed, id] };
    this.persist();
    this.notify();
    return true;
  }

  /** Buys from the Eternal Merchant with Marks. Returns the item granted by a relic roll, if any. */
  buyFromMerchant(id: MerchantOfferId): boolean {
    const offer = MERCHANT_OFFERS.find((o) => o.id === id);
    if (!offer || this.eternal.marks < offer.price) return false;
    if (id === "RIFT_SCROLL" && this.rift.charges >= MAX_RIFT_CHARGES) return false;
    this.eternal = { ...this.eternal, marks: this.eternal.marks - offer.price };
    if (id === "SHARD_POUCH") this.addGemShards(SHARD_POUCH_AMOUNT, "eternal_merchant");
    else if (id === "RIFT_SCROLL") this.rift = { ...this.rift, charges: this.rift.charges + 1 };
    else {
      const table = getDropTable(RIFT_DROP_TABLE_ID);
      if (table) {
        const item = createItemInstance(rollDropTable(table), this.playerId, { type: "MINI_BOSS_DROP", refId: "eternal_merchant" });
        const result = addItemWithCapacity(this.inventory, this.overflowInventory, item, this.inventoryCapacity);
        this.inventory = result.inventory;
        this.overflowInventory = result.overflow;
        this.pendingItemRewards.push(item);
        appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "eternal_merchant", eventType: "ITEM_CREATED", fromOwner: null, toOwner: this.playerId });
        appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "eternal_merchant", eventType: "ITEM_ACQUIRED", fromOwner: null, toOwner: this.playerId });
      }
    }
    this.persist();
    this.notify();
    return true;
  }

  // ── EXPEDIÇÕES E FORJA (config/expeditions.ts) ─────────────────────────
  private addForgeMaterials(splinters: number, essences: typeof NO_ESSENCES): void {
    this.expeditions = { ...this.expeditions, splinters: this.expeditions.splinters + splinters, essences: addEssences(this.expeditions.essences, essences) };
  }

  /** Highest wave this account has reached — what opens expedition regions. */
  private expeditionRecord(): number {
    return Math.max(this.bestWave, this.seasonBestWave);
  }

  /** Scout groups usable now: owned groups, plus one while VIP. */
  scoutGroups(nowMs: number = Date.now()): number {
    return this.expeditions.groups + (isVipActive(this.vip, nowMs) ? VIP_EXTRA_SCOUT_GROUPS : 0);
  }

  /** OFERTAS DE MOMENTO — shows a real-money offer at a moment that calls for it (config/shopOffers.ts). */
  private offerMoment(trigger: MomentTrigger): void {
    this.momentOffers = triggerMomentOffer(this.momentOffers, trigger, Date.now());
  }

  getActiveMomentOffer() {
    return activeMomentOffer(this.momentOffers, Date.now());
  }

  dismissMomentOffer(): void {
    if (!this.momentOffers.active) return;
    this.momentOffers = { ...this.momentOffers, active: null };
    this.persist();
    this.notify();
  }

  getExpeditionState(): Readonly<ExpeditionState> {
    return this.expeditions;
  }

  getExpeditionRecord(): number {
    return this.expeditionRecord();
  }

  /** Sends a free scout group to a region the record has passed. */
  startExpedition(regionIndex: number, hours: ExpeditionHours, nowMs: number = Date.now()): boolean {
    const e = this.expeditions;
    if (e.active.length >= this.scoutGroups(nowMs)) return false;
    if (!unlockedRegions(this.expeditionRecord()).some((r) => r.index === regionIndex)) return false;
    this.expeditions = { ...e, active: [...e.active, { regionIndex, hours, startedAt: nowMs, endsAt: nowMs + hours * 3_600_000 }] };
    this.persist();
    this.notify();
    return true;
  }

  private payExpedition(i: number): ExpeditionPrize | null {
    const exp = this.expeditions.active[i];
    const region = exp ? expeditionRegions()[exp.regionIndex] : undefined;
    if (!exp || !region) return null;
    const prize = expeditionPrize(region.tier, exp.hours);
    this.gold += prize.gold;
    this.addGemShards(prize.shards, "expedition");
    this.expeditions = { ...this.expeditions, active: this.expeditions.active.filter((_, k) => k !== i) };
    this.addForgeMaterials(prize.splinters, prize.essences);
    return prize;
  }

  /** Collects a finished trip. */
  collectExpedition(i: number, nowMs: number = Date.now()): ExpeditionPrize | null {
    const exp = this.expeditions.active[i];
    if (!exp || nowMs < exp.endsAt) return null;
    const prize = this.payExpedition(i);
    this.emitAudio({ type: "loot_drop", rarity: "RARE" });
    this.persist();
    this.notify();
    return prize;
  }

  /** Finishes a trip now for Gems (price by the time left). */
  rushExpedition(i: number, currency: GemCurrency, nowMs: number = Date.now()): ExpeditionPrize | null {
    const exp = this.expeditions.active[i];
    if (!exp) return null;
    const cost = gemPriceForCurrency(rushPrice(exp.endsAt - nowMs), currency);
    if (nowMs < exp.endsAt) {
      if (!this.canAffordGemsInCurrency(cost, currency)) return null;
      if (!this.spendGems(cost, "expedition_rush", currency)) return null;
    }
    const prize = this.payExpedition(i);
    this.persist();
    this.notify();
    return prize;
  }

  /** Buys the 3rd or 4th scout group (permanent). */
  buyScoutGroup(currency: GemCurrency): boolean {
    if (this.expeditions.groups >= MAX_SCOUT_GROUPS) return false;
    const cost = gemPriceForCurrency(EXTRA_GROUP_PRICE, currency);
    if (!this.canAffordGemsInCurrency(cost, currency)) return false;
    if (!this.spendGems(cost, "scout_group", currency)) return false;
    this.expeditions = { ...this.expeditions, groups: this.expeditions.groups + 1 };
    this.persist();
    this.notify();
    return true;
  }

  /** Starts forging the chosen item (one at a time). */
  startForge(itemId: string, nowMs: number = Date.now()): boolean {
    const r = getRecipe(itemId);
    const e = this.expeditions;
    if (!r || e.forging || !canAffordRecipe(e, r)) return false;
    this.expeditions = { ...e, splinters: e.splinters - r.splinters, essences: addEssences(e.essences, r.essences, -1), forging: { itemId: r.itemId, endsAt: nowMs + r.hours * 3_600_000 } };
    this.persist();
    this.notify();
    return true;
  }

  private finishForge(): ItemInstance | null {
    const f = this.expeditions.forging;
    if (!f) return null;
    const item = createItemInstance(f.itemId, this.playerId, { type: "FUSION", refId: "forge" });
    const result = addItemWithCapacity(this.inventory, this.overflowInventory, item, this.inventoryCapacity);
    this.inventory = result.inventory;
    this.overflowInventory = result.overflow;
    this.pendingItemRewards.push(item);
    appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "forge", eventType: "ITEM_CREATED", fromOwner: null, toOwner: this.playerId });
    appendLedgerEvent({ itemInstanceId: item.instanceId, itemDefinitionId: item.itemDefinitionId, source: "forge", eventType: "ITEM_ACQUIRED", fromOwner: null, toOwner: this.playerId });
    this.expeditions = { ...this.expeditions, forging: null };
    this.persist();
    this.notify();
    return item;
  }

  /** Takes the forged item once its time is up. */
  collectForge(nowMs: number = Date.now()): ItemInstance | null {
    const f = this.expeditions.forging;
    if (!f || nowMs < f.endsAt) return null;
    return this.finishForge();
  }

  /** Finishes the forge now for Gems (price by the time left). */
  rushForge(currency: GemCurrency, nowMs: number = Date.now()): ItemInstance | null {
    const f = this.expeditions.forging;
    if (!f) return null;
    if (nowMs < f.endsAt) {
      const cost = gemPriceForCurrency(rushPrice(f.endsAt - nowMs), currency);
      if (!this.canAffordGemsInCurrency(cost, currency)) return null;
      if (!this.spendGems(cost, "forge_rush", currency)) return null;
    }
    return this.finishForge();
  }

  /** Trips and forge that are ready to collect (HUD badge). */
  private expeditionsReady(nowMs: number): number {
    return this.expeditions.active.filter((e) => nowMs >= e.endsAt).length;
  }

  /** Depth and wave-milestone rewards of the Eternal record — paid automatically when reached. */
  private payEternalRecordRewards(): void {
    if (!this.isEternal) return;
    const depth = depthOfWave(this.seasonBestWave);
    while (this.eternal.depthRewarded < depth) {
      const d = this.eternal.depthRewarded + 1;
      const marks = depthReward(d);
      this.eternal = { ...this.eternal, depthRewarded: d, marks: this.eternal.marks + marks };
      this.offerMoment("NEW_DEPTH");
      this.lastEternalEvent = { seq: (this.lastEternalEvent?.seq ?? 0) + 1, kind: "DEPTH", value: d, marks, shards: 0 };
    }
    for (const n of claimableMilestones(this.seasonBestWave, this.eternal.milestonesClaimed)) {
      const r = milestoneReward(n);
      this.eternal = { ...this.eternal, milestonesClaimed: n, marks: this.eternal.marks + r.marks };
      this.addGemShards(r.shards, "eternal_milestone");
      this.lastEternalEvent = { seq: (this.lastEternalEvent?.seq ?? 0) + 1, kind: "MILESTONE", value: n * 50, marks: r.marks, shards: r.shards };
    }
  }

  private lootDrops: LootDrop[] = [];
  private lootSeq = 0;

  /** Puts a drop on the map for the renderer (beam + name) and plays its sound. */
  private dropLoot(drop: Omit<LootDrop, "seq">): void {
    this.lootSeq += 1;
    this.lootDrops = [...this.lootDrops, { ...drop, seq: this.lootSeq }].slice(-MAX_RECENT_LOOT);
    if (drop.kind === "item") {
      const order = RARITY_DEFINITIONS[drop.rarity].order;
      if (order > this.bestRarityFound) {
        this.bestRarityFound = order;
        this.checkAchievements();
      }
    }
    this.emitAudio({ type: "loot_drop", rarity: drop.rarity });
  }

  private itemBonusTicks = 0;
  private itemBonusDirty = true;

  /** Recomputes each tower's bonus from the items in its slots (config/itemRolls.ts) when something changed, and about once a second as a safety net. */
  private refreshItemBonusesIfDue(): void {
    this.itemBonusTicks += 1;
    if (!this.itemBonusDirty && this.itemBonusTicks < 60) return;
    this.itemBonusTicks = 0;
    this.itemBonusDirty = false;
    const byId = new Map(this.inventory.map((item) => [item.instanceId, item]));
    const tb = talentBonus(this.talents);
    const lastStand = this.maxBaseHp > 0 && this.baseHp > 0 && this.baseHp / this.maxBaseHp < LAST_STAND_HP_FRACTION ? tb.lastStandDamagePct : 0;
    const sr = this.seasonRule;
    const hasTalents = tb.damagePct + tb.attackSpeedPct + tb.bossDamagePct + tb.critChancePct + tb.rangePct + lastStand > 0 || !!sr && (sr.critPct !== 0 || sr.rangePct !== 0 || sr.attackSpeedPct !== 0);
    for (const tower of this.towers) {
      const items = tower.equippedItemInstanceIds.map((id) => (id ? byId.get(id) : undefined)).filter((x): x is ItemInstance => !!x);
      if (items.length === 0 && !hasTalents) {
        tower.itemBonus = undefined;
        continue;
      }
      const b = itemBonusFrom(items);
      tower.itemBonus = {
        damagePct: b.damagePct + tb.damagePct + lastStand,
        attackSpeedPct: b.attackSpeedPct + tb.attackSpeedPct + (sr?.attackSpeedPct ?? 0),
        bossDamagePct: b.bossDamagePct + tb.bossDamagePct,
        critChancePct: b.critChancePct + tb.critChancePct + (sr?.critPct ?? 0),
        rangePct: b.rangePct + tb.rangePct + (sr?.rangePct ?? 0),
      };
    }
  }

  update(dtMs: number): void {
    this.refreshItemBonusesIfDue();
    if (this.tutorialHold) return;
    if (this.phase === "PRE_RUN" || this.phase === "OFFLINE_RETURN" || this.phase === "PROGRESSION_STOPPED" || this.phase === "DEPLOY") return;
    if (this.syncMapLayout() && (this.phase as RunPhase) === "DEPLOY") {
      this.notify();
      return;
    }

    const scaledDt = dtMs * this.speed;
    // Boss/mini-boss ability cadence (Shield windows, Summon/Disable
    // intervals, Enrage's own re-arm) must scale with game speed exactly
    // like everything else in this tick — movement, tower cooldowns,
    // status-effect durations. A real wall-clock reference (performance.now())
    // would NOT scale with `speed`, silently making bosses relatively less
    // dangerous at 2x/4x (found while writing a test for the mini-boss
    // ability-ticking fix below: at zero real elapsed time between ticks,
    // no ability ever fired). This accumulator is this attempt's own
    // simulated clock instead — reset in resetAttemptState().
    this.simClockMs += scaledDt;
    const nowMs = this.simClockMs;

    if (this.phase === "BOSS_INTRO") {
      this.bossIntroRemainingMs -= scaledDt;
      if (this.bossIntroRemainingMs <= 0) {
        const boss = createBossInstance(getMainBossForWave(this.wave.currentWave), this.wave.currentWave, nowMs);
        // the wounds of earlier assaults stay
        if (this.bossSiege && this.bossSiege.wave === this.wave.currentWave) {
          boss.hp = Math.max(1, Math.round(boss.maxHp * this.bossSiege.hpFraction));
          // back already below its enrage threshold: it's exhausted, not enraged
          if (boss.boss && this.bossSiege.hpFraction <= ENRAGE_HP_THRESHOLD) boss.boss.exhausted = true;
        }
        this.activeBossId = boss.id;
        this.enemies.push(boss);
        this.phase = "BOSS_BATTLE";
      }
      this.notify();
      return;
    }

    if (this.phase === "VICTORY") {
      this.victoryRemainingMs -= scaledDt;
      if (this.victoryRemainingMs <= 0) {
        this.activeBossId = null;
        activateNextWave(this.wave);
        this.onWaveStarted(this.wave.currentWave);
        this.phase = "RUNNING";
        this.emitAudio({ type: "wave_start" });
        this.syncMapLayout();
        this.persist();
      }
      this.notify();
      return;
    }

    if (this.phase !== "BOSS_BATTLE") {
      // Boss-wave interception: about to auto-transition into a main-boss
      // milestone wave. Skip WaveManager entirely for this tick and hand
      // off to the boss ceremony instead — the next tick after VICTORY
      // resumes normal WaveManager ticking via activateNextWave() above.
      if (
        this.wave.phase === "TRANSITIONING" &&
        this.wave.transitionTimerMs <= scaledDt &&
        isBossMilestone(this.wave.currentWave + 1)
      ) {
        this.enterBossIntro(this.wave.currentWave + 1);
        this.persist();
        this.notify();
        return;
      }

      const waveBefore = this.wave.currentWave;
      const { enemyTypeToSpawn } = tickWaveManager(this.wave, scaledDt, this.enemies.length);
      if (this.wave.currentWave !== waveBefore) this.onWaveStarted(this.wave.currentWave);
      if (enemyTypeToSpawn) {
        const spawned = createEnemyInstance(enemyTypeToSpawn, this.wave.currentWave, waveHpFactor(this.wave.currentWave));
        spawned.goldReward = Math.round(spawned.goldReward * waveGoldFactor(this.wave.currentWave));
        this.applyRiftToSpawn(spawned);
        this.applySeasonRuleToSpawn(spawned);
        this.enemies.push(spawned);
        this.maybeDiscover(enemyTypeToSpawn);
      }
      this.maybeSpawnMiniBoss(nowMs);
      this.maybeSpawnElite();
    }

    tickEnemyDisableAbilities(this.enemies, this.towers, nowMs);

    // Tick every boss-tagged enemy's abilities — the main boss during
    // BOSS_BATTLE, AND any mini-boss currently walking through a regular
    // wave. Previously only the tracked main boss was ever ticked here, so
    // a spawned mini-boss's ability (Shield/Summon/Disable/...) never
    // actually fired after spawn — found while wiring up the new mini-boss
    // roster. Fixed by ticking uniformly instead of special-casing the
    // active boss.
    const bossSummons: EnemyInstance[] = [];
    for (const enemy of this.enemies) {
      if (enemy.boss) bossSummons.push(...tickBossAbilities(enemy, nowMs, this.wave.currentWave, this.towers));
      // Enrage SFX fires exactly once per boss instance (spec section 9) —
      // `enraged` never resets once true, so a Set of "already announced"
      // ids is all that's needed, mirroring eliteSpawnedForWave's pattern.
      if (enemy.boss?.enraged && !this.enrageAudioFired.has(enemy.id)) {
        this.enrageAudioFired.add(enemy.id);
        this.emitAudio({ type: "boss_enrage" });
      }
      // Master Implementation Pass spec section 13 — Boss Siege Attack.
      // Fully independent of tickBossAbilities' own cadence above.
      if (enemy.boss) {
        const siegeHit = tickBossSiege(enemy, nowMs, scaledDt, this.towers);
        if (siegeHit) {
          const target = this.towers.find((t) => t.id === siegeHit.targetTowerId);
          if (target) {
            applySiegeDamage(target, siegeHit.rawDamage, SIEGE_DISABLE_ON_DEPLETION_MS);
            this.emitAudio({ type: "tower_siege_hit" });
          }
        }
      }
    }
    this.enemies.push(...bossSummons);

    const reachedBaseIds = new Set<string>();
    for (const enemy of this.enemies) {
      const { reachedEnd, burnDamageDealt } = advanceEnemy(enemy, scaledDt, this.hordeAdaptation.multipliers.INFERNO);
      if (reachedEnd) reachedBaseIds.add(enemy.id);
      this.waveDamageByType.INFERNO += burnDamageDealt;
      // Floating Damage Numbers rewrite — burn previously applied smoothly
      // to enemy.hp every single tick with NO event of any kind reaching
      // the render layer; CanvasRenderer's old per-frame hp-diff fallback
      // was the only thing that ever noticed it, spawning a tiny number on
      // literally every rendered frame a burn was active (spec: exactly
      // the "aparecem rápido demais" complaint). Reporting it here, once
      // per tick, with the EXACT amount just subtracted from enemy.hp,
      // lets the rendering layer aggregate DOT ticks into readable
      // periodic numbers instead — see VfxManager.reportEnemyDamage.
      if (burnDamageDealt > 0) {
        this.emitCombatVfx({ kind: "DOT", enemyId: enemy.id, position: enemy.position, amount: burnDamageDealt, isCrit: false });
      }
    }

    // TOWER MANA — a hold only lasts for the wave or boss fight it started in.
    if (this.specialsHeld && (this.wave.currentWave !== this.specialsHeldWave || this.phase === "WAVE_TRANSITION")) {
      this.specialsHeld = false;
    }
    const { projectiles: newProjectiles, damageEvents } = tickCombat(this.towers, this.enemies, scaledDt, this.wave.currentWave, this.specialsHeld, this.hordeAdaptation.multipliers);
    this.projectiles.push(...newProjectiles);
    for (const e of damageEvents) this.waveDamageByType[e.towerType] += e.amount;
    recordDamageEvents(this.battleStats, damageEvents);

    // Real-event audio derivation (Audio spec sections 2/3) — read directly
    // off what CombatSystem actually decided this tick, never re-simulated
    // or fabricated. `this.enemies` still holds every enemy hit this tick
    // (the kill loop that removes the dead hasn't run yet), so tier lookup
    // here sees the true pre-kill roster.
    for (const projectile of newProjectiles) {
      this.emitAudio({ type: "tower_attack", towerType: projectile.towerType });
      if (projectile.towerType === "STORMCALLER" && projectile.chainTargets.length > 0) {
        this.emitAudio({ type: "stormcaller_chain" });
      }
    }
    for (const damageEvent of damageEvents) {
      const target = this.enemies.find((e) => e.id === damageEvent.enemyId);
      if (target) {
        this.emitAudio({ type: "enemy_hit", towerType: damageEvent.towerType, tier: this.classifyEnemyTier(target) });
        // Floating Damage Numbers rewrite — the ONE place a HIT vfx event is
        // ever emitted: `damageEvent.amount` is already `applyDamageToEnemy`'s
        // real return value (the exact post-reduction amount just subtracted
        // from `target.hp`), so the number shown can never drift from the
        // actual HP change — no separate render-side hp-diff guess needed.
        this.emitCombatVfx({
          kind: "HIT",
          enemyId: target.id,
          position: target.position,
          amount: damageEvent.amount,
          isCrit: damageEvent.isCrit === true,
        });
      }
      if (damageEvent.isFreeze) {
        this.emitAudio({ type: "frostborn_freeze" });
        this.trackMission("FREEZE_ENEMIES");
      }
    }

    for (const projectile of this.projectiles) tickProjectile(projectile, scaledDt);
    this.projectiles = this.projectiles.filter((p) => !isProjectileExpired(p));

    const survivors: EnemyInstance[] = [];
    let bossDefeatedThisTick = false;
    for (const enemy of this.enemies) {
      if (reachedBaseIds.has(enemy.id)) {
        // BALANCEAMENTO DEFINITIVO spec section 5 — category-based Castle
        // Damage (config/castleDamage.ts), computed fresh at the exact
        // moment of crossing from the CURRENT wave and CURRENT max Castle
        // HP (never a flat per-archetype constant, never cached on the
        // enemy, never applied more than this one time per enemy).
        const category: CastleDamageCategory = enemy.boss?.isMainBoss ? "BOSS" : enemy.boss ? "MINI_BOSS" : "NORMAL";
        const fragile = this.rift.active?.wave === this.wave.currentWave && this.rift.active.mods.includes("FRAGILE");
        const castleDamage = computeCastleDamage(category, this.wave.currentWave, this.maxBaseHp) * (fragile ? RIFT_FRAGILE_BREACH : 1) * (1 - talentBonus(this.talents).castleDamageReductionPct / 100);
        this.baseHp = Math.max(0, this.baseHp - castleDamage);
        recordBaseHit(this.battleStats, enemy, castleDamage);
        continue; // removed, no gold — it breached the base
      }
      if (isEnemyDead(enemy)) {
        // HORDENOVA Season/Progression v1.0 — Prestige's small, permanently
        // bounded Gold bonus (see config/prestige.ts's getPrestigeBonuses)
        // applies here, at the one real per-kill Gold grant. Never touches
        // enemy.goldReward itself (the frozen wave-scaling formula), only
        // the amount the player actually receives.
        const killGold = this.withSkinGoldBonus(Math.round(enemy.goldReward * getPrestigeBonuses(this.prestigeLevel).goldMultiplier * (1 + talentBonus(this.talents).killGoldPct / 100)));
        this.gold += killGold;
        this.waveKillGold += killGold;
        this.enemiesDefeated += 1;
        this.trackMission("KILL_ENEMIES");
        if (enemy.boss && !enemy.boss.isMainBoss) {
          this.trackMission("DEFEAT_MINI_BOSSES");
          this.bumpContract("MINI_BOSSES");
          this.addPassXp("MINI_BOSS");
        }
        if (enemy.boss?.isMainBoss) this.addPassXp("MAIN_BOSS");
        recordKill(this.battleStats, enemy);
        this.bestiaryKills[enemy.type] = (this.bestiaryKills[enemy.type] ?? 0) + 1;
        this.bumpContract("KILL_FAMILY", 1, (c) => c.family === ENEMY_VOICE_FAMILY[enemy.type]);
        const tier = this.classifyEnemyTier(enemy);
        const flavor = enemy.burn ? "fire" : enemy.slow?.percent === 1 ? "ice" : undefined;
        this.emitAudio({ type: "enemy_death", tier, flavor, family: ENEMY_VOICE_FAMILY[enemy.type] });
        if (tier === "boss") this.emitAudio({ type: "boss_death" });
        if (enemy.id === this.activeBossId) {
          bossDefeatedThisTick = true;
          this.lastBossReward = enemy.goldReward;
        }
        if (enemy.boss) this.grantBossDrop(enemy.boss, enemy.position);
        else if (tier === "elite" && Math.random() < ELITE_SHARD_DROP_CHANCE + talentBonus(this.talents).eliteShardP / 100) {
          this.addGemShards(ELITE_SHARD_DROP_AMOUNT, "elite_drop");
          this.dropLoot({ kind: "shards", rarity: shardPileRarity(ELITE_SHARD_DROP_AMOUNT), amount: ELITE_SHARD_DROP_AMOUNT, x: enemy.position.x, y: enemy.position.y });
        }
        continue; // removed, killed by towers/burn
      }
      survivors.push(enemy);
    }
    this.enemies = survivors;
    // One event for the whole tick, however many enemies breached at once
    // (spec section 7: "se vários inimigos chegarem juntos, controlar o
    // número de sons") — AudioManager's own cooldown throttles this
    // further across consecutive ticks.
    if (reachedBaseIds.size > 0) this.emitAudio({ type: "castle_damage", count: reachedBaseIds.size });
    if (reachedBaseIds.size > 0) this.onCastleBreached(reachedBaseIds.has(this.activeBossId ?? ""));

    if (this.phase === "BOSS_BATTLE") {
      const boss = this.enemies.find((e) => e.id === this.activeBossId) ?? null;
      recordBossSnapshot(this.battleStats, boss);
      if (boss) {
        this.lastBossHpFraction = Math.max(0, boss.hp / boss.maxHp);
      }
      if (bossDefeatedThisTick) {
        this.phase = "VICTORY";
        this.victoryRemainingMs = BOSS_VICTORY_DURATION_MS;
        this.emitAudio({ type: "victory" });
        this.advanceBestWave(this.wave.currentWave);
        this.finishWave(this.wave.currentWave);
        // CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — a real kill is
        // proof this exact build/boss matchup is NOT a wall, whatever the
        // streak was before it.
        this.consecutiveBossEscapesWithoutKill = 0;
        this.bestBossDamageFractionInStreak = 0;
        this.onBossKilled(this.wave.currentWave);
        this.persist();
      } else if (boss === null) {
        // The boss reached the base and was removed via the normal leak
        // path (reachedBaseIds) instead of dying — it "escaped" rather
        // than being defeated. Without this branch the engine has no way to
        // leave BOSS_BATTLE once its one tracked enemy is gone. No reward,
        // and no progress: the boss is fought again (see below).
        // AUDITORIA E CORREÇÃO GERAL spec sections 1, 11 — advanceBestWave
        // MUST be called for the boss wave itself (this.wave.currentWave,
        // BEFORE activateNextWave bumps it) or a milestone landing exactly
        // on a boss wave (e.g. wave 30) is silently skipped entirely: the
        // very next advanceBestWave call would already be for wave 31,
        // which is never a multiple of ROULETTE_MILESTONE_INTERVAL. This
        // bug pre-dates the pending-Roulette rework but was invisible
        // before it — a skipped auto-grant just silently gave nothing;
        // now it would have silently skipped queuing a pending spin.
        //
        // CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — this escape
        // valve itself is UNCHANGED (still never freezes the run), but a
        // long unbroken streak of escapes with no kill in between is now
        // surfaced explicitly instead of silently looking identical to one
        // unlucky fight — see EndgameWallReport's own doc comment.
        const escapedBossWave = this.wave.currentWave;
        const escapedBoss = getMainBossForWave(escapedBossWave);
        const damageFraction = 1 - (this.battleStats.bossHpPercentRemaining ?? 1);
        this.bestBossDamageFractionInStreak = Math.max(this.bestBossDamageFractionInStreak, damageFraction);
        this.consecutiveBossEscapesWithoutKill += 1;
        if (this.consecutiveBossEscapesWithoutKill >= ENDGAME_WALL_ESCAPE_THRESHOLD) {
          this.endgameWallReport = {
            bossId: escapedBoss.id,
            bossNameKey: escapedBoss.i18nKey,
            wave: escapedBossWave,
            bestWave: this.bestWave,
            bestDamageFraction: this.bestBossDamageFractionInStreak,
            consecutiveEscapes: this.consecutiveBossEscapesWithoutKill,
            diagnosis: generateFailureReport(finalizeBattleStats(this.battleStats, escapedBossWave), this.towers),
          };
        }

        // A boss has to be DEFEATED to move on — but it keeps its wounds and
        // the map goes under siege (config/bossAssault.ts).
        this.bossRetreat();
      }
    } else {
      this.phase = this.wave.phase === "TRANSITIONING" ? "WAVE_TRANSITION" : "RUNNING";
      if (this.wave.phase === "TRANSITIONING") {
        this.advanceBestWave(this.wave.currentWave);
        this.finishWave(this.wave.currentWave);
        if (this.waveCompleteAudioFiredForWave !== this.wave.currentWave) {
          this.waveCompleteAudioFiredForWave = this.wave.currentWave;
          this.emitAudio({ type: "wave_complete" });
          this.trackMission("CLEAR_WAVES");
          this.addPassXp("WAVE_CLEARED");
        }
        // AUDITORIA E CORREÇÃO GERAL spec section 10/13 — advanceBestWave
        // can now enqueue a pending Roulette spin (pendingRouletteSpinWaves)
        // purely in memory; without persisting here, a reload landing
        // between this wave transition and the next boss/victory tick would
        // silently lose that pending milestone. The sibling BOSS_BATTLE
        // branches above already persist on every wave-advancing event —
        // this keeps the same guarantee for a plain (non-boss) wave clear.
        this.persist();
      }
    }

    if (this.baseHp <= 0) {
      this.stopProgression();
      return;
    }

    this.notify();
  }

  /**
   * Raises bestWave and, the first time THIS wave number is ever crossed,
   * grants its milestone bonus (config/phaseConfig.ts) — spec section 12.
   *
   * AUDITORIA E CORREÇÃO GERAL spec sections 1-3 — every
   * ROULETTE_MILESTONE_INTERVAL waves, this ONLY enqueues the milestone as
   * pending (`pendingRouletteSpinWaves`). It must NEVER roll or grant a
   * reward itself — that was the exact bug this pass fixes: Castle HP (and
   * every other Roulette reward) used to be rolled and applied the instant
   * a milestone wave was reached, with the UI only showing a toast
   * afterward. Now nothing is rolled/granted until the player explicitly
   * calls spinPendingRoulette() (their own ROLETAR click).
   */
  /**
   * A wave was cleared (a plain wave reaching its transition, or a boss
   * defeated): the horde learns from it and the city pays out and rebuilds.
   * Runs once per wave number.
   */
  private finishWave(wave: number): void {
    if (this.lastFinishedWave === wave) return;
    this.lastFinishedWave = wave;

    this.bumpContract("CLEAR_WAVES");
    if (!this.waveLeaked) this.bumpContract("CLEAN_WAVES");
    this.payEternalRecordRewards();
    if (this.rift.active && this.rift.active.wave === wave) this.completeRift();
    this.checkAchievements();
    const repair = talentBonus(this.talents).castleRepairPct;
    if (repair > 0 && this.baseHp > 0) this.baseHp = Math.min(this.maxBaseHp, this.baseHp + (this.maxBaseHp * repair) / 100);
    this.rift = chargeAfterWave(this.rift, wave);

    const before = strongestResistance(this.hordeAdaptation);
    this.hordeAdaptation = adaptAfterWave(this.hordeAdaptation, this.waveDamageByType, wave);
    const after = strongestResistance(this.hordeAdaptation);
    if (
      (before?.type ?? null) !== (after?.type ?? null) ||
      Math.floor((after?.resist ?? 0) / ADAPTATION_ANNOUNCE_STEP) !== Math.floor((before?.resist ?? 0) / ADAPTATION_ANNOUNCE_STEP)
    ) {
      this.hordeChangeSeq += 1;
    }

    const builtBefore = this.cityBuiltCount;
    const rebuilt = this.waveLeaked ? [] : advanceRebuild(this.city);
    const income = Math.round(this.waveKillGold * this.cityShare());
    if (income > 0) this.gold += income;
    const built = builtBuildings(this.seasonBestWave);
    this.cityBuiltCount = built.length;
    if (built.length > builtBefore && builtBefore >= 0) {
      this.pushCityEvent("BUILT", built.slice(builtBefore).map((b) => b.id), income);
    } else if (rebuilt.length > 0) {
      this.pushCityEvent("REBUILT", rebuilt, income);
    } else if (income > 0) {
      this.pushCityEvent("INCOME", [], income);
    }

    this.waveDamageByType = emptyShares();
    this.waveKillGold = 0;
    this.waveLeaked = false;
  }

  /** Creatures reached the castle: the first breach of a wave sets a building alight, a main boss one more. */
  private onCastleBreached(bossBreached: boolean): void {
    let fires = 0;
    if (!this.waveLeaked) fires += CITY_FIRES_PER_LEAKED_WAVE;
    if (bossBreached) fires += CITY_FIRES_PER_BOSS_BREACH;
    this.waveLeaked = true;
    if (fires === 0) return;
    const lit = igniteBuildings(this.seasonBestWave, this.city, fires);
    if (lit.length > 0) this.pushCityEvent("BURNED", lit, 0);
  }

  private cityBuiltCount = -1;

  private pushCityEvent(kind: "BUILT" | "BURNED" | "REBUILT" | "INCOME", ids: CityBuildingId[], amount: number): void {
    this.cityEventSeq += 1;
    this.lastCityEvent = { seq: this.cityEventSeq, kind, ids, amount };
  }

  private advanceBestWave(wave: number): void {
    // Season high-water mark (PRÓXIMA GRANDE FASE spec — "Season possui seu
    // próprio seasonBestWave") tracked completely independently of the
    // account's all-time bestWave below: it can be lower than bestWave at
    // any moment (right after a Season boundary resets it to 0, a returning
    // veteran player's very next wave crossed is already a new SEASON best
    // long before it's anywhere near a new ACCOUNT best) — gating this on
    // `wave <= this.bestWave` would silently stop updating it the moment an
    // account's lifetime record pulls ahead, which is exactly wrong.
    if (wave > this.seasonBestWave) this.seasonBestWave = wave;

    if (wave <= this.bestWave) return;
    const bonus = getMilestoneBonus(wave);
    if (bonus > 0) {
      this.gold += this.withSkinGoldBonus(bonus);
      // Gem Shards (spec section 34: "obtidos via... milestones") — a
      // small amount scaled off the SAME milestone bonus gold already
      // computed above, not an invented parallel number.
      this.addGemShards(this.withSkinShardBonus(Math.max(1, Math.round(bonus / 150))), `milestone_wave_${wave}`);
    }
    this.bestWave = wave;
    if (wave % ROULETTE_MILESTONE_INTERVAL === 0) this.pendingRouletteSpinWaves.push(wave);
  }

  /**
   * AUDITORIA E CORREÇÃO GERAL spec sections 2-3, 6, 9, 11, 13 — the ONLY
   * way any Roulette reward is ever rolled or granted: an explicit player
   * action (the ROLETAR click). Resolves the OLDEST pending milestone
   * (FIFO — spec section 11: "Roulette 20 → jogador roleta → resultado,
   * Roulette 30 → jogador roleta → resultado", never both at once). Returns
   * false (a no-op) if nothing is pending, so a UI can safely call this
   * without checking first.
   *
   * The result is determined HERE, synchronously, the instant this is
   * called (spec section 6: "o resultado deve ser determinado de maneira
   * segura" at click time) — any spin/reveal animation a UI wants to show
   * is purely a cosmetic delay on ALREADY-decided state, never something
   * that can alter the outcome.
   */
  spinPendingRoulette(): boolean {
    const wave = this.pendingRouletteSpinWaves.shift();
    if (wave === undefined) return false;

    const rewardType = rollRoulette();
    const castleHpGranted = castleHpForReward(rewardType);
    let gemsGranted = 0;
    let castleSkinId: string | null = null;

    if (castleHpGranted > 0) {
      this.castleHpBonus += castleHpGranted;
      this.maxBaseHp += castleHpGranted;
      this.baseHp += castleHpGranted;
    } else if (rewardType === "GEM") {
      gemsGranted = ROULETTE_GEM_REWARD_AMOUNT;
      this.addFreeGems(gemsGranted, `roulette_wave_${wave}`);
    } else if (rewardType === "CASTLE_SKIN") {
      // Grant the first real skin this save doesn't already own; if every
      // real Castle Skin is already unlocked, the 1%-rarity roll falls back
      // to Gems rather than doing nothing (spec section 48).
      const unowned = CASTLE_SKINS.find((s) => !this.unlockedCastleSkinIds.includes(s.id));
      if (unowned) {
        castleSkinId = unowned.id;
        this.unlockedCastleSkinIds = [...this.unlockedCastleSkinIds, unowned.id];
      } else {
        gemsGranted = ROULETTE_CASTLE_SKIN_FALLBACK_GEMS;
        this.addFreeGems(gemsGranted, `roulette_wave_${wave}_skin_fallback`);
      }
    }
    // else rewardType === "NOTHING" — grant absolutely nothing (spec section
    // 4-5: a real, honest chance of walking away empty-handed). Every
    // reward variable above already defaults to its "nothing granted" value.

    this.pendingRouletteResults.push({ wave, rewardType, castleHpGranted, gemsGranted, castleSkinId });
    this.persist();
    this.notify();
    return true;
  }

  /** Dismisses the currently-shown Roulette result banner (see HudSnapshot.pendingRouletteResult) so the next one, if any, can show. */
  acknowledgeRouletteResult(): void {
    this.pendingRouletteResults.shift();
    this.notify();
  }

  // Enemy HP is the same for every player at the same wave (competitive
  // fairness): the old per-account Combat Power adjustment
  // (config/difficultyScaling.ts) is no longer applied to spawns.

  private maybeSpawnMiniBoss(nowMs: number): void {
    if (!isMiniBossWave(this.wave.currentWave)) return;
    if (this.miniBossSpawnedForWave === this.wave.currentWave) return;
    if (this.wave.phase !== "SPAWNING") return;
    this.miniBossSpawnedForWave = this.wave.currentWave;
    this.enemies.push(createBossInstance(getMiniBossForWave(this.wave.currentWave), this.wave.currentWave, nowMs));
  }

  /** Elite Wave (spec section 4/5): one stat-and-ability-boosted enemy on top of the wave's normal composition, not a wave-wide change. */
  private maybeSpawnElite(): void {
    const isElite = getWaveTag(this.wave.currentWave) === "ELITE" || isBonusEliteWave(this.wave.currentWave);
    if (!isElite) return;
    if (this.eliteSpawnedForWave === this.wave.currentWave) return;
    if (this.wave.phase !== "SPAWNING") return;
    this.eliteSpawnedForWave = this.wave.currentWave;
    const elite = createEliteEnemyInstance(ELITE_BASE_TYPE, this.wave.currentWave, ELITE_MODIFIER, waveHpFactor(this.wave.currentWave));
    elite.goldReward = Math.round(elite.goldReward * waveGoldFactor(this.wave.currentWave));
    this.applySeasonRuleToSpawn(elite);
    this.enemies.push(elite);
  }

  private maybeDiscover(type: EnemyType): void {
    if (this.discoveredEnemyTypes.has(type)) return;
    this.discoveredEnemyTypes.add(type);
    this.pendingDiscoveries.push(type);
    this.persist();
  }

  /** Dismisses the currently-shown "NEW ENEMY" banner (see HudSnapshot.pendingDiscoveryType) so the next one, if any, can show. */
  acknowledgeDiscovery(): void {
    this.pendingDiscoveries.shift();
    this.notify();
  }

  /**
   * Item System spec section 25: any boss OR mini-boss that dies rolls its
   * DropTable (config/dropTables.ts, keyed off BossDefinition.dropTableId
   * via BossState.bossId — see config/bossConfig.ts.getBossDefinitionById)
   * exactly once. A boss with no dropTableId yet (every biome past Ancient
   * Forest, for now) simply grants nothing — no placeholder loot, per spec
   * section 25's "não criar dezenas de itens agora".
   */
  private grantBossDrop(boss: BossState, at?: { x: number; y: number }): void {
    if (boss.isMainBoss) this.bossesDefeatedTotal += 1;
    else this.miniBossesDefeatedTotal += 1;
    this.addForgeMaterials(boss.isMainBoss ? BOSS_SPLINTERS : MINI_BOSS_SPLINTERS, NO_ESSENCES);

    // Gem Shards (spec section 34: "obtidos via... bosses"): every boss
    // kill grants a small amount regardless of whether it also has a
    // dropTableId — this is the ONE gem-adjacent reward already wired to a
    // real, non-arbitrary event (a boss actually dying), independent of
    // the item-drop system below. HORDENOVA balance correction: base rates
    // lowered 60/24 -> 1/1 — the previous rates were too generous for an
    // infinite F2P game, especially for players who leave a run active for
    // many hours. Prestige's small, permanently bounded Gem Shard bonus
    // (config/prestige.ts's getPrestigeBonuses) still applies on top, per
    // its own unchanged formula.
    // FASE 6 (Cenário D, approved): uniform 2 Gem Shards per boss/mini-boss
    // kill — a deliberately small, non-inflationary bump from the previous
    // 1/1 rate. Mini-bosses vastly outnumber main-boss kills in real play
    // (measured ~19:1), so weighting toward the rarer main-boss kill instead
    // (tested and rejected) barely moves total income; uniform 2x was the
    // real winner. See config/phaseConfig.ts's PHASE_MILESTONE_BONUSES for
    // the other (one-time, per-wave-milestone) half of Prestige's income.
    const baseShards = 2;
    const shards = Math.round(baseShards * getPrestigeBonuses(this.prestigeLevel).gemShardMultiplier);
    const granted = this.withSkinShardBonus(shards);
    this.addGemShards(granted, boss.isMainBoss ? "main_boss_kill" : "mini_boss_kill");
    if (at) this.dropLoot({ kind: "shards", rarity: shardPileRarity(granted), amount: granted, x: at.x - 22, y: at.y + 6 });

    const def = getBossDefinitionById(boss.bossId);
    if (!def || !def.dropTableId) return;
    const table = getDropTable(def.dropTableId);
    if (!table) return;

    const itemDefinitionId = rollDropTable(table);
    const item = createItemInstance(itemDefinitionId, this.playerId, {
      type: boss.isMainBoss ? "BOSS_DROP" : "MINI_BOSS_DROP",
      refId: def.id,
    });
    // Inventory Capacity + Overflow (spec section 36/39): a full inventory
    // never silently drops this reward — it lands in the overflow waiting
    // area instead, still visible in the reward banner either way.
    const result = addItemWithCapacity(this.inventory, this.overflowInventory, item, this.inventoryCapacity);
    this.inventory = result.inventory;
    this.overflowInventory = result.overflow;
    this.pendingItemRewards.push(item);
    const itemDef = getItemDefinition(item.itemDefinitionId);
    if (at && itemDef) this.dropLoot({ kind: "item", rarity: itemDef.rarity, itemDefinitionId: item.itemDefinitionId, amount: 1, x: at.x + 18, y: at.y - 4 });

    const ledgerBase = {
      itemInstanceId: item.instanceId,
      itemDefinitionId: item.itemDefinitionId,
      source: def.id,
    };
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_CREATED", fromOwner: null, toOwner: this.playerId });
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_DROPPED", fromOwner: null, toOwner: this.playerId });
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_ACQUIRED", fromOwner: null, toOwner: this.playerId });

    const firstRecord = checkLocalFirst(this.localFirstDiscoveries, item.itemDefinitionId, item.instanceId, this.playerId);
    if (firstRecord) {
      this.localFirstDiscoveries = { ...this.localFirstDiscoveries, [item.itemDefinitionId]: firstRecord };
    }

    // Persisted immediately rather than waiting for the tick's own
    // conditional persist() (e.g. a mini-boss killed mid-wave doesn't
    // otherwise save until the next wave transition) — a granted item is
    // exactly the kind of state that must never be lost to a reload that
    // happens to land between this drop and some later save point.
    this.persist();
  }

  /** Dismisses the currently-shown item-reward banner (see HudSnapshot.pendingItemReward) so the next one, if any, can show. */
  acknowledgeItemReward(): void {
    this.pendingItemRewards.shift();
    this.persist();
    this.notify();
  }

  getInventory(): readonly ItemInstance[] {
    return this.inventory;
  }

  getUnlockedCastleSkinIds(): readonly string[] {
    return this.unlockedCastleSkinIds;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getLocalFirstDiscoveries(): LocalFirstDiscoveries {
    return this.localFirstDiscoveries;
  }

  getLocalEconomyTotals(): { bossesDefeatedTotal: number; miniBossesDefeatedTotal: number } {
    return { bossesDefeatedTotal: this.bossesDefeatedTotal, miniBossesDefeatedTotal: this.miniBossesDefeatedTotal };
  }

  private stopProgression(): void {
    // The castle fell during a boss assault: the boss retreats with its
    // wounds and the siege goes on — no defeat screen, nothing lost.
    if (this.phase === "BOSS_BATTLE" && isBossMilestone(this.wave.currentWave)) {
      this.bossRetreat();
      return;
    }
    this.phase = "PROGRESSION_STOPPED";
    this.offerMoment("CASTLE_FELL");
    if (this.rift.active) {
      this.rift = { ...this.rift, active: null };
      this.lastRiftResult = { seq: (this.lastRiftResult?.seq ?? 0) + 1, won: false, reward: null };
    }
    const failedWave = this.wave.currentWave;
    const finalized = finalizeBattleStats(this.battleStats, failedWave);
    this.lastFailureReport = generateFailureReport(finalized, this.towers);
    // The record counts CLEARED waves: the wave the castle fell on wasn't
    // cleared. Recording it would also mark its milestone (bonus gold, a
    // Roulette spin on a boss wave) as already earned, so beating it later
    // would pay nothing.
    this.bestWave = recordRunResult(failedWave - 1, this.storageKey).bestWave;
    // The castle fell: the phase starts over from its first wave. Done here,
    // not on retry, and saved right away so reloading can't skip it.
    this.wave.currentWave = phaseStartWave(phaseNumberFromWave(failedWave));
    if (this.telemetryEnabled) {
      recordBalanceEvent({
        ...this.telemetryBase(failedWave),
        type: "castle_fell",
        boss: false,
        bossFallStreak: 0,
        restartedPhase: true,
        defence: this.defenceSnapshot(),
      });
    }
    this.emitAudio({ type: "defeat" });
    this.persist();
    this.notify();
  }

  // -------------------------------------------------------------------
  // BOSS SIEGE (config/bossAssault.ts)
  // -------------------------------------------------------------------

  /** The boss survived the assault: it keeps its wounds (recovering a little) and the map goes under siege. */
  private bossRetreat(): void {
    const wave = this.wave.currentWave;
    const left = Math.min(1, this.lastBossHpFraction + BOSS_RETREAT_RECOVERY);
    const assaults = (this.bossSiege?.wave === wave ? this.bossSiege.assaults : 0) + 1;
    this.bossSiege = { wave, hpFraction: left, assaults };
    if (assaults >= 2) this.offerMoment("BOSS_HELD");
    this.emitAudio({ type: "boss_enrage" });
    this.resetAttemptState();
    this.lastBossHpFraction = 1;
    // replay the last few regular waves before the boss, then it attacks again
    this.wave.currentWave = Math.max(1, wave - SIEGE_WAVES);
    this.beginCurrentOrNextWave();
    this.persist();
    this.notify();
  }

  private onBossKilled(wave: number): void {
    const assaults = (this.bossSiege?.wave === wave ? this.bossSiege.assaults : 0) + 1;
    if (assaults === 1) {
      // first-assault kill: a bonus on top of the boss's normal reward
      const boss = getMainBossForWave(wave);
      this.gold += this.withSkinGoldBonus(Math.round(boss.goldReward * (FIRST_ASSAULT_GOLD_MULTIPLIER - 1)));
      this.addGemShards(FIRST_ASSAULT_BONUS_SHARDS, "boss_first_assault");
    }
    const season = seasonClock.getCurrentSeasonWindow().seasonNumber;
    if (!this.bossRecords || this.bossRecords.seasonNumber !== season) this.bossRecords = { seasonNumber: season, assaultsByWave: {} };
    const key = String(wave);
    const prev = this.bossRecords.assaultsByWave[key];
    this.bossRecords.assaultsByWave[key] = prev === undefined ? assaults : Math.min(prev, assaults);
    this.lastBossAssaults = assaults;
    if (this.telemetryEnabled) {
      recordBalanceEvent({ ...this.telemetryBase(wave), type: "boss_defeated", fallsBeforeWin: assaults - 1, defence: this.defenceSnapshot() });
    }
    this.bossSiege = null;
  }

  private bossFightInfo(): HudSnapshot["bossFight"] {
    if (this.phase !== "BOSS_INTRO" && this.phase !== "BOSS_BATTLE") return null;
    const wave = this.wave.currentWave;
    const boss = this.enemies.find((e) => e.id === this.activeBossId);
    return {
      weakness: bossWeakness(getMainBossForWave(wave).id),
      assault: (this.bossSiege?.wave === wave ? this.bossSiege.assaults : 0) + 1,
      enraged: boss?.boss?.enraged === true,
      exhausted: boss?.boss?.exhausted === true,
    };
  }

  /** Assaults the last main boss took to fall (for the victory banner), or null. */
  getLastBossAssaults(): number | null {
    return this.lastBossAssaults;
  }

  getBossRecords(): BossRecords | null {
    return this.bossRecords;
  }

  getBossWeakness(): TowerType | null {
    if (!isBossMilestone(this.wave.currentWave) && !this.bossSiege) return null;
    return bossWeakness(getMainBossForWave(this.bossSiege?.wave ?? this.wave.currentWave).id);
  }

  private classifyEnemyTier(enemy: EnemyInstance): EnemyAudioTier {
    if (enemy.boss?.isMainBoss) return "boss";
    if (enemy.boss) return "mini_boss";
    if (enemy.elite) return "elite";
    return "regular";
  }

  private emitAudio(event: GameAudioEvent): void {
    this.audioEvents.push(event);
    // nobody draining (simulations, a long background catch-up): keep it bounded
    if (this.audioEvents.length > MAX_QUEUED_EVENTS) this.audioEvents.splice(0, this.audioEvents.length - MAX_QUEUED_EVENTS);
  }

  /** Audio spec section 16 — the ONLY way anything outside this class observes what happened audio-wise. Called once per real tick by audio/GameAudioBridge.ts, never from inside a render loop. */
  drainAudioEvents(): GameAudioEvent[] {
    const events = this.audioEvents;
    this.audioEvents = [];
    return events;
  }

  private emitCombatVfx(event: CombatVfxEvent): void {
    this.combatVfxEvents.push(event);
    if (this.combatVfxEvents.length > MAX_QUEUED_EVENTS) this.combatVfxEvents.splice(0, this.combatVfxEvents.length - MAX_QUEUED_EVENTS);
  }

  /** Floating Damage Numbers rewrite — the ONLY way the rendering layer observes real damage application. Safe to drain every render frame (unlike audio, which is tick-cadenced): an empty array is the overwhelmingly common case, and nothing is lost between drains since this is a plain queue like drainAudioEvents above. */
  drainCombatVfxEvents(): CombatVfxEvent[] {
    const events = this.combatVfxEvents;
    this.combatVfxEvents = [];
    return events;
  }

  getFailureReport(): FailureReport | null {
    return this.lastFailureReport;
  }

  /** CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — non-null once ENDGAME_WALL_ESCAPE_THRESHOLD consecutive boss escapes (zero kills) have happened. The run keeps ticking regardless — this is purely informational. */
  getEndgameWallReport(): EndgameWallReport | null {
    return this.endgameWallReport;
  }

  /** Dismisses the current wall banner — a fresh one can reappear later if the streak (reset only by a real kill) reaches the threshold again. */
  acknowledgeEndgameWallReport(): void {
    this.endgameWallReport = null;
    this.notify();
  }

  private persist(): void {
    updateSave(
      {
        bestWave: this.bestWave,
        gold: this.gold,
        currentWave: this.wave.currentWave,
        mapLayoutId: this.layout.id,
        // benched towers (DEPLOY) are saved with no site, so a reload keeps them
        towerLoadout: [...this.towers.map((t) => this.loadoutEntryOf(t)), ...this.deployBench.map((t) => ({ ...this.loadoutEntryOf(t), slotId: "" }))],
        discoveredEnemyTypes: [...this.discoveredEnemyTypes],
        inventory: this.inventory,
        playerId: this.playerId,
        bossesDefeatedTotal: this.bossesDefeatedTotal,
        miniBossesDefeatedTotal: this.miniBossesDefeatedTotal,
        localFirstDiscoveries: this.localFirstDiscoveries,
        freeGems: this.freeGems,
        purchasedGems: this.purchasedGems,
        gemShards: this.gemShards,
        tradeUnlocked: this.tradeUnlocked,
        inventoryCapacity: this.inventoryCapacity,
        overflowInventory: this.overflowInventory,
        castleHpBonus: this.castleHpBonus,
        unlockedCastleSkinIds: this.unlockedCastleSkinIds,
        prestigeLevel: this.prestigeLevel,
        pendingRouletteSpinWaves: this.pendingRouletteSpinWaves,
        seasonBestWave: this.seasonBestWave,
        towerMasteryLevels: this.towerMasteryLevels,
        towerManaLevels: this.towerManaLevels,
        masteryUnlocked: this.masteryUnlocked,
        unlockedItemSlots: this.unlockedItemSlots,
        ownedTowerSkinIds: [...this.ownedTowerSkinIds],
        equippedTowerSkinByType: this.equippedTowerSkinByType,
        unlockedSpecializationIds: this.unlockedSpecializationIds,
        lastFreeRepositionDayIndex: this.lastFreeRepositionDayIndex,
        dailyMissions: this.dailyMissions,
        seasonPass: this.seasonPass,
        bossSiege: this.bossSiege,
        bossRecords: this.bossRecords,
        hordeAdaptation: this.hordeAdaptation,
        city: this.city,
        rift: this.rift,
        talents: this.talents,
        eternal: this.eternal,
        expeditions: this.expeditions,
        momentOffers: this.momentOffers,
        bestiaryKills: this.bestiaryKills,
        achievements: this.achievements,
        equippedTitle: this.equippedTitle,
        riftsCleared: this.riftsCleared,
        bestRarityFound: this.bestRarityFound,
      },
      this.storageKey,
    );
  }

  private cachedHud: HudSnapshot | null = null;

  /**
   * Returns a stable reference when nothing HUD-relevant changed since the
   * last call, so React's useSyncExternalStore (see hooks/useGameEngine)
   * doesn't re-render on every 60fps tick when e.g. only enemy positions moved.
   */
  getHudSnapshot(): HudSnapshot {
    const boss = this.activeBossId ? this.enemies.find((e) => e.id === this.activeBossId) ?? null : null;
    const next: HudSnapshot = {
      phase: this.phase,
      wave: this.wave.currentWave,
      phaseId: getPhaseForWave(this.wave.currentWave).id,
      phaseI18nKey: getPhaseForWave(this.wave.currentWave).i18nKey,
      gold: this.gold,
      freeGems: this.freeGems,
      purchasedGems: this.purchasedGems,
      gemShards: this.gemShards,
      baseHp: this.baseHp,
      maxBaseHp: this.maxBaseHp,
      speed: this.speed,
      bestWave: this.bestWave,
      seasonBestWave: this.seasonBestWave,
      enemiesDefeated: this.enemiesDefeated,
      enemiesLeft: this.wave.spawnQueue.length + this.enemies.filter((e) => e.hp > 0).length,
      nextWaveInS: this.wave.phase === "TRANSITIONING" ? Math.max(0, Math.ceil(this.wave.transitionTimerMs / 1000)) : null,
      selectedTowerId: this.selectedTowerId,
      bossNameKey: boss?.boss?.nameKey ?? this.bossIntroNameKey,
      bossHp: boss ? boss.hp : null,
      bossMaxHp: boss ? boss.maxHp : null,
      bossIntroRemainingMs: this.phase === "BOSS_INTRO" ? Math.max(0, this.bossIntroRemainingMs) : null,
      bossLastReward: this.phase === "VICTORY" ? this.lastBossReward : null,
      pendingDiscoveryType: this.pendingDiscoveries[0] ?? null,
      pendingItemReward: this.pendingItemRewards[0]
        ? { instanceId: this.pendingItemRewards[0].instanceId, itemDefinitionId: this.pendingItemRewards[0].itemDefinitionId }
        : null,
      pendingRouletteResult: this.pendingRouletteResults[0] ?? null,
      pendingRouletteSpinWave: this.pendingRouletteSpinWaves[0] ?? null,
      repositionFreeAvailable: this.isFreeRepositionAvailable(),
      mapLayoutId: this.layout.id,
      towerCount: this.towers.length,
      deployBench: this.deployBench.map((t) => ({ id: t.id, type: t.type, level: t.level })),
      bossFight: this.bossFightInfo(),
      bossVictoryAssaults: this.phase === "VICTORY" ? this.lastBossAssaults : null,
      bossSiege: this.bossSiege
        ? { wave: this.bossSiege.wave, hpFraction: this.bossSiege.hpFraction, assaults: this.bossSiege.assaults, wavesUntilBoss: Math.max(0, this.bossSiege.wave - this.wave.currentWave) }
        : null,
      specialsHeld: this.specialsHeld,
      specialsReady: this.towers.filter((t) => t.mana >= MANA_MAX).length,
      towersByType: Object.fromEntries(TOWER_TYPES.map((type) => [type, this.countTowersOfType(type)])) as Record<TowerType, number>,
      missionsKey: this.missionsKey(),
      missionsClaimable: this.getDailyMissions().filter((m) => !m.claimed && m.progress >= m.target).length,
      horde: { multipliers: this.hordeAdaptation.multipliers, changeSeq: this.hordeChangeSeq },
      city: { burning: { ...this.city.burning }, goldShare: this.cityShare(), lastEvent: this.lastCityEvent },
      rift: { charges: this.rift.charges, armed: this.rift.armed, active: this.rift.active, lastResult: this.lastRiftResult },
      talents: { ranks: this.talents, free: talentPointsFree(this.talents, this.seasonBestWave) },
      achievement: { last: this.lastAchievement, title: this.equippedTitle, count: this.achievements.length },
      eternal: {
        active: this.isEternal,
        marks: this.eternal.marks,
        depth: this.isEternal ? depthOfWave(this.wave.currentWave) : 0,
        lastEvent: this.lastEternalEvent,
        contractsReady: this.isEternal ? this.getEternalContracts().filter((c) => c.done && !c.claimed).length : 0,
      },
      expeditions: { ready: this.expeditionsReady(Date.now()), away: this.expeditions.active.length, forging: !!this.expeditions.forging, splinters: this.expeditions.splinters, forgeReady: !!this.expeditions.forging && Date.now() >= this.expeditions.forging.endsAt },
      momentOffer: this.momentOffers.active && this.momentOffers.active.expiresAt > Date.now() ? this.momentOffers.active : null,
    };

    const prev = this.cachedHud;
    if (prev && hudSnapshotsEqual(prev, next)) return prev;

    this.cachedHud = next;
    return next;
  }

  getRenderSnapshot(): RenderSnapshot {
    return {
      phase: this.phase,
      towers: this.towers,
      enemies: this.enemies,
      projectiles: this.projectiles,
      selectedTowerId: this.selectedTowerId,
      biomeId: getPhaseForWave(this.wave.currentWave).biomeId,
      mapLayoutId: this.layout.id,
      lootDrops: this.lootDrops,
      depth: this.isEternal ? depthOfWave(this.wave.currentWave) : 0,
    };
  }
}
