import {
  type AssetLevel,
  type NextAssetLevel,
  nextAssetLevel,
} from "./asset-level";
import type { PublicActionId } from "./public-plan";

const SHARED_ALLOWED_ACTION_IDS = [
  "review_cash_buffer",
  "confirm_monthly_limit",
  "review_debt_schedule",
  "review_income_change",
  "schedule_monthly_checkin",
  "seek_professional_review",
] as const satisfies readonly PublicActionId[];

export type LevelTransitionDefinition = {
  currentLevel: AssetLevel;
  nextLevel: NextAssetLevel;
  /** The level-specific action that must survive routine planning. */
  actionPriority: readonly [PublicActionId];
  /** Model and rule candidates are restricted to this transition catalog. */
  allowedActionIds: readonly PublicActionId[];
};

function defineTransition(
  currentLevel: AssetLevel,
  primaryActionId: PublicActionId,
  supportingActionIds: readonly PublicActionId[] = [],
): LevelTransitionDefinition {
  return {
    currentLevel,
    nextLevel: nextAssetLevel(currentLevel),
    actionPriority: [primaryActionId],
    allowedActionIds: [
      primaryActionId,
      ...supportingActionIds,
      ...SHARED_ALLOWED_ACTION_IDS,
    ],
  };
}

export const LEVEL_TRANSITIONS = {
  L1: defineTransition("L1", "map_monthly_cashflow"),
  L2: defineTransition("L2", "set_cash_safety_rule"),
  L3: defineTransition("L3", "confirm_debt_payment_calendar"),
  L4: defineTransition("L4", "lock_monthly_execution_routine"),
  L5: defineTransition("L5", "review_asset_concentration"),
  L6: defineTransition("L6", "review_long_term_structure"),
  L7: defineTransition("L7", "audit_plan_drift"),
  L8: defineTransition("L8", "refresh_asset_valuation_dates", [
    "audit_plan_drift",
  ]),
  L9: defineTransition("L9", "reconcile_liability_register", [
    "refresh_asset_valuation_dates",
  ]),
  L10: defineTransition("L10", "document_ownership_structure", [
    "reconcile_liability_register",
  ]),
  L11: defineTransition("L11", "consolidate_reporting_calendar", [
    "document_ownership_structure",
  ]),
  L12: defineTransition("L12", "verify_decision_authorities", [
    "consolidate_reporting_calendar",
  ]),
  L13: defineTransition("L13", "review_continuity_records", [
    "verify_decision_authorities",
  ]),
  L14: defineTransition("L14", "confirm_alternate_access", [
    "review_continuity_records",
  ]),
  L15: defineTransition("L15", "audit_governance_calendar", [
    "confirm_alternate_access",
  ]),
} as const satisfies Record<AssetLevel, LevelTransitionDefinition>;

export function levelTransitionFor(
  currentLevel: AssetLevel,
): LevelTransitionDefinition {
  return LEVEL_TRANSITIONS[currentLevel];
}
