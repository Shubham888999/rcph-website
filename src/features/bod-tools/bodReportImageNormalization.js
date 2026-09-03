import { BOD_REPORT_IMAGE_MAX_BYTES } from './bodReportImageService.js';

export const BOD_REPORT_IMAGE_NORMALIZED_MIME_TYPE = 'image/jpeg';
export const BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE = 1200;
export const BOD_REPORT_IMAGE_NORMALIZATION_MIN_LONG_EDGE = 640;
export const BOD_REPORT_IMAGE_NORMALIZATION_TARGET_BYTES = 750 * 1024;
export const BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES = 1024 * 1024;
export const BOD_REPORT_IMAGE_JPEG_QUALITY_STEPS = Object.freeze([0.82, 0.76, 0.70, 0.64, 0.58, 0.52]);
export const BOD_REPORT_IMAGE_MAX_DIMENSION_PASSES = 6;

const SUPPORTED_INPUT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SAFE_NORMALIZATION_ERROR = 'The selected report image could not be prepared for the PDF.';
const RESIZE_FACTOR = 0.85;

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

function normalizeInputMimeType(value) {
  const mimeType = cleanString(value, 120).toLowerCase();
  if (!SUPPORTED_INPUT_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported report image type.');
  }
  return mimeType;
}

function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Image normalization was aborted.', 'AbortError');
  const err = new Error('Image normalization was aborted.');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function isAbortError(err) {
  return err?.name === 'AbortError';
}

