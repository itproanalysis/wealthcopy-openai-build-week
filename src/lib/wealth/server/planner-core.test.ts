import { describe, expect, it } from "vitest";

import {
  createPlanningContext,
  mergeModelSelection,
  planRequestSchema,
} from "./planner-core";

const request = {
  profile: {
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
      "review_cash_buffer",
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
      "confirm_monthly_limit",
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
    });

    expect(plan.actions).toHaveLength(3);
    expect(plan.actions.map((action) => action.id)).toContain(
      "review_cash_buffer",
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
