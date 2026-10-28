/**
 * Shared live fire/smoke/ember drawing (castle damage, torches, tower
 * furnaces): layered flame tongues, soft rising smoke puffs and embers —
 * never a flat glowing circle.
 */
/** Seeded 0..1 noise from an integer-ish input. */
export function n01(v: number): number {
  const x = Math.sin(v * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Layered, flickering flames rooted at (x,y): dark-red outer tongues, orange body, yellow-white core, plus a warm light pool. */
export function drawFire(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number,
  size: number,
  seed: number,
  /** Optional [outer, body, core] flame colours (rgba strings) for non-orange fire. */
  palette?: readonly [string, string, string],
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(x, y - 4 * size, 0, x, y - 4 * size, 22 * size);
  pool.addColorStop(0, "rgba(255,140,50,0.28)");
  pool.addColorStop(1, "rgba(255,100,30,0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(x, y - 4 * size, 22 * size, 0, Math.PI * 2);
  ctx.fill();
  const tongues = 5;
  const transparent = (c: string) => c.replace(/,[\d.]+\)$/, ",0)");
  const layers: [string, string, number, number][] = palette
    ? [
        [palette[0], transparent(palette[0]), 1.0, 1.0],
        [palette[1], transparent(palette[1]), 0.75, 0.8],
        [palette[2], transparent(palette[2]), 0.42, 0.55],
      ]
    : [
        ["rgba(200,40,10,0.55)", "rgba(200,40,10,0)", 1.0, 1.0],
        ["rgba(255,120,30,0.75)", "rgba(255,150,40,0)", 0.75, 0.8],
        ["rgba(255,230,150,0.9)", "rgba(255,240,190,0)", 0.42, 0.55],
      ];
  for (const [c0, c1, wMul, hMul] of layers) {
    for (let k = 0; k < tongues; k++) {
      const off = (k - (tongues - 1) / 2) * 2.6 * size;
      const t = timeMs / (90 + n01(seed + k) * 60) + n01(seed * 3 + k) * 6;
      const h = (9 + 6 * Math.abs(Math.sin(t)) + 4 * n01(seed + k * 7)) * size * hMul * (1 - Math.abs(off) / (10 * size));
      if (h <= 1) continue;
      const w = 2.4 * size * wMul;
      const sway = Math.sin(t * 1.7) * 1.8 * size;
      const g = ctx.createLinearGradient(x + off, y, x + off, y - h);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + off - w, y);
      ctx.bezierCurveTo(x + off - w, y - h * 0.4, x + off + sway - w * 0.4, y - h * 0.7, x + off + sway, y - h);
      ctx.bezierCurveTo(x + off + sway + w * 0.4, y - h * 0.7, x + off + w, y - h * 0.4, x + off + w, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A rising, widening, drifting smoke column made of soft puffs. */
export function drawSmokeColumn(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, size: number, seed: number): void {
  ctx.save();
  const puffs = 9;
  for (let i = 0; i < puffs; i++) {
    const cycle = (timeMs / 3400 + i / puffs + n01(seed + i) * 0.05) % 1;
    const drift = cycle * cycle * 26 * size + Math.sin(timeMs / 1300 + i + seed) * 3;
    const px = x + drift;
    const py = y - cycle * 70 * size;
    const r = (4 + cycle * 14) * size;
    const a = Math.sin(cycle * Math.PI) * 0.42;
    const shade = 30 + Math.round(cycle * 50);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${shade},${shade - 4},${shade - 8},${a})`);
    g.addColorStop(1, `rgba(${shade},${shade - 4},${shade - 8},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bright embers spiralling up out of a fire. */
export function drawEmbers(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, count: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const life = 1600 + n01(seed + i) * 1400;
    const cycle = ((timeMs + n01(seed * 5 + i) * life) % life) / life;
    const ex = x + (n01(seed + i * 3) - 0.5) * 12 + Math.sin(timeMs / 260 + i) * 4 * cycle;
    const ey = y - cycle * (40 + n01(seed + i * 9) * 30);
    const a = (1 - cycle) * (0.6 + 0.4 * Math.sin(timeMs / 60 + i));
    ctx.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - cycle))},60,${Math.max(0, a)})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 0.8 + (1 - cycle) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

