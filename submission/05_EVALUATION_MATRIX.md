# Representative evaluation matrix

This matrix distinguishes deterministic financial behavior from optional GPT-5.6 explanation orchestration. “Model call” means the context is eligible for bounded four-ID selection; all financial outputs exist before that call.

The concentrated L6 row matches Cloud Run revision `wealth-copy-00013-wtl`; the same case was rerun against both a no-traffic candidate tag and the public 100%-traffic URL before the package was finalized.

| Case | Input condition | Deterministic product result | Orchestration policy | Model call |
| --- | --- | --- | --- | --- |
| Concentrated L6 sample | KRW 440M assets, KRW 40M debt; home 63.6%; positive monthly balance | L6 to L7, 50% position, KRW 100M gap; home 13.6%p above L7 reference ceiling; three priorities | Allows `structure_then_scale` or `cashflow_then_gap`; lead choices include largest-gap and cashflow/balance; three explanation orders; structure/cashflow connections | Yes |
| Monthly deficit | Essential expense plus debt payment exceeds monthly income | Monthly balance is negative; deployable amount remains zero; safety route precedes composition guidance | Fixed `protect_then_build`, `safety_is_the_gate`, `diagnosis_first`, `safety_to_structure` | No |
| Multiple safety stops | High debt service, short liquid runway, high debt-to-assets, weak net worth | All critical conditions appear together in the first horizon; later structure work remains conditional on resolution | Same fixed safety plan as above | No |
| Low-confidence holdings | `other` assets exceed 10% of total | Confidence becomes low; ranking is held until holdings are clarified | Fixed `verify_then_plan`, `certainty_before_comparison`, `checkpoint_first`, `evidence_to_priority` | No |
| L1 recovery | Assets below debt | Current band L1; report prioritizes deficit recovery, liquidity defense, and debt stabilization rather than investment expansion | Fixed safeguard plan because non-positive net worth is a hard stop | No |
| Terminal L15 | Net worth is KRW 1T or more | Current and next both L15; gap is zero; no L16 or promotion claim; route covers durability, liquidity, concentration, governance, and succession | Uses the same strict explanation contract, but terminal copy never invents a higher band | Conditional |

## Valid-plan example

For a normal L6 context, the test suite applies this fully allowlisted candidate:

```json
{
  "framingId": "cashflow_then_gap",
  "leadInsightId": "balance_before_scale",
  "explanationOrderId": "adjustment_first",
  "connectionId": "structure_to_gap"
}
```

The result changes the executive headline, summary connection, priority-card reading emphasis, and ordering of route explanations. Levels, amounts, ratios, gaps, safety conditions, priorities, and response schema remain unchanged.

## Fallback parity proof

Automated tests submit all of the following and assert exact equality with the deterministic fallback report:

- `null` output;
- a partial plan with only a framing ID;
- an invented framing ID;
- a lead insight that is valid globally but disallowed for the current context;
- an invented explanation-order ID;
- a connection that is valid globally but disallowed for the current context; and
- a four-ID combination whose individual IDs are all context-allowed but whose framing/lead/connection are semantically incoherent;
- an incomplete Responses API result, including `max_output_tokens`; and
- an otherwise valid plan containing an extra user-facing field.

Safety-stop and low-confidence contexts do not call the model at all. This preserves the same public `wealth-report-v2` shape across missing key, timeout, rate limit, API error, invalid output, and deterministic-only paths.
