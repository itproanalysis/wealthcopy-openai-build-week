import { describe, expect, it } from "vitest";

import {
  collectedWealthProfileSchema,
  normalizedProfileSchema,
  toNormalizedProfile,
} from "./normalized-profile";

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

describe("collectedWealthProfileSchema", () => {
  it("accepts aggregate household asset data and defaults the optional PSID band", () => {
    const result = collectedWealthProfileSchema.safeParse({
      incomeExecutionRatio: 48,
      debtServiceRatio: 18,
      totalAssetsKrw: 450_000_000,
      totalDebtKrw: 50_000_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assetPercentileBand).toBe("unknown");
      expect(toNormalizedProfile(result.data)).toEqual({
        incomeExecutionRatio: 48,
        assetPercentileBand: "unknown",
        debtServiceRatio: 18,
      });
    }
  });

  it("rejects negative, fractional, or unsafe aggregate amounts", () => {
    for (const totalAssetsKrw of [
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        collectedWealthProfileSchema.safeParse({
          incomeExecutionRatio: 48,
          debtServiceRatio: 18,
          totalAssetsKrw,
          totalDebtKrw: 0,
        }).success,
      ).toBe(false);
    }
  });
});
