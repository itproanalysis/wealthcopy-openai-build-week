import { describe, expect, it } from "vitest";

import {
  ASSET_LEVEL_POLICY_VERSION,
  classifyAssetLevel,
} from "./asset-level-policy";

describe("server asset-level policy", () => {
  it("locks every exact lower boundary and the value immediately below it", () => {
    const boundaries = [
      [0, "L2"],
      [10_000_000, "L3"],
      [30_000_000, "L4"],
      [100_000_000, "L5"],
      [300_000_000, "L6"],
      [500_000_000, "L7"],
      [1_000_000_000, "L8"],
      [3_000_000_000, "L9"],
      [5_000_000_000, "L10"],
      [10_000_000_000, "L11"],
      [30_000_000_000, "L12"],
      [100_000_000_000, "L13"],
      [300_000_000_000, "L14"],
      [1_000_000_000_000, "L15"],
    ] as const;

    expect(ASSET_LEVEL_POLICY_VERSION).toBe("krw-net-worth-v1");
    expect(classifyAssetLevel({ totalAssetsKrw: 0, totalDebtKrw: 1 })).toBe(
      "L1",
    );

    boundaries.forEach(([boundary, level], index) => {
      expect(
        classifyAssetLevel({ totalAssetsKrw: boundary, totalDebtKrw: 0 }),
      ).toBe(level);

      if (boundary > 0) {
        const previousLevel = boundaries[index - 1]?.[1] ?? "L2";
        expect(
          classifyAssetLevel({
            totalAssetsKrw: boundary - 1,
            totalDebtKrw: 0,
          }),
        ).toBe(previousLevel);
      }
    });
  });

  it("classifies household net worth after subtracting aggregate debt", () => {
    expect(
      classifyAssetLevel({
        totalAssetsKrw: 1_400_000_000,
        totalDebtKrw: 500_000_000,
      }),
    ).toBe("L7");
    expect(
      classifyAssetLevel({
        totalAssetsKrw: 1_500_000_000,
        totalDebtKrw: 500_000_000,
      }),
    ).toBe("L8");
  });

  it("rejects invalid aggregate amounts at the domain boundary", () => {
    for (const input of [
      { totalAssetsKrw: -1, totalDebtKrw: 0 },
      { totalAssetsKrw: 1.5, totalDebtKrw: 0 },
      { totalAssetsKrw: Number.MAX_SAFE_INTEGER + 1, totalDebtKrw: 0 },
    ]) {
      expect(() => classifyAssetLevel(input)).toThrow(RangeError);
    }
  });
});
