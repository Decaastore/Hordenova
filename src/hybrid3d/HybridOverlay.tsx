import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import { getMapLayout } from "@/data/mapLayouts";
import { getBiome } from "@/rendering/biomes";
import { getFortressAnchor, getPortalAnchor } from "@/rendering/MapRenderer";
import { cameraPosition, groundGroupPlacement, worldDirectionToThreeYaw, worldToLocalGround } from "@/rendering3d/enemyProjection";
import { buildCastleModel, type CastleModel } from "@/battlefield3d/models/castleModel";
import { Effects } from "@/battlefield3d/fx";
import { castleDressingFor } from "@/rendering/castleSprites";
import { getActiveCastleSkin } from "@/rendering/castleSkinFx";
import { footprints } from "@/rendering/footprints";
import { TILT_COS } from "@/rendering3d/enemyProjection";
import { WORLD_SIZE } from "@/config/gameBalance";
import { Creature, CREATURE_URLS, creatureFor, heightFactor, prepareCreatures, rankScale } from "@/battlefield3d/creatures";
import { getPointAtDistance, type Vector2 } from "@/utils/geometry";

/**
 * HÍBRIDO (prévia) — the 2D map stays exactly as it is; on top of it a
 * transparent 3D layer draws only what moves and lives: the castle (banners
 * in the wind, torches, a breathing crystal, a portcullis that lifts when
 * the horde arrives, smoke and fire as it loses HP) and the creatures
 * themselves (walking, turning, falling — and walking in through the gate to
 * vanish inside the castle). Aligned pixel-for-pixel with the 2D canvas by
 * the same tilted-orthographic projection the existing 3D enemy layer uses.
 * Read-only: never touches gameplay state.
 */

const loc = (p: Vector2, y = 0) => {
  const [x, , z] = worldToLocalGround(p);
  return new THREE.Vector3(x, y, z);
};

let blobTex: THREE.Texture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// ----------------------------------------------------------------- camera + world scale
function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.left = -size.width / 2;
    cam.right = size.width / 2;
    cam.top = size.height / 2;
    cam.bottom = -size.height / 2;
    cam.near = 0.1;
    cam.far = 6000;
    cam.position.set(...cameraPosition(2000));
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** Everything inside is authored in world units; this group scales it to CSS pixels exactly like the 2D canvas. */
function WorldScale({ children, fx }: { children: ReactNode; fx: Effects }) {
  const ref = useRef<THREE.Group>(null);
  // follows the shared view camera every frame, so zooming and panning move the 3D layer with the map
  useFrame(({ size, gl }) => {
    const g = ref.current;
    if (!g) return;
    const p = groundGroupPlacement(size.width, size.height);
    g.scale.setScalar(p.scale);
    g.position.set(p.x, 0, p.z);
    fx.setOrthoScale(p.scale * gl.getPixelRatio());
  }, -1);
  return <group ref={ref}>{children}</group>;
}

