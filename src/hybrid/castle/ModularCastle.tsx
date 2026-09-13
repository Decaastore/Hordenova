import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildTaperedTube, buildJaggedPlateShape } from "@/lab3d/geometryUtils";
import { getStoneTexture, getCrackTexture } from "@/lab3d/proceduralTextures";
import { mulberry32 } from "@/lab3d/rng";
import type { CastleHandle } from "@/lab3d/effectsTypes";
import type { CastleSkinDefinition } from "./castleSkinTypes";
import { getToonGradientMap } from "@/rendering3d/toonShading";
import { OutlineMesh } from "@/rendering3d/OutlineMesh";

interface Props {
  skin: CastleSkinDefinition;
  onReady?: (handle: CastleHandle) => void;
}

const KEEP_PROFILE = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.06, 1.0, 0.02),
  new THREE.Vector3(-0.03, 2.1, -0.02),
  new THREE.Vector3(0, 2.75, 0),
];
const KEEP_RADII = [0.95, 0.72, 0.52, 0.44];

const SIDE_TOWER_PROFILE = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.9, 0.01), new THREE.Vector3(0, 1.55, -0.01)];
const SIDE_TOWER_RADII = [0.5, 0.4, 0.32];

const GATE_ARCH = (() => {
  const shape = new THREE.Shape();
  const w = 0.55;
  const h = 1.15;
  shape.moveTo(-w, 0);
  shape.lineTo(-w, h);
  shape.absarc(0, h, w, Math.PI, 0, true);
  shape.lineTo(w, 0);
  shape.closePath();
  return shape;
})();

/**
 * PROVA DE CONCEITO — SKIN LAB. "LAST BASTION" reconceived NOT as a box
 * with one tower (the honest limitation of `@/lab3d/Castle.tsx`, which
 * this deliberately supersedes for the lab): a broad broken-rock
 * foundation, a crenellated outer wall ring with a gated opening, a
 * tall tapered multi-tier keep with banding rings and a spired roof,
 * two flanking gate towers, buttress ribs breaking up the keep's flat
 * faces, hanging banners, torchlight, and a floating ward-crystal over
 * the gate — the castle's own "core", playing the same role a tower's
 * crystal plays, and the part a future skin would most obviously swap.
 */
