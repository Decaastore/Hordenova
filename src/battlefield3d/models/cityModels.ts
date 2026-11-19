import * as THREE from "three";
import type { CityBuildingId } from "@/config/city";

/**
 * O CASTELO VIRA CIDADE, in 3D — the city's buildings built from real
 * geometry with painted, relief-mapped surfaces in the same spirit as the
 * castle (models/castleModel.ts): lime plaster with stains, oak timber
 * framing, rough fieldstone footings, clay tile and straw roofs, plank
 * walls. Every texture is painted once and shared.
 *
 * Units are world units (a building is ~40–60 wide; the castle is ~118).
 * Each model's front faces +Z; the overlay turns it towards the camera.
 * A model reports where its door is (villagers walk to it) and where flames
 * go when it burns, and lists its materials so it can be charred.
 */

export interface CityModel {
  root: THREE.Group;
  /** Door, on the ground in front of the building (model space). */
  door: THREE.Vector3;
  /** Points over the roofline where flames and smoke rise when it burns. */
  firePoints: THREE.Vector3[];
  /** Chimney tops (smoke when standing). */
  chimneys: THREE.Vector3[];
  /** Glowing points (forge, crystal) — light when standing. */
  glows: { at: THREE.Vector3; color: string }[];
  /** Every material, with its original colour, so it can be charred and restored. */
  materials: { m: THREE.MeshStandardMaterial; color: THREE.Color }[];
}

