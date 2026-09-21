# flow-sha: 39d8f29774ccb11bb27bb2b89098f569703a545c78c2e2950151fc1d98d9f5b9  (flows\events.md — regenerate with /update-feature events)
@events
Feature: Events service - browse, filter and reach the ticket page in Hyderabad

  Source flow: flows/events.md (Service Type: Event)

  Scenarios stop at the ticket page. No ticket type is added and no payment is
  started: this drives the live production site, where adding a ticket holds
  real inventory.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Events" tab

  @smoke
  Scenario: Browse the Hyderabad events listing
    Then the events listing is displayed
    And the events listing is headed for "Hyderabad"
    And the selected city remains "Hyderabad"

  # The expected URL fragment is a measured fact per group, not a slug of the
  # option: "Free" encodes as priceGroup=0to0, not priceGroup=free. Keeping it
  # in the table is what stops a future row from being written by guesswork.
  @filters
  Scenario Outline: Filter the events listing by <group>
    When the user applies the "<option>" option from the "<group>" filter
    Then the listing URL carries "<param>"
    And the listing page is still shown

    Examples:
      | group      | option       | param                   |
      | Categories | Comedy Shows | categories=comedy-shows |
      | Date       | Today        | daygroups=today         |
      | Languages  | English      | languages=english       |
      | Price      | Free         | priceGroup=0to0         |

  @filters
  Scenario: Clear an applied events filter
    When the user applies the "Comedy Shows" option from the "Categories" filter
    And the listing URL carries "categories=comedy-shows"
    And the user clears the applied filter
    Then no filter is applied to the listing
    And the events listing is displayed

  # Two groups at once. Each group writes its own query parameter, so both
  # must be present; the listing itself may be empty for the combination.
  @filters
  Scenario: Combine a category filter with a date filter
    When the user applies the "Comedy Shows" option from the "Categories" filter
    And the user applies the "Today" option from the "Date" filter
    Then the listing URL carries "categories=comedy-shows"
    And the listing URL carries "daygroups=today"
    And the listing page is still shown

  Scenario: Open the first event and see its details
    When the user opens the first event in the listing
    Then the event details page is displayed
    And the interested count is shown
    And the "Book Now" link is available

  # Measured 2026-09-21: the "About The Event" text is truncated behind a
  # `button "Read More"` that becomes `button "Read Less"` once expanded. The
  # button swap is the assertion; text length is not, because a short
  # description grows by a line.
  @details
  Scenario: Read the full description of an event
    When the user opens the first event in the listing
    Then the event details page is displayed
    And the "About The Event" section is shown
    When the user expands the description
    Then the full description is expanded

  # Stops on the ticket page. "Login To Book" is what a logged-out visitor is
  # offered there, so this proves the funnel is account-gated without adding a
  # ticket or touching the pay CTA.
  @booking
  Scenario: Reach the event ticket page without starting a booking
    When the user opens the first event in the listing
    And the user starts booking the event
    Then the ticket page is displayed
    And the ticket types are listed
    And booking the event requires signing in
    And no payment has been started

  # "Know more" beside a ticket type is purely informational: measured
  # 2026-09-21 it swaps to "Know less" and reveals a list of that type's
  # inclusions. Nothing is added and the pay CTA stays disabled.
  @booking
  Scenario: Read a ticket type's details without adding it
    When the user opens the first event in the listing
    And the user starts booking the event
    Then the ticket page is displayed
    When the user expands the first ticket type's details
    Then the ticket type details are shown
    And no payment has been started

  # "Browse by Venues" leaves /explore/ for /venues?category=events, headed
  # "Venues for Events in Hyderabad": a grid of venue buttons with a search
  # box that filters it client-side (48 -> 1 for a full venue name, measured
  # 2026-09-21). The name is read from the page's own first row.
  @venues
  Scenario: Browse events by venue and search the venues directory
    When the user opens Browse by Venues
    Then the venues directory for "Events" in "Hyderabad" is displayed
    When the user searches the directory for its first listed name
    Then the directory still lists that name

  # Switches city mid-scenario. The header offers "Select your region" only
  # before a city has EVER been chosen, so going Hyderabad -> Mumbai uses the
  # header's city button; BasePage.cityPickerTrigger covers both states.
  @city
  Scenario: Browse the events listing in Mumbai
    Given the city is set to "Mumbai"
    And the user opens the "Events" tab
    Then the events listing is displayed
    And the events listing is headed for "Mumbai"
    And the selected city remains "Mumbai"

  # Searches for a title taken from today's listing rather than a hard-coded
  # event, read from the card's img alt. See the Movies feature for why the
  # assertion is a count.
  @search
  Scenario: Search returns results for an event that is currently listed
    When the user searches for the first event in the listing
    Then the search returns at least one result

  # The signed-in half of the ticket-page scenario, run by the "account"
  # project. Measured contrast on the same page: logged out it offers "Login
  # To Book", signed in that button is gone while the ticket types remain.
  # Still nothing is added and the pay CTA is never clicked.
  @account
  Scenario: A signed-in user reaches the event ticket page without a login gate
    Given the user is signed in
    When the user opens the first event in the listing
    And the user starts booking the event
    Then the ticket page is displayed
    And booking the event does not require signing in
    And no payment has been started
