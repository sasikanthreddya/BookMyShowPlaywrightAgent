import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the STREAM service.
 * Source flow: flows/stream.md (Service Type: Stream).
 *
 * Navigation and city steps are NOT defined here — they are shared across
 * services and live in src/support/common.steps.ts. Redefining them would
 * fail bddgen with "Multiple definitions matched scenario step."
 */
const { When, Then } = createBdd(test);

When(
  "the user scrolls to the {string} collection",
  async ({ streamPage }, collection: string) => {
    await streamPage.scrollToCollection(collection);
  },
);

When(
  "the user opens the first title in the {string} collection",
  async ({ streamPage }, collection: string) => {
    await streamPage.openFirstTitleIn(collection);
  },
);

Then("the {string} collection is displayed", async ({ streamPage }, collection: string) => {
  await streamPage.assertCollectionShown(collection);
});

Then("the title details page is displayed", async ({ streamPage }) => {
  await streamPage.assertTitlePageShown();
});

When("the user notes how many collections are on the page", async ({ streamPage }) => {
  await streamPage.rememberCollectionCount();
});

When("the user scrolls down the page", async ({ streamPage }) => {
  await streamPage.scrollDownThePage();
});

Then("more collections have been loaded", async ({ streamPage }) => {
  await streamPage.assertMoreCollectionsLoaded();
});

Then("the new releases carousel is displayed", async ({ streamPage }) => {
  await streamPage.assertNewReleasesShown();
});

When("the user opens the first new release", async ({ streamPage }) => {
  await streamPage.openFirstNewRelease();
});

Then("rent and buy options are offered", async ({ streamPage }) => {
  await streamPage.assertRentAndBuyOffered();
});

Then("no purchase has been started", async ({ streamPage }) => {
  await streamPage.assertNoPurchaseStarted();
});

When(
  "the user searches for the first title in the {string} collection",
  async ({ streamPage }, collection: string) => {
    await streamPage.searchForTitle(await streamPage.firstTitleIn(collection));
  },
);

When("the user opens the Stream library", async ({ streamPage }) => {
  await streamPage.openStreamLibrary();
});

Then("the Stream library requires signing in", async ({ streamPage }) => {
  await streamPage.assertStreamLibraryRequiresSignIn();
});

Then("the Stream library is displayed", async ({ streamPage }) => {
  await streamPage.assertStreamLibraryShown();
});
