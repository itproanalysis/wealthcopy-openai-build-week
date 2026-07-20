import { z } from "zod";

import { assetLevelSchema, nextAssetLevelSchema } from "./asset-level";

export const WEALTH_REPORT_VERSION = "wealth-report-v2" as const;
export const WEALTH_REPORT_METHODOLOGY_VERSION =
  "composition-policy-v2" as const;
export const MAX_REPORT_AMOUNT_KRW = 8_000_000_000_000_000;

export const ASSET_COMPOSITION_KEYS = [
  "liquid",
  "home",
  "market",
  "pension",
  "incomeProperty",
  "businessPrivate",
  "alternatives",
  "other",
] as const;

export const assetCompositionKeySchema = z.enum(ASSET_COMPOSITION_KEYS);
export type AssetCompositionKey = z.infer<typeof assetCompositionKeySchema>;

export const ASSET_COMPOSITION_LABELS = {
  liquid: "현금성·단기예치",
  home: "거주용 자산",
  market: "상장 금융자산",
  pension: "연금·장기계정",
  incomeProperty: "수익형 부동산",
  businessPrivate: "사업·비상장지분",
  alternatives: "대체·헤지자산",
  other: "기타·회수예정",
} as const satisfies Record<AssetCompositionKey, string>;

export const reportAmountSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_REPORT_AMOUNT_KRW);

export const reportAssetBreakdownSchema = z
  .object({
    liquid: reportAmountSchema,
    home: reportAmountSchema,
    market: reportAmountSchema,
    pension: reportAmountSchema,
    incomeProperty: reportAmountSchema,
    businessPrivate: reportAmountSchema,
    alternatives: reportAmountSchema,
    other: reportAmountSchema,
  })
  .strict()
  .superRefine((assets, context) => {
    const total = ASSET_COMPOSITION_KEYS.reduce(
      (sum, key) => sum + assets[key],
      0,
    );
    if (!Number.isSafeInteger(total) || total > MAX_REPORT_AMOUNT_KRW) {
      context.addIssue({
        code: "custom",
        message: "자산 합계가 지원 범위를 넘습니다.",
      });
    }
  });

export type ReportAssetBreakdown = z.infer<
  typeof reportAssetBreakdownSchema
>;

export const reportIncomeStabilitySchema = z.enum([
  "stable",
  "variable",
  "uncertain",
]);
export type ReportIncomeStability = z.infer<
  typeof reportIncomeStabilitySchema
>;

export const reportNext90DayEventSchema = z.enum([
  "none",
  "housing",
  "career",
  "business",
  "large_expense",
]);
export type ReportNext90DayEvent = z.infer<
  typeof reportNext90DayEventSchema
>;

export const reportFramingIdSchema = z.enum([
  "verify_then_plan",
  "protect_then_build",
  "cashflow_then_gap",
  "structure_then_scale",
]);
export type ReportFramingId = z.infer<typeof reportFramingIdSchema>;

export const reportLeadInsightIdSchema = z.enum([
  "safety_is_the_gate",
  "certainty_before_comparison",
  "near_term_liquidity_first",
  "cashflow_sets_pace",
  "largest_gap_sets_direction",
  "balance_before_scale",
]);
export type ReportLeadInsightId = z.infer<
  typeof reportLeadInsightIdSchema
>;

export const reportExplanationOrderIdSchema = z.enum([
  "diagnosis_first",
  "adjustment_first",
  "checkpoint_first",
]);
export type ReportExplanationOrderId = z.infer<
  typeof reportExplanationOrderIdSchema
>;

export const reportConnectionIdSchema = z.enum([
  "safety_to_structure",
  "evidence_to_priority",
  "event_to_cashflow",
  "cashflow_to_structure",
  "structure_to_gap",
]);
export type ReportConnectionId = z.infer<
  typeof reportConnectionIdSchema
>;

const percentSchema = z.number().finite().min(0).max(100);
const extendedPercentSchema = z.number().finite().min(0).max(1_000);

export const wealthCompositionRowSchema = z
  .object({
    key: assetCompositionKeySchema,
    label: z.string().min(1).max(40),
    currentAmountKrw: reportAmountSchema,
    currentSharePercent: percentSchema,
    referenceMinPercent: percentSchema,
    referenceMidPercent: percentSchema,
    referenceMaxPercent: percentSchema,
    direction: z.enum(["below", "within", "above"]),
    gapPercentagePoints: percentSchema,
    estimatedGapKrw: reportAmountSchema,
  })
  .strict()
  .refine(
    (row) =>
      row.referenceMinPercent <= row.referenceMidPercent &&
      row.referenceMidPercent <= row.referenceMaxPercent,
    { message: "참고 범위의 순서가 올바르지 않습니다." },
  );

