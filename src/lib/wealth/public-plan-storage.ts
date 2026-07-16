import { z } from "zod";

import {
  assetLevelSchema,
  nextAssetLevel,
  type AssetLevel,
} from "./asset-level";
import {
  projectPublicPlan,
  publicPlanSchema,
  type PublicPlan,
} from "./public-plan";

const storedPlanV5Schema = z
  .object({
    monthKey: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    plan: publicPlanSchema,
    sourceLevel: assetLevelSchema,
    version: z.literal(5),
  })
  .strict()
  .refine(
    (record) => record.plan.nextLevel === nextAssetLevel(record.sourceLevel),
    {
      message: "The stored target must match the source level's next step.",
      path: ["plan", "nextLevel"],
    },
  );

export function serializeStoredPlan(
  monthKey: string,
  sourceLevel: AssetLevel,
  plan: PublicPlan,
) {
  return JSON.stringify(
    storedPlanV5Schema.parse({
      monthKey,
      plan,
      sourceLevel,
      version: 5,
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
  const record = parseStoredRecord(raw, storedPlanV5Schema);
  if (!record) return null;

  return restoreRecord(
    record.sourceLevel,
    record.plan,
    record.monthKey,
    currentMonth,
  );
}

export function parseStoredPlan(raw: string | null, currentMonth: string) {
  const restored = restoreStoredPlan(raw, currentMonth);
  return restored && !restored.rolledOver ? restored.plan : null;
}
