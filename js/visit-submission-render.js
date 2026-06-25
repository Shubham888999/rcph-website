'use strict';

(function initVisitSubmissionRender(global) {
  const S = global.RcphVisitState;

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function badge(label, state) {
    return `<span class="visit-badge ${state ? `is-${state}` : ''}">${escapeHtml(label)}</span>`;
  }

  function statusBadges(item) {
    const badges = [];
    badges.push(badge(item.enabled === false ? 'Disabled' : 'Enabled', item.enabled === false ? 'disabled' : 'enabled'));
    badges.push(badge(item.submissionOpen === false ? 'Closed' : 'Open', item.submissionOpen === false ? 'closed' : 'open'));
    if (item.locked) badges.push(badge('Locked', 'locked'));
    return badges.join('');
  }

  function dateLine(label, value) {
    if (!value) return '';
    return `<div class="visit-muted"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(S.formatDate(value))}</div>`;
  }

  function renderDashboard(data) {
    const access = data?.access || {};
    const visits = data?.visits || [];
    return `
      <section class="visit-panel">
        <div class="visit-panel__head">
          <div>
            <h2>Submission Dashboard</h2>
            <p class="visit-muted">Use the three visit cards to open folders, upload files, and review submission progress.</p>
          </div>
          <div class="visit-badges">
            ${badge(access.role || 'Role', access.canManage ? 'manager' : '')}
            ${access.canManage ? badge('Manager controls enabled', 'manager') : ''}
          </div>
        </div>
        <div class="visit-grid">
          ${visits.map(visit => `
            <article class="visit-card" data-visit-card="${escapeHtml(visit.visitType)}">
              <div>
                <div class="visit-badges">${statusBadges(visit)}</div>
                <h3>${escapeHtml(visit.displayTitle)}</h3>
                <p class="visit-muted">${escapeHtml(visit.description || 'Visit submission workspace')}</p>
                ${dateLine('Visit date', visit.visitDate)}
                ${dateLine('Deadline', visit.submissionDeadline)}
              </div>
              <div class="visit-stat-grid">
                <div class="visit-stat"><span>Accessible</span><strong>${Number(visit.accessiblePositionCount || 0)}</strong></div>
                <div class="visit-stat"><span>Total</span><strong>${Number(visit.totalPositionCount || 0)}</strong></div>
                <div class="visit-stat"><span>Active files</span><strong>${Number(visit.activeSubmissionCount || 0)}</strong></div>
                <div class="visit-stat"><span>Locked</span><strong>${Number(visit.lockedPositionCount || 0)}</strong></div>
              </div>
              <div class="visit-actions">
                <button class="btn" type="button" data-open-visit="${escapeHtml(visit.visitType)}">Open folders</button>
                <button class="btn btn-outline" type="button" data-view-visit-submissions="${escapeHtml(visit.visitType)}">View submissions</button>
                ${access.canManage ? `<button class="btn btn-outline" type="button" data-manage-visit="${escapeHtml(visit.visitType)}">Manage settings</button>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
        ${access.canManage ? `
          <div class="visit-manager-panel" style="margin-top:16px;">
            <div class="visit-section-head">
              <div>
                <h3>System Maintenance</h3>
                <p class="visit-muted">Use these actions only when setting up or repairing Visit Submission data.</p>
              </div>
              <button class="btn btn-outline" type="button" data-clean-expired>Clean expired upload sessions</button>
            </div>
            <div id="visitModerationMount">${renderModerationPanel(data)}</div>
          </div>
        ` : ''}
      </section>
    `;
  }

  function renderUninitialized(canInitialize, message) {
    return `
      <section class="visit-state-card">
        <h2>Visit Submission system has not been initialized</h2>
        <p>${escapeHtml(message || 'The Visit Submission structure has not been initialized yet.')}</p>
        ${canInitialize ? `
          <div class="visit-actions inline">
            <button class="btn" type="button" data-initialize-visit-system>Initialize Visit Submission System</button>
          </div>
        ` : ''}
      </section>
    `;
  }

  function renderVisitFolders(data) {
    const visit = data?.visit || {};
    const folders = data?.folders || [];
    const access = data?.access || {};
    const closed = visit.enabled === false || visit.submissionOpen === false;
    return `
      <section class="visit-panel">
        <div class="visit-panel__head">
          <div>
            <h2>${escapeHtml(visit.displayTitle || 'Visit')}</h2>
            <p class="visit-muted">${escapeHtml(visit.description || 'Position folders for this visit.')}</p>
            ${dateLine('Visit date', visit.visitDate)}
            ${dateLine('Deadline', visit.submissionDeadline)}
          </div>
          <div class="visit-actions">
            ${access.canManage ? `<button class="btn btn-outline" type="button" data-manage-visit="${escapeHtml(visit.visitType)}">Visit settings</button>` : ''}
          </div>
        </div>
        <div class="visit-status-banner ${closed ? 'is-warning' : ''}">
          ${closed ? 'This visit is not currently open for all submissions.' : 'This visit is open according to the current backend configuration.'}
          ${visit.instructions ? `<div>${escapeHtml(visit.instructions)}</div>` : ''}
        </div>
        ${folders.length ? `
          <div class="visit-folder-grid">
            ${folders.map(folder => renderFolderCard(folder, access)).join('')}
          </div>
        ` : '<div class="visit-empty">No accessible folders were returned for this visit.</div>'}
      </section>
    `;
  }

  function renderFolderCard(folder, access) {
    const remaining = Math.max(0, Number(folder.maxActiveFiles || 0) - Number(folder.activeFileCount || 0));
    return `
      <article class="visit-folder-card">
        <div>
          <div class="visit-badges">${statusBadges(folder)}</div>
          <h3>${escapeHtml(folder.positionTitle)}</h3>
          <p class="visit-muted">${escapeHtml(folder.avenueCode || folder.positionKey)}</p>
          ${folder.lockReason ? `<p class="visit-muted"><strong>Reason:</strong> ${escapeHtml(folder.lockReason)}</p>` : ''}
        </div>
        <div class="visit-stat-grid">
          <div class="visit-stat"><span>Files</span><strong>${Number(folder.activeFileCount || 0)}/${Number(folder.maxActiveFiles || 0)}</strong></div>
          <div class="visit-stat"><span>Remaining</span><strong>${remaining}</strong></div>
        </div>
        <div class="visit-actions">
          ${folder.canOpen ? `<button class="btn" type="button" data-open-folder="${escapeHtml(folder.visitType)}:${escapeHtml(folder.positionKey)}">Open folder</button>` : ''}
          ${access.canManage || folder.canManage ? `<button class="btn btn-outline" type="button" data-manage-folder="${escapeHtml(folder.visitType)}:${escapeHtml(folder.positionKey)}">Settings</button>` : ''}
        </div>
      </article>
    `;
  }

  function uploadUnavailableReason(visit, folder) {
    if (!folder.canOpen) return 'You do not have permission to open this folder.';
    if (visit.enabled === false) return 'The visit is disabled.';
    if (visit.submissionOpen === false) return 'Submissions are closed for this visit.';
    if (folder.enabled === false) return 'This folder is disabled.';
    if (folder.submissionOpen === false) return 'Submissions are closed for this folder.';
    if (folder.locked) return folder.lockReason || 'This folder is locked.';
    if (Number(folder.activeFileCount || 0) >= Number(folder.maxActiveFiles || 0)) return 'This folder is at maximum active-file capacity.';
    return 'Uploading is not available for this folder.';
  }

  function renderFolderDetail(data, uploadState) {
    const visit = data?.visit || {};
    const folder = data?.folder || {};
    const access = data?.access || {};
    const submissions = data?.submissions || [];
    const remaining = Math.max(0, Number(folder.maxActiveFiles || 0) - Number(folder.activeFileCount || 0));
    return `
      <section class="visit-folder-header">
        <div class="visit-folder-header__main">
          <div>
            <h2>${escapeHtml(visit.displayTitle || folder.visitType)} - ${escapeHtml(folder.positionTitle || folder.positionKey)}</h2>
            <p class="visit-muted">${escapeHtml(folder.avenueCode || '')}</p>
            <div class="visit-badges">${statusBadges(visit)}${statusBadges(folder)}${access.canManage ? badge('Manager', 'manager') : ''}</div>
            ${folder.lockReason ? `<p class="visit-muted"><strong>Lock reason:</strong> ${escapeHtml(folder.lockReason)}</p>` : ''}
            ${dateLine('Deadline', visit.submissionDeadline)}
          </div>
          <div class="visit-stat-grid">
            <div class="visit-stat"><span>Active files</span><strong>${Number(folder.activeFileCount || 0)}</strong></div>
            <div class="visit-stat"><span>Maximum</span><strong>${Number(folder.maxActiveFiles || 0)}</strong></div>
            <div class="visit-stat"><span>Remaining</span><strong>${remaining}</strong></div>
            <div class="visit-stat"><span>Per selection</span><strong>${Number(folder.maxFilesPerSelection || 0)}</strong></div>
          </div>
        </div>
        <div class="visit-actions">
          ${access.canManage ? `<button class="btn btn-outline" type="button" data-manage-folder="${escapeHtml(folder.visitType)}:${escapeHtml(folder.positionKey)}">Folder settings</button>` : ''}
          ${access.canManage ? `<button class="btn btn-outline" type="button" data-reconcile-folder="${escapeHtml(folder.visitType)}:${escapeHtml(folder.positionKey)}">Reconcile file counts</button>` : ''}
        </div>
      </section>

      <section class="visit-panel">
        <div class="visit-section-head">
          <div>
            <h2>Upload Files</h2>
            <p class="visit-upload-limits">Up to ${Number(folder.maxFilesPerSelection || 0)} files per selection, ${S.humanBytes(folder.maxFileSizeBytes)} each. ${remaining} active slot${remaining === 1 ? '' : 's'} remaining.</p>
          </div>
        </div>
        ${folder.canUpload ? renderUploadArea(folder, uploadState) : `<div class="visit-status-banner is-warning">${escapeHtml(uploadUnavailableReason(visit, folder))}</div>`}
      </section>

      <section class="visit-panel">
        <div class="visit-section-head">
          <h2>Active Submissions</h2>
        </div>
        ${submissions.length ? `<div class="visit-submission-list">${submissions.map(item => renderSubmission(item, access)).join('')}</div>` : '<div class="visit-empty">No active files in this folder yet.</div>'}
      </section>
    `;
  }

  function renderUploadArea(folder, uploadState) {
    const accept = S.ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',');
    const isUploading = uploadState.isUploading;
    return `
      <div class="visit-dropzone" data-dropzone>
        <input id="visitFileInput" type="file" multiple accept="${accept}">
        <p><strong>Drop files here</strong> or</p>
        <button class="btn btn-outline" type="button" data-pick-files>Select files</button>
      </div>
      <div class="visit-queue" aria-live="polite">
        ${uploadState.queue.length ? uploadState.queue.map(renderQueueItem).join('') : '<div class="visit-empty">No files selected.</div>'}
      </div>
      ${uploadState.summary ? `<div class="visit-status-banner ${uploadState.summary.warning ? 'is-warning' : ''}">${uploadState.summary.completed} uploaded successfully, ${uploadState.summary.failed} failed, ${uploadState.summary.cancelled} cancelled.${uploadState.summary.warning ? ` ${escapeHtml(uploadState.summary.warning)}` : ''}</div>` : ''}
      <div class="visit-actions" style="margin-top:14px;">
        <button class="btn" type="button" data-start-upload ${isUploading || !uploadState.queue.length ? 'disabled' : ''}>${isUploading ? 'Uploading...' : 'Start upload'}</button>
        <button class="btn btn-outline" type="button" data-cancel-upload ${!isUploading ? 'disabled' : ''}>Cancel remaining uploads</button>
        <button class="btn btn-outline" type="button" data-clear-upload ${isUploading ? 'disabled' : ''}>Clear queue</button>
      </div>
    `;
  }

  function renderQueueItem(item) {
    const tone = item.validationError || item.status === 'Failed' ? 'is-error' : '';
    return `
      <div class="visit-queue-item ${tone}">
        <div>
          <strong>${escapeHtml(item.fileName)}</strong>
          <div class="visit-submission-meta">${escapeHtml(item.mimeType || 'Unknown')} - ${S.humanBytes(item.sizeBytes)} - ${escapeHtml(item.validationError || item.message || item.status)}</div>
          <div class="visit-progress" aria-label="Upload progress"><i style="width:${Math.max(0, Math.min(100, Number(item.progress || 0)))}%"></i></div>
        </div>
        <div class="visit-actions">
          <span class="visit-badge">${escapeHtml(item.status)}</span>
          ${item.status === 'Queued' || item.validationError ? `<button class="visit-icon-button" type="button" data-remove-queued-file="${escapeHtml(item.clientFileId)}" aria-label="Remove ${escapeHtml(item.fileName)}">&times;</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderSubmission(item, access) {
    return `
      <article class="visit-submission-card">
        <div>
          <h4>${escapeHtml(item.fileName || item.originalFileName || 'Submission')}</h4>
          <div class="visit-submission-meta">
            ${escapeHtml(item.mimeType || 'File')} - ${S.humanBytes(item.sizeBytes)} - uploaded by ${escapeHtml(item.uploadedByName || item.uploadedByUid || 'Member')} - ${escapeHtml(S.formatDate(item.createdAt))}
          </div>
          <div class="visit-badges">${badge(item.status || 'active')}</div>
        </div>
        <div class="visit-actions">
          ${item.fileUrl ? `<a class="btn btn-outline" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener">Open File</a>` : ''}
          ${item.canReplace === true ? `<button class="btn btn-outline" type="button" data-replace-submission="${escapeHtml(item.submissionId)}">Replace</button>` : ''}
          ${item.canWithdraw === true ? `<button class="btn btn-outline" type="button" data-withdraw-submission="${escapeHtml(item.submissionId)}">Withdraw</button>` : ''}
          ${item.canRemove === true ? `<button class="btn btn-outline" type="button" data-remove-submission="${escapeHtml(item.submissionId)}">Remove</button>` : ''}
        </div>
      </article>
    `;
  }

  function renderVisitSettingsForm(visit) {
    return `
      <form class="visit-form-grid" data-visit-settings-form>
        <input type="hidden" name="visitType" value="${escapeHtml(visit.visitType)}">
        <label class="visit-field is-wide"><span>Description</span><textarea name="description">${escapeHtml(visit.description || '')}</textarea></label>
        <label class="visit-field"><span>Enabled</span><select name="enabled"><option value="true" ${visit.enabled !== false ? 'selected' : ''}>Enabled</option><option value="false" ${visit.enabled === false ? 'selected' : ''}>Disabled</option></select></label>
        <label class="visit-field"><span>Submissions open</span><select name="submissionOpen"><option value="true" ${visit.submissionOpen !== false ? 'selected' : ''}>Open</option><option value="false" ${visit.submissionOpen === false ? 'selected' : ''}>Closed</option></select></label>
        <label class="visit-field"><span>Visit date</span><input name="visitDate" type="datetime-local" value="${escapeHtml(datetimeLocalValue(visit.visitDate))}"></label>
        <label class="visit-field"><span>Submission deadline</span><input name="submissionDeadline" type="datetime-local" value="${escapeHtml(datetimeLocalValue(visit.submissionDeadline))}"></label>
        <label class="visit-field is-wide"><span>Instructions</span><textarea name="instructions">${escapeHtml(visit.instructions || '')}</textarea></label>
        <div class="visit-actions"><button class="btn" type="submit">Save visit settings</button></div>
      </form>
    `;
  }

  function renderFolderSettingsForm(folder) {
    return `
      <form class="visit-form-grid" data-folder-settings-form>
        <input type="hidden" name="visitType" value="${escapeHtml(folder.visitType)}">
        <input type="hidden" name="positionKey" value="${escapeHtml(folder.positionKey)}">
        <label class="visit-field"><span>Enabled</span><select name="enabled"><option value="true" ${folder.enabled !== false ? 'selected' : ''}>Enabled</option><option value="false" ${folder.enabled === false ? 'selected' : ''}>Disabled</option></select></label>
        <label class="visit-field"><span>Submissions open</span><select name="submissionOpen"><option value="true" ${folder.submissionOpen !== false ? 'selected' : ''}>Open</option><option value="false" ${folder.submissionOpen === false ? 'selected' : ''}>Closed</option></select></label>
        <label class="visit-field"><span>Locked</span><select name="locked"><option value="false" ${folder.locked !== true ? 'selected' : ''}>Unlocked</option><option value="true" ${folder.locked === true ? 'selected' : ''}>Locked</option></select></label>
        <label class="visit-field"><span>Lock reason</span><input name="lockReason" value="${escapeHtml(folder.lockReason || '')}"></label>
        <label class="visit-field"><span>Max active files</span><input name="maxActiveFiles" type="number" min="1" max="100" value="${Number(folder.maxActiveFiles || 40)}"></label>
        <label class="visit-field"><span>Max files per selection</span><input name="maxFilesPerSelection" type="number" min="1" max="10" value="${Number(folder.maxFilesPerSelection || 10)}"></label>
        <label class="visit-field"><span>Max file size (MB)</span><input name="maxFileSizeMb" type="number" min="1" max="25" value="${Math.round(Number(folder.maxFileSizeBytes || 26214400) / 1048576)}"></label>
        <div class="visit-actions"><button class="btn" type="submit">Save folder settings</button></div>
      </form>
    `;
  }

  function renderModerationPanel(data) {
    const visits = data?.visits || [];
    const moderation = S.state.moderation;
    return `
      <section>
        <div class="visit-section-head">
          <div>
            <h3>Moderation</h3>
            <p class="visit-muted">Review submissions in bounded pages.</p>
          </div>
        </div>
        <form class="visit-moderation-filters" data-moderation-form>
          <label class="visit-field"><span>Visit</span><select name="visitType"><option value="">All visits</option>${visits.map(v => `<option value="${escapeHtml(v.visitType)}" ${moderation.filters.visitType === v.visitType ? 'selected' : ''}>${escapeHtml(v.displayTitle)}</option>`).join('')}</select></label>
          <label class="visit-field"><span>Position key</span><input name="positionKey" value="${escapeHtml(moderation.filters.positionKey || '')}" placeholder="secretary"></label>
          <label class="visit-field"><span>Status</span><select name="status">${['active', 'replaced', 'admin-removed', 'archived'].map(status => `<option value="${status}" ${moderation.filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
          <div class="visit-actions"><button class="btn btn-outline" type="submit">Load moderation</button></div>
        </form>
        <div class="visit-moderation-list" style="margin-top:12px;">
          ${moderation.rows.length ? moderation.rows.map(renderModerationRow).join('') : '<div class="visit-empty">No moderation rows loaded.</div>'}
        </div>
        <div class="visit-actions" style="margin-top:12px;">
          <button class="btn btn-outline" type="button" data-load-more-moderation ${!moderation.hasMore || moderation.loading ? 'disabled' : ''}>Load more</button>
        </div>
      </section>
    `;
  }

  function renderModerationRow(item) {
    return `
      <article class="visit-submission-card">
        <div>
          <h4>${escapeHtml(item.fileName || 'Submission')}</h4>
          <div class="visit-submission-meta">
            ${escapeHtml(item.visitType)} / ${escapeHtml(item.positionKey)} - ${escapeHtml(item.status)} - ${escapeHtml(S.formatDate(item.createdAt))}
          </div>
          ${item.deleteReason ? `<p class="visit-muted"><strong>Reason:</strong> ${escapeHtml(item.deleteReason)}</p>` : ''}
        </div>
        <div class="visit-actions">
          ${item.fileUrl ? `<a class="btn btn-outline" href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noopener">Open File</a>` : ''}
        </div>
      </article>
    `;
  }

  function datetimeLocalValue(value) {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isoOrNull(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  global.RcphVisitRender = Object.freeze({
    escapeHtml,
    badge,
    statusBadges,
    renderDashboard,
    renderUninitialized,
    renderVisitFolders,
    renderFolderDetail,
    renderVisitSettingsForm,
    renderFolderSettingsForm,
    renderModerationPanel,
    isoOrNull,
  });
})(window);
