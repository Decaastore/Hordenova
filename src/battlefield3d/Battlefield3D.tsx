import { Component, memo, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer, Bloom, N8AO, Vignette, ToneMapping, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import { getTowerStats, type TowerInstance } from "@/entities/Tower";
import type { TowerType } from "@/config/towerStats";
import { WORLD_SIZE } from "@/config/gameBalance";
import { getTowerLevelStats, getTowerVisualStage, TOWER_PRESENTATION_SCALE } from "@/config/towerStats";
import { MANA_MAX } from "@/config/towerMana";
import { getMapLayout, HIGH_GROUND_RANGE_MULT, type BuildSite } from "@/data/mapLayouts";
import { getBiome } from "@/rendering/biomes";
import { getFortressAnchor, getPortalAnchor } from "@/rendering/MapRenderer";
import type { MapPointerBridge } from "@/rendering/CanvasRenderer";
import { buildTerrain, type TerrainData } from "./terrain";
import { buildScenery } from "./vegetation";
import { buildTowerModel } from "./models/towerModel";
import { buildCastleModel } from "./models/castleModel";
import { threeToWorld, worldDirToYaw, worldToThree } from "./coords";
import { Effects } from "./fx";
import { Creature, CREATURE_URLS, creatureFor, heightFactor, prepareCreatures } from "./creatures";
import { buildProps } from "./props";

/**
 * CAMPO DE BATALHA 3D (prévia) — the battlefield rendered as a real-time 3D
 * scene, seen from high above like a classic tower-defence board: one sun
 * with soft shadows, bloom on everything that glows, particle effects for
 * every shot, hit and death, and a 2D layer on top for health bars and
 * damage numbers. It only READS the engine snapshot each frame; gameplay is
 * untouched.
 */

type Quality = "low" | "high";
const CAMERA_FOV = 24;
const TOWER_COLORS: Record<string, string> = { IRONWOOD: "#ffd27a", INFERNO: "#ff7a2a", FROSTBORN: "#8fe6ff", STORMCALLER: "#c49bff" };
const RARITY_COLORS: Record<string, string> = {
  COMMON: "#cfcfcf",
  UNCOMMON: "#6ad46a",
  RARE: "#4aa8ff",
  EPIC: "#b46aff",
  LEGENDARY: "#ffb43a",
  MYTHIC: "#ff4a5a",
};

/** What the HUD is doing right now that the battlefield should show (choosing where to build). */
export interface Battlefield3DUiState {
  pendingTowerType: TowerType | null;
  placingTower: TowerInstance | null;
}

/** World position under the pointer on the 3D ground (null when off the field). */
const hoverWorld: { current: { x: number; y: number } | null } = { current: null };

// ----------------------------------------------------------------- camera
function CameraRig() {
  const { camera, size, scene } = useThree();
  if (import.meta.env.DEV) Object.assign(window, { __b3dScene: scene, __b3dCamera: camera });
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = CAMERA_FOV;
    cam.aspect = size.width / size.height;
    cam.near = 20;
    cam.far = 6000;
    // Fit the whole 1000×600 field: look down at its centre from high in the
    // south (~64° pitch, narrow lens) so it reads like a classic tower
    // defence board, then pull back until every corner is on screen.
    const target = new THREE.Vector3(0, 0, 8);
    const pitch = THREE.MathUtils.degToRad(64);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
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
        return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.96;
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
function useMapKeys(engine: GameEngine) {
  const s = engine.getRenderSnapshot();
  const [keys, setKeys] = useState({ biomeId: s.biomeId, layoutId: s.mapLayoutId });
  useFrame(() => {
    const n = engine.getRenderSnapshot();
    if (n.biomeId !== keys.biomeId || n.mapLayoutId !== keys.layoutId) setKeys({ biomeId: n.biomeId, layoutId: n.mapLayoutId });
  });
  return keys;
}

function World({
  engine,
  quality,
  ui,
  hud,
}: {
  engine: GameEngine;
  quality: Quality;
  ui?: MutableRefObject<Battlefield3DUiState>;
  hud: RefObject<HTMLCanvasElement>;
}) {
  const { biomeId, layoutId } = useMapKeys(engine);
  const biome = useMemo(() => getBiome(biomeId), [biomeId]);
  const layout = useMemo(() => getMapLayout(layoutId), [layoutId]);
  const fortress = useMemo(() => getFortressAnchor(layout.path), [layout]);
  const pads = useMemo(() => layout.sites.map((s) => s.position), [layout]);
  const terrain = useMemo(() => buildTerrain(biome, layout.path, pads, fortress.position), [biome, layout, pads, fortress.position]);
  const scenery = useMemo(() => buildScenery(biome, terrain, pads, fortress.position, layout.path, quality), [biome, terrain, pads, fortress.position, layout, quality]);
  const props = useMemo(() => buildProps(biome, terrain, pads, fortress.position, layout.path), [biome, terrain, pads, fortress.position, layout]);
  const fx = useMemo(() => new Effects(), []);
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
  const { gl, size, scene } = useThree();
  useEffect(() => fx.setViewportHeight(size.height * gl.getPixelRatio(), CAMERA_FOV), [fx, size, gl]);
  // soft image-based light: every PBR surface picks up sky and bounce from all sides, so roofs read from above
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  const accent = biome.palette.accentGlow;
  const firefly = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    scenery.windTime.value += dt;
    for (const f of props.flames) if (Math.random() < 0.75) fx.flame(f.clone(), 0.75);
    for (const c of props.crystals) if (Math.random() < 0.12) fx.mote(c.clone(), accent, 8, 10);
    // fireflies drifting over the clearing
    if (Math.random() < 0.5) {
      const w = { x: Math.random() * WORLD_SIZE.width, y: Math.random() * WORLD_SIZE.height };
      fx.mote(firefly.copy(worldToThree(w, terrain.heightAt(w) + 6 + Math.random() * 14)), "#d8ff7a", 2, 3);
    }
    fx.update(dt);
  });
  const fog = new THREE.Color(biome.palette.fogColor).lerp(new THREE.Color("#0a0f0d"), 0.75);
  return (
    <>
      <color attach="background" args={[fog]} />
      <fogExp2 attach="fog" args={[fog, 0.0003]} />
      <Lights quality={quality} />
      <mesh geometry={terrain.geometry} material={groundMat} receiveShadow />
      <primitive object={scenery.group} />
      <primitive object={props.group} />
      <primitive object={fx.root} />
      <TowerPads engine={engine} sites={layout.sites} terrain={terrain} color={biome.palette.slotStone} glow={accent} ui={ui} />
      <Castle engine={engine} biomeId={biomeId} fortress={fortress} terrain={terrain} fx={fx} />
      <Portal path={layout.path} terrain={terrain} glow={accent} fx={fx} />
      <Towers engine={engine} terrain={terrain} fx={fx} />
      <RangePreview engine={engine} sites={layout.sites} terrain={terrain} ui={ui} />
      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <Enemies engine={engine} terrain={terrain} fx={fx} fortress={fortress.position} portal={getPortalAnchor(layout.path)} />
        </Suspense>
      </SceneErrorBoundary>
      <Projectiles engine={engine} terrain={terrain} fx={fx} />
      <LootBeams engine={engine} terrain={terrain} fx={fx} />
      <HudLayer engine={engine} terrain={terrain} canvas={hud} />
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
      <hemisphereLight args={["#a9bdd4", "#2a2318", 0.75]} />
      <directionalLight
        ref={sun}
        color="#ffd9a8"
        intensity={3.3}
        position={[-520, 640, 470]}
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
      <directionalLight color="#7fa6d6" intensity={0.8} position={[420, 260, -620]} />
    </>
  );
}

