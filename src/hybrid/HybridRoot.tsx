import { useState, type CSSProperties } from "react";
import { Hybrid2DBackground } from "./Hybrid2DBackground";
import { HybridScene3D } from "./HybridScene3D";
import { CastleShowcaseScene } from "./CastleShowcaseScene";
import { CANVAS_W, CANVAS_H } from "./hybridWorldData";
import { ironwoodBaseSkin } from "./towers/skins/ironwoodBaseSkin";
import { ironwoodEmberSkin } from "./towers/skins/ironwoodEmberSkin";
import type { TowerSkinDefinition } from "./towers/towerSkinTypes";

const TOWER_SKINS: readonly TowerSkinDefinition[] = [ironwoodBaseSkin, ironwoodEmberSkin];

/**
 * PROVA DE CONCEITO HÍBRIDA — 2D (real HORDENOVA) + 3D integration test,
 * now extended into a SKIN LAB: HORDENOVA will sell paid Tower/Castle
 * skins, so this step tests whether the same 3D base can carry a genuinely
 * different premium look (not a recolor) and whether a first castle
 * concept has enough presence to anchor that future economy. Mounted
 * ONLY at `#hybrid` (see main.tsx) — its own React root, sharing no
 * state, save data, or component tree with the real game.
 *
 * Layout:
 *  1. "Arena Híbrida" — the real 2D MapRenderer output (cropped) + the
 *     3D Brute + toggleable Ironwood tower skin, exactly like the first
 *     hybrid step, plus a skin-switch control.
 *  2. "Castelo — Showcase" — a separate, disclosed-as-separate 3D-only
 *     display of the first castle concept (see CastleShowcaseScene.tsx
 *     for why it isn't composited onto the map crop above).
 */
export function HybridRoot() {
  const [skinIndex, setSkinIndex] = useState(0);
  const skin = TOWER_SKINS[skinIndex]!;

  return (
    <div style={pageStyle}>
      <div style={frameStyle}>
        <div style={sectionLabelStyle}>ARENA HÍBRIDA — mapa real + Brute + Torre (skin alternável)</div>
        <div style={{ ...stageStyle, width: CANVAS_W, height: CANVAS_H }}>
          <Hybrid2DBackground />
          <HybridScene3D towerSkin={skin} />
        </div>

        <div style={togglePanelStyle}>
          {TOWER_SKINS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setSkinIndex(i)} style={i === skinIndex ? { ...toggleButtonStyle, ...toggleButtonActiveStyle } : toggleButtonStyle}>
              {s.name}
            </button>
          ))}
        </div>
        <div style={skinDescStyle}>{skin.description}</div>

        <div style={sectionLabelStyle}>CASTELO — SHOWCASE (concept, exibido isoladamente — ver nota abaixo)</div>
        <div style={{ ...stageStyle, width: CANVAS_W, height: 320 }}>
          <CastleShowcaseScene />
        </div>

        <div style={legendStyle}>
          <div style={titleStyle}>HORDENOVA — Prova de Conceito Híbrida (2D + 3D) — SKIN LAB</div>
          <div style={hintStyle}>
            Mapa/rota/plataforma: renderização 2D real (MapRenderer). Brute + Torre Ironwood + ataque: camada 3D
            sobreposta. A torre agora é modular (base/corpo/ornamentos/núcleo/correntes/efeitos definidos por um
            TowerSkinDefinition) — o botão acima troca entre a skin base e a variante premium, sem duplicar
            componentes. O Castelo é uma primeira versão conceitual, mostrada em um showcase 3D separado (não
            posicionada no recorte real do mapa — sua coordenada de produção fica bem além desta janela). Protótipo
            experimental — sem gameplay, sem save, descartável.
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
  overflowY: "auto",
  padding: "24px 0",
};

const frameStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const stageStyle: CSSProperties = {
  position: "relative",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
};

const sectionLabelStyle: CSSProperties = {
  color: "#c9bfa0",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  marginTop: 8,
};

const togglePanelStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 4,
};

const toggleButtonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid rgba(253,246,232,0.25)",
  background: "rgba(20,18,12,0.7)",
  color: "#fdf6e8",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const toggleButtonActiveStyle: CSSProperties = {
  background: "linear-gradient(180deg, #6a4a2a, #3a2814)",
  border: "1px solid #ffcf8a",
  boxShadow: "0 0 12px rgba(255,138,60,0.35)",
};

const skinDescStyle: CSSProperties = {
  color: "#fdf6e8",
  opacity: 0.75,
  fontSize: 11.5,
  maxWidth: 680,
  textAlign: "center",
};

const legendStyle: CSSProperties = {
  maxWidth: 700,
  textAlign: "center",
  color: "#fdf6e8",
  marginTop: 10,
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
