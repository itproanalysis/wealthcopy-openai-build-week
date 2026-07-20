"use client";

import type { CSSProperties } from "react";

import type { WealthReport } from "@/lib/wealth/wealth-report";
import { serializeWealthReportSnapshot } from "@/lib/wealth/report-snapshot";

import { KoreaHouseholdContextPanel } from "./korea-household-context-panel";
import { WealthJudgePanel } from "./wealth-judge-panel";

type WealthReportViewProps = {
  language: "ko" | "en";
  report: WealthReport;
  previousReport?: WealthReport | null;
  onRestart: () => void;
};

const KRW_PER_EOK = 100_000_000;
const KRW_PER_MANWON = 10_000;

const COMPOSITION_COLORS: Record<string, string> = {
  liquid: "#4f8f83",
  home: "#b7a477",
  market: "#335f78",
  pension: "#7b85aa",
  incomeProperty: "#9c735f",
  businessPrivate: "#735f86",
  alternatives: "#b56f64",
  other: "#9ca6a1",
};

function formatKrw(value: number, compact = false) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0원";

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const jo = Math.floor(absolute / 1_000_000_000_000);
  const eok = Math.floor((absolute % 1_000_000_000_000) / KRW_PER_EOK);
  const manwon = Math.floor((absolute % KRW_PER_EOK) / KRW_PER_MANWON);

  if (compact) {
    if (jo > 0) return `${sign}${(absolute / 1_000_000_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
    if (eok > 0) return `${sign}${(absolute / KRW_PER_EOK).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
    if (absolute < KRW_PER_MANWON) return `${value.toLocaleString("ko-KR")}원`;
    return `${sign}${manwon.toLocaleString("ko-KR")}만`;
  }

  const parts = [
    jo > 0 ? `${jo.toLocaleString("ko-KR")}조` : "",
    eok > 0 ? `${eok.toLocaleString("ko-KR")}억` : "",
    manwon > 0 ? `${manwon.toLocaleString("ko-KR")}만원` : "",
  ].filter(Boolean);
  return `${sign}${parts.join(" ") || `${absolute.toLocaleString("ko-KR")}원`}`;
}

function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function formatMultiple(value: number | null) {
  if (value === null) return "산정 안 함";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}배`;
}

function formatKrwChange(value: number) {
  if (value === 0) return "변동 없음";
  return `${value > 0 ? "+" : "−"}${formatKrw(Math.abs(value))}`;
}

function formatPointChange(value: number) {
  if (Math.abs(value) < 0.05) return "변동 없음";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%p`;
}

function compositionStatus(direction: "below" | "within" | "above") {
  if (direction === "below") return "참고비중 아래";
  if (direction === "above") return "참고비중 위";
  return "참고비중 안";
}

function directionCopy(direction: "below" | "within" | "above", gapPercentagePoints: number) {
  if (direction === "within") return "범위 안";
  return `${gapPercentagePoints.toFixed(1)}%p ${direction === "below" ? "차이" : "초과"}`;
}

function dominantDifferenceCopy(
  item: WealthReport["composition"][number] | undefined,
) {
  if (!item || item.direction === "within") {
    return "주요 자산군이 내부 참고범위 안에 있습니다.";
  }

  return `${item.label} 비중이 참고 ${item.direction === "below" ? "하단보다" : "상단보다"} ${item.gapPercentagePoints.toFixed(1)}%p ${item.direction === "below" ? "낮습니다" : "높습니다"}.`;
}

function priorityPresentation(
  priority: WealthReport["priorities"][number],
  order: WealthReport["interpretation"]["explanationOrderId"],
) {
  if (order === "adjustment_first") {
    return {
      mainKicker: "조정 가이드 먼저",
      mainBody: priority.guidance,
      metricLabel: "현재 판단 근거",
      sideKicker: "진단 근거",
      sideBody: priority.diagnosis,
    };
  }
  if (order === "checkpoint_first") {
    return {
      mainKicker: "확인 기준 먼저",
      mainBody: priority.checkpoint,
      metricLabel: "현재 진단 지표",
      sideKicker: "진단과 조정 가이드",
      sideBody: `${priority.diagnosis} ${priority.guidance}`,
    };
  }
  return {
    mainKicker: `PRIORITY ${priority.rank}`,
    mainBody: priority.diagnosis,
    metricLabel: "현재 진단",
    sideKicker: "조정 가이드",
    sideBody: priority.guidance,
  };
}

function PrintIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8V3h10v5M7 17H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2" /><path d="M7 14h10v7H7z" /></svg>;
}

function Chevron() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;
}

export function WealthReportView({ language, report, previousReport = null, onRestart }: WealthReportViewProps) {
  const generatedLabel = new Intl.DateTimeFormat(language === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(report.generatedAt));
  const position = Math.max(0, Math.min(100, report.level.positionPercent));
  const isGuarded = report.risks.some((risk) => risk.severity === "critical");
  const totalAssets = report.composition.reduce((sum, item) => sum + item.currentAmountKrw, 0);
  const totalDebt = Math.max(0, totalAssets - report.level.netWorthKrw);
  const targetGrossAssets = report.level.terminal
    ? totalAssets
    : report.level.targetNetWorthKrw + totalDebt;
  const criticalRisks = report.risks.filter((risk) => risk.severity === "critical");
  const warningRisks = report.risks.filter((risk) => risk.severity !== "critical");
  const summaryRisks = criticalRisks.length > 0 ? criticalRisks : warningRisks;
  const firstSafetyIssue = summaryRisks[0];
  const dominantGap = [...report.composition]
    .filter((item) => item.key !== "other")
    .sort((left, right) => right.gapPercentagePoints - left.gapPercentagePoints)[0];
  const previousDominantMatch = dominantGap && previousReport
    ? previousReport.composition.find((item) => item.key === dominantGap.key)
    : undefined;
  const gapChangeKrw = previousReport
    ? report.level.gapKrw - previousReport.level.gapKrw
    : 0;
  const monthlyBalanceChangeKrw = previousReport
    ? report.cashflow.monthlyBalanceKrw - previousReport.cashflow.monthlyBalanceKrw
    : 0;
  const compositionGapChange = dominantGap && previousDominantMatch
    ? dominantGap.gapPercentagePoints - previousDominantMatch.gapPercentagePoints
    : 0;
  const sameLevelBand = previousReport?.level.current === report.level.current;
  const confidenceLabel = {
    high: "높음",
    medium: "보통",
    low: "확인 필요",
  }[report.dataConfidence.grade];

  function downloadSnapshot() {
    const blob = new Blob([serializeWealthReportSnapshot(report)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wealthcopy-${report.level.current}-${report.generatedAt.slice(0, 10)}.wealthcopy.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="wc-report-shell wc-rise">
      <header className="wc-report-masthead">
        <div><span>WEALTHCOPY STRUCTURE REPORT</span><strong>{generatedLabel}</strong></div>
        <div><button type="button" onClick={() => window.print()}><PrintIcon /> {language === "en" ? "Print / save PDF" : "인쇄·PDF 저장"}</button><button type="button" onClick={downloadSnapshot}>{language === "en" ? "Download snapshot" : "비교용 스냅샷 저장"}</button><button type="button" onClick={onRestart}>{language === "en" ? "Edit inputs" : "입력값 수정"}</button></div>
      </header>

      {language === "en" ? <WealthJudgePanel report={report} /> : null}

      <section className={`wc-report-hero ${isGuarded ? "guarded" : ""}`} aria-label="자산구조 핵심 요약">
        <div className="wc-executive-top">
          <div className="wc-level-story">
            <span className="wc-report-kicker">EXECUTIVE STRUCTURE BRIEF</span>
            {report.level.terminal ? (
              <div className="wc-level-pair terminal">
                <div className="target"><small>현재 최상위 구간</small><strong>{report.level.current}</strong><span>{report.level.currentLabel}</span></div>
              </div>
            ) : (
              <div className="wc-level-pair">
                <div><small>현재</small><strong>{report.level.current}</strong><span>{report.level.currentLabel}</span></div>
                <i><svg aria-hidden="true" width="34" height="20" viewBox="0 0 34 20" fill="none"><path d="M1 10h30M23 2l8 8-8 8" stroke="currentColor" strokeWidth="1.7" /></svg></i>
                <div className="target"><small>다음 목표</small><strong>{report.level.next}</strong><span>{report.level.nextLabel}</span></div>
              </div>
            )}
            <h1 tabIndex={-1}>{report.interpretation.headline}</h1>
            <p>{report.interpretation.summary}</p>
            <div className="wc-reading-connection">
              <span>리포트 연결</span>
              <strong>{report.interpretation.connection}</strong>
            </div>
          </div>

          <div className={`wc-position-card ${report.level.current === "L1" || report.level.terminal ? "qualitative" : ""}`}>
            <div className="wc-position-ring" style={{ "--position": `${position * 3.6}deg` } as CSSProperties}>
              <div>
                <small>{report.level.current === "L1" ? "순자산 회복 필요" : report.level.terminal ? "장기 운영 구간" : "구간 내 위치"}</small>
                {report.level.current === "L1" ? <strong className="text-value">{formatKrw(Math.abs(report.level.netWorthKrw), true)}</strong> : report.level.terminal ? <strong className="text-value">L15</strong> : <strong>{position.toFixed(0)}<em>%</em></strong>}
              </div>
            </div>
            {!report.level.terminal && report.level.current !== "L1" ? <div className="wc-position-scale"><span>{report.level.current}</span><i><b style={{ width: `${position}%` }} /></i><span>{report.level.next}</span></div> : null}
            <div className="wc-threshold-copy">
              <small>{report.level.terminal ? "현재 운영 기준" : `${report.level.next} 진입까지`}</small>
              <strong>{report.level.terminal ? formatKrw(report.level.netWorthKrw) : formatKrw(report.level.gapKrw)}</strong>
              <span>{report.level.terminal ? "추가 레벨 없이 보전·유동성·집중·승계를 점검합니다." : `진입 기준 ${formatKrw(report.level.targetNetWorthKrw)}`}</span>
            </div>
          </div>
        </div>

        <div className="wc-executive-insights">
          <article>
            <small>DOMINANT DIFFERENCE</small>
            <h2>가장 큰 구조 차이</h2>
            <p>{dominantDifferenceCopy(dominantGap)}</p>
          </article>
          <article className={firstSafetyIssue ? "attention" : "clear"}>
            <small>SAFETY CONDITION</small>
            <h2>먼저 확인할 안전조건</h2>
            <p>{firstSafetyIssue?.title ?? "즉시 확인할 고위험 신호 없음"}</p>
          </article>
          <article className="wc-executive-priorities">
            <small>THREE DIRECTIONS</small>
            <h2>이번 리포트의 조정 방향</h2>
            <ol>{report.priorities.map((priority) => <li key={priority.rank}><span>0{priority.rank}</span><strong>{priority.title}</strong></li>)}</ol>
          </article>
        </div>
      </section>

      <section className="wc-number-grid" aria-label="자산 요약">
        <article><span>현재 총자산</span><strong>{formatKrw(totalAssets)}</strong><small>8개 자산군 합계</small></article>
        <article><span>현재 총부채</span><strong>{formatKrw(totalDebt)}</strong><small>총자산 대비 {formatPercent(report.cashflow.debtToAssetRatioPercent)}</small></article>
        <article><span>현재 순자산</span><strong>{formatKrw(report.level.netWorthKrw)}</strong><small>총자산 − 총부채</small></article>
        <article className="accent"><span>{report.level.terminal ? "L15 운영 기준" : `${report.level.next} 진입 순자산`}</span><strong>{formatKrw(report.level.targetNetWorthKrw)}</strong><small>{report.level.terminal ? "최상위 장기운영 구간" : `순자산 부족액 ${formatKrw(report.level.gapKrw)}`}</small></article>
      </section>

      <KoreaHouseholdContextPanel language={language} netWorthKrw={report.level.netWorthKrw} />

      <nav className="wc-report-nav" aria-label="리포트 바로가기">
        <span>입력 완결성 <strong>{confidenceLabel}</strong><small>{report.dataConfidence.message}</small></span>
        <a href="#report-priorities">01 우선순위</a><a href="#report-composition">02 자산구성</a><a href="#report-cashflow">03 현금흐름·위험</a><a href="#report-route">04 12개월 경로</a>
      </nav>

      {previousReport ? (
        <aside className="wc-report-comparison" aria-labelledby="report-comparison-title">
          <header>
            <div><span>SESSION COMPARISON</span><h2 id="report-comparison-title">변경 전과 비교</h2></div>
            <p>저장하지 않고 현재 입력 흐름 안에서만 이전 결과와 비교합니다.</p>
          </header>
          <div>
            <article><span>자산 구간</span><strong>{previousReport.level.current} <i>→</i> {report.level.current}</strong><small>{previousReport.level.current === report.level.current ? "구간 유지" : "새 입력 기준 재분류"}</small></article>
            <article><span>다음 구간 부족액</span><strong>{formatKrw(report.level.gapKrw)}</strong><small className={sameLevelBand ? (gapChangeKrw <= 0 ? "favorable" : "unfavorable") : undefined}>{sameLevelBand ? formatKrwChange(gapChangeKrw) : `기준 재설정 · ${formatKrwChange(gapChangeKrw)}`}</small></article>
            <article><span>월 잔여액</span><strong>{formatKrw(report.cashflow.monthlyBalanceKrw)}</strong><small className={monthlyBalanceChangeKrw >= 0 ? "favorable" : "unfavorable"}>{formatKrwChange(monthlyBalanceChangeKrw)}</small></article>
            <article><span>{dominantGap?.label ?? "주요 자산군"} 구성 차이</span><strong>{dominantGap ? `${dominantGap.gapPercentagePoints.toFixed(1)}%p` : "—"}</strong><small className={sameLevelBand ? (compositionGapChange <= 0 ? "favorable" : "unfavorable") : undefined}>{sameLevelBand ? formatPointChange(compositionGapChange) : `참고범위 변경 · ${formatPointChange(compositionGapChange)}`}</small></article>
          </div>
        </aside>
      ) : null}

      <section className="wc-report-section" id="report-priorities" aria-labelledby="report-priorities-title">
        <header className="wc-report-section-head compact"><div><span>01 / PRIORITY REVIEW</span><h2 id="report-priorities-title">지금 먼저 볼 구조 3가지</h2><p>위험, 입력 기준 월 현금흐름, 다음 구간 구성 차이 순서로 정리한 검토 가이드입니다.</p></div></header>
        <div className="wc-priority-list">
          {report.priorities.map((priority) => {
            const presentation = priorityPresentation(
              priority,
              report.interpretation.explanationOrderId,
            );
            return (
              <article data-reading-order={report.interpretation.explanationOrderId} key={priority.rank}>
                <div className="wc-priority-rank"><span>0{priority.rank}</span><i /></div>
                <div className="wc-priority-main"><span>{presentation.mainKicker}</span><h3>{priority.title}</h3><p>{presentation.mainBody}</p><div className="wc-priority-metric"><small>{presentation.metricLabel}</small><strong>{priority.metric}</strong></div></div>
                <div className="wc-priority-guide"><span>{presentation.sideKicker}</span><p>{presentation.sideBody}</p><div><small>확인 기준</small><strong>{priority.checkpoint}</strong></div>{priority.guardrail ? <em>{priority.guardrail}</em> : null}</div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wc-report-section wc-composition-section" id="report-composition" aria-labelledby="report-composition-title">
        <header className="wc-report-section-head">
          <div><span>02 / ASSET COMPOSITION</span><h2 id="report-composition-title">내 자산과 {report.level.terminal ? "L15" : "다음 구간"}의 구성 차이</h2><p>현재 비중과 내부 참고비중을 비교하고, 현재 부채가 유지된다는 단순 가정 아래 자산군별 참고 금액범위를 환산했습니다.</p></div>
          <div className={`wc-confidence ${report.dataConfidence.grade}`}><small>비교 기준 총자산</small><strong>{formatKrw(targetGrossAssets)}</strong><span>{report.level.terminal ? "현재 총자산 기준" : `${report.level.next} 순자산 기준 + 현재 총부채`}</span></div>
        </header>

        <div className="wc-composition-overview">
          <div className="wc-stack-row">
            <span>내 구성</span>
            <div className="wc-stacked-bar" role="img" aria-label={report.composition.map((item) => `${item.label} ${item.currentSharePercent.toFixed(1)}%`).join(", ")}>{report.composition.map((item) => <i key={item.key} title={`${item.label} ${item.currentSharePercent.toFixed(1)}%`} style={{ width: `${Math.max(0, item.currentSharePercent)}%`, backgroundColor: COMPOSITION_COLORS[item.key] }} />)}</div>
          </div>
          <div className="wc-stack-row reference">
            <span>참고 중심</span>
            <div className="wc-stacked-bar" role="img" aria-label={report.composition.map((item) => `${item.label} 참고 중심 ${item.referenceMidPercent.toFixed(1)}%`).join(", ")}>{report.composition.map((item) => <i key={item.key} title={`${item.label} ${item.referenceMidPercent.toFixed(1)}%`} style={{ width: `${Math.max(0, item.referenceMidPercent)}%`, backgroundColor: COMPOSITION_COLORS[item.key] }} />)}</div>
          </div>
          <div className="wc-composition-legend">{report.composition.map((item) => <span key={item.key}><i style={{ backgroundColor: COMPOSITION_COLORS[item.key] }} />{item.label}</span>)}</div>
        </div>

        <details className="wc-report-disclosure wc-composition-disclosure">
          <summary><span>8개 자산군 상세 비교</span><small>금액·비중·내부 참고범위 전체 보기</small><i aria-hidden="true">+</i></summary>
          <div>
            <div className="wc-composition-table" role="table" aria-label="자산구성 비교표">
              <div className="wc-composition-table-head" role="row"><span role="columnheader">자산군</span><span role="columnheader">내 금액</span><span role="columnheader">내 비중</span><span role="columnheader">참고비중</span><span role="columnheader">다음 구간 금액범위</span><span role="columnheader">참고 하단까지</span></div>
              {report.composition.map((item) => {
                const marker = Math.max(0, Math.min(100, item.currentSharePercent));
                const referenceMinKrw = Math.round((targetGrossAssets * item.referenceMinPercent) / 100);
                const referenceMaxKrw = Math.round((targetGrossAssets * item.referenceMaxPercent) / 100);
                return (
                  <div className={`wc-composition-row ${item.direction}`} role="row" key={item.key}>
                    <div className="wc-composition-name" role="cell"><i style={{ backgroundColor: COMPOSITION_COLORS[item.key] }} /><span><strong>{item.label}</strong><small>{compositionStatus(item.direction)} · {directionCopy(item.direction, item.gapPercentagePoints)}</small></span></div>
                    <strong role="cell" data-label="내 금액">{formatKrw(item.currentAmountKrw, true)}</strong>
                    <strong role="cell" data-label="내 비중">{formatPercent(item.currentSharePercent)}</strong>
                    <div className="wc-range-cell" role="cell" data-label="참고비중"><span>{item.referenceMinPercent.toFixed(1)}–{item.referenceMaxPercent.toFixed(1)}%</span><div><i style={{ left: `${item.referenceMinPercent}%`, width: `${Math.max(1, item.referenceMaxPercent - item.referenceMinPercent)}%` }} /><b style={{ left: `calc(${marker}% - 4px)` }} /></div></div>
                    <div className="wc-target-amount" role="cell" data-label="다음 구간 금액범위"><strong>{formatKrw(referenceMinKrw, true)}–{formatKrw(referenceMaxKrw, true)}</strong><small>현재 부채 유지 가정</small></div>
                    <div className="wc-gap-cell" role="cell" data-label="참고 하단까지"><strong>{item.estimatedGapKrw > 0 ? formatKrw(item.estimatedGapKrw, true) : "하단 충족"}</strong><small>{item.estimatedGapKrw > 0 ? "참고 하단과의 차이" : "추가 부족액 없음"}</small></div>
                  </div>
                );
              })}
            </div>
            <p className="wc-inline-disclaimer">금액범위와 부족액은 현재 부채가 그대로 유지된다는 단순 비교 가정입니다. 실제로는 자산 증가와 부채 감소의 조합에 따라 달라지며, 즉시 매수·매도할 금액이 아닙니다. 거주용·수익형 부동산, 사업·비상장, 대체자산의 낮은 비중은 취득 필요로 해석하지 않습니다.</p>
          </div>
        </details>
      </section>

      <section className="wc-dual-section" id="report-cashflow" aria-label="현금흐름과 위험 진단">
        <article className="wc-report-section wc-cashflow-card">
          <header className="wc-report-section-head compact"><div><span>03 / MONTHLY FLOW</span><h2>입력 기준 한 달의 잔여액</h2></div></header>
          <div className={`wc-cashflow-hero ${report.cashflow.monthlyBalanceKrw < 0 ? "negative" : ""}`}><span>{report.cashflow.monthlyBalanceKrw < 0 ? "입력 기준 월 부족액" : "입력 기준 월 잔여액"}</span><strong>{formatKrw(Math.abs(report.cashflow.monthlyBalanceKrw))}</strong><small>세후소득 − 필수생활비 − 부채상환액 · 비정기 지출 전</small></div>
          <dl>
            <div><dt>월 세후소득</dt><dd>{formatKrw(report.cashflow.monthlyIncomeKrw)}</dd></div>
            <div><dt>필수생활비</dt><dd>{formatKrw(report.cashflow.monthlyLivingExpenseKrw)} <small>{formatPercent(report.cashflow.livingCostRatioPercent)}</small></dd></div>
            <div><dt>월 부채상환</dt><dd>{formatKrw(report.cashflow.monthlyDebtPaymentKrw)} <small>{formatPercent(report.cashflow.debtServiceRatioPercent)} · 세후소득 입력기준, 규제상 DSR 아님</small></dd></div>
            <div><dt>현금성 여유</dt><dd>{report.cashflow.liquidRunwayMonths === null ? "확인 필요" : `${report.cashflow.liquidRunwayMonths.toFixed(1)}개월`} <small>생활비+상환</small></dd></div>
            <div><dt>순자산 / 연소득</dt><dd>{formatMultiple(report.cashflow.netWorthToAnnualIncomeMultiple)}</dd></div>
          </dl>
        </article>

        <article className="wc-report-section wc-risk-card">
          <header className="wc-report-section-head compact"><div><span>04 / RISK CHECK</span><h2>구조 변경 전에 확인할 위험</h2></div></header>
          {report.risks.length > 0 ? <div className="wc-risk-list">{report.risks.map((risk, index) => <div className={risk.severity} key={`${risk.title}-${index}`}><span>{risk.severity === "critical" ? "우선 확인" : "관찰"}</span><div><strong>{risk.title}</strong><p>{risk.description}</p></div></div>)}</div> : <div className="wc-risk-clear"><span>✓</span><div><strong>즉시 확인할 고위험 신호가 없습니다.</strong><p>구성 차이와 입력 기준 월 현금흐름을 중심으로 검토할 수 있습니다.</p></div></div>}
        </article>
      </section>

      <section className="wc-report-section wc-route-section" id="report-route" aria-labelledby="report-route-title">
        <header className="wc-report-section-head"><div><span>05 / STRUCTURE ROUTE</span><h2 id="report-route-title">{report.route.title}</h2><p>{report.route.summary}</p></div></header>
        <div className="wc-route-line">
          {report.route.stages.map((stage, index) => <article key={`${stage.horizon}-${index}`}><div><span>0{index + 1}</span><i /></div><small>{stage.horizon}</small><h3>{stage.title}</h3><p>{stage.description}</p><Chevron /></article>)}
        </div>
      </section>

      <section className="wc-evidence-contract" aria-labelledby="wc-evidence-contract-title">
        <header><span>REPORT EVIDENCE CONTRACT</span><h2 id="wc-evidence-contract-title">{language === "en" ? "What this report calculates—and what it does not claim" : "이 리포트가 계산한 것과 주장하지 않는 것"}</h2></header>
        <div>
          <article><small>01 / INPUT</small><strong>{language === "en" ? "One household snapshot" : "같은 기준일의 가구 입력"}</strong><p>{language === "en" ? "Eight asset groups, debt and monthly flow are validated under one strict request contract." : "8개 자산군·부채·월 흐름을 하나의 엄격한 입력 계약으로 검증합니다."}</p></article>
          <article><small>02 / CALCULATION</small><strong>{language === "en" ? "Deterministic financial facts" : "결정론적 금융 계산"}</strong><p>{language === "en" ? "Net worth, band, ratios, safeguards and amount differences are calculated by server policy." : "순자산·구간·비율·안전조건·금액 차이는 서버 정책으로 계산합니다."}</p></article>
          <article><small>03 / REFERENCE</small><strong>{language === "en" ? "Versioned internal ranges" : "버전이 고정된 내부 참고범위"}</strong><p>{language === "en" ? "The eight-group ranges are diagnostic policy references, not personalized peer matches or observed household portfolios." : "8개 자산군 범위는 진단용 정책 참고값이며 개인화된 유사가구 매칭이나 관측 가구 포트폴리오가 아닙니다."}</p></article>
          <article><small>04 / LIMIT</small><strong>{language === "en" ? "No forecast or trade instruction" : "예측·거래지시 아님"}</strong><p>{language === "en" ? "No expected return, promotion date, product or buy/sell instruction is produced." : "기대수익률·승급시점·상품·매수·매도 지시는 만들지 않습니다."}</p></article>
        </div>
      </section>

      <footer className="wc-report-footer">
        <details className="wc-methodology-disclosure">
          <summary><span>{report.methodology.label}</span><strong>산정 기준과 유의사항 보기 · {report.methodology.version}</strong><i aria-hidden="true">+</i></summary>
          <p>{report.methodology.disclaimer}</p>
        </details>
        <button type="button" onClick={onRestart}>{language === "en" ? "Edit inputs" : "입력값 수정"}</button>
      </footer>
    </main>
  );
}
