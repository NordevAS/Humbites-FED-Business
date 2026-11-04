import Link from '@/components/AppLink';
export default function NotFound() {
  return (
    <main id="main" className="container empty-page">
      <span className="eyebrow">SIDEN FINNES IKKE</span>
      <h1>Vi fant ikke denne siden.</h1>
      <p>Gå tilbake til bedriftsdashboardet.</p>
      <Link href="/" className="button button-primary">
        Åpne dashboardet
      </Link>
    </main>
  );
}
