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
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig />

      <ambientLight intensity={0.75} />
      <hemisphereLight args={[0xdfe8c8, 0x231a12, 0.5]} />
      <directionalLight position={[40, 90, 55]} intensity={1.6} color={"#ffcf8a"} />

      <HybridDemoController towerSkin={towerSkin} />
    </Canvas>
  );
}
