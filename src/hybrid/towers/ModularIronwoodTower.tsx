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

/**
 * HERO PASS — the Ironwood base skin's silhouette, redesigned around one
 * question: does the black shape alone read? Bottom to top: a WIDE, heavy
 * stone drum (the "this is load-bearing" read) narrowing through a rune
 * shoulder-band into a much thinner wood spire (the "this is grown, not
 * built" read) up to a slender neck — then the neck flares back OUT into
 * a metal collar that is WIDER than the neck, so the silhouette bulges
 * again right where the crystal sits. That bulge-narrow-bulge profile
 * (heavy / slender / heavy) is the actual silhouette work: a single
 * uniform taper (the old design) reads as "a stick," no matter how
 * detailed its texture is.
 *
 * Two separate lofts, not one continuous tube, because the drum is stone
 * and the spire is wood — genuinely different materials meeting at a
 * visible seam (the rune shoulder-band) is the point, not an accident of
 * how the geometry happens to be built.
 */
const DRUM_POINTS = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.2, 0.01), new THREE.Vector3(-0.015, 0.4, 0)];
const DRUM_RADII = [0.52, 0.49, 0.4];

const SPIRE_POINTS = [new THREE.Vector3(-0.015, 0.4, 0), new THREE.Vector3(0.035, 0.72, 0.02), new THREE.Vector3(-0.02, 0.98, -0.015), new THREE.Vector3(0, 1.16, 0)];
const SPIRE_RADII = [0.4, 0.27, 0.18, 0.13];

/**
 * The crystal is a LatheGeometry gem profile (6 radial segments = hard
 * hexagonal facets, not a smooth sphere and not an icosahedron primitive)
 * — a shape that reads as "cut gem" on its own silhouette, before any
 * emissive or color is applied. This is what TESTE 4 (materials/effects
 * off) needs to still look interesting.
 */
const GEM_PROFILE = [new THREE.Vector2(0, -0.31), new THREE.Vector2(0.2, -0.1), new THREE.Vector2(0.25, 0.08), new THREE.Vector2(0.13, 0.29), new THREE.Vector2(0, 0.38)];

const IRONWOOD_CORE_HEIGHT = 1.45;

