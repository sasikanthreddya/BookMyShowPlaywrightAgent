import { TicketedPage } from "../../support/ticketed.page";

/**
 * POM for the EVENTS service — one POM per BookMyShow service.
 *
 * Grounded against the real page on 2026-09-21 (Hyderabad):
 *   - The Events nav item is a link named "Events", href
 *     "/explore/events-hyderabad?cat=CT". The category code is CT, not "EV" —
 *     worth stating because every other service's code matches its name
 *     (MT/PL/SP/AT) and CT is the one that does not.
 *   - The listing renders <h1> "Events in Hyderabad" and 29 event cards.
 *   - Filter rail: Categories (expanded by default), Date, Languages,
 *     More Filters, Price, Browse by Venues. Applying one rewrites the URL,
 *     which is the authoritative signal — see BasePage.assertUrlCarries for
 *     the measured encodings.
 *   - An event details page renders <h1> holding the event title, the text
 *     "<N> are interested", h2 "About The Event" with a "Read More" button,
 *     h2 "Artists", and a "Book Now" LINK.
 *   - "Book Now" goes straight to /events/<slug>/ET<id>/ticket/<VENUE>/<id>,
 *     which renders one "Add" / "Know more" pair per ticket type, a disabled
 *     "Login To Book" and a disabled "Review & Proceed to Pay".
 *
 * Everything above is the shape TicketedPage implements (Sports is identical);
 * the only things unique to Events are the two fields below.
 */
export class EventsPage extends TicketedPage {
  protected readonly slug = "events";
  protected readonly serviceName = "Events";
}
