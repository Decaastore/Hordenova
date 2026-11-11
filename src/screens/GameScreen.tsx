import { BestiaryPanel } from "@/ui/BestiaryPanel";
import { TalentPanel } from "@/ui/TalentPanel";
import { RiftPanel } from "@/ui/RiftPanel";
import { CityPanel } from "@/ui/CityPanel";
import { HordeAdaptationBadge } from "@/ui/HordeAdaptationBadge";
import { VictoryClipCard } from "@/ui/clip/VictoryClipCard";
import { isClipRecordingSupported, VictoryClipRecorder, type FinishedClip } from "@/ui/clip/victoryClip";
import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
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
import { DailyMissionsPanel } from "@/ui/DailyMissionsPanel";
import { getMainBossForWave } from "@/config/bossConfig";
import { useTabPresence } from "@/hooks/useTabPresence";
import { formatDurationShort } from "@/utils/formatDuration";
import { ProgressionStoppedBar, ProgressionStoppedOverlay } from "@/ui/ProgressionStoppedOverlay";
import { BossBanner } from "@/ui/BossBanner";
import { SpecialsPanel } from "@/ui/SpecialsPanel";
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
import { PORTAL_PATH_DISTANCE } from "@/rendering/riftPortal";
import { getTowerUpgradeCost } from "@/entities/Tower";
import { TOWER_DEFINITIONS } from "@/config/towerStats";
import type { TranslationKey } from "@/i18n/translate";
import { flushBalanceEvents } from "@/telemetry/balanceTelemetry";
import { useLanguage } from "@/i18n/LanguageContext";
import { PHASES } from "@/config/phaseConfig";
import { HIGH_GROUND_RANGE_MULT, MAX_TOWERS_ON_MAP, MAX_TOWERS_PER_TYPE, RUNE_ALTAR_DAMAGE_MULT } from "@/data/mapLayouts";
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
  /** Leaves the game for the Store page (the HUD's Gem balances). */
  onOpenStore?: () => void;
}

