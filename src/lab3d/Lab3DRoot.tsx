import { Suspense, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Terrain } from "./Terrain";
import { Lighting } from "./Lighting";
import { DemoController } from "./DemoController";
import { FOREST } from "./palette";

/**
 * TESTE VISUAL 3D — HORDENOVA art-direction proof of concept. Mounted
 * ONLY at `#lab3d` (see main.tsx) — completely separate React root from
 * the real game, sharing no state, no save data, no economy. Everything
 * under this component is presentational; nothing here can affect a real
 * player's account.
 */
export function Lab3DRoot() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <div style={rootStyle}>
      <Canvas
        shadows
        dpr={dpr}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.35 }}
        camera={{ position: [5, 15, 29], fov: 42, near: 0.1, far: 160 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(FOREST.skyBottom));
        }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <Terrain />
          <DemoController />
        </Suspense>
        <OrbitControls
          target={[5, 0, 3]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={18}
          maxDistance={46}
          minPolarAngle={Math.PI * 0.26}
          maxPolarAngle={Math.PI * 0.42}
          minAzimuthAngle={-Math.PI * 0.3}
          maxAzimuthAngle={Math.PI * 0.3}
        />
      </Canvas>

      <div style={overlayStyle}>
        <div style={titleStyle}>HORDENOVA — Whispering Woods (3D art-direction test)</div>
        <div style={hintStyle}>Drag to look around · Scroll to zoom · Visual prototype only, no gameplay wired</div>
      </div>

      <div style={qualityStyle}>
        <button style={btnStyle(dpr === 1)} onClick={() => setDpr(1)}>
          Performance
        </button>
        <button style={btnStyle(dpr === 1.5)} onClick={() => setDpr(1.5)}>
          Balanced
        </button>
        <button style={btnStyle(dpr === 2)} onClick={() => setDpr(2)}>
          Quality
        </button>
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0b0f08",
  overflow: "hidden",
  fontFamily: "system-ui, sans-serif",
};

const overlayStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  color: "#fdf6e8",
  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
  pointerEvents: "none",
};

const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.5,
};

const hintStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
  marginTop: 4,
};

const qualityStyle: CSSProperties = {
  position: "absolute",
  bottom: 16,
  right: 16,
  display: "flex",
  gap: 6,
};

function btnStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 6,
    border: `1px solid ${active ? "#ffd257" : "rgba(255,255,255,0.25)"}`,
    background: active ? "rgba(255,210,87,0.18)" : "rgba(0,0,0,0.35)",
    color: "#fdf6e8",
    fontSize: 11,
    cursor: "pointer",
  };
}
