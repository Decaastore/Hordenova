/**
 * COMPRAS SÓ PARA MAIORES DE 18 — the game is open to everyone, but buying
 * anything with real money (Gem packs, the starter pack, premium passes)
 * is for verified adults only.
 *
 * Brazil's ECA Digital (Lei 15.211/2025, in force since 17 Mar 2026) does
 * not accept a self-declared age (typing a birth date) as verification, so
 * NOTHING in the client can mark a player as an adult: there is no "I am
 * 18" button. Verification happens once, at the first real-money purchase,
 * through the payment provider (the CPF of the card/account holder) or an
 * age-verification service — both run server-side, and only the server's
 * confirmation may set `status: "VERIFIED_ADULT"`. Until a provider is
 * connected (config/store.ts's REAL_MONEY_PAYMENTS_ENABLED), every purchase
 * stays closed and the rule is simply shown.
 *
 * Spending Gems the player already has is unaffected: Purchased Gems can
 * only come from a verified adult's payment, and Free Gems are earned by
 * playing.
 */
export const PURCHASE_MIN_AGE = 18;

export type AgeVerificationMethod = "PAYMENT_PROVIDER" | "ID_SERVICE";

export interface AgeVerification {
  status: "NONE" | "VERIFIED_ADULT" | "DENIED";
  method: AgeVerificationMethod | null;
  verifiedAt: number | null;
}

export function createAgeVerification(): AgeVerification {
  return { status: "NONE", method: null, verifiedAt: null };
}

const METHODS = new Set<string>(["PAYMENT_PROVIDER", "ID_SERVICE"]);

export function sanitizeAgeVerification(raw: unknown): AgeVerification {
  if (!raw || typeof raw !== "object") return createAgeVerification();
  const r = raw as Record<string, unknown>;
  const method = typeof r.method === "string" && METHODS.has(r.method) ? (r.method as AgeVerificationMethod) : null;
  const verifiedAt = typeof r.verifiedAt === "number" && Number.isFinite(r.verifiedAt) ? r.verifiedAt : null;
  // A verified status only counts with the method and the moment it came from.
  if (r.status === "VERIFIED_ADULT" && method && verifiedAt !== null) return { status: "VERIFIED_ADULT", method, verifiedAt };
  if (r.status === "DENIED" && method && verifiedAt !== null) return { status: "DENIED", method, verifiedAt };
  return createAgeVerification();
}

/** May this account pay with real money? Only a verified adult. */
export function canPayWithRealMoney(v: AgeVerification): boolean {
  return v.status === "VERIFIED_ADULT";
}

/** Purchase offers (pop-up deals) are only ever shown to verified adults. */
export function canShowPurchaseOffers(v: AgeVerification): boolean {
  return v.status === "VERIFIED_ADULT";
}
