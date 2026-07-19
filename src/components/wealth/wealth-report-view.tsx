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
  if (direction === "below") return "참고비중 아래";
  if (direction === "above") return "참고비중 위";
  return "참고비중 안";
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
  const totalDebt = Math.max(0, totalAssets - report.level.netWorthKrw);
  const targetGrossAssets = report.level.terminal
    ? totalAssets
    : report.level.targetNetWorthKrw + totalDebt;
  const criticalRisks = report.risks.filter((risk) => risk.severity === "critical");
  const warningRisks = report.risks.filter((risk) => risk.severity !== "critical");
  const summaryRisks = criticalRisks.length > 0 ? criticalRisks : warningRisks;
  const confidenceLabel = {
    high: "높음",
    medium: "보통",
    low: "확인 필요",
  }[report.dataConfidence.grade];

  return (
    <main className="wc-report-shell wc-rise">
      <header className="wc-report-masthead">
        <div><span>WEALTHCOPY STRUCTURE REPORT</span><strong>{generatedLabel}</strong></div>
        <div><button type="button" onClick={() => window.print()}><PrintIcon /> 인쇄·PDF 저장</button><button type="button" onClick={onRestart}>입력값 수정</button></div>
      </header>

      <section className="wc-report-hero" aria-label="현재와 다음 자산 구간">
        <div className="wc-level-story">
          <span className="wc-report-kicker">NEXT WEALTH BAND</span>
          {report.level.terminal ? (
            <div className="wc-level-pair terminal">
              <div className="target"><small>현재 최상위 구간</small><strong>{report.level.current}</strong><span>{report.level.currentLabel}</span></div>
            </div>
          ) : (
            <div className="wc-level-pair">
              <div><small>현재</small><strong>{report.level.current}</strong><span>{report.level.currentLabel}</span></div>
              <i><svg aria-hidden="true" width="34" height="20" viewBox="0 0 34 20" fill="none"><path d="M1 10h30M23 2l8 8-8 8" stroke="currentColor" strokeWidth="1.7" /></svg></i>
              <div className="target"><small>다음</small><strong>{report.level.next}</strong><span>{report.level.nextLabel}</span></div>
            </div>
          )}
          <h1 tabIndex={-1}>{isGuarded ? "지금은 자산 확대보다 구조 안정화가 먼저입니다." : report.level.terminal ? "최상위 구간에서는 자산보다 운영체계를 봅니다." : `다음 구간까지 ${formatKrw(report.level.gapKrw)} 남았습니다.`}</h1>
          <p>{isGuarded ? "상위 구간 참고구성은 그대로 보여드리되, 유동성과 부채 위험을 먼저 정리한 뒤 구성 변화를 검토합니다." : "순자산 격차와 자산구성 차이를 분리해, 지금 가장 먼저 살펴볼 구조를 정리했습니다."}</p>
        </div>

        <div className={`wc-position-card ${report.level.current === "L1" || report.level.terminal ? "qualitative" : ""}`}>
          <div className="wc-position-ring" style={{ "--position": `${position * 3.6}deg` } as CSSProperties}>
            <div>
              <small>{report.level.current === "L1" ? "순자산 회복 필요" : report.level.terminal ? "장기 운영 구간" : "현재 구간 위치"}</small>
              {report.level.current === "L1" ? <strong className="text-value">{formatKrw(Math.abs(report.level.netWorthKrw), true)}</strong> : report.level.terminal ? <strong className="text-value">L15</strong> : <strong>{position.toFixed(0)}<em>%</em></strong>}
            </div>
          </div>
          {!report.level.terminal && report.level.current !== "L1" ? <div className="wc-position-scale"><span>{report.level.current}</span><i><b style={{ width: `${position}%` }} /></i><span>{report.level.next}</span></div> : null}
          <p>{report.level.current === "L1" ? "순자산이 0원 이상이 될 때 L2 기반 구간으로 이동합니다." : report.level.terminal ? "다음 자동 레벨 없이 유동성·집중·권한·승계의 운영 품질을 봅니다." : <><strong>순자산 기준</strong>으로 계산한 현재 구간의 위치입니다.</>}</p>
        </div>
      </section>

      <section className="wc-number-grid" aria-label="자산 요약">
        <article><span>현재 총자산</span><strong>{formatKrw(totalAssets)}</strong><small>8개 자산군 합계</small></article>
        <article><span>현재 총부채</span><strong>{formatKrw(totalDebt)}</strong><small>총자산 대비 {formatPercent(report.cashflow.debtToAssetRatioPercent)}</small></article>
        <article><span>현재 순자산</span><strong>{formatKrw(report.level.netWorthKrw)}</strong><small>총자산 − 총부채</small></article>
        <article className="accent"><span>{report.level.terminal ? "L15 운영 기준" : `${report.level.next} 진입 순자산`}</span><strong>{formatKrw(report.level.targetNetWorthKrw)}</strong><small>{report.level.terminal ? "최상위 장기운영 구간" : `순자산 부족액 ${formatKrw(report.level.gapKrw)}`}</small></article>
      </section>

      <section className={`wc-report-brief ${isGuarded ? "guarded" : ""}`} id="report-summary" aria-labelledby="report-summary-title">
        <header>
          <div><span>REPORT SUMMARY</span><h2 id="report-summary-title">먼저 확인할 핵심</h2></div>
          <nav aria-label="리포트 바로가기"><a href="#report-priorities">우선순위</a><a href="#report-composition">자산구성</a><a href="#report-cashflow">현금흐름·위험</a><a href="#report-route">12개월 경로</a></nav>
        </header>
        <div className="wc-brief-grid">
          <article className="wc-brief-safety"><small>{isGuarded ? "SAFETY FIRST" : "RISK CONTEXT"}</small><h3>{isGuarded ? `${criticalRisks.length}개 안전조건을 먼저 확인` : summaryRisks.length > 0 ? "경로에 반영할 조건" : "즉시 중단할 위험 없음"}</h3>{summaryRisks.length > 0 ? <ul>{summaryRisks.slice(0, 3).map((risk) => <li key={risk.title}>{risk.title}</li>)}</ul> : <p>입력값에서 즉시 구조 변경을 멈출 고위험 신호는 확인되지 않았습니다.</p>}</article>
          <article><small>TOP 3 REVIEW</small><h3>지금 먼저 볼 구조</h3><ol>{report.priorities.map((priority) => <li key={priority.rank}><span>0{priority.rank}</span>{priority.title}</li>)}</ol></article>
          <article className={`wc-brief-confidence ${report.dataConfidence.grade}`}><small>INPUT COMPLETENESS</small><h3>입력 완결성 {confidenceLabel}</h3><p>{report.dataConfidence.message}</p></article>
        </div>
      </section>

      <section className="wc-report-section" id="report-priorities" aria-labelledby="report-priorities-title">
        <header className="wc-report-section-head compact"><div><span>01 / PRIORITY REVIEW</span><h2 id="report-priorities-title">지금 먼저 볼 구조 3가지</h2><p>위험, 입력 기준 월 현금흐름, 다음 구간 구성 차이 순서로 정리한 검토 가이드입니다.</p></div></header>
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
      </section>

      <section className="wc-dual-section" id="report-cashflow" aria-label="현금흐름과 위험 진단">
        <article className="wc-report-section wc-cashflow-card">
          <header className="wc-report-section-head compact"><div><span>03 / MONTHLY FLOW</span><h2>입력 기준 한 달의 잔여액</h2></div></header>
          <div className={`wc-cashflow-hero ${report.cashflow.monthlyBalanceKrw < 0 ? "negative" : ""}`}><span>{report.cashflow.monthlyBalanceKrw < 0 ? "입력 기준 월 부족액" : "입력 기준 월 잔여액"}</span><strong>{formatKrw(Math.abs(report.cashflow.monthlyBalanceKrw))}</strong><small>세후소득 − 필수생활비 − 부채상환액 · 비정기 지출 전</small></div>
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
          {report.risks.length > 0 ? <div className="wc-risk-list">{report.risks.map((risk, index) => <div className={risk.severity} key={`${risk.title}-${index}`}><span>{risk.severity === "critical" ? "우선 확인" : "관찰"}</span><div><strong>{risk.title}</strong><p>{risk.description}</p></div></div>)}</div> : <div className="wc-risk-clear"><span>✓</span><div><strong>즉시 확인할 고위험 신호가 없습니다.</strong><p>구성 차이와 입력 기준 월 현금흐름을 중심으로 검토할 수 있습니다.</p></div></div>}
        </article>
      </section>

      <section className="wc-report-section wc-route-section" id="report-route" aria-labelledby="report-route-title">
        <header className="wc-report-section-head"><div><span>05 / STRUCTURE ROUTE</span><h2 id="report-route-title">{report.route.title}</h2><p>{report.route.summary}</p></div></header>
        <div className="wc-route-line">
          {report.route.stages.map((stage, index) => <article key={`${stage.horizon}-${index}`}><div><span>0{index + 1}</span><i /></div><small>{stage.horizon}</small><h3>{stage.title}</h3><p>{stage.description}</p><Chevron /></article>)}
        </div>
      </section>

      <footer className="wc-report-footer">
        <div><span>{report.methodology.label}</span><strong>내부 비교 기준 · 결과 저장 안 함</strong></div>
        <p>{report.methodology.disclaimer}</p>
        <button type="button" onClick={onRestart}>입력값 수정</button>
      </footer>
    </main>
  );
}
