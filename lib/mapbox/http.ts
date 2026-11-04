import type { MapboxFailure } from './types';

const windows = new Map<string, { started: number; count: number }>();
export function takeRequestBudget(
  operation: string,
  now = Date.now(),
): boolean {
  const previous = windows.get(operation);
  if (!previous || now - previous.started >= 60000) {
    windows.set(operation, { started: now, count: 1 });
    return true;
  }
  if (previous.count >= 25) return false;
  previous.count += 1;
  return true;
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new Error('invalid-input');
  if (Number(request.headers.get('content-length')) > 4096)
    throw new Error('invalid-input');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid-input');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) {
        await reader.cancel();
        throw new Error('invalid-input');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const invalidInput = (): MapboxFailure => ({
  status: 'error',
  code: 'invalid-input',
  message: 'Kontroller stedet og prøv igjen.',
});
export const rateLimited = (): MapboxFailure => ({
  status: 'error',
  code: 'rate-limit',
  message: 'Vent et lite øyeblikk før du prøver igjen.',
});
export function mapResponse(
  result: { status: string; code?: string; message?: string },
  explicitStatus?: number,
): Response {
  const status =
    explicitStatus ??
    (result.status === 'unconfigured'
      ? 503
      : result.status === 'error'
        ? result.code === 'rate-limit'
          ? 429
          : 502
        : 200);
  return Response.json(result, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
    },
  });
}
