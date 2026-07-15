# WealthCopy — 다음 자산 단계, 이번 달 행동 세 개

WealthCopy는 자산관리를 분석 문제가 아니라 **행동 문제**로 다루는 OpenAI Build Week MVP입니다. 사용자가 입력한 가구 총자산과 총부채로 현재 순자산 레벨을 내부 분류하고, 메인 화면에는 다음 단계, 정확히 세 개의 이번 달 행동, 행동 완료율만 남깁니다.

## 사용자 경험

메인 화면의 정보 계약은 세 가지뿐입니다.

1. 다음 자산 단계: `L2`부터 `L15` 중 현재 순자산 구간에서 이어지는 한 단계
2. 이번 달 행동: 정확히 3개
3. 행동 완료율: `0%`, `33%`, `67%`, `100%` 중 하나

진행률은 완료한 행동 수만 뜻합니다. 자산 변화, 수익률, 단계 도달률 또는 승급 가능성을 의미하지 않습니다. `3/3 · 100%`가 되어도 레벨은 자동으로 올라가지 않으며, 새 달에는 최신 가구 자산정보로 다시 분류해야 합니다. `L15`는 더 높은 단계가 없는 유지 단계로 `L15 → L15` 점검 행동을 제공합니다.

상품, 금액, 기간, 추천 이유, 모델명, 경로 비교 결과는 메인 화면에 표시하지 않습니다.

사용 흐름:

1. `다음 단계 행동 만들기`를 누르고 가구 총자산, 가구 총부채, 소득 대비 실행 비율, 월 부채상환 비율을 입력합니다. PSID 참고 구간은 선택 입력이며 모르면 건너뛸 수 있습니다.
2. 서버는 `가구 순자산 = 가구 총자산 - 가구 총부채`로 현재 레벨을 분류하고 다음 한 단계를 정합니다.
3. 단계별 전환 앵커와 안전 제약을 먼저 적용하고, GPT‑5.6은 허용된 동반 행동 ID만 선택합니다. 세 번째 행동은 항상 월말 점검입니다.
4. 성공 JSON 본문에는 `nextLevel`, 행동 3개, `0%`만 반환합니다. UI가 결과를 현재 분류와 결속할 수 있도록 응답 헤더 `X-WealthCopy-Source-Level`에 서버가 계산한 출발 레벨을 함께 보내며, 응답 전체는 `Cache-Control: no-store`입니다. 정확한 자산·부채 금액은 반환하거나 저장하지 않습니다.
5. 사용자가 행동을 체크하면 완료율이 `33% → 67% → 100%`로 바뀝니다.
6. 월말 점검 행동에서는 금융정보가 없는 `.ics` 파일을 받아 캘린더에 연결할 수 있습니다.
7. 새 달에는 과거 행동 완료 여부와 무관하게 최신 자산 스냅샷을 다시 입력해 레벨을 재분류합니다.

## L1–L15 순자산 자동분류

분류 정책 버전은 `krw-net-worth-v1`입니다. 가구 총자산과 총부채는 0 이상의 원화 정수로 처리하며, 순자산이 음수일 수 있습니다. 모든 구간은 하한을 포함하고 상한을 포함하지 않습니다.

| 현재 레벨 | 가구 순자산 구간 | 다음 단계 |
| --- | ---: | --- |
| `L1` | 0원 미만 | `L2` |
| `L2` | 0원 이상 1천만원 미만 | `L3` |
| `L3` | 1천만원 이상 3천만원 미만 | `L4` |
| `L4` | 3천만원 이상 1억원 미만 | `L5` |
| `L5` | 1억원 이상 3억원 미만 | `L6` |
| `L6` | 3억원 이상 5억원 미만 | `L7` |
| `L7` | 5억원 이상 10억원 미만 | `L8` |
| `L8` | 10억원 이상 30억원 미만 | `L9` |
| `L9` | 30억원 이상 50억원 미만 | `L10` |
| `L10` | 50억원 이상 100억원 미만 | `L11` |
| `L11` | 100억원 이상 300억원 미만 | `L12` |
| `L12` | 300억원 이상 1,000억원 미만 | `L13` |
| `L13` | 1,000억원 이상 3,000억원 미만 | `L14` |
| `L14` | 3,000억원 이상 1조원 미만 | `L15` |
| `L15` | 1조원 이상 | `L15` 유지 |

