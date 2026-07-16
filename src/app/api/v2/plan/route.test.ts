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
vi.mock("@/lib/wealth/server/planner", async () =>
  import("../../../../lib/wealth/server/planner-core"),
);
vi.mock("@/lib/wealth/public-plan", async () =>
  import("../../../../lib/wealth/public-plan"),
);
vi.mock("@/lib/wealth/asset-level", async () =>
  import("../../../../lib/wealth/asset-level"),
);

import { PUBLIC_ACTION_COPY } from "../../../../lib/wealth/public-plan";

import { POST } from "./route";

const validHardStopPayload = {
  profile: {
    totalAssetsKrw: 450_000_000,
    totalDebtKrw: 50_000_000,
    incomeExecutionRatio: 48,
    assetPercentileBand: "p90_plus",
    debtServiceRatio: 18,
    cashRunwayBand: "under_1",
    incomeStability: "stable",
    largestAssetGroup: "mixed",
    concentrationBand: "p30_50",
    debtRisk: "none",
    next90DayEvent: "none",
  },
  constraintNote: "",
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
} as const;

const validModelPayload = {
  ...validHardStopPayload,
  profile: {
    ...validHardStopPayload.profile,
    assetPercentileBand: "p90_plus",
    cashRunwayBand: "six_to_twelve",
    concentrationBand: "p50_70",
    largestAssetGroup: "market",
  },
  sessionId: "123e4567-e89b-42d3-a456-426614174001",
} as const;

