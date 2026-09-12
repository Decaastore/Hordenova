import * as THREE from "three";
import { MAP_DECORATIONS } from "@/rendering/mapDecorations";
import { buildTaperedTube, buildJaggedPlateShape } from "@/lab3d/geometryUtils";
import { mulberry32 } from "@/lab3d/rng";
import { worldToLocalGround } from "../enemyProjection";
import { terrainElevationAt, parseBiomeColor } from "./worldTerrainGeometry";
import type { BiomePalette } from "@/rendering/biomes";

/**
 * MUNDO 3D — FASE 2 "midground": the 2D scenery already scatters TREE/ROCK/
 * RUIN decorations across the map (`rendering/mapDecorations.ts`'s
 * `MAP_DECORATIONS`, generated once with a fixed seed). This file builds a
 * REAL 3D counterpart for exactly those three kinds, reading the SAME
 * array — same positions, same rotation, same scale, same variant — so
 * nothing is duplicated or re-authored; `CanvasRenderer.tsx` is told to
 * stop drawing the 2D sprite for those kinds while this layer is active
 * (see its `skipDecorationKinds` param), so each decoration exists exactly
 * once, now as real geometry sitting on the actual rolling terrain height
 * (`terrainElevationAt`) instead of a flat painted icon. GRASS/FLOWER/
 * WATER/TORCH/ROOT/CRYSTAL stay 2D (small, cheap, already read well at
 * ground level — converting them would cost more than it visually buys).
 *
 * Perf: one THREE.InstancedMesh per (kind, mesh-part) — trunks, canopies,
 * rocks — geometry and material built ONCE and shared across every
 * instance; only a per-instance matrix (and, for canopies/rocks, an
 * instance color) is written, no per-frame work at all since the whole
 * forest is static in world space.
 */

const TRUNK_HEIGHT = 14;
const CANOPY_POINTS: readonly [number, number][] = [
  [10, 13],
  [18, 12],
  [26, 9],
  [34, 5],
  [40, 0],
];

function buildTreeTrunkGeometry(): THREE.BufferGeometry {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, TRUNK_HEIGHT, 0)];
  return buildTaperedTube(points, [2.6, 1.6], 6, true);
}

/** A single lofted silhouette standing in for the layered-blob canopy the 2D tree draws — an organic taper, never a bare ConeGeometry primitive. */
function buildTreeCanopyGeometry(): THREE.BufferGeometry {
  const points = CANOPY_POINTS.map(([y]) => new THREE.Vector3(0, y, 0));
  const radii = CANOPY_POINTS.map(([, r]) => r);
  return buildTaperedTube(points, radii, 7, true);
}

/** An irregular boulder (extruded jagged plate, not a bare box/sphere) reused for both ROCK and RUIN decorations — a coherent procedural placeholder per the direction's "prefira elementos procedurais simples mas coerentes" guidance. */
function buildRockGeometry(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const shape = buildJaggedPlateShape(6, 7, rand);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 4.5, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 2.2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

interface Placement {
  position: THREE.Vector3;
  rotationY: number;
  scale: number;
  variant: number;
}

function collectPlacements(kinds: ReadonlySet<string>): Placement[] {
  const placements: Placement[] = [];
  for (const deco of MAP_DECORATIONS) {
    if (!kinds.has(deco.kind)) continue;
    const elevation = terrainElevationAt(deco.position.x, deco.position.y) - 1;
    const [lx, , lz] = worldToLocalGround(deco.position);
    placements.push({ position: new THREE.Vector3(lx, elevation, lz), rotationY: deco.rotation, scale: deco.scale, variant: deco.variant });
  }
  return placements;
}

const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

function buildInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly Placement[],
  colorByVariant?: readonly THREE.Color[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(placements.length, 1));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  placements.forEach((p, i) => {
    tmpMatrix.makeRotationY(p.rotationY);
    tmpMatrix.scale(new THREE.Vector3(p.scale, p.scale, p.scale));
    tmpMatrix.setPosition(p.position);
    mesh.setMatrixAt(i, tmpMatrix);
    if (colorByVariant) {
      tmpColor.copy(colorByVariant[p.variant % colorByVariant.length]!);
      mesh.setColorAt(i, tmpColor);
    }
  });
  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Built once per biome change — everything here is static in world space, so this is never touched again per-frame (see WorldTerrain.tsx's useMemo). */
export function buildVegetationMeshes(palette: BiomePalette): THREE.Object3D[] {
  const treePlacements = collectPlacements(new Set(["TREE"]));
  const rockPlacements = collectPlacements(new Set(["ROCK", "RUIN"]));

  // MUNDO 3D — FASE 2: the palette's vegetation tones are AUTHORED very
  // dark (a deliberate moody-forest choice for the 2D icons, which read
  // fine as small flat sprites) — lit with a real directional light and
  // flat-shaded facets, that same near-black albedo stayed near-black
  // regardless of light intensity, so the trees rendered as flat dark
  // blobs with no visible form. Lifting the 3D-only copy of these tones
  // toward white (never touching the palette itself, so the 2D icons and
  // every other consumer of `BiomePalette` are unaffected) is what lets
  // the directional light actually carve out visible canopy facets.
  const lift = (c: THREE.Color, amount: number): THREE.Color => c.clone().lerp(new THREE.Color(0xffffff), amount);
  const bark = parseBiomeColor(palette.groundShadowed).lerp(new THREE.Color(0x1a120a), 0.4);
  const canopyColors = [
    lift(parseBiomeColor(palette.vegetationPrimary), 0.28),
    lift(parseBiomeColor(palette.vegetationSecondary), 0.28),
    lift(parseBiomeColor(palette.vegetationDark), 0.32),
  ];
  const rockColors = [lift(parseBiomeColor(palette.rock), 0.12), lift(parseBiomeColor(palette.rockDark), 0.18)];

  const trunks = buildInstancedMesh(
    buildTreeTrunkGeometry(),
    new THREE.MeshStandardMaterial({ color: bark, roughness: 0.95 }),
    treePlacements,
  );
  const canopies = buildInstancedMesh(
    buildTreeCanopyGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }),
    treePlacements,
    canopyColors,
  );
  const rocks = buildInstancedMesh(
    buildRockGeometry(4231),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, flatShading: true }),
    rockPlacements,
    rockColors,
  );

  return [trunks, canopies, rocks];
}
