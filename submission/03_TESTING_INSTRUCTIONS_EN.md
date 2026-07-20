# Judge testing instructions

> **Verified deployment:** the path below matches Cloud Run revision `wealth-copy-00011-zxg`, receiving 100% traffic after the final live and accessibility smoke tests.

## Fastest path - no login required

1. Visit https://wealth-copy-470320899177.asia-northeast3.run.app/ in a modern desktop or mobile browser.
2. Select **L6 편중 사례로 먼저 보기** - “Try the concentrated L6 sample.”
3. On each of the three steps, select **다음 단계** - “Next.”
4. On the final step, select **종합 리포트 만들기** - “Create comprehensive report.”
5. The generated report should show:
   - current **L6**, next **L7**;
   - KRW 400M net worth and KRW 100M remaining to L7;
   - 50% position inside L6;
   - owner-occupied home at 63.6% of assets, 13.6 percentage points above the L7 internal reference ceiling;
   - exactly three ranked priorities and three route horizons; and
   - no critical safety signal for the default sample.

## Important Korean labels

| Korean UI | English meaning |
| --- | --- |
| 현재 | Current |
| 다음 목표 | Next target |
| 구간 내 위치 | Position inside the current band |
| 진입까지 | Remaining to enter the next band |
| 가장 큰 구조 차이 | Largest structural difference |
| 먼저 확인할 안전조건 | Safety condition to check first |
| 이번 리포트의 조정 방향 | Three adjustment directions |
| 지금 먼저 볼 구조 3가지 | Three structures to review first |
| 8개 자산군 상세 비교 | Detailed comparison of eight asset groups |
| 입력 기준 월 잔여액 | Monthly balance based on entered values |
| 구조 변경 전에 확인할 위험 | Risks to check before structural change |
| 입력값 수정 | Edit inputs |
| 인쇄·PDF 저장 | Print or save as PDF |

## Test a change without persistence

From the report, select **입력값 수정** (“Edit inputs”), change monthly income, and regenerate. A **변경 전과 비교** (“Compare with previous”) panel will appear. The previous report exists only in React memory for the current page session; refresh or start a new report to clear it.

## Safety behavior

For a safety-stop example, edit the monthly flow so living expenses plus debt payments exceed monthly income. Regenerate the report. The executive brief should identify the monthly deficit as the first safety condition, and the first route horizon should prioritize simultaneous safety checks before composition changes.

## Technical run path

Local requirements: Node.js 24 and pnpm 11.

```powershell
pnpm.cmd install
Copy-Item .env.example .env.local
pnpm.cmd dev
```

Set `OPENAI_API_KEY` in `.env.local` to exercise model-backed explanation orchestration. Without a key, the strict deterministic fallback produces the same financial calculations, safety conditions, report schema, and server-owned copy surface.

Run the complete quality gate:

```powershell
pnpm.cmd check
```

The public API is `POST /api/v3/report`. The retired `/api/v2/plan` route returns 404.

## Product boundaries

WealthCopy is an educational structure-diagnosis tool, not investment, tax, legal, credit, or insurance advice. Its composition ranges are WealthCopy-owned internal review ranges, not observed Korean household statistics, official percentiles, optimal allocations, or expected-return forecasts. PSID-derived percentile spacing is server-only calibration backdata; PSID dollar values, source terminology, and inferred Korean ranks are not exposed in the UI, public API, model request, or report.
