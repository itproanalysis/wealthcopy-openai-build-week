import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSET_LEVELS, type AssetLevel } from "../asset-level";
import { ASSET_COMPOSITION_KEYS, wealthReportSchema } from "../wealth-report";
import { ASSET_LEVEL_MINIMUM_NET_WORTH_KRW } from "./asset-level-policy";
import {
  createReportContext,
  isCoherentReportOrchestrationPlan,
  mergeReportOrchestration,
  reportModelInputSchema,
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
    expect(report.version).toBe("wealth-report-v2");
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
    expect(report.interpretation).toMatchObject({
      framingId: "structure_then_scale",
      leadInsightId: "cashflow_sets_pace",
      explanationOrderId: "diagnosis_first",
      connectionId: "cashflow_to_structure",
    });
    expect(report.methodology.version).toBe("composition-policy-v2");
    expect(report.route.title).toBe("L6→L7 구조화 전환 경로");
    expect(report.route.stages.map((stage) => stage.title)).toEqual([
      "편중 원인 확인",
      "월 흐름 연결",
      "L7 전환 재산정",
    ]);
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
        expect(report.route.title).toBe("L15 장기운영·영속성 경로");
        expect(report.route.title).not.toContain("L15→L15");
        expect(report.route.stages[2]?.title).toBe("L15 운영 재점검");
        expect(report.route.stages[2]?.description).toContain(
          "다음 레벨을 가정하지 않고",
        );
        expect(JSON.stringify(report.route)).not.toMatch(/L16|상위 구간으로 이동/);
      }
    }
  });

  it("derives asset-group amount gaps from next-band gross assets with current debt held constant", () => {
    const report = createReportContext(
      requestWith({
        assets: {
          liquid: 50_000_000,
          home: 260_000_000,
          market: 10_000_000,
          pension: 50_000_000,
          incomeProperty: 30_000_000,
          businessPrivate: 25_000_000,
          alternatives: 15_000_000,
          other: 10_000_000,
        },
      }),
    ).fallback;

    expect(report.level).toMatchObject({
      current: "L6",
      next: "L7",
      targetNetWorthKrw: 500_000_000,
    });
    const market = report.composition.find((row) => row.key === "market");
    expect(market).toMatchObject({
      currentAmountKrw: 10_000_000,
      referenceMinPercent: 18,
      estimatedGapKrw: 89_000_000,
    });
    expect(report.methodology.disclaimer).toContain(
      "현재 부채가 유지된다고 가정한 다음 구간 총자산 기준",
    );
  });

  it("uses verification and cashflow priorities instead of composition-gap actions for a zero-asset snapshot", () => {
    const zeroAssets = Object.fromEntries(
      ASSET_COMPOSITION_KEYS.map((key) => [key, 0]),
    ) as typeof stableProfile.assets;
    const report = createReportContext(
      requestWith({ assets: zeroAssets, totalDebtKrw: 0 }),
    ).fallback;

    expect(report.level.current).toBe("L2");
    expect(report.dataConfidence.grade).toBe("low");
    expect(report.composition.every((row) => row.currentAmountKrw === 0)).toBe(
      true,
    );
    expect(report.priorities.some((priority) => priority.title === "0원 자산 스냅샷 재확인")).toBe(
      true,
    );
    expect(
      report.priorities.some((priority) =>
        priority.metric.includes("다음 구간 참고 하단까지"),
      ),
    ).toBe(false);
    expect(
      report.priorities.some((priority) =>
        priority.title.includes("기타·회수예정 자산을 세부 항목으로 분리"),
      ),
    ).toBe(false);
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
    expect(report.fallback.route.title).toContain("안전조건 우선");
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
      title: "안전자금 분리",
    });
    expect(report.fallback.route.stages[1]?.description).toContain(
      "중단조건을 재평가",
    );
    expect(report.fallback.route.stages[2]?.description).toContain("해소된 경우에만");
  });

  it("keeps an urgent free-text signal private while forcing safeguard framing", () => {
    const context = createReportContext({
      ...requestWith(),
      constraintNote: "최근 소득 중단으로 연체 위험이 있습니다",
    });

    expect(context.allowModel).toBe(false);
    expect(context.fallback.route.title).toContain("안전조건 우선");
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
    expect(context.fallback.route.title).toBe("L6→L7 구조화 전환 경로");
    context.fallback.priorities.forEach((priority, index) => {
      expect(context.fallback.route.stages[index]?.description).toContain(
        priority.title,
      );
    });
  });

  it("turns negative monthly cashflow into a critical safeguard while deployable cash stays nonnegative", () => {
    const context = createReportContext(
      requestWith({
        monthlyIncomeKrw: 5_000_000,
        monthlyLivingExpenseKrw: 5_500_000,
        monthlyDebtPaymentKrw: 500_000,
      }),
    );
    const report = context.fallback;

    expect(report.cashflow.monthlyBalanceKrw).toBe(-1_000_000);
    expect(report.cashflow.monthlyDeployableKrw).toBe(0);
    expect(context.allowModel).toBe(false);
    expect(context.allowedFramingIds).toEqual(["protect_then_build"]);
    expect(
      report.risks.some(
        (risk) =>
          risk.severity === "critical" && risk.title.includes("월 현금흐름이 적자"),
      ),
    ).toBe(true);
    expect(report.priorities.some((priority) => priority.title.includes("월 부족액"))).toBe(
      true,
    );
    expect(report.route.title).toContain("안전조건 우선");
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

  it("treats the event amount plus exactly three months of required outflow as the 90-day coverage boundary", () => {
    const exactlyCovered = createReportContext(
      requestWith({
        next90DayEvent: "housing",
        next90DayAmountKrw: 35_000_000,
      }),
    );
    expect(exactlyCovered.modelInput.signals.nearTermCoverage).toBe("covered");
    expect(
      exactlyCovered.fallback.risks.some(
        (risk) => risk.severity === "critical" && risk.title.includes("90일"),
      ),
    ).toBe(false);
    expect(exactlyCovered.fallback.risks.some((risk) => risk.description.includes("1,500만원"))).toBe(
      true,
    );

    const oneWonShort = createReportContext(
      requestWith({
        next90DayEvent: "housing",
        next90DayAmountKrw: 35_000_001,
      }),
    );
    expect(oneWonShort.modelInput.signals.nearTermCoverage).toBe("shortfall");
    expect(oneWonShort.allowedFramingIds).toEqual(["protect_then_build"]);
    expect(oneWonShort.fallback.priorities[0]).toMatchObject({
      title: expect.stringContaining("뒤 안전선 보완"),
      metric: "이벤트 후 안전선 부족 1원",
    });
    expect(
      oneWonShort.fallback.risks.some(
        (risk) =>
          risk.severity === "critical" &&
          risk.title.includes("뒤 3개월 안전선이 부족"),
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

  it("sends only minimized categorical signals and applies a fully allowlisted orchestration plan", () => {
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

    expect(context.modelInput).not.toHaveProperty("signals.levelBand");
    expect(context.modelInput.allowedChoices.framings).toHaveLength(2);
    expect(context.modelInput.allowedChoices.leadInsights).toHaveLength(2);
    expect(context.modelInput.allowedChoices.explanationOrders).toHaveLength(3);
    expect(context.modelInput.allowedChoices.connections).toHaveLength(2);
    expect(reportModelInputSchema.parse(context.modelInput)).toEqual(
      context.modelInput,
    );

    const selected = mergeReportOrchestration(context, {
      framingId: "cashflow_then_gap",
      leadInsightId: "balance_before_scale",
      explanationOrderId: "adjustment_first",
      connectionId: "structure_to_gap",
    });
    expect(selected.interpretation).toMatchObject({
      framingId: "cashflow_then_gap",
      leadInsightId: "balance_before_scale",
      explanationOrderId: "adjustment_first",
      connectionId: "structure_to_gap",
      headline: "규모 확대보다 역할의 균형이 먼저입니다",
    });
    expect(selected.route.title).toBe("L6→L7 구조화 전환 경로");
    expect(selected.route.summary).toContain("월 현금흐름");
    expect(selected.route.summary).toContain("구성의 역할 차이");
    expect(selected.route.stages.map((stage) => stage.title)).toEqual([
      "편중 원인 확인",
      "월 흐름 연결",
      "L7 전환 재산정",
    ]);
    selected.priorities.forEach((priority, index) => {
      expect(selected.route.stages[index]?.description).toContain(priority.title);
    });
    expect(
      mergeReportOrchestration(context, {
        framingId: "verify_then_plan",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      }),
    ).toEqual(context.fallback);
    expect(
      mergeReportOrchestration(context, {
        framingId: "cashflow_then_gap",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
        summary: "invented",
      }),
    ).toEqual(context.fallback);
  });

  it("rejects semantically incoherent four-ID combinations even when every ID is individually allowlisted", () => {
    const context = createReportContext(
      requestWith({
        next90DayEvent: "housing",
        next90DayAmountKrw: 1_000_000,
      }),
    );
    expect(context.allowModel).toBe(true);

    const frameConflict = {
      framingId: "structure_then_scale",
      leadInsightId: "near_term_liquidity_first",
      explanationOrderId: "checkpoint_first",
      connectionId: "event_to_cashflow",
    } as const;
    expect(context.allowedFramingIds).toContain(frameConflict.framingId);
    expect(context.allowedLeadInsightIds).toContain(frameConflict.leadInsightId);
    expect(context.allowedExplanationOrderIds).toContain(
      frameConflict.explanationOrderId,
    );
    expect(context.allowedConnectionIds).toContain(frameConflict.connectionId);
    expect(isCoherentReportOrchestrationPlan(frameConflict)).toBe(false);
    expect(mergeReportOrchestration(context, frameConflict)).toEqual(
      context.fallback,
    );

    const connectionConflict = {
      framingId: "cashflow_then_gap",
      leadInsightId: "largest_gap_sets_direction",
      explanationOrderId: "checkpoint_first",
      connectionId: "event_to_cashflow",
    } as const;
    expect(isCoherentReportOrchestrationPlan(connectionConflict)).toBe(false);
    expect(mergeReportOrchestration(context, connectionConflict)).toEqual(
      context.fallback,
    );
  });

  it("rejects partial, invented, and context-disallowed plans with exact fallback parity", () => {
    const context = createReportContext(requestWith());
    const invalidPlans = [
      null,
      { framingId: "cashflow_then_gap" },
      {
        framingId: "invented",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      },
      {
        framingId: "cashflow_then_gap",
        leadInsightId: "near_term_liquidity_first",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      },
      {
        framingId: "cashflow_then_gap",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "guardrail_first",
        connectionId: "structure_to_gap",
      },
      {
        framingId: "cashflow_then_gap",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "event_to_cashflow",
      },
    ];

    for (const candidate of invalidPlans) {
      expect(mergeReportOrchestration(context, candidate)).toEqual(
        context.fallback,
      );
    }
  });

  it("keeps safety reports deterministic even when a candidate plan is supplied", () => {
    const context = createReportContext(
      requestWith({
        monthlyIncomeKrw: 5_000_000,
        monthlyLivingExpenseKrw: 5_500_000,
        monthlyDebtPaymentKrw: 500_000,
      }),
    );
    expect(context.allowModel).toBe(false);
    expect(context.fallback.interpretation).toMatchObject({
      framingId: "protect_then_build",
      leadInsightId: "safety_is_the_gate",
      explanationOrderId: "diagnosis_first",
      connectionId: "safety_to_structure",
    });
    expect(
      mergeReportOrchestration(context, {
        framingId: "cashflow_then_gap",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      }),
    ).toEqual(context.fallback);
  });
});
