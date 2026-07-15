import type { AssetLevel } from "../asset-level";

export const ASSET_LEVEL_POLICY_VERSION = "krw-net-worth-v1";

type AssetLevelThreshold = {
  level: AssetLevel;
  minimumNetWorthKrw: number;
};

/**
 * WealthCopy-owned household net-worth snapshot policy. Assets mean the
 * household's current estimated gross holdings and debt means its current
 * outstanding obligations at request time. Bounds are lower-inclusive and
 * upper-exclusive. These cutoffs are neither an official percentile nor a
 * conversion of the optional PSID reference band. Change them only under a new
 * policy version and keep them on the server so the client receives no cutoff
 * table.
 */
const ASSET_LEVEL_THRESHOLDS_DESCENDING = [
  { level: "L15", minimumNetWorthKrw: 1_000_000_000_000 },
  { level: "L14", minimumNetWorthKrw: 300_000_000_000 },
  { level: "L13", minimumNetWorthKrw: 100_000_000_000 },
  { level: "L12", minimumNetWorthKrw: 30_000_000_000 },
  { level: "L11", minimumNetWorthKrw: 10_000_000_000 },
  { level: "L10", minimumNetWorthKrw: 5_000_000_000 },
  { level: "L9", minimumNetWorthKrw: 3_000_000_000 },
  { level: "L8", minimumNetWorthKrw: 1_000_000_000 },
  { level: "L7", minimumNetWorthKrw: 500_000_000 },
  { level: "L6", minimumNetWorthKrw: 300_000_000 },
  { level: "L5", minimumNetWorthKrw: 100_000_000 },
  { level: "L4", minimumNetWorthKrw: 30_000_000 },
  { level: "L3", minimumNetWorthKrw: 10_000_000 },
  { level: "L2", minimumNetWorthKrw: 0 },
] as const satisfies readonly AssetLevelThreshold[];

export type AssetLevelClassificationInput = {
  totalAssetsKrw: number;
  totalDebtKrw: number;
};

function assertHouseholdAmount(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer.`);
  }
}

export function classifyAssetLevel({
  totalAssetsKrw,
  totalDebtKrw,
}: AssetLevelClassificationInput): AssetLevel {
  assertHouseholdAmount(totalAssetsKrw, "totalAssetsKrw");
  assertHouseholdAmount(totalDebtKrw, "totalDebtKrw");

  const netWorthKrw = totalAssetsKrw - totalDebtKrw;
  return (
    ASSET_LEVEL_THRESHOLDS_DESCENDING.find(
      ({ minimumNetWorthKrw }) => netWorthKrw >= minimumNetWorthKrw,
    )?.level ?? "L1"
  );
}
