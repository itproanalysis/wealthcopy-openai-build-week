import { describe, expect, it } from "vitest";

import {
  matchWealthPaths,
  type WealthProfile,
  wealthProfileSchema,
} from "./engine";

const balancedProfile: WealthProfile = {
  currentLevel: "L6",
  targetLevel: "L7",
  monthlyIncome: 6_500_000,
  monthlySavings: 3_100_000,
  debtRatio: 18,
  householdType: "single",
  riskPreference: "balanced",
  emergencyFundMonths: 5,
};

describe("wealthProfileSchema", () => {
  it("rejects savings above income", () => {
    const result = wealthProfileSchema.safeParse({
      ...balancedProfile,
      monthlySavings: balancedProfile.monthlyIncome + 1,
    });

    expect(result.success).toBe(false);
  });

  it("restricts the demo to the reviewed L6 to L7 journey", () => {
    const result = wealthProfileSchema.safeParse({
      ...balancedProfile,
      currentLevel: "L5",
    });

    expect(result.success).toBe(false);
  });
});

describe("matchWealthPaths", () => {
  it("returns the three path library entries in stable order", () => {
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

  it("keeps slide fixture values for the L6 to L7 demo", () => {
    const paths = matchWealthPaths(balancedProfile);

    expect(paths.map((path) => path.monthlyRequired)).toEqual([
      2_400_000, 3_100_000, 4_200_000,
    ]);
    expect(paths.map((path) => path.durationMonths)).toEqual([77, 62, 54]);
  });

  it("moves a low-buffer, high-debt profile away from fast", () => {
    const paths = matchWealthPaths({
      ...balancedProfile,
      debtRatio: 48,
      emergencyFundMonths: 1,
      riskPreference: "fast",
    });

    expect(paths.find((path) => path.type === "stable")?.recommended).toBe(
      true,
    );
    expect(paths.find((path) => path.type === "fast")?.recommended).toBe(
      false,
    );
  });

  it("reports a transparent budget gap", () => {
    const paths = matchWealthPaths({
      ...balancedProfile,
      monthlySavings: 2_500_000,
    });

    expect(paths.find((path) => path.type === "balanced")?.budgetGap).toBe(
      600_000,
    );
    expect(paths.find((path) => path.type === "stable")?.budgetGap).toBe(0);
  });
});
