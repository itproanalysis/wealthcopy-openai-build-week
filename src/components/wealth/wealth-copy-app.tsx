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
  recentCompletionsForPlanner,
  pruneRecentActionHistory,
  removeMonthFromActionHistory,
  restoreRecentActionHistory,
  serializeRecentActionHistory,
  updateRecentActionHistory,
  type RecentActionCompletion,
} from "@/lib/wealth/recent-action-history";
import {
  ASSET_LEVEL_LABELS,
  WEALTH_SOURCE_LEVEL_HEADER,
  assetLevelSchema,
  nextAssetLevel,
  type AssetLevel,
} from "@/lib/wealth/asset-level";
import type {
  CashRunwayBand,
  ConcentrationBand,
  DebtRisk,
  IncomeStability,
  LargestAssetGroup,
  Next90DayEvent,
  PsidAssetPercentileBand,
} from "@/lib/wealth/normalized-profile";

import { WealthLogo } from "./logo";

type SetupProfile = {
  totalAssetsEok: number | "";
  totalDebtEok: number | "";
  cashRunwayBand: CashRunwayBand;
  incomeStability: IncomeStability;
  largestAssetGroup: LargestAssetGroup;
  concentrationBand: ConcentrationBand;
  incomeExecutionRatio: number | "";
  assetPercentileBand: PsidAssetPercentileBand;
  debtServiceRatio: number | "";
  debtRisk: DebtRisk;
  next90DayEvent: Next90DayEvent;
};

type ActionSignals = Pick<
  SetupProfile,
  | "cashRunwayBand"
  | "incomeStability"
  | "largestAssetGroup"
  | "concentrationBand"
  | "incomeExecutionRatio"
  | "assetPercentileBand"
  | "debtServiceRatio"
  | "debtRisk"
  | "next90DayEvent"
>;

type SetupStep = 1 | 2 | 3;

type ApiErrorBody = {
  error?: string;
};

class UserFacingPlanError extends Error {}

const PLAN_STORAGE_KEY = "wealthcopy-public-plan-v5";
const DEPRECATED_PLAN_STORAGE_KEYS = [
  "wealthcopy-public-plan-v4",
  "wealthcopy-public-plan-v3",
  "wealthcopy-public-plan-v2",
  "wealthcopy-demo-plan-v1",
] as const;
const SESSION_STORAGE_KEY = "wealthcopy-anonymous-session";
const ACTION_HISTORY_STORAGE_KEY = "wealthcopy-action-history-v1";
const PLAN_REQUEST_TIMEOUT_MS = 20_000;

const INITIAL_PROFILE: SetupProfile = {
  totalAssetsEok: "",
  totalDebtEok: "",
  cashRunwayBand: "unknown",
  incomeStability: "unknown",
  largestAssetGroup: "unknown",
  concentrationBand: "unknown",
  incomeExecutionRatio: "",
  assetPercentileBand: "unknown",
  debtServiceRatio: "",
  debtRisk: "unknown",
  next90DayEvent: "unknown",
};

const INITIAL_NOTE = "";

const inputClass =
  "h-14 w-full rounded-xl border border-[#cbd2cd] bg-[#fffefa] px-4 pr-16 text-[15px] font-semibold text-[#10251f] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:font-normal placeholder:text-[#68746f] hover:border-[#9da9a3] focus:border-[#0d705f] focus:bg-white focus:ring-4 focus:ring-[#0d705f]/12";

const ACTION_STAGE_LABELS = {
  protect: "기반 보호",
  advance: "다음 단계",
  verify: "결과 확인",
} as const;

const KRW_PER_EOK = 100_000_000;
const MAX_EOK_INPUT =
  Math.floor((Number.MAX_SAFE_INTEGER / KRW_PER_EOK) * 100) / 100;

function eokToKrw(value: number) {
  return Math.round(value * KRW_PER_EOK);
}

