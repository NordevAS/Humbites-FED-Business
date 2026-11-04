# Names for selected map points

Map clicks retain the exact selected longitude/latitude and immediately set a
coordinate fallback. A same-origin POST to `/api/places/reverse` asks for the
nearest official address within 100 metres. A successful label is prefixed
`Ved` (near), since it names a nearby address rather than moving the marker to it.
Missing addresses and provider errors keep the chosen point and explain the result.

The provider is Kartverket's open address service, not Mapbox Geocoding. Its
[official OpenAPI](https://ws.geonorge.no/adresser/v1/openapi.json) documents
`/punktsok`, distance ordering, `meterDistanseTilPunkt`, `radius`, result limits and
coordinate reference systems. We request one result in EPSG:4326 within 100 m.
The [Kartverket guide](https://www.kartverket.no/en/api-and-data/eiendomsdata/brukarrettleiing-adresse-api)
also describes point searches and field selection.

The [national data registry's publisher record](https://data.norge.no/nn/data-services/e329a3ba-ba66-3012-b518-ff45f089aeac/adresse-rest-api)
lists Creative Commons Attribution 4.0. Visible map copy credits Kartverket and
links to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These labels may
be persisted with event drafts; we do not mislabel them as permanently licensed
Mapbox geocoding or change their location source away from `map`.

Requests are same-origin, limited to numeric coordinates and 1 KiB input. The
provider target, radius and count are server-owned. Provider response size is
limited to 32 KiB and its request to seven seconds. The client has a nine-second
timeout. New clicks, typed locations, presets and unmount cancel the previous
lookup. A generation guard prevents ignored aborts from overwriting a later choice.

Tests cover real-shaped provider output, no match, invalid/distant/oversized
responses, network errors, input/origin rejection and late-response races.
No claim is made that an address confirms a foodtruck's actual availability.
