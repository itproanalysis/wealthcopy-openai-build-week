# WealthCopy — 다음 자산 구간 종합 리포트

WealthCopy는 사용자의 현재 자산을 여덟 자산군으로 나눠 보고, 내부 L1–L15 구간을 판정한 뒤 **다음 구간의 참고 구성과 현재 구성의 차이**를 설명하는 Build Week 서비스입니다.

결과 화면은 단순한 할 일 목록이 아닙니다. 다음 내용을 한 리포트에 연결합니다.

- 현재 구간과 다음 구간, 다음 기준까지 부족한 순자산
- 현재 구간 안에서의 위치
- 여덟 자산군별 현재 비중과 다음 구간 내부 참고범위
- 현금흐름, 부채상환, 필수유출 대비 유동성 여력, 순자산/연소득 배수와 주요 위험
- 가장 큰 격차부터 정리한 우선순위 3개
- `0–3개월`, `4–6개월`, `7–12개월` 경로
- 입력 완성도에 따른 데이터 신뢰도

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

`composition-policy-v1`은 WealthCopy가 설계한 L1–L15별 내부 참고범위입니다. 여섯 개 앵커 사이를 서버에서 보간해 열다섯 단계가 서로 다른 구성 범위를 갖습니다. 외부 가구 데이터의 공개 백분위 좌표는 분포 간격을 보정하는 백데이터로만 사용하며, 달러 금액을 원화로 바꾸거나 한국 자산순위를 추정하지 않습니다. 데이터셋 이름·원시 금액·백분위 좌표는 앱, 공개 API, 모델 입력에 노출하지 않습니다.

이 범위는 실제 한국 가구의 통계적 평균, 공식 백분위, 적정 배분 또는 수익률 예측이 아닙니다. 현재 비중이 참고범위를 벗어나면 리포트는 차이와 추정 격차를 설명하지만 매수·매도 금액이나 상품을 지시하지 않습니다.

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

성공 응답은 `wealth-report-v1`이며 `level`, `composition`, `cashflow`, `risks`, `priorities`, `route`, `dataConfidence`, `methodology`를 포함합니다. 모든 응답은 `Cache-Control: no-store`입니다. 폐기된 `/api/v2/plan`은 제공하지 않습니다.

## 개인정보와 OpenAI 경계

- 금융 입력과 생성된 리포트는 브라우저 localStorage에 저장하지 않습니다.
- 익명 요청 제한용 UUID만 현재 탭의 sessionStorage에 분리 보관합니다.
- 이전 행동 추적 저장 키는 첫 실행 시 삭제합니다.
- 정확한 금액, 비율, 레벨, 원문 메모와 사용자용 문장은 OpenAI에 전달하지 않습니다.
- OpenAI는 서버가 허용한 경로 프레이밍 ID 중 하나만 선택합니다.
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
src/app/api/v3/report/route.ts
src/lib/wealth/wealth-report.ts
src/lib/wealth/server/report-core.ts
src/lib/wealth/server/level-composition-benchmarks.ts
src/lib/wealth/server/asset-level-policy.ts
```

WealthCopy는 교육용 구조 진단 도구입니다. 투자·세무·법률·신용·보험 자문이나 거래 실행을 제공하지 않습니다.
