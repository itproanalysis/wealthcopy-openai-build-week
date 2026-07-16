import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/wealth/wealth-copy-app", () => ({
  WealthCopyApp: () => null,
}));

import nextConfig from "../../next.config";
import { revalidate } from "./page";

describe("runtime hardening configuration", () => {
  it("disables framework disclosure and protects every route", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    if (!nextConfig.headers) throw new Error("Expected route headers.");

    const rules = await nextConfig.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    if (!globalRule) throw new Error("Expected global security headers.");

    const headers = new Map(
      globalRule.headers.map((header) => [header.key, header.value]),
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("keeps API responses and the root document out of stale caches", async () => {
    if (!nextConfig.headers) throw new Error("Expected route headers.");

    const rules = await nextConfig.headers();
    const apiRule = rules.find((rule) => rule.source === "/api/:path*");
    expect(apiRule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "no-store",
    });
    expect(revalidate).toBe(0);
  });
});
