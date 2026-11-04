import { redirect } from 'next/navigation';
import Link from '@/components/AppLink';
export const metadata = {
  title: 'Tilbake fra Vipps',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string | string[] }>;
}) {
  const { bookingId } = await searchParams;
  if (
    typeof bookingId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  )
    redirect(`/kvittering/${bookingId}`);
  return (
    <main id="main" className="container service-page">
      <h1>Se betalingsstatus på kvitteringen.</h1>
      <p>
        Åpne den private kvitteringslenken du lagret. At du har kommet tilbake
        fra Vipps bekrefter ikke at betalingen er fullført.
      </p>
      <Link href="/" className="button button-primary">
        Til forsiden
      </Link>
    </main>
  );
}
