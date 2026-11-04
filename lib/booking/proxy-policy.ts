const id = '[A-Za-z0-9_-]{1,80}';
export type Target = {
  path: string;
  auth: 'public' | 'guest' | 'owner';
  bookingId?: string;
};
/** Every allowed operation is named here. No URL, host, query or arbitrary path is forwarded. */
export function resolveTarget(method: string, path: string): Target | null {
  if (method === 'GET' && path === 'payment-config')
    return { path: 'payments/config', auth: 'public' };
  if (method === 'POST' && path === 'quotes')
    return { path: 'bookings/quote', auth: 'guest' };
  if (method === 'POST' && path === 'requests')
    return { path: 'bookings', auth: 'guest' };
  const guest = path.match(
    new RegExp(`^requests/(${id})(?:/(cancel|payment))?$`),
  );
  if (
    guest &&
    ((!guest[2] && method === 'GET') ||
      (guest[2] === 'cancel' && method === 'POST') ||
      (guest[2] === 'payment' && ['GET', 'POST'].includes(method)))
  )
    return {
      path:
        guest[2] === 'payment'
          ? `payments/bookings/${guest[1]}`
          : `bookings/${guest[1]}${guest[2] ? '/cancel' : ''}`,
      auth: 'guest',
      bookingId: guest[1],
    };
  if (method === 'GET' && path === 'owner/businesses')
    return { path: 'me/businesses', auth: 'owner' };
  const media = path.match(
    /^owner\/businesses\/(\d+)\/trucks\/(\d+)\/media\/(images(?:\/\d+)?|menu\/\d+\/images|uploads\/[A-Za-z0-9_-]+\/complete)$/,
  );
  if (
    media &&
    ((media[3] === 'images' && ['GET', 'POST'].includes(method)) ||
      (/^images\/\d+$/.test(media[3]) && method === 'DELETE') ||
      ((media[3].startsWith('menu/') || media[3].startsWith('uploads/')) &&
        method === 'POST'))
  )
    return {
      path: `media/businesses/${media[1]}/foodtrucks/${media[2]}/${media[3]}`,
      auth: 'owner',
    };
  const payment = path.match(
    new RegExp(`^owner/payments/(${id})(?:/(capture|cancel|refund))?$`),
  );
  if (
    payment &&
    ((method === 'GET' && !payment[2]) || (method === 'POST' && payment[2]))
  )
    return {
      path: `payments/bookings/${payment[1]}${payment[2] ? `/${payment[2]}` : ''}`,
      auth: 'owner',
    };
  const owner = path.match(
    /^owner\/businesses\/(\d+)\/trucks(?:\/(\d+)(?:\/(bookings|booking-settings|menu|menu-options)(?:\/([A-Za-z0-9_-]+)(?:\/(accept|decline|cancel|assignment))?)?)?)?$/,
  );
  if (!owner) return null;
  const [, business, truck, section, item, action] = owner;
  const base = `me/businesses/${business}/foodtrucks${truck ? `/${truck}` : ''}`;
  if (!section && method === 'GET' && !truck)
    return { path: base, auth: 'owner' };
  if (
    section === 'bookings' &&
    ((method === 'GET' && !action) ||
      (method === 'POST' &&
        item &&
        ['accept', 'decline', 'cancel'].includes(action)))
  )
    return {
      path: `${base}/bookings${item ? `/${item}` : ''}${action ? `/${action}` : ''}`,
      auth: 'owner',
    };
  if (
    section === 'booking-settings' &&
    !item &&
    ['GET', 'PUT'].includes(method)
  )
    return { path: `${base}/booking-settings`, auth: 'owner' };
  if (section === 'menu-options' && method === 'GET' && !item)
    return { path: `${base}/menu-options`, auth: 'owner' };
  if (
    section === 'menu' &&
    ((['GET', 'POST'].includes(method) && !item) ||
      (item && !action && ['PATCH', 'DELETE'].includes(method)) ||
      (item && action === 'assignment' && method === 'PUT'))
  )
    return {
      path: `${base}/menu${item ? `/${item}` : ''}${action ? `/${action}` : ''}`,
      auth: 'owner',
    };
  return null;
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return (
    !!origin &&
    origin === new URL(request.url).origin &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  );
}
export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
export function guestCookie(id: string) {
  return `humbites_guest_${id}`;
}
export function permittedQuery(
  method: string,
  path: string,
  query: URLSearchParams,
): string | null {
  if (!query.size) return '';
  if (
    method !== 'GET' ||
    !/^owner\/businesses\/\d+\/trucks\/\d+\/bookings$/.test(path)
  )
    return null;
  for (const key of query.keys())
    if (
      !['page', 'limit', 'status'].includes(key) ||
      query.getAll(key).length !== 1
    )
      return null;
  const page = query.get('page'),
    limit = query.get('limit'),
    status = query.get('status');
  if (page && (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 9999))
    return null;
  if (
    limit &&
    (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
  )
    return null;
  if (
    status &&
    !['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'].includes(status)
  )
    return null;
  return `?${query.toString()}`;
}
