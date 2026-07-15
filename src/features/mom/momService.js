import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../app/firebase";
import { MOM_DRIVE_FOLDER_NAME, momDriveSubfolderName, validateMomPdfFile } from "./momModel";

const REGION_BASE = "https://us-central1-rcph-admin.cloudfunctions.net";

function endpoint(name, override) {
  return String(override || `${REGION_BASE}/${name}`).replace(/\/$/, "");
}

function requireUser() {
  if (!auth.currentUser) throw new Error("Authenticated user required.");
  return auth.currentUser;
}

async function call(name, payload) {
  requireUser();
  const result = await httpsCallable(functions, name)(payload);
  return result?.data && typeof result.data === "object" ? result.data : {};
}

function targetPayload(target) {
  return {
    targetType: target?.targetType || "",
    targetId: target?.targetId || "",
    driveFolderName: MOM_DRIVE_FOLDER_NAME,
    driveSubfolderName: momDriveSubfolderName(target?.targetType),
  };
}

export async function uploadMomPdf(target, file, onStage = () => {}) {
  const validationError = validateMomPdfFile(file);
  if (validationError) throw new Error(validationError);

  onStage("authorizing");
  const session = await call("createMomUploadSession", {
    ...targetPayload(target),
    fileName: file.name,
    mimeType: file.type || "application/pdf",
    sizeBytes: file.size,
  });

  if (!session?.sessionId || !session?.proof) {
    throw new Error("MOM upload authorization was incomplete.");
  }

  const body = new FormData();
  body.set("sessionId", session.sessionId);
  body.set("proof", session.proof);
  body.set("targetType", target?.targetType || "");
  body.set("targetId", target?.targetId || "");
  body.set("fileName", file.name);
  body.set("mimeType", file.type || "application/pdf");
  body.set("sizeBytes", String(file.size));
  body.set("file", file, file.name);

  onStage("uploading");
  const response = await fetch(
    endpoint("uploadMomPdf", session.uploadEndpoint || import.meta.env.VITE_MOM_PDF_UPLOAD_ENDPOINT),
    { method: "POST", body },
  );
  const uploaded = await response.json().catch(() => ({}));
  if (!response.ok || uploaded?.ok !== true) {
    throw Object.assign(new Error(uploaded?.message || "The MOM PDF upload failed."), {
      code: uploaded?.code || "upload-failed",
    });
  }

  onStage("finalizing");
  const finalized = await call("finalizeMomUpload", {
    ...targetPayload(target),
    sessionId: session.sessionId,
  });

  onStage("ready");
  return finalized?.mom || finalized?.metadata || uploaded?.mom || null;
}

export async function fetchMomPdf(target) {
  const user = requireUser();
  const token = await user.getIdToken();
  const url = new URL(endpoint("downloadMomPdf", import.meta.env.VITE_MOM_PDF_DOWNLOAD_ENDPOINT));
  url.searchParams.set("targetType", target?.targetType || "");
  url.searchParams.set("targetId", target?.targetId || "");
  const response = await fetch(url.href, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw Object.assign(new Error(payload?.message || "The MOM PDF could not be opened."), {
      code: payload?.code || "download-failed",
    });
  }
  return response.blob();
}

export async function viewMomPdf(target) {
  const blob = await fetchMomPdf(target);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
