# WealthCopy repository guidance

## Mission

Turn a household snapshot into a concise wealth-structure report: current L1–L15 band, next-band gap, eight-group composition comparison, cashflow and risk diagnosis, three ranked priorities, and a three-horizon route.

## Public product contract

- The primary result is a comprehensive report, not a completion tracker.
- Do not add checkboxes, completion percentages, streaks, action history, or claims that following the report causes promotion.
- Always cover the eight canonical groups in order: `liquid`, `home`, `market`, `pension`, `incomeProperty`, `businessPrivate`, `alternatives`, `other`.
- Show current and next level, threshold gap and in-band position. Keep L15 terminal.
- Compare current composition with the next-band internal reference range and explain the largest gaps.
- Keep exactly three ranked priorities and three route horizons: 0–3, 4–6 and 7–12 months.
- Surface safety risks and data confidence before structural guidance.
- Never present internal reference ranges as observed population statistics, official grades, optimal allocation, expected returns, or transaction instructions.

## Classification and methodology

- `krw-net-worth-v1` in `src/lib/wealth/server/asset-level-policy.ts` owns L1–L15 thresholds.
- Net worth is the sum of all eight asset groups minus total debt.
- `composition-policy-v2` is a WealthCopy-owned comparison policy, not financial advice. Asset-group amount gaps use the next-band gross-asset reference while holding current debt constant.
- A methodology change requires a new version, boundary tests and an explicit storage/API compatibility decision.
- PSID may influence only `server-only` percentile-spacing calibration for the fifteen internal composition policies. Never convert or expose its dollar values, source terminology or inferred rank through client code, request schemas, model input, public responses, storage, logs or product copy.

## Request and response boundary

- The only report endpoint is `POST /api/v3/report`; do not restore `/api/v2/plan`.
- Accept exactly eight household asset amounts, total debt, monthly income, living expense, debt payment, income stability, a near-term event and its amount, a bounded note and an anonymous UUID. Zero assets and zero income are valid when explicitly confirmed.
- Reject client-supplied totals, levels, benchmark selections and extra fields.
- Keep the 8 KiB body limit, JSON-only content type, identity encoding, same-origin browser gate and no-store responses.
- Validate the final `wealth-report-v1` response with its strict Zod schema.

## Privacy and persistence

- Do not persist financial input or report output in localStorage, sessionStorage, cookies, IndexedDB or telemetry.
- A random session identifier may live in sessionStorage only for abuse controls and must contain no financial data.
- Remove deprecated plan and behavior-history keys on client startup.
- Do not log request bodies or reports.

## OpenAI boundary

- Classification, amounts, ratios, reference comparison, risks, priority copy and fallback are deterministic server responsibilities.
- OpenAI may choose only one allowlisted route-framing ID from coarse non-financial signals.
- Never send amounts, ratios, levels, composition values, raw notes or user-facing prose to the model.
- Preserve Structured Outputs, `store: false`, low reasoning effort, short timeout, no SDK retries, token limits and hashed `safety_identifier`.
- Model failure must return the same strict public report shape without exposing provenance.

## Verification

On Windows use `pnpm.cmd`:

1. `pnpm.cmd lint`
2. `pnpm.cmd typecheck`
3. `pnpm.cmd test`
4. `pnpm.cmd build`

Tests must cover all 15 levels, all eight groups, threshold edges, safety stops, strict request rejection, model-input minimization, fallback parity, no-store headers and the absence of legacy v2 routes. Keep `README.md` and `docs/` synchronized. Never modify the user-owned `기획서/` directory unless explicitly requested.
