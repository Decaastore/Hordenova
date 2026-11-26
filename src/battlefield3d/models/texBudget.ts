/**
 * Canvas memory budget for the painted 3D surfaces.
 *
 * Safari (iPhone, iPad and Mac) caps the total memory all canvases on a
 * page may use. Past that cap new canvases come back blank or without a
 * context, and the page stops drawing or reloads. The castle paints its
 * stone and slate at 1024px (several canvases per surface), which alone
 * went past the iPhone cap on the Play page. On those devices every
 * painted surface is scaled down to TEX_MAX once it is finished and the
 * full-size canvas is released, so the castle looks the same and costs
 * a quarter of the memory.
 */

function detectLowTextureMemory(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // every browser on iPhone/iPad is Safari underneath (iPadOS reports itself as a Mac with touch)
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const safari = /AppleWebKit/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(ua);
  const phone = /Android|Mobile/.test(ua);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return ios || safari || phone || (deviceMemory !== undefined && deviceMemory <= 4);
}

export const LOW_TEXTURE_MEMORY = detectLowTextureMemory();

/** Largest side, in pixels, a finished painted surface keeps. */
export const TEX_MAX = LOW_TEXTURE_MEMORY ? 512 : 1024;

/**
 * Returns `canvas` scaled down so its larger side is at most `max`, and
 * releases the original's memory. Returns `canvas` itself when it already
 * fits (or when a smaller canvas can't be made).
 */
export function fitCanvas(canvas: HTMLCanvasElement, max = TEX_MAX): HTMLCanvasElement {
  if (canvas.width <= max && canvas.height <= max) return canvas;
  const k = max / Math.max(canvas.width, canvas.height);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * k));
  out.height = Math.max(1, Math.round(canvas.height * k));
  const g = out.getContext("2d");
  if (!g) return canvas;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(canvas, 0, 0, out.width, out.height);
  // a canvas's memory is only given back when its size goes to zero (Safari keeps it until then)
  canvas.width = 0;
  canvas.height = 0;
  return out;
}
