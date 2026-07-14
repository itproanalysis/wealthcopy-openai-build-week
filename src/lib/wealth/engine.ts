import { z } from "zod";

export const assetLevelSchema = z.enum([
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
]);
export const pathTypeSchema = z.enum(["stable", "balanced", "fast"]);
export const householdTypeSchema = z.enum([
  "single",
  "couple",
  "family",
  "other",
]);

export const wealthProfileSchema = z
  .object({
    currentLevel: z.literal("L6"),
    targetLevel: z.literal("L7"),
    monthlyIncome: z.number().int().positive().max(10_000_000_000),
    monthlySavings: z.number().int().nonnegative().max(10_000_000_000),
    debtRatio: z.number().min(0).max(100),
    householdType: householdTypeSchema,
    riskPreference: pathTypeSchema,
    emergencyFundMonths: z.number().min(0).max(24),
  })
  .strict()
  .superRefine((profile, context) => {
    if (profile.monthlySavings > profile.monthlyIncome) {
      context.addIssue({
        code: "custom",
        message: "월 가용 저축액은 월소득을 초과할 수 없습니다.",
        path: ["monthlySavings"],
      });
    }

  });

export type AssetLevel = z.infer<typeof assetLevelSchema>;
export type PathType = z.infer<typeof pathTypeSchema>;
export type HouseholdType = z.infer<typeof householdTypeSchema>;
export type WealthProfile = z.infer<typeof wealthProfileSchema>;

export type WealthPathResult = {
  type: PathType;
  title: string;
  durationMonths: number;
  monthlyRequired: number;
  liquidityScore: number;
  difficulty: "쉬움" | "보통" | "어려움";
  bullets: [string, string, string];
  recommended: boolean;
  score: number;
  coverageRatio: number;
  budgetGap: number;
};

type PathTemplate = Omit<
  WealthPathResult,
  | "budgetGap"
  | "coverageRatio"
  | "durationMonths"
  | "monthlyRequired"
  | "recommended"
  | "score"
>;

const PATH_LIBRARY: Record<
  PathType,
  PathTemplate & { baseDurationMonths: number; baseMonthlyRequired: number }
> = {
  stable: {
    type: "stable",
    title: "안정형 경로",
    baseDurationMonths: 77,
    baseMonthlyRequired: 2_400_000,
    liquidityScore: 5,
    difficulty: "쉬움",
    bullets: ["생활비 여유 우선", "부채 축소 먼저", "투자 확대는 천천히"],
  },
  balanced: {
    type: "balanced",
    title: "균형형 경로",
    baseDurationMonths: 62,
    baseMonthlyRequired: 3_100_000,
    liquidityScore: 4,
    difficulty: "보통",
    bullets: ["저축·부채상환 균형", "장기 계획 병행", "지속 가능성 우선"],
  },
  fast: {
    type: "fast",
    title: "빠른형 경로",
    baseDurationMonths: 54,
    baseMonthlyRequired: 4_200_000,
    liquidityScore: 3,
    difficulty: "어려움",
    bullets: ["높은 월 실행액", "생활비 여유 감소", "실행 난도 높음"],
  },
};

const PATH_ORDER: PathType[] = ["stable", "balanced", "fast"];

function scorePath(profile: WealthProfile, pathType: PathType, coverage: number) {
  let score = 50;

  if (profile.riskPreference === pathType) {
    score += 26;
  } else if (
    (profile.riskPreference === "balanced" && pathType !== "balanced") ||
    (pathType === "balanced" && profile.riskPreference !== "balanced")
  ) {
    score += 8;
  }

  if (coverage >= 1) score += 24;
  else if (coverage >= 0.8) score += 8;
  else score -= 18;

  if (pathType === "stable") {
    if (profile.debtRatio >= 30) score += 18;
    if (profile.emergencyFundMonths < 3) score += 22;
    if (profile.householdType === "family") score += 8;
  }

  if (pathType === "balanced") {
    if (profile.debtRatio >= 10 && profile.debtRatio < 35) score += 10;
    if (profile.emergencyFundMonths >= 3) score += 8;
  }

  if (pathType === "fast") {
    if (profile.debtRatio >= 30) score -= 28;
    if (profile.emergencyFundMonths < 3) score -= 34;
    if (profile.monthlySavings / profile.monthlyIncome >= 0.45) score += 14;
    if (profile.householdType === "family") score -= 10;
  }

  return score;
}

export function matchWealthPaths(input: WealthProfile): WealthPathResult[] {
  const profile = wealthProfileSchema.parse(input);

  const candidates = PATH_ORDER.map((type) => {
    const template = PATH_LIBRARY[type];
    const monthlyRequired = template.baseMonthlyRequired;
    const durationMonths = template.baseDurationMonths;
    const coverageRatio =
      monthlyRequired === 0 ? 1 : profile.monthlySavings / monthlyRequired;

    return {
      type,
      title: template.title,
      durationMonths,
      monthlyRequired,
      liquidityScore: template.liquidityScore,
      difficulty: template.difficulty,
      bullets: template.bullets,
      recommended: false,
      score: scorePath(profile, type, coverageRatio),
      coverageRatio,
      budgetGap: Math.max(0, monthlyRequired - profile.monthlySavings),
    } satisfies WealthPathResult;
  });

  const recommendedType = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PATH_ORDER.indexOf(a.type) - PATH_ORDER.indexOf(b.type);
  })[0]?.type;

  return candidates.map((candidate) => ({
    ...candidate,
    recommended: candidate.type === recommendedType,
  }));
}
