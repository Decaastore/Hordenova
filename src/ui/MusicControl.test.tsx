import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MusicControl } from "./MusicControl";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { initMusicSettingsFromStorage, setMusicVolume, toggleMusicMuted } from "@/audio/musicSettings";
import { audioManager } from "@/audio/AudioManager";

function render(): string {
  return renderToStaticMarkup(
    <LanguageProvider>
      <MusicControl />
    </LanguageProvider>,
  );
}

/**
 * Regression test for a real bug found during live verification: a
 * player's persisted music volume/mute (musicSettings.ts, its own
 * localStorage key) silently reset to the defaults (100%, unmuted) on
 * every reload, even though the CORRECT values were sitting right there in
 * localStorage. Root cause: `initMusicSettingsFromStorage()` used to run
 * inside App.tsx's `useEffect`, but MusicControl's `useState(getMusicVolume)`
 * / `useState(isMusicMuted)` initializers run during the INITIAL RENDER —
 * which happens before ANY effect fires, App's included — so MusicControl
 * always locked in AudioManager's un-restored defaults. Fixed by moving the
 * restore call to main.tsx, before ReactDOM ever renders anything. This
 * test reproduces the exact ordering that matters: call
 * initMusicSettingsFromStorage() BEFORE rendering MusicControl (matching
 * main.tsx's real sequence) and assert the very first render already
 * reflects the persisted values — not the defaults.
 */
describe("MusicControl — persisted volume/mute survive a reload (real bug, fixed)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    audioManager.setMusicVolume(1);
    audioManager.setMusicMuted(false);
  });

  it("the FIRST render already shows a persisted non-default volume, not 100%", () => {
    setMusicVolume(0.25); // simulates a choice made in a previous session, already in localStorage
    audioManager.setMusicVolume(1); // perturb the live manager back to the default — only initMusicSettingsFromStorage() below should be able to fix this before render

    initMusicSettingsFromStorage(); // this is what main.tsx now does BEFORE rendering anything
    const html = render();

    expect(html).toContain("25%");
    expect(html).not.toContain("100%");
  });

  it("the FIRST render already reflects a persisted mute, not the default unmuted state", () => {
    toggleMusicMuted(); // now muted, persisted
    audioManager.setMusicMuted(false); // perturb back to unmuted in memory

    initMusicSettingsFromStorage();
    const html = render();

    expect(html).toContain('aria-pressed="true"');
  });

  it("with nothing persisted yet, the first render shows the real sane defaults (not 0%/muted)", () => {
    initMusicSettingsFromStorage();
    const html = render();
    expect(html).toContain('aria-pressed="false"');
  });
});
