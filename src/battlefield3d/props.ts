import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD_SIZE } from "@/config/gameBalance";
import type { Vector2 } from "@/utils/geometry";
import type { BiomeDefinition } from "@/rendering/biomes/types";
import { fbmNoise2D } from "@/lab3d/noise";
import { worldToThree } from "./coords";
import type { TerrainData } from "./terrain";

/**
 * CAMPO DE BATALHA 3D — the small things that make the clearing feel lived
 * in: torches along the road, glowing crystal outcrops, stumps and fallen
 * logs, mushroom rings, a few ruined columns and low bushes. Placed from a
 * fixed seed, clear of the road, the build sites, the castle and the rift.
 */

export interface Props {
  group: THREE.Group;
  /** Where a flame burns every frame (torch heads). */
  flames: THREE.Vector3[];
  /** Crystal outcrops that shed motes. */
  crystals: THREE.Vector3[];
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function lumpy(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbmNoise2D(v.x * 0.3 + seed, v.z * 0.3 + v.y * 0.2 + seed, 2) - 0.5;
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.3)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function buildProps(
  biome: BiomeDefinition,
  terrain: TerrainData,
  pads: readonly Vector2[],
  castle: Vector2,
  path: readonly Vector2[],
): Props {
  const P = biome.palette;
  const group = new THREE.Group();
  const rand = rng(4242);
  const W = WORLD_SIZE.width;
  const H = WORLD_SIZE.height;
  const taken: { p: Vector2; r: number }[] = [];
  const free = (p: Vector2, r: number, road = 30) =>
    p.x > 10 &&
    p.y > 10 &&
    p.x < W - 10 &&
    p.y < H - 10 &&
    terrain.roadDistance(p) > road + r &&
    !pads.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 30 + r) &&
    Math.hypot(castle.x - p.x, castle.y - p.y) > 110 + r &&
    Math.hypot(path[0]!.x - p.x, path[0]!.y - p.y) > 70 + r &&
    !taken.some((t) => Math.hypot(t.p.x - p.x, t.p.y - p.y) < t.r + r);
  const findSpot = (r: number, road = 30, tries = 400): Vector2 | null => {
    for (let k = 0; k < tries; k++) {
      const p = { x: 20 + rand() * (W - 40), y: 20 + rand() * (H - 40) };
      if (free(p, r, road)) {
        taken.push({ p, r });
        return p;
      }
    }
    return null;
  };
  const at = (p: Vector2, lift = 0) => worldToThree(p, terrain.heightAt(p) + lift);
  const glowDisc = (p: THREE.Vector3, color: THREE.ColorRepresentation, r: number, o: number) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(color), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.copy(p).setY(p.y + 0.8);
    m.renderOrder = 2;
    group.add(m);
  };
  const flames: THREE.Vector3[] = [];
  const crystals: THREE.Vector3[] = [];

  const wood = new THREE.MeshStandardMaterial({ color: "#3e2c1e", roughness: 0.95 });
  const woodLight = new THREE.MeshStandardMaterial({ color: "#7a5e40", roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: "#2a2826", roughness: 0.5, metalness: 0.7 });
  const stone = new THREE.MeshStandardMaterial({ color: "#7c7668", roughness: 0.92 });

  // ------------------------------------------------------------ torches along the road
  {
    const postGeo = new THREE.CylinderGeometry(0.9, 1.3, 15, 6);
    postGeo.translate(0, 7.5, 0);
    const cupGeo = new THREE.CylinderGeometry(2.4, 1.2, 2.6, 8, 1, true);
    cupGeo.translate(0, 15.8, 0);
    let walked = 0;
    let side = 1;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      walked += Math.hypot(b.x - a.x, b.y - a.y);
      if (walked < 150) continue;
      walked = 0;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const p = { x: b.x + (-dy / l) * 40 * side, y: b.y + (dx / l) * 40 * side };
      side = -side;
      if (!free(p, 6, 30)) continue;
      taken.push({ p, r: 8 });
      const base = at(p);
      const post = new THREE.Mesh(postGeo, wood);
      post.position.copy(base);
      post.rotation.z = (rand() - 0.5) * 0.12;
      post.castShadow = true;
      const cup = new THREE.Mesh(cupGeo, iron);
      cup.position.copy(base);
      group.add(post, cup);
      flames.push(base.clone().setY(base.y + 17));
      glowDisc(base, "#ff9a3a", 22, 0.45);
    }
  }

  // ------------------------------------------------------------ crystal outcrops
  {
    const shard = new THREE.OctahedronGeometry(1, 0);
    shard.scale(2.2, 7, 2.2);
    shard.translate(0, 5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(P.accentGlow).multiplyScalar(0.6),
      emissive: new THREE.Color(P.accentGlow),
      emissiveIntensity: 2.4,
      roughness: 0.15,
      metalness: 0.1,
    });
    for (let n = 0; n < 7; n++) {
      const p = findSpot(14, 45);
      if (!p) break;
      const base = at(p, -1);
      const k = 4 + Math.floor(rand() * 4);
      for (let j = 0; j < k; j++) {
        const s = new THREE.Mesh(shard, mat);
        const a = rand() * Math.PI * 2;
        const r = j === 0 ? 0 : 3 + rand() * 5;
        s.position.copy(base).add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        s.rotation.set((rand() - 0.5) * 0.9, rand() * 6, (rand() - 0.5) * 0.9);
        s.scale.setScalar(j === 0 ? 1.2 : 0.5 + rand() * 0.6);
        s.castShadow = true;
        group.add(s);
      }
      // a rock base so they grow out of something
      const rock = new THREE.Mesh(lumpy(new THREE.DodecahedronGeometry(6, 1), 0.4, n), stone);
      rock.scale.set(1.2, 0.45, 1.2);
      rock.position.copy(base);
      rock.receiveShadow = rock.castShadow = true;
      group.add(rock);
      crystals.push(base.clone().setY(base.y + 8));
      glowDisc(base, P.accentGlow, 34, 0.55);
    }
  }

  // ------------------------------------------------------------ stumps and fallen logs
  {
    const stumpGeo = new THREE.CylinderGeometry(4, 5.2, 5, 9);
    stumpGeo.translate(0, 2.5, 0);
    const ringGeo = new THREE.CircleGeometry(3.7, 9).rotateX(-Math.PI / 2);
    ringGeo.translate(0, 5.05, 0);
    for (let n = 0; n < 10; n++) {
      const p = findSpot(7);
      if (!p) break;
      const base = at(p, -0.5);
      const s = 0.7 + rand() * 0.6;
      const st = new THREE.Mesh(stumpGeo, wood);
      const top = new THREE.Mesh(ringGeo, woodLight);
      for (const o of [st, top]) {
        o.position.copy(base);
        o.scale.setScalar(s);
        o.rotation.y = rand() * 6;
        o.castShadow = o.receiveShadow = true;
      }
      group.add(st, top);
    }
    const logGeo = new THREE.CylinderGeometry(2.4, 2.8, 30, 8);
    logGeo.rotateZ(Math.PI / 2);
    for (let n = 0; n < 6; n++) {
      const p = findSpot(16);
      if (!p) break;
      const log = new THREE.Mesh(logGeo, wood);
      log.position.copy(at(p, 2));
      log.rotation.y = rand() * Math.PI;
      log.scale.setScalar(0.7 + rand() * 0.5);
      log.castShadow = log.receiveShadow = true;
      group.add(log);
    }
  }

  // ------------------------------------------------------------ mushroom rings
  {
    const stem = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
    stem.translate(0, 1.5, 0);
    const cap = new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.7, 1);
    cap.translate(0, 2.8, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: "#d8cbb0", roughness: 0.8 });
    const capMats = [
      new THREE.MeshStandardMaterial({ color: "#8a2a1e", roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: "#c08a4a", roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: "#3a6a8a", emissive: new THREE.Color("#4ad0ff"), emissiveIntensity: 1.6, roughness: 0.4 }),
    ];
    for (let n = 0; n < 12; n++) {
      const p = findSpot(8);
      if (!p) break;
      const mat = capMats[n % capMats.length]!;
      const k = 3 + Math.floor(rand() * 4);
      for (let j = 0; j < k; j++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * 6;
        const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        const s = 0.6 + rand() * 0.8;
        const st = new THREE.Mesh(stem, stemMat);
        const cp = new THREE.Mesh(cap, mat);
        for (const o of [st, cp]) {
          o.position.copy(at(q, -0.2));
          o.scale.setScalar(s);
          o.castShadow = true;
        }
        group.add(st, cp);
      }
      if (mat === capMats[2]) glowDisc(at(p), "#4ad0ff", 14, 0.4);
    }
  }

  // ------------------------------------------------------------ ruined columns
  {
    const colGeo = new THREE.CylinderGeometry(3.4, 3.8, 1, 10);
    colGeo.translate(0, 0.5, 0);
    const blockGeo = lumpy(new THREE.BoxGeometry(6, 4, 5), 0.15, 3);
    for (let n = 0; n < 4; n++) {
      const p = findSpot(18);
      if (!p) break;
      const base = at(p, -0.5);
      const col = new THREE.Mesh(colGeo, stone);
      col.position.copy(base);
      col.scale.set(1, 10 + rand() * 18, 1);
      col.rotation.z = (rand() - 0.5) * 0.2;
      col.castShadow = col.receiveShadow = true;
      group.add(col);
      for (let j = 0; j < 3; j++) {
        const b = new THREE.Mesh(blockGeo, stone);
        const a = rand() * Math.PI * 2;
        b.position.copy(base).add(new THREE.Vector3(Math.cos(a) * (7 + rand() * 6), 1.5, Math.sin(a) * (7 + rand() * 6)));
        b.rotation.set(rand() * 0.6, rand() * 6, rand() * 0.6);
        b.scale.setScalar(0.5 + rand() * 0.6);
        b.castShadow = b.receiveShadow = true;
        group.add(b);
      }
    }
  }

  // ------------------------------------------------------------ bushes
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let j = 0; j < 4; j++) {
      const b = new THREE.IcosahedronGeometry(3.6 - j * 0.4, 1);
      b.translate((j % 2 ? 1 : -1) * j * 1.6, 2.5 + (j % 3) * 0.6, (j > 1 ? 1 : -1) * 1.8);
      parts.push(lumpy(b, 0.35, j + 7));
    }
    const bushGeo = mergeGeometries(parts);
    bushGeo.scale(1, 0.75, 1);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const spots: Vector2[] = [];
    for (let k = 0; k < 3000 && spots.length < 160; k++) {
      const p = { x: -20 + rand() * (W + 40), y: -20 + rand() * (H + 40) };
      const d = terrain.roadDistance(p);
      const edge = Math.min(p.x, p.y, W - p.x, H - p.y);
      const nearRoad = d > 34 && d < 60;
      if (!(edge < 40 || (nearRoad && rand() < 0.35) || fbmNoise2D(p.x * 0.02, p.y * 0.02, 2) > 0.66)) continue;
      if (!free(p, 3, 34)) continue;
      spots.push(p);
    }
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, spots.length);
    bushes.castShadow = bushes.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const greens = [P.vegetationPrimary, "#22401c", "#2c4a22", "#1a3016"].map((h) => new THREE.Color(h));
    spots.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.3);
      const s = 0.8 + rand() * 0.9;
      m.compose(at(p, -0.5), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s));
      bushes.setMatrixAt(i, m);
      bushes.setColorAt(i, c.copy(greens[i % greens.length]!).multiplyScalar(0.8 + rand() * 0.5));
    });
    group.add(bushes);
  }

  return { group, flames, crystals };
}
