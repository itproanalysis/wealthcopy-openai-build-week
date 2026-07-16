import { describe, expect, it } from "vitest";

import { ASSET_LEVELS, nextAssetLevel } from "./asset-level";
import { LEVEL_TRANSITIONS, levelTransitionFor } from "./level-transitions";
import {
  PUBLIC_ACTION_COPY,
  publicActionIdSchema,
  type PublicActionId,
} from "./public-plan";

const expectedAnchorActions = [
  "map_30_day_cashflow",
  "separate_cash_roles",
  "start_core_auto_execution",
  "separate_near_term_goal_funds",
  "classify_asset_roles",
  "set_leverage_guardrail",
  "set_concentration_cap",
  "build_liquidity_tiers",
  "align_valuation_dates",
  "draft_one_page_ips",
  "consolidate_reporting_calendar",
  "set_asset_class_limits",
  "create_family_decision_matrix",
  "build_liquidity_event_calendar",
  "audit_governance_calendar",
] as const satisfies readonly PublicActionId[];

describe("level transition action catalog", () => {
  it("assigns a distinct, allowlisted anchor action to every L1-L15 level", () => {
    expect(Object.keys(LEVEL_TRANSITIONS)).toEqual([...ASSET_LEVELS]);

    ASSET_LEVELS.forEach((currentLevel, index) => {
      const transition = levelTransitionFor(currentLevel);
      const anchorActionId = expectedAnchorActions[index];

      expect(transition.currentLevel).toBe(currentLevel);
      expect(transition.nextLevel).toBe(nextAssetLevel(currentLevel));
      expect(transition.actionPriority).toEqual([anchorActionId]);
      expect(transition.allowedActionIds).toContain(anchorActionId);
      expect(publicActionIdSchema.safeParse(anchorActionId).success).toBe(true);
    });

    expect(levelTransitionFor("L15").nextLevel).toBe("L15");
    expect(new Set(expectedAnchorActions).size).toBe(ASSET_LEVELS.length);
  });

  it("provides nonempty protect, advance, and verify stages at every level", () => {
    for (const transition of Object.values(LEVEL_TRANSITIONS)) {
      expect(transition.protectionActionIds.length).toBeGreaterThan(0);
      expect(transition.actionPriority).toHaveLength(1);
      expect(transition.evidenceActionIds.length).toBeGreaterThan(0);

      expect(
        transition.protectionActionIds.every(
          (id) => PUBLIC_ACTION_COPY[id].stage === "protect",
        ),
      ).toBe(true);
      expect(PUBLIC_ACTION_COPY[transition.actionPriority[0]].stage).toBe(
        "advance",
      );
      expect(
        transition.evidenceActionIds.every(
          (id) => PUBLIC_ACTION_COPY[id].stage === "verify",
        ),
      ).toBe(true);
    }
  });

  it("builds each allowlist as a unique protect-anchor-evidence union", () => {
    for (const transition of Object.values(LEVEL_TRANSITIONS)) {
      const expected = [
        ...transition.protectionActionIds,
        ...transition.actionPriority,
        ...transition.evidenceActionIds,
      ];

      expect(transition.allowedActionIds).toEqual(expected);
      expect(new Set(transition.allowedActionIds).size).toBe(
        transition.allowedActionIds.length,
      );
    }
  });

  it("gives every allowlisted action complete practical metadata", () => {
    expect(Object.keys(PUBLIC_ACTION_COPY).sort()).toEqual(
      [...publicActionIdSchema.options].sort(),
    );

    for (const copy of Object.values(PUBLIC_ACTION_COPY)) {
      expect(Object.keys(copy)).toEqual([
        "stage",
        "title",
        "outcome",
        "description",
        "steps",
      ]);
      expect(["protect", "advance", "verify"]).toContain(copy.stage);
      expect(copy.title.trim().length).toBeGreaterThan(0);
      expect(copy.outcome.trim().length).toBeGreaterThan(0);
      expect(copy.description).toMatch(/완료/);
      expect(copy.steps).toHaveLength(3);
      expect(copy.steps.every((step) => step.trim().length > 0)).toBe(true);
    }
  });

  it("contains no product, trade, return, amount, allocation, or ETA advice", () => {
    expect(JSON.stringify({ LEVEL_TRANSITIONS, PUBLIC_ACTION_COPY })).not.toMatch(
      /(?:ETF|대출 상품|종목|매수|매도|거래 추천|수익률|금리 수익|금액|달러|배분|비중|예상\s*기간|duration|return|yield|amount|allocation|krw|usd)/i,
    );
  });
});
