import { z } from "zod";

import { normalizedProfileSchema } from "./normalized-profile";
import {
  INTERNAL_PATH_LIBRARY,
  INTERNAL_PATH_TYPES,
  scoreInternalPath,
  type InternalPathType,
} from "./path-library";
import type { PublicActionId } from "./public-plan";

export const pathTypeSchema = z.enum(INTERNAL_PATH_TYPES);

/** Internal path matching consumes ratios only, never raw household amounts. */
export const wealthProfileSchema = normalizedProfileSchema;

export type PathType = InternalPathType;
export type WealthProfile = z.infer<typeof wealthProfileSchema>;

export type WealthPathResult = {
  type: PathType;
  recommended: boolean;
  score: number;
  actionPriority: readonly PublicActionId[];
};

const PATH_ORDER: readonly PathType[] = INTERNAL_PATH_TYPES;

export function matchWealthPaths(input: WealthProfile): WealthPathResult[] {
  const profile = wealthProfileSchema.parse(input);
  const candidates = PATH_ORDER.map((type) => ({
    type,
    recommended: false,
    score: scoreInternalPath(type, profile),
    actionPriority: [...INTERNAL_PATH_LIBRARY[type].actionPriority],
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
