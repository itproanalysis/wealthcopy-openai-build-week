# WealthCopy — 다음 자산 단계, 이번 달 행동 세 개

WealthCopy는 자산관리를 분석 문제가 아니라 **행동 문제**로 다루는 OpenAI Build Week MVP입니다. 사용자는 복잡한 경로 비교 대신 다음 자산 단계 `L7`, 정확히 세 개의 이번 달 행동, 행동 완료율만 봅니다.

## 사용자 경험

메인 화면의 정보 계약은 세 가지뿐입니다.

1. 다음 자산 단계: `L7`
2. 이번 달 행동: 정확히 3개
3. 행동 완료율: `0%`, `33%`, `67%`, `100%` 중 하나

진행률은 완료한 행동 수를 뜻하며 자산 변화, 수익률, 목표 도달률을 의미하지 않습니다. 상품, 기간, 금액, 추천 이유, 모델명, 경로 비교 결과는 메인 화면에 표시하지 않습니다.

사용 흐름:

1. `L7 행동 복제하기`를 누르고 월소득, 실행 가능액, 부채 비율, 비상자금과 이번 달 변화를 입력합니다.
2. 서버 내부에서 규칙 엔진과 GPT‑5.6이 안전한 행동 후보를 검토합니다.
3. 브라우저에는 `L7`, 허용된 행동 3개, `0%`만 반환합니다.
4. 사용자가 행동을 체크하면 완료율이 `33% → 67% → 100%`로 바뀝니다.
5. 이번 달 계획은 브라우저에 저장되며 월이 바뀌면 같은 세 행동의 완료 상태를 초기화합니다.

## 공개 API 계약

`POST /api/v2/plan`의 성공 응답 최상위 키는 **정확히** `nextLevel`, `actions`, `progress`입니다.

```json
{
  "nextLevel": "L7",
  "actions": [
    { "id": "review_cash_buffer", "completed": false },
    { "id": "confirm_monthly_limit", "completed": false },
    { "id": "schedule_monthly_checkin", "completed": false }
  ],
  "progress": 0
}
```

계약 불변식:

- `nextLevel`은 `"L7"`입니다.
- `actions`는 중복 없는 허용 ID를 가진 객체 3개입니다.
- 각 action의 키는 정확히 `id`, `completed`입니다. 제목과 설명은 클라이언트의 검토된 정적 카피에서 가져옵니다.
- `progress`는 완료 개수에 따라 `0`, `33`, `67`, `100`만 허용합니다.
- 성공 응답에는 `paths`, `assessment`, `model`, `source`, 금액, 기간, 점수, 추천 이유를 포함하지 않습니다.

## 서버 내부의 OpenAI 역할

경로 라이브러리, 규칙 계산, 후보 비교, GPT‑5.6 해석은 모두 서버 내부 구현입니다. GPT‑5.6은 Responses API와 Zod Structured Outputs를 통해 허용된 행동 ID를 고르는 데만 관여하며, 숫자·수익률·상품·거래·진행률을 만들거나 변경할 수 없습니다.

모델 출력은 의미 검증과 허용 목록 투영을 거쳐 공개 계획으로 변환됩니다. API 키 누락, 모델 오류, 스키마 오류가 발생해도 규칙 기반 fallback이 동일한 공개 계약을 반환하며, 사용자 화면에는 모델명이나 내부 실패 원인을 노출하지 않습니다.

- `OPENAI_MODEL` 기본값: `gpt-5.6`
- `responses.parse` + Zod Structured Outputs
- `store: false`, medium reasoning, 출력 토큰 제한
- 익명 세션 UUID를 SHA-256 해시한 `safety_identifier`
- 개인정보 형태, 금융 실행 요청, 소득 중단 조건을 모델 호출 전에 차단
- 요청 본문 8KB 제한
- 데모용 인메모리 제한: IP당 분당 20회, 세션당 분당 8회

## Windows에서 실행

요구 사항은 Node.js 24.x와 pnpm 11.x입니다. 라이브 GPT‑5.6 계획을 사용하려면 OpenAI API 키가 필요하지만, 키 없이도 fallback으로 행동 화면을 시연할 수 있습니다.

```powershell
cd C:\wealth_copy_openai_challenge
pnpm.cmd install
Copy-Item .env.example .env.local
```

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6
```

```powershell
pnpm.cmd dev
```

[http://localhost:3000](http://localhost:3000)을 엽니다. API 키는 절대 `NEXT_PUBLIC_` 변수에 넣지 마세요.

## 품질 명령

| 명령 | 용도 |
| --- | --- |
| `pnpm.cmd lint` | ESLint 검사 |
| `pnpm.cmd typecheck` | TypeScript 검사 |
| `pnpm.cmd test` | Vitest 실행 |
| `pnpm.cmd build` | 프로덕션 빌드 |
| `pnpm.cmd check` | 전체 품질 게이트 |

## 구조

```text
src/components/wealth/wealth-copy-app.tsx  L7·행동 3개·완료율 UI
src/lib/wealth/public-plan.ts               엄격한 공개 계획 스키마와 정적 행동 카피
src/lib/wealth/public-plan-storage.ts       월별 저장·검증·기존 기록 마이그레이션
src/app/api/v2/plan/route.ts                공개 계획 API와 서버 내부 투영
src/lib/wealth/engine.ts                    내부 경로·수치 규칙
src/lib/wealth/server/planner-core.ts       내부 신호·안전 게이트·fallback
src/lib/wealth/server/planner.ts            서버 전용 계획 모듈 경계
src/lib/openai.ts                           서버 전용 OpenAI 설정
```

## 브라우저 저장

`wealthcopy-public-plan-v2`에는 버전, 월 키와 공개 계획만 저장합니다. 입력 프로필, 내부 경로, 모델 응답은 저장하지 않습니다. 이전 `wealthcopy-demo-plan-v1` 기록은 안전한 세 행동 상태로 마이그레이션한 뒤 제거합니다. 공용 기기에서는 `기록 지우고 새로 시작`을 사용하세요.

## 금융 안전 경계

WealthCopy는 교육용 행동 기록 화면입니다. 투자·세무·법률·신용·보험 자문이 아니며 상품 추천, 수익 보장, 계좌 연결, 자동이체, 주문, 매매, 리밸런싱을 제공하지 않습니다. 행동 체크는 실제 금융 실행이 아니며 모든 의사결정은 사용자가 합니다.

현재 rate limit은 단일 프로세스용 데모 보호입니다. 공개 출시 전에는 인증 기반 분산 rate limiting, 모니터링, 접근성 점검, 명시적 동의·삭제 UX, 개인정보·보존 정책과 금융 도메인 법률 검토가 필요합니다.

## Build Week

제출 준비는 `docs/BUILD_WEEK.md`, 결정은 `docs/DECISIONS.md`, 녹화는 `docs/DEMO_SCRIPT.md`에서 관리합니다.

- [GPT‑5.6 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Build Week](https://openai.com/build-week/)
