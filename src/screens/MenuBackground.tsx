import { useEffect, useRef } from "react";
import { drawMenuScene, MENU_SCENE_SIZE } from "@/rendering/MenuScene";

/**
 * Full-bleed cinematic backdrop for the main menu — a purpose-built scene
 * (see rendering/MenuScene.ts), not the top-down gameplay map reused at a
 * different zoom. "Cover" fit against a fixed virtual canvas size, plus a
 * subtle, lerped pointer-parallax so the layered depth reads even before
 * anything on screen animates on its own.
 */
export function MenuBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    const targetPointer = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };

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

    const handlePointerMove = (event: PointerEvent) => {
      targetPointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetPointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", handlePointerMove);

    const draw = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      const scale = Math.max(cssWidth / MENU_SCENE_SIZE.width, cssHeight / MENU_SCENE_SIZE.height) * 1.02;
      const offsetX = (cssWidth - MENU_SCENE_SIZE.width * scale) / 2;
      const offsetY = (cssHeight - MENU_SCENE_SIZE.height * scale) / 2;

      pointer.x += (targetPointer.x - pointer.x) * 0.04;
      pointer.y += (targetPointer.y - pointer.y) * 0.04;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

      drawMenuScene(ctx, timestamp, pointer);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
