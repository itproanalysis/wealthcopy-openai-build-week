import type { PsidAssetPercentileBand } from "../normalized-profile";

type PsidWealthPercentilePoint = {
  percentile: 5 | 10 | 25 | 50 | 75 | 90 | 95;
  netWorthUsd: number;
};

/**
 * Audit-only source values from the published PSID/SCF comparison table.
 *
 * These dollar values never enter the model input, public API, or client bundle.
 * WealthCopy uses only the published percentile cut structure (25/50/75/90)
 * so the user-facing concept remains currency neutral.
 */
export const PSID_WEALTH_REFERENCE_2019 = {
  referenceVersion: "psid-wealth-reference-v1",
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
  percentilePoints: [
    { percentile: 5, netWorthUsd: -23_000 },
    { percentile: 10, netWorthUsd: -3_000 },
    { percentile: 25, netWorthUsd: 10_700 },
    { percentile: 50, netWorthUsd: 76_000 },
    { percentile: 75, netWorthUsd: 316_100 },
    { percentile: 90, netWorthUsd: 900_000 },
    { percentile: 95, netWorthUsd: 1_660_000 },
  ] satisfies readonly PsidWealthPercentilePoint[],
} as const;

export type PsidAssetPositionSignal =
  | "lower_quartile"
  | "lower_middle"
  | "middle"
  | "upper"
  | "top_decile"
  | "unknown";

export function psidAssetPositionSignal(
  band: PsidAssetPercentileBand,
): PsidAssetPositionSignal {
  switch (band) {
    case "below_25":
      return "lower_quartile";
    case "p25_49":
      return "lower_middle";
    case "p50_74":
      return "middle";
    case "p75_89":
      return "upper";
    case "p90_plus":
      return "top_decile";
    case "unknown":
      return "unknown";
  }
}
