import { z } from "zod";

export const psidAssetPercentileBandSchema = z.enum([
  "below_25",
  "p25_49",
  "p50_74",
  "p75_89",
  "p90_plus",
  "unknown",
]);

const normalizedProfileShape = {
  incomeExecutionRatio: z.number().min(0).max(100),
  assetPercentileBand: psidAssetPercentileBandSchema,
  debtServiceRatio: z.number().min(0).max(100),
};

function validateRatioConsistency(
  profile: { incomeExecutionRatio: number; debtServiceRatio: number },
  context: z.RefinementCtx,
) {
  if (profile.debtServiceRatio > profile.incomeExecutionRatio) {
    context.addIssue({
      code: "custom",
      message:
        "부채상환 비율은 저축과 부채상환을 합친 월 소득 대비 실행 비율을 초과할 수 없습니다.",
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
    totalAssetsKrw: householdKrwAmountSchema,
    totalDebtKrw: householdKrwAmountSchema,
  })
  .strict()
  .superRefine(validateRatioConsistency);

export type PsidAssetPercentileBand = z.infer<
  typeof psidAssetPercentileBandSchema
>;
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
  });
}
