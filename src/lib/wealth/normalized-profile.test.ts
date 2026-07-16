import { describe, expect, it } from "vitest";

import {
  collectedWealthProfileSchema,
  normalizedProfileSchema,
  toNormalizedProfile,
} from "./normalized-profile";

const completeNormalizedProfile = {
  incomeExecutionRatio: 48,
  assetPercentileBand: "p50_74" as const,
  debtServiceRatio: 18,
  cashRunwayBand: "three_to_six" as const,
  incomeStability: "stable" as const,
  largestAssetGroup: "market" as const,
  concentrationBand: "p30_50" as const,
  debtRisk: "none" as const,
  next90DayEvent: "none" as const,
};

describe("normalizedProfileSchema", () => {
  it("accepts a currency-neutral profile with internally consistent ratios", () => {
    expect(normalizedProfileSchema.safeParse(completeNormalizedProfile).success).toBe(
      true,
    );
  });

  it("requires all normalized signals", () => {
    expect(
      normalizedProfileSchema.safeParse({
        incomeExecutionRatio: 48,
        assetPercentileBand: "p50_74",
        debtServiceRatio: 18,
        incomeStability: "stable",
        largestAssetGroup: "market",
        concentrationBand: "p30_50",
        debtRisk: "none",
        next90DayEvent: "none",
      }).success,
    ).toBe(false);
  });

  it("rejects debt service above the combined saving-and-repayment ratio", () => {
    const result = normalizedProfileSchema.safeParse({
      ...completeNormalizedProfile,
      incomeExecutionRatio: 20,
      assetPercentileBand: "unknown",
      debtServiceRatio: 21,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["debtServiceRatio"]);
      expect(result.error.issues[0]?.message).toBe(
        "부채상환 비율은 저축과 부채상환을 합친 월소득 대비 실행 비율을 초과할 수 없습니다.",
      );
    }
  });
});

describe("collectedWealthProfileSchema", () => {
  it("accepts aggregate household asset data and defaults optional signals", () => {
    const result = collectedWealthProfileSchema.safeParse({
      incomeExecutionRatio: 48,
      debtServiceRatio: 18,
      totalAssetsKrw: 450_000_000,
      totalDebtKrw: 50_000_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assetPercentileBand).toBe("unknown");
      expect(result.data.cashRunwayBand).toBe("unknown");
      expect(result.data.incomeStability).toBe("unknown");
      expect(result.data.largestAssetGroup).toBe("unknown");
      expect(result.data.concentrationBand).toBe("unknown");
      expect(result.data.debtRisk).toBe("unknown");
      expect(result.data.next90DayEvent).toBe("unknown");
      expect(toNormalizedProfile(result.data)).toEqual({
        incomeExecutionRatio: 48,
        assetPercentileBand: "unknown",
        debtServiceRatio: 18,
        cashRunwayBand: "unknown",
        incomeStability: "unknown",
        largestAssetGroup: "unknown",
        concentrationBand: "unknown",
        debtRisk: "unknown",
        next90DayEvent: "unknown",
      });
    }
  });

  it("projects every privacy-safe signal without aggregate money amounts", () => {
    const collected = collectedWealthProfileSchema.parse({
      incomeExecutionRatio: 62,
      assetPercentileBand: "p75_89",
      debtServiceRatio: 12,
      cashRunwayBand: "six_to_twelve",
      incomeStability: "variable",
      largestAssetGroup: "property",
      concentrationBand: "p50_70",
      debtRisk: "variable_rate",
      next90DayEvent: "tax",
      totalAssetsKrw: 800_000_000,
      totalDebtKrw: 120_000_000,
    });

    const normalized = toNormalizedProfile(collected);

    expect(normalized).toEqual({
      incomeExecutionRatio: 62,
      assetPercentileBand: "p75_89",
      debtServiceRatio: 12,
      cashRunwayBand: "six_to_twelve",
      incomeStability: "variable",
      largestAssetGroup: "property",
      concentrationBand: "p50_70",
      debtRisk: "variable_rate",
      next90DayEvent: "tax",
    });
    expect(normalized).not.toHaveProperty("totalAssetsKrw");
    expect(normalized).not.toHaveProperty("totalDebtKrw");
  });

  it("rejects unsupported signal enum values", () => {
    const base = {
      incomeExecutionRatio: 48,
      debtServiceRatio: 18,
      totalAssetsKrw: 450_000_000,
      totalDebtKrw: 50_000_000,
    };

    for (const invalidSignal of [
      { cashRunwayBand: "two_years" },
      { incomeStability: "guaranteed" },
      { largestAssetGroup: "crypto" },
      { concentrationBand: "p100_plus" },
      { debtRisk: "low" },
      { next90DayEvent: "inheritance" },
    ]) {
      expect(
        collectedWealthProfileSchema.safeParse({
          ...base,
          ...invalidSignal,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects negative, fractional, or unsafe aggregate amounts", () => {
    for (const totalAssetsKrw of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
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
