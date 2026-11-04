# Menykategorier i bedriftsvisningen

Eieren kan opprette, gi nytt navn til og slette egne kategorier under **Meny**.
Retter kan tilordnes flere kategorier eller vises uten kategori. En kategori som
brukes av en rett, også en deaktivert rett, kan ikke slettes før retten er flyttet
eller tilordningen er fjernet. Et åpent menyutkast blokkerer også sletting av sine
valgte kategorier i brukergrensesnittet.

Kategorier tilhører en truck i den besøkendes demoøkt. Dette følger samme
eierkontroll og øktisolasjon som menyredigering. Det endrer ikke andre besøkendes
data. De eksisterende delte rettenes navn/pris følger fortsatt tidligere deling,
mens kategoritilordningen er lokal for hver truck. Når en rett knyttes til en
annen truck, starter den uten kategorier der.

## API og lagring

Under `owner/businesses/:businessId/trucks/:truckId`:

| Rute | Metode | Resultat |
| --- | --- | --- |
| `menu-categories` | GET | Truckens kategorier |
| `menu-categories` | POST `{name}` | Ny kategori, status 201 |
| `menu-categories/:id` | PATCH `{name}` | Oppdatert navn, samme ID |
| `menu-categories/:id` | DELETE | Status 204 eller 409 hvis kategorien brukes |
| `menu/:id` | PATCH `{categoryIds}` | Validerte kategorier for denne trucken |

Navn normaliseres med Unicode NFKC og sammenhengende mellomrom, er 1–60 tegn og
avviser kontrolltegn. Duplikater avvises uten hensyn til store/små bokstaver.
Det er maksimalt 30 kategorier per truck. Kategori-ID-er må være unike i
tilordningslisten og tilhøre den aktuelle trucken. Nye ID-er tildeles atomisk i
øktens eksisterende optimistiske transaksjon; parallelle opprettelser lager ikke
duplikater. GET-kall endrer ikke lagrede data.

`FoodTruck.menuCategories` beskriver kategoriene, og `MenuItem.categoryIds`
refererer til dem. `publicTrucks` inkluderer begge i den offentlige katalogen.
Feltene er valgfrie i domenet for kompatibilitet med eldre statiske demodata.

Gamle lagrede trucker uten `menuCategories` får den historiske kategorien
`{id: 1, name: 'Hovedrett'}` ved lesing. En eksplisitt tom liste betyr derimot
ingen kategorier og overskrives ikke med standardverdien. Eksisterende
tilordninger bevares. Dette krever ingen D1-skjemaendring eller nullstilling.

## Kode og kontroll

- `features/owner/CategoryManager.tsx` håndterer kategoriskjema og sletting.
- `features/owner/MenuEditor.tsx` håndterer rettens tilordninger og usparte utkast.
- `lib/showcase/service.ts` validerer og utfører atomiske endringer.
- `lib/showcase/store.ts` håndterer historisk standard og offentlig representasjon.
- `tests/menu-categories.test.ts` kontrollerer API-et mot SQLite: hele flyten,
  isolasjon, navn/ID-validering, parallelle endringer, historiske økter og delte retter.

I tillegg er oppretting, tilordning, blokkert sletting og navneendring testet mot
den lokale Workers-serveren, ikke bare gjennom Node-testene.
