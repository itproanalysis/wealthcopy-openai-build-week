import { describe, expect, it } from "vitest";

import {
  ASSET_COMPOSITION_KEYS,
  WEALTH_REPORT_METHODOLOGY_VERSION,
  WEALTH_REPORT_VERSION,
  type WealthReport,
} from "./wealth-report";
import {
  buildEnglishJudgeBrief,
  ENGLISH_ASSET_LABELS,
  formatEnglishKrw,
  getDominantCompositionGap,
} from "./report-presentation";

function reportFixture(): WealthReport {
  return {
    version: WEALTH_REPORT_VERSION,
    generatedAt: "2026-07-20T03:00:00.000Z",
    level: {
      current: "L6",
      next: "L7",
      currentLabel: "자산 구조화",
      nextLabel: "성장 기반",
      netWorthKrw: 600_000_000,
      targetNetWorthKrw: 1_000_000_000,
      gapKrw: 400_000_000,
      positionPercent: 42,
      terminal: false,
    },
    composition: ASSET_COMPOSITION_KEYS.map((key) => ({
      key,
      label: `한국어 ${key}`,
      currentAmountKrw: 100_000_000,
      currentSharePercent: 12.5,
      referenceMinPercent: 10,
      referenceMidPercent: 12.5,
      referenceMaxPercent: 15,
      direction: "within" as const,
      gapPercentagePoints: 0,
      estimatedGapKrw: 0,
    })),
    cashflow: {
      monthlyIncomeKrw: 10_000_000,
      monthlyLivingExpenseKrw: 4_000_000,
      monthlyDebtPaymentKrw: 1_000_000,
      monthlyBalanceKrw: 5_000_000,
      monthlyDeployableKrw: 5_000_000,
      livingCostRatioPercent: 40,
      debtServiceRatioPercent: 10,
      liquidRunwayMonths: 25,
      debtToAssetRatioPercent: 25,
      netWorthToAnnualIncomeMultiple: 5,
    },
    risks: [],
    priorities: [1, 2, 3].map((rank) => ({
      rank: rank as 1 | 2 | 3,
      title: `${rank}순위`,
      diagnosis: "진단",
      guidance: "가이드",
      metric: "지표",
      checkpoint: "점검 기준",
      guardrail: "보호 기준",
    })),
    interpretation: {
      framingId: "structure_then_scale",
      leadInsightId: "largest_gap_sets_direction",
      explanationOrderId: "diagnosis_first",
      connectionId: "structure_to_gap",
      headline: "구조를 먼저 점검합니다.",
      summary: "현재 구조와 다음 구간 참고범위의 차이를 설명합니다.",
      connection: "차이가 큰 항목부터 연결해 봅니다.",
    },
    route: {
      title: "12개월 점검 경로",
      summary: "세 구간으로 나누어 점검합니다.",
      stages: [
        { horizon: "0-3개월", title: "기반 점검", description: "안전 여력을 확인합니다." },
        { horizon: "4-6개월", title: "구조 조정", description: "구조를 검토합니다." },
        { horizon: "7-12개월", title: "재점검", description: "변화를 다시 진단합니다." },
      ],
    },
    dataConfidence: { grade: "high", message: "입력 자료가 충분합니다." },
    methodology: {
      label: "WealthCopy 내부 참고범위",
      version: WEALTH_REPORT_METHODOLOGY_VERSION,
      disclaimer: "내부 참고범위이며 투자 조언이 아닙니다.",
    },
  };
}

