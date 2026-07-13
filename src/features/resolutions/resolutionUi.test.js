import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminNav = readFileSync(new URL("../admin/shared/adminNavigation.js", import.meta.url), "utf8");
const adminModule = readFileSync(new URL("../admin/resolutions/ResolutionsModule.jsx", import.meta.url), "utf8");
const dashboardCard = readFileSync(new URL("../dashboard/MemberResolutions.jsx", import.meta.url), "utf8");
const dashboardPage = readFileSync(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./resolutionModel.js", import.meta.url), "utf8");
const pdf = readFileSync(new URL("./resolutionPdf.js", import.meta.url), "utf8");
const bodPdf = readFileSync(new URL("../bod-tools/bodAvenueReportPdf.js", import.meta.url), "utf8");
const pdfBuilder = readFileSync(new URL("../admin/resolutions/ResolutionPdfBuilder.jsx", import.meta.url), "utf8");
const uploadPanel = readFileSync(new URL("../admin/resolutions/ResolutionPdfUploadPanel.jsx", import.meta.url), "utf8");

test("Resolutions is placed directly after Announcements in Admin navigation", () => {
  assert.match(adminNav, /\["announcements", "Announcements"\], \["resolutions", "Resolutions"\]/);
});

test("uploaded-PDF mode exposes private upload, preview, retry, and final download workflow", () => {
  for (const label of ["Upload Ready-Made PDF", "Standard Resolution Format", "Custom Section Layout"]) assert.match(pdfBuilder, new RegExp(label));
  for (const label of ["Choose PDF", "Open / Preview", "Replace", "Remove", "Appended Votes Table", "All eligible voters"]) assert.match(uploadPanel, new RegExp(label));
  assert.match(adminModule, /retryResolutionPdfMerge/);
  assert.match(adminModule, /downloadFinalizedResolutionPdf/);
});

test("uploaded-PDF creation auto-saves one draft before allowing source upload", () => {
  assert.match(uploadPanel, /onEnsurePersisted/);
  assert.match(uploadPanel, /stage === "saving" \? "Saving draft\.\.\." : "Choose PDF"/);
  assert.match(uploadPanel, /Choose a PDF to attach\. A draft will be saved automatically if needed\./);
  assert.doesNotMatch(uploadPanel, /Save the draft first\. You can then attach/);
  assert.match(uploadPanel, /if \(value\.id\)[\s\S]*input\.current\?\.click\(\)/);
  assert.match(uploadPanel, /await onEnsurePersisted\(value\)/);
  assert.match(uploadPanel, /Click Choose PDF again to select the file|could not be prepared for upload/);
  assert.match(pdfBuilder, /onEnsurePersisted=\{onEnsurePersisted\}/);
  assert.match(adminModule, /autoSaveDraft = useRef\(null\)/);
  assert.match(adminModule, /if \(autoSaveDraft\.current\) return autoSaveDraft\.current/);
  assert.match(adminModule, /createResolutionDraft\(payload\)/);
  assert.match(adminModule, /persistedDraftId\(result\)/);
  assert.match(adminModule, /documentSourceMode: "uploadedPdf"/);
  assert.match(adminModule, /draft\.id \? \(\) => updateResolutionDraft\(draft\.id, payload\) : \(\) => createResolutionDraft\(payload\)/);
});

test("uploaded-PDF dark admin panel uses readable theme tokens", () => {
  const adminCss = readFileSync(new URL("../../styles/components/admin.css", import.meta.url), "utf8");
  assert.match(adminCss, /\.resolution-upload \{[\s\S]*var\(--color-border\)[\s\S]*var\(--color-text\)[\s\S]*var\(--color-surface-soft\)/);
  assert.match(adminCss, /\.resolution-upload h4 \{[\s\S]*var\(--color-text\)/);
  assert.match(adminCss, /\.resolution-upload fieldset \{[\s\S]*rgba\(255, 255, 255, 0\.025\)/);
  assert.match(adminCss, /\.resolution-upload__file > span,[\s\S]*\.resolution-upload__status \{[\s\S]*var\(--color-text-muted\)/);
  assert.match(adminCss, /\.resolution-upload input:focus-visible,[\s\S]*\.resolution-upload button:focus-visible \{[\s\S]*outline: 3px solid var\(--color-primary\)/);
});

test("Admin resolution tool exposes lifecycle groups and permission-scoped actions", () => {
  for (const label of ["Open voting", "Drafts", "Completed", "Cancelled", "Download completed resolution PDF", "Audit history", "Delete"]) assert.match(adminModule, new RegExp(label));
  for (const label of ["Approval Method", "Website Voting", "Website Vote with Prepared Email", "Hybrid Email Confirmation", "Record Only / No Voting", "Append submitted vote table to final PDF", "Email configuration", "Mark email verified", "Reject email confirmation"]) assert.match(adminModule + model, new RegExp(label));
  assert.match(adminModule, /item\.status === "draft"/);
  assert.match(adminModule, /item\.status === "open"/);
  assert.match(adminModule, /\["draft", "cancelled"\]\.includes\(item\.status\)/);
  assert.match(adminModule, /deleteResolution/);
  for (const label of ["Edit PDF layout", "Custom Section Layout", "Download Preview PDF"]) assert.match(adminModule + readFileSync(new URL("../admin/resolutions/ResolutionPdfBuilder.jsx", import.meta.url), "utf8"), new RegExp(label));
  assert.match(adminModule, /updateResolutionPdfLayout/);
});

test("Admin hybrid email verification only enables after voter email-sent claim", () => {
  assert.match(model, /function canVerifyHybridEmail\(emailConfirmationStatus\)[\s\S]*email_sent_claimed/);
  assert.match(adminModule, /canVerifyHybridEmail\(vote\.emailConfirmationStatus\)/);
  assert.match(adminModule, /const actionDisabled = busy \|\| !verificationReady/);
  assert.match(adminModule, /Waiting for the voter to confirm that the email was sent\./);
  assert.match(adminModule, /disabled=\{actionDisabled\}[\s\S]*Mark email verified/);
  assert.match(adminModule, /disabled=\{actionDisabled\}[\s\S]*Reject email confirmation/);
  assert.match(adminModule, /verificationReady && onVerify\(vote, \{ \.\.\.form, action: "email_verified" \}\)/);
  assert.match(adminModule, /verificationReady && onVerify\(vote, \{ \.\.\.form, action: "email_rejected" \}\)/);
});

test("Hybrid email editor uses generated content as editable values with independent reset controls", () => {
  for (const label of ["Official email subject", "Official email body", "Generated template", "Customized", "Reset subject", "Reset body", "Confirm reset"]) assert.match(adminModule, new RegExp(label));
  assert.match(adminModule, /function buildHybridEmailSubject/);
  assert.match(adminModule, /function buildHybridEmailPlaceholder/);
  assert.match(adminModule, /value\.officialEmailSubject !== generatedEmailSubject/);
  assert.match(adminModule, /value\.officialEmailBody !== generatedEmailBody/);
  assert.match(adminModule, /key === "officialEmailSubject" \? "subject" : "body"\]: true/);
  assert.match(adminModule, /const emailStateKey = value\.id \|\| "new"/);
  assert.match(adminModule, /setEmailField\("officialEmailSubject"\)/);
  assert.match(adminModule, /setEmailField\("officialEmailBody"\)/);
  assert.match(adminModule, /resetEmailField\("subject"\)/);
  assert.match(adminModule, /resetEmailField\("body"\)/);
  assert.match(adminModule, /withGeneratedHybridEmail\(item, meeting\)/);
  assert.match(model, /Enter an official email subject before saving or opening hybrid email voting/);
  assert.match(model, /Enter an official email body before saving or opening hybrid email voting/);
});

test("Admin resolution creator exposes eligible voter selection controls", () => {
  for (const label of ["Eligible voters", "Search members", "Position filter", "Select all active BOD", "Clear selection", "selected BOD voter"]) assert.match(adminModule, new RegExp(label));
  assert.match(adminModule, /eligibleVoterIds/);
  assert.match(adminModule, /selectedEligibleVoterIds/);
  assert.match(adminModule, /activeEligibleRoster/);
  assert.match(adminModule, /member\?\.[\s\S]*active !== false/);
  assert.match(adminModule, /!Array\.isArray\(value\.eligibleVoterIds\)[\s\S]*allEligibleVoterIds\(roster\)/);
  assert.match(adminModule, /onClick=\{\(\) => setSelectedIds\(\[\]\)\}/);
  assert.match(adminModule, /member\.active === false \? "Inactive" : "Active"/);
  assert.match(adminModule, /!isRecordOnly \? <EligibleVotersSelector/);
  assert.match(model, /Select at least one eligible voter before saving or opening voting/);
  assert.match(adminModule, /Resolution number <span className="admin-optional">Optional<\/span>/);
  assert.doesNotMatch(model + adminModule, /Enter a resolution number|Resolution number is required/);
});

test("dashboard voting is textual, optimistic, and rollback-capable", () => {
  for (const choice of ["approve", "reject", "abstain"]) assert.match(dashboardCard, new RegExp(`"${choice}"`));
  assert.match(dashboardCard, /Your vote:/);
  assert.match(dashboardCard, /You may change your vote while voting remains open/);
  for (const label of ["Open default email app", "Open Gmail", "Copy confirmation text", "I have sent the email", "Confirm your vote", "Confirm vote"]) assert.match(dashboardCard, new RegExp(label));
  assert.match(dashboardPage, /updateOpenResolutions\(previous\)/);
  assert.match(dashboardPage, /setInterval\(refreshOpenResolutions, 20000\)/);
});

test("new-mode hybrid dashboard and admin avoid required email verification language", () => {
  for (const label of [
    "This vote will be recorded immediately and cannot be changed after confirmation.",
    "This vote is final and has been included in the resolution result.",
    "This email is optional and may be sent as an additional official record.",
    "Prepared confirmation email",
    "Recorded and counted",
    "Pending voter has not submitted a dashboard vote.",
  ]) assert.match(dashboardCard + adminModule, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(dashboardCard, /isAuthenticatedFinalHybrid\(resolution\)/);
  assert.match(dashboardPage, /isAuthenticatedFinalHybrid\(resolution\)/);
  assert.match(adminModule, /isAuthenticatedFinalHybrid\(resolution\)/);
  assert.match(adminModule, /resolutionApprovalMethodLabel/);
});

test("hybrid email workflow displays required sender and gates Gmail opening", () => {
  for (const label of [
    "Required sender",
    "Use your registered email so Admin can verify your vote.",
    "Admin verification will reject the confirmation if it is sent from another email address.",
    "Gmail may open using another signed-in Google account. Check the sending account before sending.",
    "If your email app opens without the full prepared text, use Copy confirmation text and paste the complete reply.",
    "Need another account? Switch accounts in Gmail, then return here and open the prepared email again.",
    "Before sending, confirm that Gmail shows",
    "Registered email unavailable",
    "Email actions are paused because the required sender address is missing.",
  ]) assert.match(dashboardCard, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(dashboardCard, /setGmailConfirming\(true\)/);
  assert.match(dashboardCard, /href=\{links\.gmail\}[\s\S]*target="_blank"/);
  assert.match(dashboardCard, /href=\{links\.mailto\}/);
  assert.match(dashboardCard, /navigator\.clipboard\.writeText\(resolution\.preparedReplyText\)/);
  assert.match(dashboardCard, /!missingRequiredSender && confirming/);
  assert.match(dashboardPage, /!resolution\.requiredSenderEmail/);
  assert.match(dashboardPage, /requiredSenderEmail: vote\.requiredSenderEmail \|\| item\.requiredSenderEmail/);
  assert.match(model, /requiredSenderEmail: text\(raw\.requiredSenderEmail, 220\)/);
  assert.doesNotMatch(dashboardCard, /sender selected|selected sender|editable from/i);
});

test("hybrid member voting locks after email-sent claim while staying uncounted until verification", () => {
  for (const label of ["Email sent - awaiting Admin verification", "Your selected vote is locked while the email confirmation is being reviewed. It is not counted until an Admin verifies the email.", "Email verified - your vote is now counted", "Email confirmation rejected", "I have resent the email", "Confirm email sent", "Selected vote:", "Confirm only if the message was sent from this registered email address. Your vote will be locked while Admin verification is pending."]) assert.match(dashboardCard, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(dashboardCard, /isHybridVoteChoiceLocked/);
  assert.match(dashboardCard, /canClaimHybridEmailSent/);
  assert.match(dashboardCard, /disabled=\{busy \|\| hybridLocked \|\| voteLocked\}/);
  assert.match(dashboardPage, /isHybridVoteChoiceLocked\(resolution\.emailConfirmationStatus\)/);
  assert.match(dashboardPage, /markResolutionEmailSent\(user\.uid, resolution\)/);
  assert.match(model, /isHybridVoteChoiceLocked/);
  assert.match(model, /canClaimHybridEmailSent/);
});

test("Resolution PDF uses A4 safe-area pagination and a shared letterhead XObject", () => {
  assert.match(pdf, /RESOLUTION_PDF_PAGE = Object\.freeze\(\{ width: 595, height: 842 \}\)/);
  assert.match(pdf, /RESOLUTION_CONTENT_BOUNDS = Object\.freeze\(\{ left: 54, right: 541, bottom: 260, top: 665 \}\)/);
  assert.match(pdf, /wrapText/);
  assert.match(pdf, /paginateBlocks/);
  assert.match(pdf, /buildResolutionVoteRows/);
  assert.match(pdf, /const xObjects = `\/BG/);
  assert.match(pdf, /OfficialBG/);
});

test("Resolution PDF builder exposes the generated Resolution Page editor", () => {
  for (const label of ["Add Resolution Page", "Generated Resolution Page", "Resolution details", "Main statement", "Additional content", "Generated page order", "Resolution Page -&gt; Voting Table", "Voting Table -&gt; Resolution Page"]) {
    assert.match(pdfBuilder, new RegExp(label));
  }
  assert.match(pdfBuilder, /createDefaultResolutionPageConfig/);
  assert.match(pdfBuilder, /addResolutionPageBlock/);
  assert.match(pdfBuilder, /moveResolutionPageBlock/);
  assert.match(pdfBuilder, /deleteResolutionPageBlock/);
});

test("Resolution letterhead integration remains isolated from the BOD Avenue renderer", () => {
  assert.doesNotMatch(bodPdf, /resolutionLetterhead|resolution_letterhead|RESOLUTION_CONTENT_BOUNDS/);
  assert.match(bodPdf, /BOD_AVENUE_REPORT_LETTERHEAD_URL/);
  assert.match(bodPdf, /parseBodAvenueReportLetterheadPng/);
  assert.match(bodPdf, /\/XObject << \/BG/);
});

test("Resolution body and notes use one accessible progressive disclosure", () => {
  for (const label of [
    "Resolution text and background notes",
    "Full resolution text",
    "Background or notes",
  ]) {
    assert.match(adminModule, new RegExp(label));
  }

  assert.match(adminModule, /function hasResolutionOptionalText/);
  assert.match(adminModule, /optionalTextExpanded/);
  assert.match(adminModule, /aria-expanded=\{optionalTextExpanded\}/);
  assert.match(adminModule, /aria-controls=\{optionalTextId\}/);
  assert.match(adminModule, /className="resolution-optional-toggle"/);
  assert.match(adminModule, /className="resolution-optional-fields"/);
  assert.match(adminModule, /aria-hidden="true"/);
});

test("Generated Page Preview renders after the optional Resolution Page editor", () => {
  const editorIndex = pdfBuilder.indexOf(
    "{resolutionPageConfig.enabled ? <ResolutionPageEditor",
  );
  const previewIndex = pdfBuilder.indexOf(
    '<section className="resolution-builder__generated-preview"',
  );

  assert.notEqual(editorIndex, -1);
  assert.notEqual(previewIndex, -1);
  assert.ok(
    editorIndex < previewIndex,
    "Resolution Page editor must render before Generated Page Preview.",
  );
  assert.match(pdfBuilder, /Generated Page Preview/);
  assert.match(pdfBuilder, /Open Preview/);
  assert.match(pdfBuilder, /Download Preview/);
});