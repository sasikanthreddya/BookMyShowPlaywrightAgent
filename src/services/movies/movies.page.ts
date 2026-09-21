import { type Locator, expect } from "@playwright/test";
import { BasePage } from "../../support/base.page";

/** A movie details page: /movies/<city>/<slug>/ET<numeric id>. */
const MOVIE_DETAILS_URL = /\/movies\/[a-z-]+\/[^/]+\/ET\d+/i;

/**
 * POM for the MOVIES service — one POM per BookMyShow service.
 * Owns only Movies concerns: the Movies nav tab, the Filters sidebar's
 * "Languages" group, the resulting movie cards, and the movie details page
 * up to (but not through) the booking funnel.
 *
 * Grounded against the real page on 2026-09-17:
 *   - The Movies nav item is a link with accessible name "Movies"
 *     (href "/explore/movies?cat=MT").
 *   - It lands on /explore/movies-hyderabad?cat=MT, title
 *     "Hyderabad Movie Tickets Online Booking & Showtimes near you".
 *   - The Filters sidebar renders a "Languages" group: English, Telugu,
 *     Hindi, Tamil, Malayalam, Marathi, Odia, Assamese, Japanese.
 *   - Applying Telugu rewrites the URL to
 *     /explore/movies-hyderabad?languages=telugu — that URL is the
 *     authoritative proof the filter took effect.
 *   - A movie details page exposes a button named exactly "Book tickets".
 */
export class MoviesPage extends BasePage {
  get moviesTab(): Locator {
    return this.serviceTab("Movies");
  }

  /**
   * Filters sidebar language chip. First visible exact-text match.
   *
   * Re-measured 2026-09-17: these are in fact `button` elements carrying an
   * aria-pressed state (`button "Telugu" [pressed]`), so a role-based locator
   * DOES exist, contrary to the earlier note here. It is not used yet because
   * the page renders TWO buttons per language (sidebar plus a collapsed filter
   * panel) and one of them is hidden, which is the same duplicate trap the
   * text locator below already sidesteps. Switching to
   * `getByRole("button", { name: /^Telugu$/ }).filter({ visible: true })`
   * would be the cleaner form; left alone here to avoid rewriting a verified
   * selector as a side effect of an unrelated change.
   */
  languageOption(language: string): Locator {
    return this.page.locator("div:visible").filter({ hasText: new RegExp(`^${language}$`) }).first();
  }

  /**
   * Movie cards in the listing, scoped to the active city.
   *
   * The city segment matters. Measured 2026-09-17, a listing card is
   *   /movies/hyderabad/mandaadi/ET00442702   <- city segment present
   * while the footer's "Movies Now Showing in Hyderabad" links are
   *   /movies/mandaadi-telugu/ET00514261      <- no city segment
   * so a bare a[href*="/movies/"] matches the footer too. That made
   * "the listing is displayed" satisfiable by footer links alone, and would
   * let "the first movie" resolve to a footer link on a page whose listing
   * never rendered.
   */
  get movieCards(): Locator {
    const city = this.activeCityFromUrl() ?? "";
    return this.page.locator(`a[href*="/movies/${city}/"]`);
  }

  /** Details-page CTA that opens the booking funnel. */
  get bookTicketsButton(): Locator {
    return this.page.getByRole("button", { name: /^Book tickets$/i });
  }

  async selectLanguage(language: string): Promise<void> {
    await this.languageOption(language).click();
    await this.page.waitForURL(new RegExp(`languages=${language}`, "i"), { timeout: 30_000 });
  }

  /**
   * Adds a SECOND language to an already-applied language filter.
   *
   * Measured 2026-09-21: the Languages group is multi-select, and the URL
   * joins the values with a pipe — Telugu then Hindi gives
   * `?languages=telugu|hindi`. So `selectLanguage()`'s wait for
   * `languages=hindi` would never be satisfied here; this waits for the new
   * language anywhere in the `languages` value instead.
   */
  async addLanguage(language: string): Promise<void> {
    await this.languageOption(language).click();
    await this.page.waitForURL(new RegExp(`languages=[^&]*${language}`, "i"), { timeout: 30_000 });
  }

  /**
   * Flow step 5, "whichever show comes first": the first card in the listing,
   * in DOM order. Deliberately does not pin a title — the Hyderabad listing
   * changes daily, so asserting a specific movie would fail on any other day.
   */
  async openFirstMovie(): Promise<void> {
    const first = this.movieCards.first();
    await expect(first).toBeVisible();
    await first.click();
    await this.page.waitForURL(MOVIE_DETAILS_URL, { timeout: 30_000 });
  }

