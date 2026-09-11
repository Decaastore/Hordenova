import * as THREE from "three";

/**
 * PROVA DE CONCEITO — SKIN LAB. New procedural-shape helpers layered on
 * top of (never editing) `@/lab3d/geometryUtils`'s `buildTaperedTube` —
 * they just produce different POINT ARRAYS to feed into it, so a "twisted
 * spire" or a "jagged shard" is a real change of form, not a recolor of
 * the same tube.
 */

/** A vertical point sequence that spirals as it rises — feeds buildTaperedTube to get a helically twisted spire silhouette instead of a straight/gently-curved trunk. */
export function buildSpirePoints(height: number, segments: number, turns: number, wobble: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = t * height;
    const angle = t * turns * Math.PI * 2;
    const r = wobble * (1 - t * 0.4) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.4));
    points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }
  return points;
}

/** A short, sharply-tapering shard pointing outward/upward from `origin` at `angle`/`tilt` — for obsidian shard clusters and horn-vents alike (tilt=0 is straight up). */
export function buildShardPoints(length: number, angle: number, tilt: number): THREE.Vector3[] {
  const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(angle), Math.cos(tilt), Math.sin(tilt) * Math.sin(angle));
  return [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(length * 0.55), dir.clone().multiplyScalar(length)];
}
