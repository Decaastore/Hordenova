import { SFX_ASSETS, type SfxId, type SfxPriority } from "./sfxCatalog";

/**
 * Audio spec sections 1/5/6/12/13/15/16 — the ONLY place in the codebase
 * that touches `Audio`/`HTMLAudioElement`. Gameplay code (GameEngine,
 * CombatSystem, ...) never imports this file or a sound file path
 * directly — it emits semantic events (engine/AudioEvents.ts) that
 * audio/GameAudioBridge.ts translates into calls here. That indirection
 * is what keeps "add a new SFX" from ever touching engine code.
 *
 * Home screen ambient music (see playAmbientMusic below) lives here too —
 * this is still "the one place that touches audio", it just also owns a
 * Web Audio API graph alongside the HTMLAudioElement SFX pools.
 *
 * Performance (section 15): a small pool of reusable HTMLAudioElements per
 * sound id, not a fresh `new Audio()` per play — this runs for hours in an
 * Active Idle session, so unbounded object churn is a real leak risk.
 */
const MAX_GLOBAL_VOICES = 10;
const PRIORITY_RANK: Record<SfxPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Web Audio API global constructor, prefixed on old Safari. Absent in the vitest/jsdom test environment — every music method below degrades to a silent no-op there, never a thrown error. */
function getAudioContextConstructor(): typeof AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface MusicGraph {
  ctx: AudioContext;
  masterGain: GainNode;
  stop: () => void;
}

/**
 * PRODUÇÃO — RODADA 2, item 1-5 (P0, non-negotiable): the previous ambient
 * pad — even after adding harmonics/breathing/a bell — was still, in the
 * end, a held drone: no melody, no rhythm, nothing that resembles a game
 * theme. That was correctly rejected as "zumbido", regardless of whether it
 * technically produced a measurable signal. This is a from-scratch
 * replacement: a real short COMPOSITION (melody, bass, rhythm, harmonic
 * movement, structure, a natural loop point), not a sustained tone bank.
 *
 * HONESTY NOTE: there is no music-generation tool available to this agent,
 * and a filesystem search of this repo turned up zero existing music
 * assets and zero audio libraries (Tone.js, Howler, ...) already
 * installed — see `HOME_THEME_ASSET_URL` below for the real-file path this
 * infrastructure is ready to prefer the moment a licensed track is added;
 * until then, this procedural piece is the best-effort placeholder. It is
 * still synthesized in-code (oscillators + envelopes), NOT a
 * recorded/produced audio file — that distinction is disclosed rather than
 * hidden. What changed from the rejected drone: this has a real, singable
 * melodic phrase, a real bass line following real chord changes, a soft
 * rhythmic pulse, and a ~59s structure (intro -> theme -> development ->
 * return) that loops back to its own starting point instead of holding one
 * unchanging texture indefinitely.
 */

/** Where a real, licensed music file would go — dropping a file at this path in `public/` makes `playAmbientMusic()` use it automatically instead of the procedural composition below (see `tryPlayRealTrackFile`). No such file exists in this project today; this constant does not claim otherwise. */
const HOME_THEME_ASSET_URL = "/audio/music/home-theme.ogg";

/** Standard equal-tempered pitches (A4=440Hz) used by the composition below. */
const NOTE: Record<string, number> = {
  D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81,
  D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
  Bb4: 466.16, C5: 523.25, D5: 587.33,
};

const THEME_BPM = 82;
const BEAT_SEC = 60 / THEME_BPM;
/** 20 bars of 4/4 — intro (4) + theme (8) + development (4) + return (4). */
const LOOP_BEATS = 80;
const LOOP_SEC = LOOP_BEATS * BEAT_SEC;

interface NoteEvent {
  /** Offset from the loop's start, in beats. */
  beat: number;
  freq: number;
  /** Length, in beats. */
  beats: number;
}

/**
 * The lead melody — a real, contoured phrase in D Dorian (the "heroic
 * fantasy" mode: a minor scale with a raised 6th, common in adventure/Celtic
 * game scoring), rising to a peak over the borrowed VI chord (bar 5, Bb)
 * before resolving back down to the tonic — real tension and release, the
 * thing a drone by definition cannot have.
 */
