# BookMyShowAgent

Playwright + BDD (Cucumber Gherkin via `playwright-bdd`) UI automation for BookMyShow.

Every BookMyShow module is treated as a **service** — Movies, Stream, Events, Plays,
Sports, Activities. Each service owns exactly one Page Object and one step-definition
file. User flows are authored as markdown under `flows/` and converted into executable
Gherkin + Playwright code.

## Layout

```
flows/<service>.md                     user flow, authored first (movies, stream, events, plays, Sports, activities)
features/<service>.feature             Gherkin written from that flow, same name
src/support/base.page.ts               cross-service behaviour (landing, city gate, nav tabs, filters, search,
                                       sign-in, details sections, directories, payment guard)
src/support/catalogue.page.ts          shared shape for the date-first services (Plays, Activities)
src/support/ticketed.page.ts           shared shape for the ticket-first services (Events, Sports)
src/support/common.steps.ts            steps shared by EVERY service (home page, city, tabs, filters, search, ...)
src/support/auth.setup.ts              setup project: signs in once, writes .auth/user.json
src/support/fixtures.ts                the single custom `test`, one POM fixture per service
src/services/<service>/<service>.page.ts    one POM per service (Movies and Stream extend BasePage directly)
src/services/<service>/<service>.steps.ts   one step-definition file per service
scripts/check-flow-drift.mjs           fails the build when a feature lags its flow
.github/workflows/e2e.yml              CI: flow-drift gate, @smoke on PR, full suite nightly
Jenkinsfile                            Same pipeline for Jenkins: SUITE=smoke|anonymous|full, nightly full
reports/screenshots/                   execution evidence

A feature file must be named after its flow (flows/X.md <-> features/X.feature); that pairing
is what the drift check uses.
```

## Running

```bash
npm test                          # drift check + bddgen + run every scenario
npm run test:smoke                # only @smoke-tagged scenarios
npm run test:movies               # only @movies-tagged scenarios
npm run test:events               # only @events-tagged scenarios
npm run test:plays                # only @plays-tagged scenarios
npm run test:activities           # only @activities-tagged scenarios
npm run test:sports               # only @sports-tagged scenarios
npm run test:stream               # only @stream-tagged scenarios
npm run test:list                 # list scenarios without running them
npm run auth:capture              # capture a signed-in session (see "Signed-in scenarios")
npm run test:account              # only the signed-in scenarios
npm run flows:check               # are features in sync with flows/*.md?
npm run flows:bless               # re-record flow hashes after regenerating
npx bddgen                        # compile .feature -> runnable Playwright spec only
```

`npx bddgen` is `playwright-bdd`'s compiler. A `.feature` file is not executable on its
own; bddgen turns it into a Playwright spec under `.features-gen/`. `npm test` does both.

## Environment notes, verified 2026-09-17

**Cloudflare blocks headless browsers. Runs must be headed.** Measured against the live
site one variable at a time:

| Browser | Mode | Result |
| --- | --- | --- |
| bundled Chromium | headless | blocked |
| real Chrome (`channel: "chrome"`) | headless | blocked |
| real Chrome (`channel: "chrome"`) | **headed** | **HTTP 200, genuine page** |
| real Chrome + persistent `.chrome-profile` | headed | blocked |

Headless is the single setting that decides it, and Playwright defaults it to `true`, so
`playwright.config.ts` sets `headless` explicitly along with `channel: "chrome"` and
`--disable-blink-features=AutomationControlled`. Do not remove any of them — dropping the
`headless` line silently reintroduces the block. A visible Chrome window during a run is
expected, not a bug.

The checked-in `.chrome-profile/` is **not** wired into the test run; that profile's state is
itself flagged by Cloudflare and is blocked even headed.

Cloudflare has **two** responses, and they need opposite handling:

- A *transient* interstitial headed **"Performing security verification"** — a JS challenge that
  clears itself after a few seconds and then renders the real page. Observed on roughly one run
  in five. `BasePage.settleThroughBotCheck()` waits it out. Failing on sight would be wrong;
  so would ignoring it, because every locator is missing while it is up (it previously surfaced
  as a 30s timeout inside `ensureCity`, blaming the city picker for a page that was never
  BookMyShow).
- A *terminal* block headed **"Sorry, you have been blocked"** — never clears.
  `BasePage.assertNotBlocked()` fails immediately with an explanatory error, so it surfaces as a
  clear message on the first step rather than a two-minute timeout on an unrelated locator.

Set `BMS_HEADLESS=1` to deliberately reproduce the terminal blocked state.

