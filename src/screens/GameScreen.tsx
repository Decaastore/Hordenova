import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { isWebGLAvailable } from "@/rendering3d/webglSupport";
import { Enemy3DErrorBoundary } from "@/rendering3d/Enemy3DErrorBoundary";
import { useGameAudio } from "@/hooks/useGameAudio";
import { audioManager } from "@/audio/AudioManager";
import { CanvasRenderer } from "@/rendering/CanvasRenderer";
import { HUD } from "@/ui/HUD";
import { TowerPalette } from "@/ui/TowerPalette";
import { TowerInfoPanel } from "@/ui/TowerInfoPanel";
import { ProgressionStoppedOverlay } from "@/ui/ProgressionStoppedOverlay";
import { BossBanner } from "@/ui/BossBanner";
import { WelcomeBackOverlay } from "@/ui/WelcomeBackOverlay";
import { PhaseBanner } from "@/ui/PhaseBanner";
import { EnemyDiscoveryBanner } from "@/ui/EnemyDiscoveryBanner";
import { ItemRewardBanner } from "@/ui/ItemRewardBanner";
import { InventoryPanel } from "@/ui/InventoryPanel";
import { RouletteBanner } from "@/ui/RouletteBanner";
import { RoulettePendingPrompt } from "@/ui/RoulettePendingPrompt";
import { AscensionHudBadge } from "@/ui/AscensionHudBadge";
import { EndgameWallBanner } from "@/ui/EndgameWallBanner";
import { RepositioningOverlay } from "@/ui/RepositioningOverlay";
import { DeployOverlay } from "@/ui/DeployOverlay";
import { TutorialOverlay, type TutorialTarget } from "@/ui/TutorialOverlay";
import {
  acknowledgeTutorial,
  advanceTutorial,
  FINISHED_STATE,
  hasAcknowledgeButton,
  isBlockingStep,
  isNewPlayer,
  loadTutorialState,
  NEW_PLAYER_STATE,
  saveTutorialState,
  skipTutorial,
  stepNumber,
  TUTORIAL_STEP_COUNT,
  visibleTutorialCard,
  type TutorialState,
  type TutorialStep,
} from "@/tutorial/tutorialFlow";
import { fortressAnchorFor } from "@/data/mapLayouts";
import { roadCoverage } from "@/engine/MapDeployment";
import { PORTAL_PATH_DISTANCE } from "@/rendering/riftPortal";
import { getTowerUpgradeCost } from "@/entities/Tower";
import { TOWER_DEFINITIONS } from "@/config/towerStats";
import type { TranslationKey } from "@/i18n/translate";
import { useLanguage } from "@/i18n/LanguageContext";
import { PHASES } from "@/config/phaseConfig";
import { HIGH_GROUND_RANGE_MULT, MAX_TOWERS_ON_MAP, RUNE_ALTAR_DAMAGE_MULT } from "@/data/mapLayouts";
import type { TowerType } from "@/config/towerStats";
import { syncSeasonIfNeeded } from "@/engine/AscensionManager";
import type { DualGemPrice } from "@/config/gemsEconomy";

// INIMIGOS 3D — dynamic import so three.js/@react-three/fiber never land in
// this screen's own bundle unless the overlay actually mounts (gated by
// `isWebGLAvailable()` below); on any environment without WebGL, this
// import is never even requested.
const Enemy3DOverlay = lazy(() => import("@/rendering3d/Enemy3DOverlay").then((m) => ({ default: m.Enemy3DOverlay })));

// MUNDO 3D — same lazy/WebGL-gated pattern as the enemy overlay above, for
// the background terrain/atmosphere layer (src/rendering3d/world/).
const WorldSceneOverlay = lazy(() =>
  import("@/rendering3d/world/WorldSceneOverlay").then((m) => ({ default: m.WorldSceneOverlay })),
);

interface GameScreenProps {
  onExitToMenu: () => void;
}

