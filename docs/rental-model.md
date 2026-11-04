# Event rental model

The event organizer rents the foodtruck. Guests order and pay for their own food at the event. Pickup food orders remain a separate flow with quantities and food payment.

## Customer and owner contract

- Choose the event location, date, time, duration and guest count.
- Select which menu dishes the truck should offer, using checkboxes. Guest-facing portion prices are information only.
- The organizer pays one configured rental fee, including transport and rigging. No food subtotal, per-guest estimate, or prepaid portion count is added.
- The owner sees the selected dishes and the event guest count. Availability still checks guest capacity, geography, schedule, booking horizon and accepted reservations.
- Owner approval and the simulated rental payment remain separate steps. The demo never transfers real money.

## Compatibility and implementation

The existing quantity-map wire shape is retained to avoid breaking stored drafts. Values above zero mean selected and are normalized to 1; zero removes a selection. Invalid, unsafe or unbounded numeric values are rejected. This is not the pickup quantity model.

New quotes declare pricingModel=rental-v1, rentalFeeMinor and selectedDishCount. They contain canonical selected dish lines with quantity=1 and lineTotalMinor=0. unitPriceMinor preserves the menu price for information. subtotalMinor and portionCount are zero. The legacy transportFeeMinor field carries the full rental fee and totalMinor equals that fee. The owner fixedFeeMinor setting is labeled as rental including transport/rigging.

Old submitted booking snapshots are neither migrated nor recalculated. Their missing pricingModel selects the historical display with original quantities and totals. New submissions from old quotes are rejected: the stored settings fingerprint includes the rental model revision and the server compares a freshly calculated quote. The customer must fetch a new quote. Replay of an already submitted idempotent request still returns its original booking.

maxPortions is retained only as a compatibility setting. Event availability no longer uses it; maxGuests still applies. This change is implemented in the Sites showcase API. Any separately hosted production backend must adopt the same rental contract before switching a Site to that backend.

## Checks

Domain tests cover fee-only totals, valid selection normalization, invalid inputs, no-food-charge boundaries and request snapshots. API tests cover canonical persisted selections, guest capacity with obsolete portion limits, old-quote rejection and historical price preservation through owner approval. Existing pickup tests verify its independent food quantities and payment behavior.

Historical audit and research documents record the previous catering model; this document supersedes their portion-based event-pricing proposals.
