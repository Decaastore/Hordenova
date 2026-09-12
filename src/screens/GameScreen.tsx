import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
import type { TowerType } from "@/config/towerStats";
import { syncSeasonIfNeeded } from "@/engine/AscensionManager";

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

  // BALANCEAMENTO DEFINITIVO spec section 6/8 — Tower Repositioning's own
  // small state machine: "picking" a destination on the map, then either
  // executing immediately (free) or "confirm"/"blocked" for a paid move.
  // Lives here (not inside GameEngine) because it's pure UI flow — the
  // engine's own repositionTower() call is only ever made from "confirm"'s
  // onConfirm or directly from a free destination click.
  type RepositionUiState =
    | { phase: "idle" }
    | { phase: "picking"; fromSlotId: string }
    | { phase: "confirm"; fromSlotId: string; toSlotId: string; cost: number }
    | { phase: "blocked"; cost: number };
  const [repositionUi, setRepositionUi] = useState<RepositionUiState>({ phase: "idle" });

  useEffect(() => {
    // Master Implementation spec section 9 — every entry point into the
    // game must catch the account up on any Season boundary that passed
    // since it was last opened, before anything Season-related renders.
    // A no-op once already caught up for the current Season.
    syncSeasonIfNeeded();
    engine.startRun();
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

  /** Executes (free) or opens the Gems confirmation/blocked prompt for a chosen destination slot — shared by both the empty-slot and swap-with-occupied-slot paths below. */
  const resolveRepositionDestination = (fromSlotId: string, toSlotId: string) => {
    const cost = engine.getRepositionCost();
    if (cost === 0) {
      engine.repositionTower(fromSlotId, toSlotId);
      setRepositionUi({ phase: "idle" });
    } else if (hud.gems < cost) {
      setRepositionUi({ phase: "blocked", cost });
    } else {
      setRepositionUi({ phase: "confirm", fromSlotId, toSlotId, cost });
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
          <Enemy3DErrorBoundary onError={() => setEnableWorldLayer(false)}>
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
          worldLayerActive={enableWorldLayer}
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
          <EndgameWallBanner report={engine.getEndgameWallReport()!} onDismiss={() => engine.acknowledgeEndgameWallReport()} />
        )}
        {hud.pendingDiscoveryType && (
          <EnemyDiscoveryBanner enemyType={hud.pendingDiscoveryType} onAcknowledge={() => engine.acknowledgeDiscovery()} />
        )}
        {hud.pendingItemReward && (
          <ItemRewardBanner
            itemDefinitionId={hud.pendingItemReward.itemDefinitionId}
            onAcknowledge={() => engine.acknowledgeItemReward()}
            onOpenInventory={() => setInventoryOpen(true)}
          />
        )}
        {hud.pendingRouletteResult && (
          <RouletteBanner result={hud.pendingRouletteResult} onAcknowledge={() => engine.acknowledgeRouletteResult()} />
        )}
        {/* AUDITORIA E CORREÇÃO GERAL spec sections 2-3, 11 — shown whenever a milestone is unlocked but not yet spun (persists across F5). Hidden while a just-resolved result is still being revealed, so the two never overlap in the same bottom-center slot; a second pending wave (e.g. Offline Defense crossing both 20 and 30) shows here again the instant the current reveal is acknowledged. */}
        {hud.pendingRouletteSpinWave !== null && !hud.pendingRouletteResult && (
          <RoulettePendingPrompt wave={hud.pendingRouletteSpinWave} onSpin={() => engine.spinPendingRoulette()} />
        )}

        {selectedTower && (
          <TowerInfoPanel
            tower={selectedTower}
            gold={hud.gold}
            gems={hud.gems}
            onUpgrade={() => engine.upgradeSelectedTower()}
            onClose={() => engine.selectTower(null)}
            onChooseSpecialization={(id) => engine.chooseTowerSpecialization(id)}
            onUpgradeSpecialization={() => engine.upgradeSelectedTowerSpecialization()}
            onEquipSkin={(skinId) => engine.equipSkinOnSelectedTower(skinId)}
            onPurchaseSkin={(skinId) => engine.purchaseTowerSkin(skinId)}
            isSkinOwned={(skinId) => engine.isTowerSkinOwned(skinId)}
            onUnlockMastery={() => engine.unlockSelectedTowerMastery()}
            onUpgradeMastery={() => engine.upgradeSelectedTowerMastery()}
            unlockedSpecializationIdsForType={engine.getUnlockedSpecializationIdsForType(selectedTower.type)}
            onSwitchSpecialization={(id) => engine.switchTowerSpecialization(id)}
            repositionFreeAvailable={hud.repositionFreeAvailable}
            onStartReposition={() => handleStartReposition(selectedTower.slotId)}
            itemSlots={engine.getSelectedTowerItemSlots()}
            inventory={engine.getInventory()}
            canEquipToSlot={(instanceId, slotIndex) => engine.canEquipItemOnSelectedTower(instanceId, slotIndex)}
            onEquipItem={(instanceId, slotIndex) => engine.equipItemOnSelectedTower(instanceId, slotIndex)}
            onUnequipItem={(slotIndex) => engine.unequipItemFromSelectedTower(slotIndex)}
            unlockedSlots={engine.getSelectedTowerUnlockedSlots()}
            getSlotUnlockCost={(slotIndex) => engine.getItemSlotUnlockGemCost(slotIndex)}
            canUnlockSlot={(slotIndex) => engine.canUnlockItemSlotOnSelectedTower(slotIndex)}
            onUnlockSlot={(slotIndex) => engine.unlockItemSlotOnSelectedTower(slotIndex)}
          />
        )}

        {repositionUi.phase === "picking" && (
          <RepositioningOverlay mode="picking" onCancel={() => setRepositionUi({ phase: "idle" })} />
        )}
        {repositionUi.phase === "confirm" && (
          <RepositioningOverlay
            mode="confirm"
            cost={repositionUi.cost}
            onConfirm={() => {
              engine.repositionTower(repositionUi.fromSlotId, repositionUi.toSlotId);
              setRepositionUi({ phase: "idle" });
            }}
            onCancel={() => setRepositionUi({ phase: "idle" })}
          />
        )}
        {repositionUi.phase === "blocked" && (
          <RepositioningOverlay mode="blocked" cost={repositionUi.cost} onClose={() => setRepositionUi({ phase: "idle" })} />
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
            gems={hud.gems}
            prestigeLevel={engine.getPrestigeLevel()}
            bestWave={hud.bestWave}
            onUpgradePrestige={() => engine.upgradePrestige()}
            getFusionEligibility={(ids) => engine.getFusionEligibility(ids)}
            onAttemptFusion={(ids) => engine.attemptFusion(ids)}
          />
        )}
      </div>

      <TowerPalette gold={hud.gold} pendingTowerType={pendingTowerType} onSelect={setPendingTowerType} />
    </div>
  );
}
