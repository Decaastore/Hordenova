import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * MONSTROS 3D — the animated creatures (Mixamo characters, compressed into
 * public/models/enemies/mixamo/) and which game enemy each one plays. Every
 * Mixamo character shares the same skeleton, so one walk cycle drives them
 * all; a character that came with its own walk uses it.
 *
 * There is no death clip yet, so a kill is a procedural fall (see `Creature.fall`).
 */

export const CREATURE_FILES = {
  warrok: "/models/enemies/mixamo/warrok.glb",
  parasite: "/models/enemies/mixamo/parasite.glb",
  vampire: "/models/enemies/mixamo/vampire.glb",
  mutant: "/models/enemies/mixamo/mutant.glb",
  brute2: "/models/enemies/mixamo/brute2.glb",
} as const;
export type CreatureId = keyof typeof CREATURE_FILES;
export const CREATURE_URLS = Object.values(CREATURE_FILES);
const IDS = Object.keys(CREATURE_FILES) as CreatureId[];

/** Which creature plays each enemy type (bosses use the Mutant, bigger). */
const FOR_TYPE: Record<string, CreatureId> = {
  BRUTE: "warrok",
  CRAWLER: "parasite",
  SWARMLING: "parasite",
  RUNNER: "vampire",
  DISABLER: "vampire",
  SHIELDBEARER: "mutant",
  IRONCLAD: "mutant",
  REGENERATOR: "brute2",
};

export function creatureFor(type: string, boss: boolean): CreatureId {
  if (boss) return "mutant";
  return FOR_TYPE[type] ?? IDS[(type.charCodeAt(0) + type.length) % IDS.length]!;
}

/** Relative height of each enemy type (world units of the shortest is ~1). */
export function heightFactor(type: string): number {
  switch (type) {
    case "CRAWLER":
    case "SWARMLING":
      return 0.8;
    case "BRUTE":
    case "IRONCLAD":
      return 1.15;
    default:
      return 1;
  }
}

export interface CreatureKit {
  scene: THREE.Object3D;
  height: number;
  walk: THREE.AnimationClip;
}

/** A walk that stays in place: the hips keep their height and sway but never travel forward. */
function inPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const c = clip.clone();
  for (const t of c.tracks) {
    if (!/Hips\.position$/.test(t.name)) continue;
    const v = t.values;
    const x0 = v[0]!;
    const z0 = v[2]!;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  return c;
}

export function prepareCreatures(gltfs: readonly GLTF[]): Record<CreatureId, CreatureKit> {
  const byId = Object.fromEntries(IDS.map((id, i) => [id, gltfs[i]!])) as Record<CreatureId, GLTF>;
  const sharedWalk = byId.warrok.animations.find((a) => a.name === "Walk") ?? byId.warrok.animations[0]!;
  const out = {} as Record<CreatureId, CreatureKit>;
  for (const id of IDS) {
    const g = byId[id];
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene);
    const walk = g.animations.find((a) => a.name === "Walk") ?? sharedWalk;
    out[id] = { scene: g.scene, height: Math.max(0.01, box.max.y - box.min.y), walk: inPlace(walk) };
  }
  return out;
}

/** One live creature on the field. */
export class Creature {
  readonly obj: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly walk: THREE.AnimationAction;
  /** World height the creature is scaled to. */
  readonly scale: number;
  private fallT = -1;
  private fallDir = 1;

  constructor(kit: CreatureKit, worldHeight: number) {
    // the model sits inside a pivot so a fall can tip it over its feet
    const body = cloneSkinned(kit.scene);
    this.obj = new THREE.Group();
    this.obj.add(body);
    this.mixer = new THREE.AnimationMixer(body);
    this.walk = this.mixer.clipAction(kit.walk);
    this.walk.time = Math.random() * kit.walk.duration;
    this.walk.play();
    this.scale = worldHeight / kit.height;
    this.obj.scale.setScalar(this.scale);
  }

  /** Start the death fall (tips over backwards or sideways, then lies still). */
  fall() {
    if (this.fallT >= 0) return;
    this.fallT = 0;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    this.walk.fadeOut(0.25);
  }

  get falling() {
    return this.fallT >= 0;
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.fallT >= 0) {
      this.fallT += dt;
      const k = Math.min(1, this.fallT / 0.55);
      const e = k * k * (3 - 2 * k);
      const body = this.obj.children[0]!;
      body.rotation.x = -e * 1.45;
      body.rotation.z = e * 0.35 * this.fallDir;
    }
  }
}
