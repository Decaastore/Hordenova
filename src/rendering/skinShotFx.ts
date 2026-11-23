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

type Trail = "smoke" | "sparkles" | "rings" | "shards" | "runes" | "spiral" | "bubbles" | "leaves" | "feathers" | "stars" | "zigzag" | "ghost" | "embers" | "petals" | "snow" | "drip"
  // bundle-exclusive (config/store.ts SKIN_BUNDLES): no other skin uses these
  | "heartfire" | "frostcrown" | "emerald" | "bloodstorm" | "eclipse" | "blackfrost" | "royal" | "royalbolt"
  // ranking prizes (config/rankedRewards.ts): no other skin uses these
  | "sand" | "nebula" | "clockrings" | "starfall" | "blades" | "warflame" | "shieldshards" | "gongrings" | "banners" | "laurel" | "silvermist" | "comet";
type Impact = "rays" | "ring" | "shards" | "splash" | "star" | "pillar" | "puff" | "fork" | "cross" | "nova" | "petals" | "crack" | "flower" | "vortex" | "crown" | "skull"
  // bundle-exclusive
  | "heartburst" | "icecrown" | "emeraldbloom" | "bloodfork" | "eclipse" | "blackcorona" | "sovereign" | "sovereignstrike"
  // ranking prizes
  | "hourglass" | "supernova" | "timestop" | "singularity" | "crossedswords" | "shieldburst" | "arenafrost" | "thunderclap" | "standard" | "laurelcrown" | "glacierseal" | "cometstrike";

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
  // ---- PACOTES: each bundle skin has a trail and an impact no other skin has ----
  INFERNO_PACK_EMBERHEART: { trail: "heartfire", impact: "heartburst", c2: "#ffe08a" },
  FROSTBORN_PACK_WINTER_CROWN: { trail: "frostcrown", impact: "icecrown", c2: "#ffffff" },
  IRONWOOD_PACK_EMERALD_SENTINEL: { trail: "emerald", impact: "emeraldbloom", c2: "#ffd860" },
  STORMCALLER_PACK_CRIMSON_STORM: { trail: "bloodstorm", impact: "bloodfork", c2: "#2a0408" },
  IRONWOOD_PACK_ECLIPSE: { trail: "eclipse", impact: "eclipse", c2: "#0a080c" },
  FROSTBORN_PACK_ECLIPSE: { trail: "blackfrost", impact: "blackcorona", c2: "#0a080c" },
  INFERNO_PACK_SOVEREIGN: { trail: "royal", impact: "sovereign", c2: "#ffffff" },
  STORMCALLER_PACK_SOVEREIGN: { trail: "royalbolt", impact: "sovereignstrike", c2: "#ffffff" },
  // ---- RANKING prizes: Eterno (violet & gold), Arena (crimson & bronze), Season (royal blue & silver) ----
  IRONWOOD_ETERNAL_RANK: { trail: "sand", impact: "hourglass", c2: "#b07aff" },
  INFERNO_ETERNAL_RANK: { trail: "nebula", impact: "supernova", c2: "#8a3aff" },
  FROSTBORN_ETERNAL_RANK: { trail: "clockrings", impact: "timestop", c2: "#ffd878" },
  STORMCALLER_ETERNAL_RANK: { trail: "starfall", impact: "singularity", c2: "#ffffff" },
  IRONWOOD_ARENA_RANK: { trail: "blades", impact: "crossedswords", c2: "#e8ecf4" },
  INFERNO_ARENA_RANK: { trail: "warflame", impact: "shieldburst", c2: "#c8201a" },
  FROSTBORN_ARENA_RANK: { trail: "shieldshards", impact: "arenafrost", c2: "#d8963a" },
  STORMCALLER_ARENA_RANK: { trail: "gongrings", impact: "thunderclap", c2: "#ff5a2a" },
  IRONWOOD_SEASON_RANK: { trail: "banners", impact: "standard", c2: "#2a5ad8" },
  INFERNO_SEASON_RANK: { trail: "laurel", impact: "laurelcrown", c2: "#4a9aff" },
  FROSTBORN_SEASON_RANK: { trail: "silvermist", impact: "glacierseal", c2: "#7aa8ff" },
  STORMCALLER_SEASON_RANK: { trail: "comet", impact: "cometstrike", c2: "#4a8aff" },
};

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w, y);
  ctx.closePath();
}
function crownShape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x - w, y + h);
  ctx.lineTo(x - w, y);
  ctx.lineTo(x - w / 2, y + h * 0.5);
  ctx.lineTo(x, y - h * 0.3);
  ctx.lineTo(x + w / 2, y + h * 0.5);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

