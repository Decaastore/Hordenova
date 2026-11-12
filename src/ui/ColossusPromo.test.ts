import { describe, expect, it } from "vitest";
import { dueColossusAlert } from "./ColossusPromo";

const H = 3_600_000;
const base = { week: 10, timeLeft: 100 * H, defeated: false, prize: false, attempts: 3 };

describe("Chefe Global alerts", () => {
  it("announces a new Serpent once per week", () => {
    expect(dueColossusAlert(base, [])).toBe("arrive");
    expect(dueColossusAlert(base, ["w10:arrive"])).toBeNull();
    expect(dueColossusAlert({ ...base, week: 11 }, ["w10:arrive"])).toBe("arrive");
  });
  it("warns in the last 24 hours while there are attempts left", () => {
    expect(dueColossusAlert({ ...base, timeLeft: 5 * H }, ["w10:arrive"])).toBe("last");
    expect(dueColossusAlert({ ...base, timeLeft: 5 * H, attempts: 0 }, ["w10:arrive"])).toBeNull();
    expect(dueColossusAlert({ ...base, timeLeft: 5 * H }, ["w10:arrive", "w10:last"])).toBeNull();
  });
  it("tells you about the community victory when there are Gems to claim", () => {
    expect(dueColossusAlert({ ...base, defeated: true, prize: true }, ["w10:arrive"])).toBe("won");
    expect(dueColossusAlert({ ...base, defeated: true, prize: false }, [])).toBeNull();
  });
});
