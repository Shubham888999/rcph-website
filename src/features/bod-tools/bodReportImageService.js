const DEFAULT_BOD_REPORT_IMAGE_ENDPOINT = 'https://us-central1-rcph-admin.cloudfunctions.net/downloadBodReportImage';
const BOD_REPORT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BOD_REPORT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const BOD_REPORT_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

function envValue(name) {
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[name] : '';
}

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDocumentId(value, label = 'event') {
  const id = cleanString(value, 128);
  if (!id || /[\\/]/.test(id) || /[\x00-\x1F\x7F]/.test(id)) {
    throw new Error(`Choose a valid ${label}.`);
  }
  return id;
}

function normalizeEndpoint(value = envValue('VITE_BOD_REPORT_IMAGE_ENDPOINT')) {
  const candidate = cleanString(value, 700) || DEFAULT_BOD_REPORT_IMAGE_ENDPOINT;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudfunctions.net')) {
      return DEFAULT_BOD_REPORT_IMAGE_ENDPOINT;
    }
    if (!url.pathname.endsWith('/downloadBodReportImage')) {
      return DEFAULT_BOD_REPORT_IMAGE_ENDPOINT;
    }
    url.search = '';
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return DEFAULT_BOD_REPORT_IMAGE_ENDPOINT;
  }
}

function normalizeContentType(value) {
  return cleanString(value, 160).split(';')[0].trim().toLowerCase();
}

function contentLength(headers) {
  const raw = headers?.get?.('Content-Length') || headers?.get?.('content-length') || '';
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : -1;
}

async function defaultAuth() {
  const module = await import('../../app/firebase');
  return module.auth;
}

function safeFailureMessage(responsePayload) {
  const message = cleanString(responsePayload?.message, 200);
  return message || 'The BOD report image could not be downloaded.';
}

export async function fetchBodReportImageBytes(eventId, options = {}) {
  const safeEventId = safeDocumentId(eventId, 'event');
  const authInstance = options.authInstance || await defaultAuth();
  const currentUser = authInstance?.currentUser;
  if (!currentUser || typeof currentUser.getIdToken !== 'function') {
    throw new Error('An authenticated user is required.');
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Secure image download is unavailable.');

  const token = await currentUser.getIdToken();
  const url = new URL(normalizeEndpoint(options.endpoint));
  url.searchParams.set('eventId', safeEventId);

  const response = await fetchImpl(url.href, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: BOD_REPORT_IMAGE_ACCEPT,
    },
    cache: 'no-store',
    signal: options.signal,
  });

  if (!response?.ok) {
    const payload = await response?.json?.().catch(() => ({}));
    throw new Error(safeFailureMessage(payload));
  }

  const mimeType = normalizeContentType(response.headers?.get?.('Content-Type') || response.headers?.get?.('content-type'));
  if (!BOD_REPORT_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('The BOD report image response type is not supported.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const sizeBytes = Number(arrayBuffer?.byteLength || 0);
  const maxBytes = Number.isSafeInteger(options.maxBytes) ? options.maxBytes : BOD_REPORT_IMAGE_MAX_BYTES;
  if (!sizeBytes) throw new Error('The BOD report image response was empty.');
  if (sizeBytes > maxBytes) throw new Error('The BOD report image is too large.');

  const expectedLength = contentLength(response.headers);
  if (expectedLength !== null && expectedLength !== sizeBytes) {
    throw new Error('The BOD report image response size did not match.');
  }

  return {
    eventId: safeEventId,
    mimeType,
    sizeBytes,
    arrayBuffer,
  };
}

export const __test__ = {
  BOD_REPORT_IMAGE_ACCEPT,
  DEFAULT_BOD_REPORT_IMAGE_ENDPOINT,
  normalizeEndpoint,
};