// ----------------------------------------------------------------- shared textures
let radialTex: THREE.Texture | null = null;
function radialTexture(): THREE.Texture {
  if (radialTex) return radialTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  radialTex = new THREE.CanvasTexture(c);
  return radialTex;
}

/** A soft additive pool of light laid on the ground (stands in for many real lights). */
function glowDiscMaterial(color: THREE.ColorRepresentation, opacity: number) {
  return new THREE.MeshBasicMaterial({
    map: radialTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// ----------------------------------------------------------------- pads
function TowerPads({
  engine,
  sites,
  terrain,
  color,
  glow,
  ui,
}: {
  engine: GameEngine;
  sites: readonly BuildSite[];
  terrain: TerrainData;
  color: string;
  glow: string;
  ui?: MutableRefObject<Battlefield3DUiState>;
}) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(17, 19, 3, 10, 1);
    g.translate(0, 1, 0);
    return g;
  }, []);
  const highGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(16, 20, 7, 9, 1);
    g.translate(0, 3.5, 0);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }), [color]);
  const rune = "#b98aff";
  const ringMat = (c: string, i: number, o: number) => new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(c), emissiveIntensity: i, transparent: true, opacity: o });
  const mats = useMemo(
    () => ({ cold: ringMat(glow, 1.4, 0.8), hot: ringMat(glow, 7, 1), open: ringMat(glow, 3.2, 1), runeCold: ringMat(rune, 2, 0.9), runeHot: ringMat(rune, 8, 1) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [glow],
  );
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const h = hoverWorld.current;
    const snap = engine.getRenderSnapshot();
    const u = ui?.current;
    const choosing = !!u && (u.pendingTowerType !== null || u.placingTower !== null || snap.phase === "DEPLOY");
    const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.06;
    sites.forEach((s, i) => {
      const r = rings.current[i];
      if (!r) return;
      const p = s.position;
      const taken = snap.towers.some((t) => Math.hypot(t.position.x - p.x, t.position.y - p.y) < 20);
      const hot = !!h && Math.hypot(h.x - p.x, h.y - p.y) < 30;
      const isRune = s.trait === "RUNE_ALTAR";
      r.material = hot ? (isRune ? mats.runeHot : mats.hot) : choosing && !taken ? mats.open : isRune ? mats.runeCold : mats.cold;
      r.scale.setScalar(hot ? 1.14 : choosing && !taken ? pulse : 1);
    });
  });
  return (
    <>
      {sites.map((s, i) => (
        <group key={s.id} position={worldToThree(s.position, terrain.heightAt(s.position))}>
          <mesh geometry={s.trait === "HIGH_GROUND" ? highGeo : geo} material={mat} castShadow receiveShadow />
          <mesh ref={(m) => (rings.current[i] = m)} rotation-x={-Math.PI / 2} position-y={s.trait === "HIGH_GROUND" ? 7.3 : 2.8} material={mats.cold}>
            <ringGeometry args={[13, 14.4, 40]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ----------------------------------------------------------------- range preview / selection
function RangePreview({
  engine,
  sites,
  terrain,
  ui,
}: {
  engine: GameEngine;
  sites: readonly BuildSite[];
  terrain: TerrainData;
  ui?: MutableRefObject<Battlefield3DUiState>;
}) {
  const group = useRef<THREE.Group>(null);
  const edge = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.75, depthTest: false, depthWrite: false }), []);
  const fill = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.08, depthTest: false, depthWrite: false }), []);
  const sel = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }), []);
  const edgeGeo = useMemo(() => new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), []);
  const fillGeo = useMemo(() => new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), []);
  const selGeo = useMemo(() => new THREE.RingGeometry(17, 19.5, 48).rotateX(-Math.PI / 2), []);
  const refs = useRef<{ edge: THREE.Mesh | null; fill: THREE.Mesh | null; sel: THREE.Mesh | null }>({ edge: null, fill: null, sel: null });
  useFrame(({ clock }) => {
    const { edge: e, fill: f, sel: s } = refs.current;
    if (!e || !f || !s) return;
    const snap = engine.getRenderSnapshot();
    let at: { x: number; y: number } | null = null;
    let range = 0;
    let color = "#ffffff";
    const u = ui?.current;
    const subjectType = u?.placingTower?.type ?? u?.pendingTowerType ?? null;
    const h = hoverWorld.current;
    if (subjectType && h) {
      const site = sites.find((st) => Math.hypot(st.position.x - h.x, st.position.y - h.y) < 30);
      if (site) {
        at = site.position;
        range = u?.placingTower
          ? getTowerStats({ ...u.placingTower, siteTrait: site.trait }).range
          : getTowerLevelStats(subjectType, 1).range * (site.trait === "HIGH_GROUND" ? HIGH_GROUND_RANGE_MULT : 1);
        color = TOWER_COLORS[subjectType] ?? color;
      }
    }
    const selected = snap.selectedTowerId ? snap.towers.find((t) => t.id === snap.selectedTowerId) : undefined;
    if (!at && selected) {
      at = selected.position;
      range = getTowerStats(selected).range;
      color = TOWER_COLORS[selected.type] ?? color;
    }
    s.visible = !!selected;
    if (selected) {
      s.position.copy(worldToThree(selected.position, terrain.heightAt(selected.position) + 4));
      s.rotation.y = clock.elapsedTime * 0.8;
      (s.material as THREE.MeshBasicMaterial).color.set(TOWER_COLORS[selected.type] ?? "#fff").multiplyScalar(2);
    }
    e.visible = f.visible = !!at;
    if (at) {
      const p = worldToThree(at, terrain.heightAt(at) + 3);
      e.position.copy(p);
      f.position.copy(p);
      e.scale.setScalar(range);
      f.scale.setScalar(range);
      (e.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.6);
      (f.material as THREE.MeshBasicMaterial).color.set(color);
    }
  });
  return (
    <group ref={group}>
      <mesh ref={(m) => (refs.current.fill = m)} geometry={fillGeo} material={fill} renderOrder={8} visible={false} />
      <mesh ref={(m) => (refs.current.edge = m)} geometry={edgeGeo} material={edge} renderOrder={9} visible={false} />
      <mesh ref={(m) => (refs.current.sel = m)} geometry={selGeo} material={sel} renderOrder={9} visible={false} />
    </group>
  );
}

