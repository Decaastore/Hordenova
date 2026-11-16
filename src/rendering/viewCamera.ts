import { WORLD_SIZE } from "@/config/gameBalance";

/**
 * ZOOM — the one camera every map layer follows: the 2D canvas, the 3D
 * creature/castle layers and the click/hover mapping all turn world units
 * into screen pixels through `getViewTransform`, so zooming or panning moves
 * everything together. At zoom 1 it is exactly the old fit-the-whole-map
 * transform (centred, letterboxed), so nothing changes until the player zooms.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.6;

const state = { zoom: 1, cx: WORLD_SIZE.width / 2, cy: WORLD_SIZE.height / 2 };
const listeners = new Set<() => void>();

export interface ViewTransform {
  /** CSS pixels per world unit. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

function clampCenter(width: number, height: number, s: number) {
  const halfW = width / 2 / s;
  const halfH = height / 2 / s;
  const W = WORLD_SIZE.width;
  const H = WORLD_SIZE.height;
  state.cx = halfW >= W / 2 ? W / 2 : Math.min(W - halfW, Math.max(halfW, state.cx));
  state.cy = halfH >= H / 2 ? H / 2 : Math.min(H - halfH, Math.max(halfH, state.cy));
}

/** World → CSS-pixel transform for a viewport of this size. */
export function getViewTransform(width: number, height: number): ViewTransform {
  const base = Math.min(width / WORLD_SIZE.width, height / WORLD_SIZE.height);
  const s = base * state.zoom;
  clampCenter(width, height, s);
  return { scale: s, offsetX: width / 2 - state.cx * s, offsetY: height / 2 - state.cy * s };
}

export function getZoom() {
  return state.zoom;
}

function changed() {
  for (const l of listeners) l();
}

/** Zoom by `factor`, keeping the world point under (screenX, screenY) where it is. */
export function zoomAt(screenX: number, screenY: number, factor: number, width: number, height: number) {
  const before = getViewTransform(width, height);
  const wx = (screenX - before.offsetX) / before.scale;
  const wy = (screenY - before.offsetY) / before.scale;
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
  if (z === state.zoom) return;
  state.zoom = z;
  const base = Math.min(width / WORLD_SIZE.width, height / WORLD_SIZE.height);
  const s = base * z;
  state.cx = wx - (screenX - width / 2) / s;
  state.cy = wy - (screenY - height / 2) / s;
  clampCenter(width, height, s);
  changed();
}

/** Drag the map by a screen-pixel delta. */
export function panBy(dx: number, dy: number, width: number, height: number) {
  if (state.zoom <= 1) return;
  const t = getViewTransform(width, height);
  state.cx -= dx / t.scale;
  state.cy -= dy / t.scale;
  clampCenter(width, height, t.scale);
  changed();
}

export function resetView() {
  state.zoom = 1;
  state.cx = WORLD_SIZE.width / 2;
  state.cy = WORLD_SIZE.height / 2;
  changed();
}

export function onViewChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