describe("English report presentation", () => {
  it("formats KRW for an English compact presentation", () => {
    expect(formatEnglishKrw(0)).toBe("₩0");
    expect(formatEnglishKrw(999)).toBe("₩999");
    expect(formatEnglishKrw(12_500)).toBe("₩12.5K");
    expect(formatEnglishKrw(400_000_000)).toBe("₩400M");
    expect(formatEnglishKrw(1_250_000_000_000)).toBe("₩1.25T");
    expect(formatEnglishKrw(-5_000_000)).toBe("-₩5M");
    expect(formatEnglishKrw(12_345, { compact: false })).toBe("₩12,345");
  });

  it("builds a Korean-free judge brief from deterministic report fields", () => {
    const report = reportFixture();
    report.composition[2] = {
      ...report.composition[2],
      key: "market",
      direction: "below",
      gapPercentagePoints: 9.5,
      estimatedGapKrw: 95_000_000,
    };

    const brief = buildEnglishJudgeBrief(report);

    expect(brief.level.path).toBe("L6 → L7");
    expect(brief.thresholdGap.value).toBe("₩400M");
    expect(brief.inBandPosition.value).toBe("42%");
    expect(brief.dominantGap).toMatchObject({
      key: "market",
      label: ENGLISH_ASSET_LABELS.market,
      value: "9.5 pp below",
    });
    expect(brief.reviewLenses).toHaveLength(3);
    expect(brief.gptPlan.selections.map((selection) => selection.id)).toEqual([
      "structure_then_scale",
      "largest_gap_sets_direction",
      "diagnosis_first",
      "structure_to_gap",
    ]);
    expect(brief.gptPlan.title).toBe("Bounded explanation plan");
    expect(brief.gptPlan.summary).toContain("Eligible normal cases may ask GPT-5.6");
    expect(brief.gptPlan.boundary).toContain("never receives amounts, ratios, levels, notes");
    expect(brief.policy.reference).toContain("internal references");
    expect(brief.policy.limitation).toContain("not financial advice");
    expect(JSON.stringify(brief)).not.toMatch(/[ㄱ-ㅎㅏ-ㅣ가-힣]/u);
  });

  it("does not turn an above-range concentration into a zero amount difference", () => {
    const report = reportFixture();
    report.composition[1] = {
      ...report.composition[1],
      key: "home",
      direction: "above",
      gapPercentagePoints: 13.6,
      estimatedGapKrw: 0,
    };

    const gap = buildEnglishJudgeBrief(report).dominantGap;

    expect(gap.value).toBe("13.6 pp above");
    expect(gap.explanation).toContain("above the upper bound");
    expect(gap.explanation).toContain("does not infer a sell amount");
    expect(gap.explanation).not.toContain("₩0");
    expect(gap).not.toHaveProperty("estimatedAmount");
  });

  it("treats L1 as an unbounded recovery band rather than zero-percent progress", () => {
    const report = reportFixture();
    report.level = {
      ...report.level,
      current: "L1",
      next: "L2",
      currentLabel: "순자산 회복",
      nextLabel: "생활 안전",
      netWorthKrw: -10_000_000,
      targetNetWorthKrw: 0,
      gapKrw: 10_000_000,
      positionPercent: 0,
      terminal: false,
    };

    const brief = buildEnglishJudgeBrief(report);

    expect(brief.inBandPosition.value).toBe("Recovery band");
    expect(brief.inBandPosition.explanation).toContain("no bounded lower threshold");
    expect(brief.inBandPosition.explanation).toContain("no in-band percentage");
  });

  it("scopes upper-band confidence when governance inputs were not collected", () => {
    const report = reportFixture();
    report.level = {
      ...report.level,
      current: "L10",
      next: "L11",
    };
    report.dataConfidence = { grade: "medium", message: "상위 구간 예비 진단" };

    const confidence = buildEnglishJudgeBrief(report).dataConfidence;

    expect(confidence.label).toBe("Scoped upper-band input");
    expect(confidence.detail).toContain("ownership, covenant, tax, and succession");
    expect(confidence.detail).toContain("provisional");
  });

  it("keeps L15 terminal without inventing an L16 target or progress claim", () => {
    const report = reportFixture();
    report.level = {
      ...report.level,
      current: "L15",
      next: "L15",
      currentLabel: "장기 운영",
      nextLabel: "장기 운영",
      netWorthKrw: 1_500_000_000_000,
      targetNetWorthKrw: 1_000_000_000_000,
      gapKrw: 0,
      positionPercent: 100,
      terminal: true,
    };

    const brief = buildEnglishJudgeBrief(report);

    expect(brief.level.path).toBe("L15 · terminal band");
    expect(brief.thresholdGap.value).toBe("No higher band");
    expect(brief.inBandPosition.value).toBe("Terminal band");
    expect(JSON.stringify(brief)).not.toContain("L16");
    expect(brief.inBandPosition.explanation).toContain("no progress percentage");
  });

  it("puts critical safeguards and low confidence ahead of structural review without leaking source copy", () => {
    const report = reportFixture();
    report.risks = [
      { severity: "critical", title: "위험", description: "즉시 점검" },
      { severity: "warning", title: "경고", description: "함께 점검" },
    ];
    report.dataConfidence = { grade: "low", message: "확인 필요" };
    report.cashflow.monthlyBalanceKrw = -1_000_000;
    report.cashflow.monthlyDeployableKrw = 0;

    const brief = buildEnglishJudgeBrief(report);

    expect(brief.safety).toMatchObject({
      status: "gate",
      headline: "Safety gate active",
    });
    expect(brief.reviewLenses[0]).toMatchObject({
      id: "safeguards",
      tone: "guarded",
    });
    expect(brief.reviewLenses[1]).toMatchObject({
      id: "cashflow",
      status: "Monthly deficit",
      tone: "guarded",
    });
    expect(brief.dataConfidence.label).toBe("Low input completeness");
    expect(JSON.stringify(brief)).not.toMatch(/[ㄱ-ㅎㅏ-ㅣ가-힣]/u);
  });

  it("ignores the catch-all other category when selecting a structural gap", () => {
    const report = reportFixture();
    report.composition[0] = {
      ...report.composition[0],
      direction: "below",
      gapPercentagePoints: 4,
    };
    report.composition[7] = {
      ...report.composition[7],
      direction: "above",
      gapPercentagePoints: 50,
    };

    expect(getDominantCompositionGap(report).key).toBe("liquid");
  });
});
