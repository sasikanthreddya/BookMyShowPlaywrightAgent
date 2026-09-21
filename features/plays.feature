# flow-sha: bcc2796c1be48eead3a9b7df2e9950147690a6ccb84cc6dd34d5569e6a6e45e2  (flows\plays.md — regenerate with /update-feature plays)
@plays
Feature: Plays service - browse, filter and reach date selection in Hyderabad

  Source flow: flows/plays.md (Service Type: Play)

  Scenarios stop on the date selection page. A date may be chosen, but
  "Proceed" (which leads to seats) is never clicked and no payment is started:
  this drives the live production site, where choosing a seat holds real
  inventory.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Plays" tab

  @smoke
  Scenario: Browse the Hyderabad plays listing
    Then the listing is displayed
    And the listing is headed for "Hyderabad"
    And the selected city remains "Hyderabad"

  # "Theatre" encodes as categories=theatre-plays, NOT categories=theatre.
  # That is exactly why the expected URL is a column here rather than being
  # derived from the label in code.
  @filters
  Scenario Outline: Filter the plays listing by <group>
    When the user applies the "<option>" option from the "<group>" filter
    Then the listing URL carries "<param>"
    And the listing page is still shown

    Examples:
      | group      | option  | param                    |
      | Plays Type | Theatre | categories=theatre-plays |
      | Date       | Today   | daygroups=today          |
      | Price      | Free    | priceGroup=0to0          |

  @filters
  Scenario: Combine a plays type filter with a date filter
    When the user applies the "Theatre" option from the "Plays Type" filter
    And the user applies the "Today" option from the "Date" filter
    Then the listing URL carries "categories=theatre-plays"
    And the listing URL carries "daygroups=today"
    And the listing page is still shown

  @filters
  Scenario: Clear an applied plays filter
    When the user applies the "Theatre" option from the "Plays Type" filter
    And the listing URL carries "categories=theatre-plays"
    And the user clears the applied filter
    Then no filter is applied to the listing
    And the listing is displayed

  Scenario: Open the first play and see its details
    When the user opens the first item in the listing
    Then the item details page is displayed
    And the "About The Event" section is shown
    And the "Book Now" link is available

  @booking
  Scenario: Reach the date selection page without starting a booking
    When the user opens the first item in the listing
    And the user starts booking the item
    Then the date selection page is displayed
    And no payment has been started

  # One step further than the scenario above, and still short of inventory:
  # measured 2026-09-21, choosing a date does not change the URL and its only
  # observable outcome is "Proceed" flipping from disabled to enabled — so
  # that is the assertion, and Proceed is never clicked.
  @booking
  Scenario: Select a date without proceeding to seats
    When the user opens the first item in the listing
    And the user starts booking the item
    Then the date selection page is displayed
    When the user selects the first available date
    Then Proceed becomes available but is not taken
    And no payment has been started

  # Switches city mid-scenario. The header offers "Select your region" only
  # before a city has EVER been chosen, so going Hyderabad -> Mumbai uses the
  # header's city button; BasePage.cityPickerTrigger covers both states.
  @city
  Scenario: Browse the plays listing in Mumbai
    Given the city is set to "Mumbai"
    And the user opens the "Plays" tab
    Then the listing is displayed
    And the listing is headed for "Mumbai"
    And the selected city remains "Mumbai"

  # Searches for a title taken from today's listing, read from the card's img
  # alt. See the Movies feature for why the assertion is a count.
  @search
  Scenario: Search returns results for a play that is currently listed
    When the user searches for the first item in the listing
    Then the search returns at least one result

  # Plays has no login gate at the date-time page — measured, it looks
  # identical signed in and signed out, because the gate sits behind
  # "Proceed", which leads to seats and is never clicked. The venues directory
  # is where an account-gated action IS reachable safely.
  @auth
  Scenario: Favouriting a venue requires an account
    When the user opens Browse by Venues
    Then the venues directory for "Plays" in "Hyderabad" is displayed
    When the user favourites the first entry in the directory
    Then favouriting requires signing in
    And BookMyShow asks the user to sign in

  # The one account-gated action on this site that is REVERSIBLE, so unlike
  # marking a movie interested this restores what it changed and can run every
  # day. Measured: Add 7 -> 6 with a "Remove from favourites" appearing, and
  # clicking that returns it to 7.
  @account
  Scenario: A signed-in user can favourite a venue and undo it
    Given the user is signed in
    When the user opens Browse by Venues
    Then the venues directory for "Plays" in "Hyderabad" is displayed
    When the user favourites the first entry in the directory
    Then the entry is marked as a favourite
    When the user removes it from favourites
    Then the favourite is restored to how it was found
