import { describe, expect, it } from "vitest";

import { projectPublicPlan } from "./public-plan";
import {
  migrateLegacyPlan,
  parseStoredPlan,
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
      actionIds,
      new Set(["review_cash_buffer"] as const),
    );
    const raw = serializeStoredPlan("2026-07", plan);

    expect(parseStoredPlan(raw, "2026-07")).toEqual(plan);
    expect(JSON.parse(raw)).not.toHaveProperty("profile");
  });

  it("keeps actions but resets completion in a new month", () => {
    const plan = projectPublicPlan(
      actionIds,
      new Set(["review_cash_buffer", "confirm_monthly_limit"] as const),
    );
    const restored = parseStoredPlan(
      serializeStoredPlan("2026-06", plan),
      "2026-07",
    );

    expect(restored?.progress).toBe(0);
    expect(restored?.actions.every((action) => !action.completed)).toBe(true);
  });

  it("rejects stored records that smuggle old profile data", () => {
    const plan = projectPublicPlan(actionIds);
    const raw = JSON.stringify({
      version: 2,
      monthKey: "2026-07",
      plan,
      profile: { monthlyIncome: 6_500_000 },
    });

    expect(parseStoredPlan(raw, "2026-07")).toBeNull();
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
