# Visitor-isolated demo images

This module uses the Site's `DB` (D1 metadata) and `BUCKET` (R2 objects) bindings. It has no vendor credentials, external URL fetcher or access to the original Humbites R2 account. The Site owner declares the bindings in `.openai/hosting.json`; `db/media-schema.ts` is included in the generated Drizzle migration.

## Browser contract

Start a demo session through the booking API and enter the owner demo first. The `humbites_showcase` HttpOnly cookie identifies the isolated sandbox. Every mutation must include the exact Site `Origin`; PUT also requires the returned `X-Upload-Token` header. Browser fetches use `credentials: 'same-origin'`. Returned upload URLs must match the page's HTTPS origin.

With base `/api/booking/owner/businesses/1/trucks/:truckId/media`:

| Request | Body / result |
| --- | --- |
| `POST /images` | `{contentType, contentLength}` → `201 {data:{id,uploadId,uploadToken,uploadUrl,headers,expiresAt,status}}` |
| `POST /menu/:itemId/images` | Same contract; the item must be assigned to that truck in this sandbox. |
| `PUT /api/showcase-media/:uploadId/upload` | Actual file bytes, returned headers including `Content-Type` and `X-Upload-Token`, session cookie and Origin → `204`. The URL contains no token. |
| `POST /uploads/:uploadId/complete` | `{uploadToken}` → `{data:{url,status:'COMPLETED'}}`. Repeating completion is safe. |
| `GET /images` | `{data:[{id,status,sortOrder,url}]}`. Pending records have `url:null`. |
| `GET /api/showcase-media/:id` | Completed image bytes, only with the same valid sandbox cookie. Owner role is unnecessary to view the image. |
| `DELETE /images/:id` | Removes a truck image or an uploaded menu image from this sandbox → `204`. |

No public bucket address or R2 object key is returned. Image responses set the verified raster MIME, `nosniff`, private/no-store caching, a restrictive CSP and same-origin resource policy. Uploaded images do not survive the demo sandbox expiry or reset. Another visitor cannot read, overwrite, complete or remove them. The original bundled example image remains the fallback after deletion.

## Limits and lifecycle

- Maximum **5 MiB per file**, exact declared/received byte count; JPEG, PNG and WebP only. SVG is rejected.
- At most **five truck images including pending reservations**, two records per menu item during replacement, eight unfinished records, 60 records and 50 MiB per sandbox. A global cap of 500 records bounds this showcase's admission. Quota reservation uses one atomic SQL statement, so simultaneous starts cannot bypass the limits.
- Staging expires after **10 minutes**, or sooner if the sandbox expires. Completed images expire with the sandbox (currently 24 hours). The API denies access immediately at expiry.
- PUT has a conditional state transition that rejects concurrent/repeated overwrites. A completed file is copied to a separate immutable key. Completion rechecks the current session role and truck/menu assignment. New menu photos replace older completed versions.
- Start/list operations run bounded cleanup: at most 20 expired database records and 25 timestamp-ordered objects in each staging/published prefix. This also reclaims orphan objects after a process stops between R2 and D1 writes. Cleanup is **opportunistic**, not a guaranteed wall-clock deletion job; an idle Site can retain inaccessible expired bytes until traffic resumes.
- Reset marks that sandbox's records expired before deleting its objects. Failed R2 deletion retains expired metadata for subsequent cleanup. In-flight writes cannot restore visibility after reset. The storage keys contain expiry timestamps, so orphaned bytes remain discoverable without their metadata.

## Validation limits

The Worker inspects PNG signature/chunk boundaries/CRCs, JPEG segment/scan framing, and WebP RIFF/chunk framing and image headers. It rejects animation, truncated framing, MIME mismatches and dimensions above 12,000 on either edge or 40 million pixels. Request-body reads are bounded even without a Content-Length header.

These are **structural format checks**, not a full image codec decode. The demo does not use Sharp, transcode, remove metadata or scan for malware. EXIF/location metadata can remain in an uploaded photo. This is intentionally a private, short-lived demo upload facility; it is not the production image-sanitization pipeline. Only upload sample files without sensitive metadata.

## Verification

`node node_modules/tsx/dist/cli.mjs --test tests/showcase-media-format.test.ts tests/showcase-media.test.ts` uses the generated SQL migrations in in-memory SQLite plus an in-process R2 adapter. Cases cover actual bundled PNG/WebP data, JPEG structural framing, corrupt/oversized content, no-Origin rejection, private staging, complete/read/delete, cross-sandbox isolation, menu replacement, atomic quota admission, concurrent PUTs, expiry/orphan cleanup, reset/write races and retryable storage outages.

These tests do not contact a hosted bucket. Actual hosted binding checks, if performed by the publishing owner, are recorded separately in the final publication report.
