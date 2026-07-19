import {
  nextAssetLevel,
  type AssetLevel,
  type NextAssetLevel,
} from "../asset-level";

export const ASSET_LEVEL_POLICY_VERSION = "krw-net-worth-v1";

type AssetLevelThreshold = {
  level: AssetLevel;
  minimumNetWorthKrw: number;
};

export const ASSET_LEVEL_MINIMUM_NET_WORTH_KRW = {
  L1: null,
  L2: 0,
  L3: 10_000_000,
  L4: 30_000_000,
  L5: 100_000_000,
  L6: 300_000_000,
  L7: 500_000_000,
  L8: 1_000_000_000,
  L9: 3_000_000_000,
  L10: 5_000_000_000,
  L11: 10_000_000_000,
  L12: 30_000_000_000,
  L13: 100_000_000_000,
  L14: 300_000_000_000,
  L15: 1_000_000_000_000,
} as const satisfies Record<AssetLevel, number | null>;

/**
 * WealthCopy-owned household net-worth snapshot policy. Assets mean the
 * household's current estimated gross holdings and debt means its current
 * outstanding obligations at request time. Bounds are lower-inclusive and
 * upper-exclusive. These cutoffs are neither an official percentile nor a
 * conversion of an external reference band. Change them only under a new
 * policy version and keep them on the server so the client receives no cutoff
 * table.
 */
const ASSET_LEVEL_THRESHOLDS_DESCENDING = [
  { level: "L15", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L15 },
  { level: "L14", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L14 },
  { level: "L13", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L13 },
  { level: "L12", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L12 },
  { level: "L11", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L11 },
  { level: "L10", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L10 },
  { level: "L9", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L9 },
  { level: "L8", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L8 },
  { level: "L7", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L7 },
  { level: "L6", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L6 },
  { level: "L5", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L5 },
  { level: "L4", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L4 },
  { level: "L3", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L3 },
  { level: "L2", minimumNetWorthKrw: ASSET_LEVEL_MINIMUM_NET_WORTH_KRW.L2 },
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

export function minimumNetWorthForLevel(level: AssetLevel) {
  return ASSET_LEVEL_MINIMUM_NET_WORTH_KRW[level];
}

export function targetNetWorthForLevel(level: AssetLevel): {
  nextLevel: NextAssetLevel;
  targetNetWorthKrw: number;
} {
  const nextLevel = nextAssetLevel(level);
  const targetNetWorthKrw = ASSET_LEVEL_MINIMUM_NET_WORTH_KRW[nextLevel];
  if (targetNetWorthKrw === null) {
    throw new Error(`No target threshold is configured for ${nextLevel}.`);
  }

  return { nextLevel, targetNetWorthKrw };
}
