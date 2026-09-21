import { type Locator, expect } from "@playwright/test";
import { BasePage } from "../../support/base.page";

/** A Stream title page: /movies/<slug>/ET<id>, optionally city-prefixed. */
const TITLE_PAGE_URL = /\/movies\/.+\/ET\d+/i;

/**
 * POM for the STREAM service — one POM per BookMyShow service.
 * Owns only Stream concerns: the curated collection carousels
 * ("Best of Tom Cruise Movies", "Korean Cinema", "Movies On Discount", ...)
 * and the title pages they link to.
 *
 * Grounded against the real page on 2026-09-17:
 *   - The Stream nav item is a link named "Stream" (href
 *     "/explore/c/stream?cat=Online Streaming Events"); a second link with
 *     the same name sits in the footer, so serviceTab()'s .first() matters.
 *   - The page is ~8000px tall and builds itself as you scroll: collections
 *     below the fold do not exist in the DOM until then. "Best of Tom Cruise
 *     Movies" appeared after 5 scroll steps of 1200px.
 *   - Each collection is an <h2> followed by a carousel of card links. The
 *     Tom Cruise collection holds 13 cards, the first being "Top Gun:
 *     Maverick".
 *   - Card hrefs are NOT city-prefixed the way the Movies listing's are:
 *     /movies/top-gun-maverick/ET00076943, not /movies/hyderabad/... . The
 *     city segment does appear once a city cookie is set, so neither shape
 *     can be relied on — hence the city-agnostic URL pattern above.
 */
export class StreamPage extends BasePage {
  /** Most recent title opened from a collection, for the follow-up assertion. */
  private lastOpenedTitle = "";

  get streamTab(): Locator {
    return this.serviceTab("Stream");
  }

  /**
   * A collection's <h2>. `exact: true` matches the name literally, which
   * matters because collection names contain regex metacharacters
   * ("Resident Evil (2002)", "Mission: Impossible") that would break or
   * misbehave if interpolated into a RegExp.
   */
  collectionHeading(collection: string): Locator {
    return this.page.getByRole("heading", { name: collection, exact: true });
  }

  /**
   * The carousel belonging to a collection: the INNERMOST div that contains
   * both the collection's heading and at least one card link.
   *
   * There is no id, role or stable class to anchor on, and walking a fixed
   * number of parents would break on any markup change. Filtering on what the
   * container must CONTAIN, then taking the innermost match, is stable:
   * verified to resolve to the 13-card Tom Cruise carousel and not to the
   * whole page.
   */
  collectionSection(collection: string): Locator {
    return this.page
      .locator("div")
      .filter({ has: this.collectionHeading(collection) })
      .filter({ has: this.page.locator('a[href*="/movies/"]') })
      .last();
  }

  collectionCards(collection: string): Locator {
    return this.collectionSection(collection).locator('a[href*="/movies/"]');
  }

  /**
   * Flow step 4: "scroll down till find out <collection>".
   *
   * The section is not in the DOM until scrolled to, so this cannot be a
   * scrollIntoViewIfNeeded() on a locator that does not exist yet, and it
   * cannot be a plain wait either — nothing arrives without scrolling. The
   * loop IS the retry, so the one-shot count() inside it is deliberate.
   *
   * page.evaluate(window.scrollBy) rather than mouse.wheel(): the wheel
   * events did not drive this page's lazy loader at all (verified — the
   * heading never appeared), while scrollBy finds it in ~5 steps.
   *
   * The page appends collections as you reach the bottom, so progress has two
   * different shapes and the loop has to tell them apart:
   *   - not at the bottom yet -> scrolling is the progress;
   *   - at the bottom         -> only the loader can make progress, and it
   *                              shows as document.scrollHeight GROWING.
   * A fixed step count conflates them. The previous 40 blind steps of 1200px
   * spent most of their iterations scrolling a page that had no room left
   * (scrollBy is a no-op there) and gave up while the loader was still
   * appending; measured 2026-09-18 it burned 111s and missed a collection that
   * this loop reaches in 16 steps / 21s.
   */
  async scrollToCollection(collection: string): Promise<void> {
    const heading = this.collectionHeading(collection);
    const deadline = Date.now() + 90_000;
    let lastHeight = 0;
    let stagnantAtBottom = 0;

    while (Date.now() < deadline && !(await heading.count())) {
      const { height, atBottom } = await this.page.evaluate(() => {
        window.scrollBy(0, 1200);
        return {
          height: document.body.scrollHeight,
          atBottom: window.innerHeight + window.scrollY >= document.body.scrollHeight - 250,
        };
      });

      if (!atBottom) {
        stagnantAtBottom = 0;
        lastHeight = height;
        await this.page.waitForTimeout(350);
        continue;
      }

      stagnantAtBottom = height === lastHeight ? stagnantAtBottom + 1 : 0;
      lastHeight = height;
      await this.page.waitForTimeout(900);
      // Ten rounds at the bottom with no growth: the page has nothing more to
      // give, so further scrolling cannot help and the collection is absent.
      if (stagnantAtBottom >= 10) break;
    }

    if (!(await heading.count())) throw new Error(await this.collectionMissing(collection));

    await heading.scrollIntoViewIfNeeded();
    // The cards hydrate a beat after the heading appears.
    await expect(this.collectionCards(collection).first()).toBeVisible();
  }

