import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CREATURES_3D } from "../palette";
import { buildTaperedTube, buildJaggedPlateShape } from "../geometryUtils";
import { mulberry32 } from "../rng";
import { getToonGradientMap } from "@/rendering3d/toonShading";
import { OutlineMesh } from "@/rendering3d/OutlineMesh";
import type { CreatureHandle } from "./creatureTypes";

const V2 = (r: number, y: number) => new THREE.Vector2(r, y);

/** Squat, wide-bellied lathe profile — a scuttling body, never a bare sphere/capsule primitive. */
const BODY_PROFILE = [V2(0.0, 0), V2(0.28, 0.03), V2(0.4, 0.14), V2(0.36, 0.28), V2(0.22, 0.36), V2(0.0, 0.39)];

/** Small forward-jutting wedge head, proportionally oversized for read-at-a-glance legibility. */
const HEAD_PROFILE = [V2(0.0, 0), V2(0.16, 0.02), V2(0.19, 0.1), V2(0.13, 0.19), V2(0.0, 0.22)];

/** Leg points relative to the hip (local origin) — same hinge-from-hip pattern BruteCreature uses, so the whole leg swings as one rigid piece when its wrapping group rotates. */
function legPoints(kneeOffsetX: number): THREE.Vector3[] {
  return [new THREE.Vector3(0, 0, 0), new THREE.Vector3(kneeOffsetX, -0.1, 0.05), new THREE.Vector3(kneeOffsetX * 0.7, -0.19, -0.02)];
}

/**
 * CRAWLER — "inimigo comum" anatomia mínima: corpo principal + cabeça
 * separada + 4 apêndices (pernas) + 2 placas dorsais quebrando a silhueta
 * de "blob liso". Camada COMUM da hierarquia visual: 1 cor dominante, SEM
 * emissive (o acento lima da identidade do CRAWLER é usado como cor plana
 * nos olhos, nunca brilhante) — Elite/mini-boss/boss ganham emissive e
 * mais partes em variantes futuras, não nesta.
 */
export function CrawlerCreature({
  onReady,
  scale = 1,
  speedMultiplier = 1,
}: {
  onReady?: (h: CreatureHandle) => void;
  scale?: number;
  speedMultiplier?: number;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const legFLRef = useRef<THREE.Group>(null);
  const legFRRef = useRef<THREE.Group>(null);
  const legBLRef = useRef<THREE.Group>(null);
  const legBRRef = useRef<THREE.Group>(null);
  const hitT = useRef(0);
  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;
  const c = CREATURES_3D.CRAWLER;

  const bodyGeo = useMemo(() => new THREE.LatheGeometry(BODY_PROFILE, 10), []);
  const headGeo = useMemo(() => new THREE.LatheGeometry(HEAD_PROFILE, 8), []);
  const legGeoFront = useMemo(() => buildTaperedTube(legPoints(0.1), [0.045, 0.032, 0.016], 5), []);
  const legGeoBack = useMemo(() => buildTaperedTube(legPoints(-0.08), [0.045, 0.032, 0.016], 5), []);
  const plateGeo = useMemo(() => {
    const rand = mulberry32(23);
    const shape = buildJaggedPlateShape(0.12, 5, rand);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  }, []);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    const scuttle = t * 5.5 * speedMultiplierRef.current;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.2 * scale + Math.abs(Math.sin(scuttle)) * 0.02 * scale;
      bodyRef.current.rotation.z = Math.sin(scuttle) * 0.05;
    }
    if (legFLRef.current) legFLRef.current.rotation.x = Math.sin(scuttle) * 0.4;
    if (legFRRef.current) legFRRef.current.rotation.x = Math.sin(scuttle + Math.PI) * 0.4;
    if (legBLRef.current) legBLRef.current.rotation.x = Math.sin(scuttle + Math.PI) * 0.4;
    if (legBRRef.current) legBRRef.current.rotation.x = Math.sin(scuttle) * 0.4;
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
        if (g && onReady)
          onReady({
            root: g,
            pulseHit: () => (hitT.current = 1),
            setSpeedMultiplier: (m) => (speedMultiplierRef.current = m),
          });
      }}
    >
      <group ref={bodyRef} position={[0, 0.2 * scale, 0]}>
        {/* CORPO PRINCIPAL */}
        <mesh geometry={bodyGeo} scale={[1, 0.82, 1.15]} castShadow>
          <meshToonMaterial gradientMap={getToonGradientMap()} color={c.body} />
        </mesh>
        <OutlineMesh geometry={bodyGeo} scale={[1, 0.82, 1.15]} thickness={1.08} />

        {/* PLACAS DORSAIS — quebram a silhueta de "blob liso", segmentação de inseto */}
        {[0, 1].map((i) => (
          <mesh key={i} geometry={plateGeo} position={[0, 0.28 - i * 0.08, -0.1 + i * 0.14]} rotation={[1.4, 0, 0]} scale={1 - i * 0.2} castShadow>
            <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
          </mesh>
        ))}

        {/* CABEÇA — separada do corpo, à frente, proporcionalmente maior que o "realista" */}
        <group position={[0, 0.16, 0.28]} rotation={[1.2, 0, 0]}>
          <mesh geometry={headGeo} castShadow>
            <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
          </mesh>
          <OutlineMesh geometry={headGeo} thickness={1.1} />
          <mesh position={[0.06, 0.13, 0.1]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color={c.accent} />
          </mesh>
          <mesh position={[-0.06, 0.13, 0.1]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color={c.accent} />
          </mesh>
        </group>
      </group>

      {/* APÊNDICES — 4 pernas simples, existência de função de movimento */}
      <group ref={legFLRef} position={[0.22 * scale, 0.28 * scale, 0.12 * scale]} scale={scale}>
        <mesh geometry={legGeoFront} castShadow>
          <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
        </mesh>
      </group>
      <group ref={legFRRef} position={[-0.22 * scale, 0.28 * scale, 0.12 * scale]} scale={[-scale, scale, scale]}>
        <mesh geometry={legGeoFront} castShadow>
          <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
        </mesh>
      </group>
      <group ref={legBLRef} position={[0.2 * scale, 0.26 * scale, -0.15 * scale]} scale={scale}>
        <mesh geometry={legGeoBack} castShadow>
          <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
        </mesh>
      </group>
      <group ref={legBRRef} position={[-0.2 * scale, 0.26 * scale, -0.15 * scale]} scale={[-scale, scale, scale]}>
        <mesh geometry={legGeoBack} castShadow>
          <meshToonMaterial gradientMap={getToonGradientMap()} color={c.dark} />
        </mesh>
      </group>
    </group>
  );
}
