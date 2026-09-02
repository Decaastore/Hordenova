import { useEffect, useRef } from "react";
import { createSceneState, drawMenuScene, MENU_SCENE_SIZE } from "@/rendering/MenuScene";

export const TRANSITION_DURATION_MS = 1500;

interface MenuBackgroundProps {
  /** Timestamp (performance.now()) the click-to-play transition started, or null when idle. */
  transitionAt: number | null;
}

/**
 * Full-bleed cinematic backdrop for the main menu — a purpose-built scene
 * (see rendering/MenuScene.ts) with a restrained ambient baseline (smoke,
 * mist, motes) plus three large choreographed hero events it schedules
 * and rotates through itself (portal surge, creature pass, distant
 * combat). "Cover" fit against a fixed virtual canvas size, a subtle
 * lerped pointer-parallax, and pointer tracking in scene-space so the
 * portal/motes can react to cursor proximity.
 */
export function MenuBackground({ transitionAt }: MenuBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transitionAtRef = useRef<number | null>(transitionAt);
  transitionAtRef.current = transitionAt;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let lastFrameTimestamp: number | null = null;
    const targetPointer = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let pointerScenePos: { x: number; y: number } | null = null;
    let currentTransform = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };
    const sceneState = createSceneState(performance.now());

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
      const { scale, offsetX, offsetY, dpr } = currentTransform;
      pointerScenePos = {
        x: (event.clientX * dpr - offsetX) / scale,
        y: (event.clientY * dpr - offsetY) / scale,
      };
    };
    const handlePointerLeave = () => {
      pointerScenePos = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    const draw = (timestamp: number) => {
      const dtMs = lastFrameTimestamp === null ? 16 : Math.min(timestamp - lastFrameTimestamp, 100);
      lastFrameTimestamp = timestamp;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.width / dpr;
      const cssHeight = canvas.height / dpr;
      const scale = Math.max(cssWidth / MENU_SCENE_SIZE.width, cssHeight / MENU_SCENE_SIZE.height) * 1.02;
      const offsetX = (cssWidth - MENU_SCENE_SIZE.width * scale) / 2;
      const offsetY = (cssHeight - MENU_SCENE_SIZE.height * scale) / 2;
      currentTransform = { scale: scale * dpr, offsetX: offsetX * dpr, offsetY: offsetY * dpr, dpr };

      pointer.x += (targetPointer.x - pointer.x) * 0.04;
      pointer.y += (targetPointer.y - pointer.y) * 0.04;

      const transitionAtValue = transitionAtRef.current;
      sceneState.transitionProgress = transitionAtValue
        ? Math.min(1, (performance.now() - transitionAtValue) / TRANSITION_DURATION_MS)
        : 0;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

      drawMenuScene(ctx, timestamp, dtMs, pointer, pointerScenePos, sceneState);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
