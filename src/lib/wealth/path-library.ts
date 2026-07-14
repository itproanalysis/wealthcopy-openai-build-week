import type { PublicActionId } from "./public-plan";

export const INTERNAL_PATH_TYPES = ["stable", "balanced", "fast"] as const;
export const BEHAVIOR_POLICY_VERSION = "behavior-policy-v1";

export type InternalPathType = (typeof INTERNAL_PATH_TYPES)[number];
export type IncomeExecutionBand = "limited" | "steady" | "strong";
export type DebtServiceBand = "manageable" | "watch" | "high";

export type PathScoreSignals = {
  incomeExecutionRatio: number;
  debtServiceRatio: number;
};

type ScoreWeights<T extends string> = Readonly<Record<T, number>>;

export type InternalPathDefinition = {
  type: InternalPathType;
  actionPriority: readonly [
    PublicActionId,
    PublicActionId,
    PublicActionId,
    PublicActionId,
  ];
  baseScore: number;
  incomeExecutionWeights: ScoreWeights<IncomeExecutionBand>;
  debtServiceWeights: ScoreWeights<DebtServiceBand>;
};

/**
 * Currency-neutral internal paths. The weights express execution capacity and
 * debt resilience only; they are not forecasts, returns, or time estimates.
 * The self-selected PSID reference band is intentionally excluded from pace
 * scoring: a distribution position is not evidence for risk appetite or speed.
 * Income-change and professional-review actions remain constraint overrides
 * in the planner and therefore do not belong to routine path priorities.
 */
export const INTERNAL_PATH_LIBRARY = {
  stable: {
    type: "stable",
    actionPriority: [
      "review_cash_buffer",
      "review_debt_schedule",
      "confirm_monthly_limit",
      "schedule_monthly_checkin",
    ],
    baseScore: 30,
    incomeExecutionWeights: {
      limited: 30,
      steady: 12,
      strong: -12,
    },
    debtServiceWeights: {
      manageable: -4,
      watch: 18,
      high: 38,
    },
  },
  balanced: {
    type: "balanced",
    actionPriority: [
      "confirm_monthly_limit",
      "review_cash_buffer",
      "review_debt_schedule",
      "schedule_monthly_checkin",
    ],
    baseScore: 30,
    incomeExecutionWeights: {
      limited: 6,
      steady: 26,
      strong: 10,
    },
    debtServiceWeights: {
      manageable: 8,
      watch: 20,
      high: -6,
    },
  },
  fast: {
    type: "fast",
    actionPriority: [
      "confirm_monthly_limit",
      "review_cash_buffer",
      "review_debt_schedule",
      "schedule_monthly_checkin",
    ],
    baseScore: 30,
    incomeExecutionWeights: {
      limited: -45,
      steady: -16,
      strong: 32,
    },
    debtServiceWeights: {
      manageable: 25,
      watch: -20,
      high: -60,
    },
  },
} as const satisfies Record<InternalPathType, InternalPathDefinition>;

export function incomeExecutionBand(ratio: number): IncomeExecutionBand {
  if (ratio < 20) return "limited";
  if (ratio < 40) return "steady";
  return "strong";
}

export function debtServiceBand(ratio: number): DebtServiceBand {
  if (ratio < 20) return "manageable";
  if (ratio < 40) return "watch";
  return "high";
}

function fastPathReadinessAdjustment(signals: PathScoreSignals) {
  const hasStrongExecution = signals.incomeExecutionRatio >= 40;
  const hasManageableDebt = signals.debtServiceRatio < 20;

  if (hasStrongExecution && hasManageableDebt) {
    return 15;
  }

  return -25;
}

function balancedPathFitAdjustment(signals: PathScoreSignals) {
  const hasSteadyExecution =
    signals.incomeExecutionRatio >= 20 && signals.incomeExecutionRatio < 40;
  const hasWatchDebt =
    signals.debtServiceRatio >= 20 && signals.debtServiceRatio < 40;

  return hasSteadyExecution && hasWatchDebt ? 10 : 0;
}

export function scoreInternalPath(
  pathType: InternalPathType,
  signals: PathScoreSignals,
) {
  const definition = INTERNAL_PATH_LIBRARY[pathType];
  const rawScore =
    definition.baseScore +
    definition.incomeExecutionWeights[
      incomeExecutionBand(signals.incomeExecutionRatio)
    ] +
    definition.debtServiceWeights[debtServiceBand(signals.debtServiceRatio)] +
    (pathType === "fast" ? fastPathReadinessAdjustment(signals) : 0) +
    (pathType === "balanced" ? balancedPathFitAdjustment(signals) : 0);

  return Math.max(0, Math.min(100, rawScore));
}
