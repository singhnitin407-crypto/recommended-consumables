# Recommended Consumables — vanilla HTML/CSS/JS component

A selectable bundle carousel for Global Industrial: shoppers untick what they don't need, set quantities, and add the rest to the cart in one click.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`). No build step, no dependencies, works offline.

## Files
| File | What it holds |
|---|---|
| `index.html` | Semantic markup, the card `<template>`, quick-view `<dialog>`, toast |
| `styles.css` | GI design tokens (custom properties), layout, states, breakpoints |
| `app.js` | One state object, one `render()`; selection, quantities, carousel, quick view, add to cart |
| `data.js` | 12 real products from globalindustrial.com (captured 19 Oct 2026) |
| `img/` | Product images from each product page, resized to 400 × 400 px |
| `fonts/` | Kanit 400–700 (SIL Open Font License), bundled locally |

Page max width 1440 px; component container 1368 px.

## Design system
Tokens were sampled from globalindustrial.com on 19 Oct 2026 (computed styles of the live Consumables page):

| Token | Value | Used on GI for |
|---|---|---|
| Font | Kanit | Everything |
| `--gi-red` | `#D41E3D` | Add To Cart, search button |
| `--gi-blue` | `#004E7D` | Sales bar, links, "Ships within…" |
| `--ink` | `#212934` | Names, prices, headings |
| `--ink-2` | `#424C5B` | Body copy |
| `--gi-green` | `#4E832E` | Savings |
| `--gi-gold` | `#D89F02` | Bestseller ribbon |
| Card | white, 1 px `rgba(0,0,0,.2)` border, 4 px radius | Product tiles |
| Button | 50 px high, 8 px radius, 600 weight, Title Case | "Add To Cart" |

One deliberate deviation: GI sets the Bestseller ribbon text in white (about 2.3:1 contrast on gold). Here it is ink (about 7:1) to pass WCAG AA.

## Interactions
| Interaction | Why |
|---|---|
| Whole card toggles selection; checkbox top right | Large target; the comp's checkbox alone was tiny |
| Quantity stepper per item (1–99, typed or ±, arrow keys) | Consumables are bought in multiples; the total reflects the real order |
| Changing a quantity selects the item | It signals intent |
| Product name or "Quick view" opens a dialog | Full name, model #, shipping, quantity and an include switch, without leaving the page; fixes truncated names on touch |
| Select all / Clear all | Resetting no longer takes 11 clicks |
| Live total with a short count-up, plus "items · units" | Every change is visible and announced |
| Button label follows the selection | "Add All To Cart" → "Add Selected (9) To Cart" → disabled with "Select items to add" |
| Carousel: arrows, dots, "Showing 6–10 of 12", swipe, ← → Home End | Orientation in a 12-item list |
| Add flow: Adding… (700 ms simulated) → Added To Cart ✓ (green) → toast with thumbnails and Undo | Clear feedback; no real cart is called |
| Mobile (< 768 px): sticky total bar, peeking cards, Quick view always visible | Total and action stay in reach while scrolling |
| Reduced motion | Animations off; total updates instantly |

## Decisions (where the comp was ambiguous)
1. **Total = selected in-stock items × quantity.** The comp's $423.20 matched neither the visible prices nor the unchecked boxes.
2. **Everything starts selected, quantity 1.** This is a hypothesis; A/B test it against nothing selected.
3. **12 real products.** The comp duplicated stretch wrap and priced duct tape at $979.00.
4. **One real backordered item** (tape dispenser, "Available around Nov 4") shows the unavailable state.
5. **Prices** are each product page's single-unit price on 19 Oct 2026, in cents. The site's lower "as low as" prices are quantity breaks and are not used.

## QA results (Chromium via Playwright, 19 Oct 2026)
**Passed (50 checks):**
- Totals and labels in every state, including quantities (e.g. 3 × $36.75 = $110.25 line total).
- Quantity clamps to 1–99, rejects text, and selects its item.
- Quick view: opens, traps focus, syncs quantity and selection both ways, closes with Esc or the backdrop, returns focus.
- Paging by arrows, dots, keys and End; arrows disabled at the ends.
- The unavailable item can't be selected.
- Select all and Clear all; the none-selected state.
- Add flow: adding → added → toast → Undo → back to idle.
- Keyboard: Tab order, Space, ↑ on quantity.
- axe-core (WCAG 2.2 AA + best practice) at 1440 px, 390 px and with quick view open: 0 violations.
- No page-level horizontal scroll at 1920, 1280, 1024, 768, 390 and 320 px.
- Reduced motion honoured; no console errors.

**Not yet checked:** real screen readers (VoiceOver, NVDA), Safari, Firefox, physical touch devices.

## Out of scope / next steps
A real cart API, personalised recommendations, quantity-break pricing ("as low as"), analytics events (`bundle_item_toggled`, `bundle_qty_changed`, `bundle_added`).
