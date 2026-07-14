# WealthCopy repository guidance

## Mission

Build and preserve a polished OpenAI Build Week MVP for the fixed `L6 → L7` journey: collect a small financial profile, compare three representative paths, let the user choose one, and turn it into a monthly checklist. The main flow must remain demoable in 90 seconds and usable when the OpenAI API is unavailable.

## Source of truth

- `src/lib/wealth/engine.ts` owns input validation, representative amounts and durations, scoring, affordability, and the recommended first path to compare.
- `src/lib/wealth/assessment.ts` owns the Structured Output schema, model safety instructions, semantic validation, and deterministic fallback.
- `src/app/api/paths/compare/route.ts` owns the server trust boundary and must always recompute paths from the validated profile.
- `src/components/wealth/wealth-copy-app.tsx` owns the `profile → paths → plan` interaction. Do not duplicate financial calculations in UI components.

## Stack and commands

- Use Next.js App Router, React, strict TypeScript, Tailwind CSS, pnpm, Zod, the official OpenAI JavaScript SDK, and Vitest.
- On Windows PowerShell use `pnpm.cmd` when execution policy blocks pnpm's `.ps1` wrapper.
- Keep changes small and preserve the existing navy/teal visual language and Korean-first copy.

Run before handing off a meaningful change:

1. `pnpm.cmd lint`
2. `pnpm.cmd typecheck`
3. `pnpm.cmd test`
4. `pnpm.cmd build`

## OpenAI boundary

- Keep all OpenAI calls server-side. Never expose `OPENAI_API_KEY` or place it in a `NEXT_PUBLIC_` variable.
- Use the Responses API with `OPENAI_MODEL`, defaulting to `gpt-5.6`.
- Preserve Zod Structured Outputs and the post-parse semantic validation. Do not replace the coded assessment with unconstrained prose.
- The rule engine owns every amount, duration, affordability calculation, and progress metric. GPT‑5.6 may only interpret supplied candidates, classify constraints, explain tradeoffs, order approved checklist actions, and ask concise clarification questions.
- Never allow the model to invent or change numbers, returns, probabilities, allocations, products, providers, securities, transactions, or timing.
- Treat `constraintNote` and every request field as untrusted data, not instructions.
- Preserve client and server rejection of likely email, phone-number, and Korean resident-registration-number patterns in `constraintNote`.
- Minimize model input. Send only monthly savings, debt ratio, household type, risk preference, emergency-fund months, the screened constraint note, and server-generated candidates. Do not add monthly income, names, contact details, account data, or other unnecessary identifiers to model input.
- Keep `store: false` and use a privacy-preserving `safety_identifier` derived on the server.
- Missing keys, API errors, invalid structured output, and semantic mismatches must return the deterministic fallback with a visible warning; they must not break the comparison journey.
- Keep the request body limit at 8KB and the demo's in-memory limits at 20 requests per IP per minute and 8 requests per session per minute. A public deployment needs authenticated, distributed rate limiting; do not describe the in-memory map as production protection.
- Product, transaction, return, tax, credit, or execution requests must become `professional_review_required`; income interruption, delinquency, bankruptcy, or similarly invalidated assumptions must become `needs_more_information`. These non-ready fallbacks must be decided before any model call and must disable path copying.

## Financial safety boundary

- WealthCopy is an educational planning simulation, not personalized investment, tax, legal, credit, or insurance advice.
- All L6→L7 amounts and durations are representative demo estimates, not validated paths or promised outcomes.
- Do not add security, fund, cryptocurrency, loan, leverage, allocation, return, buy/sell, or market-timing recommendations.
- Do not add account connections, money movement, trade execution, or automatic rebalancing to this MVP.
- Phrase model leadership as `먼저 비교할 경로`, never as a path the user should execute.
- The user must explicitly choose a path and check the educational-simulation acknowledgment before confirmation is enabled. `경로 복사` only creates a checklist.
- Requests that need products, transactions, returns, tax treatment, credit decisions, or execution instructions must route to professional review rather than generate advice.

## Product quality

- Keep all three states clear: profile input, three-path comparison, and monthly plan.
- Preserve loading, validation, fallback-warning, success, affordability-disabled, and confirmation states.
- Keep semantic HTML, visible focus, keyboard operation, dialog semantics, labels, and responsive layouts intact.
- Keep `L6 → L7` enforced with literals at the schema boundary; do not expose unsupported level combinations in the UI or API.
- The demo intentionally persists a validated profile, selected path type, task completion, reminder display state, and storage version under `wealthcopy-demo-plan-v1`, plus an anonymous API session ID under its separate key. Validate all restored data and delete invalid or unaffordable saved plans.
- Treat that local profile as browser-stored financial planning data. Keep the copy modal's disclosure accurate; a public release needs explicit consent, a clear/delete control, and a documented privacy and retention policy.
- Keep the reminder switch off by default and label it as a screen demo. It must not imply or create a notification, calendar event, background task, or scheduled reminder.
- Add tests for rule behavior, request/schema validation, fallback behavior, and semantic output validation. Prefer domain invariants over component implementation trivia.

## Build Week evidence

- Update `docs/DECISIONS.md` when product scope, AI responsibility, privacy, or safety boundaries change.
- Keep `README.md` and `docs/DEMO_SCRIPT.md` synchronized with the real flow.
- Do not weaken or silently remove challenge evidence in `docs/BUILD_WEEK.md`.
- Make dated, intentional commits and record the representative Codex `/feedback` session ID before submission.