export function GameScreen({ onExitToMenu }: GameScreenProps) {
  const { engine, hud } = useGameEngine();
  useGameAudio(engine);
  // Stable callback identities for the dismissible banners below: `engine`
  // itself never changes across renders (see useGameEngine), but passing a
  // fresh inline arrow on every render defeats EnemyDiscoveryBanner's
  // auto-dismiss useEffect (its `onAcknowledge` dependency changes every
  // frame, so the timer keeps getting reset and never actually fires) —
  // these give each acknowledge handler one identity for the engine's
  // lifetime instead.
  const acknowledgeEndgameWallReport = useCallback(() => engine.acknowledgeEndgameWallReport(), [engine]);
  const acknowledgeDiscovery = useCallback(() => engine.acknowledgeDiscovery(), [engine]);
  const acknowledgeItemReward = useCallback(() => engine.acknowledgeItemReward(), [engine]);
  const acknowledgeRouletteResult = useCallback(() => engine.acknowledgeRouletteResult(), [engine]);
  const [pendingTowerType, setPendingTowerType] = useState<TowerType | null>(null);
  // The diagnostic report can be dismissed to let the player upgrade towers
  // on the map without retrying yet — engine phase itself doesn't change
  // until retryPhase() is called, so visibility is tracked locally and
  // re-armed whenever a fresh PROGRESSION_STOPPED report comes in.
  const [reportDismissed, setReportDismissed] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // INIMIGOS 3D — pilot scope: only BRUTE gets a 3D model (see
  // rendering3d/BruteEnemyLayer.tsx). `enable3DEnemies` starts as the
  // WebGL-availability check and can only ever be turned OFF at runtime
  // (by the error boundary below) — never back on — which is exactly the
  // "never end up with no enemies" fallback contract: once disabled for
  // this session, 2D enemy rendering (already the default when this ref
  // stays empty) takes over permanently instead of retrying.
  const [enable3DEnemies, setEnable3DEnemies] = useState(() => isWebGLAvailable());
  const hidden3DEnemyIdsRef = useRef<Set<string>>(new Set());

  // MUNDO 3D — FASE 1: background terrain/atmosphere layer, independent
  // on/off state from `enable3DEnemies` (own error boundary, own WebGL
  // gate check) so a failure in one layer never disables the other. Same
  // one-way "never re-enable" fallback contract: once a load/runtime
  // error flips this to false, CanvasRenderer's `worldLayerActive` prop
  // follows it and the existing 2D drawBackground fill resumes instantly.
  const [enableWorldLayer, setEnableWorldLayer] = useState(() => isWebGLAvailable());
  // MUNDO 3D — FASE 3 gameplay-integration test: same hidden-ids-ref
  // pattern as `hidden3DEnemyIdsRef` above, for the ONE tower type
  // (IRONWOOD) `WorldGameplayTestLayer.tsx`'s `TestTowerLayer` currently
  // gives a 3D body — cleared on any world-layer failure below so a crash
  // never leaves a tower's 2D sprite permanently hidden.
  const hidden3DTowerIdsRef = useRef<Set<string>>(new Set());

  // BALANCEAMENTO DEFINITIVO spec section 6/8 — Tower Repositioning's own
  // small state machine: "picking" a destination on the map, then either
  // executing immediately (free) or "confirm"/"blocked" for a paid move.
  // Lives here (not inside GameEngine) because it's pure UI flow — the
  // engine's own repositionTower() call is only ever made from "confirm"'s
  // onConfirm or directly from a free destination click.
  type RepositionUiState =
    | { phase: "idle" }
    | { phase: "picking"; fromSlotId: string }
    | { phase: "confirm"; fromSlotId: string; toSlotId: string; price: DualGemPrice }
    | { phase: "blocked"; price: DualGemPrice };
  const [repositionUi, setRepositionUi] = useState<RepositionUiState>({ phase: "idle" });
  // MAP LAYOUTS / DEPLOY — the benched tower the next click on the map places
  // (defaults to the strongest one still waiting).
  const [deployPick, setDeployPick] = useState<string | null>(null);
  const { t } = useLanguage();
  const deploying = hud.phase === "DEPLOY";
  const benchSelectedId = deploying
    ? (hud.deployBench.find((b) => b.id === deployPick)?.id ?? [...hud.deployBench].sort((a, b) => b.level - a.level)[0]?.id ?? null)
    : null;
  const placingTower = benchSelectedId ? (engine.getDeployBench().find((tw) => tw.id === benchSelectedId) ?? null) : null;

  // ---- FIRST-RUN TUTORIAL (tutorial/tutorialFlow.ts) ----
  const [tutorial, setTutorial] = useState<TutorialState>(FINISHED_STATE);
  const updateTutorial = useCallback((fn: (s: TutorialState) => TutorialState) => {
    setTutorial((prev) => {
      const next = fn(prev);
      if (next !== prev) saveTutorialState(next);
      return next;
    });
  }, []);
  const towersNow = engine.getRenderSnapshot().towers;
  const maxTowerLevel = towersNow.reduce((m, tw) => Math.max(m, tw.level), 0);
  const upgradeableTower = towersNow.find((tw) => {
    const cost = getTowerUpgradeCost(tw);
    return cost !== null && cost <= hud.gold;
  });
  const canAffordUpgrade = upgradeableTower !== undefined;
  useEffect(() => {
    updateTutorial((s) =>
      advanceTutorial(s, {
        phase: hud.phase,
        towerCount: hud.towerCount,
        pendingTowerType,
        selectedTowerId: hud.selectedTowerId,
        maxTowerLevel,
        canAffordUpgrade,
        speed: hud.speed,
      }),
    );
  }, [updateTutorial, hud.phase, hud.towerCount, pendingTowerType, hud.selectedTowerId, maxTowerLevel, canAffordUpgrade, hud.speed]);
  const tutorialBlocking = isBlockingStep(tutorial.step);
  useEffect(() => {
    engine.setTutorialHold(tutorialBlocking);
    return () => engine.setTutorialHold(false);
  }, [engine, tutorialBlocking]);
  const tutorialCard = visibleTutorialCard(tutorial, hud.phase);
  const tutorialStep: TutorialStep | null = tutorialCard?.kind === "step" ? tutorialCard.step : null;
  // the best free build spot for the tower in hand (or Ironwood), to glow during PLACE_TOWER
  const suggestedSiteId = useMemo(() => {
    if (tutorialStep !== "PLACE_TOWER") return null;
    const layout = engine.getMapLayout();
    const occupied = new Set(engine.getRenderSnapshot().towers.map((tw) => tw.slotId));
    const range = TOWER_DEFINITIONS[pendingTowerType ?? "IRONWOOD"].baseRange;
    let best: { id: string; value: number } | null = null;
    for (const site of layout.sites) {
      if (occupied.has(site.id)) continue;
      const value = roadCoverage(layout, site.position, range * (site.trait === "HIGH_GROUND" ? HIGH_GROUND_RANGE_MULT : 1)).fraction;
      if (!best || value > best.value) best = { id: site.id, value };
    }
    return best?.id ?? null;
  }, [engine, tutorialStep, pendingTowerType, hud.mapLayoutId]);
  const upgradeTowerId = upgradeableTower?.id ?? null;
  const tutorialTargets = useMemo<TutorialTarget[]>(() => {
    const layout = engine.getMapLayout();
    switch (tutorialStep) {
      case "INTRO": {
        const [a, b] = [layout.path[0]!, layout.path[1]!];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const castle = fortressAnchorFor(layout.path).position;
        return [
          { kind: "world", x: a.x + ((b.x - a.x) / len) * PORTAL_PATH_DISTANCE, y: a.y + ((b.y - a.y) / len) * PORTAL_PATH_DISTANCE, r: 38 },
          { kind: "world", x: castle.x, y: castle.y - 55, r: 80 },
        ];
      }
      case "PICK_TOWER":
        return [{ kind: "dom", id: "tower-IRONWOOD" }];
      case "PLACE_TOWER": {
        const site = layout.sites.find((s) => s.id === suggestedSiteId);
        return site ? [{ kind: "world", x: site.position.x, y: site.position.y, r: 28 }] : [];
      }
      case "SELECT_TOWER": {
        const tower = engine.getRenderSnapshot().towers.find((tw) => tw.id === upgradeTowerId);
        return tower ? [{ kind: "world", x: tower.position.x, y: tower.position.y - 10, r: 34 }] : [];
      }
      case "UPGRADE":
        return [{ kind: "dom", id: "upgrade" }];
      case "SPEED":
        return [{ kind: "dom", id: "speed-2" }, { kind: "dom", id: "speed-4" }];
      default:
        return [];
    }
  }, [engine, tutorialStep, suggestedSiteId, upgradeTowerId, hud.mapLayoutId]);
  useEffect(() => {
    if (!deploying) setDeployPick(null);
  }, [deploying]);

  useEffect(() => {
    // Master Implementation spec section 9 — every entry point into the
    // game must catch the account up on any Season boundary that passed
    // since it was last opened, before anything Season-related renders.
    // A no-op once already caught up for the current Season.
    syncSeasonIfNeeded();
    // Moving onto a new map pauses so the player can arrange their towers.
    engine.enableDeployPause(true);
    engine.startRun();
    // First-run tutorial: only a brand-new save starts it; anyone who
    // already played is marked done the first time they open this build.
    const saved = loadTutorialState();
    const h = engine.getHudSnapshot();
    const initial = saved ?? (isNewPlayer({ wave: h.wave, bestWave: h.bestWave, towerCount: h.towerCount }) ? NEW_PLAYER_STATE : FINISHED_STATE);
    if (!saved) saveTutorialState(initial);
    // hold from the very first frame, not one render later
    engine.setTutorialHold(isBlockingStep(initial.step));
    setTutorial(initial);
  }, [engine]);

  useEffect(() => {
    if (hud.phase === "PROGRESSION_STOPPED") setReportDismissed(false);
  }, [hud.phase]);

  useEffect(() => {
    // Dev-only hook so end-to-end smoke tests can drive/inspect the engine
    // directly instead of pixel-clicking canvas coordinates. Dead-code-
    // eliminated from production builds (import.meta.env.DEV is false).
    if (import.meta.env.DEV) {
      (window as unknown as { __hordenovaEngine?: typeof engine }).__hordenovaEngine = engine;
      (window as unknown as { __hordenovaAudio?: typeof audioManager }).__hordenovaAudio = audioManager;
    }
  }, [engine]);

  /** Executes (free) or opens the Gems confirmation/blocked prompt for a chosen destination slot — shared by both the empty-slot and swap-with-occupied-slot paths below. GEMS ECONOMY v2 — the prompt always shows BOTH prices; "blocked" only when NEITHER currency can afford it. */
  const resolveRepositionDestination = (fromSlotId: string, toSlotId: string) => {
    const price = engine.getRepositionPrice();
    if (price.free === 0 && price.purchased === 0) {
      engine.repositionTower(fromSlotId, toSlotId);
      setRepositionUi({ phase: "idle" });
    } else if (hud.freeGems < price.free && hud.purchasedGems < price.purchased) {
      setRepositionUi({ phase: "blocked", price });
    } else {
      setRepositionUi({ phase: "confirm", fromSlotId, toSlotId, price });
    }
  };

  const handleSlotClick = (slotId: string) => {
    if (repositionUi.phase === "picking") {
      resolveRepositionDestination(repositionUi.fromSlotId, slotId);
      return;
    }
    if (pendingTowerType) {
      const placed = engine.placeTower(slotId, pendingTowerType);
      if (placed) setPendingTowerType(null);
      return;
    }
    // DEPLOY: put the chosen benched tower here — once; it can't be picked up again for free
    if (benchSelectedId) {
      engine.selectTower(null);
      if (engine.deployPlaceTower(benchSelectedId, slotId)) setDeployPick(null);
    }
  };

  const handleTowerClick = (towerId: string) => {
    if (repositionUi.phase === "picking") {
      const tower = engine.getRenderSnapshot().towers.find((t) => t.id === towerId);
      if (!tower) return;
      if (tower.slotId === repositionUi.fromSlotId) {
        // Clicking the same tower being repositioned cancels the flow.
        setRepositionUi({ phase: "idle" });
        return;
      }
      resolveRepositionDestination(repositionUi.fromSlotId, tower.slotId);
      return;
    }
    engine.selectTower(towerId);
  };

  const handleBackgroundClick = () => {
    setDeployPick(null);
    engine.selectTower(null);
    setPendingTowerType(null);
    if (repositionUi.phase === "picking") setRepositionUi({ phase: "idle" });
  };

  const handleStartReposition = (slotId: string) => {
    engine.selectTower(null);
    setPendingTowerType(null);
    setRepositionUi({ phase: "picking", fromSlotId: slotId });
  };

  const selectedTower = hud.selectedTowerId
    ? engine.getRenderSnapshot().towers.find((t) => t.id === hud.selectedTowerId) ?? null
    : null;

  const offlineSummary = hud.phase === "OFFLINE_RETURN" ? engine.getOfflineSummary() : null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <HUD hud={hud} onSetSpeed={engine.setSpeed.bind(engine)} onOpenInventory={() => setInventoryOpen((open) => !open)} />

      {/*
        MUNDO 3D — `zIndex: 0` here (instead of leaving it "auto") is load-
        bearing: it makes THIS div establish its own CSS stacking context,
        so WorldSceneOverlay's `zIndex: -1` wrapper is scoped to stack
        behind CanvasRenderer's canvas WITHIN this container — without it,
        a negative z-index with no enclosing stacking context resolves
        against the page's own root stacking context instead (verified
        live: the terrain rendered fine at zIndex 999 but was invisible at
        zIndex -1 without this, hidden behind the page's own background,
        nowhere near where drawBackground's flat fill even was). Every
        other child here keeps its default `auto` z-index and stacks by
        DOM order exactly as before — this changes nothing for them.
      */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, zIndex: 0 }}>
        {enableWorldLayer && (
          <Enemy3DErrorBoundary
            onError={() => {
              hidden3DTowerIdsRef.current.clear();
              setEnableWorldLayer(false);
            }}
          >
            <Suspense fallback={null}>
              <WorldSceneOverlay engine={engine} />
            </Suspense>
          </Enemy3DErrorBoundary>
        )}
        <CanvasRenderer
          engine={engine}
          pendingTowerType={pendingTowerType}
          onSlotClick={handleSlotClick}
          onTowerClick={handleTowerClick}
          onBackgroundClick={handleBackgroundClick}
          hidden3DEnemyIds={hidden3DEnemyIdsRef}
          hidden3DTowerIds={hidden3DTowerIdsRef}
          worldLayerActive={enableWorldLayer}
          placingTower={placingTower}
          previewLabels={{
            coverage: t("deploy.previewCoverage", { pct: "{pct}" }),
            highGround: t("deploy.highGround", { pct: Math.round((HIGH_GROUND_RANGE_MULT - 1) * 100) }),
            altar: t("deploy.runeAltar", { pct: Math.round((RUNE_ALTAR_DAMAGE_MULT - 1) * 100) }),
          }}
        />
        {enable3DEnemies && (
          <Enemy3DErrorBoundary
            onError={() => {
              hidden3DEnemyIdsRef.current.clear();
              setEnable3DEnemies(false);
            }}
          >
            <Suspense fallback={null}>
              <Enemy3DOverlay engine={engine} hiddenIdsRef={hidden3DEnemyIdsRef} />
            </Suspense>
          </Enemy3DErrorBoundary>
        )}

        <AscensionHudBadge />
        <BossBanner hud={hud} />
        <PhaseBanner phaseId={hud.phaseId} phaseI18nKey={hud.phaseI18nKey} />
        {engine.getEndgameWallReport() && (
          <EndgameWallBanner report={engine.getEndgameWallReport()!} onDismiss={acknowledgeEndgameWallReport} />
        )}
        {hud.pendingDiscoveryType && !tutorialBlocking && (
          <EnemyDiscoveryBanner enemyType={hud.pendingDiscoveryType} onAcknowledge={acknowledgeDiscovery} />
        )}
        {hud.pendingItemReward && (
          <ItemRewardBanner
            itemDefinitionId={hud.pendingItemReward.itemDefinitionId}
            onAcknowledge={acknowledgeItemReward}
            onOpenInventory={() => setInventoryOpen(true)}
          />
        )}
        {hud.pendingRouletteResult && (
          <RouletteBanner result={hud.pendingRouletteResult} onAcknowledge={acknowledgeRouletteResult} />
        )}
        {/* AUDITORIA E CORREÇÃO GERAL spec sections 2-3, 11 — shown whenever a milestone is unlocked but not yet spun (persists across F5). Hidden while a just-resolved result is still being revealed, so the two never overlap in the same bottom-center slot; a second pending wave (e.g. Offline Defense crossing both 20 and 30) shows here again the instant the current reveal is acknowledged. */}
        {hud.pendingRouletteSpinWave !== null && !hud.pendingRouletteResult && (
          <RoulettePendingPrompt wave={hud.pendingRouletteSpinWave} onSpin={() => engine.spinPendingRoulette()} />
        )}

        {deploying && (
          <DeployOverlay
            phaseNumber={Math.max(1, PHASES.findIndex((p) => p.i18nKey === hud.phaseI18nKey) + 1)}
            phaseI18nKey={hud.phaseI18nKey}
            bench={hud.deployBench}
            selectedId={benchSelectedId}
            onSelect={(id) => {
              setPendingTowerType(null);
              setDeployPick(id);
            }}
            onStart={() => {
              setDeployPick(null);
              engine.confirmDeployment();
            }}
          />
        )}

        {tutorialCard && (
          <TutorialOverlay
            stepLabel={(() => {
              const n = tutorialStep ? stepNumber(tutorialStep) : null;
              return n ? t("tutorial.stepOf", { n, total: TUTORIAL_STEP_COUNT }) : null;
            })()}
            title={t(`tutorial.${tutorialCopyKey(tutorialCard.kind === "boss" ? "BOSS" : tutorialCard.step)}.title` as TranslationKey)}
            body={t(`tutorial.${tutorialCopyKey(tutorialCard.kind === "boss" ? "BOSS" : tutorialCard.step)}.body` as TranslationKey, {
              cost: TOWER_DEFINITIONS.IRONWOOD.buildCost,
            })}
            targets={tutorialCard.kind === "boss" ? NO_TARGETS : tutorialTargets}
            anchor={tutorialStep && tutorialStep !== "INTRO" && tutorialTargets.length > 0 ? "target" : "map"}
            ackLabel={
              tutorialCard.kind === "boss"
                ? t("tutorial.gotIt")
                : tutorialStep === "FINISH"
                  ? t("tutorial.finish.button")
                  : tutorialStep && hasAcknowledgeButton(tutorialStep)
                    ? t("tutorial.gotIt")
                    : null
            }
            onAck={() => updateTutorial((s) => (tutorialCard.kind === "boss" ? { ...s, bossTipShown: true } : acknowledgeTutorial(s)))}
            skipLabel={tutorialCard.kind === "step" && tutorialStep !== "FINISH" ? t("tutorial.skip") : null}
            onSkip={() => updateTutorial(() => skipTutorial())}
          />
        )}

        {selectedTower && (
          <TowerInfoPanel
            tower={selectedTower}
            gold={hud.gold}
            freeGems={hud.freeGems}
            purchasedGems={hud.purchasedGems}
            onUpgrade={() => engine.upgradeSelectedTower()}
            onClose={() => engine.selectTower(null)}
            onChooseSpecialization={(id, currency) => engine.chooseTowerSpecialization(id, currency)}
            onUpgradeSpecialization={() => engine.upgradeSelectedTowerSpecialization()}
            onEquipSkin={(skinId) => engine.equipSkinOnSelectedTower(skinId)}
            onPurchaseSkin={(skinId, currency) => engine.purchaseTowerSkin(skinId, currency)}
            isSkinOwned={(skinId) => engine.isTowerSkinOwned(skinId)}
            onUnlockMastery={() => engine.unlockSelectedTowerMastery()}
            onUpgradeMastery={() => engine.upgradeSelectedTowerMastery()}
            unlockedSpecializationIdsForType={engine.getUnlockedSpecializationIdsForType(selectedTower.type)}
            onSwitchSpecialization={(id, currency) => engine.switchTowerSpecialization(id, currency)}
            repositionFreeAvailable={hud.repositionFreeAvailable}
            onStartReposition={() => handleStartReposition(selectedTower.slotId)}
            itemSlots={engine.getSelectedTowerItemSlots()}
            inventory={engine.getInventory()}
            canEquipToSlot={(instanceId, slotIndex) => engine.canEquipItemOnSelectedTower(instanceId, slotIndex)}
            onEquipItem={(instanceId, slotIndex) => engine.equipItemOnSelectedTower(instanceId, slotIndex)}
            onUnequipItem={(slotIndex) => engine.unequipItemFromSelectedTower(slotIndex)}
            unlockedSlots={engine.getSelectedTowerUnlockedSlots()}
            getSlotUnlockPrice={(slotIndex) => engine.getItemSlotUnlockDualPrice(slotIndex)}
            canUnlockSlot={(slotIndex, currency) => engine.canUnlockItemSlotOnSelectedTower(slotIndex, currency)}
            onUnlockSlot={(slotIndex, currency) => engine.unlockItemSlotOnSelectedTower(slotIndex, currency)}
          />
        )}

        {repositionUi.phase === "picking" && (
          <RepositioningOverlay mode="picking" onCancel={() => setRepositionUi({ phase: "idle" })} />
        )}
        {repositionUi.phase === "confirm" && (
          <RepositioningOverlay
            mode="confirm"
            price={repositionUi.price}
            freeGems={hud.freeGems}
            purchasedGems={hud.purchasedGems}
            onConfirm={(currency) => {
              engine.repositionTower(repositionUi.fromSlotId, repositionUi.toSlotId, currency);
              setRepositionUi({ phase: "idle" });
            }}
            onCancel={() => setRepositionUi({ phase: "idle" })}
          />
        )}
        {repositionUi.phase === "blocked" && (
          <RepositioningOverlay
            mode="blocked"
            price={repositionUi.price}
            freeGems={hud.freeGems}
            purchasedGems={hud.purchasedGems}
            onClose={() => setRepositionUi({ phase: "idle" })}
          />
        )}

        {hud.phase === "PROGRESSION_STOPPED" && !reportDismissed && (
          <ProgressionStoppedOverlay
            hud={hud}
            report={engine.getFailureReport()}
            onDismiss={() => setReportDismissed(true)}
            onRetry={() => engine.retryPhase()}
            onExitToMenu={onExitToMenu}
          />
        )}

        {offlineSummary && (
          <WelcomeBackOverlay summary={offlineSummary} onContinue={() => engine.dismissOfflineSummary()} />
        )}

        {inventoryOpen && (
          <InventoryPanel
            inventory={engine.getInventory()}
            localEconomyTotals={engine.getLocalEconomyTotals()}
            onClose={() => setInventoryOpen(false)}
            inventoryCapacity={engine.getInventoryCapacity()}
            overflowInventory={engine.getOverflowInventory()}
            onClaimOverflowItem={(instanceId) => engine.claimOverflowItem(instanceId)}
            gemShards={hud.gemShards}
            onConvertGemShards={() => engine.convertGemShards()}
            freeGems={hud.freeGems}
            purchasedGems={hud.purchasedGems}
            prestigeLevel={engine.getPrestigeLevel()}
            bestWave={hud.bestWave}
            onUpgradePrestige={(currency) => engine.upgradePrestige(currency)}
            getFusionEligibility={(ids) => engine.getFusionEligibility(ids)}
            onAttemptFusion={(ids) => engine.attemptFusion(ids)}
          />
        )}
      </div>

      <TowerPalette
        gold={hud.gold}
        pendingTowerType={pendingTowerType}
        onSelect={setPendingTowerType}
        mapFull={hud.towerCount + hud.deployBench.length >= MAX_TOWERS_ON_MAP}
        mapFullLabel={t("deploy.mapFull", { max: MAX_TOWERS_ON_MAP })}
      />
    </div>
  );
}

const NO_TARGETS: TutorialTarget[] = [];

/** i18n block (tutorial.<key>) for each card. */
function tutorialCopyKey(step: TutorialStep | "BOSS"): string {
  switch (step) {
    case "INTRO":
      return "intro";
    case "PICK_TOWER":
      return "pickTower";
    case "PLACE_TOWER":
      return "placeTower";
    case "GOLD":
      return "gold";
    case "SELECT_TOWER":
      return "selectTower";
    case "UPGRADE":
      return "upgrade";
    case "SPEED":
      return "speed";
    case "BOSS":
      return "boss";
    default:
      return "finish";
  }
}
