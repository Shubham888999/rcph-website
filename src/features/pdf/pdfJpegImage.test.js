import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  PDF_JPEG_IMAGE_MAX_BYTES,
  buildJpegImageXObject,
  fitJpegImageInBox,
  jpegImageDrawCommand,
  validatePreparedJpegImage,
} from './pdfJpegImage.js';

function buffer(bytes) {
  return new Uint8Array(bytes).buffer;
}

function image(overrides = {}) {
  const bytes = overrides.arrayBuffer || buffer([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4]);
  return {
    eventId: 'event-1',
    mimeType: 'image/jpeg',
    width: 1200,
    height: 900,
    sizeBytes: bytes.byteLength,
    arrayBuffer: bytes,
    ...overrides,
  };
}

function decode(bytes) {
  return new TextDecoder('latin1').decode(bytes);
}

test('valid normalized JPEG is accepted', () => {
  const validated = validatePreparedJpegImage(image());
  assert.equal(validated.eventId, 'event-1');
  assert.equal(validated.bytes[0], 0xff);
});

test('invalid JPEG image metadata is rejected', () => {
  assert.throws(() => validatePreparedJpegImage(image({ eventId: 'bad/id' })), /event ID/i);
  assert.throws(() => validatePreparedJpegImage(image({ mimeType: 'image/png' })), /JPEG/i);
  assert.throws(() => validatePreparedJpegImage(image({ arrayBuffer: buffer([]), sizeBytes: 0 })), /size/i);
  assert.throws(() => validatePreparedJpegImage(image({ sizeBytes: 99 })), /size/i);
  assert.throws(() => validatePreparedJpegImage(image({ width: 0 })), /dimensions/i);
  assert.throws(() => validatePreparedJpegImage(image({ height: -1 })), /dimensions/i);
  assert.throws(() => validatePreparedJpegImage(image({ arrayBuffer: buffer([1, 2, 3]), sizeBytes: 3 })), /JPEG/i);
    assert.throws(
    () => validatePreparedJpegImage(image({ width: '1200' })),
    /dimensions/i
  );

  assert.throws(
    () => validatePreparedJpegImage(image({ height: '900' })),
    /dimensions/i
  );

  assert.throws(
    () => validatePreparedJpegImage(image({ sizeBytes: '8' })),
    /size/i
  );

  const typedBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4]);
  assert.throws(
    () => validatePreparedJpegImage(image({
      arrayBuffer: typedBytes,
      sizeBytes: typedBytes.byteLength,
    })),
    /bytes/i
  );
  const tooLarge = new Uint8Array(PDF_JPEG_IMAGE_MAX_BYTES + 1);
  tooLarge.set([0xff, 0xd8, 0xff]);
  assert.throws(() => validatePreparedJpegImage(image({ arrayBuffer: tooLarge.buffer, sizeBytes: tooLarge.byteLength })), /size limit/i);
});

test('JPEG XObject uses raw DCT bytes with RGB color and no base64', () => {
  const bytes = buildJpegImageXObject(image());
  const text = decode(bytes);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/ColorSpace \/DeviceRGB/);
  assert.match(text, /\/BitsPerComponent 8/);
  assert.match(text, /ÿØÿÛ/);
  assert.doesNotMatch(text, /base64|\/FlateDecode|ffd8ff/i);
});

test('landscape and portrait images fit with preserved aspect ratio inside padded boxes', () => {
  const landscape = fitJpegImageInBox(image({ width: 1200, height: 900 }), { x: 8, y: 9, width: 507, height: 240 });
  assert.equal(Number((landscape.width / landscape.height).toFixed(4)), Number((1200 / 900).toFixed(4)));
  assert.ok(landscape.width <= 507);
  assert.ok(landscape.height <= 240);
  assert.ok(landscape.x >= 8);

  const portrait = fitJpegImageInBox(image({ width: 900, height: 1200 }), { x: 8, y: 9, width: 507, height: 240 });
  assert.equal(Number((portrait.width / portrait.height).toFixed(4)), Number((900 / 1200).toFixed(4)));
  assert.ok(portrait.width <= 507);
  assert.ok(portrait.height <= 240);
  assert.ok(portrait.y >= 9);
});

test('draw command paints named image resource at placement', () => {
  assert.equal(
    jpegImageDrawCommand('/Im12', { x: 10, y: 20, width: 30, height: 40 }),
    'q\n30.00 0 0 40.00 10.00 20.00 cm\n/Im12 Do\nQ'
  );
  assert.throws(() => jpegImageDrawCommand('/BG', { x: 10, y: 20, width: 30, height: 40 }), /resource name/i);
  assert.throws(() => jpegImageDrawCommand('/Im1', { x: 0, y: 0, width: 0, height: 1 }), /placement/i);
});

test('PDF JPEG helper has no network, app, browser decode, or report-file coupling', () => {
  const source = readFileSync(new URL('./pdfJpegImage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch|Firebase|Firestore|auth|downloadBodReportImage|fetchBodReportImageBytes|normalizeBodReportImageForPdf|createImageBitmap|Canvas|reportImageFileId|Drive/i);
});
