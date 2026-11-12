import type { TowerType } from "@/config/towerStats";
import type { KillFxId } from "@/config/duel";

/**
 * DUELO cosmetics outside the Duel — the Duel tower skins and the kill
 * effect, which also show in the Eternal castle (never in the Season). The
 * engine sets them when a castle starts (null for the Season castle) and
 * the renderer reads them. Visual only: a Duel skin swaps the look, never
 * the tower's own skin effects.
 */
let looks: Partial<Record<TowerType, string>> | null = null;
let killFx: KillFxId | null = null;

export function setDuelLooks(next: Partial<Record<TowerType, string>> | null, fx: KillFxId | null): void {
  looks = next;
  killFx = fx;
}

/** The skin id to draw for a tower: the Duel skin when one is worn here, otherwise its own. */
export function lookSkinId(type: TowerType, own: string | null | undefined): string | null {
  return looks?.[type] ?? own ?? null;
}

export function activeKillFx(): KillFxId | null {
  return killFx;
}

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** A kill effect at a fallen creature, `t` 0..1 through its life. */
export function drawKillFx(ctx: CanvasRenderingContext2D, fx: KillFxId, x: number, y: number, t: number, seed: number, big = false): void {
  const s = big ? 1.6 : 1;
  ctx.save();
  ctx.globalCompositeOperation = fx === "GOLD" || fx === "BLOOD" ? "source-over" : "lighter";
  const n = big ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed, i) * Math.PI * 2;
    const sp = (0.5 + rnd(seed + 1, i)) * 26 * s;
    const fade = 1 - t;
    if (fx === "EMBERS") {
      const px = x + Math.cos(a) * sp * t;
      const py = y - 6 + Math.sin(a) * sp * t * 0.6 - t * 26 * s;
      ctx.fillStyle = `rgba(255,${120 + 100 * rnd(seed, i + 3)},40,${fade})`;
      ctx.beginPath();
      ctx.arc(px, py, (2.4 - t * 1.6) * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx === "FROST") {
      const px = x + Math.cos(a) * sp * Math.sqrt(t);
      const py = y - 8 + Math.sin(a) * sp * Math.sqrt(t) * 0.7 + t * t * 14;
      ctx.fillStyle = `rgba(190,235,255,${fade})`;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + t * 4);
      ctx.beginPath();
      ctx.moveTo(0, -4 * s);
      ctx.lineTo(1.6 * s, 0);
      ctx.lineTo(0, 4 * s);
      ctx.lineTo(-1.6 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (fx === "SOULS") {
      if (i > 3) continue;
      const px = x + Math.sin(t * 7 + i * 1.7) * 8 * s + (i - 1.5) * 6;
      const py = y - 10 - t * 60 * s - i * 4;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9 * s);
      g.addColorStop(0, `rgba(230,200,255,${0.9 * fade})`);
      g.addColorStop(1, "rgba(160,90,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx === "LIGHTNING") {
      if (i > 4) continue;
      // forked bolts striking outwards
      ctx.strokeStyle = `rgba(200,180,255,${fade})`;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      let px = x;
      let py = y - 8;
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += Math.cos(a) * sp * 0.35 + (rnd(seed + k, i) - 0.5) * 8;
        py += Math.sin(a) * sp * 0.25 + (rnd(seed + k + 9, i) - 0.5) * 8;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (fx === "BLOOD") {
      // a blood-red mist that rises and a dark splash on the ground
      const px = x + Math.cos(a) * sp * t * 0.7;
      const py = y - 4 + Math.sin(a) * sp * t * 0.3 - t * 16 * s;
      ctx.fillStyle = `rgba(200,20,40,${0.8 * fade})`;
      ctx.beginPath();
      ctx.arc(px, py, (3 - t * 2) * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // GOLD: coins that pop up and fall
      const vx = Math.cos(a) * sp * 0.9;
      const px = x + vx * t;
      const py = y - 8 - (40 * s * t - 70 * s * t * t) * (0.6 + rnd(seed + 2, i));
      ctx.fillStyle = `rgba(255,210,70,${fade})`;
      ctx.strokeStyle = `rgba(120,70,0,${fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px, py, 3.2 * s, 3.2 * s * Math.abs(Math.cos(t * 12 + i)), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (fx !== "SOULS") {
    const g = ctx.createRadialGradient(x, y - 6, 0, x, y - 6, 22 * s * (0.5 + t));
    const c = fx === "EMBERS" ? "255,140,40" : fx === "FROST" ? "150,220,255" : fx === "LIGHTNING" ? "180,160,255" : fx === "BLOOD" ? "220,30,50" : "255,220,90";
    g.addColorStop(0, `rgba(${c},${0.45 * (1 - t)})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 6, 22 * s * (0.5 + t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
