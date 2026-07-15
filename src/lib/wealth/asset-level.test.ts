import { describe, expect, it } from "vitest";

import {
  ASSET_LEVELS,
  assetLevelSchema,
  nextAssetLevel,
  nextAssetLevelSchema,
} from "./asset-level";

describe("asset level journey", () => {
  it("supports every level in order", () => {
    expect(ASSET_LEVELS).toEqual(["L1", "L2", "L3", "L4", "L5", "L6", "L7"]);
    for (const level of ASSET_LEVELS) {
      expect(assetLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it("moves one level at a time and keeps L7 in maintenance", () => {
    expect(ASSET_LEVELS.map(nextAssetLevel)).toEqual([
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "L7",
      "L7",
    ]);
    expect(nextAssetLevelSchema.safeParse("L1").success).toBe(false);
  });
});
