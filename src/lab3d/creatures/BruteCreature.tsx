import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import type { CreatureHandle } from "./creatureTypes";

const BRUTE_LEG_POSITIONS: [number, number][] = [
  [0.22, -0.16],
  [-0.22, -0.16],
  [0.22, 0.16],
  [-0.22, 0.16],
];

const SPIKE_POSITIONS: [number, number, number][] = [
  [0.22, 0.38, -0.05],
  [-0.22, 0.38, -0.05],
  [0.32, 0.22, 0.1],
  [-0.32, 0.22, 0.1],
];

/**
 * BRUTE — "big, slow, resistant, heavy animation," redesigned to read as
 * a genuine threat rather than a round plush toy: an angular, plated
 * boulder-hide torso (icosahedron, not a smooth sphere) bristling with
 * bone/rock spikes, a low wedge-shaped skull with jutting tusks instead
 * of a round head, and a jagged war-club arm. The stomp displaces the
 * whole body, not just the legs, so "heavy" reads even from a distance.
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
      bodyRef.current.position.y = 0.5 * scale - Math.abs(Math.sin(stomp)) * 0.1 * scale;
      bodyRef.current.rotation.z = Math.sin(stomp) * 0.07;
    }
    if (armRef.current) armRef.current.rotation.x = Math.sin(stomp + 1) * 0.4;
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 5);
      if (bodyRef.current) bodyRef.current.scale.setScalar(scale * (1 + hitT.current * 0.2));
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
      <group ref={bodyRef} position={[0, 0.5 * scale, 0]} rotation={[0.2, 0, 0]}>
        {/* angular boulder-plated torso — flat-shaded icosahedron reads as
            jagged rock/hide, not a round toy */}
        <mesh scale={[1, 1.18, 0.88]} castShadow>
          <icosahedronGeometry args={[0.44 * scale, 0]} />
          <meshStandardMaterial color={c.body} roughness={0.75} metalness={0.08} flatShading />
        </mesh>

        {SPIKE_POSITIONS.map(([sx, sy, sz], i) => (
          <mesh key={i} position={[sx * scale, sy * scale, sz * scale]} rotation={[0.3, 0, sx > 0 ? -0.4 : 0.4]} castShadow>
            <coneGeometry args={[0.08 * scale, 0.34 * scale, 5]} />
            <meshStandardMaterial color={c.dark} roughness={0.6} flatShading />
          </mesh>
        ))}

        {/* low wedge skull with tusks — replaces the round head */}
        <mesh position={[0, 0.3 * scale, -0.32 * scale]} rotation={[0.35, 0, 0]} castShadow>
          <coneGeometry args={[0.22 * scale, 0.42 * scale, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0.1 * scale, 0.18 * scale, -0.46 * scale]} rotation={[1.6, 0, 0.5]} castShadow>
          <coneGeometry args={[0.03 * scale, 0.22 * scale, 4]} />
          <meshStandardMaterial color={"#e8dcc0"} roughness={0.4} flatShading />
        </mesh>
        <mesh position={[-0.1 * scale, 0.18 * scale, -0.46 * scale]} rotation={[1.6, 0, -0.5]} castShadow>
          <coneGeometry args={[0.03 * scale, 0.22 * scale, 4]} />
          <meshStandardMaterial color={"#e8dcc0"} roughness={0.4} flatShading />
        </mesh>
        <mesh position={[0.07 * scale, 0.32 * scale, -0.48 * scale]}>
          <sphereGeometry args={[0.035 * scale, 5, 5]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[-0.07 * scale, 0.32 * scale, -0.48 * scale]}>
          <sphereGeometry args={[0.035 * scale, 5, 5]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.4} />
        </mesh>

        <group ref={armRef} position={[0.4 * scale, 0.1 * scale, 0]}>
          <mesh position={[0.15 * scale, -0.1 * scale, 0]} rotation={[0, 0, 0.15]} castShadow>
            <cylinderGeometry args={[0.08 * scale, 0.15 * scale, 0.5 * scale, 6]} />
            <meshStandardMaterial color={c.body} roughness={0.75} flatShading />
          </mesh>
          <mesh position={[0.24 * scale, -0.38 * scale, 0]} castShadow>
            <icosahedronGeometry args={[0.19 * scale, 0]} />
            <meshStandardMaterial color={c.dark} roughness={0.7} flatShading />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[0.24 * scale + Math.cos(i * 2.1) * 0.14 * scale, -0.38 * scale + Math.sin(i * 2.1) * 0.14 * scale, 0.08 * scale]}
              rotation={[1.5, 0, i]}
              castShadow
            >
              <coneGeometry args={[0.04 * scale, 0.2 * scale, 4]} />
              <meshStandardMaterial color={c.dark} roughness={0.6} flatShading />
            </mesh>
          ))}
        </group>
        <mesh position={[-0.35 * scale, 0.05 * scale, 0]} rotation={[0, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.07 * scale, 0.12 * scale, 0.4 * scale, 6]} />
          <meshStandardMaterial color={c.body} roughness={0.75} flatShading />
        </mesh>
      </group>

      {BRUTE_LEG_POSITIONS.map(([x, z], i) => (
        <mesh key={i} position={[x * scale, 0.17 * scale, z * scale]} castShadow>
          <cylinderGeometry args={[0.09 * scale, 0.14 * scale, 0.34 * scale, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}
