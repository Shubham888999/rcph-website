import { resolveVisitUploadEndpoint } from './visitUploadModel.js';

export const VISIT_FILE_ACTION_MESSAGES = Object.freeze({
  'visit/client-refresh': 'Refresh Club Visits to load the current Drive file controls.',
  'visit/file-location': 'This file or folder was moved in Drive. Restore its recorded location or ask a Visit manager.',
  'visit/drive-permission': 'The connected Drive account cannot change this file. Ask a Visit manager to check its Drive access.',
  'visit/file-permission': 'Your account cannot change files in this position folder.',
  'visit/file-locked': 'This Club Visit folder is closed or locked.',
  'visit/file-busy': 'Another file action is running. Wait a moment, then retry.',
  'visit/file-pending': 'A previous change needs finishing. Retry that action with the same replacement file.',
  'visit/replacement-type': 'Choose a replacement of the same file type. The existing filename and link will be preserved.',
  'visit/file-references': 'Another active website entry uses this Drive file. A Visit manager must review it first.',
  'visit/file-changed': 'This document changed during the action. Refresh the folder or ask a Visit manager to finish its pending change.',
  'visit/drive-unavailable': 'The file change could not be confirmed. Retry the same action; for replacement, select the same file.',
});
export function visitFileActionError(error) {
  const code = `visit/${error?.reason || error?.details?.reason || ''}`;
  if (!VISIT_FILE_ACTION_MESSAGES[code]) return error;
  return Object.assign(new Error(VISIT_FILE_ACTION_MESSAGES[code]), { code });
}
export function resolveVisitReplacementEndpoint(env) {
  const base = resolveVisitUploadEndpoint(env);
  if (!base) return '';
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/uploadVisitSubmissionFile\/?$/, '/replaceVisitSubmissionFile');
  return url.href;
}
export function findVisitUploadConflicts(item, submissions = []) {
  if (item.allowDuplicate || item.completionProof || ['Uploaded', 'Cancelled'].includes(item.status)) return [];
  return submissions.filter(file => file.status === 'active'
    && (file.documentCategory || '') === (item.documentCategory || '')
    && file.fileName.trim().toLowerCase() === item.file.name.trim().toLowerCase());
}
export function hasVisitUploadConflicts(queue, submissions) {
  return queue.some(item => findVisitUploadConflicts(item, submissions).length > 0);
}
// Keep the request ID through a lost response, dialog close or page reload.
// Only this tab's request metadata is stored; file contents/tokens are never stored.
export async function performVisitReplacement({ file, mimeType = file.type, submissionId, uid, getIdToken, env = {}, storage = null, fetcher = fetch, onStage = () => {} }) {
  const endpoint = resolveVisitReplacementEndpoint(env);
  if (!endpoint) throw new Error('Club Visit replacement is not configured.');
  onStage('Preparing replacement…');
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `rcph-visit-replacement:${uid}:${submissionId}`;
  let saved;
  try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* Storage is optional. */ }
  const operationId = saved?.hash === hash && /^[a-zA-Z0-9_-]{1,160}$/.test(saved.operationId || '') ? saved.operationId : crypto.randomUUID();
  try { storage?.setItem(key, JSON.stringify({ operationId, hash })); } catch { /* The server can also resume by matching pending content. */ }
  const token = await getIdToken();
  const body = new FormData();
  Object.entries({ submissionId, operationId, fileName: file.name, mimeType, sizeBytes: String(file.size) }).forEach(([name, value]) => body.append(name, value));
  body.append('file', file, file.name);
  onStage('Replacing in Drive…');
  let response;
  try { response = await fetcher(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }); }
  catch { throw visitFileActionError({ reason: 'drive-unavailable' }); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true || result.submissionId !== submissionId || result.status !== 'active') {
    if (result.code === 'unauthenticated') throw Object.assign(new Error('Sign in again.'), { code: 'functions/unauthenticated' });
    throw visitFileActionError({ reason: VISIT_FILE_ACTION_MESSAGES[`visit/${result.reason}`] ? result.reason : 'drive-unavailable' });
  }
  try { if (JSON.parse(storage?.getItem(key) || 'null')?.operationId === operationId) storage.removeItem(key); } catch { /* Optional storage. */ }
  return result;
}
