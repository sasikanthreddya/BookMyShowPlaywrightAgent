import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Saved by `npm run auth:capture`. Gitignored: it holds live session cookies
// for a real account.
const AUTH_FILE = ".auth/user.json";

// playwright-bdd resolves these globs relative to THIS file's directory.
// Every service contributes its own <service>.steps.ts; support/fixtures.ts
// is listed because it exports the custom `test` those step files import.
//
// src/**, not src/services/**: shared steps live in src/support/common.steps.ts,
// and a narrower glob would silently not load them (their steps would come out
// "undefined" with no error pointing at the glob).
const steps = ["src/**/*.steps.ts", "src/support/fixtures.ts"];

// Two compilations of the SAME feature files, split by tag, because the two
// halves need different browser state: @account scenarios need a signed-in
// storageState and everything else must stay anonymous (several scenarios
// assert the logged-OUT behaviour, e.g. that marking interest redirects to
// /login/, and they would fail against a signed-in browser).
const anonymousDir = defineBddConfig({
  outputDir: ".features-gen/anonymous",
  features: "features/*.feature",
  steps,
  tags: "not @account",
});

const accountDir = defineBddConfig({
  outputDir: ".features-gen/account",
  features: "features/*.feature",
  steps,
  tags: "@account",
});

export default defineConfig({

  // Measured per-step, 2026-09-18, on the Stream scenario's slowest row
  // ("Best of Tom Cruise Movies", a collection near the bottom of the page):
  //   Given home page                 41s   (Cloudflare interstitial fired)
  //   And city is set to Hyderabad    42s
  //   When opens the Stream tab       13s
  //   And scrolls to the collection   41s   (~8000px of lazy-loaded carousels)
  //                                  ----
  //                                   137s
  // So 120_000 was not a slow-run margin, it was under the measured cost of a
  // normal run: the scenario died mid-scroll and reported whichever call was
  // in flight ("locator.scrollIntoViewIfNeeded"), which reads like a selector
  // bug and is not one. Every term above is irreducible -- the interstitial is
  // the site's, and the page genuinely has to be scrolled to build itself --
  // so the budget is what had to change.
  timeout: 240_000,
  expect: { timeout: 20_000 },

  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "reports/results.json" }],
    ["html", { open: "never", outputFolder: "reports/html" }],
  ],
  use: {
    baseURL: process.env.BMS_BASE_URL || "https://in.bookmyshow.com",

    // Under the test runner, actionTimeout defaults to 0 — "wait forever" —
    // while the Playwright LIBRARY defaults the same call to 30s. That gap cost
    // real time here: a textContent() probe that matches nothing on the happy
    // path hung for an entire 7-minute test, and the identical code in a
    // standalone script had worked fine. Setting it turns "the test mysteriously
    // timed out somewhere" into "this action failed, on this locator".
    //
    // It lives in `use`, not at the top level: actionTimeout is a test option,
    // and a top-level copy is silently ignored (tsc flagged it, the runner did
    // not), so it had never actually been in force.
    actionTimeout: 30_000,

    // bookmyshow.com sits behind Cloudflare. Measured 2026-09-17 against the
    // live site, one variable at a time:
    //   channel chrome + headless            -> "Sorry, you have been blocked"
    //   channel chrome + headed              -> HTTP 200, genuine page
    //   bundled Chromium                     -> blocked
    //   persistent .chrome-profile, headed    -> blocked (that profile's state
    //                                            is flagged; do NOT wire it in)
    // So HEADED REAL CHROME is the only combination that gets through, and
    // headless is the single setting that decides it. Playwright defaults
    // headless to true, so it must be set explicitly here -- dropping this
    // line silently reintroduces the Cloudflare block.
    // PWDEBUG/--headed still work; set BMS_HEADLESS=1 only to re-test the block.
    channel: "chrome",
    headless: process.env.BMS_HEADLESS === "1",
    launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },

    screenshot: "on",
    trace: "retain-on-failure",
    viewport: { width: 1366, height: 768 },
  },

  projects: [
    // Signs in and writes AUTH_FILE. A dependency rather than a script anyone
    // has to remember: Playwright runs it before the account project, and only
    // when a run actually includes @account scenarios. It re-uses a session
    // younger than BMS_AUTH_MAX_AGE_HOURS instead of logging in every time.
    {
      name: "setup",
      testDir: "src/support",
      testMatch: /auth\.setup\.ts/,
    },
    { name: "anonymous", testDir: anonymousDir },
    {
      name: "account",
      testDir: accountDir,
      dependencies: ["setup"],
      // Safe to reference unconditionally BECAUSE of that dependency: the
      // setup project has already written the file by the time this project's
      // contexts are created. Without the dependency Playwright throws ENOENT
      // on a missing storageState before any test runs.
      use: { storageState: AUTH_FILE },
    },
  ],
});
