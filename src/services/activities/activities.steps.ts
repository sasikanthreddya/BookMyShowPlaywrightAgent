import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the ACTIVITIES service.
 * Source flow: flows/activities.md (Service Type: Activity).
 *
 * Tag-scoped for the same reason plays.steps.ts is: Plays and Activities
 * render identically, so the same step text serves both and only the tag
 * decides which POM runs.
 *
 * "See all dates" is the one thing Activities has that Plays does not
 * (measured 2026-09-21: a multi-week activity offers it, a three-date play
 * does not), so those two steps exist only here.
 */
const { When, Then } = createBdd(test);

When("the user opens the first item in the listing", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.openFirstItem();
});

When("the user starts booking the item", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.openDateTimePage();
});

Then("the listing is displayed", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.assertListingShown();
});

Then(
  "the listing is headed for {string}",
  { tags: "@activities" },
  async ({ activitiesPage }, city: string) => {
    await activitiesPage.assertListingHeadingShown(city);
  },
);

Then("the item details page is displayed", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.assertItemDetailsShown();
});

Then("the date selection page is displayed", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.assertDateSelectionShown();
});

When("the user selects the first available date", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.selectFirstDate();
});

Then("Proceed becomes available but is not taken", { tags: "@activities" }, async ({ activitiesPage }) => {
  await activitiesPage.assertProceedAvailableButNotTaken();
});

When("the user opens See all dates", async ({ activitiesPage }) => {
  await activitiesPage.openAllDates();
});

Then("the month calendar is displayed", async ({ activitiesPage }) => {
  await activitiesPage.assertCalendarShown();
});

When(
  "the user searches for the first item in the listing",
  { tags: "@activities" },
  async ({ activitiesPage }) => {
    await activitiesPage.searchForTitle(await activitiesPage.firstItemTitle());
  },
);
