import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const section = readFileSync(new URL("./MomSection.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./momService.js", import.meta.url), "utf8");

test("MOM section renders empty and uploaded states with permission-scoped actions", () => {
  assert.match(section, /Minutes of Meeting \/ MOM/);
  assert.match(section, /No MOM uploaded yet\./);
  assert.match(section, /Upload MOM PDF/);
  assert.match(section, /View MOM/);
  assert.match(section, /Replace MOM/);
  assert.match(section, /Send MOM Email/);
  assert.match(section, /metadata && sendAllowed/);
  assert.match(section, /canSendMomEmail\(access\)/);
  assert.match(section, /metadata\.momFileName/);
  assert.match(section, /metadata\.momUploadedByName/);
  assert.match(section, /metadata\.momUpdatedAt/);
  assert.match(section, /canUploadMom\(access\)/);
  assert.match(section, /canViewMom\(access\)/);
});

test("MOM email panel pre-fills recipient, subject, body, and attachment preview", () => {
  assert.match(section, /buildMomEmailDefaults\(target\)/);
  assert.match(section, /Recipient group/);
  assert.match(section, /MOM_RECIPIENT_GROUP_OPTIONS\.map/);
  assert.match(section, /Estimated recipient preview/);
  assert.match(section, /buildMomRecipientPreview\(recipientOptions, sendDraft\)/);
  assert.match(section, /Add specific members manually/);
  assert.match(section, /Search eligible members/);
  assert.match(section, /Estimated recipients:/);
  assert.match(section, /addSpecificRecipient/);
  assert.match(section, /removeSpecificRecipient/);
  assert.match(section, /Send summary/);
  assert.match(section, /Subject/);
  assert.match(section, /Message body/);
  assert.match(section, /Attached MOM: \{metadata\.momFileName\}/);
  assert.match(section, /window\.confirm/);
});

test("MOM service uses backend-controlled Drive upload and view flow", () => {
  assert.match(service, /createMomUploadSession/);
  assert.match(service, /uploadMomPdf/);
  assert.match(service, /finalizeMomUpload/);
  assert.match(service, /downloadMomPdf/);
  assert.match(service, /sendMomEmail/);
  assert.match(service, /getMomEmailRecipientOptions/);
  assert.match(service, /targetUserIds: draft\.targetUserIds/);
  assert.match(service, /httpsCallable\(functions, name\)/);
  assert.match(service, /Authorization: `Bearer \$\{token\}`/);
  assert.match(service, /FormData/);
  assert.match(service, /driveFolderName: MOM_DRIVE_FOLDER_NAME/);
  assert.match(service, /driveSubfolderName: momDriveSubfolderName/);
  assert.doesNotMatch(service, /firebase\/storage/);
  assert.doesNotMatch(service, /setAdminLock/);
  assert.doesNotMatch(service, /remindersSent|lockAt/);
  assert.doesNotMatch(service, /drive\.google\.com/);
});