const PACK_TRAILS = new Set<Trail>([
  "heartfire", "frostcrown", "emerald", "bloodstorm", "eclipse", "blackfrost", "royal", "royalbolt",
  "sand", "nebula", "clockrings", "starfall", "blades", "warflame", "shieldshards", "gongrings", "banners", "laurel", "silvermist", "comet",
]);
function sword(ctx: CanvasRenderingContext2D, len: number, w: number, blade: string, hilt: string) {
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(0, -len);
  ctx.lineTo(w, -len * 0.85);
  ctx.lineTo(w, 0);
  ctx.lineTo(-w, 0);
  ctx.lineTo(-w, -len * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hilt;
  ctx.fillRect(-w * 3, 0, w * 6, w * 1.2);
  ctx.fillRect(-w * 0.6, w * 1.2, w * 1.2, len * 0.22);
}
function leafPair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = fill;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sd * r * 0.55, 0, r * 0.32, r, sd * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

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
    // bundle skins: a soft light around the shot, so it reads as glowing energy rather than flat shapes
    if (PACK_TRAILS.has(sig.trail) && i < 3) {
      const gr = (9 - i * 2) * k;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, gr);
      g.addColorStop(0, hexA(col, 0.55 * fade));
      g.addColorStop(1, hexA(col, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, gr, 0, Math.PI * 2);
      ctx.fill();
    }
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
      // ---- ranking trails ----
      case "sand":
        // a stream of golden sand grains in a violet haze
        for (let g = 0; g < 3; g++) {
          ctx.fillStyle = g ? col : c2;
          ctx.beginPath();
          ctx.arc(q.x + (R() - 0.5) * 7, q.y + (R() - 0.5) * 7 + i * 0.6, (0.6 + R() * 0.9) * k, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "nebula": {
        const g = ctx.createRadialGradient(q.x + jx, q.y + jy, 0, q.x + jx, q.y + jy, (5 + i * 1.1) * k);
        g.addColorStop(0, hexA(i % 2 ? col : c2, 0.5 * fade));
        g.addColorStop(1, hexA(c2, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy, (5 + i * 1.1) * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(q.x + jx * 1.4, q.y + jy * 1.4, 1.2, 1.2);
        break;
      }
      case "clockrings":
        if (i % 2 === 0) {
          const r = (3.2 - i * 0.25) * k;
          ctx.lineWidth = 1;
          ctx.strokeStyle = i ? col : c2;
          ctx.beginPath();
          ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
          ctx.stroke();
          const h = now * 8 + i;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x + Math.cos(h) * r * 0.85, q.y + Math.sin(h) * r * 0.85);
          ctx.stroke();
        }
        break;
      case "starfall":
        ctx.strokeStyle = i % 2 ? col : c2;
        ctx.lineWidth = 1.1 * k;
        ctx.beginPath();
        ctx.moveTo(q.x + jx, q.y + jy);
        ctx.lineTo(q.x + jx - 3 * k, q.y + jy - 6 * k);
        ctx.stroke();
        star(ctx, q.x + jx, q.y + jy, 1.8 * k * fade + 0.5, 4, 0.35, now * 4);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        break;
      case "blades":
        if (i % 2 === 0) {
          ctx.save();
          ctx.translate(q.x + jx * 0.5, q.y + jy * 0.5);
          ctx.rotate(now * 14 + i * 1.3);
          sword(ctx, 5 * k, 0.7 * k, c2, col);
          ctx.restore();
        }
        break;
      case "warflame": {
        const fl = (4 - i * 0.35) * k * (1 + Math.sin(now * 30 + i) * 0.2);
        ctx.fillStyle = i < 2 ? col : c2;
        ctx.beginPath();
        ctx.moveTo(q.x - fl * 0.6, q.y);
        ctx.quadraticCurveTo(q.x, q.y - fl * 2.2, q.x + fl * 0.6, q.y);
        ctx.quadraticCurveTo(q.x, q.y + fl * 0.5, q.x - fl * 0.6, q.y);
        ctx.fill();
        break;
      }
      case "shieldshards":
        ctx.save();
        ctx.translate(q.x + jx, q.y + jy);
        ctx.rotate(now * 9 + i);
        ctx.fillStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.moveTo(0, -2.6 * k);
        ctx.lineTo(2 * k, 1.6 * k);
        ctx.lineTo(-2 * k, 1.6 * k);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      case "gongrings":
        if (i % 2 === 0) {
          ctx.lineWidth = 1.4 * k * fade;
          ctx.strokeStyle = i ? c2 : col;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (2 + i * 1.1) * k, (4 + i * 2.2) * k, Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case "banners":
        if (i % 2 === 0) {
          const wv = Math.sin(now * 16 + i) * 1.4;
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y - 4 * k);
          ctx.lineTo(q.x + 5 * k, q.y - 3 * k + wv);
          ctx.lineTo(q.x, q.y - 1 * k);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y - 5 * k);
          ctx.lineTo(q.x, q.y + 2 * k);
          ctx.stroke();
        }
        break;
      case "laurel":
        leafPair(ctx, q.x, q.y, 2.6 * k * fade + 0.8, Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x) + Math.PI / 2, i % 2 ? c2 : col);
        break;
      case "silvermist":
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = i % 2 ? "#e8eef8" : c2;
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy, (2.6 + i * 0.7) * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#ffffff";
        diamond(ctx, q.x - jx, q.y - jy, 0.7 * k, 1.8 * k);
        ctx.fill();
        break;
      case "comet": {
        const w = (4.2 - i * 0.55) * k;
        if (w > 0) {
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, w * 1.6);
          g.addColorStop(0, hexA(i ? c2 : "#ffffff", fade));
          g.addColorStop(1, hexA(c2, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, w * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      // ---- bundle-exclusive trails ----
      case "heartfire": {
        const pulse = 1 + Math.sin(now * 18 + i) * 0.25;
        ctx.fillStyle = i % 2 ? col : c2;
        heart(ctx, q.x + jx * 0.6, q.y + jy * 0.6 - i, (2.6 - i * 0.22) * k * pulse);
        ctx.fill();
        break;
      }
      case "frostcrown":
        if (i === 0) {
          ctx.fillStyle = c2;
          crownShape(ctx, q.x, q.y - 6 * k, 3.6 * k, 2.8 * k);
          ctx.fill();
        }
        ctx.fillStyle = i % 2 ? col : c2;
        diamond(ctx, q.x + jx, q.y + jy, 1.1 * k, 2.6 * k);
        ctx.fill();
        break;
      case "emerald":
        ctx.fillStyle = col;
        diamond(ctx, q.x + jx, q.y + jy, 1.8 * k * fade + 0.5, 2.8 * k * fade + 0.8);
        ctx.fill();
        ctx.strokeStyle = c2;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        break;
      case "bloodstorm":
        if (i > 0) {
          const q0 = pointAt(p, Math.max(0, progress - (i - 1) * 0.07));
          const mx = (q0.x + q.x) / 2 + (R() - 0.5) * 12, my = (q0.y + q.y) / 2 + (R() - 0.5) * 12;
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = c2;
          ctx.lineWidth = 3.4 * k;
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo(mx, my);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.6 * k;
          ctx.stroke();
        }
        break;
      case "eclipse":
      case "blackfrost":
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, (3.4 - i * 0.3) * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, (3.4 - i * 0.3) * k + 0.8, 0, Math.PI * 2);
        ctx.stroke();
        if (sig.trail === "blackfrost") {
          ctx.fillStyle = "#e8f4ff";
          diamond(ctx, q.x + jx * 1.6, q.y + jy * 1.6, 0.9 * k, 2.2 * k);
          ctx.fill();
        }
        break;
      case "royal":
      case "royalbolt":
        if (sig.trail === "royalbolt" && i > 0) {
          const q0 = pointAt(p, Math.max(0, progress - (i - 1) * 0.07));
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8 * k;
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo((q0.x + q.x) / 2 + (R() - 0.5) * 7, (q0.y + q.y) / 2 + (R() - 0.5) * 7);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        if (i % 2) {
          ctx.fillStyle = c2;
          star(ctx, q.x + jx, q.y + jy, 2.6 * k * fade + 0.6, 4, 0.3, now * 5 + i);
          ctx.fill();
        } else if (sig.trail === "royal") {
          ctx.save();
          ctx.translate(q.x + jx, q.y + jy);
          ctx.rotate(now * 3 + i);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, 0, 4 * k, 1.3 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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
    // ---- ranking impacts ----
    case "hourglass": {
      const hy = y - 10 * S - e * 4;
      const w = 5 * S, h = 7 * S;
      ctx.lineWidth = 1.6 * S;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - w, hy - h);
      ctx.lineTo(x + w, hy - h);
      ctx.lineTo(x - w, hy + h);
      ctx.lineTo(x + w, hy + h);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = col;
      const sand = Math.min(1, e * 1.4);
      ctx.beginPath();
      ctx.moveTo(x - w * sand, hy + h);
      ctx.lineTo(x + w * sand, hy + h);
      ctx.lineTo(x, hy + h - h * sand * 0.8);
      ctx.fill();
      ctx.fillRect(x - 0.5, hy - h * (1 - sand), 1, h * 2 * (1 - sand * 0.5));
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2 * S * a;
      ctx.beginPath();
      ctx.ellipse(x, y, (6 + e * 18) * S, (3 + e * 9) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "supernova": {
      const g = ctx.createRadialGradient(x, y - 3 * S, 0, x, y - 3 * S, (6 + e * 20) * S);
      g.addColorStop(0, hexA("#ffffff", a));
      g.addColorStop(0.3, hexA(col, a * 0.8));
      g.addColorStop(1, hexA(c2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 3 * S, (6 + e * 20) * S, 0, Math.PI * 2);
      ctx.fill();
      for (const r of [0.6, 1]) {
        ctx.strokeStyle = r < 1 ? col : c2;
        ctx.lineWidth = 1.6 * S * a;
        ctx.beginPath();
        ctx.ellipse(x, y - 3 * S, (4 + e * 22 * r) * S, (2 + e * 11 * r) * S, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = "#ffffff";
        star(ctx, x + Math.cos(i + R() * 6) * (6 + e * 16) * S, y - 3 * S + Math.sin(i + R() * 6) * (3 + e * 8) * S, 1.6 * S * a + 0.4, 4, 0.3);
        ctx.fill();
      }
      break;
    }
    case "timestop": {
      const r = (6 + Math.min(1, e * 2) * 8) * S;
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.8 * S;
      ctx.beginPath();
      ctx.arc(x, y - 6 * S, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = col;
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2;
        const l = i % 3 ? 0.85 : 0.72;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r * l, y - 6 * S + Math.sin(an) * r * l);
        ctx.lineTo(x + Math.cos(an) * r * 0.95, y - 6 * S + Math.sin(an) * r * 0.95);
        ctx.stroke();
      }
      ctx.lineWidth = 1.4 * S;
      for (const [len, sp] of [[0.55, 2], [0.85, 9]] as const) {
        const an = -Math.PI / 2 + t * sp * (1 - t);
        ctx.beginPath();
        ctx.moveTo(x, y - 6 * S);
        ctx.lineTo(x + Math.cos(an) * r * len, y - 6 * S + Math.sin(an) * r * len);
        ctx.stroke();
      }
      break;
    }
    case "singularity": {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0a0614";
      ctx.beginPath();
      ctx.arc(x, y - 4 * S, (3 + (1 - e) * 4) * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 4; arm++) {
        ctx.strokeStyle = arm % 2 ? col : c2;
        ctx.lineWidth = 1.5 * S * a;
        ctx.beginPath();
        for (let k2 = 0; k2 <= 20; k2++) {
          const u = k2 / 20;
          const rr = (16 * (1 - u) * (1 - e * 0.6) + 3) * S;
          const an = arm * (Math.PI / 2) + u * 4 + e * 6;
          const px = x + Math.cos(an) * rr, py = y - 4 * S + Math.sin(an) * rr * 0.55;
          if (k2) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      ctx.arc(x, y - 4 * S, (4 + (1 - e) * 4) * S, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "crossedswords": {
      const cut = Math.min(1, e * 2.5);
      for (const sd of [-1, 1]) {
        ctx.save();
        ctx.translate(x, y - 6 * S);
        ctx.rotate(sd * (1.4 - cut * 0.75));
        ctx.translate(0, 8 * S);
        sword(ctx, 16 * S, 1.1 * S, c2, col);
        ctx.restore();
      }
      if (cut >= 1) {
        for (let i = 0; i < 10; i++) {
          const an = R() * Math.PI * 2;
          const d = (3 + e * 14) * S * R();
          ctx.fillStyle = i % 2 ? "#ffffff" : col;
          ctx.fillRect(x + Math.cos(an) * d, y - 6 * S + Math.sin(an) * d, 1.4 * S * a, 1.4 * S * a);
        }
      }
      break;
    }
    case "shieldburst": {
      const sy = y - 6 * S;
      const r = 7 * S;
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2;
        const off = e * 14 * S;
        ctx.save();
        ctx.translate(x + Math.cos(an + 0.5) * off, sy + Math.sin(an + 0.5) * off * 0.7);
        ctx.rotate(e * (i % 2 ? 2 : -2));
        ctx.fillStyle = i % 2 ? c2 : "#7a1410";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, an, an + Math.PI / 3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2 * S;
        ctx.stroke();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(x, sy, 0, x, sy, (8 + e * 12) * S);
      g.addColorStop(0, hexA("#ffe0a0", a));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, sy, (8 + e * 12) * S, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "arenafrost": {
      const grow = Math.min(1, e * 2);
      for (let i = 0; i < 9; i++) {
        const an = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
        for (const sd of [-1, 1]) leafPair(ctx, x + sd * Math.cos(an) * 12 * S, y - 4 * S - Math.sin(an) * 9 * S * grow, 2.4 * S, sd * (an - Math.PI / 2), c2);
      }
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2 + R();
        ctx.fillStyle = i % 2 ? "#ffffff" : col;
        diamond(ctx, x + Math.cos(an) * (4 + e * 10) * S, y + Math.sin(an) * (2 + e * 5) * S, 1.4 * S, 3.4 * S * grow);
        ctx.fill();
      }
      break;
    }
    case "thunderclap":
      for (let r = 0; r < 3; r++) {
        const u = Math.max(0, e - r * 0.18);
        ctx.strokeStyle = r % 2 ? c2 : col;
        ctx.lineWidth = (2.4 - r * 0.5) * S * a;
        ctx.beginPath();
        ctx.ellipse(x, y, (4 + u * 26) * S, (2 + u * 13) * S, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (t < 0.4) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.2 * S;
        ctx.beginPath();
        let px = x, py = y - 40 * S;
        ctx.moveTo(px, py);
        while (py < y) {
          py += 7 * S;
          px = x + (R() - 0.5) * 8 * S;
          ctx.lineTo(px, Math.min(py, y));
        }
        ctx.stroke();
      }
      break;
    case "standard": {
      const rise = Math.min(1, e * 2.2);
      const top = y - 22 * S * rise;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4 * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, top);
      ctx.stroke();
      const wv = Math.sin(t * 20) * 1.5 * S;
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(x, top + 1 * S);
      ctx.lineTo(x + 11 * S, top + 2 * S + wv);
      ctx.lineTo(x + 11 * S, top + 9 * S + wv);
      ctx.lineTo(x + 5.5 * S, top + 7 * S);
      ctx.lineTo(x, top + 9 * S);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      star(ctx, x + 5.5 * S, top + 4.5 * S + wv * 0.5, 2 * S, 5, 0.45);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6 * S * a;
      ctx.beginPath();
      ctx.ellipse(x, y, (4 + e * 14) * S, (2 + e * 7) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "laurelcrown": {
      const n = Math.ceil(Math.min(1, e * 2) * 10);
      for (let i = 0; i < n; i++) {
        const an = Math.PI * 0.2 + (i / 9) * Math.PI * 0.8;
        for (const sd of [-1, 1]) leafPair(ctx, x + sd * Math.cos(an) * 10 * S, y - 10 * S - Math.sin(an - Math.PI * 0.5) * 8 * S, 2.6 * S, sd * an, i % 2 ? col : c2);
      }
      const g = ctx.createRadialGradient(x, y - 4 * S, 0, x, y - 4 * S, (6 + e * 10) * S);
      g.addColorStop(0, hexA(c2, a));
      g.addColorStop(1, hexA(c2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 4 * S, (6 + e * 10) * S, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "glacierseal": {
      const r = (5 + Math.min(1, e * 2) * 9) * S;
      ctx.save();
      ctx.translate(x, y - 2 * S);
      ctx.scale(1, 0.55);
      ctx.rotate(e * 0.8);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(Math.cos((i / 6) * Math.PI * 2) * r, Math.sin((i / 6) * Math.PI * 2) * r);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2 * S;
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      star(ctx, x, y - 10 * S - e * 6, 3.4 * S, 5, 0.45, e * 2);
      ctx.fill();
      break;
    }
    case "cometstrike": {
      const fall = Math.min(1, t * 3);
      const hx = x + (1 - fall) * 22 * S, hy = y - (1 - fall) * 40 * S;
      if (fall < 1) {
        const g = ctx.createLinearGradient(hx, hy, hx + 16 * S, hy - 28 * S);
        g.addColorStop(0, hexA("#ffffff", 1));
        g.addColorStop(1, hexA(c2, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3 * S;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 16 * S, hy - 28 * S);
        ctx.stroke();
      } else {
        const u = (t - 1 / 3) * 1.5;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2 * S * (1 - u);
        ctx.beginPath();
        ctx.ellipse(x, y, (4 + u * 20) * S, (2 + u * 10) * S, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const an = (i / 8) * Math.PI * 2;
          ctx.fillStyle = i % 2 ? c2 : "#ffffff";
          ctx.beginPath();
          ctx.arc(x + Math.cos(an) * u * 16 * S, y + Math.sin(an) * u * 8 * S - u * 6 * S, 1.4 * S * (1 - u) + 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    // ---- bundle-exclusive impacts ----
    case "heartburst": {
      ctx.lineWidth = 2.4 * S * a + 0.6;
      ctx.strokeStyle = c2;
      heart(ctx, x, y - 4 * S, (4 + e * 12) * S);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * Math.PI * 2 + R();
        const d = (5 + e * 18) * S;
        ctx.fillStyle = i % 2 ? col : c2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6 - e * 6, 1.6 * S * a + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "icecrown":
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        const px = x + Math.cos(an) * 12 * S, py = y + Math.sin(an) * 6 * S;
        const h = (i % 2 ? 7 : 11) * S * Math.min(1, e * 2);
        ctx.fillStyle = i % 2 ? col : c2;
        diamond(ctx, px, py - h / 2, 1.8 * S, h / 2);
        ctx.fill();
      }
      ctx.fillStyle = c2;
      crownShape(ctx, x, y - 14 * S - e * 8, 6 * S, 4.5 * S);
      ctx.fill();
      break;
    case "emeraldbloom":
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        const d = (3 + e * 15) * S;
        ctx.save();
        ctx.translate(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6);
        ctx.rotate(an + Math.PI / 2);
        ctx.fillStyle = col;
        diamond(ctx, 0, 0, 2.2 * S, 4.2 * S);
        ctx.fill();
        ctx.strokeStyle = c2;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = c2;
      ctx.lineWidth = 1.6 * S * a;
      ctx.beginPath();
      ctx.ellipse(x, y, (5 + e * 20) * S, (3 + e * 11) * S, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "bloodfork":
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = c2;
      ctx.globalAlpha = a * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y, (6 + e * 14) * S, (3 + e * 7) * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2 + R();
        let px = x, py = y;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2 * S * a + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k2 = 0; k2 < 3; k2++) {
          px += Math.cos(an + (R() - 0.5)) * 7 * S * (0.4 + e);
          py += Math.sin(an + (R() - 0.5)) * 4 * S * (0.4 + e);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    case "eclipse":
    case "blackcorona": {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(x, y - 4 * S, 6 * S * (1 - e * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2 * S * a + 0.5;
      ctx.beginPath();
      ctx.arc(x, y - 4 * S, (7 + e * 10) * S, 0, Math.PI * 2);
      ctx.stroke();
      const n = im.sig.impact === "eclipse" ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + e;
        const r0 = (8 + e * 10) * S, r1 = r0 + (i % 2 ? 4 : 8) * S;
        if (im.sig.impact === "eclipse") {
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(an) * r0, y - 4 * S + Math.sin(an) * r0);
          ctx.lineTo(x + Math.cos(an) * r1, y - 4 * S + Math.sin(an) * r1);
          ctx.stroke();
        } else {
          ctx.fillStyle = i % 2 ? "#e8f4ff" : col;
          ctx.save();
          ctx.translate(x + Math.cos(an) * r0, y - 4 * S + Math.sin(an) * r0);
          ctx.rotate(an + Math.PI / 2);
          diamond(ctx, 0, 0, 1.6 * S, 4 * S);
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }
    case "sovereign":
    case "sovereignstrike": {
      const sy = y - 10 * S - e * 6;
      if (im.sig.impact === "sovereignstrike") {
        ctx.fillStyle = col;
        ctx.globalAlpha = a * 0.7;
        ctx.fillRect(x - 3 * S * a, sy - 40 * S, 6 * S * a, 44 * S);
        ctx.globalAlpha = a;
      }
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(x, sy, 5 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8 * S * a + 0.4;
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * 6 * S, sy + Math.sin(an) * 6 * S);
        ctx.lineTo(x + Math.cos(an) * (9 + e * 10) * S, sy + Math.sin(an) * (9 + e * 10) * S);
        ctx.stroke();
      }
      for (const sd of [-1, 1]) {
        for (let k2 = 0; k2 < 4; k2++) {
          ctx.save();
          ctx.translate(x + sd * (8 + k2 * 4) * S, sy + 2 * S - k2 * 1.5 * S);
          ctx.rotate(sd * (0.4 + k2 * 0.25));
          ctx.fillStyle = k2 % 2 ? col : c2;
          ctx.beginPath();
          ctx.ellipse(0, 0, 1.2 * S, (6 - k2) * S * Math.min(1, e * 2), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = col;
      crownShape(ctx, x, sy - 12 * S, 4.5 * S, 3.4 * S);
      ctx.fill();
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
