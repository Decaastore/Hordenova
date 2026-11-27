// Generated from the tower bake builder (towerbake.ts): the same procedural
// tower models, wrapped so the real-time 3D battlefield can build them.
// @ts-nocheck — mechanically wrapped from the offline bake script; type-checked there.
/* eslint-disable */
import * as THREE from "three";
import { shareTexture } from "./texBudget";

export interface TowerModel {
  root: THREE.Group;
  turret: THREE.Group;
  anchors: Record<string, THREE.Vector3>;
  turretAnchors: Set<string>;
  pointLights: { pos: THREE.Vector3; color: string; intensity: number; dist: number }[];
  turretMode: "yaw" | "tilt";
  turretPivotY: number;
  turretTilt: number;
}

export function buildTowerModel(TYPE: string, STAGE: number, SKIN: string, FUSED: string | null = null): TowerModel {
  // PACOTES (config/towerSkins.ts PACK_TOWER_SKINS): a bundle-exclusive skin is
  // built on one of its tower's premium structures (SKIN below), coloured by
  // its own look (LOOK), with its own mark on top (packFlourish at the end).
  const LOOK = SKIN;
  const PACK = PACK_LOOKS[SKIN] ?? null;
  if (PACK) SKIN = PACK.shape;
  // ---------------------------------------------------------------------------
  function rng(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  type RGB = [number, number, number];
  const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (a: RGB, b: RGB, t: number) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

  interface TexSet {
    map: THREE.CanvasTexture;
    bump: THREE.CanvasTexture;
    emissive?: THREE.CanvasTexture;
  }
  function canvasPair(S: number) {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const b = document.createElement("canvas");
    b.width = b.height = S;
    return { c, g: c.getContext("2d")!, b, h: b.getContext("2d")! };
  }
  function finish(c: HTMLCanvasElement, b: HTMLCanvasElement, e?: HTMLCanvasElement): TexSet {
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    const bump = new THREE.CanvasTexture(b);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    let emissive: THREE.CanvasTexture | undefined;
    if (e) {
      emissive = new THREE.CanvasTexture(e);
      emissive.colorSpace = THREE.SRGBColorSpace;
      emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
    }
    return { map, bump, emissive };
  }

  /** Dressed stone blocks with chiselled edges, speckle, grime; optional frost rime and glowing rune lines. */
  /** Cached across every model built on the page (the canvases are only read: each material clones them). */
  function stoneTex(seed: number, a: string, b: string, mortar: string, rows: number, cols: number, opts: { frost?: number; runes?: string; runeRows?: number[] } = {}): TexSet {
    return cachedTex("stoneTex", [seed, a, b, mortar, rows, cols, opts], () => stoneTexRaw(seed, a, b, mortar, rows, cols, opts));
  }
  function stoneTexRaw(seed: number, a: string, b: string, mortar: string, rows: number, cols: number, opts: { frost?: number; runes?: string; runeRows?: number[] } = {}): TexSet {
    const S = 512;
    const { c, g, b: bc, h } = canvasPair(S);
    const r = rng(seed);
    const A = hexRgb(a), B = hexRgb(b);
    g.fillStyle = mortar;
    g.fillRect(0, 0, S, S);
    h.fillStyle = "#202020";
    h.fillRect(0, 0, S, S);
    const rh = S / rows;
    for (let row = 0; row < rows; row++) {
      const cw = S / cols;
      for (let col = -1; col <= cols; col++) {
        const w = cw * (0.85 + r() * 0.3);
        const x = (col + (row % 2) * 0.5) * cw;
        const y = row * rh;
        const pad = 2.5;
        g.fillStyle = mixc(A, B, 0.1 + r() * 0.7);
        g.beginPath();
        g.roundRect(x + pad, y + pad, w - pad * 2, rh - pad * 2, 3);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.08)";
        g.fillRect(x + pad + 2, y + pad, w - pad * 2 - 4, 3);
        g.fillStyle = "rgba(0,0,0,0.2)";
        g.fillRect(x + pad + 2, y + rh - pad - 3, w - pad * 2 - 4, 3);
        for (let k = 0; k < 30; k++) {
          g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)";
          g.fillRect(x + r() * w, y + r() * rh, 2 + r() * 3, 1 + r() * 2);
        }
        const hv = 150 + Math.round(r() * 60);
        const hg = h.createLinearGradient(0, y, 0, y + rh);
        hg.addColorStop(0, `rgb(${hv},${hv},${hv})`);
        hg.addColorStop(0.5, `rgb(${hv + 30},${hv + 30},${hv + 30})`);
        hg.addColorStop(1, `rgb(${hv - 25},${hv - 25},${hv - 25})`);
        h.fillStyle = hg;
        h.beginPath();
        h.roundRect(x + pad, y + pad, w - pad * 2, rh - pad * 2, 3);
        h.fill();
      }
    }
    for (let k = 0; k < 10; k++) {
      const x = r() * S;
      const grd = g.createLinearGradient(x, 0, x, S);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, `rgba(0,0,0,${0.06 + r() * 0.08})`);
      g.fillStyle = grd;
      g.fillRect(x, 0, 6 + r() * 12, S);
    }
    if (opts.frost) {
      // Rime: frost crystals clinging to the top edges of each course.
      for (let row = 0; row < rows; row++) {
        for (let k = 0; k < 40 * opts.frost; k++) {
          const x = r() * S;
          const y = row * rh + r() * rh * 0.35;
          g.fillStyle = `rgba(220,240,255,${0.15 + r() * 0.35})`;
          g.beginPath();
          g.arc(x, y, 1 + r() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    let e: HTMLCanvasElement | undefined;
    if (opts.runes) {
      e = document.createElement("canvas");
      e.width = e.height = S;
      const eg = e.getContext("2d")!;
      eg.fillStyle = "#000";
      eg.fillRect(0, 0, S, S);
      for (const rr of opts.runeRows ?? [Math.floor(rows / 2)]) {
        const y = rr * rh + rh * 0.5;
        for (let i = 0; i < 10; i++) {
          const x = (i + 0.5) * (S / 10);
          for (const ctx2 of [g, eg, h]) {
            ctx2.strokeStyle = ctx2 === h ? "#000" : ctx2 === g ? "rgba(10,20,30,0.9)" : opts.runes;
            ctx2.lineWidth = ctx2 === eg ? 3 : 3.5;
            ctx2.beginPath();
            const k = Math.floor(r() * 4);
            ctx2.moveTo(x - 8, y - 9);
            if (k === 0) { ctx2.lineTo(x, y + 9); ctx2.lineTo(x + 8, y - 9); }
            else if (k === 1) { ctx2.lineTo(x + 8, y - 9); ctx2.moveTo(x, y - 9); ctx2.lineTo(x, y + 9); }
            else if (k === 2) { ctx2.lineTo(x - 8, y + 9); ctx2.lineTo(x + 8, y + 9); ctx2.moveTo(x - 8, y); ctx2.lineTo(x + 6, y); }
            else { ctx2.moveTo(x, y - 9); ctx2.lineTo(x + 8, y); ctx2.lineTo(x, y + 9); ctx2.lineTo(x - 8, y); ctx2.closePath(); }
            ctx2.stroke();
          }
        }
      }
    }
    return finish(c, bc, e);
  }

  /** Cached across every model built on the page (the canvases are only read: each material clones them). */
  function metalTex(seed: number, base: string, opts: { rivets?: boolean } = {}): TexSet {
    return cachedTex("metalTex", [seed, base, opts], () => metalTexRaw(seed, base, opts));
  }
  function metalTexRaw(seed: number, base: string, opts: { rivets?: boolean } = {}): TexSet {
    const S = 256;
    const { c, g, b, h } = canvasPair(S);
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    h.fillStyle = "#808080";
    h.fillRect(0, 0, S, S);
    for (let k = 0; k < 400; k++) {
      g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)";
      g.fillRect(r() * S, r() * S, 1 + r() * 6, 1);
    }
    if (opts.rivets) {
      for (let y = 16; y < S; y += 64) {
        for (let x = 16; x < S; x += 32) {
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.beginPath(); g.arc(x - 1, y - 1, 3, 0, Math.PI * 2); g.fill();
          h.fillStyle = "#ffffff";
          h.beginPath(); h.arc(x, y, 4, 0, Math.PI * 2); h.fill();
        }
      }
    }
    return finish(c, b);
  }

  function mat(set: TexSet, rx: number, ry: number, o: { rough?: number; metal?: number; bump?: number; emissiveColor?: string; emissiveIntensity?: number } = {}) {
    const map = shareTexture(set.map); map.repeat.set(rx, ry);
    const bump = shareTexture(set.bump); bump.repeat.set(rx, ry);
    const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: o.bump ?? 1.6, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0.02 });
    if (set.emissive) {
      const em = set.emissive.clone(); em.repeat.set(rx, ry); em.needsUpdate = true;
      m.emissiveMap = em;
      m.emissive = new THREE.Color(o.emissiveColor ?? "#ffffff");
      m.emissiveIntensity = o.emissiveIntensity ?? 2.2;
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  const root = new THREE.Group();
  const anchors: Record<string, THREE.Vector3> = {};
  const pointLights: { pos: THREE.Vector3; color: string; intensity: number; dist: number }[] = [];

  /** Rotating turret (Ironwood's ballista + operator): built into this group so it can be rendered separately at many headings. */
  const turret = new THREE.Group();
  root.add(turret);
  const turretAnchors = new Set<string>();
  /** "yaw": the turret spins about the vertical axis to face its heading; "tilt": it leans towards it from a pivot height. */
  let TURRET_MODE: "yaw" | "tilt" = "yaw";
  let TURRET_PIVOT_Y = 0;
  const TURRET_TILT = 0.42;
  let PARENT: THREE.Object3D = root;
  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = PARENT) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }

  /** An empty group placed under `parent` (moving parts are built inside one). */
  function group(x = 0, y = 0, z = 0, parent: THREE.Object3D = PARENT) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  /** Marks a part as moving: `spin` = radians/second about x/y/z, `bob` = [height, speed]. Played by animateTowerParts. */
  function animate(o: THREE.Object3D, a: { spin?: [number, number, number]; bob?: [number, number] }) {
    o.userData.anim = { ...a, r0: [o.rotation.x, o.rotation.y, o.rotation.z], y0: o.position.y, ph: Math.random() * 6 };
    return o;
  }

  /** A sharp ice crystal (elongated bipyramid with a hexagonal waist). */
  function crystal(len: number, rad: number, iceMat: THREE.Material, x: number, y: number, z: number, tiltX: number, tiltZ: number) {
    const g = new THREE.Group();
    const body = new THREE.CylinderGeometry(rad * 0.75, rad, len * 0.62, 6);
    const tip = new THREE.ConeGeometry(rad * 0.75, len * 0.38, 6);
    mesh(body, iceMat, 0, len * 0.31, 0, g);
    mesh(tip, iceMat, 0, len * 0.62 + len * 0.19, 0, g);
    g.position.set(x, y, z);
    g.rotation.set(tiltX, 0, tiltZ);
    root.add(g);
    return g;
  }

  /** Flagstone paving for horizontal tops (a side-wall brick texture stretched over a disc reads as planks). */
  /** Cached across every model built on the page (the canvases are only read: each material clones them). */
  function flagTex(seed: number, a: string, b: string, mortar: string, frost = 0): TexSet {
    return cachedTex("flagTex", [seed, a, b, mortar, frost], () => flagTexRaw(seed, a, b, mortar, frost));
  }
  function flagTexRaw(seed: number, a: string, b: string, mortar: string, frost = 0): TexSet {
    const S = 512;
    const { c, g, b: bc, h } = canvasPair(S);
    const r = rng(seed);
    const A = hexRgb(a), B = hexRgb(b);
    g.fillStyle = mortar; g.fillRect(0, 0, S, S);
    h.fillStyle = "#202020"; h.fillRect(0, 0, S, S);
    const pts: [number, number][] = [];
    for (let i = 0; i < 26; i++) pts.push([r() * S, r() * S]);
    const img = g.getImageData(0, 0, S, S);
    const himg = h.getImageData(0, 0, S, S);
    const shade = pts.map(() => r());
    // nearest two stones, with the tile wrapping round (the shortest way across each edge):
    // one distance per stone instead of five, and no array built per pixel
    const px = pts.map((p) => p[0]), py = pts.map((p) => p[1]), n = pts.length, half = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9, k1 = 0;
      for (let i = 0; i < n; i++) {
        let dx = Math.abs(x - px[i]!), dy = Math.abs(y - py[i]!);
        if (dx > half) dx = S - dx;
        if (dy > half) dy = S - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; k1 = i; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const o = (y * S + x) * 4;
      if (edge > 3) {
        const t = 0.15 + shade[k1]! * 0.7 + (r() - 0.5) * 0.08;
        img.data[o] = A[0] + (B[0] - A[0]) * t; img.data[o + 1] = A[1] + (B[1] - A[1]) * t; img.data[o + 2] = A[2] + (B[2] - A[2]) * t;
        const hv = Math.min(255, 140 + Math.min(edge, 20) * 4);
        himg.data[o] = himg.data[o + 1] = himg.data[o + 2] = hv;
      }
    }
    g.putImageData(img, 0, 0); h.putImageData(himg, 0, 0);
    if (frost) for (let k = 0; k < 500 * frost; k++) { g.fillStyle = `rgba(225,242,255,${0.2 + r() * 0.4})`; g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 4, 0, Math.PI * 2); g.fill(); }
    return finish(c, bc);
  }

  function hexPrism(radius: number, height: number, m: THREE.Material[] | THREE.Material, y: number) {
    const geo = new THREE.CylinderGeometry(radius, radius * 1.04, height, 6, 1);
    return mesh(geo, m, 0, y + height / 2, 0);
  }

  // ---------------------------------------------------------------------------
  // Skin looks: every skin keeps its tower's layout (so it still reads as that
  // tower) but swaps every material and adds its own signature structure.
  // ---------------------------------------------------------------------------
  type Tri = [string, string, string];
  interface FrostLook {
    plinth: Tri; obelisk: Tri; cap: Tri; flag: Tri;
    rune: string; trim: string; iron: string; snow: string; frost: number;
    ice: [string, string]; ice2: [string, string]; orb: [string, string];
  }
  const FROST_LOOKS: Record<string, FrostLook> = {
    base: { plinth: ["#4e5a66", "#26303a", "#141a20"], obelisk: ["#5c5670", "#2e2a3c", "#16141e"], cap: ["#6a6880", "#3a3850", "#1c1a26"], flag: ["#6e7488", "#3c4252", "#1a1e26"], rune: "#7ee6ff", trim: "#c8d4e0", iron: "#3a4048", snow: "#eef8ff", frost: 1, ice: ["#a8e6ff", "#3ab8ff"], ice2: ["#6ac8f0", "#1a7ad0"], orb: ["#7fd2f4", "#1f8fd8"] },
    FROSTBORN_ANCIENT_GUARDIAN: { plinth: ["#6a7258", "#343a2a", "#1a1e14"], obelisk: ["#727a60", "#3a4030", "#1c2016"], cap: ["#7a8268", "#42483a", "#20241a"], flag: ["#7a8064", "#424834", "#1e2216"], rune: "#b8ffa0", trim: "#9a8a5a", iron: "#4a4030", snow: "#a8d088", frost: 0, ice: ["#8ae0a0", "#2aa050"], ice2: ["#5ac078", "#1a7a3a"], orb: ["#7ad89a", "#1a9a4a"] },
    FROSTBORN_VOID_FROST: { plinth: ["#2a2434", "#120e1a", "#06040a"], obelisk: ["#30283e", "#140f1e", "#08060c"], cap: ["#3a3048", "#1a1424", "#0a0810"], flag: ["#342c40", "#18121e", "#08060c"], rune: "#9a6aff", trim: "#5a4a7a", iron: "#1a1622", snow: "#3a2a5a", frost: 0, ice: ["#3a2a6a", "#6a3aff"], ice2: ["#1a1030", "#4a1aff"], orb: ["#2a1a4a", "#5a2aff"] },
    FROSTBORN_ARCANE_CRYSTAL: { plinth: ["#5a4c6a", "#2a2236", "#140f1c"], obelisk: ["#6a5a7e", "#342a42", "#181220"], cap: ["#7a6a8e", "#3a3048", "#1c1624"], flag: ["#6e6282", "#383046", "#1a1622"], rune: "#ff9ae0", trim: "#e0c0f0", iron: "#3a2e48", snow: "#ffd8f4", frost: 0.3, ice: ["#ffb8ec", "#ff4ad0"], ice2: ["#c890ff", "#8a3aff"], orb: ["#ffb0e8", "#ff3ac0"] },
    FROSTBORN_CELESTIAL_ICE: { plinth: ["#e8eef4", "#a8b8c8", "#7a8898"], obelisk: ["#f0f4f8", "#b8c8d8", "#8a98a8"], cap: ["#ffffff", "#c8d4e0", "#9aa8b8"], flag: ["#f4f8fc", "#c0ccd8", "#8a98a8"], rune: "#bfe8ff", trim: "#e8e0c8", iron: "#b8c0cc", snow: "#ffffff", frost: 0.5, ice: ["#e8f8ff", "#9ad8ff"], ice2: ["#cfeeff", "#7ac8ff"], orb: ["#f4fbff", "#a8dcff"] },
    FROSTBORN_GLACIAL_WARLORD: { plinth: ["#2a4a5a", "#12242e", "#081218"], obelisk: ["#2e5266", "#142a36", "#08141a"], cap: ["#3a6274", "#1a3442", "#0a1820"], flag: ["#345a6c", "#183040", "#0a161c"], rune: "#4ecfff", trim: "#8ab4c8", iron: "#1a2a34", snow: "#c8f0ff", frost: 1.2, ice: ["#6ae0ff", "#0aa0ff"], ice2: ["#2a8ac0", "#0a5ac0"], orb: ["#5ad8ff", "#0a8aff"] },
    FROSTBORN_PRESTIGE_ASCENDANT: { plinth: ["#2a2622", "#100e0c", "#060504"], obelisk: ["#2e2a24", "#14110c", "#070604"], cap: ["#3a342a", "#1a160e", "#0a0806"], flag: ["#342e24", "#16120c", "#080604"], rune: "#ffd257", trim: "#e8b84a", iron: "#a8822e", snow: "#ffe8a0", frost: 0, ice: ["#ffe08a", "#ffb020"], ice2: ["#e8b84a", "#c88a10"], orb: ["#fff0b0", "#ffc830"] },
    FROSTBORN_SANDSTONE: { plinth: ["#a8865a", "#5a4428", "#2a1e10"], obelisk: ["#b8966a", "#62482a", "#2e2010"], cap: ["#c8a678", "#6e5232", "#342614"], flag: ["#b89060", "#5e4426", "#2a1e10"], rune: "#7ee6ff", trim: "#d8c090", iron: "#5a4a34", snow: "#f4ead4", frost: 0.4, ice: ["#a8e6ff", "#3ab8ff"], ice2: ["#6ac8f0", "#1a7ad0"], orb: ["#7fd2f4", "#1f8fd8"] },
    FROSTBORN_MOONSTONE: { plinth: ["#8a90a8", "#464a5e", "#20222e"], obelisk: ["#9aa0b8", "#4e5268", "#242632"], cap: ["#aab0c8", "#565a72", "#282a36"], flag: ["#949ab2", "#4a4e64", "#22242e"], rune: "#d8e0ff", trim: "#e8ecf8", iron: "#4a4e5e", snow: "#f4f6ff", frost: 0.8, ice: ["#e0e8ff", "#8a9aff"], ice2: ["#b8c4ff", "#5a6aff"], orb: ["#eef2ff", "#9aa8ff"] },
    FROSTBORN_AURORA: { plinth: ["#2a3a4a", "#121c26", "#080e14"], obelisk: ["#2e4250", "#14202a", "#0a1016"], cap: ["#36505e", "#1a2a34", "#0c161c"], flag: ["#30485a", "#16242e", "#0a1218"], rune: "#6affc8", trim: "#a0e8d0", iron: "#1e2a34", snow: "#d8fff0", frost: 0.9, ice: ["#8affd8", "#2affa0"], ice2: ["#c08aff", "#7a3aff"], orb: ["#9affe0", "#3affb0"] },
    FROSTBORN_OBSIDIAN: { plinth: ["#1e1e24", "#0c0c10", "#040406"], obelisk: ["#24242c", "#101014", "#060608"], cap: ["#2c2c36", "#141418", "#08080a"], flag: ["#26262e", "#121216", "#060608"], rune: "#ff5a6a", trim: "#8a8a96", iron: "#141418", snow: "#c8ccd8", frost: 0.6, ice: ["#ff8a9a", "#ff2a4a"], ice2: ["#c04a5a", "#a01a2a"], orb: ["#ffa0aa", "#ff3a50"] },
    FROSTBORN_GLADIATOR: { plinth: ["#7a4a2e", "#3e2414", "#1e1008"], obelisk: ["#8a5232", "#462816", "#22120a"], cap: ["#d89a3a", "#7a5218", "#3a240a"], flag: ["#8a1a1a", "#4a0c0c", "#220606"], rune: "#ff6a3a", trim: "#d89a3a", iron: "#3a2a1e", snow: "#f0e0d0", frost: 0.35, ice: ["#ffb08a", "#ff5a2a"], ice2: ["#ff8a5a", "#c8301a"], orb: ["#ffc09a", "#ff4a1a"] },
    FROSTBORN_CHAMPION: { plinth: ["#e8e0cc", "#8a826e", "#3e3a30"], obelisk: ["#f0e8d4", "#968c76", "#46402e"], cap: ["#ffd060", "#9a7418", "#4a3608"], flag: ["#1a1a22", "#0c0c10", "#060608"], rune: "#ffe08a", trim: "#ffd060", iron: "#2a2620", snow: "#fffaf0", frost: 0.7, ice: ["#fff0b0", "#ffc83a"], ice2: ["#ffe08a", "#d8a020"], orb: ["#fff4c0", "#ffcc3a"] },
    FROSTBORN_PACK_WINTER_CROWN: { plinth: ["#c8d0dc", "#7a8496", "#3a4250"], obelisk: ["#dce4f0", "#8a96aa", "#424c5c"], cap: ["#3a5aa8", "#1a2e64", "#0a1430"], flag: ["#2a4a9a", "#142a5a", "#08142e"], rune: "#6a9aff", trim: "#e8eef8", iron: "#5a6478", snow: "#ffffff", frost: 1.1, ice: ["#c8dcff", "#4a7aff"], ice2: ["#9ab8ff", "#2a5ae8"], orb: ["#d8e6ff", "#5a8aff"] },
    FROSTBORN_PACK_ECLIPSE: { plinth: ["#1c1a22", "#0a090e", "#040306"], obelisk: ["#22202a", "#0e0c12", "#060508"], cap: ["#d8a838", "#7a5812", "#3a2806"], flag: ["#1a181e", "#0c0a10", "#040306"], rune: "#ffc848", trim: "#ffc848", iron: "#16141a", snow: "#3a3428", frost: 0, ice: ["#ffe08a", "#ffb020"], ice2: ["#2a2430", "#120e18"], orb: ["#fff0b0", "#ffb020"] },
    FROSTBORN_ETERNAL_RANK: { plinth: ["#3a2a5a", "#1a1030", "#0a0618"], obelisk: ["#44306a", "#20143a", "#0e081c"], cap: ["#e8c060", "#8a6418", "#3a2806"], flag: ["#2a1a4a", "#140a28", "#080414"], rune: "#c08aff", trim: "#ffd878", iron: "#1e1430", snow: "#e8dcff", frost: 0.6, ice: ["#e0c8ff", "#9a5aff"], ice2: ["#c8a8ff", "#6a2ae8"], orb: ["#f0e0ff", "#a060ff"] },
    FROSTBORN_ARENA_RANK: { plinth: ["#7a4a2e", "#3e2414", "#1e1008"], obelisk: ["#6a3a2a", "#341a10", "#180c06"], cap: ["#d8963a", "#7a4a14", "#3a2206"], flag: ["#8a1a14", "#4a0a08", "#200404"], rune: "#ff7a4a", trim: "#e8a848", iron: "#2e2420", snow: "#f4e8e0", frost: 0.5, ice: ["#f4f0ec", "#e86a4a"], ice2: ["#ffd0b8", "#c83a1a"], orb: ["#ffe0c8", "#ff5a2a"] },
    FROSTBORN_SEASON_RANK: { plinth: ["#c8d0dc", "#7a8496", "#3a4250"], obelisk: ["#2a4a9a", "#142a5a", "#08142e"], cap: ["#ffd060", "#9a7418", "#4a3608"], flag: ["#1a3a8a", "#0c1e4a", "#060e24"], rune: "#9ac0ff", trim: "#e8eef8", iron: "#3a4458", snow: "#ffffff", frost: 0.9, ice: ["#e0ecff", "#6a9aff"], ice2: ["#b8d0ff", "#3a6ae8"], orb: ["#f0f6ff", "#7aa8ff"] },
    FROSTBORN_LEGEND: { plinth: ["#1e1a20", "#0c0a0e", "#040306"], obelisk: ["#241e26", "#100c12", "#060408"], cap: ["#ffc040", "#8a5a10", "#3a2406"], flag: ["#6a0e1e", "#3a0610", "#1a0208"], rune: "#ff4a6a", trim: "#ffc040", iron: "#141016", snow: "#ffd8e0", frost: 0.5, ice: ["#ff8aa8", "#ff2a5a"], ice2: ["#ffc040", "#c8801a"], orb: ["#ffb0c0", "#ff2a5a"] },
  };

  interface FrostCtx { top: number; obTop: number; H: number; s: number; ice: THREE.Material; iceDeep: THREE.Material; iron: TexSet; silver: TexSet }
  function frostSignature(L: FrostLook, c: FrostCtx) {
    const r = rng(99);
    const glow = (col: string, ei = 2.2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    const metal = (t: TexSet) => mat(t, 0.5, 0.5, { rough: 0.35, metal: 0.45 });
    switch (SKIN) {
      case "FROSTBORN_ANCIENT_GUARDIAN": {
        // moss cushions on every ledge and vines climbing the obelisk
        const moss = plainMat("#4a6a2a", { rough: 0.95, metal: 0 });
        for (let i = 0; i < 14; i++) {
          const a = r() * Math.PI * 2, d = 9 + r() * 5;
          const m = mesh(new THREE.SphereGeometry(1.5 + r() * 1.4, 10, 8), moss, Math.cos(a) * d, c.top - 0.3, Math.sin(a) * d);
          m.scale.y = 0.4;
        }
        const vine = plainMat("#3a5a20", { rough: 0.9, metal: 0 });
        for (let v = 0; v < 2; v++) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 30; i++) {
            const t = i / 30, a = t * Math.PI * 3 + v * Math.PI;
            const rr = 4.4 - t * 1.4;
            pts.push(new THREE.Vector3(Math.cos(a) * rr, c.top + t * c.H, Math.sin(a) * rr));
          }
          tube(pts, 0.35, vine, 120);
        }
        const leaf = plainMat("#5a8a30", { rough: 0.9, metal: 0, emissive: "#203a10", ei: 0.5 });
        for (let i = 0; i < 12; i++) {
          const t = r(), a = t * Math.PI * 3 + (i % 2) * Math.PI;
          const rr = 4.6 - t * 1.4;
          const m = mesh(new THREE.SphereGeometry(0.9, 6, 5), leaf, Math.cos(a) * rr, c.top + t * c.H, Math.sin(a) * rr);
          m.scale.set(1, 0.4, 1.6);
        }
        // a ring of ancient standing stones around the plinth
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.6;
          const st = mesh(new THREE.BoxGeometry(1.6, 6 + r() * 2, 1.2), plainMat("#6a7058", { rough: 0.95 }), Math.cos(a) * 16.5, 3, Math.sin(a) * 16.5);
          st.rotation.y = -a;
          mesh(new THREE.BoxGeometry(0.3, 2.4, 1.3), glow("#b8ffa0", 1.8), Math.cos(a) * 16.5 + Math.cos(a) * 0.7, 4, Math.sin(a) * 16.5 + Math.sin(a) * 0.7).rotation.y = -a;
        }
        break;
      }
      case "FROSTBORN_VOID_FROST": {
        // black icicles hanging from the cap edge and from the claws
        const ic = plainMat("#1a1030", { emissive: "#4a1aff", ei: 0.6, rough: 0.15 });
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const R = c.s >= 5 ? 12.6 : 14;
          const len = 2 + r() * 3;
          const m = mesh(new THREE.ConeGeometry(0.45, len, 6), ic, Math.cos(a) * R, c.top - 1.1 - len / 2, Math.sin(a) * R);
          m.rotation.x = Math.PI;
        }
        // void shards orbiting frozen in place around the orb
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const sh = mesh(new THREE.OctahedronGeometry(1.2, 0), plainMat("#0c0814", { emissive: "#7a4aff", ei: 1.2, rough: 0.2 }), Math.cos(a) * 8, c.obTop + 3 + r() * 4, Math.sin(a) * 8);
          sh.scale.y = 2;
          sh.rotation.z = r();
        }
        pointLights.push({ pos: new THREE.Vector3(0, c.obTop + 4, 6), color: "#6a3aff", intensity: 260, dist: 36 });
        break;
      }
      case "FROSTBORN_ARCANE_CRYSTAL": {
        // floating crystal array around the obelisk + a prism crowning it
        const pc = new THREE.MeshStandardMaterial({ color: "#ffb8ec", emissive: "#ff3ac0", emissiveIntensity: 0.8, roughness: 0.1, transparent: true, opacity: 0.88 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          crystal(7, 1.3, pc, Math.cos(a) * 8.5, c.top + c.H * 0.45, Math.sin(a) * 8.5, 0, 0);
        }
        crystal(6, 1.2, pc, 0, c.obTop + 9.5, 0, 0, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          crystal(3 + r() * 2, 0.8, pc, Math.cos(a) * 13.5, c.top - 0.5, Math.sin(a) * 13.5, Math.sin(a) * 0.6, -Math.cos(a) * 0.6);
        }
        pointLights.push({ pos: new THREE.Vector3(0, c.top + c.H * 0.45, 8), color: "#ff6ad8", intensity: 220, dist: 34 });
        break;
      }
      case "FROSTBORN_CELESTIAL_ICE": {
        // silver star finial and four slender silver spires at the corners
        const star = mesh(new THREE.OctahedronGeometry(2.2, 0), plainMat("#ffffff", { emissive: "#bfe8ff", ei: 1.6, metal: 0.3, rough: 0.2 }), 0, c.obTop + 12, 0);
        star.scale.y = 1.8;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          mesh(new THREE.ConeGeometry(0.9, 12, 8), metal(c.silver), Math.cos(a) * 12, c.top + 6, Math.sin(a) * 12);
          mesh(new THREE.SphereGeometry(0.8, 10, 8), glow("#e8f8ff", 2.4), Math.cos(a) * 12, c.top + 12.5, Math.sin(a) * 12);
        }
        anchors.aurora = new THREE.Vector3(0, c.obTop + 12, 0);
        break;
      }
      case "FROSTBORN_GLACIAL_WARLORD": {
        // angular ice armour plates around the obelisk and a crest of ice blades
        const armor = new THREE.MeshStandardMaterial({ color: "#3ab0e0", emissive: "#0a5ac0", emissiveIntensity: 0.6, roughness: 0.12, metalness: 0.2 });
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const y = c.top + 4 + k * 7;
            const w = 4.6 - k * 0.5;
            const pl = mesh(new THREE.BoxGeometry(5.4 - k * 0.6, 4.5, 0.9), armor, Math.cos(a) * w, y, Math.sin(a) * w);
            pl.rotation.y = -a + Math.PI / 2;
            pl.rotation.x = 0.18;
          }
        }
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.2;
          crystal(10, 1.1, armor, Math.cos(a) * 3.5, c.obTop + 2, Math.sin(a) * 3.5, Math.sin(a) * 0.7, -Math.cos(a) * 0.7);
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = crystal(6, 1, armor, Math.cos(a) * 14.5, 2.5, Math.sin(a) * 14.5, 0, 0);
          sp.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
        }
        break;
      }
      case "FROSTBORN_PRESTIGE_ASCENDANT": {
        // gilded crown of spikes above the orb and gold-veined obelisk edges
        const gold = plainMat("#e8b84a", { metal: 0.6, rough: 0.3, emissive: "#6a4a10", ei: 0.4 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(0.6, 4 + (i % 2) * 2, 6), gold, Math.cos(a) * 4.2, c.obTop + 11, Math.sin(a) * 4.2);
          sp.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const e = mesh(new THREE.BoxGeometry(0.5, c.H, 0.5), gold, Math.cos(a) * 3.4, c.top + c.H / 2, Math.sin(a) * 3.4);
          e.rotation.z = Math.cos(a) * 0.06;
          e.rotation.x = -Math.sin(a) * 0.06;
        }
        pointLights.push({ pos: new THREE.Vector3(0, c.obTop + 6, 6), color: "#ffd257", intensity: 260, dist: 36 });
        break;
      }
    }
  }


  interface IronLook { bark: [string, string]; vein: string; mound: [string, string]; iron: string; bronze: string; wood: [string, string]; moss: string; cloak: [string, string]; leaf: string; steelTrunk?: boolean }
  const IRON_LOOKS: Record<string, IronLook> = {
    base: { bark: ["#7a5e3c", "#2a1c10"], vein: "#8fff6a", mound: ["#5e4a30", "#22180e"], iron: "#3c4046", bronze: "#a8783a", wood: ["#8a6a42", "#4a3420"], moss: "#4e6a2a", cloak: ["#3a3024", "#2e3a24"], leaf: "#3e6a26" },
    IRONWOOD_WARDEN_OF_THE_ABYSS: { bark: ["#2a2230", "#0a080e"], vein: "#9a4aff", mound: ["#221c28", "#08060a"], iron: "#1a1820", bronze: "#4a3a6a", wood: ["#2e2636", "#120e16"], moss: "#2a1a3a", cloak: ["#120e18", "#1a1024"], leaf: "#3a1a5a" },
    IRONWOOD_CELESTIAL_WARDEN: { bark: ["#efe6d2", "#b8a888"], vein: "#ffe9a0", mound: ["#d8ccb0", "#9a8a68"], iron: "#d8c088", bronze: "#f0d080", wood: ["#f4ead4", "#c8b48a"], moss: "#e8dcb0", cloak: ["#f0e8d8", "#ffffff"], leaf: "#f0e0a0" },
    IRONWOOD_ARCANE_ENGINE: { bark: ["#5a6670", "#2a3036"], vein: "#6adfff", mound: ["#3a4248", "#1a1e22"], iron: "#2a3036", bronze: "#8a9aa8", wood: ["#4a5560", "#22282e"], moss: "#2a3a44", cloak: ["#1c2228", "#2a3a48"], leaf: "#3a6a80", steelTrunk: true },
    IRONWOOD_ANCIENT_HUNTER: { bark: ["#b8a684", "#5a4a32"], vein: "#8fffb0", mound: ["#6a5a3a", "#2a2216"], iron: "#4a4030", bronze: "#c8b48a", wood: ["#a89470", "#5a4a32"], moss: "#5a6a3a", cloak: ["#3a2e1e", "#4a3a24"], leaf: "#6a7a3a" },
    IRONWOOD_IRONCLAD_JUGGERNAUT: { bark: ["#4a4e54", "#1a1c1e"], vein: "#ff8a3a", mound: ["#3a3c40", "#16181a"], iron: "#2c2f33", bronze: "#6a6e74", wood: ["#3a3c40", "#1c1e20"], moss: "#3a3020", cloak: ["#1a1a1c", "#2a2a2e"], leaf: "#5a3a1a", steelTrunk: true },
    IRONWOOD_PRESTIGE_ASCENDANT: { bark: ["#2a2418", "#0c0a06"], vein: "#ffd257", mound: ["#221e14", "#0a0806"], iron: "#a8822e", bronze: "#e8b84a", wood: ["#2e281a", "#100e08"], moss: "#3a3018", cloak: ["#100d04", "#1a1408"], leaf: "#e8b84a" },
    IRONWOOD_AUTUMN: { bark: ["#8a5a32", "#2e1a0c"], vein: "#ffb04a", mound: ["#6a4a2a", "#24160a"], iron: "#3e3a36", bronze: "#b8803a", wood: ["#9a6a3a", "#4e3018"], moss: "#a8642a", cloak: ["#5a2e18", "#6a3a1a"], leaf: "#d8782a" },
    IRONWOOD_BIRCH: { bark: ["#e4ddcc", "#8a8274"], vein: "#bfe88a", mound: ["#a89a80", "#4a4234"], iron: "#5a5e64", bronze: "#9a8a6a", wood: ["#e8e0cc", "#a89c84"], moss: "#7a9a4a", cloak: ["#4a5a3a", "#3a4a2e"], leaf: "#8ac04a" },
    IRONWOOD_BLOODWOOD: { bark: ["#5a1a1a", "#1a0606"], vein: "#ff3a3a", mound: ["#3a1a14", "#120604"], iron: "#2a2224", bronze: "#8a3a2a", wood: ["#6a2420", "#2a0c0a"], moss: "#4a1010", cloak: ["#2a0a0a", "#3a1010"], leaf: "#8a1a1a" },
    IRONWOOD_FROSTPINE: { bark: ["#4a5a66", "#1a2228"], vein: "#8ae8ff", mound: ["#c8d8e4", "#6a7a88"], iron: "#5a6a78", bronze: "#a8c0d0", wood: ["#5a6a74", "#2a343c"], moss: "#e8f4fc", cloak: ["#2a3a4a", "#3a4e60"], leaf: "#2a5a5a" },
    IRONWOOD_GLADIATOR: { bark: ["#6a3a1e", "#22100a"], vein: "#ff4a2a", mound: ["#5a3a24", "#1e120a"], iron: "#3a2e26", bronze: "#d89a3a", wood: ["#7a4424", "#3a1a0c"], moss: "#8a2a1a", cloak: ["#7a1414", "#9a1e1e"], leaf: "#b8301e" },
    IRONWOOD_CHAMPION: { bark: ["#e8e0cc", "#7a7060"], vein: "#ffd84a", mound: ["#2a2420", "#0e0c0a"], iron: "#1e1c1e", bronze: "#ffd060", wood: ["#f0e8d4", "#9a8e74"], moss: "#c8a040", cloak: ["#1a1a22", "#2a2a36"], leaf: "#e8c050" },
    IRONWOOD_PACK_EMERALD_SENTINEL: { bark: ["#3a5a3e", "#122014"], vein: "#6affa0", mound: ["#2a3a2a", "#0e160e"], iron: "#2a3a2e", bronze: "#e8c050", wood: ["#2e4a32", "#142418"], moss: "#3a8a4a", cloak: ["#1a3a22", "#e8c050"], leaf: "#2aa860" },
    IRONWOOD_PACK_ECLIPSE: { bark: ["#1a181e", "#060508"], vein: "#ffc848", mound: ["#16141a", "#060508"], iron: "#141218", bronze: "#ffc848", wood: ["#201c24", "#0a080c"], moss: "#3a2e14", cloak: ["#0e0c10", "#2a2010"], leaf: "#8a6a1a" },
    IRONWOOD_ETERNAL_RANK: { bark: ["#3a2a5a", "#100a1e"], vein: "#c08aff", mound: ["#2a1e40", "#0c0818"], iron: "#1e1430", bronze: "#ffd878", wood: ["#4a3670", "#1e1430"], moss: "#6a4aa8", cloak: ["#2a1a4a", "#ffd878"], leaf: "#8a5ae0" },
    IRONWOOD_ARENA_RANK: { bark: ["#6a2a1e", "#200a06"], vein: "#ff5a2a", mound: ["#5a3a24", "#1e120a"], iron: "#3a2a22", bronze: "#d8963a", wood: ["#7a3a22", "#2e140a"], moss: "#8a4a1a", cloak: ["#8a1a14", "#d8963a"], leaf: "#a83a1a" },
    IRONWOOD_SEASON_RANK: { bark: ["#2a3a6a", "#0c1430"], vein: "#7ab0ff", mound: ["#2a3450", "#0e1426"], iron: "#c8d0dc", bronze: "#ffd060", wood: ["#34488a", "#141e44"], moss: "#3a5aa8", cloak: ["#1a3a8a", "#ffd060"], leaf: "#4a7ad8" },
    IRONWOOD_LEGEND: { bark: ["#1a1418", "#060406"], vein: "#ff3a5a", mound: ["#1e1a1e", "#08060a"], iron: "#141016", bronze: "#ffc040", wood: ["#241c22", "#0c080c"], moss: "#5a0a1a", cloak: ["#4a0a14", "#6a0e1e"], leaf: "#8a1028" },
  };

  interface IronCtx { deckY: number; TH: number; s: number; armTip: Record<string, THREE.Vector3>; metalM: (t: TexSet) => THREE.Material; iron: TexSet; bronze: TexSet }
  function ironSignature(c: IronCtx) {
    const r = rng(131);
    const glow = (col: string, ei = 2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    const coil = (m: THREE.Material, turns: number, r0: number, r1: number, y0: number, y1: number, rad: number, phase = 0) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, a = t * Math.PI * 2 * turns + phase;
        const rr = r0 + (r1 - r0) * t;
        pts.push(new THREE.Vector3(Math.cos(a) * rr, y0 + (y1 - y0) * t, Math.sin(a) * rr));
      }
      tube(pts, rad, m, 140);
    };
    switch (SKIN) {
      case "IRONWOOD_WARDEN_OF_THE_ABYSS": {
        const tendril = plainMat("#120e18", { emissive: "#5a1aff", ei: 0.5, rough: 0.4 });
        coil(tendril, 2.2, 6.6, 4.4, 3, 4 + c.TH, 0.7);
        coil(tendril, 1.8, 7.2, 5, 2, 4 + c.TH * 0.8, 0.55, Math.PI);
        PARENT = turret;
        for (const side of ["armL", "armR"]) {
          const t = c.armTip[side]!;
          tube([new THREE.Vector3(0, c.deckY + 1, 0), new THREE.Vector3(t.x * 0.5, c.deckY + 6, t.z * 0.5 + 2), t.clone().add(new THREE.Vector3(0, 2, 0))], 0.45, tendril);
        }
        PARENT = root;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(0.9, 6 + r() * 3, 5), plainMat("#0c0a10", { rough: 0.15, metal: 0.3, emissive: "#3a1a7a", ei: 0.3 }), Math.cos(a) * 11, 4, Math.sin(a) * 11);
          sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        }
        mesh(new THREE.SphereGeometry(2.4, 20, 14), plainMat("#1a0a30", { emissive: "#7a3aff", ei: 0.9, rough: 0.1 }), 0, 4 + c.TH * 0.5, 4.2);
        break;
      }
      case "IRONWOOD_CELESTIAL_WARDEN": {
        const gold = plainMat("#f0d080", { metal: 0.6, rough: 0.3, emissive: "#6a5020", ei: 0.4 });
        const feather = plainMat("#fff8e8", { rough: 0.6, emissive: "#ffe9a0", ei: 0.25 });
        PARENT = turret;
        for (const side of ["armL", "armR"]) {
          const t = c.armTip[side]!;
          for (let k = 0; k < 6; k++) {
            const f = k / 6;
            const f0 = new THREE.Vector3(t.x * (0.3 + f * 0.7), c.deckY + 3 + f * 2.4, t.z * (0.3 + f * 0.7) + 4 * (1 - f));
            const fm = mesh(new THREE.ConeGeometry(0.8, 6 - f * 2, 5), feather, f0.x, f0.y - 2, f0.z - 0.6);
            fm.rotation.x = Math.PI;
            fm.rotation.z = Math.sign(t.x) * -0.4;
          }
        }
        const halo = mesh(new THREE.TorusGeometry(3.2, 0.32, 8, 40), glow("#ffe9a0", 2.2), 0, c.deckY + 8.6, -4.6);
        void halo;
        PARENT = root;
        for (const y of [0.3, 0.68]) mesh(new THREE.CylinderGeometry(5.4 + (3.6 - 5.4) * y + 0.75, 5.4 + (3.6 - 5.4) * y + 0.8, 0.6, 20), gold, 0, 4 + c.TH * y + 0.9, 0);
        pointLights.push({ pos: new THREE.Vector3(0, c.deckY + 8, 2), color: "#ffe9a0", intensity: 220, dist: 36 });
        break;
      }
      case "IRONWOOD_ARCANE_ENGINE": {
        const steel = c.metalM(c.iron);
        const cyan = glow("#6adfff", 2);
        // gears turning (static) on the trunk and pistons from the base to the deck
        for (const [y, rr] of [[0.25, 6.6], [0.62, 5.6]] as const) {
          const gy = 4 + c.TH * y;
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            const tooth = mesh(new THREE.BoxGeometry(1.1, 1.6, 1.1), steel, Math.cos(a) * rr, gy, Math.sin(a) * rr);
            tooth.rotation.y = -a;
          }
        }
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          tube([new THREE.Vector3(Math.cos(a) * 10, 3, Math.sin(a) * 10), new THREE.Vector3(Math.cos(a) * 6, c.deckY - 2, Math.sin(a) * 6)], 0.7, steel, 4);
          tube([new THREE.Vector3(Math.cos(a) * 10.3, 3.2, Math.sin(a) * 10.3), new THREE.Vector3(Math.cos(a) * 6.2, c.deckY - 3, Math.sin(a) * 6.2)], 0.25, cyan, 4);
        }
        coil(cyan, 3, 5.7, 4.0, 5, 3 + c.TH, 0.22);
        break;
      }
      case "IRONWOOD_ANCIENT_HUNTER": {
        const bone = plainMat("#e8dcc0", { rough: 0.7 });
        // a great beast skull mounted at the front of the ballista
        PARENT = turret;
        const sk = new THREE.Vector3(0, c.deckY + 2.4, 7.4);
        const cran = mesh(new THREE.SphereGeometry(2.6, 16, 12), bone, sk.x, sk.y + 0.8, sk.z);
        cran.scale.set(1, 0.85, 1.15);
        mesh(new THREE.BoxGeometry(3.4, 1.4, 3), bone, sk.x, sk.y - 0.8, sk.z + 1.4);
        for (const x of [-1, 1]) mesh(new THREE.SphereGeometry(0.6, 8, 6), glow("#8fffb0", 2.6), sk.x + x * 1, sk.y + 1, sk.z + 2.2);
        // antlers sweeping back from the skull
        for (const side of [-1, 1]) {
          tube([new THREE.Vector3(side * 1.6, sk.y + 2.2, sk.z - 0.5), new THREE.Vector3(side * 4, sk.y + 5, sk.z - 2), new THREE.Vector3(side * 6.5, sk.y + 7.5, sk.z - 5)], 0.42, bone);
          tube([new THREE.Vector3(side * 4, sk.y + 5, sk.z - 2), new THREE.Vector3(side * 5.5, sk.y + 7.6, sk.z - 1)], 0.3, bone);
        }
        PARENT = root;
        // trophies: small skulls hanging from the trunk bands
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          mesh(new THREE.SphereGeometry(0.85, 10, 8), bone, Math.cos(a) * 6, 4 + c.TH * 0.3 - 1.6, Math.sin(a) * 6);
        }
        break;
      }
      case "IRONWOOD_IRONCLAD_JUGGERNAUT": {
        const plate = c.metalM(c.iron);
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + k * 0.5;
            const rr = 5.6 - k * 0.5;
            const pl = mesh(new THREE.BoxGeometry(4.2, 5.2, 0.8), plate, Math.cos(a) * rr, 6 + k * 6.5, Math.sin(a) * rr);
            pl.rotation.y = -a + Math.PI / 2;
            pl.rotation.x = -0.12;
          }
        }
        // spiked ram on the front of the ballista and spikes on the base
        const spike = plainMat("#8a8e94", { metal: 0.5, rough: 0.35 });
        PARENT = turret;
        for (const x of [-1.2, 0, 1.2]) {
          const sp = mesh(new THREE.ConeGeometry(0.6, 3.4, 6), spike, x, c.deckY + 2.6, 8.4);
          sp.rotation.x = Math.PI / 2;
        }
        PARENT = root;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(0.7, 4, 6), spike, Math.cos(a) * 12, 3.5, Math.sin(a) * 12);
          sp.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
        }
        mesh(new THREE.SphereGeometry(2, 16, 12), glow("#ff8a3a", 2.4), 0, 4 + c.TH * 0.5, 4.6);
        pointLights.push({ pos: new THREE.Vector3(0, 4 + c.TH * 0.5, 9), color: "#ff8a3a", intensity: 220, dist: 30 });
        break;
      }
      case "IRONWOOD_PRESTIGE_ASCENDANT": {
        const gold = plainMat("#e8b84a", { metal: 0.6, rough: 0.3, emissive: "#6a4a10", ei: 0.4 });
        coil(gold, 2, 5.8, 4.1, 4, 4 + c.TH, 0.3);
        PARENT = turret;
        for (const side of ["armL", "armR"]) {
          const t = c.armTip[side]!;
          const g = mesh(new THREE.OctahedronGeometry(1.2, 0), glow("#ffd257", 2.2), t.x, t.y + 1.4, t.z);
          g.scale.y = 1.8;
        }
        mesh(new THREE.TorusGeometry(3, 0.28, 8, 40), glow("#ffd257", 2.2), 0, c.deckY + 8.6, -4.6);
        PARENT = root;
        break;
      }
    }
  }

  interface InfLook { iron: string; dark: string; brass: string; brick: Tri; fire: string; lavaBrick?: boolean }
  const INF_LOOKS: Record<string, InfLook> = {
    base: { iron: "#3a3634", dark: "#24201e", brass: "#8a6a34", brick: ["#6a3a28", "#3a1c12", "#1a0c08"], fire: "#ff7a2a" },
    INFERNO_PACK_EMBERHEART: { iron: "#3a1410", dark: "#160806", brass: "#ffb23a", brick: ["#5a1a14", "#2a0a08", "#120404"], fire: "#ffb23a", lavaBrick: true },
    INFERNO_PACK_SOVEREIGN: { iron: "#c8a850", dark: "#6a5020", brass: "#ffe6a0", brick: ["#f2ead8", "#c0b090", "#7a6a48"], fire: "#ff4a5a" },
    INFERNO_ETERNAL_RANK: { iron: "#2a1a40", dark: "#120a20", brass: "#ffd878", brick: ["#4a3670", "#24183a", "#0e0818"], fire: "#b06aff" },
    INFERNO_ARENA_RANK: { iron: "#4a2a1e", dark: "#1e0e08", brass: "#e8a848", brick: ["#7a2a1e", "#3e140c", "#1a0804"], fire: "#ff4a1a" },
    INFERNO_SEASON_RANK: { iron: "#c8d0dc", dark: "#2a3450", brass: "#ffd060", brick: ["#2a4a9a", "#142a5a", "#08142e"], fire: "#4a9aff" },
    INFERNO_ASHEN_TYRANT: { iron: "#2a1a1c", dark: "#120a0c", brass: "#5a1a1a", brick: ["#3a1a1a", "#1a0a0a", "#0a0404"], fire: "#ff2e2e", lavaBrick: true },
    INFERNO_VOLCANIC_COLOSSUS: { iron: "#3a2e28", dark: "#1c1410", brass: "#4a3428", brick: ["#4a3a30", "#1c1410", "#0e0806"], fire: "#ff8a3a", lavaBrick: true },
    INFERNO_INDUSTRIAL_FORGE: { iron: "#5a5e62", dark: "#2a2c2e", brass: "#b07a40", brick: ["#5a5450", "#2e2a28", "#141210"], fire: "#9ad8ff" },
    INFERNO_SOLAR_ASCENDANT: { iron: "#a8823a", dark: "#5a4018", brass: "#f0d890", brick: ["#e8d4a0", "#b09460", "#6a5430"], fire: "#fff0b0" },
    INFERNO_PLAGUE_FURNACE: { iron: "#3a4a2a", dark: "#1c2414", brass: "#5a6a2a", brick: ["#3a4428", "#1a2210", "#0a1006"], fire: "#aaff4a", lavaBrick: true },
    INFERNO_PRESTIGE_ASCENDANT: { iron: "#2a2418", dark: "#100d06", brass: "#e8b84a", brick: ["#2e2a20", "#12100a", "#060504"], fire: "#ffd257" },
    INFERNO_COPPER: { iron: "#7a4a2a", dark: "#3a2214", brass: "#c87a3a", brick: ["#7a4a34", "#3e2416", "#1e1008"], fire: "#ff9a3a" },
    INFERNO_SOOT: { iron: "#26262a", dark: "#121214", brass: "#4a4a4e", brick: ["#3a3a3e", "#1c1c1e", "#0c0c0e"], fire: "#ff6a1a" },
    INFERNO_BLUE_FLAME: { iron: "#2a3442", dark: "#141a22", brass: "#5a7aa0", brick: ["#34404e", "#1a2028", "#0c1014"], fire: "#3aa8ff" },
    INFERNO_EMERALD: { iron: "#24342a", dark: "#121a14", brass: "#6a8a4a", brick: ["#2e4434", "#16221a", "#0a100c"], fire: "#4aff7a" },
    INFERNO_GLADIATOR: { iron: "#4a2e1e", dark: "#1e120a", brass: "#d89a3a", brick: ["#7a2a1e", "#3e140c", "#1e0806"], fire: "#ff4a1a" },
    INFERNO_CHAMPION: { iron: "#1e1c22", dark: "#0c0a0e", brass: "#ffd060", brick: ["#e8e0cc", "#8a826e", "#3e3a30"], fire: "#ffd84a" },
    INFERNO_LEGEND: { iron: "#16121a", dark: "#08060a", brass: "#ffc040", brick: ["#2a1e26", "#140e12", "#060406"], fire: "#ff2a5a" },
  };

  interface InfCtx { s: number; iron: TexSet; darkIron: TexSet; brass: TexSet; metalM: (t: TexSet, rx?: number, ry?: number) => THREE.Material }
  function infernoSignature(c: InfCtx) {
    const r = rng(151);
    const glow = (col: string, ei = 2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    switch (SKIN) {
      case "INFERNO_ASHEN_TYRANT": {
        const horn = plainMat("#1a1012", { rough: 0.35, metal: 0.2 });
        for (const side of [-1, 1]) {
          tube([new THREE.Vector3(side * 6.5, 15.5, 1), new THREE.Vector3(side * 9.5, 19, 0), new THREE.Vector3(side * 10.5, 23, -2.5), new THREE.Vector3(side * 8.5, 26, -4)], 1.1, horn, 24);
          tube([new THREE.Vector3(side * 8.5, 26, -4), new THREE.Vector3(side * 7.8, 27, -4.6)], 0.4, horn, 4);
        }
        const fang = plainMat("#e8dcc8", { rough: 0.5 });
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.15 + (i / 8) * 0.7);
          const fm = mesh(new THREE.ConeGeometry(0.55, 2.2, 5), fang, Math.cos(a) * 4.4, 10.5 + Math.sin(a) * 4.4 - 0.4, 6.4);
          fm.rotation.z = a - Math.PI / 2 + Math.PI;
        }
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI * (0.15 + (i / 8) * 0.7);
          const fm = mesh(new THREE.ConeGeometry(0.5, 1.8, 5), fang, Math.cos(a) * 4.4, 10.5 + Math.sin(a) * 4.4 + 0.4, 6.4);
          fm.rotation.z = a - Math.PI / 2 + Math.PI;
        }
        for (const x of [-3.2, 3.2]) mesh(new THREE.SphereGeometry(0.9, 10, 8), glow("#ff2e2e", 3), x, 15.6, 5.2);
        break;
      }
      case "INFERNO_VOLCANIC_COLOSSUS": {
        const rock = plainMat("#2a201c", { rough: 0.95 });
        const lava = glow("#ff7a2a", 2.4);
        for (let i = 0; i < 16; i++) {
          const a = r() * Math.PI * 2, d = 7 + r() * 2;
          const m = mesh(new THREE.DodecahedronGeometry(1.8 + r() * 1.8, 0), rock, Math.cos(a) * d, 6 + r() * 10, Math.sin(a) * d * 0.7);
          m.rotation.set(r() * 3, r() * 3, r() * 3);
        }
        // a smouldering volcanic cone replacing the chimney top
        mesh(new THREE.ConeGeometry(4.2, 6, 10, 1, true), rock, 4.6, 10 + 17 + 1, -3.5);
        mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 12), lava, 4.6, 10 + 17 + 3.6, -3.5);
        for (let i = 0; i < 6; i++) {
          const a = r() * Math.PI * 2;
          tube([new THREE.Vector3(Math.cos(a) * 7.5, 15, 3), new THREE.Vector3(Math.cos(a) * 7.8, 10, 3.5), new THREE.Vector3(Math.cos(a) * 8, 5, 4)], 0.3, lava, 6);
        }
        break;
      }
      case "INFERNO_INDUSTRIAL_FORGE": {
        const brass = c.metalM(c.brass);
        const dial = plainMat("#f4f0e4", { rough: 0.4 });
        for (const [x, y] of [[-5, 14.5], [5, 14.5], [-6.2, 8]] as const) {
          mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 20), brass, x, y, 5.6).rotation.x = Math.PI / 2;
          mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 20), dial, x, y, 6);
          const needle = mesh(new THREE.BoxGeometry(0.15, 1, 0.1), plainMat("#c82a1a"), x + 0.2, y + 0.3, 6.1);
          needle.rotation.z = -0.6;
        }
        for (let k = 0; k < 3; k++) {
          tube([new THREE.Vector3(-7.5, 5 + k * 3, -2 + k), new THREE.Vector3(-9.5, 7 + k * 3, k), new THREE.Vector3(-9, 12 + k * 2, -3), new THREE.Vector3(-4.6, 22, -3.5)], 0.45, brass, 30);
        }
        // valve wheel
        const wheel = mesh(new THREE.TorusGeometry(1.6, 0.3, 8, 20), plainMat("#c82a1a", { rough: 0.5 }), 7.8, 9, 2);
        wheel.rotation.y = Math.PI / 2;
        anchors.steam = new THREE.Vector3(-9.5, 13, -1);
        break;
      }
      case "INFERNO_SOLAR_ASCENDANT": {
        const gold = plainMat("#f0d890", { metal: 0.6, rough: 0.25, emissive: "#6a5020", ei: 0.5 });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const len = i % 2 ? 2.4 : 4;
          const ray = mesh(new THREE.ConeGeometry(0.55, len, 5), gold, Math.cos(a) * (5.2 + len / 2), 10.5 + Math.sin(a) * (5.2 + len / 2), 5.8);
          ray.rotation.z = a - Math.PI / 2;
        }
        mesh(new THREE.SphereGeometry(2.6, 20, 14), glow("#fff0b0", 1.8), 0, 18.5, -1);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const ray = mesh(new THREE.ConeGeometry(0.35, 2.4, 5), gold, Math.cos(a) * 3.8, 18.5 + Math.sin(a) * 3.8, -1);
          ray.rotation.z = a - Math.PI / 2;
        }
        pointLights.push({ pos: new THREE.Vector3(0, 18, 4), color: "#fff0b0", intensity: 260, dist: 36 });
        break;
      }
      case "INFERNO_PLAGUE_FURNACE": {
        const rust = plainMat("#4a3a20", { rough: 0.9, metal: 0.2 });
        const goo = glow("#aaff4a", 1.6);
        for (const [x, z] of [[-10, 3], [9.5, 4], [-8, -6]] as const) {
          mesh(new THREE.CylinderGeometry(2.2, 2, 4.4, 14), rust, x, 5.2, z);
          mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.3, 14), goo, x, 7.45, z);
          for (const y of [4, 6.4]) mesh(new THREE.TorusGeometry(2.15, 0.18, 6, 20), plainMat("#2a2414", { metal: 0.4 }), x, y, z).rotation.x = Math.PI / 2;
        }
        anchors.vat1 = new THREE.Vector3(-10, 7.6, 3);
        anchors.vat2 = new THREE.Vector3(9.5, 7.6, 4);
        const moss = plainMat("#4a6a20", { rough: 0.95, metal: 0 });
        for (let i = 0; i < 10; i++) {
          const m = mesh(new THREE.SphereGeometry(1 + r(), 8, 6), moss, (r() - 0.5) * 14, 15 + r() * 0.6, (r() - 0.5) * 9);
          m.scale.y = 0.35;
        }
        for (let i = 0; i < 4; i++) tube([new THREE.Vector3(-7.5 + i * 5, 15.2, 5.5), new THREE.Vector3(-7.4 + i * 5, 12, 5.9), new THREE.Vector3(-7.3 + i * 5, 9.5 + r(), 5.9)], 0.3, goo, 6);
        break;
      }
      case "INFERNO_PRESTIGE_ASCENDANT": {
        const gold = plainMat("#e8b84a", { metal: 0.6, rough: 0.3, emissive: "#6a4a10", ei: 0.4 });
        for (let i = 0; i < 7; i++) {
          const sp = mesh(new THREE.ConeGeometry(0.6, 3 + (i % 2) * 1.6, 6), gold, -6 + i * 2, 21, 0);
          void sp;
        }
        mesh(new THREE.BoxGeometry(15.4, 0.9, 11.4), gold, 0, 15.3, 0);
        for (const y of [5.5, 15]) mesh(new THREE.BoxGeometry(15.4, 0.6, 0.4), gold, 0, y, 5.6);
        break;
      }
    }
  }

  interface StormLook { dais: Tri; pillar: Tri; rod: string; band: string; glow: string; orb: [string, string] }
  const STORM_LOOKS: Record<string, StormLook> = {
    base: { dais: ["#6a6470", "#34303c", "#18161c"], pillar: ["#76707e", "#3e3a46", "#1c1a20"], rod: "#b06a3a", band: "#2c2a34", glow: "#a050ff", orb: ["#8a5ad0", "#5a20c0"] },
    STORMCALLER_PACK_CRIMSON_STORM: { dais: ["#4a1a1e", "#1e080a", "#0c0304"], pillar: ["#5a1e24", "#240a0e", "#100406"], rod: "#c8c0c4", band: "#240a0e", glow: "#ff3a4a", orb: ["#ff8a94", "#ff1a2e"] },
    STORMCALLER_PACK_SOVEREIGN: { dais: ["#f2ead8", "#c0b090", "#7a6a48"], pillar: ["#f6f0e2", "#c8b898", "#8a7a58"], rod: "#e8c870", band: "#b01a2a", glow: "#ffe2a0", orb: ["#fff4d0", "#ff4a5a"] },
    STORMCALLER_ETERNAL_RANK: { dais: ["#3a2a5a", "#1a1030", "#0a0618"], pillar: ["#44306a", "#20143a", "#0e081c"], rod: "#ffd878", band: "#1a1030", glow: "#c08aff", orb: ["#f0e0ff", "#9a4aff"] },
    STORMCALLER_ARENA_RANK: { dais: ["#7a4a2e", "#3e2414", "#1e1008"], pillar: ["#8a3a24", "#461a10", "#200a06"], rod: "#e8a848", band: "#3e140c", glow: "#ff6a2a", orb: ["#ffd0a0", "#ff4a1a"] },
    STORMCALLER_SEASON_RANK: { dais: ["#c8d0dc", "#7a8496", "#3a4250"], pillar: ["#2a4a9a", "#142a5a", "#08142e"], rod: "#e8eef8", band: "#ffd060", glow: "#8ab8ff", orb: ["#f0f6ff", "#4a8aff"] },
    STORMCALLER_VOID: { dais: ["#2a2430", "#100c14", "#060408"], pillar: ["#2e2836", "#120e16", "#08060a"], rod: "#2a2234", band: "#120e18", glow: "#5a1fff", orb: ["#1a0a30", "#4a10ff"] },
    STORMCALLER_THUNDER: { dais: ["#4a5a6a", "#1c2834", "#0c141a"], pillar: ["#3a5068", "#182838", "#0a141c"], rod: "#8a96a2", band: "#1c2a3a", glow: "#4ac8ff", orb: ["#6ac0f0", "#1a8aff"] },
    STORMCALLER_CELESTIAL: { dais: ["#ece6d6", "#b4a888", "#7a6e54"], pillar: ["#f4eee0", "#c4b898", "#8a7e60"], rod: "#e8c870", band: "#c8a050", glow: "#ffe9a0", orb: ["#fff4c8", "#ffd060"] },
    STORMCALLER_ARCANE: { dais: ["#4a3a60", "#22182e", "#100a16"], pillar: ["#56466e", "#281e36", "#120c1a"], rod: "#c89ae8", band: "#2a1e3a", glow: "#d89aff", orb: ["#e8b8ff", "#b04aff"] },
    STORMCALLER_TEMPEST: { dais: ["#3a5a50", "#1a2e28", "#0a1612"], pillar: ["#46685c", "#1e342c", "#0c1814"], rod: "#a8c8c0", band: "#1a3028", glow: "#6affd0", orb: ["#9affe0", "#20d0a0"] },
    STORMCALLER_PRESTIGE_ASCENDANT: { dais: ["#2a2620", "#100e0a", "#060504"], pillar: ["#2e2a22", "#14110c", "#070604"], rod: "#e8b84a", band: "#a8822e", glow: "#ffd257", orb: ["#fff0b0", "#ffc030"] },
    STORMCALLER_COPPER: { dais: ["#7a5a44", "#3e2c20", "#1e140e"], pillar: ["#86644a", "#443222", "#20160e"], rod: "#d8843a", band: "#3a2a1e", glow: "#ffb04a", orb: ["#ffc06a", "#ff8a1a"] },
    STORMCALLER_SLATE: { dais: ["#4e5458", "#26292c", "#121416"], pillar: ["#5a6064", "#2c3032", "#141618"], rod: "#8a9298", band: "#1e2224", glow: "#8ab8ff", orb: ["#a0c4ff", "#4a7aff"] },
    STORMCALLER_RUBY: { dais: ["#4a2a30", "#221216", "#100808"], pillar: ["#56303a", "#28161c", "#120a0c"], rod: "#c8a070", band: "#2a1418", glow: "#ff3a5a", orb: ["#ff6a80", "#e0102a"] },
    STORMCALLER_SUNSTORM: { dais: ["#c8b48a", "#7a6a48", "#3a3020"], pillar: ["#d4c098", "#86744e", "#40361e"], rod: "#e8c060", band: "#5a4a2a", glow: "#ffd84a", orb: ["#fff0a0", "#ffc020"] },
    STORMCALLER_GLADIATOR: { dais: ["#6a3a24", "#341c10", "#180c06"], pillar: ["#7a4428", "#3c2012", "#1c0e08"], rod: "#d89a3a", band: "#7a1414", glow: "#ff5a2a", orb: ["#ff8a5a", "#ff3a1a"] },
    STORMCALLER_CHAMPION: { dais: ["#e8e0cc", "#8a826e", "#3e3a30"], pillar: ["#f0e8d4", "#968c76", "#46402e"], rod: "#ffd060", band: "#1a1a22", glow: "#ffe06a", orb: ["#fff4c0", "#ffcc3a"] },
    STORMCALLER_LEGEND: { dais: ["#1e1a20", "#0c0a0e", "#040306"], pillar: ["#241e26", "#100c12", "#060408"], rod: "#ffc040", band: "#6a0e1e", glow: "#ff3a6a", orb: ["#ff9ab0", "#ff1a4a"] },
  };

  interface StormCtx { s: number; topY: number; PH: number; copper: TexSet; dark: TexSet; metalM: (t: TexSet) => THREE.Material; pillarStone: TexSet }
  function stormSignature(c: StormCtx) {
    const r = rng(171);
    const glow = (col: string, ei = 2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    switch (SKIN) {
      case "STORMCALLER_VOID": {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          const sh = mesh(new THREE.OctahedronGeometry(1.3, 0), plainMat("#0a0612", { emissive: "#5a1fff", ei: 1, rough: 0.15 }), Math.cos(a) * 9, c.topY - 4 - r() * 8, Math.sin(a) * 9);
          sh.scale.y = 2.4;
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(1, 9, 5), plainMat("#0c0a10", { rough: 0.15, metal: 0.3 }), Math.cos(a) * 11, 6, Math.sin(a) * 11);
          sp.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
        }
        break;
      }
      case "STORMCALLER_THUNDER": {
        // ceramic insulator stacks and a heavy central conductor spike
        const ceramic = LOOK === "STORMCALLER_PACK_CRIMSON_STORM" ? plainMat("#2a2a32", { rough: 0.25, metal: 0.8 }) : plainMat("#e8eef4", { rough: 0.3 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          for (let k = 0; k < 5; k++) mesh(new THREE.CylinderGeometry(1.4 - k * 0.05, 1.4, 0.6, 14), ceramic, Math.cos(a) * 11, 4 + k * 1.1, Math.sin(a) * 11);
          mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), c.metalM(c.copper), Math.cos(a) * 11, 11, Math.sin(a) * 11);
          anchors[`spike${i}`] = new THREE.Vector3(Math.cos(a) * 11, 13, Math.sin(a) * 11);
        }
        PARENT = turret;
        mesh(new THREE.ConeGeometry(0.9, 9, 8), c.metalM(c.copper), 0, c.topY + 15, 0);
        PARENT = root;
        anchors.rod5 = new THREE.Vector3(0, c.topY + 19.5, 0);
        break;
      }
      case "STORMCALLER_CELESTIAL": {
        const gold = plainMat("#e8c870", { metal: 0.6, rough: 0.25, emissive: "#6a5020", ei: 0.4 });
        PARENT = turret;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const h = mesh(new THREE.TorusGeometry(1.6, 0.18, 6, 24), glow("#ffe9a0", 2.2), Math.cos(a + 0.5) * 5.4, c.topY + 12.5, Math.sin(a + 0.5) * 5.4);
          h.rotation.x = Math.PI / 2;
        }
        PARENT = root;
        for (const side of [-1, 1]) {
          for (let k = 0; k < 5; k++) {
            const f = mesh(new THREE.ConeGeometry(0.7, 7 - k, 5), plainMat("#fff8e8", { emissive: "#ffe9a0", ei: 0.3 }), side * (5 + k * 1.3), c.topY - 2 + k * 0.6, -1.5);
            f.rotation.z = side * (1.1 + k * 0.12);
          }
        }
        for (const y of [0.22, 0.6]) mesh(new THREE.CylinderGeometry(4.35 - y, 4.55 - y, 0.5, 16), gold, 0, 5.2 + c.PH * y + 0.9, 0);
        break;
      }
      case "STORMCALLER_ARCANE": {
        // rune rods hovering free around the pillar, glyph plates on the dais
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.2;
          const rod = mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 6), c.metalM(c.copper), Math.cos(a) * 8, c.topY - 3 + (i % 2) * 2, Math.sin(a) * 8);
          rod.rotation.z = 0.15;
          mesh(new THREE.OctahedronGeometry(0.8, 0), glow("#ff9ae0", 2.4), Math.cos(a) * 8, c.topY + 1 + (i % 2) * 2, Math.sin(a) * 8);
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), glow("#d89aff", 1.6), Math.cos(a) * 11.5, 3.1, Math.sin(a) * 11.5).rotation.y = a;
        }
        break;
      }
      case "STORMCALLER_TEMPEST": {
        // wind vanes / turbine sails around the pillar
        // curved wind blades spiralling around the upper pillar
        const blade = plainMat("#9ad8c8", { rough: 0.4, metal: 0.3, emissive: "#1a6a50", ei: 0.4 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, aa = a + t * 1.6;
            pts.push(new THREE.Vector3(Math.cos(aa) * (4.6 + t * 4), c.topY - 10 + t * 8, Math.sin(aa) * (4.6 + t * 4)));
          }
          tube(pts, 0.55, blade, 24);
        }
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 50; i++) {
          const t = i / 50, a = t * Math.PI * 5;
          pts.push(new THREE.Vector3(Math.cos(a) * (8 - t * 3), 5 + t * (c.PH + 6), Math.sin(a) * (8 - t * 3)));
        }
        tube(pts, 0.2, glow("#6affd0", 1.4), 200);
        break;
      }
      case "STORMCALLER_PRESTIGE_ASCENDANT": {
        const gold = plainMat("#e8b84a", { metal: 0.6, rough: 0.3, emissive: "#6a4a10", ei: 0.4 });
        PARENT = turret;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(0.55, 4 + (i % 2) * 2, 6), gold, Math.cos(a) * 4.8, c.topY + 2.5, Math.sin(a) * 4.8);
          sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        }
        PARENT = root;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(0.4, 0.3, 6), gold, Math.cos(a) * 9.5, 3.1, Math.sin(a) * 9.5).rotation.y = -a + Math.PI / 2;
        }
        break;
      }
    }
  }
  // ---------------------------------------------------------------------------
  // FROSTBORN — hexagonal stone plinth, tapering slate obelisk, ice orb cradle.
  // Stage gates (every 10 levels): 2 ice crystals at the plinth, 3 glowing rune
  // band + crystals, 4 silver-capped plinth + floating rune ring, 5 second
  // plinth tier + crown shards, 6 glacial crown + frost-capped stepped base.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // FROSTBORN SKIN BODIES — every skin is its own monument on the hexagonal
  // plinth, not a recolour: a stone golem holding the cold aloft, a void
  // portal, a floating arcane crystal, a winged celestial spire, an ice
  // fortress, a golden astrolabe, a pyramid with an ice capstone, a crescent
  // moon shrine, an aurora totem, an obsidian mirror, a little colosseum, a
  // great snowflake medal, a frozen sword in the stone. The cold gathers and
  // fires from `orb`; every stage adds pieces.
  // ---------------------------------------------------------------------------
  function frostSkinBody(L: FrostLook, s: number, top: number, ice: THREE.Material, iceDeep: THREE.Material): boolean {
    // only the looks that still read as this tower's element get their own structure; the rest keep the standard tower
    if (!FROST_OWN.has(SKIN)) return false;
    const glow = (col: string, ei = 2.2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    const metal = (col: string, rough = 0.3, met = 0.8) => plainMat(col, { rough, metal: met });
    const orbM = () => new THREE.MeshStandardMaterial({ color: L.orb[0], emissive: L.orb[1], emissiveIntensity: 0.9, roughness: 0.1 });
    const orb = (x: number, y: number, z: number, rad = 3.6) => {
      mesh(new THREE.SphereGeometry(rad, 32, 24), orbM(), x, y, z);
      anchors.orb = new THREE.Vector3(x, y, z);
      pointLights.push({ pos: new THREE.Vector3(x, y, z + 2), color: L.rune, intensity: 240 + s * 60, dist: 40 });
    };
    const stone = (seed: number, tri: Tri, rows = 4, cols = 4, runes = false) => stoneTex(seed, tri[0], tri[1], tri[2], rows, cols, runes ? { runes: L.rune, runeRows: [1, 3], frost: 0.3 * L.frost } : { frost: 0.3 * L.frost });
    const r = rng(SKIN.length * 17 + 3);
    const ring = (rad: number, y: number, m: THREE.Material, tube = 0.35, rx = Math.PI / 2, ry = 0) => {
      const t = mesh(new THREE.TorusGeometry(rad, tube, 10, 48), m, 0, y, 0);
      t.rotation.set(rx, ry, 0);
      return t;
    };

    switch (SKIN) {
      // ---- an ancient carved stone head sunk in a glacier, eyes burning with cold, the orb over its brow ----
      case "FROSTBORN_ANCIENT_GUARDIAN": {
        const stoneT = stone(301, L.obelisk, 6, 4, true);
        const st = mat(stoneT, 1, 1.4, { emissiveColor: L.rune, emissiveIntensity: 2.2, bump: 2 });
        const moss = plainMat("#4a6a3a", { rough: 1 });
        const H = s >= 5 ? 1.15 : 1;
        // the head: a long carved block, heavy brow, deep sockets, broad nose, set jaw
        const head = mesh(new THREE.BoxGeometry(8.5 * H, 15 * H, 7 * H), st, 0, top + 8.5 * H, -0.5);
        void head;
        mesh(new THREE.BoxGeometry(9.4 * H, 2 * H, 2.2 * H), st, 0, top + 12.6 * H, 3.2 * H);
        for (const sx of [-1, 1]) {
          mesh(new THREE.BoxGeometry(2.4 * H, 1.4 * H, 1), plainMat("#0a0e14", { rough: 1 }), sx * 2.2 * H, top + 11.1 * H, 3.1 * H);
          mesh(new THREE.SphereGeometry(0.75 * H, 12, 8), glow(L.rune, 3.2), sx * 2.2 * H, top + 11.1 * H, 3.5 * H);
        }
        const nose = mesh(new THREE.BoxGeometry(2.2 * H, 5 * H, 2.4 * H), st, 0, top + 8.6 * H, 3.6 * H);
        nose.rotation.x = 0.12;
        mesh(new THREE.BoxGeometry(5.6 * H, 1 * H, 1.6 * H), st, 0, top + 5.2 * H, 3.3 * H);
        mesh(new THREE.BoxGeometry(7.4 * H, 3 * H, 6.4 * H), st, 0, top + 2.6 * H, 0.2);
        // runes cut down its cheeks, moss in the cracks
        for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) mesh(new THREE.BoxGeometry(0.4, 1.4, 0.3), glow(L.rune, 2.4), sx * 3.7 * H, top + (6 + k * 2.2) * H, 2.9 * H);
        for (let i = 0; i < 6; i++) {
          const m = mesh(new THREE.SphereGeometry(0.9 + r() * 0.7, 8, 6), moss, (r() - 0.5) * 8 * H, top + (14.5 + r()) * H, (r() - 0.5) * 5);
          m.scale.y = 0.4;
        }
        // the glacier swallowing its shoulders
        const n = s >= 3 ? 11 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r() * 0.3;
          const d = 4.6 + r() * 3;
          crystal(5 + r() * (s >= 4 ? 9 : 6), 1.3 + r() * 1.1, i % 3 ? ice : iceDeep, Math.cos(a) * d, top - 0.6, Math.sin(a) * d * 0.9, Math.sin(a) * 0.35, -Math.cos(a) * 0.35);
        }
        const sheet = new THREE.MeshPhysicalMaterial({ color: L.ice[0], emissive: L.ice[1], emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false });
        const shell = mesh(new THREE.CylinderGeometry(6.2, 8.4, 6, 9), sheet, 0, top + 3, 0);
        shell.rotation.y = 0.3;
        // the cold gathers in an orb over its brow, inside a ring of ice
        orb(0, top + 20.5 * H, 0.6, 3);
        ring(4.6, top + 20.5 * H, ice, 0.35, Math.PI / 2 - 0.3);
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 20.5 * H, 0.6);
        if (s >= 5) for (let i = 0; i < 5; i++) {
          const a = -0.9 + i * 0.45;
          crystal(4 + (i === 2 ? 2.5 : 0), 0.7, ice, Math.sin(a) * 3.6 * H, top + 15.3 * H, -0.5 - Math.cos(a) * 1.2, -0.15, -a * 0.5);
        }
        if (s >= 6) ring(7, top + 20.5 * H, glow(L.rune, 2.4), 0.22, Math.PI / 2 - 0.3);
        return true;
      }

      // ---- a portal into the void: a ring of black stone torn open, dark ice around it ----
      case "FROSTBORN_VOID_FROST": {
        const st = mat(stone(311, L.obelisk, 6, 10, true), 2, 1, { emissiveColor: L.rune, emissiveIntensity: 2.4 });
        const R = 9;
        const arch = mesh(new THREE.TorusGeometry(R, 1.6, 12, 48), st, 0, top + R + 2, 0);
        void arch;
        mesh(new THREE.CircleGeometry(R - 1.2, 40), plainMat("#05030a", { emissive: L.ice[1], ei: 0.6, rough: 1 }), 0, top + R + 2, -0.2);
        const swirl = mesh(new THREE.TorusGeometry(R - 3, 0.25, 6, 40), glow(L.rune, 2), 0, top + R + 2, 0.1);
        void swirl;
        mesh(new THREE.TorusGeometry(R - 5.2, 0.2, 6, 40), glow(L.ice[1], 2), 0, top + R + 2, 0.15);
        // feet of the arch
        for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(4.5, 3, 4), st, sx * R, top + 1.5, 0);
        orb(0, top + R + 2, 1.5, 2.8);
        for (let i = 0; i < 6; i++) {
          const a = Math.PI * (0.15 + 0.7 * (i / 5));
          crystal(4 + r() * 4, 0.9, i % 2 ? ice : iceDeep, Math.cos(a) * (R + 1.6), top + R + 2 + Math.sin(a) * (R + 1.6), 0, 0, -(a - Math.PI / 2));
        }
        if (s >= 3) for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          crystal(5 + r() * 3, 1, iceDeep, Math.cos(a) * 11.5, top - 0.5, Math.sin(a) * 11.5 * 0.7, Math.sin(a) * 0.4, -Math.cos(a) * 0.4);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + R + 2, 0);
        if (s >= 5) for (let i = 0; i < 6; i++) {
          const sh = mesh(new THREE.OctahedronGeometry(1, 0), glow(L.rune, 1.6), (r() - 0.5) * 18, top + 4 + r() * 18, 3 + r() * 3);
          sh.scale.y = 2;
        }
        if (s >= 6) ring(R + 3, top + R + 2, glow(L.rune, 2.4), 0.3, 0, 0);
        return true;
      }

      // ---- one huge crystal floating over the plinth inside turning rune rings ----
      case "FROSTBORN_ARCANE_CRYSTAL": {
        const crys = new THREE.MeshPhysicalMaterial({ color: L.ice[0], emissive: L.ice[1], emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.8, clearcoat: 1 });
        const big = mesh(new THREE.OctahedronGeometry(5, 0), crys, 0, top + 15, 0);
        big.scale.set(1, 2.1, 1);
        mesh(new THREE.OctahedronGeometry(2.2, 0), glow(L.rune, 2.6), 0, top + 15, 0).scale.set(1, 2, 1);
        anchors.orb = new THREE.Vector3(0, top + 15, 0);
        pointLights.push({ pos: new THREE.Vector3(0, top + 15, 3), color: L.rune, intensity: 260 + s * 60, dist: 40 });
        ring(8, top + 15, glow(L.rune, 2.4), 0.3, Math.PI / 2 - 0.3, 0.3);
        ring(9.5, top + 15, metal(L.trim), 0.35, Math.PI / 2 + 0.45, -0.4);
        // a pedestal of small crystals pointing up at it
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          crystal(4 + r() * 2.5, 1, i % 2 ? ice : iceDeep, Math.cos(a) * 3.5, top - 0.3, Math.sin(a) * 3.5, Math.sin(a) * 0.35, -Math.cos(a) * 0.35);
        }
        if (s >= 3) for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const m = mesh(new THREE.OctahedronGeometry(1.4, 0), crys, Math.cos(a) * 11, top + 9 + (i % 2) * 6, Math.sin(a) * 11);
          m.scale.y = 1.8;
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 15, 0);
        if (s >= 5) ring(11, top + 15, glow(L.ice[1], 2), 0.25, 0.2, 0);
        if (s >= 6) {
          const c2 = mesh(new THREE.OctahedronGeometry(2, 0), crys, 0, top + 29, 0);
          c2.scale.set(1, 1.8, 1);
        }
        return true;
      }

      // ---- a white marble spire with great feathered wings and a halo ----
      case "FROSTBORN_CELESTIAL_ICE": {
        const marble = mat(stone(321, L.obelisk, 8, 3), 1, 2, { rough: 0.35 });
        const gold = metal(L.trim, 0.25, 0.9);
        mesh(new THREE.CylinderGeometry(2.4, 3.6, 20, 16), marble, 0, top + 10, 0);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(0.5, 20, 0.5), marble, Math.cos(a) * 3, top + 10, Math.sin(a) * 3);
        }
        mesh(new THREE.CylinderGeometry(4, 3, 1.6, 16), gold, 0, top + 20.8, 0);
        orb(0, top + 25, 0, 3.4);
        ring(5, top + 30, glow("#fff4c8", 2.4), 0.35, Math.PI / 2 - 0.25);
        const feather = plainMat("#ffffff", { rough: 0.6, emissive: L.rune, ei: 0.12 });
        const n = s >= 4 ? 8 : 6;
        for (const sx of [-1, 1]) for (let k = 0; k < n; k++) {
          const len = 12 - k * 0.9;
          const a = 0.25 + k * 0.17;
          const f = mesh(new THREE.BoxGeometry(1.6, len, 0.3), feather, sx * (2.5 + Math.sin(a) * len / 2), top + 15 + Math.cos(a) * len / 2, -2.4 - k * 0.15);
          f.rotation.z = -sx * a;
        }
        if (s >= 3) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5;
          mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 8), marble, Math.cos(a) * 11.5, top + 2, Math.sin(a) * 11.5);
          mesh(new THREE.SphereGeometry(0.7, 10, 8), glow("#fff4c8", 2), Math.cos(a) * 11.5, top + 4.6, Math.sin(a) * 11.5);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 12, 0);
        if (s >= 6) ring(7, top + 30, gold, 0.3, Math.PI / 2 - 0.25);
        return true;
      }

      // ---- a fortress tower built of ice blocks, battlements and a war banner ----
      case "FROSTBORN_GLACIAL_WARLORD": {
        const block = new THREE.MeshPhysicalMaterial({ color: L.ice2[0], emissive: L.ice2[1], emissiveIntensity: 0.35, roughness: 0.25, transparent: true, opacity: 0.92, clearcoat: 0.6 });
        const H = s >= 5 ? 19 : 16;
        for (let y = 0; y < H; y += 2.6) for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const b = mesh(new THREE.BoxGeometry(9.4, 2.4, 1.6), block, Math.cos(a) * 4, top + 1.3 + y, Math.sin(a) * 4);
          b.rotation.y = -a + Math.PI / 2 + ((y / 2.6) % 2) * 0.02;
        }
        mesh(new THREE.BoxGeometry(8, H, 8), plainMat("#0a2030", { rough: 1 }), 0, top + H / 2, 0);
        // battlements
        for (let i = 0; i < 12; i++) {
          const side = Math.floor(i / 3), k = i % 3;
          const a = (side / 4) * Math.PI * 2;
          const t = -3.4 + k * 3.4;
          mesh(new THREE.BoxGeometry(2, 2.2, 2), block, Math.cos(a) * 4.8 - Math.sin(a) * t, top + H + 1.1, Math.sin(a) * 4.8 + Math.cos(a) * t);
        }
        // a gate of frozen iron
        mesh(new THREE.BoxGeometry(3.4, 5, 0.6), metal(L.iron, 0.5, 0.6), 0, top + 2.5, 4.9);
        orb(0, top + H + 4.5, 0, 3);
        // banner
        mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 6), metal(L.iron), 3.6, top + H + 5, -3.6);
        const ban = mesh(new THREE.PlaneGeometry(4, 5.5), plainMat(L.rune, { rough: 0.9, emissive: L.rune, ei: 0.2 }), 5.6, top + H + 7, -3.6);
        (ban.material as THREE.Material).side = THREE.DoubleSide;
        if (s >= 3) for (const sx of [-1, 1]) crystal(9, 1.4, ice, sx * 7.5, top - 0.5, 3, 0.2, -sx * 0.35);
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + H * 0.6, 0);
        if (s >= 6) for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          crystal(6, 0.8, ice, Math.cos(a) * 6.6, top + H + 1, Math.sin(a) * 6.6, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
        }
        return true;
      }

      // ---- a golden astrolabe: nested rings turning round a captured ice sun ----
      case "FROSTBORN_PRESTIGE_ASCENDANT": {
        const gold = metal(L.trim, 0.2, 0.95);
        mesh(new THREE.CylinderGeometry(1.4, 3.2, 8, 12), gold, 0, top + 4, 0);
        mesh(new THREE.TorusGeometry(3.2, 0.5, 8, 24), gold, 0, top + 0.4, 0).rotation.x = Math.PI / 2;
        const Y = top + 16;
        orb(0, Y, 0, 3.6);
        ring(7, Y, gold, 0.45, Math.PI / 2, 0);
        ring(7.6, Y, gold, 0.4, 0, 0.6);
        ring(8.2, Y, gold, 0.35, 0.9, -0.5);
        // meridian arc down to the stand
        mesh(new THREE.TorusGeometry(8.8, 0.5, 8, 48, Math.PI), gold, 0, Y, 0).rotation.set(0, Math.PI / 2, Math.PI);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), glow("#fff0b0", 2), Math.cos(a) * 7, Y, Math.sin(a) * 7);
        }
        if (s >= 3) for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          mesh(new THREE.SphereGeometry(1, 14, 10), glow("#fff0b0", 1.6), Math.cos(a) * 11, Y + (i - 1) * 3, Math.sin(a) * 11);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, Y, 0);
        if (s >= 5) ring(10, Y, glow(L.rune, 2.4), 0.25, 0.4, 0.8);
        if (s >= 6) for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(new THREE.ConeGeometry(0.4, 3, 6), gold, Math.cos(a) * 9, Y + 9, Math.sin(a) * 9).rotation.set(Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5);
        }
        return true;
      }

      // ---- a sandstone pyramid whose capstone is the ice orb ----
      case "FROSTBORN_SANDSTONE": {
        const sand = mat(stone(331, L.obelisk, 8, 8, true), 2, 2, { emissiveColor: L.rune, emissiveIntensity: 2 });
        const pyr = mesh(new THREE.ConeGeometry(12, 17, 4, 6), sand, 0, top + 8.5, 0);
        pyr.rotation.y = Math.PI / 4;
        // a doorway with blue light
        mesh(new THREE.BoxGeometry(3, 4.2, 1), glow(L.rune, 1.6), 0, top + 2.1, 6.8);
        mesh(new THREE.BoxGeometry(4.4, 0.8, 1.6), sand, 0, top + 4.6, 7);
        orb(0, top + 19.5, 0, 3);
        mesh(new THREE.OctahedronGeometry(3.4, 0), new THREE.MeshPhysicalMaterial({ color: L.ice[0], transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }), 0, top + 19.5, 0).scale.y = 1.4;
        if (s >= 3) for (const sx of [-1, 1]) {
          // sphinx-like guardian blocks
          mesh(new THREE.BoxGeometry(2.6, 3, 5), sand, sx * 10, top + 1.5, 6);
          mesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), sand, sx * 10, top + 4, 8);
          mesh(new THREE.SphereGeometry(0.4, 8, 6), glow(L.rune, 3), sx * 10, top + 4.4, 9.25);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 10, 0);
        if (s >= 5) for (const [x, z] of [[-9, -9], [9, -9]] as const) {
          mesh(new THREE.CylinderGeometry(0.7, 1.4, 12, 4), sand, x, top + 6, z).rotation.y = Math.PI / 4;
          mesh(new THREE.ConeGeometry(1, 1.8, 4), ice, x, top + 12.9, z).rotation.y = Math.PI / 4;
        }
        if (s >= 6) ring(5, top + 19.5, glow(L.rune, 2.4), 0.3, Math.PI / 2 - 0.3);
        return true;
      }

      // ---- a moon shrine: a standing crescent moon cradling the orb ----
      case "FROSTBORN_MOONSTONE": {
        const moonM = plainMat(L.cap[0], { rough: 0.35, metal: 0.1, emissive: L.rune, ei: 0.25 });
        const st = mat(stone(341, L.plinth, 3, 4), 1, 1);
        mesh(new THREE.CylinderGeometry(3, 4, 4, 8), st, 0, top + 2, 0);
        const cres = mesh(new THREE.TorusGeometry(8, 2, 16, 48, Math.PI * 1.3), moonM, 0, top + 13, 0);
        cres.rotation.z = -Math.PI * 0.15 - Math.PI / 2;
        orb(0, top + 13, 0, 3.6);
        for (let i = 0; i < 7; i++) {
          const st2 = mesh(new THREE.OctahedronGeometry(0.6, 0), glow("#eef2ff", 2.4), (r() - 0.5) * 22, top + 6 + r() * 18, -3 + r() * 2);
          st2.scale.y = 1.6;
        }
        if (s >= 3) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(1.4, 3.6, 1), st, Math.cos(a) * 11.5, top + 1.8, Math.sin(a) * 11.5).rotation.y = -a;
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 13, 0);
        if (s >= 5) {
          const c2 = mesh(new THREE.TorusGeometry(4.5, 0.9, 12, 40, Math.PI * 1.3), moonM, -11, top + 15, -4);
          c2.rotation.z = Math.PI * 0.85 - Math.PI / 2;
        }
        if (s >= 6) ring(11, top + 13, glow(L.rune, 2), 0.2, 0, 0);
        return true;
      }

      // ---- a carved totem pole with ribbons of aurora winding round it ----
      case "FROSTBORN_AURORA": {
        const wood = plainMat(L.obelisk[0], { rough: 0.85 });
        const dark = plainMat(L.obelisk[2], { rough: 0.9 });
        const H = 22;
        mesh(new THREE.CylinderGeometry(2.8, 3.2, H, 12), wood, 0, top + H / 2, 0);
        // carved faces stacked up the pole
        for (const y of [5, 11.5, 18]) {
          mesh(new THREE.BoxGeometry(5.4, 1, 1.4), dark, 0, top + y + 1.6, 2.6);
          for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.7, 10, 8), glow(L.rune, 2.6), sx * 1.2, top + y + 0.6, 2.9);
          mesh(new THREE.BoxGeometry(2, 0.6, 1), dark, 0, top + y - 1.2, 2.9);
        }
        // spread wings at the top
        for (const sx of [-1, 1]) {
          const w = mesh(new THREE.BoxGeometry(9, 2.4, 0.8), wood, sx * 6.5, top + H - 1, 0);
          w.rotation.z = sx * 0.25;
        }
        orb(0, top + H + 3.5, 0, 3);
        // aurora ribbons
        const auroraM = (col: string) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
        const ribbons = s >= 3 ? 3 : 2;
        for (let k = 0; k < ribbons; k++) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 40; i++) {
            const t = i / 40, a = t * Math.PI * 4 + k * 2.1;
            pts.push(new THREE.Vector3(Math.cos(a) * (5 + k), top + 2 + t * (H + 2), Math.sin(a) * (5 + k)));
          }
          tube(pts, 0.35, auroraM(k % 2 ? L.ice2[1] : L.ice[1]), 120);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 12, 0);
        if (s >= 5) for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(1.4, 1.6, 10, 10), wood, sx * 10, top + 5, -3);
          mesh(new THREE.SphereGeometry(1.2, 12, 10), orbM(), sx * 10, top + 11, -3);
        }
        if (s >= 6) ring(7, top + H + 3.5, auroraM(L.ice[1]), 0.5, Math.PI / 2 - 0.2);
        return true;
      }

      // ---- a black obsidian mirror on a stand, the orb hanging before its glass ----
      case "FROSTBORN_OBSIDIAN": {
        const obs = new THREE.MeshPhysicalMaterial({ color: "#0a0a10", roughness: 0.04, metalness: 0.4, clearcoat: 1, envMapIntensity: 1.6 });
        const frame = metal(L.trim, 0.3, 0.8);
        const Y = top + 13;
        const mirror = mesh(new THREE.CylinderGeometry(8, 8, 0.8, 40), obs, 0, Y, -2);
        mirror.rotation.x = Math.PI / 2;
        mesh(new THREE.TorusGeometry(8.2, 0.7, 10, 48), frame, 0, Y, -2);
        mesh(new THREE.TorusGeometry(6.6, 0.15, 6, 48), glow(L.rune, 2.6), 0, Y, -1.5);
        for (const sx of [-1, 1]) {
          tube([new THREE.Vector3(sx * 6, top, -2), new THREE.Vector3(sx * 8.6, top + 6, -2), new THREE.Vector3(sx * 8.4, Y, -2)], 0.6, frame, 12);
        }
        orb(0, Y, 2.6, 3);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(new THREE.ConeGeometry(0.6, 3.4, 4), obs, Math.cos(a) * 9.8, Y + Math.sin(a) * 9.8, -2).rotation.z = a - Math.PI / 2;
        }
        if (s >= 3) for (let i = 0; i < 4; i++) crystal(6 + r() * 4, 1.2, obs, -9 + i * 6, top - 0.5, 5 + (i % 2) * 2, 0.25, (r() - 0.5) * 0.5);
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, Y, 2.6);
        if (s >= 5) ring(10.6, Y, glow(L.rune, 2), 0.25, 0, 0).position.z = -2;
        if (s >= 6) for (const sx of [-1, 1]) {
          const m2 = mesh(new THREE.CylinderGeometry(3, 3, 0.5, 24), obs, sx * 11, Y + 5, -3);
          m2.rotation.set(Math.PI / 2, 0, 0);
          mesh(new THREE.TorusGeometry(3.1, 0.35, 8, 24), frame, sx * 11, Y + 5, -3);
        }
        return true;
      }

      // ---- a miniature colosseum: a ring of arches with the orb on a column inside ----
      case "FROSTBORN_GLADIATOR": {
        const st = mat(stone(351, L.obelisk, 3, 3), 1, 1);
        const R = 9.5;
        const n = 10;
        const tiers = s >= 4 ? 2 : 1;
        for (let t = 0; t < tiers; t++) for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          if (Math.sin(a) > 0.75) continue;
          const y = top + t * 7;
          mesh(new THREE.BoxGeometry(1.6, 6, 1.6), st, Math.cos(a) * R, y + 3, Math.sin(a) * R);
          const lintel = mesh(new THREE.BoxGeometry(2 * R * Math.sin(Math.PI / n) + 1.6, 1, 1.8), st, Math.cos(a + Math.PI / n) * R * Math.cos(Math.PI / n), y + 6.5, Math.sin(a + Math.PI / n) * R * Math.cos(Math.PI / n));
          lintel.rotation.y = -(a + Math.PI / n) + Math.PI / 2;
        }
        mesh(new THREE.CylinderGeometry(1.4, 1.8, 14, 12), st, 0, top + 7, 0);
        mesh(new THREE.CylinderGeometry(2.6, 1.6, 1.4, 12), metal(L.trim, 0.3, 0.8), 0, top + 14.5, 0);
        orb(0, top + 18, 0, 3);
        // red cloth banners
        for (const sx of [-1, 1]) {
          const b = mesh(new THREE.PlaneGeometry(2.2, 4.5), plainMat(L.flag[0], { rough: 0.9 }), sx * 4, top + 4, R * 0.95);
          (b.material as THREE.Material).side = THREE.DoubleSide;
        }
        if (s >= 3) for (let i = 0; i < 2; i++) {
          const sw = mesh(new THREE.BoxGeometry(0.5, 6, 0.15), metal("#c8ccd0", 0.2, 0.9), (i - 0.5) * 3, top + 3, 2);
          sw.rotation.z = (i - 0.5) * 0.9;
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 10, 0);
        if (s >= 6) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          crystal(4, 0.6, ice, Math.cos(a) * 2.6, top + 15, Math.sin(a) * 2.6, Math.sin(a) * 0.6, -Math.cos(a) * 0.6);
        }
        return true;
      }

      // ---- a great snowflake medal standing on a winner's podium ----
      case "FROSTBORN_CHAMPION": {
        const marble = mat(stone(361, L.plinth, 3, 4), 1, 1, { rough: 0.4 });
        const gold = metal(L.trim, 0.2, 0.95);
        mesh(new THREE.BoxGeometry(6, 5, 6), marble, 0, top + 2.5, 0);
        for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(5, 3, 5.4), marble, sx * 5.6, top + 1.5, 0.3);
        mesh(new THREE.BoxGeometry(6.4, 0.4, 6.4), gold, 0, top + 5, 0);
        const Y = top + 16;
        // the snowflake: six arms with side-branches
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
          const arm = mesh(new THREE.BoxGeometry(1.1, 9, 0.8), gold, Math.cos(a) * 4.5, Y + Math.sin(a) * 4.5, 0);
          arm.rotation.z = a - Math.PI / 2;
          for (const k of [0.45, 0.75]) for (const sd of [-1, 1]) {
            const b = mesh(new THREE.BoxGeometry(0.6, 2.8 - k * 1.4, 0.6), gold, Math.cos(a) * 9 * k + Math.cos(a + sd * Math.PI / 2) * 1, Y + Math.sin(a) * 9 * k + Math.sin(a + sd * Math.PI / 2) * 1, 0);
            b.rotation.z = a - Math.PI / 2 + sd * 0.8;
          }
          mesh(new THREE.OctahedronGeometry(0.8, 0), ice, Math.cos(a) * 9.4, Y + Math.sin(a) * 9.4, 0);
        }
        orb(0, Y, 0.5, 2.8);
        mesh(new THREE.TorusGeometry(3.4, 0.45, 8, 36), gold, 0, Y, 0.3);
        mesh(new THREE.BoxGeometry(1.4, 6, 0.8), plainMat(L.flag[0], { rough: 0.9 }), 0, top + 8.5, -0.5);
        if (s >= 3) for (const sx of [-1, 1]) mesh(new THREE.OctahedronGeometry(1.2, 0), glow("#fff0b0", 2), sx * 5.6, top + 4.6, 0.3).scale.y = 1.6;
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, Y, 0);
        if (s >= 5) ring(11, Y, glow(L.rune, 2), 0.25, 0, 0);
        if (s >= 6) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const m = mesh(new THREE.OctahedronGeometry(0.6, 0), glow("#fff0b0", 2.2), Math.cos(a) * 13, Y + Math.sin(a) * 13, 0);
          m.scale.y = 1.8;
        }
        return true;
      }

      // ---- a giant crystal sword driven into a block of ice, the orb as its pommel ----
      case "FROSTBORN_LEGEND": {
        const blockM = new THREE.MeshPhysicalMaterial({ color: L.ice[0], emissive: L.ice[1], emissiveIntensity: 0.3, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 });
        const blk = mesh(new THREE.DodecahedronGeometry(6, 0), blockM, 0, top + 3, 0);
        blk.scale.set(1.3, 0.75, 1.1);
        const blade = new THREE.MeshPhysicalMaterial({ color: L.ice2[0], emissive: L.ice2[1], emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.88, clearcoat: 1 });
        const b = mesh(new THREE.BoxGeometry(3, 18, 0.9), blade, 0, top + 13, 0);
        void b;
        mesh(new THREE.BoxGeometry(0.4, 17, 1.1), glow(L.rune, 2.4), 0, top + 13, 0);
        const gold = metal(L.trim, 0.25, 0.9);
        mesh(new THREE.BoxGeometry(10, 1.4, 1.8), gold, 0, top + 22.6, 0);
        for (const sx of [-1, 1]) mesh(new THREE.OctahedronGeometry(1, 0), glow(L.rune, 2.4), sx * 5.4, top + 22.6, 0);
        mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.6, 10), plainMat(L.flag[0], { rough: 0.8 }), 0, top + 25.6, 0);
        orb(0, top + 29.4, 0, 2.4);
        if (s >= 3) for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          crystal(4 + r() * 3, 0.9, iceDeep, Math.cos(a) * 7.5, top - 0.5, Math.sin(a) * 7.5, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
        }
        if (s >= 4) anchors.runeOrbit = new THREE.Vector3(0, top + 13, 0);
        if (s >= 5) for (const sx of [-1, 1]) {
          const sw = mesh(new THREE.BoxGeometry(1.6, 10, 0.5), blade, sx * 8.5, top + 6, -3);
          sw.rotation.z = sx * 0.35;
        }
        if (s >= 6) ring(4.5, top + 29.4, glow(L.rune, 2.4), 0.3, Math.PI / 2 - 0.3);
        return true;
      }
    }
    return false;
  }

  function buildFrostborn() {
    const s = STAGE;
    const L = FROST_LOOKS[LOOK] ?? FROST_LOOKS[SKIN] ?? FROST_LOOKS.base!;
    const plinthStone = stoneTex(11, L.plinth[0], L.plinth[1], L.plinth[2], 4, 6, { frost: 0.6 * L.frost });
    const obeliskStone = stoneTex(23, L.obelisk[0], L.obelisk[1], L.obelisk[2], 9, 3, { frost: 0.35 * L.frost, runes: L.rune, runeRows: s >= 3 ? [2, 6] : [] });
    const capStone = stoneTex(31, L.cap[0], L.cap[1], L.cap[2], 2, 4, { frost: L.frost });
    const flag = flagTex(37, L.flag[0], L.flag[1], L.flag[2], 0.8 * L.frost);
    const topMat = mat(flag, 1, 1, { bump: 1.2 });
    const tiered = (side: TexSet, rx: number, ry: number) => [mat(side, rx, ry), topMat, topMat];
    const silver = metalTex(41, L.trim, { rivets: true });
    const iron = metalTex(43, L.iron);
    const ice = new THREE.MeshStandardMaterial({ color: L.ice[0], emissive: L.ice[1], emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
    const iceDeep = new THREE.MeshStandardMaterial({ color: L.ice2[0], emissive: L.ice2[1], emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1 });

    // Plinth (tiers grow outward/upward, never the tower's overall height budget).
    let top = 0;
    if (s >= 5) {
      hexPrism(16, 2.2, tiered(plinthStone, 3, 0.6), 0);
      top = 2.2;
    }
    hexPrism(s >= 5 ? 13.6 : 15, 3.2, tiered(plinthStone, 3, 0.8), top);
    top += 3.2;
    // bevelled cap slab
    hexPrism(s >= 5 ? 12.6 : 14, 1.1, tiered(capStone, 3, 0.3), top);
    top += 1.1;
    if (frostSkinBody(L, s, top, ice, iceDeep)) return;
    if (s >= 4) {
      // silver corner caps on the plinth
      const R = s >= 5 ? 13.6 : 15;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(new THREE.BoxGeometry(2.4, 4.6, 2.4), mat(silver, 0.5, 0.5, { rough: 0.4, metal: 0.35 }), Math.cos(a) * R * 0.97, top - 2.6, Math.sin(a) * R * 0.97);
      }
    }

    // Obelisk: square, tapering, slightly rotated to read as stone not a pole.
    const H = 26;
    const obGeo = new THREE.CylinderGeometry(2.6 * Math.SQRT2, 4.2 * Math.SQRT2, H, 4, 6);
    const ob = mesh(obGeo, mat(obeliskStone, 1.2, 2.2, { emissiveColor: L.rune, emissiveIntensity: 2.6 }), 0, top + H / 2, 0);
    ob.rotation.y = Math.PI / 4;
    // Footing collar
    const collar = mesh(new THREE.CylinderGeometry(5.6 * Math.SQRT2 * 0.72, 6.2 * Math.SQRT2 * 0.72, 2, 4), mat(capStone, 1, 0.3), 0, top + 1, 0);
    collar.rotation.y = Math.PI / 4;
    if (s >= 2) {
      // iron bands
      for (const by of s >= 4 ? [0.3, 0.62] : [0.45]) {
        const w = 4.2 - (4.2 - 2.6) * by;
        const band = mesh(new THREE.CylinderGeometry(w * Math.SQRT2 * 1.08, w * Math.SQRT2 * 1.1, 1.1, 4), mat(s >= 4 ? silver : iron, 1, 0.2, { rough: 0.45, metal: 0.35 }), 0, top + H * by, 0);
        band.rotation.y = Math.PI / 4;
      }
    }
    const obTop = top + H;

    // Orb cradle: three curved iron/silver claws rising from the obelisk tip.
    const clawMat = mat(s >= 4 ? silver : iron, 0.5, 0.5, { rough: s >= 4 ? 0.35 : 0.55, metal: 0.35 });
    const clawCount = s >= 6 ? 6 : s >= 3 ? 4 : 3;
    for (let i = 0; i < clawCount; i++) {
      const a = (i / clawCount) * Math.PI * 2 + 0.3;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 2.4, obTop - 0.5, Math.sin(a) * 2.4),
        new THREE.Vector3(Math.cos(a) * 5.2, obTop + 3, Math.sin(a) * 5.2),
        new THREE.Vector3(Math.cos(a) * 5.0, obTop + 7, Math.sin(a) * 5.0),
        new THREE.Vector3(Math.cos(a) * 3.2, obTop + 9.5, Math.sin(a) * 3.2),
      ]);
      mesh(new THREE.TubeGeometry(curve, 16, 0.55, 6, false), clawMat);
    }
    anchors.orb = new THREE.Vector3(0, obTop + 5.6, 0);
    // Ice orb (static base sphere; the live glow/pulse is drawn on top in the game).
    mesh(new THREE.SphereGeometry(3.9, 32, 24), new THREE.MeshStandardMaterial({ color: L.orb[0], emissive: L.orb[1], emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.0 }), 0, obTop + 5.6, 0);
    pointLights.push({ pos: new THREE.Vector3(0, obTop + 5.6, 2), color: L.rune, intensity: 220 + s * 60, dist: 40 });

    // Ice crystals growing out of the plinth.
    const r = rng(77);
    if (s >= 2) {
      const n = s >= 5 ? 8 : s >= 3 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.6;
        const R = (s >= 5 ? 12 : 12.5) + r() * 1.5;
        crystal(5 + r() * 5 + (s >= 5 ? 3 : 0), 1 + r() * 0.6, i % 2 ? ice : iceDeep, Math.cos(a) * R, top - 0.5, Math.sin(a) * R, Math.sin(a) * 0.35, -Math.cos(a) * 0.35);
      }
    }
    // Stage 4+: a floating rune ring hovering around the obelisk.
    if (s >= 4) {
      // Runestones hovering beside the obelisk (they orbit live in the game).
      anchors.runeOrbit = new THREE.Vector3(0, top + H * 0.55, 0);
    }
    // Stage 5+: crown shards flanking the orb.
    if (s >= 5) {
      const n = s >= 6 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.9;
        crystal(s >= 6 ? 9 : 7, 0.9, ice, Math.cos(a) * 4.2, obTop + 1.5, Math.sin(a) * 4.2, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
      }
    }
    // Stage 6: snow/frost settling on the base step and a cold glow at the foot.
    if (s >= 6) {
      const snow = new THREE.MeshStandardMaterial({ color: L.snow, roughness: 0.85 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + r();
        const m = mesh(new THREE.SphereGeometry(1.4 + r(), 10, 8), snow, Math.cos(a) * 14.6, 2.2, Math.sin(a) * 14.6);
        m.scale.y = 0.4;
      }
      pointLights.push({ pos: new THREE.Vector3(0, 6, 9), color: L.rune, intensity: 160, dist: 30 });
    }
    // --- evolution: every stage visibly transforms the obelisk ---
    if (s >= 2) {
      // frost creeping up the foot of the obelisk
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.2;
        crystal(5 + r() * 3.5, 0.9 + r() * 0.4, i % 2 ? ice : iceDeep, Math.cos(a) * 4.6, top - 0.3, Math.sin(a) * 4.6, Math.sin(a) * 0.3, -Math.cos(a) * 0.3);
      }
    }
    if (s >= 3) {
      // ice spikes bursting out of the obelisk's corners
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const y = top + H * (i % 2 ? 0.42 : 0.62);
        const w = 4.2 - 1.6 * (y - top) / H;
        crystal(s >= 5 ? 8 : 6, 0.8, ice, Math.cos(a) * w, y, Math.sin(a) * w, Math.sin(a) * 1.05, -Math.cos(a) * 1.05);
      }
    }
    if (s >= 4) {
      // a ring of ice circling the orb
      const halo = mesh(new THREE.TorusGeometry(6.4, 0.5, 8, 40), ice, 0, obTop + 5.6, 0);
      halo.rotation.set(Math.PI / 2 - 0.35, 0, 0.2);
    }
    if (s >= 5) {
      // twin spires rise from the plinth, each with its own small orb
      for (const sx of [-1, 1]) {
        const x = sx * 9.2, z = -3.5;
        const sp = mesh(new THREE.CylinderGeometry(1.2 * Math.SQRT2, 2 * Math.SQRT2, 13, 4), mat(obeliskStone, 0.6, 1.2, { emissiveColor: L.rune, emissiveIntensity: 2.6 }), x, top + 6.5, z);
        sp.rotation.y = Math.PI / 4;
        mesh(new THREE.CylinderGeometry(0.6, 1.5, 1.6, 4), mat(capStone, 0.4, 0.3), x, top + 13.6, z).rotation.y = Math.PI / 4;
        mesh(new THREE.SphereGeometry(1.7, 18, 14), new THREE.MeshStandardMaterial({ color: L.orb[0], emissive: L.orb[1], emissiveIntensity: 0.9, roughness: 0.12 }), x, top + 16, z);
      }
      pointLights.push({ pos: new THREE.Vector3(0, top + 16, 0), color: L.rune, intensity: 120, dist: 30 });
    }
    if (s >= 6) {
      // great wings of ice fanning out behind the orb
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const g = crystal(14 - k * 1.8, 1.1 - k * 0.1, k % 2 ? iceDeep : ice, sx * 2.5, obTop - 2 + k * 0.4, -2.5, -0.15, -sx * (0.55 + k * 0.22));
          void g;
        }
      }
    }
    frostSignature(L, { top, obTop, H, s, ice, iceDeep, iron, silver });
  }

  /** Bark: deep vertical furrows, knots, optional glowing sap veins (emissive). */
  /** Cached across every model built on the page (the canvases are only read: each material clones them). */
  function barkTex(seed: number, a: string, b: string, veins?: string): TexSet {
    return cachedTex("barkTex", [seed, a, b, veins], () => barkTexRaw(seed, a, b, veins));
  }
  function barkTexRaw(seed: number, a: string, b: string, veins?: string): TexSet {
    const S = 512;
    const { c, g, b: bc, h } = canvasPair(S);
    const r = rng(seed);
    const A = hexRgb(a), B = hexRgb(b);
    g.fillStyle = b; g.fillRect(0, 0, S, S);
    h.fillStyle = "#404040"; h.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      let x = r() * S;
      const w = 4 + r() * 12;
      g.strokeStyle = mixc(A, B, r() * 0.7);
      h.strokeStyle = `rgb(${140 + r() * 100},${140 + r() * 100},${140 + r() * 100})`;
      g.lineWidth = w; h.lineWidth = w;
      g.beginPath(); h.beginPath();
      g.moveTo(x, 0); h.moveTo(x, 0);
      for (let y = 0; y <= S; y += 32) {
        x += (r() - 0.5) * 10;
        g.lineTo(x, y); h.lineTo(x, y);
      }
      g.stroke(); h.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const x = r() * S, y = r() * S;
      g.fillStyle = "rgba(20,12,6,0.8)"; g.beginPath(); g.ellipse(x, y, 7, 11, 0, 0, Math.PI * 2); g.fill();
      h.fillStyle = "#101010"; h.beginPath(); h.ellipse(x, y, 7, 11, 0, 0, Math.PI * 2); h.fill();
    }
    let e: HTMLCanvasElement | undefined;
    if (veins) {
      e = document.createElement("canvas"); e.width = e.height = S;
      const eg = e.getContext("2d")!;
      eg.fillStyle = "#000"; eg.fillRect(0, 0, S, S);
      for (let k = 0; k < 7; k++) {
        let x = r() * S, y = S;
        eg.strokeStyle = veins; eg.lineWidth = 3;
        g.strokeStyle = "rgba(10,20,6,0.9)"; g.lineWidth = 4;
        eg.beginPath(); g.beginPath();
        eg.moveTo(x, y); g.moveTo(x, y);
        while (y > 0) {
          x += (r() - 0.5) * 30; y -= 20 + r() * 30;
          eg.lineTo(x, y); g.lineTo(x, y);
        }
        g.stroke(); eg.stroke();
      }
    }
    return finish(c, bc, e);
  }

  function plainMat(color: string, o: { rough?: number; metal?: number; emissive?: string; ei?: number } = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0.2, emissive: o.emissive ?? "#000000", emissiveIntensity: o.ei ?? 1 });
  }

  /** Irregular rounded mound (displaced, flattened sphere). */
  function mound(radius: number, height: number, m: THREE.Material, seed: number) {
    const geo = new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const r = rng(seed);
    const ph = [r() * 6, r() * 6, r() * 6];
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.06 * Math.sin(a * 3 + ph[0]!) + 0.04 * Math.sin(a * 5 + ph[1]!) + 0.025 * Math.sin(a * 11 + ph[2]!);
      pos.setXYZ(i, x * k, (y / radius) * height * (0.9 + 0.2 * Math.sin(a * 5 + ph[0]!)), z * k);
    }
    geo.computeVertexNormals();
    return mesh(geo, m);
  }

  /** A tapering, slightly twisting trunk built as a lathe. */
  function trunk(r0: number, r1: number, h: number, m: THREE.Material, seed: number, y0: number) {
    const r = rng(seed);
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + Math.sin(t * 5 + r() * 2) * 0.35 + (t < 0.1 ? (0.1 - t) * 12 : 0), t * h));
    }
    const geo = new THREE.LatheGeometry(pts, 14);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const tw = (y / h) * 0.5;
      pos.setXYZ(i, x * Math.cos(tw) - z * Math.sin(tw), y, x * Math.sin(tw) + z * Math.cos(tw));
    }
    geo.computeVertexNormals();
    return mesh(geo, m, 0, y0, 0);
  }

  function tube(points: THREE.Vector3[], radius: number, m: THREE.Material, segs = 20) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, radius, 8, false), m);
  }

  // ---------------------------------------------------------------------------
  // IRONWOOD — gnarled root mound, iron-banded twisting trunk with glowing sap
  // veins, a ballista mounted on top with a hooded operator behind it. The
  // bowstring/bolt are drawn live (they draw tighter as the next shot nears).
  // Stages: 2 iron spikes, 3 chain wrap, 4 bronze-shod ballista, 5 reinforced
  // twin-plated arms + banner, 6 ancient crown of leaves and glowing runes.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // IRONWOOD SKIN BODIES — every skin raises the ballista on its own structure
  // and dresses the crew its own way, not a recolour: a hunter's treehouse, a
  // clockwork engine, an autumn maple, a ring of birches, a thorned bloodwood,
  // a floating sky island, a siege tower, a snowy pine, a war wagon, an iron
  // bunker, a dragon's spine, a golden tree of life, an abyssal watchtower.
  // Returns where the ballista deck sits and how the weapon and crew look.
  // ---------------------------------------------------------------------------
  interface Ballista { deckY: number; wood: THREE.Material; fit: THREE.Material; arm: THREE.Material; crew: "hood" | "helm" | "bot" | "skull" | "none"; crewM: THREE.Material; eye: string }
  function ironSkinBody(L: IronLook, s: number): Ballista | null {
    // only the looks that still read as this tower's element get their own structure; the rest keep the standard tower
    if (!IRON_OWN.has(SKIN)) return null;
    const glow = (col: string, ei = 2.2) => plainMat(col, { emissive: col, ei, rough: 0.4 });
    const metal = (col: string, rough = 0.35, met = 0.75) => plainMat(col, { rough, metal: met });
    const r = rng(SKIN.length * 29 + 5);
    const barkM = (seed: number, a: string, b: string, veins?: string) => mat(barkTex(seed, a, b, veins), 1.5, 1.5, { bump: 2.4, rough: 0.9, emissiveColor: veins, emissiveIntensity: 0.9 });
    const leafBlob = (x: number, y: number, z: number, rad: number, col: string) => {
      const m = mesh(new THREE.IcosahedronGeometry(rad, 1), plainMat(col, { rough: 0.9, metal: 0, emissive: col, ei: 0.12 }), x, y, z);
      m.scale.y = 0.75;
      return m;
    };
    const earth = (rad = 13) => {
      const m = mesh(new THREE.CylinderGeometry(rad, rad + 1.5, 2, 24), plainMat(L.mound[1], { rough: 1 }), 0, 1, 0);
      void m;
    };
    const woodM = plainMat(L.wood[0], { rough: 0.85 });
    const fitM = metal(s >= 4 ? L.bronze : L.iron);
    const ballista = (deckY: number, crew: Ballista["crew"], crewM: THREE.Material = plainMat(s >= 4 ? L.cloak[1] : L.cloak[0], { rough: 0.95 }), arm: THREE.Material = plainMat(L.wood[1], { rough: 0.8 }), eye = L.vein): Ballista => ({ deckY, wood: woodM, fit: fitM, arm, crew, crewM, eye });

    switch (SKIN) {
      // ---- a hunter's treehouse: a huge oak with a hut wrapped round its crown ----
      case "IRONWOOD_ANCIENT_HUNTER": {
        earth();
        const bark = barkM(501, L.bark[0], L.bark[1], L.vein);
        trunk(6.2, 4.4, 20, bark, 503, 2);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          tube([new THREE.Vector3(Math.cos(a) * 4, 4, Math.sin(a) * 4), new THREE.Vector3(Math.cos(a) * 9, 1.8, Math.sin(a) * 9), new THREE.Vector3(Math.cos(a + 0.3) * 13, 0.6, Math.sin(a + 0.3) * 13)], 1.2, bark, 12);
        }
        // the hut: plank walls and a thatched ring roof under the deck
        mesh(new THREE.CylinderGeometry(7.5, 7.5, 4.5, 12, 1, true), woodM, 0, 17, 0).material.side = THREE.DoubleSide;
        mesh(new THREE.ConeGeometry(9.5, 3, 12, 1, true), plainMat("#6a5226", { rough: 1 }), 0, 20.4, 0).material.side = THREE.DoubleSide;
        mesh(new THREE.BoxGeometry(2, 3, 0.4), glow("#ffc86a", 1.4), 0, 16.6, 7.5);
        // antlers mounted over the door
        for (const sx of [-1, 1]) tube([new THREE.Vector3(sx * 0.8, 19, 7.8), new THREE.Vector3(sx * 3, 21, 8.4), new THREE.Vector3(sx * 4.2, 23.5, 8), new THREE.Vector3(sx * 3.4, 25, 7.6)], 0.25, plainMat("#e8dcc0"), 10);
        anchors.core = new THREE.Vector3(0, 10, 5.5);
        if (s >= 3) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.4;
          leafBlob(Math.cos(a) * 8.5, 22 + r() * 2, Math.sin(a) * 8.5, 2.6, L.leaf);
        }
        if (s >= 5) {
          // a rope ladder and hanging lanterns
          for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 13, 4), plainMat("#8a6a42"), sx * 1, 8.5, 6.8);
          for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(2.2, 0.25, 0.3), woodM, 0, 3 + k * 2, 6.8);
          for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.7, 10, 8), glow("#ffc86a", 2.4), sx * 8, 16, 3);
        }
        return ballista(21.8, "hood");
      }

      // ---- a clockwork engine tower: brass drum, turning gears, a glowing core ----
      case "IRONWOOD_ARCANE_ENGINE": {
        const brass = metal(L.bronze, 0.3, 0.85);
        const iron = metal(L.iron, 0.4, 0.75);
        mesh(new THREE.CylinderGeometry(9, 10, 3, 16), iron, 0, 1.5, 0);
        mesh(new THREE.CylinderGeometry(4.8, 6, 17, 16), iron, 0, 11.5, 0);
        for (const y of [5, 11, 17]) mesh(new THREE.TorusGeometry(5.2 - (y - 5) * 0.05, 0.4, 8, 32), brass, 0, y, 0).rotation.x = Math.PI / 2;
        // the core window
        mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.6, 20), brass, 0, 11, 5.4).rotation.x = Math.PI / 2;
        mesh(new THREE.CircleGeometry(1.8, 20), glow(L.vein, 3), 0, 11, 5.75);
        anchors.core = new THREE.Vector3(0, 11, 6);
        // gears on both flanks
        const gear = (x: number, y: number, z: number, rad: number, ry: number) => {
          const g = new THREE.Group();
          g.position.set(x, y, z);
          g.rotation.y = ry;
          root.add(g);
          mesh(new THREE.TorusGeometry(rad, rad * 0.16, 6, 24), brass, 0, 0, 0, g);
          const teeth = Math.round(rad * 4);
          for (let i = 0; i < teeth; i++) {
            const a = (i / teeth) * Math.PI * 2;
            mesh(new THREE.BoxGeometry(rad * 0.25, rad * 0.25, rad * 0.25), brass, Math.cos(a) * rad * 1.15, Math.sin(a) * rad * 1.15, 0, g).rotation.z = a;
          }
          mesh(new THREE.CylinderGeometry(rad * 0.25, rad * 0.25, 0.8, 10), iron, 0, 0, 0, g).rotation.x = Math.PI / 2;
        };
        gear(6.2, 9, 0, 3, Math.PI / 2);
        gear(-6.2, 13, 0, 2.2, Math.PI / 2);
        if (s >= 3) gear(5.8, 15.5, 2, 1.6, Math.PI / 2 - 0.3);
        if (s >= 4) for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(0.9, 0.9, 8, 10), iron, sx * 7.5, 6, -3);
          mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 8), metal("#d0d4d8", 0.2, 0.9), sx * 7.5, 12.5, -3);
        }
        if (s >= 5) {
          tube([new THREE.Vector3(-4, 18, -4), new THREE.Vector3(-4, 22, -6), new THREE.Vector3(-3, 25, -6)], 0.7, brass, 10);
          anchors.banner = new THREE.Vector3(-3, 25.5, -6);
        }
        return ballista(20, "bot", metal(L.iron, 0.3, 0.8), metal(L.bronze, 0.3, 0.85));
      }

      // ---- an autumn maple: a fire of orange leaves round the deck, leaves on the ground ----
      case "IRONWOOD_AUTUMN": {
        earth();
        const bark = barkM(511, L.bark[0], L.bark[1]);
        trunk(5, 3.4, 19, bark, 513, 2);
        for (const sx of [-1, 1]) tube([new THREE.Vector3(sx * 2, 14, 0), new THREE.Vector3(sx * 6, 18, -1), new THREE.Vector3(sx * 9, 20, -2)], 0.9, bark, 10);
        const cols = ["#d8642a", "#e89a2a", "#b8401a", "#f0b84a"];
        const n = s >= 3 ? 14 : 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          leafBlob(Math.cos(a) * (7 + r() * 2), 19 + r() * 3, Math.sin(a) * (7 + r() * 2) - 1, 2.6 + r() * 1.2, cols[i % 4]!);
        }
        // fallen leaves on the ground
        for (let i = 0; i < 20; i++) {
          const a = r() * Math.PI * 2, d = 5 + r() * 8;
          mesh(new THREE.CircleGeometry(0.7, 5), plainMat(cols[i % 4]!, { rough: 1 }), Math.cos(a) * d, 2.05, Math.sin(a) * d).rotation.x = -Math.PI / 2;
        }
        anchors.core = new THREE.Vector3(0, 9, 4.2);
        if (s >= 5) {
          // a swing hanging from a branch, pumpkins at the root
          for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 4), plainMat("#8a6a42"), 7.5 + sx, 14, -1.5);
          mesh(new THREE.BoxGeometry(3, 0.4, 1.2), woodM, 7.5, 9, -1.5);
          for (const [x, z] of [[-6, 6], [-8, 3]] as const) {
            const p = mesh(new THREE.SphereGeometry(1.4, 12, 8), plainMat("#e87a1a", { rough: 0.7 }), x, 3.2, z);
            p.scale.y = 0.75;
          }
        }
        return ballista(21, "hood");
      }

      // ---- three slender white birches braided together under a plank deck ----
      case "IRONWOOD_BIRCH": {
        earth();
        const birch = plainMat("#ece8de", { rough: 0.7 });
        const mark = plainMat("#2a2620", { rough: 0.9 });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 8; k++) {
            const t = k / 8, aa = a + t * 1.4;
            pts.push(new THREE.Vector3(Math.cos(aa) * (4 - t * 1.6), 2 + t * 18, Math.sin(aa) * (4 - t * 1.6)));
          }
          tube(pts, 1.4, birch, 24);
          for (let k = 1; k < 8; k++) {
            const p = pts[k]!;
            mesh(new THREE.BoxGeometry(1.4, 0.35, 0.3), mark, p.x * 1.33, p.y, p.z * 1.33).rotation.y = -Math.atan2(p.z, p.x) + Math.PI / 2;
          }
        }
        mesh(new THREE.CylinderGeometry(6.5, 6.5, 1, 10), woodM, 0, 20, 0);
        const n = s >= 3 ? 12 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          leafBlob(Math.cos(a) * 7.5, 21.5 + r() * 2, Math.sin(a) * 7.5 - 1, 1.8, i % 3 ? "#a8c84a" : "#e8d84a");
        }
        anchors.core = new THREE.Vector3(0, 10, 3);
        if (s >= 4) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 4), plainMat("#8a6a42"), Math.cos(a) * 6.3, 18.5, Math.sin(a) * 6.3);
          mesh(new THREE.SphereGeometry(0.5, 8, 6), glow("#fff4c0", 2.2), Math.cos(a) * 6.3, 16.8, Math.sin(a) * 6.3);
        }
        return ballista(20.5, "hood");
      }

      // ---- a twisted blood-red tree wrapped in thorny vines, sap dripping ----
      case "IRONWOOD_BLOODWOOD": {
        earth();
        mesh(new THREE.CircleGeometry(6, 20), glow(L.vein, 0.9), 0, 2.05, 6).rotation.x = -Math.PI / 2;
        const bark = barkM(521, L.bark[0], L.bark[1], L.vein);
        trunk(5.6, 3.2, 20, bark, 523, 2);
        const thornM = plainMat("#1a0a0a", { rough: 0.5 });
        const vines = s >= 3 ? 3 : 2;
        for (let k = 0; k < vines; k++) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 30; i++) {
            const t = i / 30, a = t * Math.PI * 5 + k * 2.1;
            const rad = 5.8 - t * 2.2;
            pts.push(new THREE.Vector3(Math.cos(a) * rad, 2 + t * 19, Math.sin(a) * rad));
            if (i % 3 === 0) {
              const th = mesh(new THREE.ConeGeometry(0.35, 2, 5), thornM, Math.cos(a) * (rad + 0.8), 2 + t * 19, Math.sin(a) * (rad + 0.8));
              th.rotation.z = -Math.PI / 2;
              th.rotation.y = -a;
            }
          }
          tube(pts, 0.45, thornM, 90);
        }
        anchors.core = new THREE.Vector3(0, 11, 4.8);
        if (s >= 4) for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          mesh(new THREE.SphereGeometry(0.4, 8, 6), glow(L.vein, 2.4), Math.cos(a) * 4.2, 14 - r() * 6, Math.sin(a) * 4.2).scale.y = 1.8;
        }
        if (s >= 5) for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const sp = mesh(new THREE.ConeGeometry(0.9, 7, 6), thornM, Math.cos(a) * 11, 4.5, Math.sin(a) * 11);
          sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        }
        return ballista(22, "skull", plainMat("#3a0a10", { rough: 0.95 }), plainMat("#2a0a0a", { rough: 0.7 }));
      }

      // ---- a chunk of earth floating over the ground, light pouring off its edges ----
      case "IRONWOOD_CELESTIAL_WARDEN": {
        mesh(new THREE.CylinderGeometry(5, 6, 1, 6), plainMat("#e8e4d8", { rough: 0.5 }), 0, 0.5, 0);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const p = mesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 8), plainMat("#f4f0e4", { rough: 0.4 }), Math.cos(a) * 9, 2.5, Math.sin(a) * 9);
          void p;
          mesh(new THREE.SphereGeometry(0.8, 10, 8), glow("#fff4c8", 2.4), Math.cos(a) * 9, 5.6, Math.sin(a) * 9);
        }
        // the island: grassy top, rocky cone underneath
        const Y = 14;
        mesh(new THREE.CylinderGeometry(8, 8.6, 2, 20), plainMat("#6a9a4a", { rough: 1 }), 0, Y, 0);
        const rockGeo = new THREE.ConeGeometry(8.4, 10, 14, 3);
        const rk = mesh(rockGeo, plainMat("#8a7a6a", { rough: 1 }), 0, Y - 6, 0);
        rk.rotation.x = Math.PI;
        // light falling from its rim like a waterfall
        const fall = new THREE.MeshBasicMaterial({ color: "#fff4c8", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        mesh(new THREE.PlaneGeometry(3, 12), fall, 6.5, Y - 6, 4.5).rotation.y = -0.8;
        mesh(new THREE.CylinderGeometry(1.4, 3, Y - 2, 12, 1, true), fall, 0, (Y - 2) / 2, 0);
        mesh(new THREE.CylinderGeometry(3, 3.4, 4, 12), plainMat("#f4f0e4", { rough: 0.4 }), 0, Y + 3, 0);
        anchors.core = new THREE.Vector3(0, Y - 4, 3);
        if (s >= 3) for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const rock = mesh(new THREE.DodecahedronGeometry(1 + r() * 0.8, 0), plainMat("#8a7a6a", { rough: 1 }), Math.cos(a) * 11, Y - 2 + r() * 6, Math.sin(a) * 11);
          rock.rotation.set(r() * 3, r() * 3, 0);
        }
        if (s >= 5) for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
          const f = mesh(new THREE.BoxGeometry(1.3, 7 - k * 0.8, 0.3), plainMat("#ffffff", { rough: 0.6 }), sx * (4 + k * 1.1), Y + 6 + k * 0.4, -4);
          f.rotation.z = -sx * (0.8 + k * 0.17);
        }
        return ballista(Y + 5, "helm", metal("#e8e0c8", 0.25, 0.85), metal(L.bronze, 0.25, 0.9), "#fff4c8");
      }

      // ---- a wooden siege tower with gold-trimmed walls and banners ----
      case "IRONWOOD_CHAMPION": {
        const planks = mat(barkTex(531, L.wood[0], L.wood[1]), 2, 2, { bump: 1.6 });
        const gold = metal(L.bronze, 0.25, 0.9);
        const H = s >= 5 ? 20 : 17;
        mesh(new THREE.BoxGeometry(11, H, 11), planks, 0, H / 2 + 1, 0);
        for (const y of [5, 11, H]) mesh(new THREE.BoxGeometry(11.6, 0.6, 11.6), gold, 0, y, 0);
        for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]] as const) mesh(new THREE.BoxGeometry(1.2, H + 1, 1.2), gold, x, H / 2 + 1, z);
        // big wheels and a drawbridge front
        for (const sx of [-1, 1]) for (const z of [-3.5, 3.5]) {
          const w = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.9, 16), plainMat(L.wood[1], { rough: 0.8 }), sx * 6, 2.6, z);
          w.rotation.z = Math.PI / 2;
        }
        const db = mesh(new THREE.BoxGeometry(6, 8, 0.6), planks, 0, 6, 5.8);
        db.rotation.x = 0.25;
        anchors.core = new THREE.Vector3(0, 8, 7);
        // banners hanging from the top
        for (const sx of [-1, 1]) {
          const b = mesh(new THREE.PlaneGeometry(3, 7), plainMat(L.cloak[1], { rough: 0.9 }), sx * 3.5, H - 3.5, 5.65);
          (b.material as THREE.Material).side = THREE.DoubleSide;
          mesh(new THREE.OctahedronGeometry(0.8, 0), gold, sx * 3.5, H - 3, 5.8);
        }
        if (s >= 3) for (let i = 0; i < 8; i++) {
          const side = Math.floor(i / 2), k = i % 2;
          const a = (side / 4) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(2, 1.8, 1.4), planks, Math.cos(a) * 5.3 - Math.sin(a) * (k ? 3 : -3), H + 1.6, Math.sin(a) * 5.3 + Math.cos(a) * (k ? 3 : -3));
        }
        return ballista(H + 1, "helm", gold, gold, "#ffd060");
      }

      // ---- a snow-laden pine: tiers of dark needles, the deck at its crown ----
      case "IRONWOOD_FROSTPINE": {
        earth();
        mesh(new THREE.CylinderGeometry(1.8, 2.6, 22, 10), barkM(541, L.bark[0], L.bark[1]), 0, 12, 0);
        const needle = plainMat(L.leaf, { rough: 0.95 });
        const snow = plainMat("#f4f8ff", { rough: 0.8 });
        const tiers = s >= 3 ? 5 : 4;
        for (let i = 0; i < tiers; i++) {
          const rad = 10 - i * 1.6, y = 5 + i * 3.6;
          mesh(new THREE.ConeGeometry(rad, 5, 12), needle, 0, y, 0);
          mesh(new THREE.ConeGeometry(rad * 0.85, 1.6, 12), snow, 0, y + 1.2, 0);
        }
        // snow drifts round the foot
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const m = mesh(new THREE.SphereGeometry(2 + r(), 10, 8), snow, Math.cos(a) * 11, 2, Math.sin(a) * 11);
          m.scale.y = 0.4;
        }
        anchors.core = new THREE.Vector3(0, 6, 8);
        if (s >= 4) for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2, y = 6 + (i % 4) * 3.6;
          mesh(new THREE.SphereGeometry(0.45, 8, 6), glow(i % 2 ? "#6ad0ff" : "#fff4c0", 2.4), Math.cos(a) * (9 - (y - 5) * 0.45), y - 1, Math.sin(a) * (9 - (y - 5) * 0.45));
        }
        if (s >= 6) mesh(new THREE.OctahedronGeometry(1.2, 0), glow("#fff4c0", 2.6), 0, 33, -3).scale.y = 1.6;
        return ballista(21, "hood");
      }

      // ---- a war wagon: spiked wheels, a bronze-plated bed, the ballista on its roof ----
      case "IRONWOOD_GLADIATOR": {
        const bronze = metal(L.bronze, 0.3, 0.85);
        const wood = plainMat(L.wood[0], { rough: 0.85 });
        mesh(new THREE.BoxGeometry(12, 7, 16), wood, 0, 8, 0);
        for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(0.4, 6, 3.4), bronze, sx * 6.2, 8, -6 + k * 4);
        for (const sx of [-1, 1]) for (const z of [-5, 5]) {
          const w = mesh(new THREE.CylinderGeometry(3.6, 3.6, 1.2, 18), plainMat(L.wood[1], { rough: 0.8 }), sx * 7, 3.8, z);
          w.rotation.z = Math.PI / 2;
          mesh(new THREE.TorusGeometry(3.6, 0.35, 6, 18), bronze, sx * 7.65, 3.8, z).rotation.y = Math.PI / 2;
          const sp = mesh(new THREE.ConeGeometry(0.5, 3.6, 6), metal("#c8ccd0", 0.2, 0.9), sx * 9.6, 3.8, z);
          sp.rotation.z = -sx * Math.PI / 2;
        }
        // a ram's head at the front
        mesh(new THREE.SphereGeometry(2, 14, 10), bronze, 0, 7, 8.8);
        for (const sx of [-1, 1]) {
          const h = mesh(new THREE.TorusGeometry(1.4, 0.45, 6, 14, Math.PI * 1.4), bronze, sx * 1.8, 8, 8.2);
          h.rotation.y = Math.PI / 2;
        }
        anchors.core = new THREE.Vector3(0, 8, 9.6);
        if (s >= 3) for (const sx of [-1, 1]) {
          const sh = mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 18), bronze, sx * 6.6, 12.5, 3);
          sh.rotation.z = Math.PI / 2;
        }
        if (s >= 5) {
          const p = mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 6), wood, -4, 17.5, -6);
          void p;
          const fl = mesh(new THREE.PlaneGeometry(4, 3), plainMat("#a01818", { rough: 0.9 }), -2, 22, -6);
          (fl.material as THREE.Material).side = THREE.DoubleSide;
        }
        return ballista(11.5, "helm", bronze, bronze, "#ff8a3a");
      }

      // ---- an iron bunker on tank treads, riveted plates and vision slits ----
      case "IRONWOOD_IRONCLAD_JUGGERNAUT": {
        const plate = mat(metalTex(551, L.bark[0], { rivets: true }), 2, 2, { rough: 0.45, metal: 0.75 });
        const dark = metal(L.iron, 0.5, 0.6);
        for (const sx of [-1, 1]) {
          mesh(new THREE.BoxGeometry(3.6, 4, 17), dark, sx * 7.2, 3, 0);
          for (let k = 0; k < 5; k++) {
            const w = mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.8, 12), metal("#2a2a2e", 0.5, 0.6), sx * 7.2, 2.6, -6 + k * 3);
            w.rotation.z = Math.PI / 2;
          }
        }
        mesh(new THREE.BoxGeometry(11, 7, 15), plate, 0, 7.5, 0);
        const slope = mesh(new THREE.BoxGeometry(11, 0.8, 6), plate, 0, 10.4, 8.2);
        slope.rotation.x = 0.6;
        mesh(new THREE.CylinderGeometry(5, 5.6, 4, 16), plate, 0, 13, -1);
        for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(2.6, 0.4, 0.3), glow(L.vein, 2.4), sx * 2.6, 9, 7.55);
        anchors.core = new THREE.Vector3(0, 9, 8);
        if (s >= 3) for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 8), dark, sx * 4.2, 13, 4);
          mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 8), dark, sx * 4.2, 17.4, 4);
          anchors.banner ??= new THREE.Vector3(sx * 4.2, 18.2, 4);
        }
        if (s >= 5) for (let i = 0; i < 6; i++) mesh(new THREE.ConeGeometry(0.5, 2, 6), metal("#c8ccd0", 0.2, 0.9), -5 + i * 2, 11.4, 9.6).rotation.x = Math.PI / 2 - 0.5;
        return ballista(15, "bot", dark, metal(L.bronze, 0.3, 0.8), L.vein);
      }

      // ---- a dragon's spine rising out of the ground, ribs curling round it ----
      case "IRONWOOD_LEGEND": {
        const bone = plainMat("#d8ccb4", { rough: 0.7 });
        earth();
        for (let i = 0; i < 9; i++) {
          const y = 2.5 + i * 2.2;
          mesh(new THREE.CylinderGeometry(2.3 - i * 0.08, 2.5 - i * 0.08, 1.6, 12), bone, Math.sin(i * 0.5) * 0.6, y, 0);
          mesh(new THREE.ConeGeometry(0.6, 2.6, 6), bone, Math.sin(i * 0.5) * 0.6, y, -2.8).rotation.x = -1.3;
        }
        const ribs = s >= 3 ? 5 : 3;
        for (let i = 0; i < ribs; i++) for (const sx of [-1, 1]) {
          const y = 5 + i * 3.2;
          tube([new THREE.Vector3(sx * 2, y, -0.5), new THREE.Vector3(sx * 7, y + 1, 1), new THREE.Vector3(sx * 8, y - 2, 5), new THREE.Vector3(sx * 5, y - 4, 7)], 0.5, bone, 14);
        }
        // a horned dragon skull at the foot
        const sk = mesh(new THREE.SphereGeometry(3, 16, 12), bone, 0, 3.6, 8.4);
        sk.scale.set(1, 0.8, 1.4);
        for (const sx of [-1, 1]) {
          mesh(new THREE.SphereGeometry(0.7, 10, 8), glow(L.vein, 3), sx * 1.4, 4.4, 11.2);
          tube([new THREE.Vector3(sx * 1.8, 5, 7), new THREE.Vector3(sx * 4, 7, 5), new THREE.Vector3(sx * 4.6, 9, 2)], 0.45, bone, 10);
        }
        anchors.core = new THREE.Vector3(0, 4.4, 11.6);
        if (s >= 5) for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          mesh(new THREE.ConeGeometry(0.8, 5, 6), bone, Math.cos(a) * 12, 3.6, Math.sin(a) * 12).rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        }
        return ballista(22, "skull", plainMat("#1a0e14", { rough: 0.95 }), bone, L.vein);
      }

      // ---- a golden tree of life: a gilded trunk, golden leaves, light at its roots ----
      case "IRONWOOD_PRESTIGE_ASCENDANT": {
        const gold = metal(L.bronze, 0.2, 0.95);
        mesh(new THREE.CylinderGeometry(9, 10, 2, 24), plainMat("#1a1610", { rough: 0.6 }), 0, 1, 0);
        mesh(new THREE.TorusGeometry(9.2, 0.4, 8, 48), gold, 0, 2, 0).rotation.x = Math.PI / 2;
        trunk(4.6, 3, 19, gold, 561, 2);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          tube([new THREE.Vector3(Math.cos(a) * 3.6, 3, Math.sin(a) * 3.6), new THREE.Vector3(Math.cos(a) * 7, 2.4, Math.sin(a) * 7), new THREE.Vector3(Math.cos(a) * 9, 2.2, Math.sin(a) * 9)], 0.7, gold, 10);
        }
        const leafM = plainMat("#ffd860", { rough: 0.25, metal: 0.8, emissive: "#6a4a10", ei: 0.4 });
        const n = s >= 3 ? 14 : 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const m = mesh(new THREE.IcosahedronGeometry(2.2 + r(), 0), leafM, Math.cos(a) * (7 + r() * 2), 18 + r() * 4, Math.sin(a) * (7 + r() * 2) - 1);
          m.scale.y = 0.6;
        }
        mesh(new THREE.CircleGeometry(8.6, 32), glow("#fff0b0", 0.9), 0, 2.05, 0).rotation.x = -Math.PI / 2;
        anchors.core = new THREE.Vector3(0, 10, 4.2);
        if (s >= 5) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.SphereGeometry(0.7, 10, 8), glow("#fff0b0", 2.4), Math.cos(a) * 9.5, 15, Math.sin(a) * 9.5);
        }
        if (s >= 6) mesh(new THREE.TorusGeometry(5, 0.3, 8, 40), glow("#fff0b0", 2.4), 0, 33, -3).rotation.x = Math.PI / 2 - 0.3;
        return ballista(21, "helm", gold, gold, "#fff0b0");
      }

      // ---- a black watchtower of the abyss, gripped by purple tentacles ----
      case "IRONWOOD_WARDEN_OF_THE_ABYSS": {
        const st = mat(stoneTex(571, "#2a2232", "#120e18", "#06040a", 8, 6, { runes: L.vein, runeRows: [2, 5] }), 1.5, 2, { emissiveColor: L.vein, emissiveIntensity: 2.2 });
        mesh(new THREE.CylinderGeometry(5.6, 7, 18, 10), st, 0, 10, 0);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(1.8, 2, 1.8), st, Math.cos(a) * 5.6, 19.6, Math.sin(a) * 5.6);
        }
        mesh(new THREE.BoxGeometry(1.4, 3, 0.4), glow(L.vein, 2.4), 0, 12, 6.3);
        mesh(new THREE.CircleGeometry(6, 24), glow(L.vein, 1.2), 0, 0.1, 0).rotation.x = -Math.PI / 2;
        const tent = LOOK === "IRONWOOD_PACK_ECLIPSE" ? plainMat("#16141a", { rough: 0.3, metal: 0.4, emissive: L.vein, ei: 0.08 }) : plainMat("#4a1a6a", { rough: 0.5, emissive: L.vein, ei: 0.15 });
        const n = s >= 3 ? 5 : 3;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 16; i++) {
            const t = i / 16, a = a0 + t * 2.6;
            const rad = 9 - t * 2.4 + Math.sin(t * 9) * 0.6;
            pts.push(new THREE.Vector3(Math.cos(a) * rad, 0.5 + t * 17, Math.sin(a) * rad));
          }
          mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.9, 8, false), tent);
        }
        anchors.core = new THREE.Vector3(0, 12, 6.6);
        if (s >= 5) for (let i = 0; i < 6; i++) {
          const m = mesh(new THREE.SphereGeometry(0.6, 10, 8), glow(L.vein, 2.6), (r() - 0.5) * 20, 20 + r() * 6, (r() - 0.5) * 16);
          void m;
        }
        return ballista(20.6, "hood", plainMat(L.cloak[1], { rough: 0.95 }), plainMat("#2a1a3a", { rough: 0.7 }), L.vein);
      }
    }
    return null;
  }

  /** The ballista and its crew, shared by every Ironwood look that has its own structure. */
  function buildBallista(b: Ballista, s: number) {
    const { deckY } = b;
    mesh(new THREE.CylinderGeometry(5, 4.4, 1.6, 10), b.wood, 0, deckY + 0.8, 0);
    PARENT = turret;
    mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 12), b.wood, 0, deckY + 1.9, 0);
    mesh(new THREE.BoxGeometry(2.4, 2, 12), b.wood, 0, deckY + 2.6, 1.5);
    mesh(new THREE.BoxGeometry(3.2, 2.6, 2.4), b.fit, 0, deckY + 2.6, 5.5);
    const armTip: Record<string, THREE.Vector3> = {};
    for (const side of [-1, 1]) {
      const pts = [new THREE.Vector3(side * 1.4, deckY + 2.8, 5.4), new THREE.Vector3(side * 6, deckY + 3.6, 4.2), new THREE.Vector3(side * 10.5, deckY + 4.6, 1.2), new THREE.Vector3(side * 12.8, deckY + 5.4, -2.2)];
      tube(pts, s >= 5 ? 0.95 : 0.75, b.arm, 24);
      armTip[side < 0 ? "armL" : "armR"] = pts[3]!.clone();
      mesh(new THREE.SphereGeometry(0.7, 8, 6), b.fit, pts[3]!.x, pts[3]!.y, pts[3]!.z);
    }
    anchors.armL = armTip.armL!;
    anchors.armR = armTip.armR!;
    anchors.nockRest = new THREE.Vector3(0, deckY + 3.4, 2.0);
    anchors.nockDrawn = new THREE.Vector3(0, deckY + 3.4, -3.2);
    anchors.boltTip = new THREE.Vector3(0, deckY + 3.4, 9.0);
    // the crew member working the ballista
    if (b.crew !== "none") {
      const body = mesh(new THREE.ConeGeometry(2.4, 5.2, 10), b.crewM, 0, deckY + 3.8, -3.4);
      body.rotation.x = -0.25;
      if (b.crew === "hood") {
        mesh(new THREE.SphereGeometry(1.5, 12, 10), b.crewM, 0, deckY + 6.9, -3.0);
        const hood = mesh(new THREE.SphereGeometry(1.85, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), b.crewM, 0, deckY + 7.0, -3.2);
        hood.rotation.x = -0.5;
      } else if (b.crew === "helm") {
        mesh(new THREE.SphereGeometry(1.6, 14, 10), b.fit, 0, deckY + 6.9, -3.0);
        mesh(new THREE.BoxGeometry(0.4, 2.2, 2.6), plainMat("#a01818", { rough: 0.9 }), 0, deckY + 8.6, -3.2);
        mesh(new THREE.BoxGeometry(2, 0.3, 0.3), plainMat("#0a0808"), 0, deckY + 6.9, -1.45);
      } else if (b.crew === "bot") {
        mesh(new THREE.BoxGeometry(2.6, 2.4, 2.4), b.crewM, 0, deckY + 7, -3.0);
        mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), plainMat(b.eye, { emissive: b.eye, ei: 3 }), 0, deckY + 7.1, -1.7).rotation.x = Math.PI / 2;
        mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 4), b.crewM, 0.8, deckY + 9, -3);
      } else if (b.crew === "skull") {
        mesh(new THREE.SphereGeometry(1.5, 12, 10), plainMat("#d8ccb4", { rough: 0.7 }), 0, deckY + 6.9, -3.0);
        for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.35, 8, 6), plainMat(b.eye, { emissive: b.eye, ei: 3 }), sx * 0.55, deckY + 7, -1.65);
        const hood = mesh(new THREE.SphereGeometry(1.85, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), b.crewM, 0, deckY + 7.0, -3.4);
        hood.rotation.x = -0.6;
      }
    }
    anchors.eyes = new THREE.Vector3(0, deckY + 6.8, -1.6);
    for (const k of ["armL", "armR", "nockRest", "nockDrawn", "boltTip", "eyes"]) turretAnchors.add(k);
    PARENT = root;
    if (s >= 5 && !anchors.banner) {
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), b.fit, -4, deckY + 7, -4);
      anchors.banner = new THREE.Vector3(-4, deckY + 13.5, -4);
    }
    pointLights.push({ pos: anchors.core ? anchors.core.clone().add(new THREE.Vector3(0, 0, 4)) : new THREE.Vector3(0, deckY * 0.5, 9), color: b.eye, intensity: 120 + s * 30, dist: 26 });
  }

  function buildIronwood() {
    const s = STAGE;
    const L = IRON_LOOKS[LOOK] ?? IRON_LOOKS[SKIN] ?? IRON_LOOKS.base!;
    const own = ironSkinBody(L, s);
    if (own) {
      buildBallista(own, s);
      return;
    }
    const bark = L.steelTrunk ? metalTex(51, L.bark[0], { rivets: true }) : barkTex(51, L.bark[0], L.bark[1], L.vein);
    const moundBark = barkTex(53, L.mound[0], L.mound[1]);
    const iron = metalTex(55, L.iron, { rivets: true });
    const bronze = metalTex(57, L.bronze, { rivets: true });
    const wood = barkTex(59, L.wood[0], L.wood[1]);
    const moss = plainMat(L.moss, { rough: 0.95, metal: 0 });
    const metalM = (t: TexSet) => mat(t, 1, 1, { rough: 0.45, metal: 0.4 });
    const fitEarly = s >= 4 ? bronze : iron;

    mound(14, 5, mat(moundBark, 2, 1, { bump: 1.6 }), 61);
    // moss tufts on the mound
    const r = rng(63);
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, d = 6 + r() * 7;
      const m = mesh(new THREE.SphereGeometry(1.8 + r() * 1.5, 10, 8), moss, Math.cos(a) * d, 3.2 - d * 0.18, Math.sin(a) * d);
      m.scale.y = 0.35;
    }
    // roots crawling out into the ground
    const rootMat = mat(moundBark, 1, 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r() * 0.5;
      tube([new THREE.Vector3(Math.cos(a) * 9, 2.5, Math.sin(a) * 9), new THREE.Vector3(Math.cos(a) * 14, 1, Math.sin(a) * 14), new THREE.Vector3(Math.cos(a + 0.2) * 19, 0.2, Math.sin(a + 0.2) * 19)], 1.1 - i * 0.05, rootMat);
    }
    if (s >= 2) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const sp = mesh(new THREE.ConeGeometry(0.8, 5, 6), metalM(iron), Math.cos(a) * 10, 4.5, Math.sin(a) * 10);
        sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
    }
    const TH = s >= 5 ? 25 : 22;
    trunk(5.4, 3.6, TH, mat(bark, 1.5, 1.5, { bump: L.steelTrunk ? 1 : 2.6, rough: L.steelTrunk ? 0.45 : 0.9, metal: L.steelTrunk ? 0.4 : 0.02, emissiveColor: L.vein, emissiveIntensity: 0.85 }), 65, 4);
    for (const by of [0.3, 0.68]) {
      const w = 5.4 + (3.6 - 5.4) * by;
      mesh(new THREE.CylinderGeometry(w + 0.6, w + 0.7, 1.6, 20), metalM(s >= 4 ? bronze : iron), 0, 4 + TH * by, 0);
    }
    if (s >= 3) {
      // heavy chain wrapped around the trunk
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const y = 4 + TH * 0.48 + Math.sin(a * 1) * 1.2;
        const link = mesh(new THREE.TorusGeometry(0.75, 0.25, 6, 10), metalM(iron), Math.cos(a) * 5.6, y, Math.sin(a) * 5.6);
        link.rotation.set(i % 2 ? Math.PI / 2 : 0, -a, 0);
      }
    }
    if (s >= 4) {
      // two living branches break out of the trunk, in leaf
      const leafM = plainMat(L.leaf, { rough: 0.9, metal: 0, emissive: L.leaf, ei: 0.15 });
      for (const sx of [-1, 1]) {
        const end = new THREE.Vector3(sx * 11, 4 + TH * 0.62, -1.5);
        tube([new THREE.Vector3(sx * 3.6, 4 + TH * 0.4, 0), new THREE.Vector3(sx * 7, 4 + TH * 0.48, -0.5), end], 1.0, mat(bark, 0.5, 1, { bump: 2 }), 12);
        for (let k = 0; k < 3; k++) {
          const m = mesh(new THREE.IcosahedronGeometry(2 + r() * 0.8, 1), leafM, end.x + (r() - 0.5) * 3, end.y + r() * 1.5, end.z + (r() - 0.5) * 3);
          m.scale.y = 0.7;
        }
      }
    }
    if (s >= 5) {
      // great iron-shod roots claw up out of the mound
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.9;
        tube([new THREE.Vector3(Math.cos(a) * 12, 0.5, Math.sin(a) * 12), new THREE.Vector3(Math.cos(a) * 13, 6, Math.sin(a) * 13), new THREE.Vector3(Math.cos(a) * 11, 10, Math.sin(a) * 11)], 1.2, rootMat, 12);
        const tip = mesh(new THREE.ConeGeometry(1.2, 3, 6), metalM(fitEarly), Math.cos(a) * 10.6, 11.4, Math.sin(a) * 10.6);
        tip.rotation.set(Math.sin(a) * -0.4, 0, Math.cos(a) * 0.4);
      }
    }
    anchors.core = new THREE.Vector3(0, 4 + TH * 0.5, 4.4);
    pointLights.push({ pos: new THREE.Vector3(0, 4 + TH * 0.5, 9), color: L.vein, intensity: 120 + s * 30, dist: 26 });

    // Ballista on top (facing the viewer), arms swept back, operator behind.
    const deckY = 4 + TH;
    const deck = mesh(new THREE.CylinderGeometry(5, 4.4, 1.6, 10), mat(wood, 1, 0.3), 0, deckY + 0.8, 0);
    void deck;
    const fit = s >= 4 ? bronze : iron;
    PARENT = turret;
    mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 12), mat(wood, 1, 0.3), 0, deckY + 1.9, 0);
    mesh(new THREE.BoxGeometry(2.4, 2, 12), mat(wood, 0.5, 1.5), 0, deckY + 2.6, 1.5);
    mesh(new THREE.BoxGeometry(3.2, 2.6, 2.4), metalM(fit), 0, deckY + 2.6, 5.5);
    const armMat = mat(wood, 0.4, 2);
    const armTip: Record<string, THREE.Vector3> = {};
    for (const side of [-1, 1]) {
      const pts = [
        new THREE.Vector3(side * 1.4, deckY + 2.8, 5.4),
        new THREE.Vector3(side * 6, deckY + 3.6, 4.2),
        new THREE.Vector3(side * 10.5, deckY + 4.6, 1.2),
        new THREE.Vector3(side * 12.8, deckY + 5.4, -2.2),
      ];
      tube(pts, s >= 5 ? 0.95 : 0.75, armMat, 24);
      if (s >= 5) tube(pts.map((p) => p.clone().add(new THREE.Vector3(0, 0.9, 0.2))), 0.45, metalM(fit), 24);
      armTip[side < 0 ? "armL" : "armR"] = pts[3]!.clone();
      mesh(new THREE.SphereGeometry(0.7, 8, 6), metalM(fit), pts[3]!.x, pts[3]!.y, pts[3]!.z);
    }
    anchors.armL = armTip.armL!;
    anchors.armR = armTip.armR!;
    anchors.nockRest = new THREE.Vector3(0, deckY + 3.4, 2.0);
    anchors.nockDrawn = new THREE.Vector3(0, deckY + 3.4, -3.2);
    anchors.boltTip = new THREE.Vector3(0, deckY + 3.4, 9.0);
    // Hooded operator crouched behind the stock.
    const cloak = plainMat(s >= 4 ? L.cloak[1] : L.cloak[0], { rough: 0.95, metal: 0 });
    const body = mesh(new THREE.ConeGeometry(2.4, 5.2, 10), cloak, 0, deckY + 3.8, -3.4);
    body.rotation.x = -0.25;
    mesh(new THREE.SphereGeometry(1.5, 12, 10), cloak, 0, deckY + 6.9, -3.0);
    const hood = mesh(new THREE.SphereGeometry(1.85, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cloak, 0, deckY + 7.0, -3.2);
    hood.rotation.x = -0.5;
    anchors.eyes = new THREE.Vector3(0, deckY + 6.8, -1.6);
    for (const k of ["armL", "armR", "nockRest", "nockDrawn", "boltTip", "eyes"]) turretAnchors.add(k);
    PARENT = root;

    if (s >= 5) {
      // war banner on a pole behind the operator
      const pole = mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), metalM(fit), -4, deckY + 7, -4);
      void pole;
      anchors.banner = new THREE.Vector3(-4, deckY + 13.5, -4);
    }
    if (s >= 6 && (SKIN === "base" || SKIN === "IRONWOOD_ANCIENT_HUNTER")) {
      // ancient crown: leafy clusters sprouting from the trunk top and glowing root runes
      const leaf = plainMat(L.leaf, { rough: 0.9, metal: 0, emissive: L.leaf, ei: 0.25 });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const m = mesh(new THREE.IcosahedronGeometry(2.2 + r() * 1.2, 1), leaf, Math.cos(a) * 5.6, deckY - 1 + r() * 1.5, Math.sin(a) * 5.6);
        m.scale.y = 0.7;
      }
      const rune = plainMat(L.vein, { emissive: L.vein, ei: 2.4 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), rune, Math.cos(a) * 13, 1.2, Math.sin(a) * 13);
      }
      pointLights.push({ pos: new THREE.Vector3(0, 3, 12), color: L.vein, intensity: 140, dist: 30 });
    }
    ironSignature({ deckY, TH, s, armTip, metalM, iron, bronze });
  }

  // ---------------------------------------------------------------------------
  // INFERNO — octagonal iron platform with glowing vents, a riveted furnace with
  // a big round fire mouth facing out and a rear chimney. The fire inside the
  // mouth, sparks and smoke are live. Stages: 2 coal chute, 3 taller chimney +
  // pressure pipes, 4 brass studs/trim, 5 twin chimneys + bellows, 6 gilded
  // furnace with lava-rune vents.
  // ---------------------------------------------------------------------------
  /** Swirling molten fire for the surface inside the cauldron. */
  function lavaTexture(fire: string) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const col = new THREE.Color(fire);
    const r = rng(311);
    g.fillStyle = `#${col.clone().multiplyScalar(0.55).getHexString()}`;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      const x = r() * 128, y = r() * 128, rad = 6 + r() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const hot = col.clone().lerp(new THREE.Color("#fff2a0"), 0.3 + r() * 0.6);
      gr.addColorStop(0, `rgba(${(hot.r * 255) | 0},${(hot.g * 255) | 0},${(hot.b * 255) | 0},0.85)`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // dark crust veins drifting on top
    g.strokeStyle = "rgba(60,14,4,0.35)";
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(r() * 128, r() * 128);
      g.bezierCurveTo(r() * 128, r() * 128, r() * 128, r() * 128, r() * 128, r() * 128);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const INF_OWN = new Set(["INFERNO_ASHEN_TYRANT", "INFERNO_VOLCANIC_COLOSSUS", "INFERNO_INDUSTRIAL_FORGE", "INFERNO_SOLAR_ASCENDANT", "INFERNO_PRESTIGE_ASCENDANT", "INFERNO_BLUE_FLAME", "INFERNO_COPPER", "INFERNO_EMERALD", "INFERNO_LEGEND"]);
  const FROST_OWN = new Set(["FROSTBORN_ANCIENT_GUARDIAN", "FROSTBORN_ARCANE_CRYSTAL", "FROSTBORN_GLACIAL_WARLORD", "FROSTBORN_LEGEND", "FROSTBORN_CHAMPION", "FROSTBORN_CELESTIAL_ICE"]);
  const STORM_OWN = new Set(["STORMCALLER_THUNDER", "STORMCALLER_VOID", "STORMCALLER_COPPER", "STORMCALLER_RUBY", "STORMCALLER_PRESTIGE_ASCENDANT", "STORMCALLER_LEGEND", "STORMCALLER_CHAMPION"]);
  const IRON_OWN = new Set(["IRONWOOD_ANCIENT_HUNTER", "IRONWOOD_AUTUMN", "IRONWOOD_BIRCH", "IRONWOOD_BLOODWOOD", "IRONWOOD_CELESTIAL_WARDEN", "IRONWOOD_CHAMPION", "IRONWOOD_FROSTPINE", "IRONWOOD_LEGEND", "IRONWOOD_PRESTIGE_ASCENDANT", "IRONWOOD_WARDEN_OF_THE_ABYSS"]);

  // ---------------------------------------------------------------------------
  // INFERNO SKIN BODIES — every skin is its own machine, not a recolour: a demon
  // skull, a volcano, a steam boiler, a sun temple, an alchemist's still, a
  // phoenix brazier, a spirit lantern, a beehive kiln, a locomotive, a jade
  // dragon, a war helmet, a trophy of fire, an obsidian rift. Each stands on
  // the same octagonal platform, turns to aim, hurls fire from `mouth`, smokes
  // from `smoke1`/`smoke2`, and grows new pieces every stage.
  // ---------------------------------------------------------------------------
  function infernoSkinBody(L: InfLook, s: number): boolean {
    // only the looks that still read as this tower's element get their own structure; the rest keep the standard tower
    if (!INF_OWN.has(SKIN)) return false;
    const fireCol = new THREE.Color(L.fire);
    const hot = `#${fireCol.clone().lerp(new THREE.Color("#fff0c0"), 0.45).getHexString()}`;
    const fireM = (col: string, op = 0.85) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const flame = (x: number, y: number, z: number, h: number, r: number, col = L.fire) => mesh(new THREE.ConeGeometry(r, h, 8), fireM(col), x, y + h / 2, z);
    const glow = (col: string, ei = 2.2) => plainMat(col, { emissive: col, ei, rough: 0.5 });
    const metal = (col: string, rough = 0.35, met = 0.7) => plainMat(col, { rough, metal: met });
    let lavaTex: THREE.Texture | undefined;
    const lava = (ei = 2.4) => {
      const m = plainMat(L.fire, { emissive: L.fire, ei, rough: 0.6 });
      lavaTex ??= lavaTexture(L.fire);
      m.emissiveMap = lavaTex;
      m.map = lavaTex;
      return m;
    };
    /** A ball of living fire with tongues of flame licking up from it. */
    const fireBall = (x: number, y: number, z: number, r: number, tongues = 5) => {
      mesh(new THREE.SphereGeometry(r, 24, 18), lava(2.6), x, y, z);
      mesh(new THREE.SphereGeometry(r * 1.25, 20, 14), fireM(L.fire, 0.35), x, y, z);
      const fr = rng(Math.round(x * 13 + y * 7 + z * 3) + 5);
      for (let i = 0; i < tongues; i++) {
        const a = (i / tongues) * Math.PI * 2;
        flame(x + Math.cos(a) * r * 0.45, y + r * 0.2, z + Math.sin(a) * r * 0.45, r * (1.4 + fr()), r * 0.42, i % 2 ? hot : L.fire);
      }
      flame(x, y + r * 0.3, z, r * 2.4, r * 0.55, hot);
    };
    const light = (x: number, y: number, z: number, k = 1) => pointLights.push({ pos: new THREE.Vector3(x, y, z), color: L.fire, intensity: (320 + s * 60) * k, dist: 40 });
    const r = rng(SKIN.length * 31 + 7);

    switch (SKIN) {
      // ---- a horned demon skull, fire roaring out of its open jaw ----
      case "INFERNO_ASHEN_TYRANT": {
        const boneTex = stoneTex(201, "#5a4844", "#2a1e1c", "#100808", 5, 4, { runes: L.fire, runeRows: [1, 3] });
        const bone = mat(boneTex, 1.5, 1.5, { emissiveColor: L.fire, emissiveIntensity: 2, rough: 0.8 });
        const skull = mesh(new THREE.SphereGeometry(7.5, 32, 24), bone, 0, 15, -0.5);
        skull.scale.set(1, 0.95, 1.1);
        // brow ridge and cheekbones
        mesh(new THREE.BoxGeometry(13, 2, 3), bone, 0, 16.6, 6.2).rotation.x = -0.2;
        for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(2.6, 14, 10), bone, sx * 5, 11.5, 5.2);
        // eye sockets with burning pupils
        for (const sx of [-1, 1]) {
          mesh(new THREE.SphereGeometry(2.1, 16, 12), plainMat("#080404", { rough: 1 }), sx * 3, 14.6, 6.6);
          mesh(new THREE.SphereGeometry(0.9, 12, 8), glow(L.fire, 3.5), sx * 3, 14.6, 7.9);
        }
        // the hinged lower jaw hanging open, teeth top and bottom
        const jaw = mesh(new THREE.BoxGeometry(9, 2.2, 8), bone, 0, 6.2, 3.4);
        jaw.rotation.x = 0.22;
        for (let i = 0; i < 6; i++) {
          const x = -3.6 + i * 1.45;
          mesh(new THREE.ConeGeometry(0.55, 2, 6), plainMat("#d8ccb8", { rough: 0.6 }), x, 9.4, 7.2).rotation.x = Math.PI;
          mesh(new THREE.ConeGeometry(0.5, 1.6, 6), plainMat("#d8ccb8", { rough: 0.6 }), x, 7.8, 6.8);
        }
        fireBall(0, 8.9, 4.2, 2.8, 6);
        anchors.mouth = new THREE.Vector3(0, 8.8, 8.6);
        light(0, 9, 11);
        // great horns sweeping back
        const hornM = plainMat("#1a1212", { rough: 0.45, metal: 0.2 });
        const horns = (sz: number, y: number, z: number) => {
          for (const sx of [-1, 1]) {
            tube([new THREE.Vector3(sx * 5.5, y, z), new THREE.Vector3(sx * 9.5 * sz, y + 3 * sz, z - 1), new THREE.Vector3(sx * 11 * sz, y + 8 * sz, z - 4), new THREE.Vector3(sx * 9 * sz, y + 12 * sz, z - 6)], 1.1 * sz, hornM, 18);
            mesh(new THREE.ConeGeometry(1.1 * sz, 3 * sz, 8), hornM, sx * 8.6 * sz, y + 13.3 * sz, z - 6.4).rotation.x = -0.4;
          }
        };
        horns(1, 18, 0);
        if (s >= 3) horns(0.62, 20.5, -2);
        if (s >= 4) {
          // a cracked molten crown of the skull
          for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.4, 0.3, 6), glow(L.fire, 2.6), -3 + i * 1.5, 22, -1).rotation.z = (r() - 0.5) * 0.6;
        }
        if (s >= 5) {
          // chains hanging from the jaw
          for (const sx of [-1, 1]) tube([new THREE.Vector3(sx * 4.4, 6, 6.5), new THREE.Vector3(sx * 6, 3.5, 7.5), new THREE.Vector3(sx * 7.5, 1.5, 8)], 0.3, metal("#3a3434"), 10);
        }
        if (s >= 6) {
          for (let i = 0; i < 7; i++) {
            const a = -0.9 + i * 0.3;
            mesh(new THREE.ConeGeometry(0.7, 4, 6), metal(L.brass, 0.3, 0.8), Math.sin(a) * 6.5, 21 + Math.cos(a) * 1.5, -0.5 - Math.cos(a) * 2).rotation.z = -a * 0.6;
          }
        }
        anchors.smoke1 = new THREE.Vector3(0, 23, -1);
        if (s >= 5) anchors.smoke2 = new THREE.Vector3(0, 10, 9);
        return true;
      }

      // ---- a living volcano: lava rivers, a burning crater, a vent at its foot ----
      case "INFERNO_VOLCANIC_COLOSSUS": {
        const rock = stoneTex(211, "#4a3a30", "#2a1e18", "#0e0806", 6, 6, { runes: L.fire, runeRows: [2, 5] });
        const H = s >= 5 ? 21 : 18;
        const geo = new THREE.CylinderGeometry(4.5, 12.5, H, 18, 6);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const a = Math.atan2(z, x);
          const k = 1 + 0.1 * Math.sin(a * 5 + y * 0.4) + 0.06 * Math.sin(a * 11);
          pos.setXYZ(i, x * k, y, z * k);
        }
        geo.computeVertexNormals();
        mesh(geo, mat(rock, 3, 2, { emissiveColor: L.fire, emissiveIntensity: 2, bump: 2.4 }), 0, 3 + H / 2, 0);
        // crater rim and the lava lake inside
        mesh(new THREE.TorusGeometry(4.4, 1.1, 8, 20), mat(rock, 2, 0.5), 0, 3 + H, 0).rotation.x = Math.PI / 2;
        mesh(new THREE.CircleGeometry(4, 24), lava(2.8), 0, 2.6 + H, 0).rotation.x = -Math.PI / 2;
        flame(0, 2.8 + H, 0, 6, 2.2, hot);
        // lava rivers running down the slopes
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5;
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 6; k++) {
            const t = k / 6;
            const rad = 4.6 + t * 8.2;
            const aa = a + Math.sin(t * 4) * 0.15;
            pts.push(new THREE.Vector3(Math.cos(aa) * rad, 3 + H - t * H + 0.3, Math.sin(aa) * rad));
          }
          tube(pts, 0.55, lava(2.6), 16);
        }
        // the vent at its foot it fires from
        fireBall(0, 7, 10.4, 2.4, 5);
        mesh(new THREE.TorusGeometry(2.9, 0.9, 8, 18), mat(rock, 1, 0.4), 0, 7, 10.2);
        anchors.mouth = new THREE.Vector3(0, 7, 12.8);
        light(0, 7, 14);
        light(0, H + 6, 0, 0.6);
        if (s >= 3) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + r();
            const b = mesh(new THREE.DodecahedronGeometry(1.4 + r() * 1.2, 0), mat(rock, 0.4, 0.4, { emissiveColor: L.fire, emissiveIntensity: 1.6 }), Math.cos(a) * 13.5, 4, Math.sin(a) * 13.5);
            b.rotation.set(r() * 3, r() * 3, r() * 3);
          }
        }
        if (s >= 4) {
          // a smaller cone breaking out of its flank
          mesh(new THREE.CylinderGeometry(1.6, 4.5, 8, 12), mat(rock, 1, 1, { emissiveColor: L.fire, emissiveIntensity: 2 }), -7, 7, -3);
          mesh(new THREE.CircleGeometry(1.5, 12), lava(2.8), -7, 11.05, -3).rotation.x = -Math.PI / 2;
          anchors.smoke2 = new THREE.Vector3(-7, 12, -3);
        }
        if (s >= 6) {
          // molten rocks hanging in the heat above the crater
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            mesh(new THREE.DodecahedronGeometry(1 + r() * 0.6, 0), lava(2), Math.cos(a) * 6, H + 9 + r() * 3, Math.sin(a) * 6).rotation.set(r() * 3, r() * 3, 0);
          }
        }
        anchors.smoke1 = new THREE.Vector3(0, H + 5, 0);
        return true;
      }

      // ---- an upright steam boiler: gauges, pistons, a flywheel and tall stacks ----
      case "INFERNO_INDUSTRIAL_FORGE": {
        const plate = metalTex(221, L.iron, { rivets: true });
        const plateM = mat(plate, 3, 2, { rough: 0.4, metal: 0.7 });
        const brassM = metal(L.brass, 0.3, 0.85);
        mesh(new THREE.CylinderGeometry(6.2, 6.6, 15, 28), plateM, 0, 10.5, -0.5);
        const dome = mesh(new THREE.SphereGeometry(6.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), plateM, 0, 18, -0.5);
        void dome;
        for (const y of [4.5, 10, 15.5]) mesh(new THREE.TorusGeometry(6.4, 0.32, 8, 40), brassM, 0, y, -0.5).rotation.x = Math.PI / 2;
        // the firebox door with its fire
        mesh(new THREE.BoxGeometry(6, 5.4, 1.4), metal(L.dark), 0, 7.5, 5.8);
        mesh(new THREE.PlaneGeometry(4.6, 4), lava(2.4), 0, 7.5, 6.55);
        for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.3, 4.2, 0.3), metal(L.dark), -1.8 + i * 1.2, 7.5, 6.75);
        flame(0, 5.8, 6.9, 3.5, 1.4, hot);
        anchors.mouth = new THREE.Vector3(0, 7.5, 7.8);
        light(0, 7.5, 10);
        // pressure gauges
        for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.6, 20), brassM, sx * 2.6, 13.4, 5.6).rotation.x = Math.PI / 2;
          mesh(new THREE.CircleGeometry(1.05, 20), plainMat("#f4ecd8", { rough: 0.4 }), sx * 2.6, 13.4, 5.92);
          mesh(new THREE.BoxGeometry(0.12, 0.9, 0.05), plainMat("#aa1a1a"), sx * 2.6, 13.6, 5.96).rotation.z = sx * 0.8;
        }
        // tall smoke stack
        const stack = (x: number, z: number, h: number) => {
          mesh(new THREE.CylinderGeometry(1.4, 1.7, h, 16), plateM, x, 18 + h / 2, z);
          mesh(new THREE.CylinderGeometry(2.2, 1.5, 1.6, 16), brassM, x, 18 + h, z);
          return new THREE.Vector3(x, 19.5 + h, z);
        };
        anchors.smoke1 = stack(2.4, -3, s >= 3 ? 12 : 9);
        if (s >= 3) anchors.smoke2 = stack(-2.6, -3.4, 8);
        if (s >= 2) {
          // pistons on the flanks
          for (const sx of [-1, 1]) {
            mesh(new THREE.CylinderGeometry(1.3, 1.3, 7, 14), metal(L.iron), sx * 8, 7, 0);
            mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 8), metal("#d0d4d8", 0.2, 0.9), sx * 8, 12.5, 0);
            tube([new THREE.Vector3(sx * 6.4, 13, 0), new THREE.Vector3(sx * 8, 15, 0)], 0.5, brassM, 4);
          }
        }
        if (s >= 4) {
          // a toothed flywheel on the right
          const wheel = new THREE.Group();
          wheel.position.set(9.6, 9, -2);
          wheel.rotation.y = Math.PI / 2;
          PARENT.add(wheel);
          mesh(new THREE.TorusGeometry(4, 0.6, 8, 28), brassM, 0, 0, 0, wheel);
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), brassM, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0, wheel).rotation.z = a;
          }
          for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(8, 0.5, 0.5), metal(L.iron), 0, 0, 0, wheel).rotation.z = (i / 4) * Math.PI;
        }
        if (s >= 5) {
          // steam pipes snaking round the boiler
          tube([new THREE.Vector3(-6, 16, 1), new THREE.Vector3(-8, 18, 2), new THREE.Vector3(-8, 10, 4), new THREE.Vector3(-5.5, 4, 5)], 0.6, brassM, 20);
          anchors.steam = new THREE.Vector3(-8, 18.5, 2);
        }
        if (s >= 6) {
          mesh(new THREE.TorusGeometry(6.5, 0.6, 8, 40), brassM, 0, 18.2, -0.5).rotation.x = Math.PI / 2;
          mesh(new THREE.SphereGeometry(1.2, 12, 10), brassM, 0, 24.3, -0.5);
        }
        return true;
      }

      // ---- a stepped sun temple with a blazing sun hanging over it ----
      case "INFERNO_SOLAR_ASCENDANT": {
        const sand = stoneTex(231, "#e8d4a0", "#b09460", "#6a5430", 4, 6);
        const step = (w: number, h: number, y: number) => mesh(new THREE.BoxGeometry(w, h, w), mat(sand, w / 6, h / 3, { rough: 0.8 }), 0, y + h / 2, 0);
        step(14, 3.2, 3);
        step(10.5, 3.2, 6.2);
        step(7, 3, 9.4);
        // gold trim and a stair up the front
        for (const [w, y] of [[14.2, 6.2], [10.7, 9.4], [7.2, 12.4]] as const) mesh(new THREE.BoxGeometry(w, 0.4, w), metal(L.brass, 0.25, 0.9), 0, y, 0);
        for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(3.4, 0.9, 1.6), mat(sand, 0.5, 0.2), 0, 3.5 + i * 1.5, 7 - i * 1.1);
        // the sun
        const SY = s >= 5 ? 22 : 20;
        mesh(new THREE.SphereGeometry(4, 32, 24), lava(2.8), 0, SY, 0);
        mesh(new THREE.SphereGeometry(5.2, 24, 18), fireM(L.fire, 0.3), 0, SY, 0);
        const rays = (n: number, len: number, rad: number, off: number) => {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            const ray = mesh(new THREE.ConeGeometry(0.8, len, 6), metal(L.brass, 0.2, 0.9), Math.cos(a) * (rad + len / 2), SY + Math.sin(a) * (rad + len / 2), -0.5);
            ray.rotation.z = a - Math.PI / 2;
          }
        };
        rays(12, s >= 4 ? 4.5 : 3.4, 5, 0);
        if (s >= 6) rays(12, 3, 5.2, Math.PI / 12);
        anchors.mouth = new THREE.Vector3(0, SY, 4.6);
        anchors.smoke1 = new THREE.Vector3(0, SY + 4.5, 0);
        light(0, SY, 6);
        // a beam of light from the altar to the sun
        mesh(new THREE.CylinderGeometry(0.9, 1.6, SY - 13, 12, 1, true), fireM(hot, 0.35), 0, 12.4 + (SY - 13) / 2, 0);
        if (s >= 3) {
          // obelisks at the temple corners
          for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as const) {
            mesh(new THREE.CylinderGeometry(0.5, 1, 6, 4), mat(sand, 0.3, 1), x, 9.2, z).rotation.y = Math.PI / 4;
            mesh(new THREE.ConeGeometry(0.7, 1.2, 4), metal(L.brass, 0.2, 0.9), x, 12.8, z).rotation.y = Math.PI / 4;
          }
        }
        if (s >= 5) {
          // a golden ring orbiting the sun
          const ring = mesh(new THREE.TorusGeometry(7, 0.35, 8, 48), metal(L.brass, 0.2, 0.9), 0, SY, 0);
          ring.rotation.x = 1.2;
        }
        return true;
      }

      // ---- an alchemist's still: a great glass flask of poison fire over a burner ----
      case "INFERNO_PLAGUE_FURNACE": {
        const iron = metal(L.dark, 0.6, 0.5);
        // burner and tripod
        mesh(new THREE.CylinderGeometry(4, 4.6, 2.4, 16), metal(L.iron), 0, 4.2, 0);
        flame(0, 5.4, 0, 3, 2, hot);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          tube([new THREE.Vector3(Math.cos(a) * 7, 3, Math.sin(a) * 7), new THREE.Vector3(Math.cos(a) * 5.4, 9, Math.sin(a) * 5.4)], 0.45, iron, 4);
        }
        // the flask
        const glass = new THREE.MeshPhysicalMaterial({ color: "#c8ffb0", transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, depthWrite: false });
        mesh(new THREE.SphereGeometry(6.4, 32, 24), glass, 0, 13, 0);
        const brew = mesh(new THREE.SphereGeometry(5.6, 28, 20, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), lava(2.2), 0, 13, 0);
        void brew;
        for (let i = 0; i < 8; i++) mesh(new THREE.SphereGeometry(0.3 + r() * 0.5, 8, 6), glow(hot, 2), (r() - 0.5) * 7, 13 + r() * 4, (r() - 0.5) * 7);
        // the long neck bends forward: the poison fire spits from its tip
        mesh(new THREE.CylinderGeometry(1.4, 1.8, 4, 14), glass, 0, 20.5, 0);
        tube([new THREE.Vector3(0, 22, 0), new THREE.Vector3(0, 25, 1.5), new THREE.Vector3(0, 24.5, 6), new THREE.Vector3(0, 21.5, 9)], 0.9, metal(L.brass, 0.4, 0.6), 18);
        anchors.mouth = new THREE.Vector3(0, 21, 9.8);
        anchors.smoke1 = new THREE.Vector3(0, 23, 0);
        light(0, 13, 8);
        if (s >= 2) {
          // a rack of vials
          for (let i = 0; i < 4; i++) {
            const x = -9 + i * 1.6;
            mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 10), glass, x, 4.5, 8);
            mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 10), glow(i % 2 ? L.fire : hot, 1.8), x, 4.1, 8);
          }
        }
        if (s >= 4) {
          // a second retort fed by a coil from the first
          mesh(new THREE.SphereGeometry(3, 24, 18), glass, 9, 9, -3);
          mesh(new THREE.SphereGeometry(2.5, 20, 14), lava(2), 9, 8.8, -3);
          tube([new THREE.Vector3(4.5, 17, -1.5), new THREE.Vector3(8, 16, -2.5), new THREE.Vector3(9, 12, -3)], 0.45, metal(L.brass, 0.4, 0.6), 12);
          anchors.smoke2 = new THREE.Vector3(9, 12.5, -3);
        }
        if (s >= 6) {
          // a skull mounted on the burner and a crown of glass spires
          mesh(new THREE.SphereGeometry(1.6, 14, 10), plainMat("#d8d0b8", { rough: 0.7 }), 0, 4.5, 4.6);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            mesh(new THREE.ConeGeometry(0.5, 3.4, 6), glow(hot, 1.4), Math.cos(a) * 5, 18.6, Math.sin(a) * 5).rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
          }
        }
        return true;
      }

      // ---- a golden phoenix brazier with wings of gold feathers ----
      case "INFERNO_PRESTIGE_ASCENDANT": {
        const gold = metal(L.brass, 0.22, 0.9);
        mesh(new THREE.CylinderGeometry(5, 6, 2.4, 24), gold, 0, 4.2, 0);
        const fl = mesh(new THREE.CylinderGeometry(2.6, 3.4, 9, 16), metal(L.iron, 0.4, 0.6), 0, 9.9, 0);
        void fl;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(0.5, 9, 0.5), gold, Math.cos(a) * 3.05, 9.9, Math.sin(a) * 3.05);
        }
        const bowl = mesh(new THREE.LatheGeometry([new THREE.Vector2(0.01, 14), new THREE.Vector2(3, 14.4), new THREE.Vector2(6.5, 16.4), new THREE.Vector2(8, 19), new THREE.Vector2(7.6, 19.3)], 32), gold, 0, 0, 0);
        (bowl.material as THREE.Material).side = THREE.DoubleSide;
        fireBall(0, 19.2, 0, 4.6, 8);
        anchors.mouth = new THREE.Vector3(0, 20, 6);
        anchors.smoke1 = new THREE.Vector3(0, 26, 0);
        light(0, 21, 6);
        // wings
        const n = s >= 4 ? 7 : 5;
        for (const sx of [-1, 1]) {
          for (let k = 0; k < n; k++) {
            const len = 13 - k * 1.2;
            const f = mesh(new THREE.BoxGeometry(1.4, len, 0.35), gold, 0, 0, 0);
            const a = 0.35 + k * 0.17;
            f.position.set(sx * (6 + Math.sin(a) * len / 2), 17 + Math.cos(a) * len / 2, -3 - k * 0.2);
            f.rotation.z = -sx * a;
            mesh(new THREE.BoxGeometry(0.4, len * 0.8, 0.4), glow(hot, 1.6), f.position.x, f.position.y, f.position.z + 0.25).rotation.z = -sx * a;
          }
        }
        if (s >= 3) for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(1, 14, 10), glow(L.fire, 2.5), sx * 5, 4.2, 4.8);
        if (s >= 6) {
          mesh(new THREE.TorusGeometry(5.5, 0.4, 8, 40), glow(hot, 2.4), 0, 30, -1).rotation.x = Math.PI / 2 - 0.3;
        }
        return true;
      }

      // ---- a spirit lantern: a caged blue fire behind panes of glass ----
      case "INFERNO_BLUE_FLAME": {
        const ironM = metal(L.iron, 0.4, 0.7);
        mesh(new THREE.CylinderGeometry(6.5, 7.2, 3, 6), ironM, 0, 4.5, 0);
        const glassM = new THREE.MeshPhysicalMaterial({ color: "#a8d8ff", transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, depthWrite: false });
        mesh(new THREE.CylinderGeometry(5.6, 5.6, 11, 6, 1, true), glassM, 0, 11.5, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.BoxGeometry(0.6, 11.5, 0.6), ironM, Math.cos(a) * 5.7, 11.5, Math.sin(a) * 5.7);
        }
        mesh(new THREE.CylinderGeometry(6.4, 6.4, 1, 6), ironM, 0, 17.4, 0);
        mesh(new THREE.ConeGeometry(6.6, 6, 6), ironM, 0, 21, 0);
        mesh(new THREE.TorusGeometry(1.2, 0.35, 8, 16), ironM, 0, 25, 0);
        fireBall(0, 10.5, 0, 3, 6);
        anchors.mouth = new THREE.Vector3(0, 11, 6);
        anchors.smoke1 = new THREE.Vector3(0, 24.5, 0);
        light(0, 11, 7);
        if (s >= 3) {
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            crystal(4 + r() * 2, 0.8, glow(hot, 1.4), Math.cos(a) * 10.5, 2.8, Math.sin(a) * 10.5, Math.sin(a) * 0.3, -Math.cos(a) * 0.3);
          }
        }
        if (s >= 5) {
          // two small lanterns swinging from hooks
          for (const sx of [-1, 1]) {
            tube([new THREE.Vector3(sx * 4, 21, 0), new THREE.Vector3(sx * 8.5, 22, 0), new THREE.Vector3(sx * 9.5, 20, 0)], 0.25, ironM, 8);
            mesh(new THREE.CylinderGeometry(1.4, 1.4, 3, 6, 1, true), glassM, sx * 9.5, 17.5, 0);
            mesh(new THREE.ConeGeometry(1.6, 1.4, 6), ironM, sx * 9.5, 19.6, 0);
            mesh(new THREE.SphereGeometry(0.8, 10, 8), glow(L.fire, 2.6), sx * 9.5, 17.5, 0);
          }
        }
        if (s >= 6) mesh(new THREE.ConeGeometry(0.6, 6, 6), glow(hot, 2), 0, 28.6, 0);
        return true;
      }

      // ---- a round copper-banded beehive kiln with an arched fire door ----
      case "INFERNO_COPPER": {
        const brickT = stoneTex(241, L.brick[0], L.brick[1], L.brick[2], 8, 10);
        const kiln = mesh(new THREE.SphereGeometry(8.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat(brickT, 3, 1.4), 0, 3, 0);
        kiln.scale.y = 1.55;
        const cu = metal(L.brass, 0.3, 0.85);
        for (const [y, rad] of [[6, 8.2], [10.5, 6.9]] as const) mesh(new THREE.TorusGeometry(rad, 0.4, 8, 40), cu, 0, y, 0).rotation.x = Math.PI / 2;
        // arched fire door
        const arch = mesh(new THREE.TorusGeometry(3.2, 0.8, 8, 20, Math.PI), cu, 0, 6, 8.2);
        void arch;
        mesh(new THREE.PlaneGeometry(6.4, 3), lava(2.4), 0, 4.5, 8.1);
        mesh(new THREE.CircleGeometry(3.2, 20, 0, Math.PI), lava(2.4), 0, 6, 8.1);
        flame(0, 3.2, 8.4, 5, 1.6, hot);
        anchors.mouth = new THREE.Vector3(0, 6, 9.5);
        light(0, 6, 11);
        // a bent copper flue
        tube([new THREE.Vector3(0, 15.5, -1), new THREE.Vector3(0, 19, -1.5), new THREE.Vector3(2, 21.5, -3), new THREE.Vector3(2.4, 25, -3.4)], 1, cu, 16);
        anchors.smoke1 = new THREE.Vector3(2.4, 25.6, -3.4);
        if (s >= 3) {
          // spy-holes glowing round the dome
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            if (Math.abs(Math.sin(a) - 1) < 0.3) continue;
            mesh(new THREE.CircleGeometry(0.8, 12), glow(L.fire, 2.4), Math.cos(a) * 7.5, 9, Math.sin(a) * 7.5).lookAt(Math.cos(a) * 20, 9, Math.sin(a) * 20);
          }
        }
        if (s >= 4) {
          // a second, smaller kiln joined by a copper pipe
          const k2 = mesh(new THREE.SphereGeometry(4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(brickT, 1.5, 0.8), -9, 3, -4);
          k2.scale.y = 1.4;
          tube([new THREE.Vector3(-6, 6, -2), new THREE.Vector3(-7.5, 8, -3)], 0.6, cu, 4);
          anchors.smoke2 = new THREE.Vector3(-9, 9.2, -4);
        }
        if (s >= 6) {
          mesh(new THREE.TorusGeometry(4.2, 0.5, 8, 30), cu, 0, 14.5, 0).rotation.x = Math.PI / 2;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            mesh(new THREE.ConeGeometry(0.4, 2.4, 6), cu, Math.cos(a) * 4.2, 16, Math.sin(a) * 4.2);
          }
        }
        return true;
      }

      // ---- a steam locomotive, its firebox blazing out of the smokebox door ----
      case "INFERNO_SOOT": {
        const black = metal(L.iron, 0.5, 0.6);
        const trim = metal(L.brass, 0.35, 0.8);
        const boiler = mesh(new THREE.CylinderGeometry(4.4, 4.4, 15, 24), black, 0, 10, 0);
        boiler.rotation.x = Math.PI / 2;
        for (const z of [-4, 0, 4]) mesh(new THREE.TorusGeometry(4.5, 0.25, 6, 30), trim, 0, 10, z);
        // smokebox door: a round fire
        mesh(new THREE.CylinderGeometry(4.6, 4.6, 1, 24), black, 0, 10, 7.6).rotation.x = Math.PI / 2;
        mesh(new THREE.CircleGeometry(3.2, 24), lava(2.6), 0, 10, 8.15);
        mesh(new THREE.TorusGeometry(3.3, 0.45, 8, 24), trim, 0, 10, 8.2);
        flame(0, 8, 8.6, 4.5, 1.6, hot);
        anchors.mouth = new THREE.Vector3(0, 10, 9.4);
        light(0, 10, 12);
        // funnel stack
        mesh(new THREE.CylinderGeometry(1.5, 1.4, 4, 14), black, 0, 15.5, 4.6);
        mesh(new THREE.CylinderGeometry(2.6, 1.5, 2.6, 14), black, 0, 18.6, 4.6);
        anchors.smoke1 = new THREE.Vector3(0, 20.5, 4.6);
        // cab at the back
        mesh(new THREE.BoxGeometry(9.5, 8, 5.5), black, 0, 9.5, -9);
        mesh(new THREE.BoxGeometry(10.4, 0.7, 6.6), trim, 0, 13.8, -9);
        for (const sx of [-1, 1]) mesh(new THREE.PlaneGeometry(2.4, 2.4), glow(L.fire, 1.2), sx * 4.8, 10.5, -8).rotation.y = sx * Math.PI / 2;
        // wheels and rods
        for (const sx of [-1, 1]) {
          for (const z of [-4.5, 0, 4.5]) {
            const w = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.8, 20), black, sx * 4.4, 4.6, z);
            w.rotation.z = Math.PI / 2;
            mesh(new THREE.TorusGeometry(2.6, 0.25, 6, 20), trim, sx * 4.85, 4.6, z).rotation.y = Math.PI / 2;
          }
          mesh(new THREE.BoxGeometry(0.3, 0.6, 10), trim, sx * 5, 4.6, 0);
        }
        // cowcatcher
        const cc = mesh(new THREE.ConeGeometry(4.6, 3.5, 4, 1, false, Math.PI / 4), black, 0, 4, 9.2);
        cc.rotation.x = Math.PI / 2;
        cc.scale.set(1, 1, 0.5);
        if (s >= 3) {
          // steam dome and bell
          mesh(new THREE.SphereGeometry(1.8, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), trim, 0, 14, -1);
          mesh(new THREE.ConeGeometry(1, 1.6, 12, 1, true), trim, 0, 15, 1.8);
          anchors.steam = new THREE.Vector3(0, 16, -1);
        }
        if (s >= 5) {
          // headlamp and a second stack
          mesh(new THREE.CylinderGeometry(0.9, 1, 1.6, 12), trim, 0, 15, 7.2).rotation.x = Math.PI / 2;
          mesh(new THREE.CircleGeometry(0.75, 12), glow("#fff4c0", 3), 0, 15, 8.05);
          mesh(new THREE.CylinderGeometry(1, 1, 3, 12), black, 0, 15.5, -4);
          anchors.smoke2 = new THREE.Vector3(0, 17.2, -4);
        }
        if (s >= 6) for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.3, 2.2, 13), trim, sx * 4.6, 7, 0);
        return true;
      }

      // ---- a jade dragon rearing up, green fire in its jaws ----
      case "INFERNO_EMERALD": {
        // the whole dragon a size up, so it rears over its platform
        const dragon = new THREE.Group();
        PARENT.add(dragon);
        const outer = PARENT;
        PARENT = dragon;
        const DK = 1.3;
        dragon.scale.setScalar(DK);
        const lightsFrom = pointLights.length;
        const jadeT = stoneTex(251, "#4a8a5a", "#2a5a3a", "#143020", 6, 4);
        const jade = mat(jadeT, 1, 1, { rough: 0.35, metal: 0.15, bump: 0.8 });
        const gold = metal(L.brass, 0.3, 0.8);
        mesh(new THREE.CylinderGeometry(5.5, 6.5, 3, 10), mat(jadeT, 2, 0.5), 0, 4.5, -2);
        // the neck rising and arching forward
        const neckPts = [new THREE.Vector3(0, 5, -3), new THREE.Vector3(0, 11, -4.5), new THREE.Vector3(0, 17, -2.5), new THREE.Vector3(0, 19.5, 1.5)];
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neckPts), 24, 2.6, 14, false), jade);
        // head and snout
        const head = mesh(new THREE.SphereGeometry(3.6, 20, 16), jade, 0, 19.5, 2.2);
        head.scale.set(1, 0.85, 1.15);
        const snout = mesh(new THREE.BoxGeometry(3.6, 2.2, 5.5), jade, 0, 19.6, 6);
        void snout;
        const jaw = mesh(new THREE.BoxGeometry(3.2, 1.1, 5), jade, 0, 17.2, 5.5);
        jaw.rotation.x = 0.35;
        for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) mesh(new THREE.ConeGeometry(0.25, 0.9, 5), plainMat("#f0ecd8"), sx * 1.4, 18.2, 4.6 + i * 1.1).rotation.x = Math.PI;
        fireBall(0, 18.3, 8.4, 1.5, 5);
        anchors.mouth = new THREE.Vector3(0, 18.3, 9.6);
        light(0, 18, 11);
        for (const sx of [-1, 1]) {
          mesh(new THREE.SphereGeometry(0.6, 10, 8), glow(L.fire, 3), sx * 1.9, 20.8, 5.2);
          // horns swept back along the skull, a smaller pair below them
          tube([new THREE.Vector3(sx * 1.8, 21.4, 1.8), new THREE.Vector3(sx * 3.2, 22.6, -1.2), new THREE.Vector3(sx * 3.6, 23.2, -4.6)], 0.55, gold, 12);
          tube([new THREE.Vector3(sx * 2.4, 19.6, 2.2), new THREE.Vector3(sx * 3.8, 19.8, 0), new THREE.Vector3(sx * 4.4, 20.6, -2.2)], 0.32, gold, 10);
        }
        anchors.smoke1 = new THREE.Vector3(0, 21, 7.5);
        if (s >= 2) {
          // claws gripping the pedestal
          for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) mesh(new THREE.ConeGeometry(0.4, 2, 6), plainMat("#f0ecd8"), sx * (3 + k * 0.8), 6.5, 2.5 + k * 0.4).rotation.x = Math.PI / 2 + 0.6;
        }
        if (s >= 3) {
          // spines down the neck
          for (let i = 0; i < 7; i++) {
            const p = new THREE.CatmullRomCurve3(neckPts).getPoint(i / 7);
            mesh(new THREE.ConeGeometry(0.6, 2.4, 6), gold, p.x, p.y + 2.4, p.z - 1.6).rotation.x = -0.6;
          }
        }
        if (s >= 5) {
          // whiskers
          for (const sx of [-1, 1]) tube([new THREE.Vector3(sx * 1.6, 19.5, 8.6), new THREE.Vector3(sx * 4.5, 19, 9), new THREE.Vector3(sx * 6.5, 16, 7), new THREE.Vector3(sx * 7, 13, 5)], 0.18, gold, 16);
        }
        if (s >= 6) {
          // the dragon's pearl floating over its brow
          mesh(new THREE.SphereGeometry(1.5, 18, 14), plainMat("#f4fff0", { emissive: L.fire, ei: 0.8, rough: 0.1 }), 0, 26.5, 0);
          mesh(new THREE.TorusGeometry(2.2, 0.15, 6, 24), gold, 0, 26.5, 0);
        }
        // great jade wings spread from its shoulders, ribbed in gold
        const membrane = new THREE.MeshStandardMaterial({ color: "#3a8a52", emissive: L.fire, emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
        for (const sx of [-1, 1]) {
          const wing = new THREE.Group();
          wing.position.set(sx * 2.6, 13.5, -4.2);
          wing.rotation.set(-0.25, sx > 0 ? -0.35 : Math.PI + 0.35, 0.45);
          dragon.add(wing);
          const shape = new THREE.Shape();
          shape.moveTo(0, 0);
          shape.lineTo(5, 7.5);
          shape.lineTo(11, 9.5);
          shape.lineTo(13.5, 4);
          shape.quadraticCurveTo(11, 3.6, 10, 1.2);
          shape.quadraticCurveTo(8, 2.2, 6.6, -0.8);
          shape.quadraticCurveTo(4.6, 0.6, 3, -2.2);
          shape.lineTo(0, 0);
          mesh(new THREE.ShapeGeometry(shape, 12), membrane, 0, 0, 0, wing);
          for (const [x, y] of [[11, 9.5], [13.5, 4], [10, 1.2], [6.6, -0.8], [3, -2.2]] as const)
            mesh(new THREE.CylinderGeometry(0.16, 0.32, Math.hypot(x, y), 6), gold, x / 2, y / 2, 0.05, wing).rotation.z = Math.atan2(-x, y);
          mesh(new THREE.ConeGeometry(0.35, 1.6, 6), gold, 11, 10.4, 0, wing);
        }
        PARENT = outer;
        // its anchors and lights live in the turret's space: carry them up with the bigger dragon
        for (const k of ["mouth", "smoke1", "smoke2"]) if (anchors[k]) anchors[k]!.multiplyScalar(DK);
        for (let i = lightsFrom; i < pointLights.length; i++) pointLights[i]!.pos.multiplyScalar(DK);
        return true;
      }

      // ---- a giant bronze war-helmet, fire burning behind its visor ----
      case "INFERNO_GLADIATOR": {
        const bronze = metal(L.brass, 0.3, 0.85);
        const helm = mesh(new THREE.SphereGeometry(7.4, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze, 0, 10, 0);
        helm.scale.set(1.05, 1.08, 1.1);
        // cheek guards and the T-shaped face opening with the fire behind it
        for (const sx of [-1, 1]) {
          const g = mesh(new THREE.BoxGeometry(4, 7, 1.4), bronze, sx * 3.3, 6.4, 7.4);
          g.rotation.y = sx * -0.35;
        }
        mesh(new THREE.BoxGeometry(2.4, 6, 1), lava(2.8), 0, 6.6, 7.6);
        mesh(new THREE.BoxGeometry(8.4, 2, 1), lava(2.8), 0, 10.6, 7.9);
        mesh(new THREE.BoxGeometry(9.4, 0.8, 1.6), bronze, 0, 12, 8.1);
        mesh(new THREE.BoxGeometry(1.2, 4, 1.4), bronze, 0, 10.2, 8.6);
        flame(0, 4, 8.2, 5, 1.3, hot);
        anchors.mouth = new THREE.Vector3(0, 9, 8.2);
        light(0, 9, 10);
        // the red horsehair crest
        const crestM = plainMat("#a01818", { rough: 0.95 });
        for (let i = 0; i < 13; i++) {
          const a = -1.2 + i * 0.2;
          const c = mesh(new THREE.BoxGeometry(1.4, 3.4, 1.2), crestM, 0, 10 + Math.cos(a) * 9.4, Math.sin(a) * 9.4);
          c.rotation.x = a;
        }
        anchors.smoke1 = new THREE.Vector3(0, 21, -3);
        if (s >= 3) {
          // round shields propped against it
          for (const sx of [-1, 1]) {
            const sh = mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 24), bronze, sx * 9.4, 5.6, 1);
            sh.rotation.set(0, 0, sx * (Math.PI / 2 - 0.25));
            mesh(new THREE.SphereGeometry(0.9, 12, 8), metal(L.iron), sx * 9.9, 5.6, 1);
          }
        }
        if (s >= 5) {
          // crossed spears behind
          for (const sx of [-1, 1]) {
            const sp = mesh(new THREE.CylinderGeometry(0.25, 0.25, 24, 6), plainMat("#5a3a20"), 0, 14, -6);
            sp.rotation.z = sx * 0.6;
            mesh(new THREE.ConeGeometry(0.7, 3, 4), metal("#c8ccd0", 0.2, 0.9), Math.sin(sx * -0.6) * -13, 14 + Math.cos(0.6) * 13, -6).rotation.z = sx * 0.6;
          }
        }
        if (s >= 6) {
          // a laurel of gold round the brow
          for (let i = 0; i < 14; i++) {
            const a = Math.PI * 0.2 + (i / 13) * Math.PI * 0.6 + Math.PI;
            const l = mesh(new THREE.SphereGeometry(0.6, 8, 6), metal("#ffd060", 0.25, 0.9), Math.cos(a) * -7.6, 13.2, Math.sin(a) * -8.3);
            l.scale.set(1, 0.5, 1.6);
          }
        }
        return true;
      }

      // ---- a great trophy cup brimming with fire ----
      case "INFERNO_CHAMPION": {
        const gold = metal(L.brass, 0.18, 0.95);
        const marbleT = stoneTex(261, "#e8e0cc", "#b8b09c", "#8a826e", 3, 4);
        mesh(new THREE.BoxGeometry(11, 3, 11), mat(marbleT, 2, 0.6), 0, 4.5, 0);
        mesh(new THREE.BoxGeometry(8, 2, 8), mat(marbleT, 1.5, 0.4), 0, 7, 0);
        mesh(new THREE.BoxGeometry(11.4, 0.4, 11.4), gold, 0, 6, 0);
        const cup = mesh(new THREE.LatheGeometry([
          new THREE.Vector2(3.4, 8), new THREE.Vector2(2.6, 8.8), new THREE.Vector2(1, 10), new THREE.Vector2(1, 13), new THREE.Vector2(2.4, 13.6),
          new THREE.Vector2(4.8, 15.5), new THREE.Vector2(6.4, 18.5), new THREE.Vector2(7.2, 22), new THREE.Vector2(7.6, 22.4), new THREE.Vector2(7.2, 22.4),
        ], 36), gold, 0, 0, 0);
        (cup.material as THREE.Material).side = THREE.DoubleSide;
        for (const sx of [-1, 1]) {
          const h = mesh(new THREE.TorusGeometry(2.8, 0.55, 8, 20, Math.PI * 1.2), gold, sx * 7.6, 18.4, 0);
          h.rotation.z = sx > 0 ? -Math.PI * 0.6 : Math.PI * 0.4 + Math.PI;
        }
        fireBall(0, 21.6, 0, 5, 9);
        anchors.mouth = new THREE.Vector3(0, 22.5, 6.5);
        anchors.smoke1 = new THREE.Vector3(0, 28, 0);
        light(0, 23, 7);
        if (s >= 3) {
          // a laurel wreath hung on the cup
          const leaf = metal("#d8b040", 0.3, 0.8);
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const l = mesh(new THREE.SphereGeometry(0.7, 8, 6), leaf, Math.cos(a) * 5.3, 16.5, Math.sin(a) * 5.3);
            l.scale.set(0.6, 0.4, 1.4);
            l.rotation.y = -a;
          }
        }
        if (s >= 5) {
          // stars of victory at the plinth corners
          for (const [x, z] of [[-5.5, 5.5], [5.5, 5.5], [-5.5, -5.5], [5.5, -5.5]] as const) {
            const st = mesh(new THREE.OctahedronGeometry(1.2, 0), glow("#ffe9a0", 2), x, 8.5, z);
            st.scale.y = 1.6;
          }
        }
        if (s >= 6) {
          // a crown hovering over the flames
          mesh(new THREE.CylinderGeometry(3, 3, 1.6, 20, 1, true), gold, 0, 31, 0);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            mesh(new THREE.ConeGeometry(0.5, 1.8, 6), gold, Math.cos(a) * 3, 32.6, Math.sin(a) * 3);
          }
        }
        return true;
      }

      // ---- an obsidian rift: black blades round a hovering heart of fire ----
      case "INFERNO_LEGEND": {
        const obs = new THREE.MeshPhysicalMaterial({ color: "#14101a", roughness: 0.1, metalness: 0.3, clearcoat: 1, emissive: L.fire, emissiveIntensity: 0.06 });
        const n = s >= 3 ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.3;
          const len = 13 + r() * 9;
          crystal(len, 1.6 + r() * 1, obs, Math.cos(a) * 7, 2.8, Math.sin(a) * 7, Math.sin(a) * 0.22, -Math.cos(a) * 0.22);
          // a molten crack up each blade
          crystal(len * 0.8, 0.35, glow(L.fire, 2.4), Math.cos(a) * 7.6, 3, Math.sin(a) * 7.6, Math.sin(a) * 0.22, -Math.cos(a) * 0.22);
        }
        fireBall(0, 15, 0, 3.6, 7);
        const ring = (rad: number, y: number, tilt: number) => mesh(new THREE.TorusGeometry(rad, 0.3, 8, 48), glow("#ffc040", 2.4), 0, y, 0).rotation.set(Math.PI / 2 + tilt, 0, tilt * 0.5);
        ring(6, 15, 0.35);
        if (s >= 4) ring(7.5, 15, -0.5);
        anchors.mouth = new THREE.Vector3(0, 15, 4.5);
        anchors.smoke1 = new THREE.Vector3(0, 20, 0);
        light(0, 15, 6);
        if (s >= 5) {
          // shards hovering in orbit
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const sh = mesh(new THREE.OctahedronGeometry(0.9, 0), obs, Math.cos(a) * 10, 18 + (i % 2) * 3, Math.sin(a) * 10);
            sh.scale.y = 2;
          }
        }
        if (s >= 6) {
          mesh(new THREE.ConeGeometry(1.2, 8, 6), obs, 0, 25, 0);
          mesh(new THREE.ConeGeometry(0.4, 6, 6), glow(L.fire, 3), 0, 25, 0);
        }
        return true;
      }
    }
    return false;
  }

  function buildInferno() {
    const s = STAGE;
    const L = INF_LOOKS[LOOK] ?? INF_LOOKS[SKIN] ?? INF_LOOKS.base!;
    const iron = metalTex(71, L.iron, { rivets: true });
    const darkIron = metalTex(73, L.dark, { rivets: true });
    const brass = metalTex(75, L.brass, { rivets: true });
    const brick = stoneTex(77, L.brick[0], L.brick[1], L.brick[2], 6, 5, L.lavaBrick ? { runes: L.fire, runeRows: [1, 4] } : {});
    const metalM = (t: TexSet, rx = 1, ry = 1) => mat(t, rx, ry, { rough: 0.5, metal: 0.45 });
    const glowOrange = plainMat(L.fire, { emissive: L.fire, ei: 2.2 });

    // octagonal platform
    const plat = mesh(new THREE.CylinderGeometry(15, 15.6, 3, 8), [metalM(darkIron, 3, 0.4), metalM(darkIron, 2, 2), metalM(darkIron)], 0, 1.5, 0);
    plat.rotation.y = Math.PI / 8;
    // glowing vents on the platform rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8 + Math.PI / 8;
      const v = mesh(new THREE.BoxGeometry(4, 0.7, 0.3), s >= 6 ? plainMat(L.fire, { emissive: L.fire, ei: 3 }) : glowOrange, Math.cos(a) * 14.3, 1.6, Math.sin(a) * 14.3);
      v.rotation.y = -a + Math.PI / 2;
    }
    // Everything from the firebox up turns to face the target.
    PARENT = turret;
    if (infernoSkinBody(L, s)) {
      PARENT = root;
      for (const k of ["mouth", "smoke1", "smoke2", "steam", "vat1", "vat2"]) if (anchors[k]) turretAnchors.add(k);
      return;
    }
    // brick firebox base under the furnace
    mesh(new THREE.BoxGeometry(17, 4, 13), [mat(brick, 2, 0.6), mat(brick, 2, 0.6), mat(brick, 2, 2), mat(brick, 2, 2), mat(brick, 2, 0.6), mat(brick, 2, 0.6)], 0, 3, 0);
    // riveted furnace body: rounded box (cylinder lying sideways + box)
    const bodyMat = metalM(s >= 6 && SKIN === "base" ? brass : iron, 1.5, 1.2);
    mesh(new THREE.BoxGeometry(15, 10, 11), bodyMat, 0, 10, 0);
    const dome = mesh(new THREE.CylinderGeometry(5.5, 5.5, 15, 24, 1, false, 0, Math.PI), bodyMat, 0, 15, 0);
    dome.rotation.z = Math.PI / 2;
    // fire mouth on the front face
    // the round mouth is a drum of fire jutting from the furnace, open at the front like a
    // cauldron on its side: a sooty throat lit from within, a molten back wall, a bed of
    // coals and tongues of flame
    const FZ = 5.5, DEPTH = 3.8, MZ = FZ + DEPTH;
    anchors.mouth = new THREE.Vector3(0, 10.5, MZ + 0.4);
    const drum = mesh(new THREE.CylinderGeometry(4.6, 4.9, DEPTH, 32, 1, true), bodyMat, 0, 10.5, FZ + DEPTH / 2);
    drum.rotation.x = Math.PI / 2;
    const throatM = plainMat("#1a0a06", { emissive: L.fire, ei: 0.6, rough: 0.9 });
    throatM.side = THREE.BackSide;
    mesh(new THREE.CylinderGeometry(3.8, 3.8, DEPTH, 32, 1, true), throatM, 0, 10.5, FZ + DEPTH / 2).rotation.x = Math.PI / 2;
    const back = plainMat(L.fire, { emissive: L.fire, ei: 2.2, rough: 0.7 });
    back.emissiveMap = lavaTexture(L.fire);
    back.map = back.emissiveMap;
    mesh(new THREE.CircleGeometry(3.8, 32), back, 0, 10.5, FZ + 0.05);
    const fr = rng(41);
    const coalM = plainMat("#2a0e06", { emissive: L.fire, ei: 1.2, rough: 0.8 });
    for (let i = 0; i < 10; i++) {
      const c = mesh(new THREE.DodecahedronGeometry(0.6 + fr() * 0.45, 0), coalM, (fr() - 0.5) * 5, 7.5 + fr() * 0.5, FZ + 0.6 + fr() * (DEPTH - 1));
      c.rotation.set(fr() * 3, fr() * 3, fr() * 3);
    }
    const flameM = (col: string) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const x = (i / 6 - 0.5) * 5;
      const h = 3 + fr() * 2.6 - Math.abs(x) * 0.4;
      const f = mesh(new THREE.ConeGeometry(0.95 + fr() * 0.4, h, 7), flameM(i % 2 ? `#${new THREE.Color(L.fire).lerp(new THREE.Color("#fff0c0"), 0.4).getHexString()}` : L.fire), x, 7.6 + h / 2, FZ + 0.8 + fr() * (DEPTH - 1.6));
      f.rotation.z = (fr() - 0.5) * 0.3;
    }
    mesh(new THREE.ConeGeometry(1.5, 5, 8), flameM(`#${new THREE.Color(L.fire).lerp(new THREE.Color("#ffffff"), 0.6).getHexString()}`), 0, 10.2, FZ + DEPTH / 2);
    // the lip of the drum
    mesh(new THREE.TorusGeometry(4.5, 0.75, 10, 32), metalM(s >= 4 ? brass : darkIron), 0, 10.5, MZ);
    pointLights.push({ pos: new THREE.Vector3(0, 10.5, MZ + 4), color: L.fire, intensity: 380 + s * 60, dist: 40 });
    // rear chimney(s)
    const chH = s >= 3 ? 17 : 13;
    const ch = (x: number, h: number) => {
      mesh(new THREE.CylinderGeometry(1.9, 2.2, h, 14), metalM(darkIron, 1, 2), x, 10 + h / 2, -3.5);
      mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 14), metalM(s >= 4 ? brass : iron), x, 10 + h, -3.5);
      return new THREE.Vector3(x, 10 + h + 1, -3.5);
    };
    anchors.smoke1 = ch(4.6, chH);
    if (s >= 5) anchors.smoke2 = ch(-4.6, chH - 3);
    if (s >= 2) {
      // coal chute on the left side
      const chute = mesh(new THREE.BoxGeometry(3, 2.4, 7), metalM(iron), -9.5, 7, 1);
      chute.rotation.z = 0.5;
    }
    if (s >= 3) {
      // pressure pipes wrapping from the chimney into the body
      tube([new THREE.Vector3(4.6, 18, -3.5), new THREE.Vector3(7.6, 16, -1), new THREE.Vector3(8, 12, 2), new THREE.Vector3(7.6, 9, 4)], 0.6, metalM(s >= 4 ? brass : iron));
      mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.6, 16), metalM(brass), 7.9, 13, 3.2).rotation.x = Math.PI / 2;
    }
    if (s >= 4) {
      // brass studs framing the mouth
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        mesh(new THREE.SphereGeometry(0.45, 8, 6), metalM(brass), Math.cos(a) * 4.5, 10.5 + Math.sin(a) * 4.5, MZ + 0.7);
      }
    }
    if (s >= 5) {
      // bellows on the right
      const b = mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 6), plainMat("#5a3a22", { rough: 0.9 }), 9.8, 6.5, -1);
      b.rotation.z = Math.PI / 2;
    }
    if (s >= 6) {
      // gilded crown trim and lava rune plates
      mesh(new THREE.BoxGeometry(15.6, 0.8, 11.6), metalM(brass), 0, 15.2, 0);
      for (const x of [-5.5, 5.5]) mesh(new THREE.BoxGeometry(2.2, 3.4, 0.3), plainMat(L.fire, { emissive: L.fire, ei: 2.6 }), x, 10.5, 5.6);
    }
    // --- evolution: every stage visibly transforms the furnace ---
    if (s >= 2) {
      // riveted armour plates bolted over the brick firebox
      for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.5, 3.2, 11), metalM(darkIron, 1, 0.4), sx * 8.7, 3.2, 0);
    }
    if (s >= 3) {
      // glowing grilles along both flanks of the furnace
      for (const sx of [-1, 1]) {
        mesh(new THREE.BoxGeometry(0.3, 3.4, 6.4), glowOrange, sx * 7.55, 10, 0.5);
        for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.4, 3.8, 0.35), metalM(darkIron), sx * 7.7, 10, -2.2 + k * 1.35);
      }
    }
    if (s >= 4) {
      // iron horns curling up from the front corners
      for (const sx of [-1, 1]) {
        tube([new THREE.Vector3(sx * 6.6, 16, 4.6), new THREE.Vector3(sx * 8.4, 19.5, 5.4), new THREE.Vector3(sx * 8.2, 23, 3.4), new THREE.Vector3(sx * 6.6, 24.5, 1.4)], 0.7, metalM(s >= 6 ? brass : darkIron), 16);
      }
    }
    if (s >= 5) {
      // side burners: two small fire drums blazing on the flanks
      const fM = new THREE.MeshBasicMaterial({ color: L.fire, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const sx of [-1, 1]) {
        const d = mesh(new THREE.CylinderGeometry(2.2, 2.4, 2.4, 20, 1, true), metalM(s >= 6 ? brass : iron), sx * 9, 13.5, 2.5);
        d.rotation.z = Math.PI / 2;
        (d.material as THREE.Material).side = THREE.DoubleSide;
        mesh(new THREE.CircleGeometry(2, 20), plainMat(L.fire, { emissive: L.fire, ei: 2.4 }), sx * 8.6, 13.5, 2.5).rotation.y = sx * Math.PI / 2;
        const f = mesh(new THREE.ConeGeometry(1.2, 4, 8), fM, sx * 10.2, 13.8, 2.5);
        f.rotation.z = -sx * Math.PI / 2;
        anchors[sx < 0 ? "vat1" : "vat2"] ??= new THREE.Vector3(sx * 10.8, 13.5, 2.5);
      }
    }
    if (s >= 6) {
      // a crest of fire running along the top of the furnace
      const fM = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.fire).lerp(new THREE.Color("#fff0c0"), 0.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < 7; k++) {
        const x = -6 + k * 2;
        const h = 3.5 + (k % 2) * 1.5 - Math.abs(x) * 0.12;
        mesh(new THREE.ConeGeometry(0.9, h, 7), fM, x, 20.4 + h / 2, 0);
      }
      mesh(new THREE.BoxGeometry(14, 0.5, 1.4), plainMat(L.fire, { emissive: L.fire, ei: 2.6 }), 0, 20.5, 0);
    }
    infernoSignature({ s, iron, darkIron, brass, metalM });
    PARENT = root;
    for (const k of ["mouth", "smoke1", "smoke2", "steam", "vat1", "vat2"]) if (anchors[k]) turretAnchors.add(k);
  }

  // ---------------------------------------------------------------------------
  // STORMCALLER — round stone dais with glowing channels, a banded stone pillar
  // with a lightning inlay, a cradle of copper lightning rods holding the storm
  // orb. Arcs, the orb and discharges are live. Stages: 2 copper coil, 3 more
  // rods, 4 satellite orb (live), 5 tesla spikes on the dais, 6 storm crown.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // STORMCALLER (coil) — a storm engine: a round stone dais with glowing
  // channels, a column wound tight in copper and stacked with glass insulators,
  // and on top a polished ring (the great coil) holding the storm orb between
  // its lightning rods. The crown leans towards the target. Stages: 2 iron
  // struts brace the column, 3 more rods and lit insulators, 4 satellite orb,
  // 5 tesla spikes on the dais, 6 a second ring and floating storm-stones.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // STORMCALLER SKIN BODIES — every skin is its own lightning machine on the
  // round dais, not a recolour: a void monolith, a living thundercloud, a sky
  // lighthouse, a wizard's tower, a storm windmill, a golden lightning tree, a
  // jacob's ladder, a radio mast, a ruby geode, a bell tower, a shield-and-
  // spears trophy, a giant golden bolt, a skeletal claw. Lightning gathers in
  // `orb` and arcs from the `rodN` tips; every stage adds pieces.
  // ---------------------------------------------------------------------------
  function stormSkinBody(L: StormLook, s: number, daisStone: TexSet): boolean {
    // only the looks that still read as this tower's element get their own structure; the rest keep the standard tower
    if (!STORM_OWN.has(SKIN)) return false;
    const glow = (col: string, ei = 2.2) => plainMat(col, { emissive: col, ei, rough: 0.3 });
    const metal = (col: string, rough = 0.3, met = 0.8) => plainMat(col, { rough, metal: met });
    const orb = (x: number, y: number, z: number, rad = 3.2) => {
      mesh(new THREE.SphereGeometry(rad, 28, 20), plainMat(L.orb[0], { emissive: L.orb[1], ei: 0.95, rough: 0.2 }), x, y, z);
      anchors.orb = new THREE.Vector3(x, y, z);
      pointLights.push({ pos: new THREE.Vector3(x, y, z + 3), color: L.glow, intensity: 260 + s * 50, dist: 40 });
      if (s >= 4) anchors.satellite = new THREE.Vector3(x, y, z);
    };
    let rods = 0;
    const rod = (x: number, y: number, z: number) => {
      mesh(new THREE.SphereGeometry(0.55, 10, 8), glow(L.glow, 2), x, y, z);
      if (rods < 6) anchors[`rod${rods++}`] = new THREE.Vector3(x, y, z);
    };
    const st = (seed: number, rows = 4, cols = 4, runes = false) => mat(stoneTex(seed, L.pillar[0], L.pillar[1], L.pillar[2], rows, cols, runes ? { runes: L.glow, runeRows: [1, 3] } : {}), 1, 1, { emissiveColor: L.glow, emissiveIntensity: 2.2 });
    const r = rng(SKIN.length * 23 + 11);
    const spikes = () => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.6, 4, 6), metal(L.rod), Math.cos(a) * 12.5, 5, Math.sin(a) * 12.5);
        mesh(new THREE.SphereGeometry(0.5, 8, 6), glow(L.glow, 2), Math.cos(a) * 12.5, 7.3, Math.sin(a) * 12.5);
        anchors[`spike${i}`] = new THREE.Vector3(Math.cos(a) * 12.5, 7.3, Math.sin(a) * 12.5);
      }
    };

    switch (SKIN) {
      // ---- a black monolith with a void eye hanging over it, dark spires around ----
      case "STORMCALLER_VOID": {
        const obs = new THREE.MeshPhysicalMaterial({ color: "#0c0812", roughness: 0.08, metalness: 0.3, clearcoat: 1 });
        const mono = mesh(new THREE.BoxGeometry(5, 20, 3), obs, 0, 13, -1);
        mono.rotation.y = 0.15;
        mesh(new THREE.BoxGeometry(0.4, 18, 3.2), glow(L.glow, 2.4), 0, 13, -1);
        orb(0, 27, 0, 3.4);
        mesh(new THREE.TorusGeometry(5, 0.5, 8, 40), obs, 0, 27, 0);
        mesh(new THREE.TorusGeometry(5, 0.15, 6, 40), glow(L.glow, 3), 0, 27, 0.5);
        const n = s >= 3 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          const len = 9 + r() * 6;
          const sp = mesh(new THREE.ConeGeometry(1, len, 5), obs, Math.cos(a) * 9, 3 + len / 2, Math.sin(a) * 9);
          sp.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
          rod(Math.cos(a) * (9 + len * 0.25), 3 + len, Math.sin(a) * (9 + len * 0.25));
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(7.5, 0.2, 6, 48), glow(L.glow, 2.4), 0, 27, 0).rotation.x = 1.2;
        return true;
      }

      // ---- a living thundercloud boiling over a squat stone tower ----
      case "STORMCALLER_THUNDER": {
        mesh(new THREE.CylinderGeometry(3.6, 4.6, 12, 12), st(401, 4, 6, true), 0, 9, 0);
        mesh(new THREE.CylinderGeometry(5, 4, 1.6, 12), metal(L.band, 0.5, 0.6), 0, 15.6, 0);
        // Tempestade Rubra (bundle skin): a blood-red stormcloud lit from within
        const rubra = LOOK === "STORMCALLER_PACK_CRIMSON_STORM";
        const cloudM = rubra ? plainMat("#7a141c", { rough: 0.9, emissive: "#c0101e", ei: 0.35 }) : plainMat("#5a6878", { rough: 1, emissive: L.glow, ei: 0.08 });
        const darkM = rubra ? plainMat("#24070a", { rough: 0.95, emissive: "#5a0a10", ei: 0.25 }) : plainMat("#3a4450", { rough: 1 });
        const puffs = s >= 4 ? 16 : 11;
        for (let i = 0; i < puffs; i++) {
          const a = (i / puffs) * Math.PI * 2 + r();
          const d = 3 + r() * 6;
          mesh(new THREE.SphereGeometry(3 + r() * 2.6, 14, 10), i % 3 ? cloudM : darkM, Math.cos(a) * d, 23 + r() * 3, Math.sin(a) * d * 0.8);
        }
        orb(0, 21, 3.5, 2.6);
        // rain of light falling from the cloud
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.6;
          rod(Math.cos(a) * 7, 19.5, Math.sin(a) * 6);
        }
        if (s >= 3) for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), glow(L.glow, 1.6), (r() - 0.5) * 14, 14, (r() - 0.5) * 10);
        if (s >= 5) spikes();
        if (s >= 6) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          mesh(new THREE.SphereGeometry(2, 12, 8), cloudM, Math.cos(a) * 11, 28 + r() * 2, Math.sin(a) * 9);
        }
        return true;
      }

      // ---- a white sky-lighthouse with a golden lantern room holding the storm ----
      case "STORMCALLER_CELESTIAL": {
        const white = plainMat(L.pillar[0], { rough: 0.45 });
        const gold = metal(L.rod, 0.25, 0.9);
        const tower = mesh(new THREE.CylinderGeometry(3.2, 5, 18, 20), white, 0, 12, 0);
        void tower;
        for (const y of [7, 12, 17]) mesh(new THREE.TorusGeometry(4.6 - (y - 3) * 0.1, 0.35, 8, 32), gold, 0, y, 0).rotation.x = Math.PI / 2;
        mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.8, 20), gold, 0, 21.4, 0);
        // gallery rail
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 4), gold, Math.cos(a) * 5, 22.6, Math.sin(a) * 5);
        }
        mesh(new THREE.CylinderGeometry(3.6, 3.6, 6, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: "#fff8e0", transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }), 0, 25, 0);
        orb(0, 25, 0, 2.6);
        mesh(new THREE.ConeGeometry(4.2, 4, 12), gold, 0, 30, 0);
        rod(0, 33, 0);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          rod(Math.cos(a) * 5, 23.6, Math.sin(a) * 5);
        }
        if (s >= 3) for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
          const f = mesh(new THREE.BoxGeometry(1.3, 8 - k, 0.3), white, sx * (4.5 + k * 1.2), 18 + k * 0.5, -1.5);
          f.rotation.z = -sx * (0.9 + k * 0.15);
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), glow("#fff4c8", 2.4), 0, 36, 0).rotation.x = Math.PI / 2;
        return true;
      }

      // ---- a slender wizard's tower with a crooked purple roof and floating tomes ----
      case "STORMCALLER_ARCANE": {
        const stoneM = st(411, 8, 4);
        mesh(new THREE.CylinderGeometry(3, 4.2, 17, 14), stoneM, 0, 11.5, 0);
        // windows glowing
        for (const [y, a] of [[8, 0.3], [13, 2.4], [16, 4.4]] as const) mesh(new THREE.BoxGeometry(1, 1.8, 0.4), glow(L.glow, 2.4), Math.sin(a) * 3.6, y, Math.cos(a) * 3.6).rotation.y = a;
        mesh(new THREE.CylinderGeometry(4.4, 4.4, 1, 14), metal(L.band, 0.5, 0.5), 0, 20.5, 0);
        const roof = mesh(new THREE.ConeGeometry(5, 10, 14), plainMat(L.dais[0], { rough: 0.8 }), 0, 26, 0);
        roof.rotation.z = 0.12;
        mesh(new THREE.ConeGeometry(1.6, 4, 10), plainMat(L.dais[0], { rough: 0.8 }), -1.2, 31.6, 0).rotation.z = 0.45;
        orb(-2.6, 34, 0, 2.2);
        rod(-2.6, 34, 0);
        // floating spell books
        const n = s >= 3 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const b = mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), plainMat(i % 2 ? "#6a1a3a" : "#1a2a6a", { rough: 0.8 }), Math.cos(a) * 8, 16 + (i % 2) * 4, Math.sin(a) * 8);
          b.rotation.set(r(), a, r() * 0.5);
          rod(Math.cos(a) * 8, 17 + (i % 2) * 4, Math.sin(a) * 8);
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(6, 0.2, 6, 40), glow(L.glow, 2.4), 0, 20.5, 0).rotation.x = Math.PI / 2;
        return true;
      }

      // ---- a storm windmill: a tower with great sails spinning the storm at its hub ----
      case "STORMCALLER_TEMPEST": {
        mesh(new THREE.CylinderGeometry(2.8, 4.6, 18, 8), st(421, 6, 6), 0, 12, -1);
        mesh(new THREE.ConeGeometry(4, 4, 8), plainMat(L.band, { rough: 0.6 }), 0, 23, -1);
        orb(0, 19, 3.6, 2);
        const sailM = plainMat("#e8f4ee", { rough: 0.8, emissive: L.glow, ei: 0.1 });
        const blades = s >= 4 ? 6 : 4;
        for (let i = 0; i < blades; i++) {
          const a = (i / blades) * Math.PI * 2 + 0.3;
          const arm = mesh(new THREE.BoxGeometry(0.5, 12, 0.5), metal(L.rod, 0.4, 0.6), Math.cos(a) * 6, 19 + Math.sin(a) * 6, 4);
          arm.rotation.z = a - Math.PI / 2;
          const sail = mesh(new THREE.BoxGeometry(2.8, 9, 0.15), sailM, Math.cos(a) * 7 + Math.cos(a + Math.PI / 2) * 1.6, 19 + Math.sin(a) * 7 + Math.sin(a + Math.PI / 2) * 1.6, 4.1);
          sail.rotation.z = a - Math.PI / 2;
          rod(Math.cos(a) * 12, 19 + Math.sin(a) * 12, 4);
        }
        // wind trails curling round the tower
        const windM = new THREE.MeshBasicMaterial({ color: L.glow, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
        for (let k = 0; k < (s >= 3 ? 3 : 2); k++) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 24; i++) {
            const t = i / 24, a = t * Math.PI * 3 + k * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * (6 + t * 2), 4 + t * 16, Math.sin(a) * (6 + t * 2)));
          }
          tube(pts, 0.22, windM, 60);
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(13, 0.3, 6, 48), glow(L.glow, 2), 0, 19, 4);
        return true;
      }

      // ---- a tree of gold whose branches end in crackling sparks ----
      case "STORMCALLER_PRESTIGE_ASCENDANT": {
        const gold = metal(L.rod, 0.22, 0.95);
        tube([new THREE.Vector3(0, 3, 0), new THREE.Vector3(0.8, 10, 0), new THREE.Vector3(-0.6, 16, 0), new THREE.Vector3(0, 20, 0)], 1.8, gold, 16);
        const branches = s >= 3 ? 7 : 5;
        for (let i = 0; i < branches; i++) {
          const a = (i / branches) * Math.PI * 2 + 0.2;
          const y0 = 14 + (i % 3) * 2;
          const end = new THREE.Vector3(Math.cos(a) * (8 + r() * 2), y0 + 6 + r() * 3, Math.sin(a) * (8 + r() * 2));
          tube([new THREE.Vector3(0, y0, 0), new THREE.Vector3(Math.cos(a) * 4, y0 + 3, Math.sin(a) * 4), end], 0.55, gold, 12);
          rod(end.x, end.y, end.z);
        }
        // golden roots
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          tube([new THREE.Vector3(0, 5, 0), new THREE.Vector3(Math.cos(a) * 5, 3.4, Math.sin(a) * 5), new THREE.Vector3(Math.cos(a) * 9, 3.1, Math.sin(a) * 9)], 0.7, gold, 10);
        }
        orb(0, 23, 0, 3.4);
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(5, 0.3, 8, 40), glow("#fff0b0", 2.4), 0, 28.5, 0).rotation.x = Math.PI / 2 - 0.3;
        return true;
      }

      // ---- a jacob's ladder: two tall copper horns over a transformer, the spark climbing between them ----
      case "STORMCALLER_COPPER": {
        const cu = metal(L.rod, 0.3, 0.9);
        mesh(new THREE.BoxGeometry(9, 6, 6), metal(L.band, 0.5, 0.6), 0, 6, 0);
        for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(9.4, 0.4, 0.5), cu, 0, 3.6 + i * 0.9, 3.1);
        for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(1.2, 1.4, 2, 12), plainMat("#e8e4d8", { rough: 0.3 }), sx * 2.4, 10, 0);
          tube([new THREE.Vector3(sx * 2.4, 11, 0), new THREE.Vector3(sx * 2.2, 16, 0), new THREE.Vector3(sx * 4.4, 23, 0), new THREE.Vector3(sx * 6.8, 29, 0)], 0.45, cu, 20);
          rod(sx * 6.8, 29, 0);
          rod(sx * 3.4, 20, 0);
        }
        orb(0, 15, 0, 1.8);
        // coils on the transformer sides
        for (const sx of [-1, 1]) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 60; i++) {
            const t = i / 60, a = t * Math.PI * 14;
            pts.push(new THREE.Vector3(sx * (5.6 + Math.cos(a) * 1.2), 3.5 + t * 5, Math.sin(a) * 1.2));
          }
          tube(pts, 0.18, cu, 200);
        }
        if (s >= 3) for (const sx of [-1, 1]) {
          mesh(new THREE.CylinderGeometry(1.4, 1.4, 4, 16), new THREE.MeshPhysicalMaterial({ color: L.orb[0], transparent: true, opacity: 0.4, roughness: 0.05, depthWrite: false }), sx * 9.5, 5, 5);
          mesh(new THREE.SphereGeometry(0.6, 10, 8), glow(L.glow, 2.4), sx * 9.5, 5, 5);
        }
        if (s >= 5) spikes();
        if (s >= 6) for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(1.2, 14, 10), cu, sx * 6.8, 29, 0);
        return true;
      }

      // ---- a steel lattice radio mast with dishes, the storm caught at its tip ----
      case "STORMCALLER_SLATE": {
        const steel = metal(L.rod, 0.4, 0.8);
        const H = s >= 4 ? 30 : 26;
        const leg = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          tube([leg(a).multiplyScalar(7).setY(3), leg(a).multiplyScalar(1.2).setY(3 + H)], 0.35, steel, 4);
        }
        // cross bracing
        for (let k = 0; k < 6; k++) {
          const y0 = 3 + (k / 6) * H, y1 = 3 + ((k + 1) / 6) * H;
          const w0 = 7 - (k / 6) * 5.8, w1 = 7 - ((k + 1) / 6) * 5.8;
          for (let i = 0; i < 4; i++) {
            const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4, a1 = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
            tube([leg(a0).multiplyScalar(w0).setY(y0), leg(a1).multiplyScalar(w1).setY(y1)], 0.15, steel, 2);
          }
        }
        orb(0, 3 + H + 2.4, 0, 2.4);
        rod(0, 3 + H + 6, 0);
        mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 6), steel, 0, 3 + H + 4, 0);
        // dishes
        const dishes = s >= 3 ? 3 : 2;
        for (let i = 0; i < dishes; i++) {
          const a = (i / dishes) * Math.PI * 2 + 0.6;
          const y = 3 + H * (0.45 + i * 0.15);
          const w = 7 - (y - 3) / H * 5.8;
          const d = mesh(new THREE.SphereGeometry(2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), plainMat("#d8dce0", { rough: 0.4, metal: 0.3 }), Math.cos(a) * (w + 1.5), y, Math.sin(a) * (w + 1.5));
          d.lookAt(Math.cos(a) * 30, y + 6, Math.sin(a) * 30);
          d.rotateX(Math.PI / 2);
          (d.material as THREE.Material).side = THREE.DoubleSide;
          rod(Math.cos(a) * (w + 3), y + 1, Math.sin(a) * (w + 3));
        }
        // warning lights
        for (const y of [0.33, 0.66]) mesh(new THREE.SphereGeometry(0.5, 8, 6), glow("#ff3a2a", 2.4), 0, 3 + H * y, 7 - y * 5.8);
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(4, 0.25, 6, 32), glow(L.glow, 2.4), 0, 3 + H + 2.4, 0).rotation.x = Math.PI / 2;
        return true;
      }

      // ---- a split-open geode bristling with ruby crystals, the storm in its heart ----
      case "STORMCALLER_RUBY": {
        const rock = st(431, 5, 6);
        const ruby = new THREE.MeshPhysicalMaterial({ color: L.orb[0], emissive: L.orb[1], emissiveIntensity: 0.5, roughness: 0.08, transparent: true, opacity: 0.88, clearcoat: 1 });
        // a broken rock pile with great ruby crystals bursting out of it
        const pile = mesh(new THREE.DodecahedronGeometry(7, 1), rock, 0, 5, 0);
        pile.scale.set(1.2, 0.6, 1);
        const n = s >= 4 ? 11 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r() * 0.3;
          const tilt = 0.35 + r() * 0.35;
          crystal(8 + r() * 7, 1.3 + r() * 0.8, ruby, Math.cos(a) * 2.5, 7, Math.sin(a) * 2.5, Math.sin(a) * tilt, -Math.cos(a) * tilt);
        }
        crystal(14, 2, ruby, 0, 7, -1.5, -0.12, 0);
        orb(0, 15, 3.5, 2.6);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          rod(Math.cos(a) * 9, 16 + (i % 2) * 3, Math.sin(a) * 9);
        }
        if (s >= 3) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          crystal(5 + r() * 3, 1, ruby, Math.cos(a) * 12, 2.5, Math.sin(a) * 12, Math.sin(a) * 0.4, -Math.cos(a) * 0.4);
        }
        if (s >= 5) spikes();
        if (s >= 6) for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const m = mesh(new THREE.OctahedronGeometry(1.2, 0), ruby, Math.cos(a) * 7, 25 + (i % 2) * 2, Math.sin(a) * 7);
          m.scale.y = 2;
        }
        return true;
      }

      // ---- a bell tower: a great bronze bell under an arch, ringing with lightning ----
      case "STORMCALLER_SUNSTORM": {
        const stoneM = st(441, 6, 4, true);
        for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(3, 22, 3), stoneM, sx * 7, 14, 0);
        const arch = mesh(new THREE.TorusGeometry(7, 1.5, 10, 32, Math.PI), stoneM, 0, 25, 0);
        void arch;
        mesh(new THREE.BoxGeometry(17, 1.4, 4), stoneM, 0, 25, 0);
        const bronze = metal(L.rod, 0.3, 0.85);
        const bell = mesh(new THREE.LatheGeometry([new THREE.Vector2(0.5, 0), new THREE.Vector2(2, -0.4), new THREE.Vector2(3, -2.5), new THREE.Vector2(3.6, -6), new THREE.Vector2(4.8, -8.4), new THREE.Vector2(5, -8.8)], 28), bronze, 0, 24, 0);
        (bell.material as THREE.Material).side = THREE.DoubleSide;
        orb(0, 16.5, 0, 1.8);
        rod(0, 32.5, 0);
        mesh(new THREE.ConeGeometry(1.6, 4, 8), stoneM, 0, 30.6, 0);
        for (const sx of [-1, 1]) rod(sx * 7, 26.5, 0);
        if (s >= 3) for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const ray = mesh(new THREE.ConeGeometry(0.4, 3, 6), glow("#ffd84a", 1.8), Math.cos(a) * 11, 25 + Math.sin(a) * 11, -1);
          ray.rotation.z = a - Math.PI / 2;
        }
        if (s >= 4) for (const sx of [-1, 1]) {
          mesh(new THREE.LatheGeometry([new THREE.Vector2(0.3, 0), new THREE.Vector2(1.4, -1.5), new THREE.Vector2(2, -4), new THREE.Vector2(2.4, -4.4)], 20), bronze, sx * 11, 12, 3);
          tube([new THREE.Vector3(sx * 8.5, 14, 0), new THREE.Vector3(sx * 11, 14, 3)], 0.3, bronze, 3);
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(11, 0.25, 6, 48, Math.PI), glow("#ffd84a", 2.4), 0, 25, -1);
        return true;
      }

      // ---- a war trophy: a great round shield on crossed spears, the storm at its boss ----
      case "STORMCALLER_GLADIATOR": {
        const bronze = metal(L.rod, 0.3, 0.85);
        const wood = plainMat("#5a3a20", { rough: 0.9 });
        for (const sx of [-1, 1]) {
          const sp = mesh(new THREE.CylinderGeometry(0.35, 0.35, 28, 8), wood, 0, 16, -1.5);
          sp.rotation.z = sx * 0.5;
          const tip = new THREE.Vector3(-Math.sin(sx * 0.5) * 14.5, 16 + Math.cos(0.5) * 14.5, -1.5);
          mesh(new THREE.ConeGeometry(0.9, 3.4, 4), metal("#c8ccd0", 0.2, 0.9), tip.x, tip.y, tip.z).rotation.z = sx * 0.5;
          rod(tip.x - Math.sin(sx * 0.5) * 2, tip.y + 1.8, tip.z);
        }
        const sh = mesh(new THREE.CylinderGeometry(7.5, 7.5, 1, 36), bronze, 0, 15, 0);
        sh.rotation.x = Math.PI / 2;
        mesh(new THREE.TorusGeometry(7.5, 0.6, 8, 40), metal(L.band, 0.4, 0.6), 0, 15, 0.2);
        mesh(new THREE.TorusGeometry(4.5, 0.3, 8, 36), metal(L.band, 0.4, 0.6), 0, 15, 0.6);
        orb(0, 15, 1.6, 2.2);
        // a red crest along the top
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.25 + i * 0.0625);
          mesh(new THREE.BoxGeometry(1.2, 2.4, 1), plainMat("#a01818", { rough: 0.95 }), Math.cos(a) * 8.6, 15 + Math.sin(a) * 8.6, 0).rotation.z = a - Math.PI / 2;
        }
        if (s >= 3) for (const sx of [-1, 1]) {
          const helm = mesh(new THREE.SphereGeometry(2.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), bronze, sx * 10, 4.2, 4);
          void helm;
        }
        if (s >= 5) spikes();
        if (s >= 6) for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          mesh(new THREE.ConeGeometry(0.4, 2, 6), bronze, Math.cos(a) * 8.6, 15 + Math.sin(a) * 8.6, 0.2).rotation.z = a - Math.PI / 2;
        }
        return true;
      }

      // ---- a giant golden lightning bolt standing on a winner's podium ----
      case "STORMCALLER_CHAMPION": {
        const gold = metal(L.rod, 0.18, 0.95);
        const marble = mat(stoneTex(451, L.pillar[0], L.pillar[1], L.pillar[2], 3, 4), 1, 1, { rough: 0.4 });
        mesh(new THREE.BoxGeometry(7, 5, 7), marble, 0, 5.5, 0);
        mesh(new THREE.BoxGeometry(7.4, 0.5, 7.4), gold, 0, 8.2, 0);
        // zig-zag bolt built from three slanted slabs
        const segs: [number, number, number, number][] = [[1.5, 12, -0.5, 7], [-1, 17.5, 0.6, 6], [1.2, 23.5, -0.5, 7]];
        for (const [x, y, rz, len] of segs) mesh(new THREE.BoxGeometry(2.6, len, 1.4), gold, x, y, 0).rotation.z = rz;
        mesh(new THREE.ConeGeometry(1.6, 4, 4), gold, 2.4, 28.5, 0).rotation.z = -0.4;
        orb(0, 32, 0, 2.4);
        rod(3, 30.5, 0);
        for (const sx of [-1, 1]) rod(sx * 3.5, 9, 3.5);
        if (s >= 3) for (const sx of [-1, 1]) {
          mesh(new THREE.BoxGeometry(4, 3, 5), marble, sx * 6, 4.5, 0.5);
          mesh(new THREE.OctahedronGeometry(1, 0), glow("#fff0b0", 2), sx * 6, 7, 0.5).scale.y = 1.6;
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(5, 0.3, 8, 40), glow("#fff0b0", 2.4), 0, 32, 0).rotation.x = Math.PI / 2 - 0.2;
        return true;
      }

      // ---- a skeletal dragon claw bursting from the ground, clutching the storm ----
      case "STORMCALLER_LEGEND": {
        const bone = plainMat("#d8ccb4", { rough: 0.7, emissive: L.glow, ei: 0.05 });
        const dark = plainMat(L.pillar[2], { rough: 0.9 });
        // forearm rising from a crack in the dais
        mesh(new THREE.CylinderGeometry(6, 6, 0.4, 20), glow(L.glow, 1.4), 0, 3.1, 0);
        tube([new THREE.Vector3(0, 2, 0), new THREE.Vector3(0.6, 8, 0), new THREE.Vector3(0, 14, 0.4)], 1.6, bone, 12);
        tube([new THREE.Vector3(1.4, 2, 0.6), new THREE.Vector3(1.8, 8, 0.4), new THREE.Vector3(1, 14, 0.4)], 0.9, bone, 12);
        mesh(new THREE.SphereGeometry(2.6, 14, 10), bone, 0.2, 15, 0.3);
        // five clawed fingers curling up round the orb
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          const p0 = new THREE.Vector3(Math.cos(a) * 2, 16, Math.sin(a) * 2);
          const p1 = new THREE.Vector3(Math.cos(a) * 6, 20, Math.sin(a) * 6);
          const p2 = new THREE.Vector3(Math.cos(a) * 5.4, 26, Math.sin(a) * 5.4);
          const p3 = new THREE.Vector3(Math.cos(a) * 2.6, 29, Math.sin(a) * 2.6);
          tube([p0, p1, p2, p3], 0.65, bone, 16);
          for (const p of [p1, p2]) mesh(new THREE.SphereGeometry(0.9, 10, 8), bone, p.x, p.y, p.z);
          const c = mesh(new THREE.ConeGeometry(0.55, 2.4, 6), dark, p3.x * 0.8, p3.y + 0.6, p3.z * 0.8);
          c.lookAt(0, 23, 0);
          c.rotateX(Math.PI / 2);
          rod(p3.x * 0.7, p3.y + 0.8, p3.z * 0.7);
        }
        orb(0, 23, 0, 3);
        if (s >= 3) for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + r();
          const rib = mesh(new THREE.TorusGeometry(3, 0.35, 6, 16, Math.PI), bone, Math.cos(a) * 10, 3, Math.sin(a) * 10);
          rib.rotation.y = -a;
        }
        if (s >= 5) spikes();
        if (s >= 6) mesh(new THREE.TorusGeometry(7, 0.3, 6, 40), glow(L.glow, 2.4), 0, 23, 0).rotation.x = Math.PI / 2 - 0.3;
        return true;
      }
    }
    return false;
  }

  function buildStormcallerCoil() {
    const s = STAGE;
    const L = STORM_LOOKS[LOOK] ?? STORM_LOOKS[SKIN] ?? STORM_LOOKS.base!;
    const daisStone = stoneTex(81, L.dais[0], L.dais[1], L.dais[2], 3, 8);
    const flag = flagTex(85, L.dais[0], L.dais[1], L.dais[2]);
    const copper = metalTex(87, L.rod, { rivets: false });
    const dark = metalTex(89, L.band, { rivets: true });
    const metalM = (t: TexSet, rx = 1, ry = 1) => mat(t, rx, ry, { rough: 0.35, metal: 0.6 });
    const violet = plainMat(L.glow, { emissive: L.glow, ei: 1.4 });
    const glass = new THREE.MeshPhysicalMaterial({ color: L.orb[0], emissive: L.glow, emissiveIntensity: s >= 3 ? 0.9 : 0.25, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 });
    const topM = mat(flag, 1, 1);

    // dais
    mesh(new THREE.CylinderGeometry(14.5, 15.2, 3, 32), [mat(daisStone, 4, 0.6), topM, topM], 0, 1.5, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const c = mesh(new THREE.BoxGeometry(6, 0.25, 0.5), violet, Math.cos(a) * 9.5, 3.05, Math.sin(a) * 9.5);
      c.rotation.y = -a;
    }
    mesh(new THREE.CylinderGeometry(6.6, 7.4, 3, 8), [mat(daisStone, 2, 0.4), topM, topM], 0, 4.5, 0);
    mesh(new THREE.TorusGeometry(6.8, 0.4, 8, 8), metalM(dark, 3, 0.3), 0, 6, 0).rotation.x = Math.PI / 2;
    if (stormSkinBody(L, s, daisStone)) return;

    // the column: a dark core wound tight in copper, stacked with insulators
    const base = 6;
    const PH = s >= 5 ? 25 : 21;
    mesh(new THREE.CylinderGeometry(2.6, 3.2, PH, 16), metalM(dark, 1, 3), 0, base + PH / 2, 0);
    const pts: THREE.Vector3[] = [];
    const turns = 22;
    for (let i = 0; i <= turns * 16; i++) {
      const t = i / (turns * 16);
      const a = t * Math.PI * 2 * turns;
      const rr = 3.25 - t * 0.55;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, base + 2 + t * (PH - 5), Math.sin(a) * rr));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, 0.3, 6, false), metalM(copper, 8, 1));
    for (const f of [0.12, 0.55, 0.92]) {
      const y = base + PH * f;
      const rr = 3.2 - f * 0.6;
      for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(rr + 1.6 - k * 0.3, rr + 1.8 - k * 0.3, 0.45, 20), glass, 0, y - 0.8 + k * 0.7, 0);
    }
    if (s >= 2) {
      // iron struts bracing the column
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        tube([new THREE.Vector3(Math.cos(a) * 11.5, 3, Math.sin(a) * 11.5), new THREE.Vector3(Math.cos(a) * 7, 9, Math.sin(a) * 7), new THREE.Vector3(Math.cos(a) * 3.4, base + PH * 0.55, Math.sin(a) * 3.4)], 0.45, metalM(dark), 10);
        mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), metalM(dark), Math.cos(a) * 11.5, 3.2, Math.sin(a) * 11.5);
      }
    }
    const topY = base + PH;
    if (s >= 3) {
      // glass storm jars on the dais, each holding a caged spark
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const x = Math.cos(a) * 10.6, z = Math.sin(a) * 10.6;
        mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 16), glass, x, 5, z);
        mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.6, 16), metalM(copper), x, 7.2, z);
        mesh(new THREE.SphereGeometry(0.7, 10, 8), violet, x, 5, z);
        mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6), metalM(copper), x, 8.6, z);
      }
    }

    // the crown — collar, the great coil ring, the orb and its lightning rods — leans towards the target
    PARENT = turret;
    TURRET_MODE = "tilt";
    TURRET_PIVOT_Y = topY;
    mesh(new THREE.CylinderGeometry(3.6, 2.8, 2.2, 16), metalM(dark), 0, topY + 1.1, 0);
    const ringM = plainMat(L.rod, { metal: 0.85, rough: 0.22 });
    mesh(new THREE.TorusGeometry(6.2, 1.7, 16, 40), ringM, 0, topY + 3.4, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(6.2, 0.35, 8, 40), violet, 0, topY + 3.4, 0).rotation.x = Math.PI / 2;
    if (s >= 4) {
      // spikes radiating out from the great ring
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const sp = mesh(new THREE.ConeGeometry(0.45, 2.6, 6), metalM(copper), Math.cos(a) * 8.6, topY + 3.4, Math.sin(a) * 8.6);
        sp.rotation.set(0, 0, 0);
        sp.lookAt(Math.cos(a) * 20, topY + 3.4, Math.sin(a) * 20);
        sp.rotateX(Math.PI / 2);
      }
    }
    if (s >= 6) {
      mesh(new THREE.TorusGeometry(4.2, 1.1, 14, 32), ringM, 0, topY + 9.8, 0).rotation.x = Math.PI / 2;
    }
    anchors.orb = new THREE.Vector3(0, topY + 6.8, 0);
    mesh(new THREE.SphereGeometry(3.4, 28, 20), plainMat(L.orb[0], { emissive: L.orb[1], ei: 0.9, rough: 0.2 }), 0, topY + 6.8, 0);
    const rods = s >= 6 ? 6 : s >= 3 ? 5 : 3;
    for (let i = 0; i < rods; i++) {
      const a = (i / rods) * Math.PI * 2 + 0.5;
      const tall = s >= 6 ? 14 : 11;
      tube([new THREE.Vector3(Math.cos(a) * 6.2, topY + 4.6, Math.sin(a) * 6.2), new THREE.Vector3(Math.cos(a) * 6.8, topY + 8, Math.sin(a) * 6.8), new THREE.Vector3(Math.cos(a) * 5.6, topY + tall, Math.sin(a) * 5.6)], 0.34, metalM(copper));
      mesh(new THREE.SphereGeometry(0.6, 8, 6), violet, Math.cos(a) * 5.6, topY + tall, Math.sin(a) * 5.6);
      anchors[`rod${i}`] = new THREE.Vector3(Math.cos(a) * 5.6, topY + tall, Math.sin(a) * 5.6);
    }
    PARENT = root;
    pointLights.push({ pos: new THREE.Vector3(0, topY + 6.8, 4), color: L.glow, intensity: 260 + s * 50, dist: 40 });
    pointLights.push({ pos: new THREE.Vector3(0, 4, 8), color: L.glow, intensity: 90, dist: 22 });
    if (s >= 4) anchors.satellite = new THREE.Vector3(0, topY + 6.8, 0);
    if (s >= 5) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.7, 5, 6), metalM(copper), Math.cos(a) * 12.5, 5.5, Math.sin(a) * 12.5);
        mesh(new THREE.SphereGeometry(0.55, 8, 6), violet, Math.cos(a) * 12.5, 8.2, Math.sin(a) * 12.5);
        anchors[`spike${i}`] = new THREE.Vector3(Math.cos(a) * 12.5, 8.2, Math.sin(a) * 12.5);
      }
    }
    if (s >= 6) {
      PARENT = turret;
      const r = rng(91);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const st = mesh(new THREE.DodecahedronGeometry(1.2 + r() * 0.6, 0), mat(daisStone, 0.3, 0.3), Math.cos(a) * 9, topY + 14 + r() * 2, Math.sin(a) * 9);
        st.rotation.set(r() * 3, r() * 3, r() * 3);
      }
      PARENT = root;
    }
    stormSignature({ s, topY, PH, copper, dark, metalM, pillarStone: daisStone });
    for (const k of ["orb", "satellite", "rod0", "rod1", "rod2", "rod3", "rod4", "rod5"]) if (anchors[k]) turretAnchors.add(k);
  }

  function buildStormcaller() {
    buildStormcallerCoil();
  }

  // ---------------------------------------------------------------------------
  // TORRES DE FUSÃO — the absorbed element, built onto the tower: a ring of
  // its colour round the foot, a stone pillar at the tower's shoulder and on
  // it that element's living core (a brazier of fire, a cluster of ice, a
  // caged storm orb, or a rack of glowing arrows). `fusion` is where the
  // game keeps its flames / frost / sparks going.
  // ---------------------------------------------------------------------------
  function buildFusionCore(F: string) {
    const col = ({ IRONWOOD: "#ffd27a", INFERNO: "#ff7a2a", FROSTBORN: "#9ae6ff", STORMCALLER: "#c49bff" } as Record<string, string>)[F] ?? "#ffffff";
    PARENT = root;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const H = Math.max(14, box.max.y);
    const glowM = (c: string, ei = 2.4) => plainMat(c, { emissive: c, ei, rough: 0.3 });
    const stone = mat(stoneTex(901, "#6a6460", "#3a3632", "#1a1816", 3, 2), 0.6, 1.2);
    // a ring of the absorbed element round the foot
    mesh(new THREE.TorusGeometry(15.5, 0.45, 8, 56), glowM(col, 1.8), 0, 0.7, 0).rotation.x = Math.PI / 2;
    // the pillar at the tower's back-right shoulder
    const X = 11.5, Z = -6.5;
    const PY = Math.min(H * 0.55, 18);
    mesh(new THREE.CylinderGeometry(1.5, 2.2, PY, 8), stone, X, PY / 2, Z);
    mesh(new THREE.CylinderGeometry(2.6, 1.8, 1.4, 8), stone, X, PY + 0.7, Z);
    const cy = PY + 4;
    if (F === "INFERNO") {
      const bowl = mesh(new THREE.CylinderGeometry(3, 1.8, 2.2, 14, 1, true), plainMat("#2a2220", { metal: 0.6, rough: 0.4 }), X, PY + 2.4, Z);
      (bowl.material as THREE.Material).side = THREE.DoubleSide;
      mesh(new THREE.SphereGeometry(2.2, 18, 14), glowM("#ff7a2a", 2.8), X, PY + 3.2, Z);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(0.9, 4.5, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffd27a" : "#ff6a1a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), X + Math.cos(a) * 0.9, PY + 5.4, Z + Math.sin(a) * 0.9);
      }
    } else if (F === "FROSTBORN") {
      const ice = new THREE.MeshPhysicalMaterial({ color: "#c8f0ff", emissive: "#3ab8ff", emissiveIntensity: 0.6, roughness: 0.08, transparent: true, opacity: 0.9, clearcoat: 1 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const c = mesh(new THREE.OctahedronGeometry(1.2 + (i % 2) * 0.4, 0), ice, X + Math.cos(a) * 1.4, cy + (i % 2), Z + Math.sin(a) * 1.4);
        c.scale.y = 2.4;
        c.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      }
      mesh(new THREE.OctahedronGeometry(1.6, 0), glowM("#9ae6ff", 2.6), X, cy + 1, Z).scale.y = 2;
    } else if (F === "STORMCALLER") {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        tube([new THREE.Vector3(X + Math.cos(a) * 2.2, PY + 1.4, Z + Math.sin(a) * 2.2), new THREE.Vector3(X + Math.cos(a) * 3, cy, Z + Math.sin(a) * 3), new THREE.Vector3(X + Math.cos(a) * 1.4, cy + 3.6, Z + Math.sin(a) * 1.4)], 0.22, plainMat("#c87a3a", { metal: 0.85, rough: 0.3 }), 10);
      }
      mesh(new THREE.SphereGeometry(2, 20, 16), plainMat("#d8b8ff", { emissive: "#8a4aff", ei: 1.2, rough: 0.2 }), X, cy, Z);
    } else {
      // a rack of arrows with glowing heads
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const ar = mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), plainMat("#8a6a42"), X + Math.cos(a) * 0.8, cy, Z + Math.sin(a) * 0.8);
        ar.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15);
        mesh(new THREE.ConeGeometry(0.5, 1.4, 4), glowM("#ffd27a", 2.4), X + Math.cos(a) * 1.3, cy + 3.9, Z + Math.sin(a) * 1.3);
      }
    }
    anchors.fusion = new THREE.Vector3(X, cy + 1.5, Z);
    pointLights.push({ pos: new THREE.Vector3(X, cy, Z + 2), color: col, intensity: 200, dist: 22 });
  }

  // ---------------------------------------------------------------------------
  // PACOTES — the mark every bundle-exclusive skin carries: a gilded ring set
  // with gems round its foot, and its own crest above (crown, banners, orbit,
  // eclipse or wings) in the skin's colours.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // RANKING — each prize collection changes the tower's whole silhouette, so it
  // can't be mistaken for the premium skin whose structure it starts from:
  // Eterno floats on a levitating amethyst island, Arena stands inside a small
  // colosseum, Season rises on a stepped royal dais.
  // ---------------------------------------------------------------------------
  function liftBody(lift: number) {
    const body = new THREE.Group();
    for (const ch of [...root.children]) body.add(ch);
    root.add(body);
    body.position.y = lift;
    for (const k of Object.keys(anchors)) if (!turretAnchors.has(k)) anchors[k] = anchors[k]!.clone().add(new THREE.Vector3(0, lift, 0));
    for (const pl of pointLights) pl.pos = pl.pos.clone().add(new THREE.Vector3(0, lift, 0));
    return body;
  }
  function rankedEnvelope(P: PackLook) {
    PARENT = root;
    const glowM = (c: string, ei = 2.2) => plainMat(c, { emissive: c, ei, rough: 0.3 });
    if (P.crest === "eternity") {
      const lift = 11;
      const body = liftBody(lift);
      animate(body, { bob: [0.7, 0.9] });
      const isle = group(0, lift, 0, body);
      const rock = plainMat("#2a1e3a", { rough: 0.85, metal: 0.05 });
      const rockHi = plainMat("#2e2240", { rough: 0.8 });
      const amethyst = plainMat("#5a2a9a", { rough: 0.12, metal: 0.2, emissive: P.gem, ei: 0.5 });
      // the island hangs under the tower's own footing: a rough slab and an inverted crag
      mesh(new THREE.CylinderGeometry(16.5, 15.5, 1.6, 9), rockHi, 0, -0.9, 0, isle);
      const crag = mesh(new THREE.ConeGeometry(15.5, 13, 9, 3), rock, 0, -8.3, 0, isle);
      crag.rotation.x = Math.PI;
      const rb = rng(9090);
      const cpos = (crag.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < cpos.count; k++) {
        const j = 1 + (rb() - 0.5) * 0.25;
        cpos.setX(k, cpos.getX(k) * j);
        cpos.setZ(k, cpos.getZ(k) * j);
      }
      crag.geometry.computeVertexNormals();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rb();
        const d = 4 + rb() * 7;
        const c = mesh(new THREE.ConeGeometry(1.1 + rb() * 0.8, 5 + rb() * 5, 6), amethyst, Math.cos(a) * d, -4 - rb() * 5 - (d < 7 ? 3 : 0), Math.sin(a) * d, isle);
        c.rotation.x = Math.PI;
      }
      mesh(new THREE.TorusGeometry(16, 0.35, 8, 64), glowM(P.gem, 1.8), 0, -0.1, 0, isle).rotation.x = Math.PI / 2;
      // loose stones circling the island
      const orbit = group(0, 0, 0, root);
      animate(orbit, { spin: [0, 0.35, 0] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const st = mesh(new THREE.DodecahedronGeometry(1.2 + (i % 3) * 0.5, 0), i % 2 ? rockHi : rock, Math.cos(a) * 20, 4 + (i % 3) * 2.5, Math.sin(a) * 20, orbit);
        animate(st, { spin: [0.6, 0.9, 0], bob: [0.8, 1 + i * 0.2] });
      }
      // a pool of violet light on the ground where the island's shadow falls
      mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshBasicMaterial({ color: P.gem, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.2, 0).rotation.x = -Math.PI / 2;
    } else if (P.crest === "arena") {
      const stone = plainMat("#b89670", { rough: 0.85 });
      const stoneDk = plainMat("#8a6a48", { rough: 0.9 });
      const bronze = plainMat(P.metal, { metal: 0.8, rough: 0.32 });
      const rA = 18.5, n = 14;
      // the arena floor
      mesh(new THREE.CylinderGeometry(rA + 1.5, rA + 2.2, 1.2, 40), stoneDk, 0, 0.6, 0);
      mesh(new THREE.CylinderGeometry(rA - 0.5, rA - 0.5, 0.2, 40), plainMat("#d8bc90", { rough: 1 }), 0, 1.25, 0);
      // an arcade of arches all round, its top bound by a bronze-capped ring
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * rA, z = Math.sin(a) * rA;
        mesh(new THREE.BoxGeometry(1.6, 9, 1.6), stone, x, 5.7, z).rotation.y = -a;
        const a2 = a + Math.PI / n;
        const arch = mesh(new THREE.TorusGeometry(Math.PI * rA / n - 0.8, 0.6, 6, 12, Math.PI), stone, Math.cos(a2) * rA, 10.2, Math.sin(a2) * rA);
        arch.rotation.y = -a2 + Math.PI / 2;
      }
      const band = mesh(new THREE.CylinderGeometry(rA + 0.9, rA + 0.9, 1.6, 48, 1, true), stone, 0, 12.6, 0);
      (band.material as THREE.Material).side = THREE.DoubleSide;
      mesh(new THREE.TorusGeometry(rA + 0.9, 0.45, 8, 64), bronze, 0, 13.4, 0).rotation.x = Math.PI / 2;
      mesh(new THREE.TorusGeometry(rA + 0.9, 0.45, 8, 64), bronze, 0, 11.8, 0).rotation.x = Math.PI / 2;
      liftBody(1.3);
    } else if (P.crest === "royal") {
      const marble = plainMat("#eef0f4", { rough: 0.3, metal: 0.05 });
      const gold = plainMat(P.metal, { metal: 0.85, rough: 0.28 });
      const silver = plainMat("#e4e8f0", { metal: 0.9, rough: 0.22 });
      const steps: [number, number][] = [[21, 0], [19.2, 1.4], [17.4, 2.8]];
      for (const [r, y] of steps) {
        mesh(new THREE.CylinderGeometry(r, r + 0.4, 1.4, 48), marble, 0, y + 0.7, 0);
        mesh(new THREE.TorusGeometry(r + 0.1, 0.22, 6, 72), gold, 0, y + 1.35, 0).rotation.x = Math.PI / 2;
      }
      // a royal-blue carpet running down the front steps
      const carpet = plainMat(P.cloth, { rough: 0.9, emissive: P.cloth, ei: 0.12 });
      for (let k = 0; k < 3; k++) {
        const [r, y] = steps[k]!;
        mesh(new THREE.BoxGeometry(5, 0.12, r - (steps[k + 1]?.[0] ?? 14) + 0.2), carpet, 0, y + 1.46, (r + (steps[k + 1]?.[0] ?? 14)) / 2);
      }
      // a silver balustrade round the top step, open at the carpet
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
        mesh(new THREE.CylinderGeometry(0.25, 0.32, 2.2, 8), silver, Math.cos(a) * 16.9, 5.3, Math.sin(a) * 16.9);
      }
      const rail = mesh(new THREE.TorusGeometry(16.9, 0.25, 6, 80, Math.PI * 2 - 0.6), silver, 0, 6.5, 0);
      rail.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.3);
      liftBody(4.2);
    }
  }

  function packFlourish(P: PackLook) {
    if (P.crest === "eternity" || P.crest === "arena" || P.crest === "royal") rankedEnvelope(P);
    PARENT = root;
    const box = new THREE.Box3().setFromObject(root);
    const top = Math.max(14, box.max.y);
    const glowM = (c: string, ei = 2.2) => plainMat(c, { emissive: c, ei, rough: 0.3 });
    const gold = plainMat(P.metal, { metal: 0.85, rough: 0.28 });
    const ring = mesh(new THREE.TorusGeometry(15.8, 0.55, 10, 64), gold, 0, 0.8, 0);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(new THREE.OctahedronGeometry(0.85, 0), glowM(P.gem, 2.6), Math.cos(a) * 15.8, 1.5, Math.sin(a) * 15.8);
    }
    const y = top + 4;
    const R = Math.max(8, Math.min(14, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2));
    const steel = plainMat("#b8bcc8", { metal: 0.9, rough: 0.25 });
    const marble = plainMat("#f4efe4", { rough: 0.35, metal: 0.05 });
    const obsidian = plainMat("#0c0a0e", { rough: 0.12, metal: 0.4 });
    const crown = (cy: number, rad: number, m: THREE.Material, n = 6) => {
      const band = mesh(new THREE.CylinderGeometry(rad, rad * 0.92, rad * 0.36, 28, 1, true), m, 0, cy, 0);
      (band.material as THREE.Material).side = THREE.DoubleSide;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        mesh(new THREE.ConeGeometry(rad * 0.17, rad * 0.7, 6), m, Math.cos(a) * rad, cy + rad * 0.5, Math.sin(a) * rad);
        mesh(new THREE.SphereGeometry(rad * 0.12, 10, 8), glowM(P.gem, 2.8), Math.cos(a) * rad, cy + rad * 0.92, Math.sin(a) * rad);
      }
    };
    const arc = (r0: number, h: number, ang: number, m: THREE.Material, rad = 0.4) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, th = Math.PI * t;
        pts.push(new THREE.Vector3(Math.cos(ang) * Math.cos(th) * r0, 1 + Math.sin(th) * h, Math.sin(ang) * Math.cos(th) * r0));
      }
      tube(pts, rad, m, 60);
    };
    const bolt = (from: THREE.Vector3, to: THREE.Vector3, m: THREE.Material, seed: number) => {
      const rb = rng(seed);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        const p = from.clone().lerp(to, t);
        if (i > 0 && i < 7) p.add(new THREE.Vector3((rb() - 0.5) * 2.4, (rb() - 0.5) * 1.2, (rb() - 0.5) * 2.4));
        pts.push(p);
      }
      tube(pts, 0.22, m, 40);
    };

    switch (LOOK) {
      // ---- a molten heart floating in a gold cage over the crater, ringed by obsidian obelisks ----
      case "INFERNO_PACK_EMBERHEART": {
        const hy = top + 7;
        const heart = mesh(new THREE.IcosahedronGeometry(4.4, 0), plainMat("#ff6a1a", { emissive: "#ff5a10", ei: 2.4, rough: 0.2 }), 0, hy, 0);
        heart.scale.set(1, 1.25, 1);
        animate(heart, { spin: [0, 0.8, 0], bob: [0.8, 1.6] });
        mesh(new THREE.IcosahedronGeometry(5.6, 1), new THREE.MeshBasicMaterial({ color: "#ffb23a", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }), 0, hy, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 16; k++) {
            const t = k / 16, rr2 = 3 + Math.sin(t * Math.PI) * 5.5;
            pts.push(new THREE.Vector3(Math.cos(a) * rr2, top - 1 + t * 16, Math.sin(a) * rr2));
          }
          tube(pts, 0.38, gold, 50);
        }
        const cageRing = mesh(new THREE.TorusGeometry(8.4, 0.5, 8, 40), gold, 0, hy, 0);
        cageRing.rotation.x = Math.PI / 2;
        animate(cageRing, { spin: [0, 0, 0.5] });
        crown(top + 16.5, 2.6, gold);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(a) * (R + 4), z = Math.sin(a) * (R + 4);
          mesh(new THREE.CylinderGeometry(0.9, 1.9, 13, 4), obsidian, x, 6.5, z).rotation.y = a;
          mesh(new THREE.BoxGeometry(0.25, 10, 0.9), glowM("#ff7a1a", 2.6), x + Math.cos(a) * 1.2, 6.5, z + Math.sin(a) * 1.2).rotation.y = -a;
          mesh(new THREE.ConeGeometry(1.2, 2.4, 4), gold, x, 14.2, z);
        }
        pointLights.push({ pos: new THREE.Vector3(0, hy, 0), color: "#ff7a2a", intensity: 320, dist: 36 });
        break;
      }
      // ---- a great crown of ice crystals round the top, silver buttresses and a snowflake halo ----
      case "FROSTBORN_PACK_WINTER_CROWN": {
        const ice = new THREE.MeshPhysicalMaterial({ color: "#dce8ff", emissive: "#3a6aff", emissiveIntensity: 0.55, roughness: 0.06, transparent: true, opacity: 0.9, clearcoat: 1 });
        const cy = top - 6;
        mesh(new THREE.TorusGeometry(6.4, 0.8, 10, 48), steel, 0, cy, 0).rotation.x = Math.PI / 2;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const h = i % 2 ? 7 : 11;
          const c = mesh(new THREE.OctahedronGeometry(1.4, 0), ice, Math.cos(a) * 6.6, cy + h / 2 + 0.5, Math.sin(a) * 6.6);
          c.scale.set(1, h / 2.6, 1);
          c.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28);
          mesh(new THREE.OctahedronGeometry(0.75, 0), glowM("#4a7aff", 2.6), Math.cos(a) * 6.9, cy + 0.2, Math.sin(a) * 6.9);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const bx = Math.cos(a) * (R + 2.5), bz = Math.sin(a) * (R + 2.5);
          const ph = top * 0.55;
          mesh(new THREE.CylinderGeometry(1.6, 2, 1.4, 8), steel, bx, 0.7, bz);
          const pillar = mesh(new THREE.OctahedronGeometry(1.5, 0), ice, bx, ph / 2 + 1, bz);
          pillar.scale.set(1, ph / 3, 1);
          mesh(new THREE.OctahedronGeometry(0.9, 0), ice, bx + Math.cos(a) * 1.4, ph * 0.3, bz + Math.sin(a) * 1.4).scale.set(1, 2.6, 1);
          mesh(new THREE.SphereGeometry(0.9, 14, 10), glowM("#5a8aff", 2.4), bx, ph + 1.6, bz);
        }
        const fy = top + 9;
        const flake = group(0, fy, 0);
        animate(flake, { spin: [0, 0.6, 0], bob: [0.6, 1.2] });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI;
          const arm = mesh(new THREE.BoxGeometry(14, 0.35, 0.35), glowM("#d8e8ff", 1.6), 0, 0, 0, flake);
          arm.rotation.y = a;
          for (const d of [-1, 1]) mesh(new THREE.OctahedronGeometry(0.6, 0), glowM("#ffffff", 2), Math.cos(a) * 7 * d, 0, -Math.sin(a) * 7 * d, flake);
        }
        crown(fy + 2.2, 2.2, steel);
        pointLights.push({ pos: new THREE.Vector3(0, fy, 2), color: "#8ab0ff", intensity: 260, dist: 34 });
        break;
      }
      // ---- an emerald heart set in the trunk, gilded bands, golden antlers and hanging lanterns ----
      case "IRONWOOD_PACK_EMERALD_SENTINEL": {
        const em = mesh(new THREE.OctahedronGeometry(2.6, 0), plainMat("#2affa0", { emissive: "#10c070", ei: 2.2, rough: 0.1, metal: 0.2 }), 0, 11, 6.2);
        em.scale.set(1, 1.4, 0.7);
        mesh(new THREE.TorusGeometry(3.2, 0.42, 8, 30), gold, 0, 11, 5.9);
        for (const [yy, rad] of [[5, 6.6], [13, 5.8], [18.5, 5.2]] as const) mesh(new THREE.TorusGeometry(rad, 0.45, 8, 40), gold, 0, yy, 0).rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const base = new THREE.Vector3(side * 3, top - 1, -1);
          for (let k = 0; k < 3; k++) {
            tube([base, new THREE.Vector3(side * (5 + k), top + 3 + k * 1.5, -1 + k), new THREE.Vector3(side * (8 + k * 1.6), top + 7 + k * 2.4, -2 + k * 1.6)], 0.42 - k * 0.08, gold, 20);
          }
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          const lx = Math.cos(a) * 9.5, lz = Math.sin(a) * 9.5, ly = top - 6;
          tube([new THREE.Vector3(lx, ly + 4, lz), new THREE.Vector3(lx, ly + 1, lz)], 0.08, gold, 4);
          mesh(new THREE.OctahedronGeometry(0.85, 0), glowM("#8affb8", 2.4), lx, ly, lz).scale.y = 1.5;
        }
        pointLights.push({ pos: new THREE.Vector3(0, 11, 9), color: "#4affa0", intensity: 240, dist: 30 });
        break;
      }
      // ---- a crimson vortex round the storm, red bolts striking the rods, and tall steel needles ----
      case "STORMCALLER_PACK_CRIMSON_STORM": {
        const red = glowM("#e8101e", 1.5);
        const vy = top - 7;
        for (let k = 0; k < 3; k++) {
          const t = mesh(new THREE.TorusGeometry(9.5 - k * 2.2, 0.32, 8, 64), red, 0, vy + k * 3.2, 0);
          t.rotation.set(Math.PI / 2 + (k - 1) * 0.22, 0, k * 0.6);
          const nub = mesh(new THREE.SphereGeometry(0.7, 10, 8), glowM("#ff8a94", 3), 9.5 - k * 2.2, 0, 0, t);
          void nub;
          animate(t, { spin: [0, 0, (k % 2 ? -1 : 1) * (1.2 + k * 0.4)] });
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          bolt(new THREE.Vector3(Math.cos(a) * 4, vy, Math.sin(a) * 4), new THREE.Vector3(Math.cos(a) * 12.5, 5.5, Math.sin(a) * 12.5), red, 70 + i);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(a) * (R + 3.5), z = Math.sin(a) * (R + 3.5);
          mesh(new THREE.CylinderGeometry(0.35, 1.3, 18, 8), steel, x, 9, z);
          mesh(new THREE.TorusGeometry(1.4, 0.25, 6, 20), steel, x, 6, z).rotation.x = Math.PI / 2;
          mesh(new THREE.SphereGeometry(0.75, 12, 10), red, x, 18.6, z);
        }
        pointLights.push({ pos: new THREE.Vector3(0, vy, 4), color: "#ff3a4a", intensity: 300, dist: 38 });
        break;
      }
      // ---- the Eclipse pair: golden filigree arches over the tower, black crystals veined with gold ----
      case "IRONWOOD_PACK_ECLIPSE":
      case "FROSTBORN_PACK_ECLIPSE": {
        for (const ang of [0.35, Math.PI / 2 + 0.35]) arc(R + 2, top + 2, ang, gold, 0.42);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const d = R + 1 + (i % 3) * 1.2;
          const h = 4 + (i % 4) * 1.8;
          const c = mesh(new THREE.OctahedronGeometry(1.2, 0), obsidian, Math.cos(a) * d, h / 2, Math.sin(a) * d);
          c.scale.set(1, h / 2.4, 1);
          c.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
          mesh(new THREE.BoxGeometry(0.12, h * 0.9, 0.12), glowM(P.gem, 2.6), Math.cos(a) * d, h / 2, Math.sin(a) * d).rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
        }
        const ey = top + 8;
        mesh(new THREE.SphereGeometry(3.4, 28, 20), plainMat("#030205", { rough: 0.2, metal: 0.3 }), 0, ey, 0);
        const cor = mesh(new THREE.TorusGeometry(4.3, 0.55, 12, 64), glowM(P.gem, 3.2), 0, ey, 0);
        cor.rotation.x = Math.PI / 2.15;
        mesh(new THREE.SphereGeometry(5.4, 24, 16), new THREE.MeshBasicMaterial({ color: P.gem, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }), 0, ey, 0);
        const corona = group(0, ey, 0);
        animate(corona, { spin: [0, 0, 0.35] });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const ray = mesh(new THREE.ConeGeometry(0.28, i % 2 ? 2 : 3.4, 5), glowM(P.gem, 2.4), Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0, corona);
          ray.rotation.z = a - Math.PI / 2;
        }
        pointLights.push({ pos: new THREE.Vector3(0, ey, 3), color: P.gem, intensity: 260, dist: 34 });
        break;
      }
      // ---- RANKING · Eterno: a floating hourglass of violet glass in a gold frame, orbited by star rings, over amethyst obelisks ----
      // (moving parts: the hourglass floats and turns, each star ring revolves at its own pace)
      case "IRONWOOD_ETERNAL_RANK":
      case "FROSTBORN_ETERNAL_RANK":
      case "INFERNO_ETERNAL_RANK":
      case "STORMCALLER_ETERNAL_RANK": {
        const hy = top + 9;
        const float = group(0, hy, 0);
        animate(float, { bob: [0.9, 1.3] });
        const hour = group(0, 0, 0, float);
        animate(hour, { spin: [0, 0.45, 0] });
        PARENT = hour;
        const glass = new THREE.MeshPhysicalMaterial({ color: "#d8c0ff", emissive: P.gem, emissiveIntensity: 0.35, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
        for (const d of [-1, 1]) {
          const bulb = mesh(new THREE.ConeGeometry(3.4, 4.6, 24, 1, true), glass, 0, d * 2.3, 0);
          if (d < 0) bulb.rotation.x = Math.PI;
          mesh(new THREE.CylinderGeometry(4, 4, 0.7, 28), gold, 0, d * 4.95, 0);
          mesh(new THREE.TorusGeometry(4, 0.3, 8, 36), gold, 0, d * 5.3, 0).rotation.x = Math.PI / 2;
        }
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          mesh(new THREE.CylinderGeometry(0.26, 0.26, 10, 8), gold, Math.cos(a) * 3.7, 0, Math.sin(a) * 3.7);
          mesh(new THREE.SphereGeometry(0.5, 10, 8), gold, Math.cos(a) * 3.7, 5.8, Math.sin(a) * 3.7);
        }
        // the sand: a glowing pile below, a thin falling stream, a sinking cone above
        mesh(new THREE.ConeGeometry(2.4, 2, 20), glowM("#ffd878", 2.2), 0, -3.6, 0);
        mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6), glowM("#fff0b0", 3), 0, -0.4, 0);
        mesh(new THREE.ConeGeometry(1.6, 1.4, 20), glowM("#ffd878", 2.2), 0, 1.2, 0).rotation.x = Math.PI;
        // star rings round the hourglass, each tilted its own way and revolving
        PARENT = float;
        const orbitN = TYPE === "STORMCALLER" ? 4 : 3;
        for (let k = 0; k < orbitN; k++) {
          const rad = 7 + k * 1.6;
          const tilt = group(0, 0, 0, float);
          tilt.rotation.set(Math.PI / 2 + (k - 1) * 0.5, k * 0.9, k % 2 ? 0.3 : -0.3);
          const turn = group(0, 0, 0, tilt);
          animate(turn, { spin: [0, 0, (k % 2 ? -1 : 1) * (0.7 + k * 0.25)] });
          mesh(new THREE.TorusGeometry(rad, 0.14, 6, 90), glowM(k % 2 ? "#ffd878" : P.gem, 1.6), 0, 0, 0, turn);
          for (let j = 0; j < 2; j++) {
            const st = mesh(new THREE.OctahedronGeometry(0.75, 0), glowM(j ? "#ffffff" : P.gem, 3), Math.cos(j * Math.PI + k) * rad, Math.sin(j * Math.PI + k) * rad, 0, turn);
            st.scale.set(0.6, 0.6, 1.4);
          }
        }
        mesh(new THREE.SphereGeometry(6.6, 24, 16), new THREE.MeshBasicMaterial({ color: P.gem, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, float);
        PARENT = root;
        // amethyst obelisks with gold caps and glowing runes
        const amethyst = plainMat("#3a2260", { rough: 0.15, metal: 0.3, emissive: P.gem, ei: 0.25 });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const x = Math.cos(a) * 22, z = Math.sin(a) * 22;
          const h = i % 2 ? 9 : 12.5;
          const ob = mesh(new THREE.CylinderGeometry(0.6, 1.5, h, 4), amethyst, x, h / 2, z);
          ob.rotation.y = a + Math.PI / 4;
          mesh(new THREE.ConeGeometry(0.85, 1.8, 4), gold, x, h + 0.9, z).rotation.y = a + Math.PI / 4;
          mesh(new THREE.BoxGeometry(0.18, h * 0.6, 0.18), glowM(P.gem, 2.8), x + Math.cos(a) * 1.05, h * 0.45, z + Math.sin(a) * 1.05);
          animate(mesh(new THREE.OctahedronGeometry(0.55, 0), glowM("#ffffff", 3), x, h + 2.6, z), { spin: [0, 2, 0], bob: [0.5, 2 + i * 0.3] });
        }
        pointLights.push({ pos: new THREE.Vector3(0, hy, 3), color: P.gem, intensity: 300, dist: 38 });
        break;
      }
      // ---- RANKING · Arena: red shields on crossed spears round the foot; above, a bronze laurel pierced by two crossed swords ----
      case "IRONWOOD_ARENA_RANK":
      case "FROSTBORN_ARENA_RANK":
      case "INFERNO_ARENA_RANK":
      case "STORMCALLER_ARENA_RANK": {
        const bronze = plainMat(P.metal, { metal: 0.8, rough: 0.32 });
        const crimson = plainMat(P.cloth, { rough: 0.55, metal: 0.15 });
        const wood = plainMat("#4a2e1a", { rough: 0.8 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const d = 22.5;
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          for (const s2 of [-1, 1]) {
            const sp = mesh(new THREE.CylinderGeometry(0.16, 0.16, 13, 6), wood, x, 6, z);
            sp.rotation.set(0, -a, s2 * 0.42);
            const tipOff = new THREE.Vector3(Math.sin(s2 * 0.42) * -6.4, 6.4 * Math.cos(0.42), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a);
            const tip = mesh(new THREE.ConeGeometry(0.45, 1.8, 4), steel, x + tipOff.x, 6 + tipOff.y + 0.6, z + tipOff.z);
            tip.rotation.set(0, -a, s2 * 0.42);
          }
          const sh = new THREE.Group();
          sh.position.set(x + Math.cos(a) * 0.7, 6.2, z + Math.sin(a) * 0.7);
          sh.rotation.y = -a + Math.PI / 2;
          PARENT.add(sh);
          const face = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 32), crimson);
          face.rotation.x = Math.PI / 2;
          sh.add(face);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(3, 0.32, 8, 40), bronze);
          rim.position.z = 0.1;
          sh.add(rim);
          const boss = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), bronze);
          boss.position.z = 0.35;
          boss.scale.z = 0.6;
          sh.add(boss);
          for (const r2 of [0, Math.PI / 2]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.35, 0.2), bronze);
            bar.position.z = 0.3;
            bar.rotation.z = r2 + Math.PI / 4;
            sh.add(bar);
          }
          for (const m of [face, rim, boss]) m.castShadow = true;
        }
        // the laurel and the crossed swords
        const ly = top + 10;
        const lr = 6;
        const emblem = group(0, ly, 0);
        animate(emblem, { spin: [0, 0.5, 0], bob: [0.7, 1.1] });
        PARENT = emblem;
        mesh(new THREE.TorusGeometry(lr, 0.3, 8, 48, Math.PI * 1.7), bronze, 0, 0, 0).rotation.z = Math.PI * 1.65;
        for (let i = 0; i < 18; i++) {
          const t = i / 17;
          const a = Math.PI * 1.65 + t * Math.PI * 1.7;
          for (const side of [-1, 1]) {
            const leaf = mesh(new THREE.SphereGeometry(0.75, 8, 6), gold, Math.cos(a) * (lr + side * 0.6), Math.sin(a) * (lr + side * 0.6), 0);
            leaf.scale.set(0.5, 1.4, 0.35);
            leaf.rotation.z = a + side * 0.5;
          }
        }
        for (const s2 of [-1, 1]) {
          const sw = new THREE.Group();
          sw.position.set(0, 0, 0.6);
          sw.rotation.z = s2 * 0.75;
          sw.scale.setScalar(1.45);
          emblem.add(sw);
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 11, 0.18), steel);
          blade.position.y = 1.4;
          const edge = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4), steel);
          edge.position.y = 7.6;
          edge.scale.z = 0.3;
          const guard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), bronze);
          guard.position.y = -4.2;
          const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 8), crimson);
          grip.position.y = -5.5;
          const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), bronze);
          pommel.position.y = -6.8;
          const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.16, 9, 0.22), glowM(P.gem, 2));
          fuller.position.y = 1.2;
          sw.add(blade, edge, guard, grip, pommel, fuller);
        }
        animate(mesh(new THREE.OctahedronGeometry(1.6, 0), glowM(P.gem, 3), 0, 0, 1.4), { spin: [0, 2.4, 0] });
        PARENT = root;
        pointLights.push({ pos: new THREE.Vector3(0, ly, 4), color: P.gem, intensity: 260, dist: 34 });
        break;
      }
      // ---- RANKING · Season: four royal-blue standards on silver poles, a silver crown and a royal star over the tower ----
      case "IRONWOOD_SEASON_RANK":
      case "FROSTBORN_SEASON_RANK":
      case "INFERNO_SEASON_RANK":
      case "STORMCALLER_SEASON_RANK": {
        const silver = plainMat("#e4e8f0", { metal: 0.9, rough: 0.22 });
        const royal = plainMat(P.cloth, { rough: 0.7, metal: 0.05, emissive: P.cloth, ei: 0.15 });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const d = 23.5;
          const x = Math.cos(a) * d, z = Math.sin(a) * d;
          const ph = 24;
          mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 10), silver, x, 0.6, z);
          mesh(new THREE.CylinderGeometry(0.22, 0.28, ph, 8), silver, x, ph / 2, z);
          mesh(new THREE.ConeGeometry(0.5, 2, 6), gold, x, ph + 1, z);
          mesh(new THREE.SphereGeometry(0.45, 10, 8), gold, x, ph, z);
          const perp = a + Math.PI / 2;
          const bx = x + Math.cos(perp) * 2.3, bz = z + Math.sin(perp) * 2.3;
          mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.8, 6), gold, bx, ph - 1.1, bz).rotation.set(0, -perp, Math.PI / 2);
          const ban = mesh(new THREE.PlaneGeometry(4.4, 11, 1, 8), royal, bx, ph - 6.6, bz);
          ban.rotation.y = -perp;
          (ban.material as THREE.Material).side = THREE.DoubleSide;
          const pos = (ban.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
          for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin((pos.getY(k) + 5.5) * 0.7) * 0.45);
          pos.needsUpdate = true;
          ban.geometry.computeVertexNormals();
          const trim = mesh(new THREE.BoxGeometry(4.5, 0.5, 0.2), gold, bx, ph - 12.1, bz);
          trim.rotation.y = -perp;
          const star = mesh(new THREE.OctahedronGeometry(1.3, 0), glowM("#e8eef8", 2.2), bx + Math.cos(a) * 0.3, ph - 6, bz + Math.sin(a) * 0.3);
          star.scale.set(1, 1, 0.3);
          star.rotation.y = -perp;
        }
        const sy = top + 8;
        const regal = group(0, sy, 0);
        animate(regal, { spin: [0, 0.4, 0], bob: [0.8, 1.2] });
        const wheel = group(0, 0, -0.6, regal);
        animate(wheel, { spin: [0, 0, 0.6] });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const ray = mesh(new THREE.ConeGeometry(0.9, i % 2 ? 3.4 : 5.4, 4), i % 2 ? silver : gold, Math.cos(a) * (i % 2 ? 3.6 : 4.4), Math.sin(a) * (i % 2 ? 3.6 : 4.4), 0, wheel);
          ray.rotation.z = a - Math.PI / 2;
          ray.scale.z = 0.35;
        }
        mesh(new THREE.SphereGeometry(2, 24, 18), plainMat("#b8d0ff", { emissive: P.gem, ei: 1.8, rough: 0.1 }), 0, 0, 0, regal);
        mesh(new THREE.TorusGeometry(2.5, 0.35, 8, 40), silver, 0, 0, 0.2, regal);
        PARENT = regal;
        crown(3.6, 2.4, silver, 5);
        PARENT = root;
        pointLights.push({ pos: new THREE.Vector3(0, sy, 3), color: P.gem, intensity: 260, dist: 36 });
        break;
      }
      // ---- the Sovereign pair: a marble colonnade with a gold lintel, crimson banners, great wings and a sun disk ----
      default: {
        const n = 8;
        const cr = R + 3.5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.PI / 8;
          const x = Math.cos(a) * cr, z = Math.sin(a) * cr;
          mesh(new THREE.CylinderGeometry(0.85, 1, 11, 14), marble, x, 5.5, z);
          mesh(new THREE.BoxGeometry(2.4, 0.7, 2.4), gold, x, 11.2, z).rotation.y = -a;
          mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), gold, x, 0.3, z).rotation.y = -a;
          if (i % 2 === 0) {
            const ban = mesh(new THREE.PlaneGeometry(2.6, 6), plainMat("#b01a2a", { rough: 0.8 }), Math.cos(a + 0.39) * (cr + 0.1), 7.6, Math.sin(a + 0.39) * (cr + 0.1));
            ban.rotation.y = -(a + 0.39) + Math.PI / 2;
            (ban.material as THREE.Material).side = THREE.DoubleSide;
          }
        }
        mesh(new THREE.TorusGeometry(cr, 0.55, 8, 72), gold, 0, 11.8, 0).rotation.x = Math.PI / 2;
        const sy = y;
        const disk = mesh(new THREE.CircleGeometry(5.8, 40), glowM("#ffe2a0", 1.6), 0, sy, -5.4);
        void disk;
        mesh(new THREE.TorusGeometry(6.2, 0.4, 8, 48), gold, 0, sy, -5.3);
        const sun = group(0, sy, -5.3);
        animate(sun, { spin: [0, 0, 0.3] });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const ray = mesh(new THREE.ConeGeometry(0.5, 2.6, 5), gold, Math.cos(a) * 7.6, Math.sin(a) * 7.6, 0, sun);
          ray.rotation.z = a - Math.PI / 2;
        }
        for (const side of [-1, 1]) {
          for (let k = 0; k < 8; k++) {
            const f = mesh(new THREE.BoxGeometry(0.6, 9 - k * 0.7, 1.8), k % 2 ? gold : marble, side * (3 + k * 1.5), sy - 3 + k * 0.6, -3.2);
            f.rotation.z = side * (0.3 + k * 0.16);
          }
        }
        crown(sy + 1.2, 2.2, gold, 5);
        pointLights.push({ pos: new THREE.Vector3(0, sy, 2), color: "#ffe2a0", intensity: 260, dist: 36 });
      }
    }
  }

  // ---------------------------------------------------------------------------
  if (TYPE === "FROSTBORN") buildFrostborn();
  else if (TYPE === "IRONWOOD") buildIronwood();
  else if (TYPE === "INFERNO") buildInferno();
  else if (TYPE === "STORMCALLER") buildStormcaller();
  if (FUSED && FUSED !== TYPE) buildFusionCore(FUSED);
  if (PACK) packFlourish(PACK);
  if (TURRET_PIVOT_Y) {
    for (const ch of turret.children) ch.position.y -= TURRET_PIVOT_Y;
    turret.position.y = TURRET_PIVOT_Y;
    for (const k of turretAnchors) anchors[k] = anchors[k]!.clone().sub(new THREE.Vector3(0, TURRET_PIVOT_Y, 0));
  }
  return { root, turret, anchors, turretAnchors, pointLights, turretMode: TURRET_MODE, turretPivotY: TURRET_PIVOT_Y, turretTilt: TURRET_TILT };
}

