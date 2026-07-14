import { describe, expect, it } from "vitest";

import {
  PSID_WEALTH_REFERENCE_2019,
  psidAssetPositionSignal,
} from "./psid-reference";

describe("PSID public wealth reference", () => {
  it("records a monotonic published aggregate table without raw microdata", () => {
    const points = PSID_WEALTH_REFERENCE_2019.percentilePoints;

    expect(PSID_WEALTH_REFERENCE_2019.publicAggregateOnly).toBe(true);
    expect(PSID_WEALTH_REFERENCE_2019.rawMicrodataUsed).toBe(false);
    expect(PSID_WEALTH_REFERENCE_2019.referenceVersion).toBe(
      "psid-wealth-reference-v1",
    );
    expect(points.map((point) => point.percentile)).toEqual([
      5, 10, 25, 50, 75, 90, 95,
    ]);
    expect(points.map((point) => point.netWorthUsd)).toEqual([
      -23_000,
      -3_000,
      10_700,
      76_000,
      316_100,
      900_000,
      1_660_000,
    ]);
    expect(PSID_WEALTH_REFERENCE_2019.sourceColumn).toBe("PSID 2019");
    expect(PSID_WEALTH_REFERENCE_2019.sourceTable).toBe("Table 4");
    expect(points.every((point, index) => {
      const previous = points[index - 1];
      return !previous || point.netWorthUsd > previous.netWorthUsd;
    })).toBe(true);
  });

  it("projects user-selected percentile bands into currency-free signals", () => {
    expect(psidAssetPositionSignal("below_25")).toBe("lower_quartile");
    expect(psidAssetPositionSignal("p50_74")).toBe("middle");
    expect(psidAssetPositionSignal("p90_plus")).toBe("top_decile");
    expect(psidAssetPositionSignal("unknown")).toBe("unknown");
  });
});
