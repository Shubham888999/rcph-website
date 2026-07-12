'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const attachmentService = fs.readFileSync(path.join(root, 'functions', 'lib', 'announcement-attachments.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `Missing block start: ${startNeedle}`);
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

const prospectDelete = sliceBetween(functionsIndex, 'exports.deleteProspectAccount = onCall', 'exports.promoteProspectToGbm = onCall');
assert.match(prospectDelete, /assertApprovedActiveCallableAccount\(actorUid\)/, 'Prospect deletion requires approved active admin context');
assert.match(prospectDelete, /admin\.auth\(\)\.deleteUser\(uid\)/, 'Prospect deletion removes the Firebase Auth account');
for (const collection of ['users', 'roles', 'prospectProgress', 'attendance', 'districtAttendance']) {
  assert.match(prospectDelete, new RegExp(`collection\\('${collection}'\\)\\.doc\\(uid\\)`), `Prospect deletion touches ${collection}/${'{uid}'}`);
}
assert.match(prospectDelete, /ANNOUNCEMENT_DELIVERIES_COLLECTION\)\.where\('uid', '==', uid\)/, 'Prospect deletion cleans dashboard announcement deliveries');
assert.match(prospectDelete, /collection\('members'\)\.where\('userId', '==', uid\)/, 'Prospect deletion cleans generated member docs by userId');
assert.match(prospectDelete, /collection\('bodMembers'\)\.where\('userId', '==', uid\)/, 'Prospect deletion cleans generated BOD member docs by userId');
assert.match(prospectDelete, /isPromotedProspectRecord\(user, progress\)/, 'Promoted prospects cannot be deleted from the Prospect path');
assert.match(prospectDelete, /ADMIN_MAINTENANCE_AUDIT_COLLECTION/, 'Prospect deletion writes backend audit');

const attendanceInit = sliceBetween(functionsIndex, 'async function initializeAttendanceForEvent', 'async function writeSyncedBodEvent');
assert.match(attendanceInit, /loadGeneralAttendanceParticipantIds/, 'Club attendance initialization includes approved users');
assert.match(attendanceInit, /role === 'prospect' \|\| role === 'gbm'/, 'Approved prospect and GBM users are recognized for attendance');
assert.doesNotMatch(attendanceInit, /userId && userId !== doc\.id\) add\(doc\.id\)/, 'Attendance initialization stays UID-first and does not create duplicate legacy member rows');
assert.match(functionsIndex, /initializeAttendanceFieldForCollection\('members', 'districtAttendance', districtEventId, now, \{ includeGeneralAttendanceUsers: true \}\)/, 'District attendance initialization includes approved prospects and GBMs');
assert.match(functionsIndex, /initializeAttendanceFieldForCollection\('bodMembers', 'bodAttendance'/, 'BOD attendance initialization remains on bodMembers');

const announcementArchive = sliceBetween(functionsIndex, 'exports.archiveAnnouncement = onCall', 'exports.deleteAnnouncement = onCall');
assert.match(announcementArchive, /data\.status !== 'published'/, 'Only published announcements are archived');
assert.match(announcementArchive, /status: 'archived'/, 'Announcement archive updates status');
assert.match(announcementArchive, /announcement_archived/, 'Announcement archive writes audit');

const announcementDelete = sliceBetween(functionsIndex, 'exports.deleteAnnouncement = onCall', 'exports.markAnnouncementRead = onCall');
assert.match(announcementDelete, /status === 'published'/, 'Published announcements cannot be deleted');
assert.match(announcementDelete, /announcement_deleted/, 'Announcement deletion writes audit');
assert.match(announcementDelete, /deleteAttachmentFile\(data\.attachment\)/, 'Announcement deletion cleans private attachments');
assert.match(attachmentService, /async function deleteAttachmentFile/, 'Attachment service exposes private cleanup for backend deletes only');
assert.match(attachmentService, /assertTrustedDriveFile\(driveFile, attachment\)/, 'Attachment deletion verifies Drive metadata before deleting');

const resolutionDelete = sliceBetween(functionsIndex, 'exports.deleteResolution = onCall', 'exports.getAdminResolutions = onCall');
assert.match(resolutionDelete, /RESOLUTION_PDF_CALLABLE_OPTIONS/, 'Resolution deletion uses Drive-secret callable options');
assert.match(resolutionDelete, /\['draft', 'cancelled'\]\.includes\(data\.status\)/, 'Only draft and cancelled resolutions can be deleted');
assert.match(resolutionDelete, /votesSnap\.empty/, 'Resolution deletion blocks existing votes');
assert.match(resolutionDelete, /finalizedMergedPdf|finalPdfHash|finalizedUploadedSourceSnapshot/, 'Resolution deletion blocks finalized artifacts');
assert.match(resolutionDelete, /RESOLUTION_DELETION_AUDIT_COLLECTION/, 'Resolution deletion preserves audit separately');
assert.match(resolutionDelete, /resolutionDrive\.deleteSourceFile/, 'Resolution deletion cleans uploaded source PDFs');

for (const collection of ['adminMaintenanceAudit', 'resolutionDeletionAudit', 'announcements', 'announcementDeliveries']) {
  assert.match(rules, new RegExp(`match /${collection}/`), `${collection} has explicit rules`);
}
assert.match(rules, /match \/adminMaintenanceAudit\/\{auditId\} \{[\s\S]*allow read, write: if false;/, 'Admin maintenance audit is backend-only');
assert.match(rules, /match \/resolutionDeletionAudit\/\{auditId\} \{[\s\S]*allow read, write: if false;/, 'Resolution deletion audit is backend-only');

console.log('Membership and content management verifier passed.');