/**
 * Plays a tower's moving parts (the ones marked by animate() inside buildTowerModel):
 * call every frame with the time in seconds. The marks live in userData, so they
 * survive Object3D.clone(); the list of moving parts is gathered once per object.
 */
export function animateTowerParts(root: THREE.Object3D, t: number) {
  const r = root as THREE.Object3D & { __anim?: THREE.Object3D[] };
  if (!r.__anim) {
    r.__anim = [];
    root.traverse((o) => {
      if (o.userData.anim) r.__anim!.push(o);
    });
  }
  for (const o of r.__anim) {
    const a = o.userData.anim;
    if (a.spin) o.rotation.set(a.r0[0] + a.spin[0] * t, a.r0[1] + a.spin[1] * t, a.r0[2] + a.spin[2] * t);
    if (a.bob) o.position.y = a.y0 + Math.sin(t * a.bob[1] + a.ph) * a.bob[0];
  }
}

/** PACOTES — how each bundle-exclusive skin is built (see config/towerSkins.ts PACK_TOWER_SKINS). */
interface PackLook {
  /** The premium skin of the same tower whose structure it reuses. */
  shape: string;
  crest: "crown" | "banners" | "orbit" | "eclipse" | "wings" | "eternity" | "arena" | "royal";
  metal: string;
  gem: string;
  cloth: string;
}

