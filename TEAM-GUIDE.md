# BookMyShowAgent - Team Guide

Read this in 5 minutes. It has every rule you need to follow.
For the *why* behind a rule, or a specific selector trap, open the matching section in
[PROJECT-GENERATION-PROMPT.txt](PROJECT-GENERATION-PROMPT.txt) or the [README](README.md).

---

## 1. What this project is

- Playwright + BDD (Gherkin) UI automation for **BookMyShow** (live production site).
- Stack: TypeScript, `@playwright/test`, `playwright-bdd`. Nothing else.
- Each BookMyShow module is a **service**: Movies, Stream, Events, Plays, Sports, Activities.

## 2. Where things live

| Path | What goes here |
| --- | --- |
| `flows/<service>.md` | User flow in plain words. **This is the source of truth.** |
| `features/<service>.feature` | Gherkin written from that flow. Same name as the flow. |
| `src/services/<service>/<service>.page.ts` | Page Object for that service. Extends `BasePage`. |
| `src/services/<service>/<service>.steps.ts` | Step definitions for that service. |
| `src/support/base.page.ts` | Shared behaviour: home page, city gate, nav tabs, bot-check. |
| `src/support/common.steps.ts` | Steps every service uses (home, city, open tab). |
| `src/support/fixtures.ts` | The one custom `test`. One fixture per service POM. |
| `scripts/check-flow-drift.mjs` | Fails the build when a feature is behind its flow. |
| `reports/screenshots/` | Screenshots from runs. |

Rule: **one flow, one feature, one page object, one steps file per service.**

Two services that render the same pages share a base class instead of copying code:
`TicketedPage` for Events and Sports (Book Now goes to a ticket page), `CataloguePage` for Plays
and Activities (Book Now goes to a date page). Movies and Stream extend `BasePage` directly.

## 2a. What is covered today

| Family | Tag | Which services |
| --- | --- | --- |
| Browse the listing | `@smoke` | all six |
| Filter by group, combine two filters, clear a filter | `@filters` | all except Stream |
| Switch to Mumbai | `@city` | all except Stream |
| Open the first item and read its details | none / `@details` | all six |
| Search for the first item by name | `@search` | all six |
| Walk to the funnel edge and stop | `@booking` | all six (see rule 10) |
| Cinemas and venues directories, with search | `@cinemas` / `@venues` | Movies, Events |
| Actions that need an account | `@auth` / `@account` | Movies, Events, Sports |
| Lazy-loading and the hero carousel | `@browse` | Stream |

## 3. Daily commands

```bash
npm test                 # drift check + bddgen + run everything
npm run test:smoke       # fast check, one happy path per service
npm run test:movies      # one service (also test:stream, test:events, test:plays, test:sports, test:activities)
npm run test:list        # list scenarios, no run
npm run flows:check      # are features in sync with flows?
npm run flows:bless      # re-record flow hashes after you update a feature
npm run report           # open the HTML report
npm run test:account     # only the signed-in (@account) scenarios
npm run auth:refresh     # throw away the saved login and sign in again
```

`npx bddgen` compiles `.feature` files into runnable specs. Every `test:*` script runs it for you.

**Signed-in scenarios.** Scenarios tagged `@account` need a logged-in session. `npm test` signs in
automatically when one is needed and reuses it for about 12 hours. Credentials come from
`BMS_GOOGLE_EMAIL` / `BMS_GOOGLE_PASSWORD` or from `.auth/credentials.json`. The `.auth/` folder
holds live cookies and credentials, so **never commit it**. Everything else runs logged out on
purpose, because some scenarios assert logged-out behaviour.

**CI.** GitHub Actions (`.github/workflows/e2e.yml`) and Jenkins (`Jenkinsfile`) run the same
thing: drift check, then `@smoke` by default, full suite nightly. For Jenkins, point a Pipeline job
at the repo, make sure the agent has Node 20, real Chrome and a display (xvfb on Linux; on Windows
run the agent from a logged-in desktop, not as a service), and add a *Username with password*
credential with id `bms-google` if you want `SUITE=full`. Details: README "Running in CI".

## 4. Ten rules everyone follows

1. **Runs are headed.** Cloudflare blocks headless. A visible Chrome window is normal. Never delete the `headless` or `channel` lines in `playwright.config.ts`.
2. **Never guess a selector.** Open the live page (Playwright MCP) and read the real DOM first.
3. **No class selectors.** Class names are hashed and change every deploy. Use, in order: ARIA role, exact visible text, URL.
4. **Prove results from the URL** where possible. It is the only stable signal on this site.
5. **Never assert with `count()`.** It reads once and gives false greens. Use `await expect(locator.first()).toBeVisible()`. Only exception: inside a scroll loop where the loop itself is the retry.
6. **Steps stay declarative.** A steps file only calls POM methods. No locators, no waits, no `page.*` calls in steps.
7. **Shared behaviour goes in `BasePage` + `common.steps.ts`.** Never copy city or tab logic into a service POM. Never define the same step text in two services.
8. **Conditional flow steps are real conditionals.** "If popup comes" means wait for the popup *or* the next state, not a blind click and not `waitForTimeout`.
9. **Pick "first available", not a pinned value.** Listings, formats and titles change daily. Adding a language should be a table row and nothing else.
10. **Hard stop before inventory.** Movies stop on the showtimes page (change date, open a cinema page: fine; pick a showtime or seat: never). Events and Sports stop on the ticket page (Know more: fine; Add: never). Plays and Activities stop on the date page (pick a date: fine; Proceed: never). Stream stops at seeing Rent/Buy. Never reach payment. This is the live site and those steps hold real inventory.

