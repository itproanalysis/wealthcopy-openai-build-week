import { z } from "zod";

import {
  nextAssetLevelSchema,
  type NextAssetLevel,
} from "./asset-level";

export const publicActionIdSchema = z.enum([
  "review_cash_buffer",
  "confirm_monthly_limit",
  "review_debt_schedule",
  "review_income_change",
  "schedule_monthly_checkin",
  "seek_professional_review",
  "map_monthly_cashflow",
  "set_cash_safety_rule",
  "confirm_debt_payment_calendar",
  "lock_monthly_execution_routine",
  "review_asset_concentration",
  "review_long_term_structure",
  "audit_plan_drift",
  "refresh_asset_valuation_dates",
  "reconcile_liability_register",
  "document_ownership_structure",
  "consolidate_reporting_calendar",
  "verify_decision_authorities",
  "review_continuity_records",
  "confirm_alternate_access",
  "audit_governance_calendar",
]);

export type PublicActionId = z.infer<typeof publicActionIdSchema>;

export const PUBLIC_ACTION_COPY: Record<
  PublicActionId,
  { title: string; description: string }
> = {
  review_cash_buffer: {
    title: "현금 여유 확인하기",
    description:
      "생활비와 비상 지출에 쓸 현금 여유 기준을 확인하고 기록하면 완료예요.",
  },
  confirm_monthly_limit: {
    title: "월 실행 비율 확정하기",
    description:
      "월 소득 대비 저축·상환 실행 비율을 이번 달 기준으로 기록하면 완료예요.",
  },
  review_debt_schedule: {
    title: "부채 납부 일정 재확인하기",
    description:
      "이번 달 납부일과 자동이체 상태를 모두 확인하면 완료예요.",
  },
  review_income_change: {
    title: "소득 변화 다시 확인하기",
    description:
      "달라진 소득 조건을 확인하고 이번 달 행동 범위를 다시 정하면 완료예요.",
  },
  schedule_monthly_checkin: {
    title: "월말 점검 일정 잡기",
    description:
      "월말 점검 날짜를 캘린더에 등록하고 다음 달 연결을 준비하면 완료예요.",
  },
  seek_professional_review: {
    title: "전문가와 검토 범위 정하기",
    description:
      "거래·세금 판단을 상담할 자격 있는 전문가와 확인 범위를 정하면 완료예요.",
  },
  map_monthly_cashflow: {
    title: "월 현금흐름 지도 만들기",
    description:
      "소득·필수지출·저축·부채상환을 소득 대비 비율로 나누고 빈 항목이 없으면 완료예요.",
  },
  set_cash_safety_rule: {
    title: "현금 안전망 규칙 정하기",
    description:
      "생활비가 달라져도 먼저 지킬 현금 여유 기준을 소득 대비 비율로 적으면 완료예요.",
  },
  confirm_debt_payment_calendar: {
    title: "부채 납부 달력 완성하기",
    description:
      "이번 달 모든 납부일과 자동이체 상태를 한곳에 적고 누락이 없으면 완료예요.",
  },
  lock_monthly_execution_routine: {
    title: "반복 실행 루틴 고정하기",
    description:
      "저축·상환·점검을 매달 같은 날짜의 반복 일정으로 등록하면 완료예요.",
  },
  review_asset_concentration: {
    title: "자산 범주 목록 최신화하기",
    description:
      "금융·주거·연금·기타로 나누고 빠진 자산 범주가 없으면 완료예요.",
  },
  review_long_term_structure: {
    title: "장기 목표와 월 실행 연결하기",
    description:
      "장기 목표마다 연결된 월 실행 항목을 확인하고 유지·재점검 중 하나를 표시하면 완료예요.",
  },
  audit_plan_drift: {
    title: "지난 계획과 실행 차이 확인하기",
    description:
      "지난 계획과 실제 완료 기록을 대조하고 유지·수정 중 하나를 표시하면 완료예요.",
  },
  refresh_asset_valuation_dates: {
    title: "자산 평가 기준일 맞추기",
    description:
      "자산 목록의 평가 기준일을 확인하고 오래된 항목을 표시하면 완료예요.",
  },
  reconcile_liability_register: {
    title: "부채·보증 목록 대조하기",
    description:
      "부채와 보증 기록을 관련 문서와 대조하고 누락 여부를 표시하면 완료예요.",
  },
  document_ownership_structure: {
    title: "소유·관리 구조 기록하기",
    description:
      "주요 자산별 소유 주체와 관리 담당자를 한곳에 기록하면 완료예요.",
  },
  consolidate_reporting_calendar: {
    title: "보고 일정 한곳에 모으기",
    description:
      "자산 현황을 확인할 정기 보고일과 담당자를 하나의 달력에 등록하면 완료예요.",
  },
  verify_decision_authorities: {
    title: "의사결정 권한표 확인하기",
    description:
      "주요 자산 업무의 승인자와 대체 승인자를 권한표에 표시하면 완료예요.",
  },
  review_continuity_records: {
    title: "비상 연속성 기록 점검하기",
    description:
      "비밀번호·인증수단·계좌정보는 남기지 않고, 담당자 부재 시 공식 연락·접근 절차가 최신인지 표시하면 완료예요.",
  },
  confirm_alternate_access: {
    title: "대체 담당자 접근 절차 확인하기",
    description:
      "비밀번호·인증수단·계좌정보는 공유하지 않고, 대체 담당자의 공식 접근 절차와 확인일만 점검하면 완료예요.",
  },
  audit_governance_calendar: {
    title: "자산 운영 점검표 갱신하기",
    description:
      "정기 점검·보고·권한 확인 일정을 검토하고 다음 확인일을 기록하면 완료예요.",
  },
};

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
        message: "행동 ID는 중복될 수 없습니다.",
        path: ["actions"],
      });
    }

    if (plan.actions[2]?.id !== "schedule_monthly_checkin") {
      context.addIssue({
        code: "custom",
        message: "세 번째 행동은 월말 점검 일정이어야 합니다.",
        path: ["actions", 2, "id"],
      });
    }

    const completedCount = plan.actions.filter(
      (action) => action.completed,
    ).length;
    const expectedProgress = [0, 33, 67, 100][completedCount];
    if (plan.progress !== expectedProgress) {
      context.addIssue({
        code: "custom",
        message: "진행률은 완료된 행동 수에서만 계산해야 합니다.",
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
