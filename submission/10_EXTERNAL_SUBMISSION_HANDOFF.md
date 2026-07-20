# External submission handoff

Use this page only after the entrant confirms the account-bound actions and signs in to the required services. Do not publish `06_PASS_PROBABILITY.md` or anything in `기획서/`.

## Release facts

| Field | Final value |
| --- | --- |
| Project | WealthCopy |
| Track | Apps for Your Life |
| Tagline | See what separates your household wealth structure from the next band—without handing financial decisions to a model. |
| Live URL | https://wealth-copy-470320899177.asia-northeast3.run.app/ |
| Public repository URL | https://github.com/itproanalysis/wealthcopy-openai-build-week |
| Cloud Run revision | `wealth-copy-00011-zxg` (100% traffic) |
| Product source snapshot commit | `4e52c94` (evidence-only documentation commits follow it on `main`) |
| Codex `/feedback` session ID | `019f5d64-cdd0-7b41-b6a6-2dd3cb4a79fd` |
| Video file | `video/wealthcopy_build_week_demo.mp4` |
| Source archive | `output/wealthcopy_source_release.zip` |

## 1. Publish the code repository

Recommended repository name: `wealthcopy-openai-build-week`

Recommended description:

> Privacy-first next-band household wealth structure report built with Codex and GPT-5.6.

Completed July 20, 2026. The repository was created publicly and the current `main` history was pushed with:

```powershell
gh repo create wealthcopy-openai-build-week --public --source=. --remote=origin --push --description "Privacy-first next-band household wealth structure report built with Codex and GPT-5.6."
gh repo edit --homepage "https://wealth-copy-470320899177.asia-northeast3.run.app/"
```

Verification must confirm that the public repository opens without authentication, `README.md` renders, `LICENSE` is visible, and commit `4e52c94` is in history. The URL is recorded in the root and submission READMEs, `docs/BUILD_WEEK.md`, and `07_SUBMISSION_CHECKLIST.md`.

## 2. Publish the YouTube demo

Upload `video/wealthcopy_build_week_demo.mp4` with visibility set to **Public**.

Title:

> WealthCopy — OpenAI Build Week 2026 Demo | Codex + GPT-5.6

Description:

> WealthCopy turns eight household asset estimates, debt, and cashflow into a privacy-first next-band structure report covering L1 through terminal L15. Financial calculations and safety checks remain deterministic; GPT-5.6 receives only minimized categorical signals and selects four bounded explanation decisions validated by the server. Codex supported the product redesign, implementation, testing, visual QA, and Cloud Run deployment.
>
> Live demo: https://wealth-copy-470320899177.asia-northeast3.run.app/
>
> Source: https://github.com/itproanalysis/wealthcopy-openai-build-week
>
> Educational structure diagnosis only; not investment, tax, legal, credit, or insurance advice.

Before publishing, confirm English audio is audible, runtime is 2:17, HD processing is complete, and visibility says **Public**. Record the public watch URL in `README.md` and `07_SUBMISSION_CHECKLIST.md`.

## 3. Complete the Devpost entry

1. Join OpenAI Build Week and create a project named **WealthCopy**.
2. Select **Apps for Your Life** as the single track.
3. Paste the English copy from `01_DEVPOST_SUBMISSION_EN.md` without adding performance or percentile claims.
4. Add technology tags: Codex, GPT-5.6, OpenAI Responses API, Structured Outputs, Next.js, React, TypeScript, Google Cloud Run.
5. Add the live URL, public repository URL, public YouTube URL, and Codex session ID shown above.
6. Upload screenshots in this order: `03_report_desktop.png`, `05_composition_detail.png`, `07_safety_stop.png`, `08_l15_terminal.png`, `06_report_mobile.png`, then `01_landing_desktop.png` if an additional image is useful.
7. Use `03_TESTING_INSTRUCTIONS_EN.md` for the no-login judge path.
8. Preview the complete entry and verify that every link opens in a signed-out window.
9. The entrant must personally confirm eligibility, ownership, third-party rights, rules, publicity, and Devpost terms in `07_SUBMISSION_CHECKLIST.md`.
10. Submit, then record the project URL, confirmation state, and timestamp in a new `11_SUBMISSION_CONFIRMATION.md`.

## Final public-language guardrails

- Describe levels and composition ranges as WealthCopy-owned internal review policies, not official percentiles or observed Korean household averages.
- Keep PSID server-side: do not surface its name, dollar values, terminology, or implied Korean ranks in the app screenshots or headline copy.
- Do not claim expected returns, optimal allocation, automatic promotion, or transaction recommendations.
- Describe the product as educational structure diagnosis, with safety checks before structural guidance.
