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
 * INFERNO — deliberately a DIFFERENT silhouette family from Ironwood: a
 * squat, wide obsidian brazier (not a tall slender frame) cradling a
 * floating molten core, with jagged fin-like rock shards instead of
 * prongs. Same "recognizable base shape, genuinely bigger structure when
 * evolved" contract: the evolved tier adds a full ring of secondary
 * flame vents and a taller, split core instead of one blob.
 */
export function InfernoTower({ position, evolved = false, onReady }: Props) {
  const coreRef = useRef<THREE.Mesh>(null);
  const flameLightRef = useRef<THREE.PointLight>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const attackT = useRef(0);
  const scale = evolved ? 1.3 : 1;
  const theme = TOWERS_3D.INFERNO;

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (coreRef.current) {
      coreRef.current.position.y = 1.15 * scale + Math.sin(t * 2.2) * 0.06;
      coreRef.current.rotation.y += dt * 0.8;
    }
    if (flameLightRef.current) flameLightRef.current.intensity = 1.1 + Math.sin(t * 8) * 0.25;
    if (attackT.current > 0) {
      attackT.current = Math.max(0, attackT.current - dt * 2.6);
      if (flashRef.current) flashRef.current.intensity = attackT.current * 7;
    } else if (flashRef.current) {
      flashRef.current.intensity = 0;
    }
  });

  return (
    <group
      position={position}
      scale={scale}
      ref={(g) => {
        if (g && onReady) onReady({ trigger: () => (attackT.current = 1), position: g.position });
      }}
    >
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.68, 0.8, 0.12, 10]} />
        <meshStandardMaterial color={"#1c1512"} roughness={1} />
      </mesh>

      {/* squat obsidian brazier bowl */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.56, 0.4, 0.55, 8]} />
        <meshStandardMaterial color={theme.secondary} roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <torusGeometry args={[0.52, 0.09, 6, 10]} />
        <meshStandardMaterial color={"#1c1512"} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* jagged fin shards around the bowl */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.cos((i / 4) * Math.PI * 2) * 0.5, 0.42, Math.sin((i / 4) * Math.PI * 2) * 0.5]}
          rotation={[0, -(i / 4) * Math.PI * 2, 0.15]}
          castShadow
        >
          <coneGeometry args={[0.1, 0.5, 4]} />
          <meshStandardMaterial color={theme.secondary} roughness={0.7} metalness={0.2} />
        </mesh>
      ))}
      {evolved &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={`vent-${i}`} position={[Math.cos((i / 6) * Math.PI * 2) * 0.66, 0.5, Math.sin((i / 6) * Math.PI * 2) * 0.66]}>
            <coneGeometry args={[0.045, 0.18, 4]} />
            <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={1.3} />
          </mesh>
        ))}

      <mesh ref={coreRef} position={[0, 1.15 * scale, 0]}>
        <icosahedronGeometry args={[evolved ? 0.3 : 0.22, 0]} />
        <meshStandardMaterial color={theme.accent} emissive={theme.primary} emissiveIntensity={1.8} roughness={0.3} flatShading />
      </mesh>
      {evolved && (
        <mesh position={[0, 1.5 * scale, 0]}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color={theme.accent} emissive={theme.primary} emissiveIntensity={1.6} flatShading />
        </mesh>
      )}

      <pointLight ref={flameLightRef} position={[0, 1.1 * scale, 0]} color={theme.primary} intensity={1.1} distance={3} />
      <pointLight ref={flashRef} position={[0, 1.1 * scale, 0]} color={theme.accent} intensity={0} distance={4.5} />
    </group>
  );
}
