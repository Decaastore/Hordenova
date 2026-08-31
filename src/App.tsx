import { useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";

type View = "MENU" | "GAME";

export default function App() {
  const [view, setView] = useState<View>("MENU");

  if (view === "GAME") {
    return <GameScreen onExitToMenu={() => setView("MENU")} />;
  }

  return <MainMenu onStart={() => setView("GAME")} />;
}
