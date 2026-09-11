import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOWERS_3D, FOREST } from "../palette";
import { buildTaperedTube, buildJaggedPlateShape } from "../geometryUtils";
import { getWoodTexture, getCrackTexture } from "../proceduralTextures";
import { mulberry32 } from "../rng";
import type { TowerHandle } from "./towerTypes";

interface Props {
  position: [number, number, number];
  evolved?: boolean;
  onReady?: (handle: TowerHandle) => void;
}

const TRUNK_POINTS = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.55, 0.01), new THREE.Vector3(-0.01, 1.05, 0), new THREE.Vector3(0, 1.32, -0.01)];
const TRUNK_RADII = [0.42, 0.32, 0.22, 0.17];

/**
 * IRONWOOD — the anchor/starter tower: a real weathered trunk (lofted,
 * subtly gnarled — not a straight cylinder) rising out of a broken-rock
 * skirt embedded in the ground, twisted iron-and-root prongs cradling a
 * cracked rune-crystal core. `evolved` keeps the same recognizable
 * silhouette while genuinely adding structure (a second banded ring,
 * more crystal shards, longer hanging chains).
 */
export function IronwoodTower({ position, evolved = false, onReady }: Props) {
  const coreRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const chargeRef = useRef<THREE.PointLight>(null);
  const attackT = useRef(0);
  const chargeT = useRef(0);
  const scale = evolved ? 1.28 : 1;
  const theme = TOWERS_3D.IRONWOOD;

  const trunkGeo = useMemo(() => buildTaperedTube(TRUNK_POINTS, TRUNK_RADII, 8), []);
  const woodTex = useMemo(() => getWoodTexture(theme.primary, theme.secondary), [theme.primary, theme.secondary]);
  const crackTex = useMemo(() => getCrackTexture(theme.accent), [theme.accent]);
  const rockSkirtGeo = useMemo(() => {
    const rand = mulberry32(5);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.72, 8, rand), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, []);
  const prongGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.16, 0.02), new THREE.Vector3(0.02, 0.32, -0.01)],
        [0.045, 0.03, 0.006],
        6,
      ),
    [],
  );

  useFrame((_, dt) => {
    if (coreRef.current) coreRef.current.rotation.y += dt * 0.35;
    if (crystalRef.current) {
      const bob = Math.sin(performance.now() * 0.0016) * 0.05;
      crystalRef.current.position.y = 1.55 * scale + bob + (attackT.current > 0.6 ? -0.05 : 0);
      const chargeScale = 1 + chargeT.current * 0.35;
      crystalRef.current.scale.setScalar(chargeScale);
    }
    if (chargeT.current > 0) {
      chargeT.current = Math.max(0, chargeT.current - dt * 2.2);
      if (chargeRef.current) chargeRef.current.intensity = chargeT.current * 2.4;
    } else if (chargeRef.current) {
      chargeRef.current.intensity = 0;
    }
    if (attackT.current > 0) {
      attackT.current = Math.max(0, attackT.current - dt * 2.6);
      if (flashRef.current) flashRef.current.intensity = attackT.current * 6;
    } else if (flashRef.current) {
      flashRef.current.intensity = 0;
    }
  });

  return (
    <group
      position={position}
      scale={scale}
      ref={(g) => {
        if (g && onReady)
          onReady({
            anticipate: () => (chargeT.current = 1),
            trigger: () => (attackT.current = 1),
            position: g.position,
          });
      }}
    >
      {/* broken-rock skirt, embedded into the terrain rather than a clean cylinder platform */}
      <mesh geometry={rockSkirtGeo} rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.02, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={FOREST.rockDark} roughness={0.95} flatShading />
      </mesh>

      <group ref={coreRef}>
        <mesh geometry={trunkGeo} position={[0, 0.1, 0]} castShadow>
          <meshStandardMaterial map={woodTex} color={0xffffff} roughness={0.88} />
        </mesh>
        {evolved && (
          <mesh position={[0, 1.05, 0]} castShadow>
            <torusGeometry args={[0.24, 0.045, 6, 12]} />
            <meshStandardMaterial color={theme.secondary} roughness={0.7} metalness={0.25} />
          </mesh>
        )}

        {/* twisted prongs cradling the crystal — curved loft, not straight cones */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={prongGeo} position={[Math.cos((i / 3) * Math.PI * 2) * 0.16, 1.28, Math.sin((i / 3) * Math.PI * 2) * 0.16]} rotation={[0, (i / 3) * Math.PI * 2, 0]} castShadow>
            <meshStandardMaterial color={theme.secondary} roughness={0.55} metalness={0.3} />
          </mesh>
        ))}
      </group>

      <mesh ref={crystalRef} position={[0, 1.55 * scale, 0]}>
        <icosahedronGeometry args={[evolved ? 0.24 : 0.17, 1]} />
        <meshStandardMaterial color={"#0c1410"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={2.2} roughness={0.3} metalness={0.1} />
      </mesh>
      {evolved && (
        <>
          <mesh position={[0.2, 1.75, 0.05]}>
            <icosahedronGeometry args={[0.11, 0]} />
            <meshStandardMaterial color={"#0c1410"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={2} flatShading />
          </mesh>
          <mesh position={[-0.17, 1.68, -0.1]}>
            <icosahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color={"#0c1410"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={2} flatShading />
          </mesh>
        </>
      )}

      <pointLight position={[0, 1.55 * scale, 0]} color={theme.accent} intensity={0.8} distance={2.4} />
      <pointLight ref={chargeRef} position={[0, 1.55 * scale, 0]} color={theme.accent} intensity={0} distance={2.8} />
      <pointLight ref={flashRef} position={[0, 1.55 * scale, 0]} color={theme.accent} intensity={0} distance={4} />
    </group>
  );
}
