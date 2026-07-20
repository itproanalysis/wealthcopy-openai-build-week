import type {
  AssetCompositionKey,
  WealthReport,
} from "./wealth-report";

export const ENGLISH_ASSET_LABELS = {
  liquid: "Cash and short-term deposits",
  home: "Primary residence",
  market: "Public market assets",
  pension: "Pension and long-term accounts",
  incomeProperty: "Income-producing property",
  businessPrivate: "Business and private holdings",
  alternatives: "Alternatives and hedges",
  other: "Other and expected recoveries",
} as const satisfies Record<AssetCompositionKey, string>;

export const ENGLISH_LEVEL_LABELS = {
  L1: "Recovery",
  L2: "Foundation start",
  L3: "Cash-flow reset",
  L4: "Safety buffer",
  L5: "Asset formation",
  L6: "Asset structuring",
  L7: "Growth foundation",
  L8: "Asset expansion",
  L9: "Systematized wealth",
  L10: "Asset operations",
  L11: "Integrated management",
  L12: "Professional management",
  L13: "Governance",
  L14: "Ultra-high-net-worth management",
  L15: "Long-term stewardship",
} as const satisfies Record<WealthReport["level"]["current"], string>;

const ORCHESTRATION_LABELS = {
  framing: {
    verify_then_plan: "Verify first, then plan",
    protect_then_build: "Protect first, then build",
    cashflow_then_gap: "Cash flow before the structural gap",
    structure_then_scale: "Structure before scale",
  },
  leadInsight: {
    safety_is_the_gate: "Safety is the decision gate",
    certainty_before_comparison: "Input certainty precedes comparison",
    near_term_liquidity_first: "Near-term liquidity leads",
    cashflow_sets_pace: "Cash flow sets the pace",
    largest_gap_sets_direction: "The largest composition difference leads",
    balance_before_scale: "Balance precedes scale",
  },
  explanationOrder: {
    diagnosis_first: "Diagnosis first",
    adjustment_first: "Structural review first",
    checkpoint_first: "Checkpoint first",
  },
  connection: {
    safety_to_structure: "Safety to structure",
    evidence_to_priority: "Evidence to review priority",
    event_to_cashflow: "Near-term event to cash flow",
    cashflow_to_structure: "Cash flow to structure",
    structure_to_gap: "Structure to composition difference",
  },
} as const;

export type EnglishKrwFormatOptions = Readonly<{
  compact?: boolean;
  maximumFractionDigits?: number;
}>;

export type DominantCompositionGap = WealthReport["composition"][number];

export type EnglishJudgeReviewLens = Readonly<{
  id: "safeguards" | "cashflow" | "composition";
  title: string;
  status: string;
  detail: string;
  tone: "clear" | "review" | "guarded";
}>;

export type EnglishJudgePlanSelection = Readonly<{
  role: "Framing" | "Lead insight" | "Explanation order" | "Connection";
  id:
    | WealthReport["interpretation"]["framingId"]
    | WealthReport["interpretation"]["leadInsightId"]
    | WealthReport["interpretation"]["explanationOrderId"]
    | WealthReport["interpretation"]["connectionId"];
  label: string;
}>;

export type EnglishJudgeBrief = Readonly<{
  heading: string;
  introduction: string;
  level: Readonly<{
    current: Readonly<{ id: string; label: string }>;
    target: Readonly<{ id: string; label: string }>;
    path: string;
    terminal: boolean;
  }>;
  thresholdGap: Readonly<{
    label: string;
    value: string;
    amountKrw: number;
    explanation: string;
  }>;
  inBandPosition: Readonly<{
    label: string;
    value: string;
    percent: number;
    explanation: string;
  }>;
  dominantGap: Readonly<{
    key: AssetCompositionKey;
    label: string;
    direction: "below" | "within" | "above";
    value: string;
    estimatedAmount?: string;
    explanation: string;
  }>;
  reviewLenses: readonly [
    EnglishJudgeReviewLens,
    EnglishJudgeReviewLens,
    EnglishJudgeReviewLens,
  ];
  safety: Readonly<{
    status: "clear" | "review" | "gate";
    headline: string;
    detail: string;
  }>;
  dataConfidence: Readonly<{
    grade: WealthReport["dataConfidence"]["grade"];
    label: string;
    detail: string;
  }>;
  gptPlan: Readonly<{
    title: string;
    summary: string;
    selections: readonly [
      EnglishJudgePlanSelection,
      EnglishJudgePlanSelection,
      EnglishJudgePlanSelection,
      EnglishJudgePlanSelection,
    ];
    boundary: string;
  }>;
  policy: Readonly<{
    reference: string;
    limitation: string;
    threshold: string;
  }>;
}>;

