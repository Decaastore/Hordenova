/**
 * MAESTRIA — what a tower's Mastery level looks like on the map. Each tier of
 * config/towerMastery.ts's MASTERY_COSMETIC_TIERS adds one layer on top of
 * the ones before it, so a glance at a tower tells how far its type has been
 * mastered this Season:
 *
 *   1+   faint golden ground ring (Mastery is active)
 *   5    Ember Ring    — turning ember ring with sparks rising
 *   15   Veteran Aura  — pulsing light column behind the tower
 *   30   Runic Sigils  — three runes orbiting the body
 *   60   Ascendant Halo— golden halo floating above the top
 *   120  Mythic Crown  — small floating crown above the halo
 *
 * Drawn in the tower's local, already-scaled space (origin = tower centre).
 * Purely visual; nothing here is read by combat.
 */
import { MASTERY_COSMETIC_TIERS } from "@/config/towerMastery";

const tierLevel = (id: string): number => MASTERY_COSMETIC_TIERS.find((t) => t.id === id)?.level ?? Infinity;
const EMBER = tierLevel("ember_ring");
const AURA = tierLevel("veteran_aura");
const SIGILS = tierLevel("runic_sigils");
const HALO = tierLevel("ascendant_halo");
const CROWN = tierLevel("mythic_crown");

const GROUND_Y = 4;

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Layers that sit under the tower body (ground ring, aura column). */
export function drawMasteryUnder(ctx: CanvasRenderingContext2D, level: number, accent: string, timeMs: number): void {
  if (level <= 0) return;
  const t = timeMs / 1000;
  ctx.save();

  if (level >= AURA) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    const g = ctx.createRadialGradient(0, GROUND_Y - 10, 2, 0, GROUND_Y - 10, 34);
    g.addColorStop(0, `rgba(255,214,120,${0.30 * pulse})`);
    g.addColorStop(1, "rgba(255,214,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - 10, 30, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground ring — always on once Mastery is active, brighter from Ember Ring.
  ctx.translate(0, GROUND_Y);
  ctx.scale(1, 0.42);
  const strong = level >= EMBER;
  ctx.lineWidth = strong ? 2.2 : 1.4;
  ctx.strokeStyle = strong ? "rgba(255,190,90,0.85)" : "rgba(255,214,120,0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, Math.PI * 2);
  ctx.stroke();

  if (strong) {
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -t * 18;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Layers drawn over the tower body (sparks, runes, halo, crown). `topY` is the body's top edge. */
export function drawMasteryOver(ctx: CanvasRenderingContext2D, level: number, accent: string, timeMs: number, topY: number): void {
  if (level < EMBER) return;
  const t = timeMs / 1000;
  ctx.save();

  // Embers rising off the ring.
  for (let i = 0; i < 6; i++) {
    const phase = (t * 0.45 + hash(i + 1)) % 1;
    const ang = hash(i + 7) * Math.PI * 2;
    const x = Math.cos(ang) * 27 + Math.sin(t * 2 + i) * 2;
    const y = GROUND_Y + Math.sin(ang) * 11 - phase * 34;
    ctx.globalAlpha = (1 - phase) * 0.9;
    ctx.fillStyle = i % 2 ? "#ffcf6b" : accent;
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + (1 - phase), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (level >= SIGILS) {
    const midY = (GROUND_Y + topY) / 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * 30;
      const y = midY + Math.sin(a) * 9;
      const front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 1 : 0.45;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#fff0c2";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      // A small rune: diamond with a stroke through it, a different mark per slot.
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      if (i === 0) { ctx.moveTo(0, -5); ctx.lineTo(0, 5); }
      if (i === 1) { ctx.moveTo(-4, 0); ctx.lineTo(4, 0); }
      if (i === 2) { ctx.moveTo(-2, -2); ctx.lineTo(2, 2); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  if (level >= HALO) {
    const y = topY - 6 + Math.sin(t * 1.6) * 1.5;
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, 0.32);
    ctx.shadowColor = "#ffd36b";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (level >= CROWN) {
    const y = topY - 17 + Math.sin(t * 1.6 + 0.6) * 1.5;
    ctx.save();
    ctx.translate(0, y);
    ctx.shadowColor = "#ffcf4d";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffcf4d";
    ctx.strokeStyle = "#7a4a10";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-8, -3);
    ctx.lineTo(-4, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(8, -3);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#d1324a";
    ctx.beginPath();
    ctx.arc(0, 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
