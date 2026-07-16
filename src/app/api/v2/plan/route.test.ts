import { beforeEach, describe, expect, it, vi } from "vitest";

const openAiMocks = vi.hoisted(() => ({
  getOpenAIClient: vi.fn(),
  getOpenAIModel: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: openAiMocks.getOpenAIClient,
  getOpenAIModel: openAiMocks.getOpenAIModel,
  MissingOpenAIKeyError: class MissingOpenAIKeyError extends Error {},
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

function postRequest(body: string) {
  return new Request("http://localhost/api/v2/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
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

  it("rejects a request body larger than 8 KiB", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ padding: "x".repeat(8_192) })),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(postRequest('{"profile":'));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
