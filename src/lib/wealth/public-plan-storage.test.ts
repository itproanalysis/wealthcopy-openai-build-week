import { describe, expect, it } from "vitest";

import { projectPublicPlan } from "./public-plan";
import {
  parseStoredPlan,
  restoreStoredPlan,
  serializeStoredPlan,
} from "./public-plan-storage";

const actionIds = [
  "review_cash_buffer",
  "confirm_monthly_limit",
  "schedule_monthly_checkin",
] as const;

describe("public plan storage v4", () => {
  it("restores only the strict current-month public plan contract", () => {
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
      version: 4,
    });
  });

  it("rejects source and target levels that do not form one step", () => {
    const mismatchedPlan = projectPublicPlan("L7", actionIds);
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan: mismatchedPlan,
      sourceLevel: "L2",
      version: 4,
    });

    expect(restoreStoredPlan(raw, "2026-07")).toBeNull();
    expect(() =>
      serializeStoredPlan("2026-07", "L2", mismatchedPlan),
    ).toThrow();
  });

  it("keeps L14 to L15 distinct from L15 maintenance", () => {
    const ascent = projectPublicPlan("L15", actionIds);
    const maintenance = projectPublicPlan("L15", actionIds);

    expect(
      restoreStoredPlan(
        serializeStoredPlan("2026-07", "L14", ascent),
        "2026-07",
      )?.sourceLevel,
    ).toBe("L14");
    expect(
      restoreStoredPlan(
        serializeStoredPlan("2026-07", "L15", maintenance),
        "2026-07",
      )?.sourceLevel,
    ).toBe("L15");
  });

  it("flags every prior-month plan for a fresh asset snapshot", () => {
    const plan = projectPublicPlan(
      "L5",
      actionIds,
      new Set(["review_cash_buffer", "confirm_monthly_limit"] as const),
    );
    const restored = restoreStoredPlan(
      serializeStoredPlan("2026-06", "L4", plan),
      "2026-07",
    );

    expect(restored?.rolledOver).toBe(true);
    expect(restored?.previousMonthCompleted).toBe(false);
    expect(restored?.plan.progress).toBe(0);
    expect(
      parseStoredPlan(
        serializeStoredPlan("2026-06", "L4", plan),
        "2026-07",
      ),
    ).toBeNull();
    expect(restored?.plan.actions.every((action) => !action.completed)).toBe(
      true,
    );
  });

  it("remembers whether the prior month was completed without promoting", () => {
    const plan = projectPublicPlan("L4", actionIds, new Set(actionIds));
    const restored = restoreStoredPlan(
      serializeStoredPlan("2026-06", "L3", plan),
      "2026-07",
    );

    expect(restored?.rolledOver).toBe(true);
    expect(restored?.previousMonthCompleted).toBe(true);
    expect(restored?.sourceLevel).toBe("L3");
    expect(restored?.plan.nextLevel).toBe("L4");
    expect(restored?.plan.progress).toBe(0);
  });

  it("rejects all pre-v4 journey semantics", () => {
    for (const version of [2, 3]) {
      const raw = JSON.stringify({
        monthKey: "2026-07",
        plan: projectPublicPlan("L7", actionIds),
        sourceLevel: "L6",
        version,
      });

      expect(restoreStoredPlan(raw, "2026-07")).toBeNull();
    }

    expect(
      restoreStoredPlan(
        JSON.stringify({ taskState: [{ id: "cash-buffer", done: true }] }),
        "2026-07",
      ),
    ).toBeNull();
  });

  it("rejects records that smuggle profile or exact amount data", () => {
    const plan = projectPublicPlan("L7", actionIds);
    const raw = JSON.stringify({
      monthKey: "2026-07",
      plan,
      profile: {
        totalAssetsKrw: 450_000_000,
        totalDebtKrw: 50_000_000,
      },
      sourceLevel: "L6",
      version: 4,
    });

    expect(parseStoredPlan(raw, "2026-07")).toBeNull();
    expect(restoreStoredPlan(raw, "2026-07")).toBeNull();
  });
});
