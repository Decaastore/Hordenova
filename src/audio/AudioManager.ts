import { SFX_ASSETS, type SfxId, type SfxPriority } from "./sfxCatalog";

/**
 * Audio spec sections 1/5/6/12/13/15/16 — the ONLY place in the codebase
 * that touches `Audio`/`HTMLAudioElement`. Gameplay code (GameEngine,
 * CombatSystem, ...) never imports this file or a sound file path
 * directly — it emits semantic events (engine/AudioEvents.ts) that
 * audio/GameAudioBridge.ts translates into calls here. That indirection
 * is what keeps "add a new SFX" from ever touching engine code.
 *
 * No music. This class is deliberately shaped so a future `playMusic`/
 * `crossfadeMusic` could be added alongside `play()` without restructuring
 * anything — but that's explicitly NOT built yet.
 *
 * Performance (section 15): a small pool of reusable HTMLAudioElements per
 * sound id, not a fresh `new Audio()` per play — this runs for hours in an
 * Active Idle session, so unbounded object churn is a real leak risk.
 */
const MAX_GLOBAL_VOICES = 10;
const PRIORITY_RANK: Record<SfxPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

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
