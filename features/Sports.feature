# flow-sha: 002aee37f173922f3a8101bc735fc53117c6ce3fa6b0b145a2f9e327961bdfb8  (flows\Sports.md — regenerate with /update-feature Sports)
@sports
Feature: Sports service - browse, filter and reach the ticket page in Hyderabad

  Source flow: flows/Sports.md (Service Type: Sports)

  Scenarios stop on the ticket page. No ticket type is added and no payment is
  started: this drives the live production site, where adding a ticket holds
  real inventory.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Sports" tab

  # @smoke moved here from the Cricket outline below: a browse of the listing
  # is the cheap happy path, while "Cricket" matched exactly ONE event on
  # 2026-09-18 and could legitimately match none, which is not smoke material.
  @smoke
  Scenario: Browse the Hyderabad sports listing
    Then the sports listing is displayed
    And the sports listing is headed for "Hyderabad"
    And the selected city remains "Hyderabad"

  # <SportType> is ONE Examples column used by the scroll step, the
  # availability assertion, the filter, the filtered-listing assertion AND the
  # click step — that is the flow saying "the sport type I scrolled to is the
  # one I filter by and click in".
  #
  # NOTE on how the flow's "scroll down till find out <SportType>" is read:
  # unlike Stream, the Sports page is a FLAT listing with no per-sport
  # carousels — there is no "Cricket" section or heading on it at all
  # (verified 2026-09-18). The only "Cricket" on the page is an option in the
  # "Sports Type" filter, so the flow is realised as: find the filter option,
  # apply it, then open the first card of the listing it produces.
  @sporttype
  Scenario Outline: Open the first <SportType> event in the Hyderabad sports listing
    When the user scrolls to the "<SportType>" sports type filter
    Then the "<SportType>" sports type filter is available
    When the user filters the sports listing by "<SportType>"
    Then the sports listing is filtered by "<SportType>"
    When the user opens the first event in the "<SportType>" sports listing
    Then the sports event details page is displayed

    Examples:
      | SportType |
      | Cricket   |

  # The expected URL fragment is a measured fact per group, not a slug of the
  # option: "Free" encodes as priceGroup=0to0. Sports Type is the same rail
  # component the sport-type outline drives, so "Running" -> categories=running.
  @filters
  Scenario Outline: Filter the sports listing by <group>
    When the user applies the "<option>" option from the "<group>" filter
    Then the listing URL carries "<param>"
    And the listing page is still shown

    Examples:
      | group       | option  | param              |
      | Sports Type | Running | categories=running |
      | Date        | Today   | daygroups=today    |
      | Price       | Free    | priceGroup=0to0    |

  @filters
  Scenario: Clear an applied sports filter
    When the user applies the "Running" option from the "Sports Type" filter
    And the listing URL carries "categories=running"
    And the user clears the applied filter
    Then no filter is applied to the listing
    And the sports listing is displayed

  # Re-measured 2026-09-21: "Book Now" is a LINK on Sports, the same as
  # Events, and the details page renders h2 "About The Event" and "<N> are
  # interested" exactly as Events does. That is why SportsPage shares
  # TicketedPage with EventsPage.
  Scenario: Open the first sports event and see its details
    When the user opens the first event in the listing
    Then the event details page is displayed
    And the "About The Event" section is shown
    And the interested count is shown
    And the "Book Now" link is available

  # Stops on the ticket page. "Login To Book" is what a logged-out visitor is
  # offered there, so this proves the funnel is account-gated without adding a
  # ticket or touching the pay CTA.
  @booking
  Scenario: Reach the sports ticket page without starting a booking
    When the user opens the first event in the listing
    And the user starts booking the event
    Then the ticket page is displayed
    And the ticket types are listed
    And booking the event requires signing in
    And no payment has been started

  # Switches city mid-scenario. The header offers "Select your region" only
  # before a city has EVER been chosen, so going Hyderabad -> Mumbai uses the
  # header's city button; BasePage.cityPickerTrigger covers both states.
  @city
  Scenario: Browse the sports listing in Mumbai
    Given the city is set to "Mumbai"
    And the user opens the "Sports" tab
    Then the sports listing is displayed
    And the sports listing is headed for "Mumbai"
    And the selected city remains "Mumbai"

  # Searches for a title taken from today's listing rather than a hard-coded
  # event. See the Movies feature for why the assertion is a count.
  @search
  Scenario: Search returns results for a sports event that is currently listed
    When the user searches for the first event in the listing
    Then the search returns at least one result

  # Sports shares TicketedPage with Events, and its ticket page gates the same
  # way. Measured on the same page: logged out it offers "Login To Book" and no
  # "Proceed"; signed in the gate is gone and "Proceed" appears. Two signals
  # flip, so this cannot pass on a page that merely failed to load.
  @account
  Scenario: A signed-in user reaches the sports ticket page without a login gate
    Given the user is signed in
    When the user opens the first event in the listing
    And the user starts booking the event
    Then the ticket page is displayed
    And booking the event does not require signing in
    And no payment has been started
