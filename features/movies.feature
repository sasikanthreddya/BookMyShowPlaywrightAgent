# flow-sha: f8bfe6635cb7872fa87129a229fe5489e048e97d96a016643eae378371b758f1  (flows\movies.md — regenerate with /update-feature movies)
@movies
Feature: Movies service - browse, filter and book movies by language

  Source flow: flows/movies.md (Service Type: Movie)

  Hyderabad is the default city, set in the Background; the @city scenario
  switches to a second one to prove nothing is hard-coded to it.

  Scenarios stop at selecting a language/format, or at reading the showtimes
  page. Choosing a showtime or a seat is deliberately not automated: this
  drives the live production site.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Movies" tab

  # @smoke because flows/movies.md marks this scenario [smoke] and it is the
  # service's cheap happy path; @Test is kept so the existing
  # `--grep @Test` habit still works. Without @smoke, CI's smoke job skipped
  # Movies altogether - drift the flow-sha check cannot catch, because it
  # hashes the flow and not the tags the feature gave its scenarios.
  @smoke @Test
  Scenario: Filter the Hyderabad movies listing by Telugu language
    When the user filters by the "Telugu" language
    Then the movies listing is displayed
    And the "Telugu" language filter is applied
    And the selected city remains "Hyderabad"

  # The language is ONE placeholder used by the filter, the format popup and
  # the closing assertion, so they cannot drift apart. The format is not pinned:
  # availability is per-movie and per-language, and the movie changes daily.
  @booking
  Scenario Outline: Book the first <language> movie in its first available format
    When the user filters by the "<language>" language
    And the user opens the first movie in the listing
    Then the movie details page is displayed
    And the "Book tickets" button is available
    When the user starts booking tickets
    And the user selects the first available format for "<language>" if prompted
    Then the language and format popup is no longer shown
    And the showtimes page for "<language>" is reached

    Examples:
      | language  |
      | Telugu    |
      | Tamil     |
      | Malayalam |

  # Languages is covered by the @Test scenario above, so it is not repeated
  # here: every Examples row is a full live journey through the Background.
  # "format=2D" keeps its case on purpose - measured, the Format filter does
  # NOT lowercase its value the way genres and languages do.
  @filters
  Scenario Outline: Filter the movies listing by <group>
    When the user applies the "<option>" option from the "<group>" filter
    Then the listing URL carries "<param>"
    And the listing page is still shown

    Examples:
      | group  | option | param         |
      | Genres | Action | genres=action |
      | Format | 2D     | format=2D     |

  # A coming-soon title has no "Book tickets" - it offers "I'm interested"
  # instead, and that action is account-gated. This is the logged-OUT half of
  # that behaviour and needs no session. It must stay logged out, which is why
  # the two halves are split across the "anonymous" and "account" projects.
  @auth
  Scenario: Marking a coming soon movie as interested requires an account
    When the user opens the Coming Soon listing
    Then the Coming Soon listing is displayed
    When the user opens the first upcoming movie
    Then the movie offers to mark interest instead of booking
    When the user tries to mark the movie as interested
    Then marking interest requires signing in
    And BookMyShow asks the user to sign in
    And the "Continue with Google" sign-in option is offered

  # Switches city mid-scenario rather than parameterising the Background,
  # which Gherkin cannot do — and switching is the part worth testing anyway:
  # the header offers "Select your region" only before a city has EVER been
  # chosen, so going Hyderabad -> Mumbai needs the city button instead.
  @city
  Scenario Outline: Browse the movies listing in <city>
    Given the city is set to "<city>"
    And the user opens the "Movies" tab
    Then the movies listing is displayed
    And the movies listing is headed for "<city>"
    And the selected city remains "<city>"

    Examples:
      | city      |
      | Hyderabad |
      | Mumbai    |

  @filters
  Scenario: Combine a language filter with a genre filter
    When the user filters by the "Telugu" language
    And the user applies the "Drama" option from the "Genres" filter
    Then the listing URL carries "languages=telugu"
    And the listing URL carries "genres=drama"

  # Languages is multi-select. Measured 2026-09-21: the URL joins the values
  # with a pipe, `languages=telugu|hindi`, which is why the second language is
  # applied by a different step - the first step's wait for `languages=hindi`
  # would never be satisfied.
  @filters
  Scenario: Select two languages at once
    When the user filters by the "Telugu" language
    And the user also filters by the "Hindi" language
    Then the listing URL carries "languages=telugu|hindi"
    And the listing page is still shown

  # Each "Clear" belongs to its own group rather than resetting everything:
  # measured, the first one removed languages and left genres=drama standing.
  @filters
  Scenario: Clearing one filter group leaves the other applied
    When the user filters by the "Telugu" language
    And the user applies the "Drama" option from the "Genres" filter
    And the user clears the applied filter
    Then the listing URL no longer carries "languages=telugu"
    And the listing URL carries "genres=drama"

  # Leaves /explore/ entirely. The heading is "Cinema in hyderabad" -
  # singular, lowercase city - not the "Cinemas in Hyderabad" you would guess.
  @cinemas
  Scenario: Browse the cinemas directory for the city
    When the user opens Browse by Cinemas
    Then the cinemas directory for "Hyderabad" is displayed

  # The directory's search box filters the grid client-side without changing
  # the URL: 48 cinemas -> 1 for a full name, measured 2026-09-21. The name is
  # read from the page's own first row, not hard-coded.
  @cinemas
  Scenario: Search the cinemas directory by name
    When the user opens Browse by Cinemas
    Then the cinemas directory for "Hyderabad" is displayed
    When the user searches the directory for its first listed name
    Then the directory still lists that name

  # Searches for a title taken from today's listing rather than a hard-coded
  # film, which would leave the listing next week. The card's img alt is the
  # only place the clean title appears without certification and languages
  # glued to it.
  #
  # Asserts a non-zero COUNT, not that the title is among the rows: the panel
  # overlays the listing, the result rows are siblings of the counter with no
  # shared container, and the only anchor carrying the title is the card
  # underneath - so a "results contain X" check would pass with search broken.
  @search
  Scenario: Search returns results for a movie that is currently showing
    When the user searches for the first movie in the listing
    Then the search returns at least one result

  # Measured 2026-09-21 on "Mandaadi": h4 "About the movie", h4 "Cast" (one
  # h5 per person) and h4 "Crew". The rating is asserted by shape inside
  # "the movie details content is displayed".
  @details
  Scenario: Read the details page of the first movie
    When the user opens the first movie in the listing
    Then the movie details page is displayed
    And the movie details content is displayed
    And the "About the movie" section is shown
    And the "Cast" section is shown
    And the "Crew" section is shown

  # Goes one step FURTHER than the @booking outline: that one stops at the
  # /buytickets/ URL, this one reads what is on the page. Still nothing is
  # clicked - a showtime leads to seat selection, and seats are real inventory.
  @booking
  Scenario: Read the showtimes page without selecting a showtime
    When the user filters by the "Telugu" language
    And the user opens the first movie in the listing
    And the user starts booking tickets
    And the user selects the first available format for "Telugu" if prompted
    Then the showtimes page for "Telugu" is reached
    And the showtimes list cinemas and times

  # The date strip is seven `div`s whose only stable handle is an id equal to
  # the date code (div#20260922 reads "TUE 22 SEP"); the active date is also
  # the URL's own path segment, so "next" is computed from the URL and proven
  # by it. Changing the date is not a booking step - no showtime is touched.
  @booking
  Scenario: Change the date on the showtimes page
    When the user filters by the "Telugu" language
    And the user opens the first movie in the listing
    And the user starts booking tickets
    And the user selects the first available format for "Telugu" if prompted
    Then the showtimes page for "Telugu" is reached
    When the user picks the next date on the showtimes page
    Then the showtimes page shows the next date
    And the showtimes list cinemas and times

  # Each cinema row on the showtimes page carries a text-less link to that
  # cinema's own page (/cinemas/<city>/<slug>/buytickets/<CODE>/<date>), which
  # has no heading at all: the proof is the URL with the slug we clicked, the
  # date strip and the movie grid. Nothing on it is clicked.
  @cinemas
  Scenario: Open a cinema from the showtimes page
    When the user filters by the "Telugu" language
    And the user opens the first movie in the listing
    And the user starts booking tickets
    And the user selects the first available format for "Telugu" if prompted
    Then the showtimes page for "Telugu" is reached
    When the user opens the first cinema from the showtimes page
    Then the cinema page is displayed with its dates

  # The cinemas directory has one "Add to favourites" per cinema (48 in
  # Hyderabad), and it is account-gated the same way "I'm interested" is.
  @auth
  Scenario: Favouriting a cinema requires an account
    When the user opens Browse by Cinemas
    Then the cinemas directory for "Hyderabad" is displayed
    When the user favourites the first cinema
    Then favouriting a cinema requires signing in
    And BookMyShow asks the user to sign in

  # The signed-in half, run by the "account" project against the session saved
  # by `npm run auth:capture`.
  #
  # Interest is persistent account state, so this deliberately hunts for a
  # title the account has NOT already marked. Taking "the first upcoming movie"
  # stops testing anything once it has succeeded once - the title then shows
  # "You and N are interested" and offers no control, so the click either fails
  # or is skipped, and the mutation goes unverified either way.
  @account
  Scenario: A signed-in user can mark a coming soon movie as interested
    Given the user is signed in
    When the user opens the Coming Soon listing
    Then the Coming Soon listing is displayed
    When the user opens the first upcoming movie not yet marked interested
    And the user marks the movie as interested
    Then the movie is recorded as interested for the account
