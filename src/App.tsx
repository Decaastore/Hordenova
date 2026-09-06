import { useEffect, useState } from "react";
import { MainMenu } from "./screens/MainMenu";
import { GameScreen } from "./screens/GameScreen";
import { SeasonScreen } from "./screens/SeasonScreen";
import { RankingScreen } from "./screens/RankingScreen";
import { WikiScreen } from "./screens/WikiScreen";
import { NovidadesScreen } from "./screens/NovidadesScreen";
import { LanguageProvider } from "./i18n/LanguageContext";
import { audioManager } from "./audio/AudioManager";
import type { NavView } from "./ui/TopNav";

type View = NavView | "GAME";

// SFX/music settings are restored onto AudioManager in main.tsx, before
// this component (or anything under it) ever renders — see that file's
// comment for why doing it in a useEffect here would be too late.

export default function App() {
  const [view, setView] = useState<View>("HOME");

  const navigate = (next: NavView) => setView(next);

  // MÚSICA GLOBAL spec sections 18-21: the ambient track is now a property
  // of the whole app's lifetime, not of any one screen — App itself never
  // unmounts as `view` changes (only the screen it renders conditionally
  // below does), so this is the one place its lifecycle can live without
  // restarting/duplicating on every navigation.
  //
  // Two effects, deliberately separate:
  //   1. The first-gesture fallback listeners are attached ONCE for the
  //      app's entire lifetime (empty deps) — attaching them per-navigation
  //      would mean a gesture on a later screen no longer does anything
  //      useful (they're `{ once: true }`, so they'd already have fired and
  //      detached after the very first interaction on Home).
  //   2. The play/stop decision re-runs whenever `view` changes: every
  //      non-gameplay screen wants the track playing (a true autoplay
  //      attempt on first mount, an idempotent resume — see
  //      AudioManager.playAmbientMusic's own doc comment — on every later
  //      navigation back to one), while entering actual GAME stops it
  //      (gameplay gets its own future track per spec section 24, and
  //      today simply has none — see GameScreen.tsx's SFX-only audio use).
  useEffect(() => {
    const startMusic = () => {
      audioManager.unlock();
      audioManager.playAmbientMusic();
    };
    window.addEventListener("pointerdown", startMusic, { once: true });
    window.addEventListener("keydown", startMusic, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
    };
  }, []);

  useEffect(() => {
    if (view === "GAME") {
      audioManager.stopMusic();
    } else {
      audioManager.playAmbientMusic();
    }
  }, [view]);

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
      ) : view === "RANKING" ? (
        <RankingScreen onNavigate={navigate} onPlay={() => setView("SEASON")} />
      ) : view === "WIKI" ? (
        <WikiScreen onNavigate={navigate} onPlay={() => setView("SEASON")} />
      ) : view === "NOVIDADES" ? (
        <NovidadesScreen onNavigate={navigate} onPlay={() => setView("SEASON")} />
      ) : (
        <MainMenu onStart={() => setView("SEASON")} onNavigate={navigate} />
      )}
    </LanguageProvider>
  );
}
