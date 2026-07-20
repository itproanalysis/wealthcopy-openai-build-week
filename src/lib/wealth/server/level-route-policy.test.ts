import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ASSET_LEVELS } from "../asset-level";
import {
  LEVEL_ROUTE_POLICIES,
  LEVEL_ROUTE_POLICY_VERSION,
  levelRoutePolicy,
} from "./level-route-policy";

describe("level route policy", () => {
  it("covers all fifteen levels with exactly three distinct horizons", () => {
    expect(LEVEL_ROUTE_POLICY_VERSION).toBe("level-route-policy-v2");
    expect(Object.keys(LEVEL_ROUTE_POLICIES)).toEqual(ASSET_LEVELS);
    expect(
      new Set(ASSET_LEVELS.map((level) => levelRoutePolicy(level).name)).size,
    ).toBe(ASSET_LEVELS.length);

    for (const level of ASSET_LEVELS) {
      const policy = levelRoutePolicy(level);
      expect(policy.level).toBe(level);
      expect(policy.name.length).toBeGreaterThan(0);
      expect(policy.objective.length).toBeGreaterThan(30);
      expect(policy.stages).toHaveLength(3);
      expect(new Set(policy.stages.map((stage) => stage.title)).size).toBe(3);
      for (const stage of policy.stages) {
        expect(stage.focus.length).toBeGreaterThan(55);
      }
    }
  });

  it("separates recovery, formation, diversification, and stewardship concerns", () => {
    expect(JSON.stringify(levelRoutePolicy("L1"))).toMatch(
      /월 적자[\s\S]*상환 압력[\s\S]*순자산 0원/,
    );
    expect(JSON.stringify(levelRoutePolicy("L4"))).toMatch(
      /부채부담[\s\S]*유동성 개월 수[\s\S]*장기 형성/,
    );
    expect(JSON.stringify(levelRoutePolicy("L6"))).toMatch(
      /윗구간 참고범위[\s\S]*가격 상승[\s\S]*부채비율/,
    );
    expect(JSON.stringify(levelRoutePolicy("L8"))).toMatch(
      /사업·비상장[\s\S]*집중[\s\S]*유동성/,
    );
    expect(JSON.stringify(levelRoutePolicy("L10"))).toMatch(
      /사업·비상장[\s\S]*가계[\s\S]*세후 유동성/,
    );
    expect(JSON.stringify(levelRoutePolicy("L12"))).toMatch(
      /운영 원칙[\s\S]*전문가[\s\S]*거버넌스/,
    );
    expect(JSON.stringify(levelRoutePolicy("L13"))).toMatch(
      /승계[\s\S]*대체 의사결정자[\s\S]*사망/,
    );
    expect(JSON.stringify(levelRoutePolicy("L14"))).toMatch(
      /기관[\s\S]*담보[\s\S]*위임[\s\S]*영속성/,
    );
  });

  it("connects guidance to guardrails without becoming a task checklist", () => {
    const serialized = JSON.stringify(LEVEL_ROUTE_POLICIES);

    expect(serialized).not.toMatch(/체크리스트|완료할 행동|해야 할 일|상품 추천|종목|기대수익률/);
    for (const level of ASSET_LEVELS) {
      expect(JSON.stringify(levelRoutePolicy(level))).toMatch(
        /전제하지|인정하지|보류|제외|유지|확정하지|단정하지|쓰지 않습니다|보지 않습니다/,
      );
    }
  });

  it("keeps L15 terminal and focused on stewardship rather than promotion", () => {
    const serialized = JSON.stringify(levelRoutePolicy("L15"));
    expect(serialized).toContain("L15 운영 재점검");
    expect(serialized).toContain("다음 레벨을 가정하지 않고");
    expect(serialized).toMatch(
      /자산 보전[\s\S]*영속성[\s\S]*세대·사업 연속성/,
    );
    expect(serialized).not.toMatch(
      /L15→L15|L16|상위 구간으로 이동|자동 승급|다음 단계 진입/,
    );
  });
});
