# Humbites interactive booking showcase

A Norwegian customer and owner demonstration of Humbites. It uses the Pulse visual design, a Sites Vinext Worker, D1 for each visitor's isolated sample data, and R2 for uploaded sample images. It does not make real bookings, contact vendors, send email/SMS, or call a payment provider.

## Try the whole journey

Start at `/`: the hero contains the shared place/date/guest form. Submitting opens
`/foodtrucks`, a dedicated catalogue with cuisine, vegetarian and favorite filters.
The discovery fields travel in the URL and restore on refresh; contacts and notes
stay out of URLs. A place label alone is not a geocoded point or proof of availability.

Discovery code lives in `features/discovery`: `HomePage` handles the landing page,
`EventSearch` shares the form, `ResultsPage` handles filtering and availability,
`TruckCard` renders cards, and `search-query` validates URL input. Responsive styles
are scoped in `app/discovery.css`. Query round-trips and invalid inputs are covered
in `tests/discovery.test.ts`.

1. Choose a truck and open its menu or plan an event.
2. Select **Bruk et eksempelarrangement** to fill a fictional location, future date and 40 guests. Choose the dishes the truck will offer; attendees buy food individually.
3. Request the server-calculated sample price, fill **eksempelkontakt**, and save the demo request.
4. Open **eierdemoen** from the receipt. Enter with one click, choose the truck, and approve or decline the request.
5. Return to the customer's receipt and update its status. For an approved request, try the internal simulated payment screen.
6. In the owner demo, try capture, release or refund of the simulated amount. These actions never move money.
7. Owner settings, opening hours, menu editing and sample image uploads affect only this visitor's catalogue. **Start på nytt** clears that visitor's demonstration.

Use fictional contact details and non-sensitive sample images. A sandbox is available for up to 24 hours. A private receipt link is a credential; do not post it publicly. The shareable website link creates a separate demonstration for each visitor.

## Runtime configuration

Configure runtime values through Sites, not in the tracked hosting manifest. The manifest contains only the Site identity and the `DB` D1 / `BUCKET` R2 binding declarations.

| Variable                     | Value / purpose                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SHOWCASE_MODE`              | `true`: explicitly enables isolated persisted simulation                                              |
| `HUMBITES_MODE`              | `live`: selects the API-connected customer flow; `SHOWCASE_MODE` makes its data and actions simulated |
| `SITE_URL`                   | Canonical HTTPS Site origin                                                                           |
| `MAPBOX_PUBLIC_TOKEN`        | Public `pk.` token for browser map rendering; returned by a strict public-config endpoint             |
| `MAPBOX_ACCESS_TOKEN`        | Server-side Matrix / Directions credential; never returned by the public-config endpoint              |
| `MAPBOX_PERMANENT_GEOCODING` | `false`; showcase place search uses labeled local sample locations                                    |

The showcase needs no external BED, Redis, PostgreSQL, Vipps or SMTP configuration. Its server-connected flows are mocks with durable demo state. Production BED logic remains in the separate GitHub branch; this Site does not deploy it.

Mapbox map rendering, Matrix and Directions are real provider operations when configured. Truck bases and presets remain fictional examples. No fake route, distance or provider success is generated when Mapbox fails. Address search in this demonstration searches known example places, avoiding storage of temporary Mapbox geocoding results. Map-point selection and explicit coordinates are also available. Matrix distance does not change the fixed transport/rigging fee.

## Development and checks

Use the Sites plugin's supported `install-dependencies.mjs` and `build-site.mjs` helpers. The supplied `sites()` Vite integration, Worker entrypoint and execution-profile scripts are retained. Node 24 and pnpm 11.25 are the tested toolchain.

```sh
pnpm typecheck
pnpm test
pnpm test:vinext
```

`test:vinext` executes the native BFF contract fixtures through Vinext's actual `next/server` shim, checking cookie and response parity without starting an HTTP server. Sandbox and media tests cover the mock implementation separately. `lib/booking/native-route.ts` retains the original production proxy solely as an unmounted test reference for the original BFF contracts.

D1 migrations are tracked under `drizzle/` and are included through Sites. For a fresh local `pnpm dev` the local D1 database is empty; apply the migration once with `pnpm exec wrangler d1 execute DB --local --persist-to .wrangler/state --file drizzle/0000_tense_thena.sql` (needs a wrangler config with a `DB` D1 binding), otherwise the owner demo fails with `no such table`. Generated `dist/`, dependency folders, runtime state and local environment files are ignored. Keep credentials out of source and public assets.

Desktop and mobile browser checks are recorded in `docs/control-audit.md`. Automated checks complement those observations; they do not establish every possible browser interaction.

The demo's API budgets and storage limits are a demonstration boundary, not a substitute for production abuse controls, legal/privacy arrangements, real merchant setup or payment-provider onboarding.

## Maintaining the application

Run `pnpm format` after editing application code and `pnpm format:check` before committing. The pinned formatter and repository configuration keep TypeScript, JSX and CSS consistent. Then run `pnpm typecheck` and `pnpm test`. Generated output and bundled integration code are excluded from the application formatting scope.

### Module map

- `app/`: route composition and API entrypoints.
- `features/`: customer and owner workflows; keep network orchestration in the feature coordinator and render-only controls in adjacent components.
- `features/owner/TimeRanges.tsx`: controlled time inputs, independent of saving or fetching.
- `features/owner/BookingPresentation.tsx`: shared booking date/status presentation.
- `lib/booking/`: browser API client, DTOs, payment-state interpretation and retained production BFF reference.
- `lib/showcase/handler.ts`: request dispatch and authentication boundary.
- `lib/showcase/service.ts`: authoritative operations; UI calculations must never replace server validation.
- `lib/showcase/store.ts`: visitor isolation and compare-and-swap persistence.
- `lib/showcase/schedule.ts`: shared schedule validation and Oslo-time evaluation.
- `components/`: cross-feature providers, navigation and confirmation primitives.
- `tests/`: domain, integration, storage, isolation and regression checks.

### Invariants to preserve

Money uses integer øre. Event customers pay only the truck rental, including transport and rigging; selected menu dishes carry no food charge. Pickup orders retain food quantities and their own payment flow. Pending requests do not reserve capacity. Approval rechecks availability and reserves rigging buffers atomically. Payment state is simulated and must never imply real settlement.

Schedules use Europe/Oslo wall-clock minutes: an end above 1440 continues into the next day. Vacation and legacy closed dates override dated exceptions; dated exceptions replace the entire date, including overnight carry; weekly hours apply otherwise. Accepted reservations remain intact when hours change, with conflicts exposed to the owner.

Save general settings with PATCH and schedules with the dedicated schedule PUT endpoint so independent editors cannot erase each other's fields. Keep stale-response guards and unsaved-change confirmations when changing data loading.

Use `AppLink` for internal navigation: the compiled Vinext Link namespace regression is documented in the control audit. Use `ConfirmationProvider` instead of native browser confirmation dialogs. Never store receipt capabilities, session tokens or runtime secrets in source or logs.

### Release verification

Build through the Sites plugin's `build-site.mjs`, then run `node --experimental-vm-modules scripts/check-client-navigation.mjs`. Package and publish with the supported Sites source workflow. After behavior changes, run `node scripts/verify-owner-schedule.mjs <site-url>` against an explicitly selected demo Site; it creates and resets only its own synthetic visitor. Review relevant desktop/mobile interactions separately.

Event-rental pricing and compatibility: [docs/rental-model.md](docs/rental-model.md).