export function GameScreen({ onExitToMenu, onOpenStore }: GameScreenProps) {
  const { engine, hud } = useGameEngine();
  const tabPresence = useTabPresence(hud);
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
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [riftOpen, setRiftOpen] = useState(false);
  const [talentsOpen, setTalentsOpen] = useState(false);
  const [bestiaryOpen, setBestiaryOpen] = useState(false);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  // CLIPE DA VITÓRIA — records each main-boss fight in the browser; on the
  // kill the last seconds plus an end card become a shareable video.
  const clipRecorderRef = useRef<VictoryClipRecorder | null>(null);
  const clipSupported = useMemo(() => isClipRecordingSupported(), []);
  const [victoryClip, setVictoryClip] = useState<{ clip: FinishedClip; bossName: string; wave: number } | null>(null);

  // O CASTELO VIRA CIDADE — a short notice when a building rises, burns or is rebuilt.
  const [cityNotice, setCityNotice] = useState<string | null>(null);
  const lastCitySeqRef = useRef<number>(hud.city.lastEvent?.seq ?? 0);

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
  const { t, language } = useLanguage();

  // CLIPE DA VITÓRIA — start recording when a main-boss fight begins, cut the clip at the kill, drop it if the boss retreats.
  useEffect(() => {
    const phase = hud.phase;
    if (phase === "BOSS_INTRO" || phase === "BOSS_BATTLE") {
      if (!clipRecorderRef.current && clipSupported && mapAreaRef.current && !document.hidden) {
        try {
          const recorder = new VictoryClipRecorder(mapAreaRef.current);
          recorder.start();
          clipRecorderRef.current = recorder;
        } catch {
          clipRecorderRef.current = null;
        }
      }
      return;
    }
    const recorder = clipRecorderRef.current;
    if (!recorder) return;
    clipRecorderRef.current = null;
    if (phase !== "VICTORY") {
      recorder.cancel();
      return;
    }
    const bossName = hud.bossNameKey ? t(`bosses.${hud.bossNameKey}.name` as TranslationKey) : "";
    const wave = hud.wave;
    void recorder
      .finish({ title: t("clip.overlayTitle"), subtitle: bossName, wave: t("clip.overlayWave", { wave }) })
      .then((clip) => {
        if (clip) setVictoryClip({ clip, bossName, wave });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase]);
  useEffect(() => () => clipRecorderRef.current?.cancel(), []);

  // O CASTELO VIRA CIDADE — announce buildings rising, burning and being rebuilt (not the routine income).
  const cityEvent = hud.city.lastEvent;
  useEffect(() => {
    if (!cityEvent || cityEvent.seq <= lastCitySeqRef.current) return;
    lastCitySeqRef.current = cityEvent.seq;
    if (cityEvent.kind === "INCOME") return;
    const names = cityEvent.ids.map((id) => t(`city.buildings.${id}` as TranslationKey)).join(", ");
    setCityNotice(t(`city.events.${cityEvent.kind}` as TranslationKey, { name: names }));
    const timer = window.setTimeout(() => setCityNotice(null), 4200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityEvent?.seq]);
  // CONQUISTAS — a short notice when an achievement unlocks.
  const lastAch = hud.achievement.last;
  const lastAchSeqRef = useRef<number>(lastAch?.seq ?? 0);
  useEffect(() => {
    if (!lastAch || lastAch.seq === lastAchSeqRef.current) return;
    lastAchSeqRef.current = lastAch.seq;
    setCityNotice(
      t("achievements.unlocked", {
        name: t(`achievements.list.${lastAch.id}.name` as TranslationKey),
        title: t(`achievements.list.${lastAch.id}.title` as TranslationKey),
      }),
    );
    const timer = window.setTimeout(() => setCityNotice(null), 5200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAch?.seq]);

  // FENDAS — a short notice when a Rift is won or lost.
  const riftResult = hud.rift.lastResult;
  const lastRiftSeqRef = useRef<number>(riftResult?.seq ?? 0);
  useEffect(() => {
    if (!riftResult || riftResult.seq === lastRiftSeqRef.current) return;
    lastRiftSeqRef.current = riftResult.seq;
    setCityNotice(
      riftResult.won && riftResult.reward
        ? t("rift.won", { shards: riftResult.reward.shards, gold: riftResult.reward.gold, items: riftResult.reward.itemRolls })
        : t("rift.lost"),
    );
    const timer = window.setTimeout(() => setCityNotice(null), 5200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riftResult?.seq]);
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
      // PLACE_TOWER points at no spot in particular: which spot is good is the player's call
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
  }, [engine, tutorialStep, upgradeTowerId, hud.mapLayoutId]);
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
    // anonymous balance data (where castles fall, boss attempts) — local
    // until a telemetry server is configured; see telemetry/balanceTelemetry.ts
    engine.enableTelemetry(true);
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

  // Send queued balance events (no-op unless VITE_TELEMETRY_URL is set).
  useEffect(() => {
    const flush = () => void flushBalanceEvents();
    flush();
    const id = window.setInterval(flush, 60_000);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

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
      <HUD hud={hud} onSetSpeed={engine.setSpeed.bind(engine)} onOpenInventory={() => setInventoryOpen((open) => !open)} onExitToHome={onExitToMenu} onOpenStore={onOpenStore} onToggleMissions={() => setMissionsOpen((open) => !open)} onToggleCity={() => setCityOpen((open) => !open)} onToggleRift={() => setRiftOpen((open) => !open)} onToggleTalents={() => setTalentsOpen((open) => !open)} onToggleBestiary={() => setBestiaryOpen((open) => !open)} />

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
      <div ref={mapAreaRef} style={{ position: "relative", flex: 1, minHeight: 0, zIndex: 0 }}>
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
        <HordeAdaptationBadge multipliers={hud.horde.multipliers} changeSeq={hud.horde.changeSeq} />
        {cityNotice && (
          <div style={{ ...cityNoticeStyle, top: hud.phase === "BOSS_INTRO" || hud.phase === "BOSS_BATTLE" || hud.phase === "VICTORY" ? 92 : 12 }} role="status" data-testid="city-notice">
            {cityNotice}
          </div>
        )}
        {victoryClip && (
          <VictoryClipCard clip={victoryClip.clip} bossName={victoryClip.bossName} wave={victoryClip.wave} onClose={() => setVictoryClip(null)} />
        )}
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
        {hud.pendingRouletteSpinWave !== null && !hud.pendingRouletteResult && hud.phase !== "OFFLINE_RETURN" && (
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
            onUpgradeMana={() => engine.upgradeSelectedTowerMana()}
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

        {hud.phase === "PROGRESSION_STOPPED" && reportDismissed && (
          <ProgressionStoppedBar onRetry={() => engine.retryPhase()} onShowReport={() => setReportDismissed(false)} />
        )}

        {hud.bossSiege && (hud.phase === "RUNNING" || hud.phase === "WAVE_TRANSITION") && (
          <div style={siegePillStyle} role="status" data-testid="siege-pill">
            <span style={{ ...siegeBarTrackStyle }}>
              <span style={{ ...siegeBarFillStyle, width: `${Math.round(hud.bossSiege.hpFraction * 100)}%` }} />
            </span>
            {t(hud.bossSiege.wavesUntilBoss > 0 ? "boss.siege" : "boss.siegeNow", {
              name: t(`bosses.${getMainBossForWave(hud.bossSiege.wave).i18nKey}.name` as TranslationKey),
              n: hud.bossSiege.wavesUntilBoss,
              pct: Math.round(hud.bossSiege.hpFraction * 100),
            })}
          </div>
        )}

        {tabPresence.summary && (
          <div style={tabSummaryStyle} role="status" data-testid="tab-summary">
            <span>
              {t("tab.summary", { time: formatDurationShort(tabPresence.summary.hiddenMs) })}{" "}
              <strong style={{ color: PALETTE.uiAccentBright }}>{t("tab.summaryWaves", { n: tabPresence.summary.waves })}</strong>
              {" · "}
              <strong style={{ color: PALETTE.gold }}>{t("tab.summaryGold", { n: tabPresence.summary.gold.toLocaleString(language === "ptBR" ? "pt-BR" : "en-US") })}</strong>
            </span>
            <button onClick={tabPresence.dismiss} style={tabSummaryCloseStyle} aria-label={t("missions.close")}>
              ×
            </button>
          </div>
        )}

        {offlineSummary && (
          <WelcomeBackOverlay
            summary={offlineSummary}
            gold={hud.gold}
            towers={engine.getRenderSnapshot().towers}
            onUpgrade={(towerId) => {
              engine.selectTower(towerId);
              engine.upgradeSelectedTower();
              engine.selectTower(null);
            }}
            onContinue={() => engine.dismissOfflineSummary()}
          />
        )}

        {bestiaryOpen && (
          <BestiaryPanel
            kills={engine.getBestiaryKills()}
            stats={engine.getAchievementStats()}
            unlocked={engine.getUnlockedAchievements()}
            title={hud.achievement.title}
            onEquipTitle={(id) => engine.equipTitle(id)}
            onClose={() => setBestiaryOpen(false)}
          />
        )}
        {talentsOpen && (
          <TalentPanel
            ranks={hud.talents.ranks}
            free={hud.talents.free}
            seasonBestWave={hud.seasonBestWave}
            onRaise={(id) => engine.raiseTalent(id)}
            onReset={() => engine.resetTalents()}
            onClose={() => setTalentsOpen(false)}
          />
        )}
        {riftOpen && (
          <RiftPanel
            charges={hud.rift.charges}
            armed={hud.rift.armed}
            active={hud.rift.active}
            onOpen={(mods) => engine.openRift(mods)}
            onCancel={() => engine.cancelRift()}
            onClose={() => setRiftOpen(false)}
          />
        )}
        {cityOpen && (
          <CityPanel seasonBestWave={hud.seasonBestWave} burning={hud.city.burning} goldShare={hud.city.goldShare} onClose={() => setCityOpen(false)} />
        )}

        {missionsOpen && (
          <DailyMissionsPanel missions={engine.getDailyMissions()} onClaim={(i) => engine.claimDailyMission(i)} onClose={() => setMissionsOpen(false)} />
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
            onRerollItem={(id) => engine.rerollItem(id)}
          />
        )}
      </div>

      <TowerPalette
        gold={hud.gold}
        pendingTowerType={pendingTowerType}
        onSelect={setPendingTowerType}
        mapFull={hud.towerCount + hud.deployBench.length >= MAX_TOWERS_ON_MAP}
        mapFullLabel={t("deploy.mapFull", { max: MAX_TOWERS_ON_MAP })}
        typeCounts={hud.towersByType}
        typeLimit={MAX_TOWERS_PER_TYPE}
        trailing={<SpecialsPanel engine={engine} hud={hud} />}
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

const siegePillStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "calc(100% - 24px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 14px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.danger}88`,
  background: "rgba(28,18,10,0.9)",
  color: PALETTE.uiText,
  fontSize: 12.5,
  fontWeight: 600,
  zIndex: 4,
  pointerEvents: "none",
};
const siegeBarTrackStyle: CSSProperties = { display: "inline-block", width: 70, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0 };
const siegeBarFillStyle: CSSProperties = { display: "block", height: "100%", background: PALETTE.danger };

const tabSummaryStyle: CSSProperties = {
  position: "absolute",
  top: 56,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "calc(100% - 24px)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px 9px 16px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(28,18,10,0.94)",
  boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
  color: PALETTE.uiText,
  fontSize: 13,
  zIndex: 6,
};

const tabSummaryCloseStyle: CSSProperties = { background: "none", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer", lineHeight: 1 };

const cityNoticeStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 7,
  padding: "8px 16px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.uiAccent}77`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.95), rgba(30,20,12,0.96))",
  color: PALETTE.uiAccentBright,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};
