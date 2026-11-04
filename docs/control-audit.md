# Demo controls and verification

> Event-rental update (2026-11-02): portion-based event pricing below is historical. The current [rental model](rental-model.md) charges only truck rental and uses dish selection; existing audit results are preserved as evidence from the previous version.

This records source-based and in-process contract checks plus the bounded live browser verification described below. It covers the customer and owner controls preserved from FED commit `efb42bb6e8ee5b1f8b916819d0f78f12d3cf3895` plus the new showcase controls. It is not a complete rendered mobile or accessibility audit.

| Area | Connected behavior |
| --- | --- |
| Brand, navigation, footer and hero CTAs | Internal routes or existing `foodtrucks` / `slik-fungerer-det` anchors; no placeholder `href="#"` links |
| Favourites | Toggle saved IDs, persistent browser favourites, matching results filter |
| Discovery | Place, cuisine, vegetarian and favourite filters; price/name sorting; list/map toggle; availability search with complete event; reset clears filtered availability |
| Map | Runtime public token; actual Mapbox map/Matrix/Directions; local labeled example-place search; preset/map-point/manual coordinates; loading, retry and provider error states |
| Menu | Integer portion increment/decrement/input, visible overflow/invalid errors, recalculated quote; deleted menu selections pruned on catalogue refresh |
| Booking | Three validated steps, prior-step editing, server quote, expiry reconfirmation, optional synthetic event/contact buttons, idempotent request creation |
| Receipt/history | Persisted own requests, status refresh, withdrawal, copy/bookmark link with clipboard fallback, customer ↔ owner handoff |
| Owner entry/session | Explicit one-click synthetic owner entry; logout clears owner role; shared initial visitor session prevents duplicate sandboxes |
| Owner inbox | Truck selection, status filter, previous/next pages, approve/decline/cancel with confirmation and visible feedback |
| Owner settings | Fee, capacity, service radius, opening periods, closures and descriptions saved to the visitor's demo |
| Owner menu | Add/edit/enable/remove, allergens, per-item image upload and catalogue refresh |
| Images | Start upload, same-origin authenticated PUT, complete, display and delete; bounded file validation in the media service |
| Payment | Internal mock checkout, explicit authorize/abort, receipt refresh; owner simulated capture/release/refund; no provider call or money transfer |
| Reset | Confirmation, server sandbox reset, local favourite reset and full reload |

Loading or invalid-state buttons are intentionally disabled until the relevant prerequisite exists. Errors use alert/status regions. Existing focus handling, reduced-motion behavior, readable mobile fields and the live catalogue-result announcement remain intact.

Validation before the production build: TypeScript check passed; 57 tests passed (5 actual SQLite/D1 sandbox booking workflows, 14 media/format tests, 2 showcase bootstrap/public-config tests and 36 retained domain/Mapbox/BFF regressions). A separate 9-test run used the Vinext next/server shim for the retained native BFF reference. Those reference tests do not prove the hosted mock handler; the SQLite workflow tests exercise that handler directly. No screenshot, rendered mobile layout or browser interaction pass is claimed.

Production build: the supported Sites build helper completed all five Vinext phases successfully. The artifact includes the booking, Mapbox and private media API routes, owner/customer pages and simulated checkout. Non-fatal notices concern a large lazily loaded map chunk and Vinext route-classification limits. Runtime endpoint readback is performed after deployment by the publishing owner.

## Navigation regression after publication

The publishing owner reproduced the reported fault in the supported live browser: filtering worked, but clicking **Åpne eierdemo** or **Se meny og truck** stayed on the home page and raised `TypeError: e is not a function`. Direct URL navigation and owner login worked. The existing statically imported `useRouter().push()` path was also verified live and preserved the favourites filter.

Cause: Vinext beta.5's emitted Link loader dynamically imported the browser entry's raw namespace, then requested `navigateClientSide` and `getPrefetchInterceptionContext`. That entry exposed renamed exports instead. The first missing function broke clicks; the second broke prefetch. Merely checking HTTP status, API contracts or static ESM linking did not detect this namespace-shape error.

`node --experimental-vm-modules scripts/check-client-navigation.mjs` reproduced the missing exports against the original built artifact before the fix. The script also accepts the deployed URL. This is a targeted check of the observed compiled loader, not a generic browser test.

