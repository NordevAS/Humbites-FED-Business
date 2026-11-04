import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  inspectImage,
  MAX_IMAGE_BYTES,
  MediaError,
  readBounded,
} from '../lib/showcase-media/format';

const png = new Uint8Array(
  readFileSync(new URL('../public/humbites-mark.png', import.meta.url)),
);
const webp = new Uint8Array(
  readFileSync(
    new URL('../public/images/trucks/sol-salsa.webp', import.meta.url),
  ),
);
test('checks actual PNG and WebP bytes from bundled assets, not filename or declared MIME', () => {
  assert.equal(inspectImage(png, 'image/png').mime, 'image/png');
  const photo = inspectImage(webp, 'image/webp');
  assert.ok(photo.width > 100 && photo.height > 100);
  assert.throws(() => inspectImage(png, 'image/jpeg'), MediaError);
  assert.throws(
    () =>
      inspectImage(
        new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
        'image/png',
      ),
    MediaError,
  );
});
test('rejects truncated files, corrupted PNG CRCs, trailing bytes and false WebP lengths', () => {
  assert.throws(() => inspectImage(png.slice(0, -1), 'image/png'), MediaError);
  const corrupt = png.slice();
  corrupt[30] ^= 1;
  assert.throws(() => inspectImage(corrupt, 'image/png'), MediaError);
  const trailing = new Uint8Array(png.length + 1);
  trailing.set(png);
  assert.throws(() => inspectImage(trailing, 'image/png'), MediaError);
  const falseLength = webp.slice();
  falseLength[4] ^= 1;
  assert.throws(() => inspectImage(falseLength, 'image/webp'), MediaError);
});
test('JPEG structural parser reads dimensions and rejects missing scan, truncation and excessive pixel area', () => {
  // A structural fixture, intentionally not a full codec-decode test.
  const jpeg = new Uint8Array([
    255, 216, 255, 192, 0, 11, 8, 0, 2, 0, 3, 1, 1, 17, 0, 255, 218, 0, 8, 1, 1,
    0, 0, 63, 0, 1, 255, 217,
  ]);
  assert.deepEqual(inspectImage(jpeg, 'image/jpeg'), {
    mime: 'image/jpeg',
    width: 3,
    height: 2,
  });
  assert.throws(
    () => inspectImage(jpeg.slice(0, -2), 'image/jpeg'),
    MediaError,
  );
  const huge = jpeg.slice();
  huge[7] = 0x30;
  huge[8] = 0;
  assert.throws(() => inspectImage(huge, 'image/jpeg'), MediaError);
});
test('rejects empty, oversized and falsely declared bodies; bounds stream reads even without content-length', async () => {
  assert.throws(() => inspectImage(new Uint8Array(), 'image/png'), MediaError);
  assert.throws(
    () => inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1), 'image/png'),
    MediaError,
  );
  await assert.rejects(
    readBounded(
      new Request('https://demo.example/upload', {
        method: 'PUT',
        headers: { 'content-length': '999' },
        body: 'ok',
      }),
      10,
    ),
    MediaError,
  );
  await assert.rejects(
    readBounded(
      new Request('https://demo.example/upload', {
        method: 'PUT',
        body: '12345678901',
      }),
      10,
    ),
    MediaError,
  );
  assert.equal(
    new TextDecoder().decode(
      await readBounded(
        new Request('https://demo.example/upload', {
          method: 'PUT',
          body: '1234567890',
        }),
        10,
      ),
    ),
    '1234567890',
  );
});
