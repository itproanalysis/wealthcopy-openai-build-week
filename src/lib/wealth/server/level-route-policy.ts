import "server-only";

import { ASSET_LEVELS, type AssetLevel } from "../asset-level";

export const LEVEL_ROUTE_POLICY_VERSION = "level-route-policy-v1" as const;

export type LevelRoutePolicy = {
  level: AssetLevel;
  name: string;
  objective: string;
  stages: readonly [
    { title: string; focus: string },
    { title: string; focus: string },
    { title: string; focus: string },
  ];
};

/**
 * WealthCopy-owned transition library. It describes what must be reviewed at
 * each current level without promising returns, promotion, or a completion
 * outcome. Safety stops always override these transition focuses.
 */
export const LEVEL_ROUTE_POLICIES = {
  L1: {
    level: "L1",
    name: "순자산 회복 경로",
    objective: "필수 현금흐름과 부채 조건을 먼저 안정시키고 순자산을 0원 위로 회복하는 구간입니다.",
    stages: [
      { title: "회복 기준 확정", focus: "자산·부채·필수유출을 같은 기준일로 맞춰 실제 회복 필요액을 확정합니다." },
      { title: "현금흐름 방어", focus: "월 적자와 가까운 납부일을 먼저 줄이고 반복 가능한 월 잔여액을 확인합니다." },
      { title: "L2 진입 재산정", focus: "최신 순자산이 0원 이상인지 다시 계산하고 남은 위험이 있으면 회복 경로를 유지합니다." },
    ],
  },
  L2: {
    level: "L2",
    name: "첫 안전자금 경로",
    objective: "월 잔여액을 흔들지 않는 범위에서 첫 유동성 안전선과 L3 종잣돈을 분리하는 구간입니다.",
    stages: [
      { title: "월 기준선 고정", focus: "실제 소득·필수생활비·상환액을 맞춰 반복 가능한 월 잔여액을 정합니다." },
      { title: "안전자금 분리", focus: "가까운 지출과 생활 안전자금을 장기 자금과 분리해 구조를 단순하게 만듭니다." },
      { title: "L3 격차 재산정", focus: "실제 자산 증가와 부채 감소만으로 다음 구간 격차를 다시 계산합니다." },
    ],
  },
  L3: {
    level: "L3",
    name: "목적별 시드 경로",
    objective: "비상·주거·장기 자금을 섞지 않고 목적별 역할을 정해 L4 기반을 만드는 구간입니다.",
    stages: [
      { title: "자금 목적 분리", focus: "현금성 자산의 사용 시점과 목적을 구분하고 중복된 금액을 제거합니다." },
      { title: "반복 배분 검증", focus: "월 잔여액 안에서 안전선과 장기 자금의 우선순위가 유지되는지 확인합니다." },
      { title: "L4 구조 재산정", focus: "세 달 이상의 실측 흐름으로 다음 구간 구성과 순자산 격차를 갱신합니다." },
    ],
  },
  L4: {
    level: "L4",
    name: "생활방어선 구축 경로",
    objective: "생활 안전선과 장기 자산 역할을 함께 세워 L5 자산 형성의 흔들림을 줄이는 구간입니다.",
    stages: [
      { title: "안전선 점검", focus: "유동성 개월 수와 90일 일정을 먼저 확인해 장기 자금과 분리합니다." },
      { title: "장기 역할 배치", focus: "확인된 월 잔여액 안에서 장기 자산 역할의 부족분을 검토합니다." },
      { title: "L5 전환 검증", focus: "자산·부채·현금흐름을 같은 기준일로 갱신해 다음 구간 진입 조건을 다시 봅니다." },
    ],
  },
  L5: {
    level: "L5",
    name: "자산형성 분리 경로",
    objective: "거주·유동성·장기 금융자산의 역할을 분리해 L6 구조화 단계로 넘어가는 구간입니다.",
    stages: [
      { title: "구조 병목 확인", focus: "부채와 유동성 중단조건을 먼저 제거하고 가장 큰 구성 차이를 확정합니다." },
      { title: "신규 흐름 재배치", focus: "기존 자산의 성급한 처분보다 월 잔여액의 추가 배정 순서를 조정합니다." },
      { title: "L6 구조 재산정", focus: "실측 변화가 순자산과 구성 격차에 미친 영향을 분리해 다시 계산합니다." },
    ],
  },
  L6: {
    level: "L6",
    name: "구조화 전환 경로",
    objective: "실물·금융·연금·유동성의 편중을 확인하고 L7 성장 기반을 균형 있게 만드는 구간입니다.",
    stages: [
      { title: "편중 원인 확인", focus: "가장 큰 구성 차이가 가격 변화인지 신규 자금 배정인지 구분합니다." },
      { title: "월 흐름 연결", focus: "안전선을 지킨 뒤 확인된 월 잔여액을 부족한 자산 역할과 연결합니다." },
      { title: "L7 전환 재산정", focus: "부채 유지 가정과 실제 부채 감소를 나눠 다음 구간 부족액을 갱신합니다." },
    ],
  },
  L7: {
    level: "L7",
    name: "균형성장 기반 경로",
    objective: "성장 속도보다 부채·실물·금융자산의 균형을 먼저 검증해 L8 확장 기반을 만드는 구간입니다.",
    stages: [
      { title: "성장 전 안전검증", focus: "부채상환 부담과 비유동 편중이 확대 경로를 막는지 먼저 확인합니다." },
      { title: "균형 보정", focus: "매각을 전제하지 않고 신규 흐름의 추가 배정을 부족한 역할 쪽으로 조정합니다." },
      { title: "L8 확장 재산정", focus: "구성 변화와 순자산 증가를 분리해 다음 구간 격차를 다시 계산합니다." },
    ],
  },
  L8: {
    level: "L8",
    name: "집중완화 확장 경로",
    objective: "단일 실물·사업·시장자산 의존을 낮추고 L9 자산 체계화에 필요한 유동성을 확보하는 구간입니다.",
    stages: [
      { title: "집중위험 측정", focus: "비유동 자산과 유동성 안전선을 함께 보고 구조 변경 가능 범위를 정합니다." },
      { title: "분산 역할 보강", focus: "세금·비용을 모르는 처분 대신 신규 흐름과 만기 자금의 역할을 조정합니다." },
      { title: "L9 체계 재산정", focus: "집중도가 실제로 낮아졌는지와 다음 구간 부족액을 같은 기준일로 갱신합니다." },
    ],
  },
  L9: {
    level: "L9",
    name: "자산체계 정비 경로",
    objective: "자산 증가와 생활 현금흐름을 분리해 L10 운영 단계의 안정성을 높이는 구간입니다.",
    stages: [
      { title: "현금흐름 원천 분리", focus: "근로·사업·임대·금융 흐름과 필수유출의 연결을 먼저 확인합니다." },
      { title: "구성 역할 정비", focus: "각 자산군이 성장·방어·현금흐름 중 어떤 역할을 하는지 다시 정합니다." },
      { title: "L10 운영 재산정", focus: "자산 매각 없이 유지 가능한 흐름과 다음 구간 격차를 다시 계산합니다." },
    ],
  },
  L10: {
    level: "L10",
    name: "현금흐름 운영 경로",
    objective: "자산 규모 확대보다 유동성·부채·집중위험을 통합해 L11 관리체계로 전환하는 구간입니다.",
    stages: [
      { title: "운영 위험 지도", focus: "만기·상환·유동성·집중위험을 같은 기준일의 운영 지도로 정리합니다." },
      { title: "세후 영향 확인", focus: "처분이나 이동을 가정하기 전에 세금·비용·현금 필요 시점을 확인합니다." },
      { title: "L11 관리 재산정", focus: "실제 순자산과 운영 위험 변화로 다음 구간 준비도를 갱신합니다." },
    ],
  },
  L11: {
    level: "L11",
    name: "통합관리 전환 경로",
    objective: "개별 자산 판단을 넘어 소유구조·유동성·가족 목적을 함께 정리해 L12 전문관리로 전환하는 구간입니다.",
    stages: [
      { title: "통합 기준 정리", focus: "자산·부채·현금흐름·소유구조의 기준일과 책임자를 한 체계로 맞춥니다." },
      { title: "집중·승계 위험 검토", focus: "큰 자산 이동 없이 유동성 공백과 의사결정 공백을 먼저 확인합니다." },
      { title: "L12 준비 재산정", focus: "최신 순자산과 운영 기준으로 전문관리 전환 필요성을 다시 봅니다." },
    ],
  },
  L12: {
    level: "L12",
    name: "전문관리 체계 경로",
    objective: "상품보다 자산 역할·한도·의사결정 원칙을 세워 L13 거버넌스의 기반을 만드는 구간입니다.",
    stages: [
      { title: "운영 원칙 초안", focus: "유동성·집중·위임 범위와 보고 주기를 문서화할 항목으로 정리합니다." },
      { title: "전문 검토 범위 구분", focus: "세무·법률·투자 판단이 필요한 항목과 내부에서 갱신할 항목을 나눕니다." },
      { title: "L13 체계 재산정", focus: "운영 원칙과 실제 구성 차이를 함께 검토해 다음 구간 준비도를 갱신합니다." },
    ],
  },
  L13: {
    level: "L13",
    name: "거버넌스 설계 경로",
    objective: "가족·법인·개인 자산의 목적과 권한을 정리해 L14 초고액 운영체계로 연결하는 구간입니다.",
    stages: [
      { title: "의사결정 구조 확인", focus: "소유·운용·승인 책임과 유동성 필요 시점을 같은 문서에서 확인합니다." },
      { title: "집중위험 운영", focus: "큰 자산의 처분을 전제하지 않고 한도·보고·중단조건을 먼저 정합니다." },
      { title: "L14 운영 재산정", focus: "거버넌스 공백과 구성 격차가 줄었는지 최신 기준으로 다시 평가합니다." },
    ],
  },
  L14: {
    level: "L14",
    name: "초고액 운영체계 경로",
    objective: "자산배분보다 유동성 계층·권한·외부 전문성·승계 공백을 관리해 L15 장기운영을 준비하는 구간입니다.",
    stages: [
      { title: "기관형 위험 점검", focus: "유동성 계층, 집중한도, 권한과 보고 공백을 우선 확인합니다." },
      { title: "운영체계 보완", focus: "외부 검토가 필요한 세무·법률·승계 항목과 내부 의사결정 항목을 분리합니다." },
      { title: "L15 전환 재산정", focus: "실제 운영체계와 순자산 기준을 함께 갱신해 장기운영 준비도를 다시 봅니다." },
    ],
  },
  L15: {
    level: "L15",
    name: "장기운영·영속성 경로",
    objective: "더 높은 자동 레벨을 만들지 않고 유동성·집중·권한·승계의 장기 운영 품질을 유지하는 구간입니다.",
    stages: [
      { title: "운영 공백 확인", focus: "유동성·권한·승계·보고에서 즉시 보완할 공백을 먼저 확인합니다." },
      { title: "운영 기준 보완", focus: "중단조건과 외부 전문 검토가 필요한 항목을 구분해 운영 기준을 보완합니다." },
      { title: "L15 운영 재점검", focus: "다음 레벨을 가정하지 않고 최신 자산·부채·운영 책임으로 유지 기준을 다시 봅니다." },
    ],
  },
} as const satisfies Record<AssetLevel, LevelRoutePolicy>;

if (Object.keys(LEVEL_ROUTE_POLICIES).length !== ASSET_LEVELS.length) {
  throw new Error("Every asset level must have one route policy.");
}

export function levelRoutePolicy(level: AssetLevel): LevelRoutePolicy {
  return LEVEL_ROUTE_POLICIES[level];
}
