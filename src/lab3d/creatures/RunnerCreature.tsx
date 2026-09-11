import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import type { CreatureHandle } from "./creatureTypes";

/**
 * RUNNER — "small, fast, aggressive, agile." Low, sleek wedge-shaped
 * body close to the ground, long thin legs in a fast alternating gait,
 * a forward-jutting head with two sharp eye-glints. The whole silhouette
 * reads as low and quick, distinct from a slow/heavy shape at a glance.
 */
const LEG_POSITIONS: [number, number][] = [
  [0.12, -0.15],
  [-0.12, -0.15],
  [0.12, 0.05],
  [-0.12, 0.05],
];

export function RunnerCreature({ onReady }: { onReady?: (h: CreatureHandle) => void }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const legsRef = useRef<THREE.Group[]>([]);
  const bodyRef = useRef<THREE.Group | null>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.RUNNER;

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const gait = t * 14;
    legsRef.current.forEach((leg, i) => {
      if (!leg) return;
      const phase = gait + (i % 2 === 0 ? 0 : Math.PI);
      leg.rotation.x = Math.sin(phase) * 0.9;
    });
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.24 + Math.abs(Math.sin(gait)) * 0.05;
      bodyRef.current.rotation.z = Math.sin(gait) * 0.05;
    }
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 6);
      if (bodyRef.current) bodyRef.current.scale.setScalar(1 + hitT.current * 0.25);
    } else if (bodyRef.current) {
      bodyRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (g && onReady) onReady({ root: g, pulseHit: () => (hitT.current = 1) });
      }}
    >
      <group ref={bodyRef} position={[0, 0.24, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.16, 0.5, 5]} />
          <meshStandardMaterial color={c.body} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.1, 0.28, 5]} />
          <meshStandardMaterial color={c.dark} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0.06, 0.03, -0.44]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2} />
        </mesh>
        <mesh position={[-0.06, 0.03, -0.44]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2} />
        </mesh>
        <mesh position={[0, 0.05, 0.34]} rotation={[0.5, 0, 0]} castShadow>
          <coneGeometry args={[0.05, 0.3, 4]} />
          <meshStandardMaterial color={c.dark} roughness={0.7} flatShading />
        </mesh>
      </group>

      {LEG_POSITIONS.map(([x, z], i) => (
        <group key={i} position={[x, 0.22, z]} ref={(g) => g && (legsRef.current[i] = g)}>
          <mesh position={[0, -0.09, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.02, 0.2, 4]} />
            <meshStandardMaterial color={c.dark} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