// ----------------------------------------------------------------- lights + shadow catcher
function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const s = sun.current!;
    s.target.position.set(0, 0, 0);
    s.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={["#c4d0e0", "#4a3e2c", 1.25]} />
      <directionalLight
        ref={sun}
        color="#ffe0b8"
        intensity={1.9}
        position={[420, 520, 40]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-620}
        shadow-camera-right={620}
        shadow-camera-top={520}
        shadow-camera-bottom={-520}
        shadow-camera-near={50}
        shadow-camera-far={2000}
        shadow-bias={-0.0006}
        shadow-normalBias={0.8}
      />
      <directionalLight color="#8fb0d8" intensity={0.6} position={[400, 200, 500]} />
      {/* soft fill from the viewer's side, so faces turned to the camera are never black */}
      <directionalLight color="#ffe8cc" intensity={1.5} position={[-120, 300, -600]} />
      {/* an invisible floor that only shows the shadows the 3D things cast onto the 2D map */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow>
        <planeGeometry args={[1400, 1200]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
}

// ----------------------------------------------------------------- castle
function castleTier(fraction: number) {
  return fraction > 0.75 ? 1 : fraction > 0.5 ? 2 : fraction > 0.25 ? 3 : 4;
}

const FLAG_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float k = uv.x;
    p.z += sin(uTime * 5.0 - uv.x * 6.0 + uv.y * 1.5) * 1.4 * k;
    p.y += sin(uTime * 3.3 - uv.x * 4.0) * 0.4 * k;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FLAG_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTrim;
  varying vec2 vUv;
  void main() {
    // a swallow-tail cut and a trim stripe near the pole
    float cut = abs(vUv.y - 0.5) * 2.0;
    if (vUv.x > 0.78 && cut < (vUv.x - 0.78) * 3.5) discard;
    vec3 c = uColor * (0.65 + 0.35 * vUv.y);
    if (vUv.x < 0.12) c = uTrim;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export interface CastleState {
  /** World-space point just inside the gate (where an entering creature vanishes). */
  gateInside: THREE.Vector3;
  gateFront: THREE.Vector3;
  /** Plane that clips anything that has walked through the gate. */
  gatePlane: THREE.Plane;
  /** 0 = shut, 1 = fully raised. */
  open: number;
  /** Requests: the gate stays up while this is in the future. */
  holdOpenUntil: number;
  /** A creature just got in: shake + flash. */
  struck: () => void;
}

function Castle({
  engine,
  fortress,
  facing,
  fx,
  state,
}: {
  engine: GameEngine;
  fortress: Vector2;
  facing: Vector2;
  fx: Effects;
  state: React.MutableRefObject<CastleState | null>;
}) {
  const biomeId = engine.getRenderSnapshot().biomeId;
  const [tier, setTier] = useState(1);
  const [skinId, setSkinId] = useState(() => getActiveCastleSkin()?.id ?? "");
  // the same look per map as the 2D castle (expansion maps borrow one of the six dressings)
  const dressing = castleDressingFor(biomeId).toUpperCase();
  const model: CastleModel = useMemo(() => buildCastleModel(dressing, tier, skinId), [dressing, tier, skinId]);
  const group = useRef<THREE.Group>(null);
  const torch = useRef<THREE.PointLight>(null);
  const flash = useRef<THREE.PointLight>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const shake = useRef(0);
  const hpT = useRef(0);
  const anchor = loc(fortress);
  // the gate (the model's +Z) faces back along the road the horde comes in on, turned towards
  // the viewer so the castle still shows its face rather than a flank or its back
  const YAW = useMemo(() => {
    let gx = -facing.x;
    let gy = -facing.y + 0.9;
    if (Math.hypot(gx, gy) < 0.3) {
      gx = Math.sign(gx) || -1;
      gy = 0.3;
    }
    return worldDirectionToThreeYaw({ x: gx, y: gy });
  }, [facing.x, facing.y]);
  // the castle stands straight on the map's ground: its round stone platform is taken away
  // (the ground patch below takes its place), and it is sized to the 2D castle's footprint
  const scale = useMemo(() => {
    for (const n of ["mound", "yard"]) {
      const o = model.root.getObjectByName(n);
      if (o) o.removeFromParent();
    }
    // snow piles and dunes were shaped for the old platform's rim; on the map's own ground they float
    const loose: THREE.Object3D[] = [];
    model.root.traverse((o) => {
      if (o.name === "groundDressing") loose.push(o);
    });
    for (const o of loose) o.removeFromParent();
    const box = new THREE.Box3().setFromObject(model.root);
    return 118 / Math.max(1, box.max.x - box.min.x);
  }, [model]);
  const parts = useMemo(() => {
    const portcullis = model.root.getObjectByName("portcullis") ?? null;
    const door = model.root.getObjectByName("gateDoor") as THREE.Mesh | undefined;
    const core = (model.root.getObjectByName("core") as THREE.Mesh | undefined) ?? null;
    if (core) core.material = (core.material as THREE.Material).clone();
    model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = m.receiveShadow = true;
    });
    // two real door leaves on hinges in place of the flat door, so the gate swings open
    const leaves: THREE.Object3D[] = [];
    if (door) {
      const g = door.geometry as THREE.PlaneGeometry;
      const w = g.parameters.width;
      const h = g.parameters.height;
      door.visible = false;
      for (const side of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.set(door.position.x + (side * w) / 2, door.position.y - h / 2, door.position.z + 0.6);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h, 0.9), door.material);
        leaf.position.set((-side * w) / 4, h / 2, 0);
        leaf.castShadow = leaf.receiveShadow = true;
        // iron bands across each leaf
        for (const k of [0.25, 0.7]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(w / 2, 0.7, 1.1), new THREE.MeshStandardMaterial({ color: "#2a2724", metalness: 0.7, roughness: 0.45 }));
          band.position.set((-side * w) / 4, h * k, 0);
          hinge.add(band);
        }
        hinge.add(leaf);
        hinge.userData.side = side;
        door.parent!.add(hinge);
        leaves.push(hinge);
      }
    }
    return { portcullis, core, leaves, portY: portcullis?.position.y ?? 0 };
  }, [model]);
  // the ground the castle stands on: packed earth fading into the map, darker where the walls meet it
  const groundPatch = useMemo(() => {
    const pal = getBiome(biomeId).palette;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    // the map's own road earth, only slightly darker, so it reads as trodden ground rather than a hole
    const base = new THREE.Color(pal.roadFill).lerp(new THREE.Color(pal.groundBase), 0.35).multiplyScalar(0.92);
    let seed = 99;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const k = 0.7 + rnd() * 0.6;
      const col = base.clone().multiplyScalar(k);
      g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.5)`;
      g.beginPath();
      g.ellipse(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 1 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // scattered stones and rubble
    for (let i = 0; i < 90; i++) {
      const sc = new THREE.Color(pal.rock ?? "#777").multiplyScalar(0.6 + rnd() * 0.5);
      g.fillStyle = `#${sc.getHexString()}`;
      g.beginPath();
      g.ellipse(rnd() * 256, rnd() * 256, 1.5 + rnd() * 3, 1 + rnd() * 2.2, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // darker under the walls (contact shade), then a soft edge into the map
    const ao = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    ao.addColorStop(0, "rgba(0,0,0,0.16)");
    ao.addColorStop(0.45, "rgba(0,0,0,0.06)");
    ao.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = ao;
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "destination-in";
    // irregular soft edge (not a perfect circle) so the patch melts into the map
    const edge = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    edge.addColorStop(0, "rgba(0,0,0,0.92)");
    edge.addColorStop(0.55, "rgba(0,0,0,0.7)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = edge;
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = "destination-out";
    g.filter = "blur(6px)";
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 92 + rnd() * 30;
      g.fillStyle = `rgba(0,0,0,${0.35 + rnd() * 0.4})`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 10 + rnd() * 18, 0, Math.PI * 2);
      g.fill();
    }
    g.filter = "none";
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1 });
  }, [biomeId]);
  const flags = useMemo(() => {
    const out: THREE.Mesh[] = [];
    const roof = new THREE.Color("#8a1e18");
    for (const [k, a] of Object.entries(model.anchors)) {
      if (!k.startsWith("banner")) continue;
      const geo = new THREE.PlaneGeometry(9, 5, 14, 4);
      geo.translate(4.5, -2.6, 0);
      const mat = new THREE.ShaderMaterial({
        vertexShader: FLAG_VERT,
        fragmentShader: FLAG_FRAG,
        uniforms: { uTime: { value: Math.random() * 10 }, uColor: { value: roof }, uTrim: { value: new THREE.Color("#d8b04a") } },
        side: THREE.DoubleSide,
      });
      const f = new THREE.Mesh(geo, mat);
      f.position.copy(a).add(new THREE.Vector3(0.3, 0.6, 0));
      f.castShadow = true;
      out.push(f);
    }
    return out;
  }, [model]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const at = (name: string) => {
    const a = model.anchors[name];
    if (!a || !group.current) return null;
    group.current.updateMatrixWorld();
    const w = group.current.localToWorld(tmp.copy(a));
    // back into the parent (world-unit) space: parent is the WorldScale group
    return group.current.parent ? group.current.parent.worldToLocal(w) : w;
  };

  // publish the gate geometry for the creatures
  useFrame(() => {
    const gl = at("gate");
    if (!gl) return;
    const front = gl.clone();
    const fwd = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
    const inside = front.clone().addScaledVector(fwd, -10 * scale);
    inside.y = 0;
    const planePoint = front.clone().addScaledVector(fwd, -3 * scale);
    if (!state.current) {
      state.current = {
        gateInside: inside,
        gateFront: front.setY(0),
        gatePlane: new THREE.Plane().setFromNormalAndCoplanarPoint(fwd.clone(), planePoint),
        open: 0,
        holdOpenUntil: 0,
        struck: () => {
          shake.current = 0.35;
        },
      };
    } else {
      state.current.gateInside.copy(inside);
      state.current.gateFront.copy(front.setY(0));
      state.current.gatePlane.setFromNormalAndCoplanarPoint(fwd.clone(), planePoint);
    }
  });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const s = state.current;
    hpT.current += dt;
    if (hpT.current > 0.4) {
      hpT.current = 0;
      const h = engine.getHudSnapshot();
      const nt = castleTier(h.maxBaseHp > 0 ? h.baseHp / h.maxBaseHp : 1);
      if (nt !== tier) setTier(nt);
      const sk = getActiveCastleSkin()?.id ?? "";
      if (sk !== skinId) setSkinId(sk);
    }
    // gate
    if (s) {
      const want = performance.now() < s.holdOpenUntil ? 1 : 0;
      s.open += (want - s.open) * Math.min(1, dt * (want ? 3.5 : 2));
      if (parts.portcullis) parts.portcullis.position.y = parts.portY + Math.min(1, s.open * 1.4) * 15;
      // the leaves swing inwards once the portcullis is up
      const swing = Math.max(0, (s.open - 0.25) / 0.75);
      for (const h of parts.leaves) h.rotation.y = (h.userData.side as number) * -swing * 1.75;
    }
    // banners
    for (const f of flags) (f.material as THREE.ShaderMaterial).uniforms.uTime!.value = t + f.id;
    // crystal core breathes and turns
    if (parts.core) {
      parts.core.rotation.y = t * 1.2;
      (parts.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + Math.sin(t * 2.4) * 1.2;
    }
    if (coreLight.current) coreLight.current.intensity = 120 + Math.sin(t * 2.4) * 60;
    if (torch.current) torch.current.intensity = 260 + Math.sin(t * 13) * 50 + Math.sin(t * 7.1) * 40;
    // torches and the crystal's motes
    for (const n of ["torchL", "torchR"]) {
      const p = at(n);
      if (p && Math.random() < 0.85) fx.flame(p.clone().add(new THREE.Vector3(0, 1.5 * scale, 0)), 0.55);
    }
    const c = at("core");
    if (c && Math.random() < 0.3) fx.mote(c.clone(), model.core, 3, 10);
    // damage: smoke from tier 2, fire from tier 3
    if (tier >= 2) {
      const k = at("keepWindow") ?? c;
      if (k && Math.random() < 0.12 * tier) fx.smokePuff(k.clone().add(new THREE.Vector3((Math.random() - 0.5) * 22, 6, (Math.random() - 0.5) * 10)), 0.7 + tier * 0.2);
    }
    if (tier >= 3)
      for (const n of ["towerWindowL", "towerWindowR", "keepWindow"]) {
        const p = at(n);
        if (p && Math.random() < 0.45) fx.flame(p.clone(), 1.1, "#ff5a1a");
      }
    // struck: a short shake and a red flash
    if (group.current) {
      if (shake.current > 0) {
        shake.current -= dt;
        const k = Math.max(0, shake.current) * 4;
        group.current.position.set(anchor.x + (Math.random() - 0.5) * k, 0, anchor.z + (Math.random() - 0.5) * k * 0.5);
      } else group.current.position.set(anchor.x, 0, anchor.z);
    }
    if (flash.current) flash.current.intensity = Math.max(0, shake.current) * 1500;
  });

  return (
    <>
    <mesh rotation-x={-Math.PI / 2} position={[anchor.x, 0.08, anchor.z]} material={groundPatch} receiveShadow renderOrder={1}>
      <circleGeometry args={[82, 48]} />
    </mesh>
    <group ref={group} position={anchor} rotation-y={YAW} scale={scale}>
      <primitive object={model.root} />
      {flags.map((f) => (
        <primitive key={f.uuid} object={f} />
      ))}
      <pointLight ref={torch} color="#ffa050" intensity={260} distance={60} decay={1.6} position={[0, 18, 34]} />
      <pointLight ref={coreLight} color={model.core} intensity={120} distance={40} decay={1.6} position={[0, 30, 30]} />
      <pointLight ref={flash} color="#ff3a1a" intensity={0} distance={90} decay={1.4} position={[0, 12, 40]} />
    </group>
    </>
  );
}