// ----------------------------------------------------------------- castle
function castleTier(fraction: number) {
  return fraction > 0.75 ? 1 : fraction > 0.5 ? 2 : fraction > 0.25 ? 3 : 4;
}

function cobbleTexture(base: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1e1a15";
  g.fillRect(0, 0, 512, 512);
  const col = new THREE.Color(base);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 512; y += 22) {
    const off = (y / 22) % 2 ? 14 : 0;
    for (let x = -off; x < 512; x += 28) {
      const w = 22 + rnd() * 6;
      const k = 0.55 + rnd() * 0.5;
      g.fillStyle = `rgb(${(col.r * 255 * k) | 0},${(col.g * 255 * k) | 0},${(col.b * 255 * k) | 0})`;
      g.beginPath();
      g.roundRect(x + 2 + rnd() * 2, y + 2 + rnd() * 2, w, 17 + rnd() * 3, 5);
      g.fill();
    }
  }
  // fade the edge into the ground
  const fade = g.createRadialGradient(256, 256, 150, 256, 256, 256);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = fade;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Castle({
  engine,
  biomeId,
  fortress,
  terrain,
  fx,
}: {
  engine: GameEngine;
  biomeId: string;
  fortress: { position: { x: number; y: number }; facingDir: { x: number; y: number } };
  terrain: TerrainData;
  fx: Effects;
}) {
  const [tier, setTier] = useState(1);
  const model = useMemo(() => buildCastleModel(biomeId, tier), [biomeId, tier]);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const hpCheck = useRef(0);
  const lastHp = useRef<number | null>(null);
  const plaza = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: cobbleTexture(model.lava ? "#4a3a34" : "#8a8070"), transparent: true, roughness: 0.95, depthWrite: false });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    return m;
  }, [model.lava]);
  const anchor = worldToThree(fortress.position, terrain.heightAt(fortress.position));
  // the gate faces the viewer, turned a little towards the road the horde comes in on
  const yaw = -0.5;
  const SCALE = 1.3;
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const at = (name: string) => {
    const a = model.anchors[name];
    if (!a || !group.current) return null;
    return group.current.localToWorld(tmp.copy(a));
  };
  const braziers = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const sx of [-1, 1]) {
      const p = anchor.clone().addScaledVector(fwd, 66).addScaledVector(side, sx * 24);
      const w = threeToWorld(p);
      p.y = terrain.heightAt(w);
      out.push(p);
    }
    return out;
  }, [anchor.x, anchor.z, yaw, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // an outer curtain wall around the plaza, open wherever the road runs through
  const wall = useMemo(() => {
    const R = 88;
    const segLen = 10;
    const n = Math.round((2 * Math.PI * R) / segLen);
    const blocks: { p: THREE.Vector3; yaw: number }[] = [];
    const posts: THREE.Vector3[] = [];
    let wasOpen = true;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const w = { x: fortress.position.x + Math.cos(a) * R, y: fortress.position.y + Math.sin(a) * R };
      const open = terrain.roadDistance(w) < 30 || w.x > WORLD_SIZE.width + 60 || w.y > WORLD_SIZE.height + 60 || w.y < -60;
      const p = worldToThree(w, terrain.heightAt(w));
      if (!open && i < n) blocks.push({ p, yaw: -a + Math.PI / 2 });
      if (open !== wasOpen && i > 0) posts.push(p);
      wasOpen = open;
    }
    const stone = new THREE.MeshStandardMaterial({ color: model.lava ? "#4a3e3a" : "#8a8273", roughness: 0.92 });
    const segGeo = new THREE.BoxGeometry(segLen + 0.6, 7, 3.6);
    segGeo.translate(0, 3.5, 0);
    const merlon = new THREE.BoxGeometry(3, 2.4, 4);
    merlon.translate(0, 8.2, 0);
    const segs = new THREE.InstancedMesh(segGeo, stone, blocks.length);
    const mers = new THREE.InstancedMesh(merlon, stone, blocks.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    blocks.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw);
      m.compose(b.p.clone().setY(b.p.y - 1), q, one);
      segs.setMatrixAt(i, m);
      mers.setMatrixAt(i, m);
    });
    segs.castShadow = segs.receiveShadow = mers.castShadow = true;
    const g = new THREE.Group();
    g.add(segs, mers);
    const postGeo = new THREE.CylinderGeometry(4.6, 5.4, 14, 10);
    postGeo.translate(0, 6.5, 0);
    const capGeo = new THREE.ConeGeometry(5.8, 7, 10);
    capGeo.translate(0, 17, 0);
    const roof = new THREE.MeshStandardMaterial({ color: "#6a2418", roughness: 0.8 });
    for (const p of posts) {
      const post = new THREE.Mesh(postGeo, stone);
      post.position.copy(p).setY(p.y - 1);
      post.castShadow = true;
      const cap = new THREE.Mesh(capGeo, roof);
      cap.position.copy(post.position);
      cap.castShadow = true;
      g.add(post, cap);
    }
    return { group: g, posts };
  }, [fortress.position, terrain, model.lava]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    hpCheck.current += dt;
    if (hpCheck.current > 0.4) {
      hpCheck.current = 0;
      const h = engine.getHudSnapshot();
      const frac = h.maxBaseHp > 0 ? h.baseHp / h.maxBaseHp : 1;
      const nt = castleTier(frac);
      if (nt !== tier) setTier(nt);
      if (lastHp.current !== null && h.baseHp < lastHp.current) {
        // the castle was struck: sparks and a shock ring at the gate
        const g = at("gate");
        if (g) {
          fx.glow.emit(g.clone(), { count: 40, color: "#fff0c0", colorEnd: "#ff4a1a", size: 3, life: 0.7, speed: 90, up: 30, gravity: 120, drag: 1.2 });
          fx.rings.ring(new THREE.Vector3(g.x, anchor.y + 2, g.z), "#ff5a2a", 6, 60, 0.6);
        }
      }
      lastHp.current = h.baseHp;
    }
    if (light.current) light.current.intensity = 5200 + Math.sin(t * 13) * 600 + Math.sin(t * 7.3) * 500;
    if (coreLight.current) coreLight.current.intensity = 2600 + Math.sin(t * 2.2) * 900;
    // torches and braziers burn every frame
    for (const n of ["torchL", "torchR"]) {
      const p = at(n);
      if (p && Math.random() < 0.8) fx.flame(p.clone(), 0.9);
    }
    for (const b of braziers) {
      if (Math.random() < 0.9) fx.flame(b.clone().add(new THREE.Vector3(0, 10, 0)), 1);
      if (Math.random() < 0.05) fx.smokePuff(b.clone().add(new THREE.Vector3(0, 18, 0)), 0.45);
    }
    // the crystal core breathes magic upwards
    const c = at("core");
    if (c && Math.random() < 0.35) fx.mote(c.clone(), model.core, 4, 18);
    // a hurt castle smokes; a dying one burns
    if (tier >= 2) {
      const k = at("keepWindow") ?? c;
      if (k && Math.random() < 0.18 * tier) fx.smokePuff(k.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, 10, (Math.random() - 0.5) * 20)), 1 + tier * 0.3);
    }
    if (tier >= 3) {
      for (const n of ["towerWindowL", "towerWindowR", "keepWindow"]) {
        const p = at(n);
        if (p && Math.random() < 0.5) fx.flame(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, 0)), 1.6, "#ff5a1a");
      }
    }
  });

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[anchor.x, anchor.y + 0.8, anchor.z]} material={plaza} receiveShadow renderOrder={1}>
        <circleGeometry args={[90, 48]} />
      </mesh>
      <primitive object={wall.group} />
      <group ref={group} position={anchor} scale={SCALE} rotation-y={yaw}>
        <primitive object={model.root} />
        <pointLight ref={light} color="#ffa050" intensity={5200} distance={190} decay={2} position={[0, 30, 46]} />
        <pointLight ref={coreLight} color={model.core} intensity={2600} distance={120} decay={2} position={[0, 50, 20]} />
      </group>
      {braziers.map((b, i) => (
        <group key={i} position={b} scale={0.65}>
          <mesh castShadow position-y={6}>
            <cylinderGeometry args={[3.2, 4.6, 12, 8]} />
            <meshStandardMaterial color="#4a4640" roughness={0.9} />
          </mesh>
          <mesh position-y={13}>
            <cylinderGeometry args={[5.5, 3.4, 3, 10, 1, true]} />
            <meshStandardMaterial color="#2a2420" roughness={0.6} metalness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position-y={13.6}>
            <sphereGeometry args={[3.4, 10, 8]} />
            <meshStandardMaterial color="#000" emissive="#ff8a2a" emissiveIntensity={5} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.6} material={glowDiscMaterial("#ff8a3a", 0.55)}>
            <circleGeometry args={[34, 24]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ----------------------------------------------------------------- portal
const VORTEX_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const VORTEX_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float swirl = a + r * 5.5 - uTime * 1.6;
    float n = noise(vec2(swirl * 1.6, r * 6.0 - uTime * 0.9)) * 0.6 + noise(vec2(swirl * 3.4, r * 12.0)) * 0.4;
    float arms = pow(0.5 + 0.5 * sin(swirl * 3.0 + n * 3.0), 3.0);
    float core = smoothstep(0.55, 0.0, r);
    float rim = smoothstep(0.7, 0.95, r) * smoothstep(1.0, 0.93, r);
    float body = (arms * 0.8 + n * 0.5) * smoothstep(1.0, 0.25, r);
    vec3 col = uColor * (body * 2.2 + rim * 4.0) + vec3(0.02, 0.0, 0.04) * core;
    float alpha = clamp(body + rim + core * 0.9, 0.0, 1.0);
    // a near-black eye in the middle: the way into somewhere else
    col *= mix(1.0, 0.12, core);
    gl_FragColor = vec4(col, alpha);
  }
`;

function Portal({ path, terrain, glow, fx }: { path: readonly { x: number; y: number }[]; terrain: TerrainData; glow: string; fx: Effects }) {
  const at = getPortalAnchor(path);
  const p = worldToThree(at, terrain.heightAt(at));
  const vortex = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VORTEX_VERT,
        fragmentShader: VORTEX_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(glow) } },
        transparent: true,
        depthWrite: false,
      }),
    [glow],
  );
  const stones = useMemo(() => {
    const geo = new THREE.CylinderGeometry(2.4, 4.2, 26, 5, 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (0.85 + ((i * 7919) % 13) / 40));
    geo.computeVertexNormals();
    geo.translate(0, 11, 0);
    return geo;
  }, []);
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2e2a30", roughness: 0.9 }), []);
  const runeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(glow), emissiveIntensity: 4 }), [glow]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    vortex.uniforms.uTime!.value = t;
    if (light.current) light.current.intensity = 4200 + Math.sin(t * 3.1) * 1200;
    if (Math.random() < 0.6) fx.mote(p.clone().add(new THREE.Vector3(0, 3, 0)), glow, 14, 20);
  });
  const N = 7;
  return (
    <group position={p}>
      <mesh rotation-x={-Math.PI / 2} position-y={1.2} material={vortex} renderOrder={6}>
        <circleGeometry args={[19, 64]} />
      </mesh>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + 0.3;
        const r = 25;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} scale={1} rotation={[(Math.random() - 0.5) * 0.25, a, (Math.random() - 0.5) * 0.3]}>
            <mesh geometry={stones} material={stoneMat} castShadow receiveShadow scale={[0.65, 0.45 + (i % 3) * 0.15, 0.65]} />
            <mesh position={[0, 7, 2.2]} material={runeMat}>
              <boxGeometry args={[0.8, 3.2, 0.4]} />
            </mesh>
          </group>
        );
      })}
      <mesh rotation-x={-Math.PI / 2} position-y={0.7} material={glowDiscMaterial(glow, 0.6)}>
        <circleGeometry args={[42, 32]} />
      </mesh>
      <pointLight ref={light} color={glow} intensity={4200} distance={170} decay={2} position={[0, 24, 0]} />
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

interface LiveTower {
  key: string;
  obj: THREE.Group;
  turret: THREE.Object3D | null;
  aim: number;
  crystal: THREE.Mesh;
  top: number;
  disc: THREE.Mesh;
}

function Towers({ engine, terrain, fx }: { engine: GameEngine; terrain: TerrainData; fx: Effects }) {
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, LiveTower>());
  const crystalGeo = useMemo(() => new THREE.OctahedronGeometry(3.4, 0), []);
  const crystalMats = useMemo(() => {
    const out: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [k, v] of Object.entries(TOWER_COLORS)) out[k] = new THREE.MeshStandardMaterial({ color: v, emissive: new THREE.Color(v), emissiveIntensity: 5, roughness: 0.2 });
    return out;
  }, []);
  const discMats = useMemo(() => {
    const out: Record<string, THREE.MeshBasicMaterial> = {};
    for (const [k, v] of Object.entries(TOWER_COLORS)) out[k] = glowDiscMaterial(v, 0.65);
    return out;
  }, []);
  const discGeo = useMemo(() => new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), []);
  const seenShots = useRef(new Set<string>());
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    const t = clock.elapsedTime;
    for (const tw of snap.towers as readonly TowerInstance[]) {
      seen.add(tw.id);
      const stage = getTowerVisualStage(tw.level);
      const key = `${tw.type}|${stage}|${tw.equippedSkinId ?? "base"}`;
      let entry = live.current.get(tw.id);
      if (!entry || entry.key !== key) {
        if (entry) g.remove(entry.obj, entry.disc);
        const model = towerModel(tw.type, stage, tw.equippedSkinId ?? "base");
        const obj = model.root.clone(true);
        const turret = obj.children[model.root.children.indexOf(model.turret)] ?? null;
        const s = TOWER_PRESENTATION_SCALE * 1.3;
        obj.scale.setScalar(s);
        obj.position.copy(worldToThree(tw.position, terrain.heightAt(tw.position) + 2.5));
        // a floating crystal over the roof: the tower's colour, readable from above
        const box = new THREE.Box3().setFromObject(model.root);
        const top = box.max.y + 6;
        const crystal = new THREE.Mesh(crystalGeo, crystalMats[tw.type] ?? crystalMats.IRONWOOD!);
        crystal.scale.set(1, 1.6, 1).multiplyScalar((0.6 + stage * 0.1) / s);
        crystal.position.y = top;
        obj.add(crystal);
        const disc = new THREE.Mesh(discGeo, discMats[tw.type] ?? discMats.IRONWOOD!);
        disc.position.copy(obj.position).setY(obj.position.y + 1.4);
        disc.scale.setScalar(22 + stage * 2);
        disc.renderOrder = 2;
        g.add(obj, disc);
        entry = { key, obj, turret, aim: 0, crystal, top, disc };
        live.current.set(tw.id, entry);
        // the moment it appears: a burst of its colour
        fx.rings.ring(disc.position.clone(), TOWER_COLORS[tw.type] ?? "#fff", 6, 46, 0.6);
        fx.glow.emit(obj.position.clone().add(new THREE.Vector3(0, 10, 0)), { count: 40, color: "#ffffff", colorEnd: TOWER_COLORS[tw.type] ?? "#fff", size: 3, life: 0.9, speed: 60, up: 40, gravity: 50 });
      }
      entry.crystal.rotation.y = t * 1.4;
      entry.crystal.position.y = entry.top + Math.sin(t * 2 + tw.position.x) * 1.2;
      const disabled = tw.disabledRemainingMs > 0;
      entry.crystal.visible = !disabled;
      const manaFull = tw.mana >= MANA_MAX;
      if (manaFull && Math.random() < 0.25) fx.mote(entry.obj.position.clone().add(new THREE.Vector3(0, 20, 0)), TOWER_COLORS[tw.type] ?? "#fff", 14, 30);
      // aim the turret at the most recent shot fired from this tower
      const shot = snap.projectiles.find((p) => Math.hypot(p.from.x - tw.position.x, p.from.y - tw.position.y) < 30);
      if (shot && entry.turret) entry.aim = worldDirToYaw({ x: shot.to.x - tw.position.x, y: shot.to.y - tw.position.y }) - Math.PI / 2;
      if (entry.turret) entry.turret.rotation.y += (entry.aim - entry.turret.rotation.y) * Math.min(1, dt * 12);
    }
    // muzzle flashes for shots fired this frame
    const now = new Set<string>();
    for (const p of snap.projectiles) {
      now.add(p.id);
      if (seenShots.current.has(p.id)) continue;
      const tw = snap.towers.find((x) => Math.hypot(p.from.x - x.position.x, p.from.y - x.position.y) < 30);
      const e = tw ? live.current.get(tw.id) : undefined;
      const top = e ? e.obj.position.clone().setY(e.obj.position.y + e.top * e.obj.scale.y * 0.8) : worldToThree(p.from, 30);
      fx.muzzle(top, TOWER_COLORS[p.towerType] ?? "#fff", p.isSpecial);
    }
    seenShots.current = now;
    for (const [id, e] of live.current)
      if (!seen.has(id)) {
        g.remove(e.obj, e.disc);
        live.current.delete(id);
      }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- enemies
const ENEMY_HEIGHT = 56; // world units — big enough that a creature reads as a creature

interface LiveEnemy {
  c: Creature;
  obj: THREE.Object3D;
  dyingFor: number;
  scale: number;
  born: number;
  boss: boolean;
  shadow: THREE.Mesh;
}

/** Heads-up data for the 2D layer: where each enemy's head is this frame. */
const enemyHeads = new Map<string, THREE.Vector3>();

function Enemies({
  engine,
  terrain,
  fx,
  fortress,
  portal,
}: {
  engine: GameEngine;
  terrain: TerrainData;
  fx: Effects;
  fortress: { x: number; y: number };
  portal: { x: number; y: number };
}) {
  const gltfs = useLoader(GLTFLoader, CREATURE_URLS) as GLTF[];
  const kits = useMemo(() => prepareCreatures(gltfs), [gltfs]);
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, LiveEnemy>());
  const last = useRef(new Map<string, EnemyInstance>());
  const blobMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: radialTexture(), color: "#000", transparent: true, opacity: 0.55, depthWrite: false });
    return m;
  }, []);
  const blobGeo = useMemo(() => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), []);
  const portal3 = useMemo(() => worldToThree(portal, terrain.heightAt(portal) + 4), [portal, terrain]);

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
        const tier = en.boss ? (en.boss.isMainBoss ? 2.1 : 1.6) : en.elite ? 1.3 : 1;
        const cid = creatureFor(en.type, !!en.boss, !!en.boss?.isMainBoss);
        const c = new Creature(kits[cid], ENEMY_HEIGHT * tier * heightFactor(en.type), { id: cid, biomeId: snap.biomeId });
        const obj = c.obj;
        const scale = c.scale;
        const shadow = new THREE.Mesh(blobGeo, blobMat);
        shadow.scale.setScalar(8 * tier);
        shadow.renderOrder = 3;
        g.add(obj, shadow);
        // only enemies that start at the rift crawl out of it
        const fresh = Math.hypot(en.position.x - portal.x, en.position.y - portal.y) < 90;
        e = { c, obj, dyingFor: -1, scale, born: fresh ? 0 : 1, boss: !!en.boss, shadow };
        live.current.set(en.id, e);
        if (fresh) {
          fx.glow.emit(portal3.clone(), { count: e.boss ? 60 : 14, color: "#ffffff", colorEnd: "#8a3aff", size: 4, life: 0.7, speed: 50, up: 30, drag: 2, radius: 8 });
          if (e.boss) fx.rings.ring(portal3.clone(), "#b06aff", 10, 120, 0.9);
        }
      }
      const groundY = terrain.heightAt(en.position);
      const pos = worldToThree(en.position, groundY);
      // rising out of the portal for the first half second
      if (e.born < 1) {
        e.born = Math.min(1, e.born + dt * 1.8);
        const k = 1 - (1 - e.born) * (1 - e.born);
        pos.y -= (1 - k) * ENEMY_HEIGHT * 0.9;
        e.obj.scale.setScalar(e.scale * (0.5 + 0.5 * k));
      }
      e.obj.position.copy(pos);
      e.shadow.position.set(pos.x, groundY + 0.9, pos.z);
      const yaw = worldDirToYaw(en.direction);
      const d = Math.atan2(Math.sin(yaw - e.obj.rotation.y), Math.cos(yaw - e.obj.rotation.y));
      e.obj.rotation.y += d * Math.min(1, dt * 8);
      e.c.walk.timeScale = en.slow ? 0.55 : 1.0;
      e.c.update(dt);
      const tierK = en.boss ? (en.boss.isMainBoss ? 2.1 : 1.6) : en.elite ? 1.3 : 1;
      const headY = pos.y + ENEMY_HEIGHT * tierK * (e.obj.scale.x / e.scale) + 6;
      enemyHeads.set(en.id, new THREE.Vector3(pos.x, headY, pos.z));
      // status effects on the body
      if (en.burn && Math.random() < 0.5) fx.flame(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, ENEMY_HEIGHT * 0.5, (Math.random() - 0.5) * 10)), 0.8, "#ff4a0a");
      if (en.slow && Math.random() < 0.35) fx.mote(pos.clone().add(new THREE.Vector3(0, ENEMY_HEIGHT * 0.4, 0)), "#8fe6ff", 10, 4);
    }
    for (const [id, e] of live.current) {
      if (seen.has(id)) continue;
      enemyHeads.delete(id);
      // gone from the field: play the fall, then remove
      if (e.dyingFor < 0) {
        e.dyingFor = 0;
        const lastPos = last.current.get(id)?.position;
        const reachedCastle = !!lastPos && Math.hypot(lastPos.x - fortress.x, lastPos.y - fortress.y) < 110;
        if (!reachedCastle) fx.death(e.obj.position.clone().add(new THREE.Vector3(0, ENEMY_HEIGHT * 0.4, 0)), e.boss);
        if (!reachedCastle) e.c.fall();
        else e.dyingFor = 99;
      }
      e.dyingFor += dt;
      e.c.update(dt);
      if (e.dyingFor > 1.6) {
        e.obj.position.y -= dt * 12;
        (e.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55;
        e.shadow.scale.multiplyScalar(1 - dt * 1.5);
      }
      if (e.dyingFor > 2.6) {
        g.remove(e.obj, e.shadow);
        live.current.delete(id);
        last.current.delete(id);
      }
    }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- projectiles
interface ShotState {
  type: string;
  to: { x: number; y: number };
  from: { x: number; y: number };
  chain: { x: number; y: number }[];
  special: boolean;
  skin: string | null;
}

function Projectiles({ engine, terrain, fx }: { engine: GameEngine; terrain: TerrainData; fx: Effects }) {
  const MAX = 64;
  const geo = useMemo(() => new THREE.SphereGeometry(2.6, 12, 8), []);
  const mats = useMemo(() => {
    const out: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [k, v] of Object.entries(TOWER_COLORS)) out[k] = new THREE.MeshStandardMaterial({ color: "#000", emissive: new THREE.Color(v), emissiveIntensity: 9 });
    return out;
  }, []);
  const pool = useRef<THREE.Mesh[]>([]);
  const group = useRef<THREE.Group>(null);
  const shots = useRef(new Map<string, ShotState>());
  const ground = (p: { x: number; y: number }, h: number) => worldToThree(p, terrain.heightAt(p) + h);
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
    const alive = new Set<string>();
    let i = 0;
    for (const p of snap.projectiles) {
      alive.add(p.id);
      if (!shots.current.has(p.id)) {
        shots.current.set(p.id, { type: p.towerType, to: { ...p.to }, from: { ...p.from }, chain: p.chainTargets.map((c) => ({ ...c })), special: p.isSpecial, skin: p.skinId ?? null });
        // lightning is instant: the bolt is the shot
        if (p.towerType === "STORMCALLER") {
          const color = p.skinId === "STORMCALLER_PACK_CRIMSON_STORM" ? "#ff1a2a" : p.skinId === "STORMCALLER_PACK_SOVEREIGN" ? "#ffd878" : TOWER_COLORS.STORMCALLER!;
          let prev = ground(p.from, 42);
          const hits = [p.to, ...p.chainTargets];
          for (const h of hits) {
            const next = ground(h, 16);
            fx.bolts.bolt(prev, next, color, p.isSpecial ? 0.3 : 0.18, p.isSpecial ? 14 : 9);
            if (p.isSpecial) fx.bolts.bolt(prev, next, "#ffffff", 0.22, 6);
            prev = next;
          }
        }
      }
      shots.current.get(p.id)!.to = { ...p.to };
      if (p.towerType === "STORMCALLER") continue;
      if (i >= MAX) continue;
      const m = pool.current[i++]!;
      const t = 1 - Math.max(0, Math.min(1, p.remainingMs / p.totalMs));
      const x = p.from.x + (p.to.x - p.from.x) * t;
      const y = p.from.y + (p.to.y - p.from.y) * t;
      const arc = p.towerType === "INFERNO" ? Math.sin(t * Math.PI) * 34 : 0;
      const h = 34 * (1 - t) + 16 * t + arc;
      m.position.copy(ground({ x, y }, h));
      m.material = mats[p.towerType] ?? mats.IRONWOOD!;
      m.scale.setScalar(p.isSpecial ? 2.2 : 1);
      m.visible = true;
      if (!fx.packTrail(p.skinId, m.position.clone(), p.isSpecial)) fx.trail(p.towerType, m.position.clone(), p.isSpecial);
    }
    for (; i < pool.current.length; i++) pool.current[i]!.visible = false;
    // shots that just landed
    for (const [id, s] of shots.current) {
      if (alive.has(id)) continue;
      shots.current.delete(id);
      const at = ground(s.to, 14);
      if (!fx.packImpact(s.skin, at, s.special, ground(s.to, 2))) fx.impact(s.type, at, s.special, ground(s.to, 2));
      if (s.type === "STORMCALLER") for (const c of s.chain) if (!fx.packImpact(s.skin, ground(c, 14), false, ground(c, 2))) fx.impact("STORMCALLER", ground(c, 14), false, ground(c, 2));
    }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- loot
function LootBeams({ engine, terrain, fx }: { engine: GameEngine; terrain: TerrainData; fx: Effects }) {
  const group = useRef<THREE.Group>(null);
  const beams = useRef(new Map<number, { mesh: THREE.Mesh; age: number }>());
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(3.5, 6, 120, 12, 1, true);
    g.translate(0, 60, 0);
    return g;
  }, []);
  const seen = useRef(-1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const snap = engine.getRenderSnapshot();
    for (const d of snap.lootDrops) {
      if (d.seq <= seen.current) continue;
      seen.current = d.seq;
      const color = RARITY_COLORS[d.rarity] ?? "#ffffff";
      const pos = worldToThree(d, terrain.heightAt(d));
      if (d.kind === "item" || d.rarity === "EPIC" || d.rarity === "LEGENDARY" || d.rarity === "MYTHIC") {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        g.add(mesh);
        beams.current.set(d.seq, { mesh, age: 0 });
        fx.rings.ring(pos.clone().setY(pos.y + 2), color, 4, 40, 0.8);
      }
      fx.glow.emit(pos.clone().add(new THREE.Vector3(0, 8, 0)), { count: 16, color: "#ffffff", colorEnd: color, size: 3, life: 0.9, speed: 30, up: 40, gravity: 60 });
    }
    for (const [k, b] of beams.current) {
      b.age += dt;
      const life = 5;
      const m = b.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.min(1, b.age * 4) * Math.max(0, 1 - b.age / life) * 0.45;
      if (b.age > life) {
        g.remove(b.mesh);
        m.dispose();
        beams.current.delete(k);
      }
    }
  });
  return <group ref={group} />;
}

// ----------------------------------------------------------------- 2D heads-up layer
interface Floater {
  x: THREE.Vector3;
  text: string;
  age: number;
  big: boolean;
  color: string;
}

function HudLayer({ engine, canvas }: { engine: GameEngine; terrain: TerrainData; canvas: RefObject<HTMLCanvasElement> }) {
  const { camera, size } = useThree();
  const prevHp = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, { dmg: number; t: number; burn: boolean }>());
  const floaters = useRef<Floater[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(size.width * dpr);
    const H = Math.round(size.height * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);
    const toScreen = (p: THREE.Vector3) => {
      v.copy(p).project(camera);
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, on: v.z < 1 };
    };
    const snap = engine.getRenderSnapshot();
    const alive = new Set<string>();
    for (const en of snap.enemies as readonly EnemyInstance[]) {
      alive.add(en.id);
      const head = enemyHeads.get(en.id);
      // damage bookkeeping: gather hits for a moment so a burst reads as one number
      const before = prevHp.current.get(en.id);
      prevHp.current.set(en.id, en.hp);
      if (before !== undefined && en.hp < before) {
        const p = pending.current.get(en.id) ?? { dmg: 0, t: 0, burn: true };
        p.dmg += before - en.hp;
        p.burn = p.burn && !!en.burn && before - en.hp < en.maxHp * 0.02;
        pending.current.set(en.id, p);
      }
      if (!head) continue;
      const s = toScreen(head);
      if (!s.on) continue;
      const boss = !!en.boss;
      const show = en.hp < en.maxHp || boss || en.elite;
      if (!show) continue;
      const w = boss ? 76 : en.elite ? 46 : 36;
      const h = boss ? 7 : 5;
      const x = s.x - w / 2;
      const y = s.y - 4;
      const f = Math.max(0, Math.min(1, en.hp / en.maxHp));
      ctx.fillStyle = "rgba(8,6,6,0.82)";
      ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
      ctx.fillStyle = "#3a0d10";
      ctx.fillRect(x, y, w, h);
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, boss ? "#ff6a4a" : "#f0484a");
      grad.addColorStop(1, boss ? "#a8200e" : "#9a1620");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w * f, h);
      if (en.slow) {
        ctx.fillStyle = "rgba(143,230,255,0.55)";
        ctx.fillRect(x, y, w * f, 1.5);
      }
      if (en.elite || boss) {
        ctx.strokeStyle = boss ? "#ffcf6a" : "#d9b45a";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
      }
    }
    for (const id of prevHp.current.keys()) if (!alive.has(id)) prevHp.current.delete(id);
    // flush gathered damage into floating numbers
    for (const [id, p] of pending.current) {
      p.t += dt;
      const head = enemyHeads.get(id);
      const en = snap.enemies.find((e) => e.id === id);
      if (p.t < 0.12 && en) continue;
      pending.current.delete(id);
      if (!head || p.dmg < 1) continue;
      const big = !!en && p.dmg >= en.maxHp * 0.25;
      floaters.current.push({
        x: head.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 4, 0)),
        text: Math.round(p.dmg).toLocaleString(),
        age: 0,
        big,
        color: p.burn ? "#ff9a4a" : big ? "#ffd166" : "#fff6e0",
      });
    }
    if (floaters.current.length > 60) floaters.current.splice(0, floaters.current.length - 60);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    floaters.current = floaters.current.filter((f) => (f.age += dt) < 0.9);
    for (const f of floaters.current) {
      const s = toScreen(f.x);
      const t = f.age / 0.9;
      const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (t - 0.12) * 0.5);
      const px = (f.big ? 22 : 15) * pop;
      ctx.font = `900 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const y = s.y - 8 - t * 30;
      ctx.globalAlpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      ctx.lineWidth = f.big ? 5 : 4;
      ctx.strokeStyle = "#140b06";
      ctx.strokeText(f.text, s.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, s.x, y);
      ctx.globalAlpha = 1;
    }
    // tower mana bars under each tower
    for (const tw of snap.towers) {
      const s = toScreen(worldToThree(tw.position, 2));
      const w = 30;
      const frac = Math.max(0, Math.min(1, tw.mana / MANA_MAX));
      const x = s.x - w / 2;
      const y = s.y + 11;
      ctx.fillStyle = "rgba(6,8,14,0.8)";
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = frac >= 1 ? "#a8e4ff" : "#3a7ad8";
      ctx.fillRect(x, y, w * frac, 3);
      if (tw.hp < tw.maxHp) {
        ctx.fillStyle = "rgba(6,8,14,0.8)";
        ctx.fillRect(x - 1, y + 5, w + 2, 5);
        ctx.fillStyle = "#e0b24a";
        ctx.fillRect(x, y + 6, w * Math.max(0, tw.hp / tw.maxHp), 3);
      }
    }
  });
  return null;
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

