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
]);

export type PublicActionId = z.infer<typeof publicActionIdSchema>;

export const PUBLIC_ACTION_COPY: Record<
  PublicActionId,
  { title: string; description: string }
> = {
  review_cash_buffer: {
    title: "현금 여유 확인하기",
    description:
      "생활비·비상자금 변동을 확인하고, 없거나 반영했으면 완료해요.",
  },
  confirm_monthly_limit: {
    title: "월 실행 비율 확정하기",
    description:
      "소득 대비 저축·상환 비율을 이번 달 기준으로 확정하면 완료해요.",
  },
  review_debt_schedule: {
    title: "부채 납부 일정 점검하기",
    description:
      "이번 달 납부일과 자동이체 상태를 모두 확인하면 완료해요.",
  },
  review_income_change: {
    title: "소득 변화 다시 확인하기",
    description:
      "달라진 소득 조건을 확인하고 행동 범위를 다시 정하면 완료해요.",
  },
  schedule_monthly_checkin: {
    title: "월말 점검 일정 잡기",
    description:
      "월말 점검 날짜를 캘린더에 잡고 다음 달 연결을 준비하면 완료해요.",
  },
  seek_professional_review: {
    title: "전문가와 범위 확인하기",
    description:
      "거래·세금 판단의 상담 범위를 자격 있는 전문가와 정하면 완료해요.",
  },
  map_monthly_cashflow: {
    title: "한 달 현금흐름 지도 만들기",
    description:
      "소득·필수지출·저축·상환을 소득 대비 비율로 나누고 빠진 항목이 없으면 완료해요.",
  },
  set_cash_safety_rule: {
    title: "현금 안전망 규칙 정하기",
    description:
      "생활비가 달라져도 먼저 지킬 현금 여유 기준을 소득 대비 비율로 한 줄 적으면 완료해요.",
  },
  confirm_debt_payment_calendar: {
    title: "부채 납부 달력 완성하기",
    description:
      "이번 달 모든 납부일과 자동이체 상태를 한곳에 적고 누락이 없으면 완료해요.",
  },
  lock_monthly_execution_routine: {
    title: "반복 실행 루틴 고정하기",
    description:
      "저축·상환 점검을 매달 같은 날짜의 반복 일정으로 등록하면 완료해요.",
  },
  review_asset_concentration: {
    title: "자산 범주 목록 최신화하기",
    description:
      "금융·주거·연금·기타로 나누고 빠진 자산 범주가 없으면 완료해요.",
  },
  review_long_term_structure: {
    title: "장기 목표와 월 실행 연결하기",
    description:
      "장기 목표마다 유지할 저축·상환 비율이 연결됐는지 보고 유지·재점검 중 하나를 표시하면 완료해요.",
  },
  audit_plan_drift: {
    title: "지난 계획과 실행 차이 확인하기",
    description:
      "지난 계획과 실제 완료 내역의 차이를 보고 변화 없음·수정 완료 중 하나를 표시하면 완료해요.",
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
        message: "진행률은 완료한 행동 수에서만 계산해야 합니다.",
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
