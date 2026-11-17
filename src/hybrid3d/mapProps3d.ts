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

/** Molten rock: hot swirls, darker cooling veins. Tiles, so it can flow. */
let lavaTex: THREE.CanvasTexture | null = null;
function lavaTexture() {
  if (lavaTex) return lavaTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c83a08";
  g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  for (let i = 0; i < 140; i++) {
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 30;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]] as const) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      const hot = r() < 0.5 ? "255,220,120" : "255,140,40";
      gr.addColorStop(0, `rgba(${hot},0.8)`);
      gr.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  lavaTex = new THREE.CanvasTexture(c);
  lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
  lavaTex.colorSpace = THREE.SRGBColorSpace;
  return lavaTex;
}

/** Dark cooling crust plates with bright cracks between them (transparent where the lava shows). */
let crustTex: THREE.CanvasTexture | null = null;
function crustTexture() {
  if (crustTex) return crustTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = rng(91);
  // thin cooling veins first, then a few drifting plates of crust
  g.lineCap = "round";
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(40,16,8,${0.35 + r() * 0.3})`;
    g.lineWidth = 2 + r() * 3;
    g.beginPath();
    let x = r() * 256, y = r() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 60;
      y += (r() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 14;
    g.fillStyle = `rgba(${50 + r() * 20},${26 + r() * 10},${16},${0.45 + r() * 0.2})`;
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = rad * (0.6 + r() * 0.5);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  crustTex = new THREE.CanvasTexture(c);
  crustTex.wrapS = crustTex.wrapT = THREE.RepeatWrapping;
  crustTex.colorSpace = THREE.SRGBColorSpace;
  return crustTex;
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
export function buildLavaPool(deco: Decoration, biome: BiomeDefinition): LiveProp {
  const g = new THREE.Group();
  const rx = 34 * deco.scale;
  const rz = 20 * deco.scale;
  const r = rng(deco.variant * 17 + Math.round(deco.position.y));
  const rockDark = std(biome.palette.rockDark, 0.95);
  const rock = std(biome.palette.rock, 0.95);
  // the dark crusted bank all round
  const bank = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 48), rock);
  bank.rotation.x = Math.PI / 2;
  bank.scale.set(rx + 1.5, rz + 1.5, 10);
  bank.position.y = 0.4;
  g.add(bank);
  const n = Math.round((rx + rz) * 0.55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.2;
    const k = 1.02 + r() * 0.12;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + r() * 1.8, 0), r() < 0.4 ? rockDark : rock);
    st.position.set(Math.cos(a) * (rx + 2) * k, 0.8 + r() * 0.8, Math.sin(a) * (rz + 2) * k);
    st.scale.y = 0.55 + r() * 0.4;
    st.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(st);
  }
  // the molten surface, a little below the bank
  const lavaMat = new THREE.MeshStandardMaterial({ color: "#ff6a1a", map: lavaTexture().clone(), emissive: "#ff5a10", emissiveMap: lavaTexture().clone(), emissiveIntensity: 1.6, roughness: 0.55 });
  for (const tex of [lavaMat.map!, lavaMat.emissiveMap!]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx / 30, rz / 30);
    tex.needsUpdate = true;
  }
  const lava = new THREE.Mesh(new THREE.CircleGeometry(1, 48), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.scale.set(rx, rz, 1);
  lava.position.y = 0.35;
  g.add(lava);
  // drifting crust plates on top of it
  const crustMat = new THREE.MeshStandardMaterial({ map: crustTexture().clone(), transparent: true, roughness: 0.9, depthWrite: false });
  crustMat.map!.wrapS = crustMat.map!.wrapT = THREE.RepeatWrapping;
  crustMat.map!.repeat.set(rx / 26, rz / 26);
  crustMat.map!.needsUpdate = true;
  const crust = new THREE.Mesh(new THREE.CircleGeometry(0.97, 48), crustMat);
  crust.rotation.x = -Math.PI / 2;
  crust.scale.set(rx, rz, 1);
  crust.position.y = 0.45;
  g.add(crust);
  // heat glow spilling over the bank onto the ground
  const heat = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: halo(), color: "#ff6a1a", transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  heat.rotation.x = -Math.PI / 2;
  heat.scale.set(rx * 1.9, rz * 2.1, 1);
  heat.position.y = 0.2;
  g.add(heat);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === rock) m.castShadow = true;
  });
  const seed = r() * 100;
  let bubbleT = 0;
  const local = new THREE.Vector3();
  return {
    group: g,
    update(t, dt, fx, at) {
      // the molten rock flows and breathes, the crust drifts the other way
      lavaMat.map!.offset.set(t * 0.012, t * 0.007);
      lavaMat.emissiveMap!.offset.copy(lavaMat.map!.offset);
      crustMat.map!.offset.set(-t * 0.006, t * 0.004);
      lavaMat.emissiveIntensity = 1.4 + 0.35 * Math.sin(t * 0.9 + seed);
      (heat.material as THREE.MeshBasicMaterial).opacity = 0.38 + 0.1 * Math.sin(t * 0.9 + seed);
      bubbleT -= dt;
      if (bubbleT <= 0) {
        bubbleT = 0.25 + r() * 0.6;
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
        local.set(Math.cos(a) * rx * d, 1, Math.sin(a) * rz * d).applyEuler(g.rotation);
        local.add(g.position);
        const p = at(local);
        // a bubble bursts: a pop of molten spray, embers lifting off, a breath of heat haze
        fx.glow.emit(p, { count: 6, color: "#ffe08a", colorEnd: "#ff3a0a", size: 1.4, life: 0.7, speed: 18, up: 14, gravity: 40, drag: 1, radius: 1 });
        if (r() < 0.5) fx.glow.emit(p, { count: 1, color: "#ffd27a", colorEnd: "#ff4a0a", size: 1.2, life: 1.8, speed: 3, up: 18, drag: 0.3, radius: 2 });
        if (r() < 0.25) fx.smoke.emit(p, { count: 1, color: "#5a4a40", colorEnd: "#1e1814", size: 6, life: 2.2, speed: 2, up: 10, grow: 2.6, alpha: 0.18, radius: 3 });
      }
    },
  };
}
