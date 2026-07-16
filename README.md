# WealthCopy — 다음 자산 단계, 이번 달 행동 세 개

WealthCopy는 자산관리를 분석 문제가 아니라 **행동 문제**로 다루는 OpenAI Build Week MVP입니다. 사용자가 수동으로 입력한 최신 가구 스냅샷으로 현재 순자산 레벨을 내부 분류하고, 메인 화면에는 다음 단계, 정확히 세 개의 이번 달 행동, 행동 완료율만 남깁니다.

현재 버전은 계좌 연결이나 마이데이터 연동이 아닙니다. 상품명·계좌번호 없이 사용자가 직접 입력한 가구 단위 추정값과 구조 신호만 사용합니다.

## 사용자 경험

메인 화면의 정보 계약은 세 가지뿐입니다.

1. 다음 자산 단계: 현재 순자산 구간에서 이어지는 한 단계
2. 이번 달 행동: 정확히 3개
3. 행동 완료율: `0%`, `33%`, `67%`, `100%` 중 하나

진행률은 완료한 행동 수만 뜻합니다. 자산 변화, 수익률, 단계 도달률 또는 승급 가능성을 의미하지 않습니다. `3/3 · 100%`가 되어도 레벨은 자동으로 올라가지 않으며, 새 달에는 최신 가구 자산정보로 다시 분류해야 합니다. `L15`는 더 높은 단계가 없는 유지 단계로 `L15 → L15` 운영 행동을 제공합니다.

상품, 금액, 기간, 추천 이유, 모델명과 내부 경로 비교 결과는 메인 화면에 표시하지 않습니다. 대신 각 행동 안에서 실제 실행에 필요한 `남는 결과`, 이진적인 `완료 기준`, 정확히 세 단계의 `실행 순서`를 펼쳐 볼 수 있고, 이를 텍스트 체크리스트로 복사할 수 있습니다.

## 3단계 수동 스냅샷

입력은 다음 세 단계로 나뉩니다.

1. **가구 자산:** 가구 총자산과 총부채의 현재 추정 합계
2. **자산 구조:** 가장 큰 자산 범주, 그 범주의 대략적 비중, 바로 쓸 수 있는 생활비 여유 개월 수
3. **실행 여건:** 월소득 중 저축·상환 비율, 부채상환 비율, 소득 안정성, 부채 점검 신호, 향후 90일의 큰 변화, 선택형 PSID 참고 구간과 금액 없는 상황 메모

구조와 실행 여건은 모두 사용자의 자가 추정 구간입니다. 행동이 막연해지지 않도록 가장 큰 자산 범주·쏠림·현금 여유·소득 안정성·부채 신호·90일 변화는 가장 가까운 구간을 직접 선택해야 합니다. PSID 참고 구간과 상황 메모는 선택이며, 어떤 입력도 상품이나 거래를 추천하는 데 쓰지 않습니다.

서버는 정확한 총자산·총부채로 순자산 레벨을 분류하고 부채/자산 관계를 거친 레버리지 밴드로 축약합니다. 저축·상환 비율도 거친 실행 여력 밴드로 축약합니다. 정확한 금액과 원 비율은 OpenAI 모델, 성공 JSON, 브라우저 저장소 또는 로그로 보내지 않습니다.

## 행동 정책 v2

`behavior-policy-v2`는 속도나 기대수익이 아니라 **이번 달의 병목 목적**을 고릅니다. 내부 후보는 다음 여덟 경로입니다.

- `cash_defense`: 필수 생활 현금 보호
- `debt_control`: 납부·만기 사각지대 제거
- `income_resilience`: 소득 변화에 맞춘 실행 규모 조정
- `core_building`: 완성된 현황표를 반복 가능한 기본 루틴으로 전환
- `concentration_control`: 한 자산 범주의 과도한 쏠림 점검
- `liquidity_planning`: 잠긴 자산·가까운 일정과 사용 가능한 현금 연결
- `operating_system`: 복잡한 자산을 하나의 운영 기록으로 통합
- `continuity`: 사람이나 역할이 바뀌어도 결정과 접근이 이어지게 정리

