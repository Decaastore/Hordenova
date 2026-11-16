import type { ProjectileInstance } from "@/entities/Projectile";
import { getTowerSkinDefinition } from "@/config/towerSkins";

/**
 * SKIN SHOT SIGNATURES — every tower skin's shots carry their own trail and
 * their own impact, in the skin's colours, on top of the tower type's normal
 * projectile (an arrow stays an arrow, a fireball a fireball). Purely
 * cosmetic: nothing here is read by the combat code.
 *
 * Shots fly for a fraction of a second, so the impact is spawned once when a
 * shot lands and keeps playing for a moment after the shot itself is gone
 * (`drawSkinImpacts`, called once per frame after the projectiles).
 */

type Trail = "smoke" | "sparkles" | "rings" | "shards" | "runes" | "spiral" | "bubbles" | "leaves" | "feathers" | "stars" | "zigzag" | "ghost" | "embers" | "petals" | "snow" | "drip";
type Impact = "rays" | "ring" | "shards" | "splash" | "star" | "pillar" | "puff" | "fork" | "cross" | "nova" | "petals" | "crack" | "flower" | "vortex" | "crown" | "skull";

interface Signature {
  trail: Trail;
  impact: Impact;
  /** A second colour mixed into the effect (defaults to the skin's accent). */
  c2?: string;
}

