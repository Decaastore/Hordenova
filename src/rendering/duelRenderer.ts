import { CASTLE_AT, LANE_H, LANE_SLOTS, LANE_W, lanePath, slotPos, type DuelSnapshot, type Pt, type Side } from "@/engine/DuelEngine";
import { MAX_DUEL_TOWER_LEVEL } from "@/config/duel";
import { drawEnemy, drawEnemyHpBar, drawTower } from "./EntityRenderer";
import { getCastleSprite } from "./castleSprites";

/**
 * DUELO — the board: two lanes on the arena's own ground, a paved road with
 * its stones, stone plinths for towers, a portal where creatures come in,
 * a carved wall with torches between the lanes, travelling projectiles,
 * death puffs and castle hits. Purely visual; reads only the snapshot.
 */

export const DUEL_W = LANE_W * 2;
export const DUEL_H = LANE_H;

interface ArenaLook {
  ground: [string, string];
  road: [string, string, string];
  stone: [string, string];
  portal: string;
  mote: string;
  moteKind: "leaf" | "ember" | "snow" | "wisp";
}

const LOOK: Record<string, ArenaLook> = {
  ARENA_FOREST: { ground: ["#1d2a15", "#0d1409"], road: ["#3b2a1a", "#7a5a38", "#8f6c46"], stone: ["#9a8462", "#5e4c34"], portal: "150,90,255", mote: "170,220,110", moteKind: "leaf" },
  ARENA_VOLCANO: { ground: ["#2e1810", "#120806"], road: ["#2a1810", "#5e3a26", "#734a30"], stone: ["#7a5a48", "#3e2a20"], portal: "255,110,40", mote: "255,150,60", moteKind: "ember" },
  ARENA_TUNDRA: { ground: ["#1a2632", "#0b1218"], road: ["#2a3038", "#5e6874", "#76828e"], stone: ["#a8b4c0", "#5a6470"], portal: "120,200,255", mote: "235,245,255", moteKind: "snow" },
  ARENA_ABYSS: { ground: ["#1e1729", "#0b0812"], road: ["#1e1626", "#4a3a58", "#5c4a6c"], stone: ["#7a6a8c", "#3a2e48"], portal: "200,80,255", mote: "200,140,255", moteKind: "wisp" },
};

const SHOT: Record<string, { rgb: string; speed: number }> = {
  IRONWOOD: { rgb: "255,226,160", speed: 1 },
  INFERNO: { rgb: "255,120,40", speed: 0.8 },
  FROSTBORN: { rgb: "150,225,255", speed: 0.9 },
  STORMCALLER: { rgb: "196,150,255", speed: 1 },
};

