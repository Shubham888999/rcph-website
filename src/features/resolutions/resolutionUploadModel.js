export const RESOLUTION_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const RESOLUTION_PDF_ACCEPT = ".pdf,application/pdf";

export function validateResolutionPdfFile(file) {
  if (!file) return "Choose one PDF file.";
  if (!/\.pdf$/i.test(String(file.name || ""))) return "Choose a file with a .pdf extension.";
  if (file.type && file.type !== "application/pdf") return "Only PDF files are accepted.";
  if (!Number.isInteger(file.size) || file.size < 1) return "The selected PDF is empty.";
  if (file.size > RESOLUTION_PDF_MAX_BYTES) return "The selected PDF is larger than 10 MB.";
  return "";
}

export function formatResolutionPdfSize(bytes) {
  const value = Number(bytes) || 0;
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}

export function resolutionUploadError(error) {
  const code = String(error?.code || "").toLowerCase();
  if (code.includes("encrypted-pdf")) return "Password-protected PDFs are not supported.";
  if (code.includes("too-many-pages")) return "The PDF contains more than 25 pages.";
  if (code.includes("file-too-large")) return "The PDF is larger than 10 MB.";
  if (code.includes("expired-session")) return "The upload session expired. Choose the file again.";
  if (code.includes("invalid-pdf") || code.includes("malformed-pdf")) return "The selected file is not a valid supported PDF.";
  return error?.message || "The Resolution PDF upload failed. Please retry.";
}
