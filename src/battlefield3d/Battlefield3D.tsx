import { Component, memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer, Bloom, N8AO, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import type { TowerInstance } from "@/entities/Tower";
import { WORLD_SIZE } from "@/config/gameBalance";
import { getTowerVisualStage, TOWER_PRESENTATION_SCALE } from "@/config/towerStats";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { getBiome } from "@/rendering/biomes";
import { getFortressAnchor, getPortalAnchor } from "@/rendering/MapRenderer";
import { buildTerrain, type TerrainData } from "./terrain";
import { buildScenery } from "./vegetation";
import { buildTowerModel } from "./models/towerModel";
import { buildCastleModel } from "./models/castleModel";
import { worldDirToYaw, worldToThree } from "./coords";

/**
 * CAMPO DE BATALHA 3D (prévia) — the battlefield rendered as a real-time 3D
 * scene: tilted perspective camera, one sun with soft shadows, ambient
 * occlusion, bloom on everything that glows, fog and tone mapping. It only
 * READS the engine snapshot each frame; gameplay is untouched.
 */

type Quality = "low" | "high";
const TOWER_COLORS: Record<string, string> = { IRONWOOD: "#ffd27a", INFERNO: "#ff7a2a", FROSTBORN: "#8fe6ff", STORMCALLER: "#c49bff" };

// ----------------------------------------------------------------- camera
function CameraRig() {
  const { camera, size, scene } = useThree();
  if (import.meta.env.DEV) (window as unknown as { __b3dScene?: THREE.Scene }).__b3dScene = scene;
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 30;
    cam.aspect = size.width / size.height;
    cam.near = 20;
    cam.far = 6000;
    // Fit the whole 1000×600 field: look at its centre from the south at a
    // ~52° pitch, then pull back until every corner is on screen.
    const target = new THREE.Vector3(0, 0, 18);
    const dir = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(42)), Math.cos(THREE.MathUtils.degToRad(42)));
    const corners = [
      [-WORLD_SIZE.width / 2, -WORLD_SIZE.height / 2],
      [WORLD_SIZE.width / 2, -WORLD_SIZE.height / 2],
      [-WORLD_SIZE.width / 2, WORLD_SIZE.height / 2],
      [WORLD_SIZE.width / 2, WORLD_SIZE.height / 2],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let lo = 200;
    let hi = 6000;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      cam.position.copy(target).addScaledVector(dir, mid);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const fits = corners.every((c) => {
        const p = c.clone().project(cam);
        return Math.abs(p.x) <= 0.98 && Math.abs(p.y) <= 0.98;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    cam.position.copy(target).addScaledVector(dir, hi);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ----------------------------------------------------------------- world
function World({ engine, quality }: { engine: GameEngine; quality: Quality }) {
  const biomeId = engine.getRenderSnapshot().biomeId;
  const biome = useMemo(() => getBiome(biomeId), [biomeId]);
  const fortress = useMemo(() => getFortressAnchor(ENEMY_PATH), []);
  const pads = useMemo(() => TOWER_SLOTS.map((s) => s.position), []);
  const terrain = useMemo(() => buildTerrain(biome, ENEMY_PATH, pads, fortress.position), [biome, pads, fortress.position]);
  const scenery = useMemo(() => buildScenery(biome, terrain, pads, fortress.position, ENEMY_PATH, quality), [biome, terrain, pads, fortress.position, quality]);
  const groundMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: terrain.albedo,
        bumpMap: terrain.detail,
        bumpScale: 2.2,
        roughnessMap: terrain.detail,
        roughness: 1,
        metalness: 0,
      }),
    [terrain],
  );
  useFrame((_, dt) => {
    scenery.windTime.value += dt;
  });
  const fog = new THREE.Color(biome.palette.fogColor).lerp(new THREE.Color("#0a0f0d"), 0.75);
  return (
    <>
      <color attach="background" args={[fog]} />
      <fogExp2 attach="fog" args={[fog, 0.0003]} />
      <Lights quality={quality} />
      <mesh geometry={terrain.geometry} material={groundMat} receiveShadow />
      <primitive object={scenery.group} />
      <TowerPads pads={pads} terrain={terrain} color={biome.palette.slotStone} glow={biome.palette.accentGlow} />
      <Castle biomeId={biomeId} position={fortress.position} terrain={terrain} />
      <Portal terrain={terrain} glow={biome.palette.accentGlow} />
      <Towers engine={engine} terrain={terrain} />
      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <Enemies engine={engine} terrain={terrain} />
        </Suspense>
      </SceneErrorBoundary>
      <Projectiles engine={engine} terrain={terrain} />
    </>
  );
}

