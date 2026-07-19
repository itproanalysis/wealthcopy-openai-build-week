import "server-only";

type PsidWealthPercentilePoint = {
  percentile: 5 | 10 | 25 | 50 | 75 | 90 | 95;
  netWorthUsd: number;
};

/**
 * Internal source-audit values from the published PSID/SCF comparison table.
 *
 * This module is backend reference data only. Its values and terminology must
 * never enter a request schema, model input, public report, storage record, or
 * client bundle.
 */
export const PSID_WEALTH_REFERENCE_2019 = {
  referenceVersion: "psid-wealth-reference-v2",
  dataset: "Panel Study of Income Dynamics",
  geography: "United States",
  measure: "family net worth",
  publicAggregateOnly: true,
  rawMicrodataUsed: false,
  referenceYear: 2019,
  sourceColumn: "PSID 2019",
  sourceTable: "Table 4",
  sourceTitle: "Net Worth Distribution PSID and SCF, 2007-2019",
  sourceUrl:
    "https://psidonline.isr.umich.edu/Publications/Papers/tsp/2021-02_Overview_PSID_Other_US_HH.pdf",
  limitations: {
    referencePopulation: "United States families",
    statisticType: "published cross-sectional aggregate percentile reference",
    notAKoreanWealthRank: true,
    excludedFromLevelClassification: true,
    excludedFromPathSelection: true,
  },
  percentilePoints: [
    { percentile: 5, netWorthUsd: -23_000 },
    { percentile: 10, netWorthUsd: -3_000 },
    { percentile: 25, netWorthUsd: 5_650 },
    { percentile: 50, netWorthUsd: 76_000 },
    { percentile: 75, netWorthUsd: 317_000 },
    { percentile: 90, netWorthUsd: 900_000 },
    { percentile: 95, netWorthUsd: 1_660_000 },
  ] satisfies readonly PsidWealthPercentilePoint[],
} as const;

/**
 * Percentile coordinates are the only part of the external reference that may
 * shape WealthCopy's internal level calibration. They describe spacing in a
 * published distribution; they are not a currency conversion, a Korean wealth
 * rank, or an input to level classification.
 *
 * Keep this export in this `server-only` module. Public report code must never
 * receive the source name, the published currency values, or these anchors.
 */
export const PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019 = Object.freeze(
  PSID_WEALTH_REFERENCE_2019.percentilePoints.map(
    ({ percentile }) => percentile,
  ),
);
