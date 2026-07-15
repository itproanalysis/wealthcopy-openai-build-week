import { describe, expect, it } from "vitest";

import { ASSET_LEVELS, nextAssetLevel, type AssetLevel } from "../asset-level";
import { levelTransitionFor } from "../level-transitions";
import {
  createPlanningContext,
  mergeModelSelection,
  planRequestSchema,
} from "./planner-core";

const request = {
  profile: {
    totalAssetsKrw: 450_000_000,
    totalDebtKrw: 50_000_000,
    incomeExecutionRatio: 48,
    assetPercentileBand: "p50_74" as const,
    debtServiceRatio: 18,
  },
  constraintNote: "내년에 이사 계획이 있어 현금 여유를 유지하고 싶어요.",
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
};

const levelInputs = [
  ["L1", 0, 1],
  ["L2", 0, 0],
  ["L3", 10_000_000, 0],
  ["L4", 30_000_000, 0],
  ["L5", 100_000_000, 0],
  ["L6", 300_000_000, 0],
  ["L7", 500_000_000, 0],
  ["L8", 1_000_000_000, 0],
  ["L9", 3_000_000_000, 0],
  ["L10", 5_000_000_000, 0],
  ["L11", 10_000_000_000, 0],
  ["L12", 30_000_000_000, 0],
  ["L13", 100_000_000_000, 0],
  ["L14", 300_000_000_000, 0],
  ["L15", 1_000_000_000_000, 0],
] as const satisfies readonly [AssetLevel, number, number][];

function profileAt(totalAssetsKrw: number, totalDebtKrw = 0) {
  return {
    ...request.profile,
    totalAssetsKrw,
    totalDebtKrw,
  };
}

