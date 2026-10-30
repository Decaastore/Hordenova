import { useEffect, useRef } from "react";
import { HomeDiorama as Scene } from "@/rendering/homeDiorama";

interface HomeDioramaProps {
  /** Which showcase scene to show; changing it crossfades to that scene. */
  sceneIndex: number;
  /** True while the Play transition runs — the camera pushes in toward the castle gate. */
  entering: boolean;
}

/** World rectangle the camera frames: the battlefield plus the castle on its right edge. */
const FOCUS = { x0: 190, y0: 48, x1: 1080, y1: 604 };
const MAX_DPR = 1.5;

/**
 * Full-bleed canvas running the Home screen's live battle (see
 * rendering/homeDiorama.ts). The camera "covers" the hero area, keeps the
 * castle in frame on narrow screens, drifts very slowly and pauses entirely
 * while the hero is scrolled out of view or the tab is hidden.
 */
export function HomeDiorama({ sceneIndex, entering }: HomeDioramaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const sceneIndexRef = useRef(sceneIndex);
  const enteringAtRef = useRef<number | null>(null);

  useEffect(() => {
    sceneIndexRef.current = sceneIndex;
    sceneRef.current?.goTo(sceneIndex, performance.now());
  }, [sceneIndex]);

  useEffect(() => {
    enteringAtRef.current = entering ? performance.now() : null;
  }, [entering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scene = new Scene(performance.now(), sceneIndexRef.current);
    sceneRef.current = scene;
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let visible = true;
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e?.isIntersecting ?? true)) : null;
    observer?.observe(canvas);

    let raf = 0;
    let last: number | null = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last === null ? 16 : Math.min(now - last, 100);
      last = now;
      if (!visible || document.hidden) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      scene.update(now, dt);
      const CASTLE = scene.castlePosition();

      // Cover-fit the focus rect, then keep the castle on screen when the
      // viewport is narrower than the battlefield (phones).
      const fw = FOCUS.x1 - FOCUS.x0;
      const fh = FOCUS.y1 - FOCUS.y0;
      const breathe = reduceMotion ? 0 : (Math.sin(now / 9000) + 1) * 0.025;
      const enterAt = enteringAtRef.current;
      const push = enterAt === null ? 0 : Math.min(1, (now - enterAt) / 1500);
      const zoom = (1.02 + breathe) * (1 + push * push * 0.9);
      // Portrait screens: tighter framing so the castle reads above the text.
      const portrait = h > w * 1.1;
      const scale = (portrait ? Math.max(w / 470, h / 660) : Math.max(w / fw, h / fh)) * zoom;
      const viewW = w / scale;
      const viewH = h / scale;
      let cx = (FOCUS.x0 + FOCUS.x1) / 2 + (reduceMotion ? 0 : Math.sin(now / 13000) * 12);
      let cy = (FOCUS.y0 + FOCUS.y1) / 2;
      cx = Math.max(cx, FOCUS.x1 - viewW / 2);
      if (portrait) {
        cx = CASTLE.x - viewW * 0.14;
        cy = CASTLE.y + viewH * 0.26;
      } else if (viewH < fh) cy = Math.min(FOCUS.y1 - viewH / 2, Math.max(FOCUS.y0 + viewH / 2, CASTLE.y - viewH * 0.12));
      cx += (CASTLE.x - cx) * push * push;
      cy += (CASTLE.y - cy) * push * push;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0d0a07";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const s = scale * dpr;
      ctx.setTransform(s, 0, 0, s, (w / 2 - cx * scale) * dpr, (h / 2 - cy * scale) * dpr);
      const bounds = { x0: cx - viewW / 2, y0: cy - viewH / 2, x1: cx + viewW / 2, y1: cy + viewH / 2 };
      scene.draw(ctx, now, bounds);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      sceneRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
