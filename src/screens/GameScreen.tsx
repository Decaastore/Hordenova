import { useEffect, useState } from "react";
import { useGameEngine } from "@/hooks/useGameEngine";
import { CanvasRenderer } from "@/rendering/CanvasRenderer";
import { HUD } from "@/ui/HUD";
import { TowerPalette } from "@/ui/TowerPalette";
import { TowerInfoPanel } from "@/ui/TowerInfoPanel";
import { DefeatOverlay } from "@/ui/DefeatOverlay";
import type { TowerType } from "@/config/towerStats";

interface GameScreenProps {
  onExitToMenu: () => void;
}

export function GameScreen({ onExitToMenu }: GameScreenProps) {
  const { engine, hud } = useGameEngine();
  const [pendingTowerType, setPendingTowerType] = useState<TowerType | null>(null);

  useEffect(() => {
    engine.startRun();
  }, [engine]);

  useEffect(() => {
    // Dev-only hook so end-to-end smoke tests can drive/inspect the engine
    // directly instead of pixel-clicking canvas coordinates. Dead-code-
    // eliminated from production builds (import.meta.env.DEV is false).
    if (import.meta.env.DEV) {
      (window as unknown as { __hordenovaEngine?: typeof engine }).__hordenovaEngine = engine;
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

  const handleTryAgain = () => {
    engine.startRun();
  };

  const selectedTower = hud.selectedTowerId
    ? engine.getRenderSnapshot().towers.find((t) => t.id === hud.selectedTowerId) ?? null
    : null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <HUD hud={hud} onSetSpeed={engine.setSpeed.bind(engine)} />

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CanvasRenderer
          engine={engine}
          pendingTowerType={pendingTowerType}
          onSlotClick={handleSlotClick}
          onTowerClick={handleTowerClick}
          onBackgroundClick={handleBackgroundClick}
        />

        {selectedTower && (
          <TowerInfoPanel
            tower={selectedTower}
            gold={hud.gold}
            onUpgrade={() => engine.upgradeSelectedTower()}
            onClose={() => engine.selectTower(null)}
          />
        )}

        {hud.phase === "DEFEAT" && (
          <DefeatOverlay hud={hud} onTryAgain={handleTryAgain} onExitToMenu={onExitToMenu} />
        )}
      </div>

      <TowerPalette gold={hud.gold} pendingTowerType={pendingTowerType} onSelect={setPendingTowerType} />
    </div>
  );
}