  /**
   * Why a collection was not found, with the evidence needed to tell the two
   * causes apart — they look identical from the test's side, and only one of
   * them is about this page at all.
   *
   * Measured 2026-09-18, same URL, minutes apart: with NO city applied the
   * Stream page stops at 5 collections / 4735px and no amount of scrolling
   * adds more (82s of it tried), while with Hyderabad applied it reaches 14
   * collections / 9023px. So a "missing" collection is very often a city
   * problem wearing a Stream costume, and printing what DID load says which.
   */
  private async collectionMissing(collection: string): Promise<string> {
    const loaded = (await this.page.locator("h2").allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);

    return [
      `Scrolled the Stream page to the end without finding a "${collection}" collection.`,
      `Loaded ${loaded.length} collection(s): ${loaded.join(" | ") || "(none)"}`,
      `Either the carousel was retired — they are curated and rotate — or the city`,
      `never applied: the short 5-collection page above is what an unset city looks`,
      `like, and no scrolling fixes that, so check the city step before this one.`,
      `(url: ${this.page.url()})`,
    ].join("\n");
  }

  async assertCollectionShown(collection: string): Promise<void> {
    await expect(this.collectionHeading(collection)).toBeVisible();
    await expect(this.collectionCards(collection).first()).toBeVisible();
  }

  /**
   * The first card's clean title in a collection, from its image alt.
   * Measured 2026-09-21: a Stream card's text is the title PLUS runtime,
   * genres, certificate, language and a synopsis all run together, while
   * `img.alt` holds the bare title. Used to drive search with a term that
   * exists today.
   */
  async firstTitleIn(collection: string): Promise<string> {
    const card = this.collectionCards(collection).first();
    await expect(card).toBeVisible();
    const title = ((await card.locator("img").first().getAttribute("alt")) ?? "").trim();
    if (!title) {
      throw new Error(
        `Could not read a title from the first card of "${collection}" (url: ${this.page.url()}).`,
      );
    }
    return title;
  }

  /** Collections currently on the page: one <h2> each. */
  get collectionHeadings(): Locator {
    return this.page.getByRole("heading", { level: 2 });
  }

  private collectionsBeforeScroll = -1;

  /**
   * Snapshot of how many collections exist BEFORE scrolling, so the scenario
   * can prove the lazy loader added more. Measured 2026-09-21: the page opens
   * with 5 <h2>s and has 18 after six 1200px steps.
   */
  async rememberCollectionCount(): Promise<void> {
    await expect(this.collectionHeadings.first()).toBeVisible();
    this.collectionsBeforeScroll = await this.collectionHeadings.count();
  }

