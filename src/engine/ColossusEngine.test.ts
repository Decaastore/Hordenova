import { describe, expect, it } from "vitest";
import { COLOSSUS_LENGTH_MS, COLOSSUS_ROOM_SIZE } from "@/config/colossus";
import { ColossusEngine, COLOSSUS_SLOTS, PATH_LENGTH, pathAt, SPIRAL_PATH, STRIKE_CHARGE_MS, STUN_MS } from "./ColossusEngine";

const setup = (seed = 7, slot = 3) => ({ seed, you: { name: "Eu", type: "IRONWOOD" as const, power: 2000, skin: null }, slot });

describe("ColossusEngine — the Serpent raid", () => {
  it("slots never sit on the road", () => {
    for (const s of COLOSSUS_SLOTS) {
      const d = Math.min(...SPIRAL_PATH.map((p) => Math.hypot(p.x - s.x, p.y - s.y)));
      expect(d).toBeGreaterThan(40);
    }
    for (let i = 0; i < COLOSSUS_SLOTS.length; i++)
      for (let j = i + 1; j < COLOSSUS_SLOTS.length; j++) expect(Math.hypot(COLOSSUS_SLOTS[i]!.x - COLOSSUS_SLOTS[j]!.x, COLOSSUS_SLOTS[i]!.y - COLOSSUS_SLOTS[j]!.y)).toBeGreaterThan(55);
  });

  it("fills a room of 12 on distinct slots and ends after the head reaches the core", () => {
    const e = new ColossusEngine(setup());
    const s0 = e.snapshot();
    expect(s0.players).toHaveLength(COLOSSUS_ROOM_SIZE);
    expect(new Set(s0.players.map((p) => p.slot)).size).toBe(COLOSSUS_ROOM_SIZE);
    e.advance(COLOSSUS_LENGTH_MS - 50);
    expect(e.snapshot().over).toBe(false);
    e.advance(10_000);
    const end = e.snapshot();
    expect(end.over).toBe(true);
    expect(pathAt(end.headS).x).toBeCloseTo(pathAt(PATH_LENGTH).x, 0);
    expect(end.roomDamage).toBeGreaterThan(0);
    expect(end.players.reduce((a, p) => a + p.damage, 0)).toBe(end.roomDamage);
  });

  it("is deterministic for a seed", () => {
    const a = new ColossusEngine(setup(42));
    const b = new ColossusEngine(setup(42));
    a.advance(COLOSSUS_LENGTH_MS + 3000);
    b.advance(COLOSSUS_LENGTH_MS + 3000);
    expect(a.snapshot().players.map((p) => p.damage)).toEqual(b.snapshot().players.map((p) => p.damage));
  });

  it("moving dodges a falling star; staying gets the tower stunned", () => {
    // find a seed where the player's slot is marked during Starfall
    for (let seed = 1; seed < 400; seed++) {
      const e = new ColossusEngine(setup(seed));
      let marked = false;
      while (e.timeMs < 100_000) {
        e.advance(50);
        if (e.snapshot().stars.some((s) => s.slot === e.snapshot().players[0]!.slot)) {
          marked = true;
          break;
        }
      }
      if (!marked) continue;
      const stay = new ColossusEngine(setup(seed));
      stay.advance(e.timeMs + 3_000);
      expect(stay.snapshot().players[0]!.stunnedUntil).toBeGreaterThan(stay.timeMs);
      expect(stay.snapshot().players[0]!.stunnedUntil - stay.timeMs).toBeLessThanOrEqual(STUN_MS);
      const occupied = new Set(e.snapshot().players.map((p) => p.slot));
      const danger = new Set(e.snapshot().stars.map((s) => s.slot));
      const free = COLOSSUS_SLOTS.findIndex((_, i) => !occupied.has(i) && !danger.has(i));
      expect(e.moveTo(free)).toBe(true);
      e.advance(3_000);
      expect(e.snapshot().players[0]!.stunnedUntil).toBeLessThan(e.timeMs);
      return;
    }
    throw new Error("no seed marked the player's slot");
  });

  it("the Star Strike charges, fires once and hits hard; it can't fire uncharged", () => {
    const e = new ColossusEngine(setup(3, 15));
    expect(e.strike()).toBe(false);
    e.advance(STRIKE_CHARGE_MS);
    let fired = false;
    while (!fired && e.timeMs < COLOSSUS_LENGTH_MS) {
      const before = e.snapshot().players[0]!;
      if (e.strike()) {
        fired = true;
        const after = e.snapshot().players[0]!;
        expect(after.charge).toBe(0);
        expect(after.damage - before.damage).toBeGreaterThan(2000 * 0.8 * 8 * 0.2);
        expect(e.strike()).toBe(false);
      } else e.advance(50);
    }
    expect(fired).toBe(true);
  });
});
