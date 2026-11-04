import { env } from 'cloudflare:workers';
import { decorateCatalogue } from '@/lib/showcase-media/handler';
import {
  resolveShowcaseSession,
  publicTrucks,
  type ShowcaseDatabase,
} from './store';
import { BookingError } from './validation';
export async function getShowcaseCatalogue(request: Request) {
  const db = env.DB as unknown as ShowcaseDatabase;
  if (!db)
    throw new BookingError(
      'UNCONFIGURED',
      'Demodatabasen er ikke tilgjengelig.',
      503,
    );
  const session = await resolveShowcaseSession(request, db);
  if (!session)
    throw new BookingError('SESSION_EXPIRED', 'Start demoøkten først.', 401);
  return decorateCatalogue(db, session.id, publicTrucks(session.state));
}
