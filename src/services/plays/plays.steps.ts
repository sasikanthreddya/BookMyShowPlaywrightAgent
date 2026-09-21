import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the PLAYS service.
 * Source flow: flows/plays.md (Service Type: Play).
 *
 * TAG-SCOPED on purpose. Plays and Activities render identically, so their
 * scenarios read identically too, and both services defining the same step
 * text would fail bddgen with "Multiple definitions matched scenario step."
 * Tag-scoping is the project's documented answer to that (README, "Step
 * definitions are one shared registry"), and it keeps the feature files
 * readable — the alternative is wording like "the user opens the first Plays
 * item", which says the service twice.
 *
 * Navigation, city, filter, section, "Book Now" link, payment-guard and
 * search-result steps are shared and live in src/support/common.steps.ts.
 */
const { When, Then } = createBdd(test);

When("the user opens the first item in the listing", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.openFirstItem();
});

When("the user starts booking the item", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.openDateTimePage();
});

Then("the listing is displayed", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.assertListingShown();
});

Then("the listing is headed for {string}", { tags: "@plays" }, async ({ playsPage }, city: string) => {
  await playsPage.assertListingHeadingShown(city);
});

Then("the item details page is displayed", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.assertItemDetailsShown();
});

Then("the date selection page is displayed", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.assertDateSelectionShown();
});

When("the user selects the first available date", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.selectFirstDate();
});

Then("Proceed becomes available but is not taken", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.assertProceedAvailableButNotTaken();
});

When("the user searches for the first item in the listing", { tags: "@plays" }, async ({ playsPage }) => {
  await playsPage.searchForTitle(await playsPage.firstItemTitle());
});
