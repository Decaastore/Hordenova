import type { TowerSkinDefinition } from "@/config/towerSkins";

/**
 * EVOLUÇÃO DE SKIN — the animated version of a Premium skin. Which skins the
 * account has evolved is set here by the engine (setEvolvedSkins) and read by
 * the tower renderer; it is purely visual and never touches combat.
 */
let evolved: ReadonlySet<string> = new Set();

export function setEvolvedSkins(ids: Iterable<string>): void {
  evolved = new Set(ids);
}

export function isSkinEvolved(skinId: string | null | undefined): boolean {
  return !!skinId && evolved.has(skinId);
}

const rgb = (hex: string): string => {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
};

/** Draws the evolution's living layer in tower-local space (after the body): a turning rune ring on the ground, a breathing glow and sparks spiralling up. */
export function drawSkinEvolution(ctx: CanvasRenderingContext2D, skin: TowerSkinDefinition, timeMs: number, stage: number): void {
  const accent = rgb(skin.paletteOverride.accent ?? "#ffffff");
  const spark = rgb(skin.particleStyle.color);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 520);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // ground rune ring, turning slowly
  const ry = 6.2;
  const rx = 18.5;
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = `rgba(${accent},${0.35 + 0.25 * pulse})`;
  ctx.beginPath();
  ctx.ellipse(0, 4, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  const marks = 12;
  for (let i = 0; i < marks; i++) {
    const a = timeMs / 2600 + (i / marks) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = 4 + Math.sin(a) * ry;
    const front = Math.sin(a) > 0;
    ctx.fillStyle = `rgba(${accent},${front ? 0.85 : 0.35})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.5, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // breathing glow around the body
  const g = ctx.createRadialGradient(0, -18, 2, 0, -18, 30);
  g.addColorStop(0, `rgba(${accent},${0.16 + 0.12 * pulse})`);
  g.addColorStop(1, `rgba(${accent},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -18, 30, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // sparks spiralling up from the ring
  const n = 6 + Math.min(stage, 6);
  for (let i = 0; i < n; i++) {
    const period = 2400 + (i % 3) * 500;
    const t = ((timeMs + i * 397) % period) / period;
    const a = t * Math.PI * 3 + i * 1.7;
    const r = 15 * (1 - t * 0.6);
    const x = Math.cos(a) * r;
    const y = 4 + Math.sin(a) * r * 0.34 - t * 52;
    const alpha = Math.sin(t * Math.PI) * 0.9;
    ctx.fillStyle = `rgba(${spark},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.3 - t * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
