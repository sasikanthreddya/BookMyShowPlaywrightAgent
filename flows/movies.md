Service Type: Movie

## Background
1) Navigate to BookMyShow
2) Select Hyderabad as city if not selected
3) Click on Movies tab

## Scenario: Filter the listing by language  [smoke]
1) Select Telugu language
2) Movies listing is displayed with the Telugu filter applied
3) Selected city remains Hyderabad

## Scenario: Book the first movie in a language  [booking]
1) Select <language> language
2) Click on which ever shows first comes
3) Click on Book tickets
4) If popup comes, select the first available format for <language>
5) Showtimes page for <language> is reached

Examples:
| language  |
| Telugu    |
| Tamil     |
| Malayalam |

## Scenario: Filter the listing by a filter group  [filters]
1) Apply <option> from the <group> filter
2) Listing URL carries <param>
3) Listing page is still shown (a filter may legitimately match no movies)

Examples:
| group  | option | param         |
| Genres | Action | genres=action |
| Format | 2D     | format=2D     |

## Scenario: Marking a coming soon movie as interested needs an account  [auth]
1) Open the Coming Soon listing
2) Click on which ever upcoming movie shows first
3) Movie offers to mark interest instead of booking
4) Try to click on I'm interested
5) BookMyShow asks the user to sign in
6) Continue with Google is offered

## Scenario: Browse the movies listing in a city  [city]
1) Movies listing is displayed
2) Listing is headed for <city>
3) Selected city remains <city>

Examples:
| city      |
| Hyderabad |
| Mumbai    |

## Scenario: Combine a language filter with a genre filter  [filters]
1) Select Telugu language
2) Apply Drama from the Genres filter
3) Listing URL carries languages=telugu
4) Listing URL carries genres=drama

## Scenario: Select two languages at once  [filters]
1) Select Telugu language
2) Select Hindi language as well
3) Listing URL carries languages=telugu|hindi

## Scenario: Clearing one filter group leaves the other applied  [filters]
1) Select Telugu language
2) Apply Drama from the Genres filter
3) Clear the applied filter
4) Listing URL no longer carries languages=telugu
5) Listing URL still carries genres=drama

## Scenario: Browse cinemas in the city  [cinemas]
1) Open Browse by Cinemas
2) Cinemas directory for Hyderabad is displayed

## Scenario: Search the cinemas directory by name  [cinemas]
1) Open Browse by Cinemas
2) Search the directory by the first cinema's name
3) That cinema is still listed

## Scenario: Search for a movie that is currently showing  [search]
1) Search for whichever movie shows first
2) Search returns at least one result

## Scenario: Read the details page of the first movie  [details]
1) Click on which ever shows first comes
2) Movie details page is displayed
3) About, Cast and Crew sections are shown

## Scenario: Read the showtimes page without selecting a showtime  [booking]
1) Select Telugu language
2) Click on which ever shows first comes
3) Click on Book tickets
4) If popup comes, select the first available format for Telugu
5) Showtimes page for Telugu is reached
6) Showtimes list cinemas and times

## Scenario: Change the date on the showtimes page  [booking]
1) Select Telugu language
2) Click on which ever shows first comes
3) Click on Book tickets
4) If popup comes, select the first available format for Telugu
5) Showtimes page for Telugu is reached
6) Pick the next date
7) Showtimes page shows the next date
8) Showtimes list cinemas and times

## Scenario: Open a cinema from the showtimes page  [cinemas]
1) Select Telugu language
2) Click on which ever shows first comes
3) Click on Book tickets
4) If popup comes, select the first available format for Telugu
5) Showtimes page for Telugu is reached
6) Click on whichever cinema shows first
7) Cinema page is displayed with its dates

## Scenario: Favouriting a cinema requires an account  [auth]
1) Open Browse by Cinemas
2) Click on Add to favourites for the first cinema
3) BookMyShow asks the user to sign in

## Scenario: A signed in user can mark a coming soon movie as interested  [account]
1) User is already signed in
2) Open the Coming Soon listing
3) Open the first upcoming movie not yet marked interested
4) Click on I'm interested
5) Movie is recorded as interested for the account
