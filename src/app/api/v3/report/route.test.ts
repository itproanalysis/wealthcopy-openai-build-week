import { beforeEach, describe, expect, it, vi } from "vitest";

const openAiMocks = vi.hoisted(() => {
  class MissingOpenAIKeyError extends Error {}
  return {
    getOpenAIClient: vi.fn(),
    getOpenAIModel: vi.fn(),
    MissingOpenAIKeyError,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: openAiMocks.getOpenAIClient,
  getOpenAIModel: openAiMocks.getOpenAIModel,
  MissingOpenAIKeyError: openAiMocks.MissingOpenAIKeyError,
}));
vi.mock("@/lib/wealth/server/report-core", async () =>
  import("../../../../lib/wealth/server/report-core"),
);
vi.mock("@/lib/wealth/wealth-report", async () =>
  import("../../../../lib/wealth/wealth-report"),
);

import { POST } from "./route";

const validPayload = {
  profile: {
    assets: {
      liquid: 50_000_000,
      home: 150_000_000,
      market: 120_000_000,
      pension: 50_000_000,
      incomeProperty: 30_000_000,
      businessPrivate: 25_000_000,
      alternatives: 15_000_000,
      other: 10_000_000,
    },
    totalDebtKrw: 50_000_000,
    monthlyIncomeKrw: 10_000_000,
    monthlyLivingExpenseKrw: 4_000_000,
    monthlyDebtPaymentKrw: 1_000_000,
    incomeStability: "stable",
    next90DayEvent: "none",
    next90DayAmountKrw: 0,
  },
  constraintNote: "",
  sessionId: "123e4567-e89b-42d3-a456-426614174100",
} as const;

const hardStopPayload = {
  ...validPayload,
  profile: {
    ...validPayload.profile,
    assets: {
      liquid: 10_000_000,
      home: 850_000_000,
      market: 100_000_000,
      pension: 40_000_000,
      incomeProperty: 0,
      businessPrivate: 0,
      alternatives: 0,
      other: 0,
    },
    totalDebtKrw: 1_000_000_000,
    monthlyLivingExpenseKrw: 5_000_000,
    monthlyDebtPaymentKrw: 4_000_000,
  },
  sessionId: "123e4567-e89b-42d3-a456-426614174101",
} as const;

