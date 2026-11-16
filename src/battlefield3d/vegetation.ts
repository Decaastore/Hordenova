import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD_SIZE } from "@/config/gameBalance";
import type { Vector2 } from "@/utils/geometry";
import type { BiomeDefinition } from "@/rendering/biomes/types";
import { fbmNoise2D } from "@/lab3d/noise";
import { TERRAIN_DEPTH, TERRAIN_MARGIN_X, TERRAIN_MARGIN_Z, TERRAIN_WIDTH, worldToThree } from "./coords";
import type { TerrainData } from "./terrain";

/**
 * CAMPO DE BATALHA 3D — scenery: a dense wood around the clearing, scattered
 * trees and mossy boulders inside it, and wind-blown grass everywhere the
 * road and the pads leave room. All instanced (one draw call per kind), and
 * all placed from a fixed seed so the scene never reshuffles.
 */

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function displaced(geo: THREE.BufferGeometry, amount: number, freq: number, seed: number): THREE.BufferGeometry {
  const g = geo.toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  // displace by position so shared corners stay welded
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbmNoise2D(v.x * freq + seed, v.z * freq + v.y * freq * 0.7 + seed * 2, 3) - 0.5;
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Vertex colours from a dark underside to a sunlit top, so foliage reads as volume from above. */
function shadeByHeight(geo: THREE.BufferGeometry, y0: number, y1: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) - y0) / (y1 - y0)));
    const k = 0.35 + t * 0.6;
    col[i * 3] = k * 0.95;
    col[i * 3 + 1] = k;
    col[i * 3 + 2] = k * 0.85;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

export interface Scenery {
  group: THREE.Group;
  /** Wind sway uniform shared by grass and leaves. */
  windTime: { value: number };
}

