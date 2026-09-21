import { createBdd } from "playwright-bdd";
import { test } from "../../support/fixtures";

/**
 * Step definitions for the MOVIES service.
 * Source flow: flows/movies.md (Service Type: Movie).
 * All browser detail lives in MoviesPage — steps stay declarative.
 *
 * Navigation and city steps are NOT defined here — they are shared across
 * services and live in src/support/common.steps.ts. Redefining them would
 * fail bddgen with "Multiple definitions matched scenario step."
 */
const { When, Then } = createBdd(test);

When("the user filters by the {string} language", async ({ moviesPage }, language: string) => {
  await moviesPage.selectLanguage(language);
});

When("the user opens the first movie in the listing", async ({ moviesPage }) => {
  await moviesPage.openFirstMovie();
});

When("the user starts booking tickets", async ({ moviesPage }) => {
  await moviesPage.startBooking();
});

When(
  "the user selects the {string} format for {string} if prompted",
  async ({ moviesPage }, format: string, language: string) => {
    await moviesPage.chooseFormatIfPrompted(language, format);
  },
);

Then("the movies listing is displayed", async ({ moviesPage }) => {
  await moviesPage.assertMoviesListingShown();
});

Then("the movies listing is headed for {string}", async ({ moviesPage }, city: string) => {
  await moviesPage.assertListingHeadingShown(city);
});

When("the user opens Browse by Cinemas", async ({ moviesPage }) => {
  await moviesPage.openBrowseByCinemas();
});

Then("the cinemas directory for {string} is displayed", async ({ moviesPage }, city: string) => {
  await moviesPage.assertCinemasDirectoryShown(city);
});

When("the user searches for the first movie in the listing", async ({ moviesPage }) => {
  await moviesPage.searchForTitle(await moviesPage.firstMovieTitle());
});

When("the user also filters by the {string} language", async ({ moviesPage }, language: string) => {
  await moviesPage.addLanguage(language);
});

When("the user picks the next date on the showtimes page", async ({ moviesPage }) => {
  await moviesPage.pickNextShowtimeDate();
});

Then("the showtimes page shows the next date", async ({ moviesPage }) => {
  await moviesPage.assertShowtimesOnNextDate();
});

When("the user opens the first cinema from the showtimes page", async ({ moviesPage }) => {
  await moviesPage.openFirstCinemaFromShowtimes();
});

Then("the cinema page is displayed with its dates", async ({ moviesPage }) => {
  await moviesPage.assertCinemaPageShown();
});

Then("the movie details content is displayed", async ({ moviesPage }) => {
  await moviesPage.assertDetailsContentShown();
});

Then("the showtimes list cinemas and times", async ({ moviesPage }) => {
  await moviesPage.assertShowtimesListed();
});

When("the user favourites the first cinema", async ({ moviesPage }) => {
  await moviesPage.favouriteFirstCinema();
});

Then("favouriting a cinema requires signing in", async ({ moviesPage }) => {
  await moviesPage.assertSignInRequiredForFavourite();
});

Then("the {string} language filter is applied", async ({ moviesPage }, language: string) => {
  await moviesPage.assertLanguageApplied(language);
});

Then("the movie details page is displayed", async ({ moviesPage }) => {
  await moviesPage.assertMovieDetailsShown();
});

Then("the {string} button is available", async ({ moviesPage }, name: string) => {
  await moviesPage.assertCtaAvailable(name);
});

Then("the language and format popup is no longer shown", async ({ moviesPage }) => {
  await moviesPage.assertFormatPopupDismissed();
});

Then("the showtimes page for {string} is reached", async ({ moviesPage }, language: string) => {
  await moviesPage.assertShowtimesReachedFor(language);
});

When(
  "the user selects the first available format for {string} if prompted",
  async ({ moviesPage }, language: string) => {
    await moviesPage.chooseFirstFormatIfPrompted(language);
  },
);

When("the user opens the Coming Soon listing", async ({ moviesPage }) => {
  await moviesPage.openComingSoon();
});

When("the user opens the first upcoming movie", async ({ moviesPage }) => {
  await moviesPage.openFirstUpcomingMovie();
});

When("the user marks the movie as interested", async ({ moviesPage }) => {
  await moviesPage.markInterested();
});

When("the user tries to mark the movie as interested", async ({ moviesPage }) => {
  await moviesPage.attemptMarkInterested();
});

Then("the Coming Soon listing is displayed", async ({ moviesPage }) => {
  await moviesPage.assertUpcomingListingShown();
});

Then("the movie offers to mark interest instead of booking", async ({ moviesPage }) => {
  await moviesPage.assertInterestPromptShown();
});

Then("marking interest requires signing in", async ({ moviesPage }) => {
  await moviesPage.assertSignInRequiredForInterest();
});

When("the user opens the first upcoming movie not yet marked interested", async ({ moviesPage }) => {
  await moviesPage.openFirstUpcomingMovieOfferingInterest();
});

When("the user marks the movie as interested if it is not already", async ({ moviesPage }) => {
  await moviesPage.markInterestedIfNotAlready();
});

Then("the movie is recorded as interested for the account", async ({ moviesPage }) => {
  await moviesPage.assertInterestRecorded();
});
