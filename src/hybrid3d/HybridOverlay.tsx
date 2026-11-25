import { buildLavaPool, buildTorch, PROPS_3D, type LiveProp } from "./mapProps3d";
import { getMapDecorations } from "@/rendering/mapDecorations";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GameEngine } from "@/engine/GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import { getMapLayout } from "@/data/mapLayouts";
import { getBiome } from "@/rendering/biomes";
import { getFortressAnchor, getPortalAnchor, platformStyleFor } from "@/rendering/MapRenderer";
import { buildFoundation, type FoundationStyle } from "./foundations";
import type { Battlefield3DUiState } from "@/battlefield3d/Battlefield3D";
import { cameraPosition, groundGroupPlacement, worldDirectionToThreeYaw, worldToLocalGround } from "@/rendering3d/enemyProjection";
import { buildCastleModel, type CastleModel } from "@/battlefield3d/models/castleModel";
import { Garrison } from "./garrison3d";
import { City3D } from "./city3d";
import { Effects, hasSkinShotFx, SKIN_BOLT_COLORS } from "@/battlefield3d/fx";
import { animateTowerParts, buildTowerModel, type TowerModel } from "@/battlefield3d/models/towerModel";
import { getTowerVisualStage, TOWER_PRESENTATION_SCALE } from "@/config/towerStats";
import { getTowerStats, type TowerInstance } from "@/entities/Tower";
import { MANA_MAX } from "@/config/towerMana";
import { castleDressingFor } from "@/rendering/castleSprites";
import { getActiveCastleSkin } from "@/rendering/castleSkinFx";
import { footprints, type PrintKind } from "@/rendering/footprints";
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

let starTex: THREE.Texture | null = null;
/** A soft five-pointed star (the dizzy stars over a stunned tower). */
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const glow = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(0.35, "rgba(255,220,120,0.35)");
  glow.addColorStop(1, "rgba(255,200,80,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#ffffff";
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 7 : 17;
    x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  x.closePath();
  x.fill();
  starTex = new THREE.CanvasTexture(c);
  return starTex;
}

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
      {/* a warm rim from behind, so the monsters' silhouettes stand out of the map with real volume */}
      <directionalLight color="#ffd0a0" intensity={1.1} position={[60, 240, 700]} />
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
  /**
   * A blow on the gate: "light" for a creature getting in (shake + flash), "mini" for a
   * Mini-Boss blow (harder, a few stones fall), "main" for a Boss blow — the whole castle
   * reacts: it rocks, stones break off the gatehouse, cracks spread round the arch and the
   * defenders pour burning oil on the attacker from the machicolations.
   */
  struck: (kind?: "light" | "mini" | "main", target?: THREE.Vector3, targetH?: number) => void;
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
  /** the castle rocking back from a blow: a damped spring on its tilt */
  const rock = useRef({ a: 0, v: 0 });
  /** cracks round the gate arch (0..1; they slowly knit back), and how hot they glow right after a blow */
  const cracks = useRef(0);
  const crackGlow = useRef(0);
  const coreFlare = useRef(0);
  /** seconds of burning oil still pouring from the machicolations */
  const oil = useRef(0);
  /** where the attacker stands (and how tall it is), so the oil lands on it */
  const oilAt = useRef<{ at: THREE.Vector3; h: number } | null>(null);
  const debrisGroup = useRef<THREE.Group>(null);
  const debris = useRef<{ m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; life: number; rest: boolean }[]>([]);
  // the gate (the model's +Z) faces straight back down the road the horde comes in on — squared
  // to the map (one of the four sides), never at a slant — so the road runs right into the gate
  const YAW = useMemo(() => {
    const gx = -facing.x;
    const gy = -facing.y;
    const square = Math.abs(gx) >= Math.abs(gy) ? { x: Math.sign(gx) || -1, y: 0 } : { x: 0, y: Math.sign(gy) || 1 };
    return worldDirectionToThreeYaw(square);
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
  // the road ends at the castle's GATE, not at its middle: the building stands back from the
  // road's end by the gate's own depth, so whatever walks the road goes in through the arch
  const anchor = useMemo(() => {
    const at0 = loc(fortress);
    const g = model.anchors.gate;
    if (!g) return at0;
    const v = new THREE.Vector3(g.x, 0, g.z + 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), YAW).multiplyScalar(scale);
    return at0.sub(v);
  }, [fortress.x, fortress.y, model, YAW, scale]);
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

  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a7f70", roughness: 0.95, transparent: true }), []);
  const stoneGeos = useMemo(() => [new THREE.BoxGeometry(1, 0.8, 0.9), new THREE.DodecahedronGeometry(0.6, 0), new THREE.BoxGeometry(1.3, 0.6, 0.7)], []);
  /** stones breaking off the top of the gatehouse and tumbling down in front of it */
  const spawnDebris = (n: number, power: number) => {
    const dg = debrisGroup.current;
    const top = at("gate");
    if (!dg || !top) return;
    const fwd = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (let i = 0; i < n; i++) {
      let d = debris.current.find((x) => x.life <= 0);
      if (!d) {
        if (debris.current.length >= 48) break;
        const m = new THREE.Mesh(stoneGeos[i % stoneGeos.length]!, stoneMat.clone());
        m.castShadow = true;
        dg.add(m);
        d = { m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, rest: false };
        debris.current.push(d);
      }
      const sz = (2.6 + Math.random() * 3.6) * scale * (0.7 + power * 0.5);
      d.m.scale.setScalar(sz);
      d.m.position.copy(top).addScaledVector(side, (Math.random() - 0.5) * 18 * scale).add(new THREE.Vector3(0, (18 + Math.random() * 12) * scale, 0)).addScaledVector(fwd, 2 * scale);
      d.m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.v.copy(fwd).multiplyScalar(30 + Math.random() * 70 * power).addScaledVector(side, (Math.random() - 0.5) * 90).setY(40 + Math.random() * 70 * power);
      d.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      d.life = 3.5 + Math.random();
      d.rest = false;
      d.m.visible = true;
      (d.m.material as THREE.MeshStandardMaterial).opacity = 1;
    }
  };
  /** the crack web round the arch: a canvas texture, glowing ember-orange right after a blow */
  const crackMat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const branch = (x: number, y: number, a: number, len: number, w: number) => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      let cx = x, cy = y;
      const steps = 6 + Math.floor(rnd() * 5);
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 0.9;
        cx += Math.cos(a) * (len / steps);
        cy += Math.sin(a) * (len / steps);
        g.lineTo(cx, cy);
        if (w > 1.2 && rnd() < 0.3) {
          g.stroke();
          branch(cx, cy, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * 0.5, w * 0.6);
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(cx, cy);
        }
      }
      g.stroke();
    };
    g.strokeStyle = "#fff";
    g.lineCap = "round";
    g.lineJoin = "round";
    // from the arch's crown and shoulders out across the stone
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.05 + (i / 8) * 0.9);
      const r = 62;
      branch(128 + Math.cos(a) * r, 150 + Math.sin(a) * r, a + (rnd() - 0.5) * 0.4, 70 + rnd() * 50, 3.2);
    }
    const tex = new THREE.CanvasTexture(c);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: "#1a120c", polygonOffset: true, polygonOffsetFactor: -2 });
  }, []);

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
        struck: (kind = "light", target, targetH = 60) => {
          shake.current = kind === "main" ? 0.7 : kind === "mini" ? 0.5 : 0.35;
          if (kind === "light") return;
          const p = kind === "main" ? 1 : 0.55;
          rock.current.v += 0.42 * p;
          cracks.current = Math.min(1, cracks.current + (kind === "main" ? 0.36 : 0.18));
          crackGlow.current = 1;
          coreFlare.current = 1;
          spawnDebris(kind === "main" ? 18 : 8, p);
          if (target) oilAt.current = { at: target.clone(), h: targetH };
          if (kind === "main") {
            oil.current = 1.4;
            // the castle strikes back: its crystal core lashes the attacker with lightning
            const core = at("core");
            if (core && target) {
              const hit = target.clone().setY(targetH * 0.55);
              for (let i = 0; i < 3; i++) fx.bolts.bolt(core.clone(), hit.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8)), i ? model.core : "#ffffff", 0.32, 14);
              fx.glow.emit(hit, { count: 40, color: "#ffffff", colorEnd: model.core, size: 3.2, life: 0.6, speed: 70, up: 10, drag: 2, radius: 6 });
              fx.glow.emit(core.clone(), { count: 24, color: "#ffffff", colorEnd: model.core, size: 2.6, life: 0.5, speed: 40, drag: 2 });
              fx.rings.ring(target.clone().setY(0.6), model.core, 6, targetH * 1.1, 0.6);
            }
          }
        },
      };
      if (import.meta.env.DEV) (window as unknown as { __castle?: { state: CastleState; debris: unknown[] } }).__castle = { state: state.current, debris: debris.current };
    } else {
      state.current.gateInside.copy(inside);
      state.current.gateFront.copy(front.setY(0));
      state.current.gatePlane.setFromNormalAndCoplanarPoint(fwd.clone(), planePoint);
    }
  });

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    animateTowerParts(model.root, t);
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
      // rock back from the blow and settle (a damped spring, tilting away from the gate)
      const r = rock.current;
      const sdt = Math.min(dt, 1 / 30);
      r.v += (-r.a * 90 - r.v * 9) * sdt;
      r.a += r.v * sdt;
      group.current.rotation.order = "YXZ";
      group.current.rotation.x = -r.a * 0.7;
      if (parts.portcullis) parts.portcullis.position.z = Math.max(0, r.a) * 25;
    }
    if (flash.current) flash.current.intensity = Math.max(0, shake.current) * 1500;
    // the crack web: dark lines that glow ember-hot right after a blow, knitting back slowly
    cracks.current = Math.max(0, cracks.current - dt * 0.012);
    crackGlow.current = Math.max(0, crackGlow.current - dt * 0.8);
    crackMat.opacity = Math.min(0.95, cracks.current * 1.4);
    crackMat.color.setRGB(0.1 + crackGlow.current * 1.0, 0.07 + crackGlow.current * 0.38, 0.05 + crackGlow.current * 0.05);
    // the crystal core flares as the castle takes the hit
    coreFlare.current = Math.max(0, coreFlare.current - dt * 1.6);
    if (parts.core && coreFlare.current > 0) (parts.core.material as THREE.MeshStandardMaterial).emissiveIntensity += coreFlare.current * 6;
    if (coreLight.current) coreLight.current.intensity += coreFlare.current * 500;
    // burning oil poured from the machicolations onto whoever is at the gate
    if (oil.current > 0) {
      oil.current -= dt;
      const gp = at("gate");
      const tgt = oilAt.current;
      if (gp) {
        const fwd = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
        const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
        for (const sx of [-1, 1]) {
          const lip = gp.clone().add(new THREE.Vector3(0, 24 * scale, 0)).addScaledVector(fwd, 3 * scale).addScaledVector(side, sx * 5 * scale);
          // aimed at the attacker's head and shoulders, arcing out from the wall
          const land = tgt ? tgt.at.clone().setY(tgt.h * 0.85).addScaledVector(side, sx * tgt.h * 0.08) : lip.clone().addScaledVector(fwd, 14 * scale).setY(4);
          const dir = land.clone().sub(lip);
          const dist = dir.length();
          dir.normalize();
          fx.glow.emit(lip, { count: 5, color: "#ffe08a", colorEnd: "#d04a08", size: 3.4 * scale, life: 0.55, speed: dist * 1.6, dir, spread: 0.06, gravity: 60, radius: 1.5 * scale });
          if (tgt) {
            // it splashes and burns down the body
            const body = tgt.at.clone().setY(tgt.h * (0.2 + Math.random() * 0.7)).add(new THREE.Vector3((Math.random() - 0.5) * tgt.h * 0.3, 0, (Math.random() - 0.5) * tgt.h * 0.3));
            fx.flame(body, 1.6, Math.random() < 0.5 ? "#ff6a1a" : "#ffb030");
            if (Math.random() < 0.5) fx.smoke.emit(body, { count: 1, color: "#4a3a30", colorEnd: "#140e0a", size: tgt.h * 0.12, life: 1.2, speed: 8, up: 30, grow: 2.4, alpha: 0.35 });
            if (Math.random() < 0.4) fx.glow.emit(tgt.at.clone().setY(2), { count: 3, color: "#ffb030", colorEnd: "#5a1a04", size: 2.4, life: 0.6, speed: 30, up: 14, gravity: 120, radius: tgt.h * 0.2 });
          }
        }
      }
    }
    // stones: fall, bounce once, lie a moment, then fade
    for (const d of debris.current) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (!d.rest) {
        d.v.y -= 260 * dt;
        d.m.position.addScaledVector(d.v, dt);
        d.m.rotation.x += d.w.x * dt;
        d.m.rotation.y += d.w.y * dt;
        d.m.rotation.z += d.w.z * dt;
        const floor = d.m.scale.x * 0.35;
        if (d.m.position.y < floor) {
          d.m.position.y = floor;
          if (Math.abs(d.v.y) > 40) {
            d.v.set(d.v.x * 0.45, -d.v.y * 0.28, d.v.z * 0.45);
            d.w.multiplyScalar(0.5);
            fx.smoke.emit(d.m.position.clone(), { count: 2, color: "#7a7064", colorEnd: "#2a2622", size: d.m.scale.x * 1.4, life: 0.8, speed: 12, up: 6, grow: 2, alpha: 0.4 });
          } else d.rest = true;
        }
      }
      (d.m.material as THREE.MeshStandardMaterial).opacity = Math.min(1, d.life / 0.8);
      if (d.life <= 0) d.m.visible = false;
    }
  });

  return (
    <>
    <mesh rotation-x={-Math.PI / 2} position={[anchor.x, 0.08, anchor.z]} material={groundPatch} receiveShadow renderOrder={1}>
      <circleGeometry args={[82, 48]} />
    </mesh>
    <group ref={group} position={anchor} rotation-y={YAW} scale={scale}>
      <primitive object={model.root} />
      <Garrison engine={engine} model={model} group={group} fx={fx} />
      {flags.map((f) => (
        <primitive key={f.uuid} object={f} />
      ))}
      <pointLight ref={torch} color="#ffa050" intensity={260} distance={60} decay={1.6} position={[0, 18, 34]} />
      <pointLight ref={coreLight} color={model.core} intensity={120} distance={40} decay={1.6} position={[0, 30, 30]} />
      <pointLight ref={flash} color="#ff3a1a" intensity={0} distance={90} decay={1.4} position={[0, 12, 40]} />
      <mesh position={[model.anchors.gate?.x ?? 0, (model.anchors.gate?.y ?? 8) + 9, (model.anchors.gate?.z ?? 14.7) + 0.25]} material={crackMat} renderOrder={3}>
        <planeGeometry args={[30, 30]} />
      </mesh>
    </group>
    <group ref={debrisGroup} />
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
/** Elites, Mini-Bosses and Bosses stand this much taller than the 2D sprites' ratio, so they dominate the road. */
const RANKED_SIZE = 1.3;
/** The colour of each rank's menace — eyes, ground ring, enrage. */
const RANK_COLOR = { elite: "#ff3a2a", mini: "#ff8a1a", main: "#c05aff" } as const;
const auraGeo = new THREE.CircleGeometry(1, 48);
let eyeTex: THREE.Texture | null = null;
function eyeTexture() {
  if (eyeTex) return eyeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.18, "rgba(255,255,255,0.95)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  eyeTex = new THREE.CanvasTexture(c);
  return eyeTex;
}
let auraTex: THREE.Texture | null = null;
/** A ring of menace on the ground: bright edge, a few cracks of light running in, clear in the middle. */
function auraTexture() {
  if (auraTex) return auraTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,0)");
  gr.addColorStop(0.62, "rgba(255,255,255,0.12)");
  gr.addColorStop(0.86, "rgba(255,255,255,0.75)");
  gr.addColorStop(0.92, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118);
    g.lineTo(128 + Math.cos(a + 0.12) * 92, 128 + Math.sin(a + 0.12) * 92);
    g.lineTo(128 + Math.cos(a - 0.05) * 74, 128 + Math.sin(a - 0.05) * 74);
    g.stroke();
  }
  auraTex = new THREE.CanvasTexture(c);
  return auraTex;
}

