'use client';
import Link from '@/components/AppLink';
import { useDemo } from '@/components/DemoProvider';
import { TruckProfile } from './TruckProfile';
import { BookingFlow } from '@/features/booking/BookingFlow';

export function TruckRoute({
  slug,
  booking = false,
}: {
  slug: string;
  booking?: boolean;
}) {
  const { catalogue, catalogueState, catalogueError, reloadCatalogue } =
    useDemo();
  if (catalogueState === 'loading')
    return (
      <main id="main" className="container service-page">
        <div className="service-state" role="status">
          Henter truck og meny …
        </div>
      </main>
    );
  if (catalogueState === 'error')
    return (
      <main id="main" className="container service-page">
        <div className="service-state" role="alert">
          <h1>Vi får ikke hentet trucken.</h1>
          <p>{catalogueError}</p>
          <button className="button button-primary" onClick={reloadCatalogue}>
            Prøv igjen
          </button>
        </div>
      </main>
    );
  const truck = catalogue.find((item) => item.slug === slug);
  if (!truck)
    return (
      <main id="main" className="container service-page">
        <h1>Denne trucken er ikke i utvalget.</h1>
        <p>Profilen kan ha blitt fjernet eller er ikke publisert ennå.</p>
        <Link className="button button-primary" href="/foodtrucks">
          Se utvalget
        </Link>
      </main>
    );
  if (
    booking &&
    (truck.fixedFeeMinor === null ||
      truck.booking?.enabled === false ||
      truck.booking?.configured === false ||
      !truck.menu.length)
  )
    return (
      <main id="main" className="container service-page">
        <h1>Trucken tar ikke imot forespørsler ennå.</h1>
        <p>Eieren må fullføre meny, priser og bookinginnstillinger først.</p>
        <Link className="button button-primary" href="/foodtrucks">
          Se andre trucks
        </Link>
      </main>
    );
  return booking ? (
    <BookingFlow truck={truck} />
  ) : (
    <TruckProfile truck={truck} />
  );
}
