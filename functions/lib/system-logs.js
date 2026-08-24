'use strict';

const SYSTEM_LOGS_COLLECTION = 'systemLogs';
const MAX_LOG_LIMIT = 200;
const DEFAULT_LOG_LIMIT = 80;
const ACTIVE_NOTICE_LIMIT = 100;
const RECENT_SOURCE_LIMIT = 180;

const LOG_CATEGORIES = new Set([
  'announcement',
  'email',
  'event',
  'bod_event',
  'letterhead_exchange',
  'reminder',
  'lock',
  'dashboard_notice',
  'mom',
  'treasury',
  'fines',
  'auth',
  'system',
]);

const LOG_ACTIONS = new Set([
  'created',
  'updated',
  'archived',
  'deleted',
  'sent',
  'failed',
  'locked',
  'unlocked',
  'swept',
  'synced',
  'viewed',
  'completed',
  'image_upload_session_created',
  'image_uploaded',
]);

const LOG_STATUSES = new Set(['success', 'failed', 'active', 'inactive', 'info']);

const SENSITIVE_METADATA_KEY = /(password|passcode|otp|token|secret|credential|authorization|cookie|session|html|body|raw|base64|drivefileid|drive_file_id|filecontent|privatekey|refresh)/i;

function cleanText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanLower(value, max = 120) {
  return cleanText(value, max).toLowerCase();
}

function normalizeCategory(value) {
  const category = cleanLower(value, 40);
  return LOG_CATEGORIES.has(category) ? category : 'system';
}

function normalizeAction(value) {
  const action = cleanLower(value, 40).replace(/\s+/g, '_');
  if (LOG_ACTIONS.has(action)) return action;
  if (action === 'publish' || action === 'published') return 'created';
  if (action === 'archive') return 'archived';
  if (action === 'delete') return 'deleted';
  if (action === 'send') return 'sent';
  if (action === 'sweep') return 'swept';
  if (action === 'sync') return 'synced';
  return 'updated';
}

function normalizeStatus(value) {
  const status = cleanLower(value, 40).replace(/\s+/g, '_');
  if (LOG_STATUSES.has(status)) return status;
  if (['sent', 'partial', 'published', 'ready', 'ok'].includes(status)) return 'success';
  if (['failed', 'error', 'no_recipient'].includes(status)) return 'failed';
  if (['active', 'publishing', 'open', 'locked'].includes(status)) return 'active';
  if (['inactive', 'archived', 'deleted', 'dismissed', 'completed', 'stopped', 'unlocked'].includes(status)) return 'inactive';
  return 'info';
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis) : null;
  }
  return null;
}

function timestampToIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : '';
}

function timestampMillis(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function numericCount(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function docId(doc) {
  return cleanText(doc?.id || doc?.ref?.id, 180);
}

function docData(doc) {
  if (!doc) return {};
  if (typeof doc.data === 'function') return doc.data() || {};
  return doc.data && typeof doc.data === 'object' ? doc.data : {};
}

function safeDocPath(value) {
  const path = cleanText(value, 260);
  return path && !path.includes('//') && !/[\u0000-\u001f\u007f]/.test(path) ? path : '';
}

function compactTextList(values = [], maxItems = 12) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
    if (output.length >= maxItems) break;
  }
  return output;
}

function safeMetadataValue(value, depth = 0) {
  if (value == null) return null;
  if (typeof value === 'string') return cleanText(value, 500);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date || typeof value.toDate === 'function' || typeof value.toMillis === 'function') {
    return timestampToIso(value);
  }
  if (depth >= 3) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map(item => safeMetadataValue(item, depth + 1))
      .filter(item => item !== null && item !== '');
  }
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).slice(0, 40).forEach(([key, nested]) => {
      const safeKey = cleanText(key, 80);
      if (!safeKey || SENSITIVE_METADATA_KEY.test(safeKey)) return;
      const safeValue = safeMetadataValue(nested, depth + 1);
      if (safeValue !== null && safeValue !== '') output[safeKey] = safeValue;
    });
    return output;
  }
  return null;
}

function safeMetadata(metadata = {}) {
  const sanitized = safeMetadataValue(metadata);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized) ? sanitized : {};
}

function actorFromAuthority(authority = {}, userData = {}) {
  return {
    actorUid: cleanText(authority.uid || userData.uid, 160),
    actorName: cleanText(userData.name || userData.displayName || userData.email, 180),
    actorRole: cleanText(authority.role || userData.role || userData.storedRole, 80),
  };
}

function isApprovedActiveUserRecord(data = {}) {
  return data
    && cleanLower(data.status || data.roleStatus, 40) === 'approved'
    && data.active !== false;
}

function canAccessSystemLogs({ authority = {}, userData = {} } = {}) {
  return Boolean(
    isApprovedActiveUserRecord(userData)
    && authority?.authority?.hasWebsiteDirectorPosition === true
  );
}

