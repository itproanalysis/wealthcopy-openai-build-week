# WealthCopy repository guidance

## Mission

Treat asset management as an action problem. Classify the household's current WealthCopy level from aggregate net worth, then keep the monthly public surface limited to the next sequential level, exactly three actions, and action-completion progress.

## Non-negotiable public surface

- Before setup, show the product promise and one setup CTA without fabricated level, action or progress values. After classification, show only the computed next level (`L2` through `L15`), exactly three checkable actions, and progress.
- `L1 → L2` through `L14 → L15` and `L15 → L15` maintenance must all have reviewed action paths.
- Progress means completed actions only: 0 actions = `0`, 1 = `33`, 2 = `67`, 3 = `100`.
- Never describe progress as asset growth, return, level attainment, automatic promotion, time saved, or distance remaining.
- Use copy such as `다음 단계를 준비하며 이번 달 확인할 3가지 행동입니다.` Never claim that checking actions causes a net-worth threshold to be crossed.
- For `L15`, describe the result as a maintenance stage rather than another higher target.
- Do not expose path cards, comparisons, recommendations, fit, tradeoffs, amounts, durations, scores, model names, fallback sources, or internal errors on the main surface.
- Keep aggregate amounts and ratios inside the transient setup flow. Do not repeat them on the main surface.
- Use the centralized neutral labels in `src/lib/wealth/asset-level.ts`; do not introduce investment, return, succession, official-grade, or amount-bearing labels.
- Preserve 44px touch targets, native checkboxes, `<fieldset>`, `<legend>`, `<progress max={3}>`, visible completion text and a polite live region.

## Household net-worth classification

- The server-owned policy is `krw-net-worth-v1` in `src/lib/wealth/server/asset-level-policy.ts`.
- Calculate `household net worth = totalAssetsKrw - totalDebtKrw`.
- Treat `totalAssetsKrw` and `totalDebtKrw` as non-negative safe integers. Household net worth may be negative.
- Every lower bound is inclusive and every upper bound is exclusive.

| Level | Household net worth |
| --- | ---: |
| `L1` | below KRW 0 |
| `L2` | KRW 0 to below KRW 10 million |
| `L3` | KRW 10 million to below KRW 30 million |
| `L4` | KRW 30 million to below KRW 100 million |
| `L5` | KRW 100 million to below KRW 300 million |
| `L6` | KRW 300 million to below KRW 500 million |
| `L7` | KRW 500 million to below KRW 1 billion |
| `L8` | KRW 1 billion to below KRW 3 billion |
| `L9` | KRW 3 billion to below KRW 5 billion |
| `L10` | KRW 5 billion to below KRW 10 billion |
| `L11` | KRW 10 billion to below KRW 30 billion |
| `L12` | KRW 30 billion to below KRW 100 billion |
| `L13` | KRW 100 billion to below KRW 300 billion |
| `L14` | KRW 300 billion to below KRW 1 trillion |
| `L15` | KRW 1 trillion or more |

- These are WealthCopy-owned product bands, not official wealth grades, Korean percentiles, credit grades, forecasts, or PSID-derived classifications.
- Never alter these cutoffs without a new level-policy version, boundary tests and a storage migration.
- A `3/3` plan never proves a threshold was crossed. Reclassify from a fresh household snapshot each month.

## Setup and request boundary

- The structured profile accepts `totalAssetsKrw`, `totalDebtKrw`, `incomeExecutionRatio`, `debtServiceRatio`, coarse asset-structure, cash-runway, income-stability, debt-risk and near-term-event signals, plus an optional audit-only `assetPercentileBand`.
- Do not accept a client-supplied current level. Derive it from the two aggregate amounts.
- Debt service is part of the combined execution ratio, so preserve `debtServiceRatio <= incomeExecutionRatio` in client and server validation.
- The optional note may contain an allowlisted situation but must reject common currency forms and likely contact or account data.
- Exact household amounts exist only long enough to classify the level. Never send them to OpenAI, return them, persist them, place them in an ICS file, or include them in logs or telemetry.
- Use `Cache-Control: no-store` for API responses and `store: false` for model calls.

## Public API contract

The successful `POST /api/v2/plan` response body has exactly these top-level fields:

```ts
{
  nextLevel: NextAssetLevel;
  actions: Array<{ id: PublicActionId; completed: boolean }>; // length 3
  progress: 0 | 33 | 67 | 100;
}
```

- `NextAssetLevel` is `L2` through `L15`; a classified `L15` maps to `L15` maintenance.
- Return the server-derived source level only in the `X-WealthCopy-Source-Level` response header so the client can verify that `nextLevel` is sequential. Keep it out of the JSON body and apply `Cache-Control: no-store` to the whole response.
- Each action object has exactly `id` and `completed`.
- Require three unique allowlisted action IDs ordered `protect → advance → verify`; the server chooses the evidence action and keeps it third.
- Derive progress deterministically from completed count. The model never controls it.
- Keep localized titles and completion criteria in reviewed client-owned static copy.
- Never add current level, amounts, PSID values, paths, assessment, model, source, explanation, duration, score, or recommendation fields to a successful JSON body. The source level header is the sole exception and remains no-store.
- Validate the final projection with the strict public Zod schema for model, fallback and rate-limited responses.

