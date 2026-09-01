import { useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { LanguageProvider } from "./i18n/LanguageContext";

type View = "MENU" | "GAME";

export default function App() {
  const [view, setView] = useState<View>("MENU");

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
