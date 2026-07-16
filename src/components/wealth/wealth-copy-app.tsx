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

type SetupStep = 1 | 2;

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
  "h-14 w-full rounded-xl border border-[#cbd2cd] bg-[#fffefa] px-4 pr-16 text-[15px] font-semibold text-[#10251f] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:font-normal placeholder:text-[#68746f] hover:border-[#9da9a3] focus:border-[#0d705f] focus:bg-white focus:ring-4 focus:ring-[#0d705f]/12";

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
  const [setupStep, setSetupStep] = useState<SetupStep>(1);
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
  const activeActionId =
    plan?.actions.find((action) => !action.completed)?.id ?? null;
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
      () => firstActionInputRef.current?.focus({ preventScroll: true }),
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
        setSetupStep(1);
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
    setSetupStep(1);
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
    setSetupStep(1);
  }

  function validateAssetSnapshot() {
    if (!profile) return false;

    if (
      profile.totalAssetsEok === "" ||
      !Number.isFinite(profile.totalAssetsEok) ||
      profile.totalAssetsEok < 0
    ) {
      setSetupError("현재 보유한 총자산을 0 이상의 숫자로 입력해 주세요.");
      totalAssetsInputRef.current?.focus();
      return false;
    }
    if (
      profile.totalDebtEok === "" ||
      !Number.isFinite(profile.totalDebtEok) ||
      profile.totalDebtEok < 0
    ) {
      setSetupError("현재 남은 총부채를 0 이상의 숫자로 입력해 주세요.");
      totalDebtInputRef.current?.focus();
      return false;
    }

    return true;
  }

  function handleSetupContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAssetSnapshot()) return;

    setSetupError(null);
    setSetupStep(2);
    window.setTimeout(() => executionRatioInputRef.current?.focus(), 0);
  }

  function returnToAssetSnapshot() {
    setSetupError(null);
    setSetupStep(1);
    window.setTimeout(() => totalAssetsInputRef.current?.focus(), 0);
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
    if (!validateAssetSnapshot()) return;
    if (totalAssetsEok === "" || totalDebtEok === "") return;
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
      plan.progress < 100 &&
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
      setSetupStep(1);
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
        <header className="sticky top-0 z-30 border-b border-[#d9ddd8]/80 bg-[#f3f2ed]/92 backdrop-blur-xl">
          <div className="mx-auto flex h-[4.75rem] max-w-[77.5rem] items-center justify-between px-5 sm:px-8">
            <WealthLogo />
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-[#5e6c67] sm:block">
                {currentMonthLabel}
              </span>
              <button
                className="min-h-11 rounded-xl border border-[#cfd5d0] bg-[#fffefa] px-4 text-sm font-semibold text-[#203c34] transition-colors hover:border-[#7b9188] hover:bg-white disabled:cursor-wait disabled:opacity-60"
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
                        ? "업데이트"
                        : "시작하기"}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  {isRestoring
                    ? "행동 불러오는 중"
                    : plan?.progress === 100
                      ? "최신 자산으로 재분류"
                      : plan
                        ? "자산정보 업데이트"
                        : "시작하기"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[77.5rem] px-4 py-6 sm:px-8 sm:py-12 lg:py-16">
          {!plan ? (
            isRestoring ? (
              <section
                aria-busy="true"
                aria-label="이번 달 경로 불러오는 중"
                className="wc-rise grid min-h-[34rem] animate-pulse gap-5 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div className="rounded-3xl border border-[#d9ddd8] bg-[#fffefa] p-7 sm:p-12">
                  <div className="h-3 w-28 rounded bg-[#dfe3de]" />
                  <div className="mt-10 h-16 max-w-lg rounded-xl bg-[#e4e7e2]" />
                  <div className="mt-5 h-5 max-w-md rounded bg-[#e9ebe7]" />
                  <div className="mt-14 h-12 w-40 rounded-xl bg-[#dfe3de]" />
                </div>
                <div className="rounded-3xl bg-[#17372e] p-7 sm:p-10">
                  <div className="h-3 w-24 rounded bg-white/15" />
                  <div className="mt-12 space-y-8">
                    <div className="h-14 rounded-xl bg-white/10" />
                    <div className="h-14 rounded-xl bg-white/10" />
                    <div className="h-14 rounded-xl bg-white/10" />
                  </div>
                </div>
              </section>
            ) : (
              <section className="wc-rise grid gap-5 lg:min-h-[37rem] lg:grid-cols-[1.12fr_0.88fr]">
                <div className="flex flex-col justify-center rounded-3xl border border-[#d9ddd8] bg-[#fffefa] px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#0d705f]">
                    WEALTHCOPY · MONTHLY PATH
                  </p>
                  <h1 className="mt-7 max-w-2xl break-keep text-[2.4rem] font-semibold leading-[1.12] tracking-[-0.055em] text-[#0b202a] sm:text-6xl lg:text-[4.5rem]">
                    자산관리를
                    <br />
                    행동으로 바꿉니다.
                  </h1>
                  <p className="mt-7 max-w-xl text-base leading-7 text-[#596862] sm:text-lg sm:leading-8">
                    현재 자산정보를 바탕으로 다음 한 단계를 정리하고, 이번 달에
                    완료할 행동 3개만 보여드려요.
                  </p>
                  {statusMessage ? (
                    <p className="mt-5 text-sm font-medium leading-6 text-[#596862]">
                      {statusMessage}
                    </p>
                  ) : null}
                  <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button
                      className="inline-flex min-h-14 items-center justify-center gap-5 rounded-xl bg-[#0d705f] px-6 text-[15px] font-semibold text-white shadow-[0_12px_30px_rgba(13,112,95,0.16)] transition-colors hover:bg-[#095b4e]"
                      onClick={openSetup}
                      type="button"
                    >
                      내 경로 시작하기
                      <span aria-hidden="true" className="text-lg">→</span>
                    </button>
                    <span className="text-sm font-medium text-[#63716b]">
                      입력 금액은 계산 후 저장하지 않아요
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-3xl bg-[#17372e] px-6 py-10 text-white sm:px-10 sm:py-12">
                  <div aria-hidden="true" className="absolute -right-20 -top-20 size-64 rounded-full border border-white/10" />
                  <div aria-hidden="true" className="absolute -right-7 -top-7 size-40 rounded-full border border-white/10" />
                  <div className="relative flex h-full flex-col">
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#a9c9bd]">
                      다음 경로는 단순하게
                    </p>
                    <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                      이해보다 실행에
                      <br />
                      집중하세요.
                    </h2>
                    <ol className="mt-auto pt-16">
                      {[
                        ["01", "분류", "자산정보로 현재 단계를 확인합니다."],
                        ["02", "복제", "다음 단계의 행동 3개를 받습니다."],
                        ["03", "완료", "이번 달 행동을 하나씩 끝냅니다."],
                      ].map(([number, title, description]) => (
                        <li
                          className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-white/14 py-5 first:border-t-0"
                          key={number}
                        >
                          <span className="font-mono text-xs text-[#a9c9bd]">{number}</span>
                          <span>
                            <strong className="block text-[15px] font-semibold">{title}</strong>
                            <span className="mt-1 block text-sm leading-6 text-white/62">{description}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>
            )
          ) : (
          <div className="wc-rise space-y-5">
            <section className="grid overflow-hidden rounded-3xl border border-[#d9ddd8] bg-[#fffefa] shadow-[0_20px_60px_rgba(7,25,32,0.055)] lg:grid-cols-[1.12fr_0.88fr]">
              <div className="relative overflow-hidden p-6 sm:p-10 lg:p-12">
                <div
                  aria-hidden="true"
                  className="hidden"
                />
                <div className="relative">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#0d705f]">
                    {isMaintenanceLevel ? "자산 유지 단계" : "다음 자산 단계"}
                  </p>
                  <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
                    <span className="text-[4.5rem] font-semibold leading-none tracking-[-0.08em] text-[#0b202a] tabular-nums sm:text-[6.5rem]">
                      {plan.nextLevel}
                    </span>
                    <span className="mb-2 border-l border-[#aeb8b2] pl-4 text-sm font-medium text-[#53645d] sm:mb-3">
                      {isMaintenanceLevel
                        ? "L15 유지 단계"
                        : ASSET_LEVEL_LABELS[plan.nextLevel]}
                    </span>
                  </div>
                  <h1 className="mt-7 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#0b202a] sm:text-[2.65rem]">
                    {completedCount === 3
                      ? "이번 달 3가지 행동을 완료했습니다."
                      : isMaintenanceLevel
                        ? "L15 운영 경로를 유지합니다."
                        : `${plan.nextLevel} 경로를 복제합니다.`}
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-7 text-[#596862]">
                    {completedCount === 3
                      ? isMaintenanceLevel
                        ? "다음 달 최신 자산정보로 유지 경로를 다시 준비합니다."
                        : "다음 레벨은 최신 자산정보를 입력하면 다시 분류됩니다."
                      : isMaintenanceLevel
                        ? "이번 달에는 자산 구조와 운영 연속성을 점검합니다."
                        : "상위 단계로 넘어가기 위해 3가지 행동이 필요합니다."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center border-t border-[#d9ddd8] bg-[#edf2ee] p-6 text-[#0b202a] sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
                <p className="text-xs font-semibold tracking-[0.12em] text-[#0d705f]">
                  이번 달 진행률
                </p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <p className="text-6xl font-semibold leading-none tracking-[-0.065em] tabular-nums sm:text-7xl">
                    {plan.progress}%
                  </p>
                  <p className="pb-1 text-sm font-medium text-[#53645d]">
                    {completedCount} / 3 완료
                  </p>
                </div>
                <progress
                  aria-label="이번 달 행동 진행률"
                  aria-describedby="progress-safety-note"
                  className="wc-progress mt-7"
                  max={3}
                  value={completedCount}
                >
                  {plan.progress}%
                </progress>
                <p
                  className="mt-4 text-xs leading-5 text-[#596862]"
                  id="progress-safety-note"
                >
                  행동 완료율이며 자산 변화나 목표 단계 도달률을 의미하지 않아요.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-[#d9ddd8] bg-[#fffefa] p-5 sm:p-8 lg:p-10">
              <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#0d705f]">
                    이번 달 실행
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#0b202a] sm:text-3xl">
                    {completedCount === 3
                      ? "완료한 3가지 행동"
                      : "완료할 3가지 행동"}
                  </h2>
                </div>
                <p className="text-sm font-medium text-[#596862]">
                  {completedCount === 3
                    ? "이번 달 행동을 모두 확인했어요."
                    : `${currentMonthLabel} · ${completedCount}개 완료`}
                </p>
              </div>

              <fieldset>
                <legend className="sr-only">완료할 행동 세 개</legend>
                <ol className="overflow-hidden rounded-2xl border border-[#d9ddd8] bg-white">
                  {plan.actions.map(({ id: actionId, completed }, index) => {
                    const actionCopy = PUBLIC_ACTION_COPY[actionId];

                    return (
                      <li
                        aria-current={
                          actionId === activeActionId ? "step" : undefined
                        }
                        className={`group relative border-b border-[#d9ddd8] p-4 transition-colors last:border-b-0 focus-within:z-10 focus-within:ring-4 focus-within:ring-[#0d705f]/16 sm:p-6 ${
                          completed
                            ? "bg-[#f4f6f3]"
                            : actionId === activeActionId
                              ? "bg-[#edf5f1] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[#0d705f]"
                              : "bg-white hover:bg-[#fafbf8]"
                        }`}
                        key={actionId}
                      >
                        <label className="grid min-h-16 cursor-pointer grid-cols-[2.25rem_1fr_2.75rem] items-start gap-3 sm:grid-cols-[3rem_1fr_8rem] sm:items-center sm:gap-5">
                          <input
                            checked={completed}
                            className="peer sr-only"
                            onChange={() => toggleAction(actionId)}
                            ref={index === 0 ? firstActionInputRef : undefined}
                            type="checkbox"
                          />
                          <span
                            aria-hidden="true"
                            className="font-mono pt-1 text-xs font-medium tracking-[0.08em] text-[#68756f] sm:pt-0"
                          >
                            0{index + 1}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block text-base font-semibold tracking-[-0.02em] sm:text-lg ${
                                completed ? "text-[#596862]" : "text-[#10251f]"
                              }`}
                            >
                              {actionCopy.title}
                            </span>
                            <span className="mt-1.5 block text-sm leading-6 text-[#596862]">
                              <strong className="mr-1 font-semibold text-[#40534b]">
                                완료 기준 ·
                              </strong>
                              {actionCopy.description}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-2">
                            <span
                              aria-hidden="true"
                              className={`grid size-11 place-items-center rounded-full border text-sm font-semibold transition-colors ${
                                completed
                                  ? "border-[#0d705f] bg-[#0d705f] text-white"
                                  : "border-[#aeb9b3] bg-white text-transparent group-hover:border-[#0d705f]"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="hidden text-xs font-semibold text-[#53645d] sm:block">
                              {completed
                                ? "완료됨"
                                : actionId === activeActionId
                                  ? "지금 실행"
                                  : "다음 행동"}
                            </span>
                          </span>
                        </label>
                        {actionId === "schedule_monthly_checkin" ? (
                          <button
                            className="ml-[3rem] mt-3 min-h-11 rounded-lg px-3 text-xs font-semibold text-[#0d705f] underline decoration-[#9dbbb0] underline-offset-4 transition-colors hover:bg-[#e7f0ec] sm:ml-[4.25rem]"
                            onClick={downloadMonthlyCheckin}
                            type="button"
                          >
                            캘린더에 월말 점검 추가
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </fieldset>

              {plan?.progress === 100 ? (
                <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-[#d9ddd8] pt-6 sm:flex-row sm:items-center">
                  <p className="max-w-2xl text-sm font-medium leading-6 text-[#53645d]">
                    3가지 행동을 완료했어요. 완료만으로 레벨이 오르지는
                    않아요. 최신 가구 자산정보로 현재 레벨을 다시 분류하세요.
                  </p>
                  <button
                    className="min-h-12 w-full shrink-0 rounded-xl bg-[#0d705f] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#095b4e] sm:w-auto"
                    onClick={openSetup}
                    type="button"
                  >
                    최신 자산정보로 다시 분류
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          )}

          <div className="mt-7 flex flex-col gap-3 px-1 text-xs leading-5 text-[#596862] sm:flex-row sm:items-center sm:justify-between">
            <p>
              교육용 행동 기록 화면이며 금융 거래를 실행하거나 의사결정을
              대신하지 않습니다.
            </p>
            {plan ? (
              <button
                className="min-h-11 self-start px-1 text-xs font-semibold text-[#51635c] underline decoration-[#aeb9b4] underline-offset-4 sm:self-auto"
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
          className="fixed inset-0 z-50 grid place-items-center bg-[#071d18]/62 backdrop-blur-sm sm:p-6"
          role="dialog"
        >
          <div
            aria-busy={isPreparing}
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fffefa] shadow-[0_32px_96px_rgba(3,18,24,0.3)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-[42rem] sm:rounded-3xl"
            ref={dialogRef}
          >
            <div className="shrink-0 border-b border-[#d9ddd8] px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.1em] text-[#0d705f]">
                  {setupStep} / 2
                </p>
                <h2
                  className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0b202a] sm:text-3xl"
                  id="setup-title"
                >
                  {setupStep === 1 ? "내 자산 경로 만들기" : "이번 달 실행 여건"}
                </h2>
                <p
                  className="mt-2 max-w-lg text-sm leading-6 text-[#596862]"
                  id="setup-description"
                >
                  {setupStep === 1
                    ? "정확한 금액은 레벨 계산 후 저장하지 않습니다."
                    : "금액 대신 비율과 선택형 참고 구간으로 행동을 조정합니다."}
                </p>
              </div>
              <button
                aria-label="행동 만들기 닫기"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-[#cbd2cd] text-xl font-light text-[#53645d] transition-colors hover:bg-[#edf2ee]"
                onClick={closeSetup}
                type="button"
              >
                ×
              </button>
              </div>
              <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-2">
                <span className="h-1 rounded-full bg-[#0d705f]" />
                <span className={`h-1 rounded-full ${setupStep === 2 ? "bg-[#0d705f]" : "bg-[#d9ddd8]"}`} />
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={setupStep === 1 ? handleSetupContinue : handleCreatePlan}
            >
              <fieldset className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-7" disabled={isPreparing}>
                <legend className="sr-only">
                  자산 레벨 분류와 행동 생성에 사용할 현재 조건
                </legend>

                {setupStep === 1 ? (
                <section>
                  <p className="text-[11px] font-semibold tracking-[0.11em] text-[#0d705f]">
                    가구 자산
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#10251f]">
                    지금 알고 있는 추정값이면 충분해요
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#596862]">
                    순자산은 가구 기준 총자산에서 총부채를 뺀 값입니다. 정확한
                    감정가가 아니어도 현재 알고 있는 범위의 추정값이면 돼요.
                  </p>

                  {plan?.progress === 100 ? (
                    <p className="mt-5 rounded-xl border border-[#c8d8d1] bg-[#edf5f1] px-4 py-3 text-xs font-medium leading-5 text-[#285648]">
                      행동 완료만으로 레벨이 오르지는 않아요. 아래 값을 최신
                      상태로 확인해 제출하면 현재 레벨을 처음부터 다시
                      분류합니다.
                    </p>
                  ) : null}

                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#273d35]">
                      가구 기준 총자산
                      <div className="relative mt-2">
                      <input
                        aria-describedby={`total-assets-help${setupError?.includes("총자산") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("총자산") || undefined}
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
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[#596862]">억원</span>
                      </div>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="total-assets-help"
                      >
                        예금·투자자산·부동산 등 가구가 보유한 자산의 현재 추정
                        합계예요. 3.5는 3억 5천만원입니다.
                      </span>
                    </label>

                    <label className="text-sm font-semibold text-[#273d35]">
                      가구 기준 총부채
                      <div className="relative mt-2">
                      <input
                        aria-describedby={`total-debt-help${setupError?.includes("총부채") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("총부채") || undefined}
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
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[#596862]">억원</span>
                      </div>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="total-debt-help"
                      >
                        주택담보·신용·기타 대출 등 가구가 갚아야 할 부채의 현재
                        추정 합계예요.
                      </span>
                    </label>
                  </div>

                  <div className="mt-7 flex items-start gap-3 rounded-xl bg-[#edf2ee] px-4 py-4 text-[#29483e]">
                    <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-[#7d9a8f] text-[10px]">✓</span>
                    <p className="text-xs leading-5">
                      순자산으로 L1–L15를 내부 분류하고 다음 단계만 보여드려요.
                      계좌번호나 상품별 상세정보는 입력하지 마세요.
                    </p>
                  </div>
                  <details className="mt-3 px-1 text-xs text-[#596862]">
                    <summary className="cursor-pointer font-semibold text-[#40534b]">입력정보 처리 안내</summary>
                    <p className="mt-2 leading-5">입력 금액은 이번 요청의 단계 계산에만 사용하고 저장하지 않으며 OpenAI 모델에도 전달하지 않습니다. 계산된 레벨과 행동 완료 기록만 이 기기에 저장합니다.</p>
                  </details>
                </section>
                ) : (
                <section>
                  <p className="text-[11px] font-semibold tracking-[0.11em] text-[#0d705f]">
                    실행 여건
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#10251f]">
                    실행 여건에 맞게 행동을 조정해요
                  </h3>
                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#273d35]">
                      월소득 중 저축·상환 비율
                      <div className="relative mt-2">
                      <input
                        aria-describedby={`execution-ratio-help${setupError?.includes("실행 비율") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("실행 비율") || undefined}
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
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[#596862]">%</span>
                      </div>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="execution-ratio-help"
                      >
                        월소득 중 저축·상환에 배정할 비중
                      </span>
                    </label>
                    <label className="text-sm font-semibold text-[#273d35]">
                      월소득 대비 부채 상환 비율
                      <div className="relative mt-2">
                      <input
                        aria-describedby={`debt-ratio-help${setupError?.includes("부채비율") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("부채비율") || undefined}
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
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[#596862]">%</span>
                      </div>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="debt-ratio-help"
                      >
                        월 부채 상환액 ÷ 월소득
                      </span>
                    </label>
                  </div>

                  <label className="mt-6 block text-sm font-semibold text-[#273d35]">
                    비슷한 가구 중 내 자산 위치
                    <span className="ml-1 font-normal text-[#68756f]">(선택)</span>
                    <select
                      aria-describedby="asset-percentile-help"
                      className={`${inputClass} mt-2 pr-10`}
                      onChange={(event) =>
                        updateProfile({
                          assetPercentileBand: event.target.value as PsidAssetPercentileBand,
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
                    <span className="mt-2 block text-xs font-normal leading-5 text-[#596862]" id="asset-percentile-help">잘 모르면 건너뛰세요. 경로를 정하는 참고 신호일 뿐이에요.</span>
                  </label>

                  <details
                    className="mt-5 rounded-xl border border-[#d9ddd8] bg-[#fafbf8] px-4 py-3 text-sm text-[#596862]"
                    id="psid-reference-note"
                  >
                    <summary className="cursor-pointer font-semibold text-[#40534b]">
                      데이터 기준 안내
                    </summary>
                    <p className="mt-2 leading-6">
                      공개된 2019 PSID 가구 순자산 분포 표의
                      25·50·75·90백분위 경계만 참고합니다. 한국 자산 백분위가
                      아니며 L1–L15 계산에는 사용하지 않습니다.
                    </p>
                  </details>

                  <details className="mt-3 rounded-xl border border-[#d9ddd8] px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[#40534b]">
                      이번 달 변화 추가
                      <span className="ml-1 font-normal text-[#68756f]">
                        (선택)
                      </span>
                    </summary>
                    <label className="mt-3 block text-sm font-semibold text-[#273d35]">
                      이름·연락처·계좌·금액 없이 상황만 적어 주세요
                      <textarea
                        className="mt-2 min-h-24 w-full resize-none rounded-xl border border-[#cbd2cd] bg-[#fffefa] px-4 py-3 text-[15px] font-medium leading-6 text-[#10251f] outline-none transition placeholder:font-normal placeholder:text-[#68746f] focus:border-[#0d705f] focus:bg-white focus:ring-4 focus:ring-[#0d705f]/12"
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
                )}
              </fieldset>

              {setupError ? (
                <p
                  className="mx-5 mb-4 rounded-xl border border-[#dcb8b1] bg-[#fff5f2] px-4 py-3 text-sm font-medium leading-6 text-[#8b4037] sm:mx-8"
                  id="setup-error"
                  role="alert"
                >
                  {setupError}
                </p>
              ) : null}

              <div className="shrink-0 border-t border-[#d9ddd8] bg-[#fffefa] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:px-8">
                <button
                  className="min-h-12 w-full rounded-xl px-5 text-sm font-semibold text-[#53645d] transition-colors hover:bg-[#edf2ee] sm:w-auto"
                  onClick={setupStep === 1 ? closeSetup : returnToAssetSnapshot}
                  type="button"
                >
                  {setupStep === 1 ? "취소" : "이전"}
                </button>
                <button
                  className="mt-2 min-h-12 w-full rounded-xl bg-[#0d705f] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#095b4e] disabled:cursor-wait disabled:opacity-60 sm:mt-0 sm:w-auto"
                  disabled={isPreparing}
                  type="submit"
                >
                  {setupStep === 1
                    ? "계속"
                    : isPreparing
                      ? "경로 준비 중…"
                      : plan
                        ? "최신 경로 다시 만들기"
                        : "내 경로 만들기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