function formatEokReadback(value: number | "") {
  if (value === "" || !Number.isFinite(value) || value < 0) return null;

  const totalKrw = eokToKrw(value);
  if (!Number.isSafeInteger(totalKrw)) return null;
  if (totalKrw === 0) return "0원";

  const eok = Math.floor(totalKrw / KRW_PER_EOK);
  const remainder = totalKrw % KRW_PER_EOK;
  const manwon = Math.floor(remainder / 10_000);
  const won = remainder % 10_000;
  const parts = [
    eok > 0 ? `${eok.toLocaleString("ko-KR")}억` : "",
    manwon > 0 ? `${manwon.toLocaleString("ko-KR")}만원` : "",
    won > 0 ? `${won.toLocaleString("ko-KR")}원` : "",
  ].filter(Boolean);

  return `${parts.join(" ")} · ${totalKrw.toLocaleString("ko-KR")}원`;
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
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
  const existing = readLocalStorage(SESSION_STORAGE_KEY);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existing,
    )
  ) {
    return existing;
  }

  const created = window.crypto.randomUUID();
  writeLocalStorage(SESSION_STORAGE_KEY, created);
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
  const [clearConfirmationArmed, setClearConfirmationArmed] = useState(false);
  const [replaceConfirmationArmed, setReplaceConfirmationArmed] =
    useState(false);
  const [recentActionHistory, setRecentActionHistory] = useState<
    RecentActionCompletion[]
  >([]);
  const [copyFeedback, setCopyFeedback] = useState<{
    actionId: PublicActionId;
    copied: boolean;
    message: string;
  } | null>(null);
  const [calendarNow, setCalendarNow] = useState(() => new Date());
  const [journeySourceLevel, setJourneySourceLevel] =
    useState<AssetLevel | null>(null);

  const pageContentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const totalAssetsInputRef = useRef<HTMLInputElement>(null);
  const totalDebtInputRef = useRef<HTMLInputElement>(null);
  const firstStructureInputRef = useRef<HTMLSelectElement>(null);
  const concentrationInputRef = useRef<HTMLSelectElement>(null);
  const cashRunwayInputRef = useRef<HTMLSelectElement>(null);
  const executionRatioInputRef = useRef<HTMLInputElement>(null);
  const debtRatioInputRef = useRef<HTMLInputElement>(null);
  const incomeStabilityInputRef = useRef<HTMLSelectElement>(null);
  const debtRiskInputRef = useRef<HTMLSelectElement>(null);
  const next90DayEventInputRef = useRef<HTMLSelectElement>(null);
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
  const totalAssetsReadback = profile
    ? formatEokReadback(profile.totalAssetsEok)
    : null;
  const totalDebtReadback = profile
    ? formatEokReadback(profile.totalDebtEok)
    : null;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const hadDeprecatedPlan = DEPRECATED_PLAN_STORAGE_KEYS.some(
          (key) => readLocalStorage(key) !== null,
        );
        DEPRECATED_PLAN_STORAGE_KEYS.forEach((key) =>
          removeLocalStorage(key),
        );
        const restoredHistory = pruneRecentActionHistory(
          restoreRecentActionHistory(
            readLocalStorage(ACTION_HISTORY_STORAGE_KEY),
          ),
          currentMonth,
        );
        setRecentActionHistory(restoredHistory);

        const restoredPlan = restoreStoredPlan(
          readLocalStorage(PLAN_STORAGE_KEY),
          currentMonth,
        );

        if (restoredPlan) {
          if (restoredPlan.rolledOver) {
            removeLocalStorage(PLAN_STORAGE_KEY);
            setPlan(null);
            setJourneySourceLevel(null);
            setStatusMessage(
              "새 달이 시작됐어요. 최신 가구 자산정보를 입력해 현재 레벨과 행동을 다시 준비해 주세요.",
            );
            return;
          }

          const historyWithCurrentCompletions = restoredPlan.plan.actions.reduce(
            (history, action) =>
              updateRecentActionHistory(
                history,
                action.id,
                restoredPlan.sourceLevel,
                currentMonth,
                action.completed,
              ),
            restoredHistory,
          );
          setRecentActionHistory(historyWithCurrentCompletions);
          setPlan(restoredPlan.plan);
          setJourneySourceLevel(restoredPlan.sourceLevel);
          setStatusMessage("이번 달 행동 기록을 불러왔어요.");
          return;
        }

        removeLocalStorage(PLAN_STORAGE_KEY);
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
      removeLocalStorage(PLAN_STORAGE_KEY);
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

    let saved = false;
    try {
      saved = writeLocalStorage(
        PLAN_STORAGE_KEY,
        serializeStoredPlan(currentMonth, journeySourceLevel, plan),
      );
    } catch {
      saved = false;
    }
    if (saved) return;

    const warningTimer = window.setTimeout(() => {
      setStatusMessage(
        "이번 달 계획은 화면에서 사용할 수 있지만 브라우저에 저장하지 못했어요. 창을 닫기 전에 체크리스트를 복사해 주세요.",
      );
    }, 0);
    return () => window.clearTimeout(warningTimer);
  }, [currentMonth, journeySourceLevel, plan]);

  useEffect(() => {
    if (isRestoring) return;

    let saved = false;
    try {
      saved = writeLocalStorage(
        ACTION_HISTORY_STORAGE_KEY,
        serializeRecentActionHistory(recentActionHistory),
      );
    } catch {
      saved = false;
    }
    if (saved) return;

    const warningTimer = window.setTimeout(() => {
      setStatusMessage(
        "행동 완료 이력을 브라우저에 저장하지 못했어요. 다음 달에는 같은 행동이 다시 보일 수 있습니다.",
      );
    }, 0);
    return () => window.clearTimeout(warningTimer);
  }, [isRestoring, recentActionHistory]);

  useEffect(() => {
    if (!clearConfirmationArmed) return;

    const confirmationTimer = window.setTimeout(() => {
      setClearConfirmationArmed(false);
      setStatusMessage("기록 지우기 확인 시간이 지나 취소했어요.");
    }, 10_000);

    return () => window.clearTimeout(confirmationTimer);
  }, [clearConfirmationArmed]);

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
        setReplaceConfirmationArmed(false);
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
    setClearConfirmationArmed(false);
    setReplaceConfirmationArmed(false);
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
    setReplaceConfirmationArmed(false);
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
    setReplaceConfirmationArmed(false);
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

  function validateStructureSignals() {
    if (!profile) return false;

    if (profile.largestAssetGroup === "unknown") {
      setSetupError("가장 큰 자산 범주를 선택해 주세요.");
      firstStructureInputRef.current?.focus();
      return false;
    }
    if (profile.concentrationBand === "unknown") {
      setSetupError("한 범주에 모인 비중을 선택해 주세요.");
      concentrationInputRef.current?.focus();
      return false;
    }
    if (profile.cashRunwayBand === "unknown") {
      setSetupError("바로 쓸 수 있는 생활비 여유를 선택해 주세요.");
      cashRunwayInputRef.current?.focus();
      return false;
    }

    return true;
  }

  function validateExecutionSignals() {
    if (!profile) return false;

    if (profile.incomeStability === "unknown") {
      setSetupError("소득의 안정성을 선택해 주세요.");
      incomeStabilityInputRef.current?.focus();
      return false;
    }
    if (profile.debtRisk === "unknown") {
      setSetupError("부채 점검 신호를 선택해 주세요.");
      debtRiskInputRef.current?.focus();
      return false;
    }
    if (profile.next90DayEvent === "unknown") {
      setSetupError("앞으로 90일의 큰 변화를 선택해 주세요.");
      next90DayEventInputRef.current?.focus();
      return false;
    }

    return true;
  }

  function handleSetupContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupStep === 1) {
      if (!validateAssetSnapshot()) return;

      setSetupError(null);
      setSetupStep(2);
      window.setTimeout(() => firstStructureInputRef.current?.focus(), 0);
      return;
    }

    if (!validateStructureSignals()) return;
    setSetupError(null);
    setSetupStep(3);
    window.setTimeout(() => executionRatioInputRef.current?.focus(), 0);
  }

  function returnToPreviousSetupStep() {
    setSetupError(null);
    setReplaceConfirmationArmed(false);
    if (setupStep === 3) {
      setSetupStep(2);
      window.setTimeout(() => firstStructureInputRef.current?.focus(), 0);
      return;
    }

    setSetupStep(1);
    window.setTimeout(() => totalAssetsInputRef.current?.focus(), 0);
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || constraintNote === null) return;

    const {
      totalAssetsEok,
      totalDebtEok,
      cashRunwayBand,
      incomeStability,
      largestAssetGroup,
      concentrationBand,
      incomeExecutionRatio,
      assetPercentileBand,
      debtServiceRatio,
      debtRisk,
      next90DayEvent,
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
    if (!validateExecutionSignals()) return;

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
    if (plan && completedCount > 0 && !replaceConfirmationArmed) {
      setReplaceConfirmationArmed(true);
      setSetupError(null);
      return;
    }

    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    let requestTimedOut = false;
    const requestTimeout = window.setTimeout(() => {
      requestTimedOut = true;
      abortController.abort();
    }, PLAN_REQUEST_TIMEOUT_MS);
    requestAbortRef.current = abortController;
    setIsPreparing(true);
    setSetupError(null);

    try {
      const response = await fetch("/api/v2/plan", {
        body: JSON.stringify({
          profile: {
            totalAssetsKrw,
            totalDebtKrw,
            cashRunwayBand,
            incomeStability,
            largestAssetGroup,
            concentrationBand,
            incomeExecutionRatio,
            assetPercentileBand,
            debtServiceRatio,
            debtRisk,
            next90DayEvent,
          },
          constraintNote,
          recentCompletions: recentCompletionsForPlanner(
            recentActionHistory,
            currentMonth,
          ),
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
        cashRunwayBand,
        incomeStability,
        largestAssetGroup,
        concentrationBand,
        incomeExecutionRatio,
        assetPercentileBand,
        debtServiceRatio,
        debtRisk,
        next90DayEvent,
      };
      focusNewPlanRef.current = true;
      setCopyFeedback(null);
      setPlan(nextPlan);
      setJourneySourceLevel(sourceLevel);
      setProfile(null);
      setConstraintNote(null);
      setSetupOpen(false);
      setSetupStep(1);
      setReplaceConfirmationArmed(false);
      setStatusMessage(
        nextPlan.progress > 0
          ? `${nextPlan.nextLevel} 행동 세 개를 준비했고, 같은 행동의 완료 기록은 유지했어요.`
          : `${nextPlan.nextLevel}의 이번 달 행동 세 개가 준비됐어요.`,
      );
    } catch (error) {
      if (requestTimedOut) {
        setSetupError(
          "경로 준비가 20초를 넘겼어요. 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        return;
      }
      if (abortController.signal.aborted) return;
      setSetupError(
        error instanceof UserFacingPlanError
          ? error.message
          : "이번 달 행동을 만들지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      window.clearTimeout(requestTimeout);
      if (requestAbortRef.current === abortController) {
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

    setClearConfirmationArmed(false);
    setPlan(nextPlan);
    const updatedAction = nextPlan.actions.find(
      (action) => action.id === actionId,
    );
    if (journeySourceLevel && updatedAction) {
      setRecentActionHistory((history) =>
        updateRecentActionHistory(
          history,
          actionId,
          journeySourceLevel,
          currentMonth,
          updatedAction.completed,
        ),
      );
    }
    const nextCompletedCount = nextPlan.actions.filter(
      (action) => action.completed,
    ).length;
    setStatusMessage(
      nextCompletedCount === 3
        ? `${actionCopy.title} 완료. 이번 달 행동 세 개를 모두 마쳤어요. 남는 결과는 다음 달 운영에 다시 쓸 수 있게 보관해 주세요. 행동 완료만으로 레벨이 오르지는 않아요. 최신 가구 자산정보로 다시 분류해 주세요.`
        : updatedAction?.completed
          ? `${actionCopy.title} 완료. 남는 결과는 다음 달에 다시 쓸 수 있게 보관해 주세요. 세 개 중 ${nextCompletedCount}개 완료했어요.`
          : `${actionCopy.title} 완료 취소. 세 개 중 ${nextCompletedCount}개 완료했어요.`,
    );
  }

  async function copyActionChecklist(actionId: PublicActionId) {
    const actionCopy = PUBLIC_ACTION_COPY[actionId];
    const checklist = [
      `WealthCopy · ${ACTION_STAGE_LABELS[actionCopy.stage]}`,
      actionCopy.title,
      `남는 결과: ${actionCopy.outcome}`,
      `완료 기준: ${actionCopy.description}`,
      "실행 순서",
      ...actionCopy.steps.map((step, index) => `${index + 1}. ${step}`),
    ].join("\n");

    if (!navigator.clipboard?.writeText) {
      const message =
        "이 브라우저에서는 복사를 사용할 수 없어요. 펼친 순서를 직접 기록해 주세요.";
      setCopyFeedback({ actionId, copied: false, message });
      setStatusMessage(message);
      return;
    }

    try {
      await navigator.clipboard.writeText(checklist);
      const message = `${actionCopy.title} 체크리스트를 복사했어요.`;
      setCopyFeedback({ actionId, copied: true, message });
      setStatusMessage(message);
    } catch {
      const message =
        "체크리스트를 복사하지 못했어요. 펼친 순서를 직접 기록해 주세요.";
      setCopyFeedback({ actionId, copied: false, message });
      setStatusMessage(message);
    }
  }

  function clearPlan() {
    if (!clearConfirmationArmed) {
      setClearConfirmationArmed(true);
      setStatusMessage(
        "이번 달 기록을 지우려면 ‘정말 지우기’를 한 번 더 눌러 주세요.",
      );
      return;
    }

    const planRemoved = removeLocalStorage(PLAN_STORAGE_KEY);
    const deprecatedPlansRemoved = DEPRECATED_PLAN_STORAGE_KEYS.map((key) =>
      removeLocalStorage(key),
    ).every(Boolean);
    const historyWithoutCurrentMonth = removeMonthFromActionHistory(
      recentActionHistory,
      currentMonth,
    );
    let historySaved = false;
    try {
      historySaved = writeLocalStorage(
        ACTION_HISTORY_STORAGE_KEY,
        serializeRecentActionHistory(historyWithoutCurrentMonth),
      );
    } catch {
      historySaved = false;
    }
    const historyRemovedAsFallback = historySaved
      ? false
      : removeLocalStorage(ACTION_HISTORY_STORAGE_KEY);
    setRecentActionHistory(
      historySaved
        ? historyWithoutCurrentMonth
        : historyRemovedAsFallback
          ? []
          : historyWithoutCurrentMonth,
    );
    lastActionSignalsRef.current = null;
    setCopyFeedback(null);
    setClearConfirmationArmed(false);
    setPlan(null);
    setJourneySourceLevel(null);
    setStatusMessage(
      planRemoved &&
        deprecatedPlansRemoved &&
        (historySaved || historyRemovedAsFallback)
        ? historySaved
          ? "이번 달 행동 기록을 지웠어요. 이전 달의 최소 완료 이력은 유지했어요."
          : "이번 달 행동 기록을 지웠어요. 저장 공간 문제로 이전 달의 최소 완료 이력도 함께 지웠어요."
        : "화면의 이번 달 기록은 지웠지만 브라우저 저장소 삭제를 확인하지 못했어요. 공용 기기라면 브라우저 사이트 데이터도 삭제해 주세요.",
    );
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
                className="wc-rise grid min-h-[34rem] animate-pulse gap-5 motion-reduce:animate-none lg:grid-cols-[1.15fr_0.85fr]"
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
                        <label className="grid min-h-16 cursor-pointer grid-cols-[2.25rem_1fr_3.25rem] items-start gap-3 sm:grid-cols-[3rem_1fr_8rem] sm:items-center sm:gap-5">
                          <input
                            aria-describedby={`${actionId}-completion-criterion`}
                            aria-label={`${actionCopy.title}: 완료 기준 ${completed ? "충족됨, 완료 취소" : "충족으로 표시"}`}
                            checked={completed}
                            className="peer sr-only"
                            onChange={() => toggleAction(actionId)}
                            ref={index === 0 ? firstActionInputRef : undefined}
                            type="checkbox"
                          />
                          <span
                            aria-hidden="true"
                            className="font-mono pt-1 text-xs font-medium tracking-[0.08em] text-[#596862] sm:pt-0"
                          >
                            0{index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.12em] text-[#0d705f]">
                              {ACTION_STAGE_LABELS[actionCopy.stage]}
                            </span>
                            <span
                              className={`block text-base font-semibold tracking-[-0.02em] sm:text-lg ${
                                completed ? "text-[#596862]" : "text-[#10251f]"
                              }`}
                            >
                              {actionCopy.title}
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
                            <span className="text-right text-[11px] font-semibold leading-4 text-[#53645d] sm:text-xs">
                              {completed
                                ? "완료됨"
                                : actionId === activeActionId
                                  ? "지금 실행"
                                  : "다음 행동"}
                            </span>
                          </span>
                        </label>
                        <div className="ml-[3rem] mt-4 grid gap-3 sm:ml-[4.25rem] sm:grid-cols-2">
                          <div className="rounded-xl border border-[#d9ddd8] bg-white/75 px-4 py-3">
                            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#596862]">
                              남는 결과
                            </p>
                            <p className="mt-1.5 text-sm font-semibold leading-6 text-[#29483e]">
                              {actionCopy.outcome}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#d9ddd8] bg-white/75 px-4 py-3">
                            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#596862]">
                              완료 기준
                            </p>
                            <p
                              className="mt-1.5 text-sm leading-6 text-[#40534b]"
                              id={`${actionId}-completion-criterion`}
                            >
                              {actionCopy.description}
                            </p>
                          </div>
                        </div>
                        <details className="group ml-[3rem] mt-3 rounded-xl border border-[#d9ddd8] bg-[#fafbf8] px-4 py-3 sm:ml-[4.25rem]">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#29483e] marker:hidden">
                            <span>실행 순서</span>
                            <span className="text-xs font-medium text-[#596862] group-open:hidden">
                              3단계 펼치기
                            </span>
                            <span className="hidden text-xs font-medium text-[#596862] group-open:inline">
                              접기
                            </span>
                          </summary>
                          <ol className="mt-2 space-y-3 border-t border-[#d9ddd8] pt-4">
                            {actionCopy.steps.map((step, stepIndex) => (
                              <li
                                className="grid grid-cols-[1.75rem_1fr] gap-3 text-sm leading-6 text-[#40534b]"
                                key={`${actionId}-${stepIndex}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className="grid size-7 place-items-center rounded-full bg-[#e3eee9] font-mono text-[11px] font-semibold text-[#0d705f]"
                                >
                                  {stepIndex + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                          <div className="mt-4 border-t border-[#d9ddd8] pt-3">
                            <button
                              className="min-h-11 rounded-lg px-3 text-xs font-semibold text-[#0d705f] underline decoration-[#9dbbb0] underline-offset-4 transition-colors hover:bg-[#e7f0ec] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0d705f]/16"
                              onClick={() => void copyActionChecklist(actionId)}
                              type="button"
                            >
                              {copyFeedback?.actionId === actionId &&
                              copyFeedback.copied
                                ? "체크리스트 복사됨"
                                : "체크리스트 복사"}
                            </button>
                            {copyFeedback?.actionId === actionId ? (
                              <p
                                className={`mt-1 text-xs leading-5 ${
                                  copyFeedback.copied
                                    ? "text-[#3d5c51]"
                                    : "text-[#8b4037]"
                                }`}
                              >
                                {copyFeedback.message}
                              </p>
                            ) : null}
                          </div>
                        </details>
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
              <div className="flex min-h-11 items-center gap-4 self-start sm:self-auto">
                <button
                  className={`min-h-11 px-1 text-xs font-semibold underline underline-offset-4 ${
                    clearConfirmationArmed
                      ? "text-[#9f3f35] decoration-[#d5a8a2]"
                      : "text-[#51635c] decoration-[#aeb9b4]"
                  }`}
                  onClick={clearPlan}
                  type="button"
                >
                  {clearConfirmationArmed
                    ? "정말 지우기"
                    : "이번 달 기록 지우기"}
                </button>
                {clearConfirmationArmed ? (
                  <button
                    className="min-h-11 px-1 text-xs font-semibold text-[#51635c]"
                    onClick={() => {
                      setClearConfirmationArmed(false);
                      setStatusMessage("기록 지우기를 취소했어요.");
                    }}
                    type="button"
                  >
                    취소
                  </button>
                ) : null}
              </div>
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
                  {setupStep} / 3
                </p>
                <h2
                  className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#0b202a] sm:text-3xl"
                  id="setup-title"
                >
                  {setupStep === 1
                    ? "내 자산 경로 만들기"
                    : setupStep === 2
                      ? "자산 구조 자가 점검"
                      : "이번 달 실행 여건"}
                </h2>
                <p
                  className="mt-2 max-w-lg text-sm leading-6 text-[#596862]"
                  id="setup-description"
                >
                  {setupStep === 1
                    ? "정확한 금액은 레벨 계산 후 저장하지 않습니다."
                    : setupStep === 2
                      ? "상세 금액 없이 가장 큰 자산 범주와 안전 여력을 추정합니다."
                      : "비율과 변화 신호로 이번 달 행동의 우선순위를 조정합니다."}
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
              <div
                aria-label={`설정 3단계 중 ${setupStep}단계`}
                className="mt-5 grid grid-cols-3 gap-2"
                role="progressbar"
                aria-valuemax={3}
                aria-valuemin={1}
                aria-valuenow={setupStep}
              >
                <span
                  aria-hidden="true"
                  className="h-1 rounded-full bg-[#0d705f]"
                />
                <span
                  aria-hidden="true"
                  className={`h-1 rounded-full ${setupStep >= 2 ? "bg-[#0d705f]" : "bg-[#d9ddd8]"}`}
                />
                <span
                  aria-hidden="true"
                  className={`h-1 rounded-full ${setupStep === 3 ? "bg-[#0d705f]" : "bg-[#d9ddd8]"}`}
                />
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              noValidate
              onSubmit={setupStep < 3 ? handleSetupContinue : handleCreatePlan}
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
                        {totalAssetsReadback ? (
                          <strong className="mt-1 block font-semibold text-[#29483e]">
                            입력값: 약 {totalAssetsReadback}
                          </strong>
                        ) : null}
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
                        {totalDebtReadback ? (
                          <strong className="mt-1 block font-semibold text-[#29483e]">
                            입력값: 약 {totalDebtReadback}
                          </strong>
                        ) : null}
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
                    <p className="mt-2 leading-5">
                      정확한 금액·PSID 선택값·최근 완료 이력은 OpenAI 모델에
                      전달하지 않습니다. 서버가 정한 안전한 보조 행동 후보가 2개
                      이상일 때만 선택한 범주 신호 일부를 OpenAI 모델에 전달합니다.
                      최근 완료 행동의 ID·레벨·경과 월은 서버의 반복 방지에만
                      사용하고, ID·레벨·완료 월은 최대 12개월 동안 이 기기에만
                      저장합니다.
                    </p>
                  </details>
                </section>
                ) : setupStep === 2 ? (
                <section>
                  <p className="text-[11px] font-semibold tracking-[0.11em] text-[#0d705f]">
                    자산 구조 · 자가 추정
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#10251f]">
                    금액보다 구조를 먼저 확인해요
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#596862]">
                    상품명이나 계좌정보 없이 현재 구조에 가장 가까운 추정 구간을
                    선택하세요.
                  </p>

                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#273d35]">
                      가장 큰 자산 범주
                      <span className="ml-1 font-normal text-[#596862]">
                        (필수 자가 추정)
                      </span>
                      <select
                        aria-describedby={`largest-asset-group-help${setupError?.includes("가장 큰 자산 범주") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("가장 큰 자산 범주") || undefined}
                        className={`${inputClass} mt-2 pr-10`}
                        onChange={(event) =>
                          updateProfile({
                            largestAssetGroup: event.target
                              .value as LargestAssetGroup,
                          })
                        }
                        ref={firstStructureInputRef}
                        required
                        value={profile.largestAssetGroup}
                      >
                        <option disabled value="unknown">선택해 주세요</option>
                        <option value="cash">현금·예금</option>
                        <option value="market">상장 금융자산</option>
                        <option value="pension">연금</option>
                        <option value="property">부동산</option>
                        <option value="business_private">사업·비상장 자산</option>
                        <option value="mixed">비슷하게 나뉜 혼합 구조</option>
                      </select>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="largest-asset-group-help"
                      >
                        현재 가구 자산에서 비중이 가장 큰 범주예요.
                      </span>
                    </label>

                    <label className="text-sm font-semibold text-[#273d35]">
                      한 범주에 모인 비중
                      <span className="ml-1 font-normal text-[#596862]">
                        (필수 자가 추정)
                      </span>
                      <select
                        aria-describedby={`concentration-band-help${setupError?.includes("한 범주에 모인 비중") ? " setup-error" : ""}`}
                        aria-invalid={setupError?.includes("한 범주에 모인 비중") || undefined}
                        className={`${inputClass} mt-2 pr-10`}
                        onChange={(event) =>
                          updateProfile({
                            concentrationBand: event.target
                              .value as ConcentrationBand,
                          })
                        }
                        ref={concentrationInputRef}
                        required
                        value={profile.concentrationBand}
                      >
                        <option disabled value="unknown">선택해 주세요</option>
                        <option value="under_30">30% 미만</option>
                        <option value="p30_50">30–50%</option>
                        <option value="p50_70">50–70%</option>
                        <option value="p70_plus">70% 이상</option>
                      </select>
                      <span
                        className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                        id="concentration-band-help"
                      >
                        가장 큰 자산 범주가 전체에서 차지하는 대략의 비중이에요.
                      </span>
                    </label>
                  </div>

                  <label className="mt-6 block text-sm font-semibold text-[#273d35]">
                    바로 쓸 수 있는 생활비 여유
                    <span className="ml-1 font-normal text-[#596862]">
                      (필수 자가 추정)
                    </span>
                    <select
                      aria-describedby={`cash-runway-help${setupError?.includes("바로 쓸 수 있는 생활비 여유") ? " setup-error" : ""}`}
                      aria-invalid={setupError?.includes("바로 쓸 수 있는 생활비 여유") || undefined}
                      className={`${inputClass} mt-2 pr-10`}
                      onChange={(event) =>
                        updateProfile({
                          cashRunwayBand: event.target.value as CashRunwayBand,
                        })
                      }
                      ref={cashRunwayInputRef}
                      required
                      value={profile.cashRunwayBand}
                    >
                      <option disabled value="unknown">선택해 주세요</option>
                      <option value="under_1">1개월 미만</option>
                      <option value="one_to_three">1–3개월</option>
                      <option value="three_to_six">3–6개월</option>
                      <option value="six_to_twelve">6–12개월</option>
                      <option value="twelve_plus">12개월 이상</option>
                    </select>
                    <span
                      className="mt-2 block text-xs font-normal leading-5 text-[#596862]"
                      id="cash-runway-help"
                    >
                      새 대출이나 자산 매각 없이 감당할 수 있는 필수 생활비
                      기간을 골라 주세요.
                    </span>
                  </label>

                  <div className="mt-7 rounded-xl border border-[#c8d8d1] bg-[#edf5f1] px-4 py-4 text-xs leading-5 text-[#285648]">
                    이 선택은 자산 상품을 추천하기 위한 것이 아니라, 이번 달에
                    먼저 정리할 행동의 순서를 정하는 데만 사용합니다.
                  </div>
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

                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#273d35]">
                      소득의 안정성
                      <span className="ml-1 font-normal text-[#596862]">
                        (필수 자가 추정)
                      </span>
                      <select
                        aria-describedby={setupError?.includes("소득의 안정성") ? "setup-error" : undefined}
                        aria-invalid={setupError?.includes("소득의 안정성") || undefined}
                        className={`${inputClass} mt-2 pr-10`}
                        onChange={(event) =>
                          updateProfile({
                            incomeStability: event.target
                              .value as IncomeStability,
                          })
                        }
                        ref={incomeStabilityInputRef}
                        required
                        value={profile.incomeStability}
                      >
                        <option disabled value="unknown">선택해 주세요</option>
                        <option value="stable">매달 대체로 일정해요</option>
                        <option value="variable">월별 변동이 커요</option>
                        <option value="changing">곧 조건이 달라져요</option>
                      </select>
                    </label>

                    <label className="text-sm font-semibold text-[#273d35]">
                      부채 점검 신호
                      <span className="ml-1 font-normal text-[#596862]">
                        (필수 자가 확인)
                      </span>
                      <select
                        aria-describedby={setupError?.includes("부채 점검 신호") ? "setup-error" : undefined}
                        aria-invalid={setupError?.includes("부채 점검 신호") || undefined}
                        className={`${inputClass} mt-2 pr-10`}
                        onChange={(event) =>
                          updateProfile({
                            debtRisk: event.target.value as DebtRisk,
                          })
                        }
                        ref={debtRiskInputRef}
                        required
                        value={profile.debtRisk}
                      >
                        <option disabled value="unknown">선택해 주세요</option>
                        <option value="none">현재 특이사항 없음</option>
                        <option value="variable_rate">변동금리 부담이 있어요</option>
                        <option value="high_cost">비용이 높은 부채가 있어요</option>
                        <option value="near_maturity">곧 만기·조건 변경이 있어요</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-6 block text-sm font-semibold text-[#273d35]">
                    앞으로 90일의 큰 변화
                    <span className="ml-1 font-normal text-[#596862]">
                      (필수 확인)
                    </span>
                    <select
                      aria-describedby={setupError?.includes("앞으로 90일의 큰 변화") ? "setup-error" : undefined}
                      aria-invalid={setupError?.includes("앞으로 90일의 큰 변화") || undefined}
                      className={`${inputClass} mt-2 pr-10`}
                      onChange={(event) =>
                        updateProfile({
                          next90DayEvent: event.target.value as Next90DayEvent,
                        })
                      }
                      ref={next90DayEventInputRef}
                      required
                      value={profile.next90DayEvent}
                    >
                      <option disabled value="unknown">선택해 주세요</option>
                      <option value="none">예정된 큰 변화 없음</option>
                      <option value="income_change">소득·직업 변화</option>
                      <option value="large_expense">큰 지출 예정</option>
                      <option value="debt_maturity">부채 만기·조건 변경</option>
                      <option value="tax">세금 신고·납부 일정</option>
                      <option value="business_capital">사업 자금 일정</option>
                    </select>
                  </label>

                  <label className="mt-6 block text-sm font-semibold text-[#273d35]">
                    미국 PSID 가구 자산 참조 구간
                    <span className="ml-1 font-normal text-[#596862]">(선택)</span>
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
                    <span className="mt-2 block text-xs font-normal leading-5 text-[#596862]" id="asset-percentile-help">
                      잘 모르면 건너뛰세요. 미국 가구 분포를 이해하기 위한 보조
                      참고이며 국내 레벨이나 행동 강도를 정하지 않고 OpenAI
                      모델에도 전달하지 않아요.
                    </span>
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
                      <span className="ml-1 font-normal text-[#596862]">
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
                          setReplaceConfirmationArmed(false);
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

              {replaceConfirmationArmed ? (
                <p
                  className="mx-5 mb-4 rounded-xl border border-[#d8c99f] bg-[#fff9e8] px-4 py-3 text-sm font-medium leading-6 text-[#684f16] sm:mx-8"
                  id="replace-plan-confirmation"
                  role="status"
                >
                  현재 {completedCount}/3 완료 기록이 있어요. 새 분류에서 레벨이나
                  행동이 달라지면 현재 목록이 교체될 수 있습니다. 완료 이력은 같은
                  행동의 반복을 줄이기 위해 이 기기에 남습니다. 아래 확인 버튼을 한
                  번 더 누르면 계속합니다.
                </p>
              ) : null}

              <div className="shrink-0 border-t border-[#d9ddd8] bg-[#fffefa] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:px-8">
                <button
                  className="min-h-12 w-full rounded-xl px-5 text-sm font-semibold text-[#53645d] transition-colors hover:bg-[#edf2ee] sm:w-auto"
                  onClick={
                    setupStep === 1 ? closeSetup : returnToPreviousSetupStep
                  }
                  type="button"
                >
                  {setupStep === 1 ? "취소" : "이전"}
                </button>
                <button
                  aria-describedby={
                    replaceConfirmationArmed
                      ? "replace-plan-confirmation"
                      : undefined
                  }
                  className="mt-2 min-h-12 w-full rounded-xl bg-[#0d705f] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#095b4e] disabled:cursor-wait disabled:opacity-60 sm:mt-0 sm:w-auto"
                  disabled={isPreparing}
                  type="submit"
                >
                  {setupStep === 1
                    ? "자산 구조로 계속"
                    : setupStep === 2
                      ? "실행 여건으로 계속"
                      : isPreparing
                      ? "경로 준비 중…"
                      : replaceConfirmationArmed
                        ? "확인하고 경로 다시 만들기"
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
