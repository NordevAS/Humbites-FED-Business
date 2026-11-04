# Stedsforslag og strengt tjenesteområde

Oppdatert 2. november 2026. Gjelder de to interaktive hoveddemoene.

Stedsfeltet søker i Kartverkets åpne adresse-API for hele Norge, med 300 ms pause
etter inntasting, avbryting av gamle kall og beskyttelse mot sene svar. Det finnes
også seks tydelig merkede eksempelsteder: Oslo, Bergen, Trondheim, Stavanger,
Kristiansand og Tromsø sentrum. Disse vises umiddelbart og er tilgjengelige hvis
leverandøren er utilgjengelig. Feil fra leverandøren vises uttrykkelig; lokale
eksempler fremstilles aldri som et fullstendig adressesøk.

Piltaster velger et forslag, Enter bekrefter og Escape lukker. Å redigere teksten
fjerner tidligere koordinater. En adresse velges eksplisitt; å skrive et bynavn
velger ikke et tilfeldig adressepunkt. Adresseetiketten inkluderer gatenavn,
postnummer og poststed. Kunden kan også velge et nøyaktig kartpunkt.

`lib/places/search.ts` bruker kun det faste offisielle endepunktet
`https://api.kartverket.no/adresser/v1/sok`, høyst fem treff, EPSG:4326, begrenset
JSON-størrelse og sju sekunders tidsfrist. Den prøver siste ord som prefiks bare
dersom eksakt tokensøk er tomt. Ingen Mapbox-geokodingsdata kopieres eller lagres.
Kildehenvisningen er synlig ved feltet: © Kartverket, CC BY 4.0.
[Offisiell API-dokumentasjon](https://api.kartverket.no/adresser/v1/openapi.json),
[Kartverkets bruksvilkår](https://www.kartverket.no/api-og-data/vilkar-for-bruk).

Både adresse- og kartpunktoppslag bruker `api.kartverket.no` med
`redirect: 'manual'` og avviser alle svar uten vellykket HTTP-status, inkludert
omdirigeringer. Cloudflare Workers støtter ikke `redirect: 'error'`; det gir en
umiddelbar runtime-feil selv om Node-baserte tester lykkes. Ved endringer i
leverandørtransporten må begge `/api/places/search` og `/api/places/reverse`
derfor også prøves mot den lokale Workers-serveren. Verifisert 2. november 2026:
tre søk etter Hamar ga fem faktiske adresser hver, og kartpunktet 59.9139, 10.7522
ga «Ved Storgata 28B, 0184 OSLO», 5 meter fra valgt punkt. Kartets koordinat
endres aldri til adressens koordinat ved et slikt navneoppslag.

`features/discovery/places.ts` er registeret og oppslaget. Bare eksakte navn fra
registeret kan gjenopprettes fra eldre bylenker, for eksempel `?place=Trondheim`.
Nye skjemasøk med tekst uten valgt punkt merkes `unresolved=1`, så de forblir
uavklarte også etter navigasjon. Ukjent
fritekst gir en forklaring om å velge forslag/kartpunkt, ikke uverifiserte trucks.
Dato og antall gjester beholdes gjennom oppslaget. Et byforslag viser uttrykkelig
til et eksempelsted i sentrum og bekrefter ikke noen annen adresse i byen.

`features/discovery/service-area.ts` krever alle disse før en truck kan vises:

- Gyldige koordinater for valgt sted og truckens base.
- Konfigurert og aktiv booking.
- Positiv, endelig tjenesteradius som inkluderer valgt punkt.

Avstanden bruker samme Haversine-beregning og jordradius som serverens
tilgjengelighetskontroll. Radius betyr geometrisk avstand, ikke kjørelengde.
Mapbox Matrix er fortsatt reiseinformasjon, ikke en alternativ tjenestegrense.
Gjeste-, mat-, vegetar- og favorittfiltre virker innenfor dette utvalget. Når dato
er valgt brukes eksisterende serverkontroll for tid og kapasitet. Et område-treff
lover ikke ledig kapasitet; eieren må fremdeles godkjenne forespørselen.

Nye demoøkter starter med 150 km tjenesteradius per truck. Eksisterende lagrede
økter og egendefinerte eierinnstillinger migreres ikke. Eldre økter kan derfor
fortsatt ha 3000 km radius. De følger sin lagrede verdi til brukeren endrer den på
eiersiden eller selv tilbakestiller demoen. Den offentlige områdeetiketten viser
den faktiske lagrede radiusen. Ingen brukers data slettes automatisk.

Tester dekker byforslag, eksakte Trondheim-lenker, ukjent fritekst, manglende og
deaktivert konfigurasjon, ugyldig geometri, den eksakte servergrensen, lokal
standardradius og bevaring av tilpassede radiusverdier. Nettleserens faktiske
combobox- og kartinteraksjoner må i tillegg kontrolleres i visuell QA.
