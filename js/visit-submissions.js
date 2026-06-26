'use strict';

(function initVisitSubmissionsPage(global) {
  const api = global.RcphVisitApi;
  const S = global.RcphVisitState;
  const U = global.RcphVisitUpload;
  const R = global.RcphVisitRender;
  const auth = global.auth;

  const els = {
    loading: document.getElementById('visitLoading'),
    message: document.getElementById('visitMessage'),
    messageTitle: document.getElementById('visitMessageTitle'),
    messageText: document.getElementById('visitMessageText'),
    messageActions: document.getElementById('visitMessageActions'),
    app: document.getElementById('visitApp'),
    content: document.getElementById('visitAppContent'),
    breadcrumb: document.getElementById('visitBreadcrumbTrail'),
    toastRegion: document.getElementById('visitToastRegion'),
    dialog: document.getElementById('visitDialog'),
    dialogTitle: document.getElementById('visitDialogTitle'),
    dialogBody: document.getElementById('visitDialogBody'),
    dialogClose: document.getElementById('visitDialogClose'),
    signOut: document.getElementById('visitSignOutBtn'),
  };
  const pageMain = document.querySelector('.visit-shell');
  let dialogReturnFocusEl = null;

  function setShell(state) {
    els.loading.hidden = state !== 'loading';
    els.message.hidden = state !== 'message';
    els.app.hidden = state !== 'app';
  }

  function toast(message, tone = '') {
    const node = document.createElement('div');
    node.className = `visit-toast ${tone ? `is-${tone}` : ''}`;
    node.textContent = message;
    els.toastRegion.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function showMessage(title, text, actionsHtml = '') {
    els.messageTitle.textContent = title;
    els.messageText.textContent = text;
    els.messageActions.innerHTML = actionsHtml;
    setShell('message');
  }

  function openDialog(title, bodyHtml) {
    dialogReturnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    els.dialogTitle.textContent = title;
    els.dialogBody.innerHTML = bodyHtml;
    if (pageMain && 'inert' in pageMain) pageMain.inert = true;
    els.dialog.setAttribute('aria-hidden', 'false');
    const first = getDialogFocusable(els.dialogBody)[0] || getDialogFocusable()[0] || els.dialogClose;
    if (first) first.focus();
  }

  function closeDialog() {
    els.dialog.setAttribute('aria-hidden', 'true');
    els.dialogBody.innerHTML = '';
    if (pageMain && 'inert' in pageMain) pageMain.inert = false;
    if (dialogReturnFocusEl && document.contains(dialogReturnFocusEl)) {
      dialogReturnFocusEl.focus();
    }
    dialogReturnFocusEl = null;
  }

  function getDialogFocusable(root = els.dialog) {
    return Array.from(root.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null);
  }

  function trapDialogTab(event) {
    const focusable = getDialogFocusable();
    if (!focusable.length) {
      event.preventDefault();
      els.dialogClose.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function routeLabel() {
    const route = S.state.route;
    if (!route.visitType) return '';
    const visit = S.getVisitDefinition(route.visitType);
    const parts = [`/ ${visit?.displayTitle || route.visitType}`];
    if (route.positionKey) {
      const folder = S.state.folderDetail?.folder || null;
      parts.push(`/ ${folder?.positionTitle || route.positionKey}`);
    }
    return parts.map(part => `<span>${R.escapeHtml(part)}</span>`).join(' ');
  }

  function renderBreadcrumb() {
    els.breadcrumb.innerHTML = routeLabel();
  }

  function maybeUninitializedError(error) {
    const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`;
    return error?.code === 'failed-precondition' && /not been initialized|incomplete|initialized/i.test(text);
  }

  async function canCurrentUserInitialize() {
    try {
      const callable = firebase.functions().httpsCallable('getMyAccess');
const result = await callable({});
const accessData = result?.data || {};

const roleData = accessData.role || null;
const userData = accessData.user || null;

const role = String(roleData?.role || '').toLowerCase();
const roleStatus = String(roleData?.status || '').toLowerCase();
const userStatus = String(userData?.status || '').toLowerCase();

const hasPresidentAuthority =
  accessData.authority?.hasPresidentAuthority === true;

return roleStatus === 'approved'
  && userStatus === 'approved'
  && (
    role === 'admin'
    || hasPresidentAuthority
  );
    } catch {
      return false;
    }
  }

  async function renderUninitialized(error) {
    const canInitialize = await canCurrentUserInitialize();
    els.content.innerHTML = R.renderUninitialized(canInitialize, error?.message);
    setShell('app');
    renderBreadcrumb();
  }

  async function loadDashboard(replaceRoute) {
    if (replaceRoute) S.setRoute('', '', true);
    setShell('loading');
    S.resetUploadState();
    try {
      const dashboard = await api.getDashboard();
      S.state.dashboard = dashboard;
      S.state.folders = null;
      S.state.folderDetail = null;
      S.state.currentVisitType = '';
      S.state.currentPositionKey = '';
      els.content.innerHTML = R.renderDashboard(dashboard);
      setShell('app');
      renderBreadcrumb();
    } catch (error) {
      if (maybeUninitializedError(error)) {
        await renderUninitialized(error);
        return;
      }
      if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
        showMessage('Access denied', error.message || 'You do not have Visit Submission access.', '<a class="btn btn-outline" href="access.html">Back to Access Hub</a>');
        return;
      }
      showMessage('Could not load Visit Submissions', error.message || 'Please try again later.');
    }
  }

  async function loadVisit(visitType, replaceRoute) {
    if (replaceRoute) S.setRoute(visitType, '', true);
    S.resetUploadState();
    setShell('loading');
    try {
      const data = await api.getFolders(visitType);
      S.state.folders = data;
      S.state.folderDetail = null;
      S.state.currentVisitType = visitType;
      S.state.currentPositionKey = '';
      els.content.innerHTML = R.renderVisitFolders(data);
      setShell('app');
      renderBreadcrumb();
    } catch (error) {
      if (maybeUninitializedError(error)) {
        await renderUninitialized(error);
        return;
      }
      showMessage('Could not load visit folders', error.message || 'Please try again.');
    }
  }

  async function loadFolder(visitType, positionKey, replaceRoute) {
    if (replaceRoute) S.setRoute(visitType, positionKey, true);
    setShell('loading');
    try {
      const data = await api.getFolder(visitType, positionKey);
      S.state.folderDetail = data;
      S.state.currentVisitType = visitType;
      S.state.currentPositionKey = positionKey;
      els.content.innerHTML = R.renderFolderDetail(data, S.state.upload);
      setShell('app');
      renderBreadcrumb();
      wireDropzoneEvents();
    } catch (error) {
      if (maybeUninitializedError(error)) {
        await renderUninitialized(error);
        return;
      }
      if (error.code === 'permission-denied') {
        showMessage('Folder access denied', error.message || 'You cannot open this position folder.', '<button class="btn btn-outline" type="button" data-route-dashboard>Back to Dashboard</button>');
        return;
      }
      showMessage('Could not load folder', error.message || 'Please try again.');
    }
  }

  function rerenderFolder() {
    if (S.state.folderDetail) {
      els.content.innerHTML = R.renderFolderDetail(S.state.folderDetail, S.state.upload);
    }
  }

  async function refreshCurrent() {
    const route = S.state.route;
    if (route.visitType && route.positionKey) {
      await loadFolder(route.visitType, route.positionKey, true);
    } else if (route.visitType) {
      await loadVisit(route.visitType, true);
    } else {
      await loadDashboard(true);
    }
  }

  function fileDescriptorsFromQueue() {
    return S.state.upload.queue
      .filter(item => !item.validationError)
      .map(item => ({
        clientFileId: item.clientFileId,
        fileName: item.file.name,
        mimeType: item.file.type,
        sizeBytes: item.file.size,
      }));
  }

  function addFilesToQueue(files, replacesSubmissionId) {
    const detail = S.state.folderDetail;
    const folder = detail?.folder || {};
    const incoming = S.makeQueueItems(files, folder, replacesSubmissionId);
    if (replacesSubmissionId && incoming.length !== 1) {
      toast('Replacement requires exactly one file.', 'error');
      return;
    }
    const currentKeys = new Set(S.state.upload.queue.map(item => `${item.fileName}:${item.sizeBytes}`));
    incoming.forEach(item => {
      const key = `${item.fileName}:${item.sizeBytes}`;
      if (currentKeys.has(key)) {
        item.status = 'Failed';
        item.validationError = 'Duplicate local file skipped.';
      }
      currentKeys.add(key);
    });
    S.state.upload.queue.push(...incoming);
    rerenderFolder();
  }

  async function startUpload(replacesSubmissionId) {
    const detail = S.state.folderDetail;
    const folder = detail?.folder || {};
    if (!folder.canUpload) {
      toast('This folder is not available for upload.', 'error');
      return;
    }
    if (!U.isUploadTransportConfigured()) {
      toast('Visit Submission Drive uploader is not configured yet.', 'error');
      return;
    }
    if (!fileDescriptorsFromQueue().length) {
      toast('Select at least one valid file.', 'error');
      return;
    }

    try {
      await U.runSequentialUpload({
        api,
        state: S.state,
        render: rerenderFolder,
        visitType: detail.visit.visitType,
        positionKey: folder.positionKey,
        files: S.state.upload.queue.map(item => item.file),
        replacesSubmissionId: replacesSubmissionId || S.state.upload.queue.find(item => item.replaceSubmissionId)?.replaceSubmissionId || '',
      });
      const summary = S.state.upload.summary;
      toast(`${summary.completed} uploaded, ${summary.failed} failed, ${summary.cancelled} cancelled.`);
      if (summary.warning) toast(summary.warning, 'error');
      await loadFolder(detail.visit.visitType, folder.positionKey, true);
    } catch (error) {
      S.state.upload.isUploading = false;
      rerenderFolder();
      toast(error.message || 'Upload failed.', 'error');
    }
  }

  async function initializeStructure(button) {
    const restore = setButtonBusy(button, 'Initializing...');
    try {
      const result = await api.initializeStructure();
      toast(`Initialized: ${result.createdConfigCount || 0} configs and ${result.createdPositionCount || 0} folders created.`);
      await loadDashboard(true);
    } catch (error) {
      toast(error.message || 'Initialization failed.', 'error');
    } finally {
      restore();
    }
  }

  function setButtonBusy(button, label) {
    if (!button) return () => {};
    const text = button.textContent;
    button.disabled = true;
    button.textContent = label;
    return () => {
      button.disabled = false;
      button.textContent = text;
    };
  }

  function boolFromForm(form, name) {
    return String(new FormData(form).get(name)) === 'true';
  }

  function showVisitSettings(visitType) {
    const dashboardVisit = (S.state.dashboard?.visits || []).find(v => v.visitType === visitType);
    const foldersVisit = S.state.folders?.visit?.visitType === visitType ? S.state.folders.visit : null;
    const folderVisit = S.state.folderDetail?.visit?.visitType === visitType ? S.state.folderDetail.visit : null;
    const visit = folderVisit || foldersVisit || dashboardVisit;
    if (!visit) return toast('Visit settings are not loaded yet.', 'error');
    openDialog('Visit settings', R.renderVisitSettingsForm(visit));
  }

  function showFolderSettings(visitType, positionKey) {
    const folder = S.state.folderDetail?.folder?.positionKey === positionKey
      ? S.state.folderDetail.folder
      : (S.state.folders?.folders || []).find(item => item.visitType === visitType && item.positionKey === positionKey);
    if (!folder) return toast('Folder settings are not loaded yet.', 'error');
    openDialog('Folder settings', R.renderFolderSettingsForm(folder));
  }

  async function saveVisitSettings(form) {
    const fd = new FormData(form);
    const payload = {
      visitType: fd.get('visitType'),
      description: String(fd.get('description') || ''),
      enabled: boolFromForm(form, 'enabled'),
      submissionOpen: boolFromForm(form, 'submissionOpen'),
      visitDate: R.isoOrNull(fd.get('visitDate')),
      submissionDeadline: R.isoOrNull(fd.get('submissionDeadline')),
      instructions: String(fd.get('instructions') || ''),
    };
    const button = form.querySelector('button[type="submit"]');
    const restore = setButtonBusy(button, 'Saving...');
    try {
      const result = await api.updateVisitConfig(payload);
      toast(result.changedFields?.length ? 'Visit settings saved.' : 'No visit settings changed.');
      closeDialog();
      await refreshCurrent();
    } catch (error) {
      toast(error.message || 'Could not save visit settings.', 'error');
    } finally {
      restore();
    }
  }

  async function saveFolderSettings(form) {
    const fd = new FormData(form);
    const locked = boolFromForm(form, 'locked');
    const maxFileSizeMb = Number(fd.get('maxFileSizeMb') || 25);
    const payload = {
      visitType: fd.get('visitType'),
      positionKey: fd.get('positionKey'),
      enabled: boolFromForm(form, 'enabled'),
      submissionOpen: boolFromForm(form, 'submissionOpen'),
      locked,
      lockReason: locked ? String(fd.get('lockReason') || '') : '',
      maxActiveFiles: Number(fd.get('maxActiveFiles') || 40),
      maxFilesPerSelection: Number(fd.get('maxFilesPerSelection') || 10),
      maxFileSizeBytes: Math.round(maxFileSizeMb * 1024 * 1024),
    };
    const button = form.querySelector('button[type="submit"]');
    const restore = setButtonBusy(button, 'Saving...');
    try {
      const result = await api.updateFolderConfig(payload);
      toast(result.changedFields?.length ? 'Folder settings saved.' : 'No folder settings changed.');
      closeDialog();
      await refreshCurrent();
    } catch (error) {
      toast(error.message || 'Could not save folder settings.', 'error');
    } finally {
      restore();
    }
  }

  function confirmWithdraw(submissionId) {
    openDialog('Withdraw submission', `
      <p>This removes the file from the active submission list but keeps its audit history.</p>
      <div class="visit-actions">
        <button class="btn btn-outline" type="button" data-dialog-cancel>Cancel</button>
        <button class="btn" type="button" data-confirm-withdraw="${R.escapeHtml(submissionId)}">Withdraw</button>
      </div>
    `);
  }

  async function withdrawSubmission(button, submissionId) {
    const restore = setButtonBusy(button, 'Withdrawing...');
    try {
      await api.withdrawSubmission({ submissionId });
      closeDialog();
      toast('Submission withdrawn.');
      await refreshCurrent();
    } catch (error) {
      toast(error.message || 'Could not withdraw submission.', 'error');
    } finally {
      restore();
    }
  }

  function confirmRemove(submissionId) {
    openDialog('Remove submission', `
      <form data-remove-submission-form>
        <p>This removes the file from the active submission list and keeps the audit history. The Drive file is not permanently deleted.</p>
        <label class="visit-field"><span>Reason</span><textarea name="reason" required></textarea></label>
        <div class="visit-actions" style="margin-top:12px;">
          <button class="btn btn-outline" type="button" data-dialog-cancel>Cancel</button>
          <button class="btn" type="submit" data-submission-id="${R.escapeHtml(submissionId)}">Remove</button>
        </div>
      </form>
    `);
  }

  async function removeSubmission(form) {
    const button = form.querySelector('button[type="submit"]');
    const reason = String(new FormData(form).get('reason') || '').trim();
    const submissionId = button?.dataset.submissionId || '';
    if (!reason) {
      toast('Enter a removal reason.', 'error');
      return;
    }
    const restore = setButtonBusy(button, 'Removing...');
    try {
      await api.removeSubmission({ submissionId, reason });
      closeDialog();
      toast('Submission removed.');
      await refreshCurrent();
    } catch (error) {
      toast(error.message || 'Could not remove submission.', 'error');
    } finally {
      restore();
    }
  }

  function openReplaceDialog(submissionId) {
    openDialog('Replace submission', `
      <form data-replace-submission-form>
        <p>Select exactly one replacement file. The old file remains active until the new upload finalizes.</p>
        <label class="visit-field"><span>Replacement file</span><input name="replacementFile" type="file" accept="${S.ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}" required></label>
        <div class="visit-actions" style="margin-top:12px;">
          <button class="btn btn-outline" type="button" data-dialog-cancel>Cancel</button>
          <button class="btn" type="submit" data-submission-id="${R.escapeHtml(submissionId)}">Upload replacement</button>
        </div>
      </form>
    `);
  }

  async function replaceSubmission(form) {
    const input = form.querySelector('input[type="file"]');
    const file = input?.files?.[0] || null;
    const submissionId = form.querySelector('button[type="submit"]')?.dataset.submissionId || '';
    if (!file || input.files.length !== 1) {
      toast('Replacement requires exactly one file.', 'error');
      return;
    }
    closeDialog();
    S.resetUploadState();
    addFilesToQueue([file], submissionId);
    await startUpload(submissionId);
  }

  async function reconcileFolder(button, visitType, positionKey) {
    const restore = setButtonBusy(button, 'Reconciling...');
    try {
      const result = await api.reconcileFolder({ visitType, positionKey });
      toast(`Counts repaired: ${result.activeFileCount} active, ${result.reservedFileCount} reserved.`);
      await refreshCurrent();
    } catch (error) {
      toast(error.message || 'Could not reconcile file counts.', 'error');
    } finally {
      restore();
    }
  }

  async function cleanExpired(button) {
    const restore = setButtonBusy(button, 'Cleaning...');
    try {
      const result = await api.cleanupExpiredSessions({ limit: 25 });
      toast(`Expired sessions: ${result.expiredSessionCount || 0}; reservations released: ${result.releasedReservations || 0}.`);
    } catch (error) {
      toast(error.message || 'Could not clean expired sessions.', 'error');
    } finally {
      restore();
    }
  }

  function confirmMaintenanceAction(title, message, actionName, payload) {
    openDialog(title, `
      <p>${R.escapeHtml(message)}</p>
      <div class="visit-actions">
        <button class="btn btn-outline" type="button" data-dialog-cancel>Cancel</button>
        <button class="btn" type="button" data-confirm-maintenance="${R.escapeHtml(actionName)}" data-payload="${R.escapeHtml(JSON.stringify(payload || {}))}">Confirm</button>
      </div>
    `);
  }

  async function loadModeration(form, append) {
    const fd = form ? new FormData(form) : null;
    if (fd) {
      S.state.moderation.filters = {
        visitType: String(fd.get('visitType') || ''),
        positionKey: String(fd.get('positionKey') || '').trim(),
        status: String(fd.get('status') || 'active'),
      };
      S.state.moderation.nextCursor = null;
      if (!append) S.state.moderation.rows = [];
    }
    S.state.moderation.loading = true;
    rerenderDashboardOrCurrent();
    try {
      const result = await api.getModerationData({
        ...S.state.moderation.filters,
        limit: 25,
        cursor: append ? S.state.moderation.nextCursor : null,
      });
      S.state.moderation.rows = append
        ? S.state.moderation.rows.concat(result.submissions || [])
        : (result.submissions || []);
      S.state.moderation.nextCursor = result.nextCursor || null;
      S.state.moderation.hasMore = result.hasMore === true;
    } catch (error) {
      toast(error.message || 'Could not load moderation data.', 'error');
    } finally {
      S.state.moderation.loading = false;
      rerenderDashboardOrCurrent();
    }
  }

  function rerenderDashboardOrCurrent() {
    if (!S.state.route.visitType && S.state.dashboard) {
      els.content.innerHTML = R.renderDashboard(S.state.dashboard);
    }
  }

  function wireDropzoneEvents() {
    const dropzone = document.querySelector('[data-dropzone]');
    const input = document.getElementById('visitFileInput');
    if (!dropzone || !input) return;
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragging');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
      addFilesToQueue(event.dataTransfer?.files || []);
    });
  }

  async function onClick(event) {
    const target = event.target;
    const dashboardBtn = target.closest('[data-route-dashboard]');
    if (dashboardBtn) {
      S.setRoute('', '', false);
      loadDashboard(false);
      return;
    }

    const initBtn = target.closest('[data-initialize-visit-system]');
    if (initBtn) return initializeStructure(initBtn);

    const openVisit = target.closest('[data-open-visit]');
    if (openVisit) {
      const visitType = openVisit.dataset.openVisit;
      S.setRoute(visitType, '', false);
      loadVisit(visitType, false);
      return;
    }

    const viewVisitSubmissions = target.closest('[data-view-visit-submissions]');
    if (viewVisitSubmissions) {
      const visitType = viewVisitSubmissions.dataset.viewVisitSubmissions;
      if (S.state.dashboard?.access?.canManage) {
        S.state.moderation.filters = { visitType, positionKey: '', status: 'active' };
        S.state.moderation.rows = [];
        S.state.moderation.nextCursor = null;
        S.state.moderation.hasMore = false;
        rerenderDashboardOrCurrent();
        const form = document.querySelector('[data-moderation-form]');
        if (form) loadModeration(form, false);
      } else {
        S.setRoute(visitType, '', false);
        loadVisit(visitType, false);
      }
      return;
    }

    const openFolder = target.closest('[data-open-folder]');
    if (openFolder) {
      const [visitType, positionKey] = openFolder.dataset.openFolder.split(':');
      S.setRoute(visitType, positionKey, false);
      loadFolder(visitType, positionKey, false);
      return;
    }

    const manageVisit = target.closest('[data-manage-visit]');
    if (manageVisit) return showVisitSettings(manageVisit.dataset.manageVisit);

    const manageFolder = target.closest('[data-manage-folder]');
    if (manageFolder) {
      const [visitType, positionKey] = manageFolder.dataset.manageFolder.split(':');
      return showFolderSettings(visitType, positionKey);
    }

    const pickFiles = target.closest('[data-pick-files]');
    if (pickFiles) return document.getElementById('visitFileInput')?.click();

    const removeQueued = target.closest('[data-remove-queued-file]');
    if (removeQueued) {
      S.state.upload.queue = S.state.upload.queue.filter(item => item.clientFileId !== removeQueued.dataset.removeQueuedFile);
      rerenderFolder();
      return;
    }

    const startUploadBtn = target.closest('[data-start-upload]');
    if (startUploadBtn) return startUpload();

    const cancelUpload = target.closest('[data-cancel-upload]');
    if (cancelUpload) {
      U.cancelActiveSession(api, S.state)
        .then(() => toast('Remaining upload reservations cancelled.'))
        .catch(error => toast(error.message || 'Could not cancel session.', 'error'))
        .finally(rerenderFolder);
      return;
    }

    const clearUpload = target.closest('[data-clear-upload]');
    if (clearUpload) {
      S.resetUploadState();
      rerenderFolder();
      return;
    }

    const withdraw = target.closest('[data-withdraw-submission]');
    if (withdraw) return confirmWithdraw(withdraw.dataset.withdrawSubmission);

    const remove = target.closest('[data-remove-submission]');
    if (remove) return confirmRemove(remove.dataset.removeSubmission);

    const replace = target.closest('[data-replace-submission]');
    if (replace) return openReplaceDialog(replace.dataset.replaceSubmission);

    const confirmWithdrawBtn = target.closest('[data-confirm-withdraw]');
    if (confirmWithdrawBtn) return withdrawSubmission(confirmWithdrawBtn, confirmWithdrawBtn.dataset.confirmWithdraw);

    const reconcile = target.closest('[data-reconcile-folder]');
    if (reconcile) {
      const [visitType, positionKey] = reconcile.dataset.reconcileFolder.split(':');
      return confirmMaintenanceAction(
        'Reconcile file counts',
        'Reconcile active and reserved file counts for this folder?',
        'reconcile',
        { visitType, positionKey }
      );
    }

    const cleanBtn = target.closest('[data-clean-expired]');
    if (cleanBtn) {
      return confirmMaintenanceAction(
        'Clean expired upload sessions',
        'Clean expired upload sessions and release unused reservations?',
        'cleanExpired',
        {}
      );
    }

    const maintenanceBtn = target.closest('[data-confirm-maintenance]');
    if (maintenanceBtn) {
      const action = maintenanceBtn.dataset.confirmMaintenance;
      let payload = {};
      try {
        payload = JSON.parse(maintenanceBtn.dataset.payload || '{}');
      } catch {
        payload = {};
      }
      if (action === 'reconcile') {
        await reconcileFolder(maintenanceBtn, payload.visitType, payload.positionKey);
        closeDialog();
      } else if (action === 'cleanExpired') {
        await cleanExpired(maintenanceBtn);
        closeDialog();
      }
      return;
    }

    const loadMore = target.closest('[data-load-more-moderation]');
    if (loadMore) {
      const form = document.querySelector('[data-moderation-form]');
      return loadModeration(form, true);
    }

    if (target.closest('[data-dialog-cancel]')) closeDialog();
  }

  function onChange(event) {
    if (event.target.id === 'visitFileInput') {
      addFilesToQueue(event.target.files || []);
      event.target.value = '';
    }

    if (event.target.matches('[name="locked"]')) {
      const reason = event.target.form?.querySelector('[name="lockReason"]');
      if (reason && event.target.value === 'false') reason.value = '';
    }
  }

  function onSubmit(event) {
    const visitSettings = event.target.closest('[data-visit-settings-form]');
    if (visitSettings) {
      event.preventDefault();
      saveVisitSettings(visitSettings);
      return;
    }

    const folderSettings = event.target.closest('[data-folder-settings-form]');
    if (folderSettings) {
      event.preventDefault();
      saveFolderSettings(folderSettings);
      return;
    }

    const removeForm = event.target.closest('[data-remove-submission-form]');
    if (removeForm) {
      event.preventDefault();
      removeSubmission(removeForm);
      return;
    }

    const replaceForm = event.target.closest('[data-replace-submission-form]');
    if (replaceForm) {
      event.preventDefault();
      replaceSubmission(replaceForm);
      return;
    }

    const moderationForm = event.target.closest('[data-moderation-form]');
    if (moderationForm) {
      event.preventDefault();
      loadModeration(moderationForm, false);
    }
  }

  function wireEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', (event) => {
      if (els.dialog.getAttribute('aria-hidden') !== 'false') return;
      if (event.key === 'Tab') trapDialogTab(event);
      if (event.key === 'Escape') closeDialog();
    });
    els.dialogClose.addEventListener('click', closeDialog);
    els.dialog.addEventListener('click', (event) => {
      if (event.target === els.dialog) closeDialog();
    });
    els.signOut.addEventListener('click', async () => {
      await auth.signOut();
      global.location.href = 'login.html';
    });
    global.addEventListener('popstate', () => {
      const route = S.parseRoute(global.location.search);
      S.state.route = route;
      if (route.visitType && route.positionKey) loadFolder(route.visitType, route.positionKey, true);
      else if (route.visitType) loadVisit(route.visitType, true);
      else loadDashboard(true);
    });
  }

  function startFromRoute() {
    const route = S.parseRoute(global.location.search);
    S.state.route = route;
    if (route.visitType && route.positionKey) return loadFolder(route.visitType, route.positionKey, true);
    if (route.visitType) return loadVisit(route.visitType, true);
    return loadDashboard(true);
  }

  function init() {
    wireEvents();
    auth.onAuthStateChanged((user) => {
      if (!user) {
        global.location.href = 'login.html';
        return;
      }
      S.state.user = user;
      startFromRoute().then(wireDropzoneEvents);
    });
  }

  const originalRerenderFolder = rerenderFolder;
  rerenderFolder = function rerenderFolderAndWire() {
    originalRerenderFolder();
    wireDropzoneEvents();
  };

  init();
})(window);
