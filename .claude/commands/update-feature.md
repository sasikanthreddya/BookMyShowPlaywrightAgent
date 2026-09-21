---
description: Regenerate a feature file (and its steps/POM) from its flows/*.md user flow
argument-hint: [service]  # e.g. movies — omit to sweep every flow
---

Bring `features/<service>.feature` back in sync with `flows/<service>.md`, including
whatever step definitions and POM methods the flow now needs.

Target service: **$1** — if that is empty, do this for every `flows/*.md`, one at a time.

Nothing in this repo compiles `flows/*.md` into Gherkin; that is your job here.
`npx bddgen` only does `.feature` -> `.features-gen/*.spec.js`.

## Procedure

1. Run `node scripts/check-flow-drift.mjs` to see which flows are out of sync.
2. Read `flows/$1.md` and `features/$1.feature`. Build an explicit step-by-step
   mapping: every numbered flow step -> the Gherkin step(s) covering it, or
   MISSING. Do one mapping table PER SCENARIO. Do not trust step counts — one
   flow step often maps to several Gherkin steps (an action plus its
   assertions), and with a Background plus several scenarios the totals are
   meaningless, so equal counts can still hide a gap. Report the tables to the
   user before editing.
3. For each MISSING step, write the Gherkin into `features/$1.feature`, then add:
   - a step definition in `src/services/$1/$1.steps.ts` — declarative only, no
     browser detail;
   - the browser detail as a method on `src/services/$1/$1.page.ts`;
   - if the behaviour is shared across services, put it on
     `src/support/base.page.ts` instead, and register any new POM in
     `src/support/fixtures.ts`.
4. Run `npm run test:smoke` (or `npx playwright test --grep @$1`) until green.
5. Run `npm run flows:bless` to record the new flow hash, then
   `node scripts/check-flow-drift.mjs` to confirm it is clean.
6. Report what changed, and anything you deliberately did not automate.

## Flow file format

A flow may be a single numbered list (one scenario), or scenario-aware:

```markdown
Service Type: Movie

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected

## Scenario: Filter the listing by language  [smoke]
1) Select Telugu language

## Scenario: Book the first movie in a language  [booking]
1) Select <language> language
2) If popup comes, select the first available format for <language>

Examples:
| language |
| Telugu   |
| Tamil    |
```

Translate it as:

- `## Background` -> Gherkin `Background:`. Everything shared by every scenario
  goes here so it is written once. Remember it re-runs for EVERY scenario and
  every Examples row, so each row is a full live journey: keep it short, and do
  not move anything scenario-specific into it.
- `## Scenario: <name>  [tag]` -> `Scenario:` plus `@tag`. No tag means no tag
  beyond the feature-level `@<service>`.
- An `Examples:` table -> `Scenario Outline:` with that table. Prefer one
  outline with N rows over N near-identical scenarios.
- `<placeholder>` -> an Examples column. **A placeholder used in more than one
  step must stay one column**: that is how the flow says "the language I
  filtered by is the language I pick in the popup". Never hard-code a value in
  one step and parameterise it in another — that is a silent contradiction the
  moment the table changes.
- Keep `@smoke` on ONE cheap happy path, not on an outline with many rows.
  Long-tail and funnel scenarios belong behind their own tag (`@booking`).

Prefer taking "whatever the page offers first" over pinning a value when the
underlying data rotates. Format availability, for instance, is per-movie AND
per-language, and the movie changes daily, so `firstFormatIn(language)` is
robust where a hard-coded "EPIQ" is a coin flip.

## Project rules you must follow

- **Never guess a selector.** BookMyShow uses hashed styled-components classes
  (`sc-7o7nez-0 fPrTaH`) that change between deploys. Open the real page and read
  the DOM. Prefer roles, exact visible text, and URL assertions. Known traps are
  documented in README.md "Selector policy".
- **Runs must be headed.** Cloudflare blocks headless; `playwright.config.ts`
  explains the measured matrix. Do not "fix" a block by changing selectors.
  `BasePage.assertNotBlocked()` already reports a block clearly.
- **Conditional flow steps** ("if a popup appears") must be guarded with a
  `count()` check, the way `BasePage.ensureCity()` does — never an unconditional
  click, and never a bare `waitForTimeout` standing in for a condition.
- **One POM + one steps file per service.** Cross-service behaviour belongs in
  `BasePage`.
- **Watch for step-text collisions.** All services share ONE step registry, so
  duplicate step text fails `bddgen` with "Multiple definitions matched scenario
  step." Either hoist the step so both services use it, or tag-scope it:
  `Given("...", { tags: "@$1" }, ...)`.
- If you hoist shared steps into a new file outside `src/services/**`, widen the
  `steps` glob in `playwright.config.ts` to `src/**/*.steps.ts` — otherwise the
  file is silently not loaded and its steps come out undefined.
- Tag each feature `@<service>`, and keep `@smoke` on the scenario that is the
  service's basic happy path.

## Stop and ask

This drives the live production site. If a flow step enters the booking funnel
past selecting a format/showtime — seat selection, payment, or anything that
holds or buys a real ticket — do not automate it. Ask the user where to stop
first, and say plainly in your report which steps you left out and why.