**Dependencies are shared with ClickToPay_QA.** `npm install` fails on this machine with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` because a corporate TLS proxy breaks the npm
certificate chain. As a workaround `node_modules/` is a directory junction to
`C:\Users\sasikanthreddy.annap\ClickToPay_QA\node_modules`, which already holds the exact
required versions (`playwright-bdd` 9.2.0, `@playwright/test` 1.61.1). Consequence:
installing or upgrading packages in either project affects both. The permanent fix is to
point npm at the corporate CA bundle via `NODE_EXTRA_CA_CERTS`, then run a real install here.

## Running in CI

`.github/workflows/e2e.yml` has three jobs:

| Job | When | What |
| --- | --- | --- |
| `flows` | every trigger | `npm run flows:check` — browserless, seconds, and catches a feature that has fallen behind its flow |
| `smoke` | PR / push | `@smoke` only, anonymous project, **no credentials needed** |
| `full` | nightly + manual | everything, including `@account` |

Two things make a CI runner different from this laptop, and both are handled:

- **`xvfb-run -a` is mandatory.** Cloudflare blocks headless outright (matrix
  above), so the runner needs a virtual display rather than `headless: true`.
  A CI job that "fixes" a block by flipping headless on will get the terminal
  block page, and `assertNotBlocked()` will say so.
- **`npx playwright install --with-deps chrome`**, not the bundled Chromium:
  measured, bundled Chromium is blocked even headed, and the config pins
  `channel: "chrome"`.

The `full` job passes `BMS_AUTH_MAX_AGE_HOURS: 0` (a fresh runner never has a
session to reuse) and `BMS_AUTH_WAIT_MINUTES: 0` (nobody is there to finish a
2FA challenge, so fail fast rather than hang). Credentials come from the
`BMS_GOOGLE_EMAIL` / `BMS_GOOGLE_PASSWORD` repository secrets; without them the
`@account` scenarios fail with instructions instead of passing hollowly.

`concurrency` cancels superseded runs on a branch. That is not tidiness: this
drives the live production site with `workers: 1`, and parallel runs multiply
the bot-detection exposure.

**Untested, and worth knowing before you rely on it:** the workflow has not run
on GitHub's infrastructure from here. Cloudflare treats datacenter IP ranges
differently from residential ones, and GitHub-hosted runners live in one, so
the suite may be blocked there even with a display attached. If that happens it
will be obvious — `assertNotBlocked()` reports it as an environment failure on
the first step, not as a selector bug — and the fix is a **self-hosted runner**
on a normal network, which needs no change to the workflow beyond `runs-on`.
There is also no `package-lock.json` in this repo, so CI uses `npm install`
rather than `npm ci`; adding a lockfile would make CI builds reproducible.

### Jenkins

`Jenkinsfile` at the repo root is the same pipeline for Jenkins. Create a
*Pipeline* (or Multibranch Pipeline) job pointing at this repo with "Pipeline
script from SCM"; the file is picked up by name.

| Parameter | Choices | Effect |
| --- | --- | --- |
| `SUITE` | `smoke` (default), `regression`, `full` | smoke = `@smoke` only; regression = every scenario except `@account`; full = regression plus the signed-in `@account` scenarios. The 01:30 UTC timer runs full. |
| `SERVICE` | `all`, `movies`, `events`, `plays`, `activities`, `sports`, `stream` | narrows any suite to one service |
| `TAG` | `all`, `@filters`, `@booking`, `@city`, `@search`, `@details`, `@auth`, `@cinemas`, `@venues`, `@browse`, `@sporttype` | narrows regression/full to one kind of scenario; ANDed with `SERVICE`; ignored for smoke |
| `GREP` | free text | raw Playwright `--grep` regex for anything the dropdowns cannot express, e.g. `@movies|@events`; overrides `SERVICE` and `TAG` |
| `INSTALL_CHROME` | tick once | `npx playwright install chrome` on a fresh agent |

Every build runs `npm install`, `npm run flows:check` and `npx bddgen` first. Smoke and
regression use `--project=anonymous` and need no credentials; full runs all three Playwright
projects and needs the `bms-google` credential. Two tags are combined into one regex with
lookaheads, `(?=.*@movies)(?=.*@filters)`, because Playwright's `--grep` takes a single
pattern. A `SERVICE`+`TAG` pair that matches no scenario (say sports + `@cinemas`) fails the
build with Playwright's "no tests found" rather than passing on zero tests.

Locally the same three suites are `npm run test:smoke`, `npm run test:regression` and `npm test`.

What the pipeline expects from the agent, because it deliberately installs none of it:

- **Node 20+ and real Google Chrome on PATH.** Tick `INSTALL_CHROME` once on a
  fresh agent to have Playwright install Chrome (needs root/admin).
- **A display.** On Linux the browser stages are wrapped in `xvfb-run -a`, so
  `xvfb` must be installed. On Windows there is no xvfb: run the agent from a
  logged-in desktop session (`java -jar agent.jar ...` in a terminal). A Jenkins
  Windows *service* runs in session 0 with no desktop, and Chrome launched there
  is the closest thing to headless, which Cloudflare blocks. If `assertNotBlocked()`
  fires on the first step of every scenario, this is the first thing to check.
- **Credentials for `SUITE=full`:** a *Username with password* credential with
  id `bms-google` (username = Google email, password = Google password). The
  pipeline binds it to `BMS_GOOGLE_EMAIL` / `BMS_GOOGLE_PASSWORD` for the run
  only. `smoke` and `anonymous` never touch it, so a job with no credential
  configured still works for those.

The pipeline sets `BMS_AUTH_MAX_AGE_HOURS=0` and `BMS_AUTH_WAIT_MINUTES=0` for
the same reasons as the GitHub workflow, and `disableConcurrentBuilds` aborts a
superseded build rather than queueing it, for the same reason `concurrency` does.

Results land in three places: the `junit` step reads `reports/junit.xml` (a
`junit` reporter was added to `playwright.config.ts` for this, and only this),
`reports/` and `test-results/` are archived as build artifacts, and if the HTML
Publisher plugin is installed the Playwright report is linked from the build
page. Without that plugin, or with a broken one, the pipeline says so and moves on.

## Flow file format

A flow is either a single numbered list (one scenario) or scenario-aware:

```markdown
Service Type: Movie

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Movies tab