function decimalDigits(value: number, requested: number | undefined) {
  if (requested !== undefined) {
    return Math.max(0, Math.min(2, Math.trunc(requested)));
  }

  return value >= 100 ? 0 : value >= 10 ? 1 : 2;
}

export function formatEnglishKrw(
  value: number,
  options: EnglishKrwFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "—";

  const compact = options.compact ?? true;
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (!compact || absolute < 1_000) {
    return `${sign}₩${absolute.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  }

  const scale = absolute >= 1_000_000_000_000
    ? { divisor: 1_000_000_000_000, suffix: "T" }
    : absolute >= 1_000_000_000
      ? { divisor: 1_000_000_000, suffix: "B" }
      : absolute >= 1_000_000
        ? { divisor: 1_000_000, suffix: "M" }
        : { divisor: 1_000, suffix: "K" };
  const scaled = absolute / scale.divisor;

  return `${sign}₩${scaled.toLocaleString("en-US", {
    maximumFractionDigits: decimalDigits(scaled, options.maximumFractionDigits),
  })}${scale.suffix}`;
}

export function getDominantCompositionGap(
  report: WealthReport,
): DominantCompositionGap {
  const comparable = report.composition.filter((row) => row.key !== "other");
  const first = comparable[0] ?? report.composition[0];

  return comparable.reduce(
    (largest, row) =>
      row.gapPercentagePoints > largest.gapPercentagePoints ? row : largest,
    first,
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function buildSafety(report: WealthReport): EnglishJudgeBrief["safety"] {
  const criticalCount = report.risks.filter(
    (risk) => risk.severity === "critical",
  ).length;
  const warningCount = report.risks.filter(
    (risk) => risk.severity === "warning",
  ).length;

  if (criticalCount > 0) {
    return {
      status: "gate",
      headline: "Safety gate active",
      detail: `${plural(criticalCount, "critical safeguard")} must be reviewed before structural guidance.`,
    };
  }

  if (warningCount > 0) {
    return {
      status: "review",
      headline: "Safeguard review needed",
      detail: `${plural(warningCount, "warning signal")} should be reviewed alongside the structural comparison.`,
    };
  }

  return {
    status: "clear",
    headline: "No blocking safety signal",
    detail: "The submitted snapshot produced no critical or warning safeguard.",
  };
}

function buildConfidence(
  report: WealthReport,
): EnglishJudgeBrief["dataConfidence"] {
  if (
    report.dataConfidence.grade === "medium" &&
    Number(report.level.current.slice(1)) >= 10
  ) {
    return {
      grade: "medium",
      label: "Scoped upper-band input",
      detail:
        "The submitted fields support asset, debt, and cash-flow comparison, but ownership, covenant, tax, and succession inputs were not collected. Treat governance findings as provisional.",
    };
  }

  const copy = {
    high: {
      label: "High input completeness",
      detail: "The submitted fields support a full structural comparison.",
    },
    medium: {
      label: "Medium input completeness",
      detail: "The report is usable, but selected inputs should be confirmed before relying on the comparison.",
    },
    low: {
      label: "Low input completeness",
      detail: "Treat the comparison as provisional and verify the submitted asset categories first.",
    },
  } as const;

  return { grade: report.dataConfidence.grade, ...copy[report.dataConfidence.grade] };
}

function buildDominantGap(
  row: DominantCompositionGap,
): EnglishJudgeBrief["dominantGap"] {
  const label = ENGLISH_ASSET_LABELS[row.key];
  const points = `${row.gapPercentagePoints.toFixed(1)} pp`;
  const estimatedAmount = formatEnglishKrw(row.estimatedGapKrw);

  if (row.direction === "within") {
    return {
      key: row.key,
      label,
      direction: row.direction,
      value: "Within range",
      explanation: `${label} is within the WealthCopy internal reference range.`,
    };
  }

  if (row.direction === "above") {
    return {
      key: row.key,
      label,
      direction: row.direction,
      value: `${points} above`,
      explanation: `${label} is ${points} above the upper bound of the WealthCopy internal reference range. This concentration signal does not infer a sell amount.`,
    };
  }

  return {
    key: row.key,
    label,
    direction: row.direction,
    value: `${points} below`,
    estimatedAmount,
    explanation: `${label} is ${points} below the lower bound of the WealthCopy internal reference range. The policy-derived shortfall to the next-band lower reference is ${estimatedAmount}; it is not a purchase instruction.`,
  };
}

function buildCashflowLens(report: WealthReport): EnglishJudgeReviewLens {
  const balance = report.cashflow.monthlyBalanceKrw;
  const status = balance > 0 ? "Positive monthly balance" : balance < 0 ? "Monthly deficit" : "Break-even month";
  const tone = balance < 0 ? "guarded" : balance === 0 ? "review" : "clear";

  return {
    id: "cashflow",
    title: "Monthly cash-flow capacity",
    status,
    detail: `The monthly balance is ${formatEnglishKrw(balance)} after living costs and debt payments. The reported deployable amount is ${formatEnglishKrw(report.cashflow.monthlyDeployableKrw)}.`,
    tone,
  };
}

function buildPlan(
  report: WealthReport,
): EnglishJudgeBrief["gptPlan"] {
  const { interpretation } = report;

  return {
    title: "Bounded explanation plan",
    summary:
      "Eligible normal cases may ask GPT-5.6 to choose presentation emphasis and sequence from four server-approved controls; deterministic fallback uses the same validated controls. Financial values and rendered sentences remain server-owned.",
    selections: [
      {
        role: "Framing",
        id: interpretation.framingId,
        label: ORCHESTRATION_LABELS.framing[interpretation.framingId],
      },
      {
        role: "Lead insight",
        id: interpretation.leadInsightId,
        label: ORCHESTRATION_LABELS.leadInsight[interpretation.leadInsightId],
      },
      {
        role: "Explanation order",
        id: interpretation.explanationOrderId,
        label: ORCHESTRATION_LABELS.explanationOrder[interpretation.explanationOrderId],
      },
      {
        role: "Connection",
        id: interpretation.connectionId,
        label: ORCHESTRATION_LABELS.connection[interpretation.connectionId],
      },
    ],
    boundary: "The model never receives amounts, ratios, levels, notes, or user-facing prose. It never calculates classifications, gaps, risks, priorities, or guidance.",
  };
}

export function buildEnglishJudgeBrief(
  report: WealthReport,
): EnglishJudgeBrief {
  const safety = buildSafety(report);
  const dataConfidence = buildConfidence(report);
  const dominantGap = buildDominantGap(getDominantCompositionGap(report));
  const terminal = report.level.terminal;
  const recoveryBand = report.level.current === "L1";
  const currentLabel = ENGLISH_LEVEL_LABELS[report.level.current];
  const targetLabel = ENGLISH_LEVEL_LABELS[report.level.next];
  const compositionTone = dominantGap.direction === "within" ? "clear" : "review";
  const safeguardsTone = safety.status === "gate"
    ? "guarded"
    : safety.status === "review"
      ? "review"
      : "clear";

  return {
    heading: "WealthCopy judge brief",
    introduction: "A household snapshot is converted into one current band, one next-band structural comparison, and three review lenses.",
    level: {
      current: { id: report.level.current, label: currentLabel },
      target: { id: report.level.next, label: targetLabel },
      path: terminal
        ? `${report.level.current} · terminal band`
        : `${report.level.current} → ${report.level.next}`,
      terminal,
    },
    thresholdGap: terminal
      ? {
          label: "Next-band threshold",
          value: "No higher band",
          amountKrw: report.level.gapKrw,
          explanation: "L15 is the terminal WealthCopy band. The report shifts from promotion framing to long-term structural review.",
        }
      : {
          label: `${report.level.next} threshold gap`,
          value: formatEnglishKrw(report.level.gapKrw),
          amountKrw: report.level.gapKrw,
          explanation: `This is the difference between current net worth and the internal ${report.level.next} classification threshold. It is not a time-to-target forecast.`,
        },
    inBandPosition: terminal
      ? {
          label: "In-band position",
          value: "Terminal band",
          percent: report.level.positionPercent,
          explanation: "L15 has no upper classification threshold, so no progress percentage is implied.",
        }
      : recoveryBand
        ? {
            label: "Band status",
            value: "Recovery band",
            percent: report.level.positionPercent,
            explanation:
              "L1 covers negative net worth and has no bounded lower threshold, so no in-band percentage is implied.",
          }
      : {
          label: "In-band position",
          value: `${report.level.positionPercent.toFixed(0)}%`,
          percent: report.level.positionPercent,
          explanation: `This is the position within ${report.level.current} under the versioned internal level policy, not a population percentile.`,
        },
    dominantGap,
    reviewLenses: [
      {
        id: "safeguards",
        title: "Safeguard status",
        status: safety.headline,
        detail: safety.detail,
        tone: safeguardsTone,
      },
      buildCashflowLens(report),
      {
        id: "composition",
        title: "Largest composition difference",
        status: `${dominantGap.label}: ${dominantGap.value}`,
        detail: dominantGap.explanation,
        tone: compositionTone,
      },
    ],
    safety,
    dataConfidence,
    gptPlan: buildPlan(report),
    policy: {
      reference: "Composition ranges are versioned WealthCopy internal references, not personalized peer matches, observed population statistics, official grades, or optimal allocations.",
      limitation: "This report is not financial advice, a forecast, an expected-return claim, or a transaction instruction.",
      threshold: "Band thresholds and amount differences are decision aids under stated policy assumptions; they do not promise promotion or an outcome.",
    },
  };
}