경계값은 다음 레벨에 포함됩니다. 예를 들어 순자산이 정확히 1천만원이면 `L3`, 정확히 1조원이면 `L15`입니다.

이 레벨은 WealthCopy가 행동을 구성하기 위해 정의한 제품 내부 구간입니다. 공식 자산등급, 한국 인구 백분위, 신용등급 또는 투자 판단 기준이 아닙니다. 행동 완료만으로 다음 순자산 구간에 도달한다고 주장하지 않습니다.

## PSID 선택 참고값

PSID 참고 구간은 미시간대학교 Panel Study of Income Dynamics가 공개한 **2019년 미국 가족 순자산 가중 집계치**의 `25·50·75·90백분위` 경계 구조를 개념적으로 참고합니다. 사용자가 선택할 수 있지만 `unknown`으로 건너뛰어도 됩니다.

- PSID 참고 구간은 `krw-net-worth-v1`의 L1–L15 분류에 사용하지 않습니다.
- 개인 자산을 PSID 원자료와 대조하거나 실제 백분위를 계산하지 않습니다.
- PSID 달러 경계값을 원화로 환산하지 않습니다.
- 한국 인구의 실제 자산 순위나 공식 백분위로 표현하지 않습니다.
- 투자수익률, 미래 자산가치 또는 다음 단계 도달 가능성을 예측하지 않습니다.
- 등록과 이용조건 동의가 필요한 Public Use 마이크로데이터, 별도 계약 대상 Restricted Data와 개별 가족 기록은 사용하지 않습니다.

`psid-wealth-reference-v1`은 공개 집계표의 출처와 선택형 구간 투영만 담당합니다. `krw-net-worth-v1`은 원화 순자산 레벨, `behavior-policy-v1`은 소득 대비 실행 비율과 부채 부담에 따른 내부 행동 우선순위를 담당하며 세 정책은 서로 분리합니다.

