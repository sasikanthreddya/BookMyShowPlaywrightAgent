# flow-sha: 67ea43655c964a6639831919099cc7a5ed12beb01d0f92688c89f6b100955512  (flows\stream.md — regenerate with /update-feature stream)
@stream
Feature: Stream service - browse curated movie collections

  Source flow: flows/stream.md (Service Type: Stream)

  Curated collections are the Stream page's own content: the Events page holds
  only live events, so this flow belongs to Stream and not to Events.

  Scenarios stop on a title page. "Rent" and "Buy" are asserted present and
  never clicked: both open the payment flow, which is the suite's hard stop.

  Background:
    Given the user is on the BookMyShow home page
    And the city is set to "Hyderabad"
    And the user opens the "Stream" tab

  # ONE Examples column, used by the scroll step, the display assertion AND the
  # click step — that is the flow saying "the section I scrolled to is the
  # section I click in". Hard-coding it in one step and parameterising it in
  # another would silently diverge the moment a row is added.
  #
  # No title is pinned anywhere. These carousels are curated and rotate: the
  # Tom Cruise collection led with "Top Gun: Maverick" (13 cards) on 2026-09-18
  # but its card order had already shifted since 2026-09-17, so "whichever
  # shows first" is read from the page, never asserted as a name.
  Scenario Outline: Open the first title in the <StremType> collection
    When the user scrolls to the "<StremType>" collection
    Then the "<StremType>" collection is displayed
    When the user opens the first title in the "<StremType>" collection
    Then the title details page is displayed

    # Tagged per Examples BLOCK, not per scenario, so @smoke buys exactly one
    # cheap happy path while @stream still covers the whole table. The rows are
    # not equal cost: "Spidey All The Way!" is the 3rd collection on the page,
    # "Best of Tom Cruise Movies" is near the bottom of ~8000px of lazy-loaded
    # carousels and takes ~41s of scrolling to reach on its own.
    @smoke
    Examples:
      | StremType           |
      | Spidey All The Way! |

    Examples:
      | StremType                 |
      | Best of Tom Cruise Movies |

  # The page builds itself as you scroll: measured 2026-09-21 it opens with 5
  # collections and has 18 after six 1200px steps. An unset city produces a
  # short page that never grows, so this also guards the city step indirectly.
  @browse
  Scenario: The Stream page loads more collections as the user scrolls
    When the user notes how many collections are on the page
    And the user scrolls down the page
    Then more collections have been loaded

  # The hero carousel at the top ("Brand new releases every Friday") is the
  # one part of the page that needs no scrolling, and it refreshes weekly, so
  # no title is pinned here either.
  @browse
  Scenario: Open the first new release from the top carousel
    Then the new releases carousel is displayed
    When the user opens the first new release
    Then the title details page is displayed

  # Measured 2026-09-21 on "Evil Dead Burn": `button "Rent ₹249"` and
  # `button "Buy ₹699"`. Prices change, so the match is on the verb. This is
  # where Stream's funnel stops — neither button is ever clicked.
  @booking
  Scenario: A title can be rented or bought, without purchasing
    When the user scrolls to the "Spidey All The Way!" collection
    And the user opens the first title in the "Spidey All The Way!" collection
    Then the title details page is displayed
    And rent and buy options are offered
    And no purchase has been started

  # Searches for a title taken from a collection on today's page, read from
  # the card's img alt (the card's text runs title, runtime, genres and
  # synopsis together). See the Movies feature for why the assertion is a count.
  @search
  Scenario: Search returns results for a title in a collection
    When the user scrolls to the "Spidey All The Way!" collection
    And the user searches for the first title in the "Spidey All The Way!" collection
    Then the search returns at least one result

  # Stream's only account-gated surface. "Rent" is NOT one: clicking
  # "Rent ₹249" logged out changes nothing - no redirect, no sign-in sheet -
  # and its signed-in side leads to payment, which is out of scope. The
  # library gates cleanly in both directions, and the page renders no h1, so
  # the URL is the whole assertion.
  @auth
  Scenario: Opening the Stream library requires an account
    When the user opens the Stream library
    Then the Stream library requires signing in

  @account
  Scenario: A signed-in user can open their Stream library
    Given the user is signed in
    When the user opens the Stream library
    Then the Stream library is displayed
