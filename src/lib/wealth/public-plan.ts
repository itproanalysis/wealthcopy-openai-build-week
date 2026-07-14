import { z } from "zod";

export const publicActionIdSchema = z.enum([
  "review_cash_buffer",
  "confirm_monthly_limit",
  "review_debt_schedule",
  "review_income_change",
  "schedule_monthly_checkin",
  "seek_professional_review",
]);

export type PublicActionId = z.infer<typeof publicActionIdSchema>;

export const PUBLIC_ACTION_COPY: Record<
  PublicActionId,
  { title: string; description: string }
> = {
  review_cash_buffer: {
    title: "현금 여유 확인하기",
    description: "이번 달 생활비와 비상자금에 변화가 없는지 확인해요.",
  },
  confirm_monthly_limit: {
    title: "월 실행 한도 정하기",
    description: "이번 달에 무리 없이 지킬 수 있는 실행 한도를 정해요.",
  },
  review_debt_schedule: {
    title: "부채 납부 일정 점검하기",
    description: "이번 달 납부 일정에서 빠진 항목이 없는지 확인해요.",
  },
  review_income_change: {
    title: "소득 변화 다시 확인하기",
    description: "달라진 소득 조건을 확인하고 이번 달 행동 범위를 다시 잡아요.",
  },
  schedule_monthly_checkin: {
    title: "월말 상태 기록하기",
    description: "이번 달 변화를 기록하고 다음 달에 이어가요.",
  },
  seek_professional_review: {
    title: "전문가와 범위 확인하기",
    description: "거래나 세금 판단이 필요한 부분은 자격 있는 전문가와 확인해요.",
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
    nextLevel: z.literal("L7"),
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
    nextLevel: "L7",
    actions: plan.actions,
    progress: [0, 33, 67, 100][completedCount],
  });
}

export function projectPublicPlan(
  actionIds: readonly PublicActionId[],
  completedIds: ReadonlySet<PublicActionId> = new Set(),
): PublicPlan {
  const actions = actionIds.map((id) => ({
    id,
    completed: completedIds.has(id),
  }));
  const completedCount = actions.filter((action) => action.completed).length;

  return publicPlanSchema.parse({
    nextLevel: "L7",
    actions,
    progress: [0, 33, 67, 100][completedCount],
  });
}
