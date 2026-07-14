import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  aiPathAssessmentSchema,
  comparePathsRequestSchema,
  createFallbackAssessment,
  isAssessmentSemanticallyValid,
  WEALTH_COPY_INSTRUCTIONS,
} from "@/lib/wealth/assessment";
import { matchWealthPaths } from "@/lib/wealth/engine";
import {
  getOpenAIClient,
  getOpenAIModel,
  MissingOpenAIKeyError,
} from "@/lib/openai";

export const runtime = "nodejs";

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitGlobal = typeof globalThis & {
  wealthCopyRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimitGlobal = globalThis as RateLimitGlobal;
const rateLimits =
  rateLimitGlobal.wealthCopyRateLimits ?? new Map<string, RateLimitEntry>();
rateLimitGlobal.wealthCopyRateLimits = rateLimits;

function consumeRateLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();

  if (!rateLimits.has(key) && rateLimits.size >= 5_000) {
    for (const [storedKey, entry] of rateLimits) {
      if (entry.resetAt <= now) rateLimits.delete(storedKey);
    }

    if (rateLimits.size >= 5_000) {
      const oldestKey = rateLimits.keys().next().value;
      if (oldestKey) rateLimits.delete(oldestKey);
    }
  }

  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maximum) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

function anonymousSafetyIdentifier(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
      return NextResponse.json(
        { error: "요청 본문은 8KB를 넘을 수 없습니다." },
        { status: 413 },
      );
    }
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 요청을 보내 주세요." },
      { status: 400 },
    );
  }

  const parsed = comparePathsRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "입력값이 예상한 형식과 일치하지 않습니다.",
      },
      { status: 400 },
    );
  }

  const { profile, constraintNote, sessionId } = parsed.data;
  const paths = matchWealthPaths(profile);
  const fallback = createFallbackAssessment(profile, paths, constraintNote);

  if (fallback.status !== "ready") {
    return NextResponse.json({
      assessment: fallback,
      model: null,
      paths,
      source: "fallback",
      warning:
        fallback.status === "professional_review_required"
          ? "이 요청은 교육용 경로 비교 범위를 벗어나 AI로 전송하지 않았습니다."
          : "계획 전제가 크게 달라져 AI로 전송하기 전에 추가 확인이 필요합니다.",
    });
  }

  const safetyIdentifier = anonymousSafetyIdentifier(sessionId);
  const ipLimit = consumeRateLimit(`ip:${requestIp(request)}`, 20, 60_000);
  const sessionLimit = consumeRateLimit(
    `session:${safetyIdentifier}`,
    8,
    60_000,
  );

  if (!ipLimit.allowed || !sessionLimit.allowed) {
    const retryAfterSeconds = Math.max(
      ipLimit.retryAfterSeconds,
      sessionLimit.retryAfterSeconds,
    );

    return NextResponse.json(
      {
        assessment: fallback,
        model: null,
        paths,
        source: "fallback",
        warning: "요청이 많아 잠시 규칙 기반 설명을 표시합니다.",
      },
      {
        headers: { "Retry-After": String(retryAfterSeconds) },
        status: 429,
      },
    );
  }

  const modelInput = {
    locale: "ko-KR",
    profile: {
      monthlySavings: profile.monthlySavings,
      debtRatio: profile.debtRatio,
      householdType: profile.householdType,
      riskPreference: profile.riskPreference,
      emergencyFundMonths: profile.emergencyFundMonths,
    },
    constraintNote,
    candidatePaths: paths.map((path) => ({
      pathId: path.type,
      durationMonths: path.durationMonths,
      monthlyRequired: path.monthlyRequired,
      liquidityScore: path.liquidityScore,
      difficulty: path.difficulty,
      budgetGap: path.budgetGap,
    })),
  };

  try {
    const model = getOpenAIModel();
    const response = await getOpenAIClient().responses.parse({
      input: JSON.stringify(modelInput),
      instructions: WEALTH_COPY_INSTRUCTIONS,
      max_output_tokens: 1200,
      model,
      reasoning: { effort: "medium" },
      safety_identifier: safetyIdentifier,
      store: false,
      text: {
        format: zodTextFormat(
          aiPathAssessmentSchema,
          "wealth_path_assessment",
        ),
      },
    });

    const assessment = response.output_parsed;

    if (!assessment || !isAssessmentSemanticallyValid(assessment, paths)) {
      return NextResponse.json({
        assessment: fallback,
        model,
        paths,
        source: "fallback",
        warning: "AI 분석을 검증하지 못해 규칙 기반 설명을 표시합니다.",
      });
    }

    return NextResponse.json({
      assessment,
      model,
      paths,
      source: "gpt-5.6",
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI path assessment failed", {
        requestId: error.requestID,
        status: error.status,
      });
    } else if (!(error instanceof MissingOpenAIKeyError)) {
      console.error("Unexpected path assessment error", error);
    }

    return NextResponse.json({
      assessment: fallback,
      model: null,
      paths,
      source: "fallback",
      warning:
        error instanceof MissingOpenAIKeyError
          ? "API 키가 없어 규칙 기반 설명으로 실행 중입니다."
          : "AI 연결이 일시적으로 어려워 규칙 기반 설명을 표시합니다.",
    });
  }
}
