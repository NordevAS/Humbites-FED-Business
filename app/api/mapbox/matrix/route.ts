import { mapboxRoute } from '@/lib/mapbox/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return mapboxRoute(request, 'matrix');
}
