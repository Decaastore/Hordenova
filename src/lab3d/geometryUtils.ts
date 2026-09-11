import * as THREE from "three";

/**
 * TESTE VISUAL 3D — custom geometry builders used to get organic,
 * non-obviously-primitive silhouettes (a tapering spectral body, a
 * curved horn, a twisting rune-cage prong) that composing spheres/cones/
 * cylinders directly can't produce. Kept deliberately simple — analytic
 * per-vertex normals from the loft direction, no external geometry
 * library — but this is what lets a shape read as "sculpted" instead of
 * "assembled from primitives."
 */

/**
 * Lofts a tube of varying radius along a 3D polyline. Each ring's frame
 * is derived from the local tangent with a fixed world-up reference,
 * which is stable for the mostly-vertical, gently-curving shapes this
 * file is used for (creature bodies, horns, banner poles) — a full
 * Frenet frame isn't needed at this curvature.
 */
export function buildTaperedTube(points: THREE.Vector3[], radii: number[], radialSegments = 8, capped = true): THREE.BufferGeometry {
  const count = points.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const p = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(count - 1, i + 1)]!;
    const forward = next.clone().sub(prev);
    if (forward.lengthSq() < 1e-8) forward.set(0, 1, 0);
    forward.normalize();
    let right = new THREE.Vector3().crossVectors(forward, worldUp);
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0).cross(forward);
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
    right.normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, forward).normalize();
    const r = radii[i] ?? radii[radii.length - 1] ?? 0.1;
    for (let s = 0; s <= radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const dir = right.clone().multiplyScalar(Math.cos(theta)).add(trueUp.clone().multiplyScalar(Math.sin(theta)));
      const pos = p.clone().add(dir.clone().multiplyScalar(r));
      positions.push(pos.x, pos.y, pos.z);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(s / radialSegments, i / Math.max(1, count - 1));
    }
  }

  const ring = radialSegments + 1;
  for (let i = 0; i < count - 1; i++) {
    for (let s = 0; s < radialSegments; s++) {
      const a = i * ring + s;
      const b = (i + 1) * ring + s;
      const c = (i + 1) * ring + s + 1;
      const d = i * ring + s + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  if (capped) {
    const startCenter = positions.length / 3;
    positions.push(points[0]!.x, points[0]!.y, points[0]!.z);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0);
    for (let s = 0; s < radialSegments; s++) indices.push(startCenter, s + 1, s);

    const endCenter = positions.length / 3;
    const lastRing = (count - 1) * ring;
    positions.push(points[count - 1]!.x, points[count - 1]!.y, points[count - 1]!.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    for (let s = 0; s < radialSegments; s++) indices.push(endCenter, lastRing + s, lastRing + s + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** A smooth, scalloped membrane outline (bat/moth-wing silhouette) via bezier curves — reads as a real wing edge, never a fan of straight primitive edges. */
export function buildMembraneWingShape(span: number, scallops: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.015 * span);
  const tipX = span;
  const tipY = span * 0.16;
  shape.quadraticCurveTo(span * 0.55, span * 0.32, tipX, tipY);
  let x = tipX;
  let y = tipY;
  for (let i = 0; i < scallops; i++) {
    const nx = tipX * (1 - (i + 1) / scallops);
    const dipY = y - span * 0.16;
    const nyBase = span * 0.02 + (i / scallops) * span * 0.05;
    shape.quadraticCurveTo(x - span * 0.05, dipY, nx, nyBase);
    x = nx;
    y = nyBase;
  }
  shape.quadraticCurveTo(span * 0.08, span * 0.08, 0, 0.015 * span);
  shape.closePath();
  return shape;
}

/** An irregular (non-regular-polygon) rock/armor-plate outline for extrusion — avoids the "obvious pentagon/hexagon primitive" read. */
export function buildJaggedPlateShape(radius: number, points: number, seedFn: () => number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (0.78 + seedFn() * 0.4);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
