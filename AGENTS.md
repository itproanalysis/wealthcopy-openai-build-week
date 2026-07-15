# WealthCopy repository guidance

## Mission

Treat asset management as an action problem. The Build Week outcome is a simple monthly surface showing only the next sequential WealthCopy level, exactly three actions, and action-completion progress. `L7` is one example and the maintained top stage, not a globally fixed target.

## Non-negotiable public surface

- The main screen shows the computed next level (`L2` through `L7`), exactly three checkable actions, and progress. Before setup, use a neutral `NEXT` state rather than assuming a level.
- `L1 → L2` through `L6 → L7` and `L7 → L7` maintenance must all have reviewed action paths.
- Progress means completed actions only: 0 actions = `0`, 1 = `33`, 2 = `67`, 3 = `100`.
- Never describe progress as asset growth, return, level attainment, time saved, or distance remaining.
- Do not expose path cards, comparison tables, recommendations, fit, tradeoffs, amounts, durations, difficulty, scores, model names, fallback sources, or internal errors.
- Keep setup inputs in the transient setup dialog; do not repeat them on the main surface.
- Setup has one user-selected WealthCopy current level plus three structured financial inputs: income-execution percentage, a user-selected PSID reference percentile band, and monthly debt-service-to-income percentage. It may also send an optional constraint note and anonymous session UUID. Do not add structured currency amount fields.
- Use these meaningful self-selected journey labels consistently: `L1 시작`, `L2 흐름 정리`, `L3 현금 안전망`, `L4 납부 안정`, `L5 월 실행`, `L6 자산 구조`, `L7 장기 유지`.
- Describe levels as product-owned action stages, never official wealth grades, Korean percentiles, or PSID-derived classifications.
- Debt service is part of the combined execution percentage, so preserve `debtServiceRatio <= incomeExecutionRatio` in both UI and server validation.
- Use action-first copy such as `분석은 줄이고, 행동은 세 개로.` Avoid `성공 경로`, `검증된 경로`, `추천`, `최적`, `예상 도달`, and `수익`.

## Public API contract

The successful `POST /api/v2/plan` response has exactly these top-level fields:

```ts
{
  nextLevel: NextAssetLevel;
  actions: Array<{ id: PublicActionId; completed: boolean }>; // length 3
  progress: 0 | 33 | 67 | 100;
}
```

- Each action object has exactly `id` and `completed`.
- Require three unique allowlisted action IDs.
- Derive progress deterministically from the completed count. The model never controls it.
- Keep localized titles and descriptions in reviewed client-owned static copy.
- Never add `paths`, `assessment`, `model`, `source`, explanation, amount, duration, score, or recommendation fields to a successful public response.
- Validate the final projection with a strict Zod schema before returning or storing it.
- Require `profile.currentLevel` on every request. Map it dynamically as `L1 → L2`, `L2 → L3`, `L3 → L4`, `L4 → L5`, `L5 → L6`, `L6 → L7`, and `L7 → L7` maintenance; never assume a fixed target.

## Internal intelligence boundary

- `src/lib/wealth/engine.ts` and `src/lib/wealth/server/planner-core.ts` may calculate and compare server-side candidates, but those details are not a public product surface.
- `src/lib/wealth/public-plan.ts` owns the public schema, action allowlist, static copy, and safe projection.
- `src/app/api/v2/plan/route.ts` is the public boundary. It may call internal analysis but returns only the public plan.
- Keep OpenAI calls server-side through the Responses API and `OPENAI_MODEL`, defaulting to `gpt-5.6`.
- Preserve Zod Structured Outputs, semantic validation, `store: false`, token limits, and hashed `safety_identifier`.
- Preserve one reviewed transition-anchor action for the request's `currentLevel`. GPT‑5.6 may choose a safe companion only from that transition's routine allowlist; an applicable safety constraint takes precedence. The third action is always `schedule_monthly_checkin`.
- GPT‑5.6 must not generate user-facing financial prose, numbers, returns, products, transactions, or progress.
- Missing keys, API errors, invalid output, and rate limits must use a deterministic fallback with the same public success shape. Do not surface model/fallback provenance in the main UI.
- Preserve pre-model PII screening and blocking for product, transaction, tax, credit, execution, income-interruption, delinquency, and bankruptcy requests.
- Reject common currency amount forms in the optional constraint note and reduce every accepted note to allowlisted constraint signals before model input. Never treat regex screening as complete natural-language amount detection.
- Keep the 8KB body limit and demo limits of 20 requests per IP per minute and 8 per session per minute. Production requires authenticated distributed limiting.

