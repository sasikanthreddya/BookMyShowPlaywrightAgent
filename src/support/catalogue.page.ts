import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Shared behaviour for the services whose pages are the SAME shape, differing
 * only in a URL slug. Measured 2026-09-21, Plays and Activities are identical
 * end to end:
 *
 *   listing   /explore/<slug>-hyderabad?cat=XX   h1 "<Service> in Hyderabad"
 *   cards     a[href*="/<slug>/"][href*="/ET"]   absolute, no city segment
 *   details   /<slug>/<title-slug>/ET<id>        CTA "Book Now" as a LINK
 *   booking   /<slug>/<title-slug>/ET<id>/date-time/<venue>
 *
 * so PlaysPage and ActivitiesPage are the slug plus a name, and everything
 * else lives here once.
 *
 * EventsPage deliberately does NOT extend this. Events looks similar but its
 * CTA skips the date step and goes straight to /ticket/<venue>/<id>, and its
 * details page carries an "<N> are interested" count that these do not — so
 * folding it in would mean parameterising the two things that actually differ.
 */
export abstract class CataloguePage extends BasePage {
  /** URL segment: "plays", "activities". */
  protected abstract readonly slug: string;
  /** Nav tab and heading wording: "Plays", "Activities". */
  protected abstract readonly serviceName: string;

  /** Title slug of the item opened from the listing, for the follow-up check. */
  private lastOpenedSlug = "";

  protected get detailsUrl(): RegExp {
    return new RegExp(`/${this.slug}/[^/]+/ET\\d+`, "i");
  }

  protected get dateTimeUrl(): RegExp {
    return new RegExp(`/${this.slug}/[^/]+/ET\\d+/date-time/`, "i");
  }

  /**
   * Listing cards. Pairing the slug with the "/ET" id is what keeps this off
   * the nav link and the footer: the nav href is /explore/plays-hyderabad,
   * which contains "/plays-" but never "/plays/".
   */
  get itemCards(): Locator {
    return this.page.locator(`a[href*="/${this.slug}/"][href*="/ET"]`);
  }

  /** A LINK on these services, not a button. */
  get bookNowLink(): Locator {
    return this.page.getByRole("link", { name: /^Book Now$/i }).filter({ visible: true });
  }

  /**
   * A selectable date on the date-time page. Measured: the accessible name is
   * the date CODE ("20261002") and the visible text is "Fri 02 Oct", so the
   * eight-digit name is the stable handle and is locale-independent.
   */
  get dateOptions(): Locator {
    return this.page.getByRole("button", { name: /^\d{8}$/ });
  }

  /**
   * The date-time page's own "Proceed", which leads to seats (Plays) or
   * tickets (Activities). Rendered DISABLED until a date is chosen, measured
   * 2026-09-21; asserting it becomes enabled is the proof a date selection
   * registered, and it is never clicked because everything past it is
   * inventory.
   */
  get proceedButton(): Locator {
    return this.page.getByRole("button", { name: /^Proceed$/i });
  }

  /**
   * "See all dates" — Activities only, measured 2026-09-21 on a multi-week
   * run: it swaps the seven-day strip for a month calendar whose buttons are
   * named "Sun 11 Oct 2026" etc., unavailable days disabled. Plays showed only
   * three dates and no such control, so a Plays scenario must not use it.
   */
  get seeAllDatesButton(): Locator {
    return this.page.getByRole("button", { name: /^See all dates$/i }).filter({ visible: true });
  }