function normalizeSystemLogForWrite(input = {}, adminSdk = null) {
  const createdAt = input.createdAt
    || input.timestamp
    || (adminSdk?.firestore?.FieldValue?.serverTimestamp
      ? adminSdk.firestore.FieldValue.serverTimestamp()
      : new Date());

  return {
    createdAt,
    category: normalizeCategory(input.category),
    action: normalizeAction(input.action),
    status: normalizeStatus(input.status),
    actorUid: cleanText(input.actorUid, 160),
    actorName: cleanText(input.actorName, 180),
    actorRole: cleanText(input.actorRole, 80),
    targetType: cleanText(input.targetType, 80),
    targetId: cleanText(input.targetId, 180),
    targetLabel: cleanText(input.targetLabel, 220),
    targetAudience: cleanText(input.targetAudience, 500),
    details: cleanText(input.details, 700),
    source: cleanText(input.source, 120),
    relatedDocPath: safeDocPath(input.relatedDocPath),
    metadata: safeMetadata(input.metadata || {}),
  };
}

function serializeLogEntry(id, data = {}, options = {}) {
  const createdAt = timestampToIso(data.createdAt || data.timestamp || data.sentAt || data.updatedAt || data.publishedAt);
  if (!id || !createdAt) return null;
  return {
    id,
    createdAt,
    category: normalizeCategory(data.category),
    action: normalizeAction(data.action),
    status: normalizeStatus(data.status),
    actorUid: cleanText(data.actorUid || data.sentBy || data.createdBy || data.updatedBy || data.archivedBy, 160),
    actorName: cleanText(data.actorName || data.sentByName || data.createdByName || data.updatedByName || data.archivedByName, 180),
    actorRole: cleanText(data.actorRole || data.actorPosition, 80),
    targetType: cleanText(data.targetType, 80),
    targetId: cleanText(data.targetId, 180),
    targetLabel: cleanText(data.targetLabel || data.targetName || data.title || data.name, 220),
    targetAudience: cleanText(data.targetAudience, 500),
    details: cleanText(data.details || data.summary, 700),
    source: cleanText(data.source, 120),
    relatedDocPath: safeDocPath(data.relatedDocPath),
    metadata: safeMetadata(data.metadata || {}),
    reconstructed: options.reconstructed === true || data.reconstructed === true,
  };
}

function makeLog(id, data, options = {}) {
  return serializeLogEntry(id, {
    category: data.category,
    action: data.action,
    status: data.status,
    actorUid: data.actorUid,
    actorName: data.actorName,
    actorRole: data.actorRole,
    targetType: data.targetType,
    targetId: data.targetId,
    targetLabel: data.targetLabel,
    targetAudience: data.targetAudience,
    details: data.details,
    source: data.source,
    relatedDocPath: data.relatedDocPath,
    metadata: data.metadata,
    createdAt: data.createdAt,
  }, options);
}

function targetAudienceSummary(data = {}) {
  const roles = compactTextList(data.targetRoles || data.recipientRoles || data.recipientGroups || []);
  const explicitCount = Array.isArray(data.targetUserIds) ? data.targetUserIds.length : numericCount(data.explicitRecipientCount, 0);
  if (roles.includes('all')) return explicitCount ? `All roles plus ${explicitCount} explicit users` : 'All dashboard users';
  const pieces = [];
  if (roles.length) pieces.push(`Roles: ${roles.join(', ')}`);
  if (explicitCount) pieces.push(`${explicitCount} explicit users`);
  return pieces.join('; ') || '';
}

function emailSummaryDetails(summary = {}) {
  const attempted = numericCount(summary.attempted, 0);
  const sent = numericCount(summary.sent, 0);
  const failed = numericCount(summary.failed, 0);
  if (!attempted && !sent && !failed) return '';
  return `${sent}/${attempted || sent + failed} emails sent, ${failed} failed`;
}

function announcementLogsFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  if (!id) return [];
  const status = normalizeStatus(data.status);
  const createdAt = data.archivedAt || data.publishedAt || data.createdAt || data.updatedAt;
  const logs = [];
  const action = data.status === 'archived'
    ? 'archived'
    : data.status === 'failed'
      ? 'failed'
      : 'created';
  const primary = makeLog(`reconstructed:announcements:${id}:${action}`, {
    createdAt,
    category: 'announcement',
    action,
    status,
    actorUid: data.archivedBy || data.createdBy,
    actorName: data.archivedByName || data.createdByName,
    actorRole: data.actorRole,
    targetType: 'announcement',
    targetId: id,
    targetLabel: data.title,
    targetAudience: targetAudienceSummary(data),
    details: `${numericCount(data.recipientCount, 0)} dashboard recipients`,
    source: 'announcements',
    relatedDocPath: `announcements/${id}`,
    metadata: {
      priority: data.priority,
      emailRequested: data.emailRequested === true,
      recipientCount: numericCount(data.recipientCount, 0),
    },
  }, { reconstructed: true });
  if (primary) logs.push(primary);

  if (data.emailRequested === true || data.emailSummary) {
    const details = emailSummaryDetails(data.emailSummary || {});
    const emailStatus = normalizeStatus(data.emailSummary?.failed > 0 && !data.emailSummary?.sent ? 'failed' : 'sent');
    const emailLog = makeLog(`reconstructed:announcements:${id}:email`, {
      createdAt: data.updatedAt || data.publishedAt || data.createdAt,
      category: 'email',
      action: emailStatus === 'failed' ? 'failed' : 'sent',
      status: emailStatus,
      actorUid: data.createdBy,
      actorName: data.createdByName,
      targetType: 'announcement',
      targetId: id,
      targetLabel: data.title,
      targetAudience: targetAudienceSummary(data),
      details,
      source: 'announcements.emailSummary',
      relatedDocPath: `announcements/${id}`,
      metadata: data.emailSummary || {},
    }, { reconstructed: true });
    if (emailLog) logs.push(emailLog);
  }
  return logs;
}

function reminderEmailLogFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  return makeLog(`reconstructed:reminderEmailHistory:${id}`, {
    createdAt: data.sentAt,
    category: 'reminder',
    action: data.status === 'failed' ? 'failed' : 'sent',
    status: data.status,
    actorUid: data.sentBy || data.actorUid || 'system',
    actorName: data.sentByName || data.actorName || (data.sentBy ? '' : 'System'),
    actorRole: data.actorRole || 'system',
    targetType: data.targetType || data.reminderType,
    targetId: data.targetId || data.reminderId,
    targetLabel: data.targetName,
    targetAudience: data.recipientRole,
    details: data.recipientEmail
      ? `Reminder ${data.status || 'sent'} to ${cleanText(data.recipientEmail, 320)}`
      : `Reminder ${data.status || 'sent'}`,
    source: 'reminderEmailHistory',
    relatedDocPath: `reminderEmailHistory/${id}`,
    metadata: {
      reminderId: data.reminderId,
      reminderType: data.reminderType,
      avenue: data.avenue,
      attemptNumber: data.attemptNumber,
      maxReminders: data.maxReminders,
      errorCode: data.errorCode,
      recipientEmail: data.recipientEmail,
    },
  }, { reconstructed: true });
}

function reminderTemplateTestLogFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  return makeLog(`reconstructed:reminderTemplateTestHistory:${id}`, {
    createdAt: data.sentAt,
    category: 'email',
    action: data.status === 'failed' ? 'failed' : 'sent',
    status: data.status,
    actorUid: data.sentBy,
    actorName: data.sentByName,
    actorRole: data.actorRole,
    targetType: 'reminder_template_test',
    targetId: data.templateType,
    targetLabel: data.templateType,
    targetAudience: data.recipientEmail,
    details: `Reminder template test ${data.status || 'sent'}`,
    source: 'reminderTemplateTestHistory',
    relatedDocPath: `reminderTemplateTestHistory/${id}`,
    metadata: {
      templateType: data.templateType,
      recipientEmail: data.recipientEmail,
      errorCode: data.errorCode,
    },
  }, { reconstructed: true });
}

function momEmailLogFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  const summary = data.emailSummary || {};
  return makeLog(`reconstructed:momEmailHistory:${id}`, {
    createdAt: data.sentAt,
    category: 'mom',
    action: data.status === 'failed' ? 'failed' : 'sent',
    status: data.status,
    actorUid: data.sentBy,
    actorName: data.sentByName,
    actorRole: data.actorRole,
    targetType: data.targetType || 'mom',
    targetId: data.targetId,
    targetLabel: data.targetName || data.momFileName,
    targetAudience: targetAudienceSummary(data),
    details: emailSummaryDetails(summary),
    source: 'momEmailHistory',
    relatedDocPath: `momEmailHistory/${id}`,
    metadata: {
      momFileName: data.momFileName,
      recipientCount: data.recipientCount,
      emailSummary: summary,
      failureReason: data.failureReason,
    },
  }, { reconstructed: true });
}

function reminderLogsFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  if (!id) return [];
  const recordType = cleanText(data.recordType || data.type, 80);
  const category = 'reminder';
  const targetType = recordType === 'avenue_reporting_window'
    ? 'avenue_reporting_window'
    : (data.targetType || data.reminderType || 'reminder');
  const targetLabel = data.targetName || data.eventName || data.name || data.reminderType || data.avenue;
  const logs = [];
  const candidates = [
    ['created', data.createdAt, data.createdBy, data.createdByName, 'configured'],
    ['updated', data.updatedAt, data.updatedBy, data.updatedByName, data.status],
    ['locked', data.lockedAt, data.lockedBy, data.lockedByName, 'locked'],
    ['unlocked', data.unlockedAt, data.unlockedBy, data.unlockedByName, 'unlocked'],
    ['completed', data.completedAt || data.stoppedAt, data.completedBy || data.stoppedBy, data.completedByName || data.stoppedByName, data.status || data.completionReason],
  ];
  candidates.forEach(([action, createdAt, actorUid, actorName, status]) => {
    const log = makeLog(`reconstructed:reminders:${id}:${action}`, {
      createdAt,
      category,
      action,
      status,
      actorUid,
      actorName,
      targetType,
      targetId: data.targetId || id,
      targetLabel,
      targetAudience: data.recipientRole || data.avenueLabel || data.avenue,
      details: data.completionReason || data.failureReason || data.lockReason || data.adminNote || '',
      source: 'reminders',
      relatedDocPath: `reminders/${id}`,
      metadata: {
        recordType,
        reminderType: data.reminderType,
        avenue: data.avenue,
        remindersSent: data.remindersSent,
        maxReminders: data.maxReminders,
        status: data.status,
      },
    }, { reconstructed: true });
    if (log) logs.push(log);
  });
  return logs;
}

function lockLogFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  const locked = data.locked === true;
  return makeLog(`reconstructed:locks:${id}:${locked ? 'locked' : 'unlocked'}`, {
    createdAt: data.lockedAt || data.unlockedAt || data.updatedAt || data.createdAt,
    category: 'lock',
    action: locked ? 'locked' : 'unlocked',
    status: locked ? 'active' : 'inactive',
    actorUid: data.lockedBy || data.unlockedBy || data.updatedBy,
    actorName: data.lockedByName || data.unlockedByName || data.updatedByName,
    actorRole: data.actorRole,
    targetType: data.type || 'admin_lock',
    targetId: id,
    targetLabel: data.avenueLabel || data.targetName || id,
    targetAudience: data.avenue || data.reportingWindowId || '',
    details: data.reason || data.unlockReason || '',
    source: 'locks',
    relatedDocPath: `locks/${id}`,
    metadata: {
      type: data.type,
      status: data.status,
      avenue: data.avenue,
      reportingWindowId: data.reportingWindowId,
      lockedBySystem: data.lockedBySystem === true,
    },
  }, { reconstructed: true });
}

function adminMaintenanceLogFromDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  const rawAction = cleanLower(data.action, 100);
  let category = 'system';
  let action = 'updated';
  if (rawAction.includes('fine')) category = 'fines';
  if (rawAction.includes('treasury')) category = 'treasury';
  if (rawAction.includes('announcement')) category = 'announcement';
  if (rawAction.includes('created')) action = 'created';
  else if (rawAction.includes('deleted')) action = 'deleted';
  else if (rawAction.includes('archived')) action = 'archived';
  else if (rawAction.includes('updated')) action = 'updated';
  const targetType = category === 'fines'
    ? 'fine'
    : category === 'treasury'
      ? 'treasury'
      : category === 'announcement'
        ? 'announcement'
        : 'admin_maintenance';
  const targetId = data.fineId || data.treasuryEntryId || data.announcementId || id;
  return makeLog(`reconstructed:adminMaintenanceAudit:${id}`, {
    createdAt: data.createdAt || data.timestamp,
    category,
    action,
    status: action === 'deleted' || action === 'archived' ? 'inactive' : 'success',
    actorUid: data.actorUid,
    actorName: data.actorName,
    actorRole: data.actorRole,
    targetType,
    targetId,
    targetLabel: data.memberName || data.title || targetId,
    targetAudience: data.memberId || '',
    details: rawAction.replace(/_/g, ' '),
    source: 'adminMaintenanceAudit',
    relatedDocPath: `adminMaintenanceAudit/${id}`,
    metadata: {
      action: rawAction,
      fineId: data.fineId,
      treasuryEntryId: data.treasuryEntryId,
      announcementId: data.announcementId,
      memberId: data.memberId,
      amount: data.amount,
      deliveryCount: data.deliveryCount,
      recipientCount: data.recipientCount,
    },
  }, { reconstructed: true });
}

function collectionEventLogs(doc, collectionName, category, targetType) {
  const id = docId(doc);
  const data = docData(doc);
  if (!id) return [];
  const label = data.name || data.title || id;
  const logs = [];
  [
    ['created', data.createdAt, data.createdBy, data.createdByName, data.archived ? 'inactive' : 'success'],
    ['updated', data.updatedAt, data.updatedBy, data.updatedByName, data.archived ? 'inactive' : 'success'],
    ['archived', data.archivedAt || data.deletedAt, data.archivedBy || data.deletedBy, data.archivedByName || data.deletedByName, 'inactive'],
  ].forEach(([action, createdAt, actorUid, actorName, status]) => {
    const log = makeLog(`reconstructed:${collectionName}:${id}:${action}`, {
      createdAt,
      category,
      action,
      status,
      actorUid,
      actorName,
      targetType,
      targetId: id,
      targetLabel: label,
      targetAudience: Array.isArray(data.avenue) ? data.avenue.join(', ') : data.visibility || '',
      details: data.source || data.type || '',
      source: collectionName,
      relatedDocPath: `${collectionName}/${id}`,
      metadata: {
        type: data.type,
        source: data.source,
        visibility: data.visibility,
        date: data.date || data.eventStart,
      },
    }, { reconstructed: true });
    if (log) logs.push(log);
  });
  return logs;
}

function normalizeLogsRequest(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const limit = Math.max(1, Math.min(MAX_LOG_LIMIT, numericCount(source.limit, DEFAULT_LOG_LIMIT)));
  return {
    limit,
    category: cleanLower(source.category, 40),
    action: cleanLower(source.action, 40),
    status: cleanLower(source.status, 40),
    actor: cleanLower(source.actor, 120),
    search: cleanLower(source.search, 160),
    dateFrom: cleanText(source.dateFrom, 20),
    dateTo: cleanText(source.dateTo, 20),
  };
}

