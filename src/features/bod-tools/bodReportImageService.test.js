import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BOD_REPORT_IMAGE_MAX_BYTES,
  __test__,
  fetchBodReportImageBytes,
} from './bodReportImageService.js';

function bytesFor(mimeType) {
  if (mimeType === 'image/png') return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/webp') return new TextEncoder().encode('RIFFxxxxWEBP');
  return new Uint8Array([0xff, 0xd8, 0xff, 0x01]);
}

function arrayBufferFromBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function headers(values = {}) {
  const lower = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    get(name) {
      return lower[String(name || '').toLowerCase()] || null;
    },
  };
}

function response({ ok = true, status = 200, mimeType = 'image/jpeg', bytes = bytesFor(mimeType), contentLength = bytes.byteLength, payload = {} } = {}) {
  return {
    ok,
    status,
    headers: headers({
      'Content-Type': mimeType,
      ...(contentLength === null ? {} : { 'Content-Length': contentLength }),
    }),
    async arrayBuffer() {
      return arrayBufferFromBytes(bytes);
    },
    async json() {
      return payload;
    },
  };
}

function authInstance(token = 'id-token-1') {
  const calls = [];
  return {
    calls,
    currentUser: {
      async getIdToken() {
        calls.push('getIdToken');
        return token;
      },
    },
  };
}

function fetchRecorder(result = response()) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return result;
  };
  return { fetchImpl, calls };
}

async function request(options = {}) {
  const auth = options.auth || authInstance();
  const fetch = fetchRecorder(options.response || response());
  const result = await fetchBodReportImageBytes(options.eventId || 'event-1', {
    authInstance: auth,
    fetchImpl: fetch.fetchImpl,
    signal: options.signal,
    endpoint: options.endpoint,
    maxBytes: options.maxBytes,
  });
  return { result, auth, fetch };
}

test('authenticated request includes Bearer ID token at the secure endpoint', async () => {
  const { result, auth, fetch } = await request();
  assert.deepEqual(auth.calls, ['getIdToken']);
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].options.headers.Authorization, 'Bearer id-token-1');
  assert.equal(fetch.calls[0].options.headers.Accept, __test__.BOD_REPORT_IMAGE_ACCEPT);
  assert.equal(new URL(fetch.calls[0].url).origin + new URL(fetch.calls[0].url).pathname, __test__.DEFAULT_BOD_REPORT_IMAGE_ENDPOINT);
  assert.equal(result.eventId, 'event-1');
});

test('request includes only eventId and never sends fileId', async () => {
  const { fetch } = await request({ eventId: 'event-1' });
  const url = new URL(fetch.calls[0].url);
  assert.equal(url.searchParams.get('eventId'), 'event-1');
  assert.equal(url.searchParams.has('fileId'), false);
  assert.equal(fetch.calls[0].url.includes('fileId'), false);
});

test('successful JPEG PNG and WebP responses return normalized bytes', async () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
    const bytes = bytesFor(mimeType);
    const { result } = await request({ response: response({ mimeType, bytes }) });
    assert.equal(result.mimeType, mimeType);
    assert.equal(result.sizeBytes, bytes.byteLength);
    assert.equal(result.arrayBuffer.byteLength, bytes.byteLength);
  }
});

test('PDF and empty responses are rejected', async () => {
  await assert.rejects(
    () => request({ response: response({ mimeType: 'application/pdf', bytes: new TextEncoder().encode('%PDF') }) }),
    /response type is not supported/
  );
  await assert.rejects(
    () => request({ response: response({ bytes: new Uint8Array([]), contentLength: 0 }) }),
    /response was empty/
  );
});

test('oversized and Content-Length mismatch responses are rejected', async () => {
  await assert.rejects(
    () => request({ response: response({ bytes: bytesFor('image/jpeg') }), maxBytes: 2 }),
    /too large/
  );
  await assert.rejects(
    () => request({ response: response({ contentLength: 99 }) }),
    /size did not match/
  );
  assert.equal(BOD_REPORT_IMAGE_MAX_BYTES, 15 * 1024 * 1024);
});

test('non-2xx response becomes a concise safe error', async () => {
  await assert.rejects(
    () => request({ response: response({ ok: false, status: 412, payload: { message: 'No report image is selected for this event.' } }) }),
    /No report image is selected/
  );
  await assert.rejects(
    () => request({ response: response({ ok: false, status: 500, payload: {} }) }),
    /could not be downloaded/
  );
});

test('AbortSignal is forwarded to fetch', async () => {
  const controller = new AbortController();
  const { fetch } = await request({ signal: controller.signal });
  assert.equal(fetch.calls[0].options.signal, controller.signal);
});

test('unauthenticated user and malformed event IDs are rejected before fetch', async () => {
  const fetch = fetchRecorder();
  await assert.rejects(
    () => fetchBodReportImageBytes('event-1', { authInstance: { currentUser: null }, fetchImpl: fetch.fetchImpl }),
    /authenticated user/
  );
  await assert.rejects(
    () => fetchBodReportImageBytes('event/1', { authInstance: authInstance(), fetchImpl: fetch.fetchImpl }),
    /valid event/
  );
  assert.equal(fetch.calls.length, 0);
});

test('endpoint override remains constrained to the secure function', () => {
  assert.equal(
    __test__.normalizeEndpoint('https://us-central1-rcph-admin-staging-2.cloudfunctions.net/downloadBodReportImage'),
    'https://us-central1-rcph-admin-staging-2.cloudfunctions.net/downloadBodReportImage'
  );
  assert.equal(__test__.normalizeEndpoint('https://evil.example/downloadBodReportImage'), __test__.DEFAULT_BOD_REPORT_IMAGE_ENDPOINT);
  assert.equal(__test__.normalizeEndpoint('http://us-central1-rcph-admin.cloudfunctions.net/downloadBodReportImage'), __test__.DEFAULT_BOD_REPORT_IMAGE_ENDPOINT);
  assert.equal(__test__.normalizeEndpoint('https://us-central1-rcph-admin.cloudfunctions.net/other'), __test__.DEFAULT_BOD_REPORT_IMAGE_ENDPOINT);
});

test('helper does not create object URLs use Canvas or call PDF code', () => {
  const source = readFileSync(new URL('./bodReportImageService.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createObjectURL|revokeObjectURL|Canvas|createImageBitmap|FileReader|jsPDF|pdf/i);
});