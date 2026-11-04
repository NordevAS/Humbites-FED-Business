import Link from '@/components/AppLink';
export default function NotFound() {
  return (
    <main id="main" className="container empty-page">
      <span className="eyebrow">DENNE TOK EN OMVEI</span>
      <h1>Her var det tomt på menyen.</h1>
      <p>
        Vi finner ikke denne siden. De gode smakene er heldigvis like i
        nærheten.
      </p>
      <Link href="/" className="button button-primary">
        Tilbake til utvalget
      </Link>
    </main>
  );
}
