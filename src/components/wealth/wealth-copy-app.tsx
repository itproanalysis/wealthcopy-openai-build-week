"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  PUBLIC_ACTION_COPY,
  projectPublicPlan,
  publicPlanSchema,
  recalculatePublicPlan,
  type PublicActionId,
  type PublicPlan,
} from "@/lib/wealth/public-plan";
import {
  DEFAULT_PUBLIC_ACTION_IDS,
  migrateLegacyPlan,
  parseStoredPlan,
  serializeStoredPlan,
} from "@/lib/wealth/public-plan-storage";

import { WealthLogo } from "./logo";

type SetupProfile = {
  debtRatio: number;
  emergencyFundMonths: number;
  monthlyIncome: number;
  monthlySavings: number;
};

type ApiErrorBody = {
  error?: string;
};

const PLAN_STORAGE_KEY = "wealthcopy-public-plan-v2";
const LEGACY_PLAN_STORAGE_KEY = "wealthcopy-demo-plan-v1";
const SESSION_STORAGE_KEY = "wealthcopy-anonymous-session";

const INITIAL_PROFILE: SetupProfile = {
  monthlyIncome: 6_500_000,
  monthlySavings: 3_100_000,
  debtRatio: 18,
  emergencyFundMonths: 5,
};

const INITIAL_NOTE =
  "내년에 이사 계획이 있어 현금 여유를 유지하고 싶어요.";

const inputClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#d8e3ee] bg-white px-4 text-[15px] font-semibold text-[#10213f] outline-none transition placeholder:font-normal placeholder:text-[#9aa7b9] focus:border-[#06a4a8] focus:ring-4 focus:ring-[#06a4a8]/10";

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function recalculatePlan(plan: PublicPlan): PublicPlan {
  return recalculatePublicPlan(plan);
}

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existing,
    )
  ) {
    return existing;
  }

  const created = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export function WealthCopyApp() {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [profile, setProfile] = useState<SetupProfile | null>(null);
  const [constraintNote, setConstraintNote] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [calendarNow, setCalendarNow] = useState(() => new Date());

  const pageContentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const monthlySavingsInputRef = useRef<HTMLInputElement>(null);
  const requestAbortRef = useRef<AbortController>(null);

  const currentMonth = monthKey(calendarNow);
  const currentMonthLabel = monthLabel(calendarNow);
  const completedCount =
    plan?.actions.filter((action) => action.completed).length ?? 0;
  const visibleActionIds = plan
    ? plan.actions.map((action) => action.id)
    : DEFAULT_PUBLIC_ACTION_IDS;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const storedPlan = parseStoredPlan(
          window.localStorage.getItem(PLAN_STORAGE_KEY),
          currentMonth,
        );

        if (storedPlan) {
          setPlan(storedPlan);
          window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY);
          setStatusMessage("이번 달 행동 기록을 불러왔어요.");
          return;
        }

        const migratedPlan = migrateLegacyPlan(
          window.localStorage.getItem(LEGACY_PLAN_STORAGE_KEY),
        );

        if (!migratedPlan) {
          window.localStorage.removeItem(PLAN_STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY);
          return;
        }

        window.localStorage.setItem(
          PLAN_STORAGE_KEY,
          serializeStoredPlan(currentMonth, migratedPlan),
        );

        const verified = parseStoredPlan(
          window.localStorage.getItem(PLAN_STORAGE_KEY),
          currentMonth,
        );
        if (!verified) return;

        window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY);
        setPlan(verified);
        setStatusMessage("기존 행동 기록을 새 화면으로 옮겼어요.");
      } finally {
        setIsRestoring(false);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [currentMonth]);

  useEffect(() => {
    const syncMonth = () => {
      const now = new Date();
      if (monthKey(now) === monthKey(calendarNow)) return;

      setIsRestoring(true);
      setPlan((current) =>
        current
          ? projectPublicPlan(current.actions.map((action) => action.id))
          : null,
      );
      setCalendarNow(now);
      setStatusMessage("새 달이 시작되어 행동 완료 상태를 초기화했어요.");
    };

    const intervalId = window.setInterval(syncMonth, 60_000);
    document.addEventListener("visibilitychange", syncMonth);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncMonth);
    };
  }, [calendarNow]);

  useEffect(() => {
    if (!plan) return;

    window.localStorage.setItem(
      PLAN_STORAGE_KEY,
      serializeStoredPlan(currentMonth, plan),
    );
  }, [currentMonth, plan]);

  useEffect(
    () => () => {
      requestAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!setupOpen) return;

    const previouslyFocused = document.activeElement;
    const pageContent = pageContentRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestAbortRef.current?.abort();
        requestAbortRef.current = null;
        setIsPreparing(false);
        setSetupOpen(false);
        setProfile(null);
        setConstraintNote(null);
        setSetupError(null);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    pageContent?.setAttribute("inert", "");
    pageContent?.setAttribute("aria-hidden", "true");
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      pageContent?.removeAttribute("inert");
      pageContent?.removeAttribute("aria-hidden");
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [setupOpen]);

  function openSetup() {
    setSetupError(null);
    setProfile(INITIAL_PROFILE);
    setConstraintNote(INITIAL_NOTE);
    setSetupOpen(true);
  }

  function updateProfile(patch: Partial<SetupProfile>) {
    setProfile((current) => (current ? { ...current, ...patch } : current));
    setSetupError(null);
  }

  function closeSetup() {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsPreparing(false);
    setSetupOpen(false);
    setProfile(null);
    setConstraintNote(null);
    setSetupError(null);
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || constraintNote === null) return;

    if (profile.monthlySavings > profile.monthlyIncome) {
      setSetupError("이번 달 실행 가능액은 월소득보다 클 수 없어요.");
      monthlySavingsInputRef.current?.focus();
      return;
    }

    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    setIsPreparing(true);
    setSetupError(null);

    try {
      const response = await fetch("/api/v2/plan", {
        body: JSON.stringify({
          profile,
          constraintNote,
          sessionId: getSessionId(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const result = (await response.json()) as unknown;

      if (!response.ok) {
        const errorBody = result as ApiErrorBody;
        throw new Error(
          errorBody.error ?? "이번 달 행동을 만들지 못했어요. 다시 시도해 주세요.",
        );
      }

      const parsedPlan = publicPlanSchema.safeParse(result);
      if (!parsedPlan.success) {
        throw new Error("이번 달 행동을 불러오지 못했어요. 다시 시도해 주세요.");
      }

      setPlan(parsedPlan.data);
      setProfile(null);
      setConstraintNote(null);
      setSetupOpen(false);
      setStatusMessage("L7을 향한 이번 달 행동 세 개가 준비됐어요.");
    } catch (error) {
      if (abortController.signal.aborted) return;
      setSetupError(
        error instanceof Error
          ? error.message
          : "이번 달 행동을 만들지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      if (!abortController.signal.aborted) {
        setIsPreparing(false);
        requestAbortRef.current = null;
      }
    }
  }

  function toggleAction(actionId: PublicActionId) {
    if (!plan) return;

    const actionCopy = PUBLIC_ACTION_COPY[actionId];
    const nextPlan = recalculatePlan(
      {
        nextLevel: plan.nextLevel,
        actions: plan.actions.map((action) =>
          action.id === actionId
            ? { ...action, completed: !action.completed }
            : action,
        ),
        progress: plan.progress,
      },
    );

    setPlan(nextPlan);
    const updatedAction = nextPlan.actions.find(
      (action) => action.id === actionId,
    );
    const nextCompletedCount = nextPlan.actions.filter(
      (action) => action.completed,
    ).length;
    setStatusMessage(
      `${actionCopy.title} ${updatedAction?.completed ? "완료" : "완료 취소"}. 세 개 중 ${nextCompletedCount}개 완료했어요.`,
    );
  }

  function clearPlan() {
    window.localStorage.removeItem(PLAN_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_PLAN_STORAGE_KEY);
    setPlan(null);
    setStatusMessage("이번 달 행동 기록을 지웠어요.");
    openSetup();
  }

  return (
    <>
      <div className="min-h-screen" ref={pageContentRef}>
        <header className="border-b border-[#dde6ef]/80 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
            <WealthLogo />
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-bold text-[#7a879b] sm:block">
                {currentMonthLabel}
              </span>
              <button
                className="min-h-11 rounded-full border border-[#d6e1ec] bg-white px-4 text-sm font-extrabold text-[#33506f] transition hover:border-[#06a4a8] hover:text-[#087f83]"
                disabled={isRestoring}
                onClick={openSetup}
                type="button"
              >
                <span className="sm:hidden">
                  {isRestoring ? "불러오는 중" : plan ? "다시 만들기" : "시작하기"}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  {isRestoring
                    ? "행동 불러오는 중"
                    : plan
                      ? "행동 다시 만들기"
                      : "시작하기"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
          <div className="wc-rise overflow-hidden rounded-[2rem] border border-white/90 bg-white/90 shadow-[0_28px_90px_rgba(24,65,105,0.12)] backdrop-blur">
            <section className="grid border-b border-[#e2eaf2] lg:grid-cols-[1fr_0.72fr]">
              <div className="relative overflow-hidden p-7 sm:p-10 lg:p-12">
                <div
                  aria-hidden="true"
                  className="absolute -right-24 -top-28 size-72 rounded-full bg-[#dff7f5] blur-3xl"
                />
                <div className="relative">
                  <p className="text-xs font-black tracking-[0.16em] text-[#078f93]">
                    다음 자산 단계
                  </p>
                  <div className="mt-4 flex items-end gap-5">
                    <span className="text-[5.5rem] font-black leading-none tracking-[-0.09em] text-[#082a66] sm:text-[7rem]">
                      L7
                    </span>
                    <span className="mb-3 rounded-full bg-[#e9f9f8] px-3 py-1.5 text-xs font-extrabold text-[#078f93]">
                      NEXT
                    </span>
                  </div>
                  <h1 className="mt-7 max-w-xl text-3xl font-black leading-tight tracking-[-0.05em] text-[#10213f] sm:text-4xl">
                    L7 경로를 {plan ? "실행합니다." : "복제합니다."}
                  </h1>
                  <p className="mt-3 max-w-xl text-base leading-7 text-[#68768c]">
                    상위 단계로 넘어가기 위해 3가지 행동이 필요합니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center bg-[#082a66] p-7 text-white sm:p-10 lg:p-12">
                <p className="text-xs font-black tracking-[0.16em] text-[#79d8d7]">
                  이번 달 행동 진행률
                </p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <p className="text-6xl font-black tracking-[-0.06em] sm:text-7xl">
                    {plan?.progress ?? 0}%
                  </p>
                  <p className="pb-2 text-sm font-bold text-white/65">
                    {completedCount} / 3 완료
                  </p>
                </div>
                <progress
                  aria-label="이번 달 행동 진행률"
                  aria-describedby="progress-safety-note"
                  className="wc-progress mt-6"
                  max={3}
                  value={completedCount}
                >
                  {plan?.progress ?? 0}%
                </progress>
                <p
                  className="mt-4 text-xs leading-5 text-white/55"
                  id="progress-safety-note"
                >
                  행동 완료율이며 자산 변화나 L7 도달률을 의미하지 않아요.
                </p>
              </div>
            </section>

            <section className="p-6 sm:p-9 lg:p-11">
              <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.15em] text-[#078f93]">
                    이번 달 행동
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#082a66] sm:text-3xl">
                    이번 달 완료할 3가지 행동
                  </h2>
                </div>
                <p className="text-sm font-semibold text-[#7a879b]">
                  {plan
                    ? completedCount === 3
                      ? "이번 달 행동을 모두 확인했어요."
                      : `세 개 중 ${completedCount}개 완료`
                    : "3가지 행동을 만들면 바로 시작할 수 있어요."}
                </p>
              </div>

              <fieldset disabled={!plan}>
                <legend className="sr-only">완료할 행동 세 개</legend>
                <div className="grid gap-4 lg:grid-cols-3">
                  {visibleActionIds.map((actionId, index) => {
                    const actionCopy = PUBLIC_ACTION_COPY[actionId];
                    const action = plan?.actions.find(
                      (item) => item.id === actionId,
                    );
                    const completed = action?.completed ?? false;

                    return (
                      <label
                        className={`group relative rounded-[1.6rem] border p-6 transition focus-within:ring-4 focus-within:ring-[#06a4a8]/25 motion-safe:hover:-translate-y-0.5 sm:min-h-56 sm:p-7 ${
                          plan
                            ? "cursor-pointer hover:border-[#86cbcc] hover:shadow-[0_16px_38px_rgba(22,75,108,0.09)]"
                            : "cursor-not-allowed opacity-55"
                        } ${
                          completed
                            ? "border-[#78cfd0] bg-[#effafa]"
                            : "border-[#dce5ee] bg-[#fbfcfe]"
                        }`}
                        key={actionId}
                      >
                        <input
                          checked={completed}
                          className="peer sr-only"
                          onChange={() => toggleAction(actionId)}
                          type="checkbox"
                        />
                        <span className="flex items-center justify-between">
                          <span
                            aria-hidden="true"
                            className="text-sm font-black tracking-[0.12em] text-[#91a0b3]"
                          >
                            0{index + 1}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`grid size-10 place-items-center rounded-full border-2 text-sm font-black transition ${
                              completed
                                ? "border-[#06a4a8] bg-[#06a4a8] text-white"
                                : "border-[#cbd7e3] bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </span>
                        <span
                          className={`mt-8 block text-xl font-black tracking-[-0.03em] ${
                            completed
                              ? "text-[#4b7281] line-through"
                              : "text-[#173253]"
                          }`}
                        >
                          {actionCopy.title}
                        </span>
                        <span className="mt-3 block text-sm leading-6 text-[#748196]">
                          {actionCopy.description}
                        </span>
                        <span className="mt-6 block text-xs font-extrabold text-[#078f93]">
                          {completed
                            ? "완료"
                            : plan
                              ? "눌러서 완료"
                              : "복제 후 시작"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {!plan ? (
                <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-2xl bg-[#f1f7fb] p-5 sm:flex-row sm:px-6">
                  <p className="text-sm font-bold leading-6 text-[#5f7188]">
                    이번 달에 완료할 행동 3개를 준비합니다.
                  </p>
                  <button
                    className="min-h-12 w-full shrink-0 rounded-xl bg-[#082a66] px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(8,42,102,0.18)] transition hover:bg-[#061f51] sm:w-auto"
                    disabled={isRestoring}
                    onClick={openSetup}
                    type="button"
                  >
                    {isRestoring ? "행동 불러오는 중…" : "L7 행동 복제하기"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-3 px-2 text-xs leading-5 text-[#7a879b] sm:flex-row sm:items-center sm:justify-between">
            <p>
              교육용 행동 기록 화면이며 금융 거래를 실행하거나 의사결정을
              대신하지 않습니다.
            </p>
            {plan ? (
              <button
                className="self-start font-bold text-[#67778c] underline decoration-[#becbd8] underline-offset-4 sm:self-auto"
                onClick={clearPlan}
                type="button"
              >
                기록 지우고 새로 시작
              </button>
            ) : null}
          </div>

          <p
            aria-live="polite"
            className="sr-only"
            role="status"
          >
            {statusMessage}
          </p>
        </main>
      </div>

      {setupOpen && profile && constraintNote !== null ? (
        <div
          aria-describedby="setup-description"
          aria-labelledby="setup-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#041b43]/60 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
        >
          <div
            aria-busy={isPreparing}
            className="my-auto w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"
            ref={dialogRef}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black tracking-[0.15em] text-[#078f93]">
                  L7 ACTION COPY
                </p>
                <h2
                  className="mt-2 text-3xl font-black tracking-[-0.045em] text-[#082a66]"
                  id="setup-title"
                >
                  행동 3개 만들기
                </h2>
                <p
                  className="mt-3 max-w-lg text-sm leading-6 text-[#6d7b90]"
                  id="setup-description"
                >
                  아래 조건은 행동을 만드는 동안에만 사용되고 메인 화면에는
                  남지 않습니다. 이름·연락처·계좌정보는 입력하지 마세요.
                </p>
              </div>
              <button
                aria-label="행동 만들기 닫기"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-[#d8e3ed] text-xl text-[#6f7e92] transition hover:bg-[#f3f7fa]"
                onClick={closeSetup}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="mt-7" onSubmit={handleCreatePlan}>
              <fieldset disabled={isPreparing}>
                <legend className="sr-only">행동 생성에 사용할 현재 조건</legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-extrabold text-[#31415d]">
                  월소득
                  <span className="ml-1 font-normal text-[#8995a8]">
                    (만원)
                  </span>
                  <input
                    className={inputClass}
                    min="10"
                    onChange={(event) =>
                      updateProfile({
                        monthlyIncome: Number(event.target.value) * 10_000,
                      })
                    }
                    ref={firstInputRef}
                    step="10"
                    type="number"
                    value={profile.monthlyIncome / 10_000}
                  />
                  </label>
                  <label className="text-sm font-extrabold text-[#31415d]">
                  이번 달 실행 가능액
                  <span className="ml-1 font-normal text-[#8995a8]">
                    (만원)
                  </span>
                  <input
                    aria-describedby={
                      profile.monthlySavings > profile.monthlyIncome
                        ? "setup-error"
                        : undefined
                    }
                    aria-invalid={
                      profile.monthlySavings > profile.monthlyIncome
                    }
                    className={inputClass}
                    min="0"
                    onChange={(event) =>
                      updateProfile({
                        monthlySavings: Number(event.target.value) * 10_000,
                      })
                    }
                    step="10"
                    type="number"
                    ref={monthlySavingsInputRef}
                    value={profile.monthlySavings / 10_000}
                  />
                  </label>
                  <label className="text-sm font-extrabold text-[#31415d]">
                  부채 상환 비율
                  <span className="ml-1 font-normal text-[#8995a8]">(%)</span>
                  <input
                    className={inputClass}
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updateProfile({ debtRatio: Number(event.target.value) })
                    }
                    type="number"
                    value={profile.debtRatio}
                  />
                  </label>
                  <label className="text-sm font-extrabold text-[#31415d]">
                  비상자금
                  <span className="ml-1 font-normal text-[#8995a8]">
                    (개월)
                  </span>
                  <input
                    className={inputClass}
                    max="24"
                    min="0"
                    onChange={(event) =>
                      updateProfile({
                        emergencyFundMonths: Number(event.target.value),
                      })
                    }
                    type="number"
                    value={profile.emergencyFundMonths}
                  />
                  </label>
                </div>

                <label className="mt-5 block text-sm font-extrabold text-[#31415d]">
                  이번 달에 꼭 반영할 변화
                  <textarea
                    className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[#d8e3ee] bg-white px-4 py-3 text-[15px] font-semibold leading-6 text-[#10213f] outline-none transition placeholder:font-normal placeholder:text-[#9aa7b9] focus:border-[#06a4a8] focus:ring-4 focus:ring-[#06a4a8]/10"
                    maxLength={500}
                    onChange={(event) => {
                      setConstraintNote(event.target.value);
                      setSetupError(null);
                    }}
                    placeholder="예: 내년에 이사 계획이 있어 현금 여유를 유지하고 싶어요."
                    value={constraintNote}
                  />
                </label>
              </fieldset>

              {setupError ? (
                <p
                  className="mt-4 rounded-xl border border-[#f1c7bb] bg-[#fff5f2] px-4 py-3 text-sm font-semibold leading-6 text-[#9c4c34]"
                  id="setup-error"
                  role="alert"
                >
                  {setupError}
                </p>
              ) : null}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="min-h-12 rounded-xl border border-[#d5e0ea] px-5 text-sm font-extrabold text-[#64748a]"
                  onClick={closeSetup}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="min-h-12 rounded-xl bg-[#082a66] px-6 text-sm font-extrabold text-white transition hover:bg-[#061f51] disabled:cursor-wait disabled:opacity-60"
                  disabled={isPreparing}
                  type="submit"
                >
                  {isPreparing ? "행동 준비 중…" : "3가지 행동 복제하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
