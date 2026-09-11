import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import { buildTaperedTube, buildJaggedPlateShape } from "../geometryUtils";
import { getStoneTexture } from "../proceduralTextures";
import { mulberry32 } from "../rng";
import type { CreatureHandle } from "./creatureTypes";

const V2 = (r: number, y: number) => new THREE.Vector2(r, y);

/** Boulder-hide torso — a lofted, faceted silhouette (lathe, not an obviously-round primitive): narrow feet, wide gut, tapering collar. */
const TORSO_PROFILE = [V2(0.02, 0), V2(0.32, 0.05), V2(0.46, 0.24), V2(0.52, 0.5), V2(0.49, 0.74), V2(0.38, 0.94), V2(0.29, 1.03), V2(0.32, 1.09), V2(0.0, 1.15)];

/** Low, forward-jutting wedge skull with a heavy brow ridge — no round head-ball. */
const HEAD_PROFILE = [V2(0.0, 0), V2(0.2, 0.02), V2(0.25, 0.14), V2(0.19, 0.27), V2(0.06, 0.35), V2(0.0, 0.37)];

function legPoints(hipY: number, kneeOffsetX: number): THREE.Vector3[] {
  return [new THREE.Vector3(0, hipY, 0), new THREE.Vector3(kneeOffsetX, hipY * 0.5, 0.06), new THREE.Vector3(kneeOffsetX * 0.6, 0.02, -0.02)];
}

/**
 * BRUTE — heavy, dangerous, asymmetric: one huge armored club-arm, one
 * clawed off-hand, a low wedge skull with tusks, a spine ridge of bone
 * shards. The torso/head/limbs are lofted (LatheGeometry / tapered
 * tube-loft) rather than an icosahedron-plus-cones assembly, so the
 * silhouette reads as sculpted bulk instead of "primitives glued
 * together." Stone-hide surface detail comes from a procedural canvas
 * texture, not a flat fill color.
 */