  get calendarDayButtons(): Locator {
    return this.page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2} [A-Z][a-z]{2} \d{4}$/ });
  }

  async assertListingShown(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/explore/${this.slug}`, "i"));
    // Web-first, never count(): these cards render lazily.
    await expect(this.itemCards.first()).toBeVisible();
  }

  async assertListingHeadingShown(city: string): Promise<void> {
    await expect(
      this.page
        .getByRole("heading", { name: new RegExp(`^${this.serviceName} in ${city}$`, "i") })
        .first(),
    ).toBeVisible();
  }

  /**
   * "Whichever shows first" — first card in DOM order. Pins no title: these
   * listings are live inventory and rotate.
   */
  async openFirstItem(): Promise<void> {
    await expect(
      this.itemCards,
      `The ${this.serviceName} listing had no cards to open (url: ${this.page.url()}). ` +
        `This is live inventory, so an empty day is possible — check it in a browser ` +
        `before touching selectors.`,
    ).not.toHaveCount(0);

    const first = this.itemCards.first();
    await expect(first).toBeVisible();
    const href = (await first.getAttribute("href")) ?? "";
    this.lastOpenedSlug = new RegExp(`/${this.slug}/([^/]+)/`, "i").exec(href)?.[1] ?? "";
    await first.click();
    await this.page.waitForURL(this.detailsUrl, { timeout: 30_000 });
  }

  /**
   * Checks the URL shape and, when the slug was readable, that we landed on
   * that same item — which is what proves the FIRST card opened, rather than
   * merely that some details page loaded.
   */
  async assertItemDetailsShown(): Promise<void> {
    await expect(this.page).toHaveURL(this.detailsUrl);
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (!this.lastOpenedSlug) return;
    await expect(this.page).toHaveURL(new RegExp(`/${this.slug}/${this.lastOpenedSlug}/`, "i"));
  }

  /**
   * Opens the date-time page and STOPS. No date is picked and no seat or
   * ticket is chosen, so this holds nothing on the live site.
   */
  async openDateTimePage(): Promise<void> {
    await expect(this.bookNowLink.first()).toBeVisible();
    await this.bookNowLink.first().click();
    await this.page.waitForURL(this.dateTimeUrl, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async assertDateSelectionShown(): Promise<void> {
    await expect(this.page).toHaveURL(this.dateTimeUrl);
    await expect(this.page.getByRole("heading", { name: /^Select Date$/i }).first()).toBeVisible();
    await expect(this.dateOptions.first()).toBeVisible();
  }

  /**
   * The first card's clean title, from its image alt. Measured 2026-09-21: a
   * card's accessible name is one flat string ("<title> <venue>: Hyderabad
   * <language> ₹ 999 onwards <title>"), while `img.alt` and the card's <h3>
   * both hold the bare title. Used to drive search with a term guaranteed to
   * exist today.
   */
  async firstItemTitle(): Promise<string> {
    const card = this.itemCards.first();
    await expect(card).toBeVisible();
    const title = ((await card.locator("img").first().getAttribute("alt")) ?? "").trim();
    if (!title) {
      throw new Error(
        `Could not read a title from the first ${this.serviceName} card (url: ${this.page.url()}). ` +
          `The card's img alt is where the clean title lives.`,
      );
    }
    return title;
  }

  /**
   * Picks the first offered date and STOPS. Measured 2026-09-21 on a play: the
   * URL does not change, the date button carries no aria-pressed, and the one
   * observable outcome is "Proceed" flipping from disabled to enabled — so
   * that is what the follow-up assertion reads. Nothing is proceeded to.
   */
  async selectFirstDate(): Promise<void> {
    await expect(this.dateOptions.first()).toBeVisible();
    await expect(this.proceedButton.first()).toBeDisabled();
    await this.dateOptions.first().click();
  }

  async assertProceedAvailableButNotTaken(): Promise<void> {
    await expect(
      this.proceedButton.first(),
      `"Proceed" stayed disabled after choosing a date (url: ${this.page.url()}), so the ` +
        `selection did not register.`,
    ).toBeEnabled();
    await expect(this.page).toHaveURL(this.dateTimeUrl);
  }

  async openAllDates(): Promise<void> {
    await expect(
      this.seeAllDatesButton.first(),
      `No "See all dates" control on this date page (url: ${this.page.url()}). It only ` +
        `appears when the run spans more than one week, so a short run is a legitimate ` +
        `reason — check the page before touching selectors.`,
    ).toBeVisible();
    await this.seeAllDatesButton.first().click();
  }

  async assertCalendarShown(): Promise<void> {
    await expect(this.calendarDayButtons.first()).toBeVisible();
    // A real month grid, not the seven-day strip: at least 28 day cells.
    await expect
      .poll(async () => this.calendarDayButtons.count(), {
        message: `Expected a month calendar (28+ day buttons) after "See all dates" (url: ${this.page.url()}).`,
      })
      .toBeGreaterThanOrEqual(28);
    await expect(this.page).toHaveURL(this.dateTimeUrl);
  }
}
