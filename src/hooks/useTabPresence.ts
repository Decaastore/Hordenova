import { useEffect, useRef, useState } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import { useLanguage } from "@/i18n/LanguageContext";

export const BASE_TITLE = "Horde Nova";
/** Coming back to the tab after at least this long hidden shows what happened meanwhile. */
const SUMMARY_MIN_HIDDEN_MS = 60_000;

export interface HiddenTabSummary {
  hiddenMs: number;
  waves: number;
  gold: number;
}

/**
 * Idle in a browser tab: while the tab is in the background the game keeps
 * playing (engine/GameLoop.ts), so the tab title says what's going on —
 * the castle fell, a boss is coming, a mission is ready, or simply the
 * current wave. Coming back after a while returns a short summary of what
 * happened (a long browser freeze is covered by the full Welcome Back
 * screen instead — GameEngine.catchUpHiddenTime).
 */
export function useTabPresence(hud: HudSnapshot): { summary: HiddenTabSummary | null; dismiss: () => void } {
  const { t } = useLanguage();
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const [summary, setSummary] = useState<HiddenTabSummary | null>(null);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const hiddenAt = useRef<{ at: number; wave: number; bestWave: number; gold: number } | null>(null);

  useEffect(() => {
    const onChange = () => {
      const isHidden = document.hidden;
      setHidden(isHidden);
      const h = hudRef.current;
      if (isHidden) {
        hiddenAt.current = { at: Date.now(), wave: h.wave, bestWave: h.bestWave, gold: h.gold };
        return;
      }
      const start = hiddenAt.current;
      hiddenAt.current = null;
      if (!start) return;
      // read the HUD after the loop's catch-up ran (it replays the hidden time on this same event)
      setTimeout(() => {
        const now = hudRef.current;
        const hiddenMs = Date.now() - start.at;
        const waves = Math.max(0, now.bestWave - start.bestWave, now.wave - start.wave);
        const gold = Math.max(0, now.gold - start.gold);
        if (hiddenMs >= SUMMARY_MIN_HIDDEN_MS && now.phase !== "OFFLINE_RETURN" && (waves > 0 || gold > 0)) setSummary({ hiddenMs, waves, gold });
      }, 0);
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (!hidden) {
      document.title = BASE_TITLE;
      return;
    }
    let status: string;
    if (hud.phase === "PROGRESSION_STOPPED") status = t("tab.castleFell");
    else if (hud.phase === "DEPLOY") status = t("tab.deploy");
    else if (hud.phase === "BOSS_INTRO" || hud.phase === "BOSS_BATTLE") status = t("tab.boss");
    else if (hud.missionsClaimable > 0) status = t("tab.mission");
    else status = t("tab.wave", { wave: hud.wave });
    document.title = `${status} · ${BASE_TITLE}`;
  }, [hidden, hud.phase, hud.missionsClaimable, hud.wave, t]);

  // restore the plain title when leaving the game screen
  useEffect(() => () => void (document.title = BASE_TITLE), []);

  // the summary fades on its own
  useEffect(() => {
    if (!summary) return;
    const id = setTimeout(() => setSummary(null), 9000);
    return () => clearTimeout(id);
  }, [summary]);

  return { summary, dismiss: () => setSummary(null) };
}
