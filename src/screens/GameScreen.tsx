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

  const handleSlotClick = (slotId: string) => {
    if (pendingTowerType) {
      const placed = engine.placeTower(slotId, pendingTowerType);
      if (placed) setPendingTowerType(null);
    }
  };

  const handleTowerClick = (towerId: string) => {
    engine.selectTower(towerId);
  };

  const handleBackgroundClick = () => {
    engine.selectTower(null);
    setPendingTowerType(null);
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
        <PhaseBanner phaseId={hud.phaseId} />
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
            onUpgradeMastery={() => engine.upgradeSelectedTowerMastery()}
            respecTokensAvailable={engine.getAvailableRespecTokensForSelectedTower()}
            canRespecSpecialization={engine.canRespecSelectedTowerSpecialization()}
            onRespecSpecialization={() => engine.respecSelectedTowerSpecialization()}
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
            gems={hud.gems}
            prestigeLevel={engine.getPrestigeLevel()}
            onUpgradePrestige={() => engine.upgradePrestige()}
          />
        )}
      </div>

      <TowerPalette gold={hud.gold} pendingTowerType={pendingTowerType} onSelect={setPendingTowerType} />
    </div>
  );
}
