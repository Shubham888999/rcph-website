import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOD_REPORT_IMAGE_MAX_BYTES } from './bodReportImageService.js';
import {
  BOD_REPORT_IMAGE_JPEG_QUALITY_STEPS,
  BOD_REPORT_IMAGE_MAX_DIMENSION_PASSES,
  BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES,
  BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE,
  BOD_REPORT_IMAGE_NORMALIZATION_TARGET_BYTES,
  __test__,
  calculateNormalizedImageDimensions,
  hasJpegSignature,
  normalizeBodReportImageForPdf,
} from './bodReportImageNormalization.js';

function bufferFromBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function bytes(size, signature = [0xff, 0xd8, 0xff]) {
  const result = new Uint8Array(size);
  result.set(signature.slice(0, Math.min(signature.length, size)));
  return result;
}

function imageInput({ mimeType = 'image/jpeg', sizeBytes = 8, eventId = 'event-1' } = {}) {
  return {
    eventId,
    mimeType,
    sizeBytes,
    arrayBuffer: bufferFromBytes(bytes(sizeBytes)),
  };
}

function makeAdapters({ width = 800, height = 600, outputSizes = [1200], signature = [0xff, 0xd8, 0xff], decodeFailure, encodeFailure } = {}) {
  const calls = { decode: [], close: 0, canvas: [], fill: [], draw: [], encode: [] };
  const source = { id: 'decoded-source' };
  return {
    calls,
    decodeImage(input, options) {
      calls.decode.push({ input, signal: options.signal });
      if (decodeFailure) throw decodeFailure;
      return {
        source,
        width,
        height,
        close() {
          calls.close += 1;
        },
      };
    },
    createCanvas(canvasWidth, canvasHeight) {
      const canvas = { width: canvasWidth, height: canvasHeight, id: `canvas-${calls.canvas.length}` };
      const context = {
        fillStyle: '',
        fillRect(x, y, fillWidth, fillHeight) {
          calls.fill.push({ x, y, width: fillWidth, height: fillHeight, fillStyle: this.fillStyle });
        },
        drawImage(drawSource, x, y, drawWidth, drawHeight) {
          calls.draw.push({ source: drawSource, x, y, width: drawWidth, height: drawHeight });
        },
      };
      calls.canvas.push({ width: canvasWidth, height: canvasHeight });
      return { canvas, context };
    },
    encodeCanvas(canvas, mimeType, quality, dimensions) {
      calls.encode.push({ canvas, mimeType, quality, dimensions });
      if (encodeFailure) throw encodeFailure;
      const size = outputSizes[Math.min(calls.encode.length - 1, outputSizes.length - 1)];
      return bufferFromBytes(bytes(size, signature));
    },
  };
}

async function normalize(options = {}) {
  const adapters = makeAdapters(options);
  const result = await normalizeBodReportImageForPdf(imageInput({ mimeType: options.mimeType }), adapters);
  return { result, adapters };
}

async function rejectsSafely(input, options = {}) {
  await assert.rejects(
    () => normalizeBodReportImageForPdf(input, options),
    (err) => err.message === __test__.SAFE_NORMALIZATION_ERROR && err.cause instanceof Error
  );
}

test('JPEG PNG and WebP inputs normalize to JPEG output with exact size metadata', async () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
    const { result } = await normalize({ mimeType, outputSizes: [4096] });
    assert.equal(result.eventId, 'event-1');
    assert.equal(result.originalMimeType, mimeType);
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.sizeBytes, result.arrayBuffer.byteLength);
    assert.equal(result.sizeBytes, 4096);
    assert.equal(hasJpegSignature(result.arrayBuffer), true);
  }
});

test('landscape portrait and small images resize without upscaling while preserving aspect ratio', async () => {
  assert.deepEqual(calculateNormalizedImageDimensions(2400, 1600, BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE), { width: 1200, height: 800 });
  assert.deepEqual(calculateNormalizedImageDimensions(1600, 2400, BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE), { width: 800, height: 1200 });
  assert.deepEqual(calculateNormalizedImageDimensions(800, 600, BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE), { width: 800, height: 600 });

  const landscape = await normalize({ width: 2400, height: 1600 });
  assert.deepEqual({ width: landscape.result.width, height: landscape.result.height }, { width: 1200, height: 800 });
  const portrait = await normalize({ width: 1600, height: 2400 });
  assert.deepEqual({ width: portrait.result.width, height: portrait.result.height }, { width: 800, height: 1200 });
  const small = await normalize({ width: 800, height: 600 });
  assert.deepEqual({ width: small.result.width, height: small.result.height }, { width: 800, height: 600 });
  assert.equal(landscape.result.width / landscape.result.height, 1.5);
});

