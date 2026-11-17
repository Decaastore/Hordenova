import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { castleDressingFor } from "@/rendering/castleSprites";

/**
 * MONSTROS 3D — the animated creatures (Mixamo characters, compressed into
 * public/models/enemies/mixamo/) and which game enemy each one plays. Every
 * Mixamo character shares the same skeleton, so one walk cycle drives them
 * all; a character that came with its own walk uses it.
 *
 * Kills play one of the Mixamo death clips (DEATH_FILES — animation only, no
 * mesh), picked at random so a pile of dead monsters doesn't fall in step;
 * a model without them falls procedurally (see `Creature.fall`).
 */

export const CREATURE_FILES = {
  warrok: "/models/enemies/mixamo/warrok.glb",
  parasite: "/models/enemies/mixamo/parasite.glb",
  vampire: "/models/enemies/mixamo/vampire.glb",
  mutant: "/models/enemies/mixamo/mutant.glb",
  brute2: "/models/enemies/mixamo/brute2.glb",
  pumpkin: "/models/enemies/mixamo/pumpkin.glb",
  yaku: "/models/enemies/mixamo/yaku.glb",
  goblin: "/models/enemies/mixamo/goblin.glb",
} as const;
export type CreatureId = keyof typeof CREATURE_FILES;
/** Death animations (no mesh), shared by every creature through the common Mixamo skeleton. */
const DEATH_FILES = ["/models/enemies/mixamo/death1.glb", "/models/enemies/mixamo/death2.glb"];
/** One-off moves (no mesh): the boss's roar, its punch at the castle gate, the run when it is enraged. */
const MOVE_FILES = { roar: "/models/enemies/mixamo/roar.glb", punch: "/models/enemies/mixamo/punch.glb", run: "/models/enemies/mixamo/run.glb" } as const;
type MoveId = keyof typeof MOVE_FILES;
const MOVE_IDS = Object.keys(MOVE_FILES) as MoveId[];
/** Everything the creature layer loads: the characters, then the death clips, then the moves. */
export const CREATURE_URLS = [...Object.values(CREATURE_FILES), ...DEATH_FILES, ...Object.values(MOVE_FILES)];
const IDS = Object.keys(CREATURE_FILES) as CreatureId[];

/** Which creature plays each enemy type (a Boss is the Mutant, a Mini-Boss the Pumpkin Hulk, both bigger). */
const FOR_TYPE: Record<string, CreatureId> = {
  BRUTE: "warrok",
  CRAWLER: "parasite",
  SWARMLING: "goblin",
  RUNNER: "goblin",
  DISABLER: "vampire",
  SHIELDBEARER: "brute2",
  IRONCLAD: "mutant",
  REGENERATOR: "yaku",
};

export function creatureFor(type: string, boss: boolean, mainBoss = false): CreatureId {
  if (boss) return mainBoss ? "mutant" : "pumpkin";
  return FOR_TYPE[type] ?? IDS[(type.charCodeAt(0) + type.length) % IDS.length]!;
}

/**
 * Relative height of each enemy type, the same ratios as the 2D creature sheets
 * (CRAWLER 23 … BRUTE 33 world units, normalised to 27), so a 3D creature keeps
 * the proportions of its kind.
 */
const TYPE_HEIGHT: Record<string, number> = {
  CRAWLER: 0.85,
  SWARMLING: 0.89,
  RUNNER: 1,
  REGENERATOR: 1,
  DISABLER: 0.96,
  SHIELDBEARER: 1.11,
  IRONCLAD: 1.07,
  BRUTE: 1.22,
};
export function heightFactor(type: string): number {
  return TYPE_HEIGHT[type] ?? 1;
}

/** Size multipliers by rank — exactly the 2D renderer's (elite 1.3×, mini-boss 1.4×, boss 1.9×). */
export function rankScale(elite: boolean, boss: { isMainBoss: boolean } | undefined): number {
  return boss ? (boss.isMainBoss ? 1.9 : 1.4) : elite ? 1.3 : 1;
}