// ----------------------------------------------------------------- creatures
/**
 * World height of an ordinary-sized 3D creature. Seen from the board's tilt a standing body
 * shows about 60% of its height, so this lands a creature at the on-screen size of the 2D
 * sprite of its kind; rank (elite / mini-boss / boss) then scales it exactly as the 2D does.
 */
const ENEMY_HEIGHT = 39;
/** A print from the 3D layer's ground space (x, z and a yaw around +Y) into world units for the 2D ground. */
function stampLocal(x: number, z: number, yaw: number, length: number, left: boolean) {
  const wx = WORLD_SIZE.width / 2 - x;
  const wy = WORLD_SIZE.height / 2 - z * TILT_COS;
  const dx = -Math.sin(yaw);
  const dy = -Math.cos(yaw) * TILT_COS;
  footprints.stamp(wx, wy, Math.atan2(dy, dx), length, left);
}

/** Footprint length (world units) of each ordinary 2D enemy, roughly its foot size. */
const ORDINARY_PRINT: Record<string, number> = { CRAWLER: 9, SWARMLING: 7, RUNNER: 9.5, BRUTE: 14, SHIELDBEARER: 11, REGENERATOR: 10, IRONCLAD: 12.5, DISABLER: 9.5 };
/** Most creatures drawn in 3D at once; beyond that the extra ones keep their 2D sprite. */
const MAX_3D_CREATURES = 90;
/** How far before the castle (along the road, world units) a creature turns off for the gate. */
const APPROACH_LEAD = 170;