The app-local `AppLink` preserves standard anchor behaviour and delegates ordinary internal clicks to statically imported `useRouter()`. Existing imperative router calls remain unchanged. No dependency upgrade, full-page reload or additional draft storage was introduced. Three focused event-contract tests cover normal/keyboard-generated clicks, modifiers, targets, download, prevention, external URLs, queries and fragments.

The publishing owner verified version 2 in the supported live browser: the previously failing link opened the owner page; homepage filtering and favourites led to the selected truck profile; two selected portions survived navigation into booking; example arrangement and contact details produced a saved receipt for **2,238 NOK, 40 guests and 2 portions**. The owner handoff displayed that saved request. No new JavaScript errors occurred during this sequence. This demonstrates the reported navigation failure is fixed for that customer flow.

## In-page confirmations

The next live step, **Godkjenn**, opened a native confirmation and stalled the supported browser controls. All six native confirmation sites have therefore been replaced with the shared Radix AlertDialog: owner booking decisions, owner simulated payment actions, image removal, menu removal, demo reset and customer withdrawal. Both **Avbryt** and the explicitly labeled positive action remain available; no mutation is automatically confirmed.

The dialog traps focus, starts on cancellation, handles Escape, restores focus to the originating control or a focusable page landmark, and cancels pending decisions on pathname change, provider unmount or originating caller unmount. Caller ownership prevents an old component's cleanup from dismissing another component's newer prompt. A single pending decision and the existing mutation busy states reject duplicate actions.

The final confirmation source pass passed TypeScript and all **63 tests**. Three new gate tests prove that actions await explicit approval, cancellation and duplicate settlements cannot approve, and caller cleanup cancels only its own decision. These tests do not simulate Radix focus behavior or browser input. A separate read-only review found no remaining actionable confirmation issue.

The publishing owner subsequently verified version 3 in the supported live browser: **Godkjenn** opened the in-page alert dialog with **Avbryt** initially focused; Escape cancelled; reopening and explicitly confirming changed the saved request to approved. The customer started the mock checkout and authorized it; the owner then inspected, captured and refunded the simulated 2,238 NOK using explicit confirmations. The final status was refunded and no new JavaScript errors occurred. No real provider or money was involved. This is the verified baseline before the business dashboard redesign below.

## Business dashboard and scheduling

The owner route has its own Pulse navigation and responsive workspace, replacing the duplicate customer header/footer only on `/eier`. It offers an overview, searchable/status-filtered paginated inbox, calendar/opening hours, menu, images and truck settings. Summary counts, recent requests, upcoming accepted jobs and accepted quote value come from the entire selected truck's persisted sandbox records. No metrics or bookings are silently seeded; the empty state links to the selected truck's customer flow. Quote value is explicitly distinguished from money received.

Inbox loading is independent from truck configuration loading. Opening-hours and settings editors retain dirty drafts during background data refresh; in-portal tab, truck, business, profile and logout navigation asks before discarding them. Saving disables those switches. Existing decision/payment mutations, private visitor scope, AppLink navigation and in-page confirmations remain in use.

Version 4 passed TypeScript, all 75 tests, the supported Sites production build and the compiled-navigation regression check. The hosted `scripts/verify-owner-schedule.mjs` passed against a fresh synthetic visitor: overnight service, dated closures, custom intervals, vacation, notice/horizon, approval rechecks, persistence, overview/search and independent section saves. It reset only its own sandbox afterward.

The supported browser verified the redesigned desktop and 390-pixel mobile interface. Checks included actual overview totals, preset confirmation, cancellation of dirty navigation, split Monday hours saved and reflected in the calendar, a vacation conflict with a retained accepted booking, persistence after full reload, holiday/date additions, price-section saving without erasing those exceptions, search/no-results/reset, payment-state readback, cancellation of an owner action, menu saving and a real demo image upload. No JavaScript errors were captured. The browser's time/date `fill` operation changed DOM values without notifying React; real arrow-key input committed the native fields and the resulting persisted values were checked.

The mobile screenshot exposed a clean-state save bar covering content with disabled actions. The follow-up CSS keeps it in document flow until there are unsaved changes; only a dirty save bar stays visible while scrolling. Mobile document width did not exceed the viewport. The earlier full authorization/capture/refund flow remains separately documented above; no real payment is implied by these checks.
