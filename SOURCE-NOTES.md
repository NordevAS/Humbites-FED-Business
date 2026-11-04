# Business dashboard demo source

Moved from `NordevAS/Humbites-FED` (`demos/sites-booking`) into
`NordevAS/Humbites-FED-Business` as a standalone application. This is the
interactive customer and owner booking demo, including the documented calendar
and simulated backend, common theme, version navigation and location/map
improvements.

Updated on 2026-10-31 with hero search and the dedicated `/foodtrucks` results route.
The implementation and query tests are in `features/discovery` and `tests/discovery.test.ts`.
Verified with TypeScript, 78 tests, and desktop/mobile browser checks for search,
favorites, categories, URL restoration, and profile navigation.

Install its own dependencies and follow its README. Local runtime state,
credentials and generated outputs are excluded. Hosted Site identity has been
removed: register a new Site before publishing this copy. The existing live
site was not changed by this export.
