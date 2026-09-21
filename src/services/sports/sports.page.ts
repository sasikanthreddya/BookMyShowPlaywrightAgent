import { type Locator, expect } from "@playwright/test";
import { TicketedPage } from "../../support/ticketed.page";

/**
 * POM for the SPORTS service — one POM per BookMyShow service.
 *
 * Grounded against the real page on 2026-09-18 and again on 2026-09-21
 * (Hyderabad):
 *   - The Sports nav item is a link named "Sports" (href
 *     "/explore/sports-hyderabad?cat=SP"). The footer holds a "Sports Events
 *     in Hyderabad" block whose links are named "Running", "Cricket", ... so
 *     serviceTab()'s exact "^Sports$" and its .first() both matter.
 *   - The Sports page is a FLAT listing, ~3300px: one <h1> "Sports in
 *     Hyderabad" and event cards as <h3>s. It is NOT built from curated
 *     carousels the way Stream is, which is why this POM shares no code with
 *     StreamPage despite the two flows reading almost identically.
 *   - There is therefore NO "Cricket" section or heading anywhere on the page.
 *     <SportType> is a "Sports Type" FILTER option, so the flow's "scroll down
 *     till find out <SportType>" resolves to that filter, and "whichever shows
 *     first" to the first card of the listing it produces. See
 *     scrollToSportType() for why that is the only available reading.
 *   - Filter rail: Sports Type (Running, Motorsports, Chess, Cricket — data
 *     driven), Date, More Filters, Price, Browse by Venues.
 *   - Event card hrefs are ABSOLUTE and carry no city segment:
 *     https://in.bookmyshow.com/sports/india-vs-west-indies-2nd-odi/ET00513273
 *   - An event page renders an <h1> holding exactly the card's title, "<N> are
 *     interested", h2 "About The Event" and a "Book Now" LINK (re-measured
 *     2026-09-21; an earlier note here called it a button). Book Now leads to
 *     /sports/<slug>/ET<id>/ticket/<venue>/<id>, the same ticket page shape as
 *     Events, so the shared TicketedPage owns all of that.
 */
export class SportsPage extends TicketedPage {
  protected readonly slug = "sports";
  protected readonly serviceName = "Sports";

  /** Most recent event opened via the sport-type flow, for the follow-up assertion. */
  private lastOpenedEvent = "";

  get sportsTab(): Locator {
    return this.serviceTab("Sports");
  }

  /**
   * A "Sports Type" filter option, e.g. "Cricket".
   *
   * `exact: true` matches the accessible name literally rather than as a
   * RegExp, so a sport type containing regex metacharacters cannot misbehave.
   *
   * `.filter({ visible: true })` is load-bearing, not defensive. Measured
   * 2026-09-18: the page renders THREE div[role="button"] nodes named
   * "Cricket" — a 0x0 invisible one (the collapsed filter panel, FIRST in DOM
   * order), the left-rail filter option, and a horizontal quick-chip row. Take
   * `.first()` without the visibility filter and you get the invisible one,
   * which is the same BookMyShow hidden-duplicate trap base.page.ts documents
   * on the city list.
   *
   * Roles, not classes: these are styled-components divs whose classes
   * ("sc-1y4pbdw-19 dkigzz") change between deploys, but they carry
   * role="button" and aria-pressed, so the accessibility tree is the stable
   * handle.
   */
  sportTypeFilter(sportType: string): Locator {
    return this.page
      .getByRole("button", { name: sportType, exact: true })
      .filter({ visible: true })
      .first();
  }

  /** Every event card in the listing, in DOM order. Kept as the Sports-flavoured name. */
  get eventCards(): Locator {
    return this.itemCards;
  }

