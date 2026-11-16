import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import { getMapLayout } from "@/data/mapLayouts";
import { getFortressAnchor, getPortalAnchor } from "@/rendering/MapRenderer";
import { computeScreenTransform, cameraPosition, worldDirectionToThreeYaw, worldToLocalGround } from "@/rendering3d/enemyProjection";
import { buildCastleModel, type CastleModel } from "@/battlefield3d/models/castleModel";
import { Effects } from "@/battlefield3d/fx";
import { castleDressingFor } from "@/rendering/castleSprites";
import { getActiveCastleSkin } from "@/rendering/castleSkinFx";
import { Creature, CREATURE_URLS, creatureFor, heightFactor, prepareCreatures } from "@/battlefield3d/creatures";
import type { Vector2 } from "@/utils/geometry";

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
  const { size, gl } = useThree();
  const t = computeScreenTransform(size.width, size.height);
  useEffect(() => fx.setOrthoScale(t.scale * gl.getPixelRatio()), [fx, t.scale, gl]);
  return <group scale={t.scale}>{children}</group>;
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
      <hemisphereLight args={["#b4c4d8", "#3a3020", 0.95]} />
      <directionalLight
        ref={sun}
        color="#ffe0b8"
        intensity={1.9}
        position={[-360, 520, -260]}
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
      <directionalLight color="#ffe8cc" intensity={0.9} position={[0, 300, -600]} />
      {/* an invisible floor that only shows the shadows the 3D things cast onto the 2D map */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} receiveShadow>
        <planeGeometry args={[1400, 1200]} />
        <shadowMaterial transparent opacity={0.32} />
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
  // size it to the 2D castle's footprint (about 100 world units across)
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model.root);
    return 148 / Math.max(1, box.max.x - box.min.x);
  }, [model]);
  const parts = useMemo(() => {
    const portcullis = model.root.getObjectByName("portcullis") ?? null;
    const door = model.root.getObjectByName("gateDoor") ?? null;
    const core = (model.root.getObjectByName("core") as THREE.Mesh | undefined) ?? null;
    if (core) core.material = (core.material as THREE.Material).clone();
    model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = m.receiveShadow = true;
    });
    return { portcullis, door, core, portY: portcullis?.position.y ?? 0 };
  }, [model]);
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
      if (parts.portcullis) parts.portcullis.position.y = parts.portY + s.open * 15;
      if (parts.door) parts.door.visible = s.open < 0.35;
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
    <group ref={group} position={anchor} rotation-y={YAW} scale={scale}>
      <primitive object={model.root} />
      {flags.map((f) => (
        <primitive key={f.uuid} object={f} />
      ))}
      <pointLight ref={torch} color="#ffa050" intensity={260} distance={60} decay={1.6} position={[0, 18, 34]} />
      <pointLight ref={coreLight} color={model.core} intensity={120} distance={40} decay={1.6} position={[0, 30, 30]} />
      <pointLight ref={flash} color="#ff3a1a" intensity={0} distance={90} decay={1.4} position={[0, 12, 40]} />
    </group>
  );
}

