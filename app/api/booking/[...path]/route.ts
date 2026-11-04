import { env } from 'cloudflare:workers';
import {
  handleShowcaseRequest,
  type ShowcaseEnvironment,
} from '@/lib/showcase/handler';
export const dynamic = 'force-dynamic';
async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handleShowcaseRequest(
    request,
    env as unknown as ShowcaseEnvironment,
    (await params).path.join('/'),
  );
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