const eyeTmp = new THREE.Vector3();
const armorTmp = new THREE.Vector3();

/** One piece of a boss's armour and the bone it rides (offsets as fractions of the creature's height). */
interface ArmorPiece {
  obj: THREE.Object3D;
  bone: "head" | "lArm" | "rArm" | "spine" | "hips";
  up: number;
  fwd: number;
  side: number;
}
const armorIron = new THREE.MeshStandardMaterial({ color: "#5a5258", metalness: 0.8, roughness: 0.3 });
const armorBone = new THREE.MeshStandardMaterial({ color: "#d8ccb0", roughness: 0.6 });
/**
 * Spiked iron armour for a Mini-Boss or Boss: pauldrons bristling with
 * spikes, a pair of horns, a row of spikes down the back, trimmed in its
 * rank's colour. Sizes follow the creature's height `h`.
 */
function buildArmor(h: number, rank: string, main: boolean): ArmorPiece[] {
  const trim = new THREE.MeshStandardMaterial({ color: rank, emissive: rank, emissiveIntensity: 1.4, roughness: 0.4 });
  const k = main ? 1.15 : 1;
  const out: ArmorPiece[] = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.06 * h * k, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), armorIron);
    shell.scale.set(1, 0.5, 1.15);
    p.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.06 * h * k, 0.007 * h, 6, 20), trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.004 * h;
    p.add(rim);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.013 * h * k, 0.07 * h * k, 6), armorBone);
      sp.position.set(sx * (0.01 + i * 0.018) * h, 0.04 * h * k, (i - 1) * 0.026 * h);
      sp.rotation.z = -sx * (0.35 + i * 0.2);
      p.add(sp);
    }
    out.push({ obj: p, bone: sx < 0 ? "lArm" : "rArm", up: 0.02, fwd: 0, side: 0 });
  }
  // horns curling up and forward from the head
  const horns = new THREE.Group();
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.03, 0, 0), new THREE.Vector3(sx * 0.07, 0.05, -0.01), new THREE.Vector3(sx * 0.085, 0.11, 0.03), new THREE.Vector3(sx * 0.06, 0.15, 0.07)].map((v) => v.multiplyScalar(h * k));
    horns.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012 * h * k, 6, false), armorBone));
  }
  out.push({ obj: horns, bone: "head", up: 0.05, fwd: 0.01, side: 0 });
  // spikes down the back
  if (main) {
    const back = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.02 * h, 0.09 * h * (1 - i * 0.12), 6), i % 2 ? armorIron : trim);
      sp.position.set(0, 0.04 * h - i * 0.045 * h, -0.02 * h);
      sp.rotation.x = -1.0;
      back.add(sp);
    }
    out.push({ obj: back, bone: "spine", up: 0.02, fwd: -0.07, side: 0 });
  }
  for (const a of out)
    a.obj.traverse((o) => {
      (o as THREE.Mesh).castShadow = true;
    });
  return out;
}
const eyeTop = new THREE.Vector3();

const iceCrystalMat = new THREE.MeshStandardMaterial({ color: "#e6f8ff", emissive: "#5ab8ff", emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.88 });
/** Clusters of ice crystals that burst out on the shoulders, back, head and hips of a frozen creature. */
function buildIce(h: number): ArmorPiece[] {
  const spots: { bone: ArmorPiece["bone"]; up: number; fwd: number; side: number; n: number; size: number }[] = [
    { bone: "head", up: 0.04, fwd: 0, side: 0, n: 4, size: 0.07 },
    { bone: "lArm", up: 0.02, fwd: 0, side: 0, n: 3, size: 0.06 },
    { bone: "rArm", up: 0.02, fwd: 0, side: 0, n: 3, size: 0.06 },
    { bone: "spine", up: 0.03, fwd: -0.05, side: 0, n: 5, size: 0.08 },
    { bone: "hips", up: 0, fwd: 0, side: 0, n: 4, size: 0.06 },
  ];
  return spots.map((sp) => {
    const grp = new THREE.Group();
    for (let i = 0; i < sp.n; i++) {
      const len = sp.size * h * (0.6 + Math.random() * 0.8);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.22, len, 5), iceCrystalMat);
      cone.geometry.translate(0, len / 2, 0);
      const a = (i / sp.n) * Math.PI * 2 + Math.random() * 0.6;
      cone.rotation.set(Math.cos(a) * (0.5 + Math.random() * 0.5), 0, Math.sin(a) * (0.5 + Math.random() * 0.5));
      cone.position.set(Math.cos(a) * sp.size * h * 0.25, 0, Math.sin(a) * sp.size * h * 0.25);
      grp.add(cone);
    }
    grp.visible = false;
    return { obj: grp, bone: sp.bone, up: sp.up, fwd: sp.fwd, side: sp.side };
  });
}

