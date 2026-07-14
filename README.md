# WealthCopy — 다음 자산 단계, 이번 달 행동 세 개

WealthCopy는 자산관리를 분석 문제가 아니라 **행동 문제**로 다루는 OpenAI Build Week MVP입니다. 사용자는 복잡한 경로 비교 대신 다음 자산 단계 `L7`, 정확히 세 개의 이번 달 행동, 행동 완료율만 봅니다.

## 사용자 경험

메인 화면의 정보 계약은 세 가지뿐입니다.

1. 다음 자산 단계: `L7`
2. 이번 달 행동: 정확히 3개
3. 행동 완료율: `0%`, `33%`, `67%`, `100%` 중 하나

진행률은 완료한 행동 수를 뜻하며 자산 변화, 수익률, 목표 도달률을 의미하지 않습니다. 상품, 기간, 금액, 추천 이유, 모델명, 경로 비교 결과는 메인 화면에 표시하지 않습니다.

사용 흐름:

1. `L7 행동 복제하기`를 누르고 소득 대비 실행 비율, 선택형 자산 위치 참고 구간, 월 부채상환 비율을 입력합니다. 구조화 입력에서는 원화나 달러 금액을 수집하지 않습니다.
2. 서버 내부에서 통화 중립 규칙 엔진과 GPT‑5.6이 안전한 행동 후보를 검토합니다.
3. 브라우저에는 `L7`, 허용된 행동 3개, `0%`만 반환합니다.
4. 사용자가 행동을 체크하면 완료율이 `33% → 67% → 100%`로 바뀝니다.
5. 행동을 다시 복제하면 겹치는 행동의 완료 상태를 유지하고, 월이 바뀌면 같은 세 행동을 이어받되 완료 상태만 초기화합니다.

## PSID 개념형 참고 원칙

자산 위치는 미시간대학교의 Panel Study of Income Dynamics(PSID)가 공개한 **2019년 미국 가족 순자산 가중 집계치**의 `25·50·75·90백분위` 경계 구조를 참고합니다. 사용자가 가장 가까운 개념형 구간을 직접 선택하며, 서비스가 개인 자산을 PSID 분포와 대조하거나 실제 백분위를 계산하지 않습니다. 원자료의 미국 달러 임계값도 원화로 환산하지 않습니다.

- 이것은 한국 인구의 실제 자산 순위나 개인의 공식 백분위가 아닙니다.
- `L7`은 Build Week 데모에서 고정한 목표 단계이며 PSID로 계산하거나 검증한 등급이 아닙니다.
- 투자수익률, 미래 자산가치, L7 도달 가능성을 예측하지 않습니다.
- 이 구현은 공개 보고서의 집계표만 참조합니다. 등록과 이용조건 동의가 필요한 Public Use 마이크로데이터와 별도 계약 대상인 Restricted Data는 모두 접근·다운로드·사용하지 않습니다.
- 선택한 비율과 구간은 계획 요청 중에만 사용하며 브라우저 저장소와 성공 응답에 남기지 않습니다.

`psid-wealth-reference-v1`은 공개 집계표의 출처와 통화 중립 구간 투영만 담당합니다. `behavior-policy-v1`은 소득 대비 실행 여력과 부채 부담으로 내부 실행 속도와 행동 우선순위를 정합니다. 자산 위치 구간은 실행 속도나 공격성을 높이는 점수로 사용하지 않으며, 하위 구간을 직접 선택했을 때 현금 여유 확인을 빠뜨리지 않는 안전 신호로만 사용합니다.

