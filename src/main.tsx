import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAudioSettingsFromSave } from "./audio/audioSettings";
import { initMusicSettingsFromStorage } from "./audio/musicSettings";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element (#root) not found in index.html");
}

// Restores persisted SFX/music volume/mute onto AudioManager BEFORE the
// first render. Doing this in an App-level useEffect instead would run too
// late: components lower in the tree (e.g. MusicControl, mounted with the
// very first Home render) read AudioManager's current values via a
// useState initializer during that SAME initial render — which happens
// before any effect fires — so they'd lock in AudioManager's un-restored
// defaults and never pick up the real persisted values afterward. Calling
// this here, before ReactDOM even renders, guarantees every component's
// first render already sees the real persisted state.
initAudioSettingsFromSave();
initMusicSettingsFromStorage();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
