import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import type { CreatureHandle } from "./creatureTypes";

const WARDEN_LEG_POSITIONS: [number, number][] = [
  [0.32, -0.6],
  [-0.32, -0.6],
  [0.32, 0.55],
  [-0.32, 0.55],
];

/**
 * WARDEN — elite/mini-boss scale showcase (requirement 5: "maior,
 * presença forte, aura/efeitos e barra de vida claramente
 * identificável"). Armored steel-blue silhouette (SHIELDBEARER's real
 * palette — distinct from Brute's red/orange so it never reads as "just
 * a bigger Brute"), a slow-rotating aura ring at its feet, and a floating
 * plate above its head standing in for a real HP bar (cosmetic fill only
 * — no real HP number, per requirement 13: no balance/economy wiring).
 */
export function WardenCreature({
  onReady,
  hp01 = 1,
}: {
  onReady?: (h: CreatureHandle) => void;
  hp01?: number;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const hpFillRef = useRef<THREE.Mesh>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.SHIELDBEARER;

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const stomp = t * 1.7;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.85 - Math.abs(Math.sin(stomp)) * 0.06;
    }
    if (auraRef.current) auraRef.current.rotation.z += dt * 0.6;
    if (hpFillRef.current) hpFillRef.current.scale.x = Math.max(0.001, hp01);
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 5);
      if (bodyRef.current) bodyRef.current.scale.setScalar(1 + hitT.current * 0.15);
    } else if (bodyRef.current) {
      bodyRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      ref={(g) => {
        if (g && onReady) onReady({ root: g, pulseHit: () => (hitT.current = 1) });
      }}
    >
      <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.75, 0.86, 24]} />
        <meshBasicMaterial color={c.accent} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.85, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.6, 8, 7]} />
          <meshStandardMaterial color={c.body} roughness={0.6} metalness={0.25} flatShading />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.16, 0.35, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <sphereGeometry args={[0.24, 7, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.6} metalness={0.3} flatShading />
        </mesh>
        <mesh position={[0.09, 0.75, -0.19]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[-0.09, 0.75, -0.19]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>

        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.58, 0.05, Math.sin((i / 5) * Math.PI * 2) * 0.58]} castShadow>
            <coneGeometry args={[0.08, 0.3, 4]} />
            <meshStandardMaterial color={c.dark} roughness={0.5} metalness={0.4} flatShading />
          </mesh>
        ))}

        {WARDEN_LEG_POSITIONS.map(([x, z], i) => (
          <mesh key={`leg-${i}`} position={[x, -0.65, z]} castShadow>
            <cylinderGeometry args={[0.13, 0.18, 0.5, 6]} />
            <meshStandardMaterial color={c.dark} roughness={0.7} metalness={0.2} flatShading />
          </mesh>
        ))}
      </group>

      <group position={[0, 2.05, 0]}>
        <mesh>
          <planeGeometry args={[0.9, 0.1]} />
          <meshBasicMaterial color={0x1a1006} transparent opacity={0.85} />
        </mesh>
        <mesh ref={hpFillRef} position={[-0.45 * (1 - hp01), 0, 0.001]}>
          <planeGeometry args={[0.86, 0.07]} />
          <meshBasicMaterial color={c.accent} />
        </mesh>
      </group>
    </group>
  );
}