## Scenario: Filter the listing by language  [smoke]
1) Select Telugu language

## Scenario: Book the first movie in a language  [booking]
1) Select <language> language
2) If popup comes, select the first available format for <language>

Examples:
| language  |
| Telugu    |
| Tamil     |
| Malayalam |
```

| In the flow | In Gherkin |
| --- | --- |
| `## Background` | `Background:` |
| `## Scenario: X  [tag]` | `Scenario:` + `@tag` |
| `Examples:` table | `Scenario Outline:` + `Examples:` |
| `<placeholder>` | an Examples column |

**A placeholder used by more than one step must stay one column.** That is how the flow says
"the language I filtered by is the language I pick in the popup". Hard-coding a value in one
step while parameterising it in another is a silent contradiction the moment the table changes
— it was a real bug in this flow: step 4 read "select Telugu 2D" regardless of the language
chosen in step 1.

Prefer "whatever the page offers first" over pinning a value when the data rotates. Format
availability is per-movie AND per-language — measured on one title, the Tamil row offered only
`2D` while Telugu offered `2D`, `EPIQ` and `HDR By Barco` — and the scenario opens a different
movie every day, so a hard-coded `EPIQ` is a coin flip. `MoviesPage.firstFormatIn(language)`
takes whichever the row lists first, excluding the row's "Select all" bulk control.

Adding a language is then a table row and nothing else: Tamil and Malayalam were verified to
need **no new step definitions or POM code**.

### Cost of scenarios

`Background` re-runs for every scenario AND every Examples row, so each row is a full live
journey (~20s). `workers: 1`, so nothing parallelises — raising it would multiply the
bot-detection exposure described above. Keep `@smoke` to one cheap happy path and put the
funnel and long tail behind their own tags (`@booking`), then run the full set deliberately:

```bash
npm run test:smoke      # one language, no booking funnel
npm run test:movies     # all movies scenarios, every language
npm test                # everything, plus the drift gate
```

## What the Movies deep dive found

### Search: the honest assertion is a count, not a title

The obvious test — "search for a film, assert the results contain it" —
**cannot be written truthfully here**, and writing it anyway would produce a
scenario that passes while search is broken. Measured 2026-09-21:

- The counter is its own `<span>` ("Showing 10 results"). Its ancestors six
  levels up hold only the counter and the category tabs (`All / Movies /
  STREAM / Events / …`), so the **result rows are siblings** and no element
  contains both.
- The rows do not render a movie as a titled link. Searching for a
  currently-showing film produced exactly **one** anchor containing its
  title — the listing card on the page *underneath* the overlay.
- **Enter does not submit.** The URL never changes, so there is no results
  page to assert against.

Put together: any `toContainText(title)` available here would be satisfied by
the page behind the panel. So the scenario asserts a **non-zero count** for a
query taken from today's own listing, which still fails if the query never
reaches the backend. The query comes from the first card's **`img` alt** — the
only place the clean title appears without certification and languages glued
to it (`"Mandaadi UA16+ Tamil, Telugu, …"`).

### The details page, and the showtimes page

A now-showing movie page carries `h1 <title>`, `In cinemas`, a rating node
(`9.4/10 (190+ Votes) Rate now 1h 57m •` — one text node), and `h4` headings
`About the movie` and `Cast`. The rating is asserted by **shape** (`n/10`),
never by value.

The `/buytickets/` page is now **read** rather than merely reached: cinemas are
grid `row`s (`"INOX GVK One, Banjara Hills: Hyderabad Non-cancellable 02:35 PM"`)
holding one `button "02:35 PM"` per showtime, matched by time *shape*. No
showtime is ever clicked — that leads to seat selection, and seats are real
inventory.

### A third account-gated action

The cinemas directory renders one `Add to favourites` per cinema (48 in
Hyderabad). Clicking one logged out goes to `/login/?referer=/hyderabad/cinemas`
— the same gate as `I'm interested`, and the same URL-as-truth proof.

## A second city, and why switching is its own problem

Hyderabad is the default, set in the `Background`. Gherkin cannot parameterise
a `Background`, so the `@city` scenario switches city *inside* the scenario —
which is the part worth testing anyway, because selecting a city and
**changing** it are different flows:

- Before any city has been chosen, the header reads **"Select your region"**.
- Once one is set, that text is gone and the header shows a **button named for
  the current city** instead. `BasePage.cityPickerTrigger` reads the current
  city from the URL and covers both states; the pre-selection locator alone
  simply times out when switching.
- The picker that opens has a `textbox "Search for your city"` above "Popular
  Cities", and its own bottom-sheet overlay intercepts the click on the target
  city — so `clickPastDeadSheet()` is what actually lands it.

Measured in Mumbai: `/explore/movies-mumbai?cat=MT`, `h1 "Movies in Mumbai"`,
16 cards at `a[href*="/movies/mumbai/"]`, and `?languages=telugu` behaves
identically. Nothing but the Background is Hyderabad-specific.

`openServiceTab()` also had to stop requiring the URL to **change**: after a
city switch the browser may already be on that service's listing, and clicking
its tab then changes nothing, timing out on a click that worked.

## Plays and Activities share one implementation

Measured 2026-09-21, these two services are the same pages with a different
slug, so `src/support/catalogue.page.ts` holds the behaviour once and
`PlaysPage` / `ActivitiesPage` are a slug plus a display name:

