import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TOWERS_3D, FOREST } from "../palette";
import { buildJaggedPlateShape } from "../geometryUtils";
import { getCrackTexture, getStoneTexture } from "../proceduralTextures";
import { mulberry32 } from "../rng";
import type { TowerHandle } from "./towerTypes";

interface Props {
  position: [number, number, number];
  evolved?: boolean;
  onReady?: (handle: TowerHandle) => void;
}

const BOWL_PROFILE = [
  new THREE.Vector2(0.02, 0),
  new THREE.Vector2(0.58, 0.05),
  new THREE.Vector2(0.5, 0.32),
  new THREE.Vector2(0.34, 0.52),
  new THREE.Vector2(0.42, 0.6),
  new THREE.Vector2(0.22, 0.66),
];

/**
 * INFERNO — a different silhouette family from Ironwood: a squat lofted
 * obsidian bowl (not a cylinder-plus-torus) embedded in a scorched rock
 * skirt, ringed by irregular jagged fin-shards of varying size (never a
 * regular polygon repeated), cradling a faceted crystal core whose
 * emissive map reads as glowing lava veins rather than a flat lit blob.
 */
export function InfernoTower({ position, evolved = false, onReady }: Props) {
  const coreRef = useRef<THREE.Mesh>(null);
  const flameLightRef = useRef<THREE.PointLight>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const chargeRef = useRef<THREE.PointLight>(null);
  const attackT = useRef(0);
  const chargeT = useRef(0);
  const scale = evolved ? 1.3 : 1;
  const theme = TOWERS_3D.INFERNO;

  const bowlGeo = useMemo(() => new THREE.LatheGeometry(BOWL_PROFILE, 12), []);
  const obsidianTex = useMemo(() => getStoneTexture(0x241a16, 0x0c0806), []);
  const crackTex = useMemo(() => getCrackTexture(theme.accent), [theme.accent]);
  const rockSkirtGeo = useMemo(() => {
    const rand = mulberry32(9);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.78, 8, rand), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, []);
  const finGeos = useMemo(() => {
    const seeds = [21, 34, 47, 58];
    return seeds.map((seed) => {
      const rand = mulberry32(seed);
      return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.14 + rand() * 0.08, 5, rand), { depth: 0.03, bevelEnabled: false });
    });
  }, []);
  const ventGeo = useMemo(() => new THREE.ConeGeometry(0.045, 0.18, 4), []);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (coreRef.current) {
      coreRef.current.position.y = 1.15 * scale + Math.sin(t * 2.2) * 0.06;
      coreRef.current.rotation.y += dt * 0.8;
      coreRef.current.scale.setScalar(1 + chargeT.current * 0.3);
    }
    if (flameLightRef.current) flameLightRef.current.intensity = 1.1 + Math.sin(t * 8) * 0.25;
    if (chargeT.current > 0) {
      chargeT.current = Math.max(0, chargeT.current - dt * 2.2);
      if (chargeRef.current) chargeRef.current.intensity = chargeT.current * 2.6;
    } else if (chargeRef.current) {
      chargeRef.current.intensity = 0;
    }
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
        if (g && onReady)
          onReady({
            anticipate: () => (chargeT.current = 1),
            trigger: () => (attackT.current = 1),
            position: g.position,
          });
      }}
    >
      <mesh geometry={rockSkirtGeo} rotation={[-Math.PI / 2, 0, 0.5]} position={[0, 0.02, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={FOREST.rockDark} roughness={0.95} flatShading />
      </mesh>

      <mesh geometry={bowlGeo} position={[0, 0.05, 0]} castShadow>
        <meshStandardMaterial map={obsidianTex} color={0xffffff} roughness={0.55} metalness={0.3} />
      </mesh>

      {/* irregular jagged fin-shards — deliberately mismatched sizes, never a repeated regular polygon */}
      {finGeos.map((geo, i) => (
        <mesh key={i} geometry={geo} position={[Math.cos((i / finGeos.length) * Math.PI * 2) * 0.48, 0.4, Math.sin((i / finGeos.length) * Math.PI * 2) * 0.48]} rotation={[0.5, -(i / finGeos.length) * Math.PI * 2, 0.2]} castShadow>
          <meshStandardMaterial color={theme.secondary} roughness={0.6} metalness={0.25} flatShading />
        </mesh>
      ))}
      {evolved &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={`vent-${i}`} geometry={ventGeo} position={[Math.cos((i / 6) * Math.PI * 2) * 0.66, 0.5, Math.sin((i / 6) * Math.PI * 2) * 0.66]}>
            <meshStandardMaterial color={"#1c1512"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={1.4} />
          </mesh>
        ))}

      <mesh ref={coreRef} position={[0, 1.15 * scale, 0]}>
        <icosahedronGeometry args={[evolved ? 0.3 : 0.22, 1]} />
        <meshStandardMaterial color={"#1a0f0a"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={2.4} roughness={0.35} flatShading />
      </mesh>
      {evolved && (
        <mesh position={[0, 1.5 * scale, 0]}>
          <icosahedronGeometry args={[0.16, 1]} />
          <meshStandardMaterial color={"#1a0f0a"} emissive={theme.accent} emissiveMap={crackTex} emissiveIntensity={2.2} flatShading />
        </mesh>
      )}

      <pointLight ref={flameLightRef} position={[0, 1.1 * scale, 0]} color={theme.primary} intensity={1.1} distance={3} />
      <pointLight ref={chargeRef} position={[0, 1.1 * scale, 0]} color={theme.accent} intensity={0} distance={3.2} />
      <pointLight ref={flashRef} position={[0, 1.1 * scale, 0]} color={theme.accent} intensity={0} distance={4.5} />
    </group>
  );
}
