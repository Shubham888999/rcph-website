'use strict';

// Extra folders inside a position's Visit folder. The holder of the position, or a
// Visit manager, can add them. They sit beside the four Secretary folders and are stored
// as a list on the position folder document. A folder can have subfolders one level deep,
// including the four Secretary folders. Drive folders are made on first upload.

const MAX_CUSTOM_FOLDERS = 10;
const MAX_SUBFOLDERS_PER_FOLDER = 10;
const MAX_TOTAL_FOLDERS = 40;
const MAX_NAME_LENGTH = 40;
const BUILT_IN_FOLDER_KEYS = Object.freeze(['inward', 'outward', 'inward-register', 'outward-register']);
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
// A subfolder needs a parent that is a built-in folder or a top-level extra folder.
function listCustomFolders(folder) {
  const source = Array.isArray(folder?.customFolders) ? folder.customFolders : [];
  const wellFormed = source
    .filter(item => item && isCustomFolderKey(item.key) && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      key: item.key,
      name: item.name,
      parentKey: typeof item.parentKey === 'string' ? item.parentKey : '',
      createdByUid: typeof item.createdByUid === 'string' ? item.createdByUid : '',
      createdAtMillis: Number.isFinite(item.createdAtMillis) ? item.createdAtMillis : 0,
    }));
  const topLevelKeys = new Set(wellFormed.filter(item => !item.parentKey).map(item => item.key));
  return wellFormed.filter(item => !item.parentKey || BUILT_IN_FOLDER_KEYS.includes(item.parentKey) || topLevelKeys.has(item.parentKey));
}

function siblingsOf(existing, parentKey) {
  return existing.filter(item => (item.parentKey || '') === (parentKey || ''));
}

// Names must differ between folders with the same parent. Top-level folders also may not
// reuse a built-in folder's name.
function validateFolderName(value, siblings = [], ignoreKey = '', { topLevel = true } = {}) {
  const name = cleanName(value);
  if (!name) return { ok: false, error: 'Enter a folder name.' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Folder names can be up to ${MAX_NAME_LENGTH} characters.` };
  if (FORBIDDEN_NAME_CHARACTERS.test(name)) return { ok: false, error: 'Folder names cannot contain / \\ : * ? " < > |' };
  if (name.replace(/[.\s]/g, '') === '') return { ok: false, error: 'Enter a folder name with letters or numbers.' };
  if (topLevel && RESERVED_NAMES.some(reserved => sameName(reserved, name))) return { ok: false, error: 'That name is already used by a built-in folder.' };
  if (siblings.some(item => item.key !== ignoreKey && sameName(item.name, name))) return { ok: false, error: 'A folder with this name already exists here.' };
  return { ok: true, name };
}

// parentKey '' makes a top-level folder. builtInParents lists the built-in folders this position has.
function planCreateFolder(folder, { name, uid, nowMillis, randomHex, parentKey = '', builtInParents = [] }) {
  const existing = listCustomFolders(folder);
  const parent = typeof parentKey === 'string' ? parentKey : '';
  if (parent) {
    const parentIsBuiltIn = builtInParents.includes(parent);
    const parentIsTopLevel = existing.some(item => item.key === parent && !item.parentKey);
    if (!parentIsBuiltIn && !parentIsTopLevel) return { ok: false, error: 'Subfolders can only be added inside a folder, one level deep.' };
    if (siblingsOf(existing, parent).length >= MAX_SUBFOLDERS_PER_FOLDER) return { ok: false, error: `A folder can have up to ${MAX_SUBFOLDERS_PER_FOLDER} subfolders.` };
  } else if (siblingsOf(existing, '').length >= MAX_CUSTOM_FOLDERS) {
    return { ok: false, error: `A position can have up to ${MAX_CUSTOM_FOLDERS} extra folders.` };
  }
  if (existing.length >= MAX_TOTAL_FOLDERS) return { ok: false, error: `A position can have up to ${MAX_TOTAL_FOLDERS} extra folders and subfolders in total.` };
  const checked = validateFolderName(name, siblingsOf(existing, parent), '', { topLevel: !parent });
  if (!checked.ok) return checked;
  let key = '';
  for (let attempt = 0; attempt < 5 && !key; attempt += 1) {
    const candidate = `custom-${randomHex(8)}`;
    if (isCustomFolderKey(candidate) && !existing.some(item => item.key === candidate)) key = candidate;
  }
  if (!key) return { ok: false, error: 'Could not create the folder. Please try again.' };
  const created = { key, name: checked.name, parentKey: parent, createdByUid: uid, createdAtMillis: nowMillis };
  return { ok: true, created, customFolders: [...existing, created] };
}

function planRenameFolder(folder, { key, name }) {
  const existing = listCustomFolders(folder);
  const target = existing.find(item => item.key === key);
  if (!target) return { ok: false, error: 'This folder no longer exists.' };
  const checked = validateFolderName(name, siblingsOf(existing, target.parentKey), key, { topLevel: !target.parentKey });
  if (!checked.ok) return checked;
  if (checked.name === target.name) return { ok: true, unchanged: true, customFolders: existing };
  return {
    ok: true,
    previousName: target.name,
    name: checked.name,
    customFolders: existing.map(item => (item.key === key ? { ...item, name: checked.name } : item)),
  };
}

// A folder can only be deleted when it holds no active files and has no subfolders.
function planDeleteFolder(folder, { key, activeFileCount }) {
  const existing = listCustomFolders(folder);
  const target = existing.find(item => item.key === key);
  if (!target) return { ok: false, error: 'This folder no longer exists.' };
  if (existing.some(item => item.parentKey === key)) return { ok: false, error: 'Delete the subfolders first.' };
  if (activeFileCount > 0) return { ok: false, error: 'Move or remove the files in this folder first.' };
  const remainingIds = folder?.categoryFolderIds && typeof folder.categoryFolderIds === 'object' ? { ...folder.categoryFolderIds } : {};
  delete remainingIds[key];
  return { ok: true, removed: target, customFolders: existing.filter(item => item.key !== key), categoryFolderIds: remainingIds };
}

module.exports = {
  BUILT_IN_FOLDER_KEYS,
  MAX_SUBFOLDERS_PER_FOLDER,
  MAX_TOTAL_FOLDERS,
  MAX_CUSTOM_FOLDERS,
  MAX_NAME_LENGTH,
  isCustomFolderKey,
  listCustomFolders,
  validateFolderName,
  planCreateFolder,
  planRenameFolder,
  planDeleteFolder,
};
