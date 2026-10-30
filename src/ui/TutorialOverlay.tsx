import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PALETTE } from "@/rendering/theme";
import { WORLD_SIZE } from "@/config/gameBalance";

/** Something to point at: a tagged element (`data-tutorial="…"`) or a spot on the map in world units. */
export type TutorialTarget = { kind: "dom"; id: string } | { kind: "world"; x: number; y: number; r: number };

interface TutorialOverlayProps {
  stepLabel: string | null;
  title: string;
  body: string;
  targets: readonly TutorialTarget[];
  /** "target": next to the first target; "map": bottom of the map (for cards that point at several things or none). */
  anchor: "target" | "map";
  ackLabel: string | null;
  onAck: () => void;
  skipLabel: string | null;
  onSkip: () => void;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  round: boolean;
}

const MAP_SELECTOR = '[data-tutorial="map"]';

function measure(target: TutorialTarget): Box | null {
  if (target.kind === "dom") {
    const el = document.querySelector(`[data-tutorial="${target.id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10, round: false };
  }
  const canvas = document.querySelector(MAP_SELECTOR);
  if (!canvas) return null;
  const c = canvas.getBoundingClientRect();
  const sc = Math.min(c.width / WORLD_SIZE.width, c.height / WORLD_SIZE.height);
  const ox = c.left + (c.width - WORLD_SIZE.width * sc) / 2;
  const oy = c.top + (c.height - WORLD_SIZE.height * sc) / 2;
  const r = Math.max(18, target.r * sc);
  return { left: ox + target.x * sc - r, top: oy + target.y * sc - r, width: r * 2, height: r * 2, round: true };
}

function sameBoxes(a: (Box | null)[], b: (Box | null)[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    if (!x || !y) return x === y;
    return Math.abs(x.left - y.left) < 0.5 && Math.abs(x.top - y.top) < 0.5 && Math.abs(x.width - y.width) < 0.5 && Math.abs(x.height - y.height) < 0.5;
  });
}

/**
 * FIRST-RUN TUTORIAL — the card and the pulsing rings around what it talks
 * about. Rendered into <body> with fixed positioning so it can point at the
 * HUD, the tower bar and the map alike; only the card catches clicks, so
 * the highlighted thing underneath stays clickable.
 */
export function TutorialOverlay({ stepLabel, title, body, targets, anchor, ackLabel, onAck, skipLabel, onSkip }: TutorialOverlayProps) {
  const [boxes, setBoxes] = useState<(Box | null)[]>([]);
  const [mapBox, setMapBox] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  // bring the first highlighted control into view (the Upgrade button can sit
  // below the fold of the tower panel on small screens)
  useEffect(() => {
    const first = targets[0];
    if (first?.kind !== "dom") return;
    const id = window.setTimeout(() => {
      document.querySelector(`[data-tutorial="${first.id}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [targets]);

  useEffect(() => {
    const update = () => {
      const next = targets.map(measure);
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
      const map = document.querySelector(MAP_SELECTOR)?.getBoundingClientRect() ?? null;
      setMapBox((prev) => (prev && map && Math.abs(prev.top - map.top) < 0.5 && Math.abs(prev.bottom - map.bottom) < 0.5 && Math.abs(prev.width - map.width) < 0.5 ? prev : map));
      setViewport((prev) => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }));
    };
    update();
    // targets move (a panel opens, the window resizes, the HUD reflows) —
    // a light poll is simpler and sturdier than observing every element
    const id = window.setInterval(update, 200);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [targets]);

  const cardWidth = Math.min(360, viewport.w - 24);
  const first = anchor === "target" ? boxes[0] ?? null : null;
  const cardPos: CSSProperties = {};
  if (first) {
    const cx = first.left + first.width / 2;
    cardPos.left = Math.min(viewport.w - cardWidth - 12, Math.max(12, cx - cardWidth / 2));
    const centerY = first.top + first.height / 2;
    const sideRoom = first.left - cardWidth - 14 >= 12;
    if (first.left + first.width > viewport.w * 0.75 && sideRoom && centerY > viewport.h * 0.2 && centerY < viewport.h * 0.8) {
      // a target on the right edge (the tower panel): sit beside it, never over it
      cardPos.left = first.left - cardWidth - 14;
      cardPos.top = Math.min(viewport.h - 200, Math.max(12, centerY - 80));
    } else if (centerY > viewport.h * 0.5) cardPos.bottom = Math.max(8, viewport.h - first.top + 14);
    else cardPos.top = Math.min(viewport.h - 120, first.top + first.height + 14);
  } else {
    cardPos.left = (mapBox ? mapBox.left + mapBox.width / 2 : viewport.w / 2) - cardWidth / 2;
    cardPos.left = Math.min(viewport.w - cardWidth - 12, Math.max(12, cardPos.left as number));
    // a phone's map is only a few hundred pixels tall: there the card sits at
    // the very bottom of the screen instead of covering the map it talks about
    const shortMap = !mapBox || mapBox.height < 380;
    cardPos.bottom = shortMap ? 8 : Math.max(8, viewport.h - mapBox.bottom + 16);
  }

  return createPortal(
    <div style={layerStyle} data-testid="tutorial-overlay">
      <style>{TUTORIAL_CSS}</style>
      {boxes.map((b, i) =>
        b ? (
          <div
            key={i}
            className="hn-tut-ring"
            style={{ left: b.left, top: b.top, width: b.width, height: b.height, borderRadius: b.round ? "50%" : 12 }}
          />
        ) : null,
      )}
      <div className="hn-tut-card" role="dialog" aria-label={title} style={{ ...cardStyle, ...cardPos, width: cardWidth }}>
        {stepLabel && <div style={stepStyle}>{stepLabel}</div>}
        <div style={titleStyle}>{title}</div>
        <p style={bodyStyle}>{body}</p>
        {(ackLabel || skipLabel) && (
          <div style={rowStyle}>
            {skipLabel && (
              <button style={skipStyle} onClick={onSkip}>
                {skipLabel}
              </button>
            )}
            {ackLabel && (
              <button style={ackStyle} onClick={onAck} autoFocus>
                {ackLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const TUTORIAL_CSS = `
.hn-tut-ring{position:fixed;pointer-events:none;box-sizing:border-box;border:2px solid #ffd257;
  box-shadow:0 0 0 3px rgba(255,210,87,.18),0 0 18px rgba(255,210,87,.55);animation:hn-tut-pulse 1.4s ease-in-out infinite}
@keyframes hn-tut-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.7}}
.hn-tut-card{animation:hn-tut-in .22s ease-out}
@keyframes hn-tut-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.hn-tut-card button:focus-visible{outline:2px solid #ffd257;outline-offset:2px}
@media (prefers-reduced-motion: reduce){.hn-tut-ring,.hn-tut-card{animation:none}}
`;

const layerStyle: CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 };
const cardStyle: CSSProperties = {
  position: "fixed",
  boxSizing: "border-box",
  pointerEvents: "auto",
  padding: "13px 16px 13px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "linear-gradient(160deg, rgba(42,29,16,0.98), rgba(22,15,8,0.98))",
  boxShadow: "0 14px 34px rgba(0,0,0,0.6)",
  color: PALETTE.uiText,
  maxHeight: "calc(100vh - 16px)",
  overflowY: "auto",
};
const stepStyle: CSSProperties = { fontSize: 11.5, color: PALETTE.gold, fontWeight: 700 };
const titleStyle: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 23, fontWeight: 700, lineHeight: 1.15, color: PALETTE.uiAccentBright, marginTop: 1 };
const bodyStyle: CSSProperties = { margin: "5px 0 0", fontSize: 13.5, lineHeight: 1.5, color: PALETTE.uiText };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 11 };
const skipStyle: CSSProperties = {
  marginRight: "auto",
  padding: "6px 2px",
  border: "none",
  background: "none",
  color: PALETTE.uiTextDim,
  fontSize: 12.5,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
};
const ackStyle: CSSProperties = {
  marginLeft: "auto",
  padding: "7px 18px",
  borderRadius: 8,
  border: "1px solid #f2c873",
  background: "linear-gradient(180deg, #f6cf7a, #e8b04b 55%, #c58a2c)",
  color: "#2b1906",
  fontWeight: 800,
  fontSize: 13.5,
  cursor: "pointer",
};
