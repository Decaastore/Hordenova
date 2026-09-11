import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import type { CreatureHandle } from "./creatureTypes";

const BRUTE_LEG_POSITIONS: [number, number][] = [
  [0.2, -0.15],
  [-0.2, -0.15],
  [0.2, 0.15],
  [-0.2, 0.15],
];

/**
 * BRUTE — "big, slow, resistant, heavy animation." A hunched barrel
 * torso leaning forward on thick stump legs, one oversized club-arm, a
 * small sunken head — the opposite silhouette language from Runner (wide
 * and low vs. tall and squat here, slow heavy stomp instead of a quick
 * skitter). The stomp itself visibly displaces the whole body, not just
 * the legs, so "heavy" reads even from a distance.
 */
export function BruteCreature({ onReady, scale = 1 }: { onReady?: (h: CreatureHandle) => void; scale?: number }) {
  const bodyRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.BRUTE;

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const stomp = t * 3.2;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.5 * scale - Math.abs(Math.sin(stomp)) * 0.09 * scale;
      bodyRef.current.rotation.z = Math.sin(stomp) * 0.06;
    }
    if (armRef.current) armRef.current.rotation.x = Math.sin(stomp + 1) * 0.35;
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 5);
      if (bodyRef.current) bodyRef.current.scale.setScalar(scale * (1 + hitT.current * 0.18));
    } else if (bodyRef.current) {
      bodyRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group
      ref={(g) => {
        if (g && onReady) onReady({ root: g, pulseHit: () => (hitT.current = 1) });
      }}
    >
      <group ref={bodyRef} position={[0, 0.5 * scale, 0]} rotation={[0.18, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42 * scale, 8, 6]} />
          <meshStandardMaterial color={c.body} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 0.32 * scale, -0.25 * scale]} castShadow>
          <sphereGeometry args={[0.2 * scale, 7, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0.06 * scale, 0.34 * scale, -0.4 * scale]}>
          <sphereGeometry args={[0.035 * scale, 5, 5]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={1.8} />
        </mesh>
        <mesh position={[-0.06 * scale, 0.34 * scale, -0.4 * scale]}>
          <sphereGeometry args={[0.035 * scale, 5, 5]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={1.8} />
        </mesh>

        <group ref={armRef} position={[0.4 * scale, 0.1 * scale, 0]}>
          <mesh position={[0.15 * scale, -0.1 * scale, 0]} castShadow>
            <cylinderGeometry args={[0.09 * scale, 0.15 * scale, 0.5 * scale, 6]} />
            <meshStandardMaterial color={c.body} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0.2 * scale, -0.35 * scale, 0]} castShadow>
            <icosahedronGeometry args={[0.16 * scale, 0]} />
            <meshStandardMaterial color={c.dark} roughness={0.9} flatShading />
          </mesh>
        </group>
        <mesh position={[-0.35 * scale, 0.05 * scale, 0]} castShadow>
          <cylinderGeometry args={[0.08 * scale, 0.12 * scale, 0.4 * scale, 6]} />
          <meshStandardMaterial color={c.body} roughness={0.85} flatShading />
        </mesh>
      </group>

      {BRUTE_LEG_POSITIONS.map(([x, z], i) => (
        <mesh key={i} position={[x * scale, 0.17 * scale, z * scale]} castShadow>
          <cylinderGeometry args={[0.09 * scale, 0.13 * scale, 0.34 * scale, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
