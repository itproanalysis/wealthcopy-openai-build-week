import { describe, expect, it } from "vitest";

import { GET, HEAD } from "./route";

describe("GET /api/healthz", () => {
  it("returns a minimal no-store liveness response", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("supports no-store HEAD probes without a response body", async () => {
    const response = HEAD();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });
});
