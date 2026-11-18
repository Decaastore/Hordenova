import { describe, expect, it } from "vitest";
import { getInventoryExpansionPrice, MAX_INVENTORY_EXPANSIONS, sanitizeInventoryExpansions } from "./inventoryExpansion";

describe("inventory expansion pricing", () => {
  it("climbs with every purchase and Free Gems cost 1.5x", () => {
    expect(getInventoryExpansionPrice(0)).toEqual({ purchased: 100, free: 150 });
    expect(getInventoryExpansionPrice(1)).toEqual({ purchased: 150, free: 225 });
    expect(getInventoryExpansionPrice(MAX_INVENTORY_EXPANSIONS - 1)!.purchased).toBeGreaterThan(getInventoryExpansionPrice(0)!.purchased);
  });
  it("stops at the cap", () => {
    expect(getInventoryExpansionPrice(MAX_INVENTORY_EXPANSIONS)).toBeNull();
  });
  it("sanitizes saved counts", () => {
    expect(sanitizeInventoryExpansions(undefined)).toBe(0);
    expect(sanitizeInventoryExpansions(-3)).toBe(0);
    expect(sanitizeInventoryExpansions(3.7)).toBe(3);
    expect(sanitizeInventoryExpansions(999)).toBe(MAX_INVENTORY_EXPANSIONS);
  });
});
