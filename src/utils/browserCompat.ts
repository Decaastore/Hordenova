/**
 * Small stand-ins for canvas features older Safari versions lack (iPhones
 * and Macs that can't update past Safari 15). Without them the game's
 * drawing code throws on those devices and the battle never appears.
 * Each one only fills in what is missing; newer browsers are untouched.
 */
type RoundRectRadii = number | DOMPointInit | (number | DOMPointInit)[];

function firstRadius(radii: RoundRectRadii | undefined): number {
  const r = Array.isArray(radii) ? radii[0] : radii;
  if (typeof r === "number") return r;
  if (r && typeof r === "object") return Number(r.x ?? 0);
  return 0;
}

function addRoundRect(proto: { roundRect?: unknown } | undefined): void {
  if (!proto || typeof proto.roundRect === "function") return;
  proto.roundRect = function (this: CanvasPath, x: number, y: number, w: number, h: number, radii?: RoundRectRadii) {
    let r = Math.max(0, firstRadius(radii));
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
    this.closePath();
  };
}

export function installBrowserCompat(): void {
  if (typeof window === "undefined") return;
  addRoundRect(window.CanvasRenderingContext2D?.prototype as { roundRect?: unknown } | undefined);
  addRoundRect((window as unknown as { Path2D?: { prototype: { roundRect?: unknown } } }).Path2D?.prototype);
  addRoundRect((window as unknown as { OffscreenCanvasRenderingContext2D?: { prototype: { roundRect?: unknown } } }).OffscreenCanvasRenderingContext2D?.prototype);
}

installBrowserCompat();
