import * as THREE from "three";
import type { Decoration } from "@/rendering/mapDecorations";
import type { BiomeDefinition } from "@/rendering/biomes";
import type { Effects } from "@/battlefield3d/fx";

/**
 * MAP PROPS IN 3D — the map's light towers (the brazier torches standing by
 * the road) and its lava pools, built as real 3D pieces in the hybrid layer
 * instead of flat 2D drawings: a stone footing and timber post with a burning
 * iron brazier that throws warm light on the ground, and a sunken pool of
 * molten rock, its crust drifting and cracking, ringed in black rock, heat
 * and embers rising off it.
 *
 * While the hybrid layer shows them, `PROPS_3D.active` tells the 2D map to
 * leave its own drawings of these props out (see CanvasRenderer).
 */
export const PROPS_3D = { active: false };

/** What a prop needs every frame. */
export interface LiveProp {
  group: THREE.Group;
  update: (t: number, dt: number, fx: Effects, at: (local: THREE.Vector3) => THREE.Vector3) => void;
}

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let haloTex: THREE.Texture | null = null;
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}



const std = (color: THREE.ColorRepresentation, rough = 0.85, metal = 0, emissive?: THREE.ColorRepresentation, ei = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ?? "#000000", emissiveIntensity: ei });

/** A light tower: stone footing, timber post bound in iron, a brazier of live coals and flame on top. */
export function buildTorch(deco: Decoration, biome: BiomeDefinition): LiveProp {
  const g = new THREE.Group();
  const S = Math.max(0.8, deco.scale) * 1.25;
  const r = rng(deco.variant * 31 + Math.round(deco.position.x));
  const flameCol = biome.id === "ABYSS" || biome.id.includes("ABYSS") ? "#b06aff" : "#ff8a2a";
  const rockM = std(biome.palette.rock, 0.95);
  const rockDark = std(biome.palette.rockDark, 0.95);
  // footing: a flat stone and a few loose rocks
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, 1.6, 9), rockDark);
  foot.position.y = 0.8;
  g.add(foot);
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + r() * 0.8, 0), rockM);
    st.position.set(Math.cos(a) * 5.2, 0.6, Math.sin(a) * 5.2);
    st.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(st);
  }
  // the timber post, iron-banded
  const post = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.45, 17, 8), std("#5a4028", 0.9));
  post.position.y = 1.6 + 8.5;
  g.add(post);
  const iron = std("#2a2624", 0.45, 0.7);
  for (const y of [5, 13.5]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.28, 6, 14), iron);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    g.add(band);
  }
  // the brazier
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.4, 0), new THREE.Vector2(1.6, 0.3), new THREE.Vector2(3.2, 1.6), new THREE.Vector2(3.6, 2.8), new THREE.Vector2(3.3, 2.9)], 18),
    iron,
  );
  bowl.position.y = 18.4;
  (bowl.material as THREE.Material).side = THREE.DoubleSide;
  g.add(bowl);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.4, 0.35), iron);
    leg.position.set(Math.cos(a) * 1.6, 18.2, Math.sin(a) * 1.6);
    leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leg);
  }
  const coals = new THREE.Mesh(new THREE.SphereGeometry(2.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std("#3a1408", 0.8, 0, flameCol, 1.6));
  coals.scale.y = 0.35;
  coals.position.y = 20.4;
  g.add(coals);
  // the flame itself: a few additive tongues that flicker, a halo, and the warm pool it throws on the ground
  const tongueM = (c: string, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const tongues: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(i === 0 ? 1.8 : 1.1, i === 0 ? 7 : 4.5, 8), tongueM(i === 0 ? "#ffd27a" : flameCol, i === 0 ? 0.75 : 0.65));
    const a = (i / 4) * Math.PI * 2;
    t.position.set(i === 0 ? 0 : Math.cos(a) * 1.4, 0, i === 0 ? 0 : Math.sin(a) * 1.4);
    const holder = new THREE.Group();
    holder.position.y = 20.6;
    holder.add(t);
    t.position.y = (i === 0 ? 7 : 4.5) / 2;
    g.add(holder);
    tongues.push(holder as unknown as THREE.Mesh);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: flameCol, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  glow.position.y = 23;
  glow.scale.setScalar(18);
  g.add(glow);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: halo(), color: flameCol, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.25;
  pool.scale.setScalar(30);
  g.add(pool);
  g.scale.setScalar(S);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m.material as THREE.Material).transparent) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  const seed = r() * 100;
  const tip = new THREE.Vector3(0, 24 * S, 0);
  let emberT = 0;
  return {
    group: g,
    update(t, dt, fx, at) {
      const f = 0.85 + 0.15 * Math.sin(t * 11 + seed) * Math.sin(t * 4.3 + seed * 2);
      tongues.forEach((h, i) => {
        h.scale.set(1, f * (0.85 + 0.25 * Math.sin(t * (7 + i) + i + seed)), 1);
        h.rotation.y = t * 0.6 + i;
      });
      (glow.material as THREE.SpriteMaterial).opacity = 0.55 + 0.2 * f;
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.1 * f;
      emberT -= dt;
      if (emberT <= 0) {
        emberT = 0.15 + r() * 0.35;
        fx.glow.emit(at(tip.clone().add(g.position)), { count: 1, color: "#ffe0a0", colorEnd: flameCol, size: 1.1, life: 1.1, speed: 4, up: 16, drag: 0.4, radius: 2 });
      }
    },
  };
}

