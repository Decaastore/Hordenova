import { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import { WorldTerrain } from "./WorldTerrain";
import { TestTowerLayer, TestCastleLayer } from "./WorldGameplayTestLayer";
import { cameraPosition, computeScreenTransform } from "../enemyProjection";

/** Same manual orthographic-frustum rig as `rendering3d/Enemy3DOverlay.tsx`'s `CameraRig` — kept as its own small copy (not shared) so this layer and the enemy overlay stay independently mountable/removable while both use the identical tilt, matching camera math (`enemyProjection.ts` is the single source of truth for the numbers either rig uses). */
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.left = -size.width / 2;
    cam.right = size.width / 2;
    cam.top = size.height / 2;
    cam.bottom = -size.height / 2;
    cam.near = 0.1;
    cam.far = 4000;
    cam.position.set(...cameraPosition(1500));
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/**
 * Scales the whole terrain group by the real screen transform every
 * resize — the terrain geometry itself is built once in "local unscaled
 * ground" units (see worldTerrainGeometry.ts) and never rebuilt; only this
 * uniform scale changes, exactly mirroring how `Enemy3DLayer` scales each
 * creature instance. No position offset is needed (see
 * `enemyProjection.ts`'s `worldToLocalGround` doc comment for the identity
 * that makes the letterbox offset cancel out here).
 */
function ScaledWorld({
  biomeId,
  engine,
  hiddenTowerIdsRef,
}: {
  biomeId: string;
  engine: GameEngine;
  hiddenTowerIdsRef: React.RefObject<Set<string>>;
}) {
  const { size } = useThree();
  const transform = computeScreenTransform(size.width, size.height);
  return (
    <group scale={transform.scale}>
      <WorldTerrain biomeId={biomeId} />
      {/* MUNDO 3D — FASE 3 gameplay-integration test: mounted INSIDE this
          same scaled group (not a separate overlay) so the test tower/
          castle share the terrain's own directional light and cast/receive
          real shadow-mapped shadows onto the ground — see
          WorldGameplayTestLayer.tsx's own doc comment for why. */}
      <TestTowerLayer engine={engine} hiddenIdsRef={hiddenTowerIdsRef} />
      <TestCastleLayer />
    </group>
  );
}

/**
 * MUNDO 3D — FASE 1: a background terrain/atmosphere layer, purely
 * visual, mounted BEHIND the real 2D game canvas (see GameScreen.tsx: a
 * wrapper div with `zIndex:-1` places it under `CanvasRenderer`'s normal-
 * flow canvas regardless of DOM order — CSS stacking rule, not a hack).
 * Reads only `engine.getRenderSnapshot().biomeId`, never anything else,
 * and never calls back into gameplay. `pointerEvents:"none"` is set
 * explicitly on the Canvas element's own style (not just an ancestor div)
 * — the exact lesson learned from the enemy overlay: react-three-fiber
 * otherwise re-asserts "auto" on its own canvas, which would eat clicks
 * even though this layer already renders behind everything visually.
 */
export function WorldSceneOverlay({
  engine,
  hiddenTowerIdsRef,
}: {
  engine: GameEngine;
  /** MUNDO 3D — FASE 3: ids of towers currently covered by `TestTowerLayer`'s 3D body — written every frame, read by `CanvasRenderer`'s `hidden3DTowerIds` prop. Owned by the caller (GameScreen.tsx), same lifecycle as `hidden3DEnemyIdsRef`. */
  hiddenTowerIdsRef: React.RefObject<Set<string>>;
}) {
  const [biomeId, setBiomeId] = useState(() => engine.getRenderSnapshot().biomeId);

  useEffect(() => {
    // Biome only ever changes at a phase transition (rare) — a light poll
    // is plenty here, no need to hook into the 2D canvas's own per-frame
    // rAF loop for something this infrequent.
    const interval = setInterval(() => {
      const current = engine.getRenderSnapshot().biomeId;
      setBiomeId((prev) => (prev === current ? prev : current));
    }, 1000);
    return () => clearInterval(interval);
  }, [engine]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <Canvas
        shadows
        orthographic
        camera={{ near: 0.1, far: 4000 }}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      >
        <CameraRig />
        <ScaledWorld biomeId={biomeId} engine={engine} hiddenTowerIdsRef={hiddenTowerIdsRef} />
      </Canvas>
    </div>
  );
}
