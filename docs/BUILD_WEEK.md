# OpenAI Build Week 2026 checklist

Verified on 2026-07-14 KST against the official event site, Devpost rules, FAQ, resources, and GPT-5.6 guide.

## Non-negotiables

- Build the project with Codex.
- Use GPT-5.6 meaningfully in a core product workflow. Incidental or decorative use is not enough.
- Select one track: Apps for Your Life, Work & Productivity, Developer Tools, or Education.
- Submit by 2026-07-21 17:00 PDT, which is 2026-07-22 09:00 KST.

The event's 100 USD credit is for Codex, not OpenAI API usage. Budget GPT-5.6 API usage separately.

## Product acceptance gate

- [x] The current snapshot is a manual three-step flow: household assets, asset structure, and execution conditions. It does not claim account linking or MyData authentication.
- [x] Household net worth is calculated as total household assets minus total household debt.
- [x] `krw-net-worth-v1` classifies every inclusive lower boundary from negative net worth at `L1` through KRW 1 trillion or more at `L15`.
- [x] The bands are WealthCopy product policy, never official grades, Korean percentiles, suitability classifications, or performance forecasts.
- [x] `behavior-policy-v2` matches one of eight purpose paths from coarse cash, debt, income, concentration, liquidity, asset-structure, and near-term-event signals.
- [x] Every source level has one fixed advance anchor and reviewed protect/evidence candidates: `L1 → L2` through `L14 → L15`, plus `L15 → L15` maintenance.
- [x] Every public plan is ordered `protect → advance → verify`.
- [x] Every action has reviewed static copy for a concrete outcome, binary done criterion, and exactly three execution steps, plus a checklist-copy interaction.
- [x] When no hard stop forces the protect action, GPT-5.6 chooses exactly one `supportActionId` from safe candidates; it cannot change the fixed anchor or evidence action.
- [x] The successful JSON body remains exactly `{nextLevel, actions, progress}` and each action remains exactly `{id, completed}`.
- [x] `X-WealthCopy-Source-Level` carries the server-derived source level outside the JSON body, and all API responses use `Cache-Control: no-store`.
- [x] Exact household amounts are reduced at the private request boundary to a level and coarse leverage band, then excluded from OpenAI input, response bodies, localStorage, analytics, and logs.
- [x] `psid-wealth-reference-v2` records the PSID 2019 Table 4 source and is excluded from level classification, purpose paths, action selection, and model input.
- [x] `3/3 · 100%` means action completion only and never causes automatic promotion.
- [x] Month rollover discards the stale plan and requires a fresh three-step household snapshot.
- [x] The `wealthcopy-public-plan-v5` record is exactly `{version, monthKey, sourceLevel, plan}` with `version: 5`; older plan records are discarded rather than migrated.
- [x] The anonymous session UUID uses the separate `wealthcopy-anonymous-session` localStorage key and is not financial profile data.
- [x] The production standalone container is deployed publicly to Cloud Run in Seoul with a dedicated runtime identity and a version-pinned Secret Manager key.

## Evidence to capture while building

- [x] Dated Git commits showing work completed during the challenge
- [x] Product and architecture decisions in `docs/DECISIONS.md`
- [x] Representative prompts, eval cases, and sample data
- [ ] Screenshots or recordings of important milestones
- [ ] A representative Codex task Session ID obtained with `/feedback`

Representative Codex Session ID: TODO

## Submission package

- [x] Working project
- [x] Public Cloud Run deployment: https://wealth-copy-470320899177.asia-northeast3.run.app
- [ ] One selected category and a short English description
- [ ] Public YouTube demo with audio; target 2:59 or less
- [ ] Demo explains the product, Codex development process, and GPT-5.6 integration
- [ ] Demo shows the three-step manual snapshot and clearly says it is self-reported, not connected-account data
- [ ] Demo shows a normal transition such as `L7 → L8` and `L15 → L15` maintenance at KRW 1 trillion or more
- [ ] Demo shows three ordered stages, expands one action's outcome/done criterion/three steps, and copies its checklist
- [ ] Demo shows `3/3 → fresh snapshot → reclassification` without claiming automatic wealth attainment
- [ ] Demo keeps the public surface to the next level, exactly three actions, and action-completion progress
- [ ] Demo describes PSID bands as optional US aggregate references excluded from level, paths, actions, and model input
- [ ] Demo explains that exact amounts are removed before GPT-5.6, the success JSON, localStorage, analytics, or logs
- [ ] Demo explains that GPT-5.6 chooses only one safe support action while server policy fixes the advance and verify actions
- [ ] Demo or technical appendix verifies the exact three-key JSON body, source-level response header, no-store behavior, and v5 storage shape
- [ ] Code repository URL
- [ ] README covers setup, running, testing, sample data, privacy boundaries, action-policy v2, and the full `L1`–`L15` threshold table
- [ ] README covers Codex collaboration, key decisions, and GPT-5.6's contribution
- [ ] Public repository includes an appropriate license, or private repository access is shared with the required judges
- [ ] Representative `/feedback` Session ID is included
- [ ] If the project is a plugin or developer tool: supported platforms, installation, and a no-rebuild demo or sandbox are included

For a private repository, the current rules require sharing access with `testing@devpost.com` and `build-week-event@openai.com`.

## Final technical verification

- [ ] `pnpm.cmd lint`
- [ ] `pnpm.cmd typecheck`
- [ ] `pnpm.cmd test`
- [ ] `pnpm.cmd build`
- [ ] Boundary tests cover every threshold, each value immediately below a threshold, negative net worth, debt subtraction, and the exact KRW 1 trillion L15 boundary
- [ ] Path tests cover all eight purpose paths and prove that PSID never changes their scores or winner
- [ ] Planning tests cover hard stops and all 15 `protect → advance → verify` transitions
- [ ] Model-boundary tests prove that only a safe `supportActionId` can change and that amount, level, ratio, note text, and PSID values are absent
- [ ] API tests assert the exact success body keys, exact action keys, source-level header, `Cache-Control: no-store`, and consistent fallback shape
- [ ] Storage tests assert the exact v5 record, deletion of incompatible older records, same-month completion carry rules, and mandatory month-rollover reclassification
- [ ] Privacy tests assert that exact amounts are absent after the private classification/derivation boundary
- [ ] A manual mobile and keyboard pass confirms 44px targets, native checkboxes, dialog focus handling, visible progress text, action-detail disclosure, checklist-copy feedback, and polite live announcements

## Judging lens

The first stage is pass/fail for challenge fit and required technology. The scored stage weights these equally:

1. Technical implementation
2. Design, polish, and complete user experience
3. Potential impact
4. Quality of the idea

WealthCopy's competitive claim should stay precise: it converts asset management from an analysis workflow into a monthly action workflow. The server privately classifies the level and bottleneck, the model makes one bounded support-action choice, and the public surface exposes only a next level, three executable actions, and completion progress. It does not claim that completing actions causes wealth growth.

## Official sources

- Event: https://openai.com/build-week/
- Rules: https://openai.devpost.com/rules
- FAQ: https://openai.devpost.com/details/faqs
- Resources: https://openai.devpost.com/resources
- Submission update: https://openai.devpost.com/updates/45282-openai-build-week-submissions-are-open-plugin-launch
- GPT-5.6 model guide: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6

Recheck Devpost before submission because event details can change. If event pages conflict, use the Devpost rules for submission decisions.
