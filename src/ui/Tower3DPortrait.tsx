import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildTowerModel, type TowerModel } from "@/battlefield3d/models/towerModel";
import { getTowerVisualStage, type TowerType } from "@/config/towerStats";

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
  type: TowerType;
  stage: number;
  skin: string;
  width: number;
  height: number;
  visible: boolean;
  spin: boolean;
  angle: number;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const models = new Map<string, { model: TowerModel; size: THREE.Vector3; center: THREE.Vector3 }>();
const portraits = new Set<Portrait>();
let raf = 0;
let last = 0;

function setup(): boolean {
  if (renderer) return true;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
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

function modelFor(p: Portrait) {
  let m = models.get(p.key);
  if (!m) {
    const model = buildTowerModel(p.type, p.stage, p.skin);
    const box = new THREE.Box3().setFromObject(model.root);
    m = { model, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
    models.set(p.key, m);
  }
  return m;
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  if (!renderer || !scene || !camera) return;
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const p of portraits) {
    if (!p.visible) continue;
    const ctx = p.canvas.getContext("2d");
    if (!ctx) continue;
    const { model, size, center } = modelFor(p);
    if (p.spin) p.angle += dt * 0.5;
    model.root.rotation.y = p.angle;
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
  }
  if (portraits.size === 0) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
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
    const p: Portrait = { canvas, key: `${type}|${stage}|${skin}`, type, stage, skin, width, height, visible: true, spin, angle: -0.5 };
    portraits.add(p);
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (p.visible = e?.isIntersecting ?? true)) : null;
    observer?.observe(canvas);
    if (!raf) raf = requestAnimationFrame(frame);
    return () => {
      portraits.delete(p);
      observer?.disconnect();
    };
  }, [type, level, skinId, width, height, spin]);
  return <canvas ref={ref} style={{ width, height, display: "block" }} aria-hidden="true" />;
}
