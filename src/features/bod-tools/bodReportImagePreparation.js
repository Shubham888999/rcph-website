import { fetchBodReportImageBytes } from './bodReportImageService.js';
import { normalizeBodReportImageForPdf } from './bodReportImageNormalization.js';

const DEFAULT_CONCURRENCY = 3;
const WARNING_CODE = 'report-image-unavailable';

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDocumentId(value) {
  const id = cleanString(value, 128);
  return id && !/[\\/]/.test(id) && !/[\x00-\x1F\x7F]/.test(id) ? id : '';
}

function hasSelectedReportImage(event) {
  return Boolean(safeDocumentId(event?.reportImageFileId));
}

function isEligibleSourceEvent(event) {
  return Boolean(
    event
    && safeDocumentId(event.id)
    && event.recordKind === 'clubEvent'
    && event.isActive === true
    && event.archived !== true
    && event.removed !== true
    && event.deleted !== true
    && hasSelectedReportImage(event)
  );
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    if (typeof DOMException === 'function') throw new DOMException('Report image preparation was aborted.', 'AbortError');
    const error = new Error('Report image preparation was aborted.');
    error.name = 'AbortError';
    throw error;
  }
}

function uniqueSafeIncludedIds(includedEventIds) {
  const ids = [];
  const seen = new Set();
  for (const value of Array.isArray(includedEventIds) || includedEventIds instanceof Set ? includedEventIds : []) {
    const id = safeDocumentId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function sourceEventMap(sourceEvents) {
  const map = new Map();
  for (const event of Array.isArray(sourceEvents) ? sourceEvents : []) {
    const id = safeDocumentId(event?.id);
    if (!id || map.has(id)) continue;
    map.set(id, event);
  }
  return map;
}

function boundedConcurrency(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return DEFAULT_CONCURRENCY;
  return Math.min(number, DEFAULT_CONCURRENCY);
}

export async function prepareBodReportImagesForPdf({
  sourceEvents = [],
  includedEventIds = [],
  signal,
  fetchImageBytes = fetchBodReportImageBytes,
  normalizeImage = normalizeBodReportImageForPdf,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  throwIfAborted(signal);
  if (typeof fetchImageBytes !== 'function') throw new TypeError('A report image fetch function is required.');
  if (typeof normalizeImage !== 'function') throw new TypeError('A report image normalization function is required.');

  const sources = sourceEventMap(sourceEvents);
  const candidates = uniqueSafeIncludedIds(includedEventIds).filter((eventId) => isEligibleSourceEvent(sources.get(eventId)));
  const imagesByEventId = new Map();
  const warnings = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      throwIfAborted(signal);
      const eventId = candidates[cursor];
      cursor += 1;
      try {
        const bytes = await fetchImageBytes(eventId, { signal });
        throwIfAborted(signal);
        const image = await normalizeImage(bytes, { signal });
        throwIfAborted(signal);
        if (safeDocumentId(image?.eventId) === eventId) imagesByEventId.set(eventId, image);
        else warnings.push({ eventId, code: WARNING_CODE });
      } catch (error) {
        if (isAbortError(error)) throw error;
        warnings.push({ eventId, code: WARNING_CODE });
      }
    }
  }

  const workerCount = Math.min(boundedConcurrency(concurrency), candidates.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { imagesByEventId, warnings };
}

export const __test__ = {
  DEFAULT_CONCURRENCY,
  WARNING_CODE,
  safeDocumentId,
};
