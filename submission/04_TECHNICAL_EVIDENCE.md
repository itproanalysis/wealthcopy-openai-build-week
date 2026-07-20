# Technical and build evidence

## Architecture

```text
Browser-only household input
        |
        v
Strict POST /api/v3/report boundary
        |
        +--> deterministic wealth engine
        |      - L1-L15 classification
        |      - eight-group composition gaps
        |      - cashflow, liquidity, debt and event safety
        |      - exactly three priorities
        |
        +--> minimized categorical planning context
               |
               v
          GPT-5.6 Structured Output
          four allowlisted IDs only
               |
               v
          server revalidation + fixed copy mapping
               |
               +--> deterministic fallback on any failure
        |
        v
Strict wealth-report-v2 response, Cache-Control: no-store
```

## Why GPT-5.6 is meaningful but bounded

The model selects four bounded explanation dimensions from context-specific allowlists, and the server revalidates the combined semantics before accepting the plan:

| Dimension | Examples | User-facing effect |
| --- | --- | --- |
| Framing | structure-then-scale, cashflow-then-gap | Changes the report’s explanatory lens. |
| Lead insight | largest gap, safety gate, cashflow pace | Chooses the executive headline and opening interpretation. |
| Explanation order | diagnosis first, adjustment first, checkpoint first | Changes the priority-card reading emphasis and route-stage introduction. |
| Connection | structure-to-gap, safety-to-structure, event-to-cashflow | Connects the executive diagnosis to the route. |

Amounts, ratios, levels, composition values, raw notes, and user-facing prose are excluded from model input. The server owns all final sentences. The four-ID model input now has its own runtime strict schema; the server validates both each context allowlist and the semantic coherence of the complete framing/lead/connection combination. A partially valid or internally incoherent plan is never merged. Incomplete Responses API output also returns exact deterministic fallback parity.

The model’s bounded role is now observable without exposing financial reasoning. `explanationOrderId` changes whether each priority card leads with diagnosis, adjustment guidance, or checkpoint. English Judge Mode visualizes all four selected controls as one explanation plan. Financial facts, priority rank, safeguards and copy remain unchanged.

## Methodology boundary

The fifteen level thresholds and eight-group composition ranges are WealthCopy-owned policy versions. They are not observed Korean household allocations, official wealth percentiles, optimized portfolios, or return forecasts. PSID-derived percentile coordinates affect only server-side spacing calibration between policy anchors. PSID dollar values, source terminology, and inferred ranks are not converted for Korean users and do not enter client code, public responses, storage, logs, or model input.

The product separately maps net worth to one unchanged interval from the official 2025 Korean Survey of Household Finances and Living Conditions. It shows the published interval share and cumulative published-band range, never interpolates within an interval, and does not convert that context into WealthCopy levels or composition ranges. Data source, dates, mapping and ratio definitions are recorded in `docs/DATA_GOVERNANCE.md`.

## Security and privacy controls

- Financial input and report output are not stored in localStorage, sessionStorage, cookies, IndexedDB, or telemetry.
- An explicit `wealth-report-snapshot-v1` download is a user-owned file, not app persistence. Import is limited to 256 KiB and revalidates the strict nested `wealth-report-v2` contract before the report enters React memory.
- Only a random anonymous UUID is kept in sessionStorage for abuse control.
- Deprecated browser-storage keys are deleted at client startup.
- Request body is streamed with an 8 KiB maximum.
- Only JSON with identity encoding is accepted.
- Browser requests require same-origin context; foreign origins are rejected.
- Request and response schemas are strict and reject client-supplied totals, levels, benchmark choices, and extra fields.
- All report responses use `Cache-Control: no-store`.
- OpenAI requests use Structured Outputs, `store: false`, low reasoning effort, 160 output tokens, a short timeout, no SDK retries, and a SHA-256 safety identifier.
- Docker runs the final Next.js server as a non-root user.
- The API key is injected from Google Secret Manager at instance startup and is not present in the image or repository.

## Verification summary

| Gate | Result |
| --- | --- |
| ESLint | Pass, zero warnings |
| TypeScript | Pass |
| Automated tests | 89 passed across 13 files |
| Production build | Pass |
| Production dependency audit | `pnpm audit --prod`: no known vulnerabilities on July 20, 2026 |
| Level coverage | All L1-L15 boundaries, including terminal L15 |
| Composition coverage | All eight groups and interpolation anchors |
| Safety coverage | Monthly deficit, debt burden, liquidity runway, near-term event shortfall, raw-note privacy |
| Model boundary coverage | Input runtime schema, minimization, strict allowlists, semantic combination checks, incomplete/partial/extra/invalid rejection, fallback parity |
| Official context coverage | All six Korean published-band boundaries, no interpolation, L15 remains in the broad KRW 1B+ interval |
| Snapshot coverage | Strict version, round trip, 256 KiB limit, malformed/extra/unsupported rejection |
| Live browser QA | Desktop and 390 x 844 mobile; no horizontal overflow; zero console warnings/errors |
| Live API QA | Normal L6-L7, safety-stop, L15, no-store, foreign-origin 403, removed v2 404 |

## Deployment

| Item | Value |
| --- | --- |
| Platform | Google Cloud Run, region `asia-northeast3` |
| Service | `wealth-copy` |
| Public URL | https://wealth-copy-470320899177.asia-northeast3.run.app/ |
| Runtime identity | `wealth-copy-run@abis-web-platform.iam.gserviceaccount.com` |
| Resources | 1 CPU, 512 MiB, concurrency 20, timeout 30s, max 3 instances |
| Secret | `wealth-copy-openai-api-key` through Secret Manager |
| Model setting | `OPENAI_MODEL=gpt-5.6-luna` |

The latest verified public revision is recorded in `docs/GCP_DEPLOYMENT.md`. The concentrated sample matches the judge path and passes root, health, strict report, English Judge Mode, official-context, snapshot-contract, mobile no-overflow, core text contrast, and keyboard-focus checks.

## Build Week timeline evidence

The Git history begins July 14, 2026 and records multiple material product transformations inside the submission period. Notable milestones include:

- `c728acb` - initial Build Week MVP;
- `39fca75` - fifteen-level household classification;
- `e386aa3` - redesigned product experience;
- `3ff4bf8` - report-first wealth-structure architecture;
- `1a4f50d` - deeper wealth-band reports and safety logic;
- `960aaf4` - four-ID explanation orchestration; and
- `de0d769` - documented verification of Cloud Run revision `wealth-copy-00008-cls`.

The concentrated sample, English submission files, screenshots, public repository and MIT license are published. The post-submission ranking upgrade adds English Judge Mode, official Korean context, portable comparison snapshots, coherent model-plan validation and expanded automated evidence. Its final product source is commit `9a74c10`, deployed as Cloud Run revision `wealth-copy-00013-wtl` with 100% traffic after live desktop, 390px mobile, L1, L6, L10+, safety-stop, near-term-event, L15, privacy-boundary and error-log checks.

Codex project thread: `019f5d64-cdd0-7b41-b6a6-2dd3cb4a79fd`.

## Honest limitations

- Composition ranges are WealthCopy-owned internal policies, not observed Korean household averages, official percentiles, optimal allocations, or return forecasts.
- PSID-derived distribution spacing is server-only backdata; US-dollar figures and source terms are not exposed or converted for users.
- Upper-band governance and succession guidance needs additional ownership, entity, and readiness inputs before production use.
- The current abuse limiter is in memory, and customer-data persistence remains intentionally disabled pending authentication, retention, deletion, legal, and accessibility review.
