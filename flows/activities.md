Service Type: Activity

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Activities tab

## Scenario: Browse the activities listing  [smoke]
1) Activities listing is displayed for Hyderabad
2) Selected city remains Hyderabad

## Scenario: Filter the listing by a filter group  [filters]
1) Apply <option> from the <group> filter
2) Listing URL carries <param>
3) Listing page is still shown (a filter may legitimately match no activities)

Examples:
| group      | option    | param                 |
| Categories | Adventure | categories=adventure  |
| Date       | Today     | daygroups=today       |
| Price      | Free      | priceGroup=0to0       |

## Scenario: Combine a category filter with a date filter  [filters]
1) Apply Adventure from the Categories filter
2) Apply Today from the Date filter
3) Listing URL carries categories=adventure
4) Listing URL carries daygroups=today

## Scenario: Clear an applied filter  [filters]
1) Apply Adventure from the Categories filter
2) Clear the applied filter
3) No filter is applied to the listing

## Scenario: Open an activity and see its details
1) Click on whichever activity shows first
2) Activity details page is displayed
3) About the event section is shown
4) Book Now is offered

## Scenario: Reach the date selection page without booking  [booking]
1) Click on whichever activity shows first
2) Click on Book Now
3) Date selection page is displayed
4) No payment has been started

## Scenario: Select a date without proceeding  [booking]
1) Click on whichever activity shows first
2) Click on Book Now
3) Select the first available date
4) Proceed becomes available but is not clicked
5) No payment has been started

## Scenario: See all dates opens the calendar  [booking]
1) Click on whichever activity shows first
2) Click on Book Now
3) Click on See all dates
4) Calendar with the month's dates is displayed
5) No payment has been started

## Scenario: Browse the activities listing in another city  [city]
1) Select Mumbai as city
2) Click on Activities tab
3) Activities listing is displayed for Mumbai
4) Selected city remains Mumbai

## Scenario: Search for the first activity  [search]
1) Search for whichever activity shows first
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
