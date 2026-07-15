import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  aiActionSelectionSchema,
  createPlanningContext,
  mergeModelSelection,
  planRequestSchema,
  WEALTH_ACTION_INSTRUCTIONS,
} from "@/lib/wealth/server/planner";
import {
  getOpenAIClient,
  getOpenAIModel,
  MissingOpenAIKeyError,
} from "@/lib/openai";
import { publicPlanSchema } from "@/lib/wealth/public-plan";
import {
  WEALTH_SOURCE_LEVEL_HEADER,
  type AssetLevel,
} from "@/lib/wealth/asset-level";

export const runtime = "nodejs";

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitGlobal = typeof globalThis & {
  wealthCopyV2RateLimits?: Map<string, RateLimitEntry>;
};

const rateLimitGlobal = globalThis as RateLimitGlobal;
const rateLimits =
  rateLimitGlobal.wealthCopyV2RateLimits ?? new Map<string, RateLimitEntry>();
rateLimitGlobal.wealthCopyV2RateLimits = rateLimits;

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
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
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

function jsonNoStore(value: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(value, {
    ...init,
    headers,
  });
}

function publicPlanResponse(
  value: unknown,
  sourceLevel: AssetLevel,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  headers.set(WEALTH_SOURCE_LEVEL_HEADER, sourceLevel);

  return jsonNoStore(publicPlanSchema.parse(value), {
    ...init,
    headers,
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
      return jsonNoStore(
        { error: "요청 본문은 8KB를 넘을 수 없습니다." },
        { status: 413 },
      );
    }
    payload = JSON.parse(rawBody);
  } catch {
    return jsonNoStore(
      { error: "유효한 JSON 요청을 보내 주세요." },
      { status: 400 },
    );
  }

  const parsed = planRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonNoStore(
      {
        error:
          parsed.error.issues[0]?.message ??
          "입력값이 예상한 형식과 일치하지 않습니다.",
      },
      { status: 400 },
    );
  }

  const context = createPlanningContext(parsed.data);
  if (!context.allowModel) {
    return publicPlanResponse(context.fallback, context.sourceLevel);
  }

  const safetyIdentifier = anonymousSafetyIdentifier(parsed.data.sessionId);
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
    return publicPlanResponse(context.fallback, context.sourceLevel, {
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

  try {
    const response = await getOpenAIClient().responses.parse({
      input: JSON.stringify(context.modelInput),
      instructions: WEALTH_ACTION_INSTRUCTIONS,
      max_output_tokens: 300,
      model: getOpenAIModel(),
      reasoning: { effort: "medium" },
      safety_identifier: safetyIdentifier,
      store: false,
      text: {
        format: zodTextFormat(
          aiActionSelectionSchema,
          "wealth_copy_action_selection",
        ),
      },
    });

    return publicPlanResponse(
      mergeModelSelection(context, response.output_parsed),
      context.sourceLevel,
    );
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI action selection failed", {
        requestId: error.requestID,
        status: error.status,
      });
    } else if (!(error instanceof MissingOpenAIKeyError)) {
      console.error("Unexpected action selection error", error);
    }

    return publicPlanResponse(context.fallback, context.sourceLevel);
  }
}
