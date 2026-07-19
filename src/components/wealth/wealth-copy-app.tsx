"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  ASSET_COMPOSITION_KEYS,
  wealthReportSchema,
  type AssetCompositionKey,
  type WealthReport,
} from "@/lib/wealth/wealth-report";

import { WealthLogo } from "./logo";
import { WealthReportView } from "./wealth-report-view";

type MoneyUnit = "manwon" | "eok";
type SetupStep = 1 | 2 | 3;
type IncomeStability = "stable" | "variable" | "uncertain";
type Next90DayEvent =
  | "none"
  | "housing"
  | "career"
  | "business"
  | "large_expense";

type SetupState = {
  assetUnit: MoneyUnit;
  assets: Record<AssetCompositionKey, string>;
  totalDebt: string;
  monthlyIncome: string;
  monthlyLivingExpense: string;
  monthlyDebtPayment: string;
  incomeStability: IncomeStability;
  next90DayEvent: Next90DayEvent;
  next90DayAmount: string;
  constraintNote: string;
};

const KRW_PER_MANWON = 10_000;
const KRW_PER_EOK = 100_000_000;
const REPORT_TIMEOUT_MS = 25_000;
const SESSION_KEY = "wealthcopy-anonymous-session-v2";
const LEGACY_STORAGE_KEYS = [
  "wealthcopy-public-plan-v5",
  "wealthcopy-public-plan-v4",
  "wealthcopy-public-plan-v3",
  "wealthcopy-public-plan-v2",
  "wealthcopy-demo-plan-v1",
  "wealthcopy-action-history-v1",
] as const;

const ASSET_META: Record<
  AssetCompositionKey,
  { label: string; description: string; index: string }
> = {
  liquid: {
    label: "현금성·단기예치",
    description: "현금, 예·적금, CMA, MMF",
    index: "01",
  },
  home: {
    label: "거주용 자산",
    description: "실거주 주택, 임차보증금",
    index: "02",
  },
  market: {
    label: "상장 금융자산",
    description: "주식, 채권, ETF, 공모펀드, 상장 REIT",
    index: "03",
  },
  pension: {
    label: "연금·장기계정",
    description: "연금저축, IRP, 퇴직연금",
    index: "04",
  },
  incomeProperty: {
    label: "수익형 부동산",
    description: "임대주택, 상가, 토지, 부동산 지분",
    index: "05",
  },
  businessPrivate: {
    label: "사업·비상장지분",
    description: "본인 사업체, 비상장주식, 사모지분",
    index: "06",
  },
  alternatives: {
    label: "대체·헤지자산",
    description: "금, 원자재, 가상자산, 수집품",
    index: "07",
  },
  other: {
    label: "기타·회수예정",
    description: "보험 환급금, 받을 돈, 차량, 분류 대기",
    index: "08",
  },
};

const EMPTY_ASSETS = Object.fromEntries(
  ASSET_COMPOSITION_KEYS.map((key) => [key, ""]),
) as Record<AssetCompositionKey, string>;

const INITIAL_SETUP: SetupState = {
  assetUnit: "eok",
  assets: EMPTY_ASSETS,
  totalDebt: "",
  monthlyIncome: "",
  monthlyLivingExpense: "",
  monthlyDebtPayment: "",
  incomeStability: "stable",
  next90DayEvent: "none",
  next90DayAmount: "",
  constraintNote: "",
};

const inputClassName = "wc-input";

function parseNonNegative(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function amountToKrw(value: string, unit: MoneyUnit) {
  const parsed = parseNonNegative(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * (unit === "eok" ? KRW_PER_EOK : KRW_PER_MANWON));
}

function monthlyToKrw(value: string) {
  const parsed = parseNonNegative(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * KRW_PER_MANWON);
}

function formatKrw(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0원";
  if (Math.abs(value) < KRW_PER_MANWON) return `${value.toLocaleString("ko-KR")}원`;

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const eok = Math.floor(absolute / KRW_PER_EOK);
  const manwon = Math.floor((absolute % KRW_PER_EOK) / KRW_PER_MANWON);

  if (eok > 0 && manwon > 0) {
    return `${sign}${eok.toLocaleString("ko-KR")}억 ${manwon.toLocaleString("ko-KR")}만원`;
  }
  if (eok > 0) return `${sign}${eok.toLocaleString("ko-KR")}억원`;
  return `${sign}${manwon.toLocaleString("ko-KR")}만원`;
}

function makeSessionId() {
  const cryptoApi = typeof globalThis.crypto === "undefined"
    ? undefined
    : globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) return existing;
    const created = makeSessionId();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return makeSessionId();
  }
}

