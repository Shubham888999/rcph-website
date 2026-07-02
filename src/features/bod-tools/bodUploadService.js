import { httpsCallable } from "firebase/functions";
import { functions } from "../../app/firebase";
import {
  buildBodUploadTicketPayload,
  normalizeBodUploadResponse,
  validateBodUploadEndpoint,
} from "./bodUploadModel";

export const BOD_UPLOAD_WEB_APP_URL = validateBodUploadEndpoint(
  import.meta.env.VITE_BOD_UPLOAD_WEB_APP_URL,
);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function uploadBodEventFile(item, event, onStatus) {
  if (!BOD_UPLOAD_WEB_APP_URL) throw new Error("Upload service is not configured.");
  onStatus?.("authorizing");
  const ticketResult = await httpsCallable(functions, "createBodUploadTicket")(
    buildBodUploadTicketPayload(item, event),
  );
  const approved = ticketResult?.data || {};
  if (!approved.ticket || !approved.uploadGroupId) {
    throw new Error("Upload authorization was incomplete.");
  }

  onStatus?.("uploading");
  const base64 = await readFileAsDataUrl(item.file);
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
  const normalized = normalizeBodUploadResponse(
  json,
  approved.uploadGroupId,
);

return {
  ...normalized,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
};
}