// ---------------------------------------------------------------------------
// surfaces
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

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function grain(g: CanvasRenderingContext2D, S: number, r: () => number, alpha: number, octaves = [16, 48, 128]) {
  const [n, ng] = canvas(8);
  for (const o of octaves) {
    n.width = n.height = o;
    const img = ng.createImageData(o, o);
    for (let i = 0; i < o * o; i++) {
      const v = Math.round(r() * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    g.save();
    g.globalAlpha = alpha;
    g.globalCompositeOperation = "overlay";
    g.imageSmoothingQuality = "high";
    g.drawImage(n, 0, 0, S, S);
    g.restore();
  }
}

function normalFromHeight(h: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const S = h.width;
  const src = h.getContext("2d")!.getImageData(0, 0, S, S).data;
  const [out, og] = canvas(S);
  const img = og.createImageData(S, S);
  const H = (x: number, y: number) => src[(((y + S) % S) * S + ((x + S) % S)) * 4]! / 255;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      img.data[i] = Math.round((-dx / len) * 127 + 128);
      img.data[i + 1] = Math.round((dy / len) * 127 + 128);
      img.data[i + 2] = Math.round((1 / len) * 127 + 128);
      img.data[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return tex(out, false);
}

function tex(c: HTMLCanvasElement, color = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

interface Surface {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}
const surfaces = new Map<string, Surface>();

function surface(kind: "plaster" | "timber" | "stone" | "tiles" | "thatch" | "planks" | "slate"): Surface {
  const hit = surfaces.get(kind);
  if (hit) return hit;
  const S = 512;
  const [c, g] = canvas(S);
  const [h, hg] = canvas(S);
  const r = rng(kind.length * 977 + 13);
  hg.fillStyle = "#808080";
  hg.fillRect(0, 0, S, S);
  if (kind === "plaster") {
    g.fillStyle = "#e4dccb";
    g.fillRect(0, 0, S, S);
    grain(g, S, r, 0.25);
    // damp and soot stains, flaking patches showing the wattle beneath
    for (let k = 0; k < 26; k++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 70;
      const st = g.createRadialGradient(x, y, 0, x, y, rad);
      st.addColorStop(0, `rgba(${110 + r() * 40},${95 + r() * 30},${70 + r() * 20},${0.12 + r() * 0.14})`);
      st.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = st;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 10; k++) {
      const x = r() * S, y = r() * S, w = 8 + r() * 26, hh = 6 + r() * 16;
      g.fillStyle = `rgba(${120 + r() * 30},${95 + r() * 20},${70},0.55)`;
      g.fillRect(x, y, w, hh);
      hg.fillStyle = "#5a5a5a";
      hg.fillRect(x, y, w, hh);
    }
    grain(hg, S, r, 0.35, [32, 96]);
  } else if (kind === "timber" || kind === "planks") {
    const base: [number, number, number] = kind === "timber" ? [72, 50, 34] : [118, 84, 54];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0, 0, S, S);
    const boards = kind === "planks" ? 8 : 1;
    for (let b = 0; b < boards; b++) {
      const y0 = (b / boards) * S;
      const bh = S / boards;
      const d = (r() - 0.5) * 24;
      g.fillStyle = `rgb(${base[0] + d},${base[1] + d * 0.8},${base[2] + d * 0.6})`;
      g.fillRect(0, y0 + 2, S, bh - 4);
      if (boards > 1) {
        g.fillStyle = "rgba(20,12,6,0.8)";
        g.fillRect(0, y0, S, 3);
        hg.fillStyle = "#303030";
        hg.fillRect(0, y0, S, 4);
      }
    }
    // the grain: long wavy streaks
    for (let k = 0; k < 260; k++) {
      const y = r() * S;
      g.strokeStyle = `rgba(${r() < 0.5 ? "20,12,6" : "180,140,100"},${0.08 + r() * 0.14})`;
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + k) * 3);
      g.stroke();
      hg.strokeStyle = `rgba(${r() < 0.5 ? "60,60,60" : "170,170,170"},0.5)`;
      hg.lineWidth = 1;
      hg.beginPath();
      hg.moveTo(0, y);
      hg.lineTo(S, y + (r() - 0.5) * 6);
      hg.stroke();
    }
    // knots
    for (let k = 0; k < 6; k++) {
      const x = r() * S, y = r() * S;
      g.fillStyle = "rgba(30,18,10,0.6)";
      g.beginPath();
      g.ellipse(x, y, 6 + r() * 6, 3 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, S, r, 0.18);
  } else if (kind === "stone") {
    g.fillStyle = "#4a4640";
    g.fillRect(0, 0, S, S);
    hg.fillStyle = "#202020";
    hg.fillRect(0, 0, S, S);
    // rough fieldstones, packed tight
    for (let k = 0; k < 140; k++) {
      const x = r() * S, y = r() * S, rx = 18 + r() * 26, ry = 12 + r() * 18;
      const v = 105 + r() * 50;
      g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`;
      g.beginPath();
      g.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
      const hv = 150 + r() * 70;
      hg.fillStyle = `rgb(${hv},${hv},${hv})`;
      hg.beginPath();
      hg.ellipse(x, y, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
      hg.fill();
    }
    grain(g, S, r, 0.3);
    grain(hg, S, r, 0.3, [48, 128]);
  } else if (kind === "tiles" || kind === "slate") {
    const A: [number, number, number] = kind === "tiles" ? [150, 72, 44] : [78, 82, 90];
    g.fillStyle = `rgb(${A[0] * 0.5},${A[1] * 0.5},${A[2] * 0.5})`;
    g.fillRect(0, 0, S, S);
    hg.fillStyle = "#000";
    hg.fillRect(0, 0, S, S);
    const rows = 14, cols = kind === "tiles" ? 10 : 9;
    const rh = S / rows, cw = S / cols;
    for (let row = 0; row < rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = (col + (row % 2) * 0.5) * cw;
        const y = row * rh;
        const d = (r() - 0.5) * 34;
        g.fillStyle = `rgb(${A[0] + d},${A[1] + d * 0.6},${A[2] + d * 0.5})`;
        g.beginPath();
        if (kind === "tiles") {
          g.moveTo(x + 2, y);
          g.lineTo(x + cw - 2, y);
          g.quadraticCurveTo(x + cw, y + rh * 1.2, x + cw / 2, y + rh * 1.25);
          g.quadraticCurveTo(x, y + rh * 1.2, x + 2, y);
        } else {
          g.rect(x + 1.5, y, cw - 3, rh * 1.2);
        }
        g.fill();
        const sh = g.createLinearGradient(0, y, 0, y + rh * 1.25);
        sh.addColorStop(0, "rgba(0,0,0,0.45)");
        sh.addColorStop(0.5, "rgba(0,0,0,0)");
        sh.addColorStop(1, "rgba(255,255,255,0.08)");
        g.fillStyle = sh;
        g.fill();
        const hgd = hg.createLinearGradient(0, y, 0, y + rh * 1.25);
        hgd.addColorStop(0, "#202020");
        hgd.addColorStop(1, "#e0e0e0");
        hg.fillStyle = hgd;
        hg.fill();
        if (r() < 0.08) {
          g.fillStyle = "rgba(150,160,90,0.35)";
          g.beginPath();
          g.arc(x + cw * r(), y + rh, 3 + r() * 5, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    grain(g, S, r, 0.18);
  } else {
    // thatch: thick straw strokes running down the slope
    g.fillStyle = "#8a7444";
    g.fillRect(0, 0, S, S);
    for (let k = 0; k < 2600; k++) {
      const x = r() * S, y = r() * S, len = 14 + r() * 26;
      const v = r();
      g.strokeStyle = v < 0.5 ? `rgba(70,54,28,${0.4 + r() * 0.3})` : `rgba(${190 + r() * 40},${160 + r() * 30},${90 + r() * 30},${0.4 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + len);
      g.stroke();
      hg.strokeStyle = v < 0.5 ? "#404040" : "#c8c8c8";
      hg.lineWidth = 1.5;
      hg.beginPath();
      hg.moveTo(x, y);
      hg.lineTo(x, y + len);
      hg.stroke();
    }
    // layered courses
    for (let y = 0; y < S; y += 42) {
      g.fillStyle = "rgba(30,22,10,0.35)";
      g.fillRect(0, y, S, 5);
    }
  }
  const s: Surface = { map: tex(c), normal: normalFromHeight(h, kind === "plaster" ? 1.2 : 3) };
  surfaces.set(kind, s);
  return s;
}

// ---------------------------------------------------------------------------
// building kit
// ---------------------------------------------------------------------------
class Kit {
  readonly root = new THREE.Group();
  readonly materials: CityModel["materials"] = [];
  private cache = new Map<string, THREE.MeshStandardMaterial>();

  mat(kind: Parameters<typeof surface>[0] | "plain", rx: number, ry: number, opts: { color?: string; rough?: number; metal?: number; emissive?: string; ei?: number } = {}): THREE.MeshStandardMaterial {
    const key = `${kind}:${rx}:${ry}:${opts.color ?? ""}:${opts.emissive ?? ""}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const m = new THREE.MeshStandardMaterial({ color: opts.color ?? "#ffffff", roughness: opts.rough ?? 0.92, metalness: opts.metal ?? 0 });
    if (kind !== "plain") {
      const s = surface(kind);
      m.map = s.map.clone();
      m.map.repeat.set(rx, ry);
      m.map.needsUpdate = true;
      m.normalMap = s.normal.clone();
      m.normalMap.repeat.set(rx, ry);
      m.normalMap.needsUpdate = true;
      m.normalScale = new THREE.Vector2(1, 1);
    }
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.ei ?? 1;
    }
    this.cache.set(key, m);
    this.materials.push({ m, color: m.color.clone() });
    return m;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 16): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** A pitched roof: a triangular prism with eaves overhang, ridge along X. */
  gable(w: number, d: number, h: number, x: number, y: number, z: number, m: THREE.Material, overhang = 2.2): void {
    const hw = w / 2 + overhang, hd = d / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-hd, 0);
    shape.lineTo(0, h);
    shape.lineTo(hd, 0);
    shape.lineTo(-hd, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hw * 2, bevelEnabled: false });
    geo.translate(0, 0, -hw);
    geo.rotateY(Math.PI / 2);
    // UVs scaled so the tiles keep their size whatever the roof
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 22, uv.getY(i) / 22);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    this.root.add(mesh);
    // ridge cap
    this.box(w + overhang * 2, 1.1, 1.4, x, y + h - 0.5, z, this.mat("plain", 1, 1, { color: "#3a2418" }));
  }

  /** A gable-end wall triangle (fills the gap under a gable roof). */
  gableEnd(d: number, h: number, x: number, y: number, z: number, side: number, m: THREE.Material): void {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(d / 2, 0);
    shape.lineTo(-d / 2, 0);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateY(side * Math.PI / 2);
    const mesh = new THREE.Mesh(geo, m);
    mesh.material = m;
    (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.root.add(mesh);
  }

  /** Half-timbering on a wall face: posts, a mid rail and braces, laid just proud of the plaster. */
  timberFrame(w: number, h: number, x: number, y: number, z: number, faceZ: boolean, m: THREE.Material): void {
    const t = 0.9;
    const along = (len: number, ax: number, ay: number, rot = 0) => {
      const beam = faceZ ? this.box(len, t, 0.5, x + ax, y + ay, z, m) : this.box(0.5, t, len, x, y + ay, z + ax, m);
      if (rot) beam.rotation[faceZ ? "z" : "x"] = rot;
      return beam;
    };
    along(w, 0, 0);
    along(w, 0, h / 2);
    along(w, 0, h - t);
    const posts = Math.max(2, Math.round(w / 7));
    for (let i = 0; i <= posts; i++) {
      const ax = -w / 2 + (w * i) / posts;
      if (faceZ) this.box(t, h, 0.5, x + ax, y, z, m);
      else this.box(0.5, h, t, x, y, z + ax, m);
    }
    // braces in the outer bays
    const bay = w / posts;
    for (const s of [-1, 1]) {
      const ax = s * (w / 2 - bay / 2);
      const len = Math.hypot(bay, h / 2);
      const b = along(len, ax, h / 4 - t / 2, s * Math.atan2(h / 2, bay));
      b.position.y = y + h / 4;
    }
  }

  window(x: number, y: number, z: number, faceZ: boolean, lit: boolean, w = 3.2, h = 4): void {
    const frame = this.mat("timber", 0.2, 0.2);
    const glass = this.mat("plain", 1, 1, { color: "#1a120a", emissive: lit ? "#ffb060" : "#000000", ei: lit ? 0.9 : 0, rough: 0.4 });
    const shutter = this.mat("planks", 0.2, 0.4, { color: "#6a8a6a" });
    if (faceZ) {
      this.box(w + 1, h + 1, 0.6, x, y - 0.5, z, frame);
      this.box(w, h, 0.4, x, y, z + 0.15, glass);
      this.box(w / 2, h, 0.3, x - w * 0.85, y, z + 0.2, shutter);
      this.box(w / 2, h, 0.3, x + w * 0.85, y, z + 0.2, shutter);
    } else {
      this.box(0.6, h + 1, w + 1, x, y - 0.5, z, frame);
      this.box(0.4, h, w, x + Math.sign(x) * 0.15, y, z, glass);
    }
  }

  door(x: number, z: number, w = 4.6, h = 7.5): void {
    this.box(w + 1.4, h + 1, 0.8, x, 0, z, this.mat("stone", 0.3, 0.4));
    this.box(w, h, 0.5, x, 0, z + 0.35, this.mat("planks", 0.4, 0.5, { color: "#8a6a4a" }));
    this.box(0.6, 0.6, 0.3, x + w * 0.3, h * 0.45, z + 0.7, this.mat("plain", 1, 1, { color: "#2a2a2a", metal: 0.8, rough: 0.4 }));
  }

  chimney(x: number, y: number, z: number, h: number, list: THREE.Vector3[]): void {
    this.box(3.4, h, 3.4, x, y, z, this.mat("stone", 0.3, 0.6));
    this.box(4, 0.8, 4, x, y + h, z, this.mat("stone", 0.3, 0.1));
    list.push(new THREE.Vector3(x, y + h + 1.5, z));
  }
}

/** A half-timbered house: stone footing, plaster and oak frame, tiled roof, chimney. */
function house(k: Kit, x: number, z: number, w: number, d: number, h: number, roofColor: string, chimneys: THREE.Vector3[], lit: boolean, storeys = 1): void {
  const plaster = k.mat("plaster", w / 26, h / 26);
  const oak = k.mat("timber", 0.3, 0.3);
  k.box(w + 0.8, 2.4, d + 0.8, x, 0, z, k.mat("stone", w / 20, 0.15));
  let y = 2.4;
  for (let s = 0; s < storeys; s++) {
    const jetty = s * 1.2;
    k.box(w + jetty, h, d + jetty, x, y, z, plaster);
    k.timberFrame(w + jetty, h, x, y, z + (d + jetty) / 2 + 0.25, true, oak);
    k.timberFrame(d + jetty, h, x + (w + jetty) / 2 + 0.25, y, z, false, oak);
    k.timberFrame(d + jetty, h, x - (w + jetty) / 2 - 0.25, y, z, false, oak);
    for (const wx of [-w / 4, w / 4]) k.window(x + wx, y + h * 0.45, z + (d + jetty) / 2 + 0.3, true, lit && (s > 0 || wx > 0));
    y += h;
  }
  const roofH = d * 0.62;
  const top = d / 2 + (storeys - 1) * 0.6;
  k.gableEnd(d + (storeys - 1) * 1.2, roofH, x + w / 2 + (storeys - 1) * 0.6, y, z, 1, plaster);
  k.gableEnd(d + (storeys - 1) * 1.2, roofH, x - w / 2 - (storeys - 1) * 0.6, y, z, 1, plaster);
  k.gable(w + (storeys - 1) * 1.2, top * 2, roofH, x, y, z, k.mat("tiles", 1, 1, { color: roofColor }));
  k.chimney(x + w * 0.28, y, z - d * 0.15, roofH + 3, chimneys);
}

export function buildCityModel(id: CityBuildingId, seed: number): CityModel {
  const k = new Kit();
  const chimneys: THREE.Vector3[] = [];
  const glows: CityModel["glows"] = [];
  let door = new THREE.Vector3(0, 0, 14);
  let firePoints: THREE.Vector3[] = [];
  const r = rng(seed);

  switch (id) {
    case "HOUSES": {
      house(k, -10, -2, 16, 13, 8, "#a8603c", chimneys, true);
      house(k, 11, 3, 14, 12, 7.5, "#8a5a44", chimneys, false);
      house(k, -2, -16, 15, 11, 7, "#9a4e34", chimneys, true, 2);
      k.door(-10, 4.6);
      k.door(11, 9.2, 4, 7);
      // a cart and barrels between them
      k.cyl(1.8, 1.8, 3.6, 2, 0, 9, k.mat("planks", 0.3, 0.3));
      k.cyl(1.6, 1.6, 3.2, 4.4, 0, 10.5, k.mat("planks", 0.3, 0.3));
      door = new THREE.Vector3(-10, 0, 8);
      firePoints = [new THREE.Vector3(-10, 18, -2), new THREE.Vector3(11, 16, 3), new THREE.Vector3(-2, 25, -16)];
      break;
    }
    case "FARM": {
      // a plank barn with a straw roof, haystacks and a fenced field of crop rows
      const planks = k.mat("planks", 2, 1, { color: "#a86a4a" });
      k.box(22, 2, 16, -6, 0, -4, k.mat("stone", 1, 0.2));
      k.box(22, 10, 16, -6, 2, -4, planks);
      k.gableEnd(16, 9, 5, 12, -4, 1, planks);
      k.gableEnd(16, 9, -17, 12, -4, 1, planks);
      k.gable(22, 16, 9, -6, 12, -4, k.mat("thatch", 1, 1), 2.6);
      k.box(9, 8, 0.6, -6, 2, 4.4, k.mat("planks", 0.6, 0.6, { color: "#7a4a34" }));
      for (const [hx, hz] of [[12, -8], [16, -1]]) {
        const hay = k.cyl(3.6, 4.6, 6, hx!, 0, hz!, k.mat("thatch", 0.6, 0.6, { color: "#d8b870" }));
        hay.scale.y = 0.9;
        k.cyl(0.1, 3.8, 2.6, hx!, 6, hz!, k.mat("thatch", 0.6, 0.6, { color: "#c8a860" }));
      }
      const soil = k.mat("plain", 1, 1, { color: "#4a3420", rough: 1 });
      const crop = k.mat("plain", 1, 1, { color: "#7a9a3a", rough: 0.9 });
      for (let i = 0; i < 6; i++) {
        k.box(30, 0.6, 1.8, -2, 0, 12 + i * 3, soil);
        for (let j = 0; j < 12; j++) {
          const c = k.cyl(0.2, 0.9, 2.2 + r() * 1, -16 + j * 2.6, 0.5, 12 + i * 3, crop, 5);
          c.castShadow = false;
        }
      }
      const fence = k.mat("timber", 0.2, 0.2, { color: "#9a7a5a" });
      for (let i = 0; i <= 10; i++) k.box(0.6, 3, 0.6, -17 + i * 3.2, 0, 29, fence);
      k.box(32, 0.5, 0.4, -1, 2.2, 29, fence);
      k.box(32, 0.5, 0.4, -1, 1, 29, fence);
      door = new THREE.Vector3(-6, 0, 7);
      firePoints = [new THREE.Vector3(-6, 20, -4), new THREE.Vector3(12, 6, -8), new THREE.Vector3(-14, 16, -4)];
      break;
    }
    case "MARKET": {
      // stalls under striped awnings around a stone well, crates and barrels
      const post = k.mat("timber", 0.2, 0.2);
      const awning = (x: number, z: number, a: string, b: string) => {
        for (const [px, pz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) k.box(0.7, 7, 0.7, x + px!, 0, z + pz!, post);
        k.box(10, 2.4, 6, x, 0, z + 0.5, k.mat("planks", 0.6, 0.3));
        const [cc, cg] = canvas(64);
        for (let i = 0; i < 8; i++) {
          cg.fillStyle = i % 2 ? a : b;
          cg.fillRect(i * 8, 0, 8, 64);
        }
        const t = tex(cc);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
        k.materials.push({ m, color: m.color.clone() });
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(12, 8, 6, 4), m);
        const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 12) * Math.PI) * 0.6);
        cloth.rotation.x = -Math.PI / 2 + 0.35;
        cloth.position.set(x, 7.8, z);
        cloth.castShadow = true;
        k.root.add(cloth);
        // wares
        for (let i = 0; i < 4; i++) k.box(1.8, 1.4, 1.8, x - 3.5 + i * 2.3, 2.4, z + 0.5, k.mat("plain", 1, 1, { color: ["#c8402a", "#e8b030", "#6a9a3a", "#9a5ac8"][i]! }));
      };
      awning(-12, -6, "#c8302a", "#efe6d0");
      awning(12, -6, "#2a5ab8", "#efe6d0");
      awning(0, 10, "#3a8a3a", "#efe6d0");
      k.cyl(4, 4.4, 3, 0, 0, -2, k.mat("stone", 1, 0.3));
      k.cyl(3.2, 3.2, 0.4, 0, 2.8, -2, k.mat("plain", 1, 1, { color: "#1a2a3a", rough: 0.1 }));
      for (const sx of [-1, 1]) k.box(0.6, 7, 0.6, sx * 3.4, 3, -2, post);
      k.box(8, 0.6, 0.8, 0, 9.6, -2, post);
      for (let i = 0; i < 5; i++) k.box(2.4, 2.4, 2.4, -18 + r() * 36, 0, 14 + r() * 6, k.mat("planks", 0.2, 0.2), r() * 3);
      door = new THREE.Vector3(0, 0, 4);
      firePoints = [new THREE.Vector3(-12, 9, -6), new THREE.Vector3(12, 9, -6), new THREE.Vector3(0, 9, 10)];
      break;
    }
    case "SMITHY": {
      // stone forge-house with an open lean-to, the forge glowing, anvil and a tall chimney
      const stone = k.mat("stone", 1.4, 0.8);
      k.box(20, 11, 14, -4, 0, -4, stone);
      k.gableEnd(14, 8, 6, 11, -4, 1, stone);
      k.gableEnd(14, 8, -14, 11, -4, 1, stone);
      k.gable(20, 14, 8, -4, 11, -4, k.mat("slate", 1, 1));
      for (const [px, pz] of [[8, 4], [16, 4], [8, 10], [16, 10]]) k.box(0.9, 8, 0.9, px!, 0, pz!, k.mat("timber", 0.2, 0.2));
      k.gable(10, 8, 3, 12, 8, 7, k.mat("planks", 0.6, 0.6, { color: "#7a5a3a" }), 1);
      k.box(6, 3.6, 4, 11, 0, 6, stone);
      k.box(4.4, 0.6, 2.6, 11, 3.6, 6, k.mat("plain", 1, 1, { color: "#ff6a20", emissive: "#ff5a10", ei: 2.2 }));
      glows.push({ at: new THREE.Vector3(11, 5, 6), color: "#ff7a2a" });
      k.box(2.6, 1.6, 1.2, 15, 2.4, 9, k.mat("plain", 1, 1, { color: "#2a2a2e", metal: 0.85, rough: 0.35 }));
      k.box(1.4, 2.4, 1, 15, 0, 9, k.mat("timber", 0.2, 0.2));
      k.chimney(-12, 11, -8, 12, chimneys);
      k.door(-4, 3.2);
      k.window(-12, 6, 3.3, true, true);
      door = new THREE.Vector3(-4, 0, 7);
      firePoints = [new THREE.Vector3(-4, 21, -4), new THREE.Vector3(12, 12, 7)];
      break;
    }
    case "TAVERN": {
      house(k, 0, -4, 24, 15, 8, "#7a3a2a", chimneys, true, 2);
      k.door(0, 4.2);
      // hanging sign and a bench outside
      const oak = k.mat("timber", 0.2, 0.2);
      k.box(0.6, 0.6, 5, 9, 12, 6, oak);
      const sign = k.box(4, 3, 0.4, 9, 8.6, 8.2, k.mat("plain", 1, 1, { color: "#c89a3a", metal: 0.4 }));
      sign.rotation.y = Math.PI / 2;
      k.box(8, 1.6, 2, -7, 0, 7, oak);
      k.cyl(1.6, 1.6, 3.2, 12, 0, 6, k.mat("planks", 0.3, 0.3));
      door = new THREE.Vector3(0, 0, 8);
      firePoints = [new THREE.Vector3(-6, 28, -4), new THREE.Vector3(6, 28, -4), new THREE.Vector3(0, 22, 2)];
      break;
    }
    case "CHAPEL": {
      // ashlar chapel with a slate roof, a bell tower and spire, a round window over the door
      const stone = k.mat("stone", 1.6, 1);
      k.box(16, 13, 24, 0, 0, -6, stone);
      k.gableEnd(16, 9, 0, 13, 6, 0, stone);
      k.gableEnd(16, 9, 0, 13, -18, 0, stone);
      const roof = new THREE.Group();
      k.root.add(roof);
      k.gable(16, 24, 9, 0, 13, -6, k.mat("slate", 1, 1));
      k.root.children[k.root.children.length - 2]!.rotation.y = Math.PI / 2;
      k.root.children[k.root.children.length - 1]!.rotation.y = Math.PI / 2;
      k.box(8, 26, 8, 0, 0, -20, stone);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(6.4, 16, 4), k.mat("slate", 1, 1));
      spire.position.set(0, 34, -20);
      spire.rotation.y = Math.PI / 4;
      spire.castShadow = true;
      k.root.add(spire);
      k.box(0.5, 4, 0.5, 0, 42, -20, k.mat("plain", 1, 1, { color: "#c8a040", metal: 0.8, rough: 0.3 }));
      k.box(2.6, 0.5, 0.5, 0, 44.4, -20, k.mat("plain", 1, 1, { color: "#c8a040", metal: 0.8, rough: 0.3 }));
      const rose = new THREE.Mesh(new THREE.CircleGeometry(2.6, 18), k.mat("plain", 1, 1, { color: "#2a1a3a", emissive: "#c88aff", ei: 0.8 }));
      rose.position.set(0, 16, 6.1);
      k.root.add(rose);
      k.door(0, 6.1, 5, 9);
      for (const wz of [-12, -2]) for (const sx of [-1, 1]) k.window(sx * 8.1, 7, wz, false, true, 2.4, 6);
      door = new THREE.Vector3(0, 0, 10);
      firePoints = [new THREE.Vector3(0, 22, -6), new THREE.Vector3(0, 30, -20)];
      break;
    }
    case "MAGE_TOWER": {
      const stone = k.mat("stone", 2, 3);
      k.cyl(8.5, 10, 4, 0, 0, -2, stone, 24);
      k.cyl(7, 8.4, 34, 0, 4, -2, stone, 24);
      k.cyl(9, 7, 3, 0, 38, -2, stone, 24);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(9.6, 16, 24), k.mat("slate", 2, 1, { color: "#7a6ab8" }));
      cone.position.set(0, 49, -2);
      cone.castShadow = true;
      k.root.add(cone);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.6), k.mat("plain", 1, 1, { color: "#bfa8ff", emissive: "#9a6aff", ei: 2.4, rough: 0.1 }));
      crystal.position.set(0, 61, -2);
      crystal.name = "crystal";
      k.root.add(crystal);
      glows.push({ at: new THREE.Vector3(0, 61, -2), color: "#a87aff" });
      for (const wy of [12, 22, 31]) k.window(0, wy, 5.2, true, true, 2.2, 4.4);
      k.door(0, 6.4, 4, 7);
      door = new THREE.Vector3(0, 0, 10);
      firePoints = [new THREE.Vector3(0, 40, -2), new THREE.Vector3(0, 24, 4)];
      break;
    }
    case "TREASURY": {
      // a stone counting-house: columns in front, a heavy door, a gilded dome
      const stone = k.mat("stone", 1.6, 1);
      k.box(24, 2, 18, 0, 0, -4, stone);
      k.box(22, 12, 14, 0, 2, -6, stone);
      for (let i = 0; i < 4; i++) k.cyl(1.2, 1.4, 12, -8 + i * 5.33, 2, 3, k.mat("stone", 0.3, 1, { color: "#d8d0c0" }));
      k.box(24, 2.2, 6, 0, 14, 2, k.mat("stone", 1.4, 0.2, { color: "#d8d0c0" }));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(7.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), k.mat("plain", 1, 1, { color: "#d8a83a", metal: 0.9, rough: 0.28 }));
      dome.position.set(0, 14, -6);
      dome.castShadow = true;
      k.root.add(dome);
      k.cyl(0.6, 0.6, 3, 0, 21, -6, k.mat("plain", 1, 1, { color: "#e8c050", metal: 0.9, rough: 0.25 }));
      k.door(0, 1.2, 5, 8);
      for (let i = 0; i < 3; i++) k.box(2.2, 1.6, 2, -9 + i * 2.6, 0, 8, k.mat("planks", 0.2, 0.2, { color: "#8a6a3a" }));
      door = new THREE.Vector3(0, 0, 8);
      firePoints = [new THREE.Vector3(-6, 16, -6), new THREE.Vector3(6, 16, -6)];
      break;
    }
  }
  return { root: k.root, door, firePoints, chimneys, glows, materials: k.materials };
}

/** Burnt look: everything blackened, a faint ember glow in the timber. */
export function setCharred(model: CityModel, k: number): void {
  for (const { m, color } of model.materials) {
    m.color.copy(color).lerp(new THREE.Color("#1a1410"), k * 0.85);
  }
}
