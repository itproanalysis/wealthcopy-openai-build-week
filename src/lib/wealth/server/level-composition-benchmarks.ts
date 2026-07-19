import "server-only";

import { ASSET_LEVELS, type AssetLevel } from "../asset-level";
import {
  ASSET_COMPOSITION_KEYS,
  WEALTH_REPORT_METHODOLOGY_VERSION,
  type AssetCompositionKey,
} from "../wealth-report";
import { PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019 } from "./psid-reference";

export type CompositionReferenceBand = {
  minPercent: number;
  midPercent: number;
  maxPercent: number;
};

export type LevelCompositionBenchmark = {
  level: AssetLevel;
  composition: Record<AssetCompositionKey, CompositionReferenceBand>;
};

type CompositionPolicyAnchor = {
  level: AssetLevel;
  mids: readonly number[];
  ranges: readonly (readonly [number, number])[];
};

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundToOne(value: number) {
  return roundTo(value, 1);
}

function interpolate(left: number, right: number, weight: number) {
  return left + (right - left) * weight;
}

function buildComposition(
  mids: readonly number[],
  ranges: readonly (readonly [number, number])[],
) {
  if (
    mids.length !== ASSET_COMPOSITION_KEYS.length ||
    ranges.length !== ASSET_COMPOSITION_KEYS.length
  ) {
    throw new Error("Composition policy must cover all asset groups.");
  }

  const midTotal = mids.reduce((sum, value) => sum + value, 0);
  if (Math.abs(midTotal - 100) > 0.000_001) {
    throw new Error("Composition policy midpoints must total 100%.");
  }

  return Object.fromEntries(
    ASSET_COMPOSITION_KEYS.map((key, index) => {
      const midPercent = mids[index];
      const range = ranges[index];
      if (midPercent === undefined || range === undefined) {
        throw new Error(`Missing composition policy for ${key}.`);
      }
      if (
        range[0] < 0 ||
        range[0] > midPercent ||
        midPercent > range[1] ||
        range[1] > 100
      ) {
        throw new Error(`Invalid composition reference band for ${key}.`);
      }
      return [
        key,
        {
          minPercent: range[0],
          midPercent,
          maxPercent: range[1],
        },
      ];
    }),
  ) as Record<AssetCompositionKey, CompositionReferenceBand>;
}

/**
 * Reviewed policy anchors. Intermediate levels are calibrated below instead of
 * reusing one anchor for several levels.
 */
const POLICY_ANCHORS = [
  {
    level: "L1",
    mids: [30, 25, 20, 10, 2, 5, 1, 7],
    ranges: [
      [20, 40], [0, 50], [12, 28], [5, 15],
      [0, 5], [0, 10], [0, 3], [2, 12],
    ],
  },
  {
    level: "L4",
    mids: [18, 40, 20, 10, 5, 3, 1, 3],
    ranges: [
      [10, 26], [25, 55], [13, 27], [5, 15],
      [0, 10], [0, 8], [0, 3], [0, 6],
    ],
  },
  {
    level: "L7",
    mids: [12, 35, 27, 8, 8, 5, 3, 2],
    ranges: [
      [7, 17], [20, 50], [18, 36], [4, 12],
      [3, 13], [0, 10], [0, 6], [0, 4],
    ],
  },
  {
    level: "L10",
    mids: [8, 20, 35, 6, 15, 10, 4, 2],
    ranges: [
      [4, 12], [10, 30], [25, 45], [2, 10],
      [8, 22], [3, 17], [1, 7], [0, 4],
    ],
  },
  {
    level: "L13",
    mids: [7, 12, 34, 4, 16, 18, 7, 2],
    ranges: [
      [3, 11], [5, 19], [24, 44], [0, 8],
      [8, 24], [8, 28], [2, 12], [0, 4],
    ],
  },
  {
    level: "L15",
    mids: [8, 10, 30, 3, 16, 22, 9, 2],
    ranges: [
      [3, 13], [4, 16], [20, 40], [0, 6],
      [8, 24], [12, 32], [4, 14], [0, 4],
    ],
  },
] as const satisfies readonly CompositionPolicyAnchor[];

function sourcePercentilePosition(levelIndex: number) {
  const sourceAnchors = PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019;
  const sourceCoordinate =
    (levelIndex * (sourceAnchors.length - 1)) / (ASSET_LEVELS.length - 1);
  const lowerIndex = Math.floor(sourceCoordinate);
  const upperIndex = Math.min(lowerIndex + 1, sourceAnchors.length - 1);
  const lower = sourceAnchors[lowerIndex];
  const upper = sourceAnchors[upperIndex];
  if (lower === undefined || upper === undefined) {
    throw new Error("Missing distribution-shape percentile anchor.");
  }
  return interpolate(lower, upper, sourceCoordinate - lowerIndex);
}

const firstSourcePercentile =
  PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019[0];
const lastSourcePercentile =
  PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019[
    PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019.length - 1
  ];