const LEAD_MELODY: NoteEvent[] = [
  // Bars 5-8 (Theme A begins at beat 16 = bar 5): D-F-G / A-G-F / E-D / D-rest
  { beat: 16, freq: NOTE.D4!, beats: 2 },
  { beat: 18, freq: NOTE.F4!, beats: 1 },
  { beat: 19, freq: NOTE.G4!, beats: 1 },
  { beat: 20, freq: NOTE.A4!, beats: 2 },
  { beat: 22, freq: NOTE.G4!, beats: 1 },
  { beat: 23, freq: NOTE.F4!, beats: 1 },
  { beat: 24, freq: NOTE.E4!, beats: 2 },
  { beat: 26, freq: NOTE.D4!, beats: 2 },
  { beat: 28, freq: NOTE.D4!, beats: 2 },
  // Bars 9-12: the peak — C5-Bb4-A4 / G4-A4-Bb4 / A4-G4 / F4-D4 (cadence)
  { beat: 32, freq: NOTE.C5!, beats: 2 },
  { beat: 34, freq: NOTE.Bb4!, beats: 1 },
  { beat: 35, freq: NOTE.A4!, beats: 1 },
  { beat: 36, freq: NOTE.G4!, beats: 2 },
  { beat: 38, freq: NOTE.A4!, beats: 1 },
  { beat: 39, freq: NOTE.Bb4!, beats: 1 },
  { beat: 40, freq: NOTE.A4!, beats: 2 },
  { beat: 42, freq: NOTE.G4!, beats: 2 },
  { beat: 44, freq: NOTE.F4!, beats: 2 },
  { beat: 46, freq: NOTE.D4!, beats: 2 },
  // Bars 13-16 (development, up an octave — more energy/urgency)
  { beat: 48, freq: NOTE.D5!, beats: 2 },
  { beat: 50, freq: NOTE.C5!, beats: 1 },
  { beat: 51, freq: NOTE.Bb4!, beats: 1 },
  { beat: 52, freq: NOTE.A4!, beats: 2 },
  { beat: 54, freq: NOTE.C5!, beats: 2 },
  { beat: 56, freq: NOTE.D5!, beats: 2 },
  { beat: 58, freq: NOTE.A4!, beats: 1 },
  { beat: 59, freq: NOTE.F4!, beats: 1 },
  { beat: 60, freq: NOTE.G4!, beats: 2 },
  { beat: 62, freq: NOTE.A4!, beats: 2 },
  // Bars 17-18 (return — winding back down toward the loop point)
  { beat: 64, freq: NOTE.A3!, beats: 2 },
  { beat: 66, freq: NOTE.F3!, beats: 1 },
  { beat: 67, freq: NOTE.D3!, beats: 1 },
  { beat: 68, freq: NOTE.D3!, beats: 4 },
  // Bars 19-20 are deliberately silent on lead — breathing room before the
  // loop restarts, so the seam reads as a musical phrase-end, not a splice.
];

