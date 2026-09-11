import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import type { CreatureHandle } from "./creatureTypes";

/**
 * WRAITH — the flying archetype (requirement 5: "movimento diferente e
 * sombra no chão"). A new concept for HORDENOVA (the 2D game has no
 * flying archetype yet — grounded in the real DISABLER interference-
 * violet palette rather than an invented color, per requirement 11's
 * "desenvolva uma linguagem própria" without inventing an ungrounded new
 * identity). Serpentine floating body, two membrane wings beating on a
 * slow arc (not a fast bird flap — reads as eerie/hovering rather than
 * bird-like), and casts a soft dark ellipse shadow on the ground that
 * tracks its XZ position independent of its flight height — the one
 * unambiguous "this thing is airborne" cue during actual gameplay.
 */
export function WraithCreature({
  onReady,
  onShadowReady,
}: {
  onReady?: (h: CreatureHandle) => void;
  onShadowReady?: (shadow: THREE.Mesh) => void;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const wingLRef = useRef<THREE.Mesh>(null);
  const wingRRef = useRef<THREE.Mesh>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.DISABLER;

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.95 + Math.sin(t * 1.6) * 0.14;
      bodyRef.current.rotation.z = Math.sin(t * 1.6) * 0.08;
    }
    const flap = Math.sin(t * 3.4) * 0.55;
    if (wingLRef.current) wingLRef.current.rotation.z = 0.3 + flap;
    if (wingRRef.current) wingRRef.current.rotation.z = -0.3 - flap;
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
        if (g && onReady) onReady({ root: g, pulseHit: () => (hitT.current = 1) });
      }}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        ref={(m) => m && onShadowReady && onShadowReady(m)}
      >
        <circleGeometry args={[0.32, 12]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.32} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.95, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.13, 0.4, 3, 6]} />
          <meshStandardMaterial color={c.body} roughness={0.5} emissive={c.dark} emissiveIntensity={0.3} flatShading />
        </mesh>
        <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.1, 0.22, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.5} flatShading />
        </mesh>
        <mesh position={[0.05, 0.03, -0.36]}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[-0.05, 0.03, -0.36]}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>

        <mesh ref={wingLRef} position={[0.14, 0.02, 0.05]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.42, 0.06, 3]} />
          <meshStandardMaterial color={c.dark} roughness={0.4} transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wingRRef} position={[-0.14, 0.02, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.42, 0.06, 3]} />
          <meshStandardMaterial color={c.dark} roughness={0.4} transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>

        <pointLight color={c.accent} intensity={0.5} distance={1.5} />
      </group>
    </group>
  );
}
