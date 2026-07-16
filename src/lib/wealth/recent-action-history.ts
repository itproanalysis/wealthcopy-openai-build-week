import { z } from "zod";

import { assetLevelSchema, type AssetLevel } from "./asset-level";
import {
  publicActionIdSchema,
  type PublicActionId,
} from "./public-plan";

export const RECENT_ACTION_HISTORY_POLICY_VERSION = "behavior-policy-v2";
export const RECENT_ACTION_HISTORY_MAX_ENTRIES = 36;

const monthKeySchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

const recentActionCompletionSchema = z
  .object({
    actionId: publicActionIdSchema,
    sourceLevel: assetLevelSchema,
    completedMonth: monthKeySchema,
  })
  .strict();

const recentActionHistorySchema = z
  .object({
    version: z.literal(1),
    policyVersion: z.literal(RECENT_ACTION_HISTORY_POLICY_VERSION),
    entries: z
      .array(recentActionCompletionSchema)
      .max(RECENT_ACTION_HISTORY_MAX_ENTRIES),
  })
  .strict()
  .superRefine((history, context) => {
    const keys = history.entries.map(
      (entry) =>
        `${entry.completedMonth}:${entry.sourceLevel}:${entry.actionId}`,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "같은 달과 레벨의 완료 행동은 한 번만 저장할 수 있습니다.",
        path: ["entries"],
      });
    }
  });

export const recentCompletionForPlannerSchema = z
  .object({
    id: publicActionIdSchema,
    sourceLevel: assetLevelSchema,
    monthsAgo: z.number().int().min(1).max(11),
  })
  .strict();

export const recentCompletionsForPlannerSchema = z
  .array(recentCompletionForPlannerSchema)
  .max(RECENT_ACTION_HISTORY_MAX_ENTRIES)
  .superRefine((entries, context) => {
    const keys = entries.map((entry) => `${entry.sourceLevel}:${entry.id}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "최근 완료 행동은 레벨별로 한 번만 전달할 수 있습니다.",
      });
    }
  });

export type RecentActionCompletion = z.infer<
  typeof recentActionCompletionSchema
>;
export type RecentCompletionForPlanner = z.infer<
  typeof recentCompletionForPlannerSchema
>;

function monthIndex(month: string) {
  const parsed = monthKeySchema.parse(month);
  const [year, monthNumber] = parsed.split("-").map(Number);
  return year * 12 + monthNumber - 1;
}

function sortHistory(entries: readonly RecentActionCompletion[]) {
  return [...entries].sort(
    (left, right) =>
      left.completedMonth.localeCompare(right.completedMonth) ||
      left.sourceLevel.localeCompare(right.sourceLevel) ||
      left.actionId.localeCompare(right.actionId),
  );
}

export function pruneRecentActionHistory(
  entries: readonly unknown[],
  currentMonth: string,
): RecentActionCompletion[] {
  const currentIndex = monthIndex(currentMonth);
  const validEntries = entries.flatMap((entry) => {
    const parsed = recentActionCompletionSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
  const uniqueEntries = [
    ...new Map(
      validEntries.map((entry) => [
        `${entry.completedMonth}:${entry.sourceLevel}:${entry.actionId}`,
        entry,
      ]),
    ).values(),
  ];
  const recent = sortHistory(
    uniqueEntries.filter((entry) => {
      const ageInMonths = currentIndex - monthIndex(entry.completedMonth);
      return ageInMonths >= 0 && ageInMonths < 12;
    }),
  );

  return recent.slice(-RECENT_ACTION_HISTORY_MAX_ENTRIES);
}

export function restoreRecentActionHistory(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = recentActionHistorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? sortHistory(parsed.data.entries) : [];
  } catch {
    return [];
  }
}

export function serializeRecentActionHistory(
  entries: readonly RecentActionCompletion[],
) {
  return JSON.stringify(
    recentActionHistorySchema.parse({
      version: 1,
      policyVersion: RECENT_ACTION_HISTORY_POLICY_VERSION,
      entries: sortHistory(entries),
    }),
  );
}

export function updateRecentActionHistory(
  entries: readonly RecentActionCompletion[],
  actionId: PublicActionId,
  sourceLevel: AssetLevel,
  completedMonth: string,
  completed: boolean,
) {
  const parsedMonth = monthKeySchema.parse(completedMonth);
  const withoutCurrent = entries.filter(
    (entry) =>
      !(
        entry.actionId === actionId &&
        entry.sourceLevel === sourceLevel &&
        entry.completedMonth === parsedMonth
      ),
  );

  const updated = completed
    ? [
        ...withoutCurrent,
        { actionId, sourceLevel, completedMonth: parsedMonth },
      ]
    : withoutCurrent;

  return pruneRecentActionHistory(updated, parsedMonth);
}

export function removeMonthFromActionHistory(
  entries: readonly RecentActionCompletion[],
  completedMonth: string,
) {
  const parsedMonth = monthKeySchema.parse(completedMonth);
  return entries.filter((entry) => entry.completedMonth !== parsedMonth);
}

export function recentCompletionsForPlanner(
  entries: readonly RecentActionCompletion[],
  currentMonth: string,
): RecentCompletionForPlanner[] {
  const currentIndex = monthIndex(currentMonth);
  const mostRecentByLevelAndAction = new Map<
    string,
    RecentCompletionForPlanner
  >();

  for (const entry of entries) {
    const monthsAgo = currentIndex - monthIndex(entry.completedMonth);
    if (monthsAgo < 1 || monthsAgo > 11) continue;

    const key = `${entry.sourceLevel}:${entry.actionId}`;
    const existing = mostRecentByLevelAndAction.get(key);
    if (!existing || monthsAgo < existing.monthsAgo) {
      mostRecentByLevelAndAction.set(key, {
        id: entry.actionId,
        sourceLevel: entry.sourceLevel,
        monthsAgo,
      });
    }
  }

  return recentCompletionsForPlannerSchema.parse(
    [...mostRecentByLevelAndAction.values()].sort(
      (left, right) =>
        left.monthsAgo - right.monthsAgo ||
        left.sourceLevel.localeCompare(right.sourceLevel) ||
        left.id.localeCompare(right.id),
    ),
  );
}
