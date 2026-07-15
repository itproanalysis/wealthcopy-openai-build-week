import { z } from "zod";

export const ASSET_LEVELS = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
] as const;

export const assetLevelSchema = z.enum(ASSET_LEVELS);

export type AssetLevel = z.infer<typeof assetLevelSchema>;

export const NEXT_ASSET_LEVELS = ["L2", "L3", "L4", "L5", "L6", "L7"] as const;
export const nextAssetLevelSchema = z.enum(NEXT_ASSET_LEVELS);
export type NextAssetLevel = z.infer<typeof nextAssetLevelSchema>;

const NEXT_ASSET_LEVEL = {
  L1: "L2",
  L2: "L3",
  L3: "L4",
  L4: "L5",
  L5: "L6",
  L6: "L7",
  L7: "L7",
} as const satisfies Record<AssetLevel, NextAssetLevel>;

/**
 * Returns the single next step in the public level journey. L7 is a
 * maintenance state, so it deliberately maps to itself.
 */
export function nextAssetLevel(currentLevel: AssetLevel): NextAssetLevel {
  return NEXT_ASSET_LEVEL[currentLevel];
}