  /**
   * Flow step "scroll down till find out <SportType>".
   *
   * On this page the Sports Type filter sits near the top (~y=230), so this
   * usually completes without scrolling at all — the loop exits before its
   * first scroll. It is still a loop because the filter list is data-driven
   * (today: Running, Chess, Motorsports, Cricket) and a longer list pushes
   * options down the panel. The loop IS the retry, so the one-shot count()
   * inside it is deliberate, matching StreamPage.scrollToCollection().
   *
   * page.evaluate(window.scrollBy) rather than mouse.wheel(): the wheel events
   * do not drive this site's lazy loaders at all — verified on Stream.
   */
  async scrollToSportType(sportType: string): Promise<void> {
    const option = this.sportTypeFilter(sportType);
    for (let i = 0; i < 20 && !(await option.count()); i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1200));
      await this.page.waitForTimeout(350);
    }

    await expect(
      option,
      `Scrolled the whole Sports page without finding a "${sportType}" option in the ` +
        `"Sports Type" filter. Note that <SportType> is a FILTER on this page, not a ` +
        `section heading: the Sports listing is flat and has no per-sport carousels. ` +
        `The filter list is driven by what is currently on sale in the city, so check ` +
        `that "${sportType}" still has events in Hyderabad (url: ${this.page.url()}).`,
    ).toHaveCount(1);

    await option.scrollIntoViewIfNeeded();
  }

  async assertSportTypeFilterAvailable(sportType: string): Promise<void> {
    await expect(this.sportTypeFilter(sportType)).toBeVisible();
  }

  /** Narrow the listing to one sport type. */
  async filterBySportType(sportType: string): Promise<void> {
    await this.sportTypeFilter(sportType).click();
    await this.page.waitForURL(/[?&]categories=/i, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /**
   * Two independent signals that the filter took, both read from the real page
   * on 2026-09-18: the URL gains "?categories=cricket", and every copy of the
   * option (including the invisible one) flips to aria-pressed="true".
   *
   * Only "Cricket" has been observed, so the slug below is inferred for any
   * other value. If a multi-word sport type ever encodes differently, this
   * assertion is what will say so, by name, instead of a later step failing
   * for no visible reason.
   */
  async assertSportTypeFilterApplied(sportType: string): Promise<void> {
    const slug = sportType.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await expect(this.page).toHaveURL(new RegExp(`[?&]categories=${slug}\\b`, "i"));
    await expect(this.sportTypeFilter(sportType)).toHaveAttribute("aria-pressed", "true");
  }

  /**
   * "Click on whichever shows first" after a sport-type filter — the first
   * card in DOM order. Pins no event title: the listing is live inventory.
   *
   * Filtering by one sport type can legitimately leave very few results —
   * "Cricket" returned exactly ONE event on 2026-09-18 — so an empty day is
   * plausible, and the error says so by name.
   */
  async openFirstEvent(sportType: string): Promise<void> {
    await expect(
      this.eventCards,
      `The "${sportType}" filter matched no events, so there was no first event to ` +
        `open (url: ${this.page.url()}). This is live inventory, not a selector ` +
        `problem: "Cricket" matched only a single event on 2026-09-18, so a day with ` +
        `none is expected. Re-check the listing in a browser before touching locators.`,
    ).not.toHaveCount(0);

    const first = this.eventCards.first();
    await expect(first).toBeVisible();
    this.lastOpenedEvent = ((await first.locator("h3").first().textContent()) ?? "").trim();
    await first.click();
    await this.page.waitForURL(this.detailsUrl, { timeout: 30_000 });
  }

  /**
   * End state of the sport-type flow. Checks the URL shape and, when the
   * card's title was readable, that the page we landed on is actually that
   * title — which is what proves the FIRST card was opened, rather than merely
   * that some event page loaded.
   */
  async assertEventPageShown(): Promise<void> {
    await expect(this.page).toHaveURL(this.detailsUrl);
    if (!this.lastOpenedEvent) return;
    await expect(
      this.page.getByRole("heading", { name: this.lastOpenedEvent, exact: true }).first(),
    ).toBeVisible();
  }
}
