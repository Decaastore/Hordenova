import type { RenderSnapshot } from "@/engine/GameEngine";
import type { Vector2 } from "@/utils/geometry";
import { castleAnchor } from "./castleSprites";

/**
 * GUARNIÇÃO in the 2D view (config/garrison.ts; the 3D view has its own
 * figures in hybrid3d/garrison3d.tsx): little archers standing on the
 * castle picture's towers and walls, drawing on every volley and loosing
 * arrows that arc down onto the Boss or Mini-Boss, knocked flat while a boss
 * blow has them down. Purely visual — the damage is the engine's.
 */

/** Where soldier N stands: a castle-picture anchor and an offset from it (fortress-local units). */
const POSTS: readonly { anchor: string; dx: number; dy: number }[] = [
  { anchor: "bannerGate", dx: -9, dy: 15 },
  { anchor: "bannerGate", dx: 9, dy: 15 },
  { anchor: "towerWindowL", dx: 0, dy: -24 },
  { anchor: "towerWindowR", dx: 0, dy: -24 },
  { anchor: "bannerGate", dx: -24, dy: 22 },
  { anchor: "bannerGate", dx: 24, dy: 22 },
  { anchor: "keepWindow", dx: -12, dy: -18 },
  { anchor: "keepWindow", dx: 12, dy: -18 },
  { anchor: "towerWindowL", dx: 8, dy: -16 },
  { anchor: "towerWindowR", dx: -8, dy: -16 },
  { anchor: "towerWindowL", dx: -8, dy: -16 },
  { anchor: "towerWindowR", dx: 8, dy: -16 },
];

interface Streak {
  from: Vector2;
  to: Vector2;
  start: number;
  dur: number;
}

let lastSeq = -1;
let streaks: Streak[] = [];
let fall = 0;
let lastTime = 0;
const drawUntil = new Map<number, number>();

export function drawGarrison2D(ctx: CanvasRenderingContext2D, fortress: Vector2, tier: number, snapshot: RenderSnapshot, timeMs: number): void {
  const gar = snapshot.garrison;
  const count = gar?.soldiers ?? 0;
  if (count <= 0) {
    streaks = [];
    return;
  }
  const dt = Math.min(0.1, Math.max(0, (timeMs - lastTime) / 1000));
  lastTime = timeMs;
  fall += ((gar?.stunned ? 1 : 0) - fall) * Math.min(1, dt * (gar?.stunned ? 8 : 1.8));

  const target = gar?.volley ? snapshot.enemies.find((e) => e.id === gar.volley!.targetId) ?? null : null;
  const posts = POSTS.slice(0, count).map((p) => {
    const a = castleAnchor(p.anchor, tier);
    return { x: fortress.x + a.x + p.dx, y: fortress.y + a.y + p.dy };
  });

  // a new volley: every standing archer looses an arrow
  if (gar?.volley && gar.volley.seq !== lastSeq) {
    const first = lastSeq < 0;
    lastSeq = gar.volley.seq;
    if (!first && target && fall < 0.3) {
      posts.forEach((p, i) => {
        const to = { x: target.position.x + (Math.random() - 0.5) * 14, y: target.position.y - 14 + (Math.random() - 0.5) * 10 };
        streaks.push({ from: { x: p.x, y: p.y - 4 }, to, start: timeMs + Math.random() * 160, dur: 260 + Math.hypot(to.x - p.x, to.y - p.y) * 1.1 });
        drawUntil.set(i, timeMs + 260);
      });
    }
  }

  // the archers
  posts.forEach((p, i) => {
    const facing = target ? Math.sign(target.position.x - p.x) || 1 : i % 2 ? 1 : -1;
    const drawing = (drawUntil.get(i) ?? 0) > timeMs;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (fall > 0.02) {
      ctx.translate(0, fall * 2);
      ctx.rotate(fall * (Math.PI / 2) * -facing);
    }
    ctx.scale(facing, 1);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 3.2, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // body (blue tabard) and legs
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(-1.6, -3, 1.3, 3);
    ctx.fillRect(0.3, -3, 1.3, 3);
    ctx.fillStyle = "#2a5ab8";
    ctx.fillRect(-2.1, -7.6, 4.2, 4.8);
    ctx.fillStyle = "#d8b04a";
    ctx.fillRect(-2.1, -4.2, 4.2, 0.7);
    // head and helmet
    ctx.fillStyle = "#d8a882";
    ctx.beginPath();
    ctx.arc(0, -9.2, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a8c92";
    ctx.beginPath();
    ctx.arc(0, -9.6, 1.9, Math.PI, 0);
    ctx.fill();
    // bow held out towards the target, string pulled back while drawing
    ctx.strokeStyle = "#7a5228";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(2.6, -6.6, 3, -Math.PI / 2.2, Math.PI / 2.2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,230,210,0.8)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(3.6, -9.4);
    ctx.lineTo(drawing ? 0.8 : 3.6, -6.6);
    ctx.lineTo(3.6, -3.8);
    ctx.stroke();
    ctx.restore();
  });

  // the arrows in flight
  streaks = streaks.filter((s) => timeMs < s.start + s.dur);
  for (const s of streaks) {
    if (timeMs < s.start) continue;
    const t = (timeMs - s.start) / s.dur;
    const dist = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    const at = (k: number) => ({ x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k - Math.sin(k * Math.PI) * dist * 0.18 });
    const head = at(t);
    const tail = at(Math.max(0, t - 0.08));
    ctx.save();
    ctx.strokeStyle = "rgba(255,236,190,0.95)";
    ctx.lineWidth = 1.3;
    ctx.shadowColor = "rgba(255,200,120,0.8)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    ctx.restore();
  }
}