  /**
   * The "Select language and format" popup.
   *
   * It has no dialog role and no stable id (the container is a bare styled
   * div), so this heading is its only stable identity.
   */
  get formatPopupHeading(): Locator {
    return this.page.getByRole("heading", { name: /^Select language and format$/i });
  }

  /**
   * A format button within a specific language's row of that popup.
   *
   * Grounded 2026-09-17 on Mandaadi (Tamil/Telugu/...). The popup is a list
   * with one listitem per language, the row text being the language and the
   * formats being buttons inside it:
   *   listitem "Tamil"  -> button "2D"
   *   listitem "Telugu" -> button "2D", "EPIQ", "HDR By Barco", "Select all"
   *
   * So "Telugu 2D" is NOT a single element, and a bare button named "2D" is
   * ambiguous — Tamil has one too, and the page body separately contains
   * LINKS named "2D", "IMAX 2D" and "DOLBY CINEMA 2D". Scoping to the
   * language's row is what makes it unambiguous.
   */
  formatOption(language: string, format: string): Locator {
    return this.page
      .getByRole("listitem")
      .filter({ hasText: new RegExp(`^${language}`, "i") })
      .getByRole("button", { name: new RegExp(`^${format}$`, "i") })
      .first();
  }

  /**
   * Any open bottom sheet's overlay.
   *
   * BookMyShow reuses id="bottomSheet-model-close" for EVERY bottom sheet —
   * the city picker, the age gate, the format popup — and the overlay
   * intercepts pointer events. Clicking anything underneath while one is open
   * does not fail fast; Playwright retries the click until the whole test
   * times out.
   */
  get openSheetOverlay(): Locator {
    return this.page.locator("#bottomSheet-model-close");
  }

  /**
   * The age-confirmation sheet that A-rated titles interpose between
   * "Book tickets" and the format popup.
   *
   * Discovered 2026-09-18 on "Daayra": reads 'This movie is rated "A" and is
   * only for viewers above 18...' with a single "Continue" button. UA16+
   * titles do not show it, which is why Telugu and Tamil never hit it and
   * only the Malayalam example failed.
   */
  get ageGate(): Locator {
    return this.page.getByText(/This movie is rated/i).first();
  }

  /** Clicks through the age gate if it is up. Returns whether it was. */
  async dismissAgeGateIfPresent(): Promise<boolean> {
    if (!(await this.ageGate.isVisible().catch(() => false))) return false;
    await this.page.getByRole("button", { name: /^Continue$/i }).first().click();
    return true;
  }

  /**
   * The first bookable format inside a language's row of the format popup.
   *
   * Pinning a format by name is fragile in a way pinning a language is not:
   * format availability is per-movie AND per-language. Measured on Mandaadi,
   * the Tamil row offered only "2D" while Telugu offered "2D", "EPIQ" and
   * "HDR By Barco". Since the scenario opens whichever movie is first in the
   * listing — a different one every day — a hard-coded "EPIQ" would pass or
   * fail on the luck of the listing. Taking whatever the row offers first
   * mirrors the flow's own "whichever show comes first".
   *
   * "Select all" is excluded: it is a bulk control in the same row, not a
   * format, and selecting it would choose every format at once.
   */
  firstFormatIn(language: string): Locator {
    return this.page
      .getByRole("listitem")
      .filter({ hasText: new RegExp(`^${language}`, "i") })
      .getByRole("button")
      .filter({ hasNotText: /^Select all$/i })
      .first();
  }

  /**
   * Flow step 6: open the booking options for the movie on screen.
   *
   * Two hazards, both found the hard way:
   *
   * 1. The details page hydrates after it renders, so "Book tickets" is
   *    visible, enabled and stable before React attaches its click handler.
   *    A click landing in that window is swallowed SILENTLY and Playwright's
   *    actionability checks cannot see it. Verified on "Daayra": an immediate
   *    click did nothing; the identical click after the page settled opened
   *    the sheet first time. It surfaced as a /buytickets/ URL assertion
   *    failing several steps later, blaming the wrong thing entirely.
   *
   * 2. A-rated titles open an age gate first, not the format popup. Retrying
   *    the click blindly then hits that sheet's overlay, which intercepts
   *    pointer events, and the click retries until the 120s test timeout.
   *
   * So: click, then wait for any of the three real outcomes — navigation, the
   * format popup, or the age gate (which we click through and keep waiting).
   * Only retry the click when NO sheet is open.
   */
  async startBooking(): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.bookTicketsButton.click();