interface Live {
  c: Creature;
  obj: THREE.Object3D;
  scale: number;
  born: number;
  /** -1 alive; otherwise seconds since it left the field. */
  gone: number;
  mode: "alive" | "dying" | "entering";
  shadow: THREE.Mesh;
  last: EnemyInstance | null;
  speed: number;
  /** Seconds into its entry at the gate (−1 = not there yet). */
  enterT: number;
  /** Blows already landed on the gate (bosses smash it before going in). */
  smashes: number;
  /** Its own fading copies of its materials, made when the entry starts. */
  fading: THREE.MeshStandardMaterial[];
  /** Already at the gate (no more footprints). */
  inside: boolean;
  boss: "main" | "mini" | null;
  /** Where it was when it left the road to head for the gate. */
  approachFrom: THREE.Vector3 | null;
  /** World height it was scaled to. */
  h: number;
  heavy: boolean;
  /** Per foot: lowest height seen lately and whether it is planted. */
  feet: { min: number; down: boolean }[];
}

function Creatures({
  engine,
  hiddenIds,
  fx,
  castle,
  portal,
  fortress,
  roadLength,
  castleAt,
}: {
  engine: GameEngine;
  hiddenIds: RefObject<Set<string>>;
  fx: Effects;
  castle: React.MutableRefObject<CastleState | null>;
  portal: Vector2;
  fortress: Vector2;
  roadLength: number;
  /** Road distance from the castle to the road's end (the castle stands a little short of it on edge maps). */
  castleAt: number;
}) {
  const gltfs = useLoader(GLTFLoader, CREATURE_URLS) as GLTF[];
  const kits = useMemo(() => prepareCreatures(gltfs), [gltfs]);
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, Live>());
  const blobMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), color: "#000", transparent: true, opacity: 0.5, depthWrite: false }), []);
  const blobGeo = useMemo(() => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), []);
  const portal3 = useMemo(() => loc(portal, 3), [portal]);
  const footTmp = useMemo(() => new THREE.Vector3(), []);
  const entered = useRef(new Set<string>());
  const strides = useRef(new Map<string, { at: number; left: boolean; last: number }>());
  const strideSeen = useMemo(() => new Set<string>(), []);

  /** Where a creature stands before the gate: further out the bigger it is. */
  const standPoint = (gate: CastleState, h: number) => gate.gateFront.clone().addScaledVector(gate.gatePlane.normal, 4 + h * 0.22).setY(0);

  const startEntry = (e: Live) => {
    if (e.enterT >= 0) return;
    e.enterT = 0;
    e.inside = true;
    e.fading = [];
    e.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const swap = (mm: THREE.Material) => {
        const c = mm.clone() as THREE.MeshStandardMaterial;
        c.transparent = true;
        c.userData.base = c.color ? c.color.clone() : null;
        e.fading.push(c);
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
  };

  /**
   * One frame of a creature's entry. Bosses first smash the gate (two blows for a Mini-Boss,
   * three for a Boss); then the creature steps in and comes apart into dark mist drawn in through
   * the doorway. Returns true when it is gone.
   */
  const stepEntry = (e: Live, rawDt: number, gate: CastleState) => {
    // never skip through the entry, even after a long frame
    const dt = Math.min(rawDt, 1 / 20);
    e.enterT += dt;
    const blows = e.boss === "main" ? 3 : e.boss === "mini" ? 2 : 0;
    const BLOW = 0.62;
    const smashTime = blows * BLOW;
    const melt = e.boss ? 1.6 : 1.0;
    const stand = standPoint(gate, e.h);
    const inward = gate.gatePlane.normal.clone().negate();
    // face the gate
    const face = Math.atan2(inward.x, inward.z);
    const d = Math.atan2(Math.sin(face - e.obj.rotation.y), Math.cos(face - e.obj.rotation.y));
    e.obj.rotation.y += d * Math.min(1, dt * 10);
    const body = e.obj.children[0]!;
    if (e.enterT < smashTime) {
      // rear back and slam the gate
      const ph = (e.enterT % BLOW) / BLOW;
      body.rotation.x = ph < 0.55 ? -0.25 * Math.sin((ph / 0.55) * Math.PI * 0.5) : -0.25 + 0.75 * Math.sin(((ph - 0.55) / 0.45) * Math.PI * 0.5);
      e.c.walk.timeScale = 0.15;
      e.c.update(dt);
      const n = Math.floor(e.enterT / BLOW);
      if (n >= e.smashes && ph > 0.92) {
        e.smashes = n + 1;
        gate.struck();
        const at = gate.gateFront.clone().setY(10);
        fx.smoke.emit(at, { count: 14, color: "#7a7064", colorEnd: "#2a2622", size: 10, life: 1.1, speed: 40, up: 18, grow: 2, alpha: 0.6, radius: 6 });
        fx.glow.emit(at, { count: 30, color: "#fff0c0", colorEnd: "#ff4a1a", size: 2.8, life: 0.7, speed: 80, up: 30, gravity: 120 });
        fx.rings.ring(gate.gateFront.clone().setY(0.5), "#ffb070", 6, 60, 0.6);
      }
      e.obj.position.copy(stand);
    } else {
      // step in and come apart into the dark of the doorway
      body.rotation.x *= 1 - Math.min(1, dt * 8);
      const k = Math.min(1, (e.enterT - smashTime) / melt);
      e.c.walk.timeScale = 0.7;
      e.c.update(dt);
      e.obj.position.copy(stand).lerp(gate.gateInside, k * 0.55);
      e.obj.scale.setScalar(e.scale * (1 - 0.3 * k));
      for (const m of e.fading) {
        m.opacity = Math.max(0, 1 - Math.pow(k, 1.3));
        const base = m.userData.base as THREE.Color | null;
        if (base && m.color) m.color.copy(base).multiplyScalar(1 - 0.85 * k);
      }
      // mist peeling off the body and drawn in through the gate
      const n = e.boss ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const p = e.obj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * e.h * 0.35, Math.random() * e.h * 0.85, (Math.random() - 0.5) * e.h * 0.35));
        const toGate = gate.gateInside.clone().setY(e.h * 0.2).sub(p).normalize();
        fx.smoke.emit(p, { count: 1, color: "#4a3a5e", colorEnd: "#1a1222", size: e.h * 0.08, life: 0.7, speed: 50, dir: toGate, spread: 0.12, grow: 1.4, alpha: 0.32, drag: 0.4 });
        fx.glow.emit(p, { count: 1, color: "#e0c8ff", colorEnd: "#5a2a9a", size: 1.6, life: 0.6, speed: 60, dir: toGate, spread: 0.1, drag: 0.3 });
      }
      if (Math.random() < 0.6) fx.glow.emit(e.obj.position.clone().setY(e.h * 0.5), { count: 2, color: "#ffb07a", colorEnd: "#5a0a2a", size: 2.2, life: 0.6, speed: 30, dir: inward, spread: 0.4, up: 6 });
      (e.shadow.material as THREE.MeshBasicMaterial).opacity = 0.5;
      e.shadow.scale.setScalar(9 * (e.h / ENEMY_HEIGHT) * (1 - k));
      if (k >= 1) {
        // the last of it: a dull thud inside the walls
        gate.struck();
        fx.smoke.emit(gate.gateInside.clone().setY(e.h * 0.6), { count: e.boss ? 10 : 5, color: "#5a4c44", colorEnd: "#1e1814", size: e.h * 0.18, life: 1.5, speed: 12, up: 26, grow: 2.2, alpha: 0.35, radius: 5 });
        return true;
      }
    }
    e.shadow.position.set(e.obj.position.x, 0.2, e.obj.position.z);
    return false;
  };

  useFrame((_, dt) => {
    const g = group.current;
    const hidden = hiddenIds.current;
    if (!g || !hidden) return;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    const gate = castle.current;
    let anyNearGate = false;
    for (const en of snap.enemies as readonly EnemyInstance[]) {
      // only the special ones are 3D creatures: Elites, Mini-Bosses and Bosses; ordinary enemies keep their 2D look
      if (!en.elite && !en.boss) {
        // …but they still leave footprints: one per stride, left and right in turn
        strideSeen.add(en.id);
        const st = strides.current.get(en.id);
        const size = ORDINARY_PRINT[en.type] ?? 7;
        if (roadLength - en.distanceTraveled < castleAt + APPROACH_LEAD + 40) anyNearGate = true;
        if (st) st.last = en.distanceTraveled;
        if (!st) strides.current.set(en.id, { at: en.distanceTraveled, left: false, last: en.distanceTraveled });
        else if (en.distanceTraveled - st.at > size * 1.5 && en.distanceTraveled > 60 && roadLength - en.distanceTraveled > castleAt + 30) {
          st.at = en.distanceTraveled;
          st.left = !st.left;
          const side = { x: -en.direction.y, y: en.direction.x };
          const off = size * 0.32 * (st.left ? -1 : 1);
          footprints.stamp(en.position.x + side.x * off, en.position.y + side.y * off, Math.atan2(en.direction.y, en.direction.x), size, st.left);
        }
        continue;
      }
      seen.add(en.id);
      // already went in through the gate while the game still has it on the road: stays hidden, not redrawn
      if (entered.current.has(en.id)) continue;
      let e = live.current.get(en.id);
      const tier = rankScale(!!en.elite, en.boss);
      if (!e) {
        if (live.current.size >= MAX_3D_CREATURES) continue; // a huge wave: the rest stay as 2D sprites
        const cid = creatureFor(en.type, !!en.boss, !!en.boss?.isMainBoss);
        const h = ENEMY_HEIGHT * tier * heightFactor(en.type);
        const c = new Creature(kits[cid], h, { id: cid, biomeId: snap.biomeId });
        const obj = c.obj;
        const scale = c.scale;
        const shadow = new THREE.Mesh(blobGeo, blobMat);
        shadow.scale.setScalar(9 * tier);
        shadow.renderOrder = 1;
        g.add(obj, shadow);
        const fresh = Math.hypot(en.position.x - portal.x, en.position.y - portal.y) < 90;
        e = { c, obj, scale, born: fresh ? 0 : 1, gone: -1, mode: "alive", shadow, last: null, speed: 40, enterT: -1, smashes: 0, fading: [], boss: en.boss ? (en.boss.isMainBoss ? "main" : "mini") : null, inside: false, approachFrom: null, h, heavy: !!en.boss || en.type === "BRUTE" || en.type === "IRONCLAD", feet: [{ min: 1e9, down: true }, { min: 1e9, down: true }] };
        live.current.set(en.id, e);
        hidden.add(en.id);
        if (fresh) fx.glow.emit(portal3.clone(), { count: en.boss ? 50 : 12, color: "#ffffff", colorEnd: "#9a4aff", size: 5, life: 0.7, speed: 50, up: 30, drag: 2, radius: 8 });
      }
      // speed estimate for the walk-in, from how far it moved since last frame
      if (e.last && dt > 0) {
        const d = Math.hypot(en.position.x - e.last.position.x, en.position.y - e.last.position.y) / dt;
        if (d > 0 && d < 400) e.speed += (d - e.speed) * 0.1;
      }
      e.last = { ...en, position: { ...en.position }, direction: { ...en.direction } };
      const pos = loc(en.position);
      if (e.born < 1) {
        e.born = Math.min(1, e.born + dt * 1.8);
        const k = 1 - (1 - e.born) * (1 - e.born);
        pos.y -= (1 - k) * ENEMY_HEIGHT * 0.9;
        e.obj.scale.setScalar(e.scale * (0.5 + 0.5 * k));
      }
      // the last stretch: leave the road and curve round to stand before the gate, facing it
      let yaw = worldDirectionToThreeYaw(en.direction);
      const remaining = roadLength - en.distanceTraveled;
      const nearCastle = remaining < castleAt + APPROACH_LEAD + 40 || Math.hypot(en.position.x - fortress.x, en.position.y - fortress.y) < 140;
      if (nearCastle) anyNearGate = true;
      if (gate && e.enterT < 0 && remaining < castleAt + APPROACH_LEAD) {
        if (!e.approachFrom) e.approachFrom = pos.clone();
        const t = Math.min(1, (castleAt + APPROACH_LEAD - remaining) / APPROACH_LEAD);
        const P0 = e.approachFrom;
        const S = standPoint(gate, e.h);
        const C = S.clone().addScaledVector(gate.gatePlane.normal, 40);
        const u = 1 - t;
        pos.set(u * u * P0.x + 2 * u * t * C.x + t * t * S.x, pos.y, u * u * P0.z + 2 * u * t * C.z + t * t * S.z);
        const tan = new THREE.Vector3(2 * u * (C.x - P0.x) + 2 * t * (S.x - C.x), 0, 2 * u * (C.z - P0.z) + 2 * t * (S.z - C.z));
        if (tan.lengthSq() > 1e-6) yaw = Math.atan2(tan.x, tan.z);
        if (t >= 1) startEntry(e);
      }
      if (e.enterT >= 0 && gate) {
        stepEntry(e, dt, gate);
      } else {
        e.obj.position.copy(pos);
        e.shadow.position.set(pos.x, 0.2, pos.z);
        const d = Math.atan2(Math.sin(yaw - e.obj.rotation.y), Math.cos(yaw - e.obj.rotation.y));
        e.obj.rotation.y += d * Math.min(1, dt * 8);
        e.c.walk.timeScale = en.slow ? 0.55 : 1.0;
        e.c.update(dt);
      }
      // footprints: a print wherever a foot comes down (not while climbing out of the rift or once through the gate)
      if (e.born >= 1 && e.enterT < 0 && e.c.feet.length === 2 && g.parent) {
        e.obj.updateMatrixWorld(true);
        for (let k = 0; k < 2; k++) {
          const st = e.feet[k]!;
          e.c.feet[k]!.getWorldPosition(footTmp);
          g.parent.worldToLocal(footTmp);
          const y = footTmp.y;
          st.min = Math.min(st.min + dt * e.h * 0.02, y);
          if (!st.down && y < st.min + e.h * 0.03) {
            st.down = true;
            stampLocal(footTmp.x, footTmp.z, e.obj.rotation.y, e.h * 0.2, k === 0);
            if (e.heavy) fx.smoke.emit(footTmp.clone().setY(1), { count: 3, color: "#6a5a48", colorEnd: "#2a241e", size: e.h * 0.1, life: 0.9, speed: 10, up: 6, grow: 2.2, alpha: 0.35, drag: 2 });
          } else if (st.down && y > st.min + e.h * 0.07) st.down = false;
        }
      }
      if (en.burn && Math.random() < 0.4) fx.flame(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, ENEMY_HEIGHT * 0.5, 0)), 0.5, "#ff4a0a");
    }
    for (const [id, st] of strides.current)
      if (!strideSeen.has(id)) {
        // an ordinary creature that got through: the gate takes the blow and dust rises inside
        if (gate && roadLength - st.last < castleAt + 40) {
          gate.struck();
          fx.smoke.emit(gate.gateInside.clone().setY(40), { count: 6, color: "#4a3e34", colorEnd: "#16120e", size: 14, life: 1.5, speed: 10, up: 24, grow: 2.4, alpha: 0.45, radius: 5 });
        }
        strides.current.delete(id);
      }
    strideSeen.clear();
    for (const e of live.current.values()) if (e.enterT >= 0) anyNearGate = true;
    if (gate && anyNearGate) gate.holdOpenUntil = performance.now() + 1500;

    for (const [id, e] of live.current) {
      if (seen.has(id)) continue;
      if (e.enterT >= 0 || (e.gone < 0 && e.last && roadLength - e.last.distanceTraveled < castleAt + 40)) {
        // it reached the castle: finish its entry at the gate, whatever the game has already counted
        e.gone = Math.max(e.gone, 0);
        if (!gate) {
          remove(id, e);
          continue;
        }
        if (e.enterT < 0) {
          e.obj.position.copy(standPoint(gate, e.h));
          startEntry(e);
        }
        if (stepEntry(e, dt, gate)) remove(id, e);
        continue;
      }
      if (e.gone < 0) {
        e.gone = 0;
        {
          e.mode = "dying";
          fx.death(e.obj.position.clone().add(new THREE.Vector3(0, ENEMY_HEIGHT * 0.4, 0)), !!e.last?.boss);
          e.c.fall();
        }
      }
      e.gone += dt;
      e.c.update(dt);
      if (e.mode === "dying") {
        if (e.gone > 1.4) {
          e.obj.position.y -= dt * 10;
          e.shadow.scale.multiplyScalar(1 - dt * 1.5);
        }
        if (e.gone > 2.4) remove(id, e);
      }
    }

    for (const id of entered.current)
      if (!seen.has(id)) {
        entered.current.delete(id);
        hidden.delete(id);
      }

    function remove(id: string, e: Live) {
      g!.remove(e.obj, e.shadow);
      for (const m of e.fading) m.dispose();
      live.current.delete(id);
      if (e.enterT >= 0 && seen.has(id)) entered.current.add(id);
      else hidden!.delete(id);
    }
  });

  // never leave ids hidden in the 2D layer if this layer goes away
  useEffect(() => {
    const set = hiddenIds.current;
    const mine = live.current;
    return () => {
      for (const id of mine.keys()) set?.delete(id);
    };
  }, [hiddenIds]);

  return <group ref={group} />;
}

