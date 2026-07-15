import { describe, expect, it } from "vitest";

import { ASSET_LEVELS, nextAssetLevel } from "../asset-level";
import { levelTransitionFor } from "../level-transitions";
import {
  createPlanningContext,
  mergeModelSelection,
  planRequestSchema,
} from "./planner-core";

const request = {
  profile: {
    currentLevel: "L6" as const,
    incomeExecutionRatio: 48,
    assetPercentileBand: "p50_74" as const,
    debtServiceRatio: 18,
  },
  constraintNote: "내년에 이사 계획이 있어 현금 여유를 유지하고 싶어요.",
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
};

describe("private planning boundary", () => {
  it("sends only currency-free bands and allowlisted signals to the model", () => {
    const context = createPlanningContext(request);

    expect(context.modelInput.profileSignals).toEqual({
      incomeExecution: "strong",
      assetPosition: "middle",
      debtBurden: "low",
      executionPace: "accelerated",
    });
    expect(context.modelInput.levelTransition).toEqual({
      currentLevel: "L6",
      nextLevel: "L7",
    });
    expect(context.modelInput.allowedRoutineActionIds).toEqual([
      "review_long_term_structure",
      "review_cash_buffer",
      "confirm_monthly_limit",
      "review_debt_schedule",
    ]);
    expect(context.modelInput.allowedRoutineActionIds).not.toContain(
      "seek_professional_review",
    );
    expect(context.modelInput.constraintSignals).toEqual([
      "preserve_liquidity",
      "keep_monthly_rhythm",
    ]);
    expect(JSON.stringify(context.modelInput)).not.toMatch(
      /monthlyIncome|monthlySavings|constraintNote|KRW|USD|만원|달러/i,
    );
  });

  it("does not accept client-supplied amounts or internal fields", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      profile: {
        ...request.profile,
        monthlyIncome: 6_500_000,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("requires an explicit current level", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      profile: {
        incomeExecutionRatio: request.profile.incomeExecutionRatio,
        assetPercentileBand: request.profile.assetPercentileBand,
        debtServiceRatio: request.profile.debtServiceRatio,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects likely contact data before planning", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      constraintNote: "연락처는 010-1234-5678입니다.",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects likely account data before planning", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      constraintNote: "은행 계좌는 123-456789-01234입니다.",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects currency amounts in the optional note", () => {
    for (const constraintNote of [
      "월 650만원을 저축하고 싶어요.",
      "월 650만 원을 저축하고 싶어요.",
      "자산은 5억 정도예요.",
      "월 육백오십만원을 저축하고 싶어요.",
      "KRW 6500000을 저축하고 싶어요.",
      "6500000 KRW를 저축하고 싶어요.",
    ]) {
      const parsed = planRequestSchema.safeParse({
        ...request,
        constraintNote,
      });

      expect(parsed.success).toBe(false);
    }
  });

  it("does not confuse ordinary Korean words with monetary amounts", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      constraintNote: "공원 근처로 이사하고 싶어요.",
    });

    expect(parsed.success).toBe(true);
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
    const parsed = planRequestSchema.safeParse({
      ...request,
      profile: {
        ...request.profile,
        incomeExecutionRatio: 20,
        debtServiceRatio: 21,
      },
    });

    expect(parsed.success).toBe(false);
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

    expect(context.modelInput.profileSignals.executionPace).toBe(
      "accelerated",
    );
    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "review_long_term_structure",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);
  });

  it("builds a real next-step plan for every asset level", () => {
    for (const currentLevel of ASSET_LEVELS) {
      const context = createPlanningContext({
        ...request,
        profile: { ...request.profile, currentLevel },
        constraintNote: "",
      });
      const actionIds = context.fallback.actions.map((action) => action.id);
      const primaryActionId = levelTransitionFor(currentLevel).actionPriority[0];

      expect(context.fallback.nextLevel).toBe(nextAssetLevel(currentLevel));
      expect(actionIds).toContain(primaryActionId);
      expect(actionIds.at(-1)).toBe("schedule_monthly_checkin");
      expect(Object.keys(context.fallback)).toEqual([
        "nextLevel",
        "actions",
        "progress",
      ]);
    }
  });

  it("keeps L7 active with a maintenance audit instead of inventing L8", () => {
    const context = createPlanningContext({
      ...request,
      profile: { ...request.profile, currentLevel: "L7" },
      constraintNote: "",
    });

    expect(context.fallback.nextLevel).toBe("L7");
    expect(context.fallback.actions[0]?.id).toBe("audit_plan_drift");
  });

  it("applies constraints before the level action and keeps check-in last", () => {
    const context = createPlanningContext({
      ...request,
      profile: { ...request.profile, currentLevel: "L3" },
      constraintNote: "소득 감소가 있어 실행 범위를 다시 정하고 싶어요.",
    });

    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "review_income_change",
      "confirm_debt_payment_calendar",
      "schedule_monthly_checkin",
    ]);
  });

  it("does not let another level's model candidate replace the transition action", () => {
    const context = createPlanningContext({
      ...request,
      profile: { ...request.profile, currentLevel: "L2" },
      constraintNote: "",
    });
    const plan = mergeModelSelection(context, {
      actionIds: [
        "audit_plan_drift",
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
      profile: { ...request.profile, currentLevel: "L2" },
      constraintNote: "",
    });
    const fallbackActionIds = context.fallback.actions.map(
      (action) => action.id,
    );
    const plan = mergeModelSelection(context, {
      actionIds: [
        "seek_professional_review",
        "review_debt_schedule",
        "review_cash_buffer",
      ],
    });

    expect(fallbackActionIds).toEqual([
      "set_cash_safety_rule",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);
    expect(plan.actions.map((action) => action.id)).toEqual([
      "set_cash_safety_rule",
      "review_debt_schedule",
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