이 내부 경로는 사용자에게 선택이나 비교 부담으로 노출하지 않으며 예측, 위험성향, 수익 목표 또는 도달 속도를 뜻하지 않습니다.

공개 행동 세 개는 항상 다음 순서입니다.

1. **기반 보호:** 현재 병목이나 안전 신호를 먼저 정리하는 `supportActionId`
2. **다음 단계:** 출발 레벨에 고정된 전환 앵커
3. **결과 확인:** 해당 전환에 고정된 증거 행동

서버의 hard stop이 켜지면 기반 보호 행동을 규칙으로 고정하고 모델을 건너뜁니다. 그 외에는 모델이 검토된 안전 후보 중 **하나의 `supportActionId`만** 선택합니다. 전환 앵커, 증거 행동, 사용자 카피, 완료 기준과 실행 순서는 서버의 검토된 정적 정책이며 모델이 만들거나 바꿀 수 없습니다.

## 반복 사용 루프

첫 달에 만든 규칙을 매달 다시 만들게 하지 않습니다. 같은 출발 레벨에서 이전 달 완료 이력이 있으면 서버는 다음처럼 행동을 회전합니다.

- 기반 보호 후보는 최근에 하지 않은 행동을 먼저 고르고, 모두 했다면 최근 조건 변화만 다시 확인합니다.
- 단계 전환 규칙을 이미 만들었다면 L1–L4는 현금흐름, L5–L8은 자산구조, L9–L12는 자산 원칙, L13–L15는 거버넌스의 **이번 달 실제 운영 행동**으로 바뀝니다.
- 결과 확인은 아직 하지 않은 항목을 먼저, 그 다음에는 가장 오래전에 확인한 항목부터 다시 점검합니다.
- 현금 부족·높은 부채 부담 같은 hard stop은 과거에 완료했더라도 현재 위험이 남아 있으면 반복됩니다.

이 기능은 금액이나 금융 프로필을 저장하지 않습니다. 브라우저에는 정책 버전과 최대 36개의 `행동 ID·출발 레벨·완료 월`만 별도 보관하고, 서버에는 현재 달을 제외한 최소 완료 신호만 보냅니다. 완료 이력은 OpenAI 모델 입력, 공개 계획 응답과 로그에 포함하지 않습니다.

## L1–L15 순자산 자동분류

분류 정책 버전은 `krw-net-worth-v1`입니다. 가구 총자산과 총부채는 0 이상의 원화 정수로 처리하며, 순자산은 음수일 수 있습니다. 모든 구간은 하한을 포함하고 상한을 포함하지 않습니다.

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

이 레벨은 WealthCopy가 행동을 구성하기 위한 제품 내부 구간입니다. 공식 자산등급, 한국 인구 백분위, 신용등급 또는 투자 판단 기준이 아닙니다. 행동 완료만으로 다음 순자산 구간에 도달한다고 주장하지 않습니다.

## PSID 선택 참고값

`psid-wealth-reference-v2`는 미시간대학교 Panel Study of Income Dynamics가 공개한 **2019년 미국 가족 순자산 집계표**의 출처를 감사 가능하게 고정합니다. 기준은 보고서 `Table 4`, `PSID 2019` 열이며, 사용자 화면에서는 `25·50·75·90백분위` 경계 구조만 선택형 참고로 제공합니다.

- 미국 가족 집계치이며 한국 가구 자산 순위가 아닙니다.
- 개인 자산을 PSID 원자료와 대조하거나 실제 백분위를 계산하지 않습니다.
- 달러 경계값을 원화로 환산하지 않습니다.
- **L1–L15 분류, 내부 경로, 공개 행동, 모델 입력에 모두 사용하지 않습니다.**
- 투자수익률, 미래 자산가치 또는 다음 단계 도달 가능성을 예측하지 않습니다.
- Public Use 마이크로데이터, Restricted Data와 개별 가족 기록은 사용하지 않습니다.

