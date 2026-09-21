import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Shared behaviour for the services whose "Book Now" goes STRAIGHT to a ticket
 * page, skipping date selection. Measured 2026-09-21, Events and Sports are
 * identical end to end:
 *
 *   listing   /explore/<slug>-hyderabad?cat=XX     h1 "<Service> in Hyderabad"
 *   cards     a[href*="/<slug>/"][href*="/ET"]     absolute, no city segment,
 *                                                  title in an <h3> and the img alt
 *   details   /<slug>/<title-slug>/ET<id>          h1 title, "<N> are interested",
 *                                                  h2 "About The Event", CTA "Book Now" as a LINK
 *   ticket    /<slug>/<title-slug>/ET<id>/ticket/<venue>/<id>
 *             one "Add" per ticket type, `button "Login To Book" [disabled]`
 *             for a logged-out visitor, `button "Review & Proceed to Pay" [disabled]`
 *
 * so EventsPage and SportsPage are the slug plus a name, and everything else
 * lives here once. (An earlier note in SportsPage recorded "Book Now" as a
 * BUTTON there; re-measured 2026-09-21 it is a link on Sports too.)
 *
 * CataloguePage is the sibling for Plays and Activities, whose "Book Now" goes
 * to a date-time page first; the two are kept apart because that is the one
 * thing that genuinely differs between the four services.
 */
export abstract class TicketedPage extends BasePage {
  /** URL segment: "events", "sports". */
  protected abstract readonly slug: string;
  /** Nav tab and heading wording: "Events", "Sports". */
  protected abstract readonly serviceName: string;

  /** Slug of the item opened from the listing, for the follow-up assertion. */
  protected lastOpenedSlug = "";

  protected get detailsUrl(): RegExp {
    return new RegExp(`/${this.slug}/[^/]+/ET\\d+`, "i");
  }

  protected get ticketUrl(): RegExp {
    return new RegExp(`/${this.slug}/[^/]+/ET\\d+/ticket/`, "i");
  }

  /**
   * Listing cards. Both attribute filters matter: "/<slug>/" alone also
   * matches the nav link (/explore/<slug>-hyderabad) and the footer's category
   * links, while pairing it with the "/ET" id pins this to real cards. Hrefs
   * are ABSOLUTE and carry no city segment, unlike Movies cards, so this must
   * not be scoped to the active city.
   */
  get itemCards(): Locator {
    return this.page.locator(`a[href*="/${this.slug}/"][href*="/ET"]`);
  }

  /** Details-page CTA. A LINK, not a button — measured, and it matters. */
  get bookNowLink(): Locator {
    return this.page.getByRole("link", { name: /^Book Now$/i }).filter({ visible: true });
  }

  /**
   * Shown to a logged-OUT visitor on the ticket page, measured 2026-09-21 as
   * `button "Login To Book" [disabled]`. Its presence is what proves the
   * booking funnel is account-gated without needing to hold any inventory.
   */
  get loginToBookButton(): Locator {
    return this.page.getByRole("button", { name: /^Login To Book$/i });
  }

  /** One per ticket type on the ticket page. Never clicked: adding holds inventory. */
  get addTicketButtons(): Locator {
    return this.page.getByRole("button", { name: /^Add$/i });
  }

