import type { EventLocation, FoodTruck } from '@/domain';

// Fictional catalogue. Coordinates illustrate city bases, not live vehicle locations.
export const foodTrucks: FoodTruck[] = [
  {
    id: 'sol-salsa',
    slug: 'sol-salsa',
    name: 'Sol & Salsa',
    cuisine: 'Tacos',
    city: 'Oslo',
    region: 'Østlandet',
    shortDescription: 'Små tortillas. Store smaker. Skikkelig god stemning.',
    description:
      'Fargerike tacos med grillet fyll, frisk lime og hjemmelaget salsa. Et uformelt samlingspunkt for sommerfesten, gårdsplassen eller en kveld med kollegaene. Sol & Salsa er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/sol-salsa.webp',
    imageAlt: 'Illustrasjon av tre tacos med fargerikt fyll og lime',
    coordinates: { longitude: 10.7522, latitude: 59.9139 },
    fixedFeeMinor: 190000,
    tags: ['Vegetarvalg', 'Friske smaker'],
    serviceAreaLabel:
      'Eksempelbase i Oslo · oppdrag på Østlandet avklares med eieren',
    practicalInfo: [
      'God adkomst og en plan oppstillingsplass avklares med eieren.',
      'Allergier og andre matbehov tas med i forespørselen.',
    ],
    menu: [
      {
        id: 'sol-chicken',
        name: 'Tacos med grillet kylling',
        description:
          'Tre maistortillas med grillet kylling, slaw, salsa og lime.',
        priceMinor: 16900,
        dietaryTags: [],
        allergens: ['Melk'],
      },
      {
        id: 'sol-mushroom',
        name: 'Tacos med grillet sopp',
        description:
          'Tre maistortillas med krydret sopp, avokado og syltet rødløk.',
        priceMinor: 15900,
        dietaryTags: ['Vegetar'],
        allergens: ['Melk'],
      },
      {
        id: 'sol-beans',
        name: 'Tacos med svarte bønner',
        description:
          'Tre maistortillas med svarte bønner, mais og frisk salsa.',
        priceMinor: 14900,
        dietaryTags: ['Vegansk'],
        allergens: [],
      },
    ],
  },
  {
    id: 'fjord-frites',
    slug: 'fjord-frites',
    name: 'Fjord & Frites',
    cuisine: 'Fisk',
    city: 'Bergen',
    region: 'Vestland',
    shortDescription: 'Sprø fisk, varme poteter og en frisk smak av kysten.',
    description:
      'Gylne fiskebiter og grove poteter med sitron, slaw og en raus skje urtedressing. En enkel meny med kystfølelse, servert rett fra luka. Fjord & Frites er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/fjord-frites.webp',
    imageAlt: 'Illustrasjon av sprø fisk med poteter, urter og sitron',
    coordinates: { longitude: 5.3221, latitude: 60.3913 },
    fixedFeeMinor: 220000,
    tags: ['Fra kysten', 'Vegetarvalg'],
    serviceAreaLabel:
      'Eksempelbase i Bergen · oppdrag i Vestland avklares med eieren',
    practicalInfo: [
      'Plassering og strømbehov avklares før et faktisk oppdrag.',
      'Oppgi gjerne ønsker om servering og allergier i merknadene.',
    ],
    menu: [
      {
        id: 'fjord-fish',
        name: 'Fish & frites',
        description: 'Sprø fisk, grove poteter, slaw og urtedressing.',
        priceMinor: 18900,
        dietaryTags: [],
        allergens: ['Fisk', 'Gluten', 'Egg', 'Melk'],
      },
      {
        id: 'fjord-halloumi',
        name: 'Sprø halloumi & frites',
        description: 'Gyllen halloumi med poteter, slaw og sitrondressing.',
        priceMinor: 17900,
        dietaryTags: ['Vegetar'],
        allergens: ['Melk', 'Gluten', 'Egg'],
      },
      {
        id: 'fjord-bowl',
        name: 'Kystbowl',
        description: 'Ovnsbakt fisk med poteter, grønne erter og friske urter.',
        priceMinor: 19500,
        dietaryTags: [],
        allergens: ['Fisk', 'Melk'],
      },
    ],
  },
  {
    id: 'glod-pizza',
    slug: 'glod-pizza',
    name: 'Glød Pizza',
    cuisine: 'Pizza',
    city: 'Trondheim',
    region: 'Trøndelag',
    shortDescription: 'Luftig bunn og sprø kant, rett fra den varme ovnen.',
    description:
      'Tomat, basilikum og den gode duften av nystekt pizza. Menyen holder det enkelt, med råvarer som får være seg selv. Glød Pizza er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/glod-pizza.webp',
    imageAlt: 'Illustrasjon av pizza med tomat, mozzarella og basilikum',
    coordinates: { longitude: 10.3951, latitude: 63.4305 },
    fixedFeeMinor: 250000,
    tags: ['Vedovnsstil', 'Vegetarvalg'],
    serviceAreaLabel:
      'Eksempelbase i Trondheim · oppdrag i Trøndelag avklares med eieren',
    practicalInfo: [
      'Oppstillingsplass og serveringsopplegg avtales med eieren.',
      'Én porsjon i demomenyen er én pizza.',
    ],
    menu: [
      {
        id: 'glod-margherita',
        name: 'Margherita',
        description: 'Tomatsaus, mozzarella og frisk basilikum.',
        priceMinor: 16900,
        dietaryTags: ['Vegetar'],
        allergens: ['Gluten', 'Melk'],
      },
      {
        id: 'glod-pepperoni',
        name: 'Pepperoni',
        description: 'Tomatsaus, mozzarella og krydret pepperoni.',
        priceMinor: 18900,
        dietaryTags: [],
        allergens: ['Gluten', 'Melk'],
      },
      {
        id: 'glod-mushroom',
        name: 'Sopp & urter',
        description: 'Hvit saus, stekt sopp, mozzarella og timian.',
        priceMinor: 17900,
        dietaryTags: ['Vegetar'],
        allergens: ['Gluten', 'Melk'],
      },
    ],
  },
  {
    id: 'bun-bal',
    slug: 'bun-bal',
    name: 'Bun & Bål',
    cuisine: 'Burger',
    city: 'Stavanger',
    region: 'Rogaland',
    shortDescription: 'Saftige burgere med stekeskorpe og alt det gode.',
    description:
      'Burgere med sprø kanter, mykt brød og syltet løk. Her er det lett å samles rundt en meny som både store og små kjenner. Bun & Bål er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/bun-bal.webp',
    imageAlt: 'Illustrasjon av en burger med ost, salat og poteter',
    coordinates: { longitude: 5.7331, latitude: 58.969 },
    fixedFeeMinor: 210000,
    tags: ['Klassikere', 'Vegetarvalg'],
    serviceAreaLabel:
      'Eksempelbase i Stavanger · oppdrag i Rogaland avklares med eieren',
    practicalInfo: [
      'Alle burgerporsjoner i demoen inkluderer poteter.',
      'Avklar adkomst, oppstilling og allergier med eieren.',
    ],
    menu: [
      {
        id: 'bun-classic',
        name: 'Klassisk smashburger',
        description:
          'Storfe, ost, salat, sylteagurk og husets dressing. Med poteter.',
        priceMinor: 18500,
        dietaryTags: [],
        allergens: ['Gluten', 'Melk', 'Egg', 'Sennep'],
      },
      {
        id: 'bun-chili',
        name: 'Chili & cheddar',
        description: 'Storfe, cheddar, jalapeño og chilimajones. Med poteter.',
        priceMinor: 19900,
        dietaryTags: [],
        allergens: ['Gluten', 'Melk', 'Egg'],
      },
      {
        id: 'bun-veggie',
        name: 'Grønn burger',
        description:
          'Bønneburger, sprø salat, syltet løk og urtedressing. Med poteter.',
        priceMinor: 17900,
        dietaryTags: ['Vegetar'],
        allergens: ['Gluten', 'Egg', 'Melk'],
      },
    ],
  },
  {
    id: 'gronn-gate',
    slug: 'gronn-gate',
    name: 'Grønn Gate',
    cuisine: 'Falafel',
    city: 'Kristiansand',
    region: 'Agder',
    shortDescription: 'Sprø falafel, myk pita og farger på hele tallerkenen.',
    description:
      'Grønne smaker med inspirasjon fra gatekjøkken rundt Middelhavet. Sprø falafel, kremet hummus og friske urter gjør det enkelt å velge plantebasert. Grønn Gate er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/gronn-gate.webp',
    imageAlt: 'Illustrasjon av pita med falafel, hummus og grønnsaker',
    coordinates: { longitude: 7.9956, latitude: 58.1467 },
    fixedFeeMinor: 180000,
    tags: ['Vegansk', 'Friske smaker'],
    serviceAreaLabel:
      'Eksempelbase i Kristiansand · oppdrag i Agder avklares med eieren',
    practicalInfo: [
      'Menyen er plantebasert i dette demoeksemplet.',
      'Be om avklaring av allergier; eksempellisten er ingen garanti.',
    ],
    menu: [
      {
        id: 'gronn-pita',
        name: 'Falafel i pita',
        description: 'Sprø falafel, hummus, rødkål, urter og tahinidressing.',
        priceMinor: 14900,
        dietaryTags: ['Vegansk'],
        allergens: ['Gluten', 'Sesam'],
      },
      {
        id: 'gronn-bowl',
        name: 'Grønn bowl',
        description:
          'Falafel, krydret ris, hummus og et raust utvalg grønnsaker.',
        priceMinor: 15900,
        dietaryTags: ['Vegansk'],
        allergens: ['Sesam'],
      },
      {
        id: 'gronn-aubergine',
        name: 'Aubergine i pita',
        description: 'Bakt aubergine, kikerter, frisk salat og tahini.',
        priceMinor: 15500,
        dietaryTags: ['Vegansk'],
        allergens: ['Gluten', 'Sesam'],
      },
    ],
  },
  {
    id: 'nord-bao',
    slug: 'nord-bao',
    name: 'Nord Bao',
    cuisine: 'Bao',
    city: 'Tromsø',
    region: 'Troms',
    shortDescription: 'Myke bao med fyldig smak og frisk, sprø topping.',
    description:
      'Dampede bao med varmt fyll, agurk, urter og sesam. Små smaksopplevelser som passer like godt til gårdsfest som til en kveld med laget. Nord Bao er et fiktivt konsept laget for Humbites-demoen.',
    image: '/images/trucks/nord-bao.webp',
    imageAlt: 'Illustrasjon av to bao med sopp, agurk og sesam',
    coordinates: { longitude: 18.9553, latitude: 69.6492 },
    fixedFeeMinor: 230000,
    tags: ['Vegetarvalg', 'Asiatiske smaker'],
    serviceAreaLabel:
      'Eksempelbase i Tromsø · oppdrag i Troms avklares med eieren',
    practicalInfo: [
      'Én porsjon i demomenyen består av to bao.',
      'Oppgi ønsker om servering, oppstilling og allergier i forespørselen.',
    ],
    menu: [
      {
        id: 'nord-mushroom',
        name: 'Bao med glasert sopp',
        description: 'To bao med sopp, agurk, syltet gulrot og sesam.',
        priceMinor: 16900,
        dietaryTags: ['Vegansk'],
        allergens: ['Gluten', 'Soya', 'Sesam'],
      },
      {
        id: 'nord-pork',
        name: 'Bao med langtidsstekt svin',
        description: 'To bao med mørt svin, slaw og hoisinsaus.',
        priceMinor: 18500,
        dietaryTags: [],
        allergens: ['Gluten', 'Soya', 'Sesam'],
      },
      {
        id: 'nord-chicken',
        name: 'Bao med sprø kylling',
        description: 'To bao med kylling, agurk og chilimajones.',
        priceMinor: 17900,
        dietaryTags: [],
        allergens: ['Gluten', 'Egg', 'Soya', 'Sesam'],
      },
    ],
  },
];

export function getFoodTruck(slug: string): FoodTruck | undefined {
  return foodTrucks.find((truck) => truck.slug === slug || truck.id === slug);
}

export const demoLocations: EventLocation[] = foodTrucks.map((truck) => ({
  label: `${truck.city} sentrum (eksempelsted)`,
  coordinates: { ...truck.coordinates },
  source: 'preset',
}));
