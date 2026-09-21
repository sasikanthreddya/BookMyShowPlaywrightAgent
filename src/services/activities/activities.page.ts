import { CataloguePage } from "../../support/catalogue.page";

/**
 * POM for the ACTIVITIES service.
 *
 * Grounded against the real page on 2026-09-21 (Hyderabad):
 *   - Nav item: link "Activities" -> /explore/activities-hyderabad?cat=AT
 *   - Listing: h1 "Activities in Hyderabad", 28 cards
 *   - Card href: https://in.bookmyshow.com/activities/<slug>/ET00516400
 *     (absolute, no city segment)
 *   - Details CTA: "Book Now" as a LINK
 *   - Book Now -> /activities/<slug>/ET<id>/date-time/<venue>, which renders
 *     h3 "Select Date", one button per date, a "See all dates" control, a
 *     DISABLED "Ticket" step and a DISABLED "Review & Proceed to Pay".
 *     (Plays shows a "Seats" step where this shows "Ticket" — the only
 *     difference between the two services' booking pages.)
 *   - Filter rail: Categories (Tourist Attractions, Amusement Parks,
 *     Navratri Celebration, Adventure, Gaming, Unique Tours, Antiques
 *     Heritage Museums, Food and Drinks, Monuments, Festivals, Nightlife,
 *     Quizzes and Competitions), Date, More Filters, Price, Browse by Venues.
 */
export class ActivitiesPage extends CataloguePage {
  protected readonly slug = "activities";
  protected readonly serviceName = "Activities";
}
