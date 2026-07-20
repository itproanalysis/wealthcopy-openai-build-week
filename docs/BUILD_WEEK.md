# OpenAI Build Week 2026 verification

## Product acceptance

- [ ] The setup collects all eight asset groups without connected-account claims.
- [ ] The report shows current L1–L15 band, next band, threshold gap and in-band position.
- [ ] L15 is presented as a terminal operating band.
- [ ] Every composition row shows current amount/share, internal reference share, next-band amount range and estimated gap under the current-debt assumption.
- [ ] Cashflow covers deployable amount, living-cost ratio, debt-service ratio, liquid runway and debt-to-asset ratio.
- [ ] Critical safeguards appear before structural guidance.
- [ ] The report contains three ranked priorities with diagnosis, guidance, metric, checkpoint and guardrail.
- [ ] Every L1–L15 route has a level-specific purpose and contains 0–3, 4–6 and 7–12 month horizons.
- [ ] Data confidence is visible and uncertain holdings reduce confidence.
- [ ] A 90-day event preserves three months of required outflow; a one-won shortfall activates a safeguard.
- [ ] Editing from a generated report preserves the user's entered values.
- [ ] Editing and regenerating shows an in-memory comparison without persisting either report.
- [ ] The executive brief connects level gap, dominant composition difference, first safeguard and exactly three adjustment directions above the detailed sections.
- [ ] No completion tracker, behavior history, product recommendation or automatic-promotion claim remains.

## API and privacy

- [ ] `POST /api/v3/report` accepts only the strict report request.
- [ ] `/api/v2/plan` is absent.
- [ ] JSON type, origin, encoding and 8 KiB gates reject invalid requests before model access.
- [ ] Every API response uses `Cache-Control: no-store`.
- [ ] Financial inputs and reports are not persisted in the browser.
- [ ] Deprecated local plan and behavior-history keys are removed.
- [ ] Exact amounts, ratios, levels, raw notes and public prose are absent from model input.
- [ ] The strict `wealth-report-v2` interpretation contains four context-allowlisted IDs and only server-mapped Korean copy.
- [ ] Any missing, extra or context-invalid orchestration ID rejects the whole plan and returns the deterministic fallback.
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
- [ ] One model-backed four-ID orchestration scenario and fallback parity proof
- [ ] L1, L14 and L15 boundary evidence
- [ ] Live URL, revision, commit and test summary