## PSID data boundary

- Use only the published historical 2019 weighted PSID aggregate for US family net worth recorded in `src/lib/wealth/server/psid-reference.ts`.
- The public percentile bands are conceptual cut ranges: `below_25`, `p25_49`, `p50_74`, `p75_89`, `p90_plus`, and `unknown`.
- The user self-selects a band. The service does not compare personal assets with PSID values or calculate a statistical percentile. WealthCopy levels and their sequential transitions are defined independently of PSID.
- Keep `psid-wealth-reference-v1` separate from `behavior-policy-v1`. Do not use a higher self-selected asset band to increase path speed, risk, or confidence.
- Never describe a selected band as a Korean population percentile, an official asset grade, a verified level outcome, or a forecast.
- Do not convert PSID dollar thresholds to Korean won. Keep source amounts and metadata under the current server import path, exclude them from the client bundle, model input, public API, and browser storage, and audit the production bundle after changes.
- Public Use microdata requiring registration and agreement to conditions, Restricted Data requiring a separate contract, and individual family records are not part of this MVP. A future calibrated dataset must be versioned and reviewed before replacing the public aggregate adapter.

## Persistence and interaction

- Store only `{version, monthKey, sourceLevel, plan}` under `wealthcopy-public-plan-v3`; the nested plan must satisfy the exact public schema. `sourceLevel` is product journey context, not verified asset status or a financial profile.
- Do not store setup profile, internal candidates, model output, or analysis metadata.
- Reset completed states for an incomplete plan when the month changes and validate all restored data.
- A `3/3` plan does not prove level attainment. On continuation or month rollover, present the old `nextLevel` only as a current-stage candidate, require the user to recheck their status, and then create the next transition.
- When regenerating actions in the same month, carry completion only when both the stored `sourceLevel` and next level are unchanged and the action ID exists in both the old and new plan.
- Migrate `wealthcopy-public-plan-v2` as the legacy `L6 → L7` source once, then remove the v2 key.
- Migrate the legacy `wealthcopy-demo-plan-v1` task state to the three public actions, then remove the legacy key.
- Offer a client-generated `.ics` file for the monthly check-in. It must contain no financial profile, PSID band, amount, model output, or other private data.
- Use native checkboxes, `<fieldset>`, `<legend>`, `<progress max={3}>`, visible completion text, and a polite live region.
- Keep the screen-reader order `next level → progress → three actions` and preserve 44px touch targets.

## Financial safety

- WealthCopy is an educational behavior tracker, not investment, tax, legal, credit, or insurance advice.
- Do not add securities, funds, crypto, loans, leverage, allocation, return, buy/sell, timing, money movement, or automatic rebalancing.
- Checking an action records behavior only and never executes a transaction.

## Verification

On Windows use `pnpm.cmd` when PowerShell blocks the `.ps1` shim.

1. `pnpm.cmd lint`
2. `pnpm.cmd typecheck`
3. `pnpm.cmd test`
4. `pnpm.cmd build`

Keep `README.md`, `docs/DECISIONS.md`, and `docs/DEMO_SCRIPT.md` synchronized. Do not weaken evidence in `docs/BUILD_WEEK.md`.