  /**
   * A bounded run of scroll steps — enough to cross the fold several times,
   * not enough to reach the bottom of the ~9000px page. window.scrollBy, not
   * mouse.wheel: see scrollToCollection().
   */
  async scrollDownThePage(steps = 6): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1200));
      await this.page.waitForTimeout(600);
    }
  }

  async assertMoreCollectionsLoaded(): Promise<void> {
    if (this.collectionsBeforeScroll < 0) throw new Error("rememberCollectionCount() was not called first.");
    const before = this.collectionsBeforeScroll;
    await expect
      .poll(async () => this.collectionHeadings.count(), {
        message:
          `The Stream page still shows ${before} collection(s) after scrolling — the lazy ` +
          `loader appended nothing. An unset city produces a short 5-collection page that ` +
          `never grows, so check the city step first (url: ${this.page.url()}).`,
      })
      .toBeGreaterThan(before);
  }

  /**
   * The hero carousel at the top of the Stream page. Measured 2026-09-21: ten
   * slides, each a link to a title page whose text begins "Brand new releases
   * every Friday", with "Go to slide N" buttons underneath. That caption is
   * the only thing that identifies the carousel — no heading, no id — so the
   * cards are the movie links that carry it.
   */
  get newReleaseCards(): Locator {
    return this.page.locator('a[href*="/movies/"]').filter({ hasText: /Brand new releases every Friday/i });
  }

  async assertNewReleasesShown(): Promise<void> {
    await expect(
      this.newReleaseCards.first(),
      `No "Brand new releases every Friday" carousel at the top of the Stream page ` +
        `(url: ${this.page.url()}). The caption is curated and may have been reworded.`,
    ).toBeVisible();
  }

  /**
   * First slide in DOM order, which is the one on screen when the page opens.
   * Pins no title: the carousel refreshes weekly. Records the title so
   * assertTitlePageShown() can prove THAT title opened.
   */
  async openFirstNewRelease(): Promise<void> {
    const first = this.newReleaseCards.first();
    await expect(first).toBeVisible();
    this.lastOpenedTitle = ((await first.locator("img").first().getAttribute("alt")) ?? "").trim();
    await first.click();
    await this.page.waitForURL(TITLE_PAGE_URL, { timeout: 30_000 });
  }

  /**
   * A Stream title page's purchase options, measured 2026-09-21 on "Evil Dead
   * Burn": `button "Rent ₹249"` and `button "Buy ₹699"`. Prices change, so the
   * match is on the verb. Neither is EVER clicked — both open the payment
   * flow, which is the suite's hard stop.
   */
  get rentButton(): Locator {
    return this.page.getByRole("button", { name: /^Rent\b/i });
  }

  get buyButton(): Locator {
    return this.page.getByRole("button", { name: /^Buy\b/i });
  }

  async assertRentAndBuyOffered(): Promise<void> {
    await expect(
      this.rentButton.first(),
      `No "Rent" option on this title page (url: ${this.page.url()}). Some titles are ` +
        `buy-only or included in a subscription, so check the page before touching selectors.`,
    ).toBeVisible();
    await expect(this.buyButton.first()).toBeVisible();
  }

  /** Still on the title page, nothing purchased. */
  async assertNoPurchaseStarted(): Promise<void> {
    await expect(this.page).toHaveURL(TITLE_PAGE_URL);
    await expect(this.page).not.toHaveURL(/payment|checkout|order/i);
    await expect(this.loginSheetHeading).toBeHidden();
  }

  /**
   * Flow step 5: "click on which ever shows first comes" — the first card in
   * the collection, in DOM order. Pins no title: these carousels are curated
   * and change, so asserting a specific movie would fail on any other day.
   */
  async openFirstTitleIn(collection: string): Promise<void> {
    const first = this.collectionCards(collection).first();
    await expect(first).toBeVisible();
    this.lastOpenedTitle = ((await first.textContent()) ?? "").trim();
    await first.click();
    await this.page.waitForURL(TITLE_PAGE_URL, { timeout: 30_000 });
  }

  /**
   * End state of flow step 5. Checks the URL shape and, when the card's title
   * was readable, that the page we landed on is actually that title — which is
   * what proves the FIRST card was the one opened, rather than merely that
   * some title page loaded.
   */
  async assertTitlePageShown(): Promise<void> {
    await expect(this.page).toHaveURL(TITLE_PAGE_URL);
    if (!this.lastOpenedTitle) return;
    await expect(
      this.page.getByRole("heading", { name: this.lastOpenedTitle, exact: true }).first(),
    ).toBeVisible();
  }

  /**
   * The account's Stream library — the one account-gated surface Stream has.
   *
   * "Rent" is NOT the gate: measured 2026-09-21, clicking "Rent ₹249" while
   * logged out changes nothing at all — no redirect, no sign-in sheet — so
   * there is no assertion to make there. And the signed-in side of Rent is
   * out of scope regardless, because it leads to payment.
   *
   * The library is a clean gate in both directions:
   *   logged out : /my-profile/stream-library -> /login/?referer=%2Fmy-profile%2Fstream-library
   *   signed in  : it stays put
   * Navigated by URL rather than through the profile menu, because the URL IS
   * the measured signal; the menu is just one way of reaching it. The page
   * renders no h1, so the URL is the whole assertion.
   */
  async openStreamLibrary(): Promise<void> {
    await this.page.goto("/my-profile/stream-library", { waitUntil: "domcontentloaded" });
    await this.settleThroughBotCheck();
    await this.page.waitForTimeout(3000);
  }

  async assertStreamLibraryRequiresSignIn(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login\/?\?referer=.*stream-library/i);
  }

  async assertStreamLibraryShown(): Promise<void> {
    await expect(
      this.page,
      `The Stream library redirected away (url: ${this.page.url()}). If it went to ` +
        `/login/ the saved session is expired — re-run "npm run auth:refresh".`,
    ).toHaveURL(/\/my-profile\/stream-library/i);
  }
}
