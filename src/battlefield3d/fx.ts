import * as THREE from "three";

/**
 * CAMPO DE BATALHA 3D — combat and ambience effects drawn in the 3D scene:
 * one pooled particle cloud (fire, sparks, ice, smoke, embers, magic motes),
 * jagged lightning bolts and expanding ground rings. Everything lives in a
 * fixed-size pool updated on the CPU, so a busy wave never allocates and the
 * whole thing is three draw calls.
 */

const MAX_PARTICLES = 4000;
const MAX_BOLT_SEGMENTS = 600;
const MAX_RINGS = 48;
/** Effects are authored a little large; this brings them to the size of the units on the board. */
const FX_SCALE = 0.65;

export interface EmitOptions {
  count: number;
  color: THREE.ColorRepresentation;
  /** Second colour each particle fades towards over its life. */
  colorEnd?: THREE.ColorRepresentation;
  /** Start size in world units (shrinks or grows by `grow`). */
  size: number;
  sizeJitter?: number;
  /** Multiplier applied to size over life (1 = constant, >1 = billows like smoke). */
  grow?: number;
  life: number;
  lifeJitter?: number;
  speed: number;
  /** Extra upward bias added to every velocity. */
  up?: number;
  /** Spread: 1 = full sphere, 0 = straight along `dir`. */
  spread?: number;
  dir?: THREE.Vector3;
  gravity?: number;
  drag?: number;
  /** Random offset around the origin. */
  radius?: number;
  /** Additive glow (fire, sparks, magic) vs. normal blending (smoke, debris). */
  additive?: boolean;
  alpha?: number;
}

function softDotTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  uniform float uOrtho;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uOrtho > 0.5 ? aSize * uScale : aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.004) discard;
  }
