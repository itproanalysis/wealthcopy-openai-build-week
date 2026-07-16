import { describe, expect, it } from "vitest";

import type { AssetLevel } from "./asset-level";
import type { PublicActionId } from "./public-plan";
import {
  RECENT_ACTION_HISTORY_POLICY_VERSION,
  pruneRecentActionHistory,
  recentCompletionsForPlanner,
  recentCompletionsForPlannerSchema,
  removeMonthFromActionHistory,
  restoreRecentActionHistory,
  serializeRecentActionHistory,
  updateRecentActionHistory,
  type RecentActionCompletion,
} from "./recent-action-history";

const completion = (
  actionId: PublicActionId,
  sourceLevel: AssetLevel,
  completedMonth: string,
): RecentActionCompletion => ({ actionId, sourceLevel, completedMonth });

describe("recent action completion history", () => {
  it("stores only bounded public action, level, and month data", () => {
    const history = updateRecentActionHistory(
      [],
      "set_new_money_guardrail",
      "L7",
      "2026-07",
      true,
    );
    const raw = serializeRecentActionHistory(history);

    expect(JSON.parse(raw)).toEqual({
      version: 1,
      policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
      entries: [
        {
          actionId: "set_new_money_guardrail",
          sourceLevel: "L7",
          completedMonth: "2026-07",
        },
      ],
    });
    expect(raw).not.toMatch(
      /profile|amount|ratio|totalAssets|totalDebt|psid|constraintNote|notes|session/i,
    );
  });

  it("adds and undoes only the selected level and month completion", () => {
    const june = updateRecentActionHistory(
      [],
      "set_concentration_cap",
      "L7",
      "2026-06",
      true,
    );
    const july = updateRecentActionHistory(
      june,
      "set_concentration_cap",
      "L7",
      "2026-07",
      true,
    );
    const anotherLevel = updateRecentActionHistory(
      july,
      "set_concentration_cap",
      "L8",
      "2026-07",
      true,
    );

    expect(
      updateRecentActionHistory(
        anotherLevel,
        "set_concentration_cap",
        "L7",
        "2026-07",
        false,
      ),
    ).toEqual([
      completion("set_concentration_cap", "L7", "2026-06"),
      completion("set_concentration_cap", "L8", "2026-07"),
    ]);
  });

  it("projects only prior 1..11 months and keeps the most recent level/action completion", () => {
    const history = [
      completion("set_concentration_cap", "L7", "2025-07"),
      completion("set_new_money_guardrail", "L7", "2026-06"),
      completion("set_concentration_cap", "L7", "2026-05"),
      completion("set_concentration_cap", "L7", "2026-06"),
      completion("set_concentration_cap", "L8", "2026-06"),
      completion("compare_plan_to_actual", "L7", "2026-07"),
      completion("verify_concentration_rule", "L7", "2026-08"),
    ];

    expect(recentCompletionsForPlanner(history, "2026-07")).toEqual([
      { id: "set_concentration_cap", sourceLevel: "L7", monthsAgo: 1 },
      { id: "set_new_money_guardrail", sourceLevel: "L7", monthsAgo: 1 },
      { id: "set_concentration_cap", sourceLevel: "L8", monthsAgo: 1 },
    ]);
  });

  it("removes current-month records without deleting earlier history", () => {
    const history = [
      completion("set_new_money_guardrail", "L7", "2026-06"),
      completion("set_concentration_cap", "L7", "2026-07"),
      completion("compare_plan_to_actual", "L8", "2026-07"),
    ];

    expect(removeMonthFromActionHistory(history, "2026-07")).toEqual([
      history[0],
    ]);
  });

  it("rejects malformed, duplicate, over-limit, stale-policy, and smuggled records", () => {
    const duplicate = completion("set_concentration_cap", "L7", "2026-07");
    const overLimit = Array.from({ length: 37 }, (_, index) =>
      completion(
        index % 2 === 0
          ? "set_concentration_cap"
          : "compare_plan_to_actual",
        `L${(index % 15) + 1}` as AssetLevel,
        `2026-${String((index % 12) + 1).padStart(2, "0")}`,
      ),
    );
    const malformed = [
      "not-json",
      JSON.stringify({
        version: 1,
        policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
        entries: [{ actionId: "invented", sourceLevel: "L7", completedMonth: "2026-07" }],
      }),
      JSON.stringify({
        version: 1,
        policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
        entries: [duplicate, duplicate],
      }),
      JSON.stringify({
        version: 1,
        policyVersion: "behavior-policy-v1",
        entries: [],
      }),
      JSON.stringify({
        version: 1,
        policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
        entries: [],
        profile: { totalAssetsKrw: 1_000_000_000 },
      }),
      JSON.stringify({
        version: 1,
        policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
        entries: overLimit,
      }),
    ];

    for (const raw of malformed) {
      expect(restoreRecentActionHistory(raw)).toEqual([]);
    }
  });

  it("prunes records older than twelve months and caps updates at 36", () => {
    const recent36 = Array.from({ length: 36 }, (_, index) =>
      completion(
        [
          "set_new_money_guardrail",
          "set_concentration_cap",
          "compare_plan_to_actual",
        ][index % 3] as PublicActionId,
        "L7",
        `2026-${String(Math.floor(index / 3) + 1).padStart(2, "0")}`,
      ),
    );
    const updated = updateRecentActionHistory(
      [completion("complete_asset_snapshot", "L7", "2025-12"), ...recent36],
      "verify_concentration_rule",
      "L7",
      "2026-12",
      true,
    );

    expect(updated).toHaveLength(36);
    expect(updated).not.toContainEqual(
      completion("complete_asset_snapshot", "L7", "2025-12"),
    );
    expect(updated).toContainEqual(
      completion("verify_concentration_rule", "L7", "2026-12"),
    );
    expect(() => serializeRecentActionHistory(updated)).not.toThrow();
  });

  it("explicitly prunes restored stale, future, duplicate, and invalid entries", () => {
    const validCurrent = completion(
      "set_concentration_cap",
      "L7",
      "2026-07",
    );
    const validOldest = completion(
      "compare_plan_to_actual",
      "L7",
      "2025-08",
    );
    const pruned = pruneRecentActionHistory(
      [
        completion("complete_asset_snapshot", "L7", "2025-07"),
        validOldest,
        validCurrent,
        validCurrent,
        completion("verify_concentration_rule", "L7", "2026-08"),
        { ...validCurrent, completedMonth: "2026-13" },
        { ...validCurrent, actionId: "invented" },
        { ...validCurrent, profile: { totalAssetsKrw: 500_000_000 } },
      ],
      "2026-07",
    );

    expect(pruned).toEqual([validOldest, validCurrent]);
  });

  it("caps an explicitly pruned restored history at the newest 36 entries", () => {
    const actionIds = [
      "set_concentration_cap",
      "compare_plan_to_actual",
      "verify_concentration_rule",
    ] as const;
    const entries = Array.from({ length: 37 }, (_, index) =>
      completion(
        actionIds[Math.floor(index / 15)] ?? "verify_asset_mix_total",
        `L${(index % 15) + 1}` as AssetLevel,
        `2026-${String((index % 7) + 1).padStart(2, "0")}`,
      ),
    );

    const pruned = pruneRecentActionHistory(entries, "2026-07");

    expect(pruned).toHaveLength(36);
    expect(pruned).toEqual(
      [...pruned].sort(
        (left, right) =>
          left.completedMonth.localeCompare(right.completedMonth) ||
          left.sourceLevel.localeCompare(right.sourceLevel) ||
          left.actionId.localeCompare(right.actionId),
      ),
    );
  });

  it("rejects duplicate, extra-field, and invalid-age planner entries", () => {
    const valid = {
      id: "set_concentration_cap" as const,
      sourceLevel: "L7" as const,
      monthsAgo: 1,
    };

    expect(recentCompletionsForPlannerSchema.safeParse([valid]).success).toBe(
      true,
    );
    expect(
      recentCompletionsForPlannerSchema.safeParse([valid, valid]).success,
    ).toBe(false);
    expect(
      recentCompletionsForPlannerSchema.safeParse([
        { ...valid, totalAssetsKrw: 500_000_000 },
      ]).success,
    ).toBe(false);
    expect(
      recentCompletionsForPlannerSchema.safeParse([
        { ...valid, monthsAgo: 0 },
      ]).success,
    ).toBe(false);
  });
});
