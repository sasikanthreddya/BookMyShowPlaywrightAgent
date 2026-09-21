import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Cross-service behaviour shared by every BookMyShow service POM
 * (Movies, Events, Plays, Sports, Activities, Stream).
 *
 * BookMyShow gates every service behind a city choice, so the city handling
 * lives here once instead of being duplicated per service.
 *
 * Every selector below was read from the real rendered page on 2026-09-17,
 * not guessed. Grounded facts:
 *   - The landing page opens a city bottom sheet whose container id is
 *     "bottomSheet-model-close"; it lists "Popular Cities" with each city as
 *     an exact-text node ("Hyderabad", "Mumbai", "Delhi-NCR", ...).
 *   - Before a city is chosen the header reads "Select your region".
 *   - After choosing Hyderabad the URL becomes /explore/home/hyderabad and
 *     the header renders a <span> with the exact text "Hyderabad".
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async open(path = "/"): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    // Cloudflare sits in front of every page and has two distinct responses,
    // which need opposite handling: a TRANSIENT verification interstitial that
    // clears itself, and a TERMINAL block page that never will.
    await this.settleThroughBotCheck();
    await this.assertNotBlocked();
    // The city bottom sheet and the header hydrate client-side.
    await this.page.waitForTimeout(4500);
  }

  /**
   * Waits out Cloudflare's interim challenge page.
   *
   * Observed 2026-09-17: roughly one run in five lands on a page headed
   * "Performing security verification" instead of BookMyShow. It is a JS
   * challenge that resolves on its own after a few seconds and then renders
   * the real page, so failing on sight would be wrong — but so is ignoring
   * it, because every later locator is missing while it is up. Previously
   * this surfaced as a confusing 30s timeout inside ensureCity, blaming the
   * city picker for a page that was never BookMyShow.
   */
  async settleThroughBotCheck(): Promise<void> {
    const interstitial = this.page.getByRole("heading", {
      name: /Performing security verification|Just a moment|Checking your browser/i,
    });
    if (!(await interstitial.first().isVisible().catch(() => false))) return;
    await interstitial.first().waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /**
   * Fails fast, and loudly, when Cloudflare served a block/challenge page
   * instead of BookMyShow. This is an environment problem, not a test bug,
   * so the message says what to check rather than which locator missed.
   *
   * Includes the verification interstitial: by this point settleThroughBotCheck
   * has already given it time to clear, so if it is still up it is stuck and
   * should be reported as a block rather than left to break a later step.
   */
  async assertNotBlocked(): Promise<void> {
    const blocked = await this.page
      .getByRole("heading", {
        name: /Sorry, you have been blocked|Attention Required|Performing security verification|Just a moment|Checking your browser/i,
      })
      .count();
    if (!blocked) return;

    throw new Error(
      [
        `Cloudflare blocked this run — BookMyShow never loaded (url: ${this.page.url()}).`,
        `This is an environment/bot-detection failure, not a broken assertion.`,
        `Known-good combination (measured 2026-09-17): real Chrome, HEADED.`,
        `Check that playwright.config.ts still sets channel "chrome" and headless false,`,
        `and that BMS_HEADLESS is not set to 1.`,
        `A verification page that never cleared can also just be rate limiting —`,
        `re-run after a pause before changing any selector.`,
      ].join("\n"),
    );
  }

  /** Container of the landing city picker. Present only while it is open. */
  get cityBottomSheet(): Locator {
    return this.page.locator("#bottomSheet-model-close");
  }

  /**
   * Header control that opens the city picker, in its pre-selection state.
   * Measured 2026-09-17: before a city is chosen the header reads "Select
   * your region"; once one is chosen it renders a button named for the city
   * (and no "Select your region" text at all).
   */
  get regionControl(): Locator {
    return this.page.getByText(/Select your region/i).first();
  }

  /**
   * Whatever opens the city picker, in EITHER header state.
   *
   * "Select your region" only exists before a city has ever been chosen. Once
   * one is set the header shows a button named for it instead, so switching
   * from Hyderabad to Mumbai has no "Select your region" to click and the
   * pre-selection locator simply times out. Measured 2026-09-21: the header
   * renders `button "Hyderabad"`, and clicking it opens a picker with a
   * `textbox "Search for your city"` above the "Popular Cities" list.
   *
   * The current city is read from the URL rather than guessed, and the
   * pre-selection control is kept as the fallback for a first visit.
   */
  get cityPickerTrigger(): Locator {
    const current = this.activeCityFromUrl();
    if (!current) return this.regionControl;
    return this.page
      .getByRole("button", { name: new RegExp(`^${current}$`, "i") })
      .first()
      .or(this.regionControl)
      .first();
  }

  cityOption(city: string): Locator {
    return this.page.getByText(new RegExp(`^${city}$`), { exact: false }).first();
  }

  /**
   * The city currently reflected in the URL, e.g. "hyderabad", else null.
   *
   * Every listing carries it as the LAST hyphenated segment of the explore
   * path — /explore/movies-hyderabad, /explore/events-hyderabad,
   * /explore/upcoming-movies-hyderabad — and the home page as
   * /explore/home/hyderabad. Stream (/explore/c/stream) carries none.
   *
   * It used to recognise only home and movies, which is why switching city
   * worked on the Movies listing and nowhere else: on /explore/events-hyderabad
   * this returned null, cityPickerTrigger fell back to the "Select your region"
   * control that only exists before a first city choice, and ensureCity timed
   * out. Measured 2026-09-21: the header on every listing renders
   * `button "<City>"` once a city is set, so the pattern is the only thing that
   * had to widen.
   *
   * Single-word cities only ("delhi-ncr" would come back as "ncr"); the suite
   * uses Hyderabad and Mumbai.
   */
  activeCityFromUrl(): string | null {
    const m = /\/explore\/(?:home\/|[a-z-]+-)([a-z]+)(?=[/?#]|$)/i.exec(this.page.url());
    return m ? m[1] : null;
  }

  /**
   * True when `city` is already the active city, by URL or by the header.
   * BookMyShow sometimes geo-redirects straight to /explore/home/<city>, in
   * which case there is nothing to select.
   */
  async cityIsActive(city: string): Promise<boolean> {
    if ((this.activeCityFromUrl() ?? "").toLowerCase() === city.toLowerCase()) return true;
    return this.page
      .getByRole("button", { name: new RegExp(`^${city}$`, "i") })
      .first()
      .isVisible()
      .catch(() => false);
  }

  /**
   * Implements the flow's conditional "select Hyderabad as city if not
   * selected": chooses the city only when it is not already active.
   *
   * The landing state varies per run, and all of these are normal:
   *   a) geo-redirect to /explore/home/<city>  -> already set, nothing to do
   *   b) the city bottom sheet is open         -> pick from the sheet
   *   c) header reads "Select your region"     -> open the picker, then pick
   *   d) the sheet is up but holds NO city list -> dismiss it, then (c)
   *   e) a DIFFERENT city is already set       -> the header shows a button
   *      named for it, not "Select your region"; cityPickerTrigger covers
   *      both, which is what makes switching cities possible at all.
   *
   * Both the sheet and the header hydrate client-side, so this must WAIT for
   * one of those states rather than read counts once. The previous version
   * gated each branch on `await locator.count()`, a single non-retrying read:
   * if neither had hydrated yet it silently did nothing and returned as if it
   * had succeeded, leaving the wrong city set. That was the intermittent
   * failure in this method. It now waits for a known state and throws if none
   * arrives, so a genuine regression cannot pass as success.
   *
   * (d) is why the sheet, not the header, decides the branch. The two are NOT
   * mutually exclusive: the sheet overlays the header, so "the header is
   * visible" never implies "the sheet is not up". Choosing by whichever of the
   * two rendered first therefore picked (c) for a state that is really (d),
   * and (c) cannot work while the overlay is present -- see dismissCitySheet().
   */
  async ensureCity(city: string): Promise<void> {
    if (await this.cityIsActive(city)) return;

    const cityRe = new RegExp(`^${city}$`, "i");
    const sheetOption = this.cityBottomSheet.getByText(cityRe).filter({ visible: true }).first();

    // Auto-retries until the sheet or the header is actually rendered.
    await expect(
      sheetOption.or(this.cityPickerTrigger).first(),
      `Neither the city bottom sheet nor a header city control appeared, so "${city}" ` +
        `could not be selected (url: ${this.page.url()}).`,
    ).toBeVisible({ timeout: 30_000 });

    // An open sheet wins, and is checked by count() on the CONTAINER rather
    // than on a visible option: a sheet mid-hydration has a container but no
    // options yet, and that is precisely the state that must not fall through
    // to the header.
    if (await this.cityBottomSheet.count()) {
      if (await this.becomesVisible(sheetOption, 5_000)) {
        await sheetOption.click();
        await this.page.waitForURL(new RegExp(city, "i"), { timeout: 30_000 });
        return;
      }
      await this.dismissCitySheet();
    }

    await this.clickPastDeadSheet(this.cityPickerTrigger);

    // Whichever picker opened, take the first VISIBLE exact match: the page
    // renders hidden duplicates of the city nodes, and clicking one of those
    // is what used to time out here. Waiting for it is also what proves the
    // header click actually landed, however it was delivered.
    const pickerOption = this.page.getByText(cityRe).filter({ visible: true }).first();
    await expect(
      pickerOption,
      `The city picker did not open after clicking the header city control ` +
        `(url: ${this.page.url()}), so "${city}" could not be selected. A leftover ` +
        `bottom-sheet backdrop (#bottomSheet-model-close) can swallow that click; ` +
        `dismissing it and dispatching the click past it are both already tried here, ` +
        `so this is something new — open the page and look before touching selectors.`,
    ).toBeVisible({ timeout: 20_000 });
    await this.clickPastDeadSheet(pickerOption);

    await this.page.waitForURL(new RegExp(city, "i"), { timeout: 30_000 });
  }

  /**
   * Clicks `target`, and if a dead city bottom sheet is swallowing the click,
   * delivers it again in a way hit-testing cannot block.
   *
   * Measured 2026-09-18: a run landed with #bottomSheet-model-close mounted
   * over the header holding NO city list, and it would not go away — neither
   * Escape nor a click on the container, whose own data-testid is
   * "modalClose", had any effect over 20s. The element underneath is a real,
   * working button; the backdrop is transparent, so it reports
   * visible/enabled/stable while every real click lands on the corpse.
   *
   * dispatchEvent bypasses hit-testing and delivers the event on the element
   * itself. It still bubbles to the app's root listener exactly as a real
   * click does, so React's handler runs — this presses the button, it does not
   * fake the outcome, and the caller still has to see the picker open.
   *
   * Narrow on purpose: with no sheet in the DOM the original failure is
   * re-thrown untouched, so this cannot paper over an ordinary "the thing I
   * wanted to click is covered by something real" bug.
   */
  private async clickPastDeadSheet(target: Locator, timeout = 10_000): Promise<void> {
    try {
      await target.click({ timeout });
    } catch (cause) {
      if (!(await this.cityBottomSheet.count())) throw cause;
      await target.dispatchEvent("click");
    }
  }

  /** Bounded "did it show up?", as a boolean instead of a thrown timeout. */
  private becomesVisible(target: Locator, timeout: number): Promise<boolean> {
    return target.waitFor({ state: "visible", timeout }).then(
      () => true,
      () => false,
    );
  }

  /**
   * Closes a city bottom sheet that is up but unusable.
   *
   * Measured 2026-09-18, on the Stream run: the sheet container was present
   * and intercepting pointer events while holding NO city list at all --
   * nothing for it in the accessibility tree, so no option could be clicked --
   * and it stayed that way for the full 120s test timeout, so it is a stuck
   * sheet and not an animation to wait out. Escape first, then the container
   * itself: its data-testid is "modalClose", i.e. it IS the sheet's close
   * control, and clicking it cannot be intercepted by the sheet it closes.
   *
   * Guarded on count() the way the project's conditional-step rule requires:
   * with no sheet in the DOM this does nothing. Failing to close is left to
   * the caller to report, because by then the useful context is the header
   * click it blocks.
   */
  private async dismissCitySheet(): Promise<void> {
    if (!(await this.cityBottomSheet.count())) return;

    await this.page.keyboard.press("Escape").catch(() => {});
    if (await this.sheetIsGone()) return;

    await this.cityBottomSheet.click({ timeout: 3_000 }).catch(() => {});
    await this.sheetIsGone();
  }

  /**
   * True once no city sheet is showing (hidden or detached both count).
   *
   * Short timeout on purpose: an already-hidden sheet resolves instantly, and
   * every second spent here is charged to a scenario that has a live site, a
   * Cloudflare interstitial and an 8000px lazy-loading scroll to pay for too.
   */
  private sheetIsGone(): Promise<boolean> {
    return this.cityBottomSheet.first().waitFor({ state: "hidden", timeout: 3_000 }).then(
      () => true,
      () => false,
    );
  }

  async assertCity(city: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(city, "i"));
  }

  /**
   * Opens a service tab by name. Shared because every service has one, and
   * the landing URL differs per service (Movies goes to
   * /explore/movies-<city>, Stream to /explore/c/stream), so this only waits
   * for the navigation to happen and leaves the landing assertion to the
   * service's own step.
   */
  async openServiceTab(service: string): Promise<void> {
    const before = this.page.url();
    await this.serviceTab(service).click();

    // "The URL changed" alone is wrong once a scenario can switch city: after
    // switching, the browser may ALREADY be on that service's listing, and
    // clicking its tab then changes nothing and the wait times out on a click
    // that worked. So either a change or already being on the service counts.
    // Stream is /explore/c/stream; every other service is /explore/<name>-<city>.
    const onService = new RegExp(`/explore/(c/)?${service}`, "i");
    await this.page.waitForURL((u) => u.toString() !== before || onService.test(u.toString()), {
      timeout: 30_000,
    });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    await this.page.waitForTimeout(3000);
  }

  /** Any service tab in the primary navigation: Movies, Events, Plays, ... */
  serviceTab(service: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(`^${service}$`, "i") }).first();
  }

  /**
   * A filter group header in the left rail ("Languages", "Genres", "Format",
   * "Categories", "Date", "Price"), or one of its options.
   *
   * Both are plain buttons carrying aria-pressed, so one locator serves both.
   * `exact: true` matches the accessible name literally rather than as a
   * RegExp, so an option containing regex metacharacters ("0 - 500") cannot
   * misbehave.
   *
   * `.filter({ visible: true })` is load-bearing, not defensive: measured
   * 2026-09-21 the Events listing renders "Comedy Shows" TWICE visibly (the
   * filter rail and a quick-chip row under the H1), on top of BookMyShow's
   * usual hidden duplicates. Same trap SportsPage documents on "Cricket".
   */
  filterControl(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true }).filter({ visible: true });
  }

  /**
   * Applies one option from one filter group, e.g. ("Categories", "Comedy
   * Shows") or ("Genres", "Action").
   *
   * Shared rather than per-service because the rail is the same component
   * everywhere: measured 2026-09-21, Movies exposes Languages/Genres/Format
   * and Events exposes Categories/Date/Languages/More Filters/Price, all as
   * button + aria-pressed with a per-group "Clear".
   *
   * The group header is a TOGGLE, and the groups do not start in the same
   * state — Movies opens with "Languages" expanded, Events with "Categories"
   * expanded, everything else collapsed. Clicking the header of an
   * ALREADY-expanded group therefore collapses it and hides the very option
   * we are about to click. So the header is only clicked when the option is
   * not already on screen, which is the project's conditional-step rule
   * (guard the condition; never click unconditionally).
   */
  async applyFilterOption(group: string, option: string): Promise<void> {
    const target = this.filterControl(option);

    if (!(await target.first().isVisible().catch(() => false))) {
      await expect(
        this.filterControl(group).first(),
        `No "${group}" filter group on this listing (url: ${this.page.url()}).`,
      ).toBeVisible({ timeout: 20_000 });
      await this.filterControl(group).first().click();
      await this.page.waitForTimeout(1500);
    }

    await expect(
      target.first(),
      `The "${group}" filter offers no "${option}" option (url: ${this.page.url()}). ` +
        `These lists are driven by what is currently on sale in the city, so check the ` +
        `page in a browser before changing selectors.`,
    ).toBeVisible({ timeout: 20_000 });

    await target.first().click();
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /**
   * Filter success is read from the URL, which is the only stable signal on
   * this site — the same URL-as-truth approach the Movies language filter and
   * the Sports type filter already use.
   *
   * The expected fragment is passed in by the caller (it lives in the feature's
   * Examples table) rather than derived here, because the encodings genuinely
   * differ per group and are not guessable. Measured 2026-09-21:
   *   Categories "Comedy Shows" -> categories=comedy-shows
   *   Date       "Today"        -> daygroups=today
   *   Languages  "English"      -> languages=english
   *   Price      "Free"         -> priceGroup=0to0      (NOT a slug of "Free")
   *   Genres     "Action"       -> genres=action
   *   Format     "2D"           -> format=2D            (case PRESERVED)
   */
  async assertUrlCarries(fragment: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  /**
   * Clears an applied filter via the rail's "Clear" control.
   *
   * Each group has its own "Clear" (measured: 5 visible on the Events rail),
   * and they are not distinguishable by accessible name. This clicks the
   * first, which is only unambiguous when a single filter is applied — so the
   * scenario using it applies exactly one. Measured 2026-09-21: with only
   * categories=comedy-shows applied, it returned the URL to a bare
   * /explore/events-hyderabad.
   */
  async clearFirstFilter(): Promise<void> {
    const clear = this.filterControl("Clear").first();
    await expect(clear, `No "Clear" control on this listing (url: ${this.page.url()}).`).toBeVisible({
      timeout: 20_000,
    });
    await clear.click();
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /**
   * "We are still on the listing page" — URL shape plus its heading, WITHOUT
   * requiring any result cards.
   *
   * Filter scenarios must assert this rather than "the listing is displayed".
   * A filter returning nothing is a legitimate outcome on a live catalogue,
   * not a defect: measured 2026-09-21, Plays with "Price: Free" and Plays with
   * "Date: Today" both matched ZERO items in Hyderabad, and asserting cards
   * there failed for a reason that had nothing to do with the filter. Sports
   * documents the same hazard from the other side, where "Cricket" matched
   * exactly one event.
   *
   * What the scenario is really claiming is "the filter was applied", and the
   * URL is the proof of that; this only adds that we did not get bounced off
   * the listing entirely.
   */
  async assertListingPageShown(): Promise<void> {
    await expect(this.page).toHaveURL(/\/explore\//i);
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }

  /**
   * The counterpart to assertUrlCarries, for the per-group "Clear" control.
   * Measured 2026-09-21: with ?languages=telugu&genres=drama applied, the
   * FIRST visible Clear removed only `languages`, leaving `genres=drama` —
   * each Clear belongs to its own group rather than resetting everything.
   */
  async assertUrlDoesNotCarry(fragment: string): Promise<void> {
    await expect(this.page).not.toHaveURL(
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  async assertUrlHasNoFilters(): Promise<void> {
    await expect(this.page).not.toHaveURL(/[?&](categories|daygroups|priceGroup|languages|genres|format)=/i);
  }

  /**
   * A content section on a details page, found by its heading text. Measured
   * 2026-09-21: Events, Plays, Sports and Activities all render
   * `h2 "About The Event"`; a movie page renders `h4 "About the movie"`,
   * `h4 "Cast"` and `h4 "Crew"`. Case-insensitive because the two products
   * capitalise "the" differently.
   */
  async assertSectionShown(heading: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).first(),
      `No "${heading}" section heading on this page (url: ${this.page.url()}).`,
    ).toBeVisible();
  }

  /**
   * "<N> are interested" — a read-only count rendered on every non-Movies
   * details page (Events, Plays, Sports, Activities; measured 2026-09-21).
   * Movies renders the same phrase only on coming-soon titles.
   */
  async assertInterestedCountShown(): Promise<void> {
    await expect(this.page.getByText(/are interested/i).first()).toBeVisible();
  }

  /**
   * A named LINK is present and visible, without clicking it. "Book Now" is a
   * link on Events, Sports, Plays and Activities (and a BUTTON named "Book
   * tickets" on Movies, which has its own assertion).
   */
  async assertLinkAvailable(name: string): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  }

  /**
   * "Read More" under a details-page description. Measured 2026-09-21 on an
   * event and a play: a `button "Read More"` that, once clicked, becomes
   * `button "Read Less"` and the description's text grows. The button swap is
   * the stable signal; text length is not asserted because a short description
   * can grow by a single line.
   */
  get readMoreButton(): Locator {
    return this.page.getByRole("button", { name: /^Read More$/i }).filter({ visible: true });
  }

  get readLessButton(): Locator {
    return this.page.getByRole("button", { name: /^Read Less$/i }).filter({ visible: true });
  }

  async expandDescription(): Promise<void> {
    await expect(
      this.readMoreButton.first(),
      `No "Read More" control on this page (url: ${this.page.url()}). A short description ` +
        `has nothing to expand, so check the page before touching selectors.`,
    ).toBeVisible();
    await this.readMoreButton.first().click();
  }

  async assertDescriptionExpanded(): Promise<void> {
    await expect(this.readLessButton.first()).toBeVisible();
    await expect(this.readMoreButton).toHaveCount(0);
  }

  /**
   * The pay CTA on every ticket / date-time page: "Review & Proceed to Pay",
   * rendered disabled until something is chosen. Named here only so the suite
   * can assert it EXISTS and never clicks it. Shared because Events, Sports,
   * Plays and Activities all render it identically (measured 2026-09-21).
   */
  get proceedToPayButton(): Locator {
    return this.page.getByRole("button", { name: /Proceed to Pay/i });
  }

  /**
   * The suite's hard stop. Asserts the payment CTA is PRESENT and never
   * touches it — see README "Booking funnel boundary".
   */
  async assertPaymentNotStarted(): Promise<void> {
    await expect(this.proceedToPayButton.first()).toBeVisible();
    await expect(this.page).not.toHaveURL(/payment|checkout/i);
  }

  /**
   * Directory pages — the cinemas directory (/<city>/cinemas) and the venues
   * directory (/venues?category=<service>) — share one shape, measured
   * 2026-09-21: an h1, a `textbox "Search by cinema or area"` /
   * `textbox "Search by venues or area"`, and a `grid` whose rows alternate an
   * `"Add to favourites"` button with a button named for the entry
   * ("Prasads Multiplex: Hyderabad <address>"). Typing in the box filters the
   * grid client-side without changing the URL (48 -> 1 for a full name), and
   * clicking an entry navigates to that cinema's or venue's own page.
   */
  get directorySearchBox(): Locator {
    return this.page.getByRole("textbox", { name: /^Search by (cinema|venues?) or area$/i });
  }

  get directoryEntries(): Locator {
    return this.page
      .getByRole("grid")
      .getByRole("button")
      .filter({ hasNotText: /Add to favourites/i })
      .filter({ hasText: /\S/ });
  }

  /** Name searched for in the directory, so the follow-up assertion needs no argument. */
  private lastDirectoryQuery = "";

  /**
   * The entry name is everything before the colon: "Prasads Multiplex: Hyderabad
   * Khairtabad, ..." -> "Prasads Multiplex". That is what a visitor would type,
   * and it is read off today's page rather than hard-coded because the
   * directory order is the site's own.
   */
  async searchDirectoryForFirstEntry(): Promise<void> {
    await expect(this.directoryEntries.first()).toBeVisible();
    const name = ((await this.directoryEntries.first().textContent()) ?? "").split(":")[0].trim();
    if (!name) throw new Error(`Could not read a name from the first directory entry (url: ${this.page.url()}).`);
    this.lastDirectoryQuery = name;
    await expect(this.directorySearchBox).toBeVisible();
    await this.directorySearchBox.fill(name);
  }

  async assertDirectoryListsSearchedEntry(): Promise<void> {
    const wanted = this.directoryEntries.filter({ hasText: this.lastDirectoryQuery });
    await expect(
      wanted.first(),
      `Searching the directory for "${this.lastDirectoryQuery}" — a name taken from its own ` +
        `first row — left no matching entry (url: ${this.page.url()}).`,
    ).toBeVisible();
    // The search must actually narrow the list, not merely leave the entry in place.
    await expect(this.directoryEntries.filter({ hasNotText: this.lastDirectoryQuery })).toHaveCount(0);
  }

  /**
   * Favouriting a directory entry, shared by the cinemas and venues
   * directories because both render the same control.
   *
   * Measured 2026-09-21 on /venues?category=plays:
   *   logged out : clicking one navigates to /login/?referer=/venues?category=plays
   *   signed in  : it stays put, "Add to favourites" drops 7 -> 6 and a
   *                "Remove from favourites" control appears
   * and clicking that restores it to 7. **It is reversible**, which is what
   * makes the signed-in scenario repeatable — unlike marking a movie
   * interested, which is one-way and spends a fixture on every run.
   */
  get addToFavouritesButtons(): Locator {
    return this.page.getByRole("button", { name: /Add to favourites/i }).filter({ visible: true });
  }

  get removeFromFavouritesButtons(): Locator {
    return this.page
      .getByRole("button", { name: /Remove from favourites|Favourited/i })
      .filter({ visible: true });
  }

  /** How many entries were favouritable before the click, to prove it changed. */
  private favouritesBefore = -1;

  async favouriteFirstDirectoryEntry(): Promise<void> {
    await expect(this.addToFavouritesButtons.first()).toBeVisible();
    this.favouritesBefore = await this.addToFavouritesButtons.count();
    await this.addToFavouritesButtons.first().click();
  }

  async assertSignInRequiredForFavourite(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\/?\?referer=/i);
  }

  /**
   * Two independent signals, so this cannot pass on a page that merely failed
   * to navigate: a "Remove from favourites" control exists, and one fewer
   * entry is still offering "Add to favourites".
   */
  async assertEntryFavourited(): Promise<void> {
    await expect(
      this.removeFromFavouritesButtons.first(),
      `Favouriting did not take — no "Remove from favourites" control appeared ` +
        `(url: ${this.page.url()}). If this run is not actually signed in, the click ` +
        `would have gone to /login/ instead.`,
    ).toBeVisible({ timeout: 20_000 });
    if (this.favouritesBefore > 0) {
      await expect(this.addToFavouritesButtons).toHaveCount(this.favouritesBefore - 1);
    }
  }

  /**
   * Puts the account back how it was found. Worth doing precisely because it
   * is possible here: a test that mutates real account state should restore
   * it when the UI offers a way, so the scenario can run again tomorrow.
   */
  async unfavouriteFirstDirectoryEntry(): Promise<void> {
    await expect(this.removeFromFavouritesButtons.first()).toBeVisible();
    await this.removeFromFavouritesButtons.first().click();
  }

  async assertFavouriteRestored(): Promise<void> {
    await expect(this.removeFromFavouritesButtons).toHaveCount(0, { timeout: 20_000 });
    if (this.favouritesBefore > 0) {
      await expect(this.addToFavouritesButtons).toHaveCount(this.favouritesBefore);
    }
  }

  /**
   * "Browse by Venues", the last control in every non-Movies filter rail.
   * Measured 2026-09-21 from Events: it leaves /explore/ for
   * /venues?category=events, headed "Venues for Events in Hyderabad".
   */
  get browseByVenuesControl(): Locator {
    return this.page.getByRole("button", { name: /^Browse by Venues$/i }).filter({ visible: true });
  }

  async openBrowseByVenues(): Promise<void> {
    await expect(this.browseByVenuesControl.first()).toBeVisible();
    await this.browseByVenuesControl.first().click();
    await this.page.waitForURL(/\/venues/i, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async assertVenuesDirectoryShown(service: string, city: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/venues/i);
    await expect(
      this.page.getByRole("heading", { name: new RegExp(`^Venues for ${service} in ${city}$`, "i") }).first(),
    ).toBeVisible();
    await expect(this.directoryEntries.first()).toBeVisible();
  }

  /**
   * Header search driven by a title read off the page, for the "search for
   * whatever shows first" scenarios every service has. See
   * assertSearchReturnedResults for why the assertion is a count.
   */
  async searchForTitle(title: string): Promise<void> {
    await this.openSearch();
    await this.searchFor(title);
  }

  /**
   * Header search. Cross-service by nature — its placeholder names every
   * service ("Search for Movies, Events, Plays, Sports and Activities") and
   * its results mix movies, artists and venues.
   *
   * Grounded 2026-09-21: opening it does NOT change the URL, and neither does
   * typing, so there is no navigation to wait on and no URL to assert. The
   * results are a single flat text node beginning "Showing N results", with a
   * "View All Results" control at the end.
   */
  get searchTrigger(): Locator {
    return this.page.getByRole("button", { name: /^Search for Movies/i }).filter({ visible: true });
  }

  get searchBox(): Locator {
    return this.page.getByRole("textbox").filter({ visible: true }).first();
  }

  /** The results blob. Matching the counter is what identifies it. */
  get searchResults(): Locator {
    return this.page.getByText(/Showing \d+ results?/i).first();
  }

  async openSearch(): Promise<void> {
    await expect(this.searchTrigger.first()).toBeVisible();
    await this.searchTrigger.first().click();
    await expect(this.searchBox).toBeVisible({ timeout: 20_000 });
  }

  async searchFor(query: string): Promise<void> {
    await this.searchBox.fill(query);
  }

  /**
   * Asserts the query reached the backend and matched something.
   *
   * Deliberately does NOT claim a particular title is among the results, and
   * that restraint is the point. Measured 2026-09-21:
   *   - the counter is its own <span> ("Showing 10 results"); its ancestors up
   *     to six levels hold only the counter and the category tabs, so the
   *     result rows are SIBLINGS and there is no container that holds both;
   *   - the rows do not render the movie as a titled link — searching for a
   *     showing film produced exactly ONE anchor containing its title, and
   *     that was the listing card on the page UNDERNEATH the overlay;
   *   - Enter does not submit to a results page; the URL never changes.
   * So any "the results contain X" assertion available here would be
   * satisfiable by the page behind the panel, i.e. it would pass with search
   * completely broken. A non-zero count is the strongest honest claim, and it
   * still fails if the query never reaches the backend.
   */
  async assertSearchReturnedResults(): Promise<void> {
    await expect(
      this.searchResults,
      `The search panel never showed a "Showing N results" count (url: ${this.page.url()}).`,
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      this.searchResults,
      `Search returned zero results for a title taken from today's own listing, ` +
        `which should always match something.`,
    ).toHaveText(/Showing [1-9]\d* results?/i);
  }

  /** The sign-in sheet BookMyShow opens for actions that need an account. */
  get loginSheetHeading(): Locator {
    return this.page.getByRole("heading", { name: /^Get Started$/i });
  }

  /**
   * Header control present only while logged OUT, so its absence is the
   * logged-in signal used by the session-capture script.
   */
  get signInButton(): Locator {
    return this.page.getByRole("button", { name: /^Sign in$/i });
  }

  /**
   * Gate for @account scenarios: they are meaningless against a logged-out
   * browser, and would "pass" misleadingly if the saved session were missing
   * or expired (a negative assertion like "was not asked to sign in" is
   * trivially true when the action never got that far). So this fails first,
   * with the command that fixes it.
   */
  async assertSignedIn(): Promise<void> {
    await expect(
      this.signInButton,
      `This scenario needs a signed-in session but the header still offers "Sign in" ` +
        `(url: ${this.page.url()}).\n` +
        `Capture one with:  npm run auth:capture\n` +
        `It writes .auth/user.json, which the "account" project loads as storageState. ` +
        `Sessions expire, so re-run it when @account scenarios start failing here.`,
    ).toHaveCount(0);
  }

  async assertLoginRequested(): Promise<void> {
    await expect(
      this.loginSheetHeading,
      `Expected BookMyShow to ask for a sign-in (its sheet is headed "Get Started") ` +
        `but no sheet appeared (url: ${this.page.url()}).`,
    ).toBeVisible({ timeout: 20_000 });
  }

  /**
   * Measured 2026-09-21: the sheet offers Google, Email and Apple as buttons
   * plus a mobile-number textbox. Asserting the Google option specifically is
   * what ties this scenario to the SSO route the suite documents.
   */
  async assertLoginOptionAvailable(option: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: new RegExp(`^${option}$`, "i") }).first()).toBeVisible();
  }
}
