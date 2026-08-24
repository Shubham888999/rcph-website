import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./BodLetterheadExchangePanel.jsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./LetterheadExchangeForm.jsx", import.meta.url), "utf8");
const uploader = readFileSync(new URL("./LetterheadExchangeImageUploader.jsx", import.meta.url), "utf8");
const history = readFileSync(new URL("./LetterheadExchangeHistory.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./letterheadExchangeService.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../pages/bod/BodToolsPage.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../styles/components/bod-tools.css", import.meta.url), "utf8");

test("BOD Tools inserts Letterhead Exchanges immediately after the avenue report panel", () => {
  assert.match(page, /import BodLetterheadExchangePanel/);
  const reportIndex = page.indexOf("<BodAvenueReportPanel");
  const letterheadIndex = page.indexOf("<BodLetterheadExchangePanel />");
  assert.ok(reportIndex > -1, "avenue report panel should still render");
  assert.ok(letterheadIndex > -1, "letterhead panel should render");
  assert.ok(letterheadIndex > reportIndex, "letterhead panel should be after the report panel");
  assert.match(panel, /<h2 id="bod-letterhead-exchanges-title">Letterhead Exchanges<\/h2>/);
  assert.match(styles, /\.bod-letterhead-exchanges/);
});

test("panel loads options and history with retryable error states", () => {
  assert.match(panel, /fetchLetterheadExchangeFormOptions/);
  assert.match(panel, /listLetterheadExchanges/);
  assert.match(panel, /status: "loading"/);
  assert.match(panel, /status: "error"/);
  assert.match(panel, /Retry options/);
  assert.match(panel, /onRetry=\{loadHistory\}/);
  assert.match(panel, /optionsStatus=\{optionsState\.status\}/);
  assert.match(panel, /members=\{optionsState\.members\}/);
  assert.match(panel, /events=\{optionsState\.events\}/);
});

test("form covers participant, member, event, Other, and upload controls", () => {
  for (const label of [
    "External Club / Rotaractor",
    "Club Name *",
    "Rotaractor Name *",
    "Position",
    "Rotaract District ID (RID)",
    "RCPH Representative(s) *",
    "Exchange Date *",
    "Associated Event",
    "Other",
    "Upload Images",
  ]) {
    assert.match(form, new RegExp(label.replace(/[()]/g, "\\$&")));
  }
  assert.match(form, /placeholder="e\.g\. 3131"/);
  assert.match(form, /maxLength="20"/);
  assert.match(form, /addParticipantRow/);
  assert.match(form, /removeParticipantRow/);
  assert.match(form, /draft\.externalParticipants\.length === 1/);
  assert.match(form, /LETTERHEAD_PARTICIPANT_LIMIT/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /toggleMemberSelection/);
  assert.match(form, /draft\.rcphMemberIds\.length\} selected/);
  assert.match(form, /<option value="">No associated event<\/option>/);
  assert.match(form, /LETTERHEAD_OTHER_LIMIT/);
  assert.match(form, /draft\.uploadImages \? \(/);
  assert.match(form, /LetterheadExchangeImageUploader/);
});

test("exchange save flow creates once, uploads optionally, and retries only failed images", () => {
  const createIndex = form.indexOf("await createLetterheadExchange(result.payload)");
  const uploadIndex = form.indexOf("await uploadImagesForExchange(exchangeId, requestedImages)");
  assert.ok(createIndex > -1, "create callable should be used");
  assert.ok(uploadIndex > createIndex, "image upload should happen after exchange creation");
  assert.match(form, /const requestedImages = draft\.uploadImages \? imageState\.files\.filter/);
  assert.match(form, /status: "partial_success"/);
  assert.match(form, /Retry failed uploads/);
  assert.match(form, /const failedFiles = imageState\.files\.filter\(\(item\) => item\.status === "failed"\)/);
  const retryBody = form.slice(form.indexOf("async function retryFailedUploads"), form.indexOf("const optionsUnavailable"));
  assert.doesNotMatch(retryBody, /createLetterheadExchange/);
  assert.match(retryBody, /uploadImagesForExchange\(submission\.exchangeId, failedFiles\)/);
});

