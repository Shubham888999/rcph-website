'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ANNOUNCEMENT_ATTACHMENT_MAX_BYTES,
  createAnnouncementAttachmentService,
  normalizeFileMetadata,
  sniffMimeType,
} = require('../lib/announcement-attachments');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `Missing block start: ${startNeedle}`);
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

const functionsIndex = read('functions/index.js');
const helperSource = read('functions/lib/announcement-attachments.js');

assert.equal(ANNOUNCEMENT_ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024, 'announcement attachments should be capped at 10 MB');
assert.equal(sniffMimeType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
assert.equal(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])), 'image/jpeg');
assert.equal(sniffMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
assert.equal(sniffMimeType(Buffer.from('RIFFxxxxWEBP', 'ascii')), 'image/webp');
assert.equal(sniffMimeType(Buffer.from('not a file')), '');

assert.equal(normalizeFileMetadata({ fileName: ' agenda.pdf ', mimeType: 'application/pdf', sizeBytes: 42 }).kind, 'pdf');
assert.equal(normalizeFileMetadata({ fileName: ' image.png ', mimeType: 'image/png', sizeBytes: 42 }).kind, 'image');
assert.throws(() => normalizeFileMetadata({ fileName: 'bad.gif', mimeType: 'image/gif', sizeBytes: 42 }), /Unsupported attachment file type/);
assert.throws(() => normalizeFileMetadata({ fileName: 'large.pdf', mimeType: 'application/pdf', sizeBytes: ANNOUNCEMENT_ATTACHMENT_MAX_BYTES + 1 }), /too large/);

const service = createAnnouncementAttachmentService({
  db: {},
  admin: { firestore: { Timestamp: { now: () => ({ toMillis: () => Date.now() }) } } },
  config: { authMode: 'oauth', folderId: 'folder' },
  driveClient: { files: {} },
  getManagerContext: async () => ({ role: 'admin' }),
  logger: { warn() {}, info() {} },
});
const safe = service.reportSafeAttachment({
  status: 'ready',
  storageProvider: 'google_drive',
  driveFileId: 'secret-drive-id',
  uploadSessionId: 'secret-session',
  filename: 'agenda.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  kind: 'pdf',
});
assert.deepStrictEqual(safe, {
  status: 'ready',
  filename: 'agenda.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  kind: 'pdf',
  uploadedAt: '',
});
assert.equal('driveFileId' in safe, false);
assert.equal('uploadSessionId' in safe, false);
assert.equal(service.reportSafeAttachment({ status: 'ready', mimeType: 'text/plain', sizeBytes: 10, filename: 'bad.txt' }), null);
assert.throws(
  () => service.emailAttachmentFromBytes({ filename: 'large.pdf', mimeType: 'application/pdf', sizeBytes: ANNOUNCEMENT_ATTACHMENT_MAX_BYTES + 1 }, Buffer.alloc(1)),
  /too large/
);

[
  'createAnnouncementAttachmentUploadSession',
  'removeAnnouncementAttachmentUpload',
  'uploadAnnouncementAttachment',
  'downloadAnnouncementAttachment',
  'cleanupAnnouncementAttachmentUploads',
].forEach((name) => {
  assert(functionsIndex.includes(`exports.${name}`), `${name} should be exported`);
});

assert(functionsIndex.includes('ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS'), 'attachment callables should use attachment-aware options');
assert(functionsIndex.includes("const ANNOUNCEMENT_ATTACHMENT_SECRETS = RESOLUTION_DRIVE_SECRETS"), 'announcement attachments should reuse existing Drive secret binding');
assert(functionsIndex.includes('createAnnouncementAttachmentService'), 'index should initialize the announcement attachment service');
assert(functionsIndex.includes('announcementAttachments.streamDownload(req, res, getAnnouncementForAttachmentAccess)'), 'download endpoint should authorize through announcement access');
assert(!functionsIndex.includes('firebase.storage') && !functionsIndex.includes('getStorage('), 'announcement attachments must not use Firebase Storage');

const publishBlock = sliceBetween(functionsIndex, 'exports.publishAnnouncement', 'exports.markAnnouncementRead');
assert(publishBlock.includes('reserveForPublish(actorUid, announcement.attachmentSessionId, announcementId)'), 'publish should reserve uploaded sessions before storing metadata');
assert(publishBlock.indexOf('reserveForPublish') < publishBlock.indexOf('announcementRef.set'), 'attachment reservation should happen before dashboard publication');
assert(publishBlock.includes('downloadAttachmentBytes(attachment)'), 'email delivery should retrieve the private Drive file through backend code');
assert(publishBlock.includes('emailAttachmentFromBytes(attachment'), 'email delivery should attach bytes, not a Drive link');
assert(publishBlock.includes('releaseReservation(actorUid, reservedAttachmentSessionId, announcementId)'), 'failed publish should release temporary reservations');
assert(publishBlock.includes('reportSafeAttachment(attachment)'), 'callable response should expose safe attachment metadata only');

const accessBlock = sliceBetween(functionsIndex, 'async function getAnnouncementForAttachmentAccess', 'function normalizeBoolean');
assert(accessBlock.includes('assertApprovedActiveCallableAccount(uid)'), 'attachment downloads should require approved active accounts');
assert(accessBlock.includes('assertAdminOrPresidentAuthority(uid)'), 'admin/president management access should be backend-derived');
assert(accessBlock.includes('ANNOUNCEMENT_DELIVERIES_COLLECTION'), 'member access should be based on delivery records');
assert(accessBlock.includes("dashboardStatus === 'dismissed'"), 'dismissed announcements should not expose attachments');
assert(accessBlock.includes("announcement.status !== 'published'"), 'unpublished announcements should not expose member downloads');

const dashboardBlock = sliceBetween(functionsIndex, 'function normalizePublishedAnnouncementForDashboard', 'function normalizeAnnouncementHistoryRequest');
assert(dashboardBlock.includes('reportSafeAttachment(announcement.attachment)'), 'dashboard payload should include safe attachment metadata');
assert(!dashboardBlock.includes('driveFileId'), 'dashboard payload should not expose Drive file ids');

const historyBlock = sliceBetween(functionsIndex, 'function normalizeAnnouncementHistoryItem', 'async function getAnnouncementDashboardSummaries');
assert(historyBlock.includes('reportSafeAttachment(data?.attachment)'), 'history payload should include safe attachment metadata');

assert(helperSource.includes("documentType: 'announcement-attachment'"), 'Drive appProperties should bind files to announcement attachments');
assert(helperSource.includes('assertTrustedDriveFile'), 'downloads should verify Drive metadata before streaming bytes');
assert(helperSource.includes('sha256'), 'stored and downloaded attachment bytes should be checksummed');
assert(helperSource.includes('files.delete'), 'removal and cleanup should delete orphaned private Drive files');
assert(helperSource.includes('Content-Disposition'), 'download endpoint should set explicit content disposition');
assert(!helperSource.includes('anyoneWithLink') && !helperSource.includes("role: 'reader'"), 'helper should not create public Drive permissions');

console.log('Announcement attachment verifier passed.');
