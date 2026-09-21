import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { test as setup, expect, type Page, type BrowserContext } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Playwright SETUP PROJECT: signs in once and saves the session to
 * .auth/user.json, which the "account" project loads as storageState.
 *
 * It is a project dependency rather than a script anyone has to remember to
 * run: `npx playwright test` runs it first, automatically, and only for runs
 * that actually include @account scenarios.
 *
 *   npm test               -> runs this first if @account scenarios are included
 *   npm run auth:capture   -> runs just this, to refresh a session by hand
 *
 * Credentials come from the environment or from .auth/credentials.json (both
 * gitignored); they are never committed.
 *
 * See README "Google SSO, and the step no locator can reach" for why the CDP
 * FedCm calls below are load-bearing: the final consent dialog is drawn by
 * Chrome itself, so no page locator can reach it and the sign-in hangs
 * forever without them.
 */
const AUTH_FILE = ".auth/user.json";
const CREDENTIALS_FILE = ".auth/credentials.json";

/**
 * Progress goes to a file as well as the console: a setup project's stdout is
 * not reliably surfaced by the reporter, and when sign-in stalls the log is
 * the only thing that says where.
 */
const LOG_FILE = ".auth/last-signin.log";
function trace(message: string): void {
  console.log(message);
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()}  ${message}\n`);
  } catch {
    /* logging must never fail the sign-in */
  }
}

/** A session older than this is re-captured rather than trusted. */
const MAX_AGE_HOURS = Number(process.env.BMS_AUTH_MAX_AGE_HOURS || 12);

function credentials(): { email: string; password: string } | null {
  const { BMS_GOOGLE_EMAIL, BMS_GOOGLE_PASSWORD } = process.env;
  if (BMS_GOOGLE_EMAIL && BMS_GOOGLE_PASSWORD) {
    return { email: BMS_GOOGLE_EMAIL, password: BMS_GOOGLE_PASSWORD };
  }
  if (existsSync(CREDENTIALS_FILE)) {
    const file = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8"));
    if (file.email && file.password) return { email: file.email, password: file.password };
  }
  return null;
}

function sessionAgeHours(): number | null {
  if (!existsSync(AUTH_FILE)) return null;
  return (Date.now() - statSync(AUTH_FILE).mtimeMs) / 3_600_000;
}

/**
 * Drives Chrome's native FedCM consent dialog over CDP.
 *
 * Must be enabled BEFORE the sign-in starts: the dialog is raised at the end
 * of the flow, and an un-enabled domain simply never reports it.
 */
type FedCmDialog = {
  dialogId: string;
  dialogType: string;
  title: string;
  accounts?: { email?: string }[];
};

/**
 * The FedCm CDP domain is newer than the Protocol types bundled with this
 * Playwright, so the session is addressed through a loose shape rather than
 * sprinkling `as never` over calls that are perfectly real at runtime.
 */
type LooseCdp = {
  send(method: string, params?: unknown): Promise<unknown>;
  on(event: string, handler: (payload: FedCmDialog) => void): void;
};

async function driveFedCmDialog(context: BrowserContext, page: Page, email: string): Promise<void> {
  const cdp = (await context.newCDPSession(page)) as unknown as LooseCdp;
  try {
    await cdp.send("FedCm.enable", { disableRejectionDelay: true });
  } catch (e) {
    trace(`FedCm unavailable (${(e as Error).message.split("\n")[0]}); finish the sign-in by hand.`);
    return;
  }

  cdp.on("FedCm.dialogShown", async (e: FedCmDialog) => {
    const accounts = e.accounts ?? [];
    trace(`FedCM dialog: "${e.title}" (${e.dialogType})`);

    // Pick the requested account: the dialog lists every Google account
    // signed in to this browser, so index 0 is not reliably the right one.
    const wanted = accounts.findIndex((a) => a.email?.toLowerCase() === email.toLowerCase());
    const accountIndex = wanted >= 0 ? wanted : 0;

    try {
      await cdp.send("FedCm.selectAccount", { dialogId: e.dialogId, accountIndex });
      trace(`  selected ${accounts[accountIndex]?.email ?? `#${accountIndex}`}`);
    } catch {
      // A ConfirmIdpLogin dialog has no account list, only a Continue button.
      await cdp
        .send("FedCm.clickDialogButton", {
          dialogId: e.dialogId,
          dialogButton: "ConfirmIdpLoginContinue",
        })
        .catch(() => trace("  could not drive the FedCM dialog"));
    }
  });
}

async function completeGoogleForm(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  trace("clicking Continue with Google");
  await page.getByRole("button", { name: /^Continue with Google$/i }).first().click();

  // The popup arrives as a new CONTEXT page; a page-scoped
  // waitForEvent("popup") misses it.
  let google: Page | undefined;
  for (let i = 0; i < 16 && !google; i++) {
    await page.waitForTimeout(1500);
    google = context.pages().find((p) => /accounts\.google\./i.test(p.url()));
  }
  if (!google) {
    trace("No Google popup appeared - finish the sign-in in the browser window.");
    return;
  }

  trace(`google popup: ${google.url().slice(0, 70)}`);
  await google.bringToFront();
  await google.waitForLoadState("domcontentloaded").catch(() => {});
  await google.waitForTimeout(4000);

  // Google's identifier field is `textbox "Email or phone"`, NOT
  // input[type=email] - a type-based locator finds nothing here.
  // Every action below carries an explicit timeout. The project sets no
  // `actionTimeout`, so Playwright's default is NO timeout, and a fill() on an
  // element that never becomes actionable hangs until the whole test dies -
  // which is what it did here, silently, for seven minutes.
  const identifier = google.getByRole("textbox", { name: /Email or phone/i });
  trace(`identifier fields: ${await identifier.count()}`);
  if (await identifier.count()) {
    await identifier.first().fill(email, { timeout: 20_000 });
    await google.getByRole("button", { name: /^Next$/i }).first().click({ timeout: 20_000 });
    trace("email submitted");
    await page.waitForTimeout(7000);
  }

  trace(
    `after email: popupClosed=${google.isClosed()} url=${
      google.isClosed() ? "-" : google.url().slice(0, 90)
    }`,
  );

  // The explicit timeout is REQUIRED, not tidiness. This probe matches nothing
  // on the happy path, and textContent() waits for its element to appear; the
  // test runner defaults `actionTimeout` to 0, i.e. wait forever, so the probe
  // hung for the entire test on every SUCCESSFUL sign-in. It cost two hours:
  // the identical code works in a standalone script, where the Playwright
  // library defaults that timeout to 30s instead of inheriting the test's.
  const rejected = await google
    .getByText(/Wrong password|Couldn.t find your Google Account|Enter a valid email/i)
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => null);
  if (rejected) throw new Error(`Google rejected the credentials: ${rejected.trim()}`);

  if (google.isClosed()) {
    trace("popup closed before the password step - nothing more to drive here");
  }

  if (!google.isClosed()) {
    const pwd = google.locator('input[type="password"]');
    await pwd.first().waitFor({ state: "visible", timeout: 25_000 });
    await pwd.first().fill(password, { timeout: 20_000 });
    await google.getByRole("button", { name: /^Next$/i }).first().click({ timeout: 20_000 });
    trace("password submitted");
    // Timed on the MAIN page: a successful SSO closes the popup, and waiting
    // on a closed popup throws over a success.
    await page.waitForTimeout(8000);
  }

  // "Sign in faster" passkey-enrolment speedbump, when Google interposes one.
  if (!google.isClosed()) {
    for (const label of ["Not now", "Skip", "Cancel"]) {
      const button = google.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).filter({ visible: true });
      if (await button.count()) {
        await button.first().click().catch(() => {});
        break;
      }
    }
  }
}

setup("authenticate", async ({ page, context }) => {
  setup.setTimeout(Number(process.env.BMS_AUTH_TIMEOUT_MS || 420_000));

  const age = sessionAgeHours();
  if (!process.env.BMS_FORCE_LOGIN && age !== null && age < MAX_AGE_HOURS) {
    trace(`Reusing ${AUTH_FILE} (${age.toFixed(1)}h old, max ${MAX_AGE_HOURS}h).`);
    return;
  }

  const creds = credentials();
  const base = new BasePage(page);

  await base.open("/");
  await base.ensureCity(process.env.BMS_CITY || "Hyderabad");
  await page.waitForTimeout(2000);

  if ((await base.signInButton.count()) === 0) {
    trace("Already signed in.");
  } else {
    if (!creds) {
      throw new Error(
        [
          "@account scenarios need a signed-in session and no credentials were provided.",
          "",
          "Set them in the environment:",
          "  BMS_GOOGLE_EMAIL=you@gmail.com BMS_GOOGLE_PASSWORD=... npm test",
          `or create ${CREDENTIALS_FILE} (gitignored):`,
          '  { "email": "you@gmail.com", "password": "..." }',
          "",
          "To run everything except the signed-in scenarios instead:",
          "  npx playwright test --project=anonymous",
        ].join("\n"),
      );
    }

    // Enabled before the flow starts, or the dialog is never reported.
    await driveFedCmDialog(context, page, creds.email);

    await base.signInButton.first().click({ timeout: 20_000 });
    await page.getByRole("heading", { name: /^Get Started$/i }).waitFor({ state: "visible", timeout: 20_000 });

    await completeGoogleForm(context, page, creds.email, creds.password);

    await page.bringToFront();
    for (let i = 0; i < 12 && (await base.signInButton.count()) > 0; i++) {
      await page.waitForTimeout(3000);
    }

    // Human fallback for what automation should not fake: 2-step verification,
    // a device challenge, or a mobile OTP.
    if ((await base.signInButton.count()) > 0) {
      const minutes = Number(process.env.BMS_AUTH_WAIT_MINUTES || 3);
      trace(`\n${"=".repeat(68)}`);
      trace("  FINISH SIGNING IN IN THE OPEN CHROME WINDOW (Google, or mobile + OTP).");
      trace(`  Waiting up to ${minutes} minutes; it continues as soon as you are in.`);
      trace(`${"=".repeat(68)}\n`);
      const deadline = Date.now() + minutes * 60_000;
      while (Date.now() < deadline && (await base.signInButton.count()) > 0) {
        await page.waitForTimeout(3000);
      }
    }
  }

  await expect(
    base.signInButton,
    'Sign-in did not complete - the header still offers "Sign in". Re-run with ' +
      "BMS_AUTH_WAIT_MINUTES=10 to allow time to finish it by hand.",
  ).toHaveCount(0);

  await context.storageState({ path: AUTH_FILE });
  trace(`Session saved to ${AUTH_FILE}`);
});
