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

const SHOULDER_BLADES: [number, number][] = [0, 1, 2, 3, 4, 5, 6].map((i) => [Math.cos((i / 7) * Math.PI * 2), Math.sin((i / 7) * Math.PI * 2)]);

/**
 * WARDEN — elite/mini-boss scale showcase (requirement: "maior, presença
 * forte, aura/efeitos e barra de vida claramente identificável"). Sized
 * up via `scale` (default 1.6 — genuinely towers over Brute/Runner, not
 * just a recolor) and redesigned around an angular, armor-plated
 * icosahedron torso instead of a smooth sphere, a horned war-helm instead
 * of a round head dome, and a full ring of backward-swept blade
 * shoulder-spikes — reads as a fortified war-beast, not a bigger blob.
 * Steel-blue SHIELDBEARER palette keeps it visually distinct from
 * Brute's red/orange at a glance. Aura ring + floating HP plate (fill
 * only, no real number) stay from the original design.
 */
export function WardenCreature({
  onReady,
  hp01 = 1,
  scale = 1.6,
}: {
  onReady?: (h: CreatureHandle) => void;
  hp01?: number;
  scale?: number;
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
      bodyRef.current.position.y = 0.85 * scale - Math.abs(Math.sin(stomp)) * 0.06 * scale;
    }
    if (auraRef.current) auraRef.current.rotation.z += dt * 0.6;
    if (hpFillRef.current) hpFillRef.current.scale.x = Math.max(0.001, hp01);
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 5);
      if (bodyRef.current) bodyRef.current.scale.setScalar(scale * (1 + hitT.current * 0.15));
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
      <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={scale}>
        <ringGeometry args={[0.75, 0.9, 28]} />
        <meshBasicMaterial color={c.accent} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.85 * scale, 0]}>
        {/* angular armor-plated torso */}
        <mesh scale={[1, 1.1, 0.92]} castShadow>
          <icosahedronGeometry args={[0.58, 1]} />
          <meshStandardMaterial color={c.body} roughness={0.5} metalness={0.35} flatShading />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.17, 0.35, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.5} metalness={0.4} />
        </mesh>

        {/* horned war-helm — replaces the round dome head */}
        <mesh position={[0, 0.74, 0]} castShadow>
          <coneGeometry args={[0.26, 0.44, 6]} />
          <meshStandardMaterial color={c.dark} roughness={0.5} metalness={0.45} flatShading />
        </mesh>
        <mesh position={[0.17, 0.85, -0.05]} rotation={[0.2, 0, -0.5]} castShadow>
          <coneGeometry args={[0.045, 0.4, 5]} />
          <meshStandardMaterial color={"#d8dce8"} roughness={0.35} metalness={0.5} flatShading />
        </mesh>
        <mesh position={[-0.17, 0.85, -0.05]} rotation={[0.2, 0, 0.5]} castShadow>
          <coneGeometry args={[0.045, 0.4, 5]} />
          <meshStandardMaterial color={"#d8dce8"} roughness={0.35} metalness={0.5} flatShading />
        </mesh>
        <mesh position={[0.1, 0.76, -0.22]}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.6} />
        </mesh>
        <mesh position={[-0.1, 0.76, -0.22]}>
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.6} />
        </mesh>

        {/* full ring of backward-swept blade shoulder-spikes */}
        {SHOULDER_BLADES.map(([bx, bz], i) => (
          <mesh key={i} position={[bx * 0.56, 0.12, bz * 0.56]} rotation={[0.5, -Math.atan2(bx, bz), 0]} castShadow>
            <coneGeometry args={[0.075, 0.42, 4]} />
            <meshStandardMaterial color={c.dark} roughness={0.45} metalness={0.5} flatShading />
          </mesh>
        ))}

        {WARDEN_LEG_POSITIONS.map(([x, z], i) => (
          <mesh key={`leg-${i}`} position={[x, -0.65, z]} castShadow>
            <cylinderGeometry args={[0.13, 0.19, 0.5, 6]} />
            <meshStandardMaterial color={c.dark} roughness={0.6} metalness={0.35} flatShading />
          </mesh>
        ))}
      </group>

      <group position={[0, 2.05 * scale, 0]}>
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
