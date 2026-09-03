export const PDF_JPEG_IMAGE_MAX_BYTES = 1024 * 1024;
export const PDF_JPEG_IMAGE_MAX_DISPLAY_HEIGHT = 240;

const encoder = new TextEncoder();

function ascii(value) {
  return encoder.encode(value);
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function cleanString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDocumentId(value) {
  const id = cleanString(value, 128);
  return id && !/[\\/]/.test(id) && !/[\x00-\x1F\x7F]/.test(id) ? id : '';
}

function asArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  return null;
}

export function jpegBytes(value) {
  const buffer = asArrayBuffer(value);
  return buffer ? new Uint8Array(buffer) : new Uint8Array();
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validatePreparedJpegImage(image) {
  const eventId = safeDocumentId(image?.eventId);
  const width = image?.width;
  const height = image?.height;
  const sizeBytes = image?.sizeBytes;

  if (!(image?.arrayBuffer instanceof ArrayBuffer)) {
    throw new TypeError('Report image bytes are invalid.');
  }

  const bytes = new Uint8Array(image.arrayBuffer);
  if (!eventId) throw new TypeError('A valid report image event ID is required.');
  if (image?.mimeType !== 'image/jpeg') throw new TypeError('A normalized JPEG report image is required.');
  if (!positiveInteger(width) || !positiveInteger(height)) throw new TypeError('Report image dimensions are invalid.');
  if (!positiveInteger(sizeBytes) || !bytes.length || sizeBytes !== bytes.length) throw new TypeError('Report image size is invalid.');
  if (sizeBytes > PDF_JPEG_IMAGE_MAX_BYTES) throw new RangeError('Report image exceeds the PDF size limit.');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new TypeError('Report image must be a JPEG.');
  return {
    eventId,
    mimeType: 'image/jpeg',
    width,
    height,
    sizeBytes,
    bytes,
  };
}

export function buildJpegImageXObject(image) {
  const validated = validatePreparedJpegImage(image);
  return concatBytes([
    ascii(`<< /Type /XObject /Subtype /Image /Width ${validated.width} /Height ${validated.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${validated.bytes.length} >>\nstream\n`),
    validated.bytes,
    ascii('\nendstream'),
  ]);
}

export function fitJpegImageInBox(image, box) {
  const validated = validatePreparedJpegImage(image);
  const x = Number(box?.x);
  const y = Number(box?.y);
  const width = Number(box?.width);
  const height = Number(box?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new TypeError('A valid PDF image box is required.');
  }
  const scale = Math.min(width / validated.width, height / validated.height, PDF_JPEG_IMAGE_MAX_DISPLAY_HEIGHT / validated.height);
  const displayWidth = Math.max(0.01, validated.width * scale);
  const displayHeight = Math.max(0.01, validated.height * scale);
  return {
    x: x + (width - displayWidth) / 2,
    y: y + (height - displayHeight) / 2,
    width: displayWidth,
    height: displayHeight,
  };
}

export function jpegImageDrawCommand(resourceName, placement) {
  const name = cleanString(resourceName, 40).replace(/^\//, '');
  if (!/^Im\d+$/.test(name)) throw new TypeError('A valid PDF image resource name is required.');
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(Number(placement?.[key])) || Number(placement[key]) <= 0) {
      throw new TypeError('A valid PDF image placement is required.');
    }
  }
  return `q\n${Number(placement.width).toFixed(2)} 0 0 ${Number(placement.height).toFixed(2)} ${Number(placement.x).toFixed(2)} ${Number(placement.y).toFixed(2)} cm\n/${name} Do\nQ`;
}

export const __test__ = {
  concatBytes,
  safeDocumentId,
};
