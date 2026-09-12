import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { getFortressAnchor } from "@/rendering/MapRenderer";
import { ModularIronwoodTower } from "@/hybrid/towers/ModularIronwoodTower";
import { ironwoodBaseSkin } from "@/hybrid/towers/skins/ironwoodBaseSkin";
import { ModularCastle } from "@/hybrid/castle/ModularCastle";
import { castleHordenovaBaseSkin } from "@/hybrid/castle/skins/castleHordenovaBaseSkin";
import type { TowerHandle } from "@/lab3d/towers/towerTypes";
import { getContactShadowTexture } from "../contactShadowTexture";
import { worldToLocalGround, worldDirectionToThreeYaw } from "../enemyProjection";
import { terrainElevationAt } from "./worldTerrainGeometry";

/**
 * MUNDO 3D — FASE 3: a CONTROLLED integration test, not a rollout. Exactly
 * one tower TYPE (IRONWOOD) and the castle get a real 3D body here, both
 * reusing the already-built `src/hybrid/` lab components (no new geometry
 * authored) — the question this file exists to answer is purely "does
 * reusing worldToLocalGround/terrainElevationAt (the SAME math the terrain
 * itself is built from) make a gameplay object look like it belongs to
 * this ground," not "build the final tower/castle art."
 *
 * Both components below are mounted as children of `WorldSceneOverlay`'s
 * already-scaled world group (see WorldSceneOverlay.tsx's `ScaledWorld`) —
 * that's what lets them share the terrain's real directional light and
 * cast/receive real shadow-mapped shadows onto the ground, something the
 * FRONT enemy overlay (a separate Canvas/scene) structurally cannot do.
 * Positions are computed in the SAME "local unscaled ground" space
 * `worldTerrainGeometry.ts` builds the ground/road in — no independent
 * projection math, no independent castle position.
 */

// Calibrated against each 2D sprite's own visual footprint (same spirit as
// creatureRegistry.ts's worldHeight/localHeight ratios) — not a measured
// asset spec, since neither hybrid-lab component ships one.
const TOWER_WORLD_HEIGHT = 58;
const TOWER_LOCAL_HEIGHT = 1.6; // ModularIronwoodTower's own approx max vertical extent (crystal apex, base-skin drum/spire variant)
const TOWER_SHADOW_RADIUS = 11;

// Calibrated by FOOTPRINT RADIUS, not height: ModularCastle's own
// `foundationGeo` has local radius 3.5, and the model's height (4.15) is
// close enough to that radius that calibrating by height alone made the
// foundation ~286 world units wide (nearly a third of the map) the first
// time this was tried — caught by live visual verification, not a spec.
// Targeting a footprint comparable to the 2D fortress's own visual width
// (`drawFortress`'s local geometry, ~120 units across) keeps the 3D body
// from dwarfing the map.
const CASTLE_LOCAL_RADIUS = 3.5;
const CASTLE_TARGET_RADIUS = 62;
const CASTLE_SCALE = CASTLE_TARGET_RADIUS / CASTLE_LOCAL_RADIUS;
const CASTLE_SHADOW_RADIUS = 30;

/**
 * Tracks the FIRST placed IRONWOOD tower each frame — single source of
 * truth is `engine.getRenderSnapshot().towers`, never a second entity.
 * Writes the tracked id into `hiddenIdsRef` so `CanvasRenderer` skips that
 * ONE tower's 2D sprite (see its `hidden3DTowerIds` prop) — everything
 * else (selection, range circle, upgrade, targeting, attack, gold cost)
 * keeps flowing through the real engine/2D renderer untouched.
 */
export function TestTowerLayer({ engine, hiddenIdsRef }: { engine: GameEngine; hiddenIdsRef: React.RefObject<Set<string>> }) {
  const anchorRef = useRef<THREE.Group>(null);
  const handleRef = useRef<TowerHandle | null>(null);
  const trackedIdRef = useRef<string | null>(null);
  const prevCooldownRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useFrame(() => {
    const snapshot = engine.getRenderSnapshot();
    const tower = snapshot.towers.find((t) => t.type === "IRONWOOD");

    const hidden = hiddenIdsRef.current;
    if (hidden) {
      hidden.clear();
      if (tower) hidden.add(tower.id);
    }

    if (!tower) {
      trackedIdRef.current = null;
      if (mounted) setMounted(false);
      return;
    }
    if (trackedIdRef.current !== tower.id) {
      trackedIdRef.current = tower.id;
      prevCooldownRef.current = tower.cooldownRemainingMs;
    }
    if (!mounted) setMounted(true);

    const [lx, , lz] = worldToLocalGround(tower.position);
    const elevation = terrainElevationAt(tower.position.x, tower.position.y);
    anchorRef.current?.position.set(lx, elevation, lz);

    // Attack-fired detection mirrors CanvasRenderer.tsx's own (a cooldown
    // jump only ever happens right after a shot resets it) — computed
    // independently here, read-only, no shared mutable state with it.
    const prevCooldown = prevCooldownRef.current;
    if (prevCooldown !== null && tower.cooldownRemainingMs > prevCooldown + 50) {
      handleRef.current?.trigger();
    }
    prevCooldownRef.current = tower.cooldownRemainingMs;
  });

  const shadowTexture = getContactShadowTexture();
  if (!mounted) return null;

  return (
    <group ref={anchorRef}>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]}>
        <circleGeometry args={[TOWER_SHADOW_RADIUS, 24]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
      <group scale={TOWER_WORLD_HEIGHT / TOWER_LOCAL_HEIGHT}>
        <ModularIronwoodTower position={[0, 0, 0]} skin={ironwoodBaseSkin} onReady={(h) => (handleRef.current = h)} />
      </group>
    </group>
  );
}

/**
 * Static (the fortress never moves) — position/orientation computed ONCE
 * from `getFortressAnchor(ENEMY_PATH)`, the exact same anchor
 * `MapRenderer.drawPathEndpoints` uses for the 2D fortress, so the two
 * representations can never drift apart. `CanvasRenderer` is told to skip
 * drawing the fortress's 2D BODY only (via `worldLayerOn` -> `drawPathEndpoints`'s
 * `skipCastleBody`) — the HP-tier damage overlay (cracks/smoke/fire) still
 * draws in 2D on top of this 3D body every frame, since Castle HP is real
 * gameplay state this test does not reproduce in 3D.
 */
export function TestCastleLayer() {
  const anchor = useMemo(() => {
    const { position, facingDir } = getFortressAnchor(ENEMY_PATH);
    const [lx, , lz] = worldToLocalGround(position);
    const elevation = terrainElevationAt(position.x, position.y);
    return { position: [lx, elevation, lz] as [number, number, number], yaw: worldDirectionToThreeYaw(facingDir) };
  }, []);

  const shadowTexture = getContactShadowTexture();

  return (
    <group position={anchor.position} rotation={[0, anchor.yaw, 0]}>
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}>
        <circleGeometry args={[CASTLE_SHADOW_RADIUS, 28]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={0.85} />
      </mesh>
      <group scale={CASTLE_SCALE}>
        <ModularCastle skin={castleHordenovaBaseSkin} />
      </group>
    </group>
  );
}
