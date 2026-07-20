# WealthCopy — A privacy-first report for the next wealth band

**OpenAI Build Week 2026 · Apps for Your Life**

[Live demo](https://wealth-copy-470320899177.asia-northeast3.run.app/) · [Devpost submission](https://devpost.com/software/wealthcopy) · [Demo video](https://youtu.be/RWI-HaFLIRs) · [Source code](https://github.com/itproanalysis/wealthcopy-openai-build-week) · [Submission package](submission/README.md) · [Deployment evidence](docs/GCP_DEPLOYMENT.md)

WealthCopy turns a household snapshot into a coherent wealth-structure report. It classifies net worth across fifteen internal bands, compares all eight asset groups with the next band’s internal reference range, surfaces safety conditions, and connects the three most important structural adjustments to a twelve-month review route.

The product is intentionally not a portfolio recommender, return forecast, or transaction engine. It answers three practical questions:

1. Where am I now, and what is the next wealth band?
2. Which parts of my current structure differ most from that next-band reference?
3. What should I review first without weakening household liquidity or debt safety?

## Judge quick start

> **Live judge path:** steps 2-5 match the concentrated sample deployed on Cloud Run revision `wealth-copy-00011-zxg`. The submission screenshots were captured on the functionally identical `wealth-copy-00010-2nf` baseline before the final contrast and focus-ring adjustment.

1. Open the [English Judge Mode](https://wealth-copy-470320899177.asia-northeast3.run.app/?judge=1) (the `EN · JUDGE` toggle is also available in the header).
2. Select **“Try the L6 concentrated sample.”**
3. Continue through the three input steps and create the report.
4. The sample has KRW 440M in assets, KRW 40M in debt, and KRW 400M in net worth. It therefore sits at L6, 50% through the band, with KRW 100M remaining to L7.
5. Its owner-occupied home is 63.6% of assets, 13.6 percentage points above the L7 internal reference ceiling. This makes the core comparison visible immediately.

No login or account connection is required. Judge Mode translates the complete input path and adds an English executive brief that exposes the product logic, evidence boundary, and bounded GPT-5.6 explanation plan. The detailed server-owned Korean report remains directly below it.

## How GPT-5.6 is used

Financial calculations, band classification, safety conditions, composition gaps, and all final Korean sentences are deterministic server responsibilities. GPT-5.6 receives no amounts, ratios, band labels, raw notes, or customer-facing prose.

Instead, the model orchestrates four bounded explanation decisions from minimized categorical signals:

- framing;
- lead insight;
- explanation order; and
- connection between diagnosis and route.

Every model choice must come from the context-specific allowlist. The server now validates both each ID and the semantic compatibility of the four-ID combination. Incomplete responses, missing/extra/invalid IDs, or incoherent combinations return the same strict report shape through a deterministic fallback. OpenAI Responses use Structured Outputs, `store: false`, low reasoning effort, a short timeout, no SDK retries, and a hashed safety identifier.

This design gives each household a more relevant reading order without asking a generative model to calculate or recommend financial outcomes. The selected explanation order now changes the priority-card reading emphasis, and Judge Mode renders the four bounded controls as a visible narrative plan.

The displayed composition ranges are WealthCopy-owned review policies, not observed Korean household allocations or official percentiles. PSID-derived percentile spacing is used only as server-side calibration backdata; PSID values and source terminology do not reach the client, public API, model request, or report.

Separately, the report provides a broad Korean household net-worth context from the official **2025 Survey of Household Finances and Living Conditions**. It maps net worth only to the published interval, never interpolates a position inside that interval, and keeps the official context separate from WealthCopy L1–L15 and the eight-group internal ranges. See [data governance](docs/DATA_GOVERNANCE.md).

## Repeat review without silent storage

The previous result is compared in React memory during the current tab. A user may also explicitly download a strict, versioned report snapshot and import it later as a comparison baseline. The snapshot includes report amounts, stays under the user’s control, is validated on import, and is never written by the app to localStorage, sessionStorage, cookies, IndexedDB, or telemetry. Print/PDF remains available for a human-readable archive.

## How Codex accelerated the build

Codex has supported the project since the first dated repository commit on July 14, 2026: inspecting the codebase, challenging assumptions, implementing and testing the product, reviewing the live UI, and operating the Cloud Run deployment. The commit history records the evolution into the current comprehensive structure report.

Key human decisions retained by the builder included:

- moving from a plan-led prototype to a report-first experience;
- extending classification to L1–L15, with L15 terminal;
- using exactly eight household asset groups and three ranked review priorities;
- keeping PSID-derived distribution spacing as server-only backdata rather than exposing US-dollar values or inferred Korean percentiles; and
- limiting GPT-5.6 to verified explanation orchestration while keeping calculations and safety deterministic.

Codex contributed implementation speed through parallel product, technical, and pitch audits; boundary-test expansion; privacy review; browser QA across desktop and mobile; deterministic fallback design; and repeated Cloud Run smoke testing. The primary Codex project thread ID is `019f5d64-cdd0-7b41-b6a6-2dd3cb4a79fd`.

## Run locally

Requirements: Node.js 24 and pnpm 11.

```powershell
pnpm.cmd install
Copy-Item .env.example .env.local
pnpm.cmd dev
```

Set `OPENAI_API_KEY` in `.env.local`. `OPENAI_MODEL` defaults to the project’s Build Week model configuration. The report still returns a deterministic, schema-identical fallback if the key or model is unavailable.

Quality gate:

```powershell
pnpm.cmd check
```

The current candidate passes lint, type checking, 85 tests, and a production build. Coverage includes all fifteen bands, all eight asset groups, threshold edges, safety stops, strict request rejection, minimized model input, coherent four-ID orchestration, incomplete-response fallback parity, official Korean interval boundaries, snapshot round-trips, English Judge Mode, no-store headers, and removal of the legacy v2 endpoint.

## Korean product documentation

# WealthCopy — 다음 자산 구간 종합 리포트

WealthCopy는 사용자의 현재 자산을 여덟 자산군으로 나눠 보고, 내부 L1–L15 구간을 판정한 뒤 **다음 구간의 참고 구성과 현재 구성의 차이**를 설명하는 Build Week 서비스입니다.

결과 화면은 단순한 할 일 목록이 아닙니다. 다음 내용을 한 리포트에 연결합니다.

- 현재 구간과 다음 구간, 다음 기준까지 부족한 순자산
- 현재 구간 안에서의 위치
- 여덟 자산군별 현재 금액·비중, 다음 구간 내부 참고비중·금액범위와 참고 하단까지의 차이
- 현금흐름, 부채상환, 필수유출 대비 유동성 여력, 순자산/연소득 배수와 주요 위험
- 가장 큰 격차부터 정리한 우선순위 3개
- 현재 레벨에 맞춘 `0–3개월`, `4–6개월`, `7–12개월` 구조 경로
- 입력 완성도에 따른 데이터 신뢰도
- 2025년 공식 가계금융복지조사의 넓은 순자산 공개구간 맥락(구간 내 위치 추정 없음)
- 사용자 파일로만 저장·불러오는 버전형 비교 스냅샷과 현재 탭 전후 비교

## 입력 구조

### 여덟 자산군

1. 현금·단기예치
2. 거주 부동산
3. 상장 금융자산
4. 연금·장기계정
5. 수익형 부동산
6. 사업·비상장 자산
7. 대체·헤지 자산
8. 기타·회수예정 자산

사용자는 본인과 배우자를 포함한 같은 가구·같은 평가기준일로 각 자산군의 추정 금액과 총부채, 월소득, 월생활비, 월부채상환액, 소득 안정성, 90일 내 주요 변화와 예상 필요액을 입력합니다. 보유액이나 소득이 없으면 0원을 명시할 수 있어 L1·L2도 같은 흐름으로 진단합니다. 계좌번호·상품명·연락처 같은 식별정보는 받지 않으며, 선택 메모에도 금액과 개인정보를 입력하지 않도록 검증합니다.

## L1–L15 구간

서버는 `순자산 = 여덟 자산군 합계 - 총부채`로 구간을 계산합니다.

| 구간 | 순자산 범위 |
| --- | ---: |
| L1 | 0원 미만 |
| L2 | 0원 이상 1천만원 미만 |
| L3 | 1천만원 이상 3천만원 미만 |
| L4 | 3천만원 이상 1억원 미만 |
| L5 | 1억원 이상 3억원 미만 |
| L6 | 3억원 이상 5억원 미만 |
| L7 | 5억원 이상 10억원 미만 |
| L8 | 10억원 이상 30억원 미만 |
| L9 | 30억원 이상 50억원 미만 |
| L10 | 50억원 이상 100억원 미만 |
| L11 | 100억원 이상 300억원 미만 |
| L12 | 300억원 이상 1천억원 미만 |
| L13 | 1천억원 이상 3천억원 미만 |
| L14 | 3천억원 이상 1조원 미만 |
| L15 | 1조원 이상 |

L15는 상위 구간이 없는 최종 운영 구간입니다. 이 구간에서는 추가 승급 격차 대신 구조와 유동성, 거버넌스의 지속 가능성을 보여 줍니다.

## 구성 비교의 의미

`composition-policy-v2`는 WealthCopy가 설계한 L1–L15별 내부 참고범위입니다. 여섯 개 앵커 사이를 서버에서 보간해 열다섯 단계가 서로 다른 구성 범위를 갖습니다. PSID의 공개 백분위 좌표는 서버에서 분포 간격을 보정하는 백데이터로만 사용하며, 달러 금액을 원화로 바꾸거나 한국 자산순위를 추정하지 않습니다. PSID 원시 금액·출처 용어·백분위 좌표는 앱, 공개 API, 모델 입력에 노출하지 않습니다.

이 범위는 실제 한국 가구의 통계적 평균, 공식 백분위, 적정 배분 또는 수익률 예측이 아닙니다. 자산군별 원화 참고범위는 `다음 구간 순자산 하단 + 현재 부채`로 계산한 비교용 총자산을 기준으로 하며, 현재 부채가 유지된다는 단순 가정입니다. 리포트는 차이와 추정 격차를 설명하지만 매수·매도 금액이나 상품을 지시하지 않습니다.

안전 진단은 월 세후소득에서 필수생활비와 부채상환액을 뺀 값을 **입력 기준 월 잔여액**으로만 표시합니다. 90일 내 큰 지출은 예정액 자체뿐 아니라 지급 후에도 필수유출 3개월분이 현금·예금에 남는지 함께 검사합니다. 월 적자, 높은 상환부담, 짧은 유동성 여력 등 중단조건이 있으면 구성 조정보다 먼저 노출합니다.

월 부채상환 비율은 사용자가 입력한 월 원리금상환액을 월 세후소득으로 나눈 진단값입니다. 금융기관의 규제상 DSR과 포함범위·소득기준이 다르므로 DSR이라고 부르지 않습니다.

`level-route-policy-v2`는 L1의 적자 회복·유동성 방어부터 중간 구간의 자산 역할 분리·부채 균형·집중 완화, L15의 장기 운영·영속성까지 각 레벨에 서로 다른 구조 경로를 제공합니다. 각 기간은 현재 구조 문제를 조정 수단과 안전선에 연결하며, L15는 다음 레벨을 만들지 않고 도달 시점이나 수익을 약속하지 않습니다.

## 공개 API

`POST /api/v3/report`

요청 본문은 다음 구조만 허용합니다.

```json
{
  "profile": {
    "assets": {
      "liquid": 50000000,
      "home": 150000000,
      "market": 120000000,
      "pension": 50000000,
      "incomeProperty": 30000000,
      "businessPrivate": 25000000,
      "alternatives": 15000000,
      "other": 10000000
    },
    "totalDebtKrw": 50000000,
    "monthlyIncomeKrw": 10000000,
    "monthlyLivingExpenseKrw": 4000000,
    "monthlyDebtPaymentKrw": 1000000,
    "incomeStability": "stable",
    "next90DayEvent": "none",
    "next90DayAmountKrw": 0
  },
  "constraintNote": "",
  "sessionId": "123e4567-e89b-42d3-a456-426614174000"
}
```

성공 응답은 `wealth-report-v2`이며 `level`, `composition`, `cashflow`, `risks`, `priorities`, `interpretation`, `route`, `dataConfidence`, `methodology`를 포함합니다. `interpretation`은 모델이 고른 네 개의 허용목록 ID를 서버 소유 한국어 설명으로 매핑하며, 하나라도 현재 문맥의 허용목록을 벗어나면 전체가 결정론적 fallback으로 돌아갑니다. 모든 응답은 `Cache-Control: no-store`입니다. 폐기된 `/api/v2/plan`은 제공하지 않습니다.

## 개인정보와 OpenAI 경계

- 금융 입력과 생성된 리포트는 브라우저 localStorage에 저장하지 않습니다.
- 명시적 다운로드 스냅샷은 사용자가 소유하는 JSON 파일이며, 불러온 리포트도 현재 React 메모리에서만 비교합니다.
- 익명 요청 제한용 UUID만 현재 탭의 sessionStorage에 분리 보관합니다.
- 이전 버전의 브라우저 저장 키는 첫 실행 시 삭제합니다.
- 정확한 금액, 비율, 레벨, 원문 메모와 사용자용 문장은 OpenAI에 전달하지 않습니다.
- OpenAI는 서버가 현재 문맥에 허용한 프레이밍·선행 인사이트·설명 순서·연결 ID만 선택하며, 서버가 모든 ID를 다시 검증하고 사용자 문장으로 매핑합니다.
- 안전 중단조건, 모델 오류, 키 누락 또는 잘못된 출력에서는 동일한 종합 리포트 형태의 결정론적 fallback을 반환합니다.

## 실행과 검증

```powershell
pnpm.cmd install
Copy-Item .env.example .env.local
pnpm.cmd dev
```

품질 게이트:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

핵심 구현:

```text
src/components/wealth/wealth-copy-app.tsx
src/components/wealth/wealth-report-view.tsx
src/components/wealth/wealth-judge-panel.tsx
src/components/wealth/korea-household-context-panel.tsx
src/app/api/v3/report/route.ts
src/lib/wealth/wealth-report.ts
src/lib/wealth/report-presentation.ts
src/lib/wealth/report-snapshot.ts
src/lib/wealth/korea-household-context.ts
src/lib/wealth/server/report-core.ts
src/lib/wealth/server/level-composition-benchmarks.ts
src/lib/wealth/server/level-route-policy.ts
src/lib/wealth/server/asset-level-policy.ts
```

WealthCopy는 교육용 구조 진단 도구입니다. 투자·세무·법률·신용·보험 자문이나 거래 실행을 제공하지 않습니다.
