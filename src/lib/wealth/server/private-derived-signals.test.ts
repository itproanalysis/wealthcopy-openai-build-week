import { describe, expect, it } from "vitest";

import { collectedWealthProfileSchema } from "../normalized-profile";
import { derivePrivatePlanningSignals } from "./private-derived-signals";

function profile(totalAssetsKrw: number, totalDebtKrw: number) {
  return collectedWealthProfileSchema.parse({
    incomeExecutionRatio: 42,
    debtServiceRatio: 18,
    totalAssetsKrw,
    totalDebtKrw,
  });
}

describe("private planning signal reduction", () => {
  it("turns exact amounts into coarse currency-neutral bands", () => {
    expect(derivePrivatePlanningSignals(profile(500_000_000, 0))).toEqual({
      freeSavingsCapacity: "strong",
      leverage: "none",
    });
    expect(
      derivePrivatePlanningSignals(profile(500_000_000, 150_000_000)),
    ).toEqual({
      freeSavingsCapacity: "strong",
      leverage: "medium",
    });
    expect(
      derivePrivatePlanningSignals(profile(100_000_000, 120_000_000)),
    ).toEqual({
      freeSavingsCapacity: "strong",
      leverage: "underwater",
    });
  });

  it("uses execution capacity after debt service", () => {
    const base = profile(500_000_000, 50_000_000);

    expect(
      derivePrivatePlanningSignals({
        ...base,
        incomeExecutionRatio: 25,
        debtServiceRatio: 20,
      }).freeSavingsCapacity,
    ).toBe("limited");
    expect(
      derivePrivatePlanningSignals({
        ...base,
        incomeExecutionRatio: 35,
        debtServiceRatio: 20,
      }).freeSavingsCapacity,
    ).toBe("steady");
  });

  it("never returns exact amounts or currency fields", () => {
    const serialized = JSON.stringify(
      derivePrivatePlanningSignals(profile(456_789_123, 123_456_789)),
    );

    expect(serialized).not.toMatch(
      /456789123|123456789|amount|asset|debt|krw|usd/i,
    );
  });
});