## Internal intelligence boundary

- Classification, transition anchors, safety constraints and deterministic fallback are server responsibilities.
- `src/lib/wealth/public-plan.ts` owns the public schema, action allowlist, static copy and safe projection.
- `src/app/api/v2/plan/route.ts` is the public boundary and must return no-store responses.
- Keep OpenAI calls server-side through the Responses API and `OPENAI_MODEL`, defaulting to `gpt-5.6-luna` with low reasoning effort for this constrained selector.
- Preserve Zod Structured Outputs, semantic validation, `store: false`, short timeouts, no SDK retries, token limits and hashed `safety_identifier`.
- Preserve one reviewed transition-anchor action for the classified source level. The model may choose only one support action from that transition's routine allowlist; an applicable safety constraint takes precedence. The server fixes the advance and evidence actions.
- Model input may contain allowed support-action IDs and coarse, non-PSID situation signals. It must not contain amounts, net worth, current or next level, the raw note, PSID values, recent-completion history, products, transactions, returns or progress.
- Missing keys, API errors, invalid model output and rate limits use the same deterministic public shape. Do not expose model or fallback provenance.
- Keep the 8KB body limit and demo limits of 20 requests per IP per minute and 8 per session per minute. Production requires authenticated distributed limiting.

## PSID data boundary

- Use only the published historical 2019 weighted PSID aggregate recorded as `psid-wealth-reference-v2` in `src/lib/wealth/server/psid-reference.ts`.
- The optional bands are `below_25`, `p25_49`, `p50_74`, `p75_89`, `p90_plus`, and `unknown`.
- The user may self-select a band or leave it unknown. Do not compare their amounts with PSID, calculate a statistical percentile, or use the band to classify L1–L15.
- Keep `psid-wealth-reference-v2`, `krw-net-worth-v1` and `behavior-policy-v2` separate.
- Do not use a higher PSID band to increase speed, risk, confidence or expected success.
- Never describe a band as a Korean population percentile, official grade, verified outcome or forecast.
- Do not convert PSID dollar thresholds to Korean won. Keep audit values server-only and out of model input, public responses, storage and client bundles.
- Registered Public Use microdata, Restricted Data and individual family records are outside this MVP.

## Persistence and monthly continuity

- Store only the strict `wealthcopy-public-plan-v5` record: `{version, monthKey, sourceLevel, plan}`. Its v5 semantics are fixed to `krw-net-worth-v1`; there is no separate policy field. Do not store exact amounts, ratios, PSID selection, raw note, internal candidates or model output.
- Keep the anonymous session UUID in the separate `wealthcopy-anonymous-session` localStorage key. It is not part of the v5 plan record and must not contain financial data.
- Keep repetition prevention in a separate strict `wealthcopy-action-history-v1` record containing only the policy version and at most 36 `{actionId, sourceLevel, completedMonth}` entries. Never store amounts, ratios, PSID, notes, path scores or model data there.
- Send only prior-month `{id, sourceLevel, monthsAgo}` completion signals to the planner. Exclude the current month, ignore records for a different server-classified source level, and never include this history in model input, public responses or logs.
- Delete `wealthcopy-public-plan-v4`, `wealthcopy-public-plan-v3`, `wealthcopy-public-plan-v2` and `wealthcopy-demo-plan-v1`; their meanings are incompatible with current classification and action semantics.
- Do not migrate a historical level or completed plan into a new financial band.
- On every month rollover, require a fresh household snapshot before presenting a current next level. Do not carry a stale classification merely because the old plan was incomplete.
- On same-month regeneration, carry completion only when the classified source level and target are unchanged and the action ID exists in both plans.
- Clearing this month's record must remove the current and deprecated plan keys plus current-month completion-history entries. Older repetition history and the anonymous session identifier remain separate unless the user explicitly clears all local data.

## Upper-level action safety

- Upper-level anchors should focus on records, review dates, liabilities, ownership, reporting, authority and operational continuity—not products, allocation, returns, tax optimization, legal conclusions or transactions.
- Actions involving continuity or alternate access must explicitly prohibit recording or sharing passwords, authentication factors, account details or other secrets.
- Checking an action records behavior only; it never values assets, changes ownership, grants authority, moves money or executes a transaction.

## Financial safety

- WealthCopy is an educational behavior tracker, not investment, tax, legal, credit or insurance advice.
- Do not add securities, funds, crypto, loans, leverage, allocation, return, buy/sell timing, money movement or automatic rebalancing.
- Production requires authentication-aware distributed rate limiting, monitoring, explicit consent and deletion, retention policy, accessibility review and financial/legal review.

## Verification

On Windows use `pnpm.cmd` when PowerShell blocks the `.ps1` shim.

1. `pnpm.cmd lint`
2. `pnpm.cmd typecheck`
3. `pnpm.cmd test`
4. `pnpm.cmd build`

Keep `README.md`, `docs/DECISIONS.md`, `docs/DEMO_SCRIPT.md`, and `docs/BUILD_WEEK.md` synchronized. Never touch the user-owned untracked `기획서/` directory unless explicitly asked.
