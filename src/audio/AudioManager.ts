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
 * PRODUÇÃO VISUAL spec section 11 — the original 4-sine-oscillator drone
 * read as a flat, static "test tone" rather than dark-fantasy/epic music,
 * and `stopMusic()`'s hard `osc.stop()` (no fade) produced an audible
 * click/pop on every screen transition — exactly the "efeito que pareça
 * erro de sistema" the direction explicitly forbids. This rebuild keeps
 * the same "no recording, no melody, no loop-point" honesty (still wholly
 * synthesized live, never resembling any existing game's soundtrack) but
 * fixes both root causes:
 *
 * 1. Richer harmonic content instead of pure sines — each pad voice sums a
 *    fundamental sine with a quiet detuned sub-octave and a very quiet 2nd
 *    harmonic (triangle), which is what separates an organ-like "pad" from
 *    a lab test tone.
 * 2. A slow (40-70s) volume "breathing" swell per voice so the texture
 *    feels alive rather than a held, static drone that can start to grate.
 * 3. A single very quiet high tension tone (a tritone above the root) far
 *    below the main chord in level — the classic "unease" interval in
 *    dark/horror scoring, kept subtle enough to read as atmosphere, not
 *    dissonant noise.
 * 4. A sparse, randomly-timed distant "bell" (a short sine with a slow
 *    exponential decay) every 18-32s — enough incidental movement to avoid
 *    "loop irritante" without ever becoming a melody or rhythm.
 * 5. `stop()` no longer clicks — see stopMusic() below, which now fades
 *    `masterGain` to 0 before tearing down the graph.
 */
function buildAmbientPadGraph(ctx: AudioContext, initialGain: number): MusicGraph {
  const masterGain = ctx.createGain();
  masterGain.gain.value = initialGain;
  masterGain.connect(ctx.destination);

  const voiceFreqs = [73.42, 110.0, 146.83, 174.61]; // D2, A2, D3, F3 — a D-minor-ish drone
  const stopFns: Array<() => void> = [];
  const cleanupFns: Array<() => void> = [];

  for (const freq of voiceFreqs) {
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;
    voiceGain.gain.linearRampToValueAtTime(1 / voiceFreqs.length, ctx.currentTime + 5); // slow 5s fade-in, no jarring onset

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);

    // Slow volume "breathing" — a gentle sine LFO on this voice's own gain
    // stage (multiplicative, via a second gain node) keeps the pad from
    // reading as a held, static drone.
    const breathGain = ctx.createGain();
    breathGain.gain.value = 1;
    const breathLfo = ctx.createOscillator();
    breathLfo.type = "sine";
    breathLfo.frequency.value = 1 / (40 + Math.random() * 30); // one cycle every 40-70s
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.18; // modulates +/-18% around unity — audible movement, never a full swell to silence
    breathLfo.connect(breathDepth);
    breathDepth.connect(breathGain.gain);
    breathGain.connect(filter);
    breathLfo.start();
    stopFns.push(() => breathLfo.stop());

    // Fundamental sine.
    const fundamental = ctx.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.value = freq;
    fundamental.connect(breathGain);

    // A quiet sub-octave sine underneath — adds weight/"ameaçador" body
    // without thickening the harmonic content into mud.
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq / 2;
    sub.connect(subGain);
    subGain.connect(breathGain);

    // A very quiet triangle at the 2nd harmonic — this is what gives the
    // tone an organ/choir-like character instead of a pure lab sine.
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.12;
    const harmonic = ctx.createOscillator();
    harmonic.type = "triangle";
    harmonic.frequency.value = freq * 2;
    harmonic.connect(harmonicGain);
    harmonicGain.connect(breathGain);

    // A slow LFO on detune (a few cents, well under a semitone) gives the
    // pad gentle, organic movement instead of a static, robotic drone.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(fundamental.detune);
    lfoGain.connect(sub.detune);
    lfoGain.connect(harmonic.detune);

    fundamental.start();
    sub.start();
    harmonic.start();
    lfo.start();
    stopFns.push(() => {
      fundamental.stop();
      sub.stop();
      harmonic.stop();
      lfo.stop();
    });
  }

  // A single, very quiet tritone tension tone above the root (D2 * sqrt(2)
  // ~= Ab2/G#2) — the classic dark/horror-scoring "unease" interval, kept
  // far enough below the main chord's level to read as atmosphere rather
  // than a wrong note.
  const tensionGain = ctx.createGain();
  tensionGain.gain.value = 0;
  tensionGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 8);
  const tensionFilter = ctx.createBiquadFilter();
  tensionFilter.type = "lowpass";
  tensionFilter.frequency.value = 700;
  const tension = ctx.createOscillator();
  tension.type = "sine";
  tension.frequency.value = 73.42 * Math.SQRT2;
  tension.connect(tensionFilter);
  tensionFilter.connect(tensionGain);
  tensionGain.connect(masterGain);
  tension.start();
  stopFns.push(() => tension.stop());

  // Soft filtered white noise — a distant "wind/fog" texture under the pad.
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 400;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.03;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start();
  stopFns.push(() => noise.stop());

  // A sparse, randomly-timed distant bell — a short sine burst with a slow
  // exponential decay, spaced 18-32s apart. Deliberately irregular timing
  // (re-rolled after every hit) so it never reads as a loop or a rhythm.
  let bellTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleBell = () => {
    const delayMs = (18 + Math.random() * 14) * 1000;
    bellTimer = setTimeout(() => {
      const bellFreq = [220, 293.66, 349.23][Math.floor(Math.random() * 3)]!; // A3, D4, F4 — stays inside the same D-minor color
      const bellOsc = ctx.createOscillator();
      bellOsc.type = "sine";
      bellOsc.frequency.value = bellFreq;
      const bellGain = ctx.createGain();
      const now = ctx.currentTime;
      bellGain.gain.setValueAtTime(0, now);
      bellGain.gain.linearRampToValueAtTime(0.06, now + 0.3); // soft mallet attack, never a sharp transient
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 6); // long, slow decay — "distant" rather than "alert"
      bellOsc.connect(bellGain);
      bellGain.connect(masterGain);
      bellOsc.start(now);
      bellOsc.stop(now + 6.2);
      scheduleBell();
    }, delayMs);
  };
  scheduleBell();
  cleanupFns.push(() => {
    if (bellTimer) clearTimeout(bellTimer);
  });

  return {
    ctx,
    masterGain,
    stop: () => {
      for (const cleanup of cleanupFns) cleanup();
      for (const stop of stopFns) {
        try {
          stop();
        } catch {
          // Already stopped — never throw during teardown.
        }
      }
    },
  };
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
   * Starts the Home screen's ambient pad (see buildAmbientPadGraph above).
   * Idempotent — calling this while already playing is a no-op rather than
   * layering a second graph. Like `unlock()`, this must be called from a
   * real user-gesture handler (a click, a keydown) — browsers block
   * `AudioContext` creation/resume otherwise. Never throws: an unsupported
   * environment (no Web Audio API, e.g. this repo's vitest/jsdom tests) or
   * a blocked/suspended context both just result in silence.
   */
  playAmbientMusic(): void {
    if (this.musicGraph) return;
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      this.musicGraph = buildAmbientPadGraph(ctx, this.effectiveMusicGain());
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

  isMusicPlaying(): boolean {
    return this.musicGraph !== null;
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