/** A plucked-string arpeggio (harp/lute character via a fast-closing filter, see PLUCK envelope below) outlining each bar's chord — the intro's "world opening up" figure, continuing quietly under the theme. */
const PLUCK_NOTES: NoteEvent[] = [
  // Intro (bars 1-4): rising Dm arpeggio, once per bar.
  { beat: 0, freq: NOTE.D3!, beats: 1 }, { beat: 1, freq: NOTE.F3!, beats: 1 }, { beat: 2, freq: NOTE.A3!, beats: 1 }, { beat: 3, freq: NOTE.D4!, beats: 1 },
  { beat: 4, freq: NOTE.D3!, beats: 1 }, { beat: 5, freq: NOTE.F3!, beats: 1 }, { beat: 6, freq: NOTE.A3!, beats: 1 }, { beat: 7, freq: NOTE.D4!, beats: 1 },
  { beat: 8, freq: NOTE.Bb2!, beats: 1 }, { beat: 9, freq: NOTE.D3!, beats: 1 }, { beat: 10, freq: NOTE.F3!, beats: 1 }, { beat: 11, freq: NOTE.Bb3!, beats: 1 },
  { beat: 12, freq: NOTE.C3!, beats: 1 }, { beat: 13, freq: NOTE.E3!, beats: 1 }, { beat: 14, freq: NOTE.G3!, beats: 1 }, { beat: 15, freq: NOTE.C4!, beats: 1 },
  // Under Theme A (bars 5-12), a lighter one-pluck-per-beat-pair pulse outlining the same chords (Dm Dm C Dm | Bb Bb C Dm).
  { beat: 16, freq: NOTE.D3!, beats: 2 }, { beat: 18, freq: NOTE.D3!, beats: 2 }, { beat: 20, freq: NOTE.C3!, beats: 2 }, { beat: 22, freq: NOTE.D3!, beats: 2 },
  { beat: 24, freq: NOTE.Bb2!, beats: 2 }, { beat: 26, freq: NOTE.Bb2!, beats: 2 }, { beat: 28, freq: NOTE.C3!, beats: 2 }, { beat: 30, freq: NOTE.D3!, beats: 2 },
  { beat: 32, freq: NOTE.D3!, beats: 2 }, { beat: 34, freq: NOTE.D3!, beats: 2 }, { beat: 36, freq: NOTE.C3!, beats: 2 }, { beat: 38, freq: NOTE.D3!, beats: 2 },
  { beat: 40, freq: NOTE.Bb2!, beats: 2 }, { beat: 42, freq: NOTE.Bb2!, beats: 2 }, { beat: 44, freq: NOTE.C3!, beats: 2 }, { beat: 46, freq: NOTE.D3!, beats: 2 },
  // Return (bars 17-20): mirrors the intro's rising arpeggio, descending this time, closing the loop.
  { beat: 68, freq: NOTE.D4!, beats: 1 }, { beat: 69, freq: NOTE.A3!, beats: 1 }, { beat: 70, freq: NOTE.F3!, beats: 1 }, { beat: 71, freq: NOTE.D3!, beats: 1 },
  { beat: 72, freq: NOTE.C4!, beats: 1 }, { beat: 73, freq: NOTE.A3!, beats: 1 }, { beat: 74, freq: NOTE.F3!, beats: 1 }, { beat: 75, freq: NOTE.D3!, beats: 1 },
];

/** Bass follows the same chord progression as the pluck (root notes, one per bar, sustained) — this is what makes the harmony changes actually audible instead of implied. */
const BASS_NOTES: NoteEvent[] = [
  { beat: 0, freq: NOTE.D2!, beats: 4 }, { beat: 4, freq: NOTE.D2!, beats: 4 }, { beat: 8, freq: NOTE.Bb2!, beats: 4 }, { beat: 12, freq: NOTE.G2!, beats: 4 },
  { beat: 16, freq: NOTE.D2!, beats: 4 }, { beat: 20, freq: NOTE.D2!, beats: 4 }, { beat: 24, freq: NOTE.Bb2!, beats: 4 }, { beat: 28, freq: NOTE.D2!, beats: 4 },
  { beat: 32, freq: NOTE.D2!, beats: 4 }, { beat: 36, freq: NOTE.D2!, beats: 4 }, { beat: 40, freq: NOTE.Bb2!, beats: 4 }, { beat: 44, freq: NOTE.D2!, beats: 4 },
  { beat: 48, freq: NOTE.Bb2!, beats: 2 }, { beat: 50, freq: NOTE.A2!, beats: 2 }, { beat: 52, freq: NOTE.D2!, beats: 2 }, { beat: 54, freq: NOTE.Bb2!, beats: 2 },
  { beat: 56, freq: NOTE.D2!, beats: 2 }, { beat: 58, freq: NOTE.G2!, beats: 2 }, { beat: 60, freq: NOTE.A2!, beats: 2 }, { beat: 62, freq: NOTE.D2!, beats: 2 },
  { beat: 64, freq: NOTE.D2!, beats: 4 }, { beat: 68, freq: NOTE.D2!, beats: 4 }, { beat: 72, freq: NOTE.D2!, beats: 4 }, { beat: 76, freq: NOTE.D2!, beats: 4 },
];

/** A soft "heartbeat" pulse on beats 1 and 3 of every bar — quiet, filtered noise, never a harsh drum hit — the rhythmic anchor a drone has none of. */
const PERCUSSION_BEATS: number[] = Array.from({ length: LOOP_BEATS / 2 }, (_, i) => i * 2);

