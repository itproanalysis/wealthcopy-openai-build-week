# WealthCopy repository guidance

## Mission

Treat asset management as an action problem. The fixed Build Week outcome is a simple monthly surface showing only the next asset level `L7`, exactly three actions, and action-completion progress.

## Non-negotiable public surface

- The main screen shows `L7`, exactly three checkable actions, and progress.
- Progress means completed actions only: 0 actions = `0`, 1 = `33`, 2 = `67`, 3 = `100`.
- Never describe progress as asset growth, return, L7 attainment, time saved, or distance remaining.
- Do not expose path cards, comparison tables, recommendations, fit, tradeoffs, amounts, durations, difficulty, scores, model names, fallback sources, or internal errors.
- Keep setup inputs in the transient setup dialog; do not repeat them on the main surface.
- Use action-first copy such as `분석은 줄이고, 행동은 세 개로.` Avoid `성공 경로`, `검증된 경로`, `추천`, `최적`, `예상 도달`, and `수익`.

## Public API contract

The successful `POST /api/v2/plan` response has exactly these top-level fields:

```ts
{
  nextLevel: "L7";
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

## Internal intelligence boundary

- `src/lib/wealth/engine.ts` and `src/lib/wealth/server/planner-core.ts` may calculate and compare server-side candidates, but those details are not a public product surface.
- `src/lib/wealth/public-plan.ts` owns the public schema, action allowlist, static copy, and safe projection.
- `src/app/api/v2/plan/route.ts` is the public boundary. It may call internal analysis but returns only the public plan.
- Keep OpenAI calls server-side through the Responses API and `OPENAI_MODEL`, defaulting to `gpt-5.6`.
- Preserve Zod Structured Outputs, semantic validation, `store: false`, token limits, and hashed `safety_identifier`.
- GPT‑5.6 may choose or order approved action IDs. It must not generate user-facing financial prose, numbers, returns, products, transactions, or progress.
- Missing keys, API errors, invalid output, and rate limits must use a deterministic fallback with the same public success shape. Do not surface model/fallback provenance in the main UI.
- Preserve pre-model PII screening and blocking for product, transaction, tax, credit, execution, income-interruption, delinquency, and bankruptcy requests.
- Keep the 8KB body limit and demo limits of 20 requests per IP per minute and 8 per session per minute. Production requires authenticated distributed limiting.

## Persistence and interaction

- Store only `{version, monthKey, plan}` under `wealthcopy-public-plan-v2`; the nested plan must satisfy the exact public schema.
- Do not store setup profile, internal candidates, model output, or analysis metadata.
- Reset completed states when the month changes and validate all restored data.
- Migrate the legacy `wealthcopy-demo-plan-v1` task state to the three public actions, then remove the legacy key.
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
