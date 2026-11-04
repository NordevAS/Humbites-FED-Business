import { searchAddressesRoute } from '@/lib/places/search';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return searchAddressesRoute(request);
}