`psid-wealth-reference-v2`, `krw-net-worth-v1`, `behavior-policy-v2`는 각각 참고 출처, 원화 순자산 구간, 행동 구성이라는 서로 다른 책임을 가집니다.

출처: [PSID 데이터 비교 페이지](https://psidonline.isr.umich.edu/Guide/Quality/DataComparisons.aspx), [PSID/미국 가구조사 비교 기술 보고서](https://psidonline.isr.umich.edu/Publications/Papers/tsp/2021-02_Overview_PSID_Other_US_HH.pdf), [PSID 시작 안내와 데이터 이용조건](https://psidonline.isr.umich.edu/GettingStarted.aspx)

## 공개 API 계약

`POST /api/v2/plan`은 세 단계 수동 스냅샷을 한 번에 받습니다. 다음은 순자산 3억원으로 `L6 → L7`이 되는 예시입니다.

```json
{
  "profile": {
    "totalAssetsKrw": 350000000,
    "totalDebtKrw": 50000000,
    "incomeExecutionRatio": 35,
    "assetPercentileBand": "unknown",
    "debtServiceRatio": 15,
    "cashRunwayBand": "three_to_six",
    "incomeStability": "unknown",
    "largestAssetGroup": "mixed",
    "concentrationBand": "p30_50",
    "debtRisk": "none",
    "next90DayEvent": "none"
  },
  "constraintNote": "",
  "recentCompletions": [],
  "sessionId": "123e4567-e89b-42d3-a456-426614174000"
}
```

총자산과 총부채는 각각 0 이상의 안전한 원화 정수여야 합니다. 두 비율은 `0–100` 범위이며, 부채상환 비율은 저축·상환 전체 실행 비율을 초과할 수 없습니다. 선택 메모는 최대 500자이고 개인정보 형태와 금액 표현을 거절합니다. 원문 메모는 모델로 보내지 않고 허용된 상황 신호로만 축약합니다. 요청 객체와 중첩 객체는 strict 스키마이므로 정의되지 않은 필드를 거절합니다.

성공 JSON 본문의 최상위 키는 **정확히** `nextLevel`, `actions`, `progress`입니다. 다음은 허용되는 v2 행동 ID로 만든 한 예입니다.

```json
{
  "nextLevel": "L7",
  "actions": [
    { "id": "complete_asset_snapshot", "completed": false },
    { "id": "set_leverage_guardrail", "completed": false },
    { "id": "verify_payment_coverage", "completed": false }
  ],
  "progress": 0
}
```

계약 불변식:

- 서버가 분류한 현재 레벨은 JSON 필드가 아니라 `X-WealthCopy-Source-Level` 응답 헤더로만 전달합니다.
- `nextLevel`은 분류된 현재 레벨에서 바로 이어지는 단계이며 `L15`에서는 `L15` 유지입니다.
- `actions`는 중복 없는 허용 ID를 가진 객체 3개이고 각 객체의 키는 정확히 `id`, `completed`입니다.
- 행동 순서는 `protect → advance → verify`이며 특정 월말 행동으로 고정하지 않습니다.
- `progress`는 완료 개수에 따라 `0`, `33`, `67`, `100`만 허용합니다.
- 성공 JSON에는 현재 레벨, 자산·부채 금액, 입력 비율, PSID 값, 내부 경로, 모델, 출처, 기간, 점수와 추천 이유가 포함되지 않습니다.
- 모든 응답은 `Cache-Control: no-store`입니다.

## 개인정보와 저장 경계

정확한 총자산·총부채는 요청 시 서버의 레벨 분류와 거친 레버리지 밴드 생성에만 사용합니다.

- OpenAI 모델 입력에 정확한 금액과 원 비율을 포함하지 않습니다.
- 성공 응답, 브라우저 저장소, 분석 이벤트와 애플리케이션 로그에 정확한 금액을 포함하지 않습니다.
- 모델 호출은 `store: false`를 사용합니다.
- 사용자에게 계좌번호, 상품명, 비밀번호, 인증수단 또는 상세 거래를 요구하지 않습니다.

브라우저 계획 저장 키는 `wealthcopy-public-plan-v5`입니다. 저장 레코드는 정확히 `{version, monthKey, sourceLevel, plan}`이고 `version`은 `5`입니다. 반복 방지를 위한 별도 `wealthcopy-action-history-v1`에는 `policyVersion`과 최대 36개의 `{actionId, sourceLevel, completedMonth}`만 저장합니다. 정확한 금액·입력 비율·자가 추정 구조·PSID 참고 구간·메모·내부 경로·모델 출력은 어느 기록에도 저장하지 않습니다. 계산된 레벨과 행동 완료 기록은 기기에 남으므로 공용 기기에서는 기록 삭제 기능을 사용해야 합니다.

익명 session UUID는 rate limit과 해시된 `safety_identifier` 생성에 쓰이며 `wealthcopy-anonymous-session`이라는 별도 localStorage 키에 보관합니다. 이 값은 v5 계획 레코드의 일부가 아니고 자산정보를 포함하지 않습니다.

`wealthcopy-public-plan-v4`, `wealthcopy-public-plan-v3`, `wealthcopy-public-plan-v2`, `wealthcopy-demo-plan-v1`은 의미가 다른 과거 기록이므로 새 레벨이나 완료 상태로 변환하지 않고 제거합니다. 같은 달에 다시 계산할 때는 출발·다음 레벨이 모두 같고 동일한 행동 ID인 경우에만 완료 기록을 유지합니다. 달이 바뀌면 저장 계획을 폐기하고 최신 가구 스냅샷으로 다시 분류합니다.

## 서버 내부의 OpenAI 역할

원화 레벨 분류, 목적 경로 점수, hard stop, 단계별 전환 앵커, 결과 확인 행동과 규칙 fallback은 서버가 결정합니다. 안전 게이트가 모델 사용을 허용할 때 OpenAI 모델은 다음 데이터만 받습니다.

- 검토된 기반 보호 후보의 `id`, 남는 결과, 완료 기준
- 현금 여유, 소득 안정성, 가장 큰 자산 범주, 쏠림, 부채 부담·위험, 저축 여력, 레버리지와 90일 이벤트의 거친 신호
- 내부 목적 경로 하나와 원문이 제거된 허용 상황 신호

모델에는 총자산·총부채, 순자산, 현재·다음 레벨, 원 비율, 원문 메모, PSID 선택값, PSID 달러 경계값과 최근 완료 이력을 전달하지 않습니다. 모델은 후보 중 하나의 `supportActionId`만 선택하며 사용자용 카피, 숫자, 수익률, 상품, 거래 또는 진행률을 만들 수 없습니다. API 키 누락, 모델 오류, 스키마 오류 또는 hard stop 상황에서는 규칙 fallback이 같은 공개 계약을 반환합니다.

- `OPENAI_MODEL` 기본값: `gpt-5.6-luna`
- Responses API의 Structured Outputs와 strict Zod 검증
- `store: false`, low reasoning, 10초 SDK 제한, 재시도 없음, 출력 토큰 제한
- 익명 세션 UUID를 SHA-256 해시한 `safety_identifier`
- `application/json`·same-origin 경계와 스트리밍 요청 본문 8KB 제한
- 데모용 인메모리 제한: IP당 분당 20회, 세션당 분당 8회

## 경쟁력

- **분류는 내부에서, 행동은 앞에서:** 복잡한 분석은 숨기고 다음 단계와 세 행동만 보여 줍니다.
- **행동이 남기는 결과:** 모든 행동에 산출물, 이진 완료 기준, 세 단계 실행 순서가 있어 막연한 권고로 끝나지 않습니다.
- **전 구간 연결:** 음의 순자산 L1부터 1조원 이상 L15 유지까지 단계별 앵커가 있습니다.
- **안전한 개인화:** 현금·부채·소득·쏠림·가까운 이벤트를 목적 경로에 반영하되 상품과 기대수익을 만들지 않습니다.
- **거짓 성과 차단:** 행동 완료와 자산 상승을 분리하고 매월 최신 스냅샷으로 다시 분류합니다.

## Windows에서 실행

요구 사항은 Node.js 24.x와 pnpm 11.x입니다. OpenAI API 키 없이도 규칙 fallback으로 실행할 수 있습니다.

```powershell
cd C:\wealth_copy_openai_challenge
pnpm.cmd install
Copy-Item .env.example .env.local
```

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
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
- 운영 확인: `GET/HEAD /api/healthz`와 5분 주기 Cloud Monitoring uptime check

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
src/components/wealth/wealth-copy-app.tsx       3단계 입력·세 행동·완료율·체크리스트 UI
src/lib/wealth/asset-level.ts                    L1–L15 순서와 다음 단계 규칙
src/lib/wealth/server/asset-level-policy.ts      krw-net-worth-v1 자동분류 정책
src/lib/wealth/server/private-derived-signals.ts 정확한 금액을 거친 내부 밴드로 축약
src/lib/wealth/level-transitions.ts              레벨별 protect·advance·verify 정책
src/lib/wealth/normalized-profile.ts             수집 프로필과 통화 중립 신호 스키마
src/lib/wealth/public-plan.ts                    공개 계획 계약과 정적 행동 산출물·완료 기준·순서
src/lib/wealth/public-plan-storage.ts            v5 월별 저장·검증·과거 버전 폐기
src/lib/wealth/recent-action-history.ts          최소 완료 이력·12개월/36건 제한·서버 투영
src/lib/wealth/path-library.ts                   behavior-policy-v2 목적 경로와 우선순위
src/lib/wealth/server/planner-core.ts            안전 게이트·모델 후보·fallback 조합
src/lib/wealth/server/psid-reference.ts          psid-wealth-reference-v2 감사용 출처
src/app/api/v2/plan/route.ts                     same-origin·8KiB·no-store 공개 계획 API
src/app/api/healthz/route.ts                     최소 no-store liveness endpoint
src/lib/openai.ts                                서버 전용 OpenAI 설정
Dockerfile                                       Cloud Run용 Node 24 standalone 이미지
.dockerignore / .gcloudignore                    비밀·로컬 파일 빌드/업로드 제외
docs/GCP_DEPLOYMENT.md                           GCP 리소스·재배포·검증·롤백 절차
```

## 금융 안전 경계

WealthCopy는 교육용 행동 기록 화면입니다. 투자·세무·법률·신용·보험 자문이 아니며 상품 추천, 수익 보장, 계좌 연결, 자동이체, 주문, 매매 또는 리밸런싱을 제공하지 않습니다. 행동 체크는 실제 금융 실행이나 자산 증가의 증거가 아니며 모든 의사결정은 사용자가 합니다. 법률·세무·신용 판단이 필요한 신호는 결론을 만들지 않고 전문가에게 확인할 자료와 질문을 정리하도록 안내합니다.

현재 rate limit은 단일 프로세스용 데모 보호입니다. 공개 출시 전에는 인증 기반 분산 rate limiting, uptime check 알림 채널과 예산 알림, 명시적 동의·삭제 UX, 개인정보·보존 정책과 금융 도메인 법률 검토가 필요합니다.

## Build Week

제출 준비는 `docs/BUILD_WEEK.md`, 결정은 `docs/DECISIONS.md`, 녹화는 `docs/DEMO_SCRIPT.md`에서 관리합니다.

- [GPT‑5.6 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [GPT‑5.6 Luna 모델](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Build Week](https://openai.com/build-week/)
