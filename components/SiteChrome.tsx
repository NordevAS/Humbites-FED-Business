'use client';
import Link from '@/components/AppLink';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDemo } from './DemoProvider';
import { Icon } from './Icon';

export function Header() {
  const { mode, showcase, favorites, favoritesOnly, setFavoritesOnly } =
    useDemo();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  if (path === '/eier') return null;
  return (
    <header className="site-header pulse-header">
      <div className="header-inner">
        <Link
          href="/"
          className="wordmark"
          aria-label="Humbites hjem"
          onClick={() => {
            setFavoritesOnly(false);
            setOpen(false);
          }}
        >
          humbites<span className="brand-dot">.</span>
          <span className="pulse-brand-star" aria-hidden="true">
            ✳
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Hovedmeny">
          <Link
            href="/foodtrucks"
            className={path === '/foodtrucks' ? 'nav-active' : ''}
            onClick={() => setFavoritesOnly(false)}
          >
            Finn din smak
          </Link>
          <Link href="/#slik-fungerer-det">Slik fungerer det</Link>
        </nav>
        <div className="header-actions">
          <span className="demo-label">
            {showcase || mode === 'demo'
              ? 'Interaktiv demo'
              : 'Forespørsel og booking'}
          </span>
          <button
            className={`favorite-nav ${favoritesOnly ? 'is-active' : ''}`}
            onClick={() => {
              setFavoritesOnly(true);
              router.push('/foodtrucks');
            }}
            aria-label={`Vis favoritter, ${favorites.length} lagret`}
            aria-pressed={favoritesOnly}
          >
            <Icon name="heart" size={21} />
            {favorites.length > 0 && <b>{favorites.length}</b>}
          </button>
          <Link
            href="/foodtrucks"
            className="pulse-header-cta"
            onClick={() => setFavoritesOnly(false)}
          >
            Planlegg noe godt <Icon name="arrow" size={18} />
          </Link>
          <button
            className="mobile-menu icon-button"
            aria-label={open ? 'Lukk meny' : 'Åpne meny'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Mobilmeny">
          <Link
            href="/foodtrucks"
            onClick={() => {
              setFavoritesOnly(false);
              setOpen(false);
            }}
          >
            Finn din smak <Icon name="arrow" />
          </Link>
          <Link href="/#slik-fungerer-det" onClick={() => setOpen(false)}>
            Slik fungerer det <Icon name="arrow" />
          </Link>
          <Link href="/eier" onClick={() => setOpen(false)}>
            For truckeiere
          </Link>
          <span>
            {showcase || mode === 'demo'
              ? 'Demo · Ingenting sendes'
              : 'Forespørsler godkjennes av eieren'}
          </span>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { mode, showcase } = useDemo();
  const path = usePathname();
  if (path === '/eier') return null;
  if (path === '/foodtrucks')
    return (
      <footer className="results-footer container">
        Humbites · Gode smaker, hele Norge.{' '}
        <Link href="/eier">For truckeiere</Link>
      </footer>
    );
  return (
    <footer className="pulse-footer">
      <div className="container">
        <div className="pulse-footer-top">
          <p>
            Gode smaker.
            <br />
            Enda bedre sammen.
          </p>
          <div>
            <Link href="/foodtrucks">
              Finn din foodtruck <Icon name="arrow" size={20} />
            </Link>
            <Link href="/#slik-fungerer-det">
              Slik fungerer det <Icon name="arrow" size={20} />
            </Link>
          </div>
          <span className="pulse-footer-star" aria-hidden="true">
            ✳
          </span>
        </div>
        <Link
          href="/"
          className="pulse-footer-wordmark"
          aria-label="Humbites hjem"
        >
          humbites.
        </Link>
        <div className="pulse-footer-bottom">
          <span>En smakebit på Humbites.</span>
          <span>
            {showcase || mode === 'demo'
              ? 'Fiktive trucks, eksempelpriser og illustrasjonsbilder.'
              : 'Foodtrucks og gode samlinger.'}
          </span>
          <Link href="/eier">For truckeiere</Link>
          <span>Norge · NOK</span>
        </div>
      </div>
    </footer>
  );
}
