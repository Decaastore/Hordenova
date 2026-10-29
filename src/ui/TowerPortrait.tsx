import { useEffect, useRef } from "react";
import { drawTower } from "@/rendering/EntityRenderer";
import { createTowerInstance } from "@/entities/Tower";
import type { TowerType } from "@/config/towerStats";

interface TowerPortraitProps {
  type: TowerType;
  level: number;
  skinId?: string | null;
  /** CSS size of the canvas. */
  width: number;
  height: number;
  /** World units → CSS px. */
  zoom: number;
  /** 0..1 — where the tower's base sits vertically in the frame. */
  baseY?: number;
}

/**
 * A live tower drawn by the battle renderer itself (same sprite, stage,
 * skin and idle effects the player sees in a run), for Home/Wiki showcases.
 * Pauses while scrolled out of view.
 */
export function TowerPortrait({ type, level, skinId = null, width, height, zoom, baseY = 0.66 }: TowerPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const view = { w: width / zoom, h: height / zoom };
    const tower = createTowerInstance("portrait", type, { x: view.w / 2, y: view.h * baseY }, level, null, 0, skinId);
    let visible = true;
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e?.isIntersecting ?? true)) : null;
    observer?.observe(canvas);
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
      drawTower(ctx, tower, false, now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [type, level, skinId, width, height, zoom, baseY]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} aria-hidden="true" />;
}