      for (let i = 0; i < 24; i++) {
        if (/\/buytickets\//i.test(this.page.url())) return;
        if (await this.formatPopupHeading.isVisible().catch(() => false)) return;
        if (await this.dismissAgeGateIfPresent()) continue;
        await this.page.waitForTimeout(500);
      }

      if (await this.openSheetOverlay.isVisible().catch(() => false)) break;
    }

    throw new Error(
      `Clicked "Book tickets" on ${this.page.url()} without reaching the format popup ` +
        `or /buytickets/. The button is present and enabled. If a bottom sheet is open, ` +
        `it is one this POM does not know how to dismiss yet (the age gate is handled).`,
    );
  }

  /**
   * Flow step 7, conditional: "if pop up will come then he should select
   * Telugu 2d from it".
   *
   * A multi-language title opens the format popup; a single-format title goes
   * straight past it. So this waits a bounded time for the popup and treats
   * its absence as "not prompted" rather than a failure — but it does NOT use
   * a one-shot count() to decide, because the popup is rendered client-side
   * after the click and would not be there yet.
   *
   * Returns whether a selection was actually made. Stops here: choosing a
   * cinema, showtime or seat is deliberately out of scope.
   */
  async chooseFormatIfPrompted(language: string, format: string): Promise<boolean> {
    await this.formatPopupHeading.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    if (!(await this.formatPopupHeading.isVisible())) return false;

    await this.formatOption(language, format).click();
    await expect(this.formatPopupHeading).toBeHidden({ timeout: 30_000 });
    return true;
  }

  /**
   * Authoritative proof flow step 7 took effect.
   *
   * Measured 2026-09-17: selecting Telugu 2D navigates to
   *   /movies/hyderabad/mandaadi/buytickets/ET00514261/20260917
   *     ?etCodes=ET00514261&language=telugu&refEventCode=ET00514261
   * so the buytickets path plus the language query parameter is the stable
   * signal — the same URL-as-truth approach used for the language filter,
   * and the reason no cinema or showtime needs to be touched to prove it.
   */
  async assertShowtimesReachedFor(language: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/buytickets\//i);
    await expect(this.page).toHaveURL(new RegExp(`language=${language}`, "i"));
  }

  /**
   * Flow step 7, robust variant: select whatever format the language row
   * offers first. Same conditional handling as chooseFormatIfPrompted —
   * a single-format title never shows the popup — and returns the format
   * actually chosen so a caller can report it.
   */
  async chooseFirstFormatIfPrompted(language: string): Promise<string | null> {
    await this.formatPopupHeading.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    if (!(await this.formatPopupHeading.isVisible())) return null;

    const button = this.firstFormatIn(language);
    await expect(button).toBeVisible();
    const format = ((await button.textContent()) ?? "").trim();
    await button.click();
    await expect(this.formatPopupHeading).toBeHidden({ timeout: 30_000 });
    return format;
  }

  async assertFormatPopupDismissed(): Promise<void> {
    await expect(this.formatPopupHeading).toBeHidden();
  }

  async assertMoviesListingShown(): Promise<void> {
    await expect(this.page).toHaveURL(/\/explore\/movies/i);
    // Must be a web-first assertion: `await locator.count()` reads the DOM
    // once with no retry, and the listing cards are rendered lazily. The old
    // form passed only because its unscoped selector also matched ~12 footer
    // links, which render early -- so it reported success before a single
    // real card existed. toBeVisible() retries until the listing is actually
    // there.
    await expect(this.movieCards.first()).toBeVisible();
  }

  async assertLanguageApplied(language: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`languages=${language}`, "i"));
  }

  /**
   * The listing's own heading, which names the city. Measured: "Movies in
   * Hyderabad" and, after switching, "Movies in Mumbai" — so this is the
   * city-facing check that the whole page, not just the URL, followed.
   */
  async assertListingHeadingShown(city: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: new RegExp(`^Movies in ${city}$`, "i") }).first(),
    ).toBeVisible();
  }

  /**
   * Left-rail link out to the city's cinema directory.
   *
   * Measured 2026-09-21: it leaves /explore/ entirely for /<city>/cinemas,
   * whose heading is "Cinema in hyderabad" — SINGULAR, and with the city in
   * lowercase, unlike every listing heading ("Movies in Hyderabad"). Asserting
   * the obvious "Cinemas in Hyderabad" would fail on both counts.
   */
  get browseByCinemasControl(): Locator {
    return this.page.getByRole("button", { name: /^Browse by Cinemas$/i }).filter({ visible: true });
  }

  /**
   * The first listing card's title, read from its image alt.
   *
   * Measured 2026-09-21: a card renders `img "Mandaadi"` alongside a text node
   * that is the title PLUS certification and languages ("Mandaadi UA16+ Tamil,
   * Telugu, ..."), and the link's accessible name repeats the title twice. The
   * alt is the only place the clean title appears on its own.
   *
   * Used to drive search with a term guaranteed to exist today, instead of
   * hard-coding a film that leaves the listing next week.
   */
  async firstMovieTitle(): Promise<string> {
    const card = this.movieCards.first();
    await expect(card).toBeVisible();
    const title = ((await card.locator("img").first().getAttribute("alt")) ?? "").trim();
    if (!title) {
      throw new Error(
        `Could not read a title from the first movie card (url: ${this.page.url()}). ` +
          `The card's img alt is where the clean title lives.`,
      );
    }
    this.lastSearchedTitle = title;
    return title;
  }

  /** Remembers the title searched for, so the assertion needs no argument. */
  private lastSearchedTitle = "";

  get searchedTitle(): string {
    return this.lastSearchedTitle;
  }

  /**
   * Content of a now-showing movie page, measured 2026-09-21 on "Om Ka Hari":
   *   h1 "<title>", text "In cinemas",
   *   "9.4/10 (190+ Votes) Rate now 1h 57m •"  (one text node),
   *   h4 "About the movie", h4 "Cast"
   * The rating is asserted by SHAPE (n/10) rather than value, which changes.
   */
  async assertDetailsContentShown(): Promise<void> {
    await expect(this.page).toHaveURL(MOVIE_DETAILS_URL);
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(this.page.getByText(/\d+(\.\d+)?\/10/).first()).toBeVisible();
    await expect(this.page.getByText(/Rate now/i).first()).toBeVisible();
    await expect(this.page.getByRole("heading", { name: /^About the movie$/i }).first()).toBeVisible();
    await expect(this.page.getByRole("heading", { name: /^Cast$/i }).first()).toBeVisible();
  }

  /**
   * A showtime button on the /buytickets/ page, e.g. `button "02:35 PM"`.
   * Matched by time SHAPE, which is stable, rather than by any specific time.
   */
  get showtimeButtons(): Locator {
    return this.page.getByRole("button", { name: /^\d{1,2}:\d{2}\s*(AM|PM)$/i });
  }

  /**
   * Reads the showtimes page and STOPS. Measured: cinemas are grid rows
   * ('row "INOX GVK One, Banjara Hills: Hyderabad Non-cancellable 02:35 PM"')
   * each holding one button per showtime.
   *
   * No showtime is clicked. That is the line this suite does not cross: a
   * showtime leads to seat selection, and seats are real inventory.
   */
  async assertShowtimesListed(): Promise<void> {
    await expect(this.page).toHaveURL(/\/buytickets\//i);
    await expect(
      this.page.getByRole("row").first(),
      `The showtimes page listed no cinema rows (url: ${this.page.url()}). A film can ` +
        `genuinely have no shows on the selected date, so check the page before ` +
        `changing selectors.`,
    ).toBeVisible();
    await expect(this.showtimeButtons.first()).toBeVisible();
    // Nothing may have advanced into seat selection or payment.
    await expect(this.page).not.toHaveURL(/seatlayout|payment|checkout/i);
  }

  /**
   * The date strip on the /buytickets/ page. Measured 2026-09-21: the seven
   * dates render as `div` elements whose ONLY stable handle is an `id` equal
   * to the date code — `div#20260922` reads "TUE 22 SEP" split over child
   * nodes, so no role, no accessible name, and text matching needs the
   * whitespace-tolerant form. The id is the cleanest handle, and an id that
   * starts with a digit has to be matched as an attribute, not a CSS `#id`.
   *
   * The active date is NOT reliably the URL's path segment. Measured
   * 2026-09-22 on a pre-release title ("The Paradise", opening 24 Sep with
   * advance booking open): the URL still said /20260922 while the strip ran
   * THU 24 SEP .. THU 01 OCT and every cinema link pointed at 20260924. The
   * site accepts any date in the URL and simply renders the first date that
   * has shows. So "the next date" is the SECOND chip in the strip, and the
   * active date is the first — both read from the strip, never computed from
   * the URL or the calendar. "Whichever movie shows first" is often a big new
   * release in exactly this state, which is how this surfaced in CI.
   */
  private nextShowtimeDate = "";

  dateChip(code: string): Locator {
    return this.page.locator(`[id="${code}"]`);
  }

  /** Every chip in the strip, in display order, as 8-digit date codes. */
  private async showtimeDateCodes(): Promise<string[]> {
    // Date chips are the only elements on the page whose id is a bare
    // 8-digit date; filter in the browser so one round trip returns them all.
    return this.page
      .locator("div[id]")
      .evaluateAll((els) => els.map((e) => e.id).filter((id) => /^[0-9]{8}$/.test(id)));
  }

  async pickNextShowtimeDate(): Promise<void> {
    // The strip is client-rendered after the showtimes grid; wait for at
    // least two chips rather than reading an empty list once.
    await expect
      .poll(async () => (await this.showtimeDateCodes()).length, {
        message: `The showtimes page shows fewer than two date chips, so there is no next date to pick (url: ${this.page.url()}).`,
        timeout: 20_000,
      })
      .toBeGreaterThanOrEqual(2);

    const [active, next] = await this.showtimeDateCodes();
    this.nextShowtimeDate = next;

    await expect(
      this.dateChip(next),
      `The next date chip ${next} (after active ${active}) is not visible (url: ${this.page.url()}).`,
    ).toBeVisible();
    await this.dateChip(next).click();
    await this.page.waitForURL(new RegExp(`/buytickets/ET\\d+/${next}`), { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /** Proof the date moved: the URL's date segment is the one we picked. */
  async assertShowtimesOnNextDate(): Promise<void> {
    if (!this.nextShowtimeDate) throw new Error("pickNextShowtimeDate() was not called first.");
    await expect(this.page).toHaveURL(new RegExp(`/buytickets/ET\\d+/${this.nextShowtimeDate}`));
  }

  /**
   * Cinema links inside the showtimes grid. Measured 2026-09-21: each cinema
   * row carries an anchor with NO text and no accessible name, whose href is
   * the cinema's own page — /cinemas/hyderabad/<slug>/buytickets/<CODE>/<date>.
   * The href pair is the only selector that isolates them from the showtime
   * buttons and the movie's own link at the top of the page.
   */
  get showtimesCinemaLinks(): Locator {
    return this.page.locator('a[href*="/cinemas/"][href*="/buytickets/"]');
  }

  /** Slug of the cinema opened from the showtimes page, for the follow-up assertion. */
  private lastOpenedCinemaSlug = "";

  async openFirstCinemaFromShowtimes(): Promise<void> {
    await expect(
      this.showtimesCinemaLinks.first(),
      `The showtimes page lists no cinema links (url: ${this.page.url()}).`,
    ).toBeAttached();
    const href = (await this.showtimesCinemaLinks.first().getAttribute("href")) ?? "";
    this.lastOpenedCinemaSlug = /\/cinemas\/[a-z-]+\/([^/]+)\//i.exec(href)?.[1] ?? "";
    await this.showtimesCinemaLinks.first().click();
    await this.page.waitForURL(/\/cinemas\/[a-z-]+\/[^/]+\/buytickets\//i, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /**
   * A cinema's own page, measured 2026-09-21 (Prasads, ALLU): NO heading at
   * all — the name is a plain text node ("Prasads Multiplex: Hyderabad ...") —
   * a "Cinema Hall" / "F&B" toggle, a strip of date buttons named "Mon 21 Sep"
   * (one pressed), and a grid of movie links. So the proof is the URL (with
   * the slug we clicked), the date strip and the movie grid; there is no h1
   * to assert.
   */
  get cinemaDateButtons(): Locator {
    return this.page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2} [A-Z][a-z]{2}$/ });
  }

  async assertCinemaPageShown(): Promise<void> {
    await expect(this.page).toHaveURL(/\/cinemas\/[a-z-]+\/[^/]+\/buytickets\//i);
    if (this.lastOpenedCinemaSlug) {
      await expect(this.page).toHaveURL(new RegExp(`/cinemas/[a-z-]+/${this.lastOpenedCinemaSlug}/`, "i"));
    }
    await expect(this.cinemaDateButtons.first()).toBeVisible();
    await expect(this.page.locator('a[href*="/movies/"][href*="/ET"]').first()).toBeVisible();
    await expect(this.page).not.toHaveURL(/seatlayout|payment|checkout/i);
  }

  /**
   * "Add to favourites" on the cinemas directory — 48 of them on the Hyderabad
   * page, one per cinema. Account-gated exactly the way "I'm interested" is.
   *
   * The control itself is the same one the venues directory renders, so the
   * click lives on BasePage; only the assertion is kept here, because the
   * cinemas referer is the part that is Movies-specific
   * (/login/?referer=/hyderabad/cinemas, where venues give
   * ?referer=/venues?category=<service>).
   */
  async favouriteFirstCinema(): Promise<void> {
    await this.favouriteFirstDirectoryEntry();
  }

  async assertSignInRequiredForFavourite(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\/?\?referer=/i);
    await expect(this.page).toHaveURL(/referer=\/[a-z-]+\/cinemas/i);
  }

  async openBrowseByCinemas(): Promise<void> {
    await expect(this.browseByCinemasControl.first()).toBeVisible();
    await this.browseByCinemasControl.first().click();
    await this.page.waitForURL(/\/[a-z-]+\/cinemas/i, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async assertCinemasDirectoryShown(city: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/${city}/cinemas`, "i"));
    await expect(
      this.page.getByRole("heading", { name: new RegExp(`^Cinema in ${city}$`, "i") }).first(),
    ).toBeVisible();
  }

  /**
   * Asserts a named CTA is present and actionable WITHOUT clicking it.
   *
   * Used as the checkpoint between flow steps 5 and 6: it proves the booking
   * CTA rendered before the scenario commits to clicking it, so a failure to
   * reach the CTA is reported distinctly from a failure of the popup that
   * follows. See README.md "Booking funnel boundary" for where the suite
   * deliberately stops.
   */
  async assertCtaAvailable(name: string): Promise<void> {
    const cta = this.page.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
  }

  /**
   * End state of flow step 5. Asserting the "Book tickets" button is visible
   * also proves flow step 6's target exists and is actionable, which is as far
   * as this suite goes without clicking into the booking funnel.
   */
  async assertMovieDetailsShown(): Promise<void> {
    await expect(this.page).toHaveURL(MOVIE_DETAILS_URL);
    await expect(this.bookTicketsButton).toBeVisible();
  }

  /**
   * Link on the Movies listing to the coming-soon titles, measured 2026-09-21:
   * link "Coming Soon" -> /explore/upcoming-movies-hyderabad?referrerBase=movies.
   * Used instead of navigating to that URL directly so the scenario travels the
   * path a real visitor does.
   */
  get comingSoonLink(): Locator {
    return this.page.getByRole("link", { name: /^Coming Soon$/i }).filter({ visible: true }).first();
  }

  /**
   * Cards on the coming-soon listing.
   *
   * NOT `movieCards`. That one is scoped to the active city via
   * activeCityFromUrl(), and when this was written that pattern recognised
   * only /explore/home-<city> and /explore/movies-<city>, so on
   * /explore/upcoming-movies-hyderabad it returned null and the city-scoped
   * selector collapsed to a[href*="/movies//"], which matches nothing. The
   * pattern has since widened, but the hrefs here ARE city-scoped
   * (/movies/hyderabad/the-paradise/ET00436621), so pairing "/movies/" with
   * the "/ET" id remains both sufficient and city-agnostic, and is kept.
   */
  get upcomingMovieCards(): Locator {
    return this.page.locator('a[href*="/movies/"][href*="/ET"]');
  }

  async openComingSoon(): Promise<void> {
    await expect(
      this.comingSoonLink,
      `No "Coming Soon" link on the Movies listing (url: ${this.page.url()}).`,
    ).toBeVisible({ timeout: 20_000 });
    await this.comingSoonLink.click();
    await this.page.waitForURL(/\/explore\/upcoming-movies/i, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async assertUpcomingListingShown(): Promise<void> {
    await expect(this.page).toHaveURL(/\/explore\/upcoming-movies/i);
    await expect(this.upcomingMovieCards.first()).toBeVisible();
  }

  async openFirstUpcomingMovie(): Promise<void> {
    await expect(
      this.upcomingMovieCards,
      `The coming-soon listing had no cards (url: ${this.page.url()}).`,
    ).not.toHaveCount(0);
    const first = this.upcomingMovieCards.first();
    await expect(first).toBeVisible();
    await first.click();
    await this.page.waitForURL(MOVIE_DETAILS_URL, { timeout: 30_000 });
  }

  /**
   * The "mark interested" control on a coming-soon movie page.
   *
   * Text, not role. Measured 2026-09-21 on "The Paradise": this is a single
   * <span class="sc-1qdowf4-0 fnRjrw"> with NO role attribute, so
   * getByRole("button", { name: /Interested/i }) finds ZERO elements — that
   * probe is what sent an earlier pass looking for a control that was there
   * all along. The class is a hashed styled-component name and must not be
   * used. Exactly one element on the page carries this text, and the
   * apostrophe is a plain ASCII quote (char 39), not a typographic one.
   */
  get interestedControl(): Locator {
    return this.page.getByText("I'm interested", { exact: true }).filter({ visible: true });
  }

  /** A coming-soon page offers interest instead of booking. */
  async assertInterestPromptShown(): Promise<void> {
    await expect(this.page).toHaveURL(MOVIE_DETAILS_URL);
    await expect(this.page.getByText(/Mark interested to know when bookings open/i).first()).toBeVisible();
    await expect(this.interestedControl.first()).toBeVisible();
  }

  /**
   * Clicks "I'm interested" and waits for the page to actually say so.
   *
   * The third instance in this repo of the same hazard, and it bit here too:
   * the details page hydrates after it renders, so this span is visible,
   * stable and hit-testable before React attaches its handler, and a click
   * landing in that window is swallowed SILENTLY — Playwright's actionability
   * checks cannot see it. Measured 2026-09-21 on "The Vvaan - Force Of The
   * Forrest": an immediate click left the page still reading "Mark interested
   * to know when bookings open … I'm interested" 20s later, and the failure
   * surfaced on the assertion rather than on the click.
   *
   * So this verifies the OUTCOME and only retries the click when the outcome
   * has not arrived — the rule the README states as "verify the outcome of an
   * action, not just that the action was dispatched."
   */
  /**
   * Clicks until one of the two REAL outcomes arrives, and reports which.
   *
   * There are exactly two, and which one is correct depends on who is signed
   * in: a signed-in visitor gets the interest recorded, a logged-out one is
   * sent to /login/?referer=<movie>. Both scenarios share this click and each
   * asserts its own outcome, so neither has to treat the other's success as a
   * failure.
   */
  private async clickInterestedUntilOutcome(): Promise<"recorded" | "login" | null> {
    await expect(this.interestedControl.first()).toBeVisible();

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.interestedControl.first().click();

      for (let i = 0; i < 20; i++) {
        if (await this.interestRecorded()) return "recorded";
        if (/\/login\//i.test(this.page.url())) return "login";
        await this.page.waitForTimeout(500);
      }
    }
    return null;
  }

  /** Signed-in path: the interest must actually be recorded. */
  async markInterested(): Promise<void> {
    const outcome = await this.clickInterestedUntilOutcome();
    if (outcome === "recorded") return;
    if (outcome === "login") {
      throw new Error(
        `Marking interest redirected to ${this.page.url()} — the saved session is ` +
          `expired. Re-run "npm run auth:capture".`,
      );
    }
    throw new Error(
      `Clicked "I'm interested" three times on ${this.page.url()} and the page never ` +
        `confirmed it. The control is present and clickable, and the run is signed in, ` +
        `so this is not the hydration race that the retry above handles.`,
    );
  }

  /**
   * Logged-out path: the click is an ATTEMPT, and being sent to the login page
   * is the expected result, so this accepts either outcome and leaves the
   * scenario to assert which one it got.
   */
  async attemptMarkInterested(): Promise<void> {
    if (await this.clickInterestedUntilOutcome()) return;
    throw new Error(
      `Clicking "I'm interested" on ${this.page.url()} produced neither a sign-in ` +
        `redirect nor a confirmation. The click is being swallowed even after retries.`,
    );
  }

  /** True once the page reflects this account's interest, either way it says so. */
  private async interestRecorded(): Promise<boolean> {
    if (await this.interestRecordedText.first().isVisible().catch(() => false)) return true;
    return this.wishlistConfirmation.first().isVisible().catch(() => false);
  }

  /**
   * Proof that marking interest is account-gated, read from the URL rather
   * than from the sheet: measured 2026-09-21, clicking it while logged out
   * navigates to
   *   /login/?referer=/movies/hyderabad/the-paradise/ET00436621
   * so the login route plus the referer back to the movie is the stable
   * signal — the same URL-as-truth approach used for the language filter and
   * the booking funnel.
   */
  async assertSignInRequiredForInterest(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\/?\?referer=/i);
    await expect(this.page).toHaveURL(/referer=\/movies\//i);
  }

  /**
   * Confirmation that the signed-in user's interest is recorded.
   *
   * Measured 2026-09-21 on "The Paradise" with a signed-in session — the page
   * reads differently depending on who is looking:
   *   logged out : "313K+ are interested   Mark interested to know when
   *                 bookings open   I'm interested"
   *   signed in  : "You and 316K+ are interested   Movie added to your
   *                 Wishlist in your Profile   View"
   * So the logged-out prompt is NOT a subset of the signed-in one, and an
   * assertion written against one state fails against the other. That is what
   * this pair of locators is for.
   */
  get wishlistConfirmation(): Locator {
    return this.page.getByText(/Movie added to your Wishlist/i);
  }

  get interestRecordedText(): Locator {
    return this.page.getByText(/You and .*are interested/i);
  }

  /**
   * Opens the first coming-soon title this account has NOT already marked.
   *
   * Interest is PERSISTENT account state, which makes "mark the first upcoming
   * movie" a scenario that stops testing anything the moment it succeeds once:
   * on the next run that title shows "You and N are interested" and offers no
   * control, so an unconditional click fails, and a click guarded with "if it
   * is offered" passes without ever clicking. Either way the mutation itself
   * goes unverified — which is what happened here: the first run passed
   * against a title the account had marked long before.
   *
   * Searching for an unmarked title is what keeps the click real on every run.
   * Hrefs are collected up front and visited directly rather than navigating
   * back and forth, so the walk does not depend on the listing re-rendering in
   * the same order.
   *
   * This scenario CONSUMES account state and cannot be made infinitely
   * repeatable, because BookMyShow exposes no un-do: measured 2026-09-21, a
   * marked title offers only "View" (to /my-profile/wishlist) and no un-mark
   * control, and that wishlist page renders as "Hi, Guest" for an automated
   * session, so no removal path could be established. The default therefore
   * scans the WHOLE coming-soon listing (~19 titles) rather than the first
   * few, and when it is exhausted the error says so and what to do. A one-way
   * action with no un-do simply cannot be verified without spending a fixture.
   */
  async openFirstUpcomingMovieOfferingInterest(maxCards = 25): Promise<void> {
    const hrefs = (
      await this.upcomingMovieCards.evaluateAll((els) => els.map((e) => e.getAttribute("href")))
    )
      .filter((h): h is string => Boolean(h))
      .slice(0, maxCards);

    for (const href of hrefs) {
      await this.page.goto(href, { waitUntil: "domcontentloaded" });
      await this.settleThroughBotCheck();
      // Same settle BasePage.open() uses: this page hydrates client-side, and
      // reading the interest state before it does reports the wrong one.
      await this.page.waitForTimeout(4500);
      if (await this.interestRecorded()) continue;
      if (await this.interestedControl.first().isVisible().catch(() => false)) return;
    }

    throw new Error(
      [
        `All ${hrefs.length} coming-soon titles are already marked interested by this`,
        `account, so there is nothing left to mark and the click cannot be exercised.`,
        ``,
        `This is account state, NOT a selector or product problem. Marking interest is`,
        `one-way in the UI, so each run of this scenario spends one title.`,
        ``,
        `To restore it: un-mark a title from ${"https://in.bookmyshow.com/my-profile/wishlist"},`,
        `or point the suite at a different account. The pool also refills on its own as`,
        `BookMyShow adds new releases.`,
      ].join("\n"),
    );
  }

  /**
   * Marks interest only when it is not already marked, and reports which case
   * it was. Kept for callers that land on an arbitrary title; scenarios that
   * need the click to actually happen use
   * openFirstUpcomingMovieOfferingInterest() first.
   */
  async markInterestedIfNotAlready(): Promise<boolean> {
    if (!(await this.interestedControl.first().isVisible().catch(() => false))) return false;
    await this.interestedControl.first().click();
    return true;
  }

  async assertInterestRecorded(): Promise<void> {
    await expect(
      this.interestRecordedText.first(),
      `The movie page does not show this account's interest (url: ${this.page.url()}). ` +
        `If the run is actually logged out the page says "Mark interested to know when ` +
        `bookings open" instead — re-run "npm run auth:capture".`,
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.wishlistConfirmation.first()).toBeVisible();
    await expect(this.page).toHaveURL(MOVIE_DETAILS_URL);
    await expect(this.loginSheetHeading).toBeHidden();
  }
}
