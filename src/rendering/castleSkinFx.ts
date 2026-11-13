/**
 * SKINS DE CASTELO — the equipped castle skin on the realistic castle:
 *   - the castle sprite recolored with the skin's hue (a "color" blend that
 *     keeps every baked shadow and highlight), cached per image + skin;
 *   - the skin's living aura around the castle (embers, frost, sun rays,
 *     leaves and fireflies, void motes, or the recruit's banners).
 * GameEngine sets the active skin at startRun from the save; the Home
 * cinematic and the Store preview pass one explicitly. Purely cosmetic.
 */
import { getCastleSkinDefinition, type CastleSkinDefinition } from "@/config/castleSkins";
import { castleAnchor, CASTLE_SPRITE_SIZE, castleSpriteOrigin } from "./castleSprites";

let active: CastleSkinDefinition | null = null;

/** Pass to drawFortress to force the plain castle (ignoring the equipped skin) — e.g. the Store's "default" card. */
export const NO_CASTLE_SKIN: CastleSkinDefinition = { id: "__none", i18nKey: "", paletteOverride: {}, source: "STORE", tint: "#000000", tintStrength: 0, glow: "#ffb45a", aura: "BANNERS" };

export function setActiveCastleSkin(id: string | null): void {
  active = id ? getCastleSkinDefinition(id) : null;
}

export function getActiveCastleSkin(): CastleSkinDefinition | null {
  return active;
}

const tintCache = new Map<string, HTMLCanvasElement>();

/** The castle sprite recolored for a skin (null when it can't be built — the caller then draws the plain sprite). */
export function tintedCastle(image: HTMLImageElement, skin: CastleSkinDefinition): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !image.naturalWidth) return null;
  const key = `${image.src}|${skin.id}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(image, 0, 0);
  g.globalCompositeOperation = "color";
  g.globalAlpha = skin.tintStrength;
  g.fillStyle = skin.tint;
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-in";
  g.drawImage(image, 0, 0);
  tintCache.set(key, c);
  return c;
}

function hash(n: number): number {
  const x = Math.sin(n * 91.3458) * 47453.5453;
  return x - Math.floor(x);
}

/** The skin's aura, in fortress-local space (same transform the castle sprite is drawn in). */
export function drawCastleSkinAura(ctx: CanvasRenderingContext2D, skin: CastleSkinDefinition, tier: number, timeMs: number): void {
  const t = timeMs / 1000;
  const o = castleSpriteOrigin();
  const top = o.y + CASTLE_SPRITE_SIZE * 0.08;
  const bottom = castleAnchor("base", tier).y;
  const left = o.x + CASTLE_SPRITE_SIZE * 0.15;
  const width = CASTLE_SPRITE_SIZE * 0.7;
  ctx.save();
  // glow pools on the windows in the skin's colour
  ctx.globalCompositeOperation = "lighter";
  for (const name of ["keepWindow", "towerWindowL", "towerWindowR", "core"]) {
    const w = castleAnchor(name, tier);
    const f = 0.6 + 0.4 * Math.sin(t * 2.3 + w.x);
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, name === "core" ? 16 : 9);
    g.addColorStop(0, hexA(skin.glow, 0.45 * f));
    g.addColorStop(1, hexA(skin.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w.x, w.y, name === "core" ? 16 : 9, 0, Math.PI * 2);
    ctx.fill();
  }

  const n = 16;
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.18 + hash(i) * 0.12) + hash(i + 3)) % 1;
    const x0 = left + hash(i + 7) * width;
    switch (skin.aura) {
      case "EMBER": {
        const y = bottom - ph * (bottom - top + 20);
        ctx.fillStyle = hexA(i % 3 ? "#ff8a3a" : "#ffd27a", (1 - ph) * 0.9);
        ctx.beginPath();
        ctx.arc(x0 + Math.sin(t * 2 + i) * 5, y, 1.3 + (1 - ph), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "FROST": {
        // snowflakes drifting down, and a cold shimmer
        const y = top - 10 + ph * (bottom - top + 14);
        ctx.fillStyle = `rgba(230,245,255,${Math.sin(ph * Math.PI) * 0.9})`;
        ctx.beginPath();
        ctx.arc(x0 + Math.sin(t + i) * 6, y, 1.2 + hash(i + 2), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "SOLAR": {
        if (i >= 8) break;
        const a = -Math.PI / 2 + (i - 3.5) * 0.22 + Math.sin(t * 0.4) * 0.05;
        const keep = castleAnchor("bannerKeep", tier);
        const len = 70 + 20 * Math.sin(t * 1.3 + i);
        const g = ctx.createLinearGradient(keep.x, keep.y, keep.x + Math.cos(a) * len, keep.y + Math.sin(a) * len);
        g.addColorStop(0, "rgba(255,240,190,0.28)");
        g.addColorStop(1, "rgba(255,240,190,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(keep.x, keep.y + 6);
        ctx.lineTo(keep.x + Math.cos(a) * len, keep.y + Math.sin(a) * len);
        ctx.stroke();
        break;
      }
      case "VERDANT": {
        // fireflies wandering around the walls
        const x = x0 + Math.sin(t * 0.7 + i * 1.3) * 10;
        const y = top + 20 + hash(i + 11) * (bottom - top - 20) + Math.cos(t * 0.9 + i) * 6;
        const blink = Math.max(0, Math.sin(t * 2 + i * 2.1));
        ctx.fillStyle = `rgba(216,255,154,${blink * 0.85})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "VOID": {
        const a = t * 0.6 + (i / n) * Math.PI * 2;
        const r = 60 + 10 * Math.sin(t + i);
        const cx = castleAnchor("core", tier);
        ctx.fillStyle = hexA(i % 2 ? "#c79bff" : "#7a4ad8", 0.75);
        ctx.beginPath();
        ctx.arc(cx.x + Math.cos(a) * r, cx.y - 26 + Math.sin(a) * r * 0.35, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "SHARDS": {
        // small black-glass shards drifting up around the walls, catching jade light
        if (i >= 10) break;
        const y = bottom - ph * (bottom - top + 10);
        const x = x0 + Math.sin(t * 0.8 + i) * 6;
        const rot = t * (0.6 + hash(i + 5)) + i;
        const sz = 2.2 + hash(i + 9) * 2;
        const a = Math.sin(ph * Math.PI);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = `rgba(12,16,20,${0.9 * a})`;
        ctx.strokeStyle = `rgba(110,255,232,${0.85 * a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.6);
        ctx.lineTo(sz * 0.7, 0);
        ctx.lineTo(0, sz * 1.6);
        ctx.lineTo(-sz * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "BANNERS":
        break;
    }
  }
  ctx.globalCompositeOperation = "source-over";
  if (skin.aura === "BANNERS") {
    // the recruit's red-and-gold pennants on every pole
    for (const [k, name] of ["bannerKeep", "bannerTowerL", "bannerTowerR"].entries()) {
      const b = castleAnchor(name, tier);
      const wave = Math.sin(t * 3 + k) * 3;
      ctx.fillStyle = k === 0 ? "#c0392b" : "#d9a441";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 2);
      ctx.quadraticCurveTo(b.x + 9, b.y + 3 + wave, b.x + 18, b.y + 6 + wave);
      ctx.lineTo(b.x, b.y + 11);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