if (
  firstSourcePercentile === undefined ||
  lastSourcePercentile === undefined ||
  firstSourcePercentile >= lastSourcePercentile
) {
  throw new Error("Distribution-shape percentile anchors are invalid.");
}

/**
 * Backend audit information for calibration tests. Only percentile coordinates
 * are retained here: no source currency values participate in level thresholds,
 * midpoint calculation, public reports, model input, or storage.
 */
export const INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION = {
  sourcePercentileAnchors: PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019,
  levels: Object.fromEntries(
    ASSET_LEVELS.map((level, index) => {
      const percentilePosition = sourcePercentilePosition(index);
      return [
        level,
        {
          sourcePercentilePosition: roundTo(percentilePosition, 4),
          normalizedPosition: roundTo(
            (percentilePosition - firstSourcePercentile) /
              (lastSourcePercentile - firstSourcePercentile),
            6,
          ),
        },
      ];
    }),
  ) as Record<
    AssetLevel,
    { sourcePercentilePosition: number; normalizedPosition: number }
  >,
} as const;

const RESOLVED_POLICY_ANCHORS = POLICY_ANCHORS.map((anchor) => ({
  level: anchor.level,
  position:
    INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION.levels[anchor.level]
      .normalizedPosition,
  composition: buildComposition(anchor.mids, anchor.ranges),
}));

function normalizedMidpoints(
  left: LevelCompositionBenchmark["composition"],
  right: LevelCompositionBenchmark["composition"],
  weight: number,
) {
  const tenths = ASSET_COMPOSITION_KEYS.map((key) =>
    Math.round(
      interpolate(
        left[key].midPercent,
        right[key].midPercent,
        weight,
      ) * 10,
    ),
  );
  const largestIndex = tenths.reduce(
    (largest, value, index, values) =>
      value > (values[largest] ?? -Infinity) ? index : largest,
    0,
  );
  const residual = 1_000 - tenths.reduce((sum, value) => sum + value, 0);
  tenths[largestIndex] = (tenths[largestIndex] ?? 0) + residual;
  return tenths.map((value) => value / 10);
}

function interpolateComposition(
  left: (typeof RESOLVED_POLICY_ANCHORS)[number],
  right: (typeof RESOLVED_POLICY_ANCHORS)[number],
  position: number,
) {
  if (position <= left.position) return left.composition;
  if (position >= right.position) return right.composition;

  const weight =
    (position - left.position) / (right.position - left.position);
  const mids = normalizedMidpoints(
    left.composition,
    right.composition,
    weight,
  );
  const ranges = ASSET_COMPOSITION_KEYS.map((key, index) => {
    const mid = mids[index];
    if (mid === undefined) {
      throw new Error(`Missing interpolated midpoint for ${key}.`);
    }
    const min = roundToOne(
      interpolate(
        left.composition[key].minPercent,
        right.composition[key].minPercent,
        weight,
      ),
    );
    const max = roundToOne(
      interpolate(
        left.composition[key].maxPercent,
        right.composition[key].maxPercent,
        weight,
      ),
    );
    return [Math.min(min, mid), Math.max(max, mid)] as const;
  });
  return buildComposition(mids, ranges);
}

function compositionForLevel(level: AssetLevel) {
  const position =
    INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION.levels[level]
      .normalizedPosition;
  const rightIndex = RESOLVED_POLICY_ANCHORS.findIndex(
    (anchor) => anchor.position >= position,
  );
  if (rightIndex <= 0) return RESOLVED_POLICY_ANCHORS[0].composition;

  const right = RESOLVED_POLICY_ANCHORS[rightIndex];
  const left = RESOLVED_POLICY_ANCHORS[rightIndex - 1];
  if (left === undefined || right === undefined) {
    return RESOLVED_POLICY_ANCHORS[
      RESOLVED_POLICY_ANCHORS.length - 1
    ].composition;
  }
  return interpolateComposition(left, right, position);
}

export const LEVEL_COMPOSITION_BENCHMARKS = Object.fromEntries(
  ASSET_LEVELS.map((level) => [
    level,
    {
      level,
      composition: compositionForLevel(level),
    },
  ]),
) as Record<AssetLevel, LevelCompositionBenchmark>;

export const COMPOSITION_METHODOLOGY = {
  label: "WealthCopy 내부 참고범위",
  version: WEALTH_REPORT_METHODOLOGY_VERSION,
  disclaimer:
    "다음 구간의 내부 운영 기준을 비교하기 위한 참고범위입니다. 특정 집단의 관찰 평균, 통계적 백분위, 기대수익률 또는 상품·거래·투자 추천이 아닙니다. 자산군별 금액 차이는 현재 부채가 유지된다고 가정한 다음 구간 총자산 기준의 진단용 추정치이며 실제 매수·매도 금액을 뜻하지 않습니다.",
} as const;

export function levelCompositionBenchmark(level: AssetLevel) {
  return LEVEL_COMPOSITION_BENCHMARKS[level];
}