  async assertListingShown(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/explore/${this.slug}`, "i"));
    // Web-first assertion, never count(): the cards render lazily.
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
   * "Whichever shows first" — the first card in DOM order. Pins no title: the
   * listing is live inventory and rotates daily.
   *
   * The explicit count check is not ceremony. A filter can legitimately leave
   * very few results, and without this an empty listing surfaces as a bare
   * visibility timeout on a card that was never there.
   */
  async openFirstItem(emptyListingHint = "This is live inventory, not necessarily a selector problem."): Promise<void> {
    await expect(
      this.itemCards,
      `The ${this.serviceName} listing had no cards to open (url: ${this.page.url()}). ` +
        `${emptyListingHint} Check the listing in a browser before touching locators.`,
    ).not.toHaveCount(0);

    const first = this.itemCards.first();
    await expect(first).toBeVisible();
    const href = (await first.getAttribute("href")) ?? "";
    this.lastOpenedSlug = new RegExp(`/${this.slug}/([^/]+)/`, "i").exec(href)?.[1] ?? "";
    await first.click();
    await this.page.waitForURL(this.detailsUrl, { timeout: 30_000 });
  }

  /**
   * The first card's clean title, from its image alt. Measured 2026-09-21: a
   * card's accessible name is one flat string ("<title> <venue>: Hyderabad
   * <category> ₹ 1500 onwards <title>"), while `img.alt` and the card's <h3>
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
   * Checks the URL shape and, when the card's slug was readable, that the page
   * we landed on is that same item — which is what proves the FIRST card was
   * opened rather than merely that some details page loaded.
   */
  async assertItemDetailsShown(): Promise<void> {
    await expect(this.page).toHaveURL(this.detailsUrl);
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (!this.lastOpenedSlug) return;
    await expect(this.page).toHaveURL(new RegExp(`/${this.slug}/${this.lastOpenedSlug}/`, "i"));
  }

  /**
   * Opens the ticket page and STOPS. Nothing is added and no ticket type is
   * chosen, so this holds no inventory on the live site.
   */
  async openTicketPage(): Promise<void> {
    await expect(this.bookNowLink.first()).toBeVisible();
    await this.bookNowLink.first().click();
    await this.page.waitForURL(this.ticketUrl, { timeout: 30_000 });
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  async assertTicketPageShown(): Promise<void> {
    await expect(this.page).toHaveURL(this.ticketUrl);
    await expect(this.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }

  /** At least one ticket type is on offer, proven by its "Add" control. */
  async assertTicketTypesListed(): Promise<void> {
    await expect(this.addTicketButtons.first()).toBeVisible();
  }

  async assertBookingRequiresLogin(): Promise<void> {
    await expect(
      this.loginToBookButton.first(),
      `Expected a logged-out visitor to be offered "Login To Book" on the ticket page ` +
        `(url: ${this.page.url()}). If this run carried a saved session it is already ` +
        `logged in, and this assertion belongs to the logged-out scenario only.`,
    ).toBeVisible();
  }

  /**
   * The signed-in counterpart, asserted against a MEASURED contrast rather
   * than an invented success state. On the same ticket page, 2026-09-21:
   *   logged out : "Login To Book" present (disabled), 4 "Add" controls
   *   signed in  : "Login To Book" ABSENT,             4 "Add" controls
   * so the disappearance of that button is what proves the account was
   * recognised, and the ticket types still being listed proves we did not
   * simply land on a broken page.
   */
  async assertBookingNotLoginGated(): Promise<void> {
    await expect(
      this.loginToBookButton,
      `The ticket page still offers "Login To Book" (url: ${this.page.url()}), so this ` +
        `run is not signed in. The saved session is probably expired — re-run ` +
        `"npm run auth:refresh".`,
    ).toHaveCount(0);
    await expect(this.addTicketButtons.first()).toBeVisible();
  }

  /**
   * "Know more" beside a ticket type. Measured 2026-09-21: clicking it swaps
   * the control to "Know less" and inserts a `list` of that type's inclusions
   * ("Rear block. 1,500 seats...") directly under it. Purely informational: no
   * ticket is added, the pay CTA stays disabled and the URL does not change.
   */
  get knowMoreButtons(): Locator {
    return this.page.getByRole("button", { name: /^Know more$/i }).filter({ visible: true });
  }

  async expandFirstTicketTypeDetails(): Promise<void> {
    await expect(
      this.knowMoreButtons.first(),
      `No "Know more" control on the ticket page (url: ${this.page.url()}). Not every ` +
        `ticket type carries a description, so check the page before touching selectors.`,
    ).toBeVisible();
    await this.knowMoreButtons.first().click();
  }

  async assertTicketTypeDetailsShown(): Promise<void> {
    await expect(this.page.getByRole("button", { name: /^Know less$/i }).first()).toBeVisible();
    await expect(this.page.getByRole("list").getByRole("listitem").first()).toBeVisible();
    await expect(this.page).toHaveURL(this.ticketUrl);
  }
}
