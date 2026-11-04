# BED integration gaps

This is a frontend-side inventory based on the current `Humbites-BED` checkout.
It records missing or incomplete API contracts; it does not propose or make
changes in BED. FED-Business can point to BED with `BED_API_URL` after
`SHOWCASE_MODE=false`, but the current backend does not yet support the complete
dashboard flow.

## Required before the business dashboard can be used end to end

| Dashboard need | Frontend request / expected contract | Current BED state |
| --- | --- | --- |
| Owner sign-in | `GET /v1/auth/csrf`, then `POST /v1/auth/login`; session verification at `GET /v1/auth/login-success` | Login routes exist, but no CSRF route or CSRF middleware is present. The frontend cannot complete its CSRF-protected login handshake. |
| Dashboard summary | `GET /v1/me/businesses/:businessId/foodtrucks/:foodtruckId/overview` | No route or controller. |
| Booking settings | `GET` and `PATCH /v1/me/businesses/:businessId/foodtrucks/:foodtruckId/booking-settings` | No route or controller. |
| Schedule | `GET`/`PUT .../schedule` and `GET .../schedule-preview` | No routes or controllers. |
| Menu read and assignment | `GET .../menu`, `GET .../menu-options`, and category CRUD at `.../menu-categories` | Menu write routes exist, but the truck route has no menu read or menu-options/category routes. The frontend needs categories, allergens, assignments, and item DTOs. |
| Booking inbox and decisions | `GET .../bookings` with `page`, `limit`, `status`, `q`; booking detail and `POST .../:bookingId/{accept,decline,cancel}` | Routes exist, but list returns an empty stub and detail/decision controllers return placeholder data. Pagination and search are not implemented. |
| Truck images | `GET/POST .../media/businesses/:businessId/foodtrucks/:foodtruckId/images`, plus delete and upload completion paths | BED has an authenticated upload route under `/me/businesses/.../foodtrucks/.../images`, but not the media API contract used by FED-Business (list, delete, menu-image upload, completion response and same-origin upload URL). |
| Payments | `GET /v1/payments/config`, `GET /v1/payments/bookings/:id`, and capture/cancel/refund actions | No payment routes are mounted in BED. |

The existing truck list route at `GET /v1/me/businesses/:businessId/foodtrucks`
and public `GET /v1/foodtrucks` return legacy Sequelize records. FED-Business can
read IDs and names for selection, but the dashboard editors need stable DTOs for
menus, booking settings, schedules, images, bookings and payment state.

## Shared public catalogue requirements

BED's `GET /v1/foodtrucks?page=&limit=` and
`GET /v1/foodtrucks/slug/:foodtruckSlug` currently return the legacy truck
record. It has name, slug, address, city/state, coordinates and image URL, but
does not include the FED catalogue contract: menu items with integer minor-unit
prices, cuisine/tags, service area, fixed rental fee, booking capacity/settings,
availability, or image metadata. FED now maps the fields that exist and marks
trucks without booking settings as unavailable for booking; it does not invent
prices or menus. BED needs to expose the complete catalogue and booking DTOs for
customer browsing and booking to work.

The customer frontend also calls:

- `POST /v1/foodtrucks/search` for server-side catalogue search; this route is
  absent. Basic local filtering can use the public list response.
- `POST /v1/bookings/quote`; the route currently returns a zero-valued USD
  placeholder instead of a server-validated quote.
- `POST /v1/bookings`; the route currently returns a temporary ID and echoes
  request input instead of persisting a booking and issuing guest access.
- `GET/POST /v1/bookings/:bookingId`, `/cancel`, and booking-payment operations;
  the available guest routes do not implement the FED request, private receipt,
  idempotency, access-token, conflict-checking or payment contracts.

## Configuration and security

- Keep `BED_API_URL` as the backend origin without `/v1`; it is server-only in
  both website repositories. FED-Business also requires `SHOWCASE_MODE=false`
  to select the BED proxy.
- The website BFFs make same-origin browser requests and forward BED calls from
  their servers. Configure session cookie behavior and the trusted frontend
  origins for the deployed topology. BED currently hard-codes CORS to
  `http://localhost:3001`; the browser must not call BED directly with session
  credentials.
- The website server routes may use a secret Mapbox token only on the server.
  The browser map uses a public `pk.` token. If Mapbox server operations are
  moved into BED, expose narrowly scoped Mapbox proxy routes there and keep the
  secret in BED's environment.
