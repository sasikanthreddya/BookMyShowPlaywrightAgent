import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the EVENTS service.
 * Source flow: flows/events.md (Service Type: Event).
 * All browser detail lives in EventsPage (via TicketedPage) — steps stay
 * declarative.
 *
 * Navigation, city, FILTER, section, interested-count, "Book Now" link,
 * Read More, payment-guard, venues and directory steps are NOT defined here:
 * they are shared across services and live in src/support/common.steps.ts.
 *
 * TAG-SCOPED to @events where the wording says "event": Sports events read the
 * same way and use the same TicketedPage methods, and both services defining
 * the same text unscoped would fail bddgen with "Multiple definitions matched
 * scenario step." Tag-scoping is the project's documented answer to that.
 */
const { When, Then } = createBdd(test);

When("the user opens the first event in the listing", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.openFirstItem();
});

When("the user starts booking the event", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.openTicketPage();
});

Then("the events listing is displayed", async ({ eventsPage }) => {
  await eventsPage.assertListingShown();
});

Then("the events listing is headed for {string}", async ({ eventsPage }, city: string) => {
  await eventsPage.assertListingHeadingShown(city);
});

Then("the event details page is displayed", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertItemDetailsShown();
});

Then("the ticket page is displayed", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertTicketPageShown();
});

Then("the ticket types are listed", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertTicketTypesListed();
});

Then("booking the event requires signing in", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertBookingRequiresLogin();
});

Then("booking the event does not require signing in", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertBookingNotLoginGated();
});

When("the user expands the first ticket type's details", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.expandFirstTicketTypeDetails();
});

Then("the ticket type details are shown", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.assertTicketTypeDetailsShown();
});

When("the user searches for the first event in the listing", { tags: "@events" }, async ({ eventsPage }) => {
  await eventsPage.searchForTitle(await eventsPage.firstItemTitle());
});
