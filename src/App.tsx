import { useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { ModeSelectScreen, type GameMode } from "./screens/ModeSelectScreen";
import { WikiScreen } from "./screens/WikiScreen";
import { NovidadesScreen } from "./screens/NovidadesScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import type { NavView } from "./ui/TopNav";

type View = "HOME" | "WIKI" | "NOVIDADES" | "MODE_SELECT" | "GAME";

// SFX/music settings are restored onto AudioManager in main.tsx, before
// this component (or anything under it) ever renders — see that file's
// comment for why doing it in a useEffect here would be too late.

export default function App() {
  const [view, setView] = useState<View>("HOME");
  const [mode, setMode] = useState<GameMode>("INFINITE");

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