/** A sunken pool of molten rock, its crust drifting, ringed in black rock, heat and embers rising. */
/** The molten surface: drifting crust plates (cellular noise) with white-hot seams, hotter towards the middle. */
const LAVA_VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vP;
varying float vR;
void main() {
  vP = position.xz + uSeed;
  vR = uv.x;
  vec3 p = position;
  // a slow, heavy swell
  p.y += (sin(position.x * 0.09 + uTime * 0.7 + uSeed) * cos(position.z * 0.11 - uTime * 0.5)) * 0.35 * (1.0 - uv.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const LAVA_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vP;
varying float vR;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1, 0)), u.x), mix(hash1(i + vec2(0, 1)), hash1(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// distance to the nearest seam between cells, and the cell's own random value
vec2 voronoi(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.42 * sin(t * 0.35 + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.42 * sin(t * 0.35 + 6.2831 * o);
      vec2 r = g + o - f;
      if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  return vec2(md, hash1(n + mg));
}
void main() {
  float t = uTime;
  vec2 p = vP * 0.075;
  // the whole surface creeps and swirls
  vec2 warp = vec2(fbm(p * 1.3 + vec2(t * 0.05, 0.0)), fbm(p * 1.3 + vec2(0.0, -t * 0.04) + 7.0));
  vec2 q = p + (warp - 0.5) * 1.1 + vec2(t * 0.02, t * 0.012);
  vec2 v = voronoi(q * 1.6, t);
  float seam = 1.0 - smoothstep(0.0, 0.11 + 0.05 * sin(t * 1.3 + v.y * 6.0), v.x);
  // plates cool towards the bank and break up towards the middle
  float cool = smoothstep(0.2, 0.9, vR) * 0.45 + 0.55 + 0.3 * (fbm(q * 3.0) - 0.5);
  float plate = smoothstep(0.045, 0.13, v.x) * clamp(cool + (v.y - 0.5) * 0.7, 0.0, 1.0);
  float heat = clamp(1.0 - plate, 0.0, 1.0);
  heat = max(heat, seam);
  float flick = 0.88 + 0.12 * sin(t * 2.1 + vP.x * 0.05) * sin(t * 1.7 - vP.y * 0.04);
  vec3 crust = mix(vec3(0.05, 0.025, 0.02), vec3(0.17, 0.06, 0.03), fbm(q * 6.0));
  // the crust still glows dull red where it is thin, near the seams
  crust += vec3(0.35, 0.06, 0.0) * smoothstep(0.22, 0.05, v.x) * plate;
  vec3 molten = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.5, 0.08), smoothstep(0.4, 1.0, heat));
  molten = mix(molten, vec3(1.0, 0.82, 0.4), smoothstep(0.95, 1.0, seam) * (1.0 - vR * 0.7) * 0.8);
  vec3 col = mix(crust, molten * flick, heat);
  // embers glinting in the crust
  col += vec3(1.0, 0.45, 0.1) * step(0.985, hash1(floor(vP * 1.4))) * plate * (0.5 + 0.5 * sin(t * 3.0 + vP.x));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * A lava pool: an irregular pit ringed with a raised lip of black basalt, its rim glowing where it
 * meets the melt; the surface itself is crust plates drifting on white-hot seams; bubbles swell
 * and burst; little flames lick up off the hot spots with smoke rolling away; and its light falls
 * warm on the ground round it.
 */
export function buildLavaPool(deco: Decoration, biome: BiomeDefinition): LiveProp {
  const g = new THREE.Group();
  const rx = 34 * deco.scale;
  const rz = 20 * deco.scale;
  const r = rng(deco.variant * 17 + Math.round(deco.position.y));
  const seed = r() * 100;
  // an organic outline (not an ellipse): a few slow lobes round it
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const edge = (a: number) => 1 + 0.11 * Math.sin(3 * a + ph[0]!) + 0.07 * Math.sin(5 * a + ph[1]!) + 0.04 * Math.sin(9 * a + ph[2]!);
  const SEG = 96;
  const sc = Math.max(0.7, deco.scale);
  /** the melt sits down in the pit, below the ground; the bank's inner wall climbs out of it */
  const LAVA_Y = -2.6 * sc;

  // ---- the molten surface: a polar grid out to the outline (uv.x = 0 centre → 1 bank)
  {
    const RINGS = 14;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pos.push(0, 0, 0);
    uv.push(0, 0);
    for (let k = 1; k <= RINGS; k++) {
      const f = k / RINGS;
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const e = edge(a);
        pos.push(Math.cos(a) * rx * e * f, 0, Math.sin(a) * rz * e * f);
        uv.push(f, i / SEG);
      }
    }
    for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i);
    for (let k = 1; k < RINGS; k++) {
      const a0 = 1 + (k - 1) * SEG, a1 = 1 + k * SEG;
      for (let i = 0; i < SEG; i++) {
        const i1 = (i + 1) % SEG;
        idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed } } });
    const lava = new THREE.Mesh(geo, mat);
    lava.position.y = LAVA_Y;
    lava.name = "lavaSurface";
    g.add(lava);
  }

  // ---- the basalt lip: a raised, lumpy bank from the melt's edge outwards, glowing at its inner edge
  const glowCol = new THREE.Color("#ff5a14");
  const rockA = new THREE.Color(biome.palette.rockDark);
  const rockB = new THREE.Color(biome.palette.rock);
  {
    const BANDS = 11;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k <= BANDS; k++) {
      const u = k / BANDS;
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const e = edge(a);
        const lump = 0.75 + 0.5 * Math.sin(a * 13 + ph[1]! * 3) * Math.sin(a * 7 + ph[2]!) + 0.25 * Math.sin(a * 29 + ph[0]! * 2) * Math.sin(a * 41);
        // broken, jagged stone: every vertex nudged a little
        const jag = (r() - 0.5) * (u > 0.04 ? 1 : 0);
        const rad = 0.95 + u * (0.5 + 0.08 * Math.sin(a * 4 + ph[0]!));
        // inner wall from under the melt up to a lumpy crest, then a long slope down to the ground
        const crest = (2.6 + 2.2 * lump) * sc;
        const CU = 0.3;
        const hgt = u < CU ? LAVA_Y - 0.4 + (crest - LAVA_Y + 0.4) * Math.sin((u / CU) * Math.PI * 0.5) : 0.1 + (crest - 0.1) * (1 - ((u - CU) / (1 - CU)) ** 0.8);
        const rj = rad + jag * 0.03;
        pos.push(Math.cos(a) * rx * e * rj, hgt + jag * 1.4 * sc * Math.sin(Math.min(1, u * 2) * Math.PI * 0.5), Math.sin(a) * rz * e * rj);
        // glowing where it meets the melt, dark basalt beyond, a little lighter on the crest
        const c = rockA.clone().lerp(rockB, Math.max(0, Math.sin(u * Math.PI)) * 0.55 * lump).multiplyScalar(0.7 + r() * 0.55);
        // the inner wall glows hot near the melt and fades up to the crest
        c.lerp(glowCol, Math.max(0, 1 - u / 0.22) ** 1.5 * 0.95);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let k = 0; k < BANDS; k++) {
      const a0 = k * SEG, a1 = (k + 1) * SEG;
      for (let i = 0; i < SEG; i++) {
        const i1 = (i + 1) % SEG;
        idx.push(a0 + i, a1 + i, a0 + i1, a0 + i1, a1 + i, a1 + i1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const bankMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.05, emissive: "#ff3a08", emissiveIntensity: 0, side: THREE.DoubleSide });
    // the inner glow is emissive (it lights itself), the rest takes the scene light
    bankMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  totalEmissiveRadiance += max(vec3(0.0), vColor.rgb - vec3(0.32, 0.2, 0.16)) * vec3(2.2, 1.1, 0.5);",
      );
    };
    const bank = new THREE.Mesh(geo, bankMat);
    bank.castShadow = true;
    bank.receiveShadow = true;
    g.add(bank);
  }
  // a few fallen boulders on the bank
  const boulderMat = std(biome.palette.rockDark, 0.95);
  const nb = 8 + Math.floor(r() * 6);
  for (let i = 0; i < nb; i++) {
    const a = r() * Math.PI * 2;
    const e = edge(a) * (1.06 + r() * 0.12);
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry((1.2 + r() * 2.6) * Math.max(0.7, deco.scale), 0), boulderMat);
    st.position.set(Math.cos(a) * rx * e, (3 + r() * 2.5) * sc, Math.sin(a) * rz * e);
    st.scale.y = 0.5 + r() * 0.4;
    st.rotation.set(r() * 3, r() * 3, r() * 3);
    st.castShadow = true;
    g.add(st);
  }
  // heat spilling over onto the ground, and the pool's own warm light
  const heat = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: halo(), color: "#ff5a14", transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  heat.rotation.x = -Math.PI / 2;
  heat.scale.set(rx * 2.1, rz * 2.3, 1);
  heat.position.y = 0.25;
  g.add(heat);
  const light = new THREE.PointLight("#ff6a1a", 900, Math.max(rx, rz) * 3.2, 1.6);
  light.position.set(0, Math.max(rx, rz) * 0.55, 0);
  g.add(light);

  // ---- bubbles: domes of melt that swell, wobble and burst
  const bubbleMat = new THREE.MeshStandardMaterial({ color: "#3a1206", emissive: "#ff4a08", emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 });
  const bubbleGeo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const bubbles = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(bubbleGeo, bubbleMat);
    m.visible = false;
    g.add(m);
    return { m, t: -r() * 2, life: 1, size: 1 };
  });
  const lavaMesh = g.getObjectByName("lavaSurface") as THREE.Mesh;
  const lavaMat = lavaMesh.material as THREE.ShaderMaterial;
  const insidePoint = (spread = 0.75) => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread * edge(a);
    return new THREE.Vector3(Math.cos(a) * rx * d, LAVA_Y + 0.3, Math.sin(a) * rz * d);
  };
  let smokeT = 0;
  let flameT = 0;
  const hot = Array.from({ length: 3 + Math.floor(r() * 3) }, () => insidePoint(0.6));
  const world = (v: THREE.Vector3, at: (l: THREE.Vector3) => THREE.Vector3) => at(v.clone().applyEuler(g.rotation).add(g.position));

  return {
    group: g,
    update(t, dt, fx, at) {
      lavaMat.uniforms.uTime!.value = t;
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.9 + seed);
      (heat.material as THREE.MeshBasicMaterial).opacity = 0.32 + 0.14 * breathe;
      light.intensity = 760 + 260 * breathe + 120 * Math.sin(t * 7.3 + seed) * Math.sin(t * 3.1);
      for (const b of bubbles) {
        b.t += dt;
        if (b.t < 0) continue;
        if (!b.m.visible) {
          const p = insidePoint(0.72);
          b.m.position.set(p.x, LAVA_Y, p.z);
          b.size = (1.6 + r() * 2.8) * Math.max(0.7, deco.scale);
          b.life = 0.9 + r() * 1.2;
          b.m.visible = true;
        }
        const k = b.t / b.life;
        if (k >= 1) {
          // it bursts: a ring of molten spray, a puff of smoke, embers lifting
          const p = world(b.m.position.clone().setY(LAVA_Y + 1.2), at);
          fx.glow.emit(p, { count: 14, color: "#fff0b0", colorEnd: "#ff3a0a", size: 1.6, life: 0.7, speed: 26 + b.size * 4, up: 22, gravity: 70, drag: 1, radius: b.size * 0.5 });
          fx.smoke.emit(p, { count: 2, color: "#4a3a32", colorEnd: "#16100c", size: b.size * 2.4, life: 2.4, speed: 4, up: 14, grow: 2.8, alpha: 0.32, radius: b.size * 0.4 });
          fx.rings.ring(p.clone().setY(LAVA_Y + 0.5), "#ffb050", b.size * 0.6, b.size * 2.4, 0.35);
          b.m.visible = false;
          b.t = -(0.2 + r() * 1.4);
          continue;
        }
        // swells (with a wobble), stretching up just before it goes
        const s = b.size * Math.pow(k, 0.6) * (1 + 0.08 * Math.sin(b.t * 18));
        b.m.scale.set(s, s * (0.55 + 0.45 * k * k), s);
      }
      // smoke rolling up off the melt, darker and heavier over the hot spots
      smokeT -= dt;
      if (smokeT <= 0) {
        smokeT = 0.09 + r() * 0.12;
        const p = world(r() < 0.6 ? hot[Math.floor(r() * hot.length)]!.clone().add(new THREE.Vector3((r() - 0.5) * 6, 0, (r() - 0.5) * 6)) : insidePoint(0.85), at);
        fx.smoke.emit(p.setY(LAVA_Y + 3), { count: 1, color: r() < 0.5 ? "#6a5a50" : "#463a32", colorEnd: "#16120f", size: (8 + r() * 7) * sc, life: 3.4 + r() * 1.6, speed: 3, up: 18 + r() * 10, grow: 3.4, alpha: 0.34, drag: 0.2, radius: 2 });
      }
      // little flames licking up off the hottest spots, embers drifting away
      flameT -= dt;
      if (flameT <= 0) {
        flameT = 0.05 + r() * 0.06;
        const h = hot[Math.floor(r() * hot.length)]!;
        const p = world(h.clone().add(new THREE.Vector3((r() - 0.5) * 7, 0.4, (r() - 0.5) * 5)), at);
        fx.flame(p, 0.7 + r() * 0.7, r() < 0.4 ? "#ffcf5a" : "#ff6a1a");
        if (r() < 0.25) fx.glow.emit(p, { count: 1, color: "#ffd27a", colorEnd: "#ff4a0a", size: 1.1, life: 2, speed: 3, up: 20, drag: 0.3, radius: 2 });
      }
    },
  };
}
