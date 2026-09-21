import { createBdd } from "playwright-bdd";
import { test } from "./fixtures";

/**
 * Steps shared by EVERY service.
 *
 * All services import the same `test`, so playwright-bdd keeps ONE step
 * registry: defining "the user is on the BookMyShow home page" in both
 * movies.steps.ts and stream.steps.ts fails bddgen with "Multiple definitions
 * matched scenario step." These live here once instead, backed by BasePage,
 * and every service's feature reuses them.
 *
 * They take the `basePage` fixture rather than any one service's POM, so no
 * service depends on another's steps file.
 *
 * NOTE: this file sits outside src/services/**, so playwright.config.ts's
 * `steps` glob must be src/**\/*.steps.ts for it to load at all.
 */
const { Given, When, Then } = createBdd(test);

Given("the user is on the BookMyShow home page", async ({ basePage }) => {
  await basePage.open("/");
});

Given("the city is set to {string}", async ({ basePage }, city: string) => {
  await basePage.ensureCity(city);
});

When("the user opens the {string} tab", async ({ basePage }, service: string) => {
  await basePage.openServiceTab(service);
});

Then("the selected city remains {string}", async ({ basePage }, city: string) => {
  await basePage.assertCity(city);
});

/**
 * Filter steps are shared, not per-service: the left rail is the same
 * component on every listing (Movies exposes Languages/Genres/Format, Events
 * exposes Categories/Date/Languages/Price), so defining these per service
 * would fail bddgen with "Multiple definitions matched scenario step."
 */
When(
  "the user applies the {string} option from the {string} filter",
  async ({ basePage }, option: string, group: string) => {
    await basePage.applyFilterOption(group, option);
  },
);

/**
 * The expected URL fragment comes from the feature's Examples table rather
 * than being derived, because the per-group encodings are measured facts that
 * are not guessable from the label ("Free" -> priceGroup=0to0).
 */
Then("the listing URL carries {string}", async ({ basePage }, fragment: string) => {
  await basePage.assertUrlCarries(fragment);
});

/**
 * Used by filter scenarios instead of "the listing is displayed": a filter
 * that matches nothing is valid live-catalogue behaviour, so result cards must
 * not be part of the claim. See BasePage.assertListingPageShown().
 */
Then("the listing page is still shown", async ({ basePage }) => {
  await basePage.assertListingPageShown();
});

Then("the listing URL no longer carries {string}", async ({ basePage }, fragment: string) => {
  await basePage.assertUrlDoesNotCarry(fragment);
});

When("the user clears the applied filter", async ({ basePage }) => {
  await basePage.clearFirstFilter();
});

Then("no filter is applied to the listing", async ({ basePage }) => {
  await basePage.assertUrlHasNoFilters();
});

/**
 * Entry gate for @account scenarios. Those run in the "account" Playwright
 * project, which loads .auth/user.json as storageState; this fails loudly when
 * that session is missing or expired rather than letting the scenario run
 * logged-out and pass on a negative assertion.
 */
Given("the user is signed in", async ({ basePage }) => {
  await basePage.assertSignedIn();
});

/** Header search is cross-service: its results mix movies, artists and venues. */
When("the user opens the search panel", async ({ basePage }) => {
  await basePage.openSearch();
});

When("the user searches for {string}", async ({ basePage }, query: string) => {
  await basePage.searchFor(query);
});

Then("the search returns at least one result", async ({ basePage }) => {
  await basePage.assertSearchReturnedResults();
});

Then("BookMyShow asks the user to sign in", async ({ basePage }) => {
  await basePage.assertLoginRequested();
});

/**
 * Details-page content shared by every service: a section found by its
 * heading ("About The Event", "About the movie", "Cast", ...), the read-only
 * interested count, a "Book Now" LINK, and the "Read More" expander.
 */
Then("the {string} section is shown", async ({ basePage }, heading: string) => {
  await basePage.assertSectionShown(heading);
});

Then("the interested count is shown", async ({ basePage }) => {
  await basePage.assertInterestedCountShown();
});

Then("the {string} link is available", async ({ basePage }, name: string) => {
  await basePage.assertLinkAvailable(name);
});

When("the user expands the description", async ({ basePage }) => {
  await basePage.expandDescription();
});

Then("the full description is expanded", async ({ basePage }) => {
  await basePage.assertDescriptionExpanded();
});

/**
 * The suite's hard stop, shared by every ticket and date-time page: the pay
 * CTA is present and is never clicked. See README "Booking funnel boundary".
 */
Then("no payment has been started", async ({ basePage }) => {
  await basePage.assertPaymentNotStarted();
});

/**
 * Directory pages (cinemas, venues) share one shape and one search box; see
 * BasePage.directoryEntries. The name searched for is read from the page's
 * own first row, so the assertion needs no argument.
 */
When("the user opens Browse by Venues", async ({ basePage }) => {
  await basePage.openBrowseByVenues();
});

Then(
  "the venues directory for {string} in {string} is displayed",
  async ({ basePage }, service: string, city: string) => {
    await basePage.assertVenuesDirectoryShown(service, city);
  },
);

When("the user searches the directory for its first listed name", async ({ basePage }) => {
  await basePage.searchDirectoryForFirstEntry();
});

Then("the directory still lists that name", async ({ basePage }) => {
  await basePage.assertDirectoryListsSearchedEntry();
});

/**
 * Favouriting a directory entry. Shared because the cinemas and venues
 * directories render the same control, and it is the one account-gated action
 * on this site that is REVERSIBLE — so the signed-in scenario restores what
 * it changed and stays repeatable.
 */
When("the user favourites the first entry in the directory", async ({ basePage }) => {
  await basePage.favouriteFirstDirectoryEntry();
});

Then("favouriting requires signing in", async ({ basePage }) => {
  await basePage.assertSignInRequiredForFavourite();
});

Then("the entry is marked as a favourite", async ({ basePage }) => {
  await basePage.assertEntryFavourited();
});

When("the user removes it from favourites", async ({ basePage }) => {
  await basePage.unfavouriteFirstDirectoryEntry();
});

Then("the favourite is restored to how it was found", async ({ basePage }) => {
  await basePage.assertFavouriteRestored();
});

Then("the {string} sign-in option is offered", async ({ basePage }, option: string) => {
  await basePage.assertLoginOptionAvailable(option);
});
