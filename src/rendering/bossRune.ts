/**
 * BOSS SIEGE — a rune lit beside the road during a boss assault (see
 * config/bossAssault.ts). Gold glyph on a glowing disc, pulsing, with a
 * ring that empties as its time runs out — clicking it strikes the boss.
 */
export function drawBossRune(ctx: CanvasRenderingContext2D, x: number, y: number, lifeLeft: number, timeMs: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 140);
  const r = 17;
  ctx.save();
  ctx.translate(x, y);

  // glow
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2);
  glow.addColorStop(0, `rgba(255, 226, 140, ${0.55 + 0.25 * pulse})`);
  glow.addColorStop(1, "rgba(255, 190, 70, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // stone disc
  ctx.fillStyle = "#2a1a0b";
  ctx.strokeStyle = "#f7dc9c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // glyph: a nova star like the emblem
  ctx.fillStyle = `rgba(255, 244, 214, ${0.8 + 0.2 * pulse})`;
  ctx.beginPath();
  const arms = [r * 0.82, r * 0.55, r * 0.82, r * 0.55];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const b = a + Math.PI / 4;
    const tip = arms[i]!;
    ctx[i === 0 ? "moveTo" : "lineTo"](tip * Math.sin(a), -tip * Math.cos(a));
    ctx.lineTo(r * 0.16 * Math.sin(b), -r * 0.16 * Math.cos(b));
  }
  ctx.closePath();
  ctx.fill();

  // time left
  ctx.strokeStyle = "#ffd257";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeLeft);
  ctx.stroke();
  ctx.restore();
}
