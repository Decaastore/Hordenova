import { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import { getBiome } from "@/rendering/biomes";
import { Enemy3DLayer } from "./Enemy3DLayer";
import { cameraPosition } from "./enemyProjection";

/**
 * Same rig technique as `src/hybrid/HybridScene3D.tsx`'s CameraRig: manual
 * orthographic frustum sized to the canvas's own CSS-pixel size (so 1
 * Three unit = 1 CSS pixel at the ground plane, matching enemyProjection's
 * math), recomputed whenever the canvas resizes (r3f's `size` already
 * tracks the parent container via ResizeObserver, same signal
 * CanvasRenderer's own resize() uses).
 */
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
 * INIMIGOS 3D — a transparent overlay stacked exactly on top of the real
 * 2D game canvas (see screens/GameScreen.tsx for where this mounts).
 * Purely visual: reads `engine.getRenderSnapshot()` itself every frame
 * (via `BruteEnemyLayer`) and never calls back into gameplay. Only
 * reached through a lazy `import()` gated on `isWebGLAvailable()` (see
 * GameScreen.tsx) — the browser never even downloads three.js/r3f unless
 * this actually mounts, so the main game bundle is unaffected either way.
 */
export function Enemy3DOverlay({ engine, hiddenIdsRef }: { engine: GameEngine; hiddenIdsRef: React.RefObject<Set<string>> }) {
  // MUNDO 3D — FASE 3: this overlay is a SEPARATE Canvas/scene from
  // `rendering3d/world/WorldSceneOverlay.tsx` (structurally can't share
  // shadows/lighting with it without merging the two — see
  // WorldGameplayTestLayer.tsx's doc comment for why that's out of scope
  // this phase), but it CAN match the world layer's own key-light color
  // (same `biome.palette.accentWarm` WorldTerrain.tsx uses) instead of a
  // hardcoded warm tone — so a 3D enemy walking across the 3D terrain at
  // least reads as lit by the same "sun," even though the shadow itself is
  // still the fake contact-shadow texture, not a real cast shadow.
  const [keyLightColor, setKeyLightColor] = useState(() => getBiome(engine.getRenderSnapshot().biomeId).palette.accentWarm);
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getBiome(engine.getRenderSnapshot().biomeId).palette.accentWarm;
      setKeyLightColor((prev) => (prev === current ? prev : current));
    }, 1000);
    return () => clearInterval(interval);
  }, [engine]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Canvas
        orthographic
        camera={{ near: 0.1, far: 4000 }}
        gl={{ alpha: true, antialias: true }}
        // react-three-fiber sets its own canvas element's pointer-events to
        // "auto" by default (for its internal raycasting), which OVERRIDES
        // the inherited "none" from the wrapping div above — this canvas
        // sits on top of the real 2D game canvas in paint order, so without
        // this explicit override it silently ate every click on the map
        // (towers became unselectable). Forcing it here, on the actual
        // canvas element r3f renders, is what actually takes the 3D layer
        // out of the input chain — the wrapping div's pointer-events:none
        // alone was not enough.
        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      >
        <CameraRig />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={[0xdfe8c8, 0x231a12, 0.5]} />
        <directionalLight position={[600, 1200, 800]} intensity={1.6} color={keyLightColor} />
        <Enemy3DLayer engine={engine} hiddenIdsRef={hiddenIdsRef} />
      </Canvas>
    </div>
  );
}
