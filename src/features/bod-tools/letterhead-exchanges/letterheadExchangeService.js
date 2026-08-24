import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../../app/firebase";
import {
  buildProtectedImageUrl,
  normalizeCreateExchangeResponse,
  normalizeFinalizeImageResponse,
  normalizeFormOptionsResponse,
  normalizeImageAccessResponse,
  normalizeImageSessionResponse,
  normalizeListExchangeResponse,
  normalizeReportLetterheadExchangeResponse,
  normalizeUploadHttpResponse,
  validateLetterheadImageFile,
} from "./letterheadExchangeModel";

const LETTERHEAD_UPLOAD_CONCURRENCY = 2;

function requireCurrentUser() {
  if (!auth.currentUser) throw new Error("An authenticated user is required.");
  return auth.currentUser.uid;
}

async function callable(name, payload = {}) {
  requireCurrentUser();
  const result = await httpsCallable(functions, name)(payload);
  return result?.data && typeof result.data === "object" ? result.data : {};
}

export function getSafeLetterheadExchangeError(error, fallback = "Unable to complete the Letterhead Exchange request.") {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  const messages = {
    "functions/unauthenticated": "Your session expired. Sign in again before using Letterhead Exchanges.",
    "functions/permission-denied": "You do not have permission to use Letterhead Exchanges.",
    "functions/invalid-argument": "Review the highlighted Letterhead Exchange details and try again.",
    "functions/not-found": "The Letterhead Exchange record could not be found.",
    "functions/failed-precondition": "Letterhead Exchange storage is not ready or the record no longer accepts this action.",
    "functions/resource-exhausted": "This exchange already has the maximum number of images.",
    "functions/unavailable": "Letterhead Exchange services are temporarily unavailable.",
  };
  if (messages[code]) return messages[code];
  const safeLocalMessages = [
    "An authenticated user is required.",
    "Image upload authorization was incomplete.",
    "The private image upload was rejected.",
    "Image finalization response was incomplete.",
    "Image access response was incomplete.",
    "Unable to open this image.",
  ];
  return safeLocalMessages.includes(error?.message)
    ? error.message
    : (error?.message && error.message.length < 180 ? error.message : fallback);
}

export async function fetchLetterheadExchangeFormOptions() {
  return normalizeFormOptionsResponse(await callable("getLetterheadExchangeFormOptions", {}));
}

export async function createLetterheadExchange(payload) {
  return normalizeCreateExchangeResponse(await callable("createLetterheadExchange", payload));
}

export async function listLetterheadExchanges(payload = {}) {
  return normalizeListExchangeResponse(await callable("listLetterheadExchanges", payload));
}

export async function getLetterheadExchangesForReport(months) {
  return normalizeReportLetterheadExchangeResponse(await callable("getLetterheadExchangesForReport", { months }));
}

export async function createLetterheadExchangeImageUploadSession(exchangeId, files) {
  const fileRequests = files.map((item) => ({
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  }));
  const raw = await callable("createLetterheadExchangeImageUploadSession", {
    exchangeId,
    files: fileRequests,
  });
  return normalizeImageSessionResponse(raw, fileRequests.length);
}

export async function finalizeLetterheadExchangeImageUpload(exchangeId, sessionId) {
  return normalizeFinalizeImageResponse(await callable("finalizeLetterheadExchangeImageUpload", {
    exchangeId,
    sessionId,
  }));
}

export async function getLetterheadExchangeImageAccess(exchangeId, imageId) {
  return normalizeImageAccessResponse(await callable("getLetterheadExchangeImageAccess", {
    exchangeId,
    imageId,
  }));
}

export async function uploadLetterheadExchangeImageFile(file, session, { exchangeId }) {
  if (!file || !session?.sessionId || !session?.proof || !session?.uploadEndpoint) {
    throw new Error("Image upload authorization was incomplete.");
  }
  const localValidation = validateLetterheadImageFile(file);
  if (localValidation) throw new Error(localValidation);
  const form = new FormData();
  form.append("exchangeId", exchangeId);
  form.append("sessionId", session.sessionId);
  form.append("proof", session.proof);
  form.append("fileName", session.fileName || file.name);
  form.append("mimeType", session.mimeType || file.type);
  form.append("sizeBytes", String(session.sizeBytes || file.size));
  form.append("file", file, file.name);
  const response = await fetch(session.uploadEndpoint, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "The private image upload was rejected.");
  return normalizeUploadHttpResponse(data, session.sessionId);
}

async function runWithConcurrency(tasks, concurrency = LETTERHEAD_UPLOAD_CONCURRENCY) {
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, async () => {
    while (tasks.length) {
      const task = tasks.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

export async function uploadLetterheadExchangeImages(exchangeId, files, { onFileStatus, concurrency = LETTERHEAD_UPLOAD_CONCURRENCY } = {}) {
  const pendingFiles = files.filter((item) => item?.file && item.status !== "uploaded");
  if (!pendingFiles.length) return { ok: true, results: [], successCount: 0, failureCount: 0 };
  let sessionBundle;
  try {
    pendingFiles.forEach((item) => onFileStatus?.(item.localId, { status: "waiting", error: "" }));
    sessionBundle = await createLetterheadExchangeImageUploadSession(exchangeId, pendingFiles);
  } catch (error) {
    pendingFiles.forEach((item) => onFileStatus?.(item.localId, {
      status: "failed",
      error: getSafeLetterheadExchangeError(error, "Image upload authorization failed."),
    }));
    return {
      ok: false,
      results: pendingFiles.map((item) => ({ localId: item.localId, ok: false, error })),
      successCount: 0,
      failureCount: pendingFiles.length,
    };
  }

  const results = [];
  const tasks = pendingFiles.map((item, index) => async () => {
    const session = sessionBundle.sessions[index];
    try {
      onFileStatus?.(item.localId, { status: "uploading", sessionId: session.sessionId, error: "" });
      const uploaded = await uploadLetterheadExchangeImageFile(item.file, {
        ...session,
        uploadEndpoint: sessionBundle.uploadEndpoint,
      }, { exchangeId });
      onFileStatus?.(item.localId, { status: "finalizing", uploaded, error: "" });
      const finalized = await finalizeLetterheadExchangeImageUpload(exchangeId, session.sessionId);
      onFileStatus?.(item.localId, {
        status: "uploaded",
        uploaded,
        image: finalized.image,
        file: null,
        error: "",
      });
      results.push({ localId: item.localId, ok: true, uploaded, finalized });
    } catch (error) {
      onFileStatus?.(item.localId, {
        status: "failed",
        error: getSafeLetterheadExchangeError(error, "The image could not be uploaded."),
      });
      results.push({ localId: item.localId, ok: false, error });
    }
  });

  await runWithConcurrency(tasks, concurrency);
  const successCount = results.filter((item) => item.ok).length;
  const failureCount = results.length - successCount;
  return {
    ok: failureCount === 0,
    results,
    successCount,
    failureCount,
  };
}

export async function openProtectedLetterheadImage(exchangeId, image, opener = globalThis.window) {
  const imageId = image?.imageId || image?.uploadSessionId || "";
  if (!imageId) throw new Error("Unable to open this image.");
  const access = await getLetterheadExchangeImageAccess(exchangeId, imageId);
  const url = buildProtectedImageUrl(access);
  if (!url) throw new Error("Image access response was incomplete.");
  const opened = opener?.open?.(url, "_blank", "noopener,noreferrer");
  if (!opened && opener?.location?.assign) opener.location.assign(url);
  return { access, url };
}