function safeError(cause) {
  try {
    return new Error(SAFE_NORMALIZATION_ERROR, { cause });
  } catch {
    const err = new Error(SAFE_NORMALIZATION_ERROR);
    err.cause = cause;
    return err;
  }
}

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} is not valid.`);
  }
  return value;
}

function normalizeImageInput(image = {}) {
  const eventId = safeDocumentId(image.eventId, 'event');
  const mimeType = normalizeInputMimeType(image.mimeType);
  if (!(image.arrayBuffer instanceof ArrayBuffer) || image.arrayBuffer.byteLength <= 0) {
    throw new Error('Report image bytes are not valid.');
  }
  const sizeBytes = assertPositiveSafeInteger(image.sizeBytes, 'Report image size');
  if (sizeBytes !== image.arrayBuffer.byteLength) {
    throw new Error('Report image size does not match.');
  }
  if (sizeBytes > BOD_REPORT_IMAGE_MAX_BYTES) {
    throw new Error('Report image is too large.');
  }
  return {
    eventId,
    mimeType,
    sizeBytes,
    arrayBuffer: image.arrayBuffer,
  };
}

function normalizeDecodedImage(decoded = {}) {
  const width = Number(decoded.width);
  const height = Number(decoded.height);
  if (!Number.isSafeInteger(width) || width <= 0) throw new Error('Decoded report image width is not valid.');
  if (!Number.isSafeInteger(height) || height <= 0) throw new Error('Decoded report image height is not valid.');
  const source = decoded.source || decoded.image || decoded;
  return { source, width, height, close: decoded.close };
}

export function calculateNormalizedImageDimensions(width, height, maxLongEdge = BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE) {
  const sourceWidth = assertPositiveSafeInteger(Number(width), 'Image width');
  const sourceHeight = assertPositiveSafeInteger(Number(height), 'Image height');
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const maxEdge = assertPositiveSafeInteger(Number(maxLongEdge), 'Maximum image edge');
  const scale = Math.min(1, maxEdge / longEdge);
  return {
    width: Math.max(1, Math.floor(sourceWidth * scale)),
    height: Math.max(1, Math.floor(sourceHeight * scale)),
  };
}

export function hasJpegSignature(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 3) return false;
  const bytes = new Uint8Array(arrayBuffer, 0, 3);
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function nextLongEdgeLimit(currentMaxLongEdge, originalLongEdge) {
  if (originalLongEdge <= BOD_REPORT_IMAGE_NORMALIZATION_MIN_LONG_EDGE) return null;
  const currentEffectiveEdge = Math.min(currentMaxLongEdge, originalLongEdge);
  const nextEdge = Math.max(
    BOD_REPORT_IMAGE_NORMALIZATION_MIN_LONG_EDGE,
    Math.floor(currentEffectiveEdge * RESIZE_FACTOR)
  );
  return nextEdge < currentEffectiveEdge ? nextEdge : null;
}

function createCanvasSurface(width, height, createCanvas) {
  const surface = createCanvas(width, height);
  const canvas = surface?.canvas || surface;
  const context = surface?.context || surface?.ctx || canvas?.getContext?.('2d');
  if (!canvas || !context) throw new Error('Canvas is unavailable.');
  canvas.width = width;
  canvas.height = height;
  return { canvas, context };
}

function paintSourceToCanvas(decoded, dimensions, createCanvas) {
  const { canvas, context } = createCanvasSurface(dimensions.width, dimensions.height, createCanvas);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);
  return canvas;
}

async function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  if (value && typeof value.arrayBuffer === 'function') return value.arrayBuffer();
  throw new Error('JPEG encoder did not return bytes.');
}

function verifyOutput(arrayBuffer, dimensions) {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength <= 0) {
    throw new Error('Prepared report image bytes are not valid.');
  }
  if (arrayBuffer.byteLength > BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES) {
    throw new Error('Prepared report image is too large.');
  }
  assertPositiveSafeInteger(dimensions.width, 'Prepared image width');
  assertPositiveSafeInteger(dimensions.height, 'Prepared image height');
  if (!hasJpegSignature(arrayBuffer)) {
    throw new Error('Prepared report image is not a JPEG.');
  }
}

async function defaultDecodeImage({ arrayBuffer, mimeType }) {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  if (typeof globalThis.createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await globalThis.createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await globalThis.createImageBitmap(blob);
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close() {
        bitmap.close?.();
      },
    };
  }

  if (typeof globalThis.Image !== 'function' || !globalThis.URL?.createObjectURL || !globalThis.URL?.revokeObjectURL) {
    throw new Error('Browser image decoding is unavailable.');
  }

  const url = globalThis.URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new globalThis.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Browser image decoding failed.'));
      img.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close() {
        globalThis.URL.revokeObjectURL(url);
      },
    };
  } catch (err) {
    globalThis.URL.revokeObjectURL(url);
    throw err;
  }
}

function defaultCreateCanvas(width, height) {
  const canvas = globalThis.document?.createElement?.('canvas');
  if (!canvas) throw new Error('Browser canvas is unavailable.');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser canvas context is unavailable.');
  return { canvas, context };
}

async function defaultEncodeCanvas(canvas, mimeType, quality) {
  if (typeof canvas?.toBlob !== 'function') throw new Error('Browser JPEG encoding is unavailable.');
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Browser JPEG encoding failed.'));
    }, mimeType, quality);
  });
  return blob.arrayBuffer();
}

async function normalizeWithAdapters(image, options) {
  throwIfAborted(options.signal);
  const input = normalizeImageInput(image);
  const decodeImage = options.decodeImage || defaultDecodeImage;
  const createCanvas = options.createCanvas || defaultCreateCanvas;
  const encodeCanvas = options.encodeCanvas || defaultEncodeCanvas;
  const qualitySteps = options.qualitySteps || BOD_REPORT_IMAGE_JPEG_QUALITY_STEPS;
  const maxLongEdge = Number.isSafeInteger(options.maxLongEdge)
    ? options.maxLongEdge
    : BOD_REPORT_IMAGE_NORMALIZATION_MAX_LONG_EDGE;
  let decoded;

  try {
    throwIfAborted(options.signal);
    const rawDecoded = await decodeImage(input, options);
    decoded = rawDecoded;
    decoded = normalizeDecodedImage(rawDecoded);
    throwIfAborted(options.signal);

    let currentMaxLongEdge = maxLongEdge;
    const originalLongEdge = Math.max(decoded.width, decoded.height);

    for (let pass = 0; pass < BOD_REPORT_IMAGE_MAX_DIMENSION_PASSES; pass += 1) {
      throwIfAborted(options.signal);
      const dimensions = calculateNormalizedImageDimensions(decoded.width, decoded.height, currentMaxLongEdge);
      let lastOutput = null;

      for (const quality of qualitySteps) {
        throwIfAborted(options.signal);
        const canvas = paintSourceToCanvas(decoded, dimensions, createCanvas);
        const output = await toArrayBuffer(await encodeCanvas(canvas, BOD_REPORT_IMAGE_NORMALIZED_MIME_TYPE, quality, dimensions));
        lastOutput = output;
        if (output.byteLength <= BOD_REPORT_IMAGE_NORMALIZATION_TARGET_BYTES) {
          verifyOutput(output, dimensions);
          return {
            eventId: input.eventId,
            originalMimeType: input.mimeType,
            mimeType: BOD_REPORT_IMAGE_NORMALIZED_MIME_TYPE,
            width: dimensions.width,
            height: dimensions.height,
            sizeBytes: output.byteLength,
            arrayBuffer: output,
          };
        }
      }

      if (lastOutput?.byteLength <= BOD_REPORT_IMAGE_NORMALIZATION_HARD_MAX_BYTES) {
        verifyOutput(lastOutput, dimensions);
        return {
          eventId: input.eventId,
          originalMimeType: input.mimeType,
          mimeType: BOD_REPORT_IMAGE_NORMALIZED_MIME_TYPE,
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: lastOutput.byteLength,
          arrayBuffer: lastOutput,
        };
      }

      const nextMaxLongEdge = nextLongEdgeLimit(currentMaxLongEdge, originalLongEdge);
      if (!nextMaxLongEdge || nextMaxLongEdge === currentMaxLongEdge) break;
      currentMaxLongEdge = nextMaxLongEdge;
    }

    throw new Error('Prepared report image remained too large.');
  } finally {
    decoded?.close?.();
  }
}

export async function normalizeBodReportImageForPdf(image, options = {}) {
  try {
    return await normalizeWithAdapters(image, options);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw safeError(err);
  }
}

export const __test__ = {
  SAFE_NORMALIZATION_ERROR,
  defaultDecodeImage,
  nextLongEdgeLimit,
  safeDocumentId,
};