/**
 * Turns a click / tap / hover on the 3D ground into a world position and hands
 * it to the 2D map's own handlers, so building, selecting and cancelling work
 * exactly as on the flat map.
 */
function PointerBridge({ bridge }: { bridge?: MutableRefObject<MapPointerBridge | null> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    const hit = new THREE.Vector3();
    const toWorld = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(ground, hit)) return null;
      const w = threeToWorld(hit);
      if (w.x < -40 || w.y < -40 || w.x > WORLD_SIZE.width + 40 || w.y > WORLD_SIZE.height + 40) return null;
      return w;
    };
    const move = (e: PointerEvent) => {
      const w = toWorld(e);
      hoverWorld.current = w;
      bridge?.current?.hover(w);
    };
    const leave = () => {
      hoverWorld.current = null;
      bridge?.current?.hover(null);
    };
    const click = (e: MouseEvent) => {
      const w = toWorld(e);
      if (w) bridge?.current?.click(w);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("click", click);
    el.style.cursor = "pointer";
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("click", click);
    };
  }, [camera, gl, bridge]);
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

export const Battlefield3D = memo(function Battlefield3D({
  engine,
  quality: initial,
  pointerBridge,
  uiState,
}: {
  engine: GameEngine;
  quality?: Quality;
  pointerBridge?: MutableRefObject<MapPointerBridge | null>;
  uiState?: MutableRefObject<Battlefield3DUiState>;
}) {
  const [quality, setQuality] = useState<Quality>(() => initial ?? pickAutoQuality());
  const hud = useRef<HTMLCanvasElement>(null);
  return (
    <>
      <Canvas
        shadows="soft"
        dpr={quality === "high" ? [1, 1.5] : 1}
        gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        camera={{ fov: CAMERA_FOV, position: [0, 900, 700] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <CameraRig />
        <PointerBridge bridge={pointerBridge} />
        <FrameRateGuard quality={quality} onSlow={() => setQuality("low")} />
        <World engine={engine} quality={quality} ui={uiState} hud={hud} />
        <EffectComposer multisampling={0}>
          {quality === "high" ? <N8AO aoRadius={18} intensity={2.4} distanceFalloff={1.2} quality="medium" /> : <></>}
          <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={1.0} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.28} darkness={0.6} />
          <SMAA />
        </EffectComposer>
      </Canvas>
      <canvas ref={hud} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
    </>
  );
});
