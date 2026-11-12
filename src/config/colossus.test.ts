import { describe, expect, it } from "vitest";
import {
  applyAttempt,
  attemptsLeft,
  claimWorldPrize,
  COLOSSUS_ATTEMPTS_PER_DAY,
  COLOSSUS_DAILY_GEMS,
  COLOSSUS_WORLD_GEMS,
  COLOSSUS_WORLD_HP,
  createColossusProfile,
  placePrize,
  raidPower,
  sanitizeColossusProfile,
  spendAttempt,
  toggleColossusCosmetic,
  worldDamageOthers,
  worldState,
  weekEndsAt,
} from "./colossus";

const MON = Date.UTC(2026, 10, 9, 12); // a Monday
const DAY = 86_400_000;

describe("Chefe Global — rules", () => {
  it("allows three attempts per UTC day, and a new day refills them", () => {
    let p = createColossusProfile();
    for (let i = 0; i < COLOSSUS_ATTEMPTS_PER_DAY; i++) p = spendAttempt(p, MON)!;
    expect(spendAttempt(p, MON)).toBeNull();
    expect(attemptsLeft(p, MON)).toBe(0);
    expect(attemptsLeft(p, MON + DAY)).toBe(COLOSSUS_ATTEMPTS_PER_DAY);
  });

  it("pays the daily Free Gem only on the first attempt of the day", () => {
    const a = applyAttempt(createColossusProfile(), 12, 1000, MON);
    expect(a.dailyGem).toBe(true);
    expect(a.prize.gems).toBe(COLOSSUS_DAILY_GEMS);
    const b = applyAttempt(a.profile, 1, 1000, MON + 1000);
    expect(b.dailyGem).toBe(false);
    expect(b.prize.gems).toBe(0);
    expect(applyAttempt(b.profile, 1, 1000, MON + DAY).dailyGem).toBe(true);
  });

  it("a better place pays more", () => {
    expect(placePrize(1).marks).toBeGreaterThan(placePrize(2).marks);
    expect(placePrize(2).splinters).toBeGreaterThan(placePrize(5).splinters);
    expect(placePrize(5).splinters).toBeGreaterThan(placePrize(12).splinters);
    // per-attempt place prizes never pay Gems on their own
    for (let i = 1; i <= 12; i++) expect(placePrize(i).gems).toBe(0);
  });

  it("weekly Marks unlock the two permanent cosmetics, and the counters reset next week while the cosmetics stay", () => {
    let p = createColossusProfile();
    let got: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = applyAttempt(p, 1, 5000, MON + i * 1000);
      p = r.profile;
      got = got.concat(r.newCosmetics);
    }
    expect(p.weekMarks).toBe(40);
    expect(got).toEqual(["ECLIPSE_SIGIL", "ECLIPSE_CROWN"]);
    expect(p.equipped).toBe("ECLIPSE_CROWN");
    const next = applyAttempt(p, 12, 10, MON + 7 * DAY);
    expect(next.profile.weekMarks).toBe(1);
    expect(next.profile.owned).toEqual(["ECLIPSE_SIGIL", "ECLIPSE_CROWN"]);
    expect(next.newCosmetics).toEqual([]);
    expect(toggleColossusCosmetic(next.profile, "ECLIPSE_SIGIL")!.equipped).toBe("ECLIPSE_SIGIL");
    expect(toggleColossusCosmetic(createColossusProfile(), "ECLIPSE_SIGIL")).toBeNull();
  });

  it("the simulated world brings the Serpent down late in the week, and the world prize needs participation and is paid once", () => {
    expect(worldState(createColossusProfile(), MON).defeated).toBe(false);
    expect(worldDamageOthers(MON)).toBeLessThan(COLOSSUS_WORLD_HP * 0.2);
    const sunday = weekEndsAt(MON) - 3_600_000;
    expect(worldState(createColossusProfile(), sunday).defeated).toBe(true);
    expect(claimWorldPrize(createColossusProfile(), sunday)).toBeNull();
    const played = applyAttempt(createColossusProfile(), 8, 100, sunday - 1000).profile;
    const r = claimWorldPrize(played, sunday)!;
    expect(r.gems).toBe(COLOSSUS_WORLD_GEMS);
    expect(claimWorldPrize(r.profile, sunday)).toBeNull();
  });

  it("raid power has diminishing returns (a 2x tower deals ~41% more)", () => {
    expect(raidPower(200) / raidPower(100)).toBeCloseTo(Math.SQRT2, 1);
  });

  it("sanitizes junk saves", () => {
    const p = sanitizeColossusProfile({ attemptsUsed: 99, owned: ["ECLIPSE_SIGIL", "HACK"], equipped: "HACK", goalsPaid: [0, 9, 0], weekDamage: Number.NaN });
    expect(p.attemptsUsed).toBe(COLOSSUS_ATTEMPTS_PER_DAY);
    expect(p.owned).toEqual(["ECLIPSE_SIGIL"]);
    expect(p.equipped).toBeNull();
    expect(p.goalsPaid).toEqual([0]);
    expect(p.weekDamage).toBe(0);
    expect(sanitizeColossusProfile(null)).toEqual(createColossusProfile());
  });
});
