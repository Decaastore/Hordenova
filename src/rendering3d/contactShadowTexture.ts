import * as THREE from "three";

/**
 * A single shared soft radial-gradient shadow texture, generated once and
 * reused by every 3D enemy instance's contact-shadow mesh — this is what
 * makes the ellipse read as a soft "creature standing on the ground" blob
 * instead of a hard-edged flat disc. Real shadow-mapped lighting was tried
 * and rejected for this same tilted-orthographic overlay technique
 * elsewhere in the codebase (see src/hybrid/HybridScene3D.tsx) because it
 * broke rendering under this environment's software WebGL — this texture
 * is the same proven-safe fake-shadow trick, just softened.
 */
let cached: THREE.Texture | null = null;

export function getContactShadowTexture(): THREE.Texture {
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.55)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0.32)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}