출처: [PSID 데이터 비교 페이지](https://psidonline.isr.umich.edu/Guide/Quality/DataComparisons.aspx), [PSID/미국 가구조사 비교 기술 보고서](https://psidonline.isr.umich.edu/Publications/Papers/tsp/2021-02_Overview_PSID_Other_US_HH.pdf), [PSID 시작 안내와 데이터 이용조건](https://psidonline.isr.umich.edu/GettingStarted.aspx)

## 공개 API 계약

요청 프로필은 통화 금액 대신 다음 세 정규화 필드만 받습니다.

```json
{
  "profile": {
    "incomeExecutionRatio": 48,
    "assetPercentileBand": "p50_74",
    "debtServiceRatio": 18
  },
  "constraintNote": "이사 계획이 있어 현금 여유를 유지하고 싶어요.",
  "sessionId": "123e4567-e89b-42d3-a456-426614174000"
}
```

`incomeExecutionRatio`는 월소득 중 저축·상환에 배정할 비중, `debtServiceRatio`는 월 부채 상환액을 월소득으로 나눈 비율이며 둘 다 `0–100` 범위입니다. 부채 상환은 실행 비율에 포함되므로 `debtServiceRatio <= incomeExecutionRatio`여야 합니다. `assetPercentileBand`는 `below_25`, `p25_49`, `p50_74`, `p75_89`, `p90_plus`, `unknown` 중 하나입니다. 선택 메모는 최대 500자이며 일반적인 원화·달러 금액 형식과 개인정보 형태를 거절하고, `sessionId`는 UUID여야 합니다. 요청 객체와 중첩 객체는 strict 스키마이므로 정의되지 않은 필드는 거절합니다.

금액 문자열 차단은 사용 실수를 줄이는 보조 장치이며 모든 자연어 금액 표현을 탐지하는 보안 경계로 간주하지 않습니다. 원문 메모는 모델로 보내지 않고 서버에서 허용된 상황 신호로만 축약합니다.

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

경로 라이브러리, PSID 참고 구간 투영, 규칙 계산, 후보 비교, GPT‑5.6 해석은 모두 서버 내부 구현입니다. 규칙 계층은 선택 메모를 허용된 상황 신호로 줄이고, 내부 경로의 행동 우선순위와 필수 안전 행동을 정합니다. GPT‑5.6은 Responses API와 Zod Structured Outputs를 통해 승인된 ID 중 이번 달 행동 후보만 고르며, 규칙 계층이 필수 행동과 마지막 월말 점검을 보존합니다. 모델에는 원문 메모, 원화·달러 금액, PSID 원 임계값이 전달되지 않으며 숫자·수익률·상품·거래·진행률을 만들거나 변경할 수도 없습니다.

## 경쟁력

- **비교보다 복제:** 사용자는 경로의 근거를 해석하지 않고 이번 달 행동 세 개를 바로 실행합니다.
- **거짓 정밀도 차단:** 국가와 통화가 달라도 비율·선택형 위치 구간·부채 부담만 사용하고 금액 환산과 수익 예측을 하지 않습니다.
- **월간 연결성:** 다시 생성한 계획은 겹치는 행동의 완료 상태를 이어받고, 새 달에는 같은 행동을 미완료 상태로 복제합니다.
- **AI 경계:** 모델은 허용된 행동 ID만 제안하고 공개 API와 브라우저에는 L7·세 행동·완료율만 남습니다.

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
src/lib/wealth/normalized-profile.ts        통화 중립 비율·PSID 구간 입력 스키마
src/lib/wealth/public-plan.ts               엄격한 공개 계획 스키마와 정적 행동 카피
src/lib/wealth/public-plan-storage.ts       월별 저장·검증·기존 기록 마이그레이션
src/app/api/v2/plan/route.ts                공개 계획 API와 서버 내부 투영
src/lib/wealth/engine.ts                    통화 중립 내부 후보 규칙
src/lib/wealth/path-library.ts              버전형 행동 경로·점수·행동 우선순위
src/lib/wealth/server/planner-core.ts       내부 신호·안전 게이트·fallback
src/lib/wealth/server/psid-reference.ts     공개 PSID 집계표 출처와 서버 전용 투영
src/lib/wealth/server/planner.ts            서버 전용 계획 모듈 경계
src/lib/openai.ts                           서버 전용 OpenAI 설정
```

## 브라우저 저장

`wealthcopy-public-plan-v2`에는 버전, 월 키와 공개 계획만 저장합니다. 입력 프로필은 같은 탭에서 행동을 다시 복제할 때만 메모리에 잠시 유지하며, 내부 경로와 모델 응답을 포함해 브라우저 저장소에는 남기지 않습니다. 이전 `wealthcopy-demo-plan-v1` 기록은 안전한 세 행동 상태로 마이그레이션한 뒤 제거합니다. 공용 기기에서는 `이번 달 기록 지우기`를 사용하세요.

## 금융 안전 경계

WealthCopy는 교육용 행동 기록 화면입니다. 투자·세무·법률·신용·보험 자문이 아니며 상품 추천, 수익 보장, 계좌 연결, 자동이체, 주문, 매매, 리밸런싱을 제공하지 않습니다. 행동 체크는 실제 금융 실행이 아니며 모든 의사결정은 사용자가 합니다.

현재 rate limit은 단일 프로세스용 데모 보호입니다. 공개 출시 전에는 인증 기반 분산 rate limiting, 모니터링, 접근성 점검, 명시적 동의·삭제 UX, 개인정보·보존 정책과 금융 도메인 법률 검토가 필요합니다.

## Build Week

제출 준비는 `docs/BUILD_WEEK.md`, 결정은 `docs/DECISIONS.md`, 녹화는 `docs/DEMO_SCRIPT.md`에서 관리합니다.

- [GPT‑5.6 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Build Week](https://openai.com/build-week/)
