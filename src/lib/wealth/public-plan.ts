import { z } from "zod";

import {
  nextAssetLevelSchema,
  type NextAssetLevel,
} from "./asset-level";

export const publicActionIdSchema = z.enum([
  "complete_asset_snapshot",
  "build_cash_runway_rule",
  "stabilize_priority_payments",
  "rank_debt_review_priority",
  "protect_near_term_liquidity",
  "prepare_income_change_plan",
  "verify_or_hold_asset",
  "pause_dominant_bucket_additions",
  "set_new_money_guardrail",
  "separate_household_business_cash",
  "calendar_30_60_90_maturities",
  "review_retirement_account_routine",
  "map_property_liquidity_dates",
  "map_critical_access_and_owners",
  "seek_professional_review",
  "map_30_day_cashflow",
  "separate_cash_roles",
  "start_core_auto_execution",
  "separate_near_term_goal_funds",
  "classify_asset_roles",
  "set_leverage_guardrail",
  "align_valuation_dates",
  "set_concentration_cap",
  "build_liquidity_tiers",
  "draft_one_page_ips",
  "consolidate_reporting_calendar",
  "set_asset_class_limits",
  "create_family_decision_matrix",
  "build_liquidity_event_calendar",
  "audit_governance_calendar",
  "verify_cashflow_balance",
  "verify_first_automatic_transfer",
  "verify_payment_coverage",
  "compare_plan_to_actual",
  "verify_asset_mix_total",
  "verify_concentration_rule",
  "verify_valuation_freshness",
  "verify_liquidity_coverage",
  "verify_policy_exceptions",
  "verify_reporting_ownership",
  "run_continuity_access_drill",
  "close_governance_review",
  "build_succession_agenda",
]);

export type PublicActionId = z.infer<typeof publicActionIdSchema>;

export type PublicActionCopy = {
  stage: "protect" | "advance" | "verify";
  title: string;
  outcome: string;
  description: string;
  steps: readonly [string, string, string];
};

