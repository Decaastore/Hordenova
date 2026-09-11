import { useEffect, useRef } from "react";
import { drawBackground, drawDecorations, drawPath, drawPathEndpoints, drawSlot } from "@/rendering/MapRenderer";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { ACTIVE_BIOME } from "@/rendering/biomes";
import { CROP, DISPLAY_SCALE, CANVAS_W, CANVAS_H, HYBRID_TOWER_SLOT } from "./hybridWorldData";

const SLOT_INDEX = TOWER_SLOTS.findIndex((s) => s.id === HYBRID_TOWER_SLOT.id);

/**
 * PROVA DE CONCEITO HÍBRIDA — the "keep the current HORDENOVA visual"
 * half of the experiment. This draws a cropped window of the REAL
 * Whispering Woods map using the actual production drawing functions
 * (`drawBackground`/`drawDecorations`/`drawPath`/`drawPathEndpoints`/
 * `drawSlot` from `@/rendering/MapRenderer`) — the exact same pure,
 * state-free paint functions `CanvasRenderer.tsx` calls every frame in
 * the real game. Nothing here is a re-implementation or approximation:
 * it is the production 2D renderer, called with a narrower viewport
 * transform, with NO GameEngine/WaveManager/save-data anywhere in the
 * call chain — a frozen, cosmetically-animated frame, not a live game.
 */
export function Hybrid2DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const render = (timeMs: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DISPLAY_SCALE, 0, 0, DISPLAY_SCALE, -CROP.minX * DISPLAY_SCALE, -CROP.minY * DISPLAY_SCALE);

      drawBackground(ctx, ACTIVE_BIOME);
      drawDecorations(ctx, ACTIVE_BIOME, timeMs);
      drawPath(ctx, ENEMY_PATH, ACTIVE_BIOME);
      drawPathEndpoints(ctx, ENEMY_PATH, ACTIVE_BIOME, timeMs);
      // occupied=true — a tower now "exists" here (the 3D one, rendered in
      // the overlay above), so the empty-slot highlight ring is skipped
      // exactly like the real game does for any occupied slot.
      drawSlot(ctx, HYBRID_TOWER_SLOT, SLOT_INDEX, true, false, ACTIVE_BIOME, timeMs);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", inset: 0, display: "block" }} />;
}
