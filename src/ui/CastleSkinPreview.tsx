import { useEffect, useRef } from "react";
import { getCastleSkinDefinition } from "@/config/castleSkins";
import { ACTIVE_BIOME } from "@/rendering/biomes";
import { drawFortress } from "@/rendering/MapRenderer";
import { NO_CASTLE_SKIN } from "@/rendering/castleSkinFx";

/** SKINS DE CASTELO — a live castle wearing `skinId` (null = the plain castle), for the Store cards. */
export function CastleSkinPreview({ skinId, size = 150 }: { skinId: string | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * 0.8 * dpr;
    const skin = skinId ? getCastleSkinDefinition(skinId) : null;
    let raf = 0;
    const loop = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size * 0.8);
      const g = ctx.createRadialGradient(size / 2, size * 0.62, 4, size / 2, size * 0.62, size * 0.6);
      g.addColorStop(0, "rgba(60,48,30,0.9)");
      g.addColorStop(1, "rgba(14,10,6,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size * 0.8);
      drawFortress(ctx, { x: size / 2, y: size * 0.66 }, ACTIVE_BIOME, now, (size / 150) * 0.72, 0, 1, skin ?? NO_CASTLE_SKIN);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [skinId, size]);
  return <canvas ref={ref} style={{ width: size, height: size * 0.8, display: "block", borderRadius: 10 }} aria-hidden="true" />;
}