function stampLocal(x: number, z: number, yaw: number, length: number, left: boolean, kind: PrintKind = "foot") {
  const wx = WORLD_SIZE.width / 2 - x;
  const wy = WORLD_SIZE.height / 2 - z * TILT_COS;
  const dx = -Math.sin(yaw);
  const dy = -Math.cos(yaw) * TILT_COS;
  footprints.stamp(wx, wy, Math.atan2(dy, dx), length, left, kind);
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
  /** Bosses' spiked iron armour (pauldrons, horns, back spikes), placed on the bones every frame. */
  armor: ArmorPiece[];
  /** Gate blows already thrown as punches. */
  punches: number;
  /** A boss roars once, as it steps out of the rift. */
  roared: boolean;
  /** Menace: glowing eyes and a pulsing ring of its rank's colour round its feet. */
  eyes: THREE.Sprite[];
  aura: THREE.Mesh;
  rank: string;
  heavy: boolean;
  /** Per foot: lowest height seen lately and whether it is planted. */
  /** per foot: running low/high of its height (they slowly forget, so they follow the walk), whether it is planted, and where it last printed */
  feet: { min: number; max: number; down: boolean; lx: number; lz: number }[];
  /** frost on the body (0 none → 1 frozen solid), whether it was frozen last frame, and its ice crystals (built on first freeze) */
  frost: number;
  frozen: boolean;
  ice: ArmorPiece[] | null;
  /** BOSS FURY: the roar's warning on the ground (an edge ring and a filling disc), the barrier dome, and what was already played. */
  fury?: { ring: THREE.Mesh; fill: THREE.Mesh; dome: THREE.Mesh; windup: boolean; blastAt: number; barrier: boolean };
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
  // dev-only handle for browser checks of the 3D creatures
  if (import.meta.env.DEV) (window as unknown as { __live3d?: Map<string, Live> }).__live3d = live.current;
  const blobMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), color: "#000", transparent: true, opacity: 0.5, depthWrite: false }), []);
  const blobGeo = useMemo(() => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), []);
  const portal3 = useMemo(() => loc(portal, 3), [portal]);
  const footTmp = useMemo(() => new THREE.Vector3(), []);
  const entered = useRef(new Set<string>());
  const strides = useRef(new Map<string, { at: number; left: boolean; last: number }>());
  const strideSeen = useMemo(() => new Set<string>(), []);

  /** Where a creature stands before the gate: further out the bigger it is. */
  const standPoint = (gate: CastleState, h: number) => gate.gateFront.clone().addScaledVector(gate.gatePlane.normal, 4 + h * 0.22).setY(0);

  /**
   * BOSS FURY (config/bossFury.ts) — what the player reads of a boss's roar and barrier:
   * a red ring on the ground at the exact radius it will hit, a disc filling it as the
   * roar winds up (the boss rears up and roars), then a shockwave; and a golden dome
   * (main boss barrier) or a stone sheen (mini-boss harden) while it's nearly unhittable.
   */
  const fury = (e: Live, en: EnemyInstance, g: THREE.Group) => {
    const st = en.boss;
    if (!st || st.nextRoarAtMs === undefined || e.born < 1 || e.enterT >= 0) {
      if (e.fury) e.fury.ring.visible = e.fury.fill.visible = e.fury.dome.visible = false;
      return;
    }
    if (!e.fury) {
      const mk = (geo: THREE.BufferGeometry, color: string, opacity: number) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 4;
        m.visible = false;
        g.add(m);
        return m;
      };
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: "#ffd878", transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      dome.visible = false;
      g.add(dome);
      e.fury = { ring: mk(new THREE.RingGeometry(0.955, 1, 96), "#ff3a1a", 0.9), fill: mk(new THREE.CircleGeometry(1, 64), "#ff5a1a", 0.18), dome, windup: false, blastAt: -1, barrier: false };
    }
    const f = e.fury;
    const feet = e.obj.position.clone().setY(0.8);
    const r3 = loc({ x: en.position.x + (st.roarRadius ?? 200), y: en.position.y }).distanceTo(loc(en.position));
    const tele = st.roarTelegraphRemainingMs ?? 0;
    const now = performance.now();
    if (tele > 0) {
      const k = 1 - tele / Math.max(1, st.roarTelegraphTotalMs ?? 1);
      f.ring.visible = f.fill.visible = true;
      f.ring.position.copy(feet);
      f.fill.position.copy(feet).setY(0.7);
      f.ring.scale.setScalar(r3);
      f.fill.scale.setScalar(Math.max(0.01, r3 * k));
      (f.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.45 * Math.abs(Math.sin(now / 90));
      (f.fill.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.18 * k;
      if (!f.windup) {
        f.windup = true;
        e.c.playOnce("roar", 1.25);
      }
      if (Math.random() < 0.5) fx.glow.emit(e.obj.position.clone().add(new THREE.Vector3(0, e.h * 0.8, 0)), { count: 1, color: "#ffd0a0", colorEnd: "#ff2a0a", size: 2.2, life: 0.5, speed: 18, up: 10, drag: 1, radius: e.h * 0.15 });
    } else {
      f.ring.visible = f.fill.visible = false;
      f.windup = false;
    }
    // the roar lands: a shockwave the size of the warning ring, dust, and a flash in its throat
    if ((st.roarSinceMs ?? 99_999) < 250 && now - f.blastAt > 800) {
      f.blastAt = now;
      fx.rings.ring(feet, "#ff5a1a", 6, r3 / 0.65, 0.55);
      fx.rings.ring(feet, "#ffd0a0", 3, (r3 * 0.7) / 0.65, 0.4);
      fx.smoke.emit(feet.clone().setY(3), { count: 18, color: "#7a6a58", colorEnd: "#2a221c", size: e.h * 0.18, life: 1.3, speed: r3 * 1.4, up: 6, grow: 2, alpha: 0.4, drag: 2.2, radius: e.h * 0.2 });
      fx.glow.emit(e.obj.position.clone().add(new THREE.Vector3(0, e.h * 0.75, 0)), { count: 4, color: "#ffffff", colorEnd: "#ff4a1a", size: e.h * 0.35, life: 0.25, speed: 0, grow: 1.6 });
    }
    // the barrier (main) / harden (mini)
    const up = st.barrierUntilMs != null;
    f.dome.visible = up;
    if (up) {
      const main = st.isMainBoss;
      const mat = f.dome.material as THREE.MeshBasicMaterial;
      mat.color.set(main ? "#ffd878" : "#c8ccd8");
      mat.opacity = (main ? 0.2 : 0.12) + 0.08 * Math.sin(now / 120);
      f.dome.position.copy(e.obj.position).setY(0);
      f.dome.scale.set(e.h * 0.55, e.h * 1.05, e.h * 0.55);
      f.dome.rotation.y += 0.02;
      if (!f.barrier) {
        f.barrier = true;
        fx.rings.ring(feet, main ? "#ffd878" : "#c8ccd8", 4, (e.h * 0.9) / 0.65, 0.6);
        fx.glow.emit(e.obj.position.clone().add(new THREE.Vector3(0, e.h * 0.5, 0)), { count: 30, color: "#ffffff", colorEnd: main ? "#ffc848" : "#a8b0c0", size: 2, life: 0.8, speed: 40, drag: 2, radius: e.h * 0.3 });
      }
      if (Math.random() < 0.3) fx.glow.emit(e.obj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * e.h * 0.9, Math.random() * e.h, (Math.random() - 0.5) * e.h * 0.9)), { count: 1, color: "#ffffff", colorEnd: main ? "#ffd878" : "#c8ccd8", size: 1.4, life: 0.5, speed: 0, grow: 1.4, radius: 0.5 });
    } else f.barrier = false;
  };

  /** The menace of an Elite / Mini-Boss / Boss: glowing eyes, a ring of its rank's colour pulsing under it, and — badly hurt or enraged — it burns red and throws sparks. */
  const menace = (e: Live, en: EnemyInstance, dt: number, g: THREE.Group) => {
    const t = performance.now() / 1000;
    const enraged = !!en.boss?.enraged || en.hp < en.maxHp * 0.3;
    const col = enraged ? "#ff1a0a" : e.rank;
    // a boss roars as it steps out of the rift, the ground ringing round it
    if (!e.roared && e.born >= 1 && e.enterT < 0) {
      e.roared = true;
      e.c.playOnce("roar", 1.25);
      fx.rings.ring(e.obj.position.clone().setY(0.6), e.rank, 8, e.h * 1.6, 0.8);
      fx.smoke.emit(e.obj.position.clone().setY(2), { count: 10, color: "#6a5a48", colorEnd: "#1e1814", size: e.h * 0.16, life: 1.2, speed: 30, up: 8, grow: 2.2, alpha: 0.4, radius: e.h * 0.2 });
    }
    // enraged, it breaks into a run (the stride follows how fast the game really moves it)
    if (e.enterT < 0) e.c.setRunning(enraged, Math.min(1.4, Math.max(0.7, e.speed / 45)));
    const auraMat = e.aura.material as THREE.MeshBasicMaterial;
    e.aura.position.set(e.obj.position.x, 0.4, e.obj.position.z);
    e.aura.scale.setScalar(e.h * 0.42 * (1 + 0.08 * Math.sin(t * (enraged ? 9 : 3))));
    e.aura.rotation.z += dt * (enraged ? 1.6 : 0.4);
    auraMat.color.set(col);
    auraMat.opacity = (enraged ? 0.95 : 0.6) * Math.min(1, e.born);
    const head = e.c.head;
    if (head) {
      head.getWorldPosition(eyeTmp);
      g.worldToLocal(eyeTmp);
      // the eyes sit partway up the head, between the neck joint and the crown
      if (e.c.headTop) {
        e.c.headTop.getWorldPosition(eyeTop);
        g.worldToLocal(eyeTop);
        eyeTmp.lerp(eyeTop, 0.4);
      }
      const yaw = e.obj.rotation.y;
      const fx_ = Math.sin(yaw), fz = Math.cos(yaw);
      const flicker = 0.85 + 0.15 * Math.sin(t * 17 + e.h);
      for (let k = 0; k < 2; k++) {
        const side = (k ? 1 : -1) * e.h * 0.028;
        const sp = e.eyes[k]!;
        sp.position.set(eyeTmp.x + fx_ * e.h * 0.07 + fz * side, eyeTmp.y, eyeTmp.z + fz * e.h * 0.07 - fx_ * side);
        sp.material.color.set(col);
        sp.scale.setScalar(e.h * (enraged ? 0.1 : 0.075) * flicker);
        sp.visible = e.born >= 1;
      }
    } else for (const sp of e.eyes) sp.visible = false;
    // the armour rides its bones, turned with the body; it melts away with it in the castle
    const melting = e.enterT >= 0 && e.smashes >= (e.boss === "main" ? 3 : 2);
    for (const a of e.armor) {
      const b = a.bone === "head" ? e.c.head : e.c.bones[a.bone];
      if (!b || melting || e.born < 1) {
        a.obj.visible = false;
        continue;
      }
      b.getWorldPosition(armorTmp);
      g.worldToLocal(armorTmp);
      const yaw = e.obj.rotation.y;
      const fwd = a.fwd * e.h, side = a.side * e.h;
      a.obj.position.set(armorTmp.x + Math.sin(yaw) * fwd + Math.cos(yaw) * side, armorTmp.y + a.up * e.h, armorTmp.z + Math.cos(yaw) * fwd - Math.sin(yaw) * side);
      a.obj.rotation.set(0, yaw, 0);
      a.obj.visible = true;
    }
    if (enraged && Math.random() < 0.35) {
      const p = e.obj.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * e.h * 0.3, e.h * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * e.h * 0.3));
      fx.glow.emit(p, { count: 1, color: "#ffd27a", colorEnd: col, size: 1.6, life: 0.6, speed: 12, up: 14, drag: 1, radius: 1 });
    }
  };

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
      const n = Math.floor(e.enterT / BLOW);
      if (e.c.has("punch")) {
        // a real punch at the gate for every blow, timed so the fist lands as the gate shakes
        if (n >= e.punches) {
          e.punches = n + 1;
          e.c.playOnce("punch", 1.08 / BLOW);
        }
      } else {
        body.rotation.x = ph < 0.55 ? -0.25 * Math.sin((ph / 0.55) * Math.PI * 0.5) : -0.25 + 0.75 * Math.sin(((ph - 0.55) / 0.45) * Math.PI * 0.5);
        e.c.walk.timeScale = 0.15;
      }
      e.c.update(dt);
      if (n >= e.smashes && ph > 0.92) {
        e.smashes = n + 1;
        gate.struck(e.boss === "main" ? "main" : e.boss === "mini" ? "mini" : "light", e.obj.position, e.h);
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
        const cid = creatureFor(en.type, !!en.boss, !!en.boss?.isMainBoss, en.boss?.bossId);
        const h = ENEMY_HEIGHT * tier * RANKED_SIZE * heightFactor(en.type);
        const fresh = Math.hypot(en.position.x - portal.x, en.position.y - portal.y) < 90;
        // no ink outline: lit and shaded, these read as solid 3D monsters, not drawings
        const c = new Creature(kits[cid], h, { id: cid, biomeId: snap.biomeId }, { outline: false });
        const obj = c.obj;
        const scale = c.scale;
        const shadow = new THREE.Mesh(blobGeo, blobMat);
        shadow.scale.setScalar(9 * tier * RANKED_SIZE);
        shadow.renderOrder = 1;
        const rank = en.boss ? (en.boss.isMainBoss ? RANK_COLOR.main : RANK_COLOR.mini) : RANK_COLOR.elite;
        const eyes = [0, 1].map(() => {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTexture(), color: rank, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
          sp.scale.setScalar(h * 0.075);
          sp.renderOrder = 6;
          return sp;
        });
        const aura = new THREE.Mesh(auraGeo, new THREE.MeshBasicMaterial({ map: auraTexture(), color: rank, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
        aura.rotation.x = -Math.PI / 2;
        aura.scale.setScalar(h * 0.42);
        aura.renderOrder = 2;
        g.add(obj, shadow, aura, ...eyes);
        if (fresh && en.boss) fx.rings.ring(portal3.clone(), rank, 10, en.boss.isMainBoss ? 160 : 110, 0.9);
        const armor = en.boss ? buildArmor(h, rank, !!en.boss.isMainBoss) : [];
        for (const a of armor) g.add(a.obj);
        e = { c, obj, scale, eyes, aura, rank, armor, punches: 0, roared: !en.boss || !fresh, born: fresh ? 0 : 1, gone: -1, mode: "alive", shadow, last: null, speed: 40, enterT: -1, smashes: 0, fading: [], boss: en.boss ? (en.boss.isMainBoss ? "main" : "mini") : null, inside: false, approachFrom: null, h, heavy: !!en.boss || en.type === "BRUTE" || en.type === "IRONCLAD", feet: [{ min: 1e9, max: -1e9, down: true, lx: 1e9, lz: 1e9 }, { min: 1e9, max: -1e9, down: true, lx: 1e9, lz: 1e9 }], frost: 0, frozen: false, ice: null };
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
      // frost: the ice tower's freeze wraps the body in an ice shell with crystals bursting out, and it stands caught in it
      {
        const pct = en.slow?.percent ?? 0;
        const target = pct >= 0.75 ? 1 : pct > 0 ? 0.22 : 0;
        e.frost += (target - e.frost) * Math.min(1, dt * (target > e.frost ? 7 : 2.2));
        if (e.frost < 0.003) e.frost = 0;
        e.c.setFrost(e.mode === "alive" ? e.frost : 0);
        const solid = e.frost > 0.6;
        const centre = e.obj.position.clone().setY(e.h * 0.45);
        if (solid && !e.frozen) {
          // the freeze takes hold: a cold burst and a ring of frost on the ground
          fx.glow.emit(centre, { count: 26, color: "#ffffff", colorEnd: "#5ab8ff", size: 2.2, life: 0.6, speed: 50, up: 10, drag: 2, radius: e.h * 0.25 });
          fx.smoke.emit(e.obj.position.clone().setY(2), { count: 8, color: "#e8f6ff", colorEnd: "#8ab8d8", size: e.h * 0.14, life: 1.2, speed: 18, up: 4, grow: 2.4, alpha: 0.35, radius: e.h * 0.2 });
          fx.rings.ring(e.obj.position.clone().setY(0.6), "#bfe8ff", 4, e.h * 0.9, 0.7);
          if (!e.ice) {
            e.ice = buildIce(e.h);
            for (const a of e.ice) g.add(a.obj);
          }
        } else if (!solid && e.frozen) {
          // the ice gives: it shatters into glittering shards
          fx.glow.emit(centre, { count: 34, color: "#ffffff", colorEnd: "#6ac8ff", size: 2.6, life: 0.9, speed: 70, up: 30, gravity: 160, radius: e.h * 0.25 });
          fx.smoke.emit(centre, { count: 5, color: "#dff2ff", colorEnd: "#7aa8c8", size: e.h * 0.1, life: 0.8, speed: 20, up: 6, grow: 2, alpha: 0.3 });
        }
        e.frozen = solid;
        if (solid && Math.random() < 0.25) fx.glow.emit(centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * e.h * 0.4, (Math.random() - 0.3) * e.h * 0.5, (Math.random() - 0.5) * e.h * 0.4)), { count: 1, color: "#ffffff", colorEnd: "#9ad8ff", size: 1.4, life: 0.5, speed: 4, up: -6, drag: 1 });
        if (e.ice) {
          const k = Math.max(0, Math.min(1, (e.frost - 0.45) / 0.4));
          for (const a of e.ice) {
            const b = a.bone === "head" ? e.c.head : e.c.bones[a.bone];
            if (!b || k <= 0 || e.mode !== "alive") {
              a.obj.visible = false;
              continue;
            }
            b.getWorldPosition(armorTmp);
            g.worldToLocal(armorTmp);
            const yaw = e.obj.rotation.y;
            const fwd = a.fwd * e.h;
            a.obj.position.set(armorTmp.x + Math.sin(yaw) * fwd, armorTmp.y + a.up * e.h, armorTmp.z + Math.cos(yaw) * fwd);
            a.obj.rotation.set(0, yaw, 0);
            // crystals grow out with a little overshoot
            a.obj.scale.setScalar(k < 1 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1);
            a.obj.visible = true;
          }
        }
      }
      // footprints: a print wherever a foot comes down (not while climbing out of the rift or once through the gate)
      if (e.born >= 1 && e.enterT < 0 && e.c.feet.length === 2 && g.parent) {
        e.obj.updateMatrixWorld(true);
        for (let k = 0; k < 2; k++) {
          const st = e.feet[k]!;
          e.c.feet[k]!.getWorldPosition(footTmp);
          g.parent.worldToLocal(footTmp);
          const y = footTmp.y;
          // the band this foot moves in, forgetting slowly so it adapts to each body and gait
          const forget = dt * e.h * 0.05;
          st.min = Math.min(st.min + forget, y);
          st.max = Math.max(st.max - forget, y);
          const lift = Math.max(st.max - st.min, e.h * 0.004);
          const moved = Math.hypot(footTmp.x - st.lx, footTmp.z - st.lz);
          const stride = e.h * 0.22;
          // planted: back near the bottom of its band (and it has actually moved on since the last print)
          if (!st.down && y < st.min + lift * 0.28 && moved > stride * 0.5) {
            st.down = true;
            st.lx = footTmp.x;
            st.lz = footTmp.z;
            stampLocal(footTmp.x, footTmp.z, e.obj.rotation.y, e.h * 0.2, k === 0, e.boss ? "boss" : "claw");
            if (e.heavy) fx.smoke.emit(footTmp.clone().setY(1), { count: e.boss ? 5 : 3, color: "#6a5a48", colorEnd: "#2a241e", size: e.h * 0.1, life: 0.9, speed: 10, up: 6, grow: 2.2, alpha: 0.35, drag: 2 });
          } else if (st.down && y > st.min + lift * 0.6) st.down = false;
          // a gait whose foot barely lifts still leaves a trail: print once it has gone a full stride
          else if (moved > stride * 1.6 && y < st.min + lift * 0.5) {
            st.lx = footTmp.x;
            st.lz = footTmp.z;
            stampLocal(footTmp.x, footTmp.z, e.obj.rotation.y, e.h * 0.2, k === 0, e.boss ? "boss" : "claw");
          }
        }
      }
      if (en.burn && Math.random() < 0.4) fx.flame(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, ENEMY_HEIGHT * 0.5, 0)), 0.5, "#ff4a0a");
      menace(e, en, dt, g);
      fury(e, en, g);
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
          e.aura.visible = false;
          if (e.fury) e.fury.ring.visible = e.fury.fill.visible = e.fury.dome.visible = false;
          for (const sp of e.eyes) sp.visible = false;
          for (const a of e.armor) a.obj.visible = false;
          fx.death(e.obj.position.clone().add(new THREE.Vector3(0, ENEMY_HEIGHT * 0.4, 0)), !!e.last?.boss);
          e.c.fall();
        }
      }
      e.gone += dt;
      e.c.update(dt);
      if (e.mode === "dying") {
        // let the death play out on the ground, then the body sinks away
        if (e.gone > 4.5) {
          e.obj.position.y -= dt * 12;
          e.shadow.scale.multiplyScalar(1 - dt * 1.5);
        }
        if (e.gone > 5.5) remove(id, e);
      }
    }

    for (const id of entered.current)
      if (!seen.has(id)) {
        entered.current.delete(id);
        hidden.delete(id);
      }

    function remove(id: string, e: Live) {
      g!.remove(e.obj, e.shadow, e.aura, ...e.eyes, ...e.armor.map((a) => a.obj), ...(e.ice ?? []).map((a) => a.obj));
      (e.aura.material as THREE.Material).dispose();
      if (e.fury) {
        for (const m of [e.fury.ring, e.fury.fill, e.fury.dome]) {
          g!.remove(m);
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      }
      for (const sp of e.eyes) sp.material.dispose();
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


// ----------------------------------------------------------------- towers
/** Live 3D towers on the map — on by default; `?towers=2d` keeps the flat 2D towers. */
export const TOWERS_3D_PREVIEW = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("towers") !== "2d";
/** The point each tower fires from (an anchor on its turret). */
const MUZZLE: Record<string, string[]> = { IRONWOOD: ["boltTip", "eyes"], INFERNO: ["mouth"], FROSTBORN: ["orb"], STORMCALLER: ["orb", "rod0"] };

let haloTex: THREE.Texture | null = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,0.95)");
  gr.addColorStop(0.18, "rgba(255,255,255,0.55)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.14)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}
let runeTex: THREE.Texture | null = null;
/** A ring of rune marks (white, tinted per tower) for the ground circle of high-stage towers. */
function runeTexture() {
  if (runeTex) return runeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.translate(128, 128);
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 118, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(0, 0, 96, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#fff";
  for (let i = 0; i < 18; i++) {
    g.save();
    g.rotate((i / 18) * Math.PI * 2);
    g.fillRect(-1.5, -114, 3, 14);
    g.fillRect(-6, -108 + (i % 3) * 3, 12, 2.5);
    if (i % 2) g.fillRect(4, -112, 2.5, 8);
    g.restore();
  }
  runeTex = new THREE.CanvasTexture(c);
  return runeTex;
}

/** The colours and idle behaviour of a tower's effects: its skin's own, or the tower's default. */
interface TowerFx { col: string; part: string; behavior: string }
const DEFAULT_FX: Record<string, TowerFx> = {
  IRONWOOD: { col: "#ffd27a", part: "#c8ff7a", behavior: "drifting-leaves" },
  INFERNO: { col: "#ff7a2a", part: "#ffd27a", behavior: "embers" },
  FROSTBORN: { col: "#8fe6ff", part: "#bfeeff", behavior: "frost-shards" },
  STORMCALLER: { col: "#c49bff", part: "#c49bff", behavior: "sparks" },
};
function towerFx(type: string, skinId: string | null | undefined): TowerFx {
  const base = DEFAULT_FX[type] ?? { col: "#ffffff", part: "#ffffff", behavior: "light-motes" };
  const sk = skinId ? getTowerSkinDefinition(skinId) : null;
  if (!sk) return base;
  return { col: sk.paletteOverride.accent ?? base.col, part: sk.particleStyle.color ?? base.part, behavior: sk.particleStyle.behavior ?? base.behavior };
}

const towerKits = new Map<string, TowerModel>();
function towerKit(type: string, stage: number, skin: string, fused: string | null = null) {
  const key = `${type}|${stage}|${skin}|${fused ?? ""}`;
  let m = towerKits.get(key);
  if (!m) {
    m = buildTowerModel(type, stage, skin, fused);
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
    });
    towerKits.set(key, m);
  }
  return m;
}

interface LiveTower {
  key: string;
  stage: number;
  obj: THREE.Group;
  turret: THREE.Object3D | null;
  kit: TowerModel;
  yaw: number;
  recoil: number;
  built: number;
  glows: { mat: THREE.MeshStandardMaterial; base: number }[];
  flash: number;
  /** Soft light halos over its crystals / orb / furnace (the glow the baked art has). */
  halos: { sprite: THREE.Sprite; base: number; size: number }[];
  /** Frostborn: ice shards circling the orb. */
  orbit: THREE.Group | null;
  /** BOSS FURY — a crown of stars wheeling over the tower while a roar has it stunned (built on first stun). */
  stars?: THREE.Group;
  /** Stage 4+: a rune circle turning on the ground under it. */
  rune: THREE.Mesh | null;
  /** Its skin's effect colours and idle particle behaviour. */
  fxc: TowerFx;
  /** Fused tower: time to the next spark at its storm core. */
  fusionT?: number;
  type: string;
  boltT: number;
}

function Towers3D({ engine, hiddenIds, fx }: { engine: GameEngine; hiddenIds: RefObject<Set<string>>; fx: Effects }) {
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<string, LiveTower>());
  const packShots = useRef(new Map<string, { to: Vector2; skin: string; special: boolean; chain: Vector2[] }>());
  const seenShots = useRef(new Set<string>());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  /** A model anchor in the layer's world-unit space (turret anchors follow the turret). */
  const anchorAt = (e: LiveTower, key: string) => {
    const a = e.kit.anchors[key];
    const g = group.current;
    if (!a || !g?.parent) return null;
    const holder = e.kit.turretAnchors.has(key) && e.turret ? e.turret : e.obj;
    holder.updateMatrixWorld(true);
    return g.parent.worldToLocal(holder.localToWorld(new THREE.Vector3().copy(a)));
  };
  /** What each kind of tower keeps doing between shots. */
  const towerLife = (e: LiveTower, tw: TowerInstance, dt: number) => {
    const col = e.fxc.col;
    const part = e.fxc.part;
    const k = 0.6 + e.stage * 0.1;
    if (tw.type === "INFERNO") {
      // flames licking up out of the cauldron (or the furnace mouth on the furnace skins)
      const c = anchorAt(e, "cauldron");
      if (c) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 5.5 * TOWER_PRESENTATION_SCALE;
          if (Math.random() < 0.8) fx.flame(c.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), (0.4 + Math.random() * 0.35) * k, col);
        }
      } else {
        const m = anchorAt(e, "mouth");
        if (m && Math.random() < 0.7) fx.flame(m, 0.35 * k, col);
      }
      for (const sk of ["smoke1", "smoke2"]) {
        const p = anchorAt(e, sk);
        if (p && Math.random() < 0.06) fx.smokePuff(p, 0.35);
        if (p && Math.random() < 0.15) fx.glow.emit(p, { count: 1, color: part, colorEnd: col, size: 1.6, life: 0.8, speed: 4, up: 14, drag: 0.6, radius: 1 });
      }
    } else if (tw.type === "FROSTBORN") {
      const o = anchorAt(e, "orb") ?? anchorAt(e, "core");
      if (o && Math.random() < 0.25 * k) fx.mote(o, part, 9, -3);
    } else if (tw.type === "STORMCALLER") {
      e.boltT -= dt;
      if (e.boltT <= 0) {
        e.boltT = 0.35 + Math.random() * (1.4 - e.stage * 0.15);
        const rods = Object.keys(e.kit.anchors).filter((n) => n.startsWith("rod"));
        const orb = anchorAt(e, "orb");
        const r = rods.length ? anchorAt(e, rods[Math.floor(Math.random() * rods.length)]!) : null;
        if (orb && r) fx.bolts.bolt(r, orb, col, 0.12, 2.5);
      }
    } else if (tw.type === "IRONWOOD") {
      const eyes = anchorAt(e, "eyes");
      if (eyes && Math.random() < 0.12 * k) fx.mote(eyes.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, -6, (Math.random() - 0.5) * 16)), part, 6, 6);
    }
    if (e.stage >= 6 && Math.random() < 0.3) fx.mote(e.obj.position.clone().setY(4), col, 14, 22);
    skinAura(e, dt);
    // a fused tower keeps its second element alive at the core on its shoulder
    const fc = tw.fusedWith ? anchorAt(e, "fusion") : null;
    if (fc && tw.fusedWith) {
      const ft = tw.fusedWith.type;
      if (ft === "INFERNO" && Math.random() < 0.6) fx.flame(fc, 0.3, "#ff7a2a");
      else if (ft === "FROSTBORN" && Math.random() < 0.2) fx.mote(fc, "#bfeeff", 5, -4);
      else if (ft === "IRONWOOD" && Math.random() < 0.12) fx.mote(fc, "#ffd27a", 4, 8);
      else if (ft === "STORMCALLER") {
        e.fusionT = (e.fusionT ?? 0) - dt;
        if (e.fusionT <= 0) {
          e.fusionT = 0.3 + Math.random() * 0.8;
          fx.bolts.bolt(fc, fc.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10)), "#c49bff", 0.1, 1.5);
        }
      }
    }
  };
  /** Each skin's own ambient effect around the tower — embers, wisps, snow, sparks, leaves, bubbles… */
  const skinAura = (e: LiveTower, dt: number) => {
    const { col, part, behavior } = e.fxc;
    const S = TOWER_PRESENTATION_SCALE;
    const base = e.obj.position;
    const rate = (0.5 + e.stage * 0.12) * dt * 60;
    const rnd = (r: number) => (Math.random() - 0.5) * 2 * r;
    const at = (r: number, y: number) => new THREE.Vector3(base.x + rnd(r * S), base.y + y * S, base.z + rnd(r * S));
    switch (behavior) {
      case "embers":
        if (Math.random() < 0.18 * rate) fx.glow.emit(at(10, 6 + Math.random() * 14), { count: 1, color: part, colorEnd: col, size: 1.3, life: 1.2, speed: 4, up: 18, drag: 0.4, radius: 1 });
        break;
      case "solar-flares":
        if (Math.random() < 0.12 * rate) fx.glow.emit(at(8, 10 + Math.random() * 12), { count: 2, color: "#ffffff", colorEnd: part, size: 2.4, life: 0.7, speed: 10, up: 10, grow: 1.4, drag: 1, radius: 2 });
        if (Math.random() < 0.01 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), part, 4, 26 * S, 0.8);
        break;
      case "void-wisps":
      case "spirit-wisps":
        if (Math.random() < 0.12 * rate) fx.glow.emit(at(12, 4 + Math.random() * 16), { count: 1, color: part, colorEnd: "#1a0830", size: 2.6, life: 1.6, speed: 6, up: 4, grow: 1.6, drag: 0.6, radius: 2 });
        if (Math.random() < 0.04 * rate) fx.smoke.emit(at(8, 3), { count: 1, color: col, colorEnd: "#0a0410", size: 5, life: 1.4, speed: 4, up: 6, grow: 2, alpha: 0.35, radius: 3 });
        break;
      case "light-motes":
      case "starlight":
        if (Math.random() < 0.14 * rate) fx.glow.emit(at(13, 6 + Math.random() * 22), { count: 1, color: "#ffffff", colorEnd: part, size: 1.6, life: 1.4, speed: 2, up: 3, drag: 0.5, radius: 1 });
        break;
      case "prism-sparkles": {
        const cols = ["#ff8ad8", "#8ad8ff", "#fff08a", "#a8ff9a"];
        if (Math.random() < 0.16 * rate) fx.glow.emit(at(11, 6 + Math.random() * 18), { count: 1, color: "#ffffff", colorEnd: cols[Math.floor(Math.random() * 4)]!, size: 1.8, life: 0.9, speed: 3, up: 2, drag: 0.5, radius: 1 });
        break;
      }
      case "sparks":
      case "circuit-pulses":
        if (Math.random() < 0.14 * rate) fx.glow.emit(at(9, 6 + Math.random() * 18), { count: 3, color: "#ffffff", colorEnd: part, size: 0.9, life: 0.3, speed: 30, drag: 4, radius: 1 });
        if (behavior === "circuit-pulses" && Math.random() < 0.015 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), part, 3, 22 * S, 0.6);
        break;
      case "frost-shards":
        if (Math.random() < 0.16 * rate) fx.glow.emit(at(14, 26 + Math.random() * 8), { count: 1, color: "#ffffff", colorEnd: part, size: 1.2, life: 2, speed: 2, up: -8, drag: 0.3, radius: 1 });
        break;
      case "steam":
        if (Math.random() < 0.05 * rate) fx.smoke.emit(at(6, 14 + Math.random() * 8), { count: 1, color: "#e8ecf0", colorEnd: "#8a9096", size: 4, life: 1.6, speed: 3, up: 14, grow: 2.4, alpha: 0.4, radius: 2 });
        break;
      case "toxic-bubbles":
        if (Math.random() < 0.12 * rate) fx.glow.emit(at(9, 4 + Math.random() * 10), { count: 1, color: part, colorEnd: col, size: 2, life: 1.6, speed: 1, up: 8, grow: 1.3, drag: 0.2, radius: 1 });
        break;
      case "drifting-leaves":
        if (Math.random() < 0.08 * rate) fx.glow.emit(at(13, 24 + Math.random() * 8), { count: 1, color: part, colorEnd: col, size: 1.8, life: 2.4, speed: 6, up: -6, drag: 0.4, radius: 2 });
        break;
      // ---- bundle-exclusive auras ----
      case "heart-embers":
        // embers rising in pulses, like a heartbeat
        if (Math.sin(performance.now() / 160) > 0.7 && Math.random() < 0.5 * rate) fx.glow.emit(at(8, 8 + Math.random() * 10), { count: 2, color: "#ffe08a", colorEnd: part, size: 1.8, life: 1, speed: 6, up: 22, drag: 0.5, radius: 1 });
        if (Math.random() < 0.006 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), part, 3, 20 * S, 0.7);
        break;
      case "crown-snow":
        if (Math.random() < 0.2 * rate) fx.glow.emit(at(15, 30 + Math.random() * 8), { count: 1, color: "#ffffff", colorEnd: part, size: 1.3, life: 2.2, speed: 1.5, up: -7, drag: 0.3, radius: 1 });
        if (Math.random() < 0.05 * rate) fx.glow.emit(at(4, 34), { count: 1, color: "#6a9aff", colorEnd: "#ffffff", size: 2.6, life: 0.6, speed: 0, up: 0, grow: 1.6, radius: 0.5 });
        break;
      case "emerald-glints":
        if (Math.random() < 0.14 * rate) fx.glow.emit(at(12, 4 + Math.random() * 22), { count: 1, color: "#ffffff", colorEnd: part, size: 2, life: 0.5, speed: 0, up: 1, grow: 1.8, radius: 0.5 });
        if (Math.random() < 0.05 * rate) fx.glow.emit(at(12, 26), { count: 1, color: "#ffd860", colorEnd: part, size: 1.6, life: 2.4, speed: 4, up: -5, drag: 0.4, radius: 2 });
        break;
      case "blood-sparks":
        if (Math.random() < 0.2 * rate) fx.glow.emit(at(10, 8 + Math.random() * 18), { count: 3, color: "#ffffff", colorEnd: "#c0101e", size: 1, life: 0.35, speed: 34, drag: 4, radius: 1 });
        if (Math.random() < 0.012 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), "#e8101e", 3, 24 * S, 0.5);
        break;
      case "eclipse-motes":
      case "black-snow":
        if (Math.random() < 0.12 * rate) fx.smoke.emit(at(9, 4 + Math.random() * 14), { count: 1, color: "#0a080c", colorEnd: "#000000", size: 4, life: 1.6, speed: 3, up: 5, grow: 1.8, alpha: 0.5, radius: 2 });
        if (Math.random() < 0.14 * rate) fx.glow.emit(at(12, 6 + Math.random() * 20), { count: 1, color: part, colorEnd: "#3a2a08", size: 1.4, life: 1.6, speed: 2, up: behavior === "black-snow" ? -5 : 4, drag: 0.4, radius: 1 });
        break;
      case "royal-rays":
      case "royal-sparks":
        if (Math.random() < 0.16 * rate) fx.glow.emit(at(13, 6 + Math.random() * 22), { count: 1, color: "#ffffff", colorEnd: part, size: 1.8, life: 1.2, speed: 2, up: 6, drag: 0.5, radius: 1 });
        if (Math.random() < (behavior === "royal-rays" ? 0.012 : 0.02) * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), "#ffd878", 4, 30 * S, 0.9);
        break;
      // ---- ranking-prize auras ----
      case "hourglass-sand":
        // golden grains trickling down round the tower, and a slow violet ring of time
        if (Math.random() < 0.22 * rate) fx.glow.emit(at(11, 26 + Math.random() * 8), { count: 1, color: "#fff0b0", colorEnd: "#c89018", size: 1, life: 1.8, speed: 1, up: -10, drag: 0.2, radius: 1 });
        if (Math.random() < 0.01 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), part, 3, 26 * S, 1.4);
        break;
      case "nebula-drift":
        if (Math.random() < 0.06 * rate) fx.smoke.emit(at(10, 10 + Math.random() * 14), { count: 1, color: "#8a3aff", colorEnd: "#1a0830", size: 6, life: 2, speed: 2, up: 3, grow: 2, alpha: 0.3, radius: 2 });
        if (Math.random() < 0.14 * rate) fx.glow.emit(at(13, 6 + Math.random() * 22), { count: 1, color: "#ffffff", colorEnd: part, size: 1.4, life: 1.2, speed: 1, up: 1, drag: 0.5, radius: 1 });
        break;
      case "clock-glyphs": {
        // motes orbiting the tower like the hands of a clock
        const a = performance.now() / 500;
        if (Math.random() < 0.3 * rate) fx.glow.emit(new THREE.Vector3(base.x + Math.cos(a) * 13 * S, base.y + 18 * S, base.z + Math.sin(a) * 13 * S), { count: 1, color: "#ffffff", colorEnd: part, size: 1.6, life: 0.9, speed: 0, drag: 1, radius: 0.5 });
        if (Math.random() < 0.15 * rate) fx.glow.emit(new THREE.Vector3(base.x + Math.cos(-a * 0.3) * 9 * S, base.y + 12 * S, base.z + Math.sin(-a * 0.3) * 9 * S), { count: 1, color: "#fff0b0", colorEnd: "#ffd878", size: 1.2, life: 0.9, speed: 0, radius: 0.5 });
        break;
      }
      case "star-fall":
        if (Math.random() < 0.1 * rate) fx.glow.emit(at(14, 32 + Math.random() * 6), { count: 1, color: "#ffffff", colorEnd: part, size: 1.8, life: 0.8, speed: 30, dir: new THREE.Vector3(0.3, -1, 0.1).normalize(), spread: 0.05, drag: 0.2, radius: 1 });
        if (Math.random() < 0.1 * rate) fx.glow.emit(at(12, 6 + Math.random() * 20), { count: 1, color: "#ffffff", colorEnd: "#8a6aff", size: 1, life: 0.6, speed: 0, grow: 1.6, radius: 0.5 });
        break;
      case "arena-sparks":
        if (Math.random() < 0.08 * rate) fx.glow.emit(at(8, 10 + Math.random() * 14), { count: 5, color: "#ffffff", colorEnd: "#ff7a2a", size: 0.9, life: 0.45, speed: 36, gravity: 100, drag: 1, radius: 1 });
        if (Math.random() < 0.04 * rate) fx.smoke.emit(at(13, 1), { count: 1, color: "#c8a07a", colorEnd: "#7a5a3a", size: 4, life: 1.2, speed: 6, up: 2, grow: 1.8, alpha: 0.3, radius: 2 });
        break;
      case "war-embers":
        if (Math.random() < 0.24 * rate) fx.glow.emit(at(10, 6 + Math.random() * 12), { count: 1, color: "#ffd060", colorEnd: "#c8201a", size: 1.5, life: 1.3, speed: 5, up: 22, drag: 0.4, radius: 1 });
        if (Math.random() < 0.04 * rate) fx.smoke.emit(at(6, 20), { count: 1, color: "#2a1210", colorEnd: "#0a0404", size: 5, life: 1.6, speed: 3, up: 14, grow: 2.2, alpha: 0.35, radius: 2 });
        break;
      case "shield-glints":
        if (Math.random() < 0.12 * rate) fx.glow.emit(at(14, 4 + Math.random() * 16), { count: 1, color: "#ffffff", colorEnd: "#ffd090", size: 2.4, life: 0.35, speed: 0, grow: 2, radius: 0.5 });
        if (Math.random() < 0.1 * rate) fx.glow.emit(at(14, 28), { count: 1, color: "#ffffff", colorEnd: part, size: 1.1, life: 2, speed: 2, up: -7, drag: 0.3, radius: 1 });
        break;
      case "gong-pulse":
        // a slow, deep beat: rings ripple out from the foot
        if (Math.random() < 0.02 * rate) {
          fx.rings.ring(base.clone().setY(base.y + 0.6), "#ffd070", 4, 28 * S, 0.9);
          fx.rings.ring(base.clone().setY(base.y + 0.6), "#ff5a2a", 2.5, 16 * S, 0.7);
        }
        if (Math.random() < 0.1 * rate) fx.glow.emit(at(8, 8 + Math.random() * 16), { count: 2, color: "#ffffff", colorEnd: part, size: 0.9, life: 0.3, speed: 26, drag: 4, radius: 1 });
        break;
      case "banner-motes":
        if (Math.random() < 0.16 * rate) fx.glow.emit(at(13, 6 + Math.random() * 22), { count: 1, color: Math.random() < 0.5 ? "#ffffff" : "#f0d070", colorEnd: "#2a5ad8", size: 1.5, life: 1.6, speed: 3, up: 5, drag: 0.5, radius: 1 });
        if (Math.random() < 0.012 * rate) fx.rings.ring(base.clone().setY(base.y + 0.6), "#2a5ad8", 3, 26 * S, 0.9);
        break;
      case "blue-flame":
        if (Math.random() < 0.26 * rate) fx.glow.emit(at(7, 8 + Math.random() * 10), { count: 1, color: "#e8f4ff", colorEnd: "#1a3ad8", size: 2.2, life: 0.9, speed: 3, up: 20, grow: 0.6, drag: 0.4, radius: 1 });
        break;
      case "silver-mist":
        if (Math.random() < 0.07 * rate) fx.smoke.emit(at(13, 2), { count: 1, color: "#f0f4ff", colorEnd: "#a8b8d8", size: 6, life: 2.2, speed: 4, up: 1, grow: 2.2, alpha: 0.3, radius: 3 });
        if (Math.random() < 0.12 * rate) fx.glow.emit(at(12, 6 + Math.random() * 20), { count: 1, color: "#ffffff", colorEnd: part, size: 1.3, life: 1, speed: 1, grow: 1.4, radius: 0.5 });
        break;
      case "comet-trail": {
        // a little comet circling high over the tower
        const a = performance.now() / 420;
        if (Math.random() < 0.5 * rate) fx.glow.emit(new THREE.Vector3(base.x + Math.cos(a) * 12 * S, base.y + (26 + Math.sin(a * 2) * 3) * S, base.z + Math.sin(a) * 12 * S), { count: 1, color: "#ffffff", colorEnd: "#4a8aff", size: 2, life: 0.6, speed: 0, drag: 1, radius: 0.3 });
        break;
      }
      case "wind-swirl":
        if (Math.random() < 0.18 * rate) {
          const a = performance.now() / 300 + Math.random();
          fx.glow.emit(new THREE.Vector3(base.x + Math.cos(a) * 12 * S, base.y + (6 + Math.random() * 18) * S, base.z + Math.sin(a) * 12 * S), { count: 1, color: "#ffffff", colorEnd: part, size: 1.2, life: 0.8, speed: 8, up: 6, drag: 0.6, radius: 1 });
        }
        break;
    }
  };

  useFrame(({ clock }, rawDt) => {
    const g = group.current;
    const hidden = hiddenIds.current;
    if (!g || !hidden) return;
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const snap = engine.getRenderSnapshot();
    const seen = new Set<string>();
    for (const tw of snap.towers as readonly TowerInstance[]) {
      seen.add(tw.id);
      const stage = getTowerVisualStage(tw.level);
      const skin = tw.equippedSkinId ?? "base";
      const fusedType = tw.fusedWith?.type ?? null;
      const key = `${tw.type}|${stage}|${skin}|${fusedType ?? ""}`;
      let e = live.current.get(tw.id);
      if (!e || e.key !== key) {
        const upgraded = !!e && stage > e.stage;
        if (e) {
          g.remove(e.obj);
          if (e.stars) g.remove(e.stars);
        }
        const kit = towerKit(tw.type, stage, skin, fusedType);
        const obj = kit.root.clone(true);
        const turret = obj.children[kit.root.children.indexOf(kit.turret)] ?? null;
        // its own copies of the glowing materials, so its crystals can flare when it fires
        const glows: LiveTower["glows"] = [];
        const own = new Map<THREE.Material, THREE.Material>();
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const m = mesh.material as THREE.MeshStandardMaterial;
          if (!m.emissive || m.emissiveIntensity <= 0.3 || m.emissive.getHex() === 0) return;
          let c = own.get(m) as THREE.MeshStandardMaterial | undefined;
          if (!c) {
            c = m.clone();
            own.set(m, c);
            glows.push({ mat: c, base: m.emissiveIntensity });
          }
          mesh.material = c;
        });
        // light halos where the model keeps its glow (its point-light spots), brighter at higher stages
        const halos: LiveTower["halos"] = [];
        const stageK = 0.55 + stage * 0.12;
        for (const pl of kit.pointLights) {
          // drawn over the model like a bloom: the light spills over the tower's own edges
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(pl.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.9 * stageK }));
          const size = pl.dist * 0.62 * (0.85 + stage * 0.06);
          sp.scale.setScalar(size);
          sp.position.copy(pl.pos);
          sp.renderOrder = 14;
          obj.add(sp);
          halos.push({ sprite: sp, base: 0.9 * stageK, size });
        }
        const fxc = towerFx(tw.type, tw.equippedSkinId);
        let orbit: THREE.Group | null = null;
        if (tw.type === "FROSTBORN") {
          const at = kit.anchors.orb ?? kit.anchors.core ?? new THREE.Vector3(0, 20, 0);
          orbit = new THREE.Group();
          orbit.position.copy(at);
          const shardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(fxc.part).lerp(new THREE.Color("#ffffff"), 0.5), emissive: new THREE.Color(fxc.col), emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 });
          const n = 2 + stage;
          for (let i = 0; i < n; i++) {
            const sh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), shardMat);
            sh.scale.set(0.7, 1.9, 0.7);
            const a2 = (i / n) * Math.PI * 2;
            sh.position.set(Math.cos(a2) * 7.5, Math.sin(a2 * 2) * 1.2, Math.sin(a2) * 7.5);
            sh.castShadow = true;
            orbit.add(sh);
          }
          obj.add(orbit);
        }
        let rune: THREE.Mesh | null = null;
        if (stage >= 4) {
          rune = new THREE.Mesh(
            new THREE.PlaneGeometry(38, 38).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: runeTexture(), color: new THREE.Color(fxc.col), transparent: true, opacity: 0.35 + (stage - 4) * 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          rune.position.y = 0.6;
          rune.renderOrder = 3;
          obj.add(rune);
        }
        obj.scale.set(TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE, TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE * TOWER_STRETCH, TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE);
        obj.position.copy(loc({ x: tw.position.x, y: tw.position.y + SITE_BASE_OFFSET }));
        // stands upright on its foundation: the base stays flat on the stone, only the height is drawn out a
        // little so the tower keeps the tall silhouette of its art under the map's higher camera
        obj.position.y = topOf(tw);
        g.add(obj);
        e = { key, stage, obj, turret, kit, yaw: e?.yaw ?? Math.PI, recoil: 0, built: e ? 1 : 0, glows, flash: upgraded ? 1.5 : 0, halos, orbit, rune, type: tw.type, boltT: Math.random(), fxc };
        live.current.set(tw.id, e);
        hidden.add(tw.id);
        const base = obj.position.clone();
        const col = fxc.col;
        if (upgraded) {
          // a new stage: a column of its light and a ring along the ground
          fx.rings.ring(base.clone().setY(0.5), col, 6, 60, 0.7);
          fx.glow.emit(base.clone().setY(20), { count: 60, color: "#ffffff", colorEnd: col, size: 3, life: 1.2, speed: 40, up: 70, gravity: 30, radius: 8 });
        } else {
          fx.smoke.emit(base.clone().setY(2), { count: 14, color: "#7a6a58", colorEnd: "#2a241e", size: 9, life: 1, speed: 26, up: 8, grow: 2, alpha: 0.5, radius: 10 });
          fx.rings.ring(base.clone().setY(0.5), col, 4, 40, 0.5);
        }
      }
      e.obj.position.y = topOf(tw);
      // rises out of the ground when built
      if (e.built < 1) {
        e.built = Math.min(1, e.built + dt * 2.2);
        const k = 1 - Math.pow(1 - e.built, 3);
        e.obj.scale.set(TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE, TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE * TOWER_STRETCH * (0.15 + 0.85 * k), TOWER_PRESENTATION_SCALE * TOWER_3D_SIZE);
      }
      // aim: the enemy furthest along the road inside its range; idle sweep otherwise
      const range = getTowerStats(tw).range;
      let target: EnemyInstance | null = null;
      for (const en of snap.enemies as readonly EnemyInstance[])
        if (Math.hypot(en.position.x - tw.position.x, en.position.y - tw.position.y) <= range && (!target || en.distanceTraveled > target.distanceTraveled)) target = en;
      if (e.turret) {
        const want = target
          ? worldDirectionToThreeYaw({ x: target.position.x - tw.position.x, y: target.position.y - tw.position.y })
          : Math.PI + Math.sin(t * 0.35 + tw.position.x) * 0.55; // at rest it faces the viewer, glancing left and right
        const d = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));
        e.yaw += d * Math.min(1, dt * (target ? 9 : 2));
        e.turret.rotation.y = e.yaw;
        // recoil: kicked back along its aim, springs forward again
        e.recoil = Math.max(0, e.recoil - dt * 6);
        const kick = Math.sin(Math.min(1, e.recoil) * Math.PI * 0.5) * 2.2;
        e.turret.position.x = e.kit.turret.position.x - Math.sin(e.yaw) * kick;
        e.turret.position.z = e.kit.turret.position.z - Math.cos(e.yaw) * kick;
      }
      animateTowerParts(e.obj, t);
      // crystals breathe; flare on a shot or a new stage; go dark while disabled
      e.flash = Math.max(0, e.flash - dt * 3);
      const disabled = tw.disabledRemainingMs > 0;
      const breathe = 1 + Math.sin(t * 2.2 + tw.position.x * 0.1) * 0.18;
      for (const gl of e.glows) gl.mat.emissiveIntensity = disabled ? gl.base * 0.15 : gl.base * (breathe + e.flash * 1.6);
      for (const h of e.halos) {
        const k = disabled ? 0.1 : h.base * (0.85 + 0.15 * breathe + e.flash * 0.9);
        (h.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, k);
        h.sprite.scale.setScalar(h.size * (1 + e.flash * 0.35));
      }
      if (e.orbit) {
        e.orbit.rotation.y += dt * (disabled ? 0.2 : 1.1 + e.stage * 0.08);
        e.orbit.children.forEach((c, i) => (c.rotation.y += dt * (1.5 + i * 0.2)));
      }
      if (e.rune) e.rune.rotation.y -= dt * 0.35;
      if (!disabled) towerLife(e, tw, dt);
      if (disabled && Math.random() < 0.2) fx.smokePuff(e.obj.position.clone().setY(18), 0.5);
      // BOSS FURY — stunned by a roar: golden stars wheeling over the tower, and a dizzy wobble
      if ((tw.roarStunMs ?? 0) > 0) {
        const top = e.obj.position.y + 38 * TOWER_PRESENTATION_SCALE;
        for (let k = 0; k < 4; k++) {
          const a = t * 5 + (k / 4) * Math.PI * 2;
          fx.glow.emit(new THREE.Vector3(e.obj.position.x + Math.cos(a) * 10, top + Math.sin(a * 2) * 1.5, e.obj.position.z + Math.sin(a) * 10), { count: 1, color: "#ffffff", colorEnd: "#ffc020", size: 4.2, life: 0.12, speed: 0, radius: 0.1 });
        }
        if (Math.random() < 0.08) fx.rings.ring(e.obj.position.clone().setY(top - 2), "#ffd040", 2, 18, 0.5);
        e.obj.rotation.z = Math.sin(t * 14) * 0.03;
        if (!e.stars) {
          e.stars = new THREE.Group();
          for (let k = 0; k < 5; k++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color: "#ffd040", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            const a = (k / 5) * Math.PI * 2;
            sp.position.set(Math.cos(a) * 13, 0, Math.sin(a) * 13);
            sp.scale.setScalar(13);
            e.stars.add(sp);
          }
          g.add(e.stars);
        }
        e.stars.visible = true;
        e.stars.position.set(e.obj.position.x, top, e.obj.position.z);
        e.stars.rotation.y = t * 4;
        e.stars.children.forEach((c, k) => (c.position.y = Math.sin(t * 6 + k) * 1.4));
      } else {
        if (e.obj.rotation.z) e.obj.rotation.z = 0;
        if (e.stars) e.stars.visible = false;
      }
      if (tw.mana >= MANA_MAX && Math.random() < 0.25) fx.mote(e.obj.position.clone().setY(10), e.fxc.col, 10, 26);
    }
    // shots fired this frame: recoil, crystal flare and a muzzle flash at the turret
    const now = new Set<string>();
    for (const p of snap.projectiles) {
      now.add(p.id);
      if (seenShots.current.has(p.id)) continue;
      const tw = snap.towers.find((x) => Math.hypot(p.from.x - x.position.x, p.from.y - x.position.y) < 40);
      const e = tw ? live.current.get(tw.id) : undefined;
      if (!e) continue;
      e.recoil = 1;
      e.flash = Math.max(e.flash, p.isSpecial ? 1.4 : 0.7);
      const muzzleKey = (MUZZLE[tw!.type] ?? []).find((k) => e.kit.anchors[k]);
      if (muzzleKey && g.parent) {
        const a = e.kit.anchors[muzzleKey]!;
        const holder = e.kit.turretAnchors.has(muzzleKey) && e.turret ? e.turret : e.obj;
        holder.updateMatrixWorld(true);
        holder.localToWorld(tmp.copy(a));
        g.parent.worldToLocal(tmp);
        fx.muzzle(tmp.clone(), e.fxc.col, p.isSpecial);
      }
    }
    seenShots.current = now;
    // PACOTES — bundle-exclusive skins fire real 3D effects over the map: a trail while the shot flies, and their own impact where it lands
    for (const p of snap.projectiles) {
      if (!hasSkinShotFx(p.skinId)) continue;
      const t = 1 - Math.max(0, Math.min(1, p.remainingMs / p.totalMs));
      const arc = p.towerType === "INFERNO" ? Math.sin(t * Math.PI) * 26 : p.towerType === "IRONWOOD" ? Math.sin(t * Math.PI) * 16 : 0;
      const pos = loc({ x: p.from.x + (p.to.x - p.from.x) * t, y: p.from.y + (p.to.y - p.from.y) * t }, 22 * (1 - t) + 8 * t + arc);
      if (p.towerType !== "STORMCALLER") fx.packTrail(p.skinId, pos, p.isSpecial);
      const known = packShots.current.get(p.id);
      if (!known) {
        packShots.current.set(p.id, { to: { ...p.to }, skin: p.skinId, special: p.isSpecial, chain: p.chainTargets.map((c) => ({ ...c })) });
        if (p.towerType === "STORMCALLER") {
          const col = SKIN_BOLT_COLORS[p.skinId] ?? "#ffd878";
          let prev = loc(p.from, 30);
          for (const h of [p.to, ...p.chainTargets]) {
            const next = loc(h, 8);
            fx.bolts.bolt(prev, next, col, p.isSpecial ? 0.32 : 0.22, p.isSpecial ? 14 : 10);
            fx.bolts.bolt(prev, next, "#ffffff", 0.14, 5);
            prev = next;
          }
        }
      } else known.to = { ...p.to };
    }
    for (const [id, s] of packShots.current) {
      if (now.has(id)) continue;
      packShots.current.delete(id);
      fx.packImpact(s.skin, loc(s.to, 8), s.special, loc(s.to, 0.6));
      for (const c of s.chain) fx.packImpact(s.skin, loc(c, 8), false, loc(c, 0.6));
    }
    for (const [id, e] of live.current)
      if (!seen.has(id)) {
        g.remove(e.obj);
        if (e.stars) g.remove(e.stars);
        for (const gl of e.glows) gl.mat.dispose();
        for (const h of e.halos) h.sprite.material.dispose();
        live.current.delete(id);
        hidden.delete(id);
      }
  });
  useEffect(() => {
    const set = hiddenIds.current;
    const mine = live.current;
    return () => {
      for (const id of mine.keys()) set?.delete(id);
    };
  }, [hiddenIds]);
  return <group ref={group} />;
}
/** Size of the 3D towers relative to the 2D tower art (tuned so both cover the same footprint). */
const TOWER_3D_SIZE = 1;
/** Height stretch so an upright tower under the map's ~58° camera keeps the silhouette of its ~38° art. */
const TOWER_STRETCH = 1.32;
/** The painted platforms (and so the towers' bases) sit this far below a site's point, in world units. */
const SITE_BASE_OFFSET = 4.5;
/** Height of the foundation each site's tower stands on (filled in by <Foundations>). */
const siteTop = new Map<string, number>();
const topOf = (tw: TowerInstance) => siteTop.get(tw.slotId) ?? 0;