// ── cached images ───────────────────────────────────────────────────────
const groundCache = new Map<string, HTMLImageElement>();
function groundImage(biome: string): HTMLImageElement | null {
  const key = biome.toLowerCase();
  let img = groundCache.get(key);
  if (!img) {
    img = new Image();
    img.src = `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}sprites/ground/${key}.webp`;
    groundCache.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** The static part of the board (ground, road, wall), drawn once per arena into an offscreen canvas. */
const boardCache = new Map<string, HTMLCanvasElement>();
function board(arenaId: string, biome: string): HTMLCanvasElement | null {
  const key = `${arenaId}:${biome}`;
  const hit = boardCache.get(key);
  if (hit) return hit;
  const ground = groundImage(biome);
  if (!ground) return null;
  const look = LOOK[arenaId] ?? LOOK.ARENA_FOREST!;
  const cv = document.createElement("canvas");
  cv.width = DUEL_W;
  cv.height = DUEL_H;
  const ctx = cv.getContext("2d")!;
  for (const side of [0, 1] as Side[]) {
    const x0 = side * LANE_W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, LANE_W, DUEL_H);
    ctx.clip();
    // ground: the biome texture, toned down so the road and units read
    ctx.fillStyle = look.ground[0];
    ctx.fillRect(x0, 0, LANE_W, DUEL_H);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(ground, 260 + side * 520, 420, 900, 900 * (DUEL_H / LANE_W), x0, 0, LANE_W, DUEL_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(6,4,2,0.38)";
    ctx.fillRect(x0, 0, LANE_W, DUEL_H);
    // vignette
    const v = ctx.createRadialGradient(x0 + LANE_W / 2, DUEL_H * 0.55, 120, x0 + LANE_W / 2, DUEL_H * 0.55, 520);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = v;
    ctx.fillRect(x0, 0, LANE_W, DUEL_H);
    drawRoad(ctx, lanePath(side), look, side);
    ctx.restore();
  }
  drawWall(ctx);
  boardCache.set(key, cv);
  return cv;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function strokePath(ctx: CanvasRenderingContext2D, path: readonly Pt[], width: number, style: string | CanvasGradient): void {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

function drawRoad(ctx: CanvasRenderingContext2D, path: readonly Pt[], look: ArenaLook, side: Side): void {
  // soft shadow, kerb, packed earth, worn centre
  ctx.save();
  ctx.filter = "blur(6px)";
  strokePath(ctx, path, 70, "rgba(0,0,0,0.55)");
  ctx.restore();
  strokePath(ctx, path, 58, look.road[0]);
  strokePath(ctx, path, 50, look.road[1]);
  strokePath(ctx, path, 30, look.road[2]);
  strokePath(ctx, path, 12, "rgba(255,240,210,0.05)");
  // cobbles along the road
  const r = seeded(17 + side);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let d = 0; d < len; d += 9) {
      for (let k = 0; k < 2; k++) {
        const off = (r() - 0.5) * 46;
        const t = d / len;
        const x = a.x + (b.x - a.x) * t + nx * off;
        const y = a.y + (b.y - a.y) * t + ny * off;
        const s = 2 + r() * 3.2;
        ctx.fillStyle = r() > 0.5 ? look.stone[0] : look.stone[1];
        ctx.globalAlpha = 0.18 + r() * 0.3;
        ctx.beginPath();
        ctx.ellipse(x, y, s * 1.3, s, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  // kerb stones on both edges
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let d = 6; d < len; d += 16) {
      for (const sgn of [-1, 1]) {
        const t = d / len;
        const x = a.x + (b.x - a.x) * t + nx * 27 * sgn;
        const y = a.y + (b.y - a.y) * t + ny * 27 * sgn;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(x + 1, y + 2, 5.5, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = look.stone[1];
        ctx.beginPath();
        ctx.ellipse(x, y, 5.5, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.ellipse(x - 1, y - 1.2, 3, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawWall(ctx: CanvasRenderingContext2D): void {
  const x = LANE_W;
  const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
  g.addColorStop(0, "#1a140e");
  g.addColorStop(0.3, "#4a3c2c");
  g.addColorStop(0.5, "#6a5840");
  g.addColorStop(0.7, "#4a3c2c");
  g.addColorStop(1, "#1a140e");
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - 20, 0, 40, DUEL_H);
  ctx.fillStyle = g;
  ctx.fillRect(x - 13, 0, 26, DUEL_H);
  // block joints
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.5;
  for (let y = 0; y < DUEL_H; y += 22) {
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x + 13, y);
    ctx.stroke();
    const jx = (y / 22) % 2 ? x - 3 : x + 4;
    ctx.beginPath();
    ctx.moveTo(jx, y);
    ctx.lineTo(jx, y + 22);
    ctx.stroke();
  }
}

const TORCH_YS = [90, 250, 410, 560];

function drawTorches(ctx: CanvasRenderingContext2D, timeMs: number): void {
  for (const [i, y] of TORCH_YS.entries()) {
    const f = 0.75 + 0.25 * Math.sin(timeMs / 90 + i * 2.1) * Math.sin(timeMs / 37 + i);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(LANE_W, y, 2, LANE_W, y, 70 * f);
    g.addColorStop(0, `rgba(255,190,90,${0.45 * f})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(LANE_W, y, 70 * f, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#2a1c10";
    ctx.fillRect(LANE_W - 3, y, 6, 14);
    ctx.fillStyle = `rgba(255,${180 + 40 * f},90,1)`;
    ctx.beginPath();
    ctx.ellipse(LANE_W, y - 3, 4 * f, 8 * f, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,250,210,0.9)";
    ctx.beginPath();
    ctx.ellipse(LANE_W, y - 1, 2, 4 * f, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPortal(ctx: CanvasRenderingContext2D, side: Side, look: ArenaLook, timeMs: number): void {
  const p = lanePath(side)[1]!;
  const cx = p.x;
  const cy = 30;
  ctx.save();
  // fog at the top of the lane
  const fog = ctx.createLinearGradient(0, 0, 0, 120);
  fog.addColorStop(0, "rgba(0,0,0,0.85)");
  fog.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fog;
  ctx.fillRect(side * LANE_W, 0, LANE_W, 120);
  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.7 + 0.3 * Math.sin(timeMs / 400);
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
  g.addColorStop(0, `rgba(${look.portal},${0.55 * pulse})`);
  g.addColorStop(1, `rgba(${look.portal},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 60, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${look.portal},0.8)`;
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a0 = timeMs / (700 + k * 260) + k * 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 30 - k * 7, 15 - k * 3.5, 0, a0, a0 + Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlinth(ctx: CanvasRenderingContext2D, p: Pt, empty: boolean, highlight: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 10, 33, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, p.y - 6, 0, p.y + 16);
  g.addColorStop(0, "#8a8070");
  g.addColorStop(1, "#3c362e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 31, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6e665a";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 5, 29, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (empty) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, 18, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (highlight > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,214,120,${highlight})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, 29, 11.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,214,120,${highlight * 0.25})`;
    ctx.fill();
    ctx.restore();
  }
}

function drawMotes(ctx: CanvasRenderingContext2D, look: ArenaLook, timeMs: number): void {
  ctx.save();
  ctx.globalCompositeOperation = look.moteKind === "snow" ? "source-over" : "lighter";
  for (let i = 0; i < 46; i++) {
    const period = 9000 + (i % 7) * 1300;
    const t = ((timeMs + i * 1777) % period) / period;
    const baseX = (i * 263) % DUEL_W;
    const fall = look.moteKind === "ember" || look.moteKind === "wisp" ? -1 : 1;
    const y = fall > 0 ? t * (DUEL_H + 40) - 20 : DUEL_H + 20 - t * (DUEL_H + 40);
    const x = baseX + Math.sin(t * Math.PI * 4 + i) * 22;
    const a = Math.sin(t * Math.PI) * (look.moteKind === "snow" ? 0.7 : 0.55);
    ctx.fillStyle = `rgba(${look.mote},${a})`;
    ctx.beginPath();
    if (look.moteKind === "leaf") ctx.ellipse(x, y, 3, 1.5, t * 12 + i, 0, Math.PI * 2);
    else ctx.arc(x, y, look.moteKind === "snow" ? 1.8 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawShots(ctx: CanvasRenderingContext2D, snap: DuelSnapshot): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of snap.shots) {
    const age = (snap.timeMs - s.at) / 400;
    const look = SHOT[s.type] ?? SHOT.IRONWOOD!;
    const from = { x: s.from.x, y: s.from.y - 40 };
    const to = { x: s.to.x, y: s.to.y - 10 };
    if (s.type === "STORMCALLER") {
      // jagged bolt that fades
      const pts = [from, to, ...(s.hops ?? []).map((h) => ({ x: h.x, y: h.y - 10 }))];
      ctx.strokeStyle = `rgba(${look.rgb},${0.95 * (1 - age)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = `rgba(${look.rgb},1)`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        for (let k = 1; k <= 5; k++) {
          const m = lerp(a, b, k / 5);
          const j = k === 5 ? 0 : (Math.sin(s.at * 0.013 + k * 7.1 + i) * 9);
          ctx.lineTo(m.x + j, m.y - j * 0.6);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      continue;
    }
    const travel = Math.min(1, age / (0.45 / look.speed));
    const head = lerp(from, to, travel);
    const tail = lerp(from, to, Math.max(0, travel - 0.25));
    if (travel < 1) {
      const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0, `rgba(${look.rgb},0)`);
      g.addColorStop(1, `rgba(${look.rgb},0.95)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = s.type === "INFERNO" ? 7 : s.type === "FROSTBORN" ? 4 : 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${look.rgb},1)`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, s.type === "INFERNO" ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // impact
      const k = (age - 0.45 / look.speed) / (1 - 0.45 / look.speed);
      const rad = s.type === "INFERNO" ? 16 + 34 * k : 6 + 14 * k;
      const g = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, rad);
      g.addColorStop(0, `rgba(${look.rgb},${0.8 * (1 - k)})`);
      g.addColorStop(1, `rgba(${look.rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(to.x, to.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDeaths(ctx: CanvasRenderingContext2D, snap: DuelSnapshot): void {
  ctx.save();
  for (const d of snap.deaths) {
    const k = (snap.timeMs - d.at) / 900;
    const r = (d.big ? 26 : 14) * (0.6 + k);
    ctx.fillStyle = `rgba(30,24,20,${0.55 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y - 4 - k * 10, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,200,140,${0.5 * (1 - k)})`;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + d.at;
      ctx.beginPath();
      ctx.arc(d.x + Math.cos(a) * r * 1.1, d.y - 6 + Math.sin(a) * r * 0.6 - k * 18, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function drawCastle(ctx: CanvasRenderingContext2D, side: Side, biome: string, snap: DuelSnapshot, timeMs: number): void {
  const cx = CASTLE_AT.x + side * LANE_W;
  const cy = CASTLE_AT.y;
  const img = getCastleSprite(biome, 3) ?? getCastleSprite(biome, 2);
  const last = snap.breaches.filter((b) => b.side === side).pop();
  const k = last ? (snap.timeMs - last.at) / 1200 : 1;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 92, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) {
    const size = 210;
    const shake = k < 0.25 ? Math.sin(timeMs / 18) * 3 * (1 - k * 4) : 0;
    ctx.save();
    if (k < 0.3) ctx.filter = `brightness(${1 + 1.2 * (1 - k / 0.3)}) saturate(0.6)`;
    ctx.drawImage(img, cx - size / 2 + shake, cy - size * 0.66, size, size);
    ctx.restore();
  }
  if (k < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,80,60,${0.8 * (1 - k)})`;
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 40 + 90 * k, 14 + 30 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.font = "bold 26px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255,110,90,${1 - k})`;
    ctx.strokeStyle = `rgba(0,0,0,${0.8 * (1 - k)})`;
    ctx.lineWidth = 4;
    ctx.strokeText(`−${last!.dmg}`, cx, cy - 120 - k * 30);
    ctx.fillText(`−${last!.dmg}`, cx, cy - 120 - k * 30);
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, b: { color: string; color2: string }, timeMs: number): void {
  for (const dx of [-62, 62]) {
    const x = CASTLE_AT.x + dx;
    const top = CASTLE_AT.y - 150;
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(x - 1.5, top, 3, 70);
    ctx.fillStyle = "#e8c06a";
    ctx.beginPath();
    ctx.arc(x, top, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const w = 26;
    const h = 40;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 1.5, top + 4);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      ctx.lineTo(x + 1.5 + t * w, top + 4 + Math.sin(timeMs / 260 + t * 4 + dx) * 2.5 * t);
    }
    for (let i = 8; i >= 0; i--) {
      const t = i / 8;
      const notch = t > 0.85 ? -6 * ((t - 0.85) / 0.15) : 0;
      ctx.lineTo(x + 1.5 + t * w, top + 4 + h + notch + Math.sin(timeMs / 260 + t * 4 + dx) * 2.5 * t);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(x, top, x + w, top + h);
    g.addColorStop(0, b.color);
    g.addColorStop(1, b.color2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/** Draws one frame of the Duel. */
export function drawDuelFrame(
  ctx: CanvasRenderingContext2D,
  snap: DuelSnapshot,
  arenaId: string,
  biome: string,
  timeMs: number,
  pickingSlot: boolean,
  hoverSlot: number | null,
  /** The player's Duel banner (Duel shop cosmetic), flown over their castle. */
  banner: { color: string; color2: string } | null = null,
): void {
  const look = LOOK[arenaId] ?? LOOK.ARENA_FOREST!;
  const b = board(arenaId, biome);
  if (b) ctx.drawImage(b, 0, 0);
  else {
    ctx.fillStyle = look.ground[1];
    ctx.fillRect(0, 0, DUEL_W, DUEL_H);
  }
  for (const side of [0, 1] as Side[]) {
    drawPortal(ctx, side, look, timeMs);
    LANE_SLOTS.forEach((_, i) => {
      const taken = snap.towers.some((t) => t.side === side && t.slot === i);
      const hl = side === 0 && pickingSlot ? (hoverSlot === i ? 1 : 0.45 + 0.3 * Math.sin(timeMs / 220)) : 0;
      drawPlinth(ctx, slotPos(side, i), !taken, hl);
    });
  }
  drawTorches(ctx, timeMs);

  // depth-sorted towers, units and castles
  const items: { y: number; draw: () => void }[] = [];
  for (const side of [0, 1] as Side[])
    items.push({
      y: CASTLE_AT.y,
      draw: () => {
        drawCastle(ctx, side, biome, snap, timeMs);
        if (side === 0 && banner) drawBanner(ctx, banner, timeMs);
      },
    });
  for (const t of snap.towers) {
    items.push({
      y: t.inst.position.y,
      draw: () => {
        const { x, y } = t.inst.position;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1.6, 1.6);
        ctx.translate(-x, -y);
        drawTower(ctx, t.inst, false, timeMs, snap.timeMs - t.lastShotAt, true);
        ctx.restore();
        for (let k = 0; k < MAX_DUEL_TOWER_LEVEL; k++) {
          const px = x - 14 + k * 14;
          const py = y + 26;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.beginPath();
          ctx.moveTo(px, py - 6);
          ctx.lineTo(px + 6, py);
          ctx.lineTo(px, py + 6);
          ctx.lineTo(px - 6, py);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = k < t.level ? "#ffd56a" : "rgba(255,255,255,0.12)";
          ctx.beginPath();
          ctx.moveTo(px, py - 4);
          ctx.lineTo(px + 4, py);
          ctx.lineTo(px, py + 4);
          ctx.lineTo(px - 4, py);
          ctx.closePath();
          ctx.fill();
        }
      },
    });
  }
  for (const u of snap.units) {
    if (u.dist < 0) continue;
    items.push({
      y: u.inst.position.y,
      draw: () => {
        drawEnemy(ctx, u.inst, timeMs, Infinity, 2, undefined, u.angle, 0);
        drawEnemyHpBar(ctx, u.inst);
      },
    });
  }
  items.sort((a, b2) => a.y - b2.y).forEach((i) => i.draw());
  drawDeaths(ctx, snap);
  drawShots(ctx, snap);
  drawMotes(ctx, look, timeMs);
}
