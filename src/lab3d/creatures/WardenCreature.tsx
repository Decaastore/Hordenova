import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import { buildTaperedTube, buildJaggedPlateShape } from "../geometryUtils";
import { getStoneTexture } from "../proceduralTextures";
import { mulberry32 } from "../rng";
import type { CreatureHandle } from "./creatureTypes";

const V2 = (r: number, y: number) => new THREE.Vector2(r, y);

/** Hourglass armored silhouette — wide chest flare, narrow waist — a genuinely different body shape from Brute's boulder bulk, not a scaled recolor. */
const TORSO_PROFILE = [V2(0.0, 0), V2(0.22, 0.05), V2(0.28, 0.4), V2(0.23, 0.7), V2(0.44, 1.02), V2(0.35, 1.3), V2(0.2, 1.48), V2(0.0, 1.56)];
const HELM_PROFILE = [V2(0.0, 0), V2(0.22, 0.03), V2(0.25, 0.22), V2(0.16, 0.4), V2(0.0, 0.46)];

const LEG_ANCHORS: [number, number][] = [
  [0.24, -0.02],
  [-0.24, -0.02],
];

function buildTatteredCapeShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, h);
  shape.lineTo(w / 2, h);
  const teeth = 5;
  for (let i = 0; i <= teeth; i++) {
    const x = w / 2 - (w * i) / teeth;
    const dip = i % 2 === 0 ? 0 : h * 0.22;
    shape.quadraticCurveTo(x + w / teeth / 2, dip * 0.6, x, dip);
  }
  shape.closePath();
  return shape;
}

/**
 * WARDEN — mini-boss with its own silhouette family, not "bigger Brute":
 * an hourglass armored torso (wide chest, narrow waist), an asymmetric
 * five-blade crown (one blade deliberately taller/off-center — a crest,
 * not a symmetric ring), a recessed chest rune-core instead of a floating
 * gem, curled horns, and a tattered cape for scale/presence. Scaled up
 * (default 1.8) so it genuinely towers over the other archetypes.
 */
