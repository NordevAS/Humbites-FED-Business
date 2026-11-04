import { env } from 'cloudflare:workers';
import type { NextRequest } from 'next/server';
import { isShowcase } from '@/lib/booking/showcase';
import {
  GET as bedGet,
  POST as bedPost,
  PUT as bedPut,
  PATCH as bedPatch,
  DELETE as bedDelete,
} from '@/lib/booking/native-route';
import {
  handleShowcaseRequest,
  type ShowcaseEnvironment,
} from '@/lib/showcase/handler';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ path: string[] }> };
const bedHandlers = {
  GET: bedGet,
  POST: bedPost,
  PUT: bedPut,
  PATCH: bedPatch,
  DELETE: bedDelete,
};
function route(method: keyof typeof bedHandlers) {
  return async (request: NextRequest, context: RouteContext) => {
    const path = (await context.params).path.join('/');
    // Owner credentials and dashboard data must always come from BED, even if
    // customer-facing showcase mode is enabled for a preview deployment.
    if (!isShowcase() || path.startsWith('owner/'))
      return bedHandlers[method](request, context);
    return handleShowcaseRequest(
      request,
      env as unknown as ShowcaseEnvironment,
      path,
    );
  };
}
export const GET = route('GET');
export const POST = route('POST');
export const PUT = route('PUT');
export const PATCH = route('PATCH');
export const DELETE = route('DELETE');
