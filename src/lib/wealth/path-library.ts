import type { AssetLevel } from "./asset-level";
import type { NormalizedProfile } from "./normalized-profile";
import type { PublicActionId } from "./public-plan";
import type {
  FreeSavingsCapacityBand,
  LeverageBand,
} from "./server/private-derived-signals";

export const INTERNAL_PATH_TYPES = [
  "cash_defense",
  "debt_control",
  "income_resilience",
  "core_building",
  "concentration_control",
  "liquidity_planning",
  "operating_system",
  "continuity",
] as const;

export const BEHAVIOR_POLICY_VERSION = "behavior-policy-v2";

export type InternalPathType = (typeof INTERNAL_PATH_TYPES)[number];
export type IncomeExecutionBand = "limited" | "steady" | "strong";
export type DebtServiceBand = "manageable" | "watch" | "high";
export type LevelGroup =
  | "foundation"
  | "building"
  | "complexity"
  | "governance";

export type PathScoreSignals = NormalizedProfile & {
  freeSavingsCapacity: FreeSavingsCapacityBand;
  leverage: LeverageBand;
  sourceLevel: AssetLevel;
};

export type InternalPathDefinition = {
  type: InternalPathType;
  objective: string;
  supportActionIds: readonly PublicActionId[];
};

/**
 * Purpose-based paths replace the former stable/balanced/fast labels. A path
 * identifies today's bottleneck; it is not a forecast, risk appetite, return
 * target, or promised speed. PSID is deliberately absent because a U.S.
 * reference percentile cannot establish a Korean household's route.
 */
