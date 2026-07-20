import { describe, expect, it } from "vitest";

import {
  MAX_WEALTH_REPORT_SNAPSHOT_BYTES,
  parseWealthReportSnapshot,
  serializeWealthReportSnapshot,
  WEALTH_REPORT_SNAPSHOT_VERSION,
} from "./report-snapshot";
import {
  ASSET_COMPOSITION_KEYS,
  WEALTH_REPORT_METHODOLOGY_VERSION,
  WEALTH_REPORT_VERSION,
  type WealthReport,
} from "./wealth-report";

function validReport(): WealthReport {
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
      positionPercent: 40,
      terminal: false,
    },
    composition: ASSET_COMPOSITION_KEYS.map((key) => ({
      key,
      label: key,
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
        {
          horizon: "0-3개월",
          title: "기반 점검",
          description: "안전 여력을 먼저 확인합니다.",
        },
        {
          horizon: "4-6개월",
          title: "구조 조정",
          description: "우선순위에 따라 구조를 검토합니다.",
        },
        {
          horizon: "7-12개월",
          title: "재점검",
          description: "변화를 다시 진단합니다.",
        },
      ],
    },
    dataConfidence: {
      grade: "high",
      message: "입력 자료가 충분합니다.",
    },
    methodology: {
      label: "WealthCopy 내부 참고범위",
      version: WEALTH_REPORT_METHODOLOGY_VERSION,
      disclaimer: "내부 참고범위이며 투자 조언이 아닙니다.",
    },
  };
}

describe("wealth report snapshot contract", () => {
  it("round-trips a valid report with a deterministic export timestamp", () => {
    const report = validReport();
    const json = serializeWealthReportSnapshot(
      report,
      new Date("2026-07-20T12:34:56.000Z"),
    );
    const result = parseWealthReportSnapshot(json);

    expect(result).toEqual({
      ok: true,
      snapshot: {
        snapshotVersion: WEALTH_REPORT_SNAPSHOT_VERSION,
        exportedAt: "2026-07-20T12:34:56.000Z",
        report,
      },
    });
  });

  it("rejects unknown wrapper keys", () => {
    const json = serializeWealthReportSnapshot(validReport());
    const candidate = { ...JSON.parse(json), unknown: true };

    expect(parseWealthReportSnapshot(JSON.stringify(candidate))).toEqual({
      ok: false,
      error: {
        code: "SNAPSHOT_INVALID_FORMAT",
        message: "WealthCopy 스냅샷 형식이 올바르지 않습니다.",
      },
    });
  });

  it("distinguishes an unsupported snapshot version", () => {
    const json = serializeWealthReportSnapshot(validReport());
    const candidate = {
      ...JSON.parse(json),
      snapshotVersion: "wealth-report-snapshot-v999",
    };

    expect(parseWealthReportSnapshot(JSON.stringify(candidate))).toMatchObject({
      ok: false,
      error: { code: "SNAPSHOT_UNSUPPORTED_VERSION" },
    });
  });

  it("rejects input above the 256 KiB UTF-8 limit before parsing", () => {
    const oversized = "가".repeat(MAX_WEALTH_REPORT_SNAPSHOT_BYTES);

    expect(parseWealthReportSnapshot(oversized)).toMatchObject({
      ok: false,
      error: { code: "SNAPSHOT_TOO_LARGE" },
    });
  });

  it("rejects malformed JSON without returning parser details", () => {
    expect(parseWealthReportSnapshot('{"snapshotVersion":')).toEqual({
      ok: false,
      error: {
        code: "SNAPSHOT_INVALID_JSON",
        message: "JSON 파일을 읽을 수 없습니다.",
      },
    });
  });

  it("validates the report again before serialization", () => {
    const report = { ...validReport(), priorities: [] } as WealthReport;

    expect(() => serializeWealthReportSnapshot(report)).toThrow();
  });
});