function postRequest(body: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-forwarded-for": "203.0.113.10",
  });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return new Request("http://localhost/api/v2/plan", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/v2/plan", () => {
  beforeEach(() => {
    openAiMocks.getOpenAIClient.mockReset();
    openAiMocks.getOpenAIModel.mockReset();
  });

  it("returns only a private-level, protect/advance/verify public plan", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validHardStopPayload)),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-WealthCopy-Source-Level")).toBe("L6");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(body)).toEqual(["nextLevel", "actions", "progress"]);
    expect(body.nextLevel).toBe("L7");
    expect(body.progress).toBe(0);
    expect(body.actions).toHaveLength(3);

    const actionIds = body.actions.map(
      (action: { id: keyof typeof PUBLIC_ACTION_COPY }) => action.id,
    );
    expect(new Set(actionIds).size).toBe(3);
    expect(
      actionIds.map((actionId: keyof typeof PUBLIC_ACTION_COPY) =>
        PUBLIC_ACTION_COPY[actionId].stage,
      ),
    ).toEqual(["protect", "advance", "verify"]);
    for (const action of body.actions) {
      expect(Object.keys(action)).toEqual(["id", "completed"]);
      expect(action.completed).toBe(false);
    }

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(
      String(validHardStopPayload.profile.totalAssetsKrw),
    );
    expect(serialized).not.toContain(
      String(validHardStopPayload.profile.totalDebtKrw),
    );
    expect(serialized).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|assetPercentileBand|p90_plus|psid|model|reasons?/i,
    );
    expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
    expect(openAiMocks.getOpenAIModel).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied level", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          ...validHardStopPayload,
          profile: {
            ...validHardStopPayload.profile,
            currentLevel: "L15",
          },
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("requires application/json before parsing the body", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validHardStopPayload), {
        "Content-Type": "text/plain",
      }),
    );

    expect(response.status).toBe(415);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
  });

  it("accepts application/json with an explicit charset", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validHardStopPayload), {
        "Content-Type": "application/json; charset=utf-8",
      }),
    );

    expect(response.status).toBe(200);
  });

  it.each([
    ["a foreign Origin", "Origin", "https://evil.example"],
    ["cross-site browser metadata", "Sec-Fetch-Site", "cross-site"],
  ])("rejects %s before model access", async (_label, header, value) => {
    const response = await POST(
      postRequest(JSON.stringify(validModelPayload), { [header]: value }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
  });

  it("allows an exact same-origin browser request", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validHardStopPayload), {
        Origin: "http://localhost",
        "Sec-Fetch-Site": "same-origin",
      }),
    );

    expect(response.status).toBe(200);
  });

  it("allows browser-confirmed same-origin requests behind a Cloud Run alias", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validHardStopPayload), {
        Origin:
          "https://wealth-copy-470320899177.asia-northeast3.run.app",
        "Sec-Fetch-Site": "same-origin",
      }),
    );

    expect(response.status).toBe(200);
  });

  it.each(["gzip", "br"])(
    "rejects the non-identity content encoding %s",
    async (contentEncoding) => {
      const response = await POST(
        postRequest(JSON.stringify(validHardStopPayload), {
          "Content-Encoding": contentEncoding,
        }),
      );

      expect(response.status).toBe(415);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
    },
  );

  it.each([
    "연락처는 010-1234-5678입니다.",
    "월 650만원을 저축하고 싶어요.",
  ])("rejects unsafe constraint notes: %s", async (constraintNote) => {
    const response = await POST(
      postRequest(
        JSON.stringify({ ...validHardStopPayload, constraintNote }),
      ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a declared body larger than 8 KiB before JSON parsing", async () => {
    const response = await POST(postRequest("{", { "Content-Length": "8193" }));

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("bounds a streamed body when Content-Length is absent", async () => {
    const request = postRequest(
      JSON.stringify({ padding: "x".repeat(8_192) }),
    );
    expect(request.headers.get("Content-Length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects an invalid Content-Length without reading model inputs", async () => {
    const response = await POST(
      postRequest(JSON.stringify(validModelPayload), {
        "Content-Length": "not-a-number",
      }),
    );

    expect(response.status).toBe(400);
    expect(openAiMocks.getOpenAIClient).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(postRequest('{"profile":'));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sends only bounded signals to GPT-5.6 Luna at low effort", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { supportActionId: "set_new_money_guardrail" },
    });
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { parse } });
    openAiMocks.getOpenAIModel.mockReturnValue("gpt-5.6-luna");

    const response = await POST(
      postRequest(JSON.stringify(validModelPayload), {
        Origin: "http://localhost",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actions[0]?.id).toBe("set_new_money_guardrail");
    expect(parse).toHaveBeenCalledOnce();

    const modelRequest = parse.mock.calls[0]?.[0];
    if (!modelRequest) throw new Error("Expected one OpenAI request.");
    expect(modelRequest).toMatchObject({
      max_output_tokens: 120,
      model: "gpt-5.6-luna",
      reasoning: { effort: "low" },
      store: false,
    });
    expect(modelRequest.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(modelRequest.safety_identifier).not.toBe(validModelPayload.sessionId);

    const serializedModelInput = String(modelRequest.input);
    expect(serializedModelInput).not.toMatch(
      /totalAssetsKrw|totalDebtKrw|assetPercentileBand|p90_plus|psid/i,
    );
    expect(serializedModelInput).not.toContain(
      String(validModelPayload.profile.totalAssetsKrw),
    );
    expect(serializedModelInput).not.toContain(
      String(validModelPayload.profile.totalDebtKrw),
    );
  });

  it("uses recent completions privately without serializing their record", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { supportActionId: "set_new_money_guardrail" },
    });
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { parse } });
    openAiMocks.getOpenAIModel.mockReturnValue("gpt-5.6-luna");

    const response = await POST(
      postRequest(
        JSON.stringify({
          ...validModelPayload,
          recentCompletions: [
            {
              id: "set_concentration_cap",
              monthsAgo: 2,
              sourceLevel: "L6",
            },
          ],
          sessionId: "123e4567-e89b-42d3-a456-426614174002",
        }),
        { "x-forwarded-for": "203.0.113.13" },
      ),
    );

    expect(response.status).toBe(200);
    expect(parse).toHaveBeenCalledOnce();
    const modelRequest = parse.mock.calls[0]?.[0];
    if (!modelRequest) throw new Error("Expected one OpenAI request.");

    const serializedModelInput = String(modelRequest.input);
    expect(serializedModelInput).not.toMatch(
      /recentCompletions|sourceLevel|monthsAgo|set_concentration_cap/,
    );
  });

  it("returns the same public fallback when the OpenAI key is missing", async () => {
    openAiMocks.getOpenAIClient.mockImplementation(() => {
      throw new openAiMocks.MissingOpenAIKeyError();
    });

    const response = await POST(
      postRequest(JSON.stringify(validModelPayload), {
        "x-forwarded-for": "203.0.113.11",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.actions[0]?.id).toBe("pause_dominant_bucket_additions");
  });

  it("returns the reviewed fallback for invalid model output", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { supportActionId: "audit_governance_calendar" },
    });
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { parse } });
    openAiMocks.getOpenAIModel.mockReturnValue("gpt-5.6-luna");

    const response = await POST(
      postRequest(JSON.stringify(validModelPayload), {
        "x-forwarded-for": "203.0.113.12",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actions[0]?.id).toBe("pause_dominant_bucket_additions");
  });
});
