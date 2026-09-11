/**
 * INIMIGOS 3D — mandatory fallback gate. If WebGL isn't available (or
 * throws), the caller must fall back to the existing 2D enemy rendering —
 * the game can never end up with no enemies rendered because of this
 * layer. Checked once and cached: creating a throwaway canvas/context is
 * cheap but there's no reason to repeat it every render.
 */
let cached: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}
