import type { CSSProperties } from "react";
import { Hybrid2DBackground } from "./Hybrid2DBackground";
import { HybridScene3D } from "./HybridScene3D";
import { CANVAS_W, CANVAS_H } from "./hybridWorldData";

/**
 * PROVA DE CONCEITO HÍBRIDA — 2D (real HORDENOVA) + 3D integration test.
 * Mounted ONLY at `#hybrid` (see main.tsx) — its own React root, sharing
 * no state, save data, or component tree with the real game. Everything
 * gameplay-related here is either a static read of REAL production data
 * (the map/path/tower-slot) or a small self-contained cosmetic demo loop
 * (`HybridDemoController`) — no GameEngine, no WaveManager, no economy.
 *
 * Layering, bottom to top:
 *  1. `Hybrid2DBackground` — the actual 2D MapRenderer output, cropped.
 *  2. `HybridScene3D` — a transparent 3D layer with the Brute + tower.
 *  3. This file's title/legend overlay.
 */
export function HybridRoot() {
  return (
    <div style={pageStyle}>
      <div style={frameStyle}>
        <div style={{ ...stageStyle, width: CANVAS_W, height: CANVAS_H }}>
          <Hybrid2DBackground />
          <HybridScene3D />
        </div>

        <div style={legendStyle}>
          <div style={titleStyle}>HORDENOVA — Prova de Conceito Híbrida (2D + 3D)</div>
          <div style={hintStyle}>
            Mapa/rota/plataforma: renderização 2D real (MapRenderer). Brute + Torre Ironwood + ataque: camada 3D
            sobreposta. Protótipo experimental — sem gameplay, sem save, descartável.
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0b0f08",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
};

const frameStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const stageStyle: CSSProperties = {
  position: "relative",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
};

const legendStyle: CSSProperties = {
  maxWidth: 680,
  textAlign: "center",
  color: "#fdf6e8",
};

const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const hintStyle: CSSProperties = {
  fontSize: 11.5,
  opacity: 0.75,
  marginTop: 6,
  lineHeight: 1.5,
};