function dateRangeMillis(filters = {}) {
  let from = 0;
  let to = Number.POSITIVE_INFINITY;
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom || '')) {
    from = Date.parse(`${filters.dateFrom}T00:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo || '')) {
    to = Date.parse(`${filters.dateTo}T00:00:00.000Z`) + 24 * 60 * 60 * 1000 - 1;
  }
  return {
    from: Number.isFinite(from) ? from : 0,
    to: Number.isFinite(to) ? to : Number.POSITIVE_INFINITY,
  };
}

function entrySearchText(entry) {
  return [
    entry.category,
    entry.action,
    entry.status,
    entry.actorName,
    entry.actorUid,
    entry.actorRole,
    entry.targetType,
    entry.targetId,
    entry.targetLabel,
    entry.targetAudience,
    entry.details,
    entry.source,
  ].join(' ').toLowerCase();
}

function applyLogFilters(entries = [], filters = {}) {
  const range = dateRangeMillis(filters);
  return entries.filter((entry) => {
    if (!entry) return false;
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.status && entry.status !== filters.status) return false;
    const millis = Date.parse(entry.createdAt);
    if (!Number.isFinite(millis) || millis < range.from || millis > range.to) return false;
    const searchText = entrySearchText(entry);
    if (filters.actor && ![entry.actorName, entry.actorUid, entry.actorRole].join(' ').toLowerCase().includes(filters.actor)) return false;
    if (filters.search && !searchText.includes(filters.search)) return false;
    return true;
  });
}

async function recentDocs(db, collectionName, orderField, limit = RECENT_SOURCE_LIMIT) {
  try {
    const snap = await db.collection(collectionName).orderBy(orderField, 'desc').limit(limit).get();
    return snap.docs || [];
  } catch {
    try {
      const snap = await db.collection(collectionName).limit(limit).get();
      return snap.docs || [];
    } catch {
      return [];
    }
  }
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function getDocsByIds(db, collectionName, ids = []) {
  const uniqueIds = Array.from(new Set(ids.map(id => cleanText(id, 180)).filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, 450)) {
    try {
      const refs = chunk.map(id => db.collection(collectionName).doc(id));
      const snaps = typeof db.getAll === 'function'
        ? await db.getAll(...refs)
        : await Promise.all(refs.map(ref => ref.get()));
      snaps.forEach(snap => result.set(snap.id, snap));
    } catch {
      // Keep the logs endpoint available even when optional name resolution fails.
    }
  }
  return result;
}

function isAnnouncementActive(data = {}, nowMillis = Date.now()) {
  if (data.status !== 'published') return false;
  const expiresMillis = timestampMillis(data.expiresAt);
  return !expiresMillis || expiresMillis > nowMillis;
}

function deliverySummary(deliveries = []) {
  const summary = {
    total: deliveries.length,
    unread: 0,
    read: 0,
    dismissed: 0,
    emailPending: 0,
    emailSent: 0,
    emailFailed: 0,
  };
  deliveries.forEach((delivery) => {
    const dashboardStatus = cleanLower(delivery.dashboardStatus || 'unread', 40);
    if (dashboardStatus === 'read') summary.read += 1;
    else if (dashboardStatus === 'dismissed') summary.dismissed += 1;
    else summary.unread += 1;
    const emailStatus = cleanLower(delivery.emailStatus, 40);
    if (emailStatus === 'sent') summary.emailSent += 1;
    else if (emailStatus === 'failed') summary.emailFailed += 1;
    else if (emailStatus === 'pending') summary.emailPending += 1;
  });
  return summary;
}

function safeVisibleUser(uid, userData = {}, fallback = {}) {
  return {
    uid: cleanText(uid, 160),
    name: cleanText(userData.name || userData.displayName || fallback.name || fallback.email || uid, 180),
    email: cleanText(userData.email || fallback.email, 320),
    role: cleanText(userData.role || userData.storedRole || fallback.role, 80),
    status: cleanText(fallback.dashboardStatus || fallback.status, 40),
    read: fallback.read === true,
    dismissed: fallback.dismissed === true,
  };
}

async function activeBodPositionAssignmentDocs(db) {
  try {
    const snap = await db.collection('bodPositionAssignments').where('active', '==', true).get();
    return snap.docs || [];
  } catch {
    return [];
  }
}

function assignmentsForAvenue(assignmentDocs = [], allowed = new Set()) {
  const byUid = new Map();
  assignmentDocs
    .map(doc => docData(doc))
    .forEach((assignment) => {
      const uid = cleanText(assignment.uid, 160);
      const positionKey = cleanLower(assignment.positionKey, 80);
      if (!uid || assignment.active !== true || !allowed.has(positionKey)) return;
      if (!byUid.has(uid)) byUid.set(uid, { ...assignment, uid, positionKey });
    });
  return Array.from(byUid.values());
}

async function visibleUsersForAssignments(db, assignments = []) {
  const usersByUid = await getDocsByIds(db, 'users', assignments.map(assignment => assignment.uid));
  return assignments.map((assignment) => {
    const userSnap = usersByUid.get(assignment.uid);
    const userData = userSnap?.exists ? (userSnap.data() || {}) : {};
    return safeVisibleUser(assignment.uid, userData, {
      role: assignment.positionKey,
      status: 'active',
    });
  });
}

async function persistedActiveAnnouncementNotices(db, nowMillis = Date.now()) {
  const announcementDocs = await recentDocs(db, 'announcements', 'publishedAt', ACTIVE_NOTICE_LIMIT);
  const activeDocs = announcementDocs.filter(doc => isAnnouncementActive(docData(doc), nowMillis));
  const notices = [];
  for (const doc of activeDocs) {
    const id = docId(doc);
    const data = docData(doc);
    let deliveryDocs = [];
    try {
      const deliverySnap = await db
        .collection('announcementDeliveries')
        .where('announcementId', '==', id)
        .limit(600)
        .get();
      deliveryDocs = deliverySnap.docs || [];
    } catch {
      deliveryDocs = [];
    }
    const deliveries = deliveryDocs.map(deliveryDoc => ({ id: docId(deliveryDoc), ...docData(deliveryDoc) }));
    const uids = deliveries.map(delivery => delivery.uid).filter(Boolean);
    const usersByUid = await getDocsByIds(db, 'users', uids);
    const visibleFor = deliveries.map((delivery) => {
      const userSnap = usersByUid.get(delivery.uid);
      const userData = userSnap?.exists ? (userSnap.data() || {}) : {};
      return safeVisibleUser(delivery.uid, userData, {
        email: delivery.email,
        role: delivery.role,
        dashboardStatus: delivery.dashboardStatus || 'unread',
        read: delivery.dashboardStatus === 'read' || !!delivery.readAt,
        dismissed: delivery.dashboardStatus === 'dismissed',
      });
    });
    notices.push({
      id: `announcement:${id}`,
      persisted: true,
      derived: false,
      source: 'announcements',
      category: 'announcement',
      title: cleanText(data.title, 180),
      body: cleanText(data.body, 5000),
      priority: cleanLower(data.priority, 40) || 'normal',
      status: 'active',
      active: true,
      createdAt: timestampToIso(data.createdAt || data.publishedAt),
      publishedAt: timestampToIso(data.publishedAt || data.createdAt),
      expiresAt: timestampToIso(data.expiresAt),
      createdBy: cleanText(data.createdBy, 160),
      createdByName: cleanText(data.createdByName, 180),
      targetRoles: compactTextList(data.targetRoles || [], 20),
      targetUserIds: compactTextList(data.targetUserIds || [], 60),
      targetAudience: targetAudienceSummary(data) || `${deliveries.length} delivery records`,
      visibleFor,
      deliverySummary: deliverySummary(deliveries),
      relatedDocPath: `announcements/${id}`,
    });
  }
  return notices;
}

async function derivedAvenueLockNotices(db, avenueReportingLocks) {
  if (!avenueReportingLocks) return [];
  const [lockDocs, reminderDocs] = await Promise.all([
    recentDocs(db, 'locks', 'updatedAt', 500),
    recentDocs(db, 'reminders', 'updatedAt', 500),
  ]);
  const locks = avenueReportingLocks.normalizeActiveAvenueReportingLocks({ lockDocs, reminderDocs });
  if (!locks.length) return [];

  const assignmentDocs = await activeBodPositionAssignmentDocs(db);

  const allTargetUids = new Set();
  const targetsByLock = new Map();
  locks.forEach((lock) => {
    const lockAvenues = Array.isArray(lock.avenues) && lock.avenues.length ? lock.avenues : [lock.avenue].filter(Boolean);
    const allowed = new Set(avenueReportingLocks.recipientPositionKeysForAvenues
      ? avenueReportingLocks.recipientPositionKeysForAvenues(lockAvenues)
      : avenueReportingLocks.recipientPositionKeysForAvenue(lock.avenue));
    const assignments = assignmentsForAvenue(assignmentDocs, allowed);
    targetsByLock.set(lock.lockId, { allowed: Array.from(allowed), assignments, lockAvenues });
    assignments.forEach(assignment => {
      const uid = cleanText(assignment.uid, 160);
      if (uid) allTargetUids.add(uid);
    });
  });
  const usersByUid = await getDocsByIds(db, 'users', Array.from(allTargetUids));

  return locks.map((lock) => {
    const targetInfo = targetsByLock.get(lock.lockId) || { allowed: [], assignments: [] };
    const visibleFor = targetInfo.assignments.map((assignment) => {
      const uid = cleanText(assignment.uid, 160);
      const userSnap = usersByUid.get(uid);
      const userData = userSnap?.exists ? (userSnap.data() || {}) : {};
      return safeVisibleUser(uid, userData, {
        role: assignment.positionKey,
        status: 'active',
      });
    });
    const targetAudience = visibleFor.length
      ? visibleFor.map(item => item.name).filter(Boolean).join(', ')
      : `Positions: ${targetInfo.allowed.join(', ') || lock.avenue}`;
    const lockAvenues = targetInfo.lockAvenues?.length ? targetInfo.lockAvenues : [lock.avenue].filter(Boolean);
    const avenuesLabel = cleanText(lock.avenuesLabel, 160) || lockAvenues.join(' + ') || lock.avenue;
    return {
      id: `derived:reportingWindowLock:${lock.lockId}`,
      persisted: false,
      derived: true,
      source: 'reportingWindowLock',
      category: 'dashboard_notice',
      title: `${avenuesLabel} reporting window locked`,
      body: avenueReportingLocks.reportingWindowLockDashboardMessage(lockAvenues),
      priority: 'urgent',
      status: 'active',
      active: true,
      createdAt: timestampToIso(lock.lockedAt),
      publishedAt: timestampToIso(lock.lockedAt) || new Date().toISOString(),
      expiresAt: '',
      targetAudience,
      visibleFor,
      deliverySummary: null,
      lockedAvenue: lock.avenue,
      lockedAvenues: lockAvenues,
      avenueLabel: lock.avenueLabel,
      avenueLabels: lock.avenueLabels || [],
      avenuesLabel,
      reportingWindowId: lock.reportingWindowId,
      lockReason: lock.reason,
      targetLabel: lock.targetName,
      conductedDate: lock.conductedDate,
      dueAt: timestampToIso(lock.dueAt),
      relatedDocPath: `locks/${lock.lockId}`,
    };
  });
}

async function derivedAvenueReportingWindowNotices(db, avenueReportingLocks) {
  if (!avenueReportingLocks?.normalizeOpenAvenueReportingWindows) return [];
  const [reminderDocs, assignmentDocs] = await Promise.all([
    recentDocs(db, 'reminders', 'updatedAt', 500),
    activeBodPositionAssignmentDocs(db),
  ]);
  const windows = avenueReportingLocks.normalizeOpenAvenueReportingWindows({
    reminderDocs,
    now: new Date(),
  });
  if (!windows.length) return [];

  return Promise.all(windows.map(async (window) => {
    const windowAvenues = Array.isArray(window.avenues) && window.avenues.length ? window.avenues : [window.avenue].filter(Boolean);
    const allowed = new Set(avenueReportingLocks.recipientPositionKeysForAvenues
      ? avenueReportingLocks.recipientPositionKeysForAvenues(windowAvenues)
      : avenueReportingLocks.recipientPositionKeysForAvenue(window.avenue));
    const assignments = assignmentsForAvenue(assignmentDocs, allowed);
    const visibleFor = await visibleUsersForAssignments(db, assignments);
    const targetAudience = visibleFor.length
      ? visibleFor.map(item => item.name).filter(Boolean).join(', ')
      : `Positions: ${Array.from(allowed).join(', ') || window.avenue}`;
    const dueAt = window.reportingDueAt || window.reportDueAt;
    const avenuesLabel = cleanText(window.avenuesLabel, 160) || windowAvenues.join(' + ') || window.avenue;
    return {
      id: `derived:reportingWindowOpen:${window.id}`,
      persisted: false,
      derived: true,
      source: 'reportingWindowOpen',
      category: 'dashboard_notice',
      title: `${avenuesLabel} reporting window open`,
      body: avenueReportingLocks.reportingWindowOpenDashboardMessage(avenuesLabel, dueAt),
      priority: 'important',
      status: 'active',
      active: true,
      createdAt: timestampToIso(window.createdAt),
      publishedAt: timestampToIso(window.reportingOpensAt) || timestampToIso(window.updatedAt) || new Date().toISOString(),
      expiresAt: timestampToIso(window.lockAt || dueAt),
      targetAudience,
      visibleFor,
      deliverySummary: null,
      openAvenue: window.avenue,
      openAvenues: windowAvenues,
      avenueLabel: window.avenueLabel,
      avenueLabels: window.avenueLabels || [],
      avenuesLabel,
      reportingWindowId: window.id,
      targetLabel: window.targetName,
      conductedDate: window.conductedDate,
      dueAt: timestampToIso(dueAt),
      relatedDocPath: `reminders/${window.id}`,
    };
  }));
}

async function buildActiveDashboardNotices(db, avenueReportingLocks, nowMillis = Date.now()) {
  const [announcements, locks, reportingWindows] = await Promise.all([
    persistedActiveAnnouncementNotices(db, nowMillis),
    derivedAvenueLockNotices(db, avenueReportingLocks),
    derivedAvenueReportingWindowNotices(db, avenueReportingLocks),
  ]);
  return [...locks, ...reportingWindows, ...announcements]
    .sort((a, b) => Date.parse(b.publishedAt || b.createdAt || 0) - Date.parse(a.publishedAt || a.createdAt || 0)
      || String(a.title).localeCompare(String(b.title)));
}

async function buildUnifiedLogs(db, filters = {}) {
  const [
    systemDocs,
    announcementDocs,
    reminderHistoryDocs,
    templateHistoryDocs,
    momHistoryDocs,
    reminderDocs,
    lockDocs,
    adminMaintenanceDocs,
    eventDocs,
    bodEventDocs,
    bodMeetingDocs,
    districtEventDocs,
  ] = await Promise.all([
    recentDocs(db, SYSTEM_LOGS_COLLECTION, 'createdAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'announcements', 'createdAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'reminderEmailHistory', 'sentAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'reminderTemplateTestHistory', 'sentAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'momEmailHistory', 'sentAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'reminders', 'updatedAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'locks', 'updatedAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'adminMaintenanceAudit', 'createdAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'events', 'updatedAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'bodEvents', 'updatedAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'bodMeetings', 'updatedAt', RECENT_SOURCE_LIMIT),
    recentDocs(db, 'districtEvents', 'updatedAt', RECENT_SOURCE_LIMIT),
  ]);

  const entries = [
    ...systemDocs.map(doc => serializeLogEntry(docId(doc), docData(doc), { reconstructed: false })),
    ...announcementDocs.flatMap(announcementLogsFromDoc),
    ...reminderHistoryDocs.map(reminderEmailLogFromDoc),
    ...templateHistoryDocs.map(reminderTemplateTestLogFromDoc),
    ...momHistoryDocs.map(momEmailLogFromDoc),
    ...reminderDocs.flatMap(reminderLogsFromDoc),
    ...lockDocs.map(lockLogFromDoc),
    ...adminMaintenanceDocs.map(adminMaintenanceLogFromDoc),
    ...eventDocs.flatMap(doc => collectionEventLogs(doc, 'events', 'event', 'club_event')),
    ...bodEventDocs.flatMap(doc => collectionEventLogs(doc, 'bodEvents', 'bod_event', 'bod_event')),
    ...bodMeetingDocs.flatMap(doc => collectionEventLogs(doc, 'bodMeetings', 'event', 'bod_meeting')),
    ...districtEventDocs.flatMap(doc => collectionEventLogs(doc, 'districtEvents', 'event', 'district_event')),
  ].filter(Boolean);

  const byId = new Map();
  entries.forEach((entry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  });

  return applyLogFilters(Array.from(byId.values()), filters)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, filters.limit || DEFAULT_LOG_LIMIT);
}

function summarizeLogs(logs = [], activeNotices = [], now = Date.now()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const weekStartMillis = now - 7 * 24 * 60 * 60 * 1000;
  return {
    today: logs.filter(log => Date.parse(log.createdAt) >= today.getTime()).length,
    thisWeek: logs.filter(log => Date.parse(log.createdAt) >= weekStartMillis).length,
    failed: logs.filter(log => log.status === 'failed' || log.action === 'failed').length,
    activeNotices: activeNotices.length,
  };
}

async function writeSystemLog({ db, admin: adminSdk }, input = {}) {
  const payload = normalizeSystemLogForWrite(input, adminSdk);
  const ref = await db.collection(SYSTEM_LOGS_COLLECTION).add(payload);
  return { id: ref.id, ...payload };
}

async function writeSystemLogSafely(context, input = {}, logger = console) {
  try {
    return await writeSystemLog(context, input);
  } catch (error) {
    logger.warn?.('System log write failed.', {
      category: input.category,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      code: error?.code || '',
      message: error?.message || String(error),
    });
    return null;
  }
}

function createSystemLogsService({
  db,
  admin,
  HttpsError,
  getAuthorityContext,
  assertApprovedActiveCallableAccount,
  avenueReportingLocks,
  logger = console,
} = {}) {
  if (!db || !admin || !HttpsError || !getAuthorityContext || !assertApprovedActiveCallableAccount) {
    throw new Error('System logs service dependencies are required.');
  }

  async function requireSystemLogsAccess(uid) {
    const account = await assertApprovedActiveCallableAccount(uid);
    const authority = await getAuthorityContext(uid);
    if (!canAccessSystemLogs({ authority, userData: account.userData })) {
      throw new HttpsError('permission-denied', 'System logs are restricted to the active Club Website Director.');
    }
    return { account, authority, actor: actorFromAuthority(authority, account.userData) };
  }

  async function getSystemLogs(uid, rawRequest = {}) {
    await requireSystemLogsAccess(uid);
    const filters = normalizeLogsRequest(rawRequest);
    const [logs, activeNotices] = await Promise.all([
      buildUnifiedLogs(db, filters),
      buildActiveDashboardNotices(db, avenueReportingLocks),
    ]);
    return {
      ok: true,
      logs,
      activeNotices,
      summary: summarizeLogs(logs, activeNotices),
      sources: {
        primary: SYSTEM_LOGS_COLLECTION,
        reconstructed: [
          'announcements',
          'announcementDeliveries',
          'reminderEmailHistory',
          'reminderTemplateTestHistory',
          'reminders',
          'locks',
          'adminMaintenanceAudit',
          'momEmailHistory',
          'events',
          'bodEvents',
          'bodMeetings',
          'districtEvents',
        ],
      },
      limitations: [
        'Older direct client writes without stored timestamp or history fields cannot be reconstructed reliably.',
        'Manual attendance, roster, and Treasury direct writes require callable migration or Firestore triggers for complete future logging.',
      ],
    };
  }

  return {
    requireSystemLogsAccess,
    getSystemLogs,
    writeLog: input => writeSystemLog({ db, admin }, input),
    writeLogSafely: input => writeSystemLogSafely({ db, admin }, input, logger),
  };
}

module.exports = {
  SYSTEM_LOGS_COLLECTION,
  canAccessSystemLogs,
  normalizeSystemLogForWrite,
  serializeLogEntry,
  safeMetadata,
  applyLogFilters,
  summarizeLogs,
  writeSystemLog,
  writeSystemLogSafely,
  createSystemLogsService,
};
