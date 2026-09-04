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
 * A slow, wholly original, procedurally-generated ambient pad — never a
 * recording, never based on or resembling any existing game's soundtrack
 * (explicitly not Zelda or any other IP). Built from four sustained
 * detuned sine/triangle tones (a D-minor-ish drone: D2/A2/D3/F3) each
 * slowly wobbled by its own slow LFO on detune for gentle movement, plus a
 * soft filtered-noise layer for a "wind/fog" texture — no melody, no
 * rhythm, nothing recognizable to copy or be copied. Because it's
 * synthesized live rather than a looping file, there's no seam/loop-point
 * to ever click or repeat noticeably.
 */
function buildAmbientPadGraph(ctx: AudioContext, initialGain: number): MusicGraph {
  const masterGain = ctx.createGain();
  masterGain.gain.value = initialGain;
  masterGain.connect(ctx.destination);

  const voiceFreqs = [73.42, 110.0, 146.83, 174.61]; // D2, A2, D3, F3
  const stopFns: Array<() => void> = [];

  for (const freq of voiceFreqs) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;
    voiceGain.gain.linearRampToValueAtTime(1 / voiceFreqs.length, ctx.currentTime + 3); // slow fade-in, no jarring onset

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    // A slow LFO on detune (a few cents, well under a semitone) gives the
    // pad gentle, organic movement instead of a static, robotic drone.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    osc.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);

    osc.start();
    lfo.start();
    stopFns.push(() => {
      osc.stop();
      lfo.stop();
    });
  }

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

  return {
    ctx,
    masterGain,
    stop: () => {
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

  /** Stops and fully tears down the ambient pad graph (oscillators, filters, the AudioContext itself). Safe to call even if music was never started. */
  stopMusic(): void {
    if (!this.musicGraph) return;
    const graph = this.musicGraph;
    this.musicGraph = null;
    try {
      graph.stop();
      graph.ctx.close().catch(() => {});
    } catch {
      // Already torn down — never throw.
    }
  }

  isMusicPlaying(): boolean {
    return this.musicGraph !== null;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGraph) this.musicGraph.masterGain.gain.value = this.effectiveMusicGain();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    if (this.musicGraph) this.musicGraph.masterGain.gain.value = this.effectiveMusicGain();
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
