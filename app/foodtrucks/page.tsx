import { Suspense } from 'react';
import { ResultsPage } from '@/features/discovery/ResultsPage';
export const metadata = { title: 'Finn foodtrucks' };
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="container">
          Henter utvalget …
        </main>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}
