import { describe, expect, it } from "vitest";

import { ASSET_LEVELS, nextAssetLevel } from "./asset-level";
import { LEVEL_TRANSITIONS, levelTransitionFor } from "./level-transitions";
import { PUBLIC_ACTION_COPY, publicActionIdSchema } from "./public-plan";

const expectedPrimaryActions = [
  "map_monthly_cashflow",
  "set_cash_safety_rule",
  "confirm_debt_payment_calendar",
  "lock_monthly_execution_routine",
  "review_asset_concentration",
  "review_long_term_structure",
  "audit_plan_drift",
  "refresh_asset_valuation_dates",
  "reconcile_liability_register",
  "document_ownership_structure",
  "consolidate_reporting_calendar",
  "verify_decision_authorities",
  "review_continuity_records",
  "confirm_alternate_access",
  "audit_governance_calendar",
] as const;

describe("level transition action catalog", () => {
  it("assigns a distinct, allowlisted primary action to every level", () => {
    expect(Object.keys(LEVEL_TRANSITIONS)).toEqual([...ASSET_LEVELS]);

    ASSET_LEVELS.forEach((currentLevel, index) => {
      const transition = levelTransitionFor(currentLevel);
      const primaryActionId = expectedPrimaryActions[index];

      expect(transition.currentLevel).toBe(currentLevel);
      expect(transition.nextLevel).toBe(nextAssetLevel(currentLevel));
      expect(transition.actionPriority).toEqual([primaryActionId]);
      expect(transition.allowedActionIds).toContain(primaryActionId);
      expect(new Set(transition.allowedActionIds).size).toBe(
        transition.allowedActionIds.length,
      );
      expect(publicActionIdSchema.safeParse(primaryActionId).success).toBe(true);
    });

    expect(new Set(expectedPrimaryActions).size).toBe(ASSET_LEVELS.length);
  });

  it("gives every public action an explicit completion criterion", () => {
    for (const copy of Object.values(PUBLIC_ACTION_COPY)) {
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.description).toMatch(/완료/);
    }
  });

  it("contains no product, return, amount, allocation, or duration advice", () => {
    expect(JSON.stringify({ LEVEL_TRANSITIONS, PUBLIC_ACTION_COPY })).not.toMatch(
      /(?:ETF|대출 상품|종목|수익률|금리 수익|금액|달러|배분|비중|예상\s*기간|duration|return|yield|amount|krw|usd)/i,
    );
  });
});
