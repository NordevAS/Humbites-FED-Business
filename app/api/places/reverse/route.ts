import { reversePlaceRoute } from '@/lib/places/reverse';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return reversePlaceRoute(request);
}