const PACK_LOOKS: Record<string, PackLook> = {
  INFERNO_PACK_EMBERHEART: { shape: "INFERNO_VOLCANIC_COLOSSUS", crest: "crown", metal: "#d8a040", gem: "#ff7a2a", cloth: "#5a1a14" },
  FROSTBORN_PACK_WINTER_CROWN: { shape: "FROSTBORN_GLACIAL_WARLORD", crest: "crown", metal: "#e8eef8", gem: "#5a8aff", cloth: "#2a4a9a" },
  IRONWOOD_PACK_EMERALD_SENTINEL: { shape: "IRONWOOD_ANCIENT_HUNTER", crest: "banners", metal: "#e8c050", gem: "#4affa0", cloth: "#1e5a32" },
  STORMCALLER_PACK_CRIMSON_STORM: { shape: "STORMCALLER_THUNDER", crest: "orbit", metal: "#c8c0c4", gem: "#ff3a4a", cloth: "#4a1a1e" },
  IRONWOOD_PACK_ECLIPSE: { shape: "IRONWOOD_WARDEN_OF_THE_ABYSS", crest: "eclipse", metal: "#d8a838", gem: "#ffc848", cloth: "#141218" },
  FROSTBORN_PACK_ECLIPSE: { shape: "FROSTBORN_ARCANE_CRYSTAL", crest: "eclipse", metal: "#d8a838", gem: "#ffc848", cloth: "#141218" },
  INFERNO_PACK_SOVEREIGN: { shape: "INFERNO_SOLAR_ASCENDANT", crest: "wings", metal: "#ffd878", gem: "#ff3a4a", cloth: "#f2ead8" },
  STORMCALLER_PACK_SOVEREIGN: { shape: "STORMCALLER_CELESTIAL", crest: "wings", metal: "#ffd878", gem: "#ff3a4a", cloth: "#f2ead8" },
  // RANKING (config/rankedRewards.ts) — prizes for the top of each ranking, never sold.
  IRONWOOD_ETERNAL_RANK: { shape: "IRONWOOD_WARDEN_OF_THE_ABYSS", crest: "eternity", metal: "#ffd878", gem: "#b07aff", cloth: "#2a1a4a" },
  FROSTBORN_ETERNAL_RANK: { shape: "FROSTBORN_CELESTIAL_ICE", crest: "eternity", metal: "#ffd878", gem: "#9a8aff", cloth: "#2a1a4a" },
  INFERNO_ETERNAL_RANK: { shape: "INFERNO_PLAGUE_FURNACE", crest: "eternity", metal: "#ffd878", gem: "#d05aff", cloth: "#2a1a4a" },
  STORMCALLER_ETERNAL_RANK: { shape: "STORMCALLER_ARCANE", crest: "eternity", metal: "#ffd878", gem: "#8a6aff", cloth: "#2a1a4a" },
  IRONWOOD_ARENA_RANK: { shape: "IRONWOOD_IRONCLAD_JUGGERNAUT", crest: "arena", metal: "#d8963a", gem: "#ff5a2a", cloth: "#8a1a14" },
  FROSTBORN_ARENA_RANK: { shape: "FROSTBORN_GLACIAL_WARLORD", crest: "arena", metal: "#d8963a", gem: "#ff7a4a", cloth: "#8a1a14" },
  INFERNO_ARENA_RANK: { shape: "INFERNO_ASHEN_TYRANT", crest: "arena", metal: "#d8963a", gem: "#ff4a1a", cloth: "#8a1a14" },
  STORMCALLER_ARENA_RANK: { shape: "STORMCALLER_TEMPEST", crest: "arena", metal: "#d8963a", gem: "#ff6a2a", cloth: "#8a1a14" },
  IRONWOOD_SEASON_RANK: { shape: "IRONWOOD_ARCANE_ENGINE", crest: "royal", metal: "#ffd060", gem: "#5a9aff", cloth: "#1a3a8a" },
  FROSTBORN_SEASON_RANK: { shape: "FROSTBORN_ANCIENT_GUARDIAN", crest: "royal", metal: "#ffd060", gem: "#7aa8ff", cloth: "#1a3a8a" },
  INFERNO_SEASON_RANK: { shape: "INFERNO_INDUSTRIAL_FORGE", crest: "royal", metal: "#ffd060", gem: "#4a9aff", cloth: "#1a3a8a" },
  STORMCALLER_SEASON_RANK: { shape: "STORMCALLER_VOID", crest: "royal", metal: "#ffd060", gem: "#4a8aff", cloth: "#1a3a8a" },
};/**
 * LIGHT ON ANY PC: the procedural stone/metal/bark textures (512×512 canvases
 * painted pixel by pixel) are the costliest part of building a tower. The
 * same textures recur across towers, levels and skins, so each is painted
 * once per page and reused (every material takes its own clone).
 */
const TEX_CACHE = new Map<string, unknown>();
function cachedTex<T>(kind: string, args: unknown[], make: () => T): T {
  const key = kind + JSON.stringify(args);
  let hit = TEX_CACHE.get(key) as T | undefined;
  if (!hit) {
    hit = make();
    TEX_CACHE.set(key, hit);
  }
  return hit;
}


