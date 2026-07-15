"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  PUBLIC_ACTION_COPY,
  carryCompletedActions,
  publicPlanSchema,
  recalculatePublicPlan,
  type PublicActionId,
  type PublicPlan,
} from "@/lib/wealth/public-plan";
import {
  DEFAULT_PUBLIC_ACTION_IDS,
  restoreStoredPlan,
  serializeStoredPlan,
} from "@/lib/wealth/public-plan-storage";
import {
  ASSET_LEVEL_LABELS,
  WEALTH_SOURCE_LEVEL_HEADER,
  assetLevelSchema,
  nextAssetLevel,
  type AssetLevel,
} from "@/lib/wealth/asset-level";
import { createMonthlyCheckinCalendar } from "@/lib/wealth/monthly-checkin-calendar";
import type { PsidAssetPercentileBand } from "@/lib/wealth/normalized-profile";

import { WealthLogo } from "./logo";

type SetupProfile = {
  totalAssetsEok: number | "";
  totalDebtEok: number | "";
  incomeExecutionRatio: number | "";
  assetPercentileBand: PsidAssetPercentileBand;
  debtServiceRatio: number | "";
};

type ActionSignals = Pick<
  SetupProfile,
  "incomeExecutionRatio" | "assetPercentileBand" | "debtServiceRatio"
>;

type ApiErrorBody = {
  error?: string;
};

class UserFacingPlanError extends Error {}

const PLAN_STORAGE_KEY = "wealthcopy-public-plan-v4";
const DEPRECATED_PLAN_STORAGE_KEYS = [
  "wealthcopy-public-plan-v3",
  "wealthcopy-public-plan-v2",
  "wealthcopy-demo-plan-v1",
] as const;
const SESSION_STORAGE_KEY = "wealthcopy-anonymous-session";

const INITIAL_PROFILE: SetupProfile = {
  totalAssetsEok: "",
  totalDebtEok: "",
  incomeExecutionRatio: "",
  assetPercentileBand: "unknown",
  debtServiceRatio: "",
};

const INITIAL_NOTE = "";

const inputClass =
  "mt-2 h-12 w-full rounded-2xl border border-[#d8e3ee] bg-white px-4 text-[15px] font-semibold text-[#10213f] outline-none transition placeholder:font-normal placeholder:text-[#9aa7b9] focus:border-[#06a4a8] focus:ring-4 focus:ring-[#06a4a8]/10";

const KRW_PER_EOK = 100_000_000;
const MAX_EOK_INPUT =
  Math.floor((Number.MAX_SAFE_INTEGER / KRW_PER_EOK) * 100) / 100;