function Lights({ quality }: { quality: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const s = sun.current!;
    s.target.position.set(0, 0, 0);
    s.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={["#9fb4cc", "#221d14", 0.55]} />
      <directionalLight
        ref={sun}
        color="#ffd9a8"
        intensity={3.4}
        position={[-520, 560, 470]}
        castShadow
        shadow-mapSize-width={quality === "high" ? 4096 : 2048}
        shadow-mapSize-height={quality === "high" ? 4096 : 2048}
        shadow-camera-left={-760}
        shadow-camera-right={760}
        shadow-camera-top={560}
        shadow-camera-bottom={-560}
        shadow-camera-near={100}
        shadow-camera-far={2400}
        shadow-bias={-0.0004}
        shadow-normalBias={1.2}
      />
      {/* cool rim from the back so silhouettes separate from the ground */}
      <directionalLight color="#7fa6d6" intensity={0.7} position={[420, 260, -620]} />
    </>
  );
}

function TowerPads({ pads, terrain, color, glow }: { pads: readonly { x: number; y: number }[]; terrain: TerrainData; color: string; glow: string }) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(22, 25, 4, 10, 1);
    g.translate(0, 1, 0);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }), [color]);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(glow), emissiveIntensity: 1.6, transparent: true, opacity: 0.85 }), [glow]);
  return (
    <>
      {pads.map((p, i) => (
        <group key={i} position={worldToThree(p, terrain.heightAt(p))}>
          <mesh geometry={geo} material={mat} castShadow receiveShadow />
          <mesh rotation-x={-Math.PI / 2} position-y={3.1} material={ring}>
            <ringGeometry args={[17, 18.2, 40]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Castle({ biomeId, position, terrain }: { biomeId: string; position: { x: number; y: number }; terrain: TerrainData }) {
  const model = useMemo(() => buildCastleModel(biomeId, 1), [biomeId]);
  const anchor = worldToThree(position, terrain.heightAt(position));
  return (
    <group position={anchor} scale={1.55} rotation-y={-0.5}>
      <primitive object={model.root} />
      <pointLight color="#ffa050" intensity={6000} distance={160} decay={2} position={[0, 30, 40]} />
    </group>
  );
}

function Portal({ terrain, glow }: { terrain: TerrainData; glow: string }) {
  const at = getPortalAnchor(ENEMY_PATH);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.8;
  });
  const p = worldToThree(at, terrain.heightAt(at));
  return (
    <group position={p}>
      <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.6}>
        <ringGeometry args={[14, 22, 48, 1]} />
        <meshStandardMaterial color="#000" emissive={glow} emissiveIntensity={1.4} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color={glow} intensity={4000} distance={140} decay={2} position={[0, 20, 0]} />
    </group>
  );
}

// ----------------------------------------------------------------- towers
const towerModelCache = new Map<string, ReturnType<typeof buildTowerModel>>();
function towerModel(type: string, stage: number, skin: string) {
  const key = `${type}|${stage}|${skin}`;
  let m = towerModelCache.get(key);
  if (!m) {
    m = buildTowerModel(type, stage, skin);
    towerModelCache.set(key, m);
  }
  return m;
}

function Towers({ engine, terrain }: { engine: GameEngine; terrain: TerrainData }) {
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, { key: string; obj: THREE.Group; turret: THREE.Object3D | null; aim: number }>());
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    for (const t of snap.towers as readonly TowerInstance[]) {
      seen.add(t.id);
      const stage = getTowerVisualStage(t.level);
      const key = `${t.type}|${stage}|${t.equippedSkinId ?? "base"}`;
      let entry = live.current.get(t.id);
      if (!entry || entry.key !== key) {
        if (entry) g.remove(entry.obj);
        const model = towerModel(t.type, stage, t.equippedSkinId ?? "base");
        const obj = model.root.clone(true);
        const turret = obj.children[model.root.children.indexOf(model.turret)] ?? null;
        obj.scale.setScalar(TOWER_PRESENTATION_SCALE * 1.55);
        obj.position.copy(worldToThree(t.position, terrain.heightAt(t.position) + 2.5));
        g.add(obj);
        entry = { key, obj, turret, aim: 0 };
        live.current.set(t.id, entry);
      }
      // aim the turret at the most recent shot fired from this tower
      const shot = snap.projectiles.find((p) => Math.hypot(p.from.x - t.position.x, p.from.y - t.position.y) < 30);
      if (shot && entry.turret) entry.aim = worldDirToYaw({ x: shot.to.x - t.position.x, y: shot.to.y - t.position.y }) - Math.PI / 2;
      if (entry.turret) entry.turret.rotation.y += (entry.aim - entry.turret.rotation.y) * 0.2;
    }
    for (const [id, e] of live.current) if (!seen.has(id)) {
      g.remove(e.obj);
      live.current.delete(id);
    }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- enemies
const PLACEHOLDER_BODIES = ["/models/enemies/Puglin.glb", "/models/enemies/Imp.glb"] as const;
const ANIMATION_LIBRARY = "/models/enemies/anims.glb";
const ENEMY_HEIGHT = 34; // world units — big enough that a creature reads as a creature

interface LiveEnemy {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  walk: THREE.AnimationAction;
  death: THREE.AnimationAction | null;
  dyingFor: number;
  scale: number;
}

function Enemies({ engine, terrain }: { engine: GameEngine; terrain: TerrainData }) {
  const [a, b, anims] = useLoader(GLTFLoader, [PLACEHOLDER_BODIES[0], PLACEHOLDER_BODIES[1], ANIMATION_LIBRARY]) as [GLTF, GLTF, GLTF];
  const bodies = useMemo(() => {
    return [a.scene, b.scene].map((scene) => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
        }
      });
      const box = new THREE.Box3().setFromObject(scene);
      return { scene, height: box.max.y - box.min.y };
    });
  }, [a, b]);
  if (!anims) throw new Error("animation library missing");

  const walkClip = anims.animations.find((c) => c.name === "Walk_Loop") ?? anims.animations[0]!;
  const deathClip = anims.animations.find((c) => c.name === "Death01") ?? null;
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, LiveEnemy>());
  const last = useRef(new Map<string, EnemyInstance>());

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    for (const en of snap.enemies as readonly EnemyInstance[]) {
      seen.add(en.id);
      last.current.set(en.id, en);
      let e = live.current.get(en.id);
      if (!e) {
        const body = bodies[(en.type.charCodeAt(0) + en.type.length) % bodies.length]!;
        const obj = cloneSkinned(body.scene);
        const mixer = new THREE.AnimationMixer(obj);
        const walk = mixer.clipAction(walkClip);
        walk.time = Math.random() * walkClip.duration;
        walk.play();
        const death = deathClip ? mixer.clipAction(deathClip) : null;
        if (death) {
          death.setLoop(THREE.LoopOnce, 1);
          death.clampWhenFinished = true;
        }
        const tier = en.boss ? (en.boss.isMainBoss ? 2.1 : 1.6) : en.elite ? 1.3 : 1;
        const scale = (ENEMY_HEIGHT * tier) / body.height;
        obj.scale.setScalar(scale);
        g.add(obj);
        e = { obj, mixer, walk, death, dyingFor: -1, scale };
        live.current.set(en.id, e);
      }
      const pos = worldToThree(en.position, terrain.heightAt(en.position));
      e.obj.position.copy(pos);
      const yaw = worldDirToYaw(en.direction);
      const d = Math.atan2(Math.sin(yaw - e.obj.rotation.y), Math.cos(yaw - e.obj.rotation.y));
      e.obj.rotation.y += d * Math.min(1, dt * 8);
      e.walk.timeScale = 1.1;
      e.mixer.update(dt);
    }
    for (const [id, e] of live.current) {
      if (seen.has(id)) continue;
      // gone from the field: play the fall, then remove
      if (e.dyingFor < 0) {
        e.dyingFor = 0;
        const reachedCastle = (last.current.get(id)?.position.x ?? 0) > WORLD_SIZE.width - 140;
        if (e.death && !reachedCastle) {
          e.walk.fadeOut(0.1);
          e.death.reset().fadeIn(0.1).play();
        } else e.dyingFor = 99;
      }
      e.dyingFor += dt;
      e.mixer.update(dt);
      if (e.dyingFor > 1.6) {
        e.obj.position.y -= dt * 12;
      }
      if (e.dyingFor > 2.6) {
        g.remove(e.obj);
        live.current.delete(id);
        last.current.delete(id);
      }
    }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- projectiles
