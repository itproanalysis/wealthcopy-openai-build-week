import { z } from "zod";

export const psidAssetPercentileBandSchema = z.enum([
  "below_25",
  "p25_49",
  "p50_74",
  "p75_89",
  "p90_plus",
  "unknown",
]);

export const cashRunwayBandSchema = z.enum([
  "under_1",
  "one_to_three",
  "three_to_six",
  "six_to_twelve",
  "twelve_plus",
  "unknown",
]);

export const incomeStabilitySchema = z.enum([
  "stable",
  "variable",
  "changing",
  "unknown",
]);

export const largestAssetGroupSchema = z.enum([
  "cash",
  "market",
  "pension",
  "property",
  "business_private",
  "mixed",
  "unknown",
]);

export const concentrationBandSchema = z.enum([
  "under_30",
  "p30_50",
  "p50_70",
  "p70_plus",
  "unknown",
]);

export const debtRiskSchema = z.enum([
  "none",
  "variable_rate",
  "high_cost",
  "near_maturity",
  "unknown",
]);

export const next90DayEventSchema = z.enum([
  "none",
  "large_expense",
  "debt_maturity",
  "tax",
  "business_capital",
  "income_change",
  "unknown",
]);

const normalizedProfileShape = {
  incomeExecutionRatio: z.number().min(0).max(100),
  assetPercentileBand: psidAssetPercentileBandSchema,
  debtServiceRatio: z.number().min(0).max(100),
  cashRunwayBand: cashRunwayBandSchema,
  incomeStability: incomeStabilitySchema,
  largestAssetGroup: largestAssetGroupSchema,
  concentrationBand: concentrationBandSchema,
  debtRisk: debtRiskSchema,
  next90DayEvent: next90DayEventSchema,
};

function validateRatioConsistency(
  profile: { incomeExecutionRatio: number; debtServiceRatio: number },
  context: z.RefinementCtx,
) {
  if (profile.debtServiceRatio > profile.incomeExecutionRatio) {
    context.addIssue({
      code: "custom",
      message:
        "부채상환 비율은 저축과 부채상환을 합친 월소득 대비 실행 비율을 초과할 수 없습니다.",
      path: ["debtServiceRatio"],
    });
  }
}

export const normalizedProfileSchema = z
  .object(normalizedProfileShape)
  .strict()
  .superRefine(validateRatioConsistency);

export const householdKrwAmountSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

/**
 * Aggregate household inputs accepted at the private planning boundary. The
 * optional PSID band remains a self-selected reference and never determines
 * the internally classified level.
 */
export const collectedWealthProfileSchema = z
  .object({
    incomeExecutionRatio: normalizedProfileShape.incomeExecutionRatio,
    assetPercentileBand:
      psidAssetPercentileBandSchema.optional().default("unknown"),
    debtServiceRatio: normalizedProfileShape.debtServiceRatio,
    cashRunwayBand: cashRunwayBandSchema.optional().default("unknown"),
    incomeStability: incomeStabilitySchema.optional().default("unknown"),
    largestAssetGroup: largestAssetGroupSchema.optional().default("unknown"),
    concentrationBand: concentrationBandSchema.optional().default("unknown"),
    debtRisk: debtRiskSchema.optional().default("unknown"),
    next90DayEvent: next90DayEventSchema.optional().default("unknown"),
    totalAssetsKrw: householdKrwAmountSchema,
    totalDebtKrw: householdKrwAmountSchema,
  })
  .strict()
  .superRefine(validateRatioConsistency);

export type PsidAssetPercentileBand = z.infer<
  typeof psidAssetPercentileBandSchema
>;
export type CashRunwayBand = z.infer<typeof cashRunwayBandSchema>;
export type IncomeStability = z.infer<typeof incomeStabilitySchema>;
export type LargestAssetGroup = z.infer<typeof largestAssetGroupSchema>;
export type ConcentrationBand = z.infer<typeof concentrationBandSchema>;
export type DebtRisk = z.infer<typeof debtRiskSchema>;
export type Next90DayEvent = z.infer<typeof next90DayEventSchema>;
export type NormalizedProfile = z.infer<typeof normalizedProfileSchema>;
export type CollectedWealthProfile = z.infer<
  typeof collectedWealthProfileSchema
>;

export function toNormalizedProfile(
  profile: CollectedWealthProfile,
): NormalizedProfile {
  return normalizedProfileSchema.parse({
    incomeExecutionRatio: profile.incomeExecutionRatio,
    assetPercentileBand: profile.assetPercentileBand,
    debtServiceRatio: profile.debtServiceRatio,
    cashRunwayBand: profile.cashRunwayBand,
    incomeStability: profile.incomeStability,
    largestAssetGroup: profile.largestAssetGroup,
    concentrationBand: profile.concentrationBand,
    debtRisk: profile.debtRisk,
    next90DayEvent: profile.next90DayEvent,
  });
}
