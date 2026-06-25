'use strict';

(function initVisitSubmissionUpload(global) {
  const DEFAULT_UPLOAD_WEB_APP_URL = '';

  function getUploadWebAppUrl() {
    return String(global.RCPH_VISIT_UPLOAD_WEB_APP_URL || DEFAULT_UPLOAD_WEB_APP_URL || '').trim();
  }

  function isUploadTransportConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\//.test(getUploadWebAppUrl());
  }

  async function uploadFileToTrustedAppsScript(file, session, sessionFile, onProgress) {
    const url = getUploadWebAppUrl();
    if (!isUploadTransportConfigured()) {
      throw new Error('Visit Submission Drive uploader is not configured yet.');
    }

    const formData = new FormData();
    formData.append('action', 'uploadVisitSubmissionFile');
    formData.append('uploadType', 'visitSubmission');
    formData.append('ticket', sessionFile.ticket);
    formData.append('sessionId', session.sessionId);
    formData.append('clientFileId', sessionFile.clientFileId);
    formData.append('fileName', sessionFile.fileName);
    formData.append('mimeType', sessionFile.mimeType);
    formData.append('sizeBytes', String(sessionFile.sizeBytes));
    formData.append('file', file, sessionFile.originalFileName || file.name);

    if (typeof onProgress === 'function') onProgress(10);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (typeof onProgress === 'function') onProgress(85);

    if (!response.ok) {
      throw new Error(`Drive upload failed with status ${response.status}.`);
    }

    const json = await response.json();
    if (!json || json.ok === false || json.status === 'error') {
      throw new Error(json?.message || 'Drive upload failed.');
    }
    if (!json.completionProof) {
      throw new Error('Trusted uploader did not return a completion proof.');
    }

    return {
      completionProof: json.completionProof,
      fileUrl: json.fileUrl || '',
    };
  }

  async function runSequentialUpload({ api, state, render, visitType, positionKey, files, replacesSubmissionId }) {
    if (!api) throw new Error('Visit Submission API is unavailable.');
    const folder = state.folderDetail?.folder || {};
    const queue = state.upload.queue;
    const validQueue = queue.filter(item => !item.validationError);
    if (!validQueue.length) {
      throw new Error('No valid files are ready to upload.');
    }

    state.upload.isUploading = true;
    state.upload.cancelled = false;
    state.upload.cancelAttempted = false;
    state.upload.summary = null;
    validQueue.forEach(item => {
      item.status = 'Preparing';
      item.progress = 2;
      item.message = 'Preparing upload session.';
    });
    render();

    const descriptors = validQueue.map(item => ({
      clientFileId: item.clientFileId,
      fileName: item.file.name,
      mimeType: item.file.type,
      sizeBytes: item.file.size,
    }));

    const session = replacesSubmissionId
      ? await api.replaceSubmission({ submissionId: replacesSubmissionId, files: descriptors })
      : await api.createUploadSession({ visitType, positionKey, files: descriptors });

    state.upload.activeSession = session;
    const approvedByClientId = new Map((session.files || []).map(item => [item.clientFileId, item]));

    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const item of validQueue) {
      if (state.upload.cancelled) {
        item.status = 'Cancelled';
        item.message = 'Cancelled before upload.';
        cancelled += 1;
        continue;
      }

      const approved = approvedByClientId.get(item.clientFileId);
      if (!approved) {
        item.status = 'Failed';
        item.message = 'Upload session did not include this file.';
        failed += 1;
        render();
        continue;
      }

      item.ticket = approved.ticket;
      item.approvedFileName = approved.fileName;
      item.status = 'Uploading';
      item.progress = 5;
      render();

      try {
        const trusted = await uploadFileToTrustedAppsScript(item.file, session, approved, (progress) => {
          item.progress = progress;
          render();
        });
        item.completionProof = trusted.completionProof;
        item.status = 'Finalizing';
        item.progress = 90;
        render();

        const finalized = await api.finalizeUpload({
          sessionId: session.sessionId,
          clientFileId: item.clientFileId,
          ticket: approved.ticket,
          completionProof: trusted.completionProof,
        });

        item.status = 'Completed';
        item.progress = 100;
        item.submissionId = finalized.submissionId || '';
        item.message = 'Upload finalized.';
        completed += 1;
      } catch (error) {
        item.status = 'Failed';
        item.message = error?.message || 'Upload failed.';
        failed += 1;
      }
      render();
    }

    let cancellationWarning = '';
    const needsReservationRelease = (failed > 0 || cancelled > 0)
      && state.upload.activeSession?.sessionId
      && state.upload.cancelAttempted !== true;
    if (needsReservationRelease) {
      try {
        state.upload.cancelAttempted = true;
        await api.cancelUploadSession({ sessionId: state.upload.activeSession.sessionId });
        state.upload.activeSession = null;
      } catch (error) {
        cancellationWarning = error?.message || 'Could not release remaining upload reservations.';
      }
    } else if (completed === validQueue.length && failed === 0 && cancelled === 0) {
      state.upload.activeSession = null;
    }

    state.upload.isUploading = false;
    state.upload.summary = { completed, failed, cancelled, warning: cancellationWarning };
    render();
    return state.upload.summary;
  }

  async function cancelActiveSession(api, state) {
    const sessionId = state.upload.activeSession?.sessionId;
    state.upload.cancelled = true;
    if (sessionId && state.upload.cancelAttempted !== true) {
      state.upload.cancelAttempted = true;
      await api.cancelUploadSession({ sessionId });
      state.upload.activeSession = null;
    }
  }

  global.RcphVisitUpload = Object.freeze({
    isUploadTransportConfigured,
    getUploadWebAppUrl,
    uploadFileToTrustedAppsScript,
    runSequentialUpload,
    cancelActiveSession,
  });
})(window);
