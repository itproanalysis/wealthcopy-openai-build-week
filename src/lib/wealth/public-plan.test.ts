import { describe, expect, it } from "vitest";

import {
  carryCompletedActions,
  projectPublicPlan,
  publicPlanSchema,
  recalculatePublicPlan,
  type PublicActionId,
} from "./public-plan";

describe("public plan contract", () => {
  it("exposes only the next level, three actions, and progress", () => {
    const plan = projectPublicPlan([
      "review_cash_buffer",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);

    expect(Object.keys(plan)).toEqual(["nextLevel", "actions", "progress"]);
    expect(plan.actions).toHaveLength(3);
    expect(plan.actions.every((action) =>
      Object.keys(action).join(",") === "id,completed",
    )).toBe(true);
  });

  it("derives progress only from completed actions", () => {
    const completedIds = new Set<PublicActionId>(["review_cash_buffer"]);
    const plan = projectPublicPlan(
      [
        "review_cash_buffer",
        "confirm_monthly_limit",
        "schedule_monthly_checkin",
      ],
      completedIds,
    );

    expect(plan.progress).toBe(33);
    expect(
      recalculatePublicPlan({
        ...plan,
        actions: plan.actions.map((action) => ({
          ...action,
          completed: true,
        })),
        progress: 33,
      } as typeof plan).progress,
    ).toBe(100);
  });

  it("rejects duplicate actions, extra fields, and invented progress", () => {
    const invalid = {
      nextLevel: "L7",
      actions: [
        { id: "review_cash_buffer", completed: false },
        { id: "review_cash_buffer", completed: false },
        { id: "schedule_monthly_checkin", completed: false },
      ],
      progress: 42,
      model: "hidden",
    };

    expect(publicPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("keeps completion only for actions shared with a regenerated plan", () => {
    const previous = projectPublicPlan(
      [
        "review_cash_buffer",
        "review_debt_schedule",
        "schedule_monthly_checkin",
      ],
      new Set<PublicActionId>([
        "review_cash_buffer",
        "review_debt_schedule",
      ]),
    );

    const next = carryCompletedActions(previous, [
      "review_cash_buffer",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ]);

    expect(next.progress).toBe(33);
    expect(next.actions.map((action) => action.completed)).toEqual([
      true,
      false,
      false,
    ]);
  });
});
