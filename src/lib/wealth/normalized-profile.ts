import { z } from "zod";

export const psidAssetPercentileBandSchema = z.enum([
  "below_25",
  "p25_49",
  "p50_74",
  "p75_89",
  "p90_plus",
  "unknown",
]);

export const normalizedProfileSchema = z
  .object({
    incomeExecutionRatio: z.number().min(0).max(100),
    assetPercentileBand: psidAssetPercentileBandSchema,
    debtServiceRatio: z.number().min(0).max(100),
  })
  .strict()
  .superRefine((profile, context) => {
    if (profile.debtServiceRatio > profile.incomeExecutionRatio) {
      context.addIssue({
        code: "custom",
        message:
          "부채비율은 저축·상환을 합친 소득 대비 실행 비율을 초과할 수 없습니다.",
        path: ["debtServiceRatio"],
      });
    }
  });

export type PsidAssetPercentileBand = z.infer<
  typeof psidAssetPercentileBandSchema
>;
export type NormalizedProfile = z.infer<typeof normalizedProfileSchema>;
