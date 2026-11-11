import { hasRain, lightningStrikeAt, weatherIntensity } from "@/rendering/ambientLight";
import { getSfxVolume, isSfxMuted } from "./audioSettings";
import { audioManager } from "./AudioManager";
import type { SfxId } from "./sfxCatalog";

/**
 * AMBIENTE SONORO — the sound of the place you're fighting in, under the
 * combat: a looping bed per biome (wind through the forest, howling wind on
 * open ground, lava and rumble, a cave's drone and drips, waves on rocks),
 * rain that swells and fades with the rain on screen, and thunder rolling in
 * a moment after each lightning flash. Follows the effects volume and mute.
 *
 * Web Audio (AudioBufferSourceNode loops with gain ramps) so beds crossfade
 * when the map changes and never click at the loop point. Every failure —
 * no Web Audio, a file that won't load — just leaves the game without
 * ambience; nothing here can stop the game.
 */
export type AmbienceBed = "forest" | "wind" | "volcanic" | "cave" | "coast";

const BED_BY_BIOME: Record<string, AmbienceBed> = {
  ANCIENT_FOREST: "forest",
  MOON_GARDENS: "forest",
  DARK_RUINS: "wind",
  DEFILED_CATHEDRAL: "wind",
  COLOSSUS_GRAVEYARD: "wind",
  FLOATING_ISLES: "wind",
  CURSED_DESERT: "wind",
  LOST_SUN_TEMPLE: "wind",
  FROZEN_TUNDRA: "wind",
  LEVIATHAN_COAST: "coast",
  CRYSTAL_SEA: "coast",
  VOLCANIC_WASTES: "volcanic",
  ASHEN_VALLEY: "volcanic",
  DWARVEN_UNDERCITY: "cave",
  ABYSS: "cave",
  ABYSSAL_FORTRESS: "cave",
};

/** The bed a biome plays (unknown biomes get the wind). */
export function ambienceBedFor(biomeId: string): AmbienceBed {
  return BED_BY_BIOME[biomeId] ?? "wind";
}

/** Per-bed loudness trim so every place sits at the same depth under the fight. */
const BED_GAIN: Record<AmbienceBed, number> = { forest: 0.55, wind: 0.5, volcanic: 0.55, cave: 0.6, coast: 0.42 };
const RAIN_GAIN = 0.5;
/** The whole ambience relative to the effects volume — it lives under the combat, never on top of it. */
const AMBIENCE_MIX = 0.6;
const CROSSFADE_S = 2.5;
const THUNDER: readonly SfxId[] = ["thunder_1", "thunder_2", "thunder_3"];

/**
 * Should thunder be scheduled now? True once per lightning strike, the first
 * time we see its cycle after the flash has happened. Returns the strike's
 * cycle so the caller can remember it.
 */
export function thunderDue(biomeId: string, nowMs: number, lastCycle: number): number | null {
  if (!hasRain(biomeId)) return null;
  const strike = lightningStrikeAt(nowMs);
  if (!strike || strike.cycle === lastCycle) return null;
  if (nowMs < strike.atMs || nowMs - strike.atMs > 3000) return null;
  return strike.cycle;
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface Layer {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class GameAmbience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private bed: { name: AmbienceBed; layer: Layer } | null = null;
  private rain: Layer | null = null;
  private rainRequested = false;
  private wantedBed: AmbienceBed | null = null;
  private lastThunderCycle = -1;
  private stopped = false;
  private readonly onGesture = () => void this.ctx?.resume().catch(() => undefined);
  private readonly onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend().catch(() => undefined);
    else void this.ctx.resume().catch(() => undefined);
  };

  start(): void {
    const Ctor = audioContextCtor();
    if (!Ctor || this.ctx) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      return;
    }
    window.addEventListener("pointerdown", this.onGesture);
    window.addEventListener("keydown", this.onGesture);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener("pointerdown", this.onGesture);
    window.removeEventListener("keydown", this.onGesture);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const ctx = this.ctx;
    this.ctx = null;
    if (!ctx) return;
    try {
      this.master?.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    } catch {
      /* closing anyway */
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 600);
  }

  /** Call a few times a second with the map being played and the renderer's clock (performance.now()). */
  tick(biomeId: string, nowMs: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.stopped) return;
    const volume = isSfxMuted() ? 0 : getSfxVolume() * AMBIENCE_MIX;
    this.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);

    const bed = ambienceBedFor(biomeId);
    if (bed !== this.wantedBed) {
      this.wantedBed = bed;
      void this.switchBed(bed);
    }

    const rainy = hasRain(biomeId);
    if (rainy && !this.rainRequested) {
      this.rainRequested = true;
      void this.startRain();
    }
    if (this.rain) {
      const target = rainy ? weatherIntensity(nowMs) * RAIN_GAIN : 0;
      this.rain.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
    }

    const cycle = thunderDue(biomeId, nowMs, this.lastThunderCycle);
    if (cycle !== null) {
      this.lastThunderCycle = cycle;
      // sound travels slower than light: the roll arrives a moment after the flash
      const delay = 400 + Math.random() * 1400;
      const id = THUNDER[Math.floor(Math.random() * THUNDER.length)]!;
      window.setTimeout(() => {
        if (!this.stopped) audioManager.play(id, { volume: 0.8 + Math.random() * 0.2 });
      }, delay);
    }
  }

  private load(name: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      const ctx = this.ctx;
      p = ctx
        ? fetch(`/audio/ambience/${name}.mp3`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then((data) => ctx.decodeAudioData(data))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(name, p);
    }
    return p;
  }

  private makeLayer(buffer: AudioBuffer, gain: number): Layer | null {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    source.connect(g);
    g.connect(this.master);
    // start each loop at a random point so two sessions never line up
    source.start(0, Math.random() * buffer.duration);
    g.gain.setTargetAtTime(gain, ctx.currentTime, CROSSFADE_S / 3);
    return { source, gain: g };
  }

  private fadeOut(layer: Layer): void {
    const ctx = this.ctx;
    if (!ctx) return;
    layer.gain.gain.setTargetAtTime(0, ctx.currentTime, CROSSFADE_S / 3);
    try {
      layer.source.stop(ctx.currentTime + CROSSFADE_S * 1.5);
    } catch {
      /* already stopped */
    }
  }

  private async switchBed(name: AmbienceBed): Promise<void> {
    const buffer = await this.load(name);
    if (!buffer || this.stopped || this.wantedBed !== name || this.bed?.name === name) return;
    const layer = this.makeLayer(buffer, BED_GAIN[name]);
    if (!layer) return;
    if (this.bed) this.fadeOut(this.bed.layer);
    this.bed = { name, layer };
  }

  private async startRain(): Promise<void> {
    const buffer = await this.load("rain");
    const layer = buffer && !this.stopped ? this.makeLayer(buffer, 0) : null;
    this.rain = layer;
  }
}