```
listing   /explore/<slug>-hyderabad?cat=XX    h1 "<Service> in Hyderabad"
cards     a[href*="/<slug>/"][href*="/ET"]    absolute, no city segment
details   /<slug>/<title>/ET<id>              CTA "Book Now" as a LINK
booking   /<slug>/<title>/ET<id>/date-time/<venue>
```

The booking page renders `h3 "Select Date"`, one button per date whose
accessible name is the **date code** (`20261002`) and whose visible text is
`Fri 02 Oct` — so the eight-digit name is the stable, locale-independent
handle. Plays then shows a disabled **Seats** step where Activities shows a
disabled **Ticket**; both show a disabled **Review & Proceed to Pay**. The
suite stops there, choosing no date.

`EventsPage` deliberately does **not** extend `CataloguePage`: its CTA skips
the date step and goes straight to `/ticket/<venue>/<id>`, and its details page
carries an "*N* are interested" count the others do not. Folding it in would
mean parameterising the two things that actually differ.

Their step definitions are **tag-scoped** (`{ tags: "@plays" }` /
`{ tags: "@activities" }`) because the two services read identically, so the
same step text serves both and only the tag picks the POM — the pattern
described under "Step definitions are one shared registry".

## Events service

Grounded against the real page on 2026-09-21 (Hyderabad):

- The nav item is `link "Events"` -> `/explore/events-hyderabad?cat=CT`. The
  category code is **CT**, not `EV`: every other service's code tracks its name
  (MT/PL/SP/AT) and this one does not, so it cannot be inferred.
- The listing is flat — `<h1> "Events in Hyderabad"` plus 29 cards — like Sports
  and unlike Stream's curated carousels.
- Cards are `a[href*="/events/"][href*="/ET"]`, **absolute and with no city
  segment** (`https://in.bookmyshow.com/events/<slug>/ET00515819`), unlike
  Movies cards which are city-scoped. The opened event is identified by its
  href slug; the clean title lives in the card's `img.alt` (and an `<h3>`),
  which is what the search scenario reads.
- An event page renders the title as `<h1>`, the text "*N* are interested"
  — a read-only count, **not** an "Interested" control — `h2 "About The Event"`
  behind a `button "Read More"` / `"Read Less"` toggle, and **"Book Now" as a
  LINK**.
