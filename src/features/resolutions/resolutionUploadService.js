import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";

const REGION_BASE = "https://us-central1-rcph-admin.cloudfunctions.net";

function endpoint(name, override) {
  return String(override || `${REGION_BASE}/${name}`).replace(/\/$/, "");
}

async function call(name, payload) {
  if (!auth.currentUser) throw new Error("Authenticated user required.");
  const result = await httpsCallable(functions, name)(payload);
  return result.data || {};
}

export async function uploadResolutionPdf(resolutionId, file, onStage = () => {}) {
  onStage("validating");
  const session = await call("createResolutionPdfUploadSession", { resolutionId, fileName: file.name, mimeType: file.type || "application/pdf", sizeBytes: file.size });
  onStage("uploading");
  const body = new FormData();
  body.set("sessionId", session.sessionId);
  body.set("proof", session.proof);
  body.set("resolutionId", resolutionId);
  body.set("file", file, file.name);
  const response = await fetch(endpoint("uploadResolutionSourcePdf", session.uploadEndpoint || import.meta.env.VITE_RESOLUTION_PDF_UPLOAD_ENDPOINT), { method: "POST", body });
  const uploaded = await response.json().catch(() => ({}));
  if (!response.ok || uploaded.ok !== true) throw Object.assign(new Error(uploaded.message || "The PDF upload failed."), { code: uploaded.code || "upload-failed" });
  onStage("processing");
  const finalized = await call("finalizeResolutionPdfUpload", { resolutionId, sessionId: session.sessionId });
  onStage("ready");
  return finalized.uploadedSource;
}

export function removeResolutionPdf(resolutionId) {
  return call("removeResolutionSourcePdf", { resolutionId });
}

export function retryResolutionPdfMerge(resolutionId) {
  return call("retryResolutionPdfMerge", { resolutionId });
}

async function fetchAuthorizedPdf(name, resolutionId) {
  if (!auth.currentUser) throw new Error("Authenticated user required.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${endpoint(name)}?resolutionId=${encodeURIComponent(resolutionId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw Object.assign(new Error(payload.message || "The PDF could not be downloaded."), { code: payload.code || "download-failed" });
  }
  return response.blob();
}

export async function previewResolutionSourcePdf(resolutionId) {
  const blob = await fetchAuthorizedPdf("downloadResolutionSourcePdf", resolutionId);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFinalizedResolutionPdf(resolutionId, resolutionNumber) {
  const blob = await fetchAuthorizedPdf("downloadFinalizedResolutionPdf", resolutionId);
  const safe = String(resolutionNumber || "Resolution").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `RCPH-${safe || "Resolution"}-Final.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