export function BruteCreature({ onReady, scale = 1 }: { onReady?: (h: CreatureHandle) => void; scale?: number }) {
  const bodyRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.BRUTE;

  const torsoGeo = useMemo(() => new THREE.LatheGeometry(TORSO_PROFILE, 9), []);
  const headGeo = useMemo(() => new THREE.LatheGeometry(HEAD_PROFILE, 8), []);
  const hideTex = useMemo(() => getStoneTexture(c.body, c.dark), [c.body, c.dark]);

  const legGeoL = useMemo(() => buildTaperedTube(legPoints(0.5, 0.06), [0.17, 0.14, 0.09], 6), []);
  const legGeoR = useMemo(() => buildTaperedTube(legPoints(0.5, -0.06), [0.17, 0.14, 0.09], 6), []);
  const armGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0.22, -0.14, 0.02), new THREE.Vector3(0.42, -0.4, 0.05)],
        [0.16, 0.13, 0.1],
        6,
      ),
    [],
  );
  const clawArmGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(-0.18, -0.16, 0.04), new THREE.Vector3(-0.32, -0.38, 0.08)],
        [0.1, 0.075, 0.045],
        6,
      ),
    [],
  );
  const tuskGeo = useMemo(
    () => buildTaperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, -0.05, 0.14), new THREE.Vector3(-0.01, -0.02, 0.24)], [0.032, 0.022, 0.004], 5),
    [],
  );
  const clubHeadGeo = useMemo(() => {
    const rand = mulberry32(42);
    const shape = buildJaggedPlateShape(0.19, 7, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, []);
  const pauldronGeo = useMemo(() => {
    const rand = mulberry32(11);
    const shape = buildJaggedPlateShape(0.28, 6, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  }, []);
  const smallPauldronGeo = useMemo(() => {
    const rand = mulberry32(19);
    const shape = buildJaggedPlateShape(0.17, 6, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  }, []);
  const spineShardGeo = useMemo(() => {
    const rand = mulberry32(31);
    const shape = buildJaggedPlateShape(0.13, 5, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  }, []);
  const clawGeo = useMemo(
    () => buildTaperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, -0.05, 0.09)], [0.028, 0.006], 5),
    [],
  );

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const stomp = t * 3.0;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.5 * scale - Math.abs(Math.sin(stomp)) * 0.09 * scale;
      bodyRef.current.rotation.z = Math.sin(stomp) * 0.06;
      bodyRef.current.rotation.x = 0.14 + Math.sin(stomp * 0.5) * 0.02;
    }
    if (armRef.current) armRef.current.rotation.x = -0.3 + Math.sin(stomp + 1) * 0.35;
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
      <group ref={bodyRef} position={[0, 0.5 * scale, 0]}>
        <mesh geometry={torsoGeo} scale={[1, 1, 0.86]} castShadow>
          <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.82} metalness={0.04} flatShading />
        </mesh>

        {/* asymmetric spine ridge — decreasing shard scale toward the head */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            geometry={spineShardGeo}
            position={[0, 0.5 + i * 0.16, -0.42 + i * 0.02]}
            rotation={[1.15 + i * 0.05, 0, (i % 2 === 0 ? 1 : -1) * 0.12]}
            scale={1 - i * 0.14}
            castShadow
          >
            <meshStandardMaterial color={c.dark} roughness={0.6} flatShading />
          </mesh>
        ))}

        {/* forward-jutting wedge skull, low and integrated into the shoulders */}
        <group position={[0, 0.86, -0.18]} rotation={[1.35, 0, 0]}>
          <mesh geometry={headGeo} castShadow>
            <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.78} flatShading />
          </mesh>
          <mesh geometry={tuskGeo} position={[0.09, 0.06, 0.3]} rotation={[0, 0.2, 0]} castShadow>
            <meshStandardMaterial color={"#e9dcc3"} roughness={0.35} />
          </mesh>
          <mesh geometry={tuskGeo} position={[-0.09, 0.06, 0.3]} rotation={[0, -0.2, 0]} scale={[-1, 1, 1]} castShadow>
            <meshStandardMaterial color={"#e9dcc3"} roughness={0.35} />
          </mesh>
          <mesh position={[0.08, 0.2, 0.24]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={1.8} />
          </mesh>
          <mesh position={[-0.08, 0.2, 0.24]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={1.8} />
          </mesh>
          {/* character fill light (front + back), carried with the creature —
              keeps it legible from any angle along its patrol loop, independent
              of which way it's currently facing or where the scene's single
              directional key light happens to be pointing */}
          <pointLight position={[0, 0.05, 0.3]} color={"#e8dcc0"} intensity={0.7} distance={2} />
        </group>
        <pointLight position={[0, 0.55, 0.35]} color={"#e8dcc0"} intensity={0.7} distance={2} />

        {/* big armored club-arm — the dominant, asymmetric silhouette element */}
        <group position={[0.44, 0.86, -0.02]}>
          <mesh geometry={pauldronGeo} rotation={[0.3, 0.4, 0.5]} castShadow>
            <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.75} metalness={0.15} flatShading />
          </mesh>
          <group ref={armRef}>
            <mesh geometry={armGeo} castShadow>
              <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.82} flatShading />
            </mesh>
            <group position={[0.42, -0.4, 0.05]} rotation={[0.4, 0.3, 0.2]}>
              <mesh geometry={clubHeadGeo} castShadow>
                <meshStandardMaterial color={c.dark} roughness={0.7} metalness={0.1} flatShading />
              </mesh>
              {[0, 1, 2].map((i) => (
                <mesh key={i} position={[Math.cos(i * 2.1) * 0.16, Math.sin(i * 2.1) * 0.16, 0.1]} rotation={[1.5, 0, i]} castShadow>
                  <coneGeometry args={[0.035, 0.16, 4]} />
                  <meshStandardMaterial color={"#d8c9a8"} roughness={0.5} flatShading />
                </mesh>
              ))}
            </group>
          </group>
        </group>

        {/* smaller clawed off-hand — deliberately asymmetric with the club arm */}
        <group position={[-0.4, 0.82, -0.02]}>
          <mesh geometry={smallPauldronGeo} rotation={[0.2, -0.3, -0.4]} castShadow>
            <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.75} flatShading />
          </mesh>
          <mesh geometry={clawArmGeo} castShadow>
            <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.82} flatShading />
          </mesh>
          <group position={[-0.32, -0.38, 0.08]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} geometry={clawGeo} position={[Math.cos(i * 2.3) * 0.05, Math.sin(i * 2.3) * 0.05, 0]} rotation={[0, 0, i]} castShadow>
                <meshStandardMaterial color={"#3a3128"} roughness={0.4} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      <mesh geometry={legGeoL} position={[0.18 * scale, 0, -0.04 * scale]} scale={scale} castShadow>
        <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.88} flatShading />
      </mesh>
      <mesh geometry={legGeoR} position={[-0.18 * scale, 0, -0.04 * scale]} scale={scale} castShadow>
        <meshStandardMaterial map={hideTex} color={0xffffff} roughness={0.88} flatShading />
      </mesh>
    </group>
  );
}
