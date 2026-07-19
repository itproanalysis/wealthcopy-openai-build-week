# OpenAI Build Week 2026 verification

## Product acceptance

- [ ] The setup collects all eight asset groups without connected-account claims.
- [ ] The report shows current L1–L15 band, next band, threshold gap and in-band position.
- [ ] L15 is presented as a terminal operating band.
- [ ] Every composition row shows current share, internal reference range, direction and estimated gap.
- [ ] Cashflow covers deployable amount, living-cost ratio, debt-service ratio, liquid runway and debt-to-asset ratio.
- [ ] Critical safeguards appear before structural guidance.
- [ ] The report contains three ranked priorities with diagnosis, guidance, metric, checkpoint and guardrail.
- [ ] The route contains 0–3, 4–6 and 7–12 month horizons.
- [ ] Data confidence is visible and uncertain holdings reduce confidence.
- [ ] No completion tracker, behavior history, product recommendation or automatic-promotion claim remains.

## API and privacy

- [ ] `POST /api/v3/report` accepts only the strict report request.
- [ ] `/api/v2/plan` is absent.
- [ ] JSON type, origin, encoding and 8 KiB gates reject invalid requests before model access.
- [ ] Every API response uses `Cache-Control: no-store`.
- [ ] Financial inputs and reports are not persisted in the browser.
- [ ] Deprecated local plan and behavior-history keys are removed.
- [ ] Exact amounts, ratios, levels, raw notes and public prose are absent from model input.
- [ ] Missing key, rate limit, API error and invalid model output return the deterministic report shape.

## Technical verification

- [ ] Lint passes with zero warnings.
- [ ] Typecheck passes.
- [ ] Unit and route tests pass.
- [ ] Production build passes.
- [ ] Tests cover all 15 levels and all eight composition groups.
- [ ] Threshold, arithmetic, zero-denominator and maximum-value edges are covered.
- [ ] Mobile, keyboard, focus, contrast and reduced-motion checks pass.
- [ ] Live Cloud Run root, `/api/healthz` and `/api/v3/report` pass smoke tests.
- [ ] Live error logs contain no new application errors.

## Submission evidence

- [ ] Desktop and mobile report screenshots
- [ ] A 90-second flow from input to report
- [ ] One safety-stop scenario
- [ ] One model-backed framing scenario and fallback parity proof
- [ ] L1, L14 and L15 boundary evidence
- [ ] Live URL, revision, commit and test summary
