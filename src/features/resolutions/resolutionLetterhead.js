export const RESOLUTION_LETTERHEAD_URL = "/images/resolution_letterhead.png";
export const RESOLUTION_OFFICIAL_LETTERHEAD_URL = "/images/RCPH_BOD_Avenue_Report_Letterhead_A4.png";
export const RESOLUTION_LETTERHEAD_JPEG_QUALITY = 0.97;

const USER_MESSAGE = "The Resolution letterhead could not be loaded. Please try again.";
let cachedLetterheadPromise = null;
let cachedOfficialLetterheadPromise = null;

function bytesFromDataUrl(value) {
  const encoded = String(value || "").split(",")[1] || "";
  if (!encoded || typeof globalThis.atob !== "function") throw new Error("JPEG data URL conversion is unavailable.");
  const binary = globalThis.atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function loadHtmlImage(blob) {
  if (typeof globalThis.Image !== "function" || !globalThis.URL?.createObjectURL) {
    throw new Error("Browser image decoding is unavailable.");
  }
  return new Promise((resolve, reject) => {
    const url = globalThis.URL.createObjectURL(blob);
    const image = new globalThis.Image();
    image.onload = () => {
      globalThis.URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      globalThis.URL.revokeObjectURL(url);
      reject(new Error("The Resolution letterhead image could not be decoded."));
    };
    image.src = url;
  });
}

async function decodeImage(blob) {
  if (typeof globalThis.createImageBitmap === "function") return globalThis.createImageBitmap(blob);
  return loadHtmlImage(blob);
}

function createCanvas(width, height) {
  if (!globalThis.document?.createElement) throw new Error("Browser canvas APIs are unavailable.");
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToJpegBlob(canvas, quality) {
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("JPEG conversion returned no data.")),
      "image/jpeg",
      quality,
    ));
  }
  if (typeof canvas.toDataURL === "function") {
    return Promise.resolve(new Blob([bytesFromDataUrl(canvas.toDataURL("image/jpeg", quality))], { type: "image/jpeg" }));
  }
  throw new Error("Browser JPEG encoding is unavailable.");
}

export async function convertResolutionLetterheadBlobToJpeg(blob, options = {}) {
  const decoder = options.decodeImage || decodeImage;
  const canvasFactory = options.createCanvas || createCanvas;
  const jpegEncoder = options.encodeJpeg || canvasToJpegBlob;
  const image = await decoder(blob);
  const width = Number(image?.width || image?.naturalWidth);
  const height = Number(image?.height || image?.naturalHeight);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    image?.close?.();
    throw new Error("The Resolution letterhead dimensions are invalid.");
  }
  const canvas = canvasFactory(width, height);
  const context = canvas?.getContext?.("2d");
  if (!context) {
    image?.close?.();
    throw new Error("A 2D canvas context is unavailable.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  image?.close?.();
  const jpegBlob = await jpegEncoder(canvas, options.quality || RESOLUTION_LETTERHEAD_JPEG_QUALITY);
  const bytes = new Uint8Array(await jpegBlob.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("The converted Resolution letterhead is not a valid JPEG stream.");
  return { bytes, width, height };
}

export async function loadResolutionLetterheadJpeg(options = {}) {
  return loadResolutionLetterheadJpegFromUrl(RESOLUTION_LETTERHEAD_URL, options);
}

export async function loadResolutionOfficialLetterheadJpeg(options = {}) {
  return loadResolutionLetterheadJpegFromUrl(RESOLUTION_OFFICIAL_LETTERHEAD_URL, options);
}

async function loadResolutionLetterheadJpegFromUrl(assetUrl, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const converter = options.convertBlob || convertResolutionLetterheadBlobToJpeg;
  const logger = options.logger || console;
  try {
    if (typeof fetchImpl !== "function") throw new Error("Asset loading is unavailable.");
    const response = await fetchImpl(assetUrl, { cache: "force-cache" });
    if (!response?.ok) throw new Error(`Asset request failed with status ${response?.status || "unknown"}.`);
    return await converter(await response.blob(), options);
  } catch (error) {
    logger?.error?.("Resolution letterhead preparation failed.", {
      assetUrl,
      errorName: typeof error?.name === "string" ? error.name : "Error",
    });
    throw new Error(USER_MESSAGE, { cause: error });
  }
}

export function getResolutionLetterheadJpeg() {
  if (!cachedLetterheadPromise) {
    cachedLetterheadPromise = loadResolutionLetterheadJpeg().catch((error) => {
      cachedLetterheadPromise = null;
      throw error;
    });
  }
  return cachedLetterheadPromise;
}

export function getResolutionOfficialLetterheadJpeg() {
  if (!cachedOfficialLetterheadPromise) {
    cachedOfficialLetterheadPromise = loadResolutionOfficialLetterheadJpeg().catch((error) => {
      cachedOfficialLetterheadPromise = null;
      throw error;
    });
  }
  return cachedOfficialLetterheadPromise;
}
