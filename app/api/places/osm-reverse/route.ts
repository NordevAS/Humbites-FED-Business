import { reverseOsmAddressRoute } from '@/lib/places/osm-search';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return reverseOsmAddressRoute(request);
}
