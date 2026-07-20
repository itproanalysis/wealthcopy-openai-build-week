import { describe, expect, it } from "vitest";

import {
  KOREA_HOUSEHOLD_NET_WORTH_BANDS,
  KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION,
  KOREA_HOUSEHOLD_WEALTH_SOURCE,
  getKoreaHouseholdWealthContext,
} from "./korea-household-context";

describe("Korean household net-worth context", () => {
  it.each([
    [-1, "negative"],
    [0, "zero_to_100m"],
    [99_999_999, "zero_to_100m"],
    [100_000_000, "100m_to_300m"],
    [299_999_999, "100m_to_300m"],
    [300_000_000, "300m_to_500m"],
    [499_999_999, "300m_to_500m"],
    [500_000_000, "500m_to_1b"],
    [999_999_999, "500m_to_1b"],
    [1_000_000_000, "one_billion_plus"],
  ] as const)("classifies the exact public boundary %s", (netWorthKrw, bandId) => {
    expect(getKoreaHouseholdWealthContext(netWorthKrw).bandId).toBe(bandId);
  });

  it("preserves all six published percentages without normalization", () => {
    expect(
      KOREA_HOUSEHOLD_NET_WORTH_BANDS.map((band) =>
        band.householdSharePercent,
      ),
    ).toEqual([3.0, 26.4, 27.5, 15.1, 16.1, 11.8]);
    expect(
      KOREA_HOUSEHOLD_NET_WORTH_BANDS.reduce(
        (total, band) => total + band.householdSharePercent,
        0,
      ),
    ).toBeCloseTo(99.9, 10);
  });

  it("uses only broad cumulative band bounds and never interpolates within a band", () => {
    const nearLowerEdge = getKoreaHouseholdWealthContext(100_000_000);
    const middle = getKoreaHouseholdWealthContext(200_000_000);
    const nearUpperEdge = getKoreaHouseholdWealthContext(299_999_999);

    for (const context of [nearLowerEdge, middle, nearUpperEdge]) {
      expect(context.bandId).toBe("100m_to_300m");
      expect(context.householdSharePercent).toBe(27.5);
      expect(context.cumulativeShareRangePercent).toEqual({
        lowerBound: 29.4,
        upperBound: 56.9,
      });
      expect(context.summary).toBe(nearLowerEdge.summary);
    }
  });

  it("keeps L15-scale wealth in the same one-billion-plus public bucket", () => {
    const atOneBillion = getKoreaHouseholdWealthContext(1_000_000_000);
    const atOneTrillion = getKoreaHouseholdWealthContext(1_000_000_000_000);

    expect(atOneTrillion.bandId).toBe("one_billion_plus");
    expect(atOneTrillion.householdSharePercent).toBe(11.8);
    expect(atOneTrillion.cumulativeShareRangePercent).toBeNull();
    expect(atOneTrillion.summary).toBe(atOneBillion.summary);
    expect(atOneTrillion.limitation).toContain("더 세밀한 위치");
  });

  it("returns English copy without changing the published classification", () => {
    const context = getKoreaHouseholdWealthContext(500_000_000, "en");

    expect(context.bandId).toBe("500m_to_1b");
    expect(context.bandLabel).toBe("KRW 500 million to under 1 billion");
    expect(context.summary).toContain("16.1%");
    expect(context.summary).toContain("72.0%–88.1%");
    expect(context.limitation).toContain("No household-specific position");
  });

  it("exposes versioned official source dates and the exact Bank of Korea URL", () => {
    const context = getKoreaHouseholdWealthContext(0);

    expect(context.version).toBe(KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION);
    expect(context.source).toBe(KOREA_HOUSEHOLD_WEALTH_SOURCE);
    expect(context.source.version).toBe("2025");
    expect(context.source.releaseDate).toBe("2025-12-04");
    expect(context.source.referenceDate).toBe("2025-03-31");
    expect(context.source.url).toBe(
      "https://www.bok.or.kr/portal/bbs/B0000501/view.do?menuNo=201264&nttId=10094917",
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite net worth values (%s)",
    (netWorthKrw) => {
      expect(() => getKoreaHouseholdWealthContext(netWorthKrw)).toThrow(
        "netWorthKrw must be a finite number.",
      );
    },
  );
});
