import { loadSave } from "@/engine/SaveSystem";

interface MainMenuProps {
  onStart: () => void;
}

/**
 * Functional placeholder only — a later, dedicated art/UI phase will give
 * this the cinematic dark-fantasy treatment. For now it just needs to
 * work: show Best Wave and start a run.
 */
export function MainMenu({ onStart }: MainMenuProps) {
  const save = loadSave();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "radial-gradient(circle at 50% 30%, #201a2e 0%, #0b0c10 70%)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 56, margin: 0, letterSpacing: 4, color: "#f2e9ff" }}>HORDENOVA</h1>
        <p style={{ margin: "8px 0 0", color: "#a89bc2", letterSpacing: 2 }}>
          BUILD. UPGRADE. SURVIVE.
        </p>
      </div>

      <button
        onClick={onStart}
        style={{
          padding: "14px 40px",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 1,
          borderRadius: 10,
          border: "1px solid #c9a8ff",
          background: "#3a2f5a",
          color: "#f2e9ff",
        }}
      >
        START RUN
      </button>

      <div style={{ fontSize: 12, color: "#a89bc2", letterSpacing: 1 }}>
        BEST WAVE — {String(save.bestWave).padStart(2, "0")}
      </div>
    </div>
  );
}
