const ROOT_FOLDER_NAME = "RCPH Treasury Bills";
const ROTARY_YEAR_FOLDER_NAME = "RY 2025-26";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.action !== "uploadTreasuryBill") {
      return jsonResponse({
        ok: false,
        error: "Invalid action."
      });
    }

    const fileName = sanitizeFileName(payload.fileName || "treasury-bill");
    const mimeType = payload.mimeType || "application/octet-stream";
    const base64 = payload.base64 || "";
    const transaction = payload.transaction || {};

    if (!base64) {
      return jsonResponse({
        ok: false,
        error: "Missing file data."
      });
    }

    const cleanBase64 = base64.includes(",")
      ? base64.split(",").pop()
      : base64;

    const bytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const rootFolder = getOrCreateFolder_(DriveApp, ROOT_FOLDER_NAME);
    const yearFolder = getOrCreateChildFolder_(rootFolder, ROTARY_YEAR_FOLDER_NAME);

    const date = sanitizeFileName(transaction.date || getToday_());
    const month = date.slice(0, 7) || getToday_().slice(0, 7);
    const monthFolder = getOrCreateChildFolder_(yearFolder, month);

    const titleOrPurpose = sanitizeFileName(
      transaction.purpose ||
      transaction.title ||
      "Treasury Transaction"
    );

    const type = sanitizeFileName(transaction.type || "transaction");
    const amount = sanitizeFileName(String(transaction.amount || "0"));

    const transactionFolderName = `${date}_${titleOrPurpose}_${type}_${amount}`.slice(0, 180);
    const transactionFolder = getOrCreateChildFolder_(monthFolder, transactionFolderName);

    const file = transactionFolder.createFile(blob);

    // Anyone with link can view. This is convenient for website preview.
    // Keep this only if you are okay with link-access bills.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    transactionFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonResponse({
      ok: true,
      fileUrl: file.getUrl(),
      fileId: file.getId(),
      fileName: file.getName(),
      folderUrl: transactionFolder.getUrl(),
      folderName: transactionFolder.getName()
    });

  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function getOrCreateFolder_(driveApp, name) {
  const folders = driveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return driveApp.createFolder(name);
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120) || "untitled";
}

function getToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}