export interface CreatureKit {
  scene: THREE.Object3D;
  height: number;
  walk: THREE.AnimationClip;
  /** Death clips to pick from when it dies (empty: a procedural fall). */
  deaths: THREE.AnimationClip[];
  /** Roar, punch and run, when loaded. */
  moves: Partial<Record<MoveId, THREE.AnimationClip>>;
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

/**
 * A death clip was recorded on a character of another size: its hip
 * positions are rescaled to this body's own hip height, so the fall lands
 * where the creature stands instead of flinging it away.
 */
function fitHips(clip: THREE.AnimationClip, scene: THREE.Object3D): THREE.AnimationClip {
  const hips = scene.getObjectByName("mixamorigHips") ?? scene.getObjectByName("mixamorig:Hips");
  const c = clip.clone();
  for (const t of c.tracks) {
    if (!/Hips\.position$/.test(t.name) || !hips) continue;
    const v = t.values;
    const k = Math.abs(v[1]!) > 1e-6 ? hips.position.y / v[1]! : 1;
    const x0 = v[0]!, z0 = v[2]!;
    for (let i = 0; i < v.length; i += 3) {
      v[i] = hips.position.x + (v[i]! - x0) * k;
      v[i + 1] = v[i + 1]! * k;
      v[i + 2] = hips.position.z + (v[i + 2]! - z0) * k;
    }
  }
  return c;
}

export function prepareCreatures(gltfs: readonly GLTF[]): Record<CreatureId, CreatureKit> {
  const byId = Object.fromEntries(IDS.map((id, i) => [id, gltfs[i]!])) as Record<CreatureId, GLTF>;
  const sharedWalk = byId.warrok.animations.find((a) => a.name === "Walk") ?? byId.warrok.animations[0]!;
  const deaths = gltfs.slice(IDS.length, IDS.length + DEATH_FILES.length).flatMap((g) => g.animations.slice(0, 1));
  const moveClips = gltfs.slice(IDS.length + DEATH_FILES.length);
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
    out[id] = { scene: g.scene, height: Math.max(0.01, box.max.y - box.min.y), walk: inPlace(walk), deaths: deaths.map((d) => fitHips(d, g.scene)), moves: {} };
    MOVE_IDS.forEach((m, i) => {
      const clip = moveClips[i]?.animations[0];
      // every move stays on the spot: the game moves the body, the clip only animates it
      if (clip) out[id]!.moves[m] = inPlace(fitHips(clip, g.scene));
    });
  }
  return out;
}

/**
 * Each map dresses its horde in its own colours, like the 2D creature sheets
 * do: the same body is tinted (and given a faint inner glow) per map look.
 */
interface BiomeTint {
  mult: [number, number, number];
  emissive?: string;
  glow?: number;
}
const TINTS: Record<string, BiomeTint> = {
  ancient_forest: { mult: [0.95, 1.02, 0.9] },
  volcanic_wastes: { mult: [1.0, 0.74, 0.64], emissive: "#ff3a0a", glow: 0.1 },
  frozen_tundra: { mult: [0.78, 0.92, 1.18], emissive: "#6ad0ff", glow: 0.1 },
  cursed_desert: { mult: [1.18, 0.98, 0.68] },
  dark_ruins: { mult: [0.78, 0.78, 0.9], emissive: "#7a5aff", glow: 0.07 },
  abyss: { mult: [0.82, 0.7, 1.0], emissive: "#9a5aff", glow: 0.1 },
};
const tintedMaterials = new Map<string, Map<THREE.Material, THREE.Material>>();

function tinted(id: CreatureId, biomeId: string, m: THREE.Material): THREE.Material {
  const look = castleDressingFor(biomeId);
  const key = `${id}|${look}`;
  let cache = tintedMaterials.get(key);
  if (!cache) tintedMaterials.set(key, (cache = new Map()));
  let out = cache.get(m);
  if (out) return out;
  const t = TINTS[look] ?? TINTS.ancient_forest!;
  const c = m.clone() as THREE.MeshStandardMaterial;
  if (c.color) c.color.multiply(new THREE.Color(t.mult[0], t.mult[1], t.mult[2]));
  if (t.emissive && c.emissive) {
    c.emissive.set(t.emissive);
    c.emissiveIntensity = t.glow ?? 0.1;
  }
  out = c;
  cache.set(m, out);
  return out;
}

const OUTLINE_COLOR = new THREE.Color("#140b06");
const outlineMats = new Map<number, THREE.MeshBasicMaterial>();
function outlineMaterial(thickness: number) {
  const key = Math.round(thickness * 1e4);
  let m = outlineMats.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThick = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uThick;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  transformed += normalize(normal) * uThick;");
  };
  m.customProgramCacheKey = () => `outline-${key}`;
  outlineMats.set(key, m);
  return m;
}

/** Inverted-hull outline: a slightly fattened, back-facing, ink-coloured copy of every skinned mesh. */
function addOutline(body: THREE.Object3D, relative: number) {
  const meshes: THREE.SkinnedMesh[] = [];
  body.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) meshes.push(m);
  });
  for (const m of meshes) {
    // thickness in the mesh's own (bind-pose) units: a fixed share of its height, whatever units it was exported in
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    const tall = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    const hull = new THREE.SkinnedMesh(m.geometry, outlineMaterial(tall * relative));
    hull.bind(m.skeleton, m.bindMatrix);
    hull.position.copy(m.position);
    hull.quaternion.copy(m.quaternion);
    hull.scale.copy(m.scale);
    hull.frustumCulled = false;
    hull.userData.outline = true;
    m.parent?.add(hull);
  }
}