function cleanupLegacyStorage() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in private browsing. The report still works.
    }
  }
}

function Icon({ name }: { name: "arrow" | "lock" | "report" | "layers" | "route" | "spark" }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "arrow") {
    return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  }
  if (name === "lock") {
    return <svg {...common}><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></svg>;
  }
  if (name === "layers") {
    return <svg {...common}><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></svg>;
  }
  if (name === "route") {
    return <svg {...common}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h2a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4" /></svg>;
  }
  if (name === "spark") {
    return <svg {...common}><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" /><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></svg>;
  }
  return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>;
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="wc-landing">
      <section className="wc-hero">
        <div className="wc-hero-copy wc-rise">
          <div className="wc-eyebrow"><span /> WEALTH STRUCTURE REPORT</div>
          <h1 tabIndex={-1}>
            지금 가진 자산을,
            <br />
            <em>다음 구간의 구조</em>와
            <br />
            비교합니다.
          </h1>
          <p>
            총액만 보는 자산관리를 넘어, 내 윗구간은 무엇으로 구성되어 있고
            나는 어디가 얼마나 다른지 한 번에 진단합니다.
          </p>
          <div className="wc-hero-actions">
            <button className="wc-primary-button" type="button" onClick={onStart}>
              내 자산 리포트 만들기 <Icon name="arrow" />
            </button>
            <span className="wc-privacy-note"><Icon name="lock" /> 입력 금액은 브라우저에 저장하지 않습니다</span>
          </div>
        </div>

        <div className="wc-preview-card wc-rise" aria-label="리포트 구성 미리보기">
          <div className="wc-preview-head">
            <div><span>STRUCTURE PREVIEW</span><strong>L6 <i /> L7</strong></div>
            <div className="wc-preview-score"><small>구간 위치</small><b>42%</b></div>
          </div>
          <div className="wc-preview-gap">
            <span>다음 구간까지 남은 순자산</span>
            <strong>1억 4,800만원</strong>
          </div>
          <div className="wc-preview-bars">
            <div><span>내 구성</span><i className="seg-a" /><i className="seg-b" /><i className="seg-c" /><i className="seg-d" /></div>
            <div><span>참고 구성</span><i className="seg-a ref" /><i className="seg-b ref" /><i className="seg-c ref" /><i className="seg-d ref" /></div>
          </div>
          <div className="wc-preview-insight">
            <Icon name="spark" />
            <p><span>가장 큰 구조 차이</span><strong>상장 금융자산 · 참고범위까지 7.0%p</strong></p>
          </div>
          <div className="wc-preview-watermark">WEALTHCOPY / SAMPLE</div>
        </div>
      </section>

      <section className="wc-value-grid" aria-label="리포트에서 확인할 내용">
        <article><span><Icon name="report" /></span><small>01 / LEVEL GAP</small><h2>얼마나 부족한가</h2><p>현재 순자산, 다음 레벨 기준, 남은 금액을 원화로 연결합니다.</p></article>
        <article><span><Icon name="layers" /></span><small>02 / COMPOSITION</small><h2>무엇이 다른가</h2><p>8개 자산군을 다음 구간의 내부 참고범위와 나란히 비교합니다.</p></article>
        <article><span><Icon name="route" /></span><small>03 / PRIORITY</small><h2>무엇부터 바꿀까</h2><p>유동성·부채 위험을 먼저 확인하고 가장 큰 구성 차이를 정리합니다.</p></article>
      </section>
    </main>
  );
}

