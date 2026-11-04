# Humbites Business Dashboard

This repository contains the business dashboard for managing food trucks,
incoming booking requests, schedules, menus, images, and business settings. The
root URL opens the dashboard at `/eier`. Customer facing catalogue, profile,
booking, receipt, and payment pages are not part of this application.

Set `BED_API_URL` to the BED origin without `/v1` and set `SHOWCASE_MODE=false`
to send dashboard API requests to BED. The server route keeps credentials
server-side and forwards only the explicitly allowlisted operations. `true`
keeps the isolated dashboard preview enabled.

BED endpoints needed by the dashboard that are absent or incomplete are listed
in [BED-INTEGRATION-GAPS.md](./BED-INTEGRATION-GAPS.md). No backend code is
changed in this repository.

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
