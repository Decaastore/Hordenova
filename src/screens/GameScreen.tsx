import { useEffect, useState } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
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

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CanvasRenderer
          engine={engine}
          pendingTowerType={pendingTowerType}
          onSlotClick={handleSlotClick}
          onTowerClick={handleTowerClick}
          onBackgroundClick={handleBackgroundClick}
        />

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