출처: [PSID 데이터 비교 페이지](https://psidonline.isr.umich.edu/Guide/Quality/DataComparisons.aspx), [PSID/미국 가구조사 비교 기술 보고서](https://psidonline.isr.umich.edu/Publications/Papers/tsp/2021-02_Overview_PSID_Other_US_HH.pdf), [PSID 시작 안내와 데이터 이용조건](https://psidonline.isr.umich.edu/GettingStarted.aspx)

## 공개 API 계약

`POST /api/v2/plan` 요청은 가구 총자산·총부채와 통화 중립 비율을 받습니다. `assetPercentileBand`는 생략할 수 있으며 기본값은 `unknown`입니다.

```json
{
  "profile": {
    "totalAssetsKrw": 350000000,
    "totalDebtKrw": 50000000,
    "incomeExecutionRatio": 35,
    "assetPercentileBand": "unknown",
    "debtServiceRatio": 15
  },
  "constraintNote": "",
  "sessionId": "123e4567-e89b-42d3-a456-426614174000"
}
```

이 예시의 순자산은 3억원이므로 현재 레벨은 `L6`, 다음 단계는 `L7`입니다. 총자산과 총부채는 각각 0 이상의 안전한 원화 정수여야 합니다. `incomeExecutionRatio`와 `debtServiceRatio`는 `0–100` 범위이며, 부채상환 비율은 저축·상환 전체 실행 비율을 초과할 수 없습니다.

선택 메모는 최대 500자입니다. 메모 안의 일반적인 원화·달러 금액과 개인정보 형태는 거절하며, 원문 메모는 모델로 보내지 않고 허용된 상황 신호로만 축약합니다. 요청 객체와 중첩 객체는 strict 스키마이므로 정의되지 않은 필드를 거절합니다.

성공 JSON 본문 최상위 키는 **정확히** `nextLevel`, `actions`, `progress`입니다.

```json
{
  "nextLevel": "L7",
  "actions": [
    { "id": "review_long_term_structure", "completed": false },
    { "id": "confirm_monthly_limit", "completed": false },
    { "id": "schedule_monthly_checkin", "completed": false }
  ],
  "progress": 0
}
```

계약 불변식:

- 서버가 분류한 현재 레벨은 JSON 필드가 아니라 `X-WealthCopy-Source-Level` 응답 헤더로만 전달하며, 클라이언트는 이 값과 `nextLevel`의 연속성을 검증합니다.
- `nextLevel`은 분류된 현재 레벨에서 바로 이어지는 단계이며 `L15`에서는 `L15` 유지입니다.
- `actions`는 중복 없는 허용 ID를 가진 객체 3개입니다.
- 각 action의 키는 정확히 `id`, `completed`입니다.
- 세 번째 행동은 항상 `schedule_monthly_checkin`입니다.
- `progress`는 완료 개수에 따라 `0`, `33`, `67`, `100`만 허용합니다.
- 성공 JSON 본문에는 현재 레벨, 자산·부채 금액, PSID 값, 내부 경로, 모델, 출처, 기간, 점수, 추천 이유가 포함되지 않습니다.

## 개인정보와 저장 경계

정확한 총자산·총부채는 요청에서 현재 레벨을 계산할 때만 사용합니다.

- OpenAI 모델 입력에 포함하지 않습니다.
- 성공 응답과 오류 로그에 포함하지 않습니다.
- 브라우저 localStorage와 `.ics` 일정 파일에 포함하지 않습니다.
- API 응답에는 `Cache-Control: no-store`를 적용합니다.
- 모델 호출은 `store: false`를 사용합니다.

브라우저 저장 키는 `wealthcopy-public-plan-v4`입니다. 저장 레코드는 정확히 `{version, monthKey, sourceLevel, plan}`이며, v4 스키마의 의미를 `krw-net-worth-v1` 자동분류에 고정합니다. 정확한 금액·입력 비율·PSID 참고 구간·메모·내부 경로·모델 출력은 저장하지 않습니다. 계산된 레벨과 행동 완료 기록은 기기에 남으므로 공용 기기에서는 `이번 달 기록 지우기`를 사용해야 합니다.

익명 session UUID는 rate limit과 해시된 `safety_identifier` 생성에 쓰이며 `wealthcopy-anonymous-session`이라는 별도 localStorage 키에 보관합니다. 이 값은 v4 계획 레코드의 일부가 아니고 자산정보를 포함하지 않습니다.

`wealthcopy-public-plan-v3`, `wealthcopy-public-plan-v2`, `wealthcopy-demo-plan-v1`은 의미가 다른 과거 분류이므로 새 레벨로 변환하지 않고 제거합니다. 매월 최신 자산 스냅샷을 다시 입력해야 하며 과거 `nextLevel`이나 `3/3` 완료를 현재 레벨로 승계하지 않습니다.

## 서버 내부의 OpenAI 역할

원화 레벨 분류, 단계별 전환 앵커, 안전 제약과 규칙 fallback은 서버가 결정합니다. GPT‑5.6은 다음 데이터만 받습니다.

- 검토된 허용 행동 ID
- 소득 대비 실행 비율의 내부 밴드
- 부채 부담의 내부 밴드
- 선택한 PSID 참고 구간의 통화 중립 신호
- 원문을 제거한 허용 상황 신호

모델에는 총자산·총부채, 순자산, 현재·다음 레벨, 원문 메모, PSID 달러 경계값을 전달하지 않습니다. GPT‑5.6은 사용자용 카피, 숫자, 수익률, 상품, 거래, 진행률을 만들 수 없습니다. API 키 누락, 모델 오류 또는 스키마 오류가 발생하면 규칙 기반 fallback이 같은 공개 계약을 반환합니다.

- `OPENAI_MODEL` 기본값: `gpt-5.6`
- Responses API의 Structured Outputs와 strict Zod 검증
- `store: false`, medium reasoning, 출력 토큰 제한
- 익명 세션 UUID를 SHA-256 해시한 `safety_identifier`
- 요청 본문 8KB 제한
- 데모용 인메모리 제한: IP당 분당 20회, 세션당 분당 8회

## 경쟁력

- **분류는 내부에서, 행동은 앞에서:** 복잡한 순자산 구간과 규칙은 숨기고 다음 행동 세 개만 보여 줍니다.
- **전 구간 연결:** 음의 순자산인 L1부터 1조원 이상 L15 유지까지 단계별 검토 행동이 있습니다.
- **거짓 성과 차단:** 행동 완료와 자산 상승을 분리하고 금액·수익률·도달 기간을 공개 계획에 넣지 않습니다.
- **월간 실행 연결:** 마지막 행동을 월말 점검으로 고정하고 개인정보 없는 캘린더 파일을 제공합니다.
- **AI 경계:** GPT‑5.6은 승인된 행동 ID만 선택하며 정확한 금융 금액은 보지 않습니다.

## Windows에서 실행

요구 사항은 Node.js 24.x와 pnpm 11.x입니다. OpenAI API 키 없이도 규칙 fallback으로 실행할 수 있습니다.

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

## GCP 배포

Build Week 공개 서비스는 서울 리전의 Google Cloud Run에서 실행합니다.

- URL: [https://wealth-copy-470320899177.asia-northeast3.run.app](https://wealth-copy-470320899177.asia-northeast3.run.app)
- GCP 프로젝트: `abis-web-platform`
- Cloud Run 서비스: `wealth-copy`
- 런타임: Node.js 24 standalone, `0.0.0.0:8080`, 비루트 사용자
- 서비스 계정: `wealth-copy-run@abis-web-platform.iam.gserviceaccount.com`
- OpenAI 키: Secret Manager의 `wealth-copy-openai-api-key`에서 런타임에만 주입
- 확장 제한: 최소 0, 최대 3 인스턴스, 인스턴스당 동시 요청 20

`gcloud run deploy --source .`가 저장소의 `Dockerfile`을 Cloud Build에서 빌드합니다. `.gcloudignore`와 `.dockerignore`는 `.env.local`, `기획서/`, 로컬 의존성과 빌드 산출물을 업로드하지 않습니다. 재배포·시크릿 교체·검증 명령은 `docs/GCP_DEPLOYMENT.md`에 기록했습니다.

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
src/components/wealth/wealth-copy-app.tsx       순자산 입력·다음 단계·세 행동·완료율 UI
src/lib/wealth/asset-level.ts                    L1–L15 순서와 다음 단계 규칙
src/lib/wealth/server/asset-level-policy.ts      krw-net-worth-v1 자동분류 정책
src/lib/wealth/level-transitions.ts              레벨별 전환 앵커와 허용 행동
src/lib/wealth/normalized-profile.ts             수집 프로필과 통화 중립 모델 프로필 분리
src/lib/wealth/public-plan.ts                    엄격한 공개 계획과 정적 행동 카피
src/lib/wealth/public-plan-storage.ts            v4 월별 저장·검증·과거 버전 폐기
src/lib/wealth/monthly-checkin-calendar.ts       금융정보 없는 월말 점검 ICS
src/app/api/v2/plan/route.ts                     no-store 공개 계획 API
src/lib/wealth/path-library.ts                   behavior-policy-v1 경로와 우선순위
src/lib/wealth/server/planner-core.ts            분류·안전 게이트·모델 경계·fallback
src/lib/wealth/server/psid-reference.ts          psid-wealth-reference-v1 공개 집계 출처
src/lib/openai.ts                                서버 전용 OpenAI 설정
Dockerfile                                       Cloud Run용 Node 24 standalone 이미지
.dockerignore / .gcloudignore                    비밀·로컬 파일 빌드/업로드 제외
docs/GCP_DEPLOYMENT.md                           GCP 리소스·재배포·검증·롤백 절차
```

## 금융 안전 경계

WealthCopy는 교육용 행동 기록 화면입니다. 투자·세무·법률·신용·보험 자문이 아니며 상품 추천, 수익 보장, 계좌 연결, 자동이체, 주문, 매매 또는 리밸런싱을 제공하지 않습니다. 행동 체크는 실제 금융 실행이 아니며 모든 의사결정은 사용자가 합니다.

현재 rate limit은 단일 프로세스용 데모 보호입니다. 공개 출시 전에는 인증 기반 분산 rate limiting, 모니터링, 접근성 점검, 명시적 동의·삭제 UX, 개인정보·보존 정책과 금융 도메인 법률 검토가 필요합니다.

## Build Week

제출 준비는 `docs/BUILD_WEEK.md`, 결정은 `docs/DECISIONS.md`, 녹화는 `docs/DEMO_SCRIPT.md`에서 관리합니다.

- [GPT‑5.6 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Build Week](https://openai.com/build-week/)