## 5. Writing a flow file

```
Service Type: Movie

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Movies tab

## Scenario: Filter the listing by language  [smoke]
1) Select Telugu language
2) Movies listing is displayed with the Telugu filter applied

## Scenario: Book the first movie in a language  [booking]
1) Select <language> language
2) Click on whichever show comes first
3) Click on Book tickets

Examples:
| language  |
| Telugu    |
| Tamil     |
```

| In the flow | In Gherkin |
| --- | --- |
| `## Background` | `Background:` |
| `## Scenario: X  [tag]` | `Scenario:` with `@tag` |
| `Examples:` table | `Scenario Outline:` with `Examples:` |
| `<placeholder>` | one Examples column |

- Put steps shared by every scenario in `Background`.
- One placeholder used in several steps stays **one column**. Do not hard-code it in one step and parameterise it in another.
- `@smoke` goes on **one cheap happy path** per service, never on a multi-row outline.
- Background re-runs for every scenario and every Examples row (about 20s each, `workers: 1`). Keep scenarios few.

## 6. Updating a feature from its flow

1. Edit `flows/<service>.md`.
2. Run `/update-feature <service>` in Claude Code (or do it by hand).
3. Check the mapping table it shows: every flow step maps to Gherkin step(s) or is marked MISSING.
4. Add missing steps: Gherkin in the feature, declarative step in `.steps.ts`, browser detail in the POM.
5. Run `npm run test:<service>` until green.
6. Run `npm run flows:bless`, then `npm run flows:check`.

Only bless a feature that covers the **whole** flow. A blessed partial feature hides the gap the check exists to find.

## 7. Adding a new service

1. `flows/<service>.md` starting with `Service Type:`.
2. `src/services/<service>/<service>.page.ts` extending `BasePage`.
3. `src/services/<service>/<service>.steps.ts` importing `test` from `src/support/fixtures.ts`. Reuse the shared steps, do not redefine them.
4. Register the POM in `src/support/fixtures.ts`.
5. `features/<service>.feature` tagged `@<service>`, with `@smoke` on one path.
6. Add `test:<service>` to `package.json`.
7. `npm run flows:bless`, then `npm run flows:check`.

Config globs pick up the new files automatically.

## 8. When a run fails

| You see | It means | Do this |
| --- | --- | --- |
| "Just a moment" / "Checking your browser" | Transient Cloudflare check | Normal. `settleThroughBotCheck()` waits it out. |
| "Sorry, you have been blocked" | Terminal Cloudflare block | Environment problem, not a test bug. Check headed + `channel: "chrome"`. Re-run after a pause. **Do not change selectors.** |
| A step is "undefined" | Steps glob too narrow | Glob must be `src/**/*.steps.ts`, not `src/services/**`. |
| "Multiple definitions matched" | Same step text in two services | Move it to `common.steps.ts`, or tag-scope it with `{ tags: "@movies" }`. |
| Click on "Book tickets" did nothing | Page hydrated after render, click swallowed | Handled in `startBooking()`. It waits for one of: `/buytickets/` URL, format popup, age gate. |
| Test times out at 120s inside a click | A bottom sheet is open and blocking | Every bottom sheet reuses `#bottomSheet-model-close`. Identify the sheet, dismiss it in the POM. |

## 9. Known site traps (short list)

Full detail with handling is in the README "Selector policy" and prompt sections 5 to 7.

- **City picker** has three landing states: already set, bottom sheet open, or header says "Select your region". Wait for one of them, never `count()` once.
- **Language filter** renders two nodes per language, one hidden. Take the first *visible* exact match.
- **Movie cards vs footer links** both match `/movies/`. Scope cards to the city in the URL.
- **Format popup** has no dialog role. Find it by its heading. Scope the format button to the language's `listitem` and skip "Select all".
- **A-rated movies** show an age gate with a "Continue" button before the format popup.
- **Stream page** builds itself as you scroll. Use `window.scrollBy` in a bounded loop, not `mouse.wheel`.
- **Collection headings** contain regex characters. Match with `exact: true`, never an interpolated RegExp.
- **"Stream"** appears in both nav and footer. Always `.first()` on nav links.
