import { describe, expect, it } from "vitest";

import { normalizedProfileSchema } from "./normalized-profile";

describe("normalizedProfileSchema", () => {
  it("accepts a currency-neutral profile with internally consistent ratios", () => {
    expect(
      normalizedProfileSchema.safeParse({
        incomeExecutionRatio: 48,
        assetPercentileBand: "p50_74",
        debtServiceRatio: 18,
      }).success,
    ).toBe(true);
  });

  it("rejects debt service above the combined saving-and-repayment ratio", () => {
    const result = normalizedProfileSchema.safeParse({
      incomeExecutionRatio: 20,
      assetPercentileBand: "unknown",
      debtServiceRatio: 21,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["debtServiceRatio"]);
    }
  });
});