function postRequest(
  body: string,
  extraHeaders: Record<string, string> = {},
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-forwarded-for": "203.0.113.31",
  });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Request("http://localhost/api/v3/report", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/v3/report", () => {
  beforeEach(() => {
    openAiMocks.getOpenAIClient.mockReset();
    openAiMocks.getOpenAIModel.mockReset();
  });

  it("returns a no-store comprehensive report without plan-completion or PSID fields", async () => {
    const response = await POST(postRequest(JSON.stringify(hardStopPayload)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(body)).toEqual([
      "version",
      "generatedAt",
      "level",
      "composition",
      "cashflow",
      "risks",
      "priorities",
      "interpretation",
      "route",
      "dataConfidence",
      "methodology",
    ]);
    expect(body.level).toMatchObject({
      current: "L2",
      next: "L3",
      netWorthKrw: 0,
      gapKrw: 10_000_000,
      positionPercent: 0,
    });
    expect(body.composition).toHaveLength(8);
    expect(body.priorities).toHaveLength(3);
    expect(body.route.stages).toHaveLength(3);
    expect(JSON.stringify(body)).not.toMatch(
      /(?:actions|completed|checklist|psid|progress)/i,
    );
    expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
  });

  it("rejects legacy PSID, client level, and aggregate total fields", async () => {
    for (const extra of [
      { assetPercentileBand: "p90_plus" },
      { currentLevel: "L6" },
      { totalAssetsKrw: 450_000_000 },
    ]) {
      const response = await POST(
        postRequest(
          JSON.stringify({
            ...validPayload,
            profile: { ...validPayload.profile, ...extra },
          }),
          { "x-forwarded-for": `203.0.113.${40 + Object.keys(extra)[0]!.length}` },
        ),
      );
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("reuses the JSON, origin, identity-encoding, and 8 KiB request gates", async () => {
    const textResponse = await POST(
      postRequest(JSON.stringify(validPayload), { "Content-Type": "text/plain" }),
    );
    expect(textResponse.status).toBe(415);

    const foreignResponse = await POST(
      postRequest(JSON.stringify(validPayload), {
        Origin: "https://example.net",
        "x-forwarded-for": "203.0.113.52",
      }),
    );
    expect(foreignResponse.status).toBe(403);

    const compressedResponse = await POST(
      postRequest(JSON.stringify(validPayload), {
        "Content-Encoding": "gzip",
        "x-forwarded-for": "203.0.113.53",
      }),
    );
    expect(compressedResponse.status).toBe(415);

    const oversizedResponse = await POST(
      postRequest(JSON.stringify(validPayload), {
        "Content-Length": "8193",
        "x-forwarded-for": "203.0.113.54",
      }),
    );
    expect(oversizedResponse.status).toBe(413);
  });

  it("lets Luna select only a strict allowlisted explanation plan from minimized signals", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        framingId: "cashflow_then_gap",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      },
    });
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { parse } });
    openAiMocks.getOpenAIModel.mockReturnValue("gpt-5.6-luna");

    const response = await POST(
      postRequest(JSON.stringify(validPayload), {
        Origin: "http://localhost",
        "x-forwarded-for": "203.0.113.61",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe("wealth-report-v2");
    expect(body.interpretation).toMatchObject({
      framingId: "cashflow_then_gap",
      leadInsightId: "balance_before_scale",
      explanationOrderId: "adjustment_first",
      connectionId: "structure_to_gap",
    });
    expect(body.route.title).toBe("L6→L7 구조화 전환 경로");
    expect(body.route.summary).toContain("월 현금흐름");
    expect(body.route.stages.map((stage: { title: string }) => stage.title)).toEqual([
      "편중 원인 확인",
      "월 흐름 연결",
      "L7 전환 재산정",
    ]);
    expect(parse).toHaveBeenCalledOnce();
    const modelRequest = parse.mock.calls[0]?.[0];
    if (!modelRequest) throw new Error("Expected one OpenAI request.");
    expect(modelRequest).toMatchObject({
      max_output_tokens: 160,
      model: "gpt-5.6-luna",
      reasoning: { effort: "low" },
      store: false,
    });
    expect(modelRequest.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(modelRequest.safety_identifier).not.toBe(validPayload.sessionId);

    const serializedModelInput = String(modelRequest.input);
    expect(serializedModelInput).not.toMatch(
      /(?:Krw|amount|ratio|percent|netWorth|currentLevel|nextLevel|psid|constraintNote)/i,
    );
    expect(serializedModelInput).not.toContain("450000000");
    expect(serializedModelInput).not.toContain("50000000");
    expect(serializedModelInput).not.toMatch(/(?:recovery|foundation|growth|complexity|governance)/i);
  });

  it("returns the deterministic report for a missing key or invalid model selection", async () => {
    openAiMocks.getOpenAIClient.mockImplementation(() => {
      throw new openAiMocks.MissingOpenAIKeyError();
    });
    const missingKeyResponse = await POST(
      postRequest(JSON.stringify(validPayload), {
        "x-forwarded-for": "203.0.113.71",
      }),
    );
    const missingKeyBody = await missingKeyResponse.json();
    expect(missingKeyResponse.status).toBe(200);
    expect(missingKeyBody.route.title).toBe("L6→L7 구조화 전환 경로");

    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        framingId: "verify_then_plan",
        leadInsightId: "balance_before_scale",
        explanationOrderId: "adjustment_first",
        connectionId: "structure_to_gap",
      },
    });
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { parse } });
    openAiMocks.getOpenAIModel.mockReturnValue("gpt-5.6-luna");
    const invalidResponse = await POST(
      postRequest(JSON.stringify(validPayload), {
        "x-forwarded-for": "203.0.113.72",
      }),
    );
    const invalidBody = await invalidResponse.json();
    expect(invalidResponse.status).toBe(200);
    expect(invalidBody.route.title).toBe("L6→L7 구조화 전환 경로");
    expect(invalidBody.route).toEqual(missingKeyBody.route);
  });
});
