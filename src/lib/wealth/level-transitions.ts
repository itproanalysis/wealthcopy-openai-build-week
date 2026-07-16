import {
  type AssetLevel,
  type NextAssetLevel,
  nextAssetLevel,
} from "./asset-level";
import type { PublicActionId } from "./public-plan";

type NonEmptyActionIds = readonly [
  PublicActionId,
  ...PublicActionId[],
];

export type LevelTransitionDefinition = {
  currentLevel: AssetLevel;
  nextLevel: NextAssetLevel;
  /** Risk and data-quality gates considered before forward action. */
  protectionActionIds: NonEmptyActionIds;
  /** The single level-specific action that moves the household forward. */
  actionPriority: readonly [PublicActionId];
  /** Observable proof that the chosen action actually worked. */
  evidenceActionIds: NonEmptyActionIds;
  /** Model and rule candidates are restricted to this unique union. */
  allowedActionIds: readonly PublicActionId[];
};

function defineTransition(
  currentLevel: AssetLevel,
  protectionActionIds: NonEmptyActionIds,
  anchorActionId: PublicActionId,
  evidenceActionIds: NonEmptyActionIds,
): LevelTransitionDefinition {
  return {
    currentLevel,
    nextLevel: nextAssetLevel(currentLevel),
    protectionActionIds,
    actionPriority: [anchorActionId],
    evidenceActionIds,
    allowedActionIds: [
      ...new Set([
        ...protectionActionIds,
        anchorActionId,
        ...evidenceActionIds,
      ]),
    ],
  };
}

export const LEVEL_TRANSITIONS = {
  L1: defineTransition(
    "L1",
    [
      "complete_asset_snapshot",
      "stabilize_priority_payments",
      "build_cash_runway_rule",
    ],
    "map_30_day_cashflow",
    ["verify_cashflow_balance", "verify_payment_coverage"],
  ),
  L2: defineTransition(
    "L2",
    ["build_cash_runway_rule", "stabilize_priority_payments"],
    "separate_cash_roles",
    ["verify_cashflow_balance", "verify_first_automatic_transfer"],
  ),
  L3: defineTransition(
    "L3",
    ["rank_debt_review_priority", "stabilize_priority_payments"],
    "start_core_auto_execution",
    ["verify_payment_coverage", "verify_first_automatic_transfer"],
  ),
  L4: defineTransition(
    "L4",
    ["protect_near_term_liquidity", "prepare_income_change_plan"],
    "separate_near_term_goal_funds",
    ["compare_plan_to_actual", "verify_liquidity_coverage"],
  ),
  L5: defineTransition(
    "L5",
    ["complete_asset_snapshot", "verify_or_hold_asset"],
    "classify_asset_roles",
    ["verify_asset_mix_total", "verify_valuation_freshness"],
  ),
  L6: defineTransition(
    "L6",
    ["rank_debt_review_priority", "protect_near_term_liquidity"],
    "set_leverage_guardrail",
    ["verify_payment_coverage", "verify_policy_exceptions"],
  ),
  L7: defineTransition(
    "L7",
    [
      "set_new_money_guardrail",
      "pause_dominant_bucket_additions",
      "verify_or_hold_asset",
    ],
    "set_concentration_cap",
    ["compare_plan_to_actual", "verify_concentration_rule"],
  ),
  L8: defineTransition(
    "L8",
    [
      "protect_near_term_liquidity",
      "calendar_30_60_90_maturities",
      "set_new_money_guardrail",
    ],
    "build_liquidity_tiers",
    ["verify_liquidity_coverage", "verify_policy_exceptions"],
  ),
  L9: defineTransition(
    "L9",
    [
      "verify_or_hold_asset",
      "map_property_liquidity_dates",
      "set_new_money_guardrail",
    ],
    "align_valuation_dates",
    ["verify_valuation_freshness", "verify_asset_mix_total"],
  ),
  L10: defineTransition(
    "L10",
    ["separate_household_business_cash", "seek_professional_review"],
    "draft_one_page_ips",
    ["verify_policy_exceptions", "verify_reporting_ownership"],
  ),
  L11: defineTransition(
    "L11",
    ["calendar_30_60_90_maturities", "review_retirement_account_routine"],
    "consolidate_reporting_calendar",
    ["verify_reporting_ownership", "compare_plan_to_actual"],
  ),
  L12: defineTransition(
    "L12",
    [
      "verify_or_hold_asset",
      "pause_dominant_bucket_additions",
      "seek_professional_review",
    ],
    "set_asset_class_limits",
    ["verify_policy_exceptions", "verify_concentration_rule"],
  ),
  L13: defineTransition(
    "L13",
    [
      "map_critical_access_and_owners",
      "separate_household_business_cash",
      "seek_professional_review",
    ],
    "create_family_decision_matrix",
    ["verify_reporting_ownership", "run_continuity_access_drill"],
  ),
  L14: defineTransition(
    "L14",
    [
      "map_critical_access_and_owners",
      "map_property_liquidity_dates",
      "calendar_30_60_90_maturities",
      "prepare_income_change_plan",
      "seek_professional_review",
    ],
    "build_liquidity_event_calendar",
    [
      "verify_liquidity_coverage",
      "run_continuity_access_drill",
      "build_succession_agenda",
    ],
  ),
  L15: defineTransition(
    "L15",
    [
      "map_critical_access_and_owners",
      "seek_professional_review",
      "verify_or_hold_asset",
      "map_property_liquidity_dates",
    ],
    "audit_governance_calendar",
    [
      "close_governance_review",
      "run_continuity_access_drill",
      "build_succession_agenda",
    ],
  ),
} as const satisfies Record<AssetLevel, LevelTransitionDefinition>;

export function levelTransitionFor(
  currentLevel: AssetLevel,
): LevelTransitionDefinition {
  return LEVEL_TRANSITIONS[currentLevel];
}