// ----------------------------------------------------------------- creatures
const ENEMY_HEIGHT = 62; // world units — the 2D creature sheets are 23–33 tall
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
  /** Materials swapped for clipped copies once it nears the gate. */
  clipped: boolean;
  /** Already walked through the gate (counted the hit once). */
  inside: boolean;
  /** Where it was when it left the road to head for the gate. */
  approachFrom: THREE.Vector3 | null;
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
  /** The gate plane in scene (pixel) space — what the clipped materials read. */
  const clipScene = useMemo(() => new THREE.Plane(), []);

  useFrame((_, dt) => {
    const g = group.current;
    const hidden = hiddenIds.current;
    if (!g || !hidden) return;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    const gate = castle.current;
    let anyNearGate = false;
    for (const en of snap.enemies as readonly EnemyInstance[]) {
      seen.add(en.id);
      let e = live.current.get(en.id);
      const tier = en.boss ? (en.boss.isMainBoss ? 2.1 : 1.6) : en.elite ? 1.3 : 1;
      if (!e) {
        if (live.current.size >= MAX_3D_CREATURES) continue; // a huge wave: the rest stay as 2D sprites
        const cid = creatureFor(en.type, !!en.boss);
        const c = new Creature(kits[cid], ENEMY_HEIGHT * tier * heightFactor(en.type), { id: cid, biomeId: snap.biomeId });
        const obj = c.obj;
        const scale = c.scale;
        const shadow = new THREE.Mesh(blobGeo, blobMat);
        shadow.scale.setScalar(9 * tier);
        shadow.renderOrder = 1;
        g.add(obj, shadow);
        const fresh = Math.hypot(en.position.x - portal.x, en.position.y - portal.y) < 90;
        e = { c, obj, scale, born: fresh ? 0 : 1, gone: -1, mode: "alive", shadow, last: null, speed: 40, clipped: false, inside: false, approachFrom: null };
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
      // the last stretch: leave the road, curve round to the front of the gate and walk in
      let yaw = worldDirectionToThreeYaw(en.direction);
      const remaining = roadLength - en.distanceTraveled;
      if (gate && remaining < castleAt + APPROACH_LEAD) {
        if (!e.approachFrom) e.approachFrom = pos.clone();
        const t = Math.min(1, (castleAt + APPROACH_LEAD - remaining) / APPROACH_LEAD);
        const P0 = e.approachFrom;
        const C = gate.gateFront.clone().addScaledVector(gate.gatePlane.normal, 45);
        const E = gate.gateInside;
        const u = 1 - t;
        pos.set(
          u * u * P0.x + 2 * u * t * C.x + t * t * E.x,
          pos.y,
          u * u * P0.z + 2 * u * t * C.z + t * t * E.z,
        );
        const tan = new THREE.Vector3(2 * u * (C.x - P0.x) + 2 * t * (E.x - C.x), 0, 2 * u * (C.z - P0.z) + 2 * t * (E.z - C.z));
        if (tan.lengthSq() > 1e-6) yaw = Math.atan2(tan.x, tan.z);
      }
      e.obj.position.copy(pos);
      e.shadow.position.set(pos.x, 0.2, pos.z);
      const d = Math.atan2(Math.sin(yaw - e.obj.rotation.y), Math.cos(yaw - e.obj.rotation.y));
      e.obj.rotation.y += d * Math.min(1, dt * 8);
      e.c.walk.timeScale = en.slow ? 0.55 : 1.0;
      e.c.update(dt);
      const nearCastle = roadLength - en.distanceTraveled < castleAt + APPROACH_LEAD + 40 || Math.hypot(en.position.x - fortress.x, en.position.y - fortress.y) < 140;
      if (nearCastle) anyNearGate = true;
      // close to the castle the creature is cut by the gate's plane, so it vanishes as it walks in
      if (nearCastle && gate && !e.clipped) {
        e.clipped = true;
        e.obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          const cloned = mats.map((mm) => {
            const c = (mm as THREE.Material).clone();
            c.clippingPlanes = [clipScene];
            return c;
          });
          m.material = Array.isArray(m.material) ? cloned : cloned[0]!;
        });
      }
      if (gate && nearCastle) {
        const past = gate.gatePlane.distanceToPoint(pos) < 0;
        e.shadow.visible = !past;
        if (past && !e.inside) {
          e.inside = true;
          gate.struck();
          fx.glow.emit(gate.gateFront.clone().setY(10), { count: en.boss ? 60 : 24, color: "#fff0c0", colorEnd: "#ff4a1a", size: 3, life: 0.6, speed: 60, up: 24, gravity: 90 });
          fx.rings.ring(gate.gateFront.clone().setY(0.5), "#ff5a2a", 4, 40, 0.5);
        }
      }
      if (en.burn && Math.random() < 0.4) fx.flame(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, ENEMY_HEIGHT * 0.5, 0)), 0.5, "#ff4a0a");
    }
    if (gate && anyNearGate) gate.holdOpenUntil = performance.now() + 1500;
    if (gate && g.parent) clipScene.copy(gate.gatePlane).applyMatrix4(g.parent.matrixWorld);

    for (const [id, e] of live.current) {
      if (seen.has(id)) continue;
      if (e.gone < 0) {
        e.gone = 0;
        const reached = !!e.last && (roadLength - e.last.distanceTraveled < castleAt + 40 || e.inside);
        if (reached) {
          // it walked in through the gate (and was cut away by it); nothing left to show
          if (!e.inside && gate) gate.struck();
          remove(id, e);
          continue;
        } else {
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

    function remove(id: string, e: Live) {
      g!.remove(e.obj, e.shadow);
      live.current.delete(id);
      hidden!.delete(id);
    }
  });

  // never leave ids hidden in the 2D layer if this layer goes away
  useEffect(() => {
    const set = hiddenIds.current;
    return () => set?.clear();
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
  return (
    <WorldScale fx={fx}>
      <Lights />
      <primitive object={fx.root} />
      <Castle key={lid} engine={engine} fortress={fortress} facing={anchorInfo.facingDir} fx={fx} state={castle} />
      <LayerBoundary onError={() => hiddenIds.current?.clear()}>
        <Suspense fallback={null}>
          <Creatures engine={engine} hiddenIds={hiddenIds} fx={fx} castle={castle} portal={portal} fortress={fortress} roadLength={layout.length} castleAt={Math.hypot(layout.path[layout.path.length - 1]!.x - fortress.x, layout.path[layout.path.length - 1]!.y - fortress.y)} />
        </Suspense>
      </LayerBoundary>
    </WorldScale>
  );
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
