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
  for (let k = 0; k < 2600 && trees.length < (quality === "high" ? 420 : 220); k++) {
    const p = { x: -TERRAIN_MARGIN_X + rand() * TERRAIN_WIDTH, y: -TERRAIN_MARGIN_Z + rand() * TERRAIN_DEPTH };
    const out = Math.max(-p.x, p.x - W, -p.y, p.y - H);
    const inside = out < 0;
    const chance = inside ? 0.035 + (fbmNoise2D(p.x * 0.01, p.y * 0.01, 2) > 0.6 ? 0.25 : 0) : 0.95;
    if (rand() < chance) tryTree(p, (inside ? 0.85 : 1.05) + rand() * 0.6);
  }

  const bark = new THREE.MeshStandardMaterial({ color: new THREE.Color("#3a2c22"), roughness: 0.95 });
  const trunkGeo = new THREE.CylinderGeometry(1.1, 2.4, 22, 7, 2);
  trunkGeo.translate(0, 11, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, bark, trees.length);
  trunks.castShadow = trunks.receiveShadow = true;

  // A conifer crown: stacked, ragged cones (one merged geometry per tree).
  const tiers: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const r = 15 - k * 2.6;
    const h = 17 - k * 1.6;
    const cone = new THREE.ConeGeometry(r, h, 9, 2, true);
    cone.translate(0, 12 + k * 8.5 + h / 2, 0);
    tiers.push(displaced(cone, 0.28, 0.35, k * 3 + 1));
  }
  const crownGeo = mergeGeometries(tiers);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  leafMat.onBeforeCompile = (shader) => {
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
  const leaves = new THREE.InstancedMesh(crownGeo, leafMat, trees.length);
  leaves.castShadow = leaves.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const greens = ["#1f3326", "#253c2a", "#2c4630", "#1a2b24"].map((h) => new THREE.Color(h));
  trees.forEach((t, i) => {
    const base = worldToThree(t.p, terrain.heightAt(t.p) - 0.5);
    e.set((rand() - 0.5) * 0.06, t.rot, (rand() - 0.5) * 0.06);
    q.setFromEuler(e);
    const s = new THREE.Vector3(t.s, t.s * (1 + rand() * 0.45), t.s);
    m.compose(base, q, s);
    trunks.setMatrixAt(i, m);
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, c.copy(greens[Math.floor(rand() * greens.length)]!).multiplyScalar(0.8 + rand() * 0.45));
  });
  group.add(trunks, leaves);

  // ------------------------------------------------------------- boulders
  const rocks: { p: Vector2; s: number }[] = [];
  for (let k = 0; k < 900 && rocks.length < 70; k++) {
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
