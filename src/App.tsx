import { useEffect, useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import { initAudioSettingsFromSave } from "./audio/audioSettings";

type View = "MENU" | "GAME";

export default function App() {
  const [view, setView] = useState<View>("MENU");

  // Restores the player's saved SFX volume/mute before any sound can play
  // — safe to do before the audio system is "unlocked" (spec section 12),
  // since this only sets AudioManager's internal state, it doesn't play anything.
  useEffect(() => {
    initAudioSettingsFromSave();
  }, []);

  return (
    <LanguageProvider>
      {view === "GAME" ? (
        <GameScreen onExitToMenu={() => setView("MENU")} />
      ) : (
        <MainMenu onStart={() => setView("GAME")} />
      )}
    </LanguageProvider>
  );
}
