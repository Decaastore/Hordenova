import { useMemo } from "react";
import * as THREE from "three";
import { FOREST } from "./palette";
import { PATH_3D, TOWER_SLOTS_3D } from "./worldData";
import { fbmNoise2D } from "./noise";
import { mulberry32 } from "./rng";
import { buildTaperedTube } from "./geometryUtils";
import { getStoneTexture } from "./proceduralTextures";

const FIELD_W = 56;
const FIELD_D = 36;
const SEGMENTS_X = 140;
const SEGMENTS_Z = 90;
const ROAD_HALF_WIDTH = 0.95;

function distanceToPath(x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < PATH_3D.length; i++) {
    const [ax, az] = PATH_3D[i - 1]!;
    const [bx, bz] = PATH_3D[i]!;
    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

function distanceToNearestTowerSlot(x: number, z: number): number {
  let best = Infinity;
  for (const [sx, sz] of TOWER_SLOTS_3D) {
    const d = Math.hypot(x - sx, z - sz);
    if (d < best) best = d;
  }
  return best;
}

/** Ground height at a world (x, z) — rolling hills via layered noise, flattened to 0 near the road so the path always reads as a walkable corridor. */
export function terrainHeightAt(x: number, z: number): number {
  const raw = (fbmNoise2D(x * 0.09, z * 0.09, 4) - 0.5) * 1.6 + (fbmNoise2D(x * 0.02, z * 0.02, 2) - 0.5) * 2.2;
  const dist = distanceToPath(x, z);
  const flatten = Math.min(1, Math.max(0, (dist - ROAD_HALF_WIDTH) / 2.2));
  return raw * flatten;
}

/**
 * TESTE VISUAL 3D — Whispering Woods ground: not a flat colored plane.
 * Rolling noise-displaced terrain, vertex-colored by height/moisture
 * blend (damp near-black earth in low spots, pale moss on rises), a real
 * dirt road ribbon carved flat along the actual 2D map's path curve, and
 * a scattered stream — the biome-storytelling elements requirement 3 asks
 * for, built procedurally (no external heightmap/texture assets).
 */
export function Terrain() {
  const groundGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(FIELD_W, FIELD_D, SEGMENTS_X, SEGMENTS_Z);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(FOREST.groundBase);
    const shadowed = new THREE.Color(FOREST.groundShadowed);
    const accentA = new THREE.Color(FOREST.groundAccentA);
    const accentB = new THREE.Color(FOREST.groundAccentB);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeightAt(x, z);
      pos.setY(i, h);

      const moisture = fbmNoise2D(x * 0.15 + 50, z * 0.15 + 50, 3);
      tmp.copy(base).lerp(shadowed, Math.max(0, -h / 1.6));
      tmp.lerp(accentA, moisture * 0.5);
      const patchy = fbmNoise2D(x * 0.35, z * 0.35, 2);
      if (patchy > 0.62) tmp.lerp(accentB, (patchy - 0.62) * 1.6);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const roadGeometry = useMemo(() => buildRoadRibbon(), []);
  const decorations = useMemo(() => buildDecorations(), []);

  return (
    <group>
      <mesh geometry={groundGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>

      <mesh geometry={roadGeometry} position={[0, 0.015, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      <Stream />
      <DustMotes />

      {decorations.trees.map((t, i) => (
        <TreeCluster key={`tree-${i}`} {...t} />
      ))}
      {decorations.rocks.map((r, i) => (
        <Rock key={`rock-${i}`} {...r} />
      ))}
      {decorations.moss.map((m, i) => (
        <mesh key={`moss-${i}`} position={[m.x, m.y + 0.02, m.z]} rotation={[-Math.PI / 2, 0, m.rot]} receiveShadow>
          <circleGeometry args={[m.scale, 10]} />
          <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={1} transparent opacity={0.55} />
        </mesh>
      ))}

      <RuinedArch />
      <FallenColumn x={-9.5} z={5.4} rot={0.6} />
      <FallenColumn x={-7.8} z={6.6} rot={2.1} />

      <BackgroundRidge />
      <ForegroundCluster />
    </group>
  );
}

/**
 * A distant, faceted ridge silhouette along the far edges of the field —
 * without it, the camera's new low cinematic angle looks straight into
 * an empty fog void past the last row of trees. Kept intentionally flat
 * and simple (a handful of large low-poly shapes, no fine detail) since
 * fog and distance are doing the "far away" work, not geometry density.
 */
function BackgroundRidge() {
  const ridgeSpecs = useMemo(() => {
    const rand = mulberry32(909);
    const specs: { x: number; z: number; w: number; h: number }[] = [];
    for (let i = 0; i < 9; i++) {
      specs.push({ x: -FIELD_W * 0.46 + i * (FIELD_W * 0.11), z: -FIELD_D * 0.62 - rand() * 4, w: 5 + rand() * 4, h: 3.2 + rand() * 2.6 });
    }
    for (let i = 0; i < 5; i++) {
      specs.push({ x: FIELD_W * 0.56 + rand() * 3, z: -FIELD_D * 0.3 + i * (FIELD_D * 0.28), w: 4.5 + rand() * 3, h: 2.8 + rand() * 2 });
    }
    return specs;
  }, []);
  const ridgeColor = useMemo(() => new THREE.Color(FOREST.vegetationDark).lerp(new THREE.Color(FOREST.fog), 0.45).getHex(), []);
  return (
    <group>
      {ridgeSpecs.map((s, i) => (
        <mesh key={i} position={[s.x, s.h * 0.42, s.z]} scale={[s.w, s.h, s.w * 0.6]}>
          <coneGeometry args={[0.5, 1, 5]} />
          <meshBasicMaterial color={ridgeColor} fog />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A rock-and-root cluster placed close to the camera's default framing —
 * without something occupying the near-frame, the strategic camera reads
 * as looking flatly at a diorama; a bold, slightly-out-of-focus-feeling
 * foreground shape (even without real depth-of-field) gives the shot
 * actual foreground/midground/background layering.
 */
function ForegroundCluster() {
  const x = 3.2;
  const z = 14.5;
  const y = terrainHeightAt(x, z);
  const stoneTex = getStoneTexture(FOREST.rock, FOREST.rockDark);
  const rootGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(-1.3, 0.35, 0), new THREE.Vector3(-0.4, 0.12, 0.3), new THREE.Vector3(0.6, 0.02, -0.1), new THREE.Vector3(1.4, 0.28, 0.15)],
        [0.22, 0.16, 0.13, 0.08],
        6,
      ),
    [],
  );
  return (
    <group position={[x, y, z]}>
      <mesh geometry={rootGeo} castShadow receiveShadow>
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.9, 0.42, 0.4]} rotation={[0.3, 0.6, 0.1]} scale={1.3} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={1} flatShading />
      </mesh>
      <mesh position={[-1.1, 0.22, -0.3]} rotation={[0.1, 1.2, 0.4]} scale={0.75} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={1} flatShading />
      </mesh>
      <mesh position={[0.1, 0.02, 0.6]} rotation={[-Math.PI / 2, 0, 0.3]} receiveShadow>
        <circleGeometry args={[0.9, 10]} />
        <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={1} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/**
 * A half-collapsed stone archway — the "estruturas/ruínas/elementos
 * arquitetônicos" requirement: this is what tells a viewer "someone
 * built something here, long before the battle" rather than just a
 * forest clearing. One pillar still stands with a broken lintel stub;
 * the other side collapsed into rubble at its base.
 */
function RuinedArch() {
  const x = -10.5;
  const z = 4.5;
  const y = terrainHeightAt(x, z);
  const stoneTex = getStoneTexture(FOREST.rock, FOREST.rockDark);
  const rootGeo = useMemo(
    () =>
      buildTaperedTube(
        [new THREE.Vector3(-0.5, 2.6, 0.4), new THREE.Vector3(-0.9, 2.0, 0.2), new THREE.Vector3(-1.25, 1.2, 0.35), new THREE.Vector3(-1.35, 0.3, 0.15)],
        [0.07, 0.055, 0.045, 0.02],
        5,
      ),
    [],
  );
  return (
    <group position={[x, y, z]} rotation={[0, 0.4, 0]}>
      {/* one pillar still standing, weathered — a root has grown down across its face over the years it's stood abandoned */}
      <mesh position={[-1.1, 1.7, 0]} rotation={[0, 0, 0.03]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.5, 3.4, 8]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.95} flatShading />
      </mesh>
      <mesh geometry={rootGeo} castShadow>
        <meshStandardMaterial color={FOREST.vegetationDark} roughness={0.9} />
      </mesh>
      <mesh position={[-1.1, 3.5, 0]} rotation={[0, 0, 0.03]} castShadow>
        <boxGeometry args={[1.05, 0.4, 1.05]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-1.05, 3.85, 0]} rotation={[0, 0.5, 0.55]} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.9]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.9} flatShading />
      </mesh>

      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[1.0 + i * 0.55, 0.3 + i * 0.07, i * 0.3]}
          rotation={[0.2 + i * 0.4, i, 1.4 + i * 0.2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.4 - i * 0.04, 0.46 - i * 0.04, 1.4 - i * 0.3, 8]} />
          <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.95} flatShading />
        </mesh>
      ))}
      <mesh position={[0.2, 0.15, -0.6]} rotation={[0, 0.8, 0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={1} flatShading />
      </mesh>
      {/* small rubble chips scattered at the base — the collapse happened here, not just "a rock nearby" */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`rubble-${i}`}
          position={[0.3 + i * 0.3 - 0.4, 0.06 + (i % 2) * 0.03, -0.9 + i * 0.22]}
          rotation={[i, i * 1.3, i * 0.7]}
          scale={0.14 + (i % 3) * 0.05}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={1} flatShading />
        </mesh>
      ))}

      <mesh position={[-1.1, 1.2, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 8]} />
        <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.15, 0.42, -0.55]} rotation={[-Math.PI / 2, 0, 0.6]}>
        <circleGeometry args={[0.32, 8]} />
        <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={1} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function FallenColumn({ x, z, rot }: { x: number; z: number; rot: number }) {
  const y = terrainHeightAt(x, z);
  const stoneTex = getStoneTexture(FOREST.rockDark, FOREST.groundShadowed);
  return (
    <group>
      <mesh position={[x, y + 0.34, z]} rotation={[0, rot, Math.PI / 2 + 0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.38, 2.1, 8]} />
        <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[x + Math.cos(rot) * 0.7, y + 0.04, z + Math.sin(rot) * 0.7]} rotation={[-Math.PI / 2, 0, rot]}>
        <circleGeometry args={[0.5, 8]} />
        <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={1} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function buildRoadRibbon(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const fill = new THREE.Color(FOREST.roadFill);
  const fillLight = new THREE.Color(FOREST.roadFillLight);
  const edge = new THREE.Color(FOREST.roadEdge);

  for (let i = 0; i < PATH_3D.length; i++) {
    const [x, z] = PATH_3D[i]!;
    const [px, pz] = PATH_3D[Math.max(0, i - 1)]!;
    const [nx, nz] = PATH_3D[Math.min(PATH_3D.length - 1, i + 1)]!;
    const dirX = nx - px;
    const dirZ = nz - pz;
    const len = Math.hypot(dirX, dirZ) || 1;
    // Perpendicular in the XZ plane.
    const perpX = -dirZ / len;
    const perpZ = dirX / len;
    const h = terrainHeightAt(x, z) + 0.02;

    const leftX = x + perpX * ROAD_HALF_WIDTH;
    const leftZ = z + perpZ * ROAD_HALF_WIDTH;
    const rightX = x - perpX * ROAD_HALF_WIDTH;
    const rightZ = z - perpZ * ROAD_HALF_WIDTH;

    positions.push(leftX, h, leftZ, rightX, h, rightZ);
    const rut = fbmNoise2D(x * 0.6, z * 0.6, 2);
    const edgeCol = edge.clone();
    const centerCol = fill.clone().lerp(fillLight, rut);
    colors.push(edgeCol.r, edgeCol.g, edgeCol.b, centerCol.r, centerCol.g, centerCol.b);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}
interface RockSpec {
  x: number;
  z: number;
  scale: number;
  rot: number;
}
interface MossSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
}

function buildDecorations(): { trees: TreeSpec[]; rocks: RockSpec[]; moss: MossSpec[] } {
  const rand = mulberry32(1312);
  const trees: TreeSpec[] = [];
  const rocks: RockSpec[] = [];
  const moss: MossSpec[] = [];

  // Cluster-based scatter (a handful of grove "centers", trees jittered
  // around each) reads as a real forest, not evenly-spaced decoration dots.
  const groveCount = 9;
  for (let g = 0; g < groveCount; g++) {
    const cx = (rand() - 0.5) * FIELD_W * 0.92;
    const cz = (rand() - 0.5) * FIELD_D * 0.92;
    if (distanceToPath(cx, cz) < 3.2) continue;
    const treesInGrove = 5 + Math.floor(rand() * 7);
    for (let t = 0; t < treesInGrove; t++) {
      const x = cx + (rand() - 0.5) * 5.5;
      const z = cz + (rand() - 0.5) * 5.5;
      if (distanceToPath(x, z) < 2.2) continue;
      if (distanceToNearestTowerSlot(x, z) < 1.9) continue;
      if (Math.abs(x) > FIELD_W / 2 - 1 || Math.abs(z) > FIELD_D / 2 - 1) continue;
      trees.push({ x, z, scale: 0.75 + rand() * 0.55, rot: rand() * Math.PI * 2, variant: Math.floor(rand() * 3) });
    }
  }

  for (let i = 0; i < 26; i++) {
    const x = (rand() - 0.5) * FIELD_W * 0.94;
    const z = (rand() - 0.5) * FIELD_D * 0.94;
    if (distanceToPath(x, z) < 1.6) continue;
    if (distanceToNearestTowerSlot(x, z) < 1.5) continue;
    rocks.push({ x, z, scale: 0.25 + rand() * 0.65, rot: rand() * Math.PI * 2 });
  }

  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * FIELD_W * 0.9;
    const z = (rand() - 0.5) * FIELD_D * 0.9;
    const d = distanceToPath(x, z);
    if (d < 1.1 || d > 8) continue;
    moss.push({ x, y: terrainHeightAt(x, z), z, scale: 0.4 + rand() * 0.9, rot: rand() * Math.PI * 2 });
  }

  return { trees, rocks, moss };
}

