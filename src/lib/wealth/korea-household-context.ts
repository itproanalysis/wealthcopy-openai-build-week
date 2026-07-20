export const KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION =
  "korea-household-net-worth-bands-2025-v1" as const;

export const KOREA_HOUSEHOLD_WEALTH_SOURCE = {
  version: "2025" as const,
  titleKo: "2025년 가계금융복지조사 결과",
  titleEn: "2025 Survey of Household Finances and Living Conditions",
  publishersKo: "국가데이터처·한국은행·금융감독원",
  publishersEn:
    "Ministry of Data and Statistics, Bank of Korea, and Financial Supervisory Service",
  releaseDate: "2025-12-04",
  referenceDate: "2025-03-31",
  url: "https://www.bok.or.kr/portal/bbs/B0000501/view.do?menuNo=201264&nttId=10094917",
} as const;

export type KoreaHouseholdContextLanguage = "ko" | "en";

export type KoreaHouseholdNetWorthBandId =
  | "negative"
  | "zero_to_100m"
  | "100m_to_300m"
  | "300m_to_500m"
  | "500m_to_1b"
  | "one_billion_plus";

type LocalizedLabel = Readonly<{
  ko: string;
  en: string;
}>;

export type KoreaHouseholdNetWorthBand = Readonly<{
  id: KoreaHouseholdNetWorthBandId;
  minInclusiveKrw: number | null;
  maxExclusiveKrw: number | null;
  householdSharePercent: number;
  cumulativeShareRangePercent: Readonly<{
    lowerBound: number;
    upperBound: number;
  }> | null;
  label: LocalizedLabel;
}>;

/**
 * Broad net-worth bands published in the 2025 Korean household survey.
 *
 * Boundaries are classified as [minimum, maximum). The published percentages
 * are rounded and therefore sum to 99.9%, not 100%. No value in this table is
 * interpolated into a household-level position.
 */
export const KOREA_HOUSEHOLD_NET_WORTH_BANDS = [
  {
    id: "negative",
    minInclusiveKrw: null,
    maxExclusiveKrw: 0,
    householdSharePercent: 3.0,
    cumulativeShareRangePercent: { lowerBound: 0, upperBound: 3.0 },
    label: { ko: "순자산 0원 미만", en: "Below KRW 0" },
  },
  {
    id: "zero_to_100m",
    minInclusiveKrw: 0,
    maxExclusiveKrw: 100_000_000,
    householdSharePercent: 26.4,
    cumulativeShareRangePercent: { lowerBound: 3.0, upperBound: 29.4 },
    label: { ko: "순자산 0원 이상 1억원 미만", en: "KRW 0 to under 100 million" },
  },
  {
    id: "100m_to_300m",
    minInclusiveKrw: 100_000_000,
    maxExclusiveKrw: 300_000_000,
    householdSharePercent: 27.5,
    cumulativeShareRangePercent: { lowerBound: 29.4, upperBound: 56.9 },
    label: {
      ko: "순자산 1억원 이상 3억원 미만",
      en: "KRW 100 million to under 300 million",
    },
  },
  {
    id: "300m_to_500m",
    minInclusiveKrw: 300_000_000,
    maxExclusiveKrw: 500_000_000,
    householdSharePercent: 15.1,
    cumulativeShareRangePercent: { lowerBound: 56.9, upperBound: 72.0 },
    label: {
      ko: "순자산 3억원 이상 5억원 미만",
      en: "KRW 300 million to under 500 million",
    },
  },
  {
    id: "500m_to_1b",
    minInclusiveKrw: 500_000_000,
    maxExclusiveKrw: 1_000_000_000,
    householdSharePercent: 16.1,
    cumulativeShareRangePercent: { lowerBound: 72.0, upperBound: 88.1 },
    label: {
      ko: "순자산 5억원 이상 10억원 미만",
      en: "KRW 500 million to under 1 billion",
    },
  },
  {
    id: "one_billion_plus",
    minInclusiveKrw: 1_000_000_000,
    maxExclusiveKrw: null,
    householdSharePercent: 11.8,
    cumulativeShareRangePercent: null,
    label: { ko: "순자산 10억원 이상", en: "KRW 1 billion or more" },
  },
] as const satisfies readonly KoreaHouseholdNetWorthBand[];

