import { useMemo } from "react";
import { getBiome } from "@/rendering/biomes";
import { buildGroundGeometry, buildMountainSilhouettes, buildRoadGeometry, parseBiomeColor } from "./worldTerrainGeometry";
import { buildVegetationMeshes } from "./worldVegetation";

/**
 * MUNDO 3D — FASE 1 fundamento visual: terrain shape + material + a
 * handful of background mountain silhouettes + fog/sky/lighting, all
 * derived from the SAME `BiomeDefinition` the 2D map already uses
 * (`getBiome(biomeId)`, `rendering/biomes/`) — the 3D ground automatically
 * matches whatever biome the current phase is in, no new palette to
 * author or keep in sync by hand.
 *
 * Everything here is built ONCE per biome change (`useMemo`, keyed on
 * `biomeId`) in the "local unscaled ground" space `enemyProjection.ts`'s
 * `worldToLocalGround` defines; the parent scales the whole group by the
 * real screen transform every resize (see WorldSceneOverlay.tsx) instead
 * of rebuilding geometry.
 */
export function WorldTerrain({ biomeId }: { biomeId: string }) {
  const biome = getBiome(biomeId);
  const palette = biome.palette;

  const groundGeometry = useMemo(() => buildGroundGeometry(palette), [biomeId]);
  const roadGeometry = useMemo(() => buildRoadGeometry(palette), [biomeId]);
  const mountains = useMemo(() => buildMountainSilhouettes(7), []);
  // MUNDO 3D — FASE 2 midground: real 3D trees/rocks at the SAME positions
  // `rendering/mapDecorations.ts` already scattered for the 2D TREE/ROCK/
  // RUIN sprites (CanvasRenderer skips drawing those specific kinds while
  // this layer is active — see its `skipDecorationKinds` — so each one
  // exists exactly once, never duplicated).
  const vegetation = useMemo(() => buildVegetationMeshes(palette), [biomeId]);

  const fogColor = useMemo(() => parseBiomeColor(palette.fogColor), [biomeId]);
  const skyColor = useMemo(() => parseBiomeColor(palette.skyBottom), [biomeId]);
  const mountainColor = useMemo(() => parseBiomeColor(palette.groundShadowed).lerp(fogColor, 0.55), [biomeId, fogColor]);
  const keyLightColor = useMemo(() => parseBiomeColor(palette.accentWarm), [biomeId]);
  const hemiSky = useMemo(() => parseBiomeColor(palette.skyTop), [biomeId]);
  const hemiGround = useMemo(() => parseBiomeColor(palette.groundShadowed), [biomeId]);

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fogExp2 attach="fog" args={[fogColor, 0.0016]} />

      <hemisphereLight args={[hemiSky, hemiGround, 0.75]} />
      <ambientLight color={hemiSky} intensity={0.4} />
      {/* MUNDO 3D — FASE 2: key light raised 1.9->2.6 and the fill light
          0.35->0.6 — the deep-forest palette's vegetation tones are close
          to black, so under the FASE 1 intensities the directional light
          could never carve out visible highlight/shadow facets on trees or
          terrain, which is the concrete reason the play area read as flat.
          Paired with worldVegetation.ts's own lifted (3D-only) canopy/rock
          tones, this is what actually makes shading — not just geometry —
          visible within the play area. */}
      <directionalLight
        position={[420, 900, 260]}
        intensity={2.6}
        color={keyLightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={200}
        shadow-camera-far={2200}
        shadow-camera-left={-620}
        shadow-camera-right={620}
        shadow-camera-top={460}
        shadow-camera-bottom={-460}
        shadow-bias={-0.0012}
      />
      <directionalLight position={[-300, 500, -400]} intensity={0.6} color={hemiSky} />

      <mesh geometry={groundGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0.02} />
      </mesh>

      {mountains.map((m, i) => (
        <mesh key={i} geometry={m.geometry} position={m.position}>
          <meshStandardMaterial color={mountainColor} roughness={1} flatShading fog />
        </mesh>
      ))}

      {vegetation.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  );
}
