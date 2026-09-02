const {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
  normalizeDocumentId,
  normalizeAuthoritativeBodUploadEvent,
} = require('./bod-event-attachments');

const BOD_REPORT_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const BOD_REPORT_IMAGE_MIME_TYPE_SET = new Set(BOD_REPORT_IMAGE_MIME_TYPES);

function makeError(HttpsError, code, message, details) {
  return new HttpsError(code, message, details);
}

function text(value, max = 500) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 120) {
  return text(value, max).toLowerCase();
}

function hasControlCharacter(value) {
  return /[\x00-\x1F\x7F]/.test(String(value || ''));
}

function normalizeOptionalReportImageFileId(value, HttpsError) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  return normalizeDocumentId(value, 'Report image file ID', HttpsError, 300);
}

function normalizeCurrentReportImageFileId(value) {
  const id = text(value, 300);
  return id && !/[\\/]/.test(id) && !hasControlCharacter(id) ? id : '';
}

function normalizeReportImageSelectionRequest(data = {}, HttpsError) {
  return {
    eventId: normalizeDocumentId(data.eventId, 'Event ID', HttpsError, 128),
    fileId: normalizeOptionalReportImageFileId(data.fileId, HttpsError),
  };
}

function assertEligibleReportImageAttachment(fileId, snap, HttpsError) {
  if (!snap.exists) {
    throw makeError(HttpsError, 'not-found', 'Verified event attachment not found.');
  }
  if (snap.id !== fileId) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment is not valid.');
  }
  const attachment = snap.data() || {};
  if (attachment.storageProvider !== BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment storage is not valid.');
  }
  if (attachment.source !== BOD_EVENT_ATTACHMENT_SOURCE) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment source is not valid.');
  }
  if (!BOD_REPORT_IMAGE_MIME_TYPE_SET.has(cleanLower(attachment.mimeType, 120))) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment is not eligible as a report image.');
  }
  const sizeBytes = Number(attachment.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment size is not valid.');
  }
  if (!text(attachment.driveFolderId, 300)) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment folder is not valid.');
  }
  if (!/^[a-f0-9]{64}$/.test(String(attachment.sha256 || ''))) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment checksum is not valid.');
  }
}

function deleteField(admin) {
  const sentinel = admin?.firestore?.FieldValue?.delete?.();
  if (!sentinel) throw new Error('Firestore delete sentinel unavailable.');
  return sentinel;
}

function createBodReportImageSelectionService(options = {}) {
  const { db, admin, HttpsError } = options;
  if (!db || !admin || !HttpsError) {
    throw new Error('BOD report image selection service requires db, admin, and HttpsError.');
  }

  function eventRef(eventId) {
    return db.collection('bodEvents').doc(eventId);
  }

  function attachmentRef(eventId, fileId) {
    return eventRef(eventId).collection('attachments').doc(fileId);
  }

  async function setReportImage(actorUid, data = {}) {
    const uid = normalizeDocumentId(actorUid, 'Actor UID', HttpsError, 128);
    const request = normalizeReportImageSelectionRequest(data, HttpsError);

    return db.runTransaction(async (tx) => {
      const eventDocumentRef = eventRef(request.eventId);
      const eventSnap = await tx.get(eventDocumentRef);
      if (!eventSnap.exists) throw makeError(HttpsError, 'not-found', 'BOD event not found.');
      const event = normalizeAuthoritativeBodUploadEvent(
        request.eventId,
        eventSnap.data() || {},
        HttpsError
      );
      const currentFileId = normalizeCurrentReportImageFileId((eventSnap.data() || {}).reportImageFileId);

      if (!request.fileId) {
        if (!currentFileId) {
          return {
            ok: true,
            eventId: event.eventId,
            reportImageFileId: '',
            unchanged: true,
          };
        }
        tx.update(eventDocumentRef, {
          reportImageFileId: deleteField(admin),
          reportImageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          reportImageUpdatedByUid: uid,
        });
        return {
          ok: true,
          eventId: event.eventId,
          reportImageFileId: '',
          unchanged: false,
        };
      }

      const attachmentSnap = await tx.get(attachmentRef(event.eventId, request.fileId));
      assertEligibleReportImageAttachment(request.fileId, attachmentSnap, HttpsError);

      if (currentFileId === request.fileId) {
        return {
          ok: true,
          eventId: event.eventId,
          reportImageFileId: request.fileId,
          unchanged: true,
        };
      }

      tx.update(eventDocumentRef, {
        reportImageFileId: request.fileId,
        reportImageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reportImageUpdatedByUid: uid,
      });
      return {
        ok: true,
        eventId: event.eventId,
        reportImageFileId: request.fileId,
        unchanged: false,
      };
    });
  }

  return {
    setReportImage,
  };
}

module.exports = {
  BOD_REPORT_IMAGE_MIME_TYPES,
  createBodReportImageSelectionService,
  normalizeReportImageSelectionRequest,
};