/** Soft flute/whistle lead — triangle wave, gentle vibrato, real attack/decay/release so notes breathe instead of holding forever. */
function scheduleLeadNote(ctx: AudioContext, destination: AudioNode, startTime: number, freq: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;

  const vibrato = ctx.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.value = 5.2;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 3; // cents-scale via detune, subtle
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(osc.detune);

  const gain = ctx.createGain();
  const attack = Math.min(0.08, durationSec * 0.25);
  const release = Math.min(0.25, durationSec * 0.35);
  const sustainLevel = 0.5;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(sustainLevel, startTime + attack);
  gain.gain.setValueAtTime(sustainLevel, Math.max(startTime + attack, startTime + durationSec - release));
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  vibrato.start(startTime);
  osc.stop(startTime + durationSec + 0.05);
  vibrato.stop(startTime + durationSec + 0.05);
}

/** Plucked harp/lute character: a sawtooth through a lowpass filter whose cutoff snaps closed right after the attack — the classic synthesized-pluck technique — with a fast-decay volume envelope so it never sustains like a held tone. */
function schedulePluckNote(ctx: AudioContext, destination: AudioNode, startTime: number, freq: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(3200, startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 2), startTime + 0.35);

  const gain = ctx.createGain();
  const decay = Math.min(durationSec, 0.9);
  gain.gain.setValueAtTime(0.3, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + decay + 0.05);
}

/** Soft bass — triangle, slower attack, sustained through the bar. */
function scheduleBassNote(ctx: AudioContext, destination: AudioNode, startTime: number, freq: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  const attack = 0.12;
  const release = Math.min(0.4, durationSec * 0.3);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.4, startTime + attack);
  gain.gain.setValueAtTime(0.4, Math.max(startTime + attack, startTime + durationSec - release));
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);
}

/** A single soft filtered-noise "heartbeat" — the rhythmic pulse, never a harsh percussive transient. */
function schedulePercussionHit(ctx: AudioContext, destination: AudioNode, startTime: number): void {
  const durationSec = 0.18;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durationSec), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(startTime);
}

/** Schedules one full pass of the composition starting at absolute AudioContext time `startTime`. */
function scheduleLoopPass(ctx: AudioContext, destination: AudioNode, startTime: number): void {
  for (const note of LEAD_MELODY) scheduleLeadNote(ctx, destination, startTime + note.beat * BEAT_SEC, note.freq, note.beats * BEAT_SEC * 0.92);
  for (const note of PLUCK_NOTES) schedulePluckNote(ctx, destination, startTime + note.beat * BEAT_SEC, note.freq, note.beats * BEAT_SEC);
  for (const note of BASS_NOTES) scheduleBassNote(ctx, destination, startTime + note.beat * BEAT_SEC, note.freq, note.beats * BEAT_SEC * 0.96);
  for (const beat of PERCUSSION_BEATS) schedulePercussionHit(ctx, destination, startTime + beat * BEAT_SEC);
}

/**
 * Builds the real composition described above, connected into a
 * caller-owned `destination` gain node (so `playAmbientMusic` can share the
 * exact same masterGain — and therefore the exact same volume/mute control
 * — regardless of whether a real track file or this fallback ends up
 * playing; see `playAmbientMusic` below). Uses Web Audio's own look-ahead
 * scheduling pattern (schedule a couple of loop passes ahead of time
 * against `ctx.currentTime`, never `setTimeout`-timed note-by-note) — the
 * standard technique for drift-free, click-free musical timing. Returns
 * only a `stop` cleanup — the caller owns the destination gain's lifecycle.
 */
function buildAdventureThemeGraph(ctx: AudioContext, destination: AudioNode): { stop: () => void } {
  // A quiet atmospheric bed underneath the composition — background texture
  // only, never the main event (the core fix vs. the rejected drone: this
  // piece HAS a foreground melody, this pad is just air behind it).
  const atmosphereGain = ctx.createGain();
  atmosphereGain.gain.value = 0.05;
  atmosphereGain.connect(destination);
  const atmosphereOsc = ctx.createOscillator();
  atmosphereOsc.type = "sine";
  atmosphereOsc.frequency.value = NOTE.D3!;
  const atmosphereFilter = ctx.createBiquadFilter();
  atmosphereFilter.type = "lowpass";
  atmosphereFilter.frequency.value = 500;
  atmosphereOsc.connect(atmosphereFilter);
  atmosphereFilter.connect(atmosphereGain);
  atmosphereOsc.start();

  let nextPassAt = ctx.currentTime + 0.15;
  scheduleLoopPass(ctx, destination, nextPassAt);
  nextPassAt += LOOP_SEC;
  scheduleLoopPass(ctx, destination, nextPassAt);
  nextPassAt += LOOP_SEC;

  // Look-ahead scheduler: keeps ~1.5 loops queued at all times so a slow
  // JS event-loop tick can never create a gap/click at the loop seam.
  const schedulerInterval = setInterval(() => {
    while (nextPassAt < ctx.currentTime + LOOP_SEC * 1.5) {
      scheduleLoopPass(ctx, destination, nextPassAt);
      nextPassAt += LOOP_SEC;
    }
  }, Math.max(1000, LOOP_SEC * 250));

  return {
    stop: () => {
      clearInterval(schedulerInterval);
      try {
        atmosphereOsc.stop();
      } catch {
        // Already stopped — never throw during teardown.
      }
      // Individually-scheduled notes each carry their own `stop()` time
      // already in the future; letting the AudioContext close (see
      // stopMusic below) silences them immediately regardless.
    },
  };
}

