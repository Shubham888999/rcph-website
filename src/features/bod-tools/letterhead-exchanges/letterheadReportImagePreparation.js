import { normalizeBodReportImageForPdf } from "../bodReportImageNormalization.js";
import { isLetterheadReportPhotoEligible, letterheadReportImageKey } from "./letterheadExchangeModel.js";

const DEFAULT_CONCURRENCY = 3;
const WARNING_CODE = "letterhead-report-image-unavailable";

function isAbortError(error) {
  return error?.name === "AbortError";
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (typeof DOMException === "function") throw new DOMException("Report image preparation was aborted.", "AbortError");
  const error = new Error("Report image preparation was aborted.");
  error.name = "AbortError";
  throw error;
}

export function letterheadReportPhotoCandidates(exchanges = []) {
  const seen = new Set();
  const candidates = [];
  for (const exchange of Array.isArray(exchanges) ? exchanges : []) {
    const key = letterheadReportImageKey(exchange?.id);
    if (!key || seen.has(key) || !isLetterheadReportPhotoEligible(exchange?.reportImage)) continue;
    seen.add(key);
    candidates.push({ exchangeId: exchange.id, key, reportImage: exchange.reportImage });
  }
  return candidates;
}

// Prepares each exchange's report photo with the same JPEG pipeline as event photos.
// Failures never block the report: the block renders without its photo and is reported.
// fetchImageBytes is injected (letterheadExchangeService.fetchLetterheadReportImageBytes in
// the app) so this module stays importable without Firebase.
export async function prepareLetterheadReportImagesForPdf({
  exchanges = [],
  signal,
  fetchImageBytes,
  normalizeImage = normalizeBodReportImageForPdf,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  throwIfAborted(signal);
  if (typeof fetchImageBytes !== "function") throw new TypeError("A report image fetch function is required.");
  if (typeof normalizeImage !== "function") throw new TypeError("A report image normalization function is required.");
  const candidates = letterheadReportPhotoCandidates(exchanges);
  const imagesByKey = new Map();
  const warnings = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      throwIfAborted(signal);
      const candidate = candidates[cursor];
      cursor += 1;
      try {
        const bytes = await fetchImageBytes(candidate.exchangeId, candidate.reportImage, { signal });
        throwIfAborted(signal);
        const image = await normalizeImage(bytes, { signal });
        throwIfAborted(signal);
        if (image?.eventId === candidate.key) imagesByKey.set(candidate.key, image);
        else warnings.push({ exchangeId: candidate.exchangeId, code: WARNING_CODE });
      } catch (error) {
        if (isAbortError(error)) throw error;
        warnings.push({ exchangeId: candidate.exchangeId, code: WARNING_CODE });
      }
    }
  }

  const limit = Math.max(1, Math.min(Number.isSafeInteger(concurrency) ? concurrency : DEFAULT_CONCURRENCY, DEFAULT_CONCURRENCY));
  await Promise.all(Array.from({ length: Math.min(limit, candidates.length) }, () => worker()));
  return { imagesByKey, warnings };
}

export const __test__ = { DEFAULT_CONCURRENCY, WARNING_CODE };
