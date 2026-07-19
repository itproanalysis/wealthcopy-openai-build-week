import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSET_LEVELS } from "../asset-level";
import {
  LEVEL_ROUTE_POLICIES,
  LEVEL_ROUTE_POLICY_VERSION,
  levelRoutePolicy,
} from "./level-route-policy";

describe("level route policy", () => {
  it("covers all fifteen levels with three distinct horizons", () => {
    expect(LEVEL_ROUTE_POLICY_VERSION).toBe("level-route-policy-v1");
    expect(Object.keys(LEVEL_ROUTE_POLICIES)).toEqual(ASSET_LEVELS);

    for (const level of ASSET_LEVELS) {
      const policy = levelRoutePolicy(level);
      expect(policy.level).toBe(level);
      expect(policy.name.length).toBeGreaterThan(0);
      expect(policy.objective.length).toBeGreaterThan(0);
      expect(policy.stages).toHaveLength(3);
      expect(new Set(policy.stages.map((stage) => stage.title)).size).toBe(3);
    }
  });

  it("keeps L15 terminal and free of promotion language", () => {
    const serialized = JSON.stringify(levelRoutePolicy("L15"));
    expect(serialized).toContain("L15 운영 재점검");
    expect(serialized).toContain("다음 레벨을 가정하지 않고");
    expect(serialized).not.toMatch(/L15→L15|L16|상위 구간으로 이동|자동 승급합니다/);
  });
});
