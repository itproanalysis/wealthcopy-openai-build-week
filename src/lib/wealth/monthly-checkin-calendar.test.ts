import { describe, expect, it } from "vitest";

import { createMonthlyCheckinCalendar } from "./monthly-checkin-calendar";

describe("createMonthlyCheckinCalendar", () => {
  it("creates an all-day month-end check-in without financial data", () => {
    const calendar = createMonthlyCheckinCalendar("2026-07");

    expect(calendar.filename).toBe("wealthcopy-2026-07-checkin.ics");
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260731");
    expect(calendar.content).toContain("DTEND;VALUE=DATE:20260801");
    expect(calendar.content).toContain("SUMMARY:WealthCopy 월말 행동 점검");
    expect(calendar.content).not.toMatch(
      /income|debt|asset|percentile|amount|krw|usd/i,
    );
  });

  it("handles leap-year February and rejects invalid month keys", () => {
    expect(createMonthlyCheckinCalendar("2028-02").content).toContain(
      "DTSTART;VALUE=DATE:20280229",
    );
    expect(() => createMonthlyCheckinCalendar("2028-13")).toThrow();
  });
});