export const INTERNAL_PATH_LIBRARY = {
  cash_defense: {
    type: "cash_defense",
    objective: "keep essential cash available before adding commitments",
    supportActionIds: [
      "build_cash_runway_rule",
      "stabilize_priority_payments",
      "protect_near_term_liquidity",
    ],
  },
  debt_control: {
    type: "debt_control",
    objective: "remove payment and maturity blind spots",
    supportActionIds: [
      "rank_debt_review_priority",
      "stabilize_priority_payments",
      "calendar_30_60_90_maturities",
    ],
  },
  income_resilience: {
    type: "income_resilience",
    objective: "resize commitments around an unstable income base",
    supportActionIds: [
      "prepare_income_change_plan",
      "protect_near_term_liquidity",
      "build_cash_runway_rule",
    ],
  },
  core_building: {
    type: "core_building",
    objective: "turn available capacity into a repeatable decision routine",
    supportActionIds: [
      "set_new_money_guardrail",
      "review_retirement_account_routine",
      "build_cash_runway_rule",
    ],
  },
  concentration_control: {
    type: "concentration_control",
    objective: "stop one asset group from silently dominating new money",
    supportActionIds: [
      "pause_dominant_bucket_additions",
      "set_new_money_guardrail",
      "verify_or_hold_asset",
    ],
  },
  liquidity_planning: {
    type: "liquidity_planning",
    objective: "match locked assets and upcoming events to available cash",
    supportActionIds: [
      "protect_near_term_liquidity",
      "calendar_30_60_90_maturities",
      "map_property_liquidity_dates",
      "separate_household_business_cash",
    ],
  },
  operating_system: {
    type: "operating_system",
    objective: "make complex assets reviewable with one operating record",
    supportActionIds: [
      "verify_or_hold_asset",
      "calendar_30_60_90_maturities",
      "map_property_liquidity_dates",
      "map_critical_access_and_owners",
    ],
  },
  continuity: {
    type: "continuity",
    objective: "keep decisions and access working when people or roles change",
    supportActionIds: [
      "map_critical_access_and_owners",
      "verify_or_hold_asset",
      "calendar_30_60_90_maturities",
      "seek_professional_review",
    ],
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

export function levelGroup(level: AssetLevel): LevelGroup {
  const number = Number(level.slice(1));
  if (number <= 4) return "foundation";
  if (number <= 8) return "building";
  if (number <= 12) return "complexity";
  return "governance";
}

function scoreCashDefense(signals: PathScoreSignals) {
  let score = levelGroup(signals.sourceLevel) === "foundation" ? 35 : 10;
  if (signals.cashRunwayBand === "under_1") score += 70;
  if (signals.cashRunwayBand === "one_to_three") score += 50;
  if (signals.cashRunwayBand === "three_to_six") score += 15;
  if (signals.freeSavingsCapacity === "limited") score += 25;
  if (signals.incomeStability === "changing") score += 20;
  return score;
}

function scoreDebtControl(signals: PathScoreSignals) {
  let score = 10;
  if (debtServiceBand(signals.debtServiceRatio) === "high") score += 70;
  if (debtServiceBand(signals.debtServiceRatio) === "watch") score += 30;
  if (signals.leverage === "underwater") score += 80;
  if (signals.leverage === "high") score += 55;
  if (signals.leverage === "medium") score += 20;
  if (
    signals.debtRisk === "high_cost" ||
    signals.debtRisk === "near_maturity"
  ) {
    score += 55;
  }
  if (signals.debtRisk === "variable_rate") score += 25;
  return score;
}

function scoreIncomeResilience(signals: PathScoreSignals) {
  let score = 10;
  if (signals.incomeStability === "changing") score += 70;
  if (signals.incomeStability === "variable") score += 45;
  if (signals.next90DayEvent === "income_change") score += 70;
  if (signals.freeSavingsCapacity === "limited") score += 20;
  return score;
}

function scoreCoreBuilding(signals: PathScoreSignals) {
  const group = levelGroup(signals.sourceLevel);
  let score = group === "foundation" || group === "building" ? 45 : 10;
  if (signals.freeSavingsCapacity === "strong") score += 25;
  if (debtServiceBand(signals.debtServiceRatio) === "manageable") score += 15;
  if (signals.largestAssetGroup === "pension") score += 15;
  return score;
}

function scoreConcentrationControl(signals: PathScoreSignals) {
  let score = levelGroup(signals.sourceLevel) === "building" ? 25 : 10;
  if (signals.concentrationBand === "p70_plus") score += 80;
  if (signals.concentrationBand === "p50_70") score += 50;
  if (
    signals.largestAssetGroup === "market" ||
    signals.largestAssetGroup === "property" ||
    signals.largestAssetGroup === "business_private"
  ) {
    score += 15;
  }
  return score;
}

function scoreLiquidityPlanning(signals: PathScoreSignals) {
  let score = 10;
  if (
    signals.next90DayEvent !== "none" &&
    signals.next90DayEvent !== "unknown"
  ) {
    score += 65;
  }
  if (signals.next90DayEvent === "debt_maturity") score += 25;
  if (
    signals.largestAssetGroup === "property" ||
    signals.largestAssetGroup === "business_private"
  ) {
    score += 35;
  }
  if (
    signals.cashRunwayBand === "under_1" ||
    signals.cashRunwayBand === "one_to_three"
  ) {
    score += 20;
  }
  return score;
}

function scoreOperatingSystem(signals: PathScoreSignals) {
  const group = levelGroup(signals.sourceLevel);
  let score = group === "complexity" ? 75 : group === "governance" ? 45 : 10;
  if (signals.largestAssetGroup === "mixed") score += 25;
  if (signals.concentrationBand === "unknown") score += 10;
  return score;
}

function scoreContinuity(signals: PathScoreSignals) {
  const group = levelGroup(signals.sourceLevel);
  let score = group === "governance" ? 90 : group === "complexity" ? 30 : 5;
  if (signals.largestAssetGroup === "business_private") score += 20;
  return score;
}

export function scoreInternalPath(
  pathType: InternalPathType,
  signals: PathScoreSignals,
) {
  const score = {
    cash_defense: scoreCashDefense,
    debt_control: scoreDebtControl,
    income_resilience: scoreIncomeResilience,
    core_building: scoreCoreBuilding,
    concentration_control: scoreConcentrationControl,
    liquidity_planning: scoreLiquidityPlanning,
    operating_system: scoreOperatingSystem,
    continuity: scoreContinuity,
  }[pathType](signals);

  return Math.max(0, Math.min(100, score));
}
