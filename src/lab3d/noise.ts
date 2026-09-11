/**
 * TESTE VISUAL 3D — tiny deterministic 2D value-noise (no external noise
 * library needed). Smooth-interpolated hash noise, cheap enough to sample
 * per-vertex on a terrain grid every frame if ever needed, and fully
 * deterministic (same input -> same output) so the terrain never "pops"
 * between renders.
 */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in roughly [0, 1], sampled at (x, y). */
export function valueNoise2D(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

/** Layered (fractal) value noise — more natural, rolling variation than a single octave. */
export function fbmNoise2D(x: number, y: number, octaves = 4): number {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max;
}
