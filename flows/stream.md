Service Type: Stream

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Stream tab

## Scenario: Open the first title in a collection  [smoke]
1) Scroll down till find out <StremType>
2) Once find out section User can click on which ever shows fisrt comes
3) Title details page is displayed

Examples:
| StremType  |
|Spidey All The Way!|
|Best of Tom Cruise Movies|

## Scenario: Stream page loads more collections as the user scrolls  [browse]
1) Note how many collections are on the page
2) Scroll down the page
3) More collections have been loaded

## Scenario: Open the first new release from the top carousel  [browse]
1) New releases carousel is displayed
2) Click on whichever new release shows first
3) Title details page is displayed

## Scenario: A title can be rented or bought without purchasing  [booking]
1) Scroll down till find out Spidey All The Way!
2) Click on whichever title shows first
3) Rent and Buy options are offered
4) No purchase has been started

## Scenario: Search for the first title in a collection  [search]
1) Scroll down till find out Spidey All The Way!
2) Search for whichever title shows first
3) Search returns at least one result

## Scenario: The Stream library needs an account  [auth]
1) Open the Stream library
2) Stream library requires signing in

## Scenario: A signed in user can open their Stream library  [account]
1) User is already signed in
2) Open the Stream library
3) Stream library is displayed
