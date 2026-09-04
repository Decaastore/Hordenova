import { useEffect, useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { ModeSelectScreen, type GameMode } from "./screens/ModeSelectScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import { initAudioSettingsFromSave } from "./audio/audioSettings";

type View = "MENU" | "MODE_SELECT" | "GAME";

export default function App() {
  const [view, setView] = useState<View>("MENU");
  const [mode, setMode] = useState<GameMode>("INFINITE");

  // Restores the player's saved SFX volume/mute before any sound can play
  // — safe to do before the audio system is "unlocked" (spec section 12),
  // since this only sets AudioManager's internal state, it doesn't play anything.
  useEffect(() => {
    initAudioSettingsFromSave();
  }, []);

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
          onBack={() => setView("MENU")}
        />
      ) : (
        <MainMenu onStart={() => setView("MODE_SELECT")} />
      )}
    </LanguageProvider>
  );
}