- **Sports is the same page, end to end.** Re-measured 2026-09-21: the Sports
  listing, details page and ticket page have exactly this shape (an earlier
  note here recorded Sports' "Book Now" as a button; it is a link). So
  `EventsPage` and `SportsPage` are a slug and a name on top of one shared
  `TicketedPage`, the way Plays and Activities share `CataloguePage`. The two
  bases stay separate because their "Book Now" lands on different pages: a
  ticket page (Events, Sports) versus a date-time page (Plays, Activities).

### Where the Events funnel stops

"Book Now" goes to `/events/<slug>/ET<id>/ticket/<venue>/<id>`. Measured on
that page while logged out:

```
heading "<event title>"
button "Ticket": 1 Ticket
button "Add" / "Know more"            (one pair per ticket type)
button "Login To Book" [disabled]
button "Review & Proceed to Pay" [disabled]
```

The suite asserts those exist and stops. **No ticket is added**, so nothing is
held: on this site an "Add" is a real inventory action. `Login To Book` is what
a logged-out visitor is offered, which is what proves the funnel is
account-gated without booking anything.

## "I'm interested" is text, not a button

On a coming-soon movie page (reached from `link "Coming Soon"` on the Movies
listing) there is no "Book tickets" — the page offers *"Mark interested to know
when bookings open"* and **"I'm interested"**.

That control is a single `<span class="sc-1qdowf4-0 fnRjrw">` with **no role
attribute**, so `getByRole("button", { name: /Interested/i })` returns **zero**
and a role-based probe concludes, wrongly, that the feature does not exist. The
class is a hashed styled-component name and must not be used; exactly one
element carries the text, and its apostrophe is a plain ASCII quote (char 39).

Clicking it while logged out navigates to:

```
/login/?referer=/movies/hyderabad/the-paradise/ET00436621
```

so that URL is the stable proof the action is account-gated — URL-as-truth
again, rather than asserting on the sheet that also appears.

### The same page reads differently depending on who is looking

Measured on "The Paradise", logged out and then signed in:

```
logged out : 313K+ are interested   Mark interested to know when bookings open   I'm interested
signed in  : You and 316K+ are interested   Movie added to your Wishlist in your Profile   View
```

The logged-out copy is **not** a subset of the signed-in copy, so an assertion
written against one state fails against the other — and once interest is
marked, the control is gone for good on that title.

That makes "mark the first upcoming movie" a scenario that stops testing
anything the moment it succeeds once: on the next run the click either fails
(control absent) or is skipped by an "if offered" guard, and the mutation goes
unverified either way. It really did pass that way once here, against a title
the account had marked long before. `openFirstUpcomingMovieOfferingInterest()`
therefore walks the listing for a title this account has **not** marked, so the
click stays real on every run.

### Marking interest is one-way, so the scenario spends a fixture

There is no un-do. Measured 2026-09-21: a marked title offers only **View**
(to `/my-profile/wishlist`) and no un-mark control, and that wishlist page
renders as **"Hi, Guest"** for an automated session even though the same
session shows personalised state on the movie page — so no removal path could
be established.

That makes the scenario state-consuming by nature: each run marks one more
coming-soon title, and it walks the whole listing (~19) looking for an
unmarked one. When they are all marked it fails with instructions rather than
quietly degrading into a weaker assertion. **A one-way action with no un-do
cannot be verified without spending a fixture**, and pretending otherwise
would mean a test that no longer tests the action. The pool also refills as
BookMyShow adds releases.

### The signed-in contrast on the Events ticket page

Same page, same ticket types, measured both ways:

| | `Login To Book` | `Proceed to Pay` | `Add` |
| --- | --- | --- | --- |
| logged out | **present** (disabled) | present (disabled) | 4 |
| signed in | **absent** | present | 4 |

So the button's disappearance is what proves the account was recognised, and
the ticket types still being listed proves the page is not merely broken.
Neither run adds a ticket or touches the pay CTA.

### "I'm interested" is swallowed by hydration too

Third instance of the hazard `startBooking()` documents: the span is visible,
stable and hit-testable **before React attaches its handler**, so an immediate
click is swallowed silently and the page still reads "Mark interested to know
when bookings open" twenty seconds later. `markInterested()` verifies the
outcome and only retries the click when the confirmation has not arrived.

## Booking funnel boundary

`flows/movies.md` ends at selecting a language and format ("Telugu 2D"), and so does the suite.
The `@booking` scenario clicks **Book tickets**, selects the format from the popup, and stops.
It does not choose a cinema, a showtime or a seat, and never reaches payment — this drives the
live production site, where those steps can hold real inventory.

Proof that the format selection worked comes from the URL, not from the showtimes UI. Measured
2026-09-17, selecting Telugu 2D lands on:

```
/movies/hyderabad/mandaadi/buytickets/ET00514261/20260917?etCodes=...&language=telugu&...
```

so `/buytickets/` plus `language=<lang>` is the stable signal — the same URL-as-truth approach
used for the language filter, and the reason nothing further needs to be clicked to verify it.

### Two traps between "Book tickets" and the popup

Both cost a confusing failure before being found, and both are handled in
`MoviesPage.startBooking()`:

- **A-rated titles open an age gate first**, not the format popup: a bottom sheet reading
  *'This movie is rated "A" and is only for viewers above 18…'* with a single **Continue**
  button. UA16+ titles skip it, which is why Telugu and Tamil never hit it and only the
  Malayalam example failed — the first Malayalam title that day happened to be A-rated.
- **The details page hydrates after it renders.** "Book tickets" is visible, enabled and
  stable before React attaches its click handler, so a click landing in that window is
  swallowed **silently**; Playwright's actionability checks cannot detect it. It surfaced as
  a `/buytickets/` assertion failing several steps later, blaming the wrong thing.

So `startBooking()` clicks and then waits for one of three real outcomes — navigation, the
format popup, or the age gate (clicked through, then keep waiting) — and only retries the
click when **no** sheet is open. That last condition matters: BookMyShow reuses
`id="bottomSheet-model-close"` for *every* bottom sheet (city picker, age gate, format
popup) and the overlay intercepts pointer events, so a blind retry does not fail fast — the
click retries until the 120s test timeout.

The general lesson, and the third instance of it in this repo: **verify the outcome of an
action, not just that the action was dispatched.**

Two notes for anyone extending this:

- **"Telugu 2D" is not one element.** The popup is a list with one `listitem` per language; the
  row text is the language and the formats are buttons inside it. A bare button named `2D` is
  ambiguous — Tamil has one too, and the page body separately contains *links* named "2D",
  "IMAX 2D" and "DOLBY CINEMA 2D". Scoping to the language's row is what disambiguates.
- The popup only appears for multi-format titles, so the step treats its absence as "not
  prompted" rather than a failure — via a bounded `waitFor`, not a one-shot `count()`.

## Filters are shared, and their URL encodings are measured

Every listing uses the same left-rail component, so `applyFilterOption(group,
option)` lives on `BasePage` and the steps are in `common.steps.ts`. Defining
them per service would fail `bddgen` with *"Multiple definitions matched
scenario step."*

Two traps, both measured 2026-09-21:

- **The group header is a toggle, and groups do not start in the same state.**
  Movies opens with `Languages` expanded, Events with `Categories` expanded,
  everything else collapsed. Clicking the header of an already-expanded group
  *collapses* it and hides the option you were about to click, so the header is
  only clicked when the option is not already visible.
- **Options render more than once.** The Events listing shows `Comedy Shows`
  twice *visibly* — the filter rail and a quick-chip row under the H1 — on top
  of BookMyShow's usual hidden duplicates. Same trap `SportsPage` documents on
  `Cricket`.

The expected URL fragment lives in the feature's `Examples` table rather than
being derived in code, because the encodings are not guessable from the label:

| Listing | Group | Option | URL |
| --- | --- | --- | --- |
| Movies | Languages | Telugu | `languages=telugu` |
| Movies | Genres | Action | `genres=action` |
| Movies | Format | 2D | `format=2D` — **case preserved** |
| Events | Categories | Comedy Shows | `categories=comedy-shows` |
| Events | Date | Today | `daygroups=today` |
| Events | Languages | English | `languages=english` |
| Events | Price | Free | `priceGroup=0to0` — **not** a slug of "Free" |
| Plays | Plays Type | Theatre | `categories=theatre-plays` — **not** `theatre` |
| Plays | Price | Free | `priceGroup=0to0` |
| Activities | Categories | Adventure | `categories=adventure` |

`Free -> 0to0` and `Theatre -> theatre-plays` are the reason for the table. A
helper that lowercased and hyphenated the label would produce `priceGroup=free`
and `categories=theatre`, wrong in a way that still looks right. Note also that
the group is `Languages` on Movies and Events but `Language` on Plays.

### Combining and clearing filters

Filters compose with `&`: `?languages=telugu&genres=drama`. Each group's
`Clear` clears **only that group** — measured, the first visible `Clear`
removed `languages` and left `genres=drama` standing — which is why
`clearFirstFilter()` is only unambiguous in a scenario that controls how many
filters are applied.

### A filter that matches nothing is not a failure

Filter scenarios assert **the URL and that we are still on the listing** — not
that result cards exist. Asserting cards conflates "the filter was applied"
with "this city has matching inventory today", and the second is not something
a test should require.

This is measured, not theoretical: on 2026-09-21 Plays with `Price: Free` and
Plays with `Date: Today` both matched **zero** items in Hyderabad, and the
scenarios failed on an empty listing while the filter itself worked perfectly.
Sports documents the same hazard from the other side, where `Cricket` matched
exactly one event.

## Signed-in scenarios

Scenarios tagged `@account` run in a separate Playwright project that loads
`.auth/user.json` as `storageState`. Everything else runs in the `anonymous`
project, and must: several scenarios assert *logged-out* behaviour (marking
interest redirects to `/login/`) and would fail against a signed-in browser.
Both projects compile the same `features/*.feature`, split by tag.

**Signing in is a setup project, not a chore.** `src/support/auth.setup.ts` is
declared as a `dependencies` of the `account` project, so `npx playwright test`
runs it first, automatically, and only when the run actually includes
`@account` scenarios. It re-uses a session younger than
`BMS_AUTH_MAX_AGE_HOURS` (default 12) instead of logging in every time, so the
cost is paid about once a day.

```bash
npm test                 # signs in automatically if a session is needed
npm run auth:capture     # run just the setup project
npm run auth:refresh     # discard the saved session and sign in again
```

Credentials come from `BMS_GOOGLE_EMAIL` / `BMS_GOOGLE_PASSWORD`, or from
`.auth/credentials.json`:

```json
{ "email": "you@gmail.com", "password": "..." }
```

`.auth/` is gitignored — it holds live session cookies *and* the credentials
file, so nothing in it may ever be committed. `.auth/last-signin.log` records
the steps of the most recent sign-in, because a setup project's stdout is not
reliably surfaced by the reporter and a stalled sign-in is otherwise silent.

### Google SSO, and the step no locator can reach

Measured against the live site on 2026-09-21, one step at a time:

- The sign-in sheet (heading **"Get Started"**) offers Google, Email, Apple and
  a mobile number.
- **Continue with Google** opens a *popup* at `accounts.google.com`, continuing
  to `.../gsi/fedcm/signincontinue` — Google Identity Services over FedCM. The
  popup arrives as a new **context** page; a page-scoped
  `page.waitForEvent("popup")` missed it, `context.on("page")` catches it.
- Google's identifier field is `textbox "Email or phone"`, **not**
  `input[type=email]`. A type-based locator finds nothing and times out on a
  form that is plainly on screen.
- **Google accepts the credentials from an automated browser.** There is no
  "this browser or app may not be secure" wall.
- Google may then interpose a **passkey-enrolment speedbump** ("Sign in
  faster"), whose dismiss control sits below the fold.

Then the popup closes and the sign-in **stalls indefinitely** — header still
offering "Sign in", sheet reset — which reads exactly like BookMyShow dropping
the callback. It is not.

The last step of the flow is a dialog Chrome draws itself:

```
Sign in to bookmyshow.com with google.com
  To continue, google.com will share your name, email address …
  [Back]  [Cancel]  [Continue]
```

**That dialog is browser UI, not page DOM.** It is absent from every
accessibility snapshot and unreachable by any Playwright locator, so
page-level automation waits forever on a button it can neither see nor click.
This cost a wrong diagnosis once already — "BookMyShow never completes the
handoff" — and no selector change could ever have fixed it.

CDP's `FedCm` domain drives that dialog, which is what makes the capture fully
automatic:

```js
const cdp = await context.newCDPSession(page);
await cdp.send("FedCm.enable", { disableRejectionDelay: true });
cdp.on("FedCm.dialogShown", (e) =>
  cdp.send("FedCm.selectAccount", { dialogId: e.dialogId, accountIndex }));
```

It must be enabled **before** the flow starts — the dialog is raised at the end
of it, and an un-enabled domain simply never reports it. The account is chosen
by matching `BMS_GOOGLE_EMAIL`, not by assuming index 0: the dialog lists every
Google account signed in to that browser.

A human fallback is kept for what automation should not fake — 2-step
verification or a device challenge. Set `BMS_GOOGLE_EMAIL` /
`BMS_GOOGLE_PASSWORD`; never hard-code them, the file is committed.

### An action with no timeout hangs the whole test

Moving this flow from a standalone script into the setup project broke it, and
the code was identical. The cause is a default that differs by context:

| | default `actionTimeout` |
| --- | --- |
| Playwright **library** (a plain `node script.mjs`) | 30s |
| Playwright **test runner** | `0` — wait forever |

The flow probes for "Wrong password" to report a bad credential by name. That
locator matches nothing on the **happy path**, and `textContent()` waits for
its element — so under the runner every *successful* sign-in hung on that
probe until the test timed out, reporting a timeout at some unrelated later
line. `playwright.config.ts` now sets `actionTimeout` explicitly, and the probe
carries its own short one. **Any locator call that is expected to find nothing
must be given a timeout.**

`BasePage.assertSignedIn()` gates every `@account` scenario. Without it a
missing session would let a contrast assertion ("was not asked to sign in")
pass trivially, because the action never got far enough to ask — a green run
over no coverage, which this repo treats as worse than a red one.

## Keeping flows and features in sync

`flows/*.md` is the source of truth, but **nothing compiles it into Gherkin** — that is a
human/agent step. `npx bddgen` only does the second hop:

```
flows/movies.md  --(no tool; run /update-feature)-->  features/movies.feature
features/movies.feature  --(npx bddgen)-->  .features-gen/movies.feature.spec.js
```

So a feature can silently fall behind its flow while the suite still passes — a green run
over incomplete coverage, which is worse than a red one. Two things guard against that:

- **`/update-feature <service>`** ([.claude/commands/update-feature.md](.claude/commands/update-feature.md))
  regenerates a feature from its flow and adds the step definitions and POM methods the new
  steps need. Run it after editing any flow.
- **`npm run flows:check`** ([scripts/check-flow-drift.mjs](scripts/check-flow-drift.mjs))
  fails the build on drift. Each feature records the SHA-256 of the flow it came from as a
  `# flow-sha:` comment on line 1; edit the flow and the hash stops matching. It hashes
  content rather than comparing mtimes, because a git checkout rewrites mtimes and would
  raise false alarms. `npm test` runs it first.

After regenerating a feature, run `npm run flows:bless` to re-record the hash. Only bless a
feature that genuinely covers the whole flow — a blessed feature asserts exactly that, so
blessing a partial one hides the very gap the check exists to find. Step counts are
deliberately *not* the pass/fail signal: one flow step often maps to several Gherkin steps,
so the counts can match while coverage does not.

## Step definitions are one shared registry

Every service imports the same `test` from `src/support/fixtures.ts`, so all step
definitions land in **one** registry. Two services defining the same step text fails
`bddgen` with *"Multiple definitions matched scenario step."*

This stopped being hypothetical when Stream arrived: its flow opens with the same two steps
as Movies ("Navigate to BookMyShow", "Select Hyderabad as city"). Those steps now live once in
**`src/support/common.steps.ts`**, backed by `BasePage` and taking the `basePage` fixture — so
no service depends on another service's steps file:

```gherkin
Given the user is on the BookMyShow home page
And the city is set to "Hyderabad"
When the user opens the "Stream" tab        # parameterised: Movies, Events, Plays, ...
Then the selected city remains "Hyderabad"
```

Because `common.steps.ts` sits outside `src/services/**`, the `steps` glob in
`playwright.config.ts` is `src/**/*.steps.ts`. **Narrowing it back would silently stop loading
that file** — its steps would come out "undefined" with nothing pointing at the glob.

When two services genuinely need different behaviour behind the same wording, tag-scope
instead of hoisting:

```ts
Given("the listing is displayed", { tags: "@movies" }, async ({ moviesPage }) => { ... });
Given("the listing is displayed", { tags: "@stream" }, async ({ streamPage }) => { ... });
```

## What each service covers

Every service has the same backbone, then its own funnel edge. Nothing past
that edge is automated (see "Booking funnel boundary").

| Scenario family | Movies | Stream | Events | Plays | Sports | Activities |
| --- | --- | --- | --- | --- | --- | --- |
| Browse listing (`@smoke`) | language filter | first title in a collection | yes | yes | yes | yes |
| Filter by group (`@filters`) | Genres, Format, 2 languages, combine, clear one | - | 4 groups, combine, clear | 3 groups, combine, clear | 3 groups, clear | 3 groups, combine, clear |
| Second city (`@city`) | Mumbai | - | Mumbai | Mumbai | Mumbai | Mumbai |
| Open first item, read details | details + About/Cast/Crew | title page | details + Read More | details | details | details |
| Header search for first item (`@search`) | yes | yes | yes | yes | yes | yes |
| Funnel edge (`@booking`) | format popup -> showtimes page; next date; open a cinema | Rent/Buy offered | ticket page; Know more | date page; pick a date | ticket page | date page; pick a date; See all dates |
| Directories (`@cinemas` / `@venues`) | cinemas directory + search | - | venues directory + search | - | - | - |
| Account-gated (`@auth` / `@account`) | I'm interested, favourite a cinema | - | Login To Book | - | Login To Book | - |
| Lazy loading (`@browse`) | - | more collections on scroll; hero carousel | - | - | - | - |

## Adding a new service

1. Write `flows/<service>.md`, starting with a `Service Type:` line.
2. Add `src/services/<service>/<service>.page.ts` extending `BasePage` — or
   `TicketedPage` if its "Book Now" lands on a ticket page (Events, Sports), or
   `CataloguePage` if it lands on a date-time page (Plays, Activities).
3. Add `src/services/<service>/<service>.steps.ts` importing `test` from `src/support/fixtures.ts`.
4. Register the POM as a fixture in `src/support/fixtures.ts`.
5. Write `features/<service>.feature` and tag it `@<service>`.

Nothing else changes; the config globs pick the new files up automatically.

## Selector policy

BookMyShow uses hashed styled-components class names such as `sc-7o7nez-0 fPrTaH`, which
change between deploys. POMs therefore avoid class selectors and use roles, exact text, and
URL assertions. Traps found on the real page and handled in code:

- An xpath anchored on the "Languages" heading resolves to a **hidden** duplicate `Telugu`
  node. The POM targets the first **visible** exact-text match instead.
- "Telugu" also appears in the page footer, so the match must be visibility-scoped.
- **Listing cards vs footer links.** A listing card is `/movies/hyderabad/mandaadi/ET00442702`
  (city segment present); the footer's "Movies Now Showing" links are
  `/movies/mandaadi-telugu/ET00514261` (no city segment). A bare `a[href*="/movies/"]` matches
  both — 28 hits where only 16 were real cards — so "the first movie" could resolve to a footer
  link. `movieCards` is scoped to the active city.
- **Never assert presence with `await locator.count()`.** It reads the DOM once and does not
  retry, so against lazily-rendered content it reports whatever happened to exist at that
  instant. `assertMoviesListingShown()` used it and passed only because the unscoped selector
  also matched footer links, which render early — it reported a healthy listing before a single
  real card existed. Use a web-first assertion (`await expect(locator.first()).toBeVisible()`),
  which retries. The same bug sat in `ensureCity()`, where a one-shot `count()` on the
  client-hydrated city picker made the method silently do nothing and return as if it had
  succeeded.
- Language filters **are** `button` elements carrying an aria-pressed state
  (`button "Telugu" [pressed]`), so a role-based locator does exist. The text-based locator is
  kept for now only because the page renders two buttons per language and one is hidden — the
  same duplicate trap as above.

- **Stream card hrefs have no city segment** — `/movies/top-gun-maverick/ET00076943`, not
  `/movies/hyderabad/...` as the Movies listing uses. The city segment *does* appear once a
  city cookie is set, so neither shape can be relied on; `StreamPage` matches a city-agnostic
  `/movies/.+/ET<id>` pattern. Beware reading hrefs from a browser that has already been
  around the site — a warm session reports the city-prefixed form and misleads you.
- **The Stream page builds itself as you scroll.** It is ~8000px tall and collections below
  the fold are not in the DOM at all, so a locator for one cannot simply be waited on. And
  `mouse.wheel()` does not drive its lazy loader (verified: the heading never appeared) —
  `page.evaluate(() => window.scrollBy(...))` finds "Best of Tom Cruise Movies" in ~5 steps.
  `StreamPage.scrollToCollection()` scrolls in a loop, so the one-shot `count()` inside that
  loop is deliberate: the loop is the retry.
- **Anchoring a carousel with no id, role or stable class**: find the INNERMOST `div` that
  contains both the collection's heading and at least one card link
  (`.filter({ has: heading }).filter({ has: cardLink }).last()`). Filtering on what the
  container must *contain* survives markup changes; walking a fixed number of parent elements
  does not.

- **The showtimes date strip has no role and no name.** The seven dates on
  `/buytickets/` are `div`s whose only stable handle is an `id` equal to the
  date code (`div#20260922` reads "TUE 22 SEP" split across child nodes, so
  even a text match needs the whitespace-tolerant `\s*` form). An id that starts
  with a digit is matched as `[id="20260922"]`, not `#20260922`. The URL's
  date segment is **not** a reliable active date: measured 2026-09-22 on a
  pre-release title with advance booking open, the URL said `/20260922` while
  the strip ran 24 Sep to 1 Oct and every cinema link pointed at 20260924 — the
  site accepts any date and renders the first one with shows. So the strip is
  read as a list of 8-digit ids: the first is the active date, the second is
  "the next date", and the move is proven by the URL ending in that second id.
  This bit the nightly run once, because "whichever movie shows first" is often
  a big release in exactly that state.
- **Cinema rows on the showtimes page link to the cinema with a text-less
  anchor.** `a[href*="/cinemas/"][href*="/buytickets/"]` is the only selector
  that isolates them from the showtime buttons. The cinema page itself has **no
  heading at all** — the name is a plain text node — so the proof there is the
  URL slug, the `button "Mon 21 Sep"` date strip and the movie grid.
- **Directory pages share one shape.** The cinemas directory and the venues
  directory are both an `h1`, a `textbox "Search by cinema|venues or area"`
  and a `grid` alternating `"Add to favourites"` buttons with entry buttons
  named "<Name>: <City> <address>". Typing filters client-side with no URL
  change (48 -> 1 for a full name), so the assertion is that no non-matching
  entry remains, not just that the wanted one does.
- **Languages is multi-select and pipe-joined**: Telugu then Hindi gives
  `?languages=telugu|hindi`, so a wait for `languages=hindi` never resolves.
  `addLanguage()` waits for the value anywhere inside the `languages` parameter.
- **Choosing a date on a date-time page changes nothing observable except
  "Proceed".** No URL change, no `aria-pressed`; the button goes from disabled
  to enabled, and that is what the Plays/Activities date scenario asserts.
  "See all dates" (Activities, multi-week runs only) swaps the strip for a month
  grid of `button "Sun 11 Oct 2026"` cells.
- **The Stream hero carousel has no heading.** Its slides are movie links whose
  text starts "Brand new releases every Friday", and that caption is the only
  handle. A Stream title page offers `button "Rent ₹249"` / `button "Buy ₹699"`;
  the price changes, so the match is on the verb, and neither is ever clicked.

Filter success is asserted from the URL (`?languages=telugu`), which is the only stable signal.
See also "Booking funnel boundary" for the format popup's row-scoping requirement.
