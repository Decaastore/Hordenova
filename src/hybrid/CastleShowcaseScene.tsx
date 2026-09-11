import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ModularCastle } from "./castle/ModularCastle";
import { castleHordenovaBaseSkin } from "./castle/skins/castleHordenovaBaseSkin";

function SlowSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.06;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * The default R3F camera (no explicit target) looks at the world origin,
 * i.e. GROUND level — with a symmetric vertical FOV that wastes half the
 * frame on empty ground below the castle and caps the visible ceiling at
 * roughly half the frame's vertical extent above y=0. The ward crystal
 * (y≈4.15, above the roof's own y≈3.76 finial tip) sat entirely above
 * that ceiling — invisible with no error, not occluded by geometry. This
 * rig explicitly aims at the castle's vertical midpoint instead.
 */
function CastleCameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(5.6, 4.6, 8.2);
    camera.lookAt(0, 2.0, 0.2);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

/**
 * PROVA DE CONCEITO — SKIN LAB. A separate, self-contained showcase for
 * the castle — its own camera/lighting/ground, NOT composited onto the
 * real 2D map crop the way the tower/creature are. This is a deliberate,
 * disclosed choice (see the final report): the real production castle's
 * true map coordinate sits far outside the small crop window the hybrid
 * demo uses for the tower/creature, so forcing it into that same crop
 * would mean inventing a fake position on the real map — presenting an
 * isolated "product shot" instead is honest about what is and isn't
 * being tested here (silhouette/scale/material/lighting/presence, not
 * "does it sit correctly at the real castle gate").
 */
export function CastleShowcaseScene() {
  return (
    <Canvas camera={{ fov: 38 }} gl={{ antialias: true }} style={{ position: "absolute", inset: 0 }}>
      <CastleCameraRig />
      <color attach="background" args={["#0a0c07"]} />
      <fog attach="fog" args={["#0a0c07", 9, 20]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={[0xdfe8c8, 0x140f0a, 0.6]} />
      <directionalLight position={[5, 8, 4]} intensity={2.1} color={"#ffd9a0"} />
      <directionalLight position={[-6, 3, -4]} intensity={0.45} color={"#7fa0ff"} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[7, 36]} />
        <meshStandardMaterial color={"#141910"} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[3.9, 32]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.4} />
      </mesh>

      <SlowSpin>
        <ModularCastle skin={castleHordenovaBaseSkin} />
      </SlowSpin>
    </Canvas>
  );
}