test('transparent inputs are painted over white before drawing the decoded source', async () => {
  const { result, adapters } = await normalize({ mimeType: 'image/png', width: 100, height: 50 });
  assert.equal(result.mimeType, 'image/jpeg');
  assert.deepEqual(adapters.calls.fill[0], { x: 0, y: 0, width: 100, height: 50, fillStyle: '#ffffff' });
  assert.equal(adapters.calls.draw[0].source.id, 'decoded-source');
  assert.deepEqual(adapters.calls.draw[0], { source: adapters.calls.draw[0].source, x: 0, y: 0, width: 100, height: 50 });
});

test('JPEG encoding starts at quality 0.82 and returns immediately when below target', async () => {
  const { adapters } = await normalize({ outputSizes: [BOD_REPORT_IMAGE_NORMALIZATION_TARGET_BYTES - 1] });
  assert.deepEqual(adapters.calls.encode.map(call => call.quality), [0.82]);
  assert.equal(adapters.calls.encode[0].mimeType, 'image/jpeg');
});

test('oversized target result uses bounded quality reduction before accepting under hard max', async () => {
  const outputSizes = [900000, 850000, 820000, 790000, 780000, 760000];
  const { result, adapters } = await normalize({ outputSizes });
  assert.deepEqual(adapters.calls.encode.map(call => call.quality), BOD_REPORT_IMAGE_JPEG_QUALITY_STEPS);
  assert.equal(result.sizeBytes, 760000);
  assert.ok(result.sizeBytes <= BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES);
});

test('results above hard max trigger dimension reduction from the original decoded source', async () => {
  const tooLarge = BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES + 1;
  const outputSizes = [tooLarge, tooLarge, tooLarge, tooLarge, tooLarge, tooLarge, 700000];
  const { result, adapters } = await normalize({ width: 2400, height: 1600, outputSizes });
  assert.deepEqual({ width: result.width, height: result.height }, { width: 1020, height: 680 });
  assert.equal(adapters.calls.encode.length, 7);
  assert.equal(adapters.calls.draw.every(call => call.source.id === 'decoded-source'), true);
});

test('encoding attempts are bounded and hard max is enforced', async () => {
  const tooLarge = BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES + 1;
  const adapters = makeAdapters({ width: 4000, height: 3000, outputSizes: [tooLarge] });
  await rejectsSafely(imageInput(), adapters);
  assert.ok(adapters.calls.encode.length <= BOD_REPORT_IMAGE_MAX_DIMENSION_PASSES * BOD_REPORT_IMAGE_JPEG_QUALITY_STEPS.length);
  assert.equal(adapters.calls.encode.at(-1).dimensions.width >= 640, true);
});

test('output JPEG signature and non-empty encoder result are verified', async () => {
  await rejectsSafely(imageInput(), makeAdapters({ signature: [0x89, 0x50, 0x4e, 0x47], outputSizes: [100] }));
  await rejectsSafely(imageInput(), makeAdapters({ outputSizes: [0] }));
});

test('malformed decoded width and height are rejected and decoded resources are cleaned up', async () => {
  const badWidth = makeAdapters({ width: 0, height: 100 });
  await rejectsSafely(imageInput(), badWidth);
  assert.equal(badWidth.calls.close, 1);

  const badHeight = makeAdapters({ width: 100, height: 0 });
  await rejectsSafely(imageInput(), badHeight);
  assert.equal(badHeight.calls.close, 1);

  const good = makeAdapters();
  await normalizeBodReportImageForPdf(imageInput(), good);
  assert.equal(good.calls.close, 1);
});

test('unsupported MIME PDF empty bytes size mismatch oversize and malformed event IDs reject safely', async () => {
  await rejectsSafely(imageInput({ mimeType: 'image/gif' }), makeAdapters());
  await rejectsSafely(imageInput({ mimeType: 'application/pdf' }), makeAdapters());
  await rejectsSafely({ ...imageInput(), sizeBytes: 0, arrayBuffer: new ArrayBuffer(0) }, makeAdapters());
  await rejectsSafely({ ...imageInput(), sizeBytes: 99 }, makeAdapters());
  await rejectsSafely(imageInput({ sizeBytes: BOD_REPORT_IMAGE_MAX_BYTES + 1 }), makeAdapters());
  await rejectsSafely(imageInput({ eventId: 'event/1' }), makeAdapters());
});