`;

class ParticlePool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private siz: Float32Array;
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private age = new Float32Array(MAX_PARTICLES);
  private life = new Float32Array(MAX_PARTICLES);
  private size0 = new Float32Array(MAX_PARTICLES);
  private grow = new Float32Array(MAX_PARTICLES);
  private grav = new Float32Array(MAX_PARTICLES);
  private drag = new Float32Array(MAX_PARTICLES);
  private c0 = new Float32Array(MAX_PARTICLES * 3);
  private c1 = new Float32Array(MAX_PARTICLES * 3);
  private a0 = new Float32Array(MAX_PARTICLES);
  private next = 0;
  readonly uniforms: { uScale: { value: number }; uOrtho: { value: number }; uMap: { value: THREE.Texture } };

  constructor(additive: boolean, map: THREE.Texture) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 4);
    this.siz = new Float32Array(MAX_PARTICLES);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.uniforms = { uScale: { value: 600 }, uOrtho: { value: 0 }, uMap: { value: map } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 12 : 11;
    this.age.fill(1);
    this.life.fill(0);
  }

  emit(origin: THREE.Vector3, opts: EmitOptions) {
    const k = FX_SCALE;
    const o: EmitOptions = { ...opts, size: opts.size * k, speed: opts.speed * k, radius: (opts.radius ?? 0) * k, up: (opts.up ?? 0) * k, gravity: (opts.gravity ?? 0) * k };
    const c0 = new THREE.Color(o.color);
    const c1 = new THREE.Color(o.colorEnd ?? o.color);
    const spread = o.spread ?? 1;
    const dir = o.dir ?? new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    for (let n = 0; n < o.count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const r = (o.radius ?? 0) * Math.cbrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      this.pos[i * 3] = origin.x + r * Math.sin(ph) * Math.cos(th);
      this.pos[i * 3 + 1] = origin.y + r * Math.cos(ph) * 0.6;
      this.pos[i * 3 + 2] = origin.z + r * Math.sin(ph) * Math.sin(th);
      // random direction blended towards `dir`
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(spread);
      v.addScaledVector(dir, 1 - spread).normalize();
      const sp = o.speed * (0.35 + Math.random() * 0.9);
      this.vel[i * 3] = v.x * sp;
      this.vel[i * 3 + 1] = v.y * sp + (o.up ?? 0) * (0.6 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = v.z * sp;
      this.age[i] = 0;
      this.life[i] = o.life * (1 + (Math.random() * 2 - 1) * (o.lifeJitter ?? 0.3));
      this.size0[i] = o.size * (1 + (Math.random() * 2 - 1) * (o.sizeJitter ?? 0.35));
      this.grow[i] = o.grow ?? 0.3;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      const k = Math.random() * 0.25;
      this.c0[i * 3] = c0.r * (1 - k) + c1.r * k;
      this.c0[i * 3 + 1] = c0.g * (1 - k) + c1.g * k;
      this.c0[i * 3 + 2] = c0.b * (1 - k) + c1.b * k;
      this.c1[i * 3] = c1.r;
      this.c1[i * 3 + 1] = c1.g;
      this.c1[i * 3 + 2] = c1.b;
      this.a0[i] = o.alpha ?? 1;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.age[i]! >= this.life[i]!) {
        this.siz[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.age[i]! += dt;
      const t = Math.min(1, this.age[i]! / this.life[i]!);
      const d = Math.exp(-this.drag[i]! * dt);
      this.vel[i * 3]! *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * d - this.grav[i]! * dt;
      this.vel[i * 3 + 2]! *= d;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.siz[i] = this.size0[i]! * (1 + (this.grow[i]! - 1) * t);
      this.col[i * 4] = this.c0[i * 3]! + (this.c1[i * 3]! - this.c0[i * 3]!) * t;
      this.col[i * 4 + 1] = this.c0[i * 3 + 1]! + (this.c1[i * 3 + 1]! - this.c0[i * 3 + 1]!) * t;
      this.col[i * 4 + 2] = this.c0[i * 3 + 2]! + (this.c1[i * 3 + 2]! - this.c0[i * 3 + 2]!) * t;
      // quick fade-in, long fade-out
      this.col[i * 4 + 3] = this.a0[i]! * Math.min(1, t * 8) * (1 - t) * (1 - t * 0.3);
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.aColor!.needsUpdate = true;
    g.attributes.aSize!.needsUpdate = true;
  }
}

class BoltPool {
  readonly lines: THREE.LineSegments;
  private pos = new Float32Array(MAX_BOLT_SEGMENTS * 6);
  private col = new Float32Array(MAX_BOLT_SEGMENTS * 6);
  private age = new Float32Array(MAX_BOLT_SEGMENTS);
  private life = new Float32Array(MAX_BOLT_SEGMENTS);
  private base = new Float32Array(MAX_BOLT_SEGMENTS * 3);
  private next = 0;
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.lines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 13;
    this.age.fill(1);
  }
  /** A jagged bolt from a to b, with a couple of forks. Colour is boosted well past 1 so bloom catches it. */
  bolt(a: THREE.Vector3, b: THREE.Vector3, color: THREE.ColorRepresentation, life = 0.16, jagIn = 9) {
    const jag = jagIn * FX_SCALE;
    const c = new THREE.Color(color).multiplyScalar(4);
    const steps = Math.max(4, Math.round(a.distanceTo(b) / 14));
    let prev = a.clone();
    const dir = b.clone().sub(a);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const p = a.clone().lerp(b, t);
      if (s < steps) p.addScaledVector(side, (Math.random() * 2 - 1) * jag).add(new THREE.Vector3(0, (Math.random() * 2 - 1) * jag * 0.6, 0));
      this.segment(prev, p, c, life);
      if (s < steps && Math.random() < 0.22) {
        const f = p.clone().addScaledVector(side, (Math.random() * 2 - 1) * jag * 2.5).add(new THREE.Vector3(0, -Math.random() * jag, 0));
        this.segment(p, f, c.clone().multiplyScalar(0.6), life * 0.8);
      }
      prev = p;
    }
  }
  private segment(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Color, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_BOLT_SEGMENTS;
    this.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    this.base.set([c.r, c.g, c.b], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
  }
  update(dt: number) {
    for (let i = 0; i < MAX_BOLT_SEGMENTS; i++) {
      this.age[i]! += dt;
      const k = this.age[i]! < this.life[i]! ? (1 - this.age[i]! / this.life[i]!) * (0.7 + Math.random() * 0.3) : 0;
      for (let v = 0; v < 2; v++) {
        this.col[i * 6 + v * 3] = this.base[i * 3]! * k;
        this.col[i * 6 + v * 3 + 1] = this.base[i * 3 + 1]! * k;
        this.col[i * 6 + v * 3 + 2] = this.base[i * 3 + 2]! * k;
      }
    }
    this.lines.geometry.attributes.color!.needsUpdate = true;
    this.lines.geometry.attributes.position!.needsUpdate = true;
  }
}

class RingPool {
  readonly group = new THREE.Group();
  private rings: { mesh: THREE.Mesh; age: number; life: number; r0: number; r1: number }[] = [];
  private next = 0;
  constructor() {
    const geo = new THREE.RingGeometry(0.82, 1, 48, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
      );
      mesh.visible = false;
      mesh.renderOrder = 10;
      this.group.add(mesh);
      this.rings.push({ mesh, age: 1, life: 0, r0: 1, r1: 1 });
    }
  }
  ring(at: THREE.Vector3, color: THREE.ColorRepresentation, r0: number, r1: number, life = 0.45) {
    const r = this.rings[this.next]!;
    this.next = (this.next + 1) % MAX_RINGS;
    r.mesh.position.copy(at);
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2.5);
    r.age = 0;
    r.life = life;
    r.r0 = r0 * FX_SCALE;
    r.r1 = r1 * FX_SCALE;
    r.mesh.visible = true;
  }
  update(dt: number) {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - (1 - t) * (1 - t);
      r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
    }
  }
}

/** The colour a skin's lightning is drawn in (Stormcaller skins with their own bolt). */
export const SKIN_BOLT_COLORS: Record<string, string> = {
  STORMCALLER_PACK_CRIMSON_STORM: "#ff1a2a",
  STORMCALLER_PACK_SOVEREIGN: "#ffd878",
  STORMCALLER_ETERNAL_RANK: "#c08aff",
  STORMCALLER_ARENA_RANK: "#ff7a2a",
  STORMCALLER_SEASON_RANK: "#8ab8ff",
};
/** Skins whose shots get their own 3D trail and impact (bundle and ranking skins). */
export function hasSkinShotFx(skinId: string | null | undefined): skinId is string {
  return !!skinId && (skinId.includes("_PACK_") || skinId.endsWith("_RANK"));
}

export class Effects {
  readonly root = new THREE.Group();
  readonly glow: ParticlePool;
  readonly smoke: ParticlePool;
  readonly bolts = new BoltPool();
  readonly rings = new RingPool();

  constructor() {
    const tex = softDotTexture();
    this.glow = new ParticlePool(true, tex);
    this.smoke = new ParticlePool(false, tex);
    this.root.add(this.smoke.points, this.glow.points, this.bolts.lines, this.rings.group);
  }

  /** Keeps point sprites the same world size whatever the canvas height. */
  setViewportHeight(px: number, fovDeg: number) {
    const s = px / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.glow.uniforms.uScale.value = s;
    this.smoke.uniforms.uScale.value = s;
  }

  /** For an orthographic camera: how many drawing-buffer pixels one world unit covers. */
  setOrthoScale(pxPerUnit: number) {
    for (const p of [this.glow, this.smoke]) {
      p.uniforms.uOrtho.value = 1;
      p.uniforms.uScale.value = pxPerUnit;
    }
  }

  update(dt: number) {
    const d = Math.min(dt, 0.05);
    this.glow.update(d);
    this.smoke.update(d);
    this.bolts.update(d);
    this.rings.update(d);
  }

  // ------------------------------------------------------------ recipes
  muzzle(at: THREE.Vector3, color: THREE.ColorRepresentation, big = false) {
    this.glow.emit(at, { count: big ? 26 : 10, color: "#ffffff", colorEnd: color, size: big ? 9 : 5, life: 0.18, speed: big ? 60 : 35, grow: 0.4, drag: 6 });
  }

  impact(type: string, at: THREE.Vector3, special: boolean, ground: THREE.Vector3) {
    const k = special ? 2.2 : 1;
    switch (type) {
      case "INFERNO":
        this.glow.emit(at, { count: Math.round(34 * k), color: "#fff1b0", colorEnd: "#ff3a0a", size: 11 * k, life: 0.55, speed: 55 * k, up: 18, grow: 1.6, drag: 3.5, radius: 3 });
        this.glow.emit(at, { count: Math.round(20 * k), color: "#ffb347", colorEnd: "#ff2a00", size: 2.6, life: 1.1, speed: 90 * k, up: 40, gravity: 120, drag: 1, sizeJitter: 0.5 });
        this.smoke.emit(at.clone().add(new THREE.Vector3(0, 6, 0)), { count: Math.round(10 * k), color: "#3a2a22", colorEnd: "#15110f", size: 14 * k, life: 1.4, speed: 14, up: 22, grow: 2.4, alpha: 0.55, drag: 1.5, radius: 4 });
        this.rings.ring(ground, "#ff6a1a", 4, 34 * k, 0.5);
        break;
      case "FROSTBORN":
        this.glow.emit(at, { count: Math.round(26 * k), color: "#ffffff", colorEnd: "#4fc8ff", size: 6 * k, life: 0.6, speed: 70 * k, up: 10, gravity: 60, drag: 2.5, sizeJitter: 0.6 });
        this.glow.emit(at, { count: Math.round(14 * k), color: "#dff6ff", colorEnd: "#6ad8ff", size: 2.2, life: 1.2, speed: 25, up: 6, gravity: -6, drag: 1.2, radius: 10 * k });
        this.rings.ring(ground, "#7fe2ff", 4, 30 * k, 0.6);
        break;
      case "STORMCALLER":
        this.glow.emit(at, { count: Math.round(22 * k), color: "#ffffff", colorEnd: "#9a6bff", size: 3 * k, life: 0.35, speed: 110 * k, gravity: 90, drag: 2, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 6, color: "#e8dcff", colorEnd: "#7a4dff", size: 18 * k, life: 0.18, speed: 0, grow: 1.8 });
        break;
      default:
        this.glow.emit(at, { count: Math.round(16 * k), color: "#fff2c8", colorEnd: "#ff9a3a", size: 2.4 * k, life: 0.45, speed: 95 * k, gravity: 160, drag: 1.6, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 4, color: "#fff6dc", colorEnd: "#ffb050", size: 10 * k, life: 0.14, speed: 0, grow: 1.6 });
        this.smoke.emit(at, { count: Math.round(5 * k), color: "#5a4a3a", colorEnd: "#2a221c", size: 8, life: 0.8, speed: 18, up: 10, grow: 2, alpha: 0.45 });
        if (special) this.rings.ring(ground, "#ffd27a", 4, 40, 0.5);
    }
  }

  trail(type: string, at: THREE.Vector3, special: boolean) {
    const k = special ? 1.8 : 1;
    if (type === "INFERNO") {
      this.glow.emit(at, { count: 2, color: "#ffd27a", colorEnd: "#ff2a00", size: 7 * k, life: 0.35, speed: 6, grow: 0.3, radius: 1.5 });
      this.smoke.emit(at, { count: 1, color: "#2a2220", colorEnd: "#141010", size: 7 * k, life: 0.7, speed: 4, up: 10, grow: 2.2, alpha: 0.35 });
    } else if (type === "FROSTBORN") this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#5fd0ff", size: 4 * k, life: 0.3, speed: 4, grow: 0.2, radius: 1.5 });
    else if (type === "STORMCALLER") this.glow.emit(at, { count: 1, color: "#ffffff", colorEnd: "#8a5cff", size: 4 * k, life: 0.2, speed: 10, grow: 0.2 });
    else this.glow.emit(at, { count: 1, color: "#fff0c8", colorEnd: "#c88a3a", size: 3 * k, life: 0.18, speed: 2, grow: 0.2 });
  }

  /**
   * PACOTES — the bundle-exclusive skins' own shots (config/towerSkins.ts
   * PACK_TOWER_SKINS): real fire, smoke, sparks under gravity, frost mist,
   * ground shockwaves and forked lightning, bigger than any normal shot so
   * they're noticed. Returns false for any other skin (caller falls back).
   */
  packTrail(skinId: string | null | undefined, at: THREE.Vector3, special: boolean): boolean {
    const k = special ? 1.7 : 1;
    switch (skinId) {
      case "INFERNO_PACK_EMBERHEART":
        this.glow.emit(at, { count: 3, color: "#fff1b0", colorEnd: "#ff3a0a", size: 9 * k, life: 0.4, speed: 6, grow: 0.3, radius: 1.5 });
        this.glow.emit(at, { count: 2, color: "#ffd27a", colorEnd: "#ff2a00", size: 1.6, life: 0.9, speed: 22, up: 10, gravity: 70, drag: 1, radius: 1 });
        this.smoke.emit(at, { count: 1, color: "#2a1814", colorEnd: "#100806", size: 8 * k, life: 0.9, speed: 4, up: 12, grow: 2.4, alpha: 0.4 });
        return true;
      case "FROSTBORN_PACK_WINTER_CROWN":
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#3a6aff", size: 5 * k, life: 0.35, speed: 5, grow: 0.25, radius: 1.5 });
        this.glow.emit(at, { count: 2, color: "#e8f4ff", colorEnd: "#8ab0ff", size: 1.3, life: 1.1, speed: 10, gravity: 30, drag: 1.2, radius: 2 });
        this.smoke.emit(at, { count: 1, color: "#e8f0ff", colorEnd: "#a8c0e8", size: 7 * k, life: 0.8, speed: 3, up: 2, grow: 2.2, alpha: 0.28 });
        return true;
      case "IRONWOOD_PACK_EMERALD_SENTINEL":
        this.glow.emit(at, { count: 2, color: "#d8ffe8", colorEnd: "#10c070", size: 5 * k, life: 0.3, speed: 3, grow: 0.3, radius: 1 });
        this.glow.emit(at, { count: 1, color: "#fff0a0", colorEnd: "#e8a020", size: 1.4, life: 0.8, speed: 12, gravity: 40, drag: 1, radius: 1.5 });
        return true;
      case "STORMCALLER_PACK_CRIMSON_STORM":
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#e8101e", size: 4 * k, life: 0.22, speed: 14, grow: 0.3 });
        return true;
      case "IRONWOOD_PACK_ECLIPSE":
      case "FROSTBORN_PACK_ECLIPSE":
        this.smoke.emit(at, { count: 2, color: "#06050a", colorEnd: "#000000", size: 7 * k, life: 0.7, speed: 3, up: 3, grow: 1.8, alpha: 0.6, radius: 1 });
        this.glow.emit(at, { count: 2, color: "#fff0b0", colorEnd: "#c89018", size: 2 * k, life: 0.6, speed: 9, drag: 1.4, radius: 2 });
        if (skinId === "FROSTBORN_PACK_ECLIPSE") this.glow.emit(at, { count: 1, color: "#ffffff", colorEnd: "#8ab0d8", size: 1.4, life: 0.9, speed: 8, gravity: 30, radius: 1.5 });
        return true;
      // ---- RANKING prizes ----
      case "IRONWOOD_ETERNAL_RANK":
        this.glow.emit(at, { count: 3, color: "#fff0b0", colorEnd: "#c89018", size: 1.4, life: 1, speed: 6, gravity: 40, drag: 1, radius: 1.5 });
        this.glow.emit(at, { count: 1, color: "#e8d0ff", colorEnd: "#6a2ae8", size: 7 * k, life: 0.35, speed: 3, grow: 0.3 });
        return true;
      case "INFERNO_ETERNAL_RANK":
        this.smoke.emit(at, { count: 1, color: "#8a3aff", colorEnd: "#1a0830", size: 9 * k, life: 0.9, speed: 3, up: 4, grow: 2, alpha: 0.35 });
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#ff8af0", size: 1.6, life: 0.7, speed: 12, drag: 1.4, radius: 2 });
        this.glow.emit(at, { count: 1, color: "#ffd0f8", colorEnd: "#8a3aff", size: 9 * k, life: 0.3, speed: 2, grow: 0.3 });
        return true;
      case "FROSTBORN_ETERNAL_RANK":
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#a8d8ff", size: 5 * k, life: 0.4, speed: 3, grow: 0.3 });
        this.glow.emit(at, { count: 1, color: "#fff0b0", colorEnd: "#ffd878", size: 1.3, life: 1.2, speed: 4, drag: 2, radius: 3 });
        return true;
      case "STORMCALLER_ETERNAL_RANK":
        return true;
      case "IRONWOOD_ARENA_RANK":
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#ff7a2a", size: 1.4, life: 0.45, speed: 40, gravity: 120, drag: 1, radius: 1 });
        this.glow.emit(at, { count: 1, color: "#ffe0b0", colorEnd: "#e0a050", size: 5 * k, life: 0.25, speed: 2, grow: 0.3 });
        return true;
      case "INFERNO_ARENA_RANK":
        this.glow.emit(at, { count: 3, color: "#fff1b0", colorEnd: "#c8201a", size: 9 * k, life: 0.4, speed: 6, up: 8, grow: 0.4, radius: 1.5 });
        this.smoke.emit(at, { count: 1, color: "#3a1410", colorEnd: "#0e0604", size: 9 * k, life: 1, speed: 4, up: 14, grow: 2.4, alpha: 0.45 });
        return true;
      case "FROSTBORN_ARENA_RANK":
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#d8e8ff", size: 4 * k, life: 0.35, speed: 4, grow: 0.25 });
        this.glow.emit(at, { count: 1, color: "#ffd090", colorEnd: "#d8963a", size: 1.5, life: 0.8, speed: 18, gravity: 60, drag: 1, radius: 1.5 });
        return true;
      case "STORMCALLER_ARENA_RANK":
        return true;
      case "IRONWOOD_SEASON_RANK":
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#2a5ad8", size: 5 * k, life: 0.35, speed: 3, grow: 0.3 });
        this.glow.emit(at, { count: 1, color: "#fff0b0", colorEnd: "#f0d070", size: 1.3, life: 0.9, speed: 10, gravity: 30, drag: 1, radius: 1.5 });
        return true;
      case "INFERNO_SEASON_RANK":
        this.glow.emit(at, { count: 3, color: "#e8f4ff", colorEnd: "#1a4ad8", size: 9 * k, life: 0.4, speed: 6, up: 6, grow: 0.35, radius: 1.5 });
        this.glow.emit(at, { count: 1, color: "#fff6d0", colorEnd: "#ffd880", size: 1.4, life: 0.8, speed: 14, up: 8, drag: 1, radius: 1.5 });
        return true;
      case "FROSTBORN_SEASON_RANK":
        this.smoke.emit(at, { count: 1, color: "#f0f4ff", colorEnd: "#a8c0e8", size: 8 * k, life: 0.9, speed: 3, up: 2, grow: 2, alpha: 0.3 });
        this.glow.emit(at, { count: 2, color: "#ffffff", colorEnd: "#7aa8ff", size: 1.4, life: 0.9, speed: 9, drag: 1.4, radius: 2 });
        return true;
      case "STORMCALLER_SEASON_RANK":
        return true;
      case "INFERNO_PACK_SOVEREIGN":
      case "STORMCALLER_PACK_SOVEREIGN":
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#ffc848", size: 7 * k, life: 0.35, speed: 5, grow: 0.3, radius: 1.5 });
        this.glow.emit(at, { count: 2, color: "#fff6d0", colorEnd: "#ff4a5a", size: 1.4, life: 1, speed: 14, up: 6, drag: 1, radius: 2 });
        return true;
    }
    return false;
  }

  packImpact(skinId: string | null | undefined, at: THREE.Vector3, special: boolean, ground: THREE.Vector3): boolean {
    const k = special ? 2 : 1.25;
    const up = new THREE.Vector3(0, 1, 0);
    switch (skinId) {
      // ---- RANKING prizes ----
      case "IRONWOOD_ETERNAL_RANK":
        // the sand runs out: a column of golden grains pours down into a violet ring of time
        this.glow.emit(at.clone().add(new THREE.Vector3(0, 22, 0)), { count: Math.round(40 * k), color: "#fff0b0", colorEnd: "#c89018", size: 1.8, life: 1.1, speed: 6, gravity: 60, drag: 0.6, radius: 2.5 });
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#8a4aff", size: 22 * k, life: 0.25, speed: 0, grow: 1.6 });
        this.rings.ring(ground, "#b07aff", 4, 34 * k, 0.7);
        this.rings.ring(ground, "#ffd878", 2.5, 20 * k, 1);
        return true;
      case "INFERNO_ETERNAL_RANK":
        // a supernova: a white-hot core, a violet nebula shell and a scatter of stars
        this.glow.emit(at, { count: 4, color: "#ffffff", colorEnd: "#ff8af0", size: 34 * k, life: 0.25, speed: 0, grow: 1.8 });
        this.glow.emit(at, { count: Math.round(44 * k), color: "#ffd0f8", colorEnd: "#6a1ae8", size: 12 * k, life: 0.8, speed: 70 * k, grow: 1.5, drag: 3, radius: 3 });
        this.glow.emit(at, { count: Math.round(24 * k), color: "#ffffff", colorEnd: "#c8a8ff", size: 2, life: 1.6, speed: 60 * k, drag: 1.4, sizeJitter: 0.6 });
        this.smoke.emit(at, { count: Math.round(10 * k), color: "#4a1a8a", colorEnd: "#0e0620", size: 18 * k, life: 1.6, speed: 14, up: 10, grow: 2.2, alpha: 0.35, drag: 1.5, radius: 4 });
        this.rings.ring(ground, "#ff8af0", 5, 46 * k, 0.5);
        return true;
      case "FROSTBORN_ETERNAL_RANK":
        // time stops: a pale flash, three slow rings frozen in place, motes hanging in the air
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#a8d8ff", size: 26 * k, life: 0.25, speed: 0, grow: 1.5 });
        this.glow.emit(at, { count: Math.round(26 * k), color: "#fff6d0", colorEnd: "#ffd878", size: 1.8, life: 2, speed: 30 * k, drag: 4, radius: 3 });
        for (const [r, l] of [[18, 1.2], [30, 1.5], [42, 1.8]] as const) this.rings.ring(ground, r === 30 ? "#ffd878" : "#a8d8ff", 3, r * k, l);
        return true;
      case "STORMCALLER_ETERNAL_RANK":
        // a singularity: a dark knot pulling light inward, then a ring of starlight
        this.smoke.emit(at, { count: Math.round(10 * k), color: "#0a0614", colorEnd: "#000000", size: 12 * k, life: 0.8, speed: 4, grow: 0.6, alpha: 0.8, radius: 2 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2, d = 26 * k;
          const p = at.clone().add(new THREE.Vector3(Math.cos(a) * d, (Math.random() - 0.5) * 10, Math.sin(a) * d));
          this.glow.emit(p, { count: 2, color: "#ffffff", colorEnd: "#8a6aff", size: 2.4, life: 0.5, speed: 55 * k, dir: at.clone().sub(p).normalize(), spread: 0.1, drag: 0.5 });
        }
        this.rings.ring(ground, "#d8b0ff", 4, 38 * k, 0.6);
        return true;
      case "IRONWOOD_ARENA_RANK":
        // steel on steel: a burst of white-hot sparks and a dust ring kicked up from the sand
        this.glow.emit(at, { count: Math.round(40 * k), color: "#ffffff", colorEnd: "#ff7a2a", size: 1.8, life: 0.6, speed: 130 * k, up: 30, gravity: 220, drag: 0.8, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 3, color: "#fff0d0", colorEnd: "#e0a050", size: 18 * k, life: 0.15, speed: 0, grow: 1.6 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 2, 0)), { count: Math.round(10 * k), color: "#c8a07a", colorEnd: "#7a5a3a", size: 10 * k, life: 1.2, speed: 30, up: 4, grow: 2, alpha: 0.4, drag: 2, radius: 4 });
        this.rings.ring(ground, "#e0a050", 4, 30 * k, 0.45);
        return true;
      case "INFERNO_ARENA_RANK":
        // a war-fire blast: a shield of flame breaking into burning shards
        this.glow.emit(at, { count: Math.round(36 * k), color: "#fff1b0", colorEnd: "#c8201a", size: 12 * k, life: 0.6, speed: 60 * k, up: 18, grow: 1.6, drag: 3, radius: 3 });
        this.glow.emit(at, { count: Math.round(20 * k), color: "#ffc060", colorEnd: "#8a1a14", size: 3.4, life: 1.2, speed: 110 * k, up: 50, gravity: 160, drag: 0.8, sizeJitter: 0.6 });
        this.smoke.emit(at, { count: Math.round(12 * k), color: "#2a1210", colorEnd: "#0a0404", size: 16 * k, life: 1.8, speed: 10, up: 24, grow: 2.6, alpha: 0.55, radius: 4 });
        this.rings.ring(ground, "#c8201a", 5, 42 * k, 0.45);
        this.rings.ring(ground, "#ffc060", 3, 26 * k, 0.6);
        return true;
      case "FROSTBORN_ARENA_RANK":
        // a frost lance: icy shards and bronze sparks, a cold ring on the sand
        this.glow.emit(at, { count: Math.round(30 * k), color: "#ffffff", colorEnd: "#a8c8ff", size: 4 * k, life: 0.8, speed: 80 * k, up: 30, gravity: 110, drag: 1.6, sizeJitter: 0.6 });
        this.glow.emit(at, { count: Math.round(16 * k), color: "#ffd090", colorEnd: "#d8963a", size: 1.8, life: 0.6, speed: 100 * k, gravity: 160, drag: 1 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 3, 0)), { count: Math.round(8 * k), color: "#f0f6ff", colorEnd: "#b8cce8", size: 12 * k, life: 1.4, speed: 14, up: 2, grow: 2, alpha: 0.35 });
        this.rings.ring(ground, "#d8e8ff", 4, 34 * k, 0.55);
        return true;
      case "STORMCALLER_ARENA_RANK":
        // a thunderclap: the gong rings out — three shockwaves and sparks
        this.glow.emit(at, { count: 4, color: "#ffffff", colorEnd: "#ffd070", size: 26 * k, life: 0.2, speed: 0, grow: 1.8 });
        this.glow.emit(at, { count: Math.round(30 * k), color: "#ffffff", colorEnd: "#ff5a2a", size: 2.4, life: 0.5, speed: 120 * k, drag: 2, sizeJitter: 0.6 });
        for (const [r, l] of [[22, 0.35], [36, 0.5], [50, 0.65]] as const) this.rings.ring(ground, r === 36 ? "#ff5a2a" : "#ffd070", 4, r * k, l);
        return true;
      case "IRONWOOD_SEASON_RANK":
        // the standard is planted: a column of royal light and silver stars rising from the hit
        this.glow.emit(ground.clone().add(new THREE.Vector3(0, 2, 0)), { count: Math.round(26 * k), color: "#e8f4ff", colorEnd: "#2a5ad8", size: 3, life: 1, speed: 70, dir: up, spread: 0.12, drag: 1.2, radius: 2 });
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#f0d070", size: 20 * k, life: 0.2, speed: 0, grow: 1.5 });
        this.rings.ring(ground, "#2a5ad8", 4, 34 * k, 0.55);
        this.rings.ring(ground, "#f0d070", 2.5, 20 * k, 0.8);
        return true;
      case "INFERNO_SEASON_RANK":
        // a blue-fire burst crowned with gold
        this.glow.emit(at, { count: Math.round(38 * k), color: "#e8f4ff", colorEnd: "#1a3ad8", size: 12 * k, life: 0.6, speed: 60 * k, up: 20, grow: 1.6, drag: 3.5, radius: 3 });
        this.glow.emit(at, { count: Math.round(22 * k), color: "#fff6d0", colorEnd: "#ffb030", size: 2.4, life: 1.2, speed: 90 * k, up: 40, gravity: 130, drag: 0.8, sizeJitter: 0.6 });
        this.smoke.emit(at, { count: Math.round(10 * k), color: "#1a2240", colorEnd: "#080c18", size: 15 * k, life: 1.6, speed: 10, up: 22, grow: 2.4, alpha: 0.45, radius: 4 });
        this.rings.ring(ground, "#4a9aff", 5, 42 * k, 0.45);
        this.rings.ring(ground, "#ffd880", 3, 24 * k, 0.65);
        return true;
      case "FROSTBORN_SEASON_RANK":
        // a glacier seal: silver mist rolls out, a flash and a slow star-shaped ring
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#7aa8ff", size: 24 * k, life: 0.22, speed: 0, grow: 1.5 });
        this.glow.emit(at, { count: Math.round(28 * k), color: "#ffffff", colorEnd: "#7aa8ff", size: 3.4 * k, life: 0.9, speed: 70 * k, up: 30, gravity: 100, drag: 1.6, sizeJitter: 0.6 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 3, 0)), { count: Math.round(14 * k), color: "#f4f8ff", colorEnd: "#b8c8e8", size: 15 * k, life: 1.8, speed: 20, up: 2, grow: 2.2, alpha: 0.4, drag: 1.6, radius: 6 });
        this.rings.ring(ground, "#e8eef8", 4, 38 * k, 0.7);
        return true;
      case "STORMCALLER_SEASON_RANK":
        // a comet strike: it falls from the sky on a white-blue streak and splashes into a crater ring
        this.bolts.bolt(at.clone().add(new THREE.Vector3(30, 90, -20)), ground, "#8ab8ff", 0.5, 4);
        this.glow.emit(at, { count: 4, color: "#ffffff", colorEnd: "#4a8aff", size: 30 * k, life: 0.25, speed: 0, grow: 1.7 });
        this.glow.emit(at, { count: Math.round(34 * k), color: "#e8f0ff", colorEnd: "#2a5ad8", size: 2.6, life: 1, speed: 110 * k, up: 50, gravity: 150, drag: 0.8, sizeJitter: 0.6 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 3, 0)), { count: Math.round(10 * k), color: "#2a3450", colorEnd: "#0e1426", size: 12 * k, life: 1.4, speed: 24, up: 8, grow: 2.2, alpha: 0.45, radius: 4 });
        this.rings.ring(ground, "#4a8aff", 5, 44 * k, 0.5);
        return true;
      case "INFERNO_PACK_EMBERHEART":
        // a fireball bursting like a heartbeat: two shockwaves, a fire core, lava spatter and a smoke column
        this.glow.emit(at, { count: Math.round(40 * k), color: "#fff6c8", colorEnd: "#ff2a00", size: 13 * k, life: 0.6, speed: 60 * k, up: 20, grow: 1.7, drag: 3.5, radius: 3 });
        this.glow.emit(at, { count: Math.round(34 * k), color: "#ffd27a", colorEnd: "#c01a00", size: 2.8, life: 1.4, speed: 100 * k, up: 50, gravity: 150, drag: 0.8, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#ff7a2a", size: 30 * k, life: 0.2, speed: 0, grow: 1.6 });
        this.smoke.emit(at.clone().add(new THREE.Vector3(0, 6, 0)), { count: Math.round(14 * k), color: "#2a1a14", colorEnd: "#0e0a08", size: 16 * k, life: 1.8, speed: 12, up: 26, grow: 2.6, alpha: 0.55, drag: 1.4, radius: 4 });
        this.rings.ring(ground, "#ff6a1a", 5, 44 * k, 0.45);
        this.rings.ring(ground, "#ffd27a", 3, 26 * k, 0.7);
        return true;
      case "FROSTBORN_PACK_WINTER_CROWN":
        // ice shatter: a crown of shards thrown upward, falling crystals and a rolling frost mist
        this.glow.emit(at, { count: Math.round(36 * k), color: "#ffffff", colorEnd: "#3a6aff", size: 5 * k, life: 0.9, speed: 80 * k, up: 40, gravity: 110, drag: 1.6, sizeJitter: 0.6 });
        this.glow.emit(ground.clone().add(new THREE.Vector3(0, 2, 0)), { count: Math.round(18 * k), color: "#e8f4ff", colorEnd: "#6a9aff", size: 3.4, life: 0.8, speed: 70, dir: up, spread: 0.25, gravity: 80, radius: 9 * k });
        this.glow.emit(at, { count: 4, color: "#ffffff", colorEnd: "#8ab0ff", size: 26 * k, life: 0.22, speed: 0, grow: 1.5 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 3, 0)), { count: Math.round(12 * k), color: "#f0f6ff", colorEnd: "#b8cce8", size: 14 * k, life: 1.6, speed: 18, up: 2, grow: 2.2, alpha: 0.4, drag: 1.6, radius: 6 });
        this.rings.ring(ground, "#9ab8ff", 5, 40 * k, 0.6);
        return true;
      case "IRONWOOD_PACK_EMERALD_SENTINEL":
        // an emerald shattering: green shards, a golden flash ring, and leaves drifting down
        this.glow.emit(at, { count: Math.round(30 * k), color: "#d8ffe8", colorEnd: "#0a9a50", size: 3.6 * k, life: 0.7, speed: 90 * k, up: 20, gravity: 100, drag: 1.8, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 3, color: "#ffffff", colorEnd: "#30e080", size: 22 * k, life: 0.2, speed: 0, grow: 1.6 });
        this.glow.emit(at.clone().add(new THREE.Vector3(0, 10, 0)), { count: Math.round(14 * k), color: "#8aff6a", colorEnd: "#2a6a1a", size: 2.4, life: 2, speed: 18, up: 4, gravity: 12, drag: 1.2, radius: 8 });
        this.rings.ring(ground, "#ffd860", 4, 36 * k, 0.5);
        this.rings.ring(ground, "#2affa0", 3, 22 * k, 0.6);
        return true;
      case "STORMCALLER_PACK_CRIMSON_STORM": {
        // a blood-red strike: forked arcs around the target, a spray of sparks, scorch smoke
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 16 * k;
          this.bolts.bolt(at, ground.clone().add(new THREE.Vector3(Math.cos(a) * d, 1, Math.sin(a) * d)), "#ff1a2a", 0.16, 6);
        }
        this.glow.emit(at, { count: Math.round(34 * k), color: "#ffffff", colorEnd: "#e8101e", size: 3 * k, life: 0.45, speed: 120 * k, gravity: 110, drag: 2, sizeJitter: 0.6 });
        this.glow.emit(at, { count: 4, color: "#ffd0d4", colorEnd: "#c0101e", size: 24 * k, life: 0.2, speed: 0, grow: 1.8 });
        this.smoke.emit(ground.clone().add(new THREE.Vector3(0, 3, 0)), { count: Math.round(8 * k), color: "#2a0a0c", colorEnd: "#0a0304", size: 10 * k, life: 1.2, speed: 10, up: 14, grow: 2.2, alpha: 0.5 });
        this.rings.ring(ground, "#e8101e", 4, 36 * k, 0.4);
        return true;
      }
      case "IRONWOOD_PACK_ECLIPSE":
      case "FROSTBORN_PACK_ECLIPSE": {
        // an eclipse: a black sphere of smoke swallowing the light, a golden corona flaring out
        this.smoke.emit(at, { count: Math.round(18 * k), color: "#05040a", colorEnd: "#000000", size: 14 * k, life: 1, speed: 16, grow: 1.6, alpha: 0.75, drag: 2.5, radius: 3 });
        this.glow.emit(at, { count: Math.round(40 * k), color: "#fff0b0", colorEnd: "#a87010", size: 2.6 * k, life: 0.6, speed: 110 * k, drag: 2.6, sizeJitter: 0.5 });
        this.glow.emit(at, { count: 5, color: "#fff4c8", colorEnd: "#c89018", size: 28 * k, life: 0.3, speed: 0, grow: 1.4 });
        if (skinId === "FROSTBORN_PACK_ECLIPSE") this.glow.emit(at, { count: Math.round(20 * k), color: "#ffffff", colorEnd: "#2a2a3a", size: 3.4, life: 0.9, speed: 70, up: 30, gravity: 100, drag: 1.4 });
        this.rings.ring(ground, "#ffc848", 5, 42 * k, 0.55);
        this.rings.ring(ground, "#1a1410", 6, 24 * k, 0.8);
        return true;
      }
      case "INFERNO_PACK_SOVEREIGN":
      case "STORMCALLER_PACK_SOVEREIGN":
        // a sovereign's judgement: a column of golden light, a white-gold flare and motes rising
        this.glow.emit(ground.clone().add(new THREE.Vector3(0, 2, 0)), { count: Math.round(30 * k), color: "#ffffff", colorEnd: "#ffc848", size: 6 * k, life: 0.7, speed: 120, dir: up, spread: 0.05, drag: 1.2, radius: 3 });
        this.glow.emit(at, { count: Math.round(30 * k), color: "#fff6d0", colorEnd: "#ff4a5a", size: 2.4 * k, life: 0.8, speed: 90 * k, up: 20, gravity: 60, drag: 2, sizeJitter: 0.5 });
        this.glow.emit(at, { count: 4, color: "#ffffff", colorEnd: "#ffd878", size: 32 * k, life: 0.25, speed: 0, grow: 1.5 });
        this.glow.emit(at, { count: Math.round(12 * k), color: "#ffe8a0", colorEnd: "#ffc848", size: 1.8, life: 2, speed: 8, up: 22, drag: 0.6, radius: 10 });
        this.rings.ring(ground, "#ffd878", 5, 46 * k, 0.5);
        this.rings.ring(ground, "#ffffff", 3, 26 * k, 0.4);
        return true;
    }
    return false;
  }

  death(at: THREE.Vector3, boss: boolean) {
    const k = boss ? 3 : 1;
    this.glow.emit(at, { count: Math.round(18 * k), color: "#ff8a5a", colorEnd: "#5a0a0a", size: 3 * k, life: 0.9, speed: 50 * k, up: 30, gravity: 80, drag: 1.4, radius: 6 * k });
    this.smoke.emit(at, { count: Math.round(10 * k), color: "#2e2622", colorEnd: "#0e0c0a", size: 12 * k, life: 1.3, speed: 16 * k, up: 16, grow: 2.2, alpha: 0.6, radius: 6 * k });
    // the soul leaving: a few pale motes drifting up
    this.glow.emit(at.clone().add(new THREE.Vector3(0, 14 * k, 0)), { count: Math.round(6 * k), color: "#d8f4ff", colorEnd: "#3a6aff", size: 4, life: 1.6, speed: 6, up: 28, drag: 0.6, radius: 5 });
  }

  /** One frame's worth of a continuous flame (torches, burning towers). */
  flame(at: THREE.Vector3, scale = 1, color: THREE.ColorRepresentation = "#ffb347") {
    this.glow.emit(at, { count: 1, color: "#fff2c0", colorEnd: color, size: 5 * scale, life: 0.5, speed: 3, up: 22 * scale, grow: 0.2, drag: 1, radius: 1.2 * scale });
  }
  smokePuff(at: THREE.Vector3, scale = 1) {
    this.smoke.emit(at, { count: 1, color: "#3a3330", colorEnd: "#121010", size: 10 * scale, life: 2.6, speed: 4, up: 18, grow: 3, alpha: 0.45, drag: 0.6, radius: 3 * scale });
  }
  mote(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, up = 14) {
    this.glow.emit(at, { count: 1, color: "#ffffff", colorEnd: color, size: 2.6, life: 1.6, speed: 6, up, drag: 0.8, radius });
  }
}
