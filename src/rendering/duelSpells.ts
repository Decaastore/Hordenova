/**
 * FEITIÇOS DO DUELO — how the three spells look: the card art (drawn, no
 * sprite needed), the Meteor falling and blowing up, the Freeze field and the
 * ice on frozen creatures, and the Rage aura on a player's towers.
 */
import type { DuelSnapshot, SpellFx } from "@/engine/DuelEngine";
import type { DuelSpellCard } from "@/config/duel";

type Effect = DuelSpellCard["effect"];

/** Card art for a spell, drawn into a square of `size`. */
export function drawSpellIcon(ctx: CanvasRenderingContext2D, effect: Effect, size: number, timeMs: number): void {
  const t = timeMs / 1000;
  const c = size / 2;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  if (effect === "METEOR") {
    // trail
    const g = ctx.createLinearGradient(size * 0.05, size * 0.05, c, c);
    g.addColorStop(0, "rgba(255,120,30,0)");
    g.addColorStop(1, "rgba(255,170,60,0.9)");
    ctx.strokeStyle = g;
    ctx.lineCap = "round";
    ctx.lineWidth = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(size * 0.12, size * 0.1);
    ctx.lineTo(c * 1.02, c * 1.02);
    ctx.stroke();
    // rock
    const r = size * 0.2;
    const rock = ctx.createRadialGradient(c * 1.08 - r * 0.3, c * 1.08 - r * 0.3, r * 0.1, c * 1.08, c * 1.08, r);
    rock.addColorStop(0, "#fff2b0");
    rock.addColorStop(0.35, "#ff9a2e");
    rock.addColorStop(1, "#7a1d08");
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.arc(c * 1.08, c * 1.08, r * (1 + 0.04 * Math.sin(t * 8)), 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.4 + i / 6) % 1;
      ctx.fillStyle = `rgba(255,${180 - ph * 100},60,${1 - ph})`;
      ctx.beginPath();
      ctx.arc(c * 1.08 - ph * size * 0.35 + Math.sin(i * 3) * 4, c * 1.08 - ph * size * 0.3 + Math.cos(i * 5) * 4, size * 0.03 * (1 - ph) + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (effect === "FREEZE") {
    const glow = ctx.createRadialGradient(c, c, 0, c, c, size * 0.48);
    glow.addColorStop(0, "rgba(200,240,255,0.55)");
    glow.addColorStop(1, "rgba(120,190,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.translate(c, c);
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = "#e9f8ff";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, size * 0.055);
    for (let k = 0; k < 6; k++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size * 0.36);
      ctx.moveTo(0, -size * 0.22);
      ctx.lineTo(size * 0.08, -size * 0.3);
      ctx.moveTo(0, -size * 0.22);
      ctx.lineTo(-size * 0.08, -size * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = "#9fdcff";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // RAGE: a roaring red flame over a war-horn swirl
    const pulse = 0.85 + 0.15 * Math.sin(t * 6);
    const glow = ctx.createRadialGradient(c, c * 1.1, 0, c, c * 1.1, size * 0.5);
    glow.addColorStop(0, `rgba(255,60,60,${0.6 * pulse})`);
    glow.addColorStop(1, "rgba(120,0,40,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.moveTo(c, size * 0.12);
    ctx.bezierCurveTo(size * 0.82, size * 0.4, size * 0.8, size * 0.86, c, size * 0.86);
    ctx.bezierCurveTo(size * 0.2, size * 0.86, size * 0.18, size * 0.48, size * 0.38, size * 0.36);
    ctx.bezierCurveTo(size * 0.38, size * 0.52, size * 0.46, size * 0.56, size * 0.5, size * 0.54);
    ctx.bezierCurveTo(size * 0.46, size * 0.38, size * 0.5, size * 0.24, c, size * 0.12);
    ctx.fill();
    ctx.fillStyle = "#ffc06a";
    ctx.beginPath();
    ctx.moveTo(c, size * 0.44);
    ctx.bezierCurveTo(size * 0.66, size * 0.58, size * 0.64, size * 0.8, c, size * 0.8);
    ctx.bezierCurveTo(size * 0.36, size * 0.8, size * 0.36, size * 0.6, c, size * 0.44);
    ctx.fill();
  }
  ctx.restore();
}

function fall(f: SpellFx, now: number): number {
  return Math.max(0, Math.min(1, (now - f.castAt) / Math.max(1, f.landAt - f.castAt)));
}

/** Ground layer (under creatures): the Meteor's target and scorch, the Freeze field. */
export function drawSpellGround(ctx: CanvasRenderingContext2D, snap: DuelSnapshot): void {
  const now = snap.timeMs;
  for (const f of snap.spells) {
    if (f.effect === "METEOR") {
      if (now < f.landAt) {
        const k = fall(f, now);
        ctx.strokeStyle = `rgba(255,120,40,${0.4 + 0.5 * k})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(f.at.x, f.at.y, f.radius, f.radius * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`;
        ctx.beginPath();
        ctx.ellipse(f.at.x, f.at.y, f.radius * 0.35 * (0.4 + k), f.radius * 0.22 * (0.4 + k), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const a = 1 - (now - f.landAt) / 900;
        if (a <= 0) continue;
        const g = ctx.createRadialGradient(f.at.x, f.at.y, 0, f.at.x, f.at.y, f.radius);
        g.addColorStop(0, `rgba(30,12,4,${0.6 * a})`);
        g.addColorStop(0.6, `rgba(90,30,8,${0.35 * a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(f.at.x, f.at.y, f.radius, f.radius * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.effect === "FREEZE") {
      const life = (now - f.castAt) / f.durationMs;
      if (life >= 1) continue;
      const a = Math.min(1, (1 - life) * 3) * Math.min(1, life * 8 + 0.2);
      const g = ctx.createRadialGradient(f.at.x, f.at.y, 0, f.at.x, f.at.y, f.radius);
      g.addColorStop(0, `rgba(210,245,255,${0.4 * a})`);
      g.addColorStop(0.75, `rgba(140,205,255,${0.28 * a})`);
      g.addColorStop(1, "rgba(140,205,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(f.at.x, f.at.y, f.radius, f.radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(230,250,255,${0.7 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(f.at.x, f.at.y, f.radius, f.radius * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      // frost shards around the rim
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + f.castAt;
        const x = f.at.x + Math.cos(ang) * f.radius * 0.86;
        const y = f.at.y + Math.sin(ang) * f.radius * 0.53;
        ctx.fillStyle = `rgba(235,250,255,${0.85 * a})`;
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 3.5, y);
        ctx.lineTo(x, y + 2);
        ctx.lineTo(x - 3.5, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

/** Air layer (over creatures): the Meteor itself and its blast, the Rage burst. */
export function drawSpellAir(ctx: CanvasRenderingContext2D, snap: DuelSnapshot): void {
  const now = snap.timeMs;
  for (const f of snap.spells) {
    if (f.effect === "METEOR") {
      if (now < f.landAt) {
        const k = fall(f, now);
        // falls from just above the board edge, so the whole drop stays in view
        const drop = Math.min(320, f.at.y + 30);
        const x = f.at.x - drop * 0.5 * (1 - k);
        const y = f.at.y - drop * (1 - k);
        const tail = ctx.createLinearGradient(x - 90, y - 170, x, y);
        tail.addColorStop(0, "rgba(255,110,30,0)");
        tail.addColorStop(1, "rgba(255,190,90,0.95)");
        ctx.strokeStyle = tail;
        ctx.lineCap = "round";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(x - 90, y - 170);
        ctx.lineTo(x, y);
        ctx.stroke();
        const rock = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 15);
        rock.addColorStop(0, "#fff6c8");
        rock.addColorStop(0.4, "#ff9a2e");
        rock.addColorStop(1, "#6e1a06");
        ctx.fillStyle = rock;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const p = (now - f.landAt) / 600;
        if (p >= 1) continue;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const flash = ctx.createRadialGradient(f.at.x, f.at.y, 0, f.at.x, f.at.y, f.radius * (0.6 + p));
        flash.addColorStop(0, `rgba(255,240,190,${0.9 * (1 - p)})`);
        flash.addColorStop(0.5, `rgba(255,140,40,${0.6 * (1 - p)})`);
        flash.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(f.at.x, f.at.y, f.radius * (0.6 + p), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = `rgba(255,210,140,${1 - p})`;
        ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath();
        ctx.ellipse(f.at.x, f.at.y, f.radius * (0.3 + p * 1.1), f.radius * 0.62 * (0.3 + p * 1.1), 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2 + f.landAt;
          const d = f.radius * (0.2 + p * (0.8 + ((i * 7) % 5) * 0.12));
          ctx.fillStyle = `rgba(255,${150 + (i % 3) * 30},60,${1 - p})`;
          ctx.beginPath();
          ctx.arc(f.at.x + Math.cos(ang) * d, f.at.y + Math.sin(ang) * d * 0.62 - p * 30 * Math.sin(p * Math.PI), 2.6 * (1 - p) + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (f.effect === "RAGE") {
      const p = (now - f.castAt) / 700;
      if (p >= 1) continue;
      ctx.strokeStyle = `rgba(255,70,70,${1 - p})`;
      ctx.lineWidth = 5 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(f.at.x, f.at.y - 30, 60 + p * 260, (60 + p * 260) * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** Ice on a frozen creature (drawn over it). */
export function drawFrozenOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, leftMs: number): void {
  const a = Math.min(1, leftMs / 300);
  ctx.save();
  ctx.fillStyle = `rgba(180,230,255,${0.38 * a})`;
  ctx.strokeStyle = `rgba(240,252,255,${0.85 * a})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.55, y + size * 0.15);
  ctx.lineTo(x - size * 0.45, y - size * 0.75);
  ctx.lineTo(x + size * 0.05, y - size * 0.95);
  ctx.lineTo(x + size * 0.5, y - size * 0.7);
  ctx.lineTo(x + size * 0.55, y + size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.25, y - size * 0.7);
  ctx.lineTo(x - size * 0.05, y - size * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** Red war aura under a tower while its owner's Rage lasts. */
export function drawRageAura(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 90);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y + 6, 4, x, y + 6, 44);
  g.addColorStop(0, `rgba(255,60,40,${0.5 * pulse})`);
  g.addColorStop(1, "rgba(255,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 44, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
