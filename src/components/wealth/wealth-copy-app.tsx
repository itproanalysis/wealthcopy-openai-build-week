"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  containsLikelySensitiveData,
  createFallbackAssessment,
  PATH_TYPE_LABELS,
  type AiPathAssessment,
} from "@/lib/wealth/assessment";
import {
  matchWealthPaths,
  type PathType,
  type WealthPathResult,
  type WealthProfile,
  wealthProfileSchema,
} from "@/lib/wealth/engine";

import { WealthLogo } from "./logo";
import { PathIcon } from "./path-icon";

type Stage = "profile" | "paths" | "plan";
type AssessmentSource = "gpt-5.6" | "fallback";

type ComparePathsResponse = {
  assessment?: AiPathAssessment;
  error?: string;
  model?: string | null;
  paths?: WealthPathResult[];
  source?: AssessmentSource;
  warning?: string;
};

type PlanTask = {
  detail: string;
  done: boolean;
  id: string;
  title: string;
};

const SAMPLE_PROFILE: WealthProfile = {
  currentLevel: "L6",
  targetLevel: "L7",
  monthlyIncome: 6_500_000,
  monthlySavings: 3_100_000,
  debtRatio: 18,
  householdType: "single",
  riskPreference: "balanced",
  emergencyFundMonths: 5,
};

const SAMPLE_CONSTRAINT_NOTE =
  "내년에 이사 가능성이 있어 현금 여유를 유지하고 싶어요.";
const STORED_PLAN_KEY = "wealthcopy-demo-plan-v1";

const INITIAL_PATHS = matchWealthPaths(SAMPLE_PROFILE);

const PATH_STYLES: Record<
  PathType,
  { accent: string; label: string; surface: string }
> = {
  stable: {
    accent: "text-[#1d67a8]",
    label: "생활 여유 우선",
    surface: "from-[#f5faff] to-white",
  },
  balanced: {
    accent: "text-[#008f92]",
    label: "지속 가능성 우선",
    surface: "from-[#edfbfa] to-white",
  },
  fast: {
    accent: "text-[#7455a8]",
    label: "속도 우선",
    surface: "from-[#faf7ff] to-white",
  },
};

const REASON_LABELS: Record<string, string> = {
  commitment_within_limit: "현재 월 가용액 안에서 비교 가능",
  commitment_over_limit: "현재 월 가용액보다 부담이 큼",
  liquidity_priority_match: "현금 여유를 지키는 조건과 가까움",
  speed_priority_match: "빠른 이동 선호와 가까움",
  debt_caution: "부채 부담을 먼저 점검해야 함",
  household_stability_need: "가구 지출 변동성 고려 필요",
  constraint_conflict: "추가 조건과 충돌 가능",
  missing_context: "추가 정보가 필요함",
};

const TRADEOFF_LABELS: Record<string, string> = {
  longer_timeline: "예상 기간이 더 길어요",
  higher_monthly_burden: "매달 필요한 금액이 커요",
  lower_liquidity: "생활비 여유가 줄 수 있어요",
  higher_execution_difficulty: "꾸준히 실행하기 더 어려워요",
  goal_timeline_uncertain: "기간은 보장되지 않는 추정치예요",
};