/** One live creature on the field. */
export class Creature {
  readonly obj: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly walk: THREE.AnimationAction;
  /** World height the creature is scaled to. */
  readonly scale: number;
  /** The ankle bones (left, right), for footprints. Empty when a model has none. */
  readonly feet: THREE.Object3D[];
  /** The head bone, for glowing eyes. Null when a model has none. */
  readonly head: THREE.Object3D | null;
  private fallT = -1;
  private fallDir = 1;
  private readonly deaths: THREE.AnimationClip[];
  private readonly moves: Partial<Record<MoveId, THREE.AnimationAction>> = {};
  /** The looping gait it is in: walk, or run when enraged. */
  private gait: THREE.AnimationAction;
  /** A one-off move (roar / punch) is playing over the gait. */
  private oneOff: THREE.AnimationAction | null = null;
  /** Playing a real death clip (rather than the procedural tip-over). */
  private clipDeath = false;

  constructor(kit: CreatureKit, worldHeight: number, tint?: { id: CreatureId; biomeId: string }, opts: { outline?: boolean } = {}) {
    // the model sits inside a pivot so a fall can tip it over its feet
    const body = cloneSkinned(kit.scene);
    if (tint)
      body.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map((mm) => tinted(tint.id, tint.biomeId, mm)) : tinted(tint.id, tint.biomeId, mesh.material);
      });
    this.obj = new THREE.Group();
    this.obj.add(body);
    this.mixer = new THREE.AnimationMixer(body);
    this.deaths = kit.deaths ?? [];
    this.walk = this.mixer.clipAction(kit.walk);
    this.gait = this.walk;
    for (const m of MOVE_IDS) {
      const clip = kit.moves?.[m];
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      if (m !== "run") {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = false;
      }
      this.moves[m] = a;
    }
    this.mixer.addEventListener("finished", (ev) => {
      // a roar or punch is over: back to walking (or running)
      if (ev.action !== this.oneOff || this.fallT >= 0) return;
      this.oneOff = null;
      this.gait.reset().play();
      ev.action.crossFadeTo(this.gait, 0.2, false);
    });
    this.walk.time = Math.random() * kit.walk.duration;
    this.walk.play();
    this.scale = worldHeight / kit.height;
    this.obj.scale.setScalar(this.scale);
    // the same dark ink outline the 2D creature sprites have, so 3D and 2D read as one style
    if (opts.outline !== false) addOutline(body, 0.012);
    const left = body.getObjectByProperty("name", "mixamorigLeftFoot") ?? body.getObjectByProperty("name", "mixamorig:LeftFoot");
    const right = body.getObjectByProperty("name", "mixamorigRightFoot") ?? body.getObjectByProperty("name", "mixamorig:RightFoot");
    this.feet = left && right ? [left, right] : [];
    this.head = body.getObjectByProperty("name", "mixamorigHead") ?? body.getObjectByProperty("name", "mixamorig:Head") ?? null;
  }

  /** Whether it can play `move` (the clip loaded). */
  has(move: MoveId) {
    return !!this.moves[move];
  }

  /** Play a roar or a punch once over its gait, `speed`× as fast, then go back to walking. */
  playOnce(move: Exclude<MoveId, "run">, speed = 1) {
    const a = this.moves[move];
    if (!a || this.fallT >= 0) return;
    const from = this.oneOff ?? this.gait;
    a.reset();
    a.timeScale = speed;
    a.play();
    from.crossFadeTo(a, 0.12, false);
    this.oneOff = a;
  }

  /** Switch between walking and running (enraged); `speed` sets the stride rate. */
  setRunning(on: boolean, speed = 1) {
    const run = this.moves.run;
    if (!run || this.fallT >= 0) return;
    const next = on ? run : this.walk;
    next.timeScale = speed;
    if (next === this.gait) return;
    const prev = this.gait;
    this.gait = next;
    if (this.oneOff) return; // the gait takes over when the move ends
    next.reset().play();
    prev.crossFadeTo(next, 0.25, false);
  }

  /** Start the death fall (tips over backwards or sideways, then lies still). */
  fall() {
    if (this.fallT >= 0) return;
    this.fallT = 0;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    if (this.deaths.length) {
      const die = this.mixer.clipAction(this.deaths[Math.floor(Math.random() * this.deaths.length)]!);
      die.setLoop(THREE.LoopOnce, 1);
      die.clampWhenFinished = true;
      die.reset().play();
      (this.oneOff ?? this.gait).crossFadeTo(die, 0.18, false);
      this.clipDeath = true;
      return;
    }
    (this.oneOff ?? this.gait).fadeOut(0.25);
  }

  get falling() {
    return this.fallT >= 0;
  }

  update(dt: number) {
    this.mixer.update(dt);
    if (this.fallT >= 0 && !this.clipDeath) {
      this.fallT += dt;
      const k = Math.min(1, this.fallT / 0.55);
      const e = k * k * (3 - 2 * k);
      const body = this.obj.children[0]!;
      body.rotation.x = -e * 1.45;
      body.rotation.z = e * 0.35 * this.fallDir;
    }
  }
}
