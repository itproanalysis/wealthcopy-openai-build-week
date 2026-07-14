import { describe, expect, it } from "vitest";

import {
  createPlanningContext,
  mergeModelSelection,
  planRequestSchema,
} from "./planner-core";

const request = {
  profile: {
    monthlyIncome: 6_500_000,
    monthlySavings: 3_100_000,
    debtRatio: 18,
    emergencyFundMonths: 5,
  },
  constraintNote: "내년에 이사 계획이 있어 현금 여유를 유지하고 싶어요.",
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
};

describe("private planning boundary", () => {
  it("keeps raw amounts and internal path analysis out of the model input", () => {
    const context = createPlanningContext(request);

    expect(context.modelInput.profileSignals).toEqual({
      capacity: "strong",
      debt: "medium",
      emergencyFund: "ready",
      executionPace: "steady",
    });
    expect(context.modelInput).not.toHaveProperty("monthlyIncome");
    expect(context.modelInput).not.toHaveProperty("monthlySavings");
    expect(context.modelInput).not.toHaveProperty("paths");
  });

  it("does not accept client-supplied internal classification fields", () => {
    const parsed = planRequestSchema.safeParse({
      ...request,
      profile: {
        ...request.profile,
        riskPreference: "fast",
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

  it("uses a deterministic safety plan without a model call", () => {
    const context = createPlanningContext({
      ...request,
      constraintNote: "코인 종목 수익률과 매수 시점을 알려 주세요.",
    });

    expect(context.allowModel).toBe(false);
    expect(context.status).toBe("professional_review");
    expect(context.fallback.actions.map((action) => action.id)).toEqual([
      "seek_professional_review",
      "review_cash_buffer",
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
      constraintSignals: ["review_debt"],
    });

    expect(plan.actions).toHaveLength(3);
    expect(plan.actions.map((action) => action.id)).toContain(
      "review_cash_buffer",
    );
    expect(Object.keys(plan)).toEqual(["nextLevel", "actions", "progress"]);
  });
});