// ----------------------------------------------------------------- root
class LayerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[hybrid3d] layer failed", err);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Scene({ engine, hiddenIds }: { engine: GameEngine; hiddenIds: RefObject<Set<string>> }) {
  const layoutId = engine.getRenderSnapshot().mapLayoutId;
  const [lid, setLid] = useState(layoutId);
  useFrame(() => {
    const n = engine.getRenderSnapshot().mapLayoutId;
    if (n !== lid) setLid(n);
  });
  const layout = useMemo(() => getMapLayout(lid), [lid]);
  const anchorInfo = useMemo(() => getFortressAnchor(layout.path), [layout]);
  const fortress = anchorInfo.position;
  const portal = useMemo(() => getPortalAnchor(layout.path), [layout]);
  const fx = useMemo(() => new Effects(), []);
  const castle = useRef<CastleState | null>(null);
  useFrame((_, dt) => fx.update(dt));
  useEffect(() => () => footprints.clear(), []);
  return (
    <WorldScale fx={fx}>
      <Lights />
      <primitive object={fx.root} />
      <GatePath
        key={`path-${lid}`}
        castle={castle}
        biomeId={engine.getRenderSnapshot().biomeId}
        from={loc(getPointAtDistance(layout.path, layout.length - Math.hypot(layout.path[layout.path.length - 1]!.x - fortress.x, layout.path[layout.path.length - 1]!.y - fortress.y) - APPROACH_LEAD).position)}
      />
      <Castle key={lid} engine={engine} fortress={fortress} facing={anchorInfo.facingDir} fx={fx} state={castle} />
      <LayerBoundary onError={() => hiddenIds.current?.clear()}>
        <Suspense fallback={null}>
          <Creatures engine={engine} hiddenIds={hiddenIds} fx={fx} castle={castle} portal={portal} fortress={fortress} roadLength={layout.length} castleAt={Math.hypot(layout.path[layout.path.length - 1]!.x - fortress.x, layout.path[layout.path.length - 1]!.y - fortress.y)} />
        </Suspense>
      </LayerBoundary>
    </WorldScale>
  );
}