export type KoreaHouseholdWealthContext = Readonly<{
  version: typeof KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION;
  bandId: KoreaHouseholdNetWorthBandId;
  bandLabel: string;
  householdSharePercent: number;
  cumulativeShareRangePercent: Readonly<{
    lowerBound: number;
    upperBound: number;
  }> | null;
  summary: string;
  limitation: string;
  source: typeof KOREA_HOUSEHOLD_WEALTH_SOURCE;
}>;

function findPublishedBand(netWorthKrw: number): KoreaHouseholdNetWorthBand {
  if (!Number.isFinite(netWorthKrw)) {
    throw new TypeError("netWorthKrw must be a finite number.");
  }

  const band = KOREA_HOUSEHOLD_NET_WORTH_BANDS.find((candidate) => {
    const meetsMinimum =
      candidate.minInclusiveKrw === null ||
      netWorthKrw >= candidate.minInclusiveKrw;
    const meetsMaximum =
      candidate.maxExclusiveKrw === null ||
      netWorthKrw < candidate.maxExclusiveKrw;
    return meetsMinimum && meetsMaximum;
  });

  // The six public intervals cover every finite number.
  if (!band) {
    throw new RangeError("No published household net-worth band was found.");
  }

  return band;
}

/**
 * Maps net worth to one unchanged public interval. It never estimates a
 * position within a band and is independent of WealthCopy levels and ranges.
 */
export function getKoreaHouseholdWealthContext(
  netWorthKrw: number,
  language: KoreaHouseholdContextLanguage = "ko",
): KoreaHouseholdWealthContext {
  const band = findPublishedBand(netWorthKrw);
  const bandLabel = band.label[language];

  if (band.id === "one_billion_plus") {
    return {
      version: KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION,
      bandId: band.id,
      bandLabel,
      householdSharePercent: band.householdSharePercent,
      cumulativeShareRangePercent: null,
      summary:
        language === "ko"
          ? "전체 가구 중 순자산 10억원 이상인 상단 약 11.8%의 넓은 구간입니다."
          : "This is the broad upper band containing approximately 11.8% of households with net worth of KRW 1 billion or more.",
      limitation:
        language === "ko"
          ? "공개된 이 구간만으로 구간 안의 더 세밀한 위치는 구분하지 않습니다."
          : "This published band does not support a finer position within it.",
      source: KOREA_HOUSEHOLD_WEALTH_SOURCE,
    };
  }

  const cumulativeRange = band.cumulativeShareRangePercent;
  if (!cumulativeRange) {
    throw new RangeError("A lower published band must include a cumulative range.");
  }

  return {
    version: KOREA_HOUSEHOLD_WEALTH_CONTEXT_VERSION,
    bandId: band.id,
    bandLabel,
    householdSharePercent: band.householdSharePercent,
    cumulativeShareRangePercent: cumulativeRange,
    summary:
      language === "ko"
        ? `이 공개 구간에는 전체 가구의 약 ${band.householdSharePercent.toFixed(1)}%가 포함됩니다. 낮은 순자산 구간부터 합산한 누적 분포는 약 ${cumulativeRange.lowerBound.toFixed(1)}%~${cumulativeRange.upperBound.toFixed(1)}% 범위입니다.`
        : `This published band contains approximately ${band.householdSharePercent.toFixed(1)}% of households. Adding the published bands from lower net worth gives an approximate cumulative distribution range of ${cumulativeRange.lowerBound.toFixed(1)}%–${cumulativeRange.upperBound.toFixed(1)}%.`,
    limitation:
      language === "ko"
        ? "구간 안의 개인별 세부 위치는 추정하지 않습니다."
        : "No household-specific position within the band is estimated.",
    source: KOREA_HOUSEHOLD_WEALTH_SOURCE,
  };
}
