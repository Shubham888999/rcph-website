'use strict';

(function initVisitSubmissionState(global) {
  const VISIT_TYPES = Object.freeze([
    { visitType: 'clubAssembly', displayTitle: 'Club Assembly', sortOrder: 1 },
    { visitType: 'dzrVisit', displayTitle: 'DZR Visit', sortOrder: 2 },
    { visitType: 'drrVisit', displayTitle: 'DRR Visit', sortOrder: 3 },
  ]);

  const ALLOWED_EXTENSIONS = Object.freeze([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'webp',
  ]);

  const ALLOWED_MIME_TYPES = Object.freeze([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  const DANGEROUS_EXTENSIONS = Object.freeze([
    'exe', 'bat', 'cmd', 'ps1', 'sh', 'js', 'html', 'svg', 'zip', 'rar', '7z',
  ]);

  const state = {
    user: null,
    route: { visitType: '', positionKey: '' },
    dashboard: null,
    folders: null,
    folderDetail: null,
    currentVisitType: '',
    currentPositionKey: '',
    moderation: {
      filters: { visitType: '', positionKey: '', status: 'active' },
      rows: [],
      nextCursor: null,
      hasMore: false,
      loading: false,
    },
    upload: {
      queue: [],
      activeSession: null,
      isUploading: false,
      cancelled: false,
      summary: null,
    },
  };

  function getVisitDefinition(visitType) {
    return VISIT_TYPES.find(item => item.visitType === visitType) || null;
  }

  function parseRoute(search) {
    const params = new URLSearchParams(search || global.location.search);
    return {
      visitType: params.get('visit') || '',
      positionKey: params.get('position') || '',
    };
  }

  function setRoute(visitType, positionKey, replace) {
    const params = new URLSearchParams();
    if (visitType) params.set('visit', visitType);
    if (positionKey) params.set('position', positionKey);
    const url = `visit-submissions.html${params.toString() ? `?${params.toString()}` : ''}`;
    if (replace) global.history.replaceState({}, '', url);
    else global.history.pushState({}, '', url);
    state.route = { visitType: visitType || '', positionKey: positionKey || '' };
  }

  function extensionForFile(fileName) {
    const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function newClientFileId(index) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `local-${Date.now()}-${index}-${rand}`;
  }

  function humanBytes(bytes) {
    const size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function validateClientFile(file, folder) {
    const extension = extensionForFile(file?.name);
    const maxSize = Number(folder?.maxFileSizeBytes || 0);
    if (!file) return 'Choose a file.';
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) return 'Unsupported file extension.';
    if (DANGEROUS_EXTENSIONS.includes(extension)) return 'This file extension is not allowed.';
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Unsupported file type.';
    if (!Number.isFinite(file.size) || file.size <= 0) return 'File is empty or unreadable.';
    if (maxSize && file.size > maxSize) return `File exceeds ${humanBytes(maxSize)}.`;
    return '';
  }

  function resetUploadState() {
    state.upload.queue = [];
    state.upload.activeSession = null;
    state.upload.isUploading = false;
    state.upload.cancelled = false;
    state.upload.summary = null;
  }

  function makeQueueItems(fileList, folder, replaceSubmissionId) {
    const seen = new Set();
    return Array.from(fileList || []).map((file, index) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      const duplicate = seen.has(key);
      seen.add(key);
      return {
        clientFileId: newClientFileId(index),
        file,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: duplicate ? 'Failed' : 'Queued',
        progress: 0,
        message: duplicate ? 'Duplicate local file skipped.' : '',
        validationError: duplicate ? 'Duplicate local file skipped.' : validateClientFile(file, folder),
        ticket: '',
        approvedFileName: '',
        completionProof: '',
        submissionId: '',
        replaceSubmissionId: replaceSubmissionId || '',
      };
    });
  }

  global.RcphVisitState = Object.freeze({
    VISIT_TYPES,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    DANGEROUS_EXTENSIONS,
    state,
    getVisitDefinition,
    parseRoute,
    setRoute,
    extensionForFile,
    humanBytes,
    formatDate,
    validateClientFile,
    resetUploadState,
    makeQueueItems,
  });
})(window);
