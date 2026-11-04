# Humbites Business Dashboard

This repository contains the business dashboard for managing food trucks,
incoming booking requests, schedules, menus, images, and business settings. The
root URL opens the dashboard at `/eier`. Customer facing catalogue, profile,
booking, receipt, and payment pages are not part of this application.

The dashboard currently uses the booking API client in `lib/booking/`. The
business frontend is intended to connect to Humbites-BED for its business and
booking data.

## Development

The project uses Node 22.13+ and pnpm 11.25.

```sh
pnpm install
pnpm dev
```

Useful checks:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

## Project map

- `app/eier/`: business dashboard route.
- `features/owner/`: dashboard, schedule, menu, image, and settings workflows.
- `lib/booking/`: API client, shared types, and payment state handling.
- `lib/showcase/`: isolated demo data and handlers used by the current preview.
- `db/` and `drizzle/`: database schema and migration.

Keep credentials out of source and public assets. Money is represented in
integer øre. Preserve server-side validation and the dashboard's unsaved-change
and stale-response protections when changing API integrations.
