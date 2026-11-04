import type { Metadata } from 'next';
import { DemoProvider } from '@/components/DemoProvider';
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
  title: { default: 'Humbites for bedrifter', template: '%s | Humbites' },
  description: 'Bedriftsdashboard for Humbites.',
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
            <ShowcaseBar />
            {children}
          </DemoProvider>
        </ConfirmationProvider>
      </body>
    </html>
  );
}
