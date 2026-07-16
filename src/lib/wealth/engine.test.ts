import { describe, expect, it } from "vitest";

import {
  matchWealthPaths,
  type PathContext,
  type WealthProfile,
  wealthProfileSchema,
} from "./engine";
import {
  BEHAVIOR_POLICY_VERSION,
  INTERNAL_PATH_LIBRARY,
  INTERNAL_PATH_TYPES,
  debtServiceBand,
  incomeExecutionBand,
} from "./path-library";
import { publicActionIdSchema } from "./public-plan";

const healthyProfile: WealthProfile = {
  incomeExecutionRatio: 35,
  assetPercentileBand: "p50_74",
  debtServiceRatio: 12,
  cashRunwayBand: "six_to_twelve",
  incomeStability: "stable",
  largestAssetGroup: "mixed",
  concentrationBand: "under_30",
  debtRisk: "none",
  next90DayEvent: "none",
};

const buildingContext: PathContext = {
  freeSavingsCapacity: "strong",
  leverage: "low",
  sourceLevel: "L6",
};

function recommendedType(profile: WealthProfile, context: PathContext) {
  return matchWealthPaths(profile, context).find((path) => path.recommended)
    ?.type;
}

describe("wealthProfileSchema", () => {
  it("rejects ratios outside the currency-neutral range", () => {
    expect(
      wealthProfileSchema.safeParse({
        ...healthyProfile,
        incomeExecutionRatio: 101,
      }).success,
    ).toBe(false);
  });

  it("rejects raw household amounts and client-supplied level fields", () => {
    for (const forbiddenField of [
      { totalAssetsKrw: 450_000_000 },
      { totalDebtKrw: 120_000_000 },
      { currentLevel: "L6" },
      { sourceLevel: "L6" },
    ]) {
      expect(
        wealthProfileSchema.safeParse({
          ...healthyProfile,
          ...forbiddenField,
        }).success,
      ).toBe(false);
    }
  });

  it("requires server-derived path context as a separate argument", () => {
    expect(() =>
      matchWealthPaths(
        healthyProfile,
        undefined as unknown as PathContext,
      ),
    ).toThrow();
  });
});

describe("matchWealthPaths", () => {
  it("uses the second-generation purpose-path policy", () => {
    expect(BEHAVIOR_POLICY_VERSION).toBe("behavior-policy-v2");
  });

  it("locks the reviewed ratio band boundaries", () => {
    expect([19, 20, 39, 40].map(incomeExecutionBand)).toEqual([
      "limited",
      "steady",
      "steady",
      "strong",
    ]);
    expect([19, 20, 39, 40].map(debtServiceBand)).toEqual([
      "manageable",
      "watch",
      "watch",
      "high",
    ]);
  });

  it("returns all eight path types in stable order with exactly one recommendation", () => {
    const paths = matchWealthPaths(healthyProfile, buildingContext);

    expect(INTERNAL_PATH_TYPES).toEqual([
      "cash_defense",
      "debt_control",
      "income_resilience",
      "core_building",
      "concentration_control",
      "liquidity_planning",
      "operating_system",
      "continuity",
    ]);
    expect(paths.map((path) => path.type)).toEqual(INTERNAL_PATH_TYPES);
    expect(paths.filter((path) => path.recommended)).toHaveLength(1);
  });

  it("prioritizes debt control for high debt service and high leverage", () => {
    expect(
      recommendedType(
        {
          ...healthyProfile,
          incomeExecutionRatio: 55,
          debtServiceRatio: 45,
          debtRisk: "high_cost",
        },
        {
          ...buildingContext,
          freeSavingsCapacity: "limited",
          leverage: "high",
        },
      ),
    ).toBe("debt_control");
  });

  it("prioritizes cash defense when essential cash covers under one month", () => {
    expect(
      recommendedType(
        {
          ...healthyProfile,
          incomeExecutionRatio: 18,
          debtServiceRatio: 8,
          cashRunwayBand: "under_1",
        },
        {
          ...buildingContext,
          freeSavingsCapacity: "limited",
        },
      ),
    ).toBe("cash_defense");
  });

  it("prioritizes income resilience when household income is changing", () => {
    expect(
      recommendedType(
        {
          ...healthyProfile,
          incomeExecutionRatio: 18,
          debtServiceRatio: 8,
          incomeStability: "changing",
          next90DayEvent: "income_change",
        },
        {
          ...buildingContext,
          freeSavingsCapacity: "limited",
        },
      ),
    ).toBe("income_resilience");
  });

  it("prioritizes concentration control when one asset group is at least 70%", () => {
    expect(
      recommendedType(
        {
          ...healthyProfile,
          largestAssetGroup: "market",
          concentrationBand: "p70_plus",
        },
        buildingContext,
      ),
    ).toBe("concentration_control");
  });

  it("prioritizes an operating system for a healthy mixed L10 household", () => {
    expect(
      recommendedType(healthyProfile, {
        ...buildingContext,
        sourceLevel: "L10",
      }),
    ).toBe("operating_system");
  });

  it("prioritizes continuity for a healthy L14 household", () => {
    expect(
      recommendedType(healthyProfile, {
        ...buildingContext,
        sourceLevel: "L14",
      }),
    ).toBe("continuity");
  });

  it("does not use a self-selected PSID band to select or score a path", () => {
    const psidBands: WealthProfile["assetPercentileBand"][] = [
      "below_25",
      "p25_49",
      "p50_74",
      "p75_89",
      "p90_plus",
      "unknown",
    ];
    const outcomes = psidBands.map((assetPercentileBand) =>
      matchWealthPaths(
        { ...healthyProfile, assetPercentileBand },
        buildingContext,
      ).map(({ type, score, recommended }) => ({
        type,
        score,
        recommended,
      })),
    );

    for (const outcome of outcomes.slice(1)) {
      expect(outcome).toEqual(outcomes[0]);
    }
  });

  it("returns only safe purpose and support metadata", () => {
    const paths = matchWealthPaths(healthyProfile, buildingContext);

    for (const path of paths) {
      expect(Object.keys(path).sort()).toEqual([
        "objective",
        "recommended",
        "score",
        "supportActionIds",
        "type",
      ]);
    }

    expect(JSON.stringify(paths)).not.toMatch(
      /amount|currency|duration|monthlyRequired|return|yield|forecast|krw|usd/i,
    );
  });

  it("provides unique allowlisted support actions for every path", () => {
    const paths = matchWealthPaths(healthyProfile, buildingContext);

    for (const path of paths) {
      expect(path.supportActionIds).toEqual(
        INTERNAL_PATH_LIBRARY[path.type].supportActionIds,
      );
      expect(new Set(path.supportActionIds).size).toBe(
        path.supportActionIds.length,
      );
      expect(path.supportActionIds.length).toBeGreaterThanOrEqual(3);
      for (const actionId of path.supportActionIds) {
        expect(publicActionIdSchema.safeParse(actionId).success).toBe(true);
      }
    }
  });

  it("keeps the path library free of forecasts and monetary fixtures", () => {
    for (const definition of Object.values(INTERNAL_PATH_LIBRARY)) {
      expect(Object.keys(definition).sort()).toEqual([
        "objective",
        "supportActionIds",
        "type",
      ]);
    }

    expect(JSON.stringify(INTERNAL_PATH_LIBRARY)).not.toMatch(
      /amount|currency|duration|monthlyRequired|return|yield|forecast|prediction|krw|usd/i,
    );
  });
});