test('report image size must be a positive safe integer without numeric coercion', async () => {
  const validArrayBuffer = bufferFromBytes(bytes(8));

  for (const sizeBytes of [
    '8',
    NaN,
    Infinity,
    -1,
    0,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await rejectsSafely({
      eventId: 'event-1',
      mimeType: 'image/jpeg',
      sizeBytes,
      arrayBuffer: validArrayBuffer,
    }, makeAdapters());
  }
});

test('already-aborted and between-stage abort signals are respected', async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(
    () => normalizeBodReportImageForPdf(imageInput(), { ...makeAdapters(), signal: alreadyAborted.signal }),
    (err) => err.name === 'AbortError'
  );

  const controller = new AbortController();
  const adapters = makeAdapters();
  const decodeImage = async (...args) => {
    const decoded = await adapters.decodeImage(...args);
    controller.abort();
    return decoded;
  };
  await assert.rejects(
    () => normalizeBodReportImageForPdf(imageInput(), { ...adapters, decodeImage, signal: controller.signal }),
    (err) => err.name === 'AbortError'
  );
  assert.equal(adapters.calls.encode.length, 0);
  assert.equal(adapters.calls.close, 1);
});

test('decoder and encoder failures become safe normalization errors', async () => {
  await rejectsSafely(imageInput(), makeAdapters({ decodeFailure: new Error('low level decode exploded') }));
  await rejectsSafely(imageInput(), makeAdapters({ encodeFailure: new Error('low level encode exploded') }));
});

test('default browser decoder requests source orientation from createImageBitmap and closes the bitmap', async () => {
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  const calls = [];
  let closed = 0;

  try {
    globalThis.createImageBitmap = async (blob, options) => {
      calls.push({ blobType: blob.type, options });
      return {
        width: 640,
        height: 480,
        close() {
          closed += 1;
        },
      };
    };
    const decoded = await __test__.defaultDecodeImage(imageInput({ mimeType: 'image/jpeg' }));
    assert.equal(decoded.width, 640);
    assert.equal(decoded.height, 480);
    assert.deepEqual(calls, [{ blobType: 'image/jpeg', options: { imageOrientation: 'from-image' } }]);
    decoded.close();
    assert.equal(closed, 1);
  } finally {
    globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});
test('object URL fallback revokes temporary URLs after use', async () => {
  const previousImage = globalThis.Image;
  const previousUrl = globalThis.URL;
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  const revoked = [];
  const created = [];

  class FakeImage {
    constructor() {
      this.naturalWidth = 321;
      this.naturalHeight = 123;
    }

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  try {
    globalThis.createImageBitmap = undefined;
    globalThis.Image = FakeImage;
    globalThis.URL = {
      createObjectURL() {
        const url = `blob:test-${created.length}`;
        created.push(url);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    };
    const decoded = await __test__.defaultDecodeImage(imageInput());
    assert.equal(decoded.width, 321);
    assert.equal(decoded.height, 123);
    assert.deepEqual(revoked, []);
    decoded.close();
    assert.deepEqual(revoked, created);
  } finally {
    globalThis.Image = previousImage;
    globalThis.URL = previousUrl;
    globalThis.createImageBitmap = previousCreateImageBitmap;
  }
});

test('small images are never upscaled even after compression resizing', async () => {
  const tooLarge = BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES + 1;
  const adapters = makeAdapters({ width: 800, height: 600, outputSizes: [tooLarge, tooLarge, tooLarge, tooLarge, tooLarge, tooLarge, 700000] });
  const result = await normalizeBodReportImageForPdf(imageInput(), adapters);
  assert.deepEqual(adapters.calls.encode.slice(0, 6).map(call => call.dimensions), Array(6).fill({ width: 800, height: 600 }));
  assert.deepEqual({ width: result.width, height: result.height }, { width: 680, height: 510 });
});

test('source has no Firebase network or PDF dependencies', () => {
  const source = readFileSync(new URL('./bodReportImageNormalization.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /firebase|auth|fetch|Firestore|reportImageFileId|Drive|downloadBodReportImage|bodAvenueReportPdf|bodSecretarialReportPdf|simplePdf|DCTDecode|jsPDF/i);
});