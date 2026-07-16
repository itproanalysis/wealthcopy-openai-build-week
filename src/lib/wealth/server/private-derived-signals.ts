import type { CollectedWealthProfile } from "../normalized-profile";

export const LEVERAGE_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "underwater",
] as const;

export const FREE_SAVINGS_CAPACITY_BANDS = [
  "limited",
  "steady",
  "strong",
] as const;

export type LeverageBand = (typeof LEVERAGE_BANDS)[number];
export type FreeSavingsCapacityBand =
  (typeof FREE_SAVINGS_CAPACITY_BANDS)[number];

export type PrivatePlanningSignals = {
  freeSavingsCapacity: FreeSavingsCapacityBand;
  leverage: LeverageBand;
};

function leverageBand(totalAssetsKrw: number, totalDebtKrw: number) {
  if (totalDebtKrw > totalAssetsKrw) return "underwater" as const;
  if (totalDebtKrw === 0) return "none" as const;
  if (totalAssetsKrw === 0) return "underwater" as const;

  const debtToAssetRatio = totalDebtKrw / totalAssetsKrw;
  if (debtToAssetRatio < 0.2) return "low" as const;
  if (debtToAssetRatio < 0.5) return "medium" as const;
  return "high" as const;
}

function freeSavingsCapacityBand(
  incomeExecutionRatio: number,
  debtServiceRatio: number,
) {
  const freeSavingsCapacity = incomeExecutionRatio - debtServiceRatio;
  if (freeSavingsCapacity < 10) return "limited" as const;
  if (freeSavingsCapacity < 20) return "steady" as const;
  return "strong" as const;
}

/**
 * Reduces exact household amounts to coarse, currency-neutral planning bands.
 * Callers must discard the source profile after classification and must never
 * serialize exact amounts into model input, the public response, storage, or
 * logs.
 */
export function derivePrivatePlanningSignals(
  profile: CollectedWealthProfile,
): PrivatePlanningSignals {
  return {
    freeSavingsCapacity: freeSavingsCapacityBand(
      profile.incomeExecutionRatio,
      profile.debtServiceRatio,
    ),
    leverage: leverageBand(profile.totalAssetsKrw, profile.totalDebtKrw),
  };
}
