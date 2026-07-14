import { z } from "zod";

import {
  projectPublicPlan,
  publicPlanSchema,
  type PublicActionId,
  type PublicPlan,
} from "./public-plan";

export const DEFAULT_PUBLIC_ACTION_IDS: readonly PublicActionId[] = [
  "review_cash_buffer",
  "confirm_monthly_limit",
  "schedule_monthly_checkin",
];

const storedPlanSchema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    plan: publicPlanSchema,
    version: z.literal(2),
  })
  .strict();

export function serializeStoredPlan(monthKey: string, plan: PublicPlan) {
  return JSON.stringify(
    storedPlanSchema.parse({
      monthKey,
      plan,
      version: 2,
    }),
  );
}

export function restoreStoredPlan(raw: string | null, currentMonth: string) {
  if (!raw) return null;

  try {
    const parsed = storedPlanSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;

    if (parsed.data.monthKey !== currentMonth) {
      return {
        plan: projectPublicPlan(
          parsed.data.plan.actions.map((action) => action.id),
        ),
        rolledOver: true,
      };
    }

    return { plan: parsed.data.plan, rolledOver: false };
  } catch {
    return null;
  }
}

export function parseStoredPlan(raw: string | null, currentMonth: string) {
  return restoreStoredPlan(raw, currentMonth)?.plan ?? null;
}

export function migrateLegacyPlan(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { taskState?: unknown };
    if (!Array.isArray(parsed.taskState)) return null;

    const completedLegacyIds = new Set(
      parsed.taskState
        .filter(
          (item): item is { done: true; id: string } =>
            typeof item === "object" &&
            item !== null &&
            "done" in item &&
            item.done === true &&
            "id" in item &&
            typeof item.id === "string",
        )
        .map((item) => item.id),
    );

    const completedIds = new Set<PublicActionId>();
    if (completedLegacyIds.has("cash-buffer")) {
      completedIds.add("review_cash_buffer");
    }
    if (
      completedLegacyIds.has("debt-review") &&
      completedLegacyIds.has("commitment")
    ) {
      completedIds.add("confirm_monthly_limit");
    }
    if (completedLegacyIds.has("monthly-checkin")) {
      completedIds.add("schedule_monthly_checkin");
    }

    return projectPublicPlan(DEFAULT_PUBLIC_ACTION_IDS, completedIds);
  } catch {
    return null;
  }
}
