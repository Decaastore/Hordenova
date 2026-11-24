import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BiomeDefinition } from "@/rendering/biomes/types";

/**
 * FUNDAÇÕES — real 3D build sites. Each map site gets a foundation set into
 * the ground instead of a painted disc: packed earth with a ring of stones
 * (clearing), cut flagstones (stone), a timber deck on stakes (wood), a broken
 * mossy ring (ruin), a carved altar whose runes glow (rune altar) or a rocky
 * mound (high ground). Every one sits on a soft patch of earth that blends
 * into the map and covers the painted platform under it. Towers stand on top
 * of `topY`.
 */

export type FoundationStyle = "CLEARING" | "STONE" | "WOOD" | "RUIN" | "ALTAR" | "ELEVATED";

export interface Foundation {
  group: THREE.Group;
  /** Height of the surface a tower stands on. */
  topY: number;
  /** Glowing parts (rune channels) that pulse. */
  glow: THREE.MeshStandardMaterial | null;
  /** The ring that lights up while the player is choosing where to build. */
  pick: THREE.Mesh;
}

function rng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function lumpy(geo: THREE.BufferGeometry, amount: number, rnd: () => number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position as THREE.BufferAttribute;
  const cache = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    let n = cache.get(k);
    if (n === undefined) cache.set(k, (n = 1 + (rnd() - 0.5) * amount));
    p.setXYZ(i, p.getX(i) * n, p.getY(i) * (1 + (n - 1) * 0.4), p.getZ(i) * n);
  }
  g.computeVertexNormals();
  return g;
}

const texCache = new Map<string, THREE.Texture>();