export function WardenCreature({
  onReady,
  hp01 = 1,
  scale = 1.8,
}: {
  onReady?: (h: CreatureHandle) => void;
  hp01?: number;
  scale?: number;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const hpFillRef = useRef<THREE.Mesh>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.SHIELDBEARER;

  const torsoGeo = useMemo(() => new THREE.LatheGeometry(TORSO_PROFILE, 10), []);
  const helmGeo = useMemo(() => new THREE.LatheGeometry(HELM_PROFILE, 8), []);
  const armorTex = useMemo(() => getStoneTexture(c.body, c.dark), [c.body, c.dark]);

  const legGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0.03, 0.3, 0.05), new THREE.Vector3(0, 0.02, -0.03)],
        [0.15, 0.12, 0.09],
        6,
      ),
    [],
  );
  const hornGeo = useMemo(
    () => buildTaperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 0.16, -0.05), new THREE.Vector3(0.02, 0.3, -0.2)], [0.04, 0.025, 0.004], 5),
    [],
  );
  const crownBladeGeo = useMemo(() => {
    const rand = mulberry32(63);
    const shape = buildJaggedPlateShape(0.16, 4, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  }, []);
  const bigPauldronGeo = useMemo(() => {
    const rand = mulberry32(71);
    const shape = buildJaggedPlateShape(0.24, 6, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  }, []);
  const smallPauldronGeo = useMemo(() => {
    const rand = mulberry32(83);
    const shape = buildJaggedPlateShape(0.17, 6, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
  }, []);
  const capeGeo = useMemo(() => {
    const shape = buildTatteredCapeShape(0.62, -0.85);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  }, []);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const stomp = t * 1.5;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.62 * scale - Math.abs(Math.sin(stomp)) * 0.05 * scale;
    }
    if (auraRef.current) auraRef.current.rotation.z += dt * 0.5;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.12;
      coreRef.current.scale.setScalar(pulse);
    }
    if (hpFillRef.current) hpFillRef.current.scale.x = Math.max(0.001, hp01);
    if (hitT.current > 0) {
      hitT.current = Math.max(0, hitT.current - dt * 4.5);
      if (bodyRef.current) bodyRef.current.scale.setScalar(scale * (1 + hitT.current * 0.13));
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
        <ringGeometry args={[0.72, 0.85, 32]} />
        <meshBasicMaterial color={c.accent} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.62 * scale, 0]}>
        <mesh geometry={torsoGeo} scale={[1, 1, 0.9]} castShadow>
          <meshStandardMaterial map={armorTex} color={0xffffff} roughness={0.42} metalness={0.32} />
        </mesh>

        {/* recessed chest rune-core — the toxic-green accent, localized rather than a global wash */}
        <mesh ref={coreRef} position={[0, 1.0, 0.36]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={1.7} roughness={0.25} />
        </mesh>
        <pointLight position={[0, 1.0, 0.36]} color={c.accent} intensity={0.9} distance={2.2} />
        {/* boss-scale character fill — the scene's directional key light doesn't
            reliably hit this model face-on from every point on its patrol loop,
            and a boss silhouetted into near-total blackness reads as a bug, not
            "atmospheric." Two lights (front + back, carried WITH the creature)
            keep it legible from any camera angle without touching the global
            scene lighting or depending on which way it happens to be facing. */}
        <pointLight position={[0.15, 1.1, 0.65]} color={"#f0e4c2"} intensity={1.1} distance={3.4} />
        <pointLight position={[-0.1, 1.1, -0.6]} color={"#f0e4c2"} intensity={1.1} distance={3.4} />

        {/* asymmetric crown — five blades, one taller and off-axis (a crest, not a ring) */}
        <group position={[0, 1.5, -0.02]}>
          {[-0.5, -0.22, 0.1, 0.4, 0.68].map((a, i) => (
            <mesh
              key={i}
              geometry={crownBladeGeo}
              position={[Math.sin(a) * 0.16, i === 2 ? 0.1 : 0, Math.cos(a) * 0.16]}
              rotation={[0.25, a, i === 2 ? 0.05 : 0.5]}
              scale={i === 2 ? 1.5 : 1}
              castShadow
            >
              <meshStandardMaterial color={c.dark} roughness={0.4} metalness={0.3} flatShading />
            </mesh>
          ))}
        </group>

        <group position={[0, 1.28, 0]} rotation={[0.18, 0, 0]}>
          <mesh geometry={helmGeo} castShadow>
            <meshStandardMaterial map={armorTex} color={0xffffff} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh geometry={hornGeo} position={[0.14, 0.1, -0.05]} rotation={[0, 0, -0.3]} castShadow>
            <meshStandardMaterial color={"#d8dce8"} roughness={0.3} metalness={0.3} />
          </mesh>
          <mesh geometry={hornGeo} position={[-0.14, 0.1, -0.05]} rotation={[0, 0, 0.3]} scale={[-1, 1, 1]} castShadow>
            <meshStandardMaterial color={"#d8dce8"} roughness={0.3} metalness={0.3} />
          </mesh>
          <mesh position={[0.1, 0.22, 0.19]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
          </mesh>
          <mesh position={[-0.1, 0.22, 0.19]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
          </mesh>
        </group>

        {/* deliberately mismatched pauldron sizes — reinforces "elite war-beast," not a symmetric toy */}
        <mesh geometry={bigPauldronGeo} position={[0.4, 1.02, -0.02]} rotation={[0.25, 0.5, 0.45]} castShadow>
          <meshStandardMaterial map={armorTex} color={0xffffff} roughness={0.45} metalness={0.3} flatShading />
        </mesh>
        <mesh geometry={smallPauldronGeo} position={[-0.38, 0.98, -0.02]} rotation={[0.2, -0.4, -0.4]} castShadow>
          <meshStandardMaterial map={armorTex} color={0xffffff} roughness={0.45} metalness={0.3} flatShading />
        </mesh>

        <mesh geometry={capeGeo} position={[0, 1.15, -0.34]} rotation={[0.35, 0, 0]}>
          <meshStandardMaterial color={"#241c2e"} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {LEG_ANCHORS.map(([x, z], i) => (
        <mesh key={i} geometry={legGeo} position={[x * scale, 0, z * scale]} scale={scale} castShadow>
          <meshStandardMaterial map={armorTex} color={0xffffff} roughness={0.5} metalness={0.25} />
        </mesh>
      ))}

      <group position={[0, 2.15 * scale, 0]}>
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
