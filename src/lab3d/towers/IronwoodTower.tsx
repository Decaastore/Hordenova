import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOWERS_3D } from "../palette";
import type { TowerHandle } from "./towerTypes";

interface Props {
  position: [number, number, number];
  evolved?: boolean;
  onReady?: (handle: TowerHandle) => void;
}

/**
 * IRONWOOD — the anchor/starter tower: weathered bark-and-iron frame with
 * a rune-green crystal core. `evolved` shows the SAME recognizable
 * silhouette (round platform -> tapering wooden frame -> crystal core)
 * scaled up with genuinely more structure (a second ring of banding, a
 * taller crystal cluster instead of one shard, hanging rune-chains) —
 * requirement 4's "a real evolution, not just bigger/recolored."
 */
export function IronwoodTower({ position, evolved = false, onReady }: Props) {
  const coreRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const attackT = useRef(0);
  const scale = evolved ? 1.28 : 1;

  useFrame((_, dt) => {
    if (coreRef.current) coreRef.current.rotation.y += dt * 0.35;
    if (crystalRef.current) {
      const bob = Math.sin(performance.now() * 0.0016) * 0.05;
      crystalRef.current.position.y = 1.55 * scale + bob;
    }
    if (attackT.current > 0) {
      attackT.current = Math.max(0, attackT.current - dt * 2.6);
      if (flashRef.current) flashRef.current.intensity = attackT.current * 6;
    } else if (flashRef.current) {
      flashRef.current.intensity = 0;
    }
  });

  const theme = TOWERS_3D.IRONWOOD;

  return (
    <group
      position={position}
      scale={scale}
      ref={(g) => {
        if (g && onReady) onReady({ trigger: () => (attackT.current = 1), position: g.position });
      }}
    >
      {/* base platform integrated into the terrain */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.74, 0.12, 10]} />
        <meshStandardMaterial color={theme.secondary} roughness={0.95} />
      </mesh>

      <group ref={coreRef}>
        {/* tapering wooden frame */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.5, 1.05, 8]} />
          <meshStandardMaterial color={theme.primary} roughness={0.85} />
        </mesh>
        {evolved && (
          <mesh position={[0, 1.05, 0]} castShadow>
            <torusGeometry args={[0.4, 0.06, 6, 12]} />
            <meshStandardMaterial color={theme.secondary} roughness={0.8} metalness={0.2} />
          </mesh>
        )}
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.32, 0.35, 8]} />
          <meshStandardMaterial color={theme.secondary} roughness={0.85} />
        </mesh>

        {/* prongs cradling the crystal */}
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i / 3) * Math.PI * 2) * 0.22, 1.45, Math.sin((i / 3) * Math.PI * 2) * 0.22]}
            rotation={[0.35, (i / 3) * Math.PI * 2, 0]}
            castShadow
          >
            <coneGeometry args={[0.05, 0.35, 4]} />
            <meshStandardMaterial color={theme.primary} roughness={0.7} />
          </mesh>
        ))}
      </group>

      <mesh ref={crystalRef} position={[0, 1.55 * scale, 0]}>
        <octahedronGeometry args={[evolved ? 0.24 : 0.17, 0]} />
        <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={1.4} roughness={0.2} />
      </mesh>
      {evolved && (
        <>
          <mesh position={[0.2, 1.75, 0.05]}>
            <octahedronGeometry args={[0.11, 0]} />
            <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[-0.17, 1.68, -0.1]}>
            <octahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={1.2} />
          </mesh>
        </>
      )}

      <pointLight position={[0, 1.55 * scale, 0]} color={theme.accent} intensity={0.9} distance={2.6} />
      <pointLight ref={flashRef} position={[0, 1.55 * scale, 0]} color={theme.accent} intensity={0} distance={4} />
    </group>
  );
}
