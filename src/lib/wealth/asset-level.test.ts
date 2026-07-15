import { describe, expect, it } from "vitest";

import {
  ASSET_LEVEL_LABELS,
  ASSET_LEVELS,
  assetLevelSchema,
  nextAssetLevel,
  nextAssetLevelSchema,
} from "./asset-level";

describe("asset level journey", () => {
  it("supports all fifteen levels in order with a label", () => {
    expect(ASSET_LEVELS).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "L7",
      "L8",
      "L9",
      "L10",
      "L11",
      "L12",
      "L13",
      "L14",
      "L15",
    ]);
    for (const level of ASSET_LEVELS) {
      expect(assetLevelSchema.safeParse(level).success).toBe(true);
      expect(ASSET_LEVEL_LABELS[level].length).toBeGreaterThan(0);
    }
  });

  it("moves one level at a time and keeps L15 in maintenance", () => {
    expect(ASSET_LEVELS.map(nextAssetLevel)).toEqual([
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "L7",
      "L8",
      "L9",
      "L10",
      "L11",
      "L12",
      "L13",
      "L14",
      "L15",
      "L15",
    ]);
    expect(nextAssetLevelSchema.safeParse("L1").success).toBe(false);
    expect(nextAssetLevelSchema.safeParse("L15").success).toBe(true);
  });
});