export const PUBLIC_ACTION_COPY = {
  complete_asset_snapshot: {
    stage: "protect",
    title: "자산 현황표 완성하기",
    outcome: "확인 기준일이 적힌 한 장의 자산 현황표",
    description:
      "주요 자산 범주와 부채, 확인 기준일을 한 표에 기록하고 빈 항목을 ‘확인 필요’로 표시하면 완료됩니다.",
    steps: [
      "자산과 부채를 범주별로 한 줄씩 적습니다.",
      "각 항목에 마지막으로 확인한 날짜를 표시합니다.",
      "모르는 항목은 ‘확인 필요’로 남기고 표를 저장합니다.",
    ],
  },
  build_cash_runway_rule: {
    stage: "protect",
    title: "생활 현금 유지 규칙 만들기",
    outcome: "생활을 지키는 현금 기준과 보충 순서",
    description:
      "필수지출을 버틸 현금 개월 수 기준과 기준 미달 시 보충 순서를 한 문장으로 저장하면 완료됩니다.",
    steps: [
      "우리 가구가 지켜야 할 필수지출 범위를 적습니다.",
      "그 지출을 버틸 현금 개월 수 기준을 정합니다.",
      "기준 아래로 내려갈 때 먼저 멈출 일과 보충 순서를 저장합니다.",
    ],
  },
  stabilize_priority_payments: {
    stage: "protect",
    title: "우선 납부 항목 안정화하기",
    outcome: "누락 없이 확인 가능한 우선 납부 목록",
    description:
      "주거·세금·보험·부채 중 놓치면 생활에 영향이 큰 항목의 납부일과 확인 방법을 모두 기록하면 완료됩니다.",
    steps: [
      "놓치면 생활에 영향이 큰 납부 항목을 모읍니다.",
      "각 항목의 납부일과 자동 처리 여부를 확인합니다.",
      "누락을 확인할 담당자 또는 알림 방법을 적습니다.",
    ],
  },
  rank_debt_review_priority: {
    stage: "protect",
    title: "부채 점검 순서 정하기",
    outcome: "위험 신호가 빠른 순서로 정리된 부채 점검표",
    description:
      "모든 부채를 만기·담보·상환 변동 가능성으로 점검하고 먼저 확인할 순서를 표시하면 완료됩니다.",
    steps: [
      "부채별 만기와 담보 여부를 한 표에 모읍니다.",
      "상환 조건이 바뀔 수 있는 항목을 표시합니다.",
      "먼저 확인할 순서와 다음 확인일을 정합니다.",
    ],
  },
  protect_near_term_liquidity: {
    stage: "protect",
    title: "가까운 일정의 현금 지키기",
    outcome: "가까운 생활 일정과 사용 가능한 현금의 연결표",
    description:
      "앞으로 예정된 큰 생활 일정과 그때 사용할 현금의 위치를 짝지어 적고 미확정 항목을 표시하면 완료됩니다.",
    steps: [
      "앞으로 예정된 큰 생활 일정을 날짜순으로 적습니다.",
      "각 일정에 사용할 수 있는 현금의 위치를 연결합니다.",
      "아직 준비되지 않은 일정에는 ‘보호 필요’를 표시합니다.",
    ],
  },
  prepare_income_change_plan: {
    stage: "protect",
    title: "소득 변화 대응표 만들기",
    outcome: "소득 변화 신호와 즉시 실행할 대응표",
    description:
      "소득이 줄거나 불규칙해질 때의 시작 신호와 지출·저축·상환의 대응 순서를 한 표에 적으면 완료됩니다.",
    steps: [
      "우리 가구가 알아챌 수 있는 소득 변화 신호를 정합니다.",
      "신호가 생기면 먼저 조정할 항목을 순서대로 적습니다.",
      "원래 계획으로 돌아갈 재확인 조건을 함께 저장합니다.",
    ],
  },
  verify_or_hold_asset: {
    stage: "protect",
    title: "확인 안 된 자산 판단 보류하기",
    outcome: "확인된 항목과 보류된 항목이 나뉜 현황표",
    description:
      "소유·가치·접근 방법 중 하나라도 확인되지 않은 자산에 ‘판단 보류’를 표시하면 완료됩니다.",
    steps: [
      "현황표에서 확인 근거가 없는 자산을 찾습니다.",
      "소유·가치·접근 방법 중 빠진 정보를 표시합니다.",
      "확인 전까지 해당 항목을 판단에서 보류한다고 기록합니다.",
    ],
  },
  pause_dominant_bucket_additions: {
    stage: "protect",
    title: "쏠림 범주 추가 판단 멈추기",
    outcome: "쏠림 확인 전까지 작동하는 판단 보류 규칙",
    description:
      "가장 큰 자산 범주와 확인이 필요한 위험 신호를 적고 점검 전에는 추가 판단을 보류한다고 저장하면 완료됩니다.",
    steps: [
      "현재 가장 큰 자산 범주를 현황표에서 찾습니다.",
      "유동성·가격·소득 연결 위험 중 확인할 신호를 표시합니다.",
      "점검이 끝날 때까지 추가 판단을 보류하는 규칙을 저장합니다.",
    ],
  },
  set_new_money_guardrail: {
    stage: "protect",
    title: "신규자금 사전 규칙 만들기",
    outcome: "목적·사용 시점·집중도를 먼저 확인하는 신규자금 체크 규칙",
    description:
      "신규자금이 생겼을 때 확인할 목적·사용 시점·집중도 질문과 판단을 보류할 조건 하나를 저장하면 완료됩니다.",
    steps: [
      "신규자금의 목적과 실제로 사용할 수 있는 시점을 먼저 적습니다.",
      "현재 가장 큰 자산 범주와 집중 구간을 확인합니다.",
      "목적·사용 시점·집중 구간 중 하나라도 불명확하면 판단을 보류하고 재확인일을 저장합니다.",
    ],
  },
  separate_household_business_cash: {
    stage: "protect",
    title: "가계와 사업 현금 흐름 나누기",
    outcome: "가계와 사업 기록이 섞이지 않는 구분 규칙",
    description:
      "가계와 사업의 수입·지출 기록 위치와 서로 이동할 때의 기록 규칙을 각각 정하면 완료됩니다.",
    steps: [
      "가계와 사업의 수입·지출 기록 위치를 따로 정합니다.",
      "두 영역 사이의 이동을 표시할 공통 이름을 정합니다.",
      "최근 기록 한 건을 새 규칙에 따라 구분해 봅니다.",
    ],
  },
  calendar_30_60_90_maturities: {
    stage: "protect",
    title: "30·60·90일 만기표 만들기",
    outcome: "가까운 만기와 의무를 한눈에 보는 일정표",
    description:
      "앞으로 90일 안의 만기·납부·갱신 일정을 30·60·90일 구간에 빠짐없이 넣으면 완료됩니다.",
    steps: [
      "만기·납부·갱신 문서에서 날짜를 모읍니다.",
      "각 날짜를 30·60·90일 구간에 넣습니다.",
      "담당자와 확인일을 각 일정 옆에 적습니다.",
    ],
  },
  review_retirement_account_routine: {
    stage: "protect",
    title: "연금계좌 점검 루틴 정하기",
    outcome: "연금계좌별 점검 항목과 다음 확인일",
    description:
      "보유 연금계좌의 상태·납입 작동 여부·연락 정보를 확인하고 다음 확인일을 기록하면 완료됩니다.",
    steps: [
      "보유 연금계좌와 관리 기관을 한곳에 적습니다.",
      "납입 작동 여부와 연락 정보를 확인합니다.",
      "다음 확인일과 확인할 사람을 기록합니다.",
    ],
  },
  map_property_liquidity_dates: {
    stage: "protect",
    title: "부동산 유동성 일정 연결하기",
    outcome: "부동산별 계약·세금·대출·수선 일정표",
    description:
      "보유 부동산별 계약·세금·대출·수선의 다음 날짜와 준비 담당자를 모두 적으면 완료됩니다.",
    steps: [
      "부동산별 계약·세금·대출·수선 문서를 모읍니다.",
      "각 문서에서 다음 확인 날짜를 일정표에 옮깁니다.",
      "준비 담당자와 빠진 문서를 표시합니다.",
    ],
  },
  map_critical_access_and_owners: {
    stage: "protect",
    title: "핵심 자산 접근 책임자 확인하기",
    outcome: "핵심 기록별 접근 방법과 예비 책임자가 연결된 표",
    description:
      "핵심 자산 기록마다 보관 위치·주 책임자·예비 책임자·접근 확인일을 연결하고 빈칸이 없으면 완료됩니다.",
    steps: [
      "가족이 반드시 찾을 수 있어야 하는 핵심 자산 기록을 고릅니다.",
      "각 기록의 보관 위치와 주 책임자·예비 책임자를 연결합니다.",
      "예비 책임자가 실제 접근 가능 여부를 확인하고 확인일을 남깁니다.",
    ],
  },
  seek_professional_review: {
    stage: "protect",
    title: "전문가 확인 범위 정하기",
    outcome: "전문가에게 전달할 자료와 질문 목록",
    description:
      "법률·세무·신용 판단이 필요한 항목을 표시하고 전문가에게 확인할 질문과 자료 목록을 만들면 완료됩니다.",
    steps: [
      "스스로 확정하면 안 되는 법률·세무·신용 항목을 표시합니다.",
      "각 항목에서 확인할 질문을 한 문장으로 적습니다.",
      "상담 전에 전달할 자료와 기록할 답변 위치를 정합니다.",
    ],
  },
  map_30_day_cashflow: {
    stage: "advance",
    title: "최근 30일 현금 흐름 지도 만들기",
    outcome: "생활·의무·미래 준비로 구분된 현금 흐름표",
    description:
      "최근 30일의 수입과 지출을 생활·의무·미래 준비로 구분하고 빠진 거래가 없는지 확인하면 완료됩니다.",
    steps: [
      "최근 30일의 수입과 지출 기록을 모읍니다.",
      "각 기록을 생활·의무·미래 준비로 구분합니다.",
      "계좌 잔액 변화와 대조해 빠진 기록을 확인합니다.",
    ],
  },
  separate_cash_roles: {
    stage: "advance",
    title: "현금의 역할 나누기",
    outcome: "생활·안전·목표 역할이 표시된 현금 지도",
    description:
      "현재 현금을 생활·안전·목표 역할로 구분하고 각 역할의 사용 조건을 한 문장씩 적으면 완료됩니다.",
    steps: [
      "현재 현금이 어디에 있는지 목록으로 만듭니다.",
      "각 항목에 생활·안전·목표 역할을 하나씩 붙입니다.",
      "역할마다 사용할 수 있는 조건을 한 문장으로 저장합니다.",
    ],
  },
  start_core_auto_execution: {
    stage: "advance",
    title: "핵심 자동 실행 시작하기",
    outcome: "생활일 뒤에 작동하는 한 가지 자동 실행",
    description:
      "반복할 저축 또는 상환 행동 하나를 정하고 소득 확인일 뒤에 자동으로 작동하도록 설정하면 완료됩니다.",
    steps: [
      "매달 가장 먼저 반복할 저축 또는 상환 행동을 하나 고릅니다.",
      "소득 확인일 뒤에 작동하는 자동 실행으로 설정합니다.",
      "첫 작동일과 실패 알림 방법을 기록합니다.",
    ],
  },
  separate_near_term_goal_funds: {
    stage: "advance",
    title: "가까운 목표 자금 분리하기",
    outcome: "가까운 목표와 장기 자산이 섞이지 않는 기록",
    description:
      "가까운 생활 목표마다 사용 시점과 자금 위치를 적고 장기 자산과 구분해 표시하면 완료됩니다.",
    steps: [
      "가까운 시기에 예정된 생활 목표를 적습니다.",
      "각 목표의 사용 시점과 자금 위치를 연결합니다.",
      "장기 자산과 섞이지 않도록 현황표에 구분 표시합니다.",
    ],
  },
  classify_asset_roles: {
    stage: "advance",
    title: "자산의 역할 분류하기",
    outcome: "안전·생활·성장·승계 역할이 표시된 자산표",
    description:
      "현황표의 모든 자산에 안전·생활·성장·승계 중 주된 역할 하나를 표시하면 완료됩니다.",
    steps: [
      "최신 자산 현황표를 엽니다.",
      "각 자산이 가구에서 맡는 주된 역할을 하나 고릅니다.",
      "역할이 겹치거나 불명확한 항목에 재검토 표시를 남깁니다.",
    ],
  },
  set_leverage_guardrail: {
    stage: "advance",
    title: "레버리지 중단선 정하기",
    outcome: "부채 부담 신호와 중단 행동이 연결된 규칙",
    description:
      "부채 부담이 커졌다고 판단할 신호와 그때 중단할 행동, 다시 검토할 조건을 문장으로 저장하면 완료됩니다.",
    steps: [
      "부채 부담을 확인할 수 있는 가구 신호를 고릅니다.",
      "신호가 켜지면 즉시 중단할 행동을 적습니다.",
      "전문가 또는 가구가 다시 검토할 조건을 저장합니다.",
    ],
  },
  align_valuation_dates: {
    stage: "advance",
    title: "자산 확인 기준일 맞추기",
    outcome: "같은 시점으로 비교 가능한 자산 현황표",
    description:
      "주요 자산의 확인 기준일을 같은 기준일로 맞추고 오래된 항목에 갱신 표시를 하면 완료됩니다.",
    steps: [
      "비교에 사용할 공통 기준일을 정합니다.",
      "각 자산의 마지막 확인일을 공통 기준일과 대조합니다.",
      "기준이 오래된 항목에 갱신 담당자와 날짜를 적습니다.",
    ],
  },
  set_concentration_cap: {
    stage: "advance",
    title: "자산 쏠림 경고선 정하기",
    outcome: "쏠림 경고와 재검토 절차가 적힌 규칙",
    description:
      "자산 범주가 경고선에 닿았을 때 새 판단을 멈추고 확인할 항목과 승인 절차를 문서에 적으면 완료됩니다.",
    steps: [
      "가구가 특별히 감시할 자산 범주를 정합니다.",
      "쏠림을 다시 검토할 내부 경고선을 기록합니다.",
      "경고선 도달 시 확인할 자료와 승인 절차를 적습니다.",
    ],
  },
  build_liquidity_tiers: {
    stage: "advance",
    title: "유동성 단계표 만들기",
    outcome: "즉시·예정·장기 역할로 나뉜 유동성 지도",
    description:
      "자산을 즉시 사용·예정된 사용·장기 보유 역할로 구분하고 사용 제한을 표시하면 완료됩니다.",
    steps: [
      "자산별로 실제 사용할 수 있는 시점을 확인합니다.",
      "즉시 사용·예정된 사용·장기 보유 역할로 구분합니다.",
      "계약·세금·담보 등 사용 제한을 각 항목에 표시합니다.",
    ],
  },
  draft_one_page_ips: {
    stage: "advance",
    title: "한 장 자산 원칙서 만들기",
    outcome: "목표·금지선·검토 절차가 담긴 한 장의 원칙서",
    description:
      "가구 목표, 지켜야 할 금지선, 판단 전 확인할 자료, 정기 검토일을 한 장에 적으면 완료됩니다.",
    steps: [
      "가구 자산이 지켜야 할 목표를 한 문장으로 적습니다.",
      "하지 않을 일과 판단 전 확인할 자료를 적습니다.",
      "책임자와 정기 검토일을 표시해 한 장으로 저장합니다.",
    ],
  },
  consolidate_reporting_calendar: {
    stage: "advance",
    title: "자산 보고 일정을 하나로 모으기",
    outcome: "보고일·자료·담당자가 연결된 통합 일정표",
    description:
      "자산·부채·세금·법인 관련 정기 보고일과 필요한 자료, 담당자를 한 일정표에 넣으면 완료됩니다.",
    steps: [
      "흩어진 정기 보고와 확인 일정을 모읍니다.",
      "각 일정에 필요한 자료와 작성 담당자를 연결합니다.",
      "검토 담당자와 누락 알림 방법을 기록합니다.",
    ],
  },
  set_asset_class_limits: {
    stage: "advance",
    title: "자산 범주 판단 한계 정하기",
    outcome: "범주별 허용·금지·예외 절차가 적힌 정책표",
    description:
      "주요 자산 범주별 허용 조건, 금지 조건, 예외 승인 절차를 한 표에 기록하면 완료됩니다.",
    steps: [
      "현재 보유하거나 검토하는 자산 범주를 적습니다.",
      "범주별 허용 조건과 금지 조건을 문장으로 남깁니다.",
      "예외가 필요할 때의 자료와 승인자를 연결합니다.",
    ],
  },
  create_family_decision_matrix: {
    stage: "advance",
    title: "가족 의사결정표 만들기",
    outcome: "사안별 제안·검토·승인 책임이 분명한 표",
    description:
      "자산 관련 주요 사안마다 제안자·검토자·승인자·대체 담당자를 한 표에 적으면 완료됩니다.",
    steps: [
      "가족이 함께 결정해야 할 주요 자산 사안을 적습니다.",
      "각 사안의 제안자·검토자·승인자를 지정합니다.",
      "부재 시 대체 담당자와 기록 보관 위치를 연결합니다.",
    ],
  },
  build_liquidity_event_calendar: {
    stage: "advance",
    title: "유동성 이벤트 달력 만들기",
    outcome: "예정 이벤트와 의사결정 시점이 연결된 달력",
    description:
      "사업·부동산·세금·상속 관련 예정 이벤트와 준비 시작일, 최종 확인일을 한 달력에 넣으면 완료됩니다.",
    steps: [
      "현금 이동을 일으킬 수 있는 예정 이벤트를 모읍니다.",
      "이벤트별 준비 시작일과 최종 확인일을 정합니다.",
      "담당자와 필요한 문서 위치를 각 일정에 연결합니다.",
    ],
  },
  audit_governance_calendar: {
    stage: "advance",
    title: "자산 운영 달력 감사하기",
    outcome: "보고·승인·승계 점검이 닫힌 운영 달력",
    description:
      "보고·승인·위험·승계 일정을 모두 검토하고 빠진 책임자나 문서가 없다고 표시하면 완료됩니다.",
    steps: [
      "올해의 보고·승인·위험·승계 일정을 한곳에 모읍니다.",
      "각 일정의 책임자와 근거 문서를 대조합니다.",
      "누락을 보완하고 검토 완료 표시와 날짜를 남깁니다.",
    ],
  },
  verify_cashflow_balance: {
    stage: "verify",
    title: "현금 흐름 누락 검증하기",
    outcome: "잔액 변화와 맞는 30일 현금 흐름표",
    description:
      "30일 현금 흐름표와 계좌 잔액 변화를 대조해 차이가 없거나 차이 이유를 모두 기록하면 완료됩니다.",
    steps: [
      "현금 흐름표의 시작과 끝 잔액 변화를 확인합니다.",
      "수입과 지출 기록의 합계 변화와 대조합니다.",
      "남은 차이마다 원인을 적고 검증 표시를 남깁니다.",
    ],
  },
  verify_first_automatic_transfer: {
    stage: "verify",
    title: "첫 자동 실행 확인하기",
    outcome: "실제 작동이 확인된 자동 실행 기록",
    description:
      "설정한 자동 실행이 예정일에 작동했는지 확인하고 성공 또는 실패 원인을 기록하면 완료됩니다.",
    steps: [
      "예정일 뒤에 실제 처리 상태를 확인합니다.",
      "성공 여부와 알림 작동 여부를 기록합니다.",
      "실패했다면 원인과 다음 재확인일을 적습니다.",
    ],
  },
  verify_payment_coverage: {
    stage: "verify",
    title: "필수 납부 준비 검증하기",
    outcome: "모든 우선 납부 항목의 준비 상태표",
    description:
      "다음 납부일까지 모든 우선 납부 항목의 준비 상태와 누락 대응자를 확인하면 완료됩니다.",
    steps: [
      "우선 납부 목록에서 다음 납부일을 확인합니다.",
      "각 항목의 처리 준비와 알림 상태를 점검합니다.",
      "미준비 항목의 대응자와 확인일을 적습니다.",
    ],
  },
  compare_plan_to_actual: {
    stage: "verify",
    title: "계획과 실제 행동 비교하기",
    outcome: "유지·수정·중단이 표시된 실행 점검표",
    description:
      "계획한 행동마다 실제 실행 여부를 대조하고 유지·수정·중단 중 하나를 표시하면 완료됩니다.",
    steps: [
      "이번 점검 주기의 계획 행동을 불러옵니다.",
      "각 행동의 실제 실행 기록과 대조합니다.",
      "다음 주기에 유지·수정·중단할 항목을 표시합니다.",
    ],
  },
  verify_asset_mix_total: {
    stage: "verify",
    title: "자산 역할표 완전성 확인하기",
    outcome: "빠진 항목 없이 역할이 표시된 자산표",
    description:
      "자산 현황표의 모든 항목에 역할과 확인 기준일이 있고 중복 또는 누락 항목이 없으면 완료됩니다.",
    steps: [
      "자산 현황표와 역할 분류표의 항목 수를 대조합니다.",
      "역할이 없거나 둘 이상인 항목을 찾아 정리합니다.",
      "확인 기준일이 없는 항목을 표시하고 검증 기록을 남깁니다.",
    ],
  },
  verify_concentration_rule: {
    stage: "verify",
    title: "쏠림 규칙 작동 확인하기",
    outcome: "경고선과 승인 절차의 작동 확인 기록",
    description:
      "가상 쏠림 상황 하나에 경고선·판단 보류·승인 절차를 적용하고 결과를 기록하면 완료됩니다.",
    steps: [
      "경고선에 닿는 가상 상황 하나를 만듭니다.",
      "정한 판단 보류와 승인 절차를 순서대로 적용합니다.",
      "막힌 단계와 보완할 책임자를 기록합니다.",
    ],
  },
  verify_valuation_freshness: {
    stage: "verify",
    title: "자산 기준일 최신성 검증하기",
    outcome: "오래된 항목과 갱신 책임자가 표시된 현황표",
    description:
      "공통 기준일과 모든 주요 자산의 확인일을 대조하고 오래된 항목에 갱신 책임자를 지정하면 완료됩니다.",
    steps: [
      "공통 기준일과 자산별 확인일을 나란히 봅니다.",
      "기준이 오래되거나 출처가 없는 항목을 표시합니다.",
      "각 표시 항목에 갱신 책임자와 확인일을 적습니다.",
    ],
  },
  verify_liquidity_coverage: {
    stage: "verify",
    title: "유동성 일정 연결 검증하기",
    outcome: "준비 상태와 담당자가 확인된 이벤트 표",
    description:
      "가까운 모든 이벤트에 사용할 현금 위치·사용 제한·준비 담당자가 연결되어 있으면 완료됩니다.",
    steps: [
      "가까운 이벤트 목록과 유동성 단계표를 대조합니다.",
      "각 이벤트의 현금 위치와 사용 제한을 확인합니다.",
      "연결이 없는 이벤트에 준비 담당자와 확인일을 적습니다.",
    ],
  },
  verify_policy_exceptions: {
    stage: "verify",
    title: "정책 예외 절차 시험하기",
    outcome: "예외 요청부터 승인 기록까지 검증된 절차",
    description:
      "가상 예외 요청 하나를 자료 확인·검토·승인·기록 절차에 통과시키고 막힌 단계를 보완하면 완료됩니다.",
    steps: [
      "가상 예외 요청과 필요한 근거 자료를 준비합니다.",
      "정책에 적힌 검토와 승인 절차를 실행합니다.",
      "막힌 단계와 보완 책임자를 기록합니다.",
    ],
  },
  verify_reporting_ownership: {
    stage: "verify",
    title: "보고 책임자 확인하기",
    outcome: "모든 보고 일정의 작성·검토 책임표",
    description:
      "통합 일정표의 모든 보고 항목에 작성자·검토자·대체 담당자가 지정되어 있으면 완료됩니다.",
    steps: [
      "통합 일정표에서 책임자가 빈 항목을 찾습니다.",
      "각 항목의 작성자와 검토자를 확인합니다.",
      "부재 시 대체 담당자와 연락 절차를 적습니다.",
    ],
  },
  run_continuity_access_drill: {
    stage: "verify",
    title: "연속성 접근 훈련 실행하기",
    outcome: "비밀정보 노출 없이 검증된 대체 접근 절차",
    description:
      "대체 담당자가 비밀정보를 공유받지 않고 공식 안내와 문서 위치를 찾아 다음 행동을 설명하면 완료됩니다.",
    steps: [
      "대체 담당자에게 가상 부재 상황을 알립니다.",
      "공식 연락처와 문서 위치를 스스로 찾게 합니다.",
      "다음 행동을 설명하게 하고 막힌 지점을 기록합니다.",
    ],
  },
  close_governance_review: {
    stage: "verify",
    title: "운영 검토 닫기",
    outcome: "결정·담당자·마감 상태가 남은 검토 기록",
    description:
      "운영 검토에서 나온 모든 안건에 결정·담당자·확인일을 적고 열린 안건이 없으면 완료됩니다.",
    steps: [
      "운영 검토 안건과 회의 기록을 모읍니다.",
      "각 안건에 결정과 실행 담당자를 연결합니다.",
      "확인일을 적고 남은 열린 안건이 없는지 점검합니다.",
    ],
  },
  build_succession_agenda: {
    stage: "verify",
    title: "승계 점검 의제 만들기",
    outcome: "가족과 전문가가 확인할 승계 의제 목록",
    description:
      "소유·의사결정·세무·접근 연속성에서 확인할 질문과 담당자를 의제 목록으로 만들면 완료됩니다.",
    steps: [
      "소유·의사결정·세무·접근 연속성 질문을 모읍니다.",
      "가족이 결정할 일과 전문가가 확인할 일을 구분합니다.",
      "각 의제의 담당자와 필요한 문서 위치를 적습니다.",
    ],
  },
} as const satisfies Record<PublicActionId, PublicActionCopy>;

