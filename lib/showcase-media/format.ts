export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

export class MediaError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const invalid = () =>
  new MediaError(
    400,
    'INVALID_IMAGE',
    'Velg et gyldig, statisk JPEG-, PNG- eller WebP-bilde.',
  );
const text = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));
const be16 = (b: Uint8Array, i: number) => b[i] * 256 + b[i + 1];
const be32 = (b: Uint8Array, i: number) =>
  b[i] * 16777216 + b[i + 1] * 65536 + b[i + 2] * 256 + b[i + 3];
const le24 = (b: Uint8Array, i: number) =>
  b[i] + b[i + 1] * 256 + b[i + 2] * 65536;
const le32 = (b: Uint8Array, i: number) => le24(b, i) + b[i + 3] * 16777216;

function dimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 12000 ||
    height > 12000 ||
    width * height > 40_000_000
  )
    throw invalid();
  return { width, height };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(bytes: Uint8Array) {
  if (bytes.length < 57 || text(bytes, 0, 8) !== '\x89PNG\r\n\x1a\n')
    throw invalid();
  let offset = 8,
    width = 0,
    height = 0,
    data = false,
    first = true;
  while (offset + 12 <= bytes.length) {
    const length = be32(bytes, offset),
      type = text(bytes, offset + 4, 4),
      end = offset + 12 + length;
    if (end > bytes.length || !/^[a-zA-Z]{4}$/.test(type)) throw invalid();
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== be32(bytes, end - 4))
      throw invalid();
    if (first && (type !== 'IHDR' || length !== 13)) throw invalid();
    if (type === 'IHDR') {
      if (!first) throw invalid();
      width = be32(bytes, offset + 8);
      height = be32(bytes, offset + 12);
      const depth = bytes[offset + 16],
        color = bytes[offset + 17];
      const depths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        !depths[color]?.includes(depth) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        bytes[offset + 20] > 1
      )
        throw invalid();
    }
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw invalid();
    if (type === 'IDAT' && length > 0) data = true;
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length || !data) throw invalid();
      return dimensions(width, height);
    }
    first = false;
    offset = end;
  }
  throw invalid();
}

function jpeg(bytes: Uint8Array) {
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw invalid();
  let offset = 2,
    width = 0,
    height = 0,
    scan = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!scan || offset !== bytes.length) throw invalid();
      return dimensions(width, height);
    }
    if (
      marker === 0 ||
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      offset + 2 > bytes.length
    )
      throw invalid();
    const length = be16(bytes, offset);
    if (length < 2 || offset + length > bytes.length) throw invalid();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 11 || width) throw invalid();
      height = be16(bytes, offset + 3);
      width = be16(bytes, offset + 5);
    } else if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    )
      throw invalid();
    offset += length;
    if (marker === 0xda) {
      if (!width || length < 6) throw invalid();
      scan = true;
      while (offset + 1 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        if (
          bytes[offset + 1] === 0 ||
          (bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7)
        ) {
          offset += 2;
          continue;
        }
        break;
      }
    }
  }
  throw invalid();
}

function webp(bytes: Uint8Array) {
  if (
    bytes.length < 25 ||
    text(bytes, 0, 4) !== 'RIFF' ||
    text(bytes, 8, 4) !== 'WEBP' ||
    le32(bytes, 4) + 8 !== bytes.length
  )
    throw invalid();
  let offset = 12,
    width = 0,
    height = 0,
    image = false,
    canvas: { width: number; height: number } | undefined;
  while (offset + 8 <= bytes.length) {
    const type = text(bytes, offset, 4),
      length = le32(bytes, offset + 4),
      start = offset + 8,
      end = start + length;
    if (end > bytes.length || ['ANIM', 'ANMF'].includes(type)) throw invalid();
    if (type === 'VP8X') {
      if (offset !== 12 || length !== 10 || bytes[start] & 0x02)
        throw invalid();
      canvas = dimensions(
        le24(bytes, start + 4) + 1,
        le24(bytes, start + 7) + 1,
      );
    }
    if (type === 'VP8 ') {
      if (
        image ||
        length < 10 ||
        bytes[start] & 1 ||
        text(bytes, start + 3, 3) !== '\x9d\x01\x2a'
      )
        throw invalid();
      width = (bytes[start + 6] | (bytes[start + 7] << 8)) & 0x3fff;
      height = (bytes[start + 8] | (bytes[start + 9] << 8)) & 0x3fff;
      image = true;
    }
    if (type === 'VP8L') {
      if (image || length < 5 || bytes[start] !== 0x2f || bytes[start + 4] >> 5)
        throw invalid();
      width = (bytes[start + 1] | ((bytes[start + 2] & 0x3f) << 8)) + 1;
      height =
        ((bytes[start + 2] >> 6) |
          (bytes[start + 3] << 2) |
          ((bytes[start + 4] & 0x0f) << 10)) +
        1;
      image = true;
    }
    offset = end + (length % 2);
  }
  if (
    offset !== bytes.length ||
    !image ||
    (canvas && (canvas.width !== width || canvas.height !== height))
  )
    throw invalid();
  return dimensions(width, height);
}

/** Structural format checks only: no full codec decode, transcoding, malware scan or metadata removal. */
export function inspectImage(bytes: Uint8Array, claimedMime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new MediaError(
      413,
      'IMAGE_SIZE',
      'Bildet må være mindre enn eller lik 5 MiB.',
    );
  const mime =
    bytes[0] === 0xff && bytes[1] === 0xd8
      ? 'image/jpeg'
      : bytes[0] === 0x89
        ? 'image/png'
        : text(bytes, 0, 4) === 'RIFF'
          ? 'image/webp'
          : '';
  if (!mime || claimedMime !== mime) throw invalid();
  return {
    mime: mime as ImageMime,
    ...(mime === 'image/png'
      ? png(bytes)
      : mime === 'image/jpeg'
        ? jpeg(bytes)
        : webp(bytes)),
  };
}

export async function readBounded(
  request: Request,
  maximum: number,
): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new MediaError(
      413,
      'BODY_TOO_LARGE',
      'Filen eller forespørselen er for stor.',
    );
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maximum) {
        await reader.cancel();
        throw new MediaError(
          413,
          'BODY_TOO_LARGE',
          'Filen eller forespørselen er for stor.',
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
