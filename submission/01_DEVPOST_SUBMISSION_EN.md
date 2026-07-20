# Devpost submission copy

## Project name

WealthCopy

## Tagline

See what separates your household wealth structure from the next band—without handing financial decisions to a model.

## Track

Apps for Your Life

## Short description

WealthCopy turns eight household asset estimates, debt, and monthly cashflow into a privacy-first report: current L1-L15 band, next-band gap, structural differences, safety conditions, three priorities, and a twelve-month review route.

## Inspiration

Most personal-finance products show balances, charts, and products, then leave the hardest work to the user: understanding what the numbers mean together. WealthCopy starts with a narrower question: what separates this household’s current structure from the next internal wealth band, and what must be reviewed before trying to close that gap?

## What it does

The user enters estimated values for eight canonical household asset groups, total debt, monthly after-tax income, essential living expenses, debt payments, income stability, and one near-term event. No bank connection, account number, product name, or identity is required.

The server then:

1. calculates net worth and classifies the household from L1 through terminal L15;
2. reports the household's position inside the current band and the net-worth gap to the next threshold;
3. compares every asset group with the next band’s WealthCopy-owned internal reference range;
4. checks cashflow, liquidity runway, debt burden, and near-term obligations before structural guidance;
5. produces exactly three ranked review priorities; and
6. connects them to three horizons: 0-3, 4-6, and 7-12 months.

The result is a diagnostic structure report. It does not forecast returns, promise movement to a higher band, or recommend transactions.

For judges, `?judge=1` opens an English input path and English executive brief. It presents the current-to-next path, threshold gap, in-band position, three review lenses, evidence boundary, and the exact bounded explanation controls before the detailed Korean report. Separately, the product maps net worth to one broad published interval from Korea’s official 2025 household survey without interpolating a household-specific position.

Repeat review remains privacy-first. The current tab compares the previous report in memory. A user can explicitly download a strict, versioned report snapshot and import it later as a baseline; the app never silently writes financial data to browser storage.

## How GPT-5.6 is integrated

We deliberately separate financial truth from generative explanation. Calculations, level thresholds, safety stops, composition gaps, priority content, and all final Korean sentences are deterministic server logic.

GPT-5.6 receives only minimized categorical signals and context-specific allowlists. It selects four bounded explanation decisions: framing, lead insight, explanation order, and connection. The server validates every ID, validates the semantic coherence of the whole combination, and maps it to server-owned copy. One missing, extra, invalid, or incoherent choice—or an incomplete model response—rejects the entire plan and returns a deterministic fallback with the same strict report schema.

Exact amounts, ratios, levels, raw notes, and user-facing copy never enter the model request. Responses use Structured Outputs, `store: false`, low reasoning effort, a short timeout, no SDK retries, and a hashed safety identifier. GPT-5.6 can therefore adapt how verified findings are introduced and connected without calculating or recommending financial outcomes. Its explanation-order choice now changes the reading emphasis of every priority card, making the bounded contribution visible while financial facts remain invariant.

## Method and limits

The next-band composition ranges are WealthCopy-owned review policies. They are not observed Korean household allocations, official percentiles, optimal portfolios, or expected-return estimates. PSID-derived percentile spacing is used only as server-side calibration backdata; no PSID dollar values, source terminology, or inferred Korean ranks reach the browser, public API, model request, or customer-facing report.

The official Korean context is a separate evidence layer based on the 2025 Survey of Household Finances and Living Conditions. It preserves the published interval boundaries and shares, never estimates within-band rank, and never converts official context into WealthCopy levels or composition targets.

## How we built it with Codex

Codex supported the project across product discovery, implementation, test expansion, visual QA, security review, and Cloud Run operations. Parallel Codex reviews repeatedly challenged the product from product, technical, and judging perspectives.

The most important human decision was to move from an early plan-led prototype to a report-first architecture covering L1-L15, eight asset groups, safety-first priorities, private repeat comparison, and a strict v3 API. Codex also helped implement the coherent four-ID GPT-5.6 boundary, the English Judge Mode, official-data separation, portable snapshot contract, expand the suite to 89 automated tests, inspect desktop and mobile layouts in a real browser, and verify normal, safety-stop, and terminal-L15 flows on GCP.

The dated Git history documents this evolution during the challenge window. Primary Codex session ID: `019f5d64-cdd0-7b41-b6a6-2dd3cb4a79fd`.

## Challenges

- Designing useful next-band comparisons without presenting an internal policy as observed population truth.
- Supporting net worth from below zero to KRW 1T+ without recycling generic advice across all levels.
- Making GPT-5.6 materially shape the explanation while preventing it from seeing or generating financial figures.
- Keeping the experience coherent on mobile and printable as a report.

## Accomplishments

- A working, no-login Cloud Run deployment.
- Fifteen distinct wealth bands with terminal L15 behavior.
- Eight-group composition comparison and safety-first route generation.
- Strict 8 KiB JSON API, same-origin browser gate, no-store responses, and non-root container runtime.
- Deterministic fallback parity around bounded GPT-5.6 orchestration.
- English Judge Mode and a visible bounded explanation plan.
- Official Korean broad-band context without invented precision.
- User-owned portable comparison snapshots without browser persistence.
- The current candidate passes lint, type checking, 89 tests, and a production build; the latest documented Cloud Run revision passed responsive browser and API smoke tests.

## What we learned

The most valuable AI boundary is not always “let the model write the answer.” In a sensitive financial context, a better division of labor is to let deterministic code own facts and safety while the model chooses how verified facts should be introduced and connected.

## What is next

We would validate the internal composition policies with Korean advisor and household research, add ownership and governance inputs for upper bands, run accessibility and financial/legal review, and replace the in-memory abuse limiter with an authenticated distributed control before any opt-in customer-data retention.

## Built with

Codex, GPT-5.6, OpenAI Responses API, Structured Outputs, Next.js 16, React 19, TypeScript, Zod, Vitest, Docker, Google Cloud Run, Secret Manager, and Cloud Build.

## Live demo

https://wealth-copy-470320899177.asia-northeast3.run.app/