function StepRail({ step }: { step: SetupStep }) {
  const labels = ["자산 구성", "부채·현금흐름", "상황 확인"];
  return (
    <ol className="wc-step-rail" aria-label="입력 단계">
      {labels.map((label, index) => {
        const number = (index + 1) as SetupStep;
        const state = number === step ? "active" : number < step ? "done" : "";
        return <li className={state} key={label}><span>{number < step ? "✓" : number}</span><strong>{label}</strong></li>;
      })}
    </ol>
  );
}

function UnitSwitch({ unit, onChange }: { unit: MoneyUnit; onChange: (unit: MoneyUnit) => void }) {
  return (
    <div className="wc-unit-switch" role="group" aria-label="자산 입력 단위">
      <button aria-pressed={unit === "manwon"} className={unit === "manwon" ? "active" : ""} type="button" onClick={() => onChange("manwon")}>만원</button>
      <button aria-pressed={unit === "eok"} className={unit === "eok" ? "active" : ""} type="button" onClick={() => onChange("eok")}>억원</button>
    </div>
  );
}

function SetupFlow({ onCancel, onComplete }: { onCancel: () => void; onComplete: (report: WealthReport) => void }) {
  const [step, setStep] = useState<SetupStep>(1);
  const [setup, setSetup] = useState<SetupState>(INITIAL_SETUP);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  const assetAmounts = useMemo(() => Object.fromEntries(
    ASSET_COMPOSITION_KEYS.map((key) => [key, amountToKrw(setup.assets[key], setup.assetUnit)]),
  ) as Record<AssetCompositionKey, number>, [setup.assets, setup.assetUnit]);

  const totalAssetsKrw = useMemo(
    () => Object.values(assetAmounts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0),
    [assetAmounts],
  );
  const monthlyBalancePreview = monthlyToKrw(setup.monthlyIncome)
    - monthlyToKrw(setup.monthlyLivingExpense)
    - monthlyToKrw(setup.monthlyDebtPayment);

  function updateAsset(key: AssetCompositionKey, value: string) {
    setSetup((current) => ({ ...current, assets: { ...current.assets, [key]: value } }));
  }

  function switchAssetUnit(nextUnit: MoneyUnit) {
    if (nextUnit === setup.assetUnit) return;
    const currentScale = setup.assetUnit === "eok" ? KRW_PER_EOK : KRW_PER_MANWON;
    const nextScale = nextUnit === "eok" ? KRW_PER_EOK : KRW_PER_MANWON;
    setSetup((current) => ({
      ...current,
      assetUnit: nextUnit,
      totalDebt: (() => {
        const raw = parseNonNegative(current.totalDebt);
        if (!Number.isFinite(raw) || current.totalDebt === "") return "";
        return String(Number(((raw * currentScale) / nextScale).toFixed(4)));
      })(),
      assets: Object.fromEntries(ASSET_COMPOSITION_KEYS.map((key) => {
        const raw = parseNonNegative(current.assets[key]);
        if (!Number.isFinite(raw) || current.assets[key] === "") return [key, ""];
        const converted = (raw * currentScale) / nextScale;
        return [key, String(Number(converted.toFixed(4)))];
      })) as Record<AssetCompositionKey, string>,
    }));
  }

  function validateStep(currentStep: SetupStep) {
    if (currentStep === 1) {
      if (ASSET_COMPOSITION_KEYS.some((key) => setup.assets[key].trim() === "")) {
        return "8개 자산군을 모두 확인해 주세요. 보유하지 않은 항목에는 0을 입력해 주세요.";
      }
      if (Object.values(assetAmounts).some((value) => !Number.isSafeInteger(value) || value < 0)) {
        return "자산 금액을 0 이상의 숫자로 입력해 주세요.";
      }
    }
    if (currentStep === 2) {
      if ([setup.totalDebt, setup.monthlyIncome, setup.monthlyLivingExpense, setup.monthlyDebtPayment].some((value) => value.trim() === "")) {
        return "부채와 월 현금흐름을 모두 확인해 주세요. 해당 금액이 없으면 0을 입력해 주세요.";
      }
      const values = [
        amountToKrw(setup.totalDebt, setup.assetUnit),
        monthlyToKrw(setup.monthlyIncome),
        monthlyToKrw(setup.monthlyLivingExpense),
        monthlyToKrw(setup.monthlyDebtPayment),
      ];
      if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
        return "부채와 월 현금흐름을 0 이상의 숫자로 입력해 주세요.";
      }
    }
    if (currentStep === 3 && setup.next90DayEvent !== "none") {
      const eventAmount = monthlyToKrw(setup.next90DayAmount);
      if (setup.next90DayAmount.trim() === "" || !Number.isSafeInteger(eventAmount) || eventAmount <= 0) {
        return "90일 안의 큰 변화에 필요한 예상 금액을 입력해 주세요.";
      }
    }
    return null;
  }

  function nextStep() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => Math.min(3, current + 1) as SetupStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setError(null);
    setStep((current) => Math.max(1, current - 1) as SetupStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const stepOneError = validateStep(1);
    const stepTwoError = validateStep(2);
    const stepThreeError = validateStep(3);
    if (stepOneError || stepTwoError || stepThreeError) {
      setError(stepOneError ?? stepTwoError ?? stepThreeError);
      return;
    }

    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/v3/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          profile: {
            assets: assetAmounts,
            totalDebtKrw: amountToKrw(setup.totalDebt, setup.assetUnit),
            monthlyIncomeKrw: monthlyToKrw(setup.monthlyIncome),
            monthlyLivingExpenseKrw: monthlyToKrw(setup.monthlyLivingExpense),
            monthlyDebtPaymentKrw: monthlyToKrw(setup.monthlyDebtPayment),
            incomeStability: setup.incomeStability,
            next90DayEvent: setup.next90DayEvent,
            next90DayAmountKrw: setup.next90DayEvent === "none" ? 0 : monthlyToKrw(setup.next90DayAmount),
          },
          constraintNote: setup.constraintNote.trim(),
          sessionId: getSessionId(),
        }),
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error
          : "리포트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
        throw new Error(message);
      }

      const parsed = wealthReportSchema.safeParse(body);
      if (!parsed.success) throw new Error("리포트 응답 형식이 올바르지 않습니다.");
      onComplete(parsed.data);
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "분석 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요."
        : caught instanceof Error ? caught.message : "리포트를 만들지 못했습니다.");
    } finally {
      window.clearTimeout(timeout);
      setIsLoading(false);
    }
  }

  return (
    <main className="wc-setup-shell">
      <div className="wc-setup-top">
        <button className="wc-text-button" type="button" onClick={onCancel}>← 처음으로</button>
        <StepRail step={step} />
        <span className="wc-step-count">0{step} / 03</span>
      </div>

      <form className="wc-setup-form wc-rise" onSubmit={submit}>
        {step === 1 ? (
          <section>
            <header className="wc-form-header">
              <div><span>STEP 01</span><h1 ref={stepHeadingRef} tabIndex={-1}>우리 가구의 자산을 구성별로 나눠 주세요.</h1><p>본인과 배우자의 공동·개별 명의 자산을 모두 포함해 주세요. 모든 금액은 오늘 또는 같은 최근 월말을 평가기준일로 맞추고, 중복 없이 가장 가까운 항목 하나에 넣어 주세요. 보유하지 않은 항목은 0으로 확인해 주세요.</p></div>
              <UnitSwitch unit={setup.assetUnit} onChange={switchAssetUnit} />
            </header>
            <div className="wc-assets-grid">
              {ASSET_COMPOSITION_KEYS.map((key) => {
                const meta = ASSET_META[key];
                const amount = assetAmounts[key];
                return (
                  <label className="wc-asset-input" key={key}>
                    <span className="wc-asset-index">{meta.index}</span>
                    <span className="wc-asset-copy"><strong>{meta.label}</strong><small>{meta.description}</small></span>
                    <span className="wc-money-field"><input inputMode="decimal" min="0" step="any" value={setup.assets[key]} onChange={(event) => updateAsset(key, event.target.value)} aria-label={`${meta.label} 금액`} placeholder="0" /><b>{setup.assetUnit === "eok" ? "억" : "만"}</b></span>
                    <em>{setup.assets[key] === "" ? "미입력" : formatKrw(amount)}</em>
                  </label>
                );
              })}
            </div>
            <div className="wc-total-strip"><span>입력한 가구 총자산</span><strong>{formatKrw(totalAssetsKrw)}</strong><small>본인·배우자 포함 8개 자산군 합계 · 같은 평가기준일</small></div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <header className="wc-form-header"><div><span>STEP 02</span><h1 ref={stepHeadingRef} tabIndex={-1}>우리 가구의 부채와 한 달 흐름을 알려 주세요.</h1><p>1단계와 동일하게 본인과 배우자를 포함한 가구 기준으로 입력해 주세요. 순자산 격차와 유동성·상환부담을 같은 기준으로 진단하며, 해당 금액이 없으면 0을 입력합니다.</p></div></header>
            <div className="wc-form-section">
              <div className="wc-section-title"><span>01</span><div><h2>현재 부채</h2><p>본인·배우자 명의의 주택담보, 신용, 사업자 대출 등 현재 남은 원금을 합산합니다.</p></div></div>
              <label className="wc-field-row"><span><strong>총 부채</strong><small>현재 남은 원금 합계</small></span><span className="wc-field-with-unit"><input className={inputClassName} inputMode="decimal" min="0" step="any" placeholder="0" value={setup.totalDebt} onChange={(event) => setSetup((current) => ({ ...current, totalDebt: event.target.value }))} /><b>{setup.assetUnit === "eok" ? "억원" : "만원"}</b></span></label>
            </div>
            <div className="wc-form-section">
              <div className="wc-section-title"><span>02</span><div><h2>가구 월 현금흐름</h2><p>본인·배우자 합산 기준의 월평균 금액을 만원 단위로 입력합니다.</p></div></div>
              <div className="wc-three-fields">
                <label><span>월 세후소득</span><div className="wc-field-with-unit"><input className={inputClassName} inputMode="decimal" min="0" step="any" placeholder="예: 650" value={setup.monthlyIncome} onChange={(event) => setSetup((current) => ({ ...current, monthlyIncome: event.target.value }))} /><b>만원</b></div></label>
                <label><span>필수 생활비</span><div className="wc-field-with-unit"><input className={inputClassName} inputMode="decimal" min="0" step="any" placeholder="예: 320" value={setup.monthlyLivingExpense} onChange={(event) => setSetup((current) => ({ ...current, monthlyLivingExpense: event.target.value }))} /><b>만원</b></div></label>
                <label><span>월 부채상환액</span><div className="wc-field-with-unit"><input className={inputClassName} inputMode="decimal" min="0" step="any" placeholder="예: 90" value={setup.monthlyDebtPayment} onChange={(event) => setSetup((current) => ({ ...current, monthlyDebtPayment: event.target.value }))} /><b>만원</b></div></label>
              </div>
              <div className={`wc-flow-preview ${monthlyBalancePreview < 0 ? "negative" : ""}`}><span>{monthlyBalancePreview < 0 ? "월 부족액" : "월 조정 가능액"}</span><strong>{formatKrw(Math.abs(monthlyBalancePreview))}</strong><small>세후소득 − 필수생활비 − 부채상환</small></div>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <header className="wc-form-header"><div><span>STEP 03</span><h1 ref={stepHeadingRef} tabIndex={-1}>숫자에 담기지 않는 상황을 확인할게요.</h1><p>같은 구성 차이라도 소득 안정성과 가까운 지출 일정에 따라 우선순위가 달라집니다.</p></div></header>
            <div className="wc-choice-section">
              <fieldset><legend>소득의 안정성</legend><div className="wc-choice-grid three">
                {[
                  ["stable", "안정적", "예측 가능한 급여·수입"],
                  ["variable", "변동 있음", "월별 편차가 큰 수입"],
                  ["uncertain", "불확실", "중단 가능성 또는 전환기"],
                ].map(([value, label, description]) => <label key={value}><input type="radio" name="incomeStability" value={value} checked={setup.incomeStability === value} onChange={() => setSetup((current) => ({ ...current, incomeStability: value as IncomeStability }))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}
              </div></fieldset>
              <fieldset><legend>90일 안에 예정된 큰 변화</legend><div className="wc-choice-grid five">
                {[
                  ["none", "없음"], ["housing", "주거 이동"], ["career", "이직·휴직"], ["business", "사업 자금"], ["large_expense", "큰 지출"],
                ].map(([value, label]) => <label key={value}><input type="radio" name="next90DayEvent" value={value} checked={setup.next90DayEvent === value} onChange={() => setSetup((current) => ({ ...current, next90DayEvent: value as Next90DayEvent, next90DayAmount: value === "none" ? "" : current.next90DayAmount }))} /><span><strong>{label}</strong></span></label>)}
              </div></fieldset>
              {setup.next90DayEvent !== "none" ? <label className="wc-event-amount"><span><strong>90일 안에 필요한 예상 금액</strong><small>가까운 일정이 현재 현금성 자산으로 감당 가능한지 확인합니다.</small></span><div className="wc-field-with-unit"><input className={inputClassName} inputMode="decimal" min="0" step="any" placeholder="예: 3000" value={setup.next90DayAmount} onChange={(event) => setSetup((current) => ({ ...current, next90DayAmount: event.target.value }))} /><b>만원</b></div></label> : null}
              <label className="wc-note-field"><span><strong>반드시 고려할 조건</strong><small>선택 입력 · 상품명, 계좌번호 등 개인정보는 적지 마세요.</small></span><textarea maxLength={300} rows={4} placeholder="예: 6개월 내 전세 보증금 증액 예정, 사업소득 변동이 큼" value={setup.constraintNote} onChange={(event) => setSetup((current) => ({ ...current, constraintNote: event.target.value }))} /><em>{setup.constraintNote.length} / 300</em></label>
            </div>
            <div className="wc-analysis-summary"><Icon name="lock" /><div><strong>분석 전 확인</strong><p>입력한 금액은 이번 리포트 계산에만 사용하며 브라우저 저장소에 남기지 않습니다. 결과는 진단용 참고정보이며 투자·세무·법률 자문이 아닙니다.</p></div></div>
          </section>
        ) : null}

        {error ? <div className="wc-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</div> : null}
        <footer className="wc-form-footer">
          {step > 1 ? <button className="wc-secondary-button" type="button" onClick={previousStep} disabled={isLoading}>이전</button> : <span />}
          {step < 3 ? <button className="wc-primary-button" type="button" onClick={nextStep}>다음 단계 <Icon name="arrow" /></button> : <button className="wc-primary-button" type="submit" disabled={isLoading}>{isLoading ? <><span className="wc-spinner" /> 구조를 분석하고 있습니다</> : <>종합 리포트 만들기 <Icon name="arrow" /></>}</button>}
        </footer>
      </form>
    </main>
  );
}

export function WealthCopyApp() {
  const [screen, setScreen] = useState<"landing" | "setup" | "report">("landing");
  const [report, setReport] = useState<WealthReport | null>(null);

  useEffect(() => cleanupLegacyStorage(), []);
  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [screen]);

  function openSetup() {
    setReport(null);
    setScreen("setup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="wc-app">
      <header className="wc-site-header">
        <button className="wc-brand-button" type="button" onClick={() => setScreen("landing")} aria-label="WealthCopy 홈"><WealthLogo /></button>
        <div className="wc-header-meta"><span>PRIVATE BETA</span>{screen === "report" ? <button type="button" onClick={openSetup}>자산 다시 입력</button> : null}</div>
      </header>
      {screen === "landing" ? <Landing onStart={openSetup} /> : null}
      {screen === "setup" ? <SetupFlow onCancel={() => setScreen("landing")} onComplete={(nextReport) => { setReport(nextReport); setScreen("report"); window.scrollTo({ top: 0 }); }} /> : null}
      {screen === "report" && report ? <WealthReportView report={report} onRestart={openSetup} /> : null}
    </div>
  );
}
