'use strict';

// Extra sub-folders inside a position's Visit folder. The holder of the position, or a
// Visit manager, can add them. They sit beside the four Secretary folders and are stored
// as a list on the position folder document. Drive folders are made on first upload.

const MAX_CUSTOM_FOLDERS = 10;
const MAX_NAME_LENGTH = 40;
const CUSTOM_KEY_PATTERN = /^custom-[a-f0-9]{8}$/;
const RESERVED_NAMES = Object.freeze(['inward', 'outward', 'inward file', 'outward file', 'inward register', 'outward register']);
// Characters Drive and file systems handle badly, plus control characters.
const FORBIDDEN_NAME_CHARACTERS = /[\\/:*?"<>|]/;

function isCustomFolderKey(value) {
  return typeof value === 'string' && CUSTOM_KEY_PATTERN.test(value);
}

function cleanName(value) {
  let result = '';
  for (const character of String(value ?? '')) {
    const code = character.codePointAt(0);
    result += code < 32 || code === 127 ? ' ' : character;
  }
  return result.replace(/\s+/g, ' ').trim();
}

function sameName(a, b) {
  return a.toLocaleLowerCase('en') === b.toLocaleLowerCase('en');
}

// Only well-formed entries are kept, so a damaged document cannot break uploads.
function listCustomFolders(folder) {
  const source = Array.isArray(folder?.customFolders) ? folder.customFolders : [];
  return source
    .filter(item => item && isCustomFolderKey(item.key) && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      key: item.key,
      name: item.name,
      createdByUid: typeof item.createdByUid === 'string' ? item.createdByUid : '',
      createdAtMillis: Number.isFinite(item.createdAtMillis) ? item.createdAtMillis : 0,
    }));
}

function validateFolderName(value, existing = [], ignoreKey = '') {
  const name = cleanName(value);
  if (!name) return { ok: false, error: 'Enter a folder name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Folder names can be up to ${MAX_NAME_LENGTH} characters.` };
  if (FORBIDDEN_NAME_CHARACTERS.test(name)) return { ok: false, error: 'Folder names cannot contain / \\ : * ? " < > |' };
  if (name.replace(/[.\s]/g, '') === '') return { ok: false, error: 'Enter a folder name with letters or numbers.' };
  if (RESERVED_NAMES.some(reserved => sameName(reserved, name))) return { ok: false, error: 'That name is already used by a built-in folder.' };
  if (existing.some(item => item.key !== ignoreKey && sameName(item.name, name))) return { ok: false, error: 'A folder with this name already exists.' };
  return { ok: true, name };
}

function planCreateFolder(folder, { name, uid, nowMillis, randomHex }) {
  const existing = listCustomFolders(folder);
  if (existing.length >= MAX_CUSTOM_FOLDERS) return { ok: false, error: `A position can have up to ${MAX_CUSTOM_FOLDERS} extra folders.` };
  const checked = validateFolderName(name, existing);
  if (!checked.ok) return checked;
  let key = '';
  for (let attempt = 0; attempt < 5 && !key; attempt += 1) {
    const candidate = `custom-${randomHex(8)}`;
    if (isCustomFolderKey(candidate) && !existing.some(item => item.key === candidate)) key = candidate;
  }
  if (!key) return { ok: false, error: 'Could not create the folder. Please try again.' };
  const created = { key, name: checked.name, createdByUid: uid, createdAtMillis: nowMillis };
  return { ok: true, created, customFolders: [...existing, created] };
}

function planRenameFolder(folder, { key, name }) {
  const existing = listCustomFolders(folder);
  const target = existing.find(item => item.key === key);
  if (!target) return { ok: false, error: 'This folder no longer exists.' };
  const checked = validateFolderName(name, existing, key);
  if (!checked.ok) return checked;
  if (checked.name === target.name) return { ok: true, unchanged: true, customFolders: existing };
  return {
    ok: true,
    previousName: target.name,
    name: checked.name,
    customFolders: existing.map(item => (item.key === key ? { ...item, name: checked.name } : item)),
  };
}

// A folder can only be deleted when it holds no active files.
function planDeleteFolder(folder, { key, activeFileCount }) {
  const existing = listCustomFolders(folder);
  const target = existing.find(item => item.key === key);
  if (!target) return { ok: false, error: 'This folder no longer exists.' };
  if (activeFileCount > 0) return { ok: false, error: 'Move or remove the files in this folder first.' };
  const remainingIds = folder?.categoryFolderIds && typeof folder.categoryFolderIds === 'object' ? { ...folder.categoryFolderIds } : {};
  delete remainingIds[key];
  return { ok: true, removed: target, customFolders: existing.filter(item => item.key !== key), categoryFolderIds: remainingIds };
}

module.exports = {
  MAX_CUSTOM_FOLDERS,
  MAX_NAME_LENGTH,
  isCustomFolderKey,
  listCustomFolders,
  validateFolderName,
  planCreateFolder,
  planRenameFolder,
  planDeleteFolder,
};
