// Generated from the castle bake builder (castlebake.ts): the same procedural
// castle, wrapped so the real-time 3D battlefield can build it.
// @ts-nocheck — mechanically wrapped from the offline bake script; type-checked there.
/* eslint-disable */
import * as THREE from "three";

export interface CastleModel {
  root: THREE.Group;
  anchors: Record<string, THREE.Vector3>;
  core: string;
  lava: boolean;
}

/** Painted surfaces are expensive (1024px + normal maps): kept across rebuilds (tier changes, remounts). */
const STONE_SET_CACHE = new Map<string, any>();
const ROOF_SET_CACHE = new Map<string, any>();

export function buildCastleModel(BIOME: string, TIER: number, SKIN = ""): CastleModel {

  // ---------------------------------------------------------------------------
  // Biome dressing
  // ---------------------------------------------------------------------------
  interface Dressing {
    stoneA: string; // light stone
    stoneB: string; // dark stone
    mortar: string;
    roof: string;
    roofDark: string;
    ground: string;
    moss?: string; // ivy/moss tint on lower walls
    snow?: boolean;
    sand?: boolean;
    lava?: boolean;
    core: string; // crystal color
    window: string;
  }
  const DRESS: Record<string, Dressing> = {
    ANCIENT_FOREST: { stoneA: "#9a9384", stoneB: "#5e5a50", mortar: "#3a372f", roof: "#7a2a1e", roofDark: "#3e130c", ground: "#4a4430", moss: "#4f6a2a", core: "#7cff7a", window: "#ffb85a" },
    VOLCANIC_WASTES: { stoneA: "#5a4c46", stoneB: "#2a201c", mortar: "#140c08", roof: "#3a1a14", roofDark: "#1a0a06", ground: "#2a1a12", lava: true, core: "#ff8a3a", window: "#ff9a3a" },
    FROZEN_TUNDRA: { stoneA: "#a8b4bc", stoneB: "#626e78", mortar: "#3a444c", roof: "#2e4a66", roofDark: "#14263a", ground: "#8a98a2", snow: true, core: "#8ae8ff", window: "#ffd08a" },
    CURSED_DESERT: { stoneA: "#cbb08a", stoneB: "#8a6c48", mortar: "#5a4428", roof: "#8a3a22", roofDark: "#4a1a0c", ground: "#a88a5a", sand: true, core: "#ffd25a", window: "#ffc070" },
    DARK_RUINS: { stoneA: "#6e7066", stoneB: "#3a3c36", mortar: "#1e201c", roof: "#2e2a36", roofDark: "#141218", ground: "#2e302a", moss: "#3a4a2a", core: "#b88aff", window: "#c0a0ff" },
    ABYSS: { stoneA: "#5a5068", stoneB: "#2a2234", mortar: "#140e1c", roof: "#3a1a52", roofDark: "#180828", ground: "#1e1828", core: "#c890ff", window: "#d0a0ff" },
  };
  // SKINS DE CASTELO — a skin replaces the biome dressing and adds its own pieces (see addSkinDressing)

  interface SkinDress extends Dressing {
    roofKind?: "cone" | "dome" | "spire" | "flat";
    roofMetal?: number;
    frostRoof?: boolean;
  }
  const SKIN_DRESS: Record<string, SkinDress> = {
    FROST_CITADEL: { stoneA: "#c8dcea", stoneB: "#7894ac", mortar: "#4a6276", roof: "#9fd4ff", roofDark: "#3a6a94", ground: "#c8d8e4", snow: true, core: "#8ae8ff", window: "#bfeaff", roofKind: "spire", frostRoof: true },
    INFERNAL_KEEP: { stoneA: "#4a3a36", stoneB: "#1a1210", mortar: "#0a0605", roof: "#5a1410", roofDark: "#220604", ground: "#2a1612", lava: true, core: "#ff5a1a", window: "#ff6a2a", roofKind: "spire" },
    SOLAR_SANCTUM: { stoneA: "#f2ead8", stoneB: "#c8b890", mortar: "#8a7a5a", roof: "#f0c050", roofDark: "#a07018", ground: "#e8dcb8", core: "#fff0a0", window: "#fff0c0", roofKind: "dome", roofMetal: 0.85 },
    VERDANT_HOLD: { stoneA: "#8a9a78", stoneB: "#4a5a3a", mortar: "#2a3420", roof: "#3a6a2a", roofDark: "#1a3410", ground: "#4a6a2a", moss: "#3f7a24", core: "#a0ff6a", window: "#e0ffa0", roofKind: "cone" },
    VOID_SPIRE: { stoneA: "#5a4a7a", stoneB: "#22183a", mortar: "#0e0818", roof: "#4a1a7a", roofDark: "#14062a", ground: "#1e1830", core: "#c890ff", window: "#d0a0ff", roofKind: "spire" },
    RECRUIT_KEEP: { stoneA: "#b8a07a", stoneB: "#7a6040", mortar: "#4a3a24", roof: "#8a5a2a", roofDark: "#4a2a10", ground: "#7a6a40", moss: "#5a6a2a", core: "#ffcf8a", window: "#ffcf8a", roofKind: "cone" },
    OBSIDIAN_BASTION: { stoneA: "#55555f", stoneB: "#17171d", mortar: "#1c3a38", roof: "#16161c", roofDark: "#060608", ground: "#1a1c20", core: "#2fe0c8", window: "#5af0d8", roofKind: "flat" },
    HUNTER_THRONE: { stoneA: "#5a3a34", stoneB: "#24120f", mortar: "#120806", roof: "#7a121a", roofDark: "#2a0408", ground: "#2a1a14", core: "#ff6a3a", window: "#ff9a5a", roofKind: "spire" },
    PRESTIGE_ETERNAL_BASTION: { stoneA: "#f4f0e6", stoneB: "#c8bca0", mortar: "#7a6a4a", roof: "#e0b440", roofDark: "#8a6010", ground: "#d8ccaa", core: "#ffe08a", window: "#fff0b0", roofKind: "spire", roofMetal: 0.9 },
  };
  const SD: SkinDress | null = SKIN_DRESS[SKIN] ?? null;

  /** Each skin's own architecture — keep and tower shapes, sizes and wall material — so every castle is a different building. */
  type KeepShape = "box" | "round" | "octagon" | "hex" | "jagged" | "tree";
  type TowerShape = "round" | "hex" | "octagon" | "jagged" | "needle" | "tree" | "square";
  interface Arch {
    keep: KeepShape;
    tower: TowerShape;
    keepH: number;
    towerH: number;
    towerR: number;
    wall: "stone" | "ice" | "glass" | "wood" | "marble";
  }
  const ARCH: Arch =
    ({
      FROST_CITADEL: { keep: "hex", tower: "hex", keepH: 84, towerH: 58, towerR: 10, wall: "ice" },
      INFERNAL_KEEP: { keep: "jagged", tower: "jagged", keepH: 74, towerH: 42, towerR: 13, wall: "glass" },
      SOLAR_SANCTUM: { keep: "round", tower: "octagon", keepH: 62, towerH: 44, towerR: 11, wall: "marble" },
      VERDANT_HOLD: { keep: "tree", tower: "tree", keepH: 66, towerH: 46, towerR: 9, wall: "stone" },
      VOID_SPIRE: { keep: "octagon", tower: "needle", keepH: 82, towerH: 70, towerR: 7, wall: "glass" },
      RECRUIT_KEEP: { keep: "box", tower: "square", keepH: 52, towerH: 38, towerR: 9, wall: "wood" },
      OBSIDIAN_BASTION: { keep: "box", tower: "square", keepH: 52, towerH: 36, towerR: 15, wall: "glass" },
      HUNTER_THRONE: { keep: "jagged", tower: "hex", keepH: 78, towerH: 54, towerR: 11, wall: "stone" },
      PRESTIGE_ETERNAL_BASTION: { keep: "octagon", tower: "octagon", keepH: 72, towerH: 50, towerR: 10, wall: "marble" },
    } as Record<string, Arch>)[SKIN] ?? { keep: "box", tower: "round", keepH: 70, towerH: 48, towerR: 11, wall: "stone" };
  const D: SkinDress = SD ?? DRESS[BIOME] ?? DRESS.ANCIENT_FOREST!;

  // ---------------------------------------------------------------------------
  // Procedural textures (canvas): stone blocks with per-stone variation + bump,
  // slate/tiles for roofs, planks for the gate.
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
  function hexRgb(h: string): [number, number, number] {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(a: [number, number, number], b: [number, number, number], t: number): string {
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }

  interface TexSet {
    map: THREE.CanvasTexture;
    bump: THREE.CanvasTexture;
    normal?: THREE.CanvasTexture;
    rough?: THREE.CanvasTexture;
  }

  // ---------------------------------------------------------------------------
  // REALISTIC SURFACES — every stone and slate texture is painted at 1024px
  // with irregular cut blocks, per-block colour drift, multi-octave grain,
  // chipped edges and recessed mortar; its height field becomes a real
  // tangent-space normal map and a roughness map, so light rakes across the
  // relief instead of over a flat picture.
  // ---------------------------------------------------------------------------
  /** Multi-octave value noise painted over a canvas (soft, tileable enough at these repeats). */
  function paintGrain(g: CanvasRenderingContext2D, S: number, r: () => number, alpha: number, octaves = [8, 24, 64, 160]) {
    const n = document.createElement("canvas");
    for (const o of octaves) {
      n.width = n.height = o;
      const ng = n.getContext("2d")!;
      const img = ng.createImageData(o, o);
      for (let i = 0; i < o * o; i++) {
        const v = Math.round(r() * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ng.putImageData(img, 0, 0);
      g.save();
      g.globalAlpha = alpha * (o <= 24 ? 0.9 : 0.55);
      g.globalCompositeOperation = "overlay";
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(n, 0, 0, S, S);
      g.restore();
    }
  }
  /** A tangent-space normal map from a greyscale height canvas (Sobel). */
  function normalFromHeight(h: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
    const S = h.width;
    const src = h.getContext("2d")!.getImageData(0, 0, S, S).data;
    const out = document.createElement("canvas");
    out.width = out.height = S;
    const og = out.getContext("2d")!;
    const img = og.createImageData(S, S);
    const H = (x: number, y: number) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
        const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * S + x) * 4;
        img.data[i] = Math.round((-dx / len) * 127 + 128);
        img.data[i + 1] = Math.round((dy / len) * 127 + 128);
        img.data[i + 2] = Math.round((1 / len) * 127 + 128);
        img.data[i + 3] = 255;
      }
    }
    og.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  function desat(c: [number, number, number], k: number): [number, number, number] {
    const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    return [c[0] + (l - c[0]) * k, c[1] + (l - c[1]) * k, c[2] + (l - c[2]) * k];
  }

  function stoneTexture(seed: number, opts: { rows: number; cols: number; mossy?: number; cracks?: number; lava?: boolean }): TexSet {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const b = document.createElement("canvas");
    b.width = b.height = S;
    const h = b.getContext("2d")!;
    const rc = document.createElement("canvas");
    rc.width = rc.height = S;
    const rg = rc.getContext("2d")!;
    const r = rng(seed);
    // real stone is greyer and browner than a game palette: pull the colours towards a weathered grey
    const A = desat(hexRgb(D.stoneA), 0.35);
    const B = desat(hexRgb(D.stoneB), 0.25);
    const M = hexRgb(D.mortar);
    g.fillStyle = `rgb(${M[0]},${M[1]},${M[2]})`;
    g.fillRect(0, 0, S, S);
    paintGrain(g, S, r, 0.5, [32, 96, 256]);
    h.fillStyle = "#1a1a1a";
    h.fillRect(0, 0, S, S);
    rg.fillStyle = "#f2f2f2";
    rg.fillRect(0, 0, S, S);
    // courses of slightly different heights, blocks of different lengths (ashlar, not bricks)
    const courses: number[] = [];
    let total = 0;
    for (let i = 0; i < opts.rows; i++) {
      const v = 0.8 + r() * 0.45;
      courses.push(v);
      total += v;
    }
    let y = 0;
    for (let row = 0; row < opts.rows; row++) {
      const rh = (courses[row]! / total) * S;
      let x = -r() * (S / opts.cols);
      while (x < S) {
        const w = (S / opts.cols) * (0.6 + r() * 0.85);
        const gap = 5 + r() * 3;
        const rx = x + gap / 2, ry = y + gap / 2, rw = w - gap, rhh = rh - gap;
        const t = 0.3 + r() * 0.35;
        const base = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
        // a warm or cool drift per block, like stone from different parts of the quarry
        const drift = (r() - 0.5) * 10;
        const col = `rgb(${Math.round(base[0] + drift)},${Math.round(base[1] + drift * 0.8)},${Math.round(base[2] + drift * 0.5)})`;
        const rad = 6 + r() * 8;
        // chipped outline: a rounded block whose corners lose bits
        const shape = () => {
          const p = new Path2D();
          const jit = () => (r() - 0.5) * 3.5;
          p.moveTo(rx + rad, ry + jit());
          p.lineTo(rx + rw * 0.5, ry + jit());
          p.lineTo(rx + rw - rad, ry + jit());
          p.quadraticCurveTo(rx + rw + jit(), ry + jit(), rx + rw + jit(), ry + rad);
          p.lineTo(rx + rw + jit(), ry + rhh * 0.5);
          p.lineTo(rx + rw + jit(), ry + rhh - rad);
          p.quadraticCurveTo(rx + rw + jit(), ry + rhh + jit(), rx + rw - rad, ry + rhh + jit());
          p.lineTo(rx + rw * 0.5, ry + rhh + jit());
          p.lineTo(rx + rad, ry + rhh + jit());
          p.quadraticCurveTo(rx + jit(), ry + rhh + jit(), rx + jit(), ry + rhh - rad);
          p.lineTo(rx + jit(), ry + rhh * 0.5);
          p.lineTo(rx + jit(), ry + rad);
          p.quadraticCurveTo(rx + jit(), ry + jit(), rx + rad, ry + jit());
          p.closePath();
          return p;
        };
        const path = shape();
        g.fillStyle = col;
        g.fill(path);
        // height: a bevelled face — darker at the edges, rising into a slightly uneven top
        const hv = 120 + Math.round(r() * 50);
        for (let k = 0; k < 5; k++) {
          const inset = k * 2.2;
          h.fillStyle = `rgb(${hv + k * 14},${hv + k * 14},${hv + k * 14})`;
          h.beginPath();
          h.roundRect(rx + inset, ry + inset, Math.max(2, rw - inset * 2), Math.max(2, rhh - inset * 2), Math.max(1, rad - inset));
          h.fill();
        }
        // a slight tilt of each block's face catches the light differently
        const tilt = h.createLinearGradient(rx, ry, rx + rw * (r() - 0.5), ry + rhh);
        tilt.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.08})`);
        tilt.addColorStop(1, `rgba(0,0,0,${0.05 + r() * 0.08})`);
        h.fillStyle = tilt;
        h.fill(path);
        // roughness: worn faces a touch smoother than the mortar
        const rv = 200 + Math.round(r() * 40);
        rg.fillStyle = `rgb(${rv},${rv},${rv})`;
        rg.fill(path);
        // edge shading on the colour: darker rim, a lighter worn top edge
        g.save();
        g.clip(path);
        const eg = g.createLinearGradient(0, ry, 0, ry + rhh);
        eg.addColorStop(0, "rgba(255,255,255,0.10)");
        eg.addColorStop(0.15, "rgba(255,255,255,0)");
        eg.addColorStop(0.8, "rgba(0,0,0,0)");
        eg.addColorStop(1, "rgba(0,0,0,0.28)");
        g.fillStyle = eg;
        g.fillRect(rx - 4, ry - 4, rw + 8, rhh + 8);
        // pits and lichen specks
        for (let k = 0; k < 26; k++) {
          const px = rx + r() * rw, py = ry + r() * rhh, pr = 0.8 + r() * 2.6;
          g.fillStyle = r() < 0.75 ? `rgba(0,0,0,${0.06 + r() * 0.1})` : `rgba(210,200,170,${0.05 + r() * 0.06})`;
          g.beginPath();
          g.arc(px, py, pr, 0, Math.PI * 2);
          g.fill();
          h.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.3})`;
          h.beginPath();
          h.arc(px, py, pr * 0.8, 0, Math.PI * 2);
          h.fill();
        }
        g.restore();
        x += w;
      }
      y += rh;
    }
    // fine grain over everything (colour and height)
    paintGrain(g, S, r, 0.22, [8, 24, 64]);
    paintGrain(h, S, r, 0.3, [48, 120]);
    // moss and lichen creeping up from the bottom, thickest in the joints
    if (opts.mossy && D.moss) {
      const Mo = hexRgb(D.moss);
      for (let k = 0; k < 520 * opts.mossy; k++) {
        const x = r() * S;
        const yy = S - Math.pow(r(), 2.2) * S * 0.75;
        g.fillStyle = `rgba(${Mo[0]},${Mo[1]},${Mo[2]},${0.12 + r() * 0.28})`;
        g.beginPath();
        g.arc(x, yy, 2 + r() * 10, 0, Math.PI * 2);
        g.fill();
      }
    }
    // rain streaks running down from the joints
    for (let k = 0; k < 40; k++) {
      const x = r() * S;
      const y0 = r() * S;
      const len = 80 + r() * 300;
      const grd = g.createLinearGradient(x, y0, x, y0 + len);
      grd.addColorStop(0, `rgba(20,16,12,${0.12 + r() * 0.12})`);
      grd.addColorStop(1, "rgba(20,16,12,0)");
      g.fillStyle = grd;
      g.fillRect(x, y0, 2 + r() * 5, len);
    }
    // damage cracks
    if (opts.cracks) {
      g.lineCap = h.lineCap = "round";
      for (let k = 0; k < opts.cracks; k++) {
        let x = r() * S;
        let yy = r() * S * 0.6;
        g.strokeStyle = "rgba(10,8,6,0.85)";
        h.strokeStyle = "#000";
        g.lineWidth = 2.5;
        h.lineWidth = 5;
        g.beginPath();
        h.beginPath();
        g.moveTo(x, yy);
        h.moveTo(x, yy);
        for (let st = 0; st < 12; st++) {
          x += (r() - 0.5) * 50;
          yy += 22 + r() * 30;
          g.lineTo(x, yy);
          h.lineTo(x, yy);
        }
        g.stroke();
        h.stroke();
      }
    }
    if (opts.lava) {
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 8; k++) {
        let x = r() * S;
        let yy = S * (0.55 + r() * 0.45);
        g.strokeStyle = "rgba(255,110,30,0.5)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, yy);
        for (let st = 0; st < 7; st++) {
          x += (r() - 0.5) * 60;
          yy -= 14 + r() * 24;
          g.lineTo(x, yy);
        }
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    const bump = new THREE.CanvasTexture(b);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    const rough = new THREE.CanvasTexture(rc);
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
    return { map, bump, normal: normalFromHeight(b, 2.6), rough };
  }

  function roofTexture(seed: number): TexSet {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const b = document.createElement("canvas");
    b.width = b.height = S;
    const h = b.getContext("2d")!;
    const r = rng(seed);
    // weathered: the skin's roof colour, aged towards slate grey and soot
    const A = desat(hexRgb(D.roof), D.roofMetal ? 0.1 : 0.42);
    const Bc = desat(hexRgb(D.roofDark), 0.3);
    g.fillStyle = `rgb(${Bc[0]},${Bc[1]},${Bc[2]})`;
    g.fillRect(0, 0, S, S);
    h.fillStyle = "#000";
    h.fillRect(0, 0, S, S);
    const rows = 22;
    const rh = S / rows;
    for (let row = 0; row < rows; row++) {
      const cols = 16;
      const cw = S / cols;
      for (let col = -1; col <= cols; col++) {
        const x = (col + (row % 2) * 0.5) * cw + (r() - 0.5) * 3;
        const yy = row * rh;
        const t = r();
        const drift = (r() - 0.5) * 22;
        const base = [A[0] + (Bc[0] - A[0]) * t * 0.7 + drift, A[1] + (Bc[1] - A[1]) * t * 0.7 + drift * 0.7, A[2] + (Bc[2] - A[2]) * t * 0.7 + drift * 0.6];
        const w = cw * (0.92 + r() * 0.1);
        const tail = rh * (1.25 + r() * 0.2);
        const p = new Path2D();
        p.moveTo(x + 2, yy);
        p.lineTo(x + w - 2, yy);
        p.lineTo(x + w - 3, yy + tail * 0.8);
        p.quadraticCurveTo(x + w / 2, yy + tail * (1.0 + (r() - 0.5) * 0.12), x + 3, yy + tail * 0.8);
        p.closePath();
        g.fillStyle = `rgb(${Math.round(base[0])},${Math.round(base[1])},${Math.round(base[2])})`;
        g.fill(p);
        // each tile's lower lip catches light, its upper part sits in the shadow of the row above
        g.save();
        g.clip(p);
        const sg = g.createLinearGradient(0, yy, 0, yy + tail);
        sg.addColorStop(0, "rgba(0,0,0,0.45)");
        sg.addColorStop(0.35, "rgba(0,0,0,0.05)");
        sg.addColorStop(0.92, "rgba(255,255,255,0.08)");
        sg.addColorStop(1, "rgba(0,0,0,0.3)");
        g.fillStyle = sg;
        g.fillRect(x, yy, w, tail);
        g.restore();
        const hg = h.createLinearGradient(0, yy, 0, yy + tail);
        hg.addColorStop(0, "#303030");
        hg.addColorStop(0.85, "#e8e8e8");
        hg.addColorStop(1, "#a0a0a0");
        h.fillStyle = hg;
        h.fill(p);
        // lichen and a few broken corners
        if (r() < 0.12) {
          g.fillStyle = `rgba(${150 + r() * 40},${150 + r() * 30},${90 + r() * 30},0.35)`;
          g.beginPath();
          g.arc(x + r() * w, yy + rh * (0.5 + r() * 0.5), 3 + r() * 6, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    paintGrain(g, S, r, 0.18, [8, 24, 64]);
    // soot and rain darkening down the slope
    for (let k = 0; k < 30; k++) {
      const x = r() * S;
      const grd = g.createLinearGradient(x, 0, x, S);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(1, `rgba(10,8,6,${0.08 + r() * 0.1})`);
      g.fillStyle = grd;
      g.fillRect(x, 0, 8 + r() * 24, S);
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    const bump = new THREE.CanvasTexture(b);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    return { map, bump, normal: normalFromHeight(b, 3.2) };
  }

  /**
   * WEATHERING — patched into every stone and roof material: grime and damp
   * darkening the lowest courses, moss tint at the foot of the walls, and
   * broad, soft patches of lighter and darker stone across whole walls so no
   * two stretches repeat the same tile.
   */
  function weather(mat: THREE.MeshStandardMaterial, kind: "stone" | "roof"): void {
    const moss = new THREE.Color(D.moss ?? D.ground);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMoss = { value: moss };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWPos;
uniform vec3 uMoss;
float wh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float wn(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(wh(i),wh(i+vec3(1,0,0)),f.x),mix(wh(i+vec3(0,1,0)),wh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(wh(i+vec3(0,0,1)),wh(i+vec3(1,0,1)),f.x),mix(wh(i+vec3(0,1,1)),wh(i+vec3(1,1,1)),f.x),f.y),f.z); }`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
{
  vec3 q = vWPos * 0.045;
  float big = wn(q) * 0.6 + wn(q * 2.7) * 0.4;
  diffuseColor.rgb *= mix(0.72, 1.12, big);
  ${kind === "stone" ? `
  float low = 1.0 - smoothstep(0.0, 40.0, vWPos.y);
  float m = low * smoothstep(0.35, 0.75, wn(vWPos * 0.12));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, low * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, uMoss * 0.8, m * 0.45);
  float streak = smoothstep(0.62, 0.9, wn(vec3(vWPos.x * 0.35, vWPos.y * 0.02, vWPos.z * 0.35)));
  diffuseColor.rgb *= 1.0 - streak * 0.18;` : `
  float soot = smoothstep(0.55, 0.85, wn(vWPos * 0.08));
  diffuseColor.rgb *= 1.0 - soot * 0.25;`}
}`,
        );
    };
    mat.customProgramCacheKey = () => `castle-weather-${kind}`;
  }

  function woodTexture(): TexSet {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const b = document.createElement("canvas");
    b.width = b.height = S;
    const h = b.getContext("2d")!;
    const r = rng(7);
    const planks = 6;
    for (let i = 0; i < planks; i++) {
      const x = (i * S) / planks;
      const w = S / planks;
      const v = 70 + Math.round(r() * 30);
      g.fillStyle = `rgb(${v + 20},${Math.round(v * 0.62)},${Math.round(v * 0.32)})`;
      g.fillRect(x, 0, w, S);
      for (let k = 0; k < 30; k++) {
        g.strokeStyle = `rgba(30,15,5,${0.15 + r() * 0.2})`;
        g.lineWidth = 1;
        const gx = x + r() * w;
        g.beginPath();
        g.moveTo(gx, 0);
        g.bezierCurveTo(gx + 3, S * 0.3, gx - 3, S * 0.6, gx + 2, S);
        g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(x, 0, 2, S);
      h.fillStyle = "#c0c0c0";
      h.fillRect(x + 2, 0, w - 2, S);
      h.fillStyle = "#202020";
      h.fillRect(x, 0, 2, S);
    }
    // Iron bands.
    for (const y of [0.18, 0.55, 0.85]) {
      g.fillStyle = "#2a2622";
      g.fillRect(0, y * S, S, 14);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(0, y * S, S, 2);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = "#4a4440";
        g.beginPath();
        g.arc(12 + i * 32, y * S + 7, 3, 0, Math.PI * 2);
        g.fill();
      }
      h.fillStyle = "#ffffff";
      h.fillRect(0, y * S, S, 14);
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(b);
    return { map, bump };
  }

  const stoneSets = STONE_SET_CACHE;
  function stoneMat(key: string, repeatX: number, repeatY: number, opts: { rows?: number; cols?: number; mossy?: number } = {}): THREE.MeshStandardMaterial {
    const cracks = TIER >= 2 ? (TIER - 1) * 3 : 0;
    const setKey = `${BIOME}|${SKIN}|${TIER}|${key}:${opts.rows ?? 10}:${opts.cols ?? 5}:${opts.mossy ?? 0}`;
    let set = stoneSets.get(setKey);
    if (!set) {
      set = stoneTexture(key.length * 31 + (opts.rows ?? 10), { rows: opts.rows ?? 10, cols: opts.cols ?? 5, mossy: opts.mossy, cracks, lava: D.lava });
      stoneSets.set(setKey, set);
    }
    const map = set.map.clone();
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    const bump = set.bump.clone();
    bump.repeat.set(repeatX, repeatY);
    bump.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0.0 });
    if (set.normal) {
      const nm = set.normal.clone();
      nm.repeat.set(repeatX, repeatY);
      nm.needsUpdate = true;
      mat.normalMap = nm;
      mat.normalScale = new THREE.Vector2(1.15, 1.15);
    } else {
      mat.bumpMap = bump;
      mat.bumpScale = 2.2;
    }
    if (set.rough) {
      const rm = set.rough.clone();
      rm.repeat.set(repeatX, repeatY);
      rm.needsUpdate = true;
      mat.roughnessMap = rm;
    }
    weather(mat, "stone");
    if (ARCH.wall === "ice") {
      mat.roughness = 0.18;
      mat.roughnessMap = null;
      mat.metalness = 0.15;
      mat.emissive = new THREE.Color("#4a8ac8");
      mat.emissiveIntensity = 0.22;
    } else if (ARCH.wall === "glass") {
      mat.roughness = 0.3;
      mat.metalness = 0.45;
      mat.roughnessMap = null;
    } else if (ARCH.wall === "marble") {
      mat.roughness = 0.45;
      mat.roughnessMap = null;
      mat.normalScale = new THREE.Vector2(0.5, 0.5);
    } else if (ARCH.wall === "wood") {
      const w = woodSet ?? (woodSet = woodTexture());
      const wm = w.map.clone();
      wm.wrapS = wm.wrapT = THREE.RepeatWrapping;
      wm.repeat.set(repeatX * 1.4, repeatY * 0.6);
      wm.needsUpdate = true;
      mat.map = wm;
      mat.bumpMap = null;
      mat.normalMap = null;
      mat.roughnessMap = null;
      mat.roughness = 0.85;
    }
    return mat;
  }
  let woodSet: TexSet | null = null;

  // ---------------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------------
  const root = new THREE.Group();
  const anchors: Record<string, THREE.Vector3> = {};

  function addBox(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Crenellated parapet along a straight wall top. */
  function battlementLine(x0: number, x1: number, y: number, z: number, depth: number, broken: Set<number> = new Set()) {
    const merlonW = 3.4;
    const gap = 2.6;
    const n = Math.floor((x1 - x0 + gap) / (merlonW + gap));
    const total = n * merlonW + (n - 1) * gap;
    const start = (x0 + x1) / 2 - total / 2;
    const mat = stoneMat("merlon", 0.5, 0.5, { rows: 4, cols: 3 });
    mat.color.setScalar(0.78);
    for (let i = 0; i < n; i++) {
      if (broken.has(i)) continue;
      const mx = start + i * (merlonW + gap) + merlonW / 2;
      addBox(merlonW, 4.2, depth, mx, y, z, mat);
      if (D.snow) addBox(merlonW + 0.4, 0.9, depth + 0.4, mx, y + 4.2, z, snowMat);
    }
    // Walkway lip.
    addBox(x1 - x0 + 1, 1.2, depth + 1.2, (x0 + x1) / 2, y - 1.2, z, stoneMat("lip", (x1 - x0) / 20, 0.15, { rows: 2, cols: 8 }));
  }

  /** Ring of merlons around a round tower top. */
  function battlementRing(cx: number, y: number, cz: number, radius: number, count: number, broken: Set<number> = new Set()) {
    const mat = stoneMat("merlon", 0.5, 0.5, { rows: 4, cols: 3 });
    mat.color.setScalar(0.78);
    for (let i = 0; i < count; i++) {
      if (broken.has(i)) continue;
      const a = (i / count) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.4, 2.4), mat);
      m.position.set(cx + Math.cos(a) * radius, y + 2.2, cz + Math.sin(a) * radius);
      m.rotation.y = -a;
      m.castShadow = m.receiveShadow = true;
      root.add(m);
      if (D.snow) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(4, 0.9, 2.8), snowMat);
        s.position.set(m.position.x, y + 4.8, m.position.z);
        s.rotation.y = -a;
        root.add(s);
      }
    }
    // Corbelled ring under the parapet.
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius + 1.4, radius + 0.2, 2.4, 28, 1, true), stoneMat("corbel", 4, 0.2, { rows: 2, cols: 10 }));
    ring.position.set(cx, y - 1.2, cz);
    ring.castShadow = true;
    root.add(ring);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius + 1.4, radius + 1.4, 0.6, 28), stoneMat("floor", 2, 2, { rows: 6, cols: 6 }));
    floor.position.set(cx, y, cz);
    root.add(floor);
  }

  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf2f8ff, roughness: 0.8 });
  const roofKey = `${BIOME}|${SKIN}`;
  const roofSet = ROOF_SET_CACHE.get(roofKey) ?? roofTexture(3);
  ROOF_SET_CACHE.set(roofKey, roofSet);
  function roofMat(repX: number, repY: number) {
    const map = roofSet.map.clone();
    map.repeat.set(repX, repY);
    map.needsUpdate = true;
    const bump = roofSet.bump.clone();
    bump.repeat.set(repX, repY);
    bump.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ map, roughness: D.roofMetal ? 0.35 : 0.82, metalness: D.roofMetal ?? 0.0 });
    if (roofSet.normal) {
      const nm = roofSet.normal.clone();
      nm.repeat.set(repX, repY);
      nm.needsUpdate = true;
      m.normalMap = nm;
      m.normalScale = new THREE.Vector2(1.3, 1.3);
    } else {
      m.bumpMap = bump;
      m.bumpScale = 1.6;
    }
    weather(m, "roof");
    if (D.frostRoof) {
      m.transparent = true;
      m.opacity = 0.92;
      m.emissive = new THREE.Color("#3a7ab0");
      m.emissiveIntensity = 0.35;
      m.roughness = 0.25;
    }
    return m;
  }

  /** Tree crowns instead of a roof (Verdant Hold): a cluster of leafy blobs; its "height" is how far the crown reaches up. */
  function foliageRoof(radius: number, _baseY: number): { mesh: THREE.Mesh; height: number } {
    const g = new THREE.Group();
    const r = rng(Math.round(radius * 7));
    const a = new THREE.MeshStandardMaterial({ color: 0x3f7a24, roughness: 0.9 });
    const b = new THREE.MeshStandardMaterial({ color: 0x5f9a34, roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * (0.45 + r() * 0.3), 1), i % 2 ? a : b);
      blob.position.set((r() - 0.5) * radius * 1.2, r() * radius * 0.9, (r() - 0.5) * radius * 1.0);
      blob.castShadow = true;
      g.add(blob);
    }
    // wrap the group in a mesh-like holder so callers can position it
    const holder = new THREE.Mesh(new THREE.BufferGeometry(), a);
    holder.add(g);
    return { mesh: holder, height: radius * 1.6 };
  }

  /** A roof in the skin's shape: cone (default), dome (Solar/Eternal) or tall spire (Frost/Infernal/Void). */
  function skinRoof(radius: number, height: number, segments: number, repX: number, repY: number): { mesh: THREE.Mesh; height: number } {
    const kind = D.roofKind ?? "cone";
    if (kind === "flat") {
      // a low slab behind the battlements: a fortress with a flat fighting top
      return { mesh: new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.82, 2.2, segments, 1), roofMat(repX, repY)), height: 2.2 };
    }
    if (kind === "dome") {
      const g = new THREE.SphereGeometry(radius * 0.92, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(g, roofMat(repX, repY));
      mesh.scale.y = 1.15;
      return { mesh, height: radius * 1.05 };
    }
    const h = kind === "spire" ? height * 1.45 : height;
    const r = kind === "spire" ? radius * 0.85 : radius;
    return { mesh: new THREE.Mesh(new THREE.ConeGeometry(r, h, segments, 1), roofMat(repX, repY)), height: h };
  }
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x120a04, emissive: new THREE.Color(D.window), emissiveIntensity: 0.75, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0906, roughness: 1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.5, metalness: 0.7 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });

  function arrowSlit(x: number, y: number, z: number, faceAngle: number, w = 1.1, h = 4) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), windowMat);
    m.position.set(x, y, z);
    m.rotation.y = faceAngle;
    root.add(m);
    return m;
  }

  function flagPole(x: number, yBase: number, z: number, height: number, key: string) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, height, 8), poleMat);
    pole.position.set(x, yBase + height / 2, z);
    pole.castShadow = true;
    root.add(pole);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 0.8, roughness: 0.3 }));
    knob.position.set(x, yBase + height, z);
    root.add(knob);
    anchors[key] = new THREE.Vector3(x, yBase + height - 0.8, z);
  }

  // ---------------------------------------------------------------------------
  // The castle
  // ---------------------------------------------------------------------------
  function build() {
    // Rocky mound the fortress stands on.
    const moundGeo = new THREE.CylinderGeometry(50, 56, 5, 48, 3);
    const pos = moundGeo.attributes.position!;
    const r = rng(11);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 3.9) {
        const x = pos.getX(i), z = pos.getZ(i);
        const k = 1 + (r() - 0.5) * 0.08;
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
      }
    }
    moundGeo.computeVertexNormals();
    const mound = new THREE.Mesh(moundGeo, stoneMat("mound", 8, 0.6, { rows: 3, cols: 12, mossy: 1 }));
    mound.position.y = -2.5;
    mound.name = "mound";
    mound.receiveShadow = true;
    root.add(mound);
    const yardMat = stoneMat("yard", 6, 6, { rows: 12, cols: 12, mossy: 0.8 });
    yardMat.color = new THREE.Color(D.ground).lerp(new THREE.Color(0xffffff), 0.35);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 0.4, 48), yardMat);
    yard.position.y = 0;
    yard.name = "yard";
    yard.receiveShadow = true;
    root.add(yard);

    // ---- Rear keep (tall square donjon) ----
    const keepW = 26, keepD = 22, keepH = ARCH.keepH, keepZ = -18;
    const keepMat = stoneMat("keep", 2, 5, { rows: 7, cols: 3, mossy: 0.6 });
    if (ARCH.keep === "box") {
      addBox(keepW, keepH, keepD, 0, 0, keepZ, keepMat);
      // Buttress corners.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        addBox(4, keepH + 2, 4, sx * (keepW / 2), 0, keepZ + sz * (keepD / 2), stoneMat("buttress", 0.4, 6.5, { rows: 10, cols: 2 }));
      }
    } else {
      const seg = { round: 36, octagon: 8, hex: 6, jagged: 5, tree: 12 }[ARCH.keep];
      const top = ARCH.keep === "hex" ? 9 : ARCH.keep === "jagged" ? 9 : ARCH.keep === "tree" ? 8 : 13;
      const bottom = ARCH.keep === "jagged" ? 17 : ARCH.keep === "tree" ? 12 : 14;
      const mat = ARCH.keep === "tree" ? new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 1, bumpMap: keepMat.bumpMap, bumpScale: 3 }) : keepMat;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, keepH, seg, 1), mat);
      body.position.set(0, keepH / 2, keepZ);
      body.rotation.y = ARCH.keep === "jagged" ? 0.3 : 0;
      body.castShadow = body.receiveShadow = true;
      root.add(body);
      if (ARCH.keep === "tree") {
        // great roots spreading over the mound
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const rootM = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.4, 20, 6), mat);
          rootM.position.set(Math.cos(a) * 14, 4, keepZ + Math.sin(a) * 12);
          rootM.rotation.z = Math.cos(a) * 1.1;
          rootM.rotation.x = -Math.sin(a) * 1.1;
          root.add(rootM);
        }
      }
      if (ARCH.keep === "jagged") {
        // shards breaking out of the keep's sides
        const r2 = rng(13);
        for (let i = 0; i < 9; i++) {
          const a = r2() * Math.PI * 2;
          const y = 10 + r2() * (keepH - 20);
          const shard = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12 + r2() * 8, 4), keepMat);
          const rad = 15 - (y / keepH) * 6;
          shard.position.set(Math.cos(a) * rad, y, keepZ + Math.sin(a) * rad);
          shard.rotation.z = -Math.cos(a) * 1.2;
          shard.rotation.x = Math.sin(a) * 1.2;
          root.add(shard);
        }
      }
    }
    // Windows on the keep face.
    for (const wy of [22, 38, 54]) {
      for (const wx of wy === 54 ? [0] : [-6, 6]) {
        // a stone surround with a deep reveal, then the lit glass set back inside it
        const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.8, 0.9), stoneMat("sill", 0.3, 0.4, { rows: 3, cols: 2 }));
        frame.position.set(wx, wy, keepZ + (ARCH.keep === "box" ? keepD / 2 + 0.1 : 13.4 - (wy / keepH) * 2));
        frame.castShadow = true;
        root.add(frame);
        const reveal = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.2, 0.5), darkMat);
        reveal.position.set(wx, wy, keepZ + (ARCH.keep === "box" ? keepD / 2 + 0.4 : 13.7 - (wy / keepH) * 2));
        root.add(reveal);
        const arch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 0.4), windowMat);
        arch.position.set(wx, wy - 0.3, keepZ + (ARCH.keep === "box" ? keepD / 2 + 0.6 : 13.9 - (wy / keepH) * 2));
        root.add(arch);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 1.6), stoneMat("sill", 0.3, 0.1, { rows: 2, cols: 2 }));
        sill.position.set(wx, wy - 2.8, keepZ + (ARCH.keep === "box" ? keepD / 2 + 0.6 : 14 - (wy / keepH) * 2));
        root.add(sill);
      }
    }
    anchors.keepWindow = new THREE.Vector3(0, 54, keepZ + keepD / 2 + 0.5);
    // Keep top: parapet + steep slate pyramid roof.
    if (ARCH.keep === "box") {
      battlementLine(-keepW / 2, keepW / 2, keepH, keepZ + keepD / 2, 2.4, TIER >= 4 ? new Set([1, 3]) : new Set());
      battlementLine(-keepW / 2, keepW / 2, keepH, keepZ - keepD / 2, 2.4);
    } else if (ARCH.keep === "round" || ARCH.keep === "octagon") {
      battlementRing(0, keepH, keepZ, 13.2, 14, TIER >= 4 ? new Set([2, 5]) : new Set());
    }
    const keepRoofR = ARCH.keep === "box" ? keepW * 0.62 : ARCH.keep === "tree" ? 22 : ARCH.keep === "hex" || ARCH.keep === "jagged" ? 11 : 15;
    const kr = ARCH.keep === "tree" ? foliageRoof(keepRoofR, keepH) : skinRoof(keepRoofR, TIER >= 4 ? 16 : 26, D.roofKind === "dome" ? 32 : ARCH.keep === "box" ? 4 : ARCH.keep === "hex" ? 6 : ARCH.keep === "jagged" ? 5 : 8, 3, 3);
    const keepRoofH = kr.height;
    const keepRoof = kr.mesh;
    keepRoof.rotation.y = ARCH.keep === "box" ? Math.PI / 4 : 0;
    keepRoof.position.set(0, ARCH.keep === "tree" ? keepH - 6 : D.roofKind === "dome" ? keepH + 1 : keepH + keepRoofH / 2 + 1, keepZ);
    keepRoof.castShadow = true;
    root.add(keepRoof);
    if (D.snow) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(keepW * 0.3, keepRoofH * 0.45, 4, 1), snowMat);
      cap.rotation.y = Math.PI / 4;
      cap.position.set(0, keepH + keepRoofH * 0.78 + 1, keepZ);
      root.add(cap);
    }
    flagPole(0, keepH + keepRoofH, keepZ, 10, "bannerKeep");

    // ---- Side curtain walls (front towers back to the rear towers) and the rear wall behind the keep ----
    for (const sx of [-1, 1]) {
      const wall = addBox(4, 24, 42, sx * 31.5, 0, -16, stoneMat("sidewall", 1.6, 2, { rows: 7, cols: 8, mossy: 0.5 }));
      wall.position.y = 12;
      anchors[sx < 0 ? "postWallL" : "postWallR"] = new THREE.Vector3(sx * 31.5, 24, -16);
    }
    {
      const rearWall = addBox(58, 22, 4, 0, 0, -39, stoneMat("rearwall", 4, 2, { rows: 7, cols: 10, mossy: 0.5 }));
      rearWall.position.y = 11;
      battlementLine(-27, 27, 22, -37.5, 2);
    }

    // ---- Front curtain wall with gatehouse ----
    const wallH = 28, frontZ = 8, wallD = 6;
    for (const sx of [-1, 1]) {
      addBox(13, wallH, wallD, sx * 16.5, 0, frontZ, stoneMat("frontwall", 1, 2.2, { rows: 7, cols: 3, mossy: 1 }));
      battlementLine(sx * 10, sx * 23, wallH, frontZ + wallD / 2 - 1, 2, TIER >= 3 && sx < 0 ? new Set([0]) : new Set());
    }
    // Gatehouse: a taller block with an arched passage (extruded shape with an arch-shaped hole).
    const gw = 20, gh = 36, gd = 9;
    const shape = new THREE.Shape();
    shape.moveTo(-gw / 2, 0);
    shape.lineTo(gw / 2, 0);
    shape.lineTo(gw / 2, gh);
    shape.lineTo(-gw / 2, gh);
    shape.closePath();
    const hole = new THREE.Path();
    const aw = 6.2, ah = 15;
    hole.moveTo(-aw, 0);
    hole.lineTo(-aw, ah);
    hole.absarc(0, ah, aw, Math.PI, 0, true);
    hole.lineTo(aw, 0);
    hole.closePath();
    shape.holes.push(hole);
    const gateGeo = new THREE.ExtrudeGeometry(shape, { depth: gd, bevelEnabled: false });
    // UVs for ExtrudeGeometry are in shape units — scale the texture accordingly.
    const gateMat = stoneMat("gatehouse", 1 / 22, 1 / 6, { rows: 7, cols: 3, mossy: 0.8 });
    const gate = new THREE.Mesh(gateGeo, gateMat);
    gate.position.set(0, 0, frontZ - gd / 2 + 2);
    gate.castShadow = gate.receiveShadow = true;
    root.add(gate);
    // Dark passage behind the arch.
    addBox(aw * 2, ah + aw, 1, 0, 0, frontZ - gd / 2 + 2.5, darkMat);
    // Wooden doors (slightly recessed) and a half-raised iron portcullis.
    const wood = woodTexture();
    const doorMat = new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.85 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(aw * 2, ah + aw * 0.9), doorMat);
    door.position.set(0, (ah + aw * 0.9) / 2, frontZ - gd / 2 + 3.2);
    door.name = "gateDoor";
    root.add(door);
    // the portcullis bars live in their own group so a live renderer can raise it
    const portcullis = new THREE.Group();
    portcullis.name = "portcullis";
    root.add(portcullis);
    const gridTop = ah + aw - 1;
    const gridBottom = TIER >= 3 ? 2 : 7;
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, gridTop - gridBottom, 0.7), ironMat);
      bar.position.set(i * 2.4, (gridTop + gridBottom) / 2, frontZ + 2.2 + gd / 2 - 3);
      portcullis.add(bar);
    }
    for (let j = 0; j < 4; j++) {
      const yb = gridBottom + 1 + j * ((gridTop - gridBottom - 2) / 3);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(aw * 2 - 0.6, 0.6, 0.6), ironMat);
      bar.position.set(0, yb, frontZ + 2.2 + gd / 2 - 3);
      portcullis.add(bar);
    }
    // Keystone crystal (the castle's magic core) above the arch.
    const coreMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.core), emissive: new THREE.Color(D.core), emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.1 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), coreMat);
    core.position.set(0, ah + aw + 3.8, frontZ + 2.2 + gd / 2 - 1.4);
    core.scale.set(0.8, 1.25, 0.8);
    core.name = "core";
    root.add(core);
    anchors.core = core.position.clone();
    // Gatehouse parapet.
    battlementLine(-gw / 2, gw / 2, gh, frontZ + 2.2 + gd / 2 - 1.2, 2);
    battlementLine(-gw / 2, gw / 2, gh, frontZ + 2.2 - gd / 2 + 1.2, 2);
    // Small banner pole over the gate.
    flagPole(0, gh, frontZ, 8, "bannerGate");
    // Gate torches (brackets) — the 2D layer draws the flames.
    for (const sx of [-1, 1]) {
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 3, 8), ironMat);
      bracket.position.set(sx * 8.5, 15, frontZ + 2.2 + gd / 2 + 0.4);
      root.add(bracket);
      anchors[sx < 0 ? "torchL" : "torchR"] = new THREE.Vector3(sx * 8.5, 17.5, frontZ + 2.2 + gd / 2 + 0.4);
    }
    anchors.gate = new THREE.Vector3(0, 8, frontZ + 2.2 + gd / 2);
    anchors.postGate = new THREE.Vector3(0, gh, frontZ + 2.2);
    anchors.postFrontL = new THREE.Vector3(-16.5, wallH, frontZ);
    anchors.postFrontR = new THREE.Vector3(16.5, wallH, frontZ);

    // ---- Four corner towers: two flanking the gate, two at the back (where the garrison stands) ----
    for (const [sx, rear] of [[-1, false], [1, false], [-1, true], [1, true]] as const) {
      const tx = sx * (rear ? 31.5 : 34), tz = rear ? -39 : 6, tr = ARCH.towerR * (rear ? 0.9 : 1), th = ARCH.towerH * (rear ? 0.92 : 1);
      const broken = !rear && TIER >= 3 && sx < 0;
      const side = (rear ? "B" : "") + (sx < 0 ? "L" : "R");
      const height = broken ? th - 9 : th;
      const tseg = { round: 32, hex: 6, octagon: 8, jagged: 5, needle: 12, tree: 10, square: 4 }[ARCH.tower];
      const tMat = ARCH.tower === "tree" ? new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 1 }) : stoneMat("tower", 3.4, 4.2, { rows: 7, cols: 5, mossy: 1 });
      const topR = ARCH.tower === "needle" ? tr * 0.75 : ARCH.tower === "jagged" ? tr * 0.7 : ARCH.tower === "tree" ? tr * 0.7 : tr;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(topR, tr + (ARCH.tower === "jagged" ? 4 : 1.2), height, tseg), tMat);
      if (ARCH.tower === "square") tower.rotation.y = Math.PI / 4;
      tower.position.set(tx, height / 2, tz);
      tower.castShadow = tower.receiveShadow = true;
      root.add(tower);
      // Plinth flare at the base.
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(tr + 1.4, tr + 3, 5, 32), stoneMat("plinth", 4, 0.6, { rows: 2, cols: 10 }));
      plinth.position.set(tx, 2.5, tz);
      plinth.castShadow = plinth.receiveShadow = true;
      root.add(plinth);
      // Arrow slits facing the camera-ish.
      for (const sy of [14, 28]) arrowSlit(tx + Math.sin(-0.25 * sx) * (tr + 0.1), sy, tz + Math.cos(-0.25 * sx) * (tr + 0.1), -0.25 * sx);
      if (!broken) arrowSlit(tx, 40, tz + tr + 0.1, 0, 1.6, 3.2);
      if (!rear) anchors[sx < 0 ? "towerWindowL" : "towerWindowR"] = new THREE.Vector3(tx, 28, tz + tr);
      // GUARNIÇÃO — an archers' balcony round the tower, below the roof, where its soldiers stand
      {
        const by = Math.round((broken ? th - 9 : th) * 0.66);
        const br = tr + 3.2;
        const plank = woodSet ?? (woodSet = woodTexture());
        const deckMap = plank.map.clone();
        deckMap.wrapS = deckMap.wrapT = THREE.RepeatWrapping;
        deckMap.repeat.set(4, 0.3);
        deckMap.needsUpdate = true;
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(br, br - 1.2, 1.4, 20), new THREE.MeshStandardMaterial({ map: deckMap, color: 0x9a8070, roughness: 0.9 }));
        // timber brackets under the deck, braced into the tower wall
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a2814, roughness: 0.95 }));
          brace.position.set(tx + Math.cos(a) * (tr + 1.4), by - 2.2, tz + Math.sin(a) * (tr + 1.4));
          brace.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          brace.castShadow = true;
          root.add(brace);
        }
        deck.position.set(tx, by, tz);
        deck.castShadow = deck.receiveShadow = true;
        root.add(deck);
        const rail = new THREE.Mesh(new THREE.TorusGeometry(br - 0.2, 0.28, 4, 24), new THREE.MeshStandardMaterial({ color: 0x3a2814, roughness: 0.9 }));
        rail.rotation.x = Math.PI / 2;
        rail.position.set(tx, by + 2.6, tz);
        root.add(rail);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), rail.material);
          post.position.set(tx + Math.cos(a) * (br - 0.2), by + 1.3, tz + Math.sin(a) * (br - 0.2));
          root.add(post);
        }
        // front towers: the side facing the road; back towers: their outer front corner, so the keep never hides them
        anchors[`postTower${side}`] = rear
          ? new THREE.Vector3(tx + sx * (tr + 1.4) * 0.72, by + 0.7, tz + (tr + 1.4) * 0.72)
          : new THREE.Vector3(tx, by + 0.7, tz + (tr + 1.4));
      }
      if (broken) {
        // Jagged broken top: irregular stone chunks, no roof.
        const rr = rng(5);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const hh = 1 + rr() * 6;
          const chunk = new THREE.Mesh(new THREE.BoxGeometry(5, hh, 3), stoneMat("chunk", 0.5, 0.5, { rows: 4, cols: 3 }));
          chunk.position.set(tx + Math.cos(a) * (tr - 1), height + hh / 2, tz + Math.sin(a) * (tr - 1));
          chunk.rotation.y = -a;
          chunk.rotation.z = (rr() - 0.5) * 0.4;
          chunk.castShadow = true;
          root.add(chunk);
        }
        // Rubble at the base.
        for (let i = 0; i < 9; i++) {
          const s = 1.2 + rr() * 2.5;
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat("rubble", 0.3, 0.3, { rows: 3, cols: 3 }));
          rock.position.set(tx + (rr() - 0.3) * 16, s * 0.6, tz + 10 + rr() * 8);
          rock.rotation.set(rr() * 3, rr() * 3, rr() * 3);
          rock.castShadow = true;
          root.add(rock);
        }
        anchors.bannerTowerL = new THREE.Vector3(tx, height + 4, tz);
      } else {
        if (ARCH.tower === "round" || ARCH.tower === "octagon" || ARCH.tower === "square") battlementRing(tx, height, tz, topR + 0.2, ARCH.tower === "square" ? 8 : 12);
        const tr2 = ARCH.tower === "tree" ? foliageRoof(tr + 8, height) : skinRoof(topR + 2.4, ARCH.tower === "needle" ? 30 : 22, ARCH.tower === "hex" ? 6 : ARCH.tower === "jagged" ? 5 : ARCH.tower === "square" ? 4 : ARCH.tower === "octagon" ? 8 : 32, 5, 2);
        if (ARCH.tower === "square") tr2.mesh.rotation.y = Math.PI / 4;
        const roofH = tr2.height;
        const roof = tr2.mesh;
        roof.position.set(tx, ARCH.tower === "tree" ? height - 4 : D.roofKind === "dome" ? height + 2.5 : height + roofH / 2 + 2.5, tz);
        roof.castShadow = true;
        root.add(roof);
        if (D.snow) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry((tr + 2.4) * 0.5, roofH * 0.5, 32, 1), snowMat);
          cap.position.set(tx, height + roofH * 0.75 + 2.5, tz);
          root.add(cap);
        }
        flagPole(tx, height + roofH + 2, tz, 8, `bannerTower${side}`);
      }
    }

    if (SD) addSkinDressing();

    // ---- Biome dressing ----
    if (D.sand) {
      const rr = rng(9);
      for (let i = 0; i < 7; i++) {
        const dune = new THREE.Mesh(new THREE.SphereGeometry(8 + rr() * 6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8b880, roughness: 1 }));
        dune.scale.set(1.4, 0.28, 0.8);
        const a = -Math.PI / 2 + (rr() - 0.5) * 2.6;
        dune.position.set(Math.cos(a) * 40, 0, Math.sin(a) * -26 + 10);
        dune.name = "groundDressing";
        dune.receiveShadow = true;
        root.add(dune);
      }
    }
    if (D.snow) {
      // Snow piled against the walls and on the rim — patches, not a flat white disc.
      const rr = rng(21);
      const snow = new THREE.MeshStandardMaterial({ color: 0xeef6ff, roughness: 0.9 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + rr() * 0.3;
        const rad = 30 + rr() * 18;
        const m = new THREE.Mesh(new THREE.SphereGeometry(5 + rr() * 5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow);
        m.scale.set(1.6, 0.35, 1);
        m.position.set(Math.cos(a) * rad, 0.1, Math.sin(a) * rad * 0.8);
        m.rotation.y = -a;
        m.name = "groundDressing";
        m.receiveShadow = true;
        root.add(m);
      }
    }
  }


  // ---------------------------------------------------------------------------
  // Skin dressing — the extra pieces that make each castle skin its own place
  // ---------------------------------------------------------------------------
  function glowMat(color: string, intensity = 2): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.25 });
  }

  function addSkinDressing(): void {
    const rr = rng(77);
    const ring = (n: number, rad: number, fn: (x: number, z: number, a: number, i: number) => void) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rr() * 0.2;
        fn(Math.cos(a) * rad, Math.sin(a) * rad * 0.85, a, i);
      }
    };
    const towerTops: [number, number, number][] = [[-34, ARCH.towerH, 6], [34, ARCH.towerH, 6]];
    switch (SKIN) {
      case "FROST_CITADEL": {
        const ice = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x3a8ac0, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
        // ice crystal clusters on the mound
        ring(14, 44, (x, z, a) => {
          if (z > 12 && Math.abs(x) < 14) return; // keep the gate clear
          const h = 10 + rr() * 12;
          for (let k = 0; k < 3; k++) {
            const c = new THREE.Mesh(new THREE.ConeGeometry(2 + rr() * 1.4, h * (0.6 + rr() * 0.6), 6), ice);
            c.position.set(x + (rr() - 0.5) * 4, (h * 0.6) / 2, z + (rr() - 0.5) * 4);
            c.rotation.set((rr() - 0.5) * 0.6, a, (rr() - 0.5) * 0.6);
            c.castShadow = true;
            root.add(c);
          }
        });
        // icicles under the front parapets and tower rings
        for (const [x0, x1, y, z] of [[-23, -10, 27, 11], [10, 23, 27, 11], [-10, 10, 35, 15]] as const) {
          for (let x = x0; x <= x1; x += 1.6) {
            const l = 1.5 + rr() * 3.5;
            const ic = new THREE.Mesh(new THREE.ConeGeometry(0.35, l, 5), ice);
            ic.rotation.x = Math.PI;
            ic.position.set(x, y - l / 2, z);
            root.add(ic);
          }
        }
        for (const [tx, ty, tz] of towerTops) {
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const l = 1.5 + rr() * 3;
            const ic = new THREE.Mesh(new THREE.ConeGeometry(0.4, l, 5), ice);
            ic.rotation.x = Math.PI;
            ic.position.set(tx + Math.cos(a) * (ARCH.towerR + 1.4), ty - 0.5 - l / 2, tz + Math.sin(a) * (ARCH.towerR + 1.4));
            root.add(ic);
          }
        }
        // a great ice spike rising behind the keep
        for (const [x, z, h, rz] of [[-50, -14, 40, 0.18], [50, -18, 34, -0.2], [-44, -30, 26, 0.1]] as const) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(4.5, h, 6), ice);
          spike.position.set(x, h / 2 - 2, z);
          spike.rotation.z = rz;
          spike.castShadow = true;
          root.add(spike);
        }
        break;
      }
      case "OBSIDIAN_BASTION": {
        // A squat black-glass bastion: flat crenellated tops crowned by floating
        // obsidian shards, heavy sloped buttresses, jade rune lines and a dark
        // still moat — no lava, no horns (that's the Infernal Keep).
        const glass = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.08, metalness: 0.65 });
        const jade = glowMat("#2fe0c8", 2.2);
        const jadeDim = glowMat("#1aa894", 1.1);
        const shardMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.05, metalness: 0.7, emissive: new THREE.Color("#0f6a5c"), emissiveIntensity: 0.55, transparent: true, opacity: 0.88 });
        const shard = (x: number, y: number, z: number, size: number, tilt: number) => {
          const g = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), shardMat);
          g.scale.set(0.7, 1.9, 0.7);
          g.position.set(x, y, z);
          g.rotation.set(tilt, rr() * Math.PI, tilt * 0.5);
          g.castShadow = true;
          root.add(g);
          const core = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.38, 0), jade);
          core.scale.set(0.7, 1.9, 0.7);
          core.position.copy(g.position);
          core.rotation.copy(g.rotation);
          root.add(core);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g.geometry), new THREE.LineBasicMaterial({ color: 0x6affe8 }));
          edges.position.copy(g.position);
          edges.rotation.copy(g.rotation);
          edges.scale.copy(g.scale);
          root.add(edges);
          // a glowing ring it floats over
          const halo = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, 0.25, 6, 28), jadeDim);
          halo.rotation.x = Math.PI / 2;
          halo.position.set(x, y - size * 2.2, z);
          root.add(halo);
        };
        // floating shards over the keep and both towers
        // (beside the flag poles, never skewered on them)
        shard(-9, ARCH.keepH + 15, -22, 6, 0.1);
        shard(10, ARCH.keepH + 10, -24, 4, -0.15);
        for (const [tx, ty, tz] of towerTops) shard(tx + (tx < 0 ? -7 : 7), ty + 12, tz - 3, 4.2, (tx < 0 ? 1 : -1) * 0.18);
        // heavy sloped buttresses at the corners of the front wall and the keep
        for (const [x, z, h, ry] of [[-27, 14, 22, 0], [27, 14, 22, 0], [-16, -6, 34, 0], [16, -6, 34, 0]] as const) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, 9), glass);
          b.geometry.translate(0, h / 2, 0);
          const p = b.geometry.attributes.position!;
          for (let i = 0; i < p.count; i++) if (p.getY(i) > h * 0.9 && p.getZ(i) > 0) p.setZ(i, p.getZ(i) - 7);
          p.needsUpdate = true;
          b.geometry.computeVertexNormals();
          b.position.set(x, 0, z);
          b.rotation.y = ry;
          b.castShadow = true;
          root.add(b);
        }
        // jade rune lines across the front wall and the keep
        for (const [x, y, w, z] of [[-17, 9, 8, 11.5], [17, 9, 8, 11.5], [-17, 18, 5, 11.5], [17, 18, 5, 11.5], [0, ARCH.keepH * 0.42, 10, -4.3], [0, ARCH.keepH * 0.42 + 4, 6, -4.3]] as const) {
          const r1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.3), jade);
          r1.position.set(x, y, z);
          root.add(r1);
          for (const dx of [-w / 2, w / 2]) {
            const v = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.4, 0.3), jade);
            v.position.set(x + dx, y + 1.2, z);
            root.add(v);
          }
        }
        // a still, dark moat with a faint jade rim
        const moatWater = new THREE.Mesh(new THREE.RingGeometry(48.5, 54, 64), new THREE.MeshStandardMaterial({ color: 0x06100f, roughness: 0.05, metalness: 0.8 }));
        moatWater.rotation.x = -Math.PI / 2;
        moatWater.position.y = -0.9;
        root.add(moatWater);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(54, 0.35, 6, 96), jadeDim);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.6;
        root.add(rim);
        // tall black-glass monoliths standing guard around the walls
        ring(8, 45, (x, z, a) => {
          if (z > 10 && Math.abs(x) < 20) return;
          const h = 14 + rr() * 10;
          const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, 2.2), glass);
          m.position.set(x, h / 2, z);
          m.rotation.set(0, a + 0.4, (rr() - 0.5) * 0.12);
          m.castShadow = true;
          root.add(m);
          const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), jade);
          cap.position.set(x, h + 1.8, z);
          root.add(cap);
        });
        break;
      }
      case "INFERNAL_KEEP": {
        const obs = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.25, metalness: 0.5 });
        const lava = glowMat(SKIN === "INFERNAL_KEEP" ? "#ff5a1a" : "#ff8a3a", 2.4);
        // lava moat around the mound
        const moat = new THREE.Mesh(new THREE.TorusGeometry(52, 2.2, 8, 64), lava);
        moat.rotation.x = Math.PI / 2;
        moat.position.y = -1.6;
        root.add(moat);
        // obsidian spikes around the walls
        ring(18, 46, (x, z, a) => {
          if (z > 12 && Math.abs(x) < 14) return;
          const h = 9 + rr() * 12;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(2.2, h, 5), obs);
          sp.position.set(x, h / 2, z);
          sp.rotation.set((rr() - 0.5) * 0.5, a, (rr() - 0.5) * 0.5);
          sp.castShadow = true;
          root.add(sp);
        });
        // horns on the tower roofs and the keep
        for (const [tx, ty, tz] of towerTops) {
          for (const s of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(1.8, 14, 6), obs);
            horn.position.set(tx + s * 13, ty + 6, tz + 4);
            horn.rotation.z = -s * 1.1;
            root.add(horn);
          }
        }
        // lava cracks glowing across the yard
        for (let i = 0; i < 9; i++) {
          const a = rr() * Math.PI * 2;
          const len = 8 + rr() * 14;
          const crack = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.9), lava);
          crack.position.set(Math.cos(a) * (30 + rr() * 12), 0.3, Math.sin(a) * (28 + rr() * 10));
          crack.rotation.y = rr() * Math.PI;
          root.add(crack);
        }
        // braziers on the gatehouse
        for (const sx of [-1, 1]) {
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.2, 1.6, 10), obs);
          bowl.position.set(sx * 8, 36.8, 13);
          root.add(bowl);
          const fire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 8), lava);
          fire.position.set(sx * 8, 39, 13);
          root.add(fire);
        }
        break;
      }
      case "SOLAR_SANCTUM":
      case "PRESTIGE_ETERNAL_BASTION": {
        const gold = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 0.9, roughness: 0.28 });
        const marble = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.4 });
        // golden spires on the domes
        for (const [x, y, z] of [[0, ARCH.keepH + 22, -18], [-34, ARCH.towerH + 21, 6], [34, ARCH.towerH + 21, 6]] as const) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.9, 12, 8), gold);
          sp.position.set(x, y, z);
          root.add(sp);
        }
        // a sun disk on the keep face
        const disk = new THREE.Mesh(new THREE.TorusGeometry(5, 0.8, 8, 32), gold);
        disk.position.set(0, ARCH.keepH * 0.66, -4.4);
        root.add(disk);
        const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 32), glowMat("#fff0a0", 1.8));
        sun.position.set(0, ARCH.keepH * 0.66, -4.3);
        root.add(sun);
        // marble columns along the front
        for (const x of [-46, -40, 40, 46]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 16, 14), marble);
          col.position.set(x, 8, 22);
          col.castShadow = true;
          root.add(col);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), gold);
          cap.position.set(x, 16.6, 22);
          root.add(cap);
        }
        // golden trims along the front wall
        addBox(46, 0.8, 0.8, 0, 26.4, 11.4, gold);
        break;
      }
      case "HUNTER_THRONE": {
        // The hunter's hall: bone trophies of every boss brought down — great
        // horns over the keep, a palisade of bone spikes, crimson war banners
        // and ember braziers burning at the gate.
        const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.75 });
        const cloth = new THREE.MeshStandardMaterial({ color: 0x8a101a, roughness: 0.85, side: THREE.DoubleSide });
        const ember = glowMat("#ff6a2a", 2.2);
        const iron = new THREE.MeshStandardMaterial({ color: 0x241c1a, roughness: 0.45, metalness: 0.7 });
        // horns curling up from the keep's crown
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 6; i++) {
            const k = i / 5;
            const h = new THREE.Mesh(new THREE.ConeGeometry(3.2 * (1 - k * 0.75), 7, 7), bone);
            h.position.set(sx * (9 + k * 10), 80 + Math.sin(k * Math.PI * 0.9) * 14, -2 - k * 4);
            h.rotation.z = -sx * (0.5 + k * 1.1);
            h.castShadow = true;
            root.add(h);
          }
        }
        // bone spike palisade around the mound
        ring(22, 47, (x, z, a) => {
          if (z > 12 && Math.abs(x) < 14) return;
          const sp = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9 + rr() * 7, 6), bone);
          sp.position.set(x, 4, z);
          sp.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
          sp.castShadow = true;
          root.add(sp);
        });
        // crimson war banners hanging from the towers
        for (const [bx, by, bz] of [[-34, 44, 8], [34, 44, 8], [0, 58, 12]] as const) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 6), iron);
          pole.rotation.z = Math.PI / 2;
          pole.position.set(bx, by + 6, bz + 1);
          root.add(pole);
          const banner = new THREE.Mesh(new THREE.PlaneGeometry(9, 16, 1, 4), cloth);
          banner.position.set(bx, by - 2, bz + 1.2);
          root.add(banner);
          const sigil = new THREE.Mesh(new THREE.CircleGeometry(2.2, 3), ember);
          sigil.position.set(bx, by, bz + 1.4);
          sigil.rotation.z = Math.PI;
          root.add(sigil);
        }
        // braziers at the gate
        for (const sx of [-1, 1]) {
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.4, 2.4, 10), iron);
          bowl.position.set(sx * 13, 5, 20);
          root.add(bowl);
          const fire = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.5, 8), ember);
          fire.position.set(sx * 13, 8, 20);
          root.add(fire);
        }
        break;
      }
      case "VERDANT_HOLD": {
        const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a24, roughness: 0.9 });
        const leaf2 = new THREE.MeshStandardMaterial({ color: 0x5a9a34, roughness: 0.9 });
        const bark = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 1 });
        const flower = glowMat("#ffd0f0", 0.6);
        // bushes and flowers around the mound
        ring(20, 46, (x, z) => {
          if (z > 12 && Math.abs(x) < 14) return;
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5 + rr() * 2.5, 0), rr() < 0.5 ? leaf : leaf2);
          b.position.set(x, 2, z);
          b.castShadow = true;
          root.add(b);
          if (rr() < 0.6) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), flower);
            f.position.set(x + 1, 4.2, z + 1);
            root.add(f);
          }
        });
        // ivy draped over the front wall
        for (let i = 0; i < 40; i++) {
          const v = new THREE.Mesh(new THREE.SphereGeometry(1 + rr() * 1.2, 6, 5), rr() < 0.5 ? leaf : leaf2);
          v.position.set((rr() - 0.5) * 46, 4 + rr() * 22, 11.3);
          v.scale.z = 0.4;
          root.add(v);
        }
        break;
      }
      case "VOID_SPIRE": {
        const crystal = glowMat("#b07aff", 1.8);
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1028, roughness: 0.3, metalness: 0.4 });
        // floating crystal shards around the towers and keep
        for (const [cx, cy, cz, n] of [[-34, 40, 6, 5], [34, 40, 6, 5], [0, 82, -18, 6]] as const) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const sh = new THREE.Mesh(new THREE.OctahedronGeometry(1.6 + rr() * 1.4, 0), crystal);
            sh.scale.y = 2;
            sh.position.set(cx + Math.cos(a) * 18, cy + rr() * 12, cz + Math.sin(a) * 14);
            sh.rotation.set(rr(), rr(), rr());
            root.add(sh);
          }
        }
        // a void rift portal ring behind the keep
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 10, 48), crystal);
        ringM.position.set(0, 66, -36);
        root.add(ringM);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshBasicMaterial({ color: 0x0a0414 }));
        disc.position.set(0, 66, -36.4);
        root.add(disc);
        // dark obelisks with glowing tips
        ring(8, 46, (x, z) => {
          if (z > 12 && Math.abs(x) < 14) return;
          const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.8, 14, 4), dark);
          ob.position.set(x, 7, z);
          ob.castShadow = true;
          root.add(ob);
          const tip = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), crystal);
          tip.position.set(x, 15, z);
          root.add(tip);
        });
        break;
      }
      case "RECRUIT_KEEP": {
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.9 });
        const hay = new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 1 });
        const cloth = new THREE.MeshStandardMaterial({ color: 0xb03024, roughness: 0.8, side: THREE.DoubleSide });
        // wooden palisade around the mound
        ring(46, 49, (x, z, a) => {
          if (z > 10 && Math.abs(x) < 16) return;
          const h = 7 + rr() * 2;
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, h, 6), wood);
          st.position.set(x, h / 2, z);
          st.castShadow = true;
          root.add(st);
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), wood);
          tip.position.set(x, h + 0.8, z);
          root.add(tip);
          void a;
        });
        // crates, barrels and hay by the gate
        for (const [x, z] of [[-18, 26], [-14, 30], [18, 27], [22, 22]] as const) {
          addBox(4, 4, 4, x, 0, z, wood);
        }
        for (const [x, z] of [[-22, 22], [14, 31]] as const) {
          const hb = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.4, 12), hay);
          hb.rotation.z = Math.PI / 2;
          hb.position.set(x, 3, z);
          root.add(hb);
        }
        // hanging red banners on the front wall
        for (const x of [-16, 16]) {
          const b = new THREE.Mesh(new THREE.PlaneGeometry(5, 12), cloth);
          b.position.set(x, 18, 11.2);
          root.add(b);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  build();
  return { root, anchors, core: D.core, lava: !!D.lava };
}