/** Flagstones (or planks) for a top surface, in the map's own stone colour. */
function surfaceTexture(kind: "flag" | "plank" | "earth", color: string): THREE.Texture {
  const key = `${kind}|${color}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(color);
  const css = (k: number, a = 1) => `rgba(${(base.r * 255 * k) | 0},${(base.g * 255 * k) | 0},${(base.b * 255 * k) | 0},${a})`;
  let seed = kind.length * 77 + color.length;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (kind === "flag") {
    g.fillStyle = css(0.35);
    g.fillRect(0, 0, 256, 256);
    // irregular flagstones
    for (let y = 0; y < 256; y += 40) {
      for (let x = -((y / 40) % 2) * 25; x < 256; x += 50) {
        const w = 42 + rnd() * 10;
        const h = 32 + rnd() * 6;
        g.fillStyle = css(0.75 + rnd() * 0.45);
        g.beginPath();
        g.roundRect(x + 3 + rnd() * 3, y + 3 + rnd() * 3, w, h, 6);
        g.fill();
        // wear and cracks
        g.strokeStyle = css(0.45, 0.6);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 6 + rnd() * w * 0.5, y + 6);
        g.lineTo(x + 10 + rnd() * w * 0.8, y + 10 + rnd() * h * 0.7);
        g.stroke();
      }
    }
  } else if (kind === "plank") {
    for (let x = 0; x < 256; x += 32) {
      g.fillStyle = `rgb(${(90 + rnd() * 30) | 0},${(62 + rnd() * 20) | 0},${(38 + rnd() * 14) | 0})`;
      g.fillRect(x, 0, 30, 256);
      g.strokeStyle = "rgba(30,20,12,0.5)";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(x + 3 + rnd() * 24, 0);
        g.lineTo(x + 3 + rnd() * 24, 256);
        g.stroke();
      }
      g.fillStyle = "rgba(20,14,8,0.8)";
      g.fillRect(x + 30, 0, 2, 256);
      g.fillStyle = "#3a3a3a";
      g.fillRect(x + 12, 20, 5, 5);
      g.fillRect(x + 12, 230, 5, 5);
    }
  } else {
    g.fillStyle = css(0.6);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = css(0.4 + rnd() * 0.6, 0.55);
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Soft earth patch the foundation sits in: blends into the map and hides the painted platform. */
export function earthPatch(biome: BiomeDefinition, radius: number): THREE.Mesh {
  const key = `patch|${biome.id}`;
  let tex = texCache.get(key);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const base = new THREE.Color(biome.palette.roadFill).lerp(new THREE.Color(biome.palette.groundBase), 0.45).multiplyScalar(0.85);
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, 0, 128, 128);
    let seed = 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const k = 0.6 + rnd() * 0.7;
      g.fillStyle = `rgba(${(base.r * 255 * k) | 0},${(base.g * 255 * k) | 0},${(base.b * 255 * k) | 0},0.6)`;
      g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
    }
    // contact shade in the middle, soft ragged edge
    const ao = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    ao.addColorStop(0, "rgba(0,0,0,0.35)");
    ao.addColorStop(0.55, "rgba(0,0,0,0.12)");
    ao.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = ao;
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = "destination-in";
    const edge = g.createRadialGradient(64, 64, 26, 64, 64, 64);
    edge.addColorStop(0, "rgba(0,0,0,1)");
    edge.addColorStop(0.7, "rgba(0,0,0,0.8)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = edge;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, tex);
  }
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 }));
  m.position.y = 0.12;
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

function runeDiscTexture(): THREE.Texture {
  const hit = texCache.get("runes");
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.translate(128, 128);
  g.strokeStyle = "#fff";
  g.lineCap = "round";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 100, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 62, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, -66);
    g.lineTo(0, -96);
    g.moveTo(-8, -86);
    g.lineTo(8, -76);
    g.moveTo(-8, -76);
    g.lineTo(0, -70);
    g.stroke();
    g.restore();
  }
  // a star joining the inner ring
  g.lineWidth = 2.5;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * 2 * Math.PI * 2) / 5 - Math.PI / 2;
    const x = Math.cos(a) * 58;
    const y = Math.sin(a) * 58;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  texCache.set("runes", t);
  return t;
}

export function buildFoundation(style: FoundationStyle, biome: BiomeDefinition, seed: number): Foundation {
  const rnd = rng(seed + 1);
  const group = new THREE.Group();
  const P = biome.palette;
  const stoneCol = new THREE.Color(P.slotStone).lerp(new THREE.Color(P.rock), 0.4);
  const stone = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 0.92 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.rockDark).lerp(stoneCol, 0.4), roughness: 0.95 });
  const moss = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.vegetationPrimary).multiplyScalar(0.9), roughness: 1 });
  let topY = 0;
  let glow: THREE.MeshStandardMaterial | null = null;

  group.add(earthPatch(biome, style === "ELEVATED" ? 32 : 27));

  /** A ring of irregular, half-buried stones. */
  const stoneRing = (r: number, n: number, size: number, gaps = 0) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      if (gaps && rnd() < gaps) continue;
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15;
      const b = lumpy(new THREE.BoxGeometry(size * (1 + rnd() * 0.5), size * (0.7 + rnd() * 0.7), size * (0.8 + rnd() * 0.4), 2, 2, 2), 0.35, rnd);
      b.rotateY(-a + (rnd() - 0.5) * 0.4);
      b.rotateX((rnd() - 0.5) * 0.25);
      b.translate(Math.cos(a) * r, size * 0.2, Math.sin(a) * r);
      parts.push(b);
    }
    if (!parts.length) return;
    const m = new THREE.Mesh(mergeGeometries(parts), rnd() < 0.5 ? stone : stoneDark);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  };
  /** A round slab with a textured top, sunk a little into the ground. */
  const slab = (r: number, h: number, top: THREE.Texture, sides: THREE.Material) => {
    const geo = new THREE.CylinderGeometry(r, r * 1.06, h, 28, 1);
    const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.9 });
    const m = new THREE.Mesh(geo, [sides, topMat, sides]);
    m.position.y = h / 2 - 0.4;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return h - 0.4;
  };

  switch (style) {
    case "CLEARING": {
      // trodden earth with a ring of field stones
      topY = slab(15, 1.2, surfaceTexture("earth", P.roadFill), stoneDark);
      stoneRing(16.5, 14, 3.4, 0.15);
      break;
    }
    case "STONE": {
      topY = slab(16, 2.6, surfaceTexture("flag", `#${stoneCol.getHexString()}`), stone);
      stoneRing(17.2, 18, 2.6);
      break;
    }
    case "WOOD": {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.6, 28), [stoneDark, stoneDark, new THREE.MeshStandardMaterial({ map: surfaceTexture("plank", "#7a5a3a"), roughness: 0.85 }), stoneDark, stoneDark, stoneDark]);
      deck.position.y = 2.6;
      deck.rotation.y = rnd() * 0.5;
      deck.castShadow = deck.receiveShadow = true;
      group.add(deck);
      const wood = new THREE.MeshStandardMaterial({ color: "#4a3422", roughness: 0.9 });
      for (const [x, z] of [
        [-12, -12],
        [12, -12],
        [-12, 12],
        [12, 12],
      ] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 6, 7), wood);
        post.position.set(x, 1.6, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), deck.rotation.y);
        post.castShadow = true;
        group.add(post);
      }
      topY = 3.4;
      break;
    }
    case "RUIN": {
      topY = slab(15, 2, surfaceTexture("flag", `#${stoneCol.getHexString()}`), stoneDark);
      stoneRing(17, 16, 3.2, 0.35);
      // a broken column stub and moss over the cracks
      const stub = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(2.8, 3.2, 7, 9, 2), 0.2, rnd), stone);
      const a = rnd() * Math.PI * 2;
      stub.position.set(Math.cos(a) * 19, 3, Math.sin(a) * 19);
      stub.rotation.z = (rnd() - 0.5) * 0.3;
      stub.castShadow = true;
      group.add(stub);
      for (let i = 0; i < 6; i++) {
        const mp = new THREE.Mesh(new THREE.SphereGeometry(2 + rnd() * 2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), moss);
        const b = rnd() * Math.PI * 2;
        mp.position.set(Math.cos(b) * (12 + rnd() * 6), 0.3, Math.sin(b) * (12 + rnd() * 6));
        mp.scale.y = 0.35;
        group.add(mp);
      }
      break;
    }
    case "ALTAR": {
      topY = slab(16, 3, surfaceTexture("flag", `#${stoneCol.clone().multiplyScalar(0.8).getHexString()}`), stoneDark);
      // runes carved into the top, glowing
      glow = new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(P.accentGlow), emissiveIntensity: 2.2, emissiveMap: runeDiscTexture(), transparent: true, alphaMap: runeDiscTexture(), depthWrite: false });
      const runes = new THREE.Mesh(new THREE.CircleGeometry(15, 40).rotateX(-Math.PI / 2), glow);
      runes.position.y = topY + 0.05;
      group.add(runes);
      // four standing stones
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const s = new THREE.Mesh(lumpy(new THREE.BoxGeometry(3, 10, 2.4, 1, 3, 1), 0.18, rnd), stone);
        s.position.set(Math.cos(a) * 19.5, 4.5, Math.sin(a) * 19.5);
        s.rotation.y = -a;
        s.rotation.z = (rnd() - 0.5) * 0.15;
        s.castShadow = true;
        group.add(s);
      }
      break;
    }
    case "ELEVATED": {
      // a rocky mound with a flat stone top
      const mound = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(17, 24, 7, 14, 2), 0.28, rnd), stoneDark);
      mound.position.y = 3.2;
      mound.castShadow = mound.receiveShadow = true;
      group.add(mound);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 16.5, 1.2, 24), [stone, new THREE.MeshStandardMaterial({ map: surfaceTexture("flag", `#${stoneCol.getHexString()}`), roughness: 0.9 }), stone]);
      top.position.y = 7;
      top.castShadow = top.receiveShadow = true;
      group.add(top);
      stoneRing(23, 10, 3.6, 0.3);
      topY = 7.6;
      break;
    }
  }

  // the "build here" ring, lit only while choosing a spot
  const pick = new THREE.Mesh(
    new THREE.RingGeometry(17.5, 19.5, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#ffd257", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pick.position.y = topY + 0.2;
  pick.renderOrder = 4;
  group.add(pick);

  return { group, topY, glow, pick };
}
