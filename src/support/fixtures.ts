import { test as base } from "playwright-bdd";
import { BasePage } from "./base.page";
import { ActivitiesPage } from "../services/activities/activities.page";
import { EventsPage } from "../services/events/events.page";
import { MoviesPage } from "../services/movies/movies.page";
import { PlaysPage } from "../services/plays/plays.page";
import { SportsPage } from "../services/sports/sports.page";
import { StreamPage } from "../services/stream/stream.page";

/**
 * The single custom `test` every service's *.steps.ts imports, so
 * playwright-bdd merges all services into ONE step registry.
 *
 * It MUST extend playwright-bdd's own `test`, not @playwright/test's —
 * createBdd() rejects the latter with
 * "createBdd() should use 'test' extended from playwright-bdd".
 *
 * One POM fixture per service, plus `basePage` for the cross-service steps in
 * support/common.steps.ts. All of them wrap the same `page`, so a scenario can
 * mix `basePage` navigation steps with a service POM's steps freely.
 *
 * Adding a service means adding its POM here and nothing else.
 */
export type ServicePoms = {
  basePage: BasePage;
  activitiesPage: ActivitiesPage;
  eventsPage: EventsPage;
  moviesPage: MoviesPage;
  playsPage: PlaysPage;
  sportsPage: SportsPage;
  streamPage: StreamPage;
};

export const test = base.extend<ServicePoms>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
  activitiesPage: async ({ page }, use) => {
    await use(new ActivitiesPage(page));
  },
  eventsPage: async ({ page }, use) => {
    await use(new EventsPage(page));
  },
  playsPage: async ({ page }, use) => {
    await use(new PlaysPage(page));
  },
  moviesPage: async ({ page }, use) => {
    await use(new MoviesPage(page));
  },
  sportsPage: async ({ page }, use) => {
    await use(new SportsPage(page));
  },
  streamPage: async ({ page }, use) => {
    await use(new StreamPage(page));
  },
});

export { expect } from "@playwright/test";
