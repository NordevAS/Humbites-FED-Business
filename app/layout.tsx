import { VersionNavigation } from '@/components/VersionNavigation';
import type { Metadata } from 'next';
import { DemoProvider } from '@/components/DemoProvider';
import { Header, Footer } from '@/components/SiteChrome';
import { ShowcaseBar } from '@/components/ShowcaseBar';
import { ConfirmationProvider } from '@/components/ConfirmationProvider';
import { isShowcase } from '@/lib/booking/showcase';
import { getMode } from '@/lib/booking/mode';
import './globals.css';
import './pulse.css';
import './booking-service.css';
import './showcase.css';
import './discovery.css';
import './theme.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ||
      'https://humbites-booking-demo.matiaspilnyh.chatgpt.site',
  ),
  title: {
    default: 'Humbites – stor smak. Gode samlinger.',
    template: '%s | Humbites',
  },
  description:
    'Prøv hele Humbites med fiktive foodtrucks, lagrede demoforespørsler, eierverktøy og simulert betaling.',
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'Humbites',
    title: 'Humbites – stor smak. Gode samlinger.',
    description:
      'Prøv kunde- og eierflyten i din egen Humbites-demo. Ingen ekte bestilling eller betaling.',
    url: '/',
    images: [
      {
        url: '/images/hero-foodtruck.webp',
        width: 1536,
        height: 1024,
        alt: 'Humbites-konsept: mennesker samles rundt maten',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Humbites – stor smak. Gode samlinger.',
    images: ['/images/hero-foodtruck.webp'],
  },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>
        <ConfirmationProvider>
          <DemoProvider
            mode={isShowcase() ? 'live' : getMode()}
            showcase={isShowcase()}
          >
            <a className="skip-link" href="#main">
              Hopp til innhold
            </a>
            <VersionNavigation current="booking" />
            <ShowcaseBar />
            <Header />
            {children}
            <Footer />
          </DemoProvider>
        </ConfirmationProvider>
      </body>
    </html>
  );
}