/** PRÉVIA — real 3D build sites under the 3D towers (see foundations.ts). */
function Foundations({ engine, ui }: { engine: GameEngine; ui?: React.MutableRefObject<Battlefield3DUiState> }) {
  const snap0 = engine.getRenderSnapshot();
  const [keys, setKeys] = useState({ layout: snap0.mapLayoutId, biome: snap0.biomeId });
  const built = useMemo(() => {
    const layout = getMapLayout(keys.layout);
    const biome = getBiome(keys.biome);
    siteTop.clear();
    return layout.sites.map((site, i) => {
      const f = buildFoundation(platformStyleFor(site, i) as FoundationStyle, biome, i * 7 + 3);
      f.group.position.copy(loc({ x: site.position.x, y: site.position.y + SITE_BASE_OFFSET }));
      siteTop.set(site.id, f.topY);
      return { site, f };
    });
  }, [keys]);
  useFrame(({ clock }) => {
    const n = engine.getRenderSnapshot();
    if (n.mapLayoutId !== keys.layout || n.biomeId !== keys.biome) setKeys({ layout: n.mapLayoutId, biome: n.biomeId });
    const t = clock.elapsedTime;
    const u = ui?.current;
    const choosing = !!u && (u.pendingTowerType !== null || u.placingTower !== null || n.phase === "DEPLOY");
    const taken = new Set(n.towers.map((tw) => tw.slotId));
    for (const { site, f } of built) {
      if (f.glow) f.glow.emissiveIntensity = 1.6 + Math.sin(t * 2 + site.position.x) * 0.8;
      const m = f.pick.material as THREE.MeshBasicMaterial;
      m.opacity = choosing && !taken.has(site.id) ? 0.55 + Math.sin(t * 5) * 0.3 : 0;
    }
  });
  return (
    <>
      {built.map(({ site, f }) => (
        <primitive key={site.id} object={f.group} />
      ))}
    </>
  );
}

