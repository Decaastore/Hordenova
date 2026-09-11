import { useMemo } from "react";
import * as THREE from "three";
import { FOREST } from "./palette";
import { PATH_3D, TOWER_SLOTS_3D } from "./worldData";
import { fbmNoise2D } from "./noise";
import { mulberry32 } from "./rng";

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
  return (
    <mesh position={[x, y + 0.25 * scale, z]} rotation={[rot * 0.3, rot, rot * 0.2]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.5 * scale, 0]} />
      <meshStandardMaterial color={FOREST.rock} roughness={1} flatShading />
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