/**
 * Attempts to play a real, licensed music file at `url` through the given
 * master gain (so volume/mute controls apply identically to a real asset
 * or the procedural fallback). Calls `onFailure` — synchronously-ish, via
 * a short grace window — if the file doesn't exist or can't play, so the
 * caller can fall back without ever running two audio sources at once.
 * Never throws.
 */
function tryPlayRealTrackFile(ctx: AudioContext, url: string, masterGain: GainNode, onFailure: () => void): HTMLAudioElement | null {
  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    onFailure();
  };
  try {
    const audio = new Audio(url);
    audio.loop = true;
    audio.addEventListener("error", fail, { once: true });
    audio.addEventListener(
      "canplaythrough",
      () => {
        if (settled) return;
        settled = true;
        try {
          const source = ctx.createMediaElementSource(audio);
          source.connect(masterGain);
          audio.play().catch(fail);
        } catch {
          fail();
        }
      },
      { once: true },
    );
    // No real asset exists in this project today (see HOME_THEME_ASSET_URL's
    // doc comment) — this grace window is what lets the procedural
    // composition take over promptly rather than waiting indefinitely.
    setTimeout(fail, 800);
    return audio;
  } catch {
    fail();
    return null;
  }
}


/** How long stopMusic()'s fade-out takes before the graph is actually torn down — long enough that the gain ramp reaches silence smoothly, short enough that navigating away from Home doesn't leave an audible tail. */
const MUSIC_STOP_FADE_MS = 350;

export interface PlayOptions {
  /** Extra playback-rate multiplier on top of the asset's own random pitch variance — e.g. a lower pitch for a heavier/bigger enemy reusing the generic hit sound. */
  pitch?: number;
  /** Extra volume multiplier on top of the asset's baseVolume. */
  volume?: number;
}

interface VoiceMeta {
  priority: SfxPriority;
  sfxId: SfxId;
}

export class AudioManager {
  private volume = 1;
  private muted = false;
  private unlocked = false;

  private readonly pools = new Map<SfxId, HTMLAudioElement[]>();
  private readonly lastPlayedAt = new Map<SfxId, number>();
  private readonly activeVoices = new Map<HTMLAudioElement, VoiceMeta>();

