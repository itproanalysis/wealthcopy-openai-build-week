import { describe, expect, it } from "vitest";

import { projectPublicPlan } from "./public-plan";
import {
  migrateLegacyPlan,
  migrateStoredPlanV2,
  parseStoredPlan,
  restoreStoredPlan,
  serializeStoredPlan,
} from "./public-plan-storage";

const actionIds = [
  "review_cash_buffer",
  "confirm_monthly_limit",
  "schedule_monthly_checkin",
] as const;

describe("public plan storage", () => {
  it("restores only a strict current-month public plan", () => {
    const plan = projectPublicPlan(
      "L3",
      actionIds,
      new Set(["review_cash_buffer"] as const),
    );
    const raw = serializeStoredPlan("2026-07", "L2", plan);
    const restored = restoreStoredPlan(raw, "2026-07");

    expect(parseStoredPlan(raw, "2026-07")).toEqual(plan);
    expect(restored).toEqual({
      plan,
      previousMonthCompleted: false,
      rolledOver: false,
      sourceLevel: "L2",
    });
    expect(Object.keys(JSON.parse(raw))).toEqual([
      "monthKey",
      "plan",
      "sourceLevel",
      "version",
    ]);
    expect(JSON.parse(raw)).toMatchObject({
      monthKey: "2026-07",
      sourceLevel: "L2",
      version: 3,
    });
  });

  it("rejects source and target levels that do not form one journey step", () => {
    const mismatchedPlan = projectPublicPlan("L7", actionIds);
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan: mismatchedPlan,
      sourceLevel: "L2",
      version: 3,
    });

    expect(restoreStoredPlan(raw, "2026-07")).toBeNull();
    expect(() =>
      serializeStoredPlan("2026-07", "L2", mismatchedPlan),
    ).toThrow();
  });

  it("signals a completed prior target instead of silently repeating it", () => {
    const completedPlan = projectPublicPlan(
      "L4",
      actionIds,
      new Set(actionIds),
    );
    const restored = restoreStoredPlan(
      serializeStoredPlan("2026-06", "L3", completedPlan),
      "2026-07",
    );

    expect(restored?.rolledOver).toBe(true);
    expect(restored?.previousMonthCompleted).toBe(true);
    expect(restored?.sourceLevel).toBe("L3");
    expect(restored?.plan.nextLevel).toBe("L4");
    expect(restored?.plan.progress).toBe(0);
  });

  it("keeps actions but resets completion in a new month", () => {
    const plan = projectPublicPlan(
      "L5",
      actionIds,
      new Set(["review_cash_buffer", "confirm_monthly_limit"] as const),
    );
    const restored = parseStoredPlan(
      serializeStoredPlan("2026-06", "L4", plan),
      "2026-07",
    );

    expect(restored?.progress).toBe(0);
    expect(restored?.actions.every((action) => !action.completed)).toBe(true);
    expect(
      restoreStoredPlan(
        serializeStoredPlan("2026-06", "L4", plan),
        "2026-07",
      )?.rolledOver,
    ).toBe(true);
  });

  it("migrates a strict v2 fixed-L7 plan with its historical L6 source", () => {
    const plan = projectPublicPlan(
      "L7",
      actionIds,
      new Set(["review_cash_buffer"] as const),
    );
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan,
      version: 2,
    });

    expect(migrateStoredPlanV2(raw, "2026-07")).toEqual({
      plan,
      previousMonthCompleted: false,
      rolledOver: false,
      sourceLevel: "L6",
    });
  });

  it("preserves prior-month completion signaling while migrating v2", () => {
    const plan = projectPublicPlan("L7", actionIds, new Set(actionIds));
    const raw = JSON.stringify({
      monthKey: "2026-06",
      plan,
      version: 2,
    });

    const migrated = migrateStoredPlanV2(raw, "2026-07");

    expect(migrated?.sourceLevel).toBe("L6");
    expect(migrated?.rolledOver).toBe(true);
    expect(migrated?.previousMonthCompleted).toBe(true);
    expect(migrated?.plan.progress).toBe(0);
  });

  it("rejects a v2 record that does not use its historical fixed L7 target", () => {
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan: projectPublicPlan("L4", actionIds),
      version: 2,
    });

    expect(migrateStoredPlanV2(raw, "2026-07")).toBeNull();
  });

  it("rejects stored records that smuggle old profile data", () => {
    const plan = projectPublicPlan("L7", actionIds);
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan,
      profile: { monthlyIncome: 6_500_000 },
      sourceLevel: "L6",
      version: 3,
    });
    const v2Raw = JSON.stringify({
      monthKey: "2026-07",
      plan,
      profile: { monthlyIncome: 6_500_000 },
      version: 2,
    });

    expect(parseStoredPlan(raw, "2026-07")).toBeNull();
    expect(restoreStoredPlan(raw, "2026-07")).toBeNull();
    expect(migrateStoredPlanV2(v2Raw, "2026-07")).toBeNull();
  });

  it("migrates legacy completion without retaining legacy inputs", () => {
    const migrated = migrateLegacyPlan(
      JSON.stringify({
        profile: { monthlyIncome: 6_500_000 },
        taskState: [
          { id: "cash-buffer", done: true },
          { id: "debt-review", done: true },
          { id: "commitment", done: true },
          { id: "monthly-checkin", done: false },
        ],
      }),
    );

    expect(migrated?.progress).toBe(67);
    expect(Object.keys(migrated ?? {})).toEqual([
      "nextLevel",
      "actions",
      "progress",
    ]);
  });
});
