"use client";

import type { CSSProperties } from "react";

import type { WealthReport } from "@/lib/wealth/wealth-report";

type WealthReportViewProps = {
  report: WealthReport;
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

function compositionStatus(direction: "below" | "within" | "above") {
  if (direction === "below") return "참고범위 아래";
  if (direction === "above") return "참고범위 위";
  return "참고범위 안";
}

function directionCopy(direction: "below" | "within" | "above", gapPercentagePoints: number) {
  if (direction === "within") return "범위 안";
  return `${gapPercentagePoints.toFixed(1)}%p ${direction === "below" ? "차이" : "초과"}`;
}

function PrintIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8V3h10v5M7 17H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2" /><path d="M7 14h10v7H7z" /></svg>;
}

function Chevron() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;
}

export function WealthReportView({ report, onRestart }: WealthReportViewProps) {
  const generatedLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(report.generatedAt));

  const position = Math.max(0, Math.min(100, report.level.positionPercent));
  const isGuarded = report.risks.some((risk) => risk.severity === "critical");
  const totalAssets = report.composition.reduce((sum, item) => sum + item.currentAmountKrw, 0);
  const confidenceLabel = {
    high: "높음",
    medium: "보통",
    low: "확인 필요",
  }[report.dataConfidence.grade];

  return (
    <main className="wc-report-shell wc-rise">
      <header className="wc-report-masthead">
        <div><span>WEALTHCOPY STRUCTURE REPORT</span><strong>{generatedLabel}</strong></div>
        <div><button type="button" onClick={() => window.print()}><PrintIcon /> 인쇄·PDF 저장</button><button type="button" onClick={onRestart}>정보 업데이트</button></div>
      </header>

      <section className="wc-report-hero">
        <div className="wc-level-story">
          <span className="wc-report-kicker">NEXT WEALTH BAND</span>
          <div className="wc-level-pair">
            <div><small>현재</small><strong>{report.level.current}</strong><span>{report.level.currentLabel}</span></div>
            <i><svg aria-hidden="true" width="34" height="20" viewBox="0 0 34 20" fill="none"><path d="M1 10h30M23 2l8 8-8 8" stroke="currentColor" strokeWidth="1.7" /></svg></i>
            <div className="target"><small>{report.level.terminal ? "유지" : "다음"}</small><strong>{report.level.next}</strong><span>{report.level.nextLabel}</span></div>
          </div>
          <h1 tabIndex={-1}>{isGuarded ? "지금은 자산 확대보다 구조 안정화가 먼저입니다." : report.level.terminal ? "최상위 구간에서는 자산보다 운영체계를 봅니다." : `다음 구간까지 ${formatKrw(report.level.gapKrw)} 남았습니다.`}</h1>
          <p>{isGuarded ? "상위 구간 참고구성은 그대로 보여드리되, 유동성과 부채 위험을 먼저 정리한 뒤 구성 변화를 검토합니다." : "순자산 격차와 자산구성 차이를 분리해, 지금 가장 먼저 살펴볼 구조를 정리했습니다."}</p>
        </div>

        <div className="wc-position-card">
          <div className="wc-position-ring" style={{ "--position": `${position * 3.6}deg` } as CSSProperties}>
            <div><small>현재 구간 위치</small><strong>{position.toFixed(0)}<em>%</em></strong></div>
          </div>
          <div className="wc-position-scale"><span>{report.level.current}</span><i><b style={{ width: `${position}%` }} /></i><span>{report.level.next}</span></div>
          <p><strong>순자산 기준</strong>으로 계산한 현재 구간의 위치입니다.</p>
        </div>
      </section>

      <section className="wc-number-grid">
        <article><span>현재 총자산</span><strong>{formatKrw(totalAssets)}</strong><small>8개 자산군 합계</small></article>
        <article><span>현재 순자산</span><strong>{formatKrw(report.level.netWorthKrw)}</strong><small>총자산 − 총부채</small></article>
        <article className="accent"><span>{report.level.terminal ? "L15 기준" : `${report.level.next} 진입 기준`}</span><strong>{formatKrw(report.level.targetNetWorthKrw)}</strong><small>{report.level.terminal ? "최상위 운영 구간" : `부족액 ${formatKrw(report.level.gapKrw)}`}</small></article>
        <article><span>부채 / 총자산</span><strong>{formatPercent(report.cashflow.debtToAssetRatioPercent)}</strong><small>월 상환부담 {formatPercent(report.cashflow.debtServiceRatioPercent)}</small></article>
      </section>

      <section className="wc-report-section wc-composition-section">
        <header className="wc-report-section-head">
          <div><span>01 / ASSET COMPOSITION</span><h2>내 자산과 다음 구간의 구성 차이</h2><p>각 자산군의 현재 비중을 {report.level.next} 내부 참고범위와 비교했습니다.</p></div>
          <div className={`wc-confidence ${report.dataConfidence.grade}`}><small>입력 완결성</small><strong>{confidenceLabel}</strong><span>{report.dataConfidence.message}</span></div>
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

        <div className="wc-composition-table" role="table" aria-label="자산구성 비교표">
          <div className="wc-composition-table-head" role="row"><span role="columnheader">자산군</span><span role="columnheader">내 금액</span><span role="columnheader">내 비중</span><span role="columnheader">다음 구간 참고범위</span><span role="columnheader">구성 차이</span></div>
          {report.composition.map((item) => {
            const marker = Math.max(0, Math.min(100, item.currentSharePercent));
            return (
              <div className={`wc-composition-row ${item.direction}`} role="row" key={item.key}>
                <div className="wc-composition-name" role="cell"><i style={{ backgroundColor: COMPOSITION_COLORS[item.key] }} /><span><strong>{item.label}</strong><small>{compositionStatus(item.direction)}</small></span></div>
                <strong role="cell" data-label="내 금액">{formatKrw(item.currentAmountKrw, true)}</strong>
                <strong role="cell" data-label="내 비중">{formatPercent(item.currentSharePercent)}</strong>
                <div className="wc-range-cell" role="cell" data-label="참고범위"><span>{item.referenceMinPercent.toFixed(0)}–{item.referenceMaxPercent.toFixed(0)}%</span><div><i style={{ left: `${item.referenceMinPercent}%`, width: `${Math.max(1, item.referenceMaxPercent - item.referenceMinPercent)}%` }} /><b style={{ left: `calc(${marker}% - 4px)` }} /></div></div>
                <div className="wc-gap-cell" role="cell" data-label="구성 차이"><strong>{directionCopy(item.direction, item.gapPercentagePoints)}</strong><small>{item.direction === "within" ? "참고범위 안" : `현재 총자산 기준 ${formatKrw(item.estimatedGapKrw, true)}`}</small></div>
              </div>
            );
          })}
        </div>
        <p className="wc-inline-disclaimer">원화 환산 차이는 즉시 매수·매도할 금액이 아니라 현재 구성을 이해하기 위한 환산치입니다. 거주용·수익형 부동산, 사업·비상장, 대체자산의 낮은 비중은 취득 필요로 해석하지 않습니다.</p>
      </section>

      <section className="wc-report-section">
        <header className="wc-report-section-head compact"><div><span>02 / PRIORITY REVIEW</span><h2>지금 먼저 볼 구조 3가지</h2><p>위험, 현금흐름, 구성 차이 순서로 정리한 검토 가이드입니다.</p></div></header>
        <div className="wc-priority-list">
          {report.priorities.map((priority) => (
            <article key={priority.rank}>
              <div className="wc-priority-rank"><span>0{priority.rank}</span><i /></div>
              <div className="wc-priority-main"><span>PRIORITY {priority.rank}</span><h3>{priority.title}</h3><p>{priority.diagnosis}</p><div className="wc-priority-metric"><small>현재 진단</small><strong>{priority.metric}</strong></div></div>
              <div className="wc-priority-guide"><span>조정 가이드</span><p>{priority.guidance}</p><div><small>확인 기준</small><strong>{priority.checkpoint}</strong></div>{priority.guardrail ? <em>{priority.guardrail}</em> : null}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="wc-dual-section">
        <article className="wc-report-section wc-cashflow-card">
          <header className="wc-report-section-head compact"><div><span>03 / MONTHLY FLOW</span><h2>한 달의 자금 여력</h2></div></header>
          <div className={`wc-cashflow-hero ${report.cashflow.monthlyBalanceKrw < 0 ? "negative" : ""}`}><span>{report.cashflow.monthlyBalanceKrw < 0 ? "월 부족액" : "월 조정 가능액"}</span><strong>{formatKrw(Math.abs(report.cashflow.monthlyBalanceKrw))}</strong><small>세후소득에서 필수생활비와 부채상환액을 제외</small></div>
          <dl>
            <div><dt>월 세후소득</dt><dd>{formatKrw(report.cashflow.monthlyIncomeKrw)}</dd></div>
            <div><dt>필수생활비</dt><dd>{formatKrw(report.cashflow.monthlyLivingExpenseKrw)} <small>{formatPercent(report.cashflow.livingCostRatioPercent)}</small></dd></div>
            <div><dt>월 부채상환</dt><dd>{formatKrw(report.cashflow.monthlyDebtPaymentKrw)} <small>{formatPercent(report.cashflow.debtServiceRatioPercent)}</small></dd></div>
            <div><dt>현금성 여유</dt><dd>{report.cashflow.liquidRunwayMonths === null ? "확인 필요" : `${report.cashflow.liquidRunwayMonths.toFixed(1)}개월`} <small>생활비+상환</small></dd></div>
            <div><dt>순자산 / 연소득</dt><dd>{formatMultiple(report.cashflow.netWorthToAnnualIncomeMultiple)}</dd></div>
          </dl>
        </article>

        <article className="wc-report-section wc-risk-card">
          <header className="wc-report-section-head compact"><div><span>04 / RISK CHECK</span><h2>구조 변경 전에 확인할 위험</h2></div></header>
          {report.risks.length > 0 ? <div className="wc-risk-list">{report.risks.map((risk, index) => <div className={risk.severity} key={`${risk.title}-${index}`}><span>{risk.severity === "critical" ? "우선 확인" : "관찰"}</span><div><strong>{risk.title}</strong><p>{risk.description}</p></div></div>)}</div> : <div className="wc-risk-clear"><span>✓</span><div><strong>즉시 확인할 고위험 신호가 없습니다.</strong><p>구성 차이와 월 현금흐름을 중심으로 검토할 수 있습니다.</p></div></div>}
        </article>
      </section>

      <section className="wc-report-section wc-route-section">
        <header className="wc-report-section-head"><div><span>05 / STRUCTURE ROUTE</span><h2>{report.route.title}</h2><p>{report.route.summary}</p></div></header>
        <div className="wc-route-line">
          {report.route.stages.map((stage, index) => <article key={`${stage.horizon}-${index}`}><div><span>0{index + 1}</span><i /></div><small>{stage.horizon}</small><h3>{stage.title}</h3><p>{stage.description}</p><Chevron /></article>)}
        </div>
      </section>

      <footer className="wc-report-footer">
        <div><span>{report.methodology.label}</span><strong>{report.methodology.version}</strong></div>
        <p>{report.methodology.disclaimer}</p>
        <button type="button" onClick={onRestart}>내 자산 정보 업데이트</button>
      </footer>
    </main>
  );
}
