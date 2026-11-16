// Generated from the tower bake builder (towerbake.ts): the same procedural
// tower models, wrapped so the real-time 3D battlefield can build them.
// @ts-nocheck — mechanically wrapped from the offline bake script; type-checked there.
/* eslint-disable */
import * as THREE from "three";

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

export function buildTowerModel(TYPE: string, STAGE: number, SKIN: string): TowerModel {
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
  function stoneTex(seed: number, a: string, b: string, mortar: string, rows: number, cols: number, opts: { frost?: number; runes?: string; runeRows?: number[] } = {}): TexSet {
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

  function metalTex(seed: number, base: string, opts: { rivets?: boolean } = {}): TexSet {
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
    const map = set.map.clone(); map.repeat.set(rx, ry); map.needsUpdate = true;
    const bump = set.bump.clone(); bump.repeat.set(rx, ry); bump.needsUpdate = true;
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
  function flagTex(seed: number, a: string, b: string, mortar: string, frost = 0): TexSet {
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
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9, k1 = 0;
      for (let i = 0; i < pts.length; i++) {
        for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]] as const) {
          const dx = x - pts[i]![0] - ox, dy = y - pts[i]![1] - oy;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; k1 = i; } else if (d < d2) d2 = d;
        }
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
        const ceramic = plainMat("#e8eef4", { rough: 0.3 });
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
  function buildFrostborn() {
    const s = STAGE;
    const L = FROST_LOOKS[SKIN] ?? FROST_LOOKS.base!;
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
  function barkTex(seed: number, a: string, b: string, veins?: string): TexSet {
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
  function buildIronwood() {
    const s = STAGE;
    const L = IRON_LOOKS[SKIN] ?? IRON_LOOKS.base!;
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

  function buildInferno() {
    const s = STAGE;
    const L = INF_LOOKS[SKIN] ?? INF_LOOKS.base!;
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
  function buildStormcallerCoil() {
    const s = STAGE;
    const L = STORM_LOOKS[SKIN] ?? STORM_LOOKS.base!;
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
  if (TYPE === "FROSTBORN") buildFrostborn();
  else if (TYPE === "IRONWOOD") buildIronwood();
  else if (TYPE === "INFERNO") buildInferno();
  else if (TYPE === "STORMCALLER") buildStormcaller();
  if (TURRET_PIVOT_Y) {
    for (const ch of turret.children) ch.position.y -= TURRET_PIVOT_Y;
    turret.position.y = TURRET_PIVOT_Y;
    for (const k of turretAnchors) anchors[k] = anchors[k]!.clone().sub(new THREE.Vector3(0, TURRET_PIVOT_Y, 0));
  }
  return { root, turret, anchors, turretAnchors, pointLights, turretMode: TURRET_MODE, turretPivotY: TURRET_PIVOT_Y, turretTilt: TURRET_TILT };
}
