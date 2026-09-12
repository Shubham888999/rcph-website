import { httpsCallable } from "firebase/functions";
import { functions } from "../../app/firebase";
import { fetchBodEventAttachments } from "./bodEventService";
import {
  buildBodUploadTicketPayload,
  buildConfirmedBodUpload,
  matchVerifiedBodUploadAttachment,
  normalizeBodUploadResponse,
  validateBodUploadEndpoint,
} from "./bodUploadModel";

export const BOD_UPLOAD_WEB_APP_URL = validateBodUploadEndpoint(
  import.meta.env.VITE_BOD_UPLOAD_WEB_APP_URL,
);

// Apps Script answers a POST with a 302 the browser follows as a GET. That hop
// can land back on /exec (no CORS headers) on slower executions, losing an
// otherwise successful response. When that happens we confirm against the
// backend-written Firestore attachment instead of failing the upload.
const CONFIRMATION_ATTEMPT_DELAYS_MS = [0, 1500, 3000];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function confirmUploadFromFirestore(eventId, expected) {
  for (const delay of CONFIRMATION_ATTEMPT_DELAYS_MS) {
    if (delay) await wait(delay);
    let attachments;
    try {
      attachments = await fetchBodEventAttachments(eventId);
    } catch {
      continue;
    }
    const match = matchVerifiedBodUploadAttachment(attachments, expected);
    if (match) return buildConfirmedBodUpload(match, eventId, expected.uploadGroupId);
  }
  return null;
}

export async function uploadBodEventFile(item, event, onStatus) {
  if (!BOD_UPLOAD_WEB_APP_URL) throw new Error("Upload service is not configured.");
  onStatus?.("authorizing");
  const ticketResult = await httpsCallable(functions, "createBodUploadTicket")(
    buildBodUploadTicketPayload(item, event),
  );
  const approved = ticketResult?.data || {};
  if (
    !approved.ticket
    || !approved.uploadGroupId
    || approved.eventId !== event.eventId
    || approved.fileName !== item.fileName
    || approved.mimeType !== item.mimeType
    || approved.sizeBytes !== item.sizeBytes
  ) {
    throw new Error("Upload authorization was incomplete.");
  }

  const expected = {
    eventId: approved.eventId,
    fileName: approved.fileName,
    mimeType: approved.mimeType,
    sizeBytes: approved.sizeBytes,
    uploadGroupId: approved.uploadGroupId,
  };

  onStatus?.("uploading");
  const base64 = await readFileAsDataUrl(item.file);

  let normalized = null;
  let transportError = null;
  try {
    const response = await fetch(BOD_UPLOAD_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "uploadBodFile",
        ticket: approved.ticket,
        uploadGroupId: approved.uploadGroupId,
        fileName: approved.fileName,
        mimeType: approved.mimeType,
        sizeBytes: approved.sizeBytes,
        base64,
      }),
    });
    if (!response.ok) throw new Error(`File upload failed with status ${response.status}.`);
    onStatus?.("processing");
    const json = await response.json().catch(() => null);
    normalized = normalizeBodUploadResponse(json, approved.uploadGroupId, expected);
  } catch (error) {
    transportError = error;
  }

  if (normalized?.attachmentFinalized) {
    return { ...normalized, mimeType: item.mimeType, sizeBytes: item.sizeBytes };
  }

  // Either the response never arrived, or it did not prove finalization.
  // The attachment document is written only by finalizeBodEventUpload and is
  // read-only to clients, so it is the authoritative answer either way.
  onStatus?.("processing");
  const confirmed = await confirmUploadFromFirestore(approved.eventId, expected);
  if (confirmed) return { ...confirmed, mimeType: item.mimeType, sizeBytes: item.sizeBytes };

  // Nothing was verified. Prefer the server's reason code when we have one.
  if (normalized) return { ...normalized, mimeType: item.mimeType, sizeBytes: item.sizeBytes };
  throw transportError || new Error("The upload service did not accept the file.");
}
