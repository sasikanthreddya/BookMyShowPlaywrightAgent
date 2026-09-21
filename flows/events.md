Service Type: Event

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Events tab

## Scenario: Browse the events listing  [smoke]
1) Events listing is displayed for Hyderabad
2) Selected city remains Hyderabad

## Scenario: Filter the listing by a filter group  [filters]
1) Apply <option> from the <group> filter
2) Listing URL carries <param>
3) Listing page is still shown (a filter may legitimately match no events)

Examples:
| group      | option       | param                   |
| Categories | Comedy Shows | categories=comedy-shows |
| Date       | Today        | daygroups=today         |
| Languages  | English      | languages=english       |
| Price      | Free         | priceGroup=0to0         |

## Scenario: Clear an applied filter  [filters]
1) Apply Comedy Shows from the Categories filter
2) Clear the applied filter
3) No filter is applied to the listing

## Scenario: Combine a category filter with a date filter  [filters]
1) Apply Comedy Shows from the Categories filter
2) Apply Today from the Date filter
3) Listing URL carries categories=comedy-shows
4) Listing URL carries daygroups=today

## Scenario: Open an event and see its details
1) Click on whichever event shows first
2) Event details page is displayed
3) Interested count is shown
4) Book Now is available

## Scenario: Read the full description of an event  [details]
1) Click on whichever event shows first
2) About the event section is shown
3) Click on Read More
4) Full description is expanded

## Scenario: Reach the ticket page without booking  [booking]
1) Click on whichever event shows first
2) Click on Book Now
3) Ticket page is displayed with its ticket types
4) Booking requires signing in
5) No payment has been started

## Scenario: Read the details of a ticket type without booking  [booking]
1) Click on whichever event shows first
2) Click on Book Now
3) Click on Know more for the first ticket type
4) Ticket type details are shown
5) No payment has been started

## Scenario: Browse events by venue  [venues]
1) Open Browse by Venues
2) Venues directory for Events in Hyderabad is displayed
3) Search the venues by the first venue's name
4) That venue is still listed

## Scenario: Browse the events listing in another city  [city]
1) Select Mumbai as city
2) Click on Events tab
3) Events listing is displayed for Mumbai
4) Selected city remains Mumbai

## Scenario: Search for the first event  [search]
1) Search for whichever event shows first
2) Search returns at least one result

## Scenario: A signed in user reaches the ticket page without a login gate  [account]
1) User is already signed in
2) Click on whichever event shows first
3) Click on Book Now
4) Ticket page is displayed
5) Booking does not require signing in
6) No payment has been started
