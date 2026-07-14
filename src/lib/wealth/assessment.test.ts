import { describe, expect, it } from "vitest";

import {
  comparePathsRequestSchema,
  createFallbackAssessment,
  isAssessmentSemanticallyValid,
} from "./assessment";
import { matchWealthPaths, type WealthProfile } from "./engine";

const profile: WealthProfile = {
  currentLevel: "L6",
  targetLevel: "L7",
  monthlyIncome: 6_500_000,
  monthlySavings: 3_100_000,
  debtRatio: 18,
  householdType: "single",
  riskPreference: "balanced",
  emergencyFundMonths: 5,
};

describe("fallback assessment", () => {
  it("covers every candidate exactly once", () => {
    const paths = matchWealthPaths(profile);
    const assessment = createFallbackAssessment(profile, paths);

    expect(assessment.comparisons.map((item) => item.pathId)).toEqual([
      "stable",
      "balanced",
      "fast",
    ]);
    expect(isAssessmentSemanticallyValid(assessment, paths)).toBe(true);
  });

  it("rejects duplicate path comparisons", () => {
    const paths = matchWealthPaths(profile);
    const assessment = createFallbackAssessment(profile, paths);
    const invalid = {
      ...assessment,
      comparisons: [
        assessment.comparisons[0],
        assessment.comparisons[0],
        assessment.comparisons[2],
      ],
    };

    expect(isAssessmentSemanticallyValid(invalid, paths)).toBe(false);
  });

  it("blocks product or transaction requests in offline fallback", () => {
    const paths = matchWealthPaths(profile);
    const assessment = createFallbackAssessment(
      profile,
      paths,
      "코인 종목을 골라 매수 주문까지 알려 주세요.",
    );

    expect(assessment.status).toBe("professional_review_required");
    expect(assessment.leadComparisonPathId).toBeNull();
    expect(assessment.checklistActionIds).toContain(
      "request_professional_review",
    );
  });

  it("requires more information when every path exceeds the budget", () => {
    const lowBudgetProfile = { ...profile, monthlySavings: 100_000 };
    const paths = matchWealthPaths(lowBudgetProfile);
    const assessment = createFallbackAssessment(lowBudgetProfile, paths);

    expect(assessment.status).toBe("needs_more_information");
    expect(assessment.leadComparisonPathId).toBeNull();
    expect(isAssessmentSemanticallyValid(assessment, paths)).toBe(true);
    expect(assessment.comparisons.every((item) => item.fit === "strained")).toBe(
      true,
    );
  });

  it("blocks copying when the note says income has stopped", () => {
    const paths = matchWealthPaths(profile);
    const assessment = createFallbackAssessment(
      profile,
      paths,
      "다음 달부터 실직으로 소득이 중단됩니다.",
    );

    expect(assessment.status).toBe("needs_more_information");
    expect(assessment.leadComparisonPathId).toBeNull();
  });

  it("rejects generated numeric or transaction claims", () => {
    const paths = matchWealthPaths(profile);
    const assessment = createFallbackAssessment(profile, paths);

    expect(
      isAssessmentSemanticallyValid(
        { ...assessment, summaryKo: "수익률 10%를 보장합니다." },
        paths,
      ),
    ).toBe(false);
  });

  it("rejects likely personal contact data before an API call", () => {
    const result = comparePathsRequestSchema.safeParse({
      profile,
      constraintNote: "연락처는 010-1234-5678이고 메일은 me@example.com입니다.",
      sessionId: "123e4567-e89b-42d3-a456-426614174000",
    });

    expect(result.success).toBe(false);
  });
});
