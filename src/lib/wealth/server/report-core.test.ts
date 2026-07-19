import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSET_LEVELS, type AssetLevel } from "../asset-level";
import { ASSET_COMPOSITION_KEYS, wealthReportSchema } from "../wealth-report";
import { ASSET_LEVEL_MINIMUM_NET_WORTH_KRW } from "./asset-level-policy";
import {
  createReportContext,
  mergeReportFraming,
  reportRequestSchema,
  type ReportRequest,
} from "./report-core";

const stableProfile: ReportRequest["profile"] = {
  assets: {
    liquid: 50_000_000,
    home: 150_000_000,
    market: 120_000_000,
    pension: 50_000_000,
    incomeProperty: 30_000_000,
    businessPrivate: 25_000_000,
    alternatives: 15_000_000,
    other: 10_000_000,
  },
  totalDebtKrw: 50_000_000,
  monthlyIncomeKrw: 10_000_000,
  monthlyLivingExpenseKrw: 4_000_000,
  monthlyDebtPaymentKrw: 1_000_000,
  incomeStability: "stable",
  next90DayEvent: "none",
  next90DayAmountKrw: 0,
};

function requestWith(
  profilePatch: Partial<typeof stableProfile> & {
    assets?: Partial<typeof stableProfile.assets>;
  } = {},
) {
  return {
    profile: {
      ...stableProfile,
      ...profilePatch,
      assets: {
        ...stableProfile.assets,
        ...profilePatch.assets,
      },
    },
    constraintNote: "",
    sessionId: "123e4567-e89b-42d3-a456-426614174000",
  };
}

describe("wealth report request boundary", () => {
  it("requires all eight amount groups and rejects client totals, levels, and PSID fields", () => {
    expect(reportRequestSchema.safeParse(requestWith()).success).toBe(true);

    const missingOther = requestWith();
    const sevenAssets: Partial<typeof missingOther.profile.assets> = {
      ...missingOther.profile.assets,
    };
    delete sevenAssets.other;
    expect(
      reportRequestSchema.safeParse({
        ...missingOther,
        profile: { ...missingOther.profile, assets: sevenAssets },
      }).success,
    ).toBe(false);

    for (const extra of [
      { totalAssetsKrw: 450_000_000 },
      { currentLevel: "L6" },
      { assetPercentileBand: "p90_plus" },
      { psid: "hidden" },
    ]) {
      expect(
        reportRequestSchema.safeParse({
          ...requestWith(),
          profile: { ...requestWith().profile, ...extra },
        }).success,
      ).toBe(false);
    }
  });

  it("rejects personal identifiers and monetary notes", () => {
    expect(
      reportRequestSchema.safeParse({
        ...requestWith(),
        constraintNote: "연락처는 010-1234-5678입니다",
      }).success,
    ).toBe(false);
    expect(
      reportRequestSchema.safeParse({
        ...requestWith(),
        constraintNote: "3천만원을 곧 씁니다",
      }).success,
    ).toBe(false);
  });
});