export const wealthRiskSchema = z
  .object({
    severity: z.enum(["critical", "warning", "info"]),
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(300),
  })
  .strict();

export const wealthPrioritySchema = z
  .object({
    rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: z.string().min(1).max(80),
    diagnosis: z.string().min(1).max(300),
    guidance: z.string().min(1).max(400),
    metric: z.string().min(1).max(180),
    checkpoint: z.string().min(1).max(220),
    guardrail: z.string().min(1).max(300),
  })
  .strict();

export const wealthRouteStageSchema = z
  .object({
    horizon: z.enum(["0-3개월", "4-6개월", "7-12개월"]),
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(400),
  })
  .strict();

export const wealthReportSchema = z
  .object({
    version: z.literal(WEALTH_REPORT_VERSION),
    generatedAt: z.string().datetime({ offset: true }),
    level: z
      .object({
        current: assetLevelSchema,
        next: nextAssetLevelSchema,
        currentLabel: z.string().min(1).max(40),
        nextLabel: z.string().min(1).max(40),
        netWorthKrw: z.number().int().safe(),
        targetNetWorthKrw: reportAmountSchema,
        gapKrw: reportAmountSchema,
        positionPercent: percentSchema,
        terminal: z.boolean(),
      })
      .strict(),
    composition: z.array(wealthCompositionRowSchema).length(8),
    cashflow: z
      .object({
        monthlyIncomeKrw: reportAmountSchema,
        monthlyLivingExpenseKrw: reportAmountSchema,
        monthlyDebtPaymentKrw: reportAmountSchema,
        monthlyBalanceKrw: z
          .number()
          .int()
          .min(-MAX_REPORT_AMOUNT_KRW)
          .max(MAX_REPORT_AMOUNT_KRW),
        monthlyDeployableKrw: reportAmountSchema,
        livingCostRatioPercent: extendedPercentSchema,
        debtServiceRatioPercent: extendedPercentSchema,
        liquidRunwayMonths: z.number().finite().nonnegative().max(120).nullable(),
        debtToAssetRatioPercent: extendedPercentSchema,
        netWorthToAnnualIncomeMultiple: z
          .number()
          .finite()
          .min(-1_000)
          .max(1_000)
          .nullable(),
      })
      .strict(),
    risks: z.array(wealthRiskSchema).max(8),
    priorities: z.array(wealthPrioritySchema).length(3),
    interpretation: z
      .object({
        framingId: reportFramingIdSchema,
        leadInsightId: reportLeadInsightIdSchema,
        explanationOrderId: reportExplanationOrderIdSchema,
        connectionId: reportConnectionIdSchema,
        headline: z.string().min(1).max(100),
        summary: z.string().min(1).max(360),
        connection: z.string().min(1).max(240),
      })
      .strict(),
    route: z
      .object({
        title: z.string().min(1).max(100),
        summary: z.string().min(1).max(400),
        stages: z.array(wealthRouteStageSchema).length(3),
      })
      .strict(),
    dataConfidence: z
      .object({
        grade: z.enum(["high", "medium", "low"]),
        message: z.string().min(1).max(300),
      })
      .strict(),
    methodology: z
      .object({
        label: z.literal("WealthCopy 내부 참고범위"),
        version: z.literal(WEALTH_REPORT_METHODOLOGY_VERSION),
        disclaimer: z.string().min(1).max(500),
      })
      .strict(),
  })
  .strict()
  .superRefine((report, context) => {
    const keys = report.composition.map((row) => row.key);
    if (
      keys.some((key, index) => key !== ASSET_COMPOSITION_KEYS[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "자산 구성 행은 정책 순서를 따라야 합니다.",
        path: ["composition"],
      });
    }

    const ranks = report.priorities.map((priority) => priority.rank);
    if (ranks.some((rank, index) => rank !== index + 1)) {
      context.addIssue({
        code: "custom",
        message: "우선 조정 가이드는 1~3순위여야 합니다.",
        path: ["priorities"],
      });
    }

  });

export type WealthReport = z.infer<typeof wealthReportSchema>;