test("image uploader validates local files and supports removing selected local files", () => {
  assert.match(uploader, /addLetterheadImageFiles/);
  assert.match(uploader, /accept="image\/jpeg,image\/png,image\/webp,\.jpg,\.jpeg,\.png,\.webp"/);
  assert.match(uploader, /multiple/);
  assert.match(uploader, /LETTERHEAD_IMAGE_MAX_FILES/);
  assert.match(uploader, /removeFile/);
  assert.match(uploader, /files\.filter\(\(item\) => item\.localId !== localId\)/);
  assert.match(uploader, /item\.status === "uploading" \|\| item\.status === "finalizing" \|\| item\.status === "uploaded"/);
  assert.match(uploader, /aria-label=\{`Remove selected image \$\{item\.fileName\}`\}/);
});

test("history is collapsible, shows all external participants, and opens images through protected access", () => {
  assert.match(history, /useState\(\(\) => new Set\(\)\)/);
  assert.match(history, /aria-expanded=\{expanded\}/);
  assert.match(history, /aria-controls=\{panelId\}/);
  assert.match(history, /expanded \? \(/);
  assert.match(history, /exchange\.externalParticipants\.map/);
  assert.match(history, /Rotaract District ID \(RID\): \{participant\.rotaractDistrictId\}/);
  assert.match(history, /Previous Letterhead Exchanges/);
  assert.match(history, /No Letterhead Exchanges have been recorded yet/);
  assert.match(history, /openProtectedLetterheadImage\(exchange\.id, image\)/);
  assert.match(history, />\s*\{openingImageId === key \? "Opening\.\.\." : "Open"\}\s*<\/button>/);
});

test("letterhead styles define responsive tablet and mobile stacking rules", () => {
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /\.letterhead-participant-row,[\s\S]*\.letterhead-history-card__summary,[\s\S]*\.letterhead-history-meta[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.letterhead-participant-row,[\s\S]*\.letterhead-form-grid,[\s\S]*\.letterhead-upload__files li,[\s\S]*\.letterhead-history-images li[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.letterhead-member-selector[\s\S]*max-height: 22rem/);
  assert.match(styles, /\.letterhead-upload__picker,[\s\S]*\.letterhead-form-actions button,[\s\S]*width: 100%/);
});

test("frontend service matches the Phase 2 backend callable and HTTP contracts", () => {
  for (const callableName of [
    "getLetterheadExchangeFormOptions",
    "createLetterheadExchange",
    "listLetterheadExchanges",
    "getLetterheadExchangesForReport",
    "createLetterheadExchangeImageUploadSession",
    "finalizeLetterheadExchangeImageUpload",
    "getLetterheadExchangeImageAccess",
  ]) {
    assert.match(service, new RegExp(`callable\\("${callableName}"`));
  }
  assert.match(service, /files: fileRequests/);
  assert.match(service, /getLetterheadExchangesForReport\(months\)/);
  assert.match(service, /normalizeReportLetterheadExchangeResponse/);
  for (const field of ["exchangeId", "sessionId", "proof", "fileName", "mimeType", "sizeBytes", "file"]) {
    assert.match(service, new RegExp(`form\\.append\\("${field}"`));
  }
  assert.match(service, /fetch\(session\.uploadEndpoint, \{ method: "POST", body: form \}\)/);
  assert.match(service, /finalizeLetterheadExchangeImageUpload\(exchangeId, session\.sessionId\)/);
  assert.match(service, /getLetterheadExchangeImageAccess\(exchangeId, imageId\)/);
  assert.match(service, /buildProtectedImageUrl\(access\)/);
  assert.match(service, /opener\?\.open\?\.\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(service, /getSafeLetterheadExchangeError/);
  assert.doesNotMatch(service, /driveFileId|webViewLink|storageFileId/);
});
