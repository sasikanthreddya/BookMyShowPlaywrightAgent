import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the SPORTS service.
 * Source flow: flows/Sports.md (Service Type: Sports).
 *
 * Navigation, city, filter, section, interested-count, "Book Now" link and
 * payment-guard steps are NOT defined here — they are shared across services
 * and live in src/support/common.steps.ts. Redefining them would fail bddgen
 * with "Multiple definitions matched scenario step."
 *
 * Two vocabularies coexist here on purpose:
 *   - The sport-type flow says "sports type" / "sports listing" so it cannot
 *     collide with Stream's "collection" steps.
 *   - The listing / details / ticket steps use the same wording as Events
 *     ("the user opens the first event in the listing") and are TAG-SCOPED to
 *     @sports, because Sports and Events share TicketedPage and read
 *     identically. Tag-scoping is the project's documented answer to a
 *     step-text collision.
 */
const { When, Then } = createBdd(test);

// ---- sport-type flow ------------------------------------------------------

When(
  "the user scrolls to the {string} sports type filter",
  async ({ sportsPage }, sportType: string) => {
    await sportsPage.scrollToSportType(sportType);
  },
);

When(
  "the user filters the sports listing by {string}",
  async ({ sportsPage }, sportType: string) => {
    await sportsPage.filterBySportType(sportType);
  },
);

When(
  "the user opens the first event in the {string} sports listing",
  async ({ sportsPage }, sportType: string) => {
    await sportsPage.openFirstEvent(sportType);
  },
);

Then(
  "the {string} sports type filter is available",
  async ({ sportsPage }, sportType: string) => {
    await sportsPage.assertSportTypeFilterAvailable(sportType);
  },
);

Then(
  "the sports listing is filtered by {string}",
  async ({ sportsPage }, sportType: string) => {
    await sportsPage.assertSportTypeFilterApplied(sportType);
  },
);

Then("the sports event details page is displayed", async ({ sportsPage }) => {
  await sportsPage.assertEventPageShown();
});

// ---- listing, details and ticket page (shared shape with Events) -----------

Then("the sports listing is displayed", async ({ sportsPage }) => {
  await sportsPage.assertListingShown();
});

Then("the sports listing is headed for {string}", async ({ sportsPage }, city: string) => {
  await sportsPage.assertListingHeadingShown(city);
});

When("the user opens the first event in the listing", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.openFirstItem(
    "Sports is the thinnest catalogue on the site — a day with no events in the city is possible.",
  );
});

Then("the event details page is displayed", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.assertItemDetailsShown();
});

When("the user starts booking the event", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.openTicketPage();
});

Then("the ticket page is displayed", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.assertTicketPageShown();
});

Then("the ticket types are listed", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.assertTicketTypesListed();
});

Then("booking the event does not require signing in", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.assertBookingNotLoginGated();
});

Then("booking the event requires signing in", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.assertBookingRequiresLogin();
});

When("the user searches for the first event in the listing", { tags: "@sports" }, async ({ sportsPage }) => {
  await sportsPage.searchForTitle(await sportsPage.firstItemTitle());
});