function Projectiles({ engine, terrain }: { engine: GameEngine; terrain: TerrainData }) {
  const MAX = 64;
  const geo = useMemo(() => new THREE.SphereGeometry(2.6, 12, 8), []);
  const mats = useMemo(() => {
    const out: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [k, v] of Object.entries(TOWER_COLORS)) out[k] = new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(v), emissiveIntensity: 9 });
    return out;
  }, []);
  const pool = useRef<THREE.Mesh[]>([]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    while (pool.current.length < MAX) {
      const m = new THREE.Mesh(geo, mats.IRONWOOD);
      m.visible = false;
      g.add(m);
      pool.current.push(m);
    }
    const snap = engine.getRenderSnapshot();
    let i = 0;
    for (const p of snap.projectiles) {
      if (i >= MAX) break;
      const m = pool.current[i++]!;
      const t = 1 - Math.max(0, Math.min(1, p.remainingMs / p.totalMs));
      const x = p.from.x + (p.to.x - p.from.x) * t;
      const y = p.from.y + (p.to.y - p.from.y) * t;
      const arc = p.towerType === "INFERNO" ? Math.sin(t * Math.PI) * 30 : 0;
      const h = 30 * (1 - t) + 14 * t + arc;
      m.position.copy(worldToThree({ x, y }, terrain.heightAt({ x, y }) + h));
      m.material = mats[p.towerType] ?? mats.IRONWOOD!;
      m.scale.setScalar(p.isSpecial ? 2.2 : 1);
      m.visible = true;
    }
    for (; i < pool.current.length; i++) pool.current[i]!.visible = false;
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- root
/** If one layer of the scene fails to load (a model file, say), drop just that layer instead of the whole battlefield. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[battlefield3d] scene layer failed to load", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Watches the frame rate for the first seconds on screen. A device that can't
 * hold ~40 fps on the high tier drops to the low tier once, for the session.
 */
function FrameRateGuard({ quality, onSlow }: { quality: Quality; onSlow: () => void }) {
  const acc = useRef({ t: 0, frames: 0, warm: 0, done: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || quality !== "high") return;
    if (a.warm < 1.5) {
      a.warm += dt; // skip shader compile and first uploads
      return;
    }
    a.t += Math.min(dt, 0.5);
    a.frames++;
    if (a.t >= 3) {
      a.done = true;
      if (a.frames / a.t < 40) onSlow();
    }
  });
  return null;
}

export function pickAutoQuality(): Quality {
  if (typeof window === "undefined") return "low";
  const forced = new URLSearchParams(window.location.search).get("q");
  if (forced === "low" || forced === "high") return forced;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const cores = navigator.hardwareConcurrency ?? 4;
  return coarse || cores <= 4 ? "low" : "high";
}

export const Battlefield3D = memo(function Battlefield3D({ engine, quality: initial }: { engine: GameEngine; quality?: Quality }) {
  const [quality, setQuality] = useState<Quality>(() => initial ?? pickAutoQuality());
  return (
    <Canvas
      shadows="soft"
      dpr={quality === "high" ? [1, 1.5] : 1}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      camera={{ fov: 30, position: [0, 900, 700] }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <CameraRig />
      <FrameRateGuard quality={quality} onSlow={() => setQuality("low")} />
      <World engine={engine} quality={quality} />
      <EffectComposer multisampling={0}>
        {quality === "high" ? <N8AO aoRadius={18} intensity={2.4} distanceFalloff={1.2} quality="medium" /> : <></>}
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.28} darkness={0.62} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
});
