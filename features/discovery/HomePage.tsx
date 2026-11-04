'use client';
import Link from '@/components/AppLink';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';
import { EventSearch } from './EventSearch';

/** The landing page starts discovery; the catalogue has its own focused route. */
export function HomePage() {
  const { mode, showcase } = useDemo();
  return (
    <main id="main" className="pulse-home discovery-home">
      <section className="pulse-hero">
        <div className="container pulse-hero-inner">
          <div className="pulse-hero-copy">
            <span className="pulse-overline">
              <span aria-hidden="true">✳</span> FOODTRUCKS. FOLK. FEST.
            </span>
            <h1>
              Stor smak.
              <br />
              <em>Gode</em>
              <br />
              samlinger.
            </h1>
            <p>
              Inviter gjengen. Finn smaken. Gjør en helt vanlig samling til noe
              å snakke om.
            </p>
            <EventSearch variant="hero" />
            <span className="pulse-hero-footnote">
              Fra hagefest til firmafest. Hele Norge.
            </span>
          </div>
          <div className="pulse-hero-visual">
            <div className="pulse-photo-window">
              <img
                src="/images/hero-foodtruck.webp"
                alt="Konseptbilde av en foodtruck og mennesker som samles rundt maten"
                fetchPriority="high"
                width="920"
                height="650"
              />
              <span>ET LITE KJØKKEN. EN STOR OPPLEVELSE.</span>
            </div>
            <div className="pulse-stamp" aria-hidden="true">
              <Icon name="spark" size={29} />
              <strong>
                Mer mat.
                <br />
                Mer moro.
              </strong>
              <span>humbites.</span>
            </div>
            <span className="pulse-photo-caption">
              Illustrert matglede.
              {showcase || mode === 'demo' ? ' Fiktive trucks i demoen.' : ''}
            </span>
          </div>
        </div>
      </section>

      <div className="pulse-flavour-strip" aria-hidden="true">
        <span>GOD MAT</span>
        <i>✳</i>
        <span>GODE FOLK</span>
        <i>✳</i>
        <span>GODE ØYEBLIKK</span>
        <i>✳</i>
        <span>HUMBITES</span>
      </div>

      <section className="pulse-how" id="slik-fungerer-det">
        <div className="container">
          <div className="pulse-how-heading">
            <span className="eyebrow">
              PLANLEGG FESTEN. SMAK PÅ MULIGHETENE.
            </span>
            <h2>
              Mer samling.
              <br />
              <span>Mindre styr.</span>
            </h2>
            <p>
              Fra «vi burde finne på noe»
              <br />
              til en plan med skikkelig god mat.
            </p>
          </div>
          <div className="pulse-steps">
            {[
              {
                n: '01',
                title: 'Finn din smak.',
                text: 'Tacos, bao eller en skikkelig burger? Utforsk truckene og velg maten dere har lyst på.',
              },
              {
                n: '02',
                title: 'Gjør den til din.',
                text: 'Planlegg arrangementet og velg menyen. Leieprisen inkluderer transport og rigg; gjestene betaler maten sin selv.',
              },
              {
                n: '03',
                title: 'Samle gjengen.',
                text: 'Send en forespørsel. Eieren må godkjenne oppdraget før det blir en booking.',
              },
            ].map((step) => (
              <article key={step.n}>
                <span>{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <Icon name="arrow" size={25} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse-final container">
        <div className="pulse-final-image">
          <img
            src="/images/trucks/sol-salsa.webp"
            alt="Illustrasjon av fargerike tacos med lime og slaw"
            loading="lazy"
            width="600"
            height="480"
          />
          <span>
            ALLE GODE FESTER
            <br />
            TRENGER GOD MAT.
          </span>
        </div>
        <div>
          <span className="eyebrow">
            DET TRENGER IKKE VÆRE EN STOR ANLEDNING.
          </span>
          <h2>
            Bare en
            <br />
            god grunn
            <br />
            <em>til å samles.</em>
          </h2>
          <p>
            En bakgård. Et bryllup. En fredag med kollegene. Vi har en smakebit
            til alle.
          </p>
          <Link href="/foodtrucks" className="button button-primary">
            Finn deres foodtruck <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
