import { describe, expect, it } from "vitest";

import {
  carryCompletedActions,
  projectPublicPlan,
  publicPlanSchema,
  recalculatePublicPlan,
  type PublicActionId,
} from "./public-plan";

const actionIds = [
  "build_cash_runway_rule",
  "separate_cash_roles",
  "verify_cashflow_balance",
] as const satisfies readonly PublicActionId[];

describe("public plan contract", () => {
  it("exposes only the next level, three actions, and progress", () => {
    const plan = projectPublicPlan("L2", actionIds);

    expect(Object.keys(plan)).toEqual(["nextLevel", "actions", "progress"]);
    expect(plan.actions).toHaveLength(3);
    expect(
      plan.actions.every(
        (action) => Object.keys(action).join(",") === "id,completed",
      ),
    ).toBe(true);
  });

  it("derives only 0, 33, 67, and 100 from completed actions", () => {
    const expected = [0, 33, 67, 100] as const;

    expected.forEach((progress, completedCount) => {
      const completedIds = new Set<PublicActionId>(
        actionIds.slice(0, completedCount),
      );
      expect(projectPublicPlan("L4", actionIds, completedIds).progress).toBe(
        progress,
      );
    });

    const plan = projectPublicPlan("L4", actionIds);
    const recalculated = recalculatePublicPlan({
      ...plan,
      actions: plan.actions.map((action) => ({
        ...action,
        completed: true,
      })),
      progress: 0,
    } as typeof plan);

    expect(recalculated.progress).toBe(100);
    expect(recalculated.nextLevel).toBe("L4");
  });

  it("rejects duplicate actions, extra fields, and invented progress", () => {
    expect(
      publicPlanSchema.safeParse({
        nextLevel: "L7",
        actions: [
          { id: "complete_asset_snapshot", completed: false },
          { id: "complete_asset_snapshot", completed: false },
          { id: "verify_asset_mix_total", completed: false },
        ],
        progress: 0,
      }).success,
    ).toBe(false);

    expect(
      publicPlanSchema.safeParse({
        nextLevel: "L7",
        actions: actionIds.map((id) => ({ id, completed: false })),
        progress: 0,
        model: "hidden",
      }).success,
    ).toBe(false);

    expect(
      publicPlanSchema.safeParse({
        nextLevel: "L7",
        actions: actionIds.map((id) => ({ id, completed: false })),
        progress: 67,
      }).success,
    ).toBe(false);
  });

  it("does not reserve the third position for a fixed action", () => {
    const plans = [
      [
        "build_cash_runway_rule",
        "separate_cash_roles",
        "verify_cashflow_balance",
      ],
      [
        "verify_cashflow_balance",
        "build_cash_runway_rule",
        "separate_cash_roles",
      ],
      [
        "verify_cashflow_balance",
        "separate_cash_roles",
        "build_cash_runway_rule",
      ],
    ] as const satisfies readonly (readonly [
      PublicActionId,
      PublicActionId,
      PublicActionId,
    ])[];

    for (const actions of plans) {
      expect(
        publicPlanSchema.safeParse({
          nextLevel: "L5",
          actions: actions.map((id) => ({ id, completed: false })),
          progress: 0,
        }).success,
      ).toBe(true);
    }
  });

  it("keeps completion only for actions shared with a regenerated plan", () => {
    const previous = projectPublicPlan(
      "L7",
      [
        "complete_asset_snapshot",
        "align_valuation_dates",
        "verify_valuation_freshness",
      ],
      new Set<PublicActionId>([
        "complete_asset_snapshot",
        "align_valuation_dates",
      ]),
    );

    const next = carryCompletedActions(previous, "L7", [
      "complete_asset_snapshot",
      "align_valuation_dates",
      "verify_asset_mix_total",
    ]);

    expect(next.progress).toBe(67);
    expect(next.actions.map((action) => action.completed)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("does not carry completion into a different next level", () => {
    const previous = projectPublicPlan(
      "L3",
      [
        "build_cash_runway_rule",
        "separate_cash_roles",
        "verify_cashflow_balance",
      ],
      new Set<PublicActionId>(["build_cash_runway_rule"]),
    );

    const next = carryCompletedActions(previous, "L4", [
      "rank_debt_review_priority",
      "start_core_auto_execution",
      "verify_payment_coverage",
    ]);

    expect(next.progress).toBe(0);
    expect(next.actions.every((action) => !action.completed)).toBe(true);
  });
});
