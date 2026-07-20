# WealthCopy data governance

Last reviewed: 2026-07-20

WealthCopy separates user facts, official public context, internal diagnostic policy, and model presentation choices. No source is allowed to silently cross those boundaries.

## Evidence ledger

| Layer | Runtime role | What may be claimed | What must not be claimed |
| --- | --- | --- | --- |
| Household snapshot | Eight assets, debt and monthly flow supplied for one report | Deterministic net worth, ratios, safety conditions and amount differences | Verified account balance, complete financial statement or future outcome |
| Korean official context | One broad published net-worth interval | Published interval share and cumulative published-band range | Household-specific rank, an interpolated percentile, or approval of WealthCopy levels |
| WealthCopy level policy | `krw-net-worth-v1`, L1–L15 | Versioned internal KRW classification | Official grade, social status or population percentile |
| WealthCopy composition policy | `composition-policy-v2`, eight role-based ranges | Diagnostic comparison under the stated current-debt assumption | Observed Korean portfolio, optimal allocation, expected return or transaction target |
| Longitudinal calibration backdata | Server-only spacing review between internal anchors | Internal methodology audit only | Source values, source terminology, converted currency or inferred Korean rank in product/API/model/storage |
| GPT-5.6 | Select four context-allowlisted explanation IDs | Bounded framing, lead, reading order and connection | Financial calculation, free-form advice, user copy, classification or recommendation |

## 2025 Korean official household context

Primary source: [2025 Survey of Household Finances and Living Conditions](https://www.bok.or.kr/portal/bbs/B0000501/view.do?menuNo=201264&nttId=10094917), jointly produced by the Ministry of Data and Statistics, Bank of Korea, and Financial Supervisory Service.

- Release date: 2025-12-04
- Asset/debt/net-worth reference date: 2025-03-31
- Runtime context version: `korea-household-net-worth-bands-2025-v1`

The public table is combined into six unchanged intervals:

| Net-worth interval | Published household share | Cumulative published-band range |
| --- | ---: | ---: |
| Below KRW 0 | 3.0% | 0.0–3.0% |
| KRW 0 to under 100M | 26.4% | 3.0–29.4% |
| KRW 100M to under 300M | 27.5% | 29.4–56.9% |
| KRW 300M to under 500M | 15.1% | 56.9–72.0% |
| KRW 500M to under 1B | 16.1% | 72.0–88.1% |
| KRW 1B or more | 11.8% | Broad upper interval only |

Published values are rounded and sum to 99.9%. WealthCopy does not interpolate within an interval. In particular, every value at or above KRW 1B receives the same broad “upper approximately 11.8%” context; L8–L15 never receive an invented finer official rank.

This public context is independent of the WealthCopy L1–L15 classification. It is also not used to construct the eight-group composition ranges because the official survey taxonomy does not map one-to-one to WealthCopy’s role-based groups.

## Ratio definitions

| Displayed metric | WealthCopy calculation | Boundary |
| --- | --- | --- |
| Debt to assets | Total debt / eight-group assets | Household snapshot ratio, not a credit decision |
| Monthly debt-payment ratio | Entered monthly payment / monthly after-tax income | Not regulatory DSR |
| Net worth / annual income | Net worth / twelve months of entered after-tax income | Accumulation context, not a target multiple |
| Monthly balance | After-tax income − essential living costs − debt payment | Before irregular spending |
| Liquid runway | Cash and short-term deposits / essential monthly outflow | Internal safety diagnostic |

Regulatory DSR uses annual income and annual principal-and-interest payments across defined financial debt. WealthCopy’s user-entered monthly after-tax ratio has a different scope, so the product explicitly labels it as not regulatory DSR. See the [Financial Services Commission definition](https://www.fsc.go.kr/po020201/27351).

## Privacy and update rules

- Financial inputs and reports are not written to browser storage, cookies, telemetry or logs.
- An explicit report snapshot is a user-controlled file. Import is capped at 256 KiB and must pass the strict `wealth-report-snapshot-v1` and `wealth-report-v2` schemas.
- Official context can be updated independently from internal level and composition policies.
- A methodology change requires a new version, boundary tests, a compatibility decision and synchronized public documentation.
- Public source revisions never silently rewrite an already exported report.
