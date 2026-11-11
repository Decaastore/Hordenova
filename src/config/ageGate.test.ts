import { describe, expect, it } from "vitest";
import { canPayWithRealMoney, canShowPurchaseOffers, createAgeVerification, sanitizeAgeVerification } from "./ageGate";

describe("adult-only purchases", () => {
  it("a new account cannot pay with real money nor see purchase offers", () => {
    const v = createAgeVerification();
    expect(canPayWithRealMoney(v)).toBe(false);
    expect(canShowPurchaseOffers(v)).toBe(false);
  });

  it("a bare 'verified' flag is not enough: it needs the method and the moment it came from", () => {
    expect(sanitizeAgeVerification({ status: "VERIFIED_ADULT" }).status).toBe("NONE");
    expect(sanitizeAgeVerification({ status: "VERIFIED_ADULT", method: "SELF_DECLARED", verifiedAt: 1 }).status).toBe("NONE");
    const ok = sanitizeAgeVerification({ status: "VERIFIED_ADULT", method: "PAYMENT_PROVIDER", verifiedAt: 1_800_000_000_000 });
    expect(canPayWithRealMoney(ok)).toBe(true);
  });

  it("a denied account stays denied", () => {
    const v = sanitizeAgeVerification({ status: "DENIED", method: "ID_SERVICE", verifiedAt: 5 });
    expect(v.status).toBe("DENIED");
    expect(canPayWithRealMoney(v)).toBe(false);
  });
});
