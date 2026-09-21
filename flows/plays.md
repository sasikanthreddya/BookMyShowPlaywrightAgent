Service Type: Play

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Plays tab

## Scenario: Browse the plays listing  [smoke]
1) Plays listing is displayed for Hyderabad
2) Selected city remains Hyderabad

## Scenario: Filter the listing by a filter group  [filters]
1) Apply <option> from the <group> filter
2) Listing URL carries <param>
3) Listing page is still shown (a filter may legitimately match no plays)

Examples:
| group      | option  | param                      |
| Plays Type | Theatre | categories=theatre-plays   |
| Date       | Today   | daygroups=today            |
| Price      | Free    | priceGroup=0to0            |

## Scenario: Combine a plays type filter with a date filter  [filters]
1) Apply Theatre from the Plays Type filter
2) Apply Today from the Date filter
3) Listing URL carries categories=theatre-plays
4) Listing URL carries daygroups=today

## Scenario: Clear an applied filter  [filters]
1) Apply Theatre from the Plays Type filter
2) Clear the applied filter
3) No filter is applied to the listing

## Scenario: Open a play and see its details
1) Click on whichever play shows first
2) Play details page is displayed
3) About the event section is shown
4) Book Now is offered

## Scenario: Reach the date selection page without booking  [booking]
1) Click on whichever play shows first
2) Click on Book Now
3) Date selection page is displayed
4) No payment has been started

## Scenario: Select a date without proceeding  [booking]
1) Click on whichever play shows first
2) Click on Book Now
3) Select the first available date
4) Proceed becomes available but is not clicked
5) No payment has been started

## Scenario: Browse the plays listing in another city  [city]
1) Select Mumbai as city
2) Click on Plays tab
3) Plays listing is displayed for Mumbai
4) Selected city remains Mumbai

## Scenario: Search for the first play  [search]
1) Search for whichever play shows first
2) Search returns at least one result

## Scenario: Favouriting a venue needs an account  [auth]
1) Open Browse by Venues
2) Click Add to favourites on the first venue
3) Favouriting requires signing in

## Scenario: A signed in user can favourite a venue and undo it  [account]
1) User is already signed in
2) Open Browse by Venues
3) Click Add to favourites on the first venue
4) Entry is marked as a favourite
5) Remove it from favourites
6) Favourite is restored to how it was found
