import { describe, expect, it } from "vitest";

import {
  matchWealthPaths,
  type WealthProfile,
  wealthProfileSchema,
} from "./engine";
import {
  BEHAVIOR_POLICY_VERSION,
  INTERNAL_PATH_LIBRARY,
  debtServiceBand,
  incomeExecutionBand,
} from "./path-library";
import { publicActionIdSchema } from "./public-plan";

const balancedProfile: WealthProfile = {
  incomeExecutionRatio: 35,
  assetPercentileBand: "p50_74",
  debtServiceRatio: 18,
};

describe("wealthProfileSchema", () => {
  it("rejects ratios outside the currency-neutral range", () => {
    const result = wealthProfileSchema.safeParse({
      ...balancedProfile,
      incomeExecutionRatio: 101,
    });

    expect(result.success).toBe(false);
  });

  it("rejects raw household amounts and client level fields", () => {
    expect(
      wealthProfileSchema.safeParse({
        ...balancedProfile,
        totalAssetsKrw: 450_000_000,
      }).success,
    ).toBe(false);
    expect(
      wealthProfileSchema.safeParse({ ...balancedProfile, currentLevel: "L6" })
        .success,
    ).toBe(false);
  });
});

describe("matchWealthPaths", () => {
  it("versions the internal behavior policy independently from PSID data", () => {
    expect(BEHAVIOR_POLICY_VERSION).toBe("behavior-policy-v1");
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

  it("returns the three internal candidates in stable order", () => {
    const paths = matchWealthPaths(balancedProfile);

    expect(paths.map((path) => path.type)).toEqual([
      "stable",
      "balanced",
      "fast",
    ]);
    expect(paths.filter((path) => path.recommended)).toHaveLength(1);
    expect(paths.find((path) => path.type === "balanced")?.recommended).toBe(
      true,
    );
  });

  it("keeps monetary values and duration estimates out of candidates", () => {
    const paths = matchWealthPaths(balancedProfile);

    for (const path of paths) {
      expect(Object.keys(path).sort()).toEqual([
        "actionPriority",
        "recommended",
        "score",
        "type",
      ]);
    }

    expect(JSON.stringify(paths)).not.toMatch(
      /amount|currency|durationMonths|monthlyRequired|return|yield/i,
    );
  });

  it("moves a high-debt profile away from fast", () => {
    const paths = matchWealthPaths({
      ...balancedProfile,
      incomeExecutionRatio: 50,
      assetPercentileBand: "below_25",
      debtServiceRatio: 45,
    });

    expect(paths.find((path) => path.type === "stable")?.recommended).toBe(
      true,
    );
    expect(paths.find((path) => path.type === "fast")?.recommended).toBe(
      false,
    );
  });

  it("can prefer fast only with strong capacity and low debt burden", () => {
    const paths = matchWealthPaths({
      ...balancedProfile,
      incomeExecutionRatio: 55,
      assetPercentileBand: "unknown",
      debtServiceRatio: 8,
    });

    expect(paths.find((path) => path.type === "fast")?.recommended).toBe(
      true,
    );
  });

  it("requires strong execution and manageable debt before fast can lead", () => {
    for (const profile of [
      {
        ...balancedProfile,
        incomeExecutionRatio: 39,
        assetPercentileBand: "p90_plus" as const,
        debtServiceRatio: 10,
      },
      {
        ...balancedProfile,
        incomeExecutionRatio: 55,
        assetPercentileBand: "p90_plus" as const,
        debtServiceRatio: 20,
      },
    ]) {
      expect(
        matchWealthPaths(profile).find((path) => path.recommended)?.type,
      ).not.toBe("fast");
    }
  });

  it("does not use a self-selected PSID band to set execution pace", () => {
    const scores = [
      "below_25",
      "p25_49",
      "p50_74",
      "p75_89",
      "p90_plus",
      "unknown",
    ].map((assetPercentileBand) =>
      matchWealthPaths({
        ...balancedProfile,
        assetPercentileBand: assetPercentileBand as WealthProfile["assetPercentileBand"],
      }).map((path) => path.score),
    );

    for (const scoreSet of scores.slice(1)) {
      expect(scoreSet).toEqual(scores[0]);
    }
  });

  it("provides unique allowlisted action priorities for every internal path", () => {
    const paths = matchWealthPaths(balancedProfile);

    for (const path of paths) {
      expect(path.actionPriority).toEqual(
        INTERNAL_PATH_LIBRARY[path.type].actionPriority,
      );
      expect(new Set(path.actionPriority).size).toBe(path.actionPriority.length);
      expect(path.actionPriority).toHaveLength(4);
      for (const actionId of path.actionPriority) {
        expect(publicActionIdSchema.safeParse(actionId).success).toBe(true);
      }
    }
  });

  it("keeps the path library free of predictions and monetary fixtures", () => {
    for (const definition of Object.values(INTERNAL_PATH_LIBRARY)) {
      expect(Object.keys(definition).sort()).toEqual([
        "actionPriority",
        "baseScore",
        "debtServiceWeights",
        "incomeExecutionWeights",
        "type",
      ]);
    }

    expect(JSON.stringify(INTERNAL_PATH_LIBRARY)).not.toMatch(
      /amount|currency|durationMonths|monthlyRequired|return|yield|krw|usd/i,
    );
  });
});
