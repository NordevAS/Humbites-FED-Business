import type { MediaEnvironment } from '../../lib/showcase-media/storage';

/** In-process R2 port: no network, external bucket or persistent object storage. */
export function memoryBucket() {
  const objects = new Map<string, Uint8Array>();
  const hooks: {
    beforePut?: (key: string) => Promise<void>;
    beforeDelete?: () => Promise<void>;
  } = {};
  const bucket = {
    async put(key: string, value: Uint8Array) {
      await hooks.beforePut?.(key);
      objects.set(key, value.slice());
      return {};
    },
    async get(key: string) {
      const value = objects.get(key);
      if (!value) return null;
      return {
        size: value.length,
        body: new Blob([value.slice()]).stream(),
        async arrayBuffer() {
          return value.slice().buffer;
        },
      };
    },
    async delete(key: string | string[]) {
      await hooks.beforeDelete?.();
      for (const item of Array.isArray(key) ? key : [key]) objects.delete(item);
    },
    async list(options: { prefix: string; limit: number }) {
      return {
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(options.prefix))
          .sort()
          .slice(0, options.limit)
          .map((key) => ({ key })),
        truncated: false,
      };
    },
  };
  return {
    objects,
    hooks,
    bucket: bucket as unknown as MediaEnvironment['BUCKET'],
  };
}
