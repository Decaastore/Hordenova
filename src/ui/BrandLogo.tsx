import type { CSSProperties } from "react";

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/** The game's name as a word. */
export const GAME_NAME = "HORDE NOVA";

/**
 * The HORDE NOVA wordmark (public/brand/hordenova-logo.svg): gold Cormorant
 * capitals with the O of NOVA replaced by the emblem — the violet rift
 * enemies pour out of, inside the gold rune ring, with a nova bursting from
 * it. Sized by height; the width follows the artwork.
 */
export function BrandLogo({ height, style, decorative = false }: { height: number | string; style?: CSSProperties; decorative?: boolean }) {
  return (
    <img
      src={`${assetBase}brand/hordenova-logo.svg`}
      alt={decorative ? "" : GAME_NAME}
      aria-hidden={decorative || undefined}
      draggable={false}
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );
}
