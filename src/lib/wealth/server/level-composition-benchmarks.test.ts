import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSET_LEVELS } from "../asset-level";
import { ASSET_COMPOSITION_KEYS } from "../wealth-report";
import {
  COMPOSITION_METHODOLOGY,
  INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION,
  LEVEL_COMPOSITION_BENCHMARKS,
} from "./level-composition-benchmarks";
import { PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019 } from "./psid-reference";

describe("L1-L15 composition reference policy", () => {
  it("covers every level and every asset group with bounded 100% reference bands", () => {
    expect(Object.keys(LEVEL_COMPOSITION_BENCHMARKS)).toEqual(ASSET_LEVELS);

    for (const level of ASSET_LEVELS) {
      const benchmark = LEVEL_COMPOSITION_BENCHMARKS[level];
      expect(Object.keys(benchmark.composition)).toEqual(ASSET_COMPOSITION_KEYS);
      expect(
        ASSET_COMPOSITION_KEYS.reduce(
          (sum, key) => sum + benchmark.composition[key].midPercent,
          0,
        ),
      ).toBeCloseTo(100, 8);

      for (const key of ASSET_COMPOSITION_KEYS) {
        const band = benchmark.composition[key];
        expect(band.minPercent).toBeGreaterThanOrEqual(0);
        expect(band.minPercent).toBeLessThanOrEqual(band.midPercent);
        expect(band.midPercent).toBeLessThanOrEqual(band.maxPercent);
        expect(band.maxPercent).toBeLessThanOrEqual(100);
      }
    }
  });

  it("gives all fifteen levels a distinct composition instead of reusing stage groups", () => {
    const fingerprints = ASSET_LEVELS.map((level) =>
      ASSET_COMPOSITION_KEYS.map((key) => {
        const band = LEVEL_COMPOSITION_BENCHMARKS[level].composition[key];
        return `${band.minPercent}/${band.midPercent}/${band.maxPercent}`;
      }).join("|"),
    );

    expect(new Set(fingerprints)).toHaveLength(ASSET_LEVELS.length);
    for (let index = 1; index < fingerprints.length; index += 1) {
      expect(fingerprints[index]).not.toBe(fingerprints[index - 1]);
    }
  });

  it("uses only monotonic published percentile coordinates for internal shape calibration", () => {
    expect(
      INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION.sourcePercentileAnchors,
    ).toEqual(PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019);

    const sourcePositions = ASSET_LEVELS.map(
      (level) =>
        INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION.levels[level]
          .sourcePercentilePosition,
    );
    const normalizedPositions = ASSET_LEVELS.map(
      (level) =>
        INTERNAL_LEVEL_DISTRIBUTION_CALIBRATION.levels[level]
          .normalizedPosition,
    );

    expect(sourcePositions[0]).toBe(
      PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019[0],
    );
    expect(sourcePositions.at(-1)).toBe(
      PSID_DISTRIBUTION_SHAPE_PERCENTILES_2019.at(-1),
    );
    expect(sourcePositions[7]).toBe(50);
    expect(normalizedPositions[0]).toBe(0);
    expect(normalizedPositions.at(-1)).toBe(1);
    expect(
      sourcePositions.every(
        (position, index) =>
          index === 0 || position > (sourcePositions[index - 1] ?? -Infinity),
      ),
    ).toBe(true);
    expect(
      normalizedPositions.every(
        (position, index) =>
          index === 0 ||
          position > (normalizedPositions[index - 1] ?? -Infinity),
      ),
    ).toBe(true);

    const sourceSteps = sourcePositions.slice(1).map(
      (position, index) => position - (sourcePositions[index] ?? position),
    );
    expect(new Set(sourceSteps.map((step) => step.toFixed(3))).size).toBeGreaterThan(
      2,
    );
  });

  it("locks the reviewed policy anchors while calibrating levels between them", () => {
    const anchors = [
      ["L1", [30, 25, 20, 10, 2, 5, 1, 7]],
      ["L4", [18, 40, 20, 10, 5, 3, 1, 3]],
      ["L7", [12, 35, 27, 8, 8, 5, 3, 2]],
      ["L10", [8, 20, 35, 6, 15, 10, 4, 2]],
      ["L13", [7, 12, 34, 4, 16, 18, 7, 2]],
      ["L15", [8, 10, 30, 3, 16, 22, 9, 2]],
    ] as const;

    for (const [level, expected] of anchors) {
      expect(
        ASSET_COMPOSITION_KEYS.map(
          (key) => LEVEL_COMPOSITION_BENCHMARKS[level].composition[key].midPercent,
        ),
      ).toEqual(expected);
    }

    for (const level of ["L2", "L3", "L5", "L6", "L8", "L9", "L11", "L12", "L14"] as const) {
      const levelIndex = ASSET_LEVELS.indexOf(level);
      const previous = LEVEL_COMPOSITION_BENCHMARKS[ASSET_LEVELS[levelIndex - 1]];
      const current = LEVEL_COMPOSITION_BENCHMARKS[level];
      const next = LEVEL_COMPOSITION_BENCHMARKS[ASSET_LEVELS[levelIndex + 1]];
      expect(current.composition).not.toEqual(previous.composition);
      expect(current.composition).not.toEqual(next.composition);
    }
  });

  it("keeps source identity and raw currency semantics out of public methodology", () => {
    expect(COMPOSITION_METHODOLOGY.label).toBe("WealthCopy 내부 참고범위");
    expect(COMPOSITION_METHODOLOGY.version).toBe("composition-policy-v2");
    expect(COMPOSITION_METHODOLOGY.disclaimer).toMatch(
      /관찰 평균.*아닙니다|투자 추천이 아닙니다/,
    );
    expect(COMPOSITION_METHODOLOGY.disclaimer).toContain(
      "현재 부채가 유지된다고 가정한 다음 구간 총자산 기준",
    );
    expect(COMPOSITION_METHODOLOGY.disclaimer).toContain(
      "실제 매수·매도 금액을 뜻하지 않습니다",
    );

    const publicMethodology = JSON.stringify(COMPOSITION_METHODOLOGY);
    const publicBenchmarks = JSON.stringify(LEVEL_COMPOSITION_BENCHMARKS);
    expect(Object.keys(COMPOSITION_METHODOLOGY)).toEqual([
      "label",
      "version",
      "disclaimer",
    ]);
    expect(publicMethodology).not.toMatch(
      /(?:PSID|SCF|United States|미국|USD|달러|netWorthUsd|\$)/i,
    );
    expect(publicMethodology).not.toMatch(
      /기대수익률\s*\d|매수하세요|매도하세요/,
    );
    expect(publicBenchmarks).not.toMatch(
      /(?:PSID|SCF|United States|USD|netWorthUsd)/i,
    );
  });
});
