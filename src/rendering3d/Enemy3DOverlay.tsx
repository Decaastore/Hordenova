import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
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
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Canvas orthographic camera={{ near: 0.1, far: 4000 }} gl={{ alpha: true, antialias: true }} style={{ width: "100%", height: "100%", display: "block" }}>
        <CameraRig />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={[0xdfe8c8, 0x231a12, 0.5]} />
        <directionalLight position={[600, 1200, 800]} intensity={1.6} color={"#ffcf8a"} />
        <Enemy3DLayer engine={engine} hiddenIdsRef={hiddenIdsRef} />
      </Canvas>
    </div>
  );
}
