# flow-sha: 331d59cf54a3637cb4f7092e13ffca81a7e5089a6609af883af3e552e1be9271  (flows\activities.md — regenerate with /update-feature activities)
@activities
Feature: Activities service - browse, filter and reach date selection in Hyderabad

  Source flow: flows/activities.md (Service Type: Activity)

  Scenarios stop on the date selection page. A date may be chosen and the
  calendar opened, but "Proceed" (which leads to tickets) is never clicked and
  no payment is started: this drives the live production site, where choosing
  a ticket holds real inventory.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Activities" tab

  @smoke
  Scenario: Browse the Hyderabad activities listing
    Then the listing is displayed
    And the listing is headed for "Hyderabad"
    And the selected city remains "Hyderabad"

  @filters
  Scenario Outline: Filter the activities listing by <group>
    When the user applies the "<option>" option from the "<group>" filter
    Then the listing URL carries "<param>"
    And the listing page is still shown

    Examples:
      | group      | option    | param                |
      | Categories | Adventure | categories=adventure |
      | Date       | Today     | daygroups=today      |
      | Price      | Free      | priceGroup=0to0      |

  @filters
  Scenario: Combine a category filter with a date filter
    When the user applies the "Adventure" option from the "Categories" filter
    And the user applies the "Today" option from the "Date" filter
    Then the listing URL carries "categories=adventure"
    And the listing URL carries "daygroups=today"
    And the listing page is still shown

  @filters
  Scenario: Clear an applied activities filter
    When the user applies the "Adventure" option from the "Categories" filter
    And the listing URL carries "categories=adventure"
    And the user clears the applied filter
    Then no filter is applied to the listing
    And the listing is displayed

  Scenario: Open the first activity and see its details
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

  # Measured 2026-09-21: choosing a date does not change the URL; its only
  # observable outcome is "Proceed" flipping from disabled to enabled. That is
  # the assertion, and Proceed is never clicked.
  @booking
  Scenario: Select a date without proceeding to tickets
    When the user opens the first item in the listing
    And the user starts booking the item
    Then the date selection page is displayed
    When the user selects the first available date
    Then Proceed becomes available but is not taken
    And no payment has been started

  # Activities only: a multi-week run offers "See all dates", which swaps the
  # seven-day strip for a month calendar (buttons named "Sun 11 Oct 2026",
  # unavailable days disabled). A three-date play has no such control, which is
  # why this scenario is not in the Plays feature.
  @booking
  Scenario: See all dates opens the month calendar
    When the user opens the first item in the listing
    And the user starts booking the item
    Then the date selection page is displayed
    When the user opens See all dates
    Then the month calendar is displayed
    And no payment has been started

  # Switches city mid-scenario. The header offers "Select your region" only
  # before a city has EVER been chosen, so going Hyderabad -> Mumbai uses the
  # header's city button; BasePage.cityPickerTrigger covers both states.
  @city
  Scenario: Browse the activities listing in Mumbai
    Given the city is set to "Mumbai"
    And the user opens the "Activities" tab
    Then the listing is displayed
    And the listing is headed for "Mumbai"
    And the selected city remains "Mumbai"

  # Searches for a title taken from today's listing, read from the card's img
  # alt. See the Movies feature for why the assertion is a count.
  @search
  Scenario: Search returns results for an activity that is currently listed
    When the user searches for the first item in the listing
    Then the search returns at least one result

  # Like Plays, the date-time page shows no login gate — it is identical
  # signed in and signed out, because the gate sits behind "Proceed", which
  # leads to tickets and is never clicked. The venues directory is where an
  # account-gated action is reachable safely.
  @auth
  Scenario: Favouriting a venue requires an account
    When the user opens Browse by Venues
    Then the venues directory for "Activities" in "Hyderabad" is displayed
    When the user favourites the first entry in the directory
    Then favouriting requires signing in
    And BookMyShow asks the user to sign in

  @account
  Scenario: A signed-in user can favourite a venue and undo it
    Given the user is signed in
    When the user opens Browse by Venues
    Then the venues directory for "Activities" in "Hyderabad" is displayed
    When the user favourites the first entry in the directory
    Then the entry is marked as a favourite
    When the user removes it from favourites
    Then the favourite is restored to how it was found
