/**
 * SONS DO DUELO E DO BOSS GLOBAL — these modes run their own engines, so the
 * main game's audio bridge never hears them. Each class here watches the
 * engine's snapshots frame by frame and plays the matching sound once per
 * new event (shots, deaths, castle hits, spells, phase changes, the end).
 * Only reuses the game's own sound library; AudioManager throttles spam.
 */
import { audioManager } from "./AudioManager";
import type { SfxId } from "./sfxCatalog";
import type { DuelSnapshot } from "@/engine/DuelEngine";
import type { ColossusSnapshot } from "@/engine/ColossusEngine";
import type { TowerType } from "@/config/towerStats";

type Play = (id: SfxId, opts?: { pitch?: number; volume?: number }) => void;
const defaultPlay: Play = (id, opts) => audioManager.play(id, opts);

const ATTACK: Record<TowerType, SfxId> = { IRONWOOD: "ironwood_attack", INFERNO: "inferno_attack", FROSTBORN: "frostborn_attack", STORMCALLER: "stormcaller_attack" };

/** Keeps a bounded memory of event keys already played. */
class Seen {
  private set = new Set<string>();
  has(k: string): boolean {
    return this.set.has(k);
  }
  add(k: string): void {
    this.set.add(k);
    if (this.set.size > 600) this.set = new Set([...this.set].slice(-300));
  }
  /** True the first time a key is offered. */
  first(k: string): boolean {
    if (this.set.has(k)) return false;
    this.add(k);
    return true;
  }
}

export class DuelAudio {
  private seen = new Seen();
  private towerLevels = [0, 0];
  private overtime = false;
  private doubleMana: boolean | null = null;
  private ended = false;
  constructor(private play: Play = defaultPlay) {}

  update(s: DuelSnapshot): void {
    // your side louder than the opponent's
    const vol = (side: number) => (side === 0 ? 1 : 0.5);
    for (const sh of s.shots) if (this.seen.first(`s${sh.side}:${sh.at}:${sh.type}:${sh.from.x}`)) this.play(ATTACK[sh.type], { volume: 0.7 * vol(sh.side) });
    for (const d of s.deaths) {
      const side = d.x < 640 ? 0 : 1;
      if (this.seen.first(`d${d.at}:${Math.round(d.x)}:${Math.round(d.y)}`)) this.play(d.big ? "death_brute_1" : "enemy_death", { volume: 0.8 * vol(side) });
    }
    for (const b of s.breaches) if (this.seen.first(`b${b.side}:${b.at}`)) this.play("castle_damage", b.side === 0 ? { volume: 1 } : { volume: 0.6, pitch: 1.15 });
    for (const f of s.spells) {
      if (this.seen.first(`c${f.side}:${f.effect}:${f.castAt}`)) {
        if (f.effect === "FREEZE") this.play("frostborn_freeze", { volume: vol(f.side) });
        else if (f.effect === "RAGE") this.play("boss_enrage", { volume: 0.55 * vol(f.side), pitch: 1.25 });
        else this.play("inferno_attack", { volume: vol(f.side), pitch: 0.7 });
      }
      if (f.effect === "METEOR" && s.timeMs >= f.landAt && this.seen.first(`m${f.side}:${f.landAt}`)) {
        this.play("tower_siege_hit", { volume: vol(f.side) });
        this.play("inferno_impact", { volume: vol(f.side), pitch: 0.6 });
      }
    }
    // a tower built or levelled up
    for (const side of [0, 1]) {
      const lv = s.towers.filter((t) => t.side === side).reduce((a, t) => a + t.level, 0);
      if (lv > this.towerLevels[side]!) this.play("tower_upgrade", { volume: 0.7 * vol(side) });
      this.towerLevels[side] = lv;
    }
    if (this.doubleMana === null) this.doubleMana = s.doubleMana;
    else if (s.doubleMana && !this.doubleMana) {
      this.doubleMana = true;
      this.play("wave_start", { volume: 0.8 });
    }
    if (s.overtime && !this.overtime) {
      this.overtime = true;
      this.play("boss_intro", { volume: 0.7 });
    }
    if (s.over && !this.ended) {
      this.ended = true;
      this.play(s.outcome === "WIN" ? "victory" : s.outcome === "LOSS" ? "defeat" : "wave_complete");
    }
  }
}

export class ColossusAudio {
  private seen = new Seen();
  private phase: string | null = null;
  private shieldUntil = 0;
  private ended = false;
  constructor(private play: Play = defaultPlay) {}

  update(s: ColossusSnapshot): void {
    const you = s.players.findIndex((p) => p.isYou);
    if (this.phase === null) {
      this.phase = s.phase;
      this.play("boss_intro", { volume: 0.8 });
    } else if (s.phase !== this.phase) {
      this.phase = s.phase;
      this.play(s.phase === "ECLIPSE" ? "boss_intro" : "boss_enrage", { volume: 0.85 });
    }
    for (const sh of s.shots) {
      if (!this.seen.first(`s${sh.from}:${sh.at}`)) continue;
      const mine = sh.from === you;
      if (sh.strike) {
        this.play("stormcaller_chain", { volume: mine ? 1 : 0.4 });
        if (mine) this.play("thunder_1", { volume: 0.8 });
      } else if (sh.shielded) this.play("frostborn_impact", { volume: mine ? 0.7 : 0.2, pitch: 0.8 });
      else this.play(ATTACK[sh.type], { volume: mine ? 0.75 : 0.18 });
      if (mine && sh.crit) this.play("tower_siege_hit", { volume: 0.5, pitch: 1.3 });
    }
    for (const im of s.impacts) {
      if (!this.seen.first(`i${im.slot}:${im.at}`)) continue;
      const onYou = s.players[you]?.slot === im.slot;
      this.play(onYou && im.hit ? "castle_damage" : "thunder_2", { volume: onYou ? 1 : 0.35 });
    }
    if (s.shieldUntil > this.shieldUntil && s.shieldUntil > s.timeMs) this.play("frostborn_freeze", { volume: 0.9, pitch: 0.75 });
    this.shieldUntil = s.shieldUntil;
    if (s.over && !this.ended) {
      this.ended = true;
      this.play("victory");
    }
  }
}
