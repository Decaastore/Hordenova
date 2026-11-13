import { describe, expect, it } from "vitest";
import { DuelAudio } from "./arenaAudio";
import { DuelEngine } from "@/engine/DuelEngine";
import { DEFAULT_DECK } from "@/config/duel";

describe("Duel sounds", () => {
  it("plays each event once: shots, deaths, castle hits, builds and the result", () => {
    const played: string[] = [];
    const audio = new DuelAudio((id) => played.push(id));
    const e = new DuelEngine(7, [DEFAULT_DECK, DEFAULT_DECK], 0.9);
    audio.update(e.snapshot());
    audio.update(e.snapshot()); // same frame twice: nothing new
    for (let i = 0; i < 6000 && !e.over; i++) {
      e.advance(50);
      if (i % 60 === 0) for (const c of e.snapshot().players[0]!.hand) if (c.startsWith("S_") && e.play(0, c)) break;
      audio.update(e.snapshot());
    }
    expect(e.over).toBe(true);
    expect(played).toContain("castle_damage");
    expect(played).toContain("tower_upgrade");
    expect(played.some((id) => id.endsWith("_attack"))).toBe(true);
    expect(played.filter((id) => id === "defeat" || id === "victory" || id === "wave_complete")).toHaveLength(1);
    const breaches = played.filter((id) => id === "castle_damage").length;
    expect(breaches).toBeLessThanOrEqual(40);
  });
});
