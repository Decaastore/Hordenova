import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildTaperedTube, buildJaggedPlateShape } from "@/lab3d/geometryUtils";
import { getWoodTexture, getStoneTexture, getCrackTexture } from "@/lab3d/proceduralTextures";
import { mulberry32 } from "@/lab3d/rng";
import { buildSpirePoints, buildShardPoints } from "../proceduralExtras";
import type { TowerHandle } from "@/lab3d/towers/towerTypes";
import type { TowerSkinDefinition } from "./towerSkinTypes";

interface Props {
  position: [number, number, number];
  skin: TowerSkinDefinition;
  onReady?: (handle: TowerHandle) => void;
}

const TRUNK_POINTS = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.55, 0.01), new THREE.Vector3(-0.01, 1.05, 0), new THREE.Vector3(0, 1.32, -0.01)];
const TRUNK_RADII = [0.42, 0.32, 0.22, 0.17];

/**
 * PROVA DE CONCEITO — SKIN LAB. Same tower "slot" (position, silhouette
 * budget, TowerHandle contract) as `@/lab3d/towers/IronwoodTower`, but
 * every visual part — base / body / ornaments / core / side elements /
 * effect colors — is read from a `TowerSkinDefinition` instead of being
 * hardcoded, and each part's `variant` picks between genuinely different
 * GEOMETRY, not just a different `color` on the same mesh. This is what
 * lets `ironwoodBaseSkin` and `ironwoodEmberSkin` produce two silhouettes
 * that don't look like the same tower painted differently.
 */
