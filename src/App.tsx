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
        // CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — the ONLY "JOGAR"
        // that goes straight into gameplay: the player is already looking
        // at the current Season (name/theme/timer/best/ranking) before this
        // fires, satisfying the required HOME -> JOGAR -> SEASON ATUAL ->
        // INICIAR/CONTINUAR RUN -> GAMEPLAY flow.
        <SeasonScreen onNavigate={navigate} onPlay={() => setView("GAME")} />
      ) : view === "WIKI" ? (
        <WikiScreen onNavigate={navigate} onPlay={() => setView("SEASON")} />
      ) : view === "NOVIDADES" ? (
        <NovidadesScreen onNavigate={navigate} onPlay={() => setView("SEASON")} />
      ) : (
        <MainMenu onStart={() => setView("SEASON")} onOpenWiki={() => setView("WIKI")} onOpenNovidades={() => setView("NOVIDADES")} />
      )}
    </LanguageProvider>
  );
}
