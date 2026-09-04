import { useEffect, useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { ModeSelectScreen, type GameMode } from "./screens/ModeSelectScreen";
import { WikiScreen } from "./screens/WikiScreen";
import { NovidadesScreen } from "./screens/NovidadesScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import { initAudioSettingsFromSave } from "./audio/audioSettings";
import { initMusicSettingsFromStorage } from "./audio/musicSettings";
import type { NavView } from "./ui/TopNav";

type View = "HOME" | "WIKI" | "NOVIDADES" | "MODE_SELECT" | "GAME";

export default function App() {
  const [view, setView] = useState<View>("HOME");
  const [mode, setMode] = useState<GameMode>("INFINITE");

  // Restores the player's saved SFX/music volume/mute before any sound can
  // play — safe to do before the audio system is "unlocked" (spec section
  // 12), since this only sets AudioManager's internal state, it doesn't
  // play anything.
  useEffect(() => {
    initAudioSettingsFromSave();
    initMusicSettingsFromStorage();
  }, []);

  const navigate = (next: NavView) => setView(next);

  return (
    <LanguageProvider>
      {view === "GAME" ? (
        <GameScreen mode={mode} onExitToMenu={() => setView("MODE_SELECT")} />
      ) : view === "MODE_SELECT" ? (
        <ModeSelectScreen
          onSelectMode={(selected) => {
            setMode(selected);
            setView("GAME");
          }}
          onBack={() => setView("HOME")}
        />
      ) : view === "WIKI" ? (
        <WikiScreen onNavigate={navigate} onPlay={() => setView("MODE_SELECT")} />
      ) : view === "NOVIDADES" ? (
        <NovidadesScreen onNavigate={navigate} onPlay={() => setView("MODE_SELECT")} />
      ) : (
        <MainMenu onStart={() => setView("MODE_SELECT")} onOpenWiki={() => setView("WIKI")} onOpenNovidades={() => setView("NOVIDADES")} />
      )}
    </LanguageProvider>
  );
}
