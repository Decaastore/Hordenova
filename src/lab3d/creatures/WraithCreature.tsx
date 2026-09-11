import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import { buildTaperedTube, buildMembraneWingShape } from "../geometryUtils";
import type { CreatureHandle } from "./creatureTypes";

/** A single continuous serpentine body — narrow tail, wide mid-body, flaring into a hood at the head end — rather than a capsule+cone assembly. */
const BODY_POINTS = [
  new THREE.Vector3(0, 0, -0.42),
  new THREE.Vector3(0, 0.02, -0.26),
  new THREE.Vector3(0, 0.05, -0.06),
  new THREE.Vector3(0, 0.09, 0.14),
  new THREE.Vector3(0, 0.15, 0.3),
  new THREE.Vector3(0, 0.19, 0.4),
];
const BODY_RADII = [0.01, 0.09, 0.135, 0.11, 0.15, 0.18];

function tendrilPoints(dx: number): THREE.Vector3[] {
  return [new THREE.Vector3(dx * 0.02, 0, -0.4), new THREE.Vector3(dx * 0.08, -0.04, -0.64), new THREE.Vector3(dx * 0.05, -0.02, -0.86)];
}

/**
 * WRAITH — the flying archetype: a single lofted, tapering body (tail ->
 * mid-body -> hood flare) instead of separate capsule/cone/wing
 * primitives, with a recessed dark hood-face carrying just two emissive
 * eye points, smooth scalloped membrane wings (bezier outline, not a
 * jagged straight-edge fan), and two independently-drifting spectral
 * tendrils trailing behind. Casts a soft dark ellipse shadow on the
 * ground tracking its XZ position — the one unambiguous "this is
 * airborne" cue.
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
  const tendrilARef = useRef<THREE.Mesh>(null);
  const tendrilBRef = useRef<THREE.Mesh>(null);
  const hitT = useRef(0);
  const c = CREATURES_3D.DISABLER;

  const bodyGeo = useMemo(() => buildTaperedTube(BODY_POINTS, BODY_RADII, 8), []);
  const wingGeo = useMemo(() => new THREE.ExtrudeGeometry(buildMembraneWingShape(0.5, 3), { depth: 0.015, bevelEnabled: false }), []);
  const tendrilGeoA = useMemo(() => buildTaperedTube(tendrilPoints(1), [0.03, 0.018, 0.003], 5), []);
  const tendrilGeoB = useMemo(() => buildTaperedTube(tendrilPoints(-1), [0.025, 0.015, 0.003], 5), []);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.95 + Math.sin(t * 1.6) * 0.14;
      bodyRef.current.rotation.z = Math.sin(t * 1.6) * 0.08;
      bodyRef.current.rotation.x = Math.sin(t * 1.1) * 0.05;
    }
    const flap = Math.sin(t * 3.4) * 0.55;
    if (wingLRef.current) wingLRef.current.rotation.z = 0.35 + flap;
    if (wingRRef.current) wingRRef.current.rotation.z = -0.35 - flap;
    if (tendrilARef.current) tendrilARef.current.rotation.x = Math.sin(t * 2.2 + 1) * 0.3;
    if (tendrilBRef.current) tendrilBRef.current.rotation.x = Math.sin(t * 2.2 + 2.3) * 0.3;
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} ref={(m) => m && onShadowReady && onShadowReady(m)}>
        <circleGeometry args={[0.32, 12]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.32} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.95, 0]}>
        <mesh geometry={bodyGeo} castShadow>
          <meshStandardMaterial color={c.body} roughness={0.45} transparent opacity={0.88} emissive={c.dark} emissiveIntensity={0.25} />
        </mesh>

        {/* recessed hood-face — reads as a dark cavity, not a lit disc, framing the two eyes */}
        <mesh position={[0, 0.19, 0.38]} rotation={[-0.2, 0, 0]}>
          <circleGeometry args={[0.13, 10]} />
          <meshStandardMaterial color={"#0a0510"} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.045, 0.2, 0.4]}>
          <sphereGeometry args={[0.024, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>
        <mesh position={[-0.045, 0.2, 0.4]}>
          <sphereGeometry args={[0.024, 6, 6]} />
          <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={2.2} />
        </mesh>

        <mesh ref={wingLRef} geometry={wingGeo} position={[0.1, 0.06, 0.02]} rotation={[0, 0.3, 0.15]}>
          <meshStandardMaterial color={c.dark} roughness={0.4} transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wingRRef} geometry={wingGeo} position={[-0.1, 0.06, 0.02]} rotation={[0, -0.3 + Math.PI, -0.15]} scale={[-1, 1, 1]}>
          <meshStandardMaterial color={c.dark} roughness={0.4} transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>

        <mesh ref={tendrilARef} geometry={tendrilGeoA} position={[0.05, 0.02, -0.2]}>
          <meshStandardMaterial color={c.dark} roughness={0.5} transparent opacity={0.55} />
        </mesh>
        <mesh ref={tendrilBRef} geometry={tendrilGeoB} position={[-0.04, 0.01, -0.2]}>
          <meshStandardMaterial color={c.dark} roughness={0.5} transparent opacity={0.5} />
        </mesh>

        <pointLight color={c.accent} intensity={0.5} distance={1.5} />
      </group>
    </group>
  );
}