function eokToKrw(value: number) {
  return Math.round(value * KRW_PER_EOK);
}

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
  const [journeySourceLevel, setJourneySourceLevel] =
    useState<AssetLevel | null>(null);

  const pageContentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const totalAssetsInputRef = useRef<HTMLInputElement>(null);
  const totalDebtInputRef = useRef<HTMLInputElement>(null);
  const executionRatioInputRef = useRef<HTMLInputElement>(null);
  const debtRatioInputRef = useRef<HTMLInputElement>(null);
  const firstActionInputRef = useRef<HTMLInputElement>(null);
  const focusNewPlanRef = useRef(false);
  const requestAbortRef = useRef<AbortController>(null);
  const lastActionSignalsRef = useRef<ActionSignals | null>(null);

  const currentMonth = monthKey(calendarNow);
  const currentMonthLabel = monthLabel(calendarNow);
  const completedCount =
    plan?.actions.filter((action) => action.completed).length ?? 0;
  const visibleActionIds = plan
    ? plan.actions.map((action) => action.id)
    : DEFAULT_PUBLIC_ACTION_IDS;
  const activeActionId =
    plan?.actions.find((action) => !action.completed)?.id ?? null;
  const nextLevelLabel = plan?.nextLevel ?? "NEXT";
  const isMaintenanceLevel =
    journeySourceLevel === "L15" && plan?.nextLevel === "L15";

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const hadDeprecatedPlan = DEPRECATED_PLAN_STORAGE_KEYS.some(
          (key) => window.localStorage.getItem(key) !== null,
        );
        DEPRECATED_PLAN_STORAGE_KEYS.forEach((key) =>
          window.localStorage.removeItem(key),
        );

        const restoredPlan = restoreStoredPlan(
          window.localStorage.getItem(PLAN_STORAGE_KEY),
          currentMonth,
        );

        if (restoredPlan) {
          if (restoredPlan.rolledOver) {
            window.localStorage.removeItem(PLAN_STORAGE_KEY);
            setPlan(null);
            setJourneySourceLevel(null);
            setStatusMessage(
              "새 달이 시작됐어요. 최신 가구 자산정보를 입력해 현재 레벨과 행동을 다시 준비해 주세요.",
            );
            return;
          }

          setPlan(restoredPlan.plan);
          setJourneySourceLevel(restoredPlan.sourceLevel);
          setStatusMessage("이번 달 행동 기록을 불러왔어요.");
          return;
        }

        window.localStorage.removeItem(PLAN_STORAGE_KEY);
        if (hadDeprecatedPlan) {
          setStatusMessage(
            "레벨 기준이 새로워졌어요. 최신 가구 자산정보로 행동을 다시 준비해 주세요.",
          );
        }
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
      window.localStorage.removeItem(PLAN_STORAGE_KEY);
      setPlan(null);
      setJourneySourceLevel(null);
      setStatusMessage(
        "새 달이 시작됐어요. 최신 가구 자산정보로 레벨과 행동을 다시 준비해 주세요.",
      );
      setCalendarNow(now);
      setIsRestoring(false);
    };

    const intervalId = window.setInterval(syncMonth, 60_000);
    document.addEventListener("visibilitychange", syncMonth);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncMonth);
    };
  }, [calendarNow]);

  useEffect(() => {
    if (!plan || !journeySourceLevel) return;

    window.localStorage.setItem(
      PLAN_STORAGE_KEY,
      serializeStoredPlan(currentMonth, journeySourceLevel, plan),
    );
  }, [currentMonth, journeySourceLevel, plan]);

  useEffect(
    () => () => {
      requestAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!plan || !focusNewPlanRef.current) return;

    focusNewPlanRef.current = false;
    const focusTimer = window.setTimeout(
      () => firstActionInputRef.current?.focus(),
      0,
    );
    return () => window.clearTimeout(focusTimer);
  }, [plan]);

  useEffect(() => {
    if (!setupOpen) return;

    const previouslyFocused = document.activeElement;
    const pageContent = pageContentRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(
      () => totalAssetsInputRef.current?.focus(),
      0,
    );

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
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
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
    setProfile({
      ...INITIAL_PROFILE,
      ...lastActionSignalsRef.current,
    });
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

    const {
      totalAssetsEok,
      totalDebtEok,
      incomeExecutionRatio,
      assetPercentileBand,
      debtServiceRatio,
    } = profile;
    if (
      totalAssetsEok === "" ||
      !Number.isFinite(totalAssetsEok) ||
      totalAssetsEok < 0
    ) {
      setSetupError("현재 보유한 총자산을 0 이상의 숫자로 입력해 주세요.");
      totalAssetsInputRef.current?.focus();
      return;
    }
    if (
      totalDebtEok === "" ||
      !Number.isFinite(totalDebtEok) ||
      totalDebtEok < 0
    ) {
      setSetupError("현재 남은 총부채를 0 이상의 숫자로 입력해 주세요.");
      totalDebtInputRef.current?.focus();
      return;
    }
    if (
      incomeExecutionRatio === "" ||
      !Number.isFinite(incomeExecutionRatio) ||
      incomeExecutionRatio < 0 ||
      incomeExecutionRatio > 100
    ) {
      setSetupError("소득 대비 실행 비율을 0~100 사이로 입력해 주세요.");
      executionRatioInputRef.current?.focus();
      return;
    }
    if (
      debtServiceRatio === "" ||
      !Number.isFinite(debtServiceRatio) ||
      debtServiceRatio < 0 ||
      debtServiceRatio > 100
    ) {
      setSetupError("부채비율을 0~100 사이로 입력해 주세요.");
      debtRatioInputRef.current?.focus();
      return;
    }
    if (debtServiceRatio > incomeExecutionRatio) {
      setSetupError(
        "부채비율은 저축·상환을 합친 소득 대비 실행 비율보다 클 수 없어요.",
      );
      debtRatioInputRef.current?.focus();
      return;
    }

    const totalAssetsKrw = eokToKrw(totalAssetsEok);
    const totalDebtKrw = eokToKrw(totalDebtEok);
    if (
      !Number.isSafeInteger(totalAssetsKrw) ||
      !Number.isSafeInteger(totalDebtKrw)
    ) {
      setSetupError("자산정보가 입력 가능한 범위를 벗어났어요.");
      totalAssetsInputRef.current?.focus();
      return;
    }
    if (
      plan &&
      completedCount > 0 &&
      !window.confirm(
        "최신 자산 스냅샷으로 레벨과 행동을 다시 계산합니다. 분류된 현재 레벨과 다음 레벨이 같을 때만 같은 행동의 완료 기록을 유지합니다. 계속할까요?",
      )
    ) {
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
          profile: {
            totalAssetsKrw,
            totalDebtKrw,
            incomeExecutionRatio,
            assetPercentileBand,
            debtServiceRatio,
          },
          constraintNote,
          sessionId: getSessionId(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const result = (await response.json().catch(() => {
        throw new UserFacingPlanError(
          "이번 달 행동을 불러오지 못했어요. 다시 시도해 주세요.",
        );
      })) as unknown;

      if (!response.ok) {
        const errorBody = result as ApiErrorBody;
        throw new UserFacingPlanError(
          errorBody.error ?? "이번 달 행동을 만들지 못했어요. 다시 시도해 주세요.",
        );
      }

      const parsedPlan = publicPlanSchema.safeParse(result);
      if (!parsedPlan.success) {
        throw new UserFacingPlanError(
          "이번 달 행동을 불러오지 못했어요. 다시 시도해 주세요.",
        );
      }

      const parsedSourceLevel = assetLevelSchema.safeParse(
        response.headers.get(WEALTH_SOURCE_LEVEL_HEADER),
      );
      if (!parsedSourceLevel.success) {
        throw new UserFacingPlanError(
          "현재 자산 레벨을 확인하지 못했어요. 다시 시도해 주세요.",
        );
      }

      const sourceLevel = parsedSourceLevel.data;
      const expectedNextLevel = nextAssetLevel(sourceLevel);
      if (parsedPlan.data.nextLevel !== expectedNextLevel) {
        throw new UserFacingPlanError(
          "자산 레벨과 다음 단계가 일치하지 않아요. 최신 정보로 다시 시도해 주세요.",
        );
      }

      const previousPlanForTarget =
        journeySourceLevel === sourceLevel &&
        plan?.nextLevel === parsedPlan.data.nextLevel
          ? plan
          : null;
      const nextPlan = carryCompletedActions(
        previousPlanForTarget,
        parsedPlan.data.nextLevel,
        parsedPlan.data.actions.map((action) => action.id),
      );

      lastActionSignalsRef.current = {
        incomeExecutionRatio,
        assetPercentileBand,
        debtServiceRatio,
      };
      focusNewPlanRef.current = true;
      setPlan(nextPlan);
      setJourneySourceLevel(sourceLevel);
      setProfile(null);
      setConstraintNote(null);
      setSetupOpen(false);
      setStatusMessage(
        nextPlan.progress > 0
          ? `${nextPlan.nextLevel} 행동 세 개를 준비했고, 같은 행동의 완료 기록은 유지했어요.`
          : `${nextPlan.nextLevel}의 이번 달 행동 세 개가 준비됐어요.`,
      );
    } catch (error) {
      if (abortController.signal.aborted) return;
      setSetupError(
        error instanceof UserFacingPlanError
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
      nextCompletedCount === 3
        ? `${actionCopy.title} 완료. 이번 달 행동 세 개를 모두 마쳤어요. 행동 완료만으로 레벨이 오르지는 않아요. 최신 가구 자산정보로 다시 분류해 주세요.`
        : `${actionCopy.title} ${updatedAction?.completed ? "완료" : "완료 취소"}. 세 개 중 ${nextCompletedCount}개 완료했어요.`,
    );
  }

  function downloadMonthlyCheckin() {
    const calendar = createMonthlyCheckinCalendar(currentMonth);
    const objectUrl = window.URL.createObjectURL(
      new Blob([calendar.content], { type: calendar.mimeType }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = calendar.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    setStatusMessage(
      "월말 점검 일정 파일을 준비했어요. 캘린더에 추가한 뒤 행동을 완료해 주세요.",
    );
  }

  function clearPlan() {
    if (
      !window.confirm(
        "이번 달 행동과 완료 기록을 지울까요? 이 작업은 되돌릴 수 없어요.",
      )
    ) {
      return;
    }

    window.localStorage.removeItem(PLAN_STORAGE_KEY);
    DEPRECATED_PLAN_STORAGE_KEYS.forEach((key) =>
      window.localStorage.removeItem(key),
    );
    lastActionSignalsRef.current = null;
    setPlan(null);
    setJourneySourceLevel(null);
    setStatusMessage("이번 달 행동 기록을 지웠어요.");
  }

  return (
    <>
      <div className="min-h-screen" ref={pageContentRef}>
        <header className="sticky top-0 z-30 border-b border-[#dde6ef]/80 bg-white/90 backdrop-blur-xl">
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
                  {isRestoring
                    ? "불러오는 중"
                    : plan?.progress === 100
                      ? "다시 분류"
                      : plan
                        ? "다시 만들기"
                        : "시작하기"}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  {isRestoring
                    ? "행동 불러오는 중"
                    : plan?.progress === 100
                      ? "최신 자산으로 재분류"
                      : plan
                        ? "행동 다시 복제"
                        : "시작하기"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-12 lg:py-16">
          <div className="wc-rise overflow-hidden rounded-[2rem] border border-white/90 bg-white/90 shadow-[0_28px_90px_rgba(24,65,105,0.12)] backdrop-blur">
            <section className="grid border-b border-[#e2eaf2] lg:grid-cols-[1fr_0.72fr]">
              <div className="relative overflow-hidden p-5 sm:p-10 lg:p-12">
                <div
                  aria-hidden="true"
                  className="absolute -right-24 -top-28 size-72 rounded-full bg-[#dff7f5] blur-3xl"
                />
                <div className="relative">
                  <p className="text-xs font-black tracking-[0.16em] text-[#078f93]">
                    {isMaintenanceLevel ? "자산 유지 단계" : "다음 자산 단계"}
                  </p>
                  <div className="mt-3 flex items-end gap-5 sm:mt-4">
                    <span className="text-[4.75rem] font-black leading-none tracking-[-0.09em] text-[#082a66] sm:text-[7rem]">
                      {nextLevelLabel}
                    </span>
                    <span className="mb-3 rounded-full bg-[#e9f9f8] px-3 py-1.5 text-xs font-extrabold text-[#078f93]">
                      {plan
                        ? isMaintenanceLevel
                          ? "L15 유지 단계"
                          : ASSET_LEVEL_LABELS[plan.nextLevel]
                        : "분류 전"}
                    </span>
                  </div>
                  <h1 className="mt-5 max-w-xl text-2xl font-black leading-tight tracking-[-0.05em] text-[#10213f] sm:mt-7 sm:text-4xl">
                    {completedCount === 3
                      ? "이번 달 3가지 행동을 완료했습니다."
                      : plan
                        ? isMaintenanceLevel
                          ? "L15 유지 행동을 실행합니다."
                          : `${plan.nextLevel} 행동을 실행합니다.`
                        : "다음 자산 단계의 행동을 복제합니다."}
                  </h1>
                  <p className="mt-3 max-w-xl text-base leading-7 text-[#68768c]">
                    {isMaintenanceLevel
                      ? "L15 자산 운영을 점검하는 이번 달 행동 3개입니다."
                      : "다음 단계를 준비하며 이번 달 확인할 3가지 행동입니다."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center bg-[#082a66] p-5 text-white sm:p-10 lg:p-12">
                <p className="text-xs font-black tracking-[0.16em] text-[#79d8d7]">
                  이번 달 행동 진행률
                </p>
                <div className="mt-4 flex items-end justify-between gap-4 sm:mt-5">
                  <p className="text-5xl font-black tracking-[-0.06em] sm:text-7xl">
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
                  행동 완료율이며 자산 변화나 목표 단계 도달률을 의미하지 않아요.
                </p>
              </div>
            </section>

            <section className="p-4 sm:p-9 lg:p-11">
              <div className="mb-5 flex flex-col gap-2 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
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
                      <div
                        aria-current={
                          actionId === activeActionId ? "step" : undefined
                        }
                        className={`group relative rounded-[1.4rem] border p-4 transition focus-within:ring-4 focus-within:ring-[#06a4a8]/25 motion-safe:hover:-translate-y-0.5 sm:min-h-56 sm:rounded-[1.6rem] sm:p-7 ${
                          plan
                            ? "cursor-pointer hover:border-[#86cbcc] hover:shadow-[0_16px_38px_rgba(22,75,108,0.09)]"
                            : "cursor-not-allowed opacity-55"
                        } ${
                          completed
                            ? "border-[#78cfd0] bg-[#effafa]"
                            : actionId === activeActionId
                              ? "border-[#4fbfc1] bg-white shadow-[0_16px_38px_rgba(22,75,108,0.1)]"
                            : "border-[#dce5ee] bg-[#fbfcfe]"
                        }`}
                        key={actionId}
                      >
                        <label
                          className={
                            plan ? "block cursor-pointer" : "block cursor-not-allowed"
                          }
                        >
                          <input
                            checked={completed}
                            className="peer sr-only"
                            onChange={() => toggleAction(actionId)}
                            ref={index === 0 ? firstActionInputRef : undefined}
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
                            className={`mt-5 block text-lg font-black tracking-[-0.03em] sm:mt-8 sm:text-xl ${
                              completed
                                ? "text-[#4b7281] line-through"
                                : "text-[#173253]"
                            }`}
                          >
                            {actionCopy.title}
                          </span>
                          <span className="mt-3 block text-sm leading-6 text-[#748196]">
                            <strong className="mr-1 font-extrabold text-[#4b627c]">
                              완료 기준
                            </strong>
                            {actionCopy.description}
                          </span>
                          <span className="mt-4 block text-xs font-extrabold text-[#078f93] sm:mt-6">
                            {completed
                              ? "완료"
                              : actionId === activeActionId
                                ? "지금 할 행동"
                              : plan
                                ? "이어 할 행동"
                                : "복제 후 시작"}
                          </span>
                        </label>
                        {plan && actionId === "schedule_monthly_checkin" ? (
                          <button
                            className="mt-4 min-h-11 w-full rounded-xl border border-[#b9dfe0] bg-white px-4 text-xs font-extrabold text-[#087f83] transition hover:border-[#06a4a8] hover:bg-[#f2fbfa]"
                            onClick={downloadMonthlyCheckin}
                            type="button"
                          >
                            월말 일정 파일 받기
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {plan?.progress === 100 ? (
                <div className="mt-7 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#b9dfe0] bg-[#f2fbfa] p-5 sm:flex-row sm:items-center sm:px-6">
                  <p className="text-sm font-bold leading-6 text-[#476579]">
                    3가지 행동을 완료했어요. 완료만으로 레벨이 오르지는
                    않아요. 최신 가구 자산정보로 현재 레벨을 다시 분류하세요.
                  </p>
                  <button
                    className="min-h-12 w-full shrink-0 rounded-xl bg-[#087f83] px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(6,164,168,0.18)] transition hover:bg-[#066f72] sm:w-auto"
                    onClick={openSetup}
                    type="button"
                  >
                    최신 자산정보로 다시 분류
                  </button>
                </div>
              ) : null}

              {!plan ? (
                <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-2xl bg-[#f1f7fb] p-5 sm:flex-row sm:px-6">
                  <p className="text-sm font-bold leading-6 text-[#5f7188]">
                    {statusMessage || "이번 달에 완료할 행동 3개를 준비합니다."}
                  </p>
                  <button
                    className="min-h-12 w-full shrink-0 rounded-xl bg-[#082a66] px-6 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(8,42,102,0.18)] transition hover:bg-[#061f51] sm:w-auto"
                    disabled={isRestoring}
                    onClick={openSetup}
                    type="button"
                  >
                    {isRestoring
                      ? "행동 불러오는 중…"
                      : "레벨 분류하고 행동 3개 받기"}
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
                이번 달 기록 지우기
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
            className="my-auto w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"
            ref={dialogRef}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black tracking-[0.15em] text-[#078f93]">
                  ASSET SNAPSHOT → ACTION COPY
                </p>
                <h2
                  className="mt-2 text-3xl font-black tracking-[-0.045em] text-[#082a66]"
                  id="setup-title"
                >
                  가구 자산정보로 다음 행동을 준비해요
                </h2>
                <p
                  className="mt-3 max-w-lg text-sm leading-6 text-[#6d7b90]"
                  id="setup-description"
                >
                  총자산과 총부채로 현재 레벨을 내부에서 분류한 뒤, 다음
                  레벨을 준비하는 행동 3개만 보여드려요. 입력 금액은 이번
                  요청의 단계 계산에만 사용하고 저장하지 않으며 OpenAI
                  모델에도 전달하지 않습니다. 계산된 레벨과 행동 완료
                  기록만 이 기기에 저장합니다.
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
                <legend className="sr-only">
                  자산 레벨 분류와 행동 생성에 사용할 현재 조건
                </legend>

                <section className="rounded-2xl border border-[#cfe1e7] bg-[#f5fbfb] p-5 sm:p-6">
                  <p className="text-[11px] font-black tracking-[0.14em] text-[#078f93]">
                    STEP 1 · ASSET SNAPSHOT
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#173253]">
                    지금의 가구 순자산을 알려주세요
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#708095]">
                    순자산은 가구 기준 총자산에서 총부채를 뺀 값입니다. 정확한
                    감정가가 아니어도 현재 알고 있는 범위의 추정값이면 돼요.
                  </p>

                  {plan?.progress === 100 ? (
                    <p className="mt-4 rounded-xl border border-[#b9dfe0] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#087f83]">
                      행동 완료만으로 레벨이 오르지는 않아요. 아래 값을 최신
                      상태로 확인해 제출하면 현재 레벨을 처음부터 다시
                      분류합니다.
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-extrabold text-[#31415d]">
                      가구 기준 총자산
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (억원)
                      </span>
                      <input
                        aria-describedby="total-assets-help"
                        className={inputClass}
                        inputMode="decimal"
                        max={MAX_EOK_INPUT}
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            totalAssetsEok:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        placeholder="예: 3.5"
                        ref={totalAssetsInputRef}
                        required
                        step="0.01"
                        type="number"
                        value={profile.totalAssetsEok}
                      />
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#7a879b]"
                        id="total-assets-help"
                      >
                        예금·투자자산·부동산 등 가구가 보유한 자산의 현재 추정
                        합계예요. 3.5는 3억 5천만원입니다.
                      </span>
                    </label>

                    <label className="text-sm font-extrabold text-[#31415d]">
                      가구 기준 총부채
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (억원)
                      </span>
                      <input
                        aria-describedby="total-debt-help"
                        className={inputClass}
                        inputMode="decimal"
                        max={MAX_EOK_INPUT}
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            totalDebtEok:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        placeholder="없으면 0"
                        ref={totalDebtInputRef}
                        required
                        step="0.01"
                        type="number"
                        value={profile.totalDebtEok}
                      />
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#7a879b]"
                        id="total-debt-help"
                      >
                        주택담보·신용·기타 대출 등 가구가 갚아야 할 부채의 현재
                        추정 합계예요.
                      </span>
                    </label>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 rounded-xl bg-[#082a66] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-white/70">
                      현재 레벨
                    </span>
                    <strong className="text-sm">
                      제출 후 순자산 기준으로 자동 분류 · L1–L15
                    </strong>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#708095]">
                    L15는 순자산 1조원 이상 자산군입니다. 계좌번호나 상품별
                    상세정보는 입력하지 마세요.
                  </p>
                </section>

                <section className="mt-5 rounded-2xl border border-[#dbe6ee] bg-white p-5 sm:p-6">
                  <p className="text-[11px] font-black tracking-[0.14em] text-[#078f93]">
                    STEP 2 · ACTION SIGNALS
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#173253]">
                    실행 여건에 맞게 행동을 조정해요
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#708095]">
                    금액이 아닌 비율과 선택형 참고 구간으로 이번 달 행동
                    구성을 조정합니다.
                  </p>

                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <label className="text-sm font-extrabold text-[#31415d]">
                      소득 대비 실행 비율
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (%)
                      </span>
                      <input
                        aria-describedby="execution-ratio-help"
                        className={inputClass}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            incomeExecutionRatio:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        ref={executionRatioInputRef}
                        required
                        step="1"
                        type="number"
                        value={profile.incomeExecutionRatio}
                      />
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#7a879b]"
                        id="execution-ratio-help"
                      >
                        월소득 중 저축·상환에 배정할 비중
                      </span>
                    </label>
                    <label className="text-sm font-extrabold text-[#31415d]">
                      자가 선택 자산 참고 구간
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (선택)
                      </span>
                      <select
                        aria-describedby="asset-percentile-help"
                        className={inputClass}
                        onChange={(event) =>
                          updateProfile({
                            assetPercentileBand: event.target
                              .value as PsidAssetPercentileBand,
                          })
                        }
                        value={profile.assetPercentileBand}
                      >
                        <option value="unknown">잘 모르겠어요</option>
                        <option value="below_25">참조 분포 · 25백분위 미만</option>
                        <option value="p25_49">참조 분포 · 25–49백분위</option>
                        <option value="p50_74">참조 분포 · 50–74백분위</option>
                        <option value="p75_89">참조 분포 · 75–89백분위</option>
                        <option value="p90_plus">참조 분포 · 90백분위 이상</option>
                      </select>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#7a879b]"
                        id="asset-percentile-help"
                      >
                        잘 모르면 건너뛰세요. 선택형 참고 신호일 뿐이에요.
                      </span>
                    </label>
                    <label className="text-sm font-extrabold text-[#31415d]">
                      부채비율
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (%)
                      </span>
                      <input
                        aria-describedby="debt-ratio-help"
                        className={inputClass}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            debtServiceRatio:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                        ref={debtRatioInputRef}
                        required
                        step="1"
                        type="number"
                        value={profile.debtServiceRatio}
                      />
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#7a879b]"
                        id="debt-ratio-help"
                      >
                        월 부채 상환액 ÷ 월소득
                      </span>
                    </label>
                  </div>

                  <details
                    className="mt-4 rounded-2xl border border-[#dce6ee] bg-[#fbfcfe] px-4 py-3 text-sm text-[#66758a]"
                    id="psid-reference-note"
                  >
                    <summary className="cursor-pointer font-extrabold text-[#35506d]">
                      PSID 참고 구간 안내
                    </summary>
                    <p className="mt-2 leading-6">
                      공개된 2019 PSID 가구 순자산 분포 표의
                      25·50·75·90백분위 경계만 참고합니다. 한국 자산 백분위가
                      아니며 L1–L15 계산에는 사용하지 않습니다.
                    </p>
                  </details>

                  <details className="mt-4 rounded-2xl border border-[#dce6ee] px-4 py-3">
                    <summary className="cursor-pointer text-sm font-extrabold text-[#35506d]">
                      이번 달 변화 추가
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (선택)
                      </span>
                    </summary>
                    <label className="mt-3 block text-sm font-extrabold text-[#31415d]">
                      이름·연락처·계좌·금액 없이 상황만 적어 주세요
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
                  </details>
                </section>
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
                  {isPreparing
                    ? "레벨 분류와 행동 준비 중…"
                    : "레벨 분류하고 행동 3개 복제"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
