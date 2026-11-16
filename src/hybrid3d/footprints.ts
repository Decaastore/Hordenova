import * as THREE from "three";

/**
 * PEGADAS — footprints the 3D creatures press into the ground. A print is
 * stamped where a foot actually lands (see HybridOverlay's foot tracking),
 * sized to the creature, and fades over a few seconds. Each map prints into
 * its own ground: dark mud in the forest, pressed snow on the ice, sand in
 * the desert, ash with a dying ember in the volcano, a faint violet glow in
 * the Abyss. One instanced draw call for every print on the field.
 */

const MAX_PRINTS = 480;
const LIFE = 6.5;
const FADE_FROM = 4;

interface PrintStyle {
  /** The print itself. */
  color: string;
  alpha: number;
  /** A glow the print starts with and loses in its first second or so (embers, magic). */
  glow?: string;
  glowLife?: number;
  /** A lighter rim pushed up around the print (snow, sand). */
  rim?: string;
}

const STYLES: Record<string, PrintStyle> = {
  ancient_forest: { color: "#160e07", alpha: 0.75 },
  volcanic_wastes: { color: "#140b07", alpha: 0.65, glow: "#ff5a14", glowLife: 1.4 },
  frozen_tundra: { color: "#4e6680", alpha: 0.65, rim: "#f4faff" },
  cursed_desert: { color: "#5a3c1c", alpha: 0.6, rim: "#f0d8a4" },
  dark_ruins: { color: "#0e0e0e", alpha: 0.7 },
  abyss: { color: "#1e0a30", alpha: 0.6, glow: "#a45aff", glowLife: 2.2 },
};

/** A foot sole seen from above: heel, arch and a fan of claw-toes. Pointing +Y in the texture. */
function printTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  // heel
  g.beginPath();
  g.ellipse(32, 98, 15, 18, 0, 0, Math.PI * 2);
  g.fill();
  // ball of the foot
  g.beginPath();
  g.ellipse(32, 56, 19, 20, 0, 0, Math.PI * 2);
  g.fill();
  // arch joining them (narrower)
  g.fillRect(22, 58, 20, 40);
  // claw-toes
  for (const [x, y, r] of [
    [14, 28, 7],
    [26, 20, 7.5],
    [39, 20, 7.5],
    [51, 28, 7],
  ] as const) {
    g.beginPath();
    g.ellipse(x, y, r * 0.75, r, (x - 32) * 0.02, 0, Math.PI * 2);
    g.fill();
    // claw tip
    g.beginPath();
    g.moveTo(x - 2.5, y - r + 1);
    g.lineTo(x + (x - 32) * 0.08, y - r - 7);
    g.lineTo(x + 2.5, y - r + 1);
    g.fill();
  }
  // soften the edge
  const soft = document.createElement("canvas");
  soft.width = 64;
  soft.height = 128;
  const s = soft.getContext("2d")!;
  s.filter = "blur(2px)";
  s.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(soft);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = /* glsl */ `
  attribute float aFade;
  attribute float aGlow;
  varying vec2 vUv;
  varying float vFade;
  varying float vGlow;
  void main() {
    vUv = uv;
    vFade = aFade;
    vGlow = aGlow;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform float uRimOn;
  uniform vec3 uGlow;
  uniform float uAlpha;
  varying vec2 vUv;
  varying float vFade;
  varying float vGlow;
  void main() {
    float a = texture2D(uMap, vUv).a;
    // a thin raised rim just outside the print (snow, sand)
    float rim = 0.0;
    if (uRimOn > 0.5) {
      float o = texture2D(uMap, vUv + vec2(0.0, 0.02)).a + texture2D(uMap, vUv - vec2(0.0, 0.02)).a
              + texture2D(uMap, vUv + vec2(0.03, 0.0)).a + texture2D(uMap, vUv - vec2(0.03, 0.0)).a;
      rim = clamp(o * 0.25 - a, 0.0, 1.0) * 1.6;
    }
    vec3 col = mix(uColor, uRim, rim);
    col = mix(col, uGlow * 2.2, vGlow * a);
    float alpha = (a * uAlpha + rim * 0.5) * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export class Footprints {
  readonly mesh: THREE.InstancedMesh;
  private age = new Float32Array(MAX_PRINTS).fill(LIFE);
  private fade: THREE.InstancedBufferAttribute;
  private glow: THREE.InstancedBufferAttribute;
  private next = 0;
  private style: PrintStyle = STYLES.ancient_forest!;
  private readonly uniforms;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 2);
    geo.rotateX(-Math.PI / 2); // lie flat; the texture's +Y now points along −Z
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PRINTS), 1);
    this.glow = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PRINTS), 1);
    this.fade.setUsage(THREE.DynamicDrawUsage);
    this.glow.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aFade", this.fade);
    geo.setAttribute("aGlow", this.glow);
    this.uniforms = {
      uMap: { value: printTexture() },
      uColor: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uRimOn: { value: 0 },
      uGlow: { value: new THREE.Color() },
      uAlpha: { value: 0.6 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PRINTS);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    // park every slot out of sight until it is used
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PRINTS; i++) this.mesh.setMatrixAt(i, this.m);
    this.setLook("ancient_forest");
  }

  /** Which map's ground the prints are pressed into (one of the six castle/map looks). */
  setLook(look: string) {
    this.style = STYLES[look] ?? STYLES.ancient_forest!;
    this.uniforms.uColor.value.set(this.style.color);
    this.uniforms.uAlpha.value = this.style.alpha;
    this.uniforms.uRimOn.value = this.style.rim ? 1 : 0;
    this.uniforms.uRim.value.set(this.style.rim ?? this.style.color);
    this.uniforms.uGlow.value.set(this.style.glow ?? "#000000");
  }

  /**
   * A foot came down at (x, z) on the ground, facing `yaw` (radians around +Y,
   * 0 = +Z). `length` is the print's length in world units; `left` mirrors it.
   */
  stamp(x: number, z: number, yaw: number, length: number, left: boolean) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PRINTS;
    // the plane's toes point along −Z after lying flat, so turn it half round onto the walking direction
    this.e.set(0, yaw + Math.PI, 0);
    this.q.setFromEuler(this.e);
    const w = length * 0.5;
    this.m.compose(new THREE.Vector3(x, 0.15, z), this.q, new THREE.Vector3(left ? -w : w, 1, length * 0.5));
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.age[i] = 0;
  }

  update(dt: number) {
    const glowLife = this.style.glowLife ?? 0;
    for (let i = 0; i < MAX_PRINTS; i++) {
      const a = (this.age[i]! += dt);
      // shows a beat after the foot lifts (so a print never sits on top of the foot that made it)
      const f = a >= LIFE ? 0 : a < 0.3 ? 0 : a < 0.5 ? (a - 0.3) / 0.2 : a > FADE_FROM ? 1 - (a - FADE_FROM) / (LIFE - FADE_FROM) : 1;
      this.fade.setX(i, f);
      this.glow.setX(i, glowLife > 0 && a < glowLife + 0.3 ? Math.pow(1 - Math.max(0, a - 0.3) / glowLife, 1.5) : 0);
    }
    this.fade.needsUpdate = true;
    this.glow.needsUpdate = true;
  }
}
