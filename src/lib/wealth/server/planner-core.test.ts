import { describe, expect, it } from "vitest";

import { ASSET_LEVELS, nextAssetLevel, type AssetLevel } from "../asset-level";
import { levelTransitionFor } from "../level-transitions";
import { PUBLIC_ACTION_COPY } from "../public-plan";
import {
  createPlanningContext,
  mergeModelSelection,
  OPERATE_ACTION_BY_LEVEL,
  planRequestSchema,
  type PlanRequest,
} from "./planner-core";

const request: PlanRequest = {
  profile: {
    totalAssetsKrw: 450_000_000,
    totalDebtKrw: 50_000_000,
    incomeExecutionRatio: 48,
    assetPercentileBand: "p50_74" as const,
    debtServiceRatio: 18,
    cashRunwayBand: "six_to_twelve" as const,
    incomeStability: "stable" as const,
    largestAssetGroup: "mixed" as const,
    concentrationBand: "p30_50" as const,
    debtRisk: "none" as const,
    next90DayEvent: "none" as const,
  },
  constraintNote: "",
  recentCompletions: [],
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

function withProfile(
  patch: Partial<PlanRequest["profile"]>,
  constraintNote = "",
): PlanRequest {
  return {
    ...request,
    profile: { ...request.profile, ...patch },
    constraintNote,
  };
}

function actionIds(context: ReturnType<typeof createPlanningContext>) {
  return context.fallback.actions.map((action) => action.id);
}

describe("private planning boundary", () => {
  it("derives the level privately and sends only coarse non-PSID signals to the model", () => {
    const context = createPlanningContext(request);

    expect(context.sourceLevel).toBe("L6");
    expect(context.nextLevel).toBe("L7");
    expect(context.modelInput.profileSignals).toMatchObject({
      debtBurden: "manageable",
      freeSavingsCapacity: "strong",
      incomeExecution: "strong",
      leverage: "low",
      pathFocus: "core_building",
    });
    expect(context.modelInput.allowedSupportActions.length).toBeGreaterThan(0);
    expect(context.modelAllowedActionIds).toEqual(["set_new_money_guardrail"]);
    expect(actionIds(context)[0]).toBe("set_new_money_guardrail");

    const serializedModelInput = JSON.stringify(context.modelInput);
    expect(serializedModelInput).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|netWorth|currentLevel|nextLevel|assetPercentile|PSID|KRW|USD/i,
    );
    expect(serializedModelInput).not.toContain("450000000");
    expect(serializedModelInput).not.toContain("50000000");
    expect(JSON.stringify(context)).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|450000000|50000000/,
    );
  });

  it("keeps the public plan contract to target, three IDs, and progress", () => {
    const plan = createPlanningContext(request).fallback;

    expect(Object.keys(plan)).toEqual(["nextLevel", "actions", "progress"]);
    expect(plan.actions).toHaveLength(3);
    expect(
      plan.actions.every(
        (action) => Object.keys(action).join(",") === "id,completed",
      ),
    ).toBe(true);
  });

  it("accepts the aggregate snapshot but rejects client levels and account fields", () => {
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

  it("defaults optional structure signals but treats missing evidence as a snapshot task", () => {
    const parsed = planRequestSchema.parse({
      ...request,
      profile: {
        totalAssetsKrw: request.profile.totalAssetsKrw,
        totalDebtKrw: request.profile.totalDebtKrw,
        incomeExecutionRatio: request.profile.incomeExecutionRatio,
        debtServiceRatio: request.profile.debtServiceRatio,
      },
    });
    const context = createPlanningContext(parsed);

    expect(parsed.profile.assetPercentileBand).toBe("unknown");
    expect(parsed.profile.largestAssetGroup).toBe("unknown");
    expect(actionIds(context)[0]).toBe("complete_asset_snapshot");
    expect(context.allowModel).toBe(false);
  });

  it("rejects personal identifiers and currency amounts in the optional note", () => {
    for (const constraintNote of [
      "연락처는 010-1234-5678입니다.",
      "은행 계좌는 123-456789-01234입니다.",
      "월 650만원을 저축하고 싶어요.",
      "KRW 6500000을 저축하고 싶어요.",
    ]) {
      expect(
        planRequestSchema.safeParse({ ...request, constraintNote }).success,
      ).toBe(false);
    }
    expect(
      planRequestSchema.safeParse({
        ...request,
        constraintNote: "공원 근처로 이사하고 싶어요.",
      }).success,
    ).toBe(true);
  });

  it("rejects debt service above the combined execution ratio", () => {
    expect(
      planRequestSchema.safeParse(
        withProfile({ incomeExecutionRatio: 20, debtServiceRatio: 21 }),
      ).success,
    ).toBe(false);
  });

  it("accepts only strict, bounded, unique recent-completion signals", () => {
    const valid = {
      id: "set_concentration_cap",
      sourceLevel: "L7",
      monthsAgo: 1,
    } as const;
    const validMaximum = Array.from({ length: 36 }, (_, index) => ({
      id: [
        "set_concentration_cap",
        "compare_plan_to_actual",
        "verify_concentration_rule",
      ][Math.floor(index / 15)],
      sourceLevel: `L${(index % 15) + 1}`,
      monthsAgo: (index % 11) + 1,
    }));
    const attempts = [
      [{ ...valid, id: "invented" }],
      [{ ...valid, sourceLevel: "L16" }],
      [{ ...valid, monthsAgo: 0 }],
      [{ ...valid, totalAssetsKrw: 825_000_000 }],
      [{ ...valid, incomeExecutionRatio: 35 }],
      [{ ...valid, assetPercentileBand: "p90_plus" }],
      [{ ...valid, constraintNote: "숨긴 메모" }],
      [valid, { ...valid, monthsAgo: 2 }],
      [...validMaximum, {
        id: "verify_asset_mix_total",
        sourceLevel: "L15",
        monthsAgo: 1,
      }],
    ];

    expect(
      planRequestSchema.safeParse({
        ...request,
        recentCompletions: [valid],
      }).success,
    ).toBe(true);
    expect(
      planRequestSchema.safeParse({
        ...request,
        recentCompletions: validMaximum,
      }).success,
    ).toBe(true);
    for (const recentCompletions of attempts) {
      expect(
        planRequestSchema.safeParse({ ...request, recentCompletions }).success,
      ).toBe(false);
    }
  });
});

describe("protect, advance, and verify action policy", () => {
  it.each([
    [
      "cash runway",
      { cashRunwayBand: "under_1" as const },
      "build_cash_runway_rule",
    ],
    [
      "high debt service",
      { incomeExecutionRatio: 55, debtServiceRatio: 45 },
      "rank_debt_review_priority",
    ],
    [
      "income change",
      { incomeStability: "changing" as const },
      "prepare_income_change_plan",
    ],
    [
      "variable income",
      { incomeStability: "variable" as const },
      "prepare_income_change_plan",
    ],
    [
      "near debt maturity",
      { next90DayEvent: "debt_maturity" as const },
      "calendar_30_60_90_maturities",
    ],
    [
      "high concentration",
      { concentrationBand: "p70_plus" as const },
      "pause_dominant_bucket_additions",
    ],
  ])("puts the %s hard gate first", (_name, patch, expected) => {
    const context = createPlanningContext(withProfile(patch));

    expect(actionIds(context)[0]).toBe(expected);
    expect(context.allowModel).toBe(false);
    expect(context.mandatoryActionIds).toContain(expected);
  });

  it("uses deterministic professional review for transaction requests", () => {
    const context = createPlanningContext({
      ...request,
      constraintNote: "코인 종목 매수 시점을 알려 주세요.",
    });

    expect(context.status).toBe("professional_review");
    expect(context.allowModel).toBe(false);
    expect(actionIds(context)[0]).toBe("seek_professional_review");
  });

  it("changes the bottleneck action within one level without changing its anchor", () => {
    const cash = createPlanningContext(
      withProfile({ cashRunwayBand: "under_1" }),
    );
    const concentration = createPlanningContext(
      withProfile({ concentrationBand: "p70_plus" }),
    );

    expect(actionIds(cash)[0]).not.toBe(actionIds(concentration)[0]);
    expect(actionIds(cash).slice(1)).toEqual(actionIds(concentration).slice(1));
  });

  it("gives a healthy L7 household three distinct, usable artifacts", () => {
    const context = createPlanningContext(
      withProfile({
        totalAssetsKrw: 825_000_000,
        totalDebtKrw: 220_000_000,
        incomeExecutionRatio: 35,
        debtServiceRatio: 15,
        cashRunwayBand: "six_to_twelve",
        incomeStability: "stable",
        largestAssetGroup: "mixed",
        concentrationBand: "p30_50",
        debtRisk: "none",
        next90DayEvent: "none",
      }),
    );

    expect(context.sourceLevel).toBe("L7");
    expect(context.nextLevel).toBe("L8");
    expect(context.allowModel).toBe(false);
    expect(context.modelAllowedActionIds).toEqual(["set_new_money_guardrail"]);
    expect(actionIds(context)).toEqual([
      "set_new_money_guardrail",
      "set_concentration_cap",
      "compare_plan_to_actual",
    ]);
  });

  it("does not prescribe a cash-runway task when healthy cash runway is already known", () => {
    const context = createPlanningContext(
      withProfile({
        largestAssetGroup: "cash",
        cashRunwayBand: "twelve_plus",
      }),
    );

    expect(context.modelAllowedActionIds).toEqual(["set_new_money_guardrail"]);
    expect(actionIds(context)[0]).toBe("set_new_money_guardrail");
  });

  it("does not create an empty maturity calendar for property without a near-term event", () => {
    const context = createPlanningContext(
      withProfile({
        largestAssetGroup: "property",
        next90DayEvent: "none",
        debtRisk: "none",
      }),
    );

    expect(context.modelAllowedActionIds).not.toContain(
      "calendar_30_60_90_maturities",
    );
    expect(actionIds(context)[0]).toBe("map_property_liquidity_dates");
  });

  it("keeps PSID reference bands out of level, path, model input, and actions", () => {
    const bands = [
      "below_25",
      "p25_49",
      "p50_74",
      "p75_89",
      "p90_plus",
      "unknown",
    ] as const;
    const contexts = bands.map((assetPercentileBand) =>
      createPlanningContext(withProfile({ assetPercentileBand })),
    );
    const baseline = contexts[0];

    for (const context of contexts.slice(1)) {
      expect(context.sourceLevel).toBe(baseline.sourceLevel);
      expect(context.modelInput).toEqual(baseline.modelInput);
      expect(context.fallback).toEqual(baseline.fallback);
    }
  });

  it("builds ordered protect, advance, verify actions for all 15 levels", () => {
    expect(levelInputs.map(([level]) => level)).toEqual(ASSET_LEVELS);

    for (const [expectedLevel, totalAssetsKrw, totalDebtKrw] of levelInputs) {
      const context = createPlanningContext(
        withProfile({ totalAssetsKrw, totalDebtKrw }),
      );
      const ids = actionIds(context);

      expect(context.sourceLevel).toBe(expectedLevel);
      expect(context.nextLevel).toBe(nextAssetLevel(expectedLevel));
      expect(ids[1]).toBe(levelTransitionFor(expectedLevel).actionPriority[0]);
      expect(PUBLIC_ACTION_COPY[ids[0]].stage).toBe("protect");
      expect(PUBLIC_ACTION_COPY[ids[1]].stage).toBe("advance");
      expect(PUBLIC_ACTION_COPY[ids[2]].stage).toBe("verify");
      expect(new Set(ids).size).toBe(3);
    }
  });

  it("keeps L15 as a governance maintenance route", () => {
    const context = createPlanningContext(
      withProfile({ totalAssetsKrw: 1_000_000_000_000, totalDebtKrw: 0 }),
    );

    expect(context.sourceLevel).toBe("L15");
    expect(context.nextLevel).toBe("L15");
    expect(actionIds(context)[1]).toBe("audit_governance_calendar");
    expect(actionIds(context)[2]).toBe("close_governance_review");
  });

  it("moves every level from its completed setup anchor to one of four explicit operating actions", () => {
    expect(OPERATE_ACTION_BY_LEVEL).toEqual({
      L1: "operate_cashflow_foundation",
      L2: "operate_cashflow_foundation",
      L3: "operate_cashflow_foundation",
      L4: "operate_cashflow_foundation",
      L5: "operate_asset_structure",
      L6: "operate_asset_structure",
      L7: "operate_asset_structure",
      L8: "operate_asset_structure",
      L9: "operate_wealth_policy",
      L10: "operate_wealth_policy",
      L11: "operate_wealth_policy",
      L12: "operate_wealth_policy",
      L13: "operate_governance_cycle",
      L14: "operate_governance_cycle",
      L15: "operate_governance_cycle",
    });

    for (const [expectedLevel, totalAssetsKrw, totalDebtKrw] of levelInputs) {
      const originalAnchor = levelTransitionFor(expectedLevel).actionPriority[0];
      const context = createPlanningContext({
        ...withProfile({ totalAssetsKrw, totalDebtKrw }),
        recentCompletions: [
          {
            id: originalAnchor,
            sourceLevel: expectedLevel,
            monthsAgo: 1,
          },
        ],
      });
      const ids = actionIds(context);

      expect(context.sourceLevel).toBe(expectedLevel);
      expect(ids[1]).toBe(OPERATE_ACTION_BY_LEVEL[expectedLevel]);
      expect(PUBLIC_ACTION_COPY[ids[1]].stage).toBe("advance");
      expect(ids[1]).not.toBe(originalAnchor);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it("ignores completion history from a different server-classified level", () => {
    const context = createPlanningContext({
      ...withProfile({
        totalAssetsKrw: 825_000_000,
        totalDebtKrw: 220_000_000,
      }),
      recentCompletions: [
        {
          id: "set_concentration_cap",
          sourceLevel: "L6",
          monthsAgo: 1,
        },
      ],
    });

    expect(context.sourceLevel).toBe("L7");
    expect(actionIds(context)[1]).toBe("set_concentration_cap");
  });

  it("replaces exhausted support setup work with a concrete recent-change review", () => {
    const context = createPlanningContext({
      ...withProfile({
        totalAssetsKrw: 825_000_000,
        totalDebtKrw: 220_000_000,
      }),
      recentCompletions: [
        {
          id: "set_new_money_guardrail",
          sourceLevel: "L7",
          monthsAgo: 1,
        },
      ],
    });

    expect(context.sourceLevel).toBe("L7");
    expect(context.modelAllowedActionIds).toEqual(["review_recent_changes"]);
    expect(context.allowModel).toBe(false);
    expect(actionIds(context)[0]).toBe("review_recent_changes");
  });

  it("never lets recent history suppress a current hard stop", () => {
    const context = createPlanningContext({
      ...withProfile({
        totalAssetsKrw: 825_000_000,
        totalDebtKrw: 220_000_000,
        cashRunwayBand: "under_1",
      }),
      recentCompletions: [
        {
          id: "build_cash_runway_rule",
          sourceLevel: "L7",
          monthsAgo: 1,
        },
      ],
    });

    expect(context.sourceLevel).toBe("L7");
    expect(actionIds(context)[0]).toBe("build_cash_runway_rule");
    expect(context.allowModel).toBe(false);
  });

  it("rotates evidence to never-completed first, then the oldest completion", () => {
    const base = withProfile({
      totalAssetsKrw: 825_000_000,
      totalDebtKrw: 220_000_000,
    });
    const neverCompleted = createPlanningContext({
      ...base,
      recentCompletions: [
        {
          id: "compare_plan_to_actual",
          sourceLevel: "L7",
          monthsAgo: 1,
        },
      ],
    });
    const oldest = createPlanningContext({
      ...base,
      recentCompletions: [
        {
          id: "compare_plan_to_actual",
          sourceLevel: "L7",
          monthsAgo: 8,
        },
        {
          id: "verify_concentration_rule",
          sourceLevel: "L7",
          monthsAgo: 2,
        },
      ],
    });

    expect(actionIds(neverCompleted)[2]).toBe("verify_concentration_rule");
    expect(actionIds(oldest)[2]).toBe("compare_plan_to_actual");
  });
});

describe("bounded model contribution", () => {
  it("lets the model choose only the support slot", () => {
    const context = createPlanningContext(
      withProfile({
        largestAssetGroup: "market",
        concentrationBand: "p50_70",
      }),
    );
    expect(context.allowModel).toBe(true);
    expect(context.modelAllowedActionIds).toEqual([
      "pause_dominant_bucket_additions",
      "set_new_money_guardrail",
    ]);
    expect(context.modelAllowedActionIds).not.toContain(
      "complete_asset_snapshot",
    );

    const plan = mergeModelSelection(context, {
      supportActionId: "set_new_money_guardrail",
    });

    expect(plan.actions[0]?.id).toBe("set_new_money_guardrail");
    expect(plan.actions.slice(1)).toEqual(context.fallback.actions.slice(1));
  });

  it("rejects an outsider, extra fields, and all model output during a hard stop", () => {
    const context = createPlanningContext(
      withProfile({
        largestAssetGroup: "market",
        concentrationBand: "p50_70",
      }),
    );
    expect(
      mergeModelSelection(context, {
        supportActionId: "audit_governance_calendar",
      }),
    ).toEqual(context.fallback);
    expect(
      mergeModelSelection(context, {
        supportActionId: "set_new_money_guardrail",
        reason: "invented",
      }),
    ).toEqual(context.fallback);

    const hardStop = createPlanningContext(
      withProfile({ cashRunwayBand: "under_1" }),
    );
    expect(
      mergeModelSelection(hardStop, {
        supportActionId: "review_retirement_account_routine",
      }),
    ).toEqual(hardStop.fallback);
  });

  it("gives the model only allowlisted candidates with concrete evidence", () => {
    const context = createPlanningContext(
      withProfile({
        largestAssetGroup: "market",
        concentrationBand: "p50_70",
      }),
    );

    expect(context.modelInput.allowedSupportActions).toEqual(
      context.modelAllowedActionIds.map((id) => ({
        id,
        purpose: PUBLIC_ACTION_COPY[id].outcome,
        doneWhen: PUBLIC_ACTION_COPY[id].description,
      })),
    );
    expect(
      context.modelInput.allowedSupportActions.every((candidate) =>
        candidate.doneWhen.includes("완료"),
      ),
    ).toBe(true);
  });

  it("keeps raw completion history out of model input and preserves rotated mandatory slots", () => {
    const context = createPlanningContext({
      ...withProfile({
        totalAssetsKrw: 825_000_000,
        totalDebtKrw: 220_000_000,
        largestAssetGroup: "market",
        concentrationBand: "p50_70",
      }),
      recentCompletions: [
        {
          id: "set_concentration_cap",
          sourceLevel: "L7",
          monthsAgo: 1,
        },
        {
          id: "compare_plan_to_actual",
          sourceLevel: "L7",
          monthsAgo: 2,
        },
      ],
    });
    const serializedModelInput = JSON.stringify(context.modelInput);
    const plan = mergeModelSelection(context, {
      supportActionId: "set_new_money_guardrail",
    });

    expect(serializedModelInput).not.toMatch(
      /recentCompletions|monthsAgo|sourceLevel|set_concentration_cap|compare_plan_to_actual/,
    );
    expect(plan.actions.map((action) => action.id)).toEqual([
      "set_new_money_guardrail",
      "operate_asset_structure",
      "verify_concentration_rule",
    ]);
  });
});
