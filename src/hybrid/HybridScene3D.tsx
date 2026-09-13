import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HybridDemoController } from "./HybridDemoController";
import { cameraPosition } from "./hybridProjection";
import type { TowerSkinDefinition } from "./towers/towerSkinTypes";

/**
 * PROVA DE CONCEITO HÍBRIDA — the 3D half. A transparent, absolutely-
 * positioned react-three-fiber canvas stacked exactly on top of the real
 * 2D map render (`Hybrid2DBackground`). Orthographic camera, tilted just
 * enough to give the Brute/tower real form (see hybridProjection.ts for
 * why this keeps ground positions aligned with the 2D layer beneath it).
 *
 * Contact shadows (soft dark ellipses under the creature/tower, not a
 * real-time shadow map) are what make them read as physically standing
 * on the map — a `THREE.ShadowMaterial` + shadow-mapped directional
 * light was tried first and broke rendering entirely under this
 * environment's SwiftShader software WebGL; a flat contact-shadow mesh
 * is the same trick the real 2D `EntityRenderer.drawContactShadow`
 * already uses elsewhere in this game, and is far more robust here.
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
    cam.far = 1000;
    cam.position.set(...cameraPosition(60));
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export function HybridScene3D({ towerSkin }: { towerSkin?: TowerSkinDefinition }) {
  return (
    <Canvas
      orthographic
      camera={{ near: 0.1, far: 1000 }}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig />

      {/* EXPOSURE PASS — raised ambient/hemisphere + a fill light opposite
          the key so the tower's shaft/base and the creature's far side
          read as dark-but-visible toon bands instead of solid black. */}
      {/* EXPOSURE PASS — this canvas is composited (alpha:true) over a
          SEPARATE 2D background canvas, so it has no shared terrain/ground
          to wash out: ambient/hemisphere here only ever lights the tower
          and creature. Their base materials (rockDark stone, near-black
          wood/hide tones) turned out to need a much larger push than a
          "normal" scene to lift out of the toon gradient's bottom band —
          verified empirically by comparing 1.1/0.8 (still solid black),
          3/2 (barely visible) and 20/10 (clearly readable) side by side. */}
      <ambientLight intensity={14} />
      <hemisphereLight args={[0xdfe8c8, 0x5a5048, 8]} />
      <directionalLight position={[40, 90, 55]} intensity={1.6} color={"#ffcf8a"} />
      <directionalLight position={[-35, 60, -45]} intensity={1.1} color={"#7fa0ff"} />

      <HybridDemoController towerSkin={towerSkin} />
    </Canvas>
  );
}
