import { z } from "zod";

import { assetLevelSchema } from "./asset-level";
import { normalizedProfileSchema } from "./normalized-profile";
import {
  INTERNAL_PATH_LIBRARY,
  INTERNAL_PATH_TYPES,
  scoreInternalPath,
  type InternalPathType,
} from "./path-library";
import type { PublicActionId } from "./public-plan";
import {
  FREE_SAVINGS_CAPACITY_BANDS,
  LEVERAGE_BANDS,
} from "./server/private-derived-signals";

export const pathTypeSchema = z.enum(INTERNAL_PATH_TYPES);

/** Internal path matching consumes bands only, never raw household amounts. */
export const wealthProfileSchema = normalizedProfileSchema;

export const pathContextSchema = z
  .object({
    freeSavingsCapacity: z.enum(FREE_SAVINGS_CAPACITY_BANDS),
    leverage: z.enum(LEVERAGE_BANDS),
    sourceLevel: assetLevelSchema,
  })
  .strict();

export type PathType = InternalPathType;
export type WealthProfile = z.infer<typeof wealthProfileSchema>;
export type PathContext = z.infer<typeof pathContextSchema>;

export type WealthPathResult = {
  type: PathType;
  recommended: boolean;
  score: number;
  objective: string;
  supportActionIds: readonly PublicActionId[];
};

const PATH_ORDER: readonly PathType[] = INTERNAL_PATH_TYPES;

export function matchWealthPaths(
  input: WealthProfile,
  context: PathContext,
): WealthPathResult[] {
  const profile = wealthProfileSchema.parse(input);
  const parsedContext = pathContextSchema.parse(context);
  const signals = { ...profile, ...parsedContext };
  const candidates = PATH_ORDER.map((type) => ({
    type,
    recommended: false,
    score: scoreInternalPath(type, signals),
    objective: INTERNAL_PATH_LIBRARY[type].objective,
    supportActionIds: [...INTERNAL_PATH_LIBRARY[type].supportActionIds],
  }));

  const recommendedType = [...candidates].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return PATH_ORDER.indexOf(left.type) - PATH_ORDER.indexOf(right.type);
  })[0]?.type;

  return candidates.map((candidate) => ({
    ...candidate,
    recommended: candidate.type === recommendedType,
  }));
}
