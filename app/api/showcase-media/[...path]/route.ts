import { env } from 'cloudflare:workers';
import { handleMediaAsset, mediaError } from '@/lib/showcase-media/handler';
import { resolveShowcaseSession } from '@/lib/showcase/store';
import { MediaError } from '@/lib/showcase-media/format';

async function dispatch(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!env.DB || !env.BUCKET)
      throw new MediaError(
        503,
        'MEDIA_UNAVAILABLE',
        'Bildelagring er ikke konfigurert.',
      );
    const session = await resolveShowcaseSession(request, env.DB);
    return handleMediaAsset(
      request,
      { DB: env.DB, BUCKET: env.BUCKET },
      session,
      (await context.params).path,
    );
  } catch (error) {
    return mediaError(error);
  }
}
export const GET = dispatch;
export const PUT = dispatch;