const publicActionSchema = z
  .object({
    id: publicActionIdSchema,
    completed: z.boolean(),
  })
  .strict();

const progressSchema = z.union([
  z.literal(0),
  z.literal(33),
  z.literal(67),
  z.literal(100),
]);

export const publicPlanSchema = z
  .object({
    nextLevel: nextAssetLevelSchema,
    actions: z.array(publicActionSchema).length(3),
    progress: progressSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    const actionIds = plan.actions.map((action) => action.id);
    if (new Set(actionIds).size !== actionIds.length) {
      context.addIssue({
        code: "custom",
        message: "행동 ID는 중복할 수 없습니다.",
        path: ["actions"],
      });
    }

    const completedCount = plan.actions.filter(
      (action) => action.completed,
    ).length;
    const expectedProgress = [0, 33, 67, 100][completedCount];
    if (plan.progress !== expectedProgress) {
      context.addIssue({
        code: "custom",
        message: "진행률은 완료한 행동 수로만 계산해야 합니다.",
        path: ["progress"],
      });
    }
  });

export type PublicPlan = z.infer<typeof publicPlanSchema>;

export function recalculatePublicPlan(plan: PublicPlan): PublicPlan {
  const completedCount = plan.actions.filter(
    (action) => action.completed,
  ).length;

  return publicPlanSchema.parse({
    nextLevel: plan.nextLevel,
    actions: plan.actions,
    progress: [0, 33, 67, 100][completedCount],
  });
}

export function projectPublicPlan(
  nextLevel: NextAssetLevel,
  actionIds: readonly PublicActionId[],
  completedIds: ReadonlySet<PublicActionId> = new Set(),
): PublicPlan {
  const actions = actionIds.map((id) => ({
    id,
    completed: completedIds.has(id),
  }));
  const completedCount = actions.filter((action) => action.completed).length;

  return publicPlanSchema.parse({
    nextLevel,
    actions,
    progress: [0, 33, 67, 100][completedCount],
  });
}

export function carryCompletedActions(
  previousPlan: PublicPlan | null,
  nextLevel: NextAssetLevel,
  nextActionIds: readonly PublicActionId[],
) {
  const completedIds = new Set(
    previousPlan?.nextLevel === nextLevel
      ? previousPlan.actions
          .filter((action) => action.completed)
          .map((action) => action.id)
      : [],
  );

  return projectPublicPlan(nextLevel, nextActionIds, completedIds);
}
