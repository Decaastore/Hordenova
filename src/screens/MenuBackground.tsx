import { useEffect, useRef } from "react";
import { WORLD_SIZE } from "@/config/gameBalance";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import {
  drawAmbientParticles,
  drawBackground,
  drawDecorations,
  drawDistantSilhouettes,
  drawFog,
  drawPath,
  drawPathEndpoints,
  drawVignette,
} from "@/rendering/MapRenderer";

/**
 * Full-bleed cinematic backdrop for the main menu — reuses the exact same
 * scenery primitives as the in-game map (forest, road, portal/gate, fog,
 * crystals, ambient motes) so the menu and the game read as one world
 * (Phase 2 spec section 12), just composed with a "cover" fit instead of
 * the gameplay canvas's "contain" fit since there is nothing here that
 * needs to stay click-accurate.
 */
export function MenuBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = window.innerWidth;
      const cssHeight = window.innerHeight;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      const scale = Math.max(cssWidth / WORLD_SIZE.width, cssHeight / WORLD_SIZE.height) * 1.08;
      const offsetX = (cssWidth - WORLD_SIZE.width * scale) / 2;
      const offsetY = (cssHeight - WORLD_SIZE.height * scale) / 2 - 40 * scale;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

      drawBackground(ctx);
      drawDistantSilhouettes(ctx, timestamp);
      drawDecorations(ctx, timestamp);
      drawPath(ctx, ENEMY_PATH);
      drawPathEndpoints(ctx, ENEMY_PATH, timestamp);
      drawFog(ctx, timestamp);
      drawAmbientParticles(ctx, timestamp);
      drawVignette(ctx);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
