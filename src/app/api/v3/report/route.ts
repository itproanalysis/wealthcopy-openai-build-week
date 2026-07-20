import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  aiReportOrchestrationPlanSchema,
  createReportContext,
  mergeReportOrchestration,
  reportRequestSchema,
  WEALTH_REPORT_ORCHESTRATION_INSTRUCTIONS,
} from "@/lib/wealth/server/report-core";
import { wealthReportSchema } from "@/lib/wealth/wealth-report";
import {
  getOpenAIClient,
  getOpenAIModel,
  MissingOpenAIKeyError,
} from "@/lib/openai";

export const runtime = "nodejs";

const MAX_REQUEST_BODY_BYTES = 8_192;

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the configured byte limit.");
    this.name = "RequestBodyTooLargeError";
  }
}
type RateLimitEntry = { count: number; resetAt: number };
type RateLimitGlobal = typeof globalThis & {
  wealthCopyV3ReportRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimitGlobal = globalThis as RateLimitGlobal;
const rateLimits =
  rateLimitGlobal.wealthCopyV3ReportRateLimits ??
  new Map<string, RateLimitEntry>();
rateLimitGlobal.wealthCopyV3ReportRateLimits = rateLimits;

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

function isApplicationJson(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  return mediaType === "application/json";
}

function hasSupportedContentEncoding(request: Request) {
  const contentEncoding = request.headers.get("content-encoding")?.trim();
  if (!contentEncoding) return true;
  return contentEncoding
    .split(",")
    .every((encoding) => encoding.trim().toLowerCase() === "identity");
}

function hasForeignBrowserOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return true;
  if (fetchSite === "same-origin") return false;

  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) return false;
  try {
    return new URL(suppliedOrigin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function declaredContentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

async function readBoundedRequestBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The size violation remains authoritative if cancellation fails.
        }
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

function jsonNoStore(value: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(value, { ...init, headers });
}

function publicReportResponse(value: unknown, init?: ResponseInit) {
  return jsonNoStore(wealthReportSchema.parse(value), init);
}

export async function POST(request: Request) {
  if (!isApplicationJson(request)) {
    return jsonNoStore(
      { error: "Content-Type은 application/json이어야 합니다." },
      { status: 415 },
    );
  }
  if (!hasSupportedContentEncoding(request)) {
    return jsonNoStore(
      { error: "압축된 요청 본문은 지원하지 않습니다." },
      { status: 415 },
    );
  }
  if (hasForeignBrowserOrigin(request)) {
    return jsonNoStore(
      { error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." },
      { status: 403 },
    );
  }

  const contentLength = declaredContentLength(request);
  if (Number.isNaN(contentLength) || contentLength === Infinity) {
    return jsonNoStore(
      { error: "Content-Length가 올바르지 않습니다." },
      { status: 400 },
    );
  }
  if (contentLength !== null && contentLength > MAX_REQUEST_BODY_BYTES) {
    return jsonNoStore(
      { error: "요청 본문은 8KB를 넘을 수 없습니다." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readBoundedRequestBody(request));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonNoStore(
        { error: "요청 본문은 8KB를 넘을 수 없습니다." },
        { status: 413 },
      );
    }
    return jsonNoStore(
      { error: "유효한 JSON 요청을 보내 주세요." },
      { status: 400 },
    );
  }

  const parsed = reportRequestSchema.safeParse(payload);
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

  const context = createReportContext(parsed.data);
  if (!context.allowModel) return publicReportResponse(context.fallback);

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
    return publicReportResponse(context.fallback, {
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

  try {
    const response = await getOpenAIClient().responses.parse({
      input: JSON.stringify(context.modelInput),
      instructions: WEALTH_REPORT_ORCHESTRATION_INSTRUCTIONS,
      max_output_tokens: 160,
      model: getOpenAIModel(),
      reasoning: { effort: "low" },
      safety_identifier: safetyIdentifier,
      store: false,
      text: {
        format: zodTextFormat(
          aiReportOrchestrationPlanSchema,
          "wealth_copy_report_orchestration",
        ),
      },
    });
    if (response.status !== "completed" || response.output_parsed === null) {
      return publicReportResponse(context.fallback);
    }
    return publicReportResponse(
      mergeReportOrchestration(context, response.output_parsed),
    );
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI report orchestration failed", {
        requestId: error.requestID,
        status: error.status,
      });
    } else if (!(error instanceof MissingOpenAIKeyError)) {
      console.error("Unexpected report orchestration error", error);
    }
    return publicReportResponse(context.fallback);
  }
}