export function ModularIronwoodTower({ position, skin, onReady }: Props) {
  const coreRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const chargeRef = useRef<THREE.PointLight>(null);
  const emberRefs = useRef<THREE.Mesh[]>([]);
  const attackT = useRef(0);
  const chargeT = useRef(0);

  const coreHeight = 1.55 * skin.core.scale;

  // --- BASE ---------------------------------------------------------
  const brokenRockGeo = useMemo(() => {
    if (skin.base.variant !== "broken-rock") return null;
    const rand = mulberry32(5);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.72, 8, rand), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, [skin.base.variant]);
  const shardDiscGeo = useMemo(() => {
    if (skin.base.variant !== "obsidian-shard-cluster") return null;
    const rand = mulberry32(6);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.66, 9, rand), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  }, [skin.base.variant]);
  const baseShardGeo = useMemo(() => {
    if (skin.base.variant !== "obsidian-shard-cluster") return null;
    return buildTaperedTube(buildShardPoints(0.55, 0, 0.32), [0.09, 0.05, 0.012], 5);
  }, [skin.base.variant]);
  const baseShards = useMemo(() => {
    if (skin.base.variant !== "obsidian-shard-cluster") return [];
    const rand = mulberry32(7);
    return Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2 + rand() * 0.4,
      radius: 0.32 + rand() * 0.2,
      tilt: 0.15 + rand() * 0.35,
      scale: 0.7 + rand() * 0.6,
    }));
  }, [skin.base.variant]);
  const veinTex = useMemo(() => (skin.base.veinColor ? getCrackTexture(skin.base.veinColor) : null), [skin.base.veinColor]);

  // --- BODY -----------------------------------------------------------
  const trunkGeo = useMemo(() => (skin.body.variant === "gnarled-trunk" ? buildTaperedTube(TRUNK_POINTS, TRUNK_RADII, 8) : null), [skin.body.variant]);
  const spireGeo = useMemo(
    () => (skin.body.variant === "twisted-spire" ? buildTaperedTube(buildSpirePoints(1.55, 14, 1.4, 0.14), [0.34, 0.3, 0.26, 0.22, 0.19, 0.17, 0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.08, 0.06, 0.04], 8) : null),
    [skin.body.variant],
  );
  const bodyTex = useMemo(
    () => (skin.body.variant === "gnarled-trunk" ? getWoodTexture(skin.body.textureBase, skin.body.textureDark) : getStoneTexture(skin.body.textureBase, skin.body.textureDark)),
    [skin.body.variant, skin.body.textureBase, skin.body.textureDark],
  );

  // --- ORNAMENTS --------------------------------------------------------
  const prongGeo = useMemo(
    () =>
      skin.ornaments.variant === "curled-iron-prongs"
        ? buildTaperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.16, 0.02), new THREE.Vector3(0.02, 0.32, -0.01)], [0.045, 0.03, 0.006], 6)
        : null,
    [skin.ornaments.variant],
  );
  const hornGeo = useMemo(
    () => (skin.ornaments.variant === "jagged-horn-vents" ? buildTaperedTube(buildShardPoints(0.42, 0, 0.55), [0.055, 0.03, 0.006], 6) : null),
    [skin.ornaments.variant],
  );

  // --- CORE --------------------------------------------------------
  const crackTex = useMemo(() => getCrackTexture(skin.core.crackColor), [skin.core.crackColor]);

  useFrame((_, dt) => {
    if (coreRef.current) coreRef.current.rotation.y += dt * (skin.body.variant === "twisted-spire" ? 0.18 : 0.35);
    const t = performance.now() * 0.001;
    if (coreMeshRef.current) {
      const bob = Math.sin(t * skin.core.pulseSpeed) * 0.05;
      coreMeshRef.current.position.y = coreHeight + bob + (attackT.current > 0.6 ? -0.05 : 0);
      const pulse = 1 + Math.sin(t * skin.core.pulseSpeed * 1.6) * 0.06;
      const chargeScale = pulse + chargeT.current * 0.35;
      coreMeshRef.current.scale.setScalar(chargeScale);
    }
    emberRefs.current.forEach((m, i) => {
      if (!m) return;
      m.position.y = coreHeight + 0.22 + Math.sin(t * 1.6 + i * 2.1) * 0.1;
      m.position.x = Math.cos(t * 0.7 + i * 2.1) * (0.22 + i * 0.04);
      m.position.z = Math.sin(t * 0.7 + i * 2.1) * (0.22 + i * 0.04);
    });
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

  const isEmberCore = skin.core.variant === "molten-ember-core";

  return (
    <group
      position={position}
      ref={(g) => {
        if (g && onReady)
          onReady({
            anticipate: () => (chargeT.current = 1),
            trigger: () => (attackT.current = 1),
            position: g.position,
          });
      }}
    >
      {/* ---------- BASE ---------- */}
      {skin.base.variant === "broken-rock" && brokenRockGeo && (
        <mesh geometry={brokenRockGeo} rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.02, 0]} receiveShadow castShadow>
          <meshStandardMaterial color={skin.base.color} roughness={skin.base.roughness} metalness={skin.base.metalness} flatShading />
        </mesh>
      )}
      {skin.base.variant === "obsidian-shard-cluster" && shardDiscGeo && baseShardGeo && (
        <>
          <mesh geometry={shardDiscGeo} rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.02, 0]} receiveShadow castShadow>
            <meshStandardMaterial color={skin.base.color} roughness={skin.base.roughness} metalness={skin.base.metalness} emissive={skin.base.veinColor || 0} emissiveMap={veinTex ?? undefined} emissiveIntensity={veinTex ? 1.1 : 0} flatShading />
          </mesh>
          {baseShards.map((s, i) => (
            <mesh
              key={i}
              geometry={baseShardGeo}
              position={[Math.cos(s.angle) * s.radius, 0.05, Math.sin(s.angle) * s.radius]}
              rotation={[0, -s.angle, 0]}
              scale={s.scale}
              castShadow
            >
              <meshStandardMaterial color={skin.base.color} roughness={skin.base.roughness} metalness={skin.base.metalness + 0.15} emissive={skin.base.veinColor || 0} emissiveMap={veinTex ?? undefined} emissiveIntensity={veinTex ? 1.4 : 0} flatShading />
            </mesh>
          ))}
        </>
      )}

      {/* ---------- BODY ---------- */}
      <group ref={coreRef}>
        {skin.body.variant === "gnarled-trunk" && trunkGeo && (
          <mesh geometry={trunkGeo} position={[0, 0.1, 0]} castShadow>
            <meshStandardMaterial map={bodyTex} color={0xffffff} roughness={skin.body.roughness} metalness={skin.body.metalness} />
          </mesh>
        )}
        {skin.body.variant === "twisted-spire" && spireGeo && (
          <mesh geometry={spireGeo} position={[0, 0.08, 0]} castShadow>
            <meshStandardMaterial map={bodyTex} color={0xffffff} roughness={skin.body.roughness} metalness={skin.body.metalness} flatShading />
          </mesh>
        )}

        {/* banding ring — same "extra structural detail" beat both body variants share, material driven entirely by the skin */}
        <mesh position={[0, skin.body.variant === "twisted-spire" ? 1.3 : 1.05, 0]} castShadow>
          <torusGeometry args={[skin.body.variant === "twisted-spire" ? 0.16 : 0.24, 0.045, 6, 12]} />
          <meshStandardMaterial color={skin.body.bandColor} roughness={skin.body.bandRoughness} metalness={skin.body.bandMetalness} />
        </mesh>

        {/* ---------- ORNAMENTS ---------- */}
        {skin.ornaments.variant === "curled-iron-prongs" &&
          prongGeo &&
          Array.from({ length: skin.ornaments.count }, (_, i) => (
            <mesh key={i} geometry={prongGeo} position={[Math.cos((i / skin.ornaments.count) * Math.PI * 2) * 0.16, 1.28, Math.sin((i / skin.ornaments.count) * Math.PI * 2) * 0.16]} rotation={[0, (i / skin.ornaments.count) * Math.PI * 2, 0]} castShadow>
              <meshStandardMaterial color={skin.ornaments.color} roughness={skin.ornaments.roughness} metalness={skin.ornaments.metalness} />
            </mesh>
          ))}
        {skin.ornaments.variant === "jagged-horn-vents" &&
          hornGeo &&
          Array.from({ length: skin.ornaments.count }, (_, i) => {
            const a = (i / skin.ornaments.count) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 0.14, 1.45, Math.sin(a) * 0.14]} rotation={[0, -a, 0]}>
                <mesh geometry={hornGeo} castShadow>
                  <meshStandardMaterial color={skin.ornaments.color} roughness={skin.ornaments.roughness} metalness={skin.ornaments.metalness} flatShading />
                </mesh>
                {skin.ornaments.tipGlow !== 0 && (
                  <mesh position={[0.42 * Math.sin(0.55), 0.42 * Math.cos(0.55), 0]}>
                    <icosahedronGeometry args={[0.045, 0]} />
                    <meshStandardMaterial color={"#1a0d08"} emissive={skin.ornaments.tipGlow} emissiveIntensity={2.4} flatShading />
                  </mesh>
                )}
              </group>
            );
          })}
      </group>

      {/* ---------- CORE ---------- */}
      {/* Two layers, not one: an unlit inner glow sphere (meshBasicMaterial
          ignores scene lighting entirely, so it stays a solid readable dot
          at any distance/scale) INSIDE a faceted shell whose emissiveMap
          carries the vein-crack detail. A single mesh with only the crack
          map read as a near-solid-black gem once the tower is small on
          screen — the map's background is pure black, so most of the
          surface between veins emits nothing; that's a real material
          limitation of "veins in dark stone," not a brightness knob to
          crank blindly (see the final report for the readback on this). */}
      <mesh position={[0, coreHeight, 0]}>
        <sphereGeometry args={[isEmberCore ? 0.15 : 0.095, 8, 8]} />
        <meshBasicMaterial color={skin.core.emissive} />
      </mesh>
      <mesh ref={coreMeshRef} position={[0, coreHeight, 0]}>
        <icosahedronGeometry args={[isEmberCore ? 0.26 : 0.17, isEmberCore ? 0 : 1]} />
        <meshStandardMaterial
          color={skin.core.shellColor}
          emissive={skin.core.emissive}
          emissiveMap={crackTex}
          emissiveIntensity={skin.core.emissiveIntensity}
          roughness={isEmberCore ? 0.55 : 0.3}
          metalness={0.1}
          flatShading={isEmberCore}
          transparent
          opacity={0.88}
        />
      </mesh>
      {isEmberCore &&
        [0, 1, 2].map((i) => (
          <mesh key={i} ref={(m) => void (m && (emberRefs.current[i] = m))} position={[0, coreHeight + 0.22, 0]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color={skin.core.emissive} emissive={skin.core.emissive} emissiveIntensity={2.6} />
          </mesh>
        ))}

      {/* ---------- SIDE ELEMENTS (hanging chains) ---------- */}
      {Array.from({ length: skin.sideElements.chainCount }, (_, i) => {
        const a = (i / skin.sideElements.chainCount) * Math.PI * 2 + 0.6;
        const r = 0.3;
        return (
          <group key={i} position={[Math.cos(a) * r, 0.95, Math.sin(a) * r]}>
            {[0, 1, 2].map((s) => (
              <mesh key={s} position={[0, -s * 0.11, 0]} rotation={[0, s * 0.6, Math.PI / 2]}>
                <torusGeometry args={[0.035, 0.012, 5, 8]} />
                <meshStandardMaterial color={skin.sideElements.chainColor} roughness={0.6} metalness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, -0.4, 0]}>
              <icosahedronGeometry args={[0.03, 0]} />
              <meshStandardMaterial color={"#100b08"} emissive={skin.sideElements.glowColor} emissiveIntensity={1.8} flatShading />
            </mesh>
          </group>
        );
      })}

      <pointLight position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={1.1} distance={2.6} />
      <pointLight ref={chargeRef} position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={0} distance={2.8} />
      <pointLight ref={flashRef} position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={0} distance={4} />
    </group>
  );
}