describe("private planning boundary", () => {
  it("derives the level internally and sends only normalized signals to the model", () => {
    const context = createPlanningContext(request);

    expect(context.sourceLevel).toBe("L6");
    expect(context.nextLevel).toBe("L7");
    expect(context.modelInput.profileSignals).toEqual({
      incomeExecution: "strong",
      assetPosition: "middle",
      debtBurden: "low",
      executionPace: "accelerated",
    });
    expect(context.modelInput.allowedRoutineActionIds).toEqual([
      "review_long_term_structure",
      "review_cash_buffer",
      "confirm_monthly_limit",
      "review_debt_schedule",
    ]);
    expect(context.modelInput.constraintSignals).toEqual([
      "preserve_liquidity",
      "keep_monthly_rhythm",
    ]);

    const serializedModelInput = JSON.stringify(context.modelInput);
    expect(serializedModelInput).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|netWorth|currentLevel|nextLevel|monthlyIncome|constraintNote|KRW|USD/i,
    );
    expect(serializedModelInput).not.toContain("450000000");
    expect(serializedModelInput).not.toContain("50000000");
    expect(JSON.stringify(context)).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|450000000|50000000/,
    );
  });

  it("accepts required aggregate amounts but rejects client level and account details", () => {
    expect(planRequestSchema.safeParse(request).success).toBe(true);

    for (const extraProfile of [
      { currentLevel: "L15" },
      { monthlyIncome: 6_500_000 },
      { accountNumber: "123-456" },
    ]) {
      expect(
        planRequestSchema.safeParse({
          ...request,
          profile: { ...request.profile, ...extraProfile },
        }).success,
      ).toBe(false);
    }
  });

  it("requires both aggregate household asset and debt inputs", () => {
    const commonProfile = {
      incomeExecutionRatio: request.profile.incomeExecutionRatio,
      assetPercentileBand: request.profile.assetPercentileBand,
      debtServiceRatio: request.profile.debtServiceRatio,
    };
    const withoutAssets = {
      ...commonProfile,
      totalDebtKrw: request.profile.totalDebtKrw,
    };
    const withoutDebt = {
      ...commonProfile,
      totalAssetsKrw: request.profile.totalAssetsKrw,
    };

    expect(
      planRequestSchema.safeParse({ ...request, profile: withoutAssets }).success,
    ).toBe(false);
    expect(
      planRequestSchema.safeParse({ ...request, profile: withoutDebt }).success,
    ).toBe(false);
  });

  it("keeps the self-selected PSID band optional", () => {
    const profile = {
      totalAssetsKrw: request.profile.totalAssetsKrw,
      totalDebtKrw: request.profile.totalDebtKrw,
      incomeExecutionRatio: request.profile.incomeExecutionRatio,
      debtServiceRatio: request.profile.debtServiceRatio,
    };
    const parsed = planRequestSchema.safeParse({ ...request, profile });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.profile.assetPercentileBand).toBe("unknown");
    }
  });

  it("rejects likely contact and account data before planning", () => {
    for (const constraintNote of [
      "연락처는 010-1234-5678입니다.",
      "은행 계좌는 123-456789-01234입니다.",
    ]) {
      expect(
        planRequestSchema.safeParse({ ...request, constraintNote }).success,
      ).toBe(false);
    }
  });

  it("rejects currency amounts in the optional note", () => {
    for (const constraintNote of [
      "월 650만원을 저축하고 싶어요.",
      "KRW 6500000을 저축하고 싶어요.",
      "6500000 KRW를 저축하고 싶어요.",
    ]) {
      expect(
        planRequestSchema.safeParse({ ...request, constraintNote }).success,
      ).toBe(false);
    }
  });

  it("does not confuse ordinary Korean words with monetary amounts", () => {
    expect(
      planRequestSchema.safeParse({
        ...request,
        constraintNote: "공원 근처로 이사하고 싶어요.",
      }).success,
    ).toBe(true);
  });

  it("uses a deterministic safety plan without a model call", () => {
    const context = createPlanningContext({
      ...request,
      constraintNote: "코인 종목 수익률과 매수 시점을 알려 주세요.",
    });

    expect(context.allowModel).toBe(false);
    expect(context.status).toBe("professional_review");
    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "seek_professional_review",
      "review_long_term_structure",
      "schedule_monthly_checkin",
    ]);
  });

  it("adds debt review for a high debt-service ratio", () => {
    const context = createPlanningContext({
      ...request,
      profile: { ...request.profile, debtServiceRatio: 45 },
      constraintNote: "",
    });

    expect(context.mandatoryActionIds).toContain("review_debt_schedule");
    expect(context.modelInput.profileSignals.debtBurden).toBe("high");
  });

  it("rejects a debt ratio above the combined execution ratio", () => {
    expect(
      planRequestSchema.safeParse({
        ...request,
        profile: {
          ...request.profile,
          incomeExecutionRatio: 20,
          debtServiceRatio: 21,
        },
      }).success,
    ).toBe(false);
  });

  it("connects the recommended internal path to a monthly fallback", () => {
    const context = createPlanningContext({
      ...request,
      profile: {
        ...request.profile,
        incomeExecutionRatio: 55,
        assetPercentileBand: "unknown",
        debtServiceRatio: 8,
      },
      constraintNote: "",
    });

    expect(context.modelInput.profileSignals.executionPace).toBe("accelerated");
    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "review_long_term_structure",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);
  });

  it("builds a derived next-step plan for every asset level", () => {
    expect(levelInputs.map(([level]) => level)).toEqual(ASSET_LEVELS);

    for (const [expectedLevel, totalAssetsKrw, totalDebtKrw] of levelInputs) {
      const context = createPlanningContext({
        ...request,
        profile: profileAt(totalAssetsKrw, totalDebtKrw),
        constraintNote: "",
      });
      const actionIds = context.fallback.actions.map((action) => action.id);
      const primaryActionId =
        levelTransitionFor(expectedLevel).actionPriority[0];

      expect(context.sourceLevel).toBe(expectedLevel);
      expect(context.nextLevel).toBe(nextAssetLevel(expectedLevel));
      expect(context.fallback.nextLevel).toBe(nextAssetLevel(expectedLevel));
      expect(actionIds).toContain(primaryActionId);
      expect(actionIds.at(-1)).toBe("schedule_monthly_checkin");
      expect(Object.keys(context.fallback)).toEqual([
        "nextLevel",
        "actions",
        "progress",
      ]);
    }
  });

  it("keeps L15 active with a governance maintenance action", () => {
    const context = createPlanningContext({
      ...request,
      profile: profileAt(1_000_000_000_000),
      constraintNote: "",
    });

    expect(context.sourceLevel).toBe("L15");
    expect(context.fallback.nextLevel).toBe("L15");
    expect(context.fallback.actions[0]?.id).toBe("audit_governance_calendar");
  });

  it("applies constraints before the derived level action and keeps check-in last", () => {
    const context = createPlanningContext({
      ...request,
      profile: profileAt(10_000_000),
      constraintNote: "소득 감소가 있어 실행 범위를 다시 정하고 싶어요.",
    });

    expect(context.sourceLevel).toBe("L3");
    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "review_income_change",
      "confirm_debt_payment_calendar",
      "schedule_monthly_checkin",
    ]);
  });

  it("does not let another level's model candidate replace the transition action", () => {
    const context = createPlanningContext({
      ...request,
      profile: profileAt(0),
      constraintNote: "",
    });
    const plan = mergeModelSelection(context, {
      actionIds: [
        "audit_governance_calendar",
        "review_asset_concentration",
        "schedule_monthly_checkin",
      ],
    });

    expect(plan.actions.map((action) => action.id)).toEqual([
      "set_cash_safety_rule",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);
  });

  it("uses a valid model routine as the second action on a normal request", () => {
    const context = createPlanningContext({
      ...request,
      profile: profileAt(0),
      constraintNote: "",
    });
    const plan = mergeModelSelection(context, {
      actionIds: [
        "seek_professional_review",
        "review_debt_schedule",
        "review_cash_buffer",
      ],
    });

    expect(plan.actions.map((action) => action.id)).toEqual([
      "set_cash_safety_rule",
      "review_debt_schedule",
      "schedule_monthly_checkin",
    ]);
  });

  it("allows an upper-level recordkeeping companion but preserves its anchor", () => {
    const context = createPlanningContext({
      ...request,
      profile: profileAt(3_000_000_000),
      constraintNote: "",
    });
    const plan = mergeModelSelection(context, {
      actionIds: [
        "refresh_asset_valuation_dates",
        "confirm_monthly_limit",
        "schedule_monthly_checkin",
      ],
    });

    expect(context.sourceLevel).toBe("L9");
    expect(plan.actions.map((action) => action.id)).toEqual([
      "reconcile_liability_register",
      "refresh_asset_valuation_dates",
      "schedule_monthly_checkin",
    ]);
  });

  it("keeps mandatory actions when merging model-selected IDs", () => {
    const context = createPlanningContext(request);
    const plan = mergeModelSelection(context, {
      actionIds: [
        "confirm_monthly_limit",
        "review_debt_schedule",
        "schedule_monthly_checkin",
      ],
    });

    expect(plan.actions).toHaveLength(3);
    expect(plan.actions.map((action) => action.id)).toContain(
      "review_long_term_structure",
    );
    expect(plan.actions.at(-1)?.id).toBe("schedule_monthly_checkin");
    expect(Object.keys(plan)).toEqual(["nextLevel", "actions", "progress"]);
  });

  it("rejects model output fields that the merge never consumes", () => {
    const context = createPlanningContext(request);
    const plan = mergeModelSelection(context, {
      actionIds: [
        "confirm_monthly_limit",
        "review_debt_schedule",
        "schedule_monthly_checkin",
      ],
      constraintSignals: ["review_debt"],
    });

    expect(plan).toEqual(context.fallback);
  });
});
