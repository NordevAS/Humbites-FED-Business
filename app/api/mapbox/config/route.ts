export const dynamic = 'force-dynamic';
/** Only a public Mapbox token may be sent to a browser. Never fall back to the server token. */
export function GET() {
  const value = process.env['MAPBOX_PUBLIC_TOKEN'] ?? '';
  const publicToken = value.startsWith('pk.') ? value : '';
  return Response.json(
    { publicToken },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