/** A strip of trodden earth from the road to the castle gate, along the curve the creatures walk. */
function GatePath({ castle, from, biomeId }: { castle: React.MutableRefObject<CastleState | null>; from: THREE.Vector3; biomeId: string }) {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const built = useRef(false);
  useFrame(() => {
    const gate = castle.current;
    if (built.current || !gate) return;
    built.current = true;
    const C = gate.gateFront.clone().addScaledVector(gate.gatePlane.normal, 45);
    const E = gate.gateFront.clone().addScaledVector(gate.gatePlane.normal, -2);
    const N = 40;
    const W = 30;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      const p = new THREE.Vector3(u * u * from.x + 2 * u * t * C.x + t * t * E.x, 0.1, u * u * from.z + 2 * u * t * C.z + t * t * E.z);
      const d = new THREE.Vector3(2 * u * (C.x - from.x) + 2 * t * (E.x - C.x), 0, 2 * u * (C.z - from.z) + 2 * t * (E.z - C.z)).normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x);
      const w = W * (0.85 + 0.15 * t);
      pos.push(p.x + side.x * w * 0.5, 0.1, p.z + side.z * w * 0.5, p.x - side.x * w * 0.5, 0.1, p.z - side.z * w * 0.5);
      uv.push(0, t, 1, t);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const pal = getBiome(biomeId).palette;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    const road = new THREE.Color(pal.roadFill);
    g.fillStyle = `#${road.getHexString()}`;
    g.fillRect(0, 0, 64, 256);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const k = 0.75 + rnd() * 0.5;
      const col = road.clone().multiplyScalar(k);
      g.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.6)`;
      g.fillRect(rnd() * 64, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    // soft shoulders, and the start blends into the road it leaves
    g.globalCompositeOperation = "destination-in";
    const across = g.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, "rgba(0,0,0,0)");
    across.addColorStop(0.22, "rgba(0,0,0,0.9)");
    across.addColorStop(0.78, "rgba(0,0,0,0.9)");
    across.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = across;
    g.fillRect(0, 0, 64, 256);
    const along = g.createLinearGradient(0, 0, 0, 256);
    along.addColorStop(0, "rgba(0,0,0,0)");
    along.addColorStop(0.25, "rgba(0,0,0,1)");
    along.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = along;
    g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 }));
    m.receiveShadow = true;
    m.renderOrder = 1;
    setMesh(m);
  });
  return mesh ? <primitive object={mesh} /> : null;
}

export function HybridOverlay({ engine, hiddenIds }: { engine: GameEngine; hiddenIds: RefObject<Set<string>> }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} data-testid="hybrid-3d">
      <Canvas
        orthographic
        shadows="soft"
        dpr={[1, 2]}
        camera={{ near: 0.1, far: 6000 }}
        gl={{ alpha: true, antialias: true, localClippingEnabled: true } as THREE.WebGLRendererParameters & { localClippingEnabled: boolean }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.9;
        }}
        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      >
        <CameraRig />
        <Scene engine={engine} hiddenIds={hiddenIds} />
      </Canvas>
    </div>
  );
}
