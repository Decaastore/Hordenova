import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { animateTowerParts, buildTowerModel, type TowerModel } from "@/battlefield3d/models/towerModel";
import { getTowerVisualStage, type TowerType } from "@/config/towerStats";
import { buildCastleModel } from "@/battlefield3d/models/castleModel";

/**
 * TOWER PORTRAIT IN 3D — the tower exactly as the battlefield draws it (the
 * same model, stage and skin: battlefield3d/models/towerModel.ts), turning
 * slowly on a plinth of light, for the Wiki and the skin previews.
 *
 * Every portrait on a page shares ONE WebGL renderer (browsers allow only a
 * handful of contexts): each frame the renderer draws each visible portrait
 * in turn and copies the picture into that portrait's own 2D canvas.
 */

interface Portrait {
  canvas: HTMLCanvasElement;
  key: string;
  build: () => THREE.Object3D;
  width: number;
  height: number;
  visible: boolean;
  spin: boolean;
  angle: number;
  /** Drawn at least once (a still portrait is never drawn again). */
  drawn: boolean;
  /** Has spinning or moving parts, so it keeps being redrawn. */
  moving: boolean;
}

/**
 * LIGHT ON ANY PC (owner's call, Nov 2026: "abrir em qualquer pc tanto forte
 * como fraco"). The portraits used to redraw every one of them on every
 * frame (~60×/s each) and build every model in the very first frame, which
 * froze weak laptops for seconds. Now:
 *  - a model is built (and its shaders compiled) at most one per frame;
 *  - moving portraits are redrawn at most ~30×/s, and only a few per frame;
 *  - a portrait that stands still is drawn once;
 *  - on a weak machine (few cores / little memory, or frames found to be
 *    slow) everything is drawn once, standing still, at 1× resolution.
 */
const LOW_END =
  typeof navigator !== "undefined" &&
  ((navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
const REDUCED_MOTION = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let still = LOW_END || REDUCED_MOTION;
const FRAME_MS = 33;
const MAX_DRAWS_PER_FRAME = 4;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const models = new Map<string, { model: { root: THREE.Object3D }; size: THREE.Vector3; center: THREE.Vector3; moving: boolean; ready: boolean }>();
const portraits = new Set<Portrait>();
let raf = 0;
let last = 0;
let lastDraw = 0;
let cursor = 0;
let slowFrames = 0;

function setup(): boolean {
  if (renderer) return true;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_END, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  } catch {
    return false;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a2018, 0.9));
  const key = new THREE.DirectionalLight(0xffe8c8, 2.4);
  key.position.set(60, 120, 80);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 1.1);
  rim.position.set(-80, 60, -90);
  scene.add(rim);
  camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  return true;
}

function hasMovingParts(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (o.userData?.anim) found = true;
  });
  return found;
}

function draw(p: Portrait, m: NonNullable<ReturnType<typeof models.get>>, now: number, dt: number) {
  if (!renderer || !scene || !camera) return;
  const ctx = p.canvas.getContext("2d");
  if (!ctx) return;
  const { model, size, center } = m;
  if (p.spin && !still) p.angle += dt * (p.key.startsWith("castle") ? 0.18 : 0.5);
  model.root.rotation.y = p.angle;
  if (!still) animateTowerParts(model.root, now / 1000);
  const dpr = still ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.round(p.width * dpr), h = Math.round(p.height * dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // frame the whole tower, seen a little from above like on the battlefield
  const fit = Math.max(size.y, (Math.max(size.x, size.z) * 1.15 * h) / w);
  const dist = (fit / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.32;
  camera.position.set(0, center.y + dist * 0.42, dist);
  camera.lookAt(0, center.y * 0.92, 0);
  camera.updateProjectionMatrix();
  scene.add(model.root);
  renderer.render(scene, camera);
  scene.remove(model.root);
  if (p.canvas.width !== w || p.canvas.height !== h) {
    p.canvas.width = w;
    p.canvas.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renderer.domElement, 0, 0, w, h);
  p.drawn = true;
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!renderer || !scene || !camera) return;
  if (now - lastDraw < FRAME_MS) return;
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  lastDraw = now;
  const t0 = performance.now();
  let built = false;
  let draws = 0;
  const list = [...portraits];
  for (let i = 0; i < list.length && draws < MAX_DRAWS_PER_FRAME; i++) {
    const p = list[(cursor + i) % list.length]!;
    if (!p.visible) continue;
    let m = models.get(p.key);
    if (!m) {
      if (built) continue; // one new model per frame, so nothing freezes
      const model = { root: p.build() };
      const box = new THREE.Box3().setFromObject(model.root);
      const entry = { model, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()), moving: hasMovingParts(model.root), ready: false };
      models.set(p.key, entry);
      built = true;
      // compile its shaders in the background where the browser can (no freeze on the first draw)
      renderer
        .compileAsync(model.root, camera, scene)
        .catch(() => undefined)
        .then(() => {
          entry.ready = true;
          wake();
        });
      continue;
    }
    if (!m.ready) continue;
    p.moving = !still && (p.spin || m.moving);
    if (p.drawn && !p.moving) continue;
    draw(p, m, now, dt);
    draws++;
  }
  cursor = list.length ? (cursor + draws) % list.length : 0;
  // a machine that can't keep up drops to still portraits
  if (!still && !built) {
    slowFrames = performance.now() - t0 > 24 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 8) still = true;
  }
  const busy = list.some((p) => p.visible && (!p.drawn || p.moving) && models.get(p.key)?.ready !== false);
  if (portraits.size === 0 || !busy) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

function wake() {
  if (!raf) raf = requestAnimationFrame(frame);
}

interface Tower3DPortraitProps {
  type: TowerType;
  level: number;
  skinId?: string | null;
  width: number;
  height: number;
  /** Turn slowly (default) or stand still facing the viewer. */
  spin?: boolean;
}

export function Tower3DPortrait({ type, level, skinId = null, width, height, spin = true }: Tower3DPortraitProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !setup()) return;
    const stage = getTowerVisualStage(level);
    const skin = skinId ?? "base";
    return mountPortrait(canvas, `tower|${type}|${stage}|${skin}`, () => (buildTowerModel(type, stage, skin) as TowerModel).root, width, height, spin, -0.5);
  }, [type, level, skinId, width, height, spin]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} aria-hidden="true" />;
}

function mountPortrait(canvas: HTMLCanvasElement, key: string, build: () => THREE.Object3D, width: number, height: number, spin: boolean, angle: number): () => void {
  const p: Portrait = { canvas, key, build, width, height, visible: true, spin, angle, drawn: false, moving: true };
  portraits.add(p);
  const observer =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => {
          p.visible = e?.isIntersecting ?? true;
          if (p.visible) wake();
        })
      : null;
  observer?.observe(canvas);
  wake();
  return () => {
    portraits.delete(p);
    observer?.disconnect();
  };
}

/**
 * The castle in 3D — the same procedural model the battlefield builds
 * (battlefield3d/models/castleModel.ts), intact, for the mode cards.
 * `dressing` is a biome dressing id (e.g. "FROZEN_TUNDRA"); `skin` a castle skin id.
 */
export function Castle3DPortrait({ dressing, skin = "", width, height, spin = true }: { dressing: string; skin?: string; width: number; height: number; spin?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !setup()) return;
    return mountPortrait(canvas, `castle|${dressing}|${skin}`, () => buildCastleModel(dressing, 1, skin).root, width, height, spin, -0.35);
  }, [dressing, skin, width, height, spin]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} aria-hidden="true" />;
}
