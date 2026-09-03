import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  __test__,
  prepareBodReportImagesForPdf,
} from './bodReportImagePreparation.js';

const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]).buffer;

function event(id, overrides = {}) {
  return {
    id,
    recordKind: 'clubEvent',
    isActive: true,
    archived: false,
    reportImageFileId: `file-${id}`,
    ...overrides,
  };
}

function bodMeeting(id, overrides = {}) {
  return event(id, { recordKind: 'bodMeeting', ...overrides });
}

function makeAdapters(options = {}) {
  const calls = {
    fetch: [],
    normalize: [],
    active: 0,
    maxActive: 0,
  };
  const delays = [];
  const fetchImageBytes = async (eventId, fetchOptions) => {
    calls.fetch.push({ eventId, keys: Object.keys(fetchOptions || {}) });
    calls.active += 1;
    calls.maxActive = Math.max(calls.maxActive, calls.active);
    await new Promise((resolve) => delays.push(resolve));
    calls.active -= 1;
    if (options.failFetch?.has?.(eventId)) throw new Error(`Drive file ${eventId} failed`);
    return { eventId, mimeType: 'image/jpeg', sizeBytes: jpegBuffer.byteLength, arrayBuffer: jpegBuffer };
  };
  const normalizeImage = async (image, normalizeOptions) => {
    calls.normalize.push({ eventId: image.eventId, keys: Object.keys(normalizeOptions || {}) });
    if (options.failNormalize?.has?.(image.eventId)) throw new Error(`normalize stack ${image.eventId}`);
    return {
      eventId: options.mismatchedEventId?.get?.(image.eventId) || image.eventId,
      originalMimeType: image.mimeType,
      mimeType: 'image/jpeg',
      width: 4,
      height: 3,
      sizeBytes: image.arrayBuffer.byteLength,
      arrayBuffer: image.arrayBuffer,
    };
  };
  return { calls, delays, fetchImageBytes, normalizeImage };
}

async function drain(adapters) {
  await Promise.resolve();
  while (adapters.delays.length) adapters.delays.shift()();
  await Promise.resolve();
}