const SIGNATURES: Record<string, Signature> = {
  // ---- IRONWOOD: arrows ----
  IRONWOOD_WARDEN_OF_THE_ABYSS: { trail: "ghost", impact: "vortex", c2: "#2a0a4a" },
  IRONWOOD_CELESTIAL_WARDEN: { trail: "feathers", impact: "pillar", c2: "#ffffff" },
  IRONWOOD_ARCANE_ENGINE: { trail: "zigzag", impact: "cross", c2: "#6ad0ff" },
  IRONWOOD_ANCIENT_HUNTER: { trail: "leaves", impact: "petals", c2: "#8ad84a" },
  IRONWOOD_IRONCLAD_JUGGERNAUT: { trail: "smoke", impact: "crack", c2: "#c8ccd0" },
  IRONWOOD_AUTUMN: { trail: "leaves", impact: "flower", c2: "#e8641a" },
  IRONWOOD_BIRCH: { trail: "petals", impact: "ring", c2: "#fff8d0" },
  IRONWOOD_BLOODWOOD: { trail: "drip", impact: "splash", c2: "#8a0a14" },
  IRONWOOD_FROSTPINE: { trail: "snow", impact: "shards", c2: "#e8f8ff" },
  IRONWOOD_GLADIATOR: { trail: "embers", impact: "cross", c2: "#ffb04a" },
  IRONWOOD_CHAMPION: { trail: "stars", impact: "crown", c2: "#fff0a0" },
  IRONWOOD_LEGEND: { trail: "ghost", impact: "skull", c2: "#ff3a5a" },
  IRONWOOD_PRESTIGE_ASCENDANT: { trail: "sparkles", impact: "star", c2: "#fff4c0" },
  // ---- INFERNO: fireballs ----
  INFERNO_ASHEN_TYRANT: { trail: "smoke", impact: "skull", c2: "#2a0a0a" },
  INFERNO_VOLCANIC_COLOSSUS: { trail: "embers", impact: "crack", c2: "#ffd04a" },
  INFERNO_INDUSTRIAL_FORGE: { trail: "sparkles", impact: "cross", c2: "#ffffff" },
  INFERNO_SOLAR_ASCENDANT: { trail: "rings", impact: "rays", c2: "#fff8d0" },
  INFERNO_PLAGUE_FURNACE: { trail: "bubbles", impact: "splash", c2: "#4a8a1a" },
  INFERNO_PRESTIGE_ASCENDANT: { trail: "feathers", impact: "nova", c2: "#fff0b0" },
  INFERNO_COPPER: { trail: "embers", impact: "ring", c2: "#ffcf8a" },
  INFERNO_SOOT: { trail: "smoke", impact: "puff", c2: "#3a3a3e" },
  INFERNO_BLUE_FLAME: { trail: "spiral", impact: "pillar", c2: "#e8f8ff" },
  INFERNO_EMERALD: { trail: "spiral", impact: "flower", c2: "#d8ffb0" },
  INFERNO_GLADIATOR: { trail: "embers", impact: "cross", c2: "#ffd060" },
  INFERNO_CHAMPION: { trail: "stars", impact: "crown", c2: "#ffffff" },
  INFERNO_LEGEND: { trail: "ghost", impact: "vortex", c2: "#ffc040" },
  // ---- FROSTBORN: ice bolts ----
  FROSTBORN_ANCIENT_GUARDIAN: { trail: "leaves", impact: "crack", c2: "#b8ffa0" },
  FROSTBORN_VOID_FROST: { trail: "ghost", impact: "vortex", c2: "#1a0a3a" },
  FROSTBORN_ARCANE_CRYSTAL: { trail: "sparkles", impact: "flower", c2: "#ffffff" },
  FROSTBORN_CELESTIAL_ICE: { trail: "feathers", impact: "pillar", c2: "#ffffff" },
  FROSTBORN_GLACIAL_WARLORD: { trail: "shards", impact: "shards", c2: "#ffffff" },
  FROSTBORN_PRESTIGE_ASCENDANT: { trail: "stars", impact: "star", c2: "#fff0b0" },
  FROSTBORN_SANDSTONE: { trail: "smoke", impact: "ring", c2: "#e8d4a0" },
  FROSTBORN_MOONSTONE: { trail: "runes", impact: "nova", c2: "#ffffff" },
  FROSTBORN_AURORA: { trail: "spiral", impact: "rays", c2: "#c08aff" },
  FROSTBORN_OBSIDIAN: { trail: "shards", impact: "crack", c2: "#1a1a22" },
  FROSTBORN_GLADIATOR: { trail: "embers", impact: "cross", c2: "#ffd060" },
  FROSTBORN_CHAMPION: { trail: "snow", impact: "crown", c2: "#ffffff" },
  FROSTBORN_LEGEND: { trail: "ghost", impact: "skull", c2: "#ffc040" },
  // ---- STORMCALLER: lightning ----
  STORMCALLER_VOID: { trail: "ghost", impact: "vortex", c2: "#0a0414" },
  STORMCALLER_THUNDER: { trail: "zigzag", impact: "fork", c2: "#ffffff" },
  STORMCALLER_CELESTIAL: { trail: "feathers", impact: "pillar", c2: "#ffffff" },
  STORMCALLER_ARCANE: { trail: "runes", impact: "nova", c2: "#ffffff" },
  STORMCALLER_TEMPEST: { trail: "spiral", impact: "ring", c2: "#ffffff" },
  STORMCALLER_PRESTIGE_ASCENDANT: { trail: "sparkles", impact: "star", c2: "#fff4c0" },
  STORMCALLER_COPPER: { trail: "sparkles", impact: "fork", c2: "#ffd8a0" },
  STORMCALLER_SLATE: { trail: "rings", impact: "cross", c2: "#e8f0ff" },
  STORMCALLER_RUBY: { trail: "shards", impact: "shards", c2: "#ffd0d8" },
  STORMCALLER_SUNSTORM: { trail: "rings", impact: "rays", c2: "#fff8d0" },
  STORMCALLER_GLADIATOR: { trail: "embers", impact: "crack", c2: "#ffd060" },
  STORMCALLER_CHAMPION: { trail: "stars", impact: "crown", c2: "#ffffff" },
  STORMCALLER_LEGEND: { trail: "ghost", impact: "skull", c2: "#ff9ab0" },
};

