import { CataloguePage } from "../../support/catalogue.page";

/**
 * POM for the PLAYS service.
 *
 * Grounded against the real page on 2026-09-21 (Hyderabad):
 *   - Nav item: link "Plays" -> /explore/plays-hyderabad?cat=PL
 *   - Listing: h1 "Plays in Hyderabad", 19 cards
 *   - Card href: https://in.bookmyshow.com/plays/<slug>/ET00508708
 *     (absolute, no city segment)
 *   - Details CTA: "Book Now" as a LINK
 *   - Book Now -> /plays/<slug>/ET<id>/date-time/<venue>, which renders
 *     h3 "Select Date", one button per date (accessible name "20261002",
 *     text "Fri 02 Oct"), a DISABLED "Seats" step and a DISABLED
 *     "Review & Proceed to Pay".
 *   - Filter rail: Plays Type (Theatre, Storytelling), Date, Language,
 *     Genres, More Filters, Price, Browse by Venues.
 *
 * Everything above is the shape CataloguePage implements; the only things
 * unique to Plays are the two fields below. Note the filter group is
 * "Language" here, SINGULAR, where Movies and Events both use "Languages" —
 * so the group name cannot be shared between services either.
 */
export class PlaysPage extends CataloguePage {
  protected readonly slug = "plays";
  protected readonly serviceName = "Plays";
}
