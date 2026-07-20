import {
  getKoreaHouseholdWealthContext,
  type KoreaHouseholdContextLanguage,
} from "@/lib/wealth/korea-household-context";

export type KoreaHouseholdContextPanelProps = {
  netWorthKrw: number;
  language: KoreaHouseholdContextLanguage;
};

const COPY = {
  ko: {
    ariaLabel: "대한민국 가구 순자산 공공통계 맥락",
    eyebrow: "KOREA HOUSEHOLD CONTEXT",
    title: "대한민국 가구의 넓은 순자산 구간",
    band: "공개 구간",
    share: "해당 구간 가구 비중",
    cumulative: "공개 구간 누적 범위",
    topBand: "상단 공개 구간",
    separation:
      "이 공공통계 구간은 대한민국 가구 순자산 분포를 넓게 이해하기 위한 참고 맥락입니다. WealthCopy L1–L15 및 8개 자산군 내부 참고범위와 별개이며 서로 변환하지 않습니다.",
    sourcePrefix: "공식 자료",
    referenceDate: "자산 기준일",
    released: "발표일",
    rounding:
      "공개 비중은 반올림되어 합계가 99.9%일 수 있습니다.",
  },
  en: {
    ariaLabel: "Public context for Korean household net worth",
    eyebrow: "KOREA HOUSEHOLD CONTEXT",
    title: "Broad net-worth band for Korean households",
    band: "Published band",
    share: "Households in this band",
    cumulative: "Cumulative published range",
    topBand: "Broad upper published band",
    separation:
      "This public context offers only a broad view of Korean household net worth. It is separate from WealthCopy L1–L15 and the internal reference ranges for the eight asset groups, and is not converted into either one.",
    sourcePrefix: "Official release",
    referenceDate: "Asset reference date",
    released: "Released",
    rounding:
      "Published shares are rounded and may sum to 99.9%.",
  },
} as const;

function formatPercent(value: number, language: KoreaHouseholdContextLanguage) {
  return `${value.toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function KoreaHouseholdContextPanel({
  netWorthKrw,
  language,
}: KoreaHouseholdContextPanelProps) {
  const context = getKoreaHouseholdWealthContext(netWorthKrw, language);
  const copy = COPY[language];
  const sourceTitle =
    language === "ko" ? context.source.titleKo : context.source.titleEn;
  const sourcePublishers =
    language === "ko"
      ? context.source.publishersKo
      : context.source.publishersEn;

  return (
    <aside className="wc-korea-context" aria-label={copy.ariaLabel}>
      <header className="wc-korea-context-header">
        <span className="wc-korea-context-eyebrow">{copy.eyebrow}</span>
        <h2 className="wc-korea-context-title">{copy.title}</h2>
      </header>

      <dl className="wc-korea-context-facts">
        <div className="wc-korea-context-fact">
          <dt>{copy.band}</dt>
          <dd>{context.bandLabel}</dd>
        </div>
        <div className="wc-korea-context-fact">
          <dt>{copy.share}</dt>
          <dd>{formatPercent(context.householdSharePercent, language)}</dd>
        </div>
        <div className="wc-korea-context-fact">
          <dt>
            {context.cumulativeShareRangePercent
              ? copy.cumulative
              : copy.topBand}
          </dt>
          <dd>
            {context.cumulativeShareRangePercent
              ? `${formatPercent(context.cumulativeShareRangePercent.lowerBound, language)}–${formatPercent(context.cumulativeShareRangePercent.upperBound, language)}`
              : language === "ko"
                ? "상단 약 11.8%"
                : "Upper approximately 11.8%"}
          </dd>
        </div>
      </dl>

      <p className="wc-korea-context-summary">{context.summary}</p>
      <p className="wc-korea-context-limitation">{context.limitation}</p>
      <p className="wc-korea-context-separation">{copy.separation}</p>

      <footer className="wc-korea-context-source">
        <span>{copy.sourcePrefix}</span>{" "}
        <a href={context.source.url} target="_blank" rel="noreferrer">
          {sourceTitle}
        </a>
        <span>
          {` · ${sourcePublishers} · ${copy.referenceDate} ${context.source.referenceDate} · ${copy.released} ${context.source.releaseDate}`}
        </span>
        <small>{copy.rounding}</small>
      </footer>
    </aside>
  );
}
