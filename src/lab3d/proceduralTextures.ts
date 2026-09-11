import * as THREE from "three";

/**
 * TESTE VISUAL 3D — small canvas-generated textures so materials read as
 * stone/wood/crystal/etc instead of flat plastic-colored primitives,
 * without any external asset files. Each texture is built once (module-
 * level cache, keyed by its color inputs) and reused across every mesh of
 * that material family — the cost is paid a handful of times total, not
 * per-instance.
 */

const cache = new Map<string, THREE.Texture>();

function cached(key: string, build: () => THREE.Texture): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = build();
  cache.set(key, tex);
  return tex;
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function fbm(x: number, y: number, octaves: number): number {
  let total = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    total += hash(Math.floor(x * freq), Math.floor(y * freq)) * amp;
    max += amp;
    amp *= 0.55;
    freq *= 2.1;
  }
  return total / max;
}

/** Soft round radial-gradient sprite — used for dust/spark/glow particles instead of visible geometric chips. */
export function getParticleSprite(): THREE.Texture {
  return cached("particle-sprite", () => {
    const size = 64;
    const { canvas, ctx } = makeCanvas(size);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.65)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });
}

/** Angular debris chip sprite (soft-edged shard silhouette) — for rock/bone impact debris. */
export function getShardSprite(): THREE.Texture {
  return cached("shard-sprite", () => {
    const size = 48;
    const { canvas, ctx } = makeCanvas(size);
    ctx.translate(size / 2, size / 2);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.46);
    ctx.lineTo(size * 0.3, -size * 0.05);
    ctx.lineTo(size * 0.16, size * 0.44);
    ctx.lineTo(-size * 0.22, size * 0.3);
    ctx.lineTo(-size * 0.3, -size * 0.14);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });
}

/** Mottled rock/stone surface — blotchy value noise, muted so it reads as surface detail, not a decal. */
export function getStoneTexture(baseHex: number, darkHex: number): THREE.Texture {
  return cached(`stone-${baseHex}-${darkHex}`, () => {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    const base = new THREE.Color(baseHex);
    const dark = new THREE.Color(darkHex);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = fbm(x * 0.06, y * 0.06, 4);
        const crack = hash(Math.floor(x * 0.22), Math.floor(y * 0.22)) > 0.93 ? 0.4 : 0;
        const t = Math.min(1, n + crack);
        const c = base.clone().lerp(dark, t * 0.85);
        const idx = (y * size + x) * 4;
        img.data[idx] = c.r * 255;
        img.data[idx + 1] = c.g * 255;
        img.data[idx + 2] = c.b * 255;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  });
}

/** Vertical wood-grain stripes with irregular noise breakup — reads as organic fiber, not a painted pattern. */
export function getWoodTexture(baseHex: number, darkHex: number): THREE.Texture {
  return cached(`wood-${baseHex}-${darkHex}`, () => {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    const base = new THREE.Color(baseHex);
    const dark = new THREE.Color(darkHex);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const grain = Math.sin(x * 0.5 + Math.sin(y * 0.09) * 3.2) * 0.5 + 0.5;
        const n = fbm(x * 0.1, y * 0.1, 2);
        const t = Math.min(1, Math.max(0, grain * 0.65 + n * 0.35));
        const c = base.clone().lerp(dark, t * 0.7);
        const idx = (y * size + x) * 4;
        img.data[idx] = c.r * 255;
        img.data[idx + 1] = c.g * 255;
        img.data[idx + 2] = c.b * 255;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  });
}

/** Dark crystal/lava base with bright branching fissures — an emissiveMap so the glow reads as veins running through the material, not a flat lit blob. */
export function getCrackTexture(crackHex: number): THREE.Texture {
  return cached(`crack-${crackHex}`, () => {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = `#${crackHex.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    let a = (crackHex + 7) >>> 0;
    const rng = () => {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (let i = 0; i < 10; i++) {
      let x = rng() * size;
      let y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 4 + Math.floor(rng() * 4);
      for (let s = 0; s < segs; s++) {
        x += (rng() - 0.5) * 42;
        y += (rng() - 0.5) * 42;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  });
}
