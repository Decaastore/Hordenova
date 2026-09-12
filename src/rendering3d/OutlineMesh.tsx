import type * as THREE from "three";

/**
 * DIREÇÃO DE ARTE — inverted-hull outline: the standard, dependency-free
 * cel-shading outline technique — the SAME geometry rendered slightly
 * larger with backface culling flipped to `BackSide` and a flat dark
 * unlit color, so only the silhouette rim peeks out from behind the real
 * (front-facing) mesh. Applied to the handful of parts that actually
 * define an object's silhouette (not every small rivet/strut), matching
 * the "teste de silhueta" requirement without a postprocessing pass.
 */
export function OutlineMesh({
  geometry,
  position,
  rotation,
  scale = 1,
  thickness = 1.045,
  color = "#0a0805",
}: {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  /** Multiplier on top of `scale` — how far the hull is pushed outward. */
  thickness?: number;
  color?: string;
}) {
  const finalScale: [number, number, number] =
    typeof scale === "number" ? [scale * thickness, scale * thickness, scale * thickness] : [scale[0] * thickness, scale[1] * thickness, scale[2] * thickness];
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} scale={finalScale}>
      <meshBasicMaterial color={color} side={2 /* THREE.BackSide */} />
    </mesh>
  );
}