test('no included IDs and source events without selected images do not fetch', async () => {
  const adapters = makeAdapters();
  const empty = await prepareBodReportImagesForPdf({
    sourceEvents: [event('a')],
    includedEventIds: [],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  assert.equal(empty.imagesByEventId.size, 0);
  assert.equal(adapters.calls.fetch.length, 0);

  const missingSelection = await prepareBodReportImagesForPdf({
    sourceEvents: [event('a', { reportImageFileId: '' })],
    includedEventIds: ['a'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  assert.equal(missingSelection.imagesByEventId.size, 0);
  assert.equal(adapters.calls.fetch.length, 0);
});

test('selected club event image fetches by eventId and normalizes exactly once', async () => {
  const adapters = makeAdapters();
  const pending = prepareBodReportImagesForPdf({
    sourceEvents: [event('a')],
    includedEventIds: ['a'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  await drain(adapters);
  const result = await pending;
  assert.deepEqual(adapters.calls.fetch, [{ eventId: 'a', keys: ['signal'] }]);
  assert.deepEqual(adapters.calls.normalize.map((call) => call.eventId), ['a']);
  assert.equal(result.imagesByEventId.get('a').eventId, 'a');
});

test('duplicate included IDs and repeated avenue appearances prepare once', async () => {
  const adapters = makeAdapters();
  const pending = prepareBodReportImagesForPdf({
    sourceEvents: [event('multi')],
    includedEventIds: ['multi', 'multi', 'multi'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  await drain(adapters);
  const result = await pending;
  assert.equal(adapters.calls.fetch.length, 1);
  assert.equal(adapters.calls.normalize.length, 1);
  assert.equal(result.imagesByEventId.size, 1);
});

test('non-club records, meetings, inactive records, and invalid source IDs are skipped', async () => {
  const adapters = makeAdapters();
  const result = await prepareBodReportImagesForPdf({
    sourceEvents: [
      event('district', { recordKind: 'districtEvent' }),
      bodMeeting('bod'),
      event('inactive', { isActive: false }),
      event('archived', { archived: true }),
      event('bad/id'),
    ],
    includedEventIds: ['district', 'bod', 'inactive', 'archived', 'bad/id'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  assert.equal(result.imagesByEventId.size, 0);
  assert.equal(adapters.calls.fetch.length, 0);
});

test('one image failure leaves other images successful with safe warnings', async () => {
  const adapters = makeAdapters({ failFetch: new Set(['b']), failNormalize: new Set(['c']) });
  const pending = prepareBodReportImagesForPdf({
    sourceEvents: [event('a'), event('b'), event('c')],
    includedEventIds: ['a', 'b', 'c'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
    concurrency: 2,
  });
  await drain(adapters);
  await drain(adapters);
  const result = await pending;
  assert.deepEqual([...result.imagesByEventId.keys()], ['a']);
  assert.deepEqual(result.warnings, [
    { eventId: 'b', code: __test__.WARNING_CODE },
    { eventId: 'c', code: __test__.WARNING_CODE },
  ]);
  assert.equal(JSON.stringify(result.warnings).includes('Drive file'), false);
  assert.equal(JSON.stringify(result.warnings).includes('normalize stack'), false);
});

test('AbortError propagates instead of becoming an ordinary warning', async () => {
  const controller = new AbortController();
  const abort = new DOMException('stop now', 'AbortError');
  await assert.rejects(
    () => prepareBodReportImagesForPdf({
      sourceEvents: [event('a')],
      includedEventIds: ['a'],
      signal: controller.signal,
      fetchImageBytes: async () => { throw abort; },
      normalizeImage: async (image) => image,
    }),
    (error) => error.name === 'AbortError'
  );

  controller.abort();
  await assert.rejects(
    () => prepareBodReportImagesForPdf({
      sourceEvents: [event('a')],
      includedEventIds: ['a'],
      signal: controller.signal,
      fetchImageBytes: async () => {},
      normalizeImage: async (image) => image,
    }),
    (error) => error.name === 'AbortError'
  );
});

test('bounded concurrency never runs more than three image pipelines', async () => {
  let active = 0;
  let maxActive = 0;
  const calls = [];
  const fetchImageBytes = async (eventId) => {
    calls.push(eventId);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return { eventId, mimeType: 'image/jpeg', sizeBytes: jpegBuffer.byteLength, arrayBuffer: jpegBuffer };
  };
  const normalizeImage = async (image) => ({
    eventId: image.eventId,
    originalMimeType: image.mimeType,
    mimeType: 'image/jpeg',
    width: 4,
    height: 3,
    sizeBytes: image.arrayBuffer.byteLength,
    arrayBuffer: image.arrayBuffer,
  });
  const result = await prepareBodReportImagesForPdf({
    sourceEvents: [event('a'), event('b'), event('c'), event('d'), event('e')],
    includedEventIds: ['a', 'b', 'c', 'd', 'e'],
    fetchImageBytes,
    normalizeImage,
    concurrency: 99,
  });
  assert.deepEqual(calls.sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(maxActive, 3);
  assert.equal(result.imagesByEventId.size, 5);
});

test('mismatched normalized event ID produces a safe warning', async () => {
  const adapters = makeAdapters({ mismatchedEventId: new Map([['a', 'other']]) });
  const pending = prepareBodReportImagesForPdf({
    sourceEvents: [event('a')],
    includedEventIds: ['a'],
    fetchImageBytes: adapters.fetchImageBytes,
    normalizeImage: adapters.normalizeImage,
  });
  await drain(adapters);
  const result = await pending;
  assert.equal(result.imagesByEventId.size, 0);
  assert.deepEqual(result.warnings, [{ eventId: 'a', code: __test__.WARNING_CODE }]);
});

test('preparation source has no PDF, Firebase, Drive, or file-ID coupling', () => {
  const source = readFileSync(new URL('./bodReportImagePreparation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /pdfJpegImage|bodAvenueReportPdf|bodSecretarialReportPdf|Firebase|Firestore|auth|Drive|downloadBodReportImage|createImageBitmap|Canvas/i);
  assert.doesNotMatch(source, /fetchImageBytes\(.*reportImageFileId/s);
});
