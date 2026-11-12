/**
 * CHEFE GLOBAL cosmetics — the Eclipse looks earned against the Serpent of
 * the Eclipse (config/colossus.ts). Unlike the Duel looks they show in BOTH
 * castles, Season and Eternal. GameEngine sets the equipped one at startRun.
 *
 *   ECLIPSE_SIGIL — a turning violet-and-gold sigil under every tower
 *   ECLIPSE_CROWN — the sigil plus a small eclipse (black sun, golden corona)
 *                   floating over the tower and motes spiralling up
 */
import type { ColossusCosmeticId } from "@/config/colossus";

let equipped: ColossusCosmeticId | null = null;

export function setEclipseAura(id: ColossusCosmeticId | null): void {
  equipped = id;
}

export function activeEclipseAura(): ColossusCosmeticId | null {
  return equipped;
}

const GROUND_Y = 4;

/** Ground sigil, drawn under the tower body (tower-local, scaled space). */
export function drawEclipseUnder(ctx: CanvasRenderingContext2D, timeMs: number, id: ColossusCosmeticId | null = equipped): void {
  if (!id) return;
  const t = timeMs / 1000;
  ctx.save();
  ctx.translate(0, GROUND_Y);
  ctx.scale(1, 0.42);
  const pulse = 0.6 + 0.4 * Math.sin(t * 1.8);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 40);
  g.addColorStop(0, `rgba(150,90,255,${0.18 * pulse})`);
  g.addColorStop(1, "rgba(150,90,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(t * 0.35);
  ctx.strokeStyle = "rgba(196,150,255,0.85)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,206,110,0.8)";
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  // runes between the two rings
  ctx.fillStyle = "rgba(255,226,160,0.9)";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(32.5, 0);
    ctx.fillRect(-0.6, -2.2, 1.2, 4.4);
    if (i % 2) ctx.fillRect(-1.8, -0.6, 3.6, 1.2);
    ctx.restore();
  }
  // a crescent "eclipse" sweep inside
  ctx.rotate(-t * 0.9);
  ctx.strokeStyle = "rgba(170,110,255,0.7)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0.2, 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 24, Math.PI + 0.2, Math.PI + 2.2);
  ctx.stroke();
  ctx.restore();
}

/** Floating eclipse and motes over the tower (Crown only). `topY` is the tower body's top. */
export function drawEclipseOver(ctx: CanvasRenderingContext2D, timeMs: number, topY: number, id: ColossusCosmeticId | null = equipped): void {
  if (id !== "ECLIPSE_CROWN") return;
  const t = timeMs / 1000;
  ctx.save();
  // motes spiralling up around the tower
  for (let i = 0; i < 7; i++) {
    const ph = (t * 0.35 + i / 7) % 1;
    const a = t * 2.2 + i * 2.1;
    const x = Math.cos(a) * (22 - ph * 10);
    const y = GROUND_Y - ph * (GROUND_Y - topY + 8) + Math.sin(a) * 6;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
    ctx.fillStyle = i % 2 ? "#c79bff" : "#ffd98a";
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const y = topY - 12 + Math.sin(t * 1.4) * 1.6;
  ctx.translate(0, y);
  const corona = ctx.createRadialGradient(0, 0, 4, 0, 0, 15);
  corona.addColorStop(0, "rgba(255,226,150,0.95)");
  corona.addColorStop(0.45, "rgba(255,170,80,0.55)");
  corona.addColorStop(1, "rgba(160,90,255,0)");
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  // corona rays
  ctx.strokeStyle = "rgba(255,220,140,0.6)";
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.6;
    const len = 9 + 3 * Math.sin(t * 3 + i);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = "#07040c";
  ctx.beginPath();
  ctx.arc(0.8, -0.4, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