export function buildScenery(
  biome: BiomeDefinition,
  terrain: TerrainData,
  pads: readonly Vector2[],
  castle: Vector2,
  path: readonly Vector2[],
  quality: "low" | "high",
): Scenery {
  const P = biome.palette;
  const group = new THREE.Group();
  const windTime = { value: 0 };
  const rand = rng(90210);
  const W = WORLD_SIZE.width;
  const H = WORLD_SIZE.height;
  const blocked = (p: Vector2, r: number) =>
    terrain.roadDistance(p) < 34 + r ||
    pads.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 40 + r) ||
    Math.hypot(castle.x - p.x, castle.y - p.y) < 120 + r ||
    Math.hypot(path[0]!.x - p.x, path[0]!.y - p.y) < 70 + r;

  // ------------------------------------------------------------- trees
  const trees: { p: Vector2; s: number; rot: number }[] = [];
  const tryTree = (p: Vector2, s: number) => {
    if (blocked(p, 10 * s)) return;
    if (trees.some((t) => Math.hypot(t.p.x - p.x, t.p.y - p.y) < 22 * Math.max(s, t.s))) return;
    trees.push({ p, s, rot: rand() * Math.PI * 2 });
  };
  // the wood around the clearing: dense outside, thinning towards the play area
  const maxTrees = quality === "high" ? 950 : 560;
  for (let k = 0; k < 9000 && trees.length < maxTrees; k++) {
    const p = { x: -TERRAIN_MARGIN_X + rand() * TERRAIN_WIDTH, y: -TERRAIN_MARGIN_Z + rand() * TERRAIN_DEPTH };
    const out = Math.max(-p.x, p.x - W, -p.y, p.y - H);
    const inside = out < 0;
    const clump = fbmNoise2D(p.x * 0.012, p.y * 0.012, 2);
    const chance = inside ? 0.03 + (clump > 0.6 ? 0.3 : 0) : out < 40 ? 0.7 : 0.98;
    if (rand() < chance) tryTree(p, (inside ? 0.8 : 1.0) + rand() * 0.55);
  }

  const bark = new THREE.MeshStandardMaterial({ color: new THREE.Color("#3a2c22"), roughness: 0.95 });
  const windSway = (shader: { uniforms: Record<string, unknown>; vertexShader: string }) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec4 wpos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float sway = sin(uTime * 0.9 + wpos.x * 0.03 + wpos.z * 0.02) * 0.9 * max(0.0, position.y - 12.0) / 45.0;
         transformed.x += sway;`,
      );
  };

  // --- conifers: stacked ragged cones
  const tiers: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const r = 15 - k * 2.6;
    const h = 17 - k * 1.6;
    const cone = new THREE.ConeGeometry(r, h, 9, 2, true);
    cone.translate(0, 12 + k * 8.5 + h / 2, 0);
    tiers.push(displaced(cone, 0.28, 0.35, k * 3 + 1));
  }
  const pineCrown = shadeByHeight(mergeGeometries(tiers), 12, 60);

  // --- broadleaf: a cluster of lumpy foliage balls, darker underneath, sunlit on top
  const blobs: THREE.BufferGeometry[] = [];
  const blobDefs = [
    [0, 30, 0, 13],
    [8, 26, 4, 9.5],
    [-8, 27, -3, 10],
    [3, 25, -8, 9],
    [-4, 36, 3, 9],
  ] as const;
  blobDefs.forEach(([x, y, z, r], k) => {
    const b = new THREE.IcosahedronGeometry(r, quality === "high" ? 2 : 1);
    b.translate(x, y, z);
    blobs.push(displaced(b, 0.32, 0.22, k * 5 + 2));
  });
  const oakTrunkGeo = new THREE.CylinderGeometry(1.3, 2.6, 24, 7, 2);
  oakTrunkGeo.translate(0, 12, 0);
  const oakCrown = shadeByHeight(mergeGeometries(blobs), 16, 44);

  const trunkGeo = new THREE.CylinderGeometry(1.1, 2.4, 22, 7, 2);
  trunkGeo.translate(0, 11, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  leafMat.onBeforeCompile = windSway;
  const oakMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, vertexColors: true, flatShading: false });
  oakMat.onBeforeCompile = windSway;

  const pines = trees.filter((_, i) => (i * 7919) % 10 < 4);
  const oaks = trees.filter((_, i) => (i * 7919) % 10 >= 4);
  const pineTrunks = new THREE.InstancedMesh(trunkGeo, bark, pines.length);
  const pineLeaves = new THREE.InstancedMesh(pineCrown, leafMat, pines.length);
  const oakTrunks = new THREE.InstancedMesh(oakTrunkGeo, bark, oaks.length);
  const oakLeaves = new THREE.InstancedMesh(oakCrown, oakMat, oaks.length);
  for (const im of [pineTrunks, pineLeaves, oakTrunks, oakLeaves]) im.castShadow = im.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const pineGreens = ["#1f3326", "#253c2a", "#2c4630", "#1a2b24"].map((h) => new THREE.Color(h));
  const oakGreens = [P.vegetationPrimary, "#24461e", "#2c4a22", "#1c3618", "#34502a"].map((h) => new THREE.Color(h));
  const place = (list: typeof trees, trunk: THREE.InstancedMesh, crown: THREE.InstancedMesh, greens: THREE.Color[], tall: number) =>
    list.forEach((t, i) => {
      const base = worldToThree(t.p, terrain.heightAt(t.p) - 0.5);
      e.set((rand() - 0.5) * 0.06, t.rot, (rand() - 0.5) * 0.06);
      q.setFromEuler(e);
      const sc = new THREE.Vector3(t.s, t.s * (1 + rand() * tall), t.s);
      m.compose(base, q, sc);
      trunk.setMatrixAt(i, m);
      crown.setMatrixAt(i, m);
      crown.setColorAt(i, c.copy(greens[Math.floor(rand() * greens.length)]!).multiplyScalar(0.75 + rand() * 0.35));
    });
  place(pines, pineTrunks, pineLeaves, pineGreens, 0.45);
  place(oaks, oakTrunks, oakLeaves, oakGreens, 0.2);
  group.add(pineTrunks, pineLeaves, oakTrunks, oakLeaves);

  // ------------------------------------------------------------- boulders
  const rocks: { p: Vector2; s: number }[] = [];
  for (let k = 0; k < 900 && rocks.length < 45; k++) {
    const p = { x: -80 + rand() * (W + 160), y: -60 + rand() * (H + 120) };
    if (blocked(p, 4)) continue;
    if (fbmNoise2D(p.x * 0.015 + 4, p.y * 0.015, 2) < 0.52) continue;
    rocks.push({ p, s: 0.5 + rand() * 1.6 });
  }
  const rockGeo = displaced(new THREE.DodecahedronGeometry(6, 1), 0.45, 0.2, 9);
  rockGeo.scale(1, 0.62, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.02 });
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rockMesh.castShadow = rockMesh.receiveShadow = true;
  const rockA = new THREE.Color(P.rock);
  const rockB = new THREE.Color(P.rockDark);
  rocks.forEach((r, i) => {
    e.set(rand() * 0.4, rand() * 6, rand() * 0.4);
    q.setFromEuler(e);
    m.compose(worldToThree(r.p, terrain.heightAt(r.p) + 0.5 * r.s), q, new THREE.Vector3(r.s * (0.8 + rand() * 0.5), r.s, r.s * (0.8 + rand() * 0.5)));
    rockMesh.setMatrixAt(i, m);
    rockMesh.setColorAt(i, c.copy(rockA).lerp(rockB, rand() * 0.7).lerp(new THREE.Color(P.vegetationDark), rand() * 0.25));
  });
  group.add(rockMesh);

  // ------------------------------------------------------------- grass
  const bladeGeo = new THREE.BufferGeometry();
  // one tapered blade, two triangles, bent forward a little
  bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.8, 0, 0, 0.8, 0, 0, -0.4, 5, 0.6, 0.4, 5, 0.6, 0, 9, 2], 3));
  bladeGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  bladeGeo.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float k = position.y / 9.0;
         transformed.x += sin(uTime * 2.1 + gw.x * 0.08 + gw.z * 0.05) * 1.1 * k * k;
         transformed.z += cos(uTime * 1.7 + gw.x * 0.05) * 0.5 * k * k;`,
      );
  };
  const grassCount = quality === "high" ? 60000 : 18000;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grass.receiveShadow = true;
  let placed = 0;
  const g1 = new THREE.Color(P.vegetationPrimary);
  const g2 = new THREE.Color(P.vegetationHighlight);
  const g3 = new THREE.Color(P.groundAccentA);
  for (let k = 0; k < grassCount * 3 && placed < grassCount; k++) {
    const p = { x: -60 + rand() * (W + 120), y: -50 + rand() * (H + 100) };
    const rd = terrain.roadDistance(p);
    if (rd < 22 + rand() * 10) continue;
    if (pads.some((pp) => Math.hypot(pp.x - p.x, pp.y - p.y) < 24)) continue;
    const dens = fbmNoise2D(p.x * 0.03, p.y * 0.03, 2);
    if (rand() > dens * 1.6) continue;
    e.set(0, rand() * 6.3, 0);
    q.setFromEuler(e);
    const s = 0.6 + rand() * 0.9;
    m.compose(worldToThree(p, terrain.heightAt(p) - 0.2), q, new THREE.Vector3(s, s * (0.7 + dens), s));
    grass.setMatrixAt(placed, m);
    grass.setColorAt(placed, c.copy(g1).lerp(g2, rand() * 0.6).lerp(g3, rand() * 0.4).multiplyScalar(0.55 + rand() * 0.3));
    placed++;
  }
  grass.count = placed;
  group.add(grass);

  return { group, windTime };
}