const HOUSEHOLD_LABELS: Record<WealthProfile["householdType"], string> = {
  single: "1인 가구",
  couple: "부부",
  family: "자녀 있음",
  other: "기타",
};

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-[#dce5ef] bg-white px-3.5 text-[15px] text-[#10213f] outline-none transition placeholder:text-[#9aa7b9] focus:border-[#06a4a8] focus:ring-4 focus:ring-[#06a4a8]/10";

function formatKrw(value: number) {
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억 원`;
  }

  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만 원`;
}

function formatYears(months: number) {
  return `${(months / 12).toFixed(1)}년`;
}

function getSessionId() {
  const key = "wealthcopy-anonymous-session";
  const existing = window.localStorage.getItem(key);

  if (existing) return existing;

  const created = window.crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function buildPlanTasks(
  profile: WealthProfile,
  path: WealthPathResult,
): PlanTask[] {
  return [
    {
      id: "cash-buffer",
      title: "현금 여유 다시 확인",
      detail: `비상자금 ${profile.emergencyFundMonths}개월분이 이번 달에도 유지되는지 확인해요.`,
      done: false,
    },
    {
      id: "debt-review",
      title: "부채 상환 일정 점검",
      detail: `부채상환 비율 ${profile.debtRatio}%와 예정된 납부 일정을 확인해요.`,
      done: false,
    },
    {
      id: "commitment",
      title: "월 실행 한도 확정",
      detail: `${formatKrw(path.monthlyRequired)}은 데모 기준이에요. 실제 가용액 안에서 실행 한도를 확정해요.`,
      done: false,
    },
    {
      id: "monthly-checkin",
      title: "월말 경로 점검 예약",
      detail: "소득·지출 변화가 생겼는지 확인하고 다음 달 경로를 다시 비교해요.",
      done: false,
    },
  ];
}

export function WealthCopyApp() {
  const [stage, setStage] = useState<Stage>("profile");
  const [profile, setProfile] = useState<WealthProfile>(SAMPLE_PROFILE);
  const [constraintNote, setConstraintNote] = useState(
    SAMPLE_CONSTRAINT_NOTE,
  );
  const [paths, setPaths] = useState<WealthPathResult[]>(INITIAL_PATHS);
  const [assessment, setAssessment] = useState<AiPathAssessment>(
    createFallbackAssessment(SAMPLE_PROFILE, INITIAL_PATHS),
  );
  const [source, setSource] = useState<AssessmentSource>("fallback");
  const [warning, setWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasFreshAnalysis, setHasFreshAnalysis] = useState(false);
  const [pendingPath, setPendingPath] = useState<WealthPathResult | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [selectedPath, setSelectedPath] = useState<WealthPathResult | null>(
    null,
  );
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [reminderOn, setReminderOn] = useState(false);
  const acknowledgmentRef = useRef<HTMLInputElement>(null);
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const analysisAbortRef = useRef<AbortController>(null);
  const analysisSequenceRef = useRef(0);

  const completedTasks = tasks.filter((task) => task.done).length;
  const progress = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;
  const leadPath = assessment.leadComparisonPathId;

  const stageNumber = stage === "profile" ? 1 : stage === "paths" ? 2 : 3;

  useEffect(() => {
    const saved = window.localStorage.getItem(STORED_PLAN_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        pathType?: unknown;
        profile?: unknown;
        reminderOn?: unknown;
        taskState?: unknown;
        version?: unknown;
      };
      const parsedProfile = wealthProfileSchema.safeParse(parsed.profile);

      if (parsed.version !== 1 || !parsedProfile.success) {
        throw new Error("Invalid stored plan");
      }

      const restoredPaths = matchWealthPaths(parsedProfile.data);
      const restoredPath = restoredPaths.find(
        (path) => path.type === parsed.pathType,
      );
      if (!restoredPath || restoredPath.budgetGap > 0) {
        throw new Error("Stored path is no longer valid");
      }

      const restoredTasks = buildPlanTasks(parsedProfile.data, restoredPath);
      if (Array.isArray(parsed.taskState)) {
        for (const task of restoredTasks) {
          const storedTask = parsed.taskState.find(
            (item): item is { done: boolean; id: string } =>
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              item.id === task.id &&
              "done" in item &&
              typeof item.done === "boolean",
          );
          task.done = storedTask?.done ?? false;
        }
      }

      const restoreTimer = window.setTimeout(() => {
        setProfile(parsedProfile.data);
        setPaths(restoredPaths);
        setAssessment(
          createFallbackAssessment(parsedProfile.data, restoredPaths),
        );
        setSource("fallback");
        setWarning("이 브라우저에 저장된 데모 계획을 복원했습니다.");
        setSelectedPath(restoredPath);
        setTasks(restoredTasks);
        setReminderOn(parsed.reminderOn === true);
        setHasFreshAnalysis(true);
        setStage("plan");
      }, 0);

      return () => window.clearTimeout(restoreTimer);
    } catch {
      window.localStorage.removeItem(STORED_PLAN_KEY);
    }
  }, []);

  useEffect(() => {
    if (!selectedPath || tasks.length === 0) return;

    window.localStorage.setItem(
      STORED_PLAN_KEY,
      JSON.stringify({
        version: 1,
        profile,
        pathType: selectedPath.type,
        taskState: tasks.map((task) => ({ id: task.id, done: task.done })),
        reminderOn,
      }),
    );
  }, [profile, reminderOn, selectedPath, tasks]);

  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!pendingPath) return;

    const previouslyFocused = document.activeElement;
    const pageContent = pageContentRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(
      () => acknowledgmentRef.current?.focus(),
      0,
    );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingPath(null);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogPanelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      pageContent?.removeAttribute("inert");
      pageContent?.removeAttribute("aria-hidden");
      document.removeEventListener("keydown", closeOnEscape);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [pendingPath]);

  const profileSummary = useMemo(
    () => [
      `월소득 ${formatKrw(profile.monthlyIncome)}`,
      `가용액 ${formatKrw(profile.monthlySavings)}`,
      `비상자금 ${profile.emergencyFundMonths}개월`,
      HOUSEHOLD_LABELS[profile.householdType],
    ],
    [profile],
  );

  function scrollToService() {
    document
      .getElementById("service")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function invalidateCurrentResult() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    analysisSequenceRef.current += 1;
    setIsAnalyzing(false);
    setHasFreshAnalysis(false);
    setSelectedPath(null);
    setTasks([]);
    window.localStorage.removeItem(STORED_PLAN_KEY);
  }

  function updateProfile(patch: Partial<WealthProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setFormError(null);
    invalidateCurrentResult();
  }

  function updateConstraintNote(value: string) {
    setConstraintNote(value);
    setFormError(null);
    invalidateCurrentResult();
  }

  async function analyzeProfile(
    profileToAnalyze: WealthProfile,
    noteToAnalyze = constraintNote,
  ) {
    const validated = wealthProfileSchema.safeParse(profileToAnalyze);

    if (!validated.success) {
      setFormError(
        validated.error.issues[0]?.message ?? "입력값을 다시 확인해 주세요.",
      );
      setStage("profile");
      scrollToService();
      return;
    }

    if (containsLikelySensitiveData(noteToAnalyze)) {
      setFormError(
        "이메일, 전화번호, 주민등록번호 등 개인정보를 제거해 주세요.",
      );
      setStage("profile");
      scrollToService();
      return;
    }

    analysisAbortRef.current?.abort();
    const abortController = new AbortController();
    const requestSequence = analysisSequenceRef.current + 1;
    analysisAbortRef.current = abortController;
    analysisSequenceRef.current = requestSequence;

    setFormError(null);
    setWarning(null);
    setIsAnalyzing(true);

    const localPaths = matchWealthPaths(validated.data);
    const localAssessment = createFallbackAssessment(
      validated.data,
      localPaths,
      noteToAnalyze,
    );
    setProfile(validated.data);
    setPaths(localPaths);
    setAssessment(localAssessment);
    setSource("fallback");
    setHasFreshAnalysis(true);
    setSelectedPath(null);
    setTasks([]);
    window.localStorage.removeItem(STORED_PLAN_KEY);
    setStage("paths");

    window.setTimeout(scrollToService, 0);

    try {
      const response = await fetch("/api/paths/compare", {
        body: JSON.stringify({
          constraintNote: noteToAnalyze,
          profile: validated.data,
          sessionId: getSessionId(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const result = (await response.json()) as ComparePathsResponse;

      if (requestSequence !== analysisSequenceRef.current) return;

      if (!result.assessment || !result.paths) {
        throw new Error(result.error ?? "경로 분석을 완료하지 못했습니다.");
      }

      setAssessment(result.assessment);
      setPaths(result.paths);
      setSource(result.source ?? "fallback");
      setWarning(result.warning ?? null);
    } catch (error) {
      if (
        abortController.signal.aborted ||
        requestSequence !== analysisSequenceRef.current
      ) {
        return;
      }
      setWarning(
        error instanceof Error
          ? `${error.message} 규칙 기반 결과를 유지합니다.`
          : "AI 연결이 어려워 규칙 기반 결과를 유지합니다.",
      );
    } finally {
      if (requestSequence === analysisSequenceRef.current) {
        setIsAnalyzing(false);
        analysisAbortRef.current = null;
      }
    }
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyzeProfile(profile);
  }

  function startSample() {
    setProfile(SAMPLE_PROFILE);
    setConstraintNote(SAMPLE_CONSTRAINT_NOTE);
    void analyzeProfile(SAMPLE_PROFILE, SAMPLE_CONSTRAINT_NOTE);
  }

  function requestCopy(path: WealthPathResult) {
    if (
      path.budgetGap > 0 ||
      isAnalyzing ||
      assessment.status !== "ready"
    ) {
      return;
    }
    setHasAcknowledged(false);
    setPendingPath(path);
  }

  function confirmCopy() {
    if (!pendingPath || !hasAcknowledged) return;

    const nextTasks = buildPlanTasks(profile, pendingPath);

    setSelectedPath(pendingPath);
    setTasks(nextTasks);
    setPendingPath(null);
    setStage("plan");
    window.setTimeout(scrollToService, 0);
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function clearSavedPlan() {
    window.localStorage.removeItem(STORED_PLAN_KEY);
    setSelectedPath(null);
    setTasks([]);
    setReminderOn(false);
    setHasFreshAnalysis(false);
    setWarning(null);
    setStage("profile");
    window.setTimeout(scrollToService, 0);
  }

  return (
    <>
      <div className="min-h-screen" ref={pageContentRef}>
      <header className="sticky top-0 z-30 border-b border-[#dce5ef]/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button
            aria-label="WealthCopy 처음으로"
            className="cursor-pointer"
            onClick={() => {
              setStage("profile");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            type="button"
          >
            <WealthLogo />
          </button>
          <nav
            aria-label="서비스 단계"
            className="hidden items-center gap-1 rounded-full bg-[#f3f7fb] p-1 md:flex"
          >
            {[
              ["조건 입력", "profile"],
              ["경로 비교", "paths"],
              ["실행 계획", "plan"],
            ].map(([label, value], index) => {
              const enabled =
                value === "profile" ||
                (value === "paths" && hasFreshAnalysis) ||
                (value === "plan" && selectedPath);
              const active = stage === value;

              return (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-[#082a66] shadow-sm"
                      : "text-[#75829a] hover:text-[#082a66]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  disabled={!enabled}
                  key={value}
                  onClick={() => {
                    setStage(value as Stage);
                    window.setTimeout(scrollToService, 0);
                  }}
                  type="button"
                >
                  <span className="mr-1.5 text-xs text-[#06a4a8]">
                    0{index + 1}
                  </span>
                  {label}
                </button>
              );
            })}
          </nav>
          <span className="rounded-full border border-[#06a4a8]/25 bg-[#effafa] px-3 py-1.5 text-xs font-bold text-[#00898c]">
            BUILD WEEK DEMO
          </span>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#e3ebf3]">
          <div
            aria-hidden="true"
            className="absolute -right-36 top-8 size-[34rem] rounded-full bg-[#daf5f3]/65 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#06a4a8]/25 bg-[#effafa] px-3.5 py-2 text-xs font-extrabold tracking-[0.08em] text-[#00898c]">
                <span className="size-2 rounded-full bg-[#06a4a8]" />
                대표 자산 경로 시뮬레이션
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[1.04] tracking-[-0.065em] text-[#082a66] sm:text-6xl lg:text-7xl">
                다음 자산그룹으로
                <span className="mt-2 block text-[#06a4a8]">
                  가는 경로를 복사하세요.
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5f6f87]">
                복잡한 상품 탐색 대신, 내 조건과 가까운 3개 대표 시나리오를
                한눈에 비교하고 월간 실행 체크리스트로 옮깁니다.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  className="rounded-xl bg-[#082a66] px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(8,42,102,0.2)] transition hover:-translate-y-0.5 hover:bg-[#061f51] disabled:cursor-wait disabled:opacity-60"
                  disabled={isAnalyzing}
                  onClick={startSample}
                  type="button"
                >
                  샘플로 바로 비교
                </button>
                <button
                  className="rounded-xl border border-[#cdd9e5] bg-white px-6 py-3.5 text-sm font-bold text-[#082a66] transition hover:border-[#06a4a8] hover:bg-[#f5fbfb]"
                  onClick={() => {
                    setStage("profile");
                    scrollToService();
                  }}
                  type="button"
                >
                  내 조건 직접 입력
                </button>
              </div>
              <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#7a879c]">
                <span aria-hidden="true">ⓘ</span>
                교육용 데모이며 실제 투자·대출·세금 조언이나 거래를 제공하지
                않습니다.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_30px_90px_rgba(21,67,112,0.14)] backdrop-blur sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8390a5]">
                      CURRENT
                    </p>
                    <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-[#082a66]">
                      L6
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#008f92]">
                      NEXT GOAL
                    </p>
                    <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-[#06a4a8]">
                      L7
                    </p>
                  </div>
                </div>

                <div className="relative my-9 h-20">
                  <div className="absolute left-5 right-5 top-9 h-2 rounded-full bg-gradient-to-r from-[#7ba2d7] via-[#4fb7c3] to-[#06a4a8]" />
                  {[12, 38, 65, 88].map((left, index) => (
                    <span
                      className="absolute top-[1.65rem] grid size-6 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-[#06a4a8] shadow"
                      key={left}
                      style={{ left: `${left}%` }}
                    >
                      {index === 3 ? (
                        <span className="size-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["비교", "3개 경로"],
                    ["복사", "월 계획"],
                    ["실행", "진행 추적"],
                  ].map(([title, copy]) => (
                    <div
                      className="rounded-2xl bg-[#f3f8fc] px-3 py-4 text-center"
                      key={title}
                    >
                      <p className="text-sm font-extrabold text-[#082a66]">
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-[#7a879c]">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-5 -left-4 rounded-2xl bg-[#082a66] px-5 py-4 text-white shadow-xl sm:-left-8">
                <p className="text-xs text-white/60">Wealth Engine</p>
                <p className="mt-1 text-sm font-bold">
                  규칙 계산 + GPT‑5.6 설명
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="scroll-mt-24 py-14 sm:py-20"
          id="service"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-[#06a4a8]">
                  0{stageNumber} / 03
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[#082a66] sm:text-4xl">
                  {stage === "profile"
                    ? "지금 조건을 알려주세요."
                    : stage === "paths"
                      ? "대표 경로 3개를 비교하세요."
                      : "이번 달 실행 계획입니다."}
                </h2>
              </div>
              {stage !== "profile" ? (
                <div className="flex flex-wrap gap-2">
                  {profileSummary.map((item) => (
                    <span
                      className="rounded-full border border-[#dce5ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#63718a]"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {stage === "profile" ? (
              <form
                className="wc-rise grid gap-6 rounded-[2rem] border border-[#dce5ef] bg-white p-5 shadow-[0_20px_70px_rgba(29,71,113,0.08)] sm:p-8 lg:grid-cols-[1fr_0.38fr]"
                onSubmit={handleProfileSubmit}
              >
                <div>
                  <div className="mb-7 flex items-center gap-4 rounded-2xl bg-[#f3f8fc] p-4">
                    <span className="grid size-13 place-items-center rounded-full bg-white text-lg font-black text-[#082a66] shadow-sm">
                      L6
                    </span>
                    <div className="h-px flex-1 border-t-2 border-dashed border-[#a9c1dc]" />
                    <span className="grid size-13 place-items-center rounded-full bg-[#e6f8f7] text-lg font-black text-[#008f92] shadow-sm">
                      L7
                    </span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-sm font-bold text-[#31415d]">
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
                        step="10"
                        type="number"
                        value={profile.monthlyIncome / 10_000}
                      />
                    </label>
                    <label className="text-sm font-bold text-[#31415d]">
                      월 가용 저축액
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (만원)
                      </span>
                      <input
                        className={inputClass}
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            monthlySavings:
                              Number(event.target.value) * 10_000,
                          })
                        }
                        step="10"
                        type="number"
                        value={profile.monthlySavings / 10_000}
                      />
                    </label>
                    <label className="text-sm font-bold text-[#31415d]">
                      부채상환 비율
                      <span className="ml-1 font-normal text-[#8995a8]">
                        (%)
                      </span>
                      <input
                        className={inputClass}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          updateProfile({
                            debtRatio: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={profile.debtRatio}
                      />
                    </label>
                    <label className="text-sm font-bold text-[#31415d]">
                      비상자금 보유
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
                    <label className="text-sm font-bold text-[#31415d]">
                      가구 유형
                      <select
                        className={inputClass}
                        onChange={(event) =>
                          updateProfile({
                            householdType: event.target
                              .value as WealthProfile["householdType"],
                          })
                        }
                        value={profile.householdType}
                      >
                        {Object.entries(HOUSEHOLD_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>

                  <fieldset className="mt-6">
                    <legend className="text-sm font-bold text-[#31415d]">
                      경로 성향
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(["stable", "balanced", "fast"] as const).map((type) => (
                        <label
                          className={`cursor-pointer rounded-xl border p-4 transition ${
                            profile.riskPreference === type
                              ? "border-[#06a4a8] bg-[#effafa] ring-2 ring-[#06a4a8]/10"
                              : "border-[#dce5ef] bg-white hover:border-[#9dcfd0]"
                          }`}
                          key={type}
                        >
                          <input
                            checked={profile.riskPreference === type}
                            className="sr-only"
                            name="riskPreference"
                            onChange={() =>
                              updateProfile({
                                riskPreference: type,
                              })
                            }
                            type="radio"
                          />
                          <span className="font-extrabold text-[#082a66]">
                            {PATH_TYPE_LABELS[type]}
                          </span>
                          <span className="ml-2 text-xs text-[#7a879c]">
                            {PATH_STYLES[type].label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="mt-6 block text-sm font-bold text-[#31415d]">
                    이번 계획에서 꼭 고려할 점
                    <input
                      className={inputClass}
                      maxLength={500}
                      onChange={(event) =>
                        updateConstraintNote(event.target.value)
                      }
                      placeholder="예: 내년에 육아휴직 가능성이 있어 현금 여유가 중요해요."
                      type="text"
                      value={constraintNote}
                    />
                  </label>

                  {formError ? (
                    <p
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      role="alert"
                    >
                      {formError}
                    </p>
                  ) : null}
                </div>

                <aside className="flex flex-col justify-between rounded-2xl bg-[#082a66] p-6 text-white">
                  <div>
                    <p className="text-xs font-bold tracking-[0.14em] text-[#74d8d7]">
                      INPUT SAFETY
                    </p>
                    <h3 className="mt-3 text-xl font-extrabold tracking-[-0.03em]">
                      이름과 계좌정보는 입력하지 마세요.
                    </h3>
                    <ul className="mt-5 space-y-3 text-sm leading-6 text-white/70">
                      <li>
                        • 계획 복사 시 입력값과 체크 상태를 이 브라우저에만
                        저장합니다.
                      </li>
                      <li>• 모델이 기간과 금액을 바꿀 수 없습니다.</li>
                      <li>• 특정 금융상품이나 매매를 추천하지 않습니다.</li>
                    </ul>
                  </div>
                  <button
                    className="mt-8 rounded-xl bg-[#06a4a8] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#079397] disabled:cursor-wait disabled:opacity-60"
                    disabled={isAnalyzing}
                    type="submit"
                  >
                    {isAnalyzing ? "비교 중…" : "경로 3개 비교하기"}
                  </button>
                </aside>
              </form>
            ) : null}

            {stage === "paths" ? (
              <div className="wc-rise">
                <div
                  aria-busy={isAnalyzing}
                  aria-live="polite"
                  className="mb-6 grid gap-4 rounded-2xl border border-[#cfe8e7] bg-[#f0fbfa] p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm">
                    ✦
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold text-[#082a66]">
                        {isAnalyzing
                          ? "GPT‑5.6이 세 경로의 차이를 정리하고 있어요."
                          : assessment.summaryKo}
                      </p>
                      {!isAnalyzing ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            source === "gpt-5.6"
                              ? "bg-[#082a66] text-white"
                              : "bg-white text-[#63718a]"
                          }`}
                        >
                          {source === "gpt-5.6"
                            ? "GPT‑5.6 분석"
                            : "규칙 기반 설명"}
                        </span>
                      ) : null}
                    </div>
                    {warning ? (
                      <p className="mt-1 text-xs text-[#6e7d91]">{warning}</p>
                    ) : null}
                  </div>
                  <p className="text-xs font-semibold text-[#6e7d91]">
                    선택은 사용자가 직접 합니다
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  {paths.map((path) => {
                    const style = PATH_STYLES[path.type];
                    const comparison = assessment.comparisons.find(
                      (item) => item.pathId === path.type,
                    );
                    const isLead = leadPath === path.type;
                    const copyBlocked =
                      path.budgetGap > 0 ||
                      isAnalyzing ||
                      assessment.status !== "ready";

                    return (
                      <article
                        className={`relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-b ${style.surface} p-5 shadow-[0_14px_45px_rgba(29,71,113,0.07)] sm:p-6 ${
                          isLead
                            ? "border-[#06a4a8] ring-4 ring-[#06a4a8]/10"
                            : "border-[#dce5ef]"
                        }`}
                        key={path.type}
                      >
                        {isLead ? (
                          <span className="absolute right-4 top-4 rounded-full bg-[#06a4a8] px-3 py-1 text-[11px] font-extrabold text-white">
                            먼저 비교
                          </span>
                        ) : null}
                        <div
                          className={`size-14 ${style.accent}`}
                        >
                          <PathIcon type={path.type} />
                        </div>
                        <p className="mt-5 text-xs font-bold text-[#7b899d]">
                          {style.label}
                        </p>
                        <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#082a66]">
                          {path.title}
                        </h3>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-white/90 p-3">
                            <p className="text-[11px] text-[#8793a5]">
                              대표 기간
                            </p>
                            <p className="mt-1 font-extrabold text-[#082a66]">
                              {formatYears(path.durationMonths)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/90 p-3">
                            <p className="text-[11px] text-[#8793a5]">
                              월 실행 기준
                            </p>
                            <p className="mt-1 font-extrabold text-[#082a66]">
                              {formatKrw(path.monthlyRequired)}
                            </p>
                          </div>
                        </div>

                        <ul className="mt-5 space-y-2.5 text-sm text-[#53627b]">
                          {path.bullets.map((bullet) => (
                            <li className="flex gap-2" key={bullet}>
                              <span className="mt-1 text-[#06a4a8]">•</span>
                              {bullet}
                            </li>
                          ))}
                        </ul>

                        {comparison ? (
                          <div className="mt-5 border-t border-[#dce5ef] pt-4">
                            <p className="text-xs font-extrabold text-[#31415d]">
                              {assessment.status !== "ready"
                                ? "참고용 대표 시나리오예요"
                                : comparison.fit === "strong"
                                ? "조건 적합도가 높아요"
                                : comparison.fit === "strained"
                                  ? "현재 조건에는 부담돼요"
                                  : "비교 가능한 선택지예요"}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[#748197]">
                              {REASON_LABELS[comparison.reasonCodes[0]]}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#9a6b52]">
                              {TRADEOFF_LABELS[comparison.tradeoffCodes[0]]}
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-5 flex items-center justify-between text-xs">
                          <span className="text-[#7f8ca0]">생활비 여유</span>
                          <span
                            aria-label={`5점 중 ${path.liquidityScore}점`}
                            className="flex gap-1"
                          >
                            {[1, 2, 3, 4, 5].map((dot) => (
                              <span
                                className={`size-2 rounded-full ${
                                  dot <= path.liquidityScore
                                    ? "bg-[#06a4a8]"
                                    : "bg-[#dce5ef]"
                                }`}
                                key={dot}
                              />
                            ))}
                          </span>
                        </div>

                        {path.budgetGap > 0 ? (
                          <div className="mt-5 rounded-xl bg-[#fff3eb] px-3.5 py-3 text-xs font-bold text-[#a25832]">
                            현재 가용액보다 월 {formatKrw(path.budgetGap)} 부족
                          </div>
                        ) : null}

                        <button
                          className="mt-5 w-full rounded-xl bg-[#082a66] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#061f51] disabled:cursor-not-allowed disabled:bg-[#d8e0e9] disabled:text-[#8c98a9]"
                          disabled={copyBlocked}
                          onClick={() => requestCopy(path)}
                          type="button"
                        >
                          {isAnalyzing
                            ? "AI 설명 확인 중"
                            : assessment.status ===
                                "professional_review_required"
                              ? "전문가 검토가 필요한 요청"
                              : assessment.status === "needs_more_information"
                                ? "추가 조건을 먼저 확인"
                                : path.budgetGap > 0
                                  ? "조건을 조정해야 복사 가능"
                                  : "이 경로를 계획에 복사"}
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#dce5ef] bg-white p-5 text-sm text-[#6d7a90] sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    기간과 금액은 기획안 재현을 위한{" "}
                    <strong className="text-[#31415d]">
                      대표 시나리오 추정치
                    </strong>
                    이며 목표 도달을 보장하지 않습니다.
                  </p>
                  <button
                    className="shrink-0 font-extrabold text-[#008f92]"
                    onClick={() => setStage("profile")}
                    type="button"
                  >
                    조건 다시 입력 →
                  </button>
                </div>
              </div>
            ) : null}

            {stage === "plan" && selectedPath ? (
              <div className="wc-rise grid gap-6 lg:grid-cols-[1fr_0.42fr]">
                <div className="space-y-6">
                  <section className="overflow-hidden rounded-[2rem] bg-[#082a66] text-white shadow-[0_20px_70px_rgba(8,42,102,0.18)]">
                    <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#06a4a8] px-3 py-1 text-xs font-extrabold">
                            ACTIVE PATH
                          </span>
                          <span className="text-sm text-white/60">
                            {selectedPath.title}
                          </span>
                        </div>
                        <h3 className="mt-5 text-3xl font-black tracking-[-0.045em]">
                          이번 달 실행률 {progress}%
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-white/65">
                          실제 거래가 아닌 월간 점검 계획입니다. 조건이 바뀌면
                          경로를 다시 비교하세요.
                        </p>
                      </div>
                      <div className="relative grid size-32 place-items-center rounded-full bg-white/10">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: `conic-gradient(#21c0c0 ${progress}%, rgba(255,255,255,.12) 0)`,
                          }}
                        />
                        <div className="relative grid size-24 place-items-center rounded-full bg-[#082a66] text-center">
                          <span className="text-3xl font-black">{progress}%</span>
                          <span className="-mt-5 text-[10px] text-white/50">
                            {completedTasks}/{tasks.length} 완료
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[2rem] border border-[#dce5ef] bg-white p-5 sm:p-7">
                    <div className="flex flex-col gap-3 border-b border-[#e6edf4] pb-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-[#06a4a8]">
                          MONTHLY CHECKLIST
                        </p>
                        <h3 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#082a66]">
                          이번 달 네 가지 점검
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#7b889b]">
                          리마인더 화면 데모
                        </span>
                        <button
                          aria-checked={reminderOn}
                          aria-label="리마인더 화면 데모"
                          className={`relative h-7 w-12 rounded-full transition ${
                            reminderOn ? "bg-[#06a4a8]" : "bg-[#cad4df]"
                          }`}
                          onClick={() => setReminderOn((current) => !current)}
                          role="switch"
                          type="button"
                        >
                          <span
                            className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${
                              reminderOn ? "left-6" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 divide-y divide-[#edf1f5]">
                      {tasks.map((task, index) => (
                        <label
                          className="flex cursor-pointer items-start gap-4 py-5"
                          key={task.id}
                        >
                          <input
                            checked={task.done}
                            className="peer sr-only"
                            onChange={() => toggleTask(task.id)}
                            type="checkbox"
                          />
                          <span
                            className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-black transition ${
                              task.done
                                ? "border-[#06a4a8] bg-[#06a4a8] text-white"
                                : "border-[#cbd6e1] bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="flex-1">
                            <span
                              className={`block font-extrabold ${
                                task.done
                                  ? "text-[#8a96a8] line-through"
                                  : "text-[#243653]"
                              }`}
                            >
                              0{index + 1}. {task.title}
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-[#7b889b]">
                              {task.detail}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>

                <aside className="space-y-5">
                  <section className="rounded-[1.75rem] border border-[#cfe8e7] bg-[#effafa] p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold tracking-[0.12em] text-[#008f92]">
                        PATH INTERPRETER
                      </p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#63718a]">
                        {source === "gpt-5.6" ? "GPT‑5.6" : "LOCAL"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-bold leading-6 text-[#214359]">
                      {assessment.summaryKo}
                    </p>
                    {assessment.clarifyingQuestionsKo.length > 0 ? (
                      <div className="mt-4 rounded-xl bg-white/80 p-4">
                        <p className="text-xs font-extrabold text-[#53627b]">
                          다음 비교 전에 확인
                        </p>
                        <ul className="mt-2 space-y-2 text-xs leading-5 text-[#6e7d91]">
                          {assessment.clarifyingQuestionsKo.map((question) => (
                            <li key={question}>• {question}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-[1.75rem] border border-[#dce5ef] bg-white p-6">
                    <p className="text-xs font-extrabold text-[#7b889b]">
                      선택한 대표 시나리오
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className={`size-12 ${PATH_STYLES[selectedPath.type].accent}`}
                      >
                        <PathIcon type={selectedPath.type} />
                      </div>
                      <div>
                        <p className="font-black text-[#082a66]">
                          {selectedPath.title}
                        </p>
                        <p className="text-xs text-[#7b889b]">
                          {formatYears(selectedPath.durationMonths)} · 월{" "}
                          {formatKrw(selectedPath.monthlyRequired)}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-5 space-y-3 border-t border-[#edf1f5] pt-5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-[#7b889b]">현재 월 가용액</dt>
                        <dd className="font-bold text-[#31415d]">
                          {formatKrw(profile.monthlySavings)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#7b889b]">실행 난도</dt>
                        <dd className="font-bold text-[#31415d]">
                          {selectedPath.difficulty}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#7b889b]">리마인더</dt>
                        <dd className="font-bold text-[#31415d]">
                          {reminderOn ? "데모 표시 켬" : "데모 표시 꺼짐"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <button
                    className="w-full rounded-xl border border-[#cdd9e5] bg-white px-5 py-3 text-sm font-extrabold text-[#082a66] transition hover:border-[#06a4a8]"
                    onClick={() => setStage("paths")}
                    type="button"
                  >
                    다른 경로 비교하기
                  </button>

                  <button
                    className="w-full px-5 py-2 text-xs font-bold text-[#7b889b] underline decoration-[#cdd9e5] underline-offset-4"
                    onClick={clearSavedPlan}
                    type="button"
                  >
                    저장된 데모 계획 지우기
                  </button>

                  <p className="rounded-xl bg-[#fff7eb] p-4 text-xs leading-5 text-[#8b643b]">
                    이 계획은 교육용 시뮬레이션입니다. 실제 금융 의사결정 전에는
                    자격 있는 전문가와 현재 상황을 검토하세요.
                  </p>
                </aside>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dce5ef] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-[#7d899d] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <WealthLogo />
          <p className="max-w-3xl leading-5">
            L6·L7 정의와 기간·금액은 현재 데모 시나리오입니다. 수익률 보장,
            상품 추천, 거래 실행 기능을 제공하지 않습니다.
          </p>
        </div>
      </footer>
      </div>

      {pendingPath ? (
        <div
          aria-describedby="copy-dialog-description"
          aria-labelledby="copy-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#051d48]/55 p-5 backdrop-blur-sm"
          role="dialog"
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-7"
            ref={dialogPanelRef}
          >
            <div className={`size-13 ${PATH_STYLES[pendingPath.type].accent}`}>
              <PathIcon type={pendingPath.type} />
            </div>
            <h2
              className="mt-4 text-2xl font-black tracking-[-0.04em] text-[#082a66]"
              id="copy-dialog-title"
            >
              {pendingPath.title}를 계획에 복사할까요?
            </h2>
            <p
              className="mt-3 text-sm leading-6 text-[#6d7a90]"
              id="copy-dialog-description"
            >
              복사는 매매나 자동이체가 아닙니다. 대표 시나리오를 월간 점검
              체크리스트로 옮기며, 모든 실행은 사용자가 직접 결정합니다.
              선택 후 입력값과 체크 상태는 이 브라우저에 저장됩니다.
            </p>
            <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f3f8fc] p-4 text-xs leading-5 text-[#56657c]">
              <input
                checked={hasAcknowledged}
                className="mt-0.5 accent-[#06a4a8]"
                onChange={(event) =>
                  setHasAcknowledged(event.target.checked)
                }
                ref={acknowledgmentRef}
                type="checkbox"
              />
              교육용 시뮬레이션이며 실제 금융 조언이 아니라는 점을
              확인했습니다.
            </label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-[#d5dfe9] px-4 py-3 text-sm font-extrabold text-[#63718a]"
                onClick={() => setPendingPath(null)}
                type="button"
              >
                취소
              </button>
              <button
                className="rounded-xl bg-[#082a66] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#d8e0e9] disabled:text-[#8c98a9]"
                disabled={!hasAcknowledged}
                onClick={confirmCopy}
                type="button"
              >
                계획에 복사
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
