# OpenAI Build Week 2026 checklist

Verified on 2026-07-14 KST against the official event site, Devpost rules, FAQ, resources, and GPT-5.6 guide.

## Non-negotiables

- Build the project with Codex.
- Use GPT-5.6 meaningfully in a core product workflow. Incidental or decorative use is not enough.
- Select one track: Apps for Your Life, Work & Productivity, Developer Tools, or Education.
- Submit by 2026-07-21 17:00 PDT, which is 2026-07-22 09:00 KST.

The event's 100 USD credit is for Codex, not OpenAI API usage. Budget GPT-5.6 API usage separately.

## Product acceptance gate

- [x] Household net worth is calculated as total household assets minus total household debt.
- [x] `krw-net-worth-v1` automatically classifies every inclusive lower boundary from negative net worth at `L1` through KRW 1 trillion or more at `L15`.
- [x] The bands are described as WealthCopy product policy, never as official grades or Korean percentiles.
- [x] Every source level has a reviewed transition anchor: `L1 → L2` through `L14 → L15`, plus `L15 → L15` maintenance.
- [x] The successful JSON body has exactly `{nextLevel, actions, progress}` and each action has exactly `{id, completed}`.
- [x] `X-WealthCopy-Source-Level` carries the server-derived source level outside the JSON body, and all API responses use `Cache-Control: no-store`.
- [x] Exact household amounts are used only for request-time classification and are absent from OpenAI input, response bodies, localStorage, ICS files, analytics, and logs.
- [x] The optional PSID reference is independent from level classification, is not converted to KRW, and is not presented as a verified Korean rank.
- [x] `3/3 · 100%` means action completion only and never causes automatic promotion.
- [x] Month rollover discards the stale classification and requires a fresh household asset snapshot.
- [x] The `wealthcopy-public-plan-v4` record is exactly `{version, monthKey, sourceLevel, plan}`; older plan records are discarded rather than migrated.
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
- [ ] Demo shows automatic household-net-worth classification, a normal transition such as `L7 → L8`, and `L15 → L15` maintenance at KRW 1 trillion or more
- [ ] Demo shows `3/3 → fresh snapshot → reclassification` without claiming automatic wealth attainment
- [ ] Demo keeps the main surface to the next level, exactly three actions, and action-completion progress
- [ ] Demo shows the privacy-safe monthly-check-in ICS connection
- [ ] Demo describes PSID bands as optional self-selected US aggregate references, not Korean verified ranks and not level inputs
- [ ] Demo explains that exact amounts disappear after server classification and never reach GPT-5.6, the success JSON, localStorage, ICS, analytics, or logs
- [ ] Demo or technical appendix verifies the exact three-key JSON body, source-level response header, no-store behavior, and v4 storage shape
- [ ] Code repository URL
- [ ] README covers setup, running, testing, sample data, privacy boundaries, and the full `L1`–`L15` threshold table
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
- [ ] API tests assert the exact success body keys, exact action keys, source-level header, `Cache-Control: no-store`, and consistent fallback shape
- [ ] Storage tests assert the exact v4 record, deletion of incompatible older records, same-month completion carry rules, and mandatory month-rollover reclassification
- [ ] Privacy tests assert that exact amounts are absent beyond classification and the generated ICS contains no financial or model data
- [ ] A manual mobile and keyboard pass confirms 44px targets, native checkboxes, dialog focus handling, visible progress text, and polite live announcements

## Judging lens

The first stage is pass/fail for challenge fit and required technology. The scored stage weights these equally:

1. Technical implementation
2. Design, polish, and complete user experience
3. Potential impact
4. Quality of the idea

WealthCopy's competitive claim should stay precise: it converts asset management from an analysis workflow into a monthly action workflow while keeping classification, safety policy, and AI orchestration behind a three-part public surface. It does not claim that completing actions causes wealth growth.

## Official sources

- Event: https://openai.com/build-week/
- Rules: https://openai.devpost.com/rules
- FAQ: https://openai.devpost.com/details/faqs
- Resources: https://openai.devpost.com/resources
- Submission update: https://openai.devpost.com/updates/45282-openai-build-week-submissions-are-open-plugin-launch
- GPT-5.6 model guide: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6

Recheck Devpost before submission because event details can change. If event pages conflict, use the Devpost rules for submission decisions.
