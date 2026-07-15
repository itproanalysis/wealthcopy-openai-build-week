import { z } from "zod";

import {
  assetLevelSchema,
  nextAssetLevel,
  type AssetLevel,
} from "./asset-level";
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

const storedPlanV3Schema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    plan: publicPlanSchema,
    sourceLevel: assetLevelSchema,
    version: z.literal(3),
  })
  .strict()
  .refine(
    (record) => record.plan.nextLevel === nextAssetLevel(record.sourceLevel),
    {
      message: "The stored target must match the source level's next step.",
      path: ["plan", "nextLevel"],
    },
  );

const storedPlanV2Schema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    plan: publicPlanSchema,
    version: z.literal(2),
  })
  .strict()
  .refine((record) => record.plan.nextLevel === "L7", {
    message: "Version 2 records must use the historical fixed L7 target.",
    path: ["plan", "nextLevel"],
  });

export const LEGACY_FIXED_TARGET_SOURCE_LEVEL: AssetLevel = "L6";

export function serializeStoredPlan(
  monthKey: string,
  sourceLevel: AssetLevel,
  plan: PublicPlan,
) {
  return JSON.stringify(
    storedPlanV3Schema.parse({
      monthKey,
      plan,
      sourceLevel,
      version: 3,
    }),
  );
}

function restoreRecord(
  sourceLevel: AssetLevel,
  plan: PublicPlan,
  storedMonth: string,
  currentMonth: string,
) {
  if (storedMonth !== currentMonth) {
    return {
      plan: projectPublicPlan(
        plan.nextLevel,
        plan.actions.map((action) => action.id),
      ),
      previousMonthCompleted: plan.progress === 100,
      rolledOver: true,
      sourceLevel,
    };
  }

  return {
    plan,
    previousMonthCompleted: false,
    rolledOver: false,
    sourceLevel,
  };
}

function parseStoredRecord<T>(
  raw: string | null,
  schema: z.ZodType<T>,
): T | null {
  if (!raw) return null;

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function restoreStoredPlan(raw: string | null, currentMonth: string) {
  const record = parseStoredRecord(raw, storedPlanV3Schema);
  if (!record) return null;

  return restoreRecord(
    record.sourceLevel,
    record.plan,
    record.monthKey,
    currentMonth,
  );
}

export function migrateStoredPlanV2(
  raw: string | null,
  currentMonth: string,
) {
  const record = parseStoredRecord(raw, storedPlanV2Schema);
  if (!record) return null;

  return restoreRecord(
    LEGACY_FIXED_TARGET_SOURCE_LEVEL,
    record.plan,
    record.monthKey,
    currentMonth,
  );
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

    return projectPublicPlan("L7", DEFAULT_PUBLIC_ACTION_IDS, completedIds);
  } catch {
    return null;
  }
}