export function skinShotSignature(skinId: string | null | undefined): Signature | null {
  return skinId ? SIGNATURES[skinId] ?? null : null;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rand(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the shot is along its path at `t` (arrows and fireballs are lobbed, ice and lightning fly straight). */
function pointAt(p: ProjectileInstance, t: number) {
  const { from, to } = p;
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const arc = p.towerType === "IRONWOOD" ? Math.min(16, dist * 0.2) : p.towerType === "INFERNO" && !p.isSpecial ? Math.min(14, dist * 0.16) : 0;
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - arc;
  const u = 1 - t;
  return { x: u * u * from.x + 2 * u * t * mx + t * t * to.x, y: u * u * from.y + 2 * u * t * my + t * t * to.y };
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5, inner = 0.45, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** The skin's trail, drawn along the shot's path while it flies. */
export function drawSkinTrail(ctx: CanvasRenderingContext2D, p: ProjectileInstance, progress: number) {
  const sig = skinShotSignature(p.skinId);
  if (!sig) return;
  const skin = getTowerSkinDefinition(p.skinId!);
  const col = skin?.paletteOverride.accent ?? "#ffffff";
  const c2 = sig.c2 ?? col;
  const R = rand(hash(p.id));
  const k = p.isSpecial ? 1.8 : 1;
  const now = performance.now() / 1000;
  ctx.save();
  ctx.globalCompositeOperation = sig.trail === "smoke" || sig.trail === "drip" ? "source-over" : "lighter";
  const N = 7;
  for (let i = 0; i < N; i++) {
    const t = Math.max(0, progress - i * 0.07);
    const q = pointAt(p, t);
    const fade = (1 - i / N) * 0.9;
    const jx = (R() - 0.5) * 6, jy = (R() - 0.5) * 6;
    const c = i % 2 ? col : c2;
    ctx.globalAlpha = fade;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    switch (sig.trail) {
      case "smoke":
        ctx.globalAlpha = fade * 0.45;
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy - i, (2 + i * 1.2) * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "embers":
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy, (1.6 - i * 0.12) * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "sparkles":
      case "stars":
        star(ctx, q.x + jx, q.y + jy, (sig.trail === "stars" ? 3.6 : 2.4) * k * fade + 0.6, sig.trail === "stars" ? 5 : 4, 0.35, now * 4 + i);
        ctx.fill();
        break;
      case "rings":
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, (2 + i * 1.3) * k, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "shards":
        ctx.save();
        ctx.translate(q.x + jx, q.y + jy);
        ctx.rotate(R() * Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, -3.4 * k);
        ctx.lineTo(1.3 * k, 0);
        ctx.lineTo(0, 3.4 * k);
        ctx.lineTo(-1.3 * k, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      case "runes":
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(now * 3 + i);
        ctx.lineWidth = 1;
        ctx.strokeRect(-2.2 * k, -2.2 * k, 4.4 * k, 4.4 * k);
        ctx.restore();
        break;
      case "spiral": {
        const a = now * 14 + i * 0.9;
        ctx.beginPath();
        ctx.arc(q.x + Math.cos(a) * 4.5 * k, q.y + Math.sin(a) * 4.5 * k, 1.6 * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bubbles":
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy - i * 1.5, (1.4 + R() * 1.6) * k, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "leaves":
      case "petals":
      case "feathers":
        ctx.save();
        ctx.translate(q.x + jx, q.y + jy + i * 0.8);
        ctx.rotate(now * 2 + i);
        ctx.beginPath();
        ctx.ellipse(0, 0, (sig.trail === "feathers" ? 3.6 : 2.6) * k, 1.1 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      case "snow":
        ctx.beginPath();
        ctx.arc(q.x + jx * 1.4, q.y + jy + i, 1.1 * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "zigzag":
        if (i > 0) {
          const q0 = pointAt(p, Math.max(0, progress - (i - 1) * 0.07));
          ctx.lineWidth = 1.4 * k;
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo((q0.x + q.x) / 2 + (R() - 0.5) * 8, (q0.y + q.y) / 2 + (R() - 0.5) * 8);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        break;
      case "ghost":
        ctx.globalAlpha = fade * 0.5;
        ctx.beginPath();
        ctx.arc(q.x, q.y, (4.5 - i * 0.3) * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "drip":
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(q.x + jx, q.y + jy + i * 1.2, 1 * k, 1.8 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }
  ctx.restore();
  if (progress > 0.8) spawnImpact(p, sig, col, c2);
}

interface LiveImpact {
  x: number;
  y: number;
  t0: number;
  life: number;
  sig: Signature;
  col: string;
  c2: string;
  big: number;
  seed: number;
}
const impacts: LiveImpact[] = [];
const spawned = new Set<string>();

function spawnImpact(p: ProjectileInstance, sig: Signature, col: string, c2: string) {
  if (spawned.has(p.id)) return;
  spawned.add(p.id);
  if (spawned.size > 600) spawned.clear();
  if (impacts.length > 80) impacts.shift();
  impacts.push({ x: p.to.x, y: p.to.y, t0: performance.now(), life: p.isSpecial ? 700 : 420, sig, col, c2, big: p.isSpecial ? 2.4 : 1.4, seed: hash(p.id) });
  // chain lightning: the same signature blooms on every link it jumps to
  for (const c of p.chainTargets) impacts.push({ x: c.x, y: c.y, t0: performance.now(), life: 360, sig, col, c2, big: 1, seed: hash(p.id + c.x) });
}

/** Every skin impact still playing out. Call once per frame, after the projectiles. */
export function drawSkinImpacts(ctx: CanvasRenderingContext2D) {
  if (!impacts.length) return;
  const now = performance.now();
  for (let n = impacts.length - 1; n >= 0; n--) {
    const im = impacts[n]!;
    const t = (now - im.t0) / im.life;
    if (t >= 1) {
      impacts.splice(n, 1);
      continue;
    }
    drawImpact(ctx, im, t);
  }
}

function drawImpact(ctx: CanvasRenderingContext2D, im: LiveImpact, t: number) {
  const { x, y, col, c2, big } = im;
  const R = rand(im.seed);
  const e = 1 - (1 - t) * (1 - t);
  const a = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation = im.sig.impact === "puff" || im.sig.impact === "splash" ? "source-over" : "lighter";
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  const S = big;
  switch (im.sig.impact) {
    case "rays":
      ctx.lineWidth = 2 * S;
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * Math.PI * 2;
        ctx.strokeStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * 4 * S, y + Math.sin(an) * 4 * S);
        ctx.lineTo(x + Math.cos(an) * (6 + e * 18) * S, y + Math.sin(an) * (6 + e * 18) * S);
        ctx.stroke();
      }
      break;
    case "ring":
      ctx.lineWidth = 2.4 * S * a + 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, (4 + e * 22) * S, (2.4 + e * 12) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.beginPath();
      ctx.ellipse(x, y, (2 + e * 13) * S, (1.2 + e * 7) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "shards":
      for (let i = 0; i < 9; i++) {
        const an = R() * Math.PI * 2;
        const d = (4 + e * (14 + R() * 10)) * S;
        ctx.save();
        ctx.translate(x + Math.cos(an) * d, y + Math.sin(an) * d - e * 4);
        ctx.rotate(an + Math.PI / 2);
        ctx.fillStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.moveTo(0, -4 * S);
        ctx.lineTo(1.5 * S, 0);
        ctx.lineTo(0, 4 * S);
        ctx.lineTo(-1.5 * S, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    case "splash":
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI * (0.1 + R() * 0.8);
        const v = (10 + R() * 14) * S;
        const px = x + Math.cos(an) * v * e;
        const py = y + Math.sin(an) * v * e + e * e * 16 * S;
        ctx.fillStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.arc(px, py, (1.6 + R()) * S * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, (6 + e * 8) * S, (2.4 + e * 3) * S, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "star":
      star(ctx, x, y - e * 6, (5 + e * 10) * S, 5, 0.42, e * 1.5);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      star(ctx, x, y - e * 6, (2.4 + e * 4) * S, 5, 0.42, e * 1.5);
      ctx.fill();
      break;
    case "pillar": {
      const h = 46 * S * (t < 0.3 ? t / 0.3 : 1);
      const g = ctx.createLinearGradient(x, y - h, x, y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.7, col);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(x - 4 * S * a, y - h, 8 * S * a, h);
      ctx.beginPath();
      ctx.ellipse(x, y, 9 * S, 3.6 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "puff":
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2 + R();
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = i % 2 ? c2 : "#5a5a60";
        ctx.beginPath();
        ctx.arc(x + Math.cos(an) * e * 10 * S, y + Math.sin(an) * e * 6 * S - e * 8, (4 + e * 6) * S, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "fork":
      ctx.lineWidth = 1.6 * S;
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * Math.PI * 2 + R();
        let px = x, py = y;
        ctx.strokeStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += Math.cos(an + (R() - 0.5) * 1.2) * 6 * S;
          py += Math.sin(an + (R() - 0.5) * 1.2) * 6 * S;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    case "cross":
      ctx.lineWidth = 3 * S * a + 0.5;
      for (const r0 of [0, Math.PI / 2]) {
        const an = r0 + Math.PI / 4;
        const L = (6 + e * 12) * S;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(an) * L, y - Math.sin(an) * L);
        ctx.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L);
        ctx.stroke();
      }
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(x, y, 3 * S * a, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "nova": {
      const g = ctx.createRadialGradient(x, y, 0, x, y, (6 + e * 26) * S);
      g.addColorStop(0, c2);
      g.addColorStop(0.5, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, (6 + e * 26) * S, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "petals":
    case "flower":
      for (let i = 0; i < (im.sig.impact === "flower" ? 6 : 8); i++) {
        const an = (i / 6) * Math.PI * 2 + e * 1.2;
        const d = (im.sig.impact === "flower" ? 5 + e * 6 : 4 + e * 16) * S;
        ctx.save();
        ctx.translate(x + Math.cos(an) * d, y + Math.sin(an) * d + (im.sig.impact === "petals" ? e * 8 : 0));
        ctx.rotate(an);
        ctx.fillStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 * S, 1.8 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    case "crack":
      ctx.lineWidth = 1.6 * S;
      ctx.strokeStyle = c2;
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2 + R();
        let px = x, py = y;
        ctx.beginPath();
        ctx.moveTo(px, py);
        const steps = Math.ceil(e * 4);
        for (let k = 0; k < steps; k++) {
          px += Math.cos(an + (R() - 0.5)) * 5 * S;
          py += Math.sin(an + (R() - 0.5)) * 3 * S;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.globalAlpha = a * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 5 * S * a, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "vortex":
      ctx.lineWidth = 2 * S;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? c2 : col;
        ctx.beginPath();
        ctx.arc(x, y, (14 - e * 10 + i * 3) * S, e * 8 + i * 2, e * 8 + i * 2 + Math.PI * 1.2);
        ctx.stroke();
      }
      break;
    case "crown": {
      ctx.beginPath();
      const w = 8 * S, h = 6 * S, cy = y - 8 - e * 10;
      ctx.moveTo(x - w, cy + h);
      ctx.lineTo(x - w, cy);
      ctx.lineTo(x - w / 2, cy + h * 0.5);
      ctx.lineTo(x, cy - h * 0.3);
      ctx.lineTo(x + w / 2, cy + h * 0.5);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(x + w, cy + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.lineWidth = 2 * S * a;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, y, (4 + e * 16) * S, (2 + e * 8) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "skull": {
      const sy = y - 6 - e * 12;
      ctx.beginPath();
      ctx.arc(x, sy, 5 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 3 * S, sy + 3 * S, 6 * S, 3 * S);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = c2;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + sx * 1.9 * S, sy - 0.4 * S, 1.4 * S, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}