export function ModularCastle({ skin, onReady }: Props) {
  const groupRef = useRef<THREE.Group | null>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const torchARef = useRef<THREE.PointLight>(null);
  const torchBRef = useRef<THREE.PointLight>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const damageT = useRef(0);

  const foundationTex = useMemo(() => getStoneTexture(skin.foundation.textureBase, skin.foundation.textureDark), [skin.foundation.textureBase, skin.foundation.textureDark]);
  const wallTex = useMemo(() => getStoneTexture(skin.wall.textureBase, skin.wall.textureDark), [skin.wall.textureBase, skin.wall.textureDark]);
  const keepTex = useMemo(() => getStoneTexture(skin.keep.textureBase, skin.keep.textureDark), [skin.keep.textureBase, skin.keep.textureDark]);
  const crackTex = useMemo(() => getCrackTexture(skin.wardCrystal.crackColor), [skin.wardCrystal.crackColor]);

  const foundationGeo = useMemo(() => {
    const rand = mulberry32(101);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(3.5, 12, rand), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  }, []);
  const keepGeo = useMemo(() => buildTaperedTube(KEEP_PROFILE, KEEP_RADII, 10), []);
  const sideTowerGeo = useMemo(() => buildTaperedTube(SIDE_TOWER_PROFILE, SIDE_TOWER_RADII, 8), []);
  const gateGeo = useMemo(() => new THREE.ExtrudeGeometry(GATE_ARCH, { depth: 0.5, bevelEnabled: false }), []);

  // gate gap faces +Z; crenellations run around the remaining ~300°
  const crenelCount = 22;
  const gateHalfAngleDeg = 26;
  const crenellations = useMemo(() => {
    const list: { angle: number }[] = [];
    for (let i = 0; i < crenelCount; i++) {
      const deg = (i / crenelCount) * 360;
      const centered = ((deg + 180) % 360) - 180; // -180..180, 0 = +Z (gate center)
      if (Math.abs(centered) < gateHalfAngleDeg) continue;
      list.push({ angle: (deg * Math.PI) / 180 });
    }
    return list;
  }, []);

  const buttressAngles = useMemo(() => [0.5, 1.6, 2.6, 3.6, 4.7, 5.7], []);
  // TORRES LATERAIS — 4 corner towers (2 flanking the gate, 2 at the rear
  // corners), not just 2, so the wall's silhouette reads as a fortress
  // with towers at every corner rather than a keep with two gate-posts.
  const sideTowerPositions = useMemo(
    () => [
      { x: -1.55, z: 0.75 },
      { x: 1.55, z: 0.75 },
      { x: -1.35, z: -1.15 },
      { x: 1.35, z: -1.15 },
    ],
    [],
  );

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (torchARef.current) torchARef.current.intensity = 0.9 + Math.sin(t * 9) * 0.2;
    if (torchBRef.current) torchBRef.current.intensity = 0.9 + Math.sin(t * 9 + 1.4) * 0.2;
    if (crystalRef.current) {
      crystalRef.current.position.y = 4.15 + Math.sin(t * 1.1) * 0.1;
      crystalRef.current.rotation.y += dt * 0.3;
    }
    if (damageT.current > 0) {
      damageT.current = Math.max(0, damageT.current - dt * 3);
      if (groupRef.current) groupRef.current.position.x = Math.sin(damageT.current * 40) * damageT.current * 0.08;
      if (flashRef.current) flashRef.current.intensity = damageT.current * 5;
    } else {
      if (groupRef.current) groupRef.current.position.x = 0;
      if (flashRef.current) flashRef.current.intensity = 0;
    }
  });

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (g && onReady) onReady({ pulseDamage: () => (damageT.current = 1) });
      }}
    >
      {/* ---------- FOUNDATION ---------- */}
      <mesh geometry={foundationGeo} rotation={[-Math.PI / 2, 0, 0.15]} position={[0, -0.02, 0]} receiveShadow>
        <meshToonMaterial gradientMap={getToonGradientMap()} map={foundationTex} color={0xffffff} />
      </mesh>
      <OutlineMesh geometry={foundationGeo} rotation={[-Math.PI / 2, 0, 0.15]} position={[0, -0.02, 0]} thickness={1.03} />

      {/* ---------- OUTER WALL (crenellated ring with a gate gap facing +Z) ---------- */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[2.55, 2.7, 1.1, 28, 1, true, ((gateHalfAngleDeg + 0.5) * Math.PI) / 180, ((360 - 2 * (gateHalfAngleDeg + 0.5)) * Math.PI) / 180]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} map={wallTex} color={0xffffff} side={THREE.DoubleSide} />
      </mesh>
      {crenellations.map((c, i) => (
        <mesh key={i} position={[Math.sin(c.angle) * 2.62, 1.18, Math.cos(c.angle) * 2.62]} rotation={[0, -c.angle, 0]}>
          <boxGeometry args={[0.28, 0.32, 0.24]} />
          <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.wall.crenelColor} />
        </mesh>
      ))}

      {/* ---------- KEEP (central tower) ---------- */}
      <mesh geometry={keepGeo} position={[0, 0.15, -0.3]} castShadow>
        <meshToonMaterial gradientMap={getToonGradientMap()} map={keepTex} color={0xffffff} />
      </mesh>
      <OutlineMesh geometry={keepGeo} position={[0, 0.15, -0.3]} thickness={1.05} />
      {[0.85, 1.75].map((y, i) => (
        <mesh key={i} position={[0, y, -0.3]}>
          <torusGeometry args={[0.68 - i * 0.15, 0.055, 6, 16]} />
          <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.keep.bandColor} />
        </mesh>
      ))}
      {buttressAngles.map((a, i) => (
        <mesh key={i} position={[Math.sin(a) * 0.62, 1.4, -0.3 + Math.cos(a) * 0.62]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.12, 2.2, 0.1]} />
          <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.buttressColor} />
        </mesh>
      ))}
      <mesh position={[0, 3.0, -0.3]} castShadow>
        <coneGeometry args={[0.58, 1.0, 10]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.roof.color} />
      </mesh>
      <mesh position={[0, 3.62, -0.3]}>
        <coneGeometry args={[0.05, 0.28, 6]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.keep.bandColor} />
      </mesh>

      {/* ---------- GATE + FLANKING TOWERS ---------- */}
      <mesh geometry={gateGeo} position={[0, 0, 1.05]} rotation={[0, 0, 0]}>
        <meshToonMaterial gradientMap={getToonGradientMap()} color={"#0d0906"} side={THREE.DoubleSide} />
      </mesh>
      {sideTowerPositions.map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
          <mesh geometry={sideTowerGeo} castShadow>
            <meshToonMaterial gradientMap={getToonGradientMap()} map={wallTex} color={0xffffff} />
          </mesh>
          <OutlineMesh geometry={sideTowerGeo} thickness={1.06} />
          <mesh position={[0, 1.7, 0]} castShadow>
            <coneGeometry args={[0.42, 0.62, 8]} />
            <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.roof.color} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <mesh key={b} position={[Math.cos((b / 6) * Math.PI * 2) * 0.36, 1.42, Math.sin((b / 6) * Math.PI * 2) * 0.36]}>
              <boxGeometry args={[0.1, 0.12, 0.1]} />
              <meshToonMaterial gradientMap={getToonGradientMap()} map={wallTex} color={0xffffff} />
            </mesh>
          ))}
          <mesh position={[pos.x < 0 ? 0.36 : -0.36, 0.95, 0]}>
            <planeGeometry args={[0.22, 0.6]} />
            <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.banner.color} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* ---------- WARD CRYSTAL (the castle's "core") ---------- */}
      {/* Floats well above the roof's finial tip (~y=3.76) — placed inside
          the roof's own cone geometry the first time this was built, which
          silently occluded it entirely (a real bug the visual check caught,
          not a stylistic choice). */}
      {/* Unlit inner glow sphere (see ModularIronwoodTower.tsx's core for
          why: a crack-map-only emissive gem reads as near-solid-black once
          it's small on screen, since the map's background is pure black
          between veins) + the faceted vein-detail shell on top. */}
      {/* Mount/pedestal — bridges the finial spike up to the orb's socket so
          the core reads as ENCAIXADO in the keep's roof, not floating
          disconnected above it. */}
      <mesh position={[0, 3.82, 0.1]} castShadow>
        <coneGeometry args={[0.2, 0.22, 8]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.keep.bandColor} />
      </mesh>
      <mesh position={[0, 3.95, 0.12]}>
        <torusGeometry args={[0.23, 0.04, 6, 16]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.keep.bandColor} emissive={skin.wardCrystal.emissive} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 4.15, 0.15]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshBasicMaterial color={skin.wardCrystal.emissive} />
      </mesh>
      <mesh ref={crystalRef} position={[0, 4.15, 0.15]}>
        <icosahedronGeometry args={[0.36, 1]} />
        <meshToonMaterial gradientMap={getToonGradientMap()} color={skin.wardCrystal.shellColor} emissive={skin.wardCrystal.emissive} emissiveMap={crackTex} emissiveIntensity={skin.wardCrystal.emissiveIntensity} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, 4.15, 0.15]} color={skin.wardCrystal.emissive} intensity={1.8} distance={5.5} />

      <pointLight ref={torchARef} position={[-0.85, 0.85, 1.15]} color={skin.torchColor} intensity={0.9} distance={2.6} />
      <pointLight ref={torchBRef} position={[0.85, 0.85, 1.15]} color={skin.torchColor} intensity={0.9} distance={2.6} />
      <pointLight ref={flashRef} position={[0, 1.2, 1.1]} color={"#ff3a2a"} intensity={0} distance={5} />
    </group>
  );
}
