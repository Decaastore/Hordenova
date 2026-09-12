import * as THREE from "three";

/**
 * DIREÇÃO DE ARTE — FASE cel-shading: a single shared 4-step gradient map,
 * generated once and reused by every `meshToonMaterial` in the game
 * (towers, castle, creatures) so every object bands its lighting the same
 * way — hard 2-3 tone steps instead of MeshStandardMaterial's smooth PBR
 * gradient. `NearestFilter` on both axes is what keeps the bands crisp
 * (no blur between steps); a `LinearFilter` gradient map reads as a soft
 * ramp again, defeating the whole point.
 */
let cached: THREE.Texture | null = null;

export function getToonGradientMap(): THREE.Texture {
  if (cached) return cached;
  const steps = [60, 120, 190, 255];
  const canvas = document.createElement("canvas");
  canvas.width = steps.length;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  steps.forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}