describe("deterministic comprehensive report", () => {
  it("calculates level gap, level position, composition, and cashflow from amounts", () => {
    const context = createReportContext(
      requestWith(),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    const report = context.fallback;

    expect(report.generatedAt).toBe("2026-07-16T00:00:00.000Z");
    expect(report.level).toMatchObject({
      current: "L6",
      next: "L7",
      netWorthKrw: 400_000_000,
      targetNetWorthKrw: 500_000_000,
      gapKrw: 100_000_000,
      positionPercent: 50,
      terminal: false,
    });
    expect(report.composition.map((row) => row.key)).toEqual(
      ASSET_COMPOSITION_KEYS,
    );
    expect(
      report.composition.map((row) => row.referenceMidPercent),
    ).toEqual([12, 35, 27, 8, 8, 5, 3, 2]);
    expect(report.cashflow).toMatchObject({
      monthlyBalanceKrw: 5_000_000,
      monthlyDeployableKrw: 5_000_000,
      livingCostRatioPercent: 40,
      debtServiceRatioPercent: 10,
      liquidRunwayMonths: 10,
      debtToAssetRatioPercent: 11.1,
      netWorthToAnnualIncomeMultiple: 3.3,
    });
    expect(report.priorities).toHaveLength(3);
    expect(report.route.stages.map((stage) => stage.horizon)).toEqual([
      "0-3개월",
      "4-6개월",
      "7-12개월",
    ]);
    expect(wealthReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(
      /(?:actions|completed|checklist|psid|progress)/i,
    );
  });

  it("classifies all fifteen levels and keeps L15 terminal", () => {
    for (const level of ASSET_LEVELS) {
      const minimum = ASSET_LEVEL_MINIMUM_NET_WORTH_KRW[level];
      const input =
        level === "L1"
          ? requestWith({
              assets: Object.fromEntries(
                ASSET_COMPOSITION_KEYS.map((key) => [key, 0]),
              ) as typeof stableProfile.assets,
              totalDebtKrw: 1,
            })
          : requestWith({
              assets: {
                liquid: minimum ?? 0,
                home: 0,
                market: 0,
                pension: 0,
                incomeProperty: 0,
                businessPrivate: 0,
                alternatives: 0,
                other: 0,
              },
              totalDebtKrw: 0,
            });
      const report = createReportContext(input).fallback;
      expect(report.level.current).toBe(level as AssetLevel);
      expect(report.level.terminal).toBe(level === "L15");
      if (level === "L15") {
        expect(report.level.next).toBe("L15");
        expect(report.level.gapKrw).toBe(0);
        expect(report.level.positionPercent).toBe(100);
      }
    }
  });

  it("uses the next-level group at every composition-policy boundary", () => {
    const boundaries = [
      ["L3", 10_000_000, 18],
      ["L6", 300_000_000, 12],
      ["L9", 3_000_000_000, 8],
      ["L12", 30_000_000_000, 7],
      ["L14", 300_000_000_000, 8],
    ] as const;

    for (const [level, netWorthKrw, expectedLiquidMid] of boundaries) {
      const report = createReportContext(
        requestWith({
          assets: {
            liquid: netWorthKrw,
            home: 0,
            market: 0,
            pension: 0,
            incomeProperty: 0,
            businessPrivate: 0,
            alternatives: 0,
            other: 0,
          },
          totalDebtKrw: 0,
        }),
      ).fallback;
      expect(report.level.current).toBe(level);
      expect(report.composition[0]?.referenceMidPercent).toBe(
        expectedLiquidMid,
      );
    }
  });

  it("turns every required safety threshold into a deterministic hard-stop report", () => {
    const report = createReportContext(
      requestWith({
        assets: {
          liquid: 10_000_000,
          home: 850_000_000,
          market: 100_000_000,
          pension: 40_000_000,
          incomeProperty: 0,
          businessPrivate: 0,
          alternatives: 0,
          other: 0,
        },
        totalDebtKrw: 1_000_000_000,
        monthlyIncomeKrw: 10_000_000,
        monthlyLivingExpenseKrw: 5_000_000,
        monthlyDebtPaymentKrw: 4_000_000,
      }),
    );

    expect(report.allowModel).toBe(false);
    expect(report.fallback.route.title).toContain("안전 중단조건");
    expect(
      report.fallback.risks.filter((risk) => risk.severity === "critical"),
    ).toHaveLength(4);
    expect(report.fallback.cashflow).toMatchObject({
      debtServiceRatioPercent: 40,
      liquidRunwayMonths: 1.1,
      debtToAssetRatioPercent: 100,
    });
    const criticalTitles = report.fallback.risks
      .filter((risk) => risk.severity === "critical")
      .map((risk) => risk.title);
    for (const title of criticalTitles) {
      expect(report.fallback.route.stages[0]?.description).toContain(title);
    }
    expect(report.fallback.route.stages[1]).toMatchObject({
      horizon: "4-6개월",
      title: expect.stringContaining("재검증"),
    });
    expect(report.fallback.route.stages[2]?.description).toContain(
      "경우에만",
    );
  });

  it("keeps an urgent free-text signal private while forcing safeguard framing", () => {
    const context = createReportContext({
      ...requestWith(),
      constraintNote: "최근 소득 중단으로 연체 위험이 있습니다",
    });

    expect(context.allowModel).toBe(false);
    expect(context.fallback.route.title).toContain("안전 중단조건");
    expect(context.fallback.risks.some((risk) => risk.severity === "critical")).toBe(
      true,
    );
    const serialized = JSON.stringify(context.fallback);
    expect(serialized).not.toContain("최근 소득 중단으로 연체 위험이 있습니다");
    expect(JSON.stringify(context.modelInput)).not.toContain("연체");
  });

  it("includes a non-urgent constraint in risks and priorities but never model input", () => {
    const note = "해외 체류 일정 때문에 계약과 유동성 확인이 필요합니다";
    const context = createReportContext({
      ...requestWith(),
      constraintNote: note,
    });

    expect(
      context.fallback.risks.some(
        (risk) =>
          risk.title.includes("제약조건") && risk.description.includes(note),
      ),
    ).toBe(true);
    expect(
      context.fallback.priorities.some(
        (priority) =>
          priority.title.includes("제약조건") &&
          priority.diagnosis.includes(note),
      ),
    ).toBe(true);
    expect(JSON.stringify(context.modelInput)).not.toContain(note);
  });

  it("holds structural ranking when other assets exceed ten percent", () => {
    const context = createReportContext(
      requestWith({
        assets: {
          liquid: 50_000_000,
          home: 150_000_000,
          market: 100_000_000,
          pension: 40_000_000,
          incomeProperty: 20_000_000,
          businessPrivate: 15_000_000,
          alternatives: 5_000_000,
          other: 70_000_000,
        },
      }),
    );

    expect(context.allowModel).toBe(false);
    expect(context.fallback.dataConfidence).toMatchObject({
      grade: "low",
    });
    expect(context.fallback.priorities[0]?.title).toContain("기타·회수예정");
    expect(context.fallback.route.title).toContain(
      context.fallback.priorities[0]?.title ?? "missing priority",
    );
  });

  it("keeps a signed monthly balance while deployable cash stays nonnegative", () => {
    const report = createReportContext(
      requestWith({
        monthlyIncomeKrw: 5_000_000,
        monthlyLivingExpenseKrw: 4_000_000,
        monthlyDebtPaymentKrw: 2_000_000,
      }),
    ).fallback;

    expect(report.cashflow.monthlyBalanceKrw).toBe(-1_000_000);
    expect(report.cashflow.monthlyDeployableKrw).toBe(0);
    expect(report.priorities.some((priority) => priority.title.includes("월 부족액"))).toBe(
      true,
    );
  });

  it("uses living expenses plus debt payments for liquid runway", () => {
    const report = createReportContext(
      requestWith({
        assets: { ...stableProfile.assets, liquid: 10_000_000 },
        monthlyIncomeKrw: 8_000_000,
        monthlyLivingExpenseKrw: 2_000_000,
        monthlyDebtPaymentKrw: 2_000_000,
      }),
    ).fallback;

    expect(report.cashflow.liquidRunwayMonths).toBe(2.5);
    expect(
      report.risks.some((risk) => risk.title.includes("3개월 미만")),
    ).toBe(true);
    expect(
      report.priorities.some(
        (priority) =>
          priority.title.includes("3개월선") &&
          priority.checkpoint.includes("월 부채상환액"),
      ),
    ).toBe(true);
  });

  it("returns a bounded net-worth-to-annual-income multiple or null at zero income", () => {
    const normal = createReportContext(requestWith()).fallback;
    expect(normal.cashflow.netWorthToAnnualIncomeMultiple).toBe(3.3);

    const noIncome = createReportContext(
      requestWith({ monthlyIncomeKrw: 0 }),
    ).fallback;
    expect(noIncome.cashflow.netWorthToAnnualIncomeMultiple).toBeNull();

    const capped = createReportContext(
      requestWith({ monthlyIncomeKrw: 1 }),
    ).fallback;
    expect(capped.cashflow.netWorthToAnnualIncomeMultiple).toBe(1_000);
  });

  it("requires an explicit 90-day amount only when an event exists", () => {
    expect(
      reportRequestSchema.safeParse(
        requestWith({ next90DayEvent: "housing", next90DayAmountKrw: 0 }),
      ).success,
    ).toBe(false);
    expect(
      reportRequestSchema.safeParse(
        requestWith({ next90DayEvent: "none", next90DayAmountKrw: 1 }),
      ).success,
    ).toBe(false);
    expect(
      reportRequestSchema.safeParse(
        requestWith({
          next90DayEvent: "housing",
          next90DayAmountKrw: 20_000_000,
        }),
      ).success,
    ).toBe(true);
  });

  it("puts an uncovered 90-day obligation behind safeguard framing", () => {
    const context = createReportContext(
      requestWith({
        next90DayEvent: "housing",
        next90DayAmountKrw: 70_000_000,
      }),
    );

    expect(context.allowModel).toBe(false);
    expect(context.allowedFramingIds).toEqual(["protect_then_build"]);
    expect(context.modelInput.signals.nearTermCoverage).toBe("shortfall");
    expect(context.fallback.priorities[0]?.title).toContain("90일");
    expect(
      context.fallback.risks.some(
        (risk) => risk.severity === "critical" && risk.title.includes("90일"),
      ),
    ).toBe(true);
  });

  it("ranks a covered 90-day event before structural composition gaps", () => {
    const report = createReportContext(
      requestWith({
        next90DayEvent: "large_expense",
        next90DayAmountKrw: 20_000_000,
      }),
    ).fallback;
    expect(report.priorities[0]?.title).toContain("90일");

    const noEvent = createReportContext(requestWith()).fallback;
    expect(
      noEvent.priorities.some(
        (priority) =>
          priority.title.includes("90일") ||
          priority.title.includes("가까운 자금"),
      ),
    ).toBe(false);
  });

  it("uses event-specific guidance for covered and shortfall 90-day plans", () => {
    const cases = [
      ["housing", "주거 이전·계약", "보증금"],
      ["career", "이직·소득 공백", "첫 급여"],
      ["business", "사업 자금 투입", "가계"],
      ["large_expense", "큰 일회성 지출", "견적"],
    ] as const;

    for (const [event, label, detail] of cases) {
      const covered = createReportContext(
        requestWith({
          next90DayEvent: event,
          next90DayAmountKrw: 20_000_000,
        }),
      ).fallback;
      expect(covered.priorities[0]?.title).toContain(label);
      expect(covered.priorities[0]?.guidance).toContain(detail);
      expect(
        covered.risks.some(
          (risk) => risk.title.includes(label) && risk.description.includes(detail),
        ),
      ).toBe(true);

      const shortfall = createReportContext(
        requestWith({
          next90DayEvent: event,
          next90DayAmountKrw: 70_000_000,
        }),
      ).fallback;
      expect(shortfall.priorities[0]?.title).toContain(label);
      expect(shortfall.priorities[0]?.guidance).toContain(detail);
      expect(
        shortfall.risks.some(
          (risk) =>
            risk.severity === "critical" &&
            risk.title.includes(label) &&
            risk.description.includes(detail),
        ),
      ).toBe(true);
    }
  });

  it("does not label an exact zero net worth as a recovery shortfall", () => {
    const report = createReportContext(
      requestWith({ totalDebtKrw: 450_000_000 }),
    ).fallback;
    expect(report.level.current).toBe("L2");
    expect(
      report.risks.some((risk) => risk.title.includes("순자산 회복")),
    ).toBe(false);
  });

  it("prefers an actionable financial gap over a larger optional underweight", () => {
    const totalAssetsKrw = 120_000_000_000;
    const percent = (value: number) => (totalAssetsKrw * value) / 100;
    const report = createReportContext(
      requestWith({
        assets: {
          liquid: percent(11),
          home: percent(19),
          market: percent(18),
          pension: percent(8),
          incomeProperty: percent(28),
          businessPrivate: percent(2),
          alternatives: percent(12),
          other: percent(2),
        },
        totalDebtKrw: 0,
      }),
    ).fallback;

    expect(report.level.current).toBe("L13");
    expect(report.priorities[0]?.title).toContain("상장 금융자산");
    expect(report.priorities[0]?.title).not.toContain("사업");
  });

  it("exposes a confidence grade without an invented numeric score", () => {
    const confidence = createReportContext(requestWith()).fallback.dataConfidence;
    expect(confidence.grade).toBe("high");
    expect("score" in confidence).toBe(false);
  });

  it("sends the model only coarse framing signals and accepts only an allowlisted ID", () => {
    const context = createReportContext(requestWith());
    expect(context.allowModel).toBe(true);
    const serialized = JSON.stringify(context.modelInput);

    expect(serialized).not.toMatch(
      /(?:Krw|amount|ratio|percent|netWorth|currentLevel|nextLevel|psid|constraintNote)/i,
    );
    for (const amount of [
      450_000_000,
      50_000_000,
      10_000_000,
      4_000_000,
      1_000_000,
    ]) {
      expect(serialized).not.toContain(String(amount));
    }

    const selected = mergeReportFraming(context, {
      framingId: "cashflow_then_gap",
    });
    expect(selected.route.title).toContain(
      selected.priorities[0]?.title ?? "missing priority",
    );
    expect(selected.route.stages[0]?.title).toBe(
      selected.priorities[0]?.title,
    );
    expect(
      mergeReportFraming(context, { framingId: "verify_then_plan" }),
    ).toEqual(context.fallback);
    expect(
      mergeReportFraming(context, {
        framingId: "cashflow_then_gap",
        summary: "invented",
      }),
    ).toEqual(context.fallback);
  });
});
