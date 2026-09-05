import { useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { SeasonScreen } from "./screens/SeasonScreen";
import { WikiScreen } from "./screens/WikiScreen";
import { NovidadesScreen } from "./screens/NovidadesScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import type { NavView } from "./ui/TopNav";

type View = NavView | "GAME";

// SFX/music settings are restored onto AudioManager in main.tsx, before
// this component (or anything under it) ever renders — see that file's
// comment for why doing it in a useEffect here would be too late.

export default function App() {
  const [view, setView] = useState<View>("HOME");

  const navigate = (next: NavView) => setView(next);

  return (
    <LanguageProvider>
      {view === "GAME" ? (
        <GameScreen onExitToMenu={() => setView("HOME")} />
      ) : view === "SEASON" ? (
        <SeasonScreen onNavigate={navigate} onPlay={() => setView("GAME")} />
      ) : view === "WIKI" ? (
        <WikiScreen onNavigate={navigate} onPlay={() => setView("GAME")} />
      ) : view === "NOVIDADES" ? (
        <NovidadesScreen onNavigate={navigate} onPlay={() => setView("GAME")} />
      ) : (
        <MainMenu onStart={() => setView("GAME")} onOpenWiki={() => setView("WIKI")} onOpenNovidades={() => setView("NOVIDADES")} />
      )}
    </LanguageProvider>
  );
}
