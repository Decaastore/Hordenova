import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element (#root) not found in index.html");
}

/**
 * TESTE VISUAL 3D — art-direction proof of concept. Reachable ONLY at
 * `#lab3d` (typed directly into the URL — never linked from TopNav or any
 * real screen, so a normal player never stumbles into it). A dynamic
 * `import()` (rather than a static one) keeps Three.js/@react-three/*
 * — and the entire `src/lab3d/` module tree — out of the real game's
 * bundle and off its network path entirely for the overwhelmingly common
 * case (nobody has `#lab3d` in the URL). `src/lab3d/` is fully self-
 * contained: nothing under `src/engine`, `src/config`, or `src/screens`
 * imports FROM it, and it only reads color/shape CONSTANTS (never game
 * logic) from the real game for visual continuity.
 */
if (window.location.hash === "#lab3d") {
  void import("./lab3d/Lab3DRoot").then(({ Lab3DRoot }) => {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <Lab3DRoot />
      </React.StrictMode>,
    );
  });
} else {
  void import("./App").then(({ default: App }) => {
    // Restores persisted SFX/music volume/mute onto AudioManager BEFORE the
    // first render. Doing this in an App-level useEffect instead would run too
    // late: components lower in the tree (e.g. MusicControl, mounted with the
    // very first Home render) read AudioManager's current values via a
    // useState initializer during that SAME initial render — which happens
    // before any effect fires — so they'd lock in AudioManager's un-restored
    // defaults and never pick up the real persisted values afterward. Calling
    // this here, before ReactDOM even renders, guarantees every component's
    // first render already sees the real persisted state.
    void Promise.all([import("./audio/audioSettings"), import("./audio/musicSettings")]).then(
      ([{ initAudioSettingsFromSave }, { initMusicSettingsFromStorage }]) => {
        initAudioSettingsFromSave();
        initMusicSettingsFromStorage();

        ReactDOM.createRoot(rootElement).render(
          <React.StrictMode>
            <App />
          </React.StrictMode>,
        );
      },
    );
  });
}