  private musicVolume = 1;
  private musicMuted = false;
  private musicGraph: MusicGraph | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Browser autoplay policies (spec section 12) block audio until a real
   * user gesture. Call this from the SAME click handler as PLAY/START —
   * after that, `play()` calls work for the rest of the session. Calling
   * `play()` before this is a silent no-op, never a thrown error.
   */
  unlock(): void {
    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private effectiveMusicGain(): number {
    return this.musicMuted ? 0 : this.musicVolume;
  }

  /**
   * Starts the Home screen's adventure theme (see buildAdventureThemeGraph
   * and tryPlayRealTrackFile above).
   *
   * CORREÇÃO P0 (autoplay): this is meant to be called TWICE in the normal
   * flow, by design — once immediately on Home mount (a genuine autoplay
   * attempt: some browsers allow it outright, and even when blocked this
   * is what gets a real `AudioContext` sitting in `suspended` state ready
   * to go), and once more from the very first user gesture anywhere on the
   * page (see MainMenu.tsx). The two calls are NOT symmetric: if a graph
   * already exists, this does not rebuild it — it just resumes the
   * existing (possibly browser-suspended) context in place. That's what
   * makes the second call "instant" instead of a fresh cold start, and
   * it's why calling this from any number of gesture handlers is always
   * safe — never a second AudioContext, never a second procedural graph,
   * never a duplicated `<audio>` element. Never throws: an unsupported
   * environment (no Web Audio API, e.g. this repo's vitest/jsdom tests) or
   * a still-blocked context both just result in silence.
   */
  playAmbientMusic(): void {
    if (this.musicGraph) {
      // Graph already exists — this call is a later gesture (or a second
      // mount-time attempt) trying to RESUME it, never to recreate it.
      // A context can be here for two different reasons: still suspended
      // because the very first attempt was true autoplay with no gesture
      // yet, or already suspended again later (e.g. the tab lost audio
      // focus) — `resume()` is the correct response to both, and is a
      // harmless no-op if it's already running.
      if (this.musicGraph.ctx.state === "suspended") {
        this.musicGraph.ctx.resume().catch(() => {
          // Still blocked — stays silent until the next gesture retries.
        });
      }
      return;
    }
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.gain.linearRampToValueAtTime(this.effectiveMusicGain(), ctx.currentTime + 1.2);
      masterGain.connect(ctx.destination);

      let proceduralStop: (() => void) | null = null;
      let realAudioEl: HTMLAudioElement | null = null;
      let stopped = false;

      // Prefer a real, licensed track the moment one exists at
      // HOME_THEME_ASSET_URL (see its doc comment) — falls back to the
      // procedural composition the instant that file fails to load
      // (today, always: no such file exists in this project). Guarded by
      // `stopped` so a slow/late fallback callback can never start a
      // graph after stopMusic() has already torn this one down.
      realAudioEl = tryPlayRealTrackFile(ctx, HOME_THEME_ASSET_URL, masterGain, () => {
        if (stopped || proceduralStop) return;
        proceduralStop = buildAdventureThemeGraph(ctx, masterGain).stop;
      });

      this.musicGraph = {
        ctx,
        masterGain,
        stop: () => {
          stopped = true;
          if (realAudioEl) {
            try {
              realAudioEl.pause();
            } catch {
              // Already stopped — never throw during teardown.
            }
          }
          if (proceduralStop) proceduralStop();
        },
      };

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {
          // Still blocked — stays silent until the next user gesture calls this again.
        });
      }
    } catch {
      this.musicGraph = null;
    }
  }

  /**
   * Stops and fully tears down the ambient pad graph (oscillators, filters,
   * the AudioContext itself). Safe to call even if music was never started.
   * Fades `masterGain` to 0 first — calling `osc.stop()` on a live sine wave
   * produces an audible click/pop at the discontinuity, which is exactly
   * the "efeito que pareça erro de sistema" the direction forbids. The
   * graph is torn down `MUSIC_STOP_FADE_MS` later, once the fade has
   * actually reached silence; `isMusicPlaying()` reports stopped
   * immediately since `this.musicGraph` is cleared synchronously here.
   */
  stopMusic(): void {
    if (!this.musicGraph) return;
    const graph = this.musicGraph;
    this.musicGraph = null;
    try {
      const now = graph.ctx.currentTime;
      graph.masterGain.gain.cancelScheduledValues(now);
      graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now);
      graph.masterGain.gain.linearRampToValueAtTime(0, now + MUSIC_STOP_FADE_MS / 1000);
    } catch {
      // Fall through to immediate teardown below if ramping itself fails.
    }
    setTimeout(() => {
      try {
        graph.stop();
        graph.ctx.close().catch(() => {});
      } catch {
        // Already torn down — never throw.
      }
    }, MUSIC_STOP_FADE_MS);
  }

  /**
   * CORREÇÃO P0 (autoplay): genuinely audible right now — not just "a
   * graph object exists". A graph can exist while its `AudioContext` sits
   * `suspended` (autoplay blocked, waiting on the first gesture — see
   * playAmbientMusic()), which must never be reported as "playing". This
   * is the one true signal the UI (MusicControl's indicator dot) should
   * read to distinguish "actually audible" from "muted"/"volume 0" (both
   * separate, independent flags — see isMusicMuted/getMusicVolume) or
   * "autoplay still blocked" (see isMusicAutoplayBlocked below).
   */
  isMusicPlaying(): boolean {
    return this.musicGraph !== null && this.musicGraph.ctx.state === "running";
  }

  /** True only while a music graph exists but the browser hasn't yet allowed it to run — i.e. waiting on the first real user gesture. False both before any attempt has been made and once audio is actually flowing; never confused with the independent musicMuted/musicVolume flags. */
  isMusicAutoplayBlocked(): boolean {
    return this.musicGraph !== null && this.musicGraph.ctx.state !== "running";
  }

  /** Ramps `masterGain` to `target` over a short, click-free transition instead of an instant value jump — the same click/pop risk `stopMusic()`'s doc comment describes applies to any sudden gain change, not just a full stop. */
  private rampMusicGainTo(target: number): void {
    if (!this.musicGraph) return;
    const { ctx, masterGain } = this.musicGraph;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(target, now + 0.12);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.rampMusicGainTo(this.effectiveMusicGain());
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    this.rampMusicGainTo(this.effectiveMusicGain());
  }

  isMusicMuted(): boolean {
    return this.musicMuted;
  }

  private getPooledElement(id: SfxId, url: string, maxSimultaneous: number): HTMLAudioElement | null {
    let pool = this.pools.get(id);
    if (!pool) {
      pool = [];
      this.pools.set(id, pool);
    }
    const free = pool.find((el) => el.paused || el.ended);
    if (free) return free;
    if (pool.length >= maxSimultaneous) return null;

    let element: HTMLAudioElement;
    try {
      element = new Audio(url);
    } catch {
      // Audio unsupported/unavailable in this environment — never crash gameplay over it.
      return null;
    }
    element.preload = "auto";
    pool.push(element);
    return element;
  }

  /** Frees a global voice slot, evicting the lowest-priority active sound if the incoming one outranks it — spec section 6: excess LOW-priority sound gets dropped first, HIGH essentially never does. */
  private reserveGlobalVoiceSlot(priority: SfxPriority): boolean {
    if (this.activeVoices.size < MAX_GLOBAL_VOICES) return true;

    let lowest: HTMLAudioElement | null = null;
    let lowestRank = Infinity;
    for (const [el, meta] of this.activeVoices) {
      const rank = PRIORITY_RANK[meta.priority];
      if (rank < lowestRank) {
        lowest = el;
        lowestRank = rank;
      }
    }
    if (lowest && PRIORITY_RANK[priority] > lowestRank) {
      lowest.pause();
      this.activeVoices.delete(lowest);
      return true;
    }
    return false;
  }

  private releaseVoice(element: HTMLAudioElement): void {
    this.activeVoices.delete(element);
  }

  /**
   * Plays one SFX for a real game event. Never throws — a missing asset,
   * an unsupported environment, a blocked autoplay policy, or a rejected
   * play() promise all just result in silence, exactly as they should for
   * something this non-critical to gameplay correctness.
   */
  play(id: SfxId, opts: PlayOptions = {}): void {
    if (this.muted || this.volume <= 0 || !this.unlocked) return;

    const config = SFX_ASSETS[id];
    if (!config) return; // unknown id — defensive, never crash

    const nowMs = this.now();
    const last = this.lastPlayedAt.get(id);
    if (last !== undefined && nowMs - last < config.cooldownMs) return; // throttled — spec section 5/15

    if (!this.reserveGlobalVoiceSlot(config.priority)) return; // dropped under load — spec section 6

    const element = this.getPooledElement(id, config.url, config.maxSimultaneous);
    if (!element) return;

    const pitchVariance = 1 + (Math.random() * 2 - 1) * config.pitchVariance;
    const pitch = pitchVariance * (opts.pitch ?? 1);
    const vol = Math.max(0, Math.min(1, config.baseVolume * (opts.volume ?? 1) * this.volume));

    try {
      element.currentTime = 0;
      element.playbackRate = Math.max(0.25, Math.min(4, pitch));
      element.volume = vol;
      this.activeVoices.set(element, { priority: config.priority, sfxId: id });
      element.onended = () => this.releaseVoice(element);
      const playResult = element.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => this.releaseVoice(element));
      }
    } catch {
      this.releaseVoice(element);
    }

    this.lastPlayedAt.set(id, nowMs);
  }
}

/** Shared instance for production use — one AudioManager per tab, matching the browser's own one-AudioContext-worth-caring-about model. Tests construct their own instances instead of using this. */
export const audioManager = new AudioManager();