/**
 * The map's light towers and lava pools as real 3D pieces (hybrid3d/mapProps3d.ts).
 * While mounted, the 2D map leaves its own drawings of them out.
 */
function MapProps({ engine, fx }: { engine: GameEngine; fx: Effects }) {
  const [biomeId, setBiomeId] = useState(engine.getRenderSnapshot().biomeId);
  const props = useMemo(() => {
    const biome = getBiome(biomeId);
    const out: LiveProp[] = [];
    for (const deco of getMapDecorations(biome)) {
      let p: LiveProp | null = null;
      if (deco.kind === "TORCH") p = buildTorch(deco, biome);
      else if (deco.kind === "WATER" && biome.liquidGlows) p = buildLavaPool(deco, biome);
      if (!p) continue;
      p.group.position.copy(loc(deco.position));
      out.push(p);
    }
    return out;
  }, [biomeId]);
  useEffect(() => {
    PROPS_3D.active = true;
    return () => {
      PROPS_3D.active = false;
    };
  }, []);
  const same = (v: THREE.Vector3) => v;
  useFrame(({ clock }, dt) => {
    const id = engine.getRenderSnapshot().biomeId;
    if (id !== biomeId) setBiomeId(id);
    const t = clock.elapsedTime;
    for (const p of props) p.update(t, Math.min(dt, 0.1), fx, same);
  });
  return (
    <>
      {props.map((p, i) => (
        <primitive key={`${biomeId}-${i}`} object={p.group} />
      ))}
    </>
  );
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

/** Soft image-based light so painted/PBR surfaces read from every side, like the baked art. */
function EnvLight({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

function Scene({ engine, hiddenIds, hiddenTowerIds, ui }: { engine: GameEngine; hiddenIds: RefObject<Set<string>>; hiddenTowerIds?: RefObject<Set<string>>; ui?: React.MutableRefObject<Battlefield3DUiState> }) {
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
      {TOWERS_3D_PREVIEW && <Foundations engine={engine} ui={ui} />}
      {TOWERS_3D_PREVIEW && hiddenTowerIds && <Towers3D engine={engine} hiddenIds={hiddenTowerIds} fx={fx} />}
      {TOWERS_3D_PREVIEW && <EnvLight intensity={0.55} />}
      <MapProps engine={engine} fx={fx} />
      <Castle key={lid} engine={engine} fortress={fortress} facing={anchorInfo.facingDir} fx={fx} state={castle} />
      <City3D key={`city-${lid}`} engine={engine} fx={fx} />
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

export function HybridOverlay({ engine, hiddenIds, hiddenTowerIds, ui }: { engine: GameEngine; hiddenIds: RefObject<Set<string>>; hiddenTowerIds?: RefObject<Set<string>>; ui?: React.MutableRefObject<Battlefield3DUiState> }) {
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
        <Scene engine={engine} hiddenIds={hiddenIds} hiddenTowerIds={hiddenTowerIds} ui={ui} />
      </Canvas>
    </div>
  );
}