function TreeCluster({ x, z, scale, rot, variant }: TreeSpec) {
  const y = terrainHeightAt(x, z);
  const trunkH = 1.6 * scale;
  const canopyY = trunkH + 0.9 * scale;
  const canopyColor = variant === 0 ? FOREST.vegetationPrimary : variant === 1 ? FOREST.vegetationSecondary : FOREST.vegetationDark;
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09 * scale, 0.16 * scale, trunkH, 6]} />
        <meshStandardMaterial color={FOREST.vegetationDark} roughness={0.95} />
      </mesh>
      <mesh position={[0, canopyY, 0]} castShadow>
        <icosahedronGeometry args={[0.95 * scale, 0]} />
        <meshStandardMaterial color={canopyColor} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.35 * scale, canopyY + 0.55 * scale, 0.15 * scale]} castShadow>
        <icosahedronGeometry args={[0.55 * scale, 0]} />
        <meshStandardMaterial color={canopyColor} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.3 * scale, canopyY + 0.3 * scale, -0.3 * scale]} castShadow>
        <icosahedronGeometry args={[0.6 * scale, 0]} />
        <meshStandardMaterial color={FOREST.vegetationHighlight} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function Rock({ x, z, scale, rot }: RockSpec) {
  const y = terrainHeightAt(x, z);
  const stoneTex = getStoneTexture(FOREST.rock, FOREST.rockDark);
  return (
    <mesh position={[x, y + 0.25 * scale, z]} rotation={[rot * 0.3, rot, rot * 0.2]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.5 * scale, 0]} />
      <meshStandardMaterial map={stoneTex} color={0xffffff} roughness={1} flatShading />
    </mesh>
  );
}

function Stream() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const startX = FIELD_W * 0.32;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = startX - t * 9;
      const z = -FIELD_D * 0.38 + Math.sin(t * 4) * 1.4;
      pts.push(new THREE.Vector3(x, terrainHeightAt(x, z) + 0.04, z));
    }
    return pts;
  }, []);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 40, 0.35, 6, false), [curve]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={FOREST.waterLight} emissive={FOREST.waterDeep} emissiveIntensity={0.4} transparent opacity={0.75} roughness={0.15} metalness={0.2} />
    </mesh>
  );
}

function DustMotes() {
  const geo = useMemo(() => {
    const rand = mulberry32(77);
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * FIELD_W * 0.85;
      positions[i * 3 + 1] = rand() * 4.5 + 0.3;
      positions[i * 3 + 2] = (rand() - 0.5) * FIELD_D * 0.85;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color={FOREST.accentWarm} size={0.045} transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}