// Crystal mount geometry (base skin only) — module-level because the
// strut geometry list is memoized independently of the render-time
// collarY/collarRadius locals below.
const NECK_RADIUS = 0.13;
const COLLAR_Y = 1.28;
const COLLAR_RADIUS = 0.32;

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

  const coreHeight = IRONWOOD_CORE_HEIGHT * skin.core.scale;

  // --- BASE ---------------------------------------------------------
  const brokenRockGeo = useMemo(() => {
    if (skin.base.variant !== "broken-rock") return null;
    const rand = mulberry32(5);
    return new THREE.ExtrudeGeometry(buildJaggedPlateShape(0.78, 8, rand), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
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
  const drumGeo = useMemo(() => (skin.body.variant === "gnarled-trunk" ? buildTaperedTube(DRUM_POINTS, DRUM_RADII, 9) : null), [skin.body.variant]);
  const spireGeoBase = useMemo(() => (skin.body.variant === "gnarled-trunk" ? buildTaperedTube(SPIRE_POINTS, SPIRE_RADII, 8) : null), [skin.body.variant]);
  const spireGeo = useMemo(
    () => (skin.body.variant === "twisted-spire" ? buildTaperedTube(buildSpirePoints(1.55, 14, 1.4, 0.14), [0.34, 0.3, 0.26, 0.22, 0.19, 0.17, 0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.08, 0.06, 0.04], 8) : null),
    [skin.body.variant],
  );
  const stoneTex = useMemo(() => getStoneTexture(skin.body.stoneColor, 0x1a1712), [skin.body.stoneColor]);
  const woodTex = useMemo(() => getWoodTexture(skin.body.textureBase, skin.body.textureDark), [skin.body.textureBase, skin.body.textureDark]);
  const bodyTexNonWood = useMemo(() => getStoneTexture(skin.body.textureBase, skin.body.textureDark), [skin.body.textureBase, skin.body.textureDark]);

  // --- ORNAMENTS: metal struts bracing the crystal collar (base skin) --
  // Each strut's geometry is built directly from its own from->to 3D
  // points (buildTaperedTube handles arbitrary orientation itself), so
  // there's no separate position/rotation/scale alignment math needed —
  // the geometry already sits exactly where it should.
  const strutList = useMemo(() => {
    if (skin.ornaments.variant !== "curled-iron-prongs") return [];
    return Array.from({ length: skin.ornaments.count }, (_, i) => {
      const a = (i / skin.ornaments.count) * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * NECK_RADIUS, COLLAR_Y - 0.16, Math.sin(a) * NECK_RADIUS);
      const to = new THREE.Vector3(Math.cos(a) * COLLAR_RADIUS, COLLAR_Y, Math.sin(a) * COLLAR_RADIUS);
      return buildTaperedTube([from, to], [0.032, 0.018], 6);
    });
  }, [skin.ornaments.variant, skin.ornaments.count]);
  const hornGeo = useMemo(
    () => (skin.ornaments.variant === "jagged-horn-vents" ? buildTaperedTube(buildShardPoints(0.42, 0, 0.55), [0.055, 0.03, 0.006], 6) : null),
    [skin.ornaments.variant],
  );

  // --- CORE --------------------------------------------------------
  const crackTex = useMemo(() => getCrackTexture(skin.core.crackColor), [skin.core.crackColor]);
  const gemGeo = useMemo(() => (skin.core.variant === "faceted-rune-crystal" ? new THREE.LatheGeometry(GEM_PROFILE, 6) : null), [skin.core.variant]);

  useFrame((_, dt) => {
    const t = performance.now() * 0.001;
    if (coreRef.current) {
      coreRef.current.rotation.y += dt * (skin.body.variant === "twisted-spire" ? 0.12 : 0.16);
      // RECOIL — the whole upper structure (body + collar + crystal, all
      // physically mounted together) dips and springs back on fire,
      // driven by the same attackT decay that runs the muzzle flash, so
      // recoil and flash always land on the same beat.
      coreRef.current.position.y = -attackT.current * 0.045;
    }
    if (coreMeshRef.current) {
      const bob = Math.sin(t * skin.core.pulseSpeed) * 0.035;
      coreMeshRef.current.position.y = coreHeight + bob;
      const pulse = 1 + Math.sin(t * skin.core.pulseSpeed * 1.6) * 0.05;
      const chargeScale = pulse + chargeT.current * 0.3;
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
      if (chargeRef.current) chargeRef.current.intensity = chargeT.current * 16000;
    } else if (chargeRef.current) {
      chargeRef.current.intensity = 0;
    }
    if (attackT.current > 0) {
      attackT.current = Math.max(0, attackT.current - dt * 2.6);
      if (flashRef.current) flashRef.current.intensity = attackT.current * 40000;
    } else if (flashRef.current) {
      flashRef.current.intensity = 0;
    }
  });

  const isEmberCore = skin.core.variant === "molten-ember-core";
  const isBaseTower = skin.body.variant === "gnarled-trunk";
  const collarY = isBaseTower ? 1.28 : 1.42;
  // Wider than the old 0.24 — at the game's real near-top-down camera
  // angle, vertical silhouette nuance (the neck/collar taper) barely
  // reads; what actually carries "there is a socket holding a gem here"
  // from that angle is the collar's horizontal footprint sitting clearly
  // outside the gem's own radius, seen as a ring around a bright center.
  const collarRadius = isBaseTower ? 0.32 : 0.22;

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
        {isBaseTower && drumGeo && spireGeoBase && (
          <>
            {/* PEDRA — wide, heavy, matte, load-bearing drum */}
            <mesh geometry={drumGeo} position={[0, 0.1, 0]} castShadow>
              <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.93} metalness={0} flatShading />
            </mesh>
            {/* rune shoulder-band — the visible seam where stone becomes
                wood, marked as a deliberate joint rather than hidden */}
            <mesh position={[0, 0.5, 0]} castShadow>
              <torusGeometry args={[0.41, 0.03, 6, 20]} />
              <meshStandardMaterial color={skin.body.bandColor} emissive={skin.core.emissive} emissiveMap={crackTex} emissiveIntensity={0.9} roughness={skin.body.bandRoughness} metalness={skin.body.bandMetalness} />
            </mesh>
            {/* MADEIRA — slender, organic, tapering neck rising out of the drum */}
            <mesh geometry={spireGeoBase} position={[0, 0.1, 0]} castShadow>
              <meshStandardMaterial map={woodTex} color={0xffffff} roughness={0.85} metalness={0} />
            </mesh>
          </>
        )}
        {skin.body.variant === "twisted-spire" && spireGeo && (
          <mesh geometry={spireGeo} position={[0, 0.08, 0]} castShadow>
            <meshStandardMaterial map={bodyTexNonWood} color={0xffffff} roughness={skin.body.roughness} metalness={skin.body.metalness} flatShading />
          </mesh>
        )}
        {skin.body.variant === "twisted-spire" && (
          <mesh position={[0, 1.3, 0]} castShadow>
            <torusGeometry args={[0.16, 0.045, 6, 12]} />
            <meshStandardMaterial color={skin.body.bandColor} roughness={skin.body.bandRoughness} metalness={skin.body.bandMetalness} />
          </mesh>
        )}

        {/* ---------- ORNAMENTS: METAL — the crystal's mount ---------- */}
        {/* A collar ring WIDER than the neck it sits on (so the silhouette
            bulges again here) plus short braces running from the neck up
            to the collar. Both stop BELOW the crystal's own vertical
            center and stay INSIDE its horizontal radius margin, so from
            the game's actual top-down-tilted camera nothing here ever
            overlaps the crystal — the exact framing bug the previous
            curled-inward prongs had. */}
        {isBaseTower && (
          <mesh position={[0, collarY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[collarRadius, 0.036, 8, 20]} />
            {/* A faint glow tying the socket to what it holds — the "eye"
                read (dark body / bright metal ring / glowing center) is
                the single strongest cue at the game's real top-down angle. */}
            <meshStandardMaterial color={skin.ornaments.color} emissive={skin.core.emissive} emissiveIntensity={0.35} roughness={0.35} metalness={0.7} />
          </mesh>
        )}
        {isBaseTower &&
          strutList.map((geo, i) => (
            <mesh key={i} geometry={geo} castShadow>
              <meshStandardMaterial color={skin.ornaments.color} roughness={0.45} metalness={0.6} />
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

        {/* ---------- CORE ---------- */}
        {/* Physically mounted ON the collar (nested in the same rotating/
            recoiling group), not a separate floating object — and, per
            the readback in the final report, the shell is a faceted
            LatheGeometry gem (reads as "cut crystal" even with materials
            off) plus an UNLIT inner glow sphere: a crack-map-only emissive
            gem is near-solid-black once it's small on screen (the map's
            background is pure black between veins), so the unlit sphere
            is what actually carries "this is the signature" at the real
            top-down game distance, with the faceted shell adding detail
            only visible up close. */}
        <mesh position={[0, coreHeight, 0]}>
          <sphereGeometry args={[isEmberCore ? 0.15 : 0.16, 8, 8]} />
          <meshBasicMaterial color={skin.core.emissive} />
        </mesh>
        {isBaseTower && gemGeo ? (
          <mesh ref={coreMeshRef} position={[0, coreHeight, 0]}>
            <primitive object={gemGeo} attach="geometry" />
            <meshStandardMaterial
              color={skin.core.shellColor}
              emissive={skin.core.emissive}
              emissiveMap={crackTex}
              emissiveIntensity={skin.core.emissiveIntensity}
              roughness={0.25}
              metalness={0.08}
              transparent
              opacity={0.82}
            />
          </mesh>
        ) : (
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
        )}
        {isEmberCore &&
          [0, 1, 2].map((i) => (
            <mesh key={i} ref={(m) => void (m && (emberRefs.current[i] = m))} position={[0, coreHeight + 0.22, 0]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color={skin.core.emissive} emissive={skin.core.emissive} emissiveIntensity={2.6} />
            </mesh>
          ))}

        {/* `distance` on a PointLight is a raw WORLD-UNIT cutoff radius —
            it is NOT rescaled by an ancestor's `scale` the way `position`
            is. These lights live inside a group scaled by TOWER_SCALE
            (60), so the old `distance={2.6}`-ish values were a cutoff of
            2.6 WORLD units around a tower whose own geometry spans tens
            to ~90 world units — every one of these lights was illuminating
            almost nothing beyond its own bulb. `distance={0}` removes the
            cutoff (physically-correct inverse-square falloff only); the
            large intensities below are candela values sized for the
            actual world-scale distances involved, not the old pre-scale
            numbers. This was the real reason material/color fixes on the
            drum and spire alone never changed the render — see the final
            report. */}
        <pointLight position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={8000} distance={0} decay={2} />
        <pointLight ref={chargeRef} position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={0} distance={0} decay={2} />
        <pointLight ref={flashRef} position={[0, coreHeight, 0]} color={skin.core.emissive} intensity={0} distance={0} decay={2} />
      </group>

      {/* Tower-local key light. The shared scene directional light (see
          HybridScene3D.tsx) lights the whole arena from one fixed angle;
          at the game's real near-top-down camera, that leaves every
          non-flat, non-emissive surface here (the drum, the spire, the
          collar) receiving almost no light at all — no amount of base
          material color mattered until this existed, which is why the
          value-hierarchy recolor alone didn't fix the read. This is a
          point light (not directional/spot), so it needs no `target`
          object and only affects geometry near its own position — it
          does not relight the shared scene, Brute included, beyond
          whatever incidental falloff reaches it while adjacent. */}
      <pointLight position={[0, 1.9, 0.5]} intensity={9000} distance={0} decay={2} color={"#fff3d8"} />

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
    </group>
  );
}
