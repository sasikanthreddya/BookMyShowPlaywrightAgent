Service Type: Sports

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Sports tab

## Scenario: Browse the sports listing  [smoke]
1) Sports listing is displayed for Hyderabad
2) Selected city remains Hyderabad

## Scenario: Open the first event of a sport type  [sporttype]
1) Scroll down till find out <SportType>
2) Once find out section User can click on which ever shows fisrt comes
3) Sports event details page is displayed

Examples:
|SportType  |
|Cricket|

## Scenario: Filter the listing by a filter group  [filters]
1) Apply <option> from the <group> filter
2) Listing URL carries <param>
3) Listing page is still shown (a filter may legitimately match no events)

Examples:
| group       | option  | param              |
| Sports Type | Running | categories=running |
| Date        | Today   | daygroups=today    |
| Price       | Free    | priceGroup=0to0    |

## Scenario: Clear an applied filter  [filters]
1) Apply Running from the Sports Type filter
2) Clear the applied filter
3) No filter is applied to the listing

## Scenario: Open an event and see its details
1) Click on whichever event shows first
2) Sports event details page is displayed
3) About the event section is shown
4) Interested count is shown
5) Book Now is offered

## Scenario: Reach the ticket page without booking  [booking]
1) Click on whichever event shows first
2) Click on Book Now
3) Ticket page is displayed with its ticket types
4) Booking requires signing in
5) No payment has been started

## Scenario: Browse the sports listing in another city  [city]
1) Select Mumbai as city
2) Click on Sports tab
3) Sports listing is displayed for Mumbai
4) Selected city remains Mumbai

## Scenario: Search for the first sports event  [search]
1) Search for whichever event shows first
2) Search returns at least one result

## Scenario: A signed in user reaches the ticket page without a login gate  [account]
1) User is already signed in
2) Click on whichever event shows first
3) Click on Book Now
4) Ticket page is displayed
5) Booking does not require signing in
6) No payment has been started
