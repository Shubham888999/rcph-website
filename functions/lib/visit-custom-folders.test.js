'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_CUSTOM_FOLDERS, MAX_SUBFOLDERS_PER_FOLDER, MAX_TOTAL_FOLDERS, isCustomFolderKey, listCustomFolders, planCreateFolder, planDeleteFolder, planRenameFolder, validateFolderName,
} = require('./visit-custom-folders');

let counter = 0;
const randomHex = () => (counter += 1).toString(16).padStart(8, '0');
const create = (folder, name) => planCreateFolder(folder, { name, uid: 'u1', nowMillis: 1000, randomHex });

test('a folder key is custom- plus 8 hex characters', () => {
  assert.equal(isCustomFolderKey('custom-0a1b2c3d'), true);
  ['inward', 'custom-', 'custom-XYZ12345', 'custom-0a1b2c3d4', '', null, 5].forEach(value => assert.equal(isCustomFolderKey(value), false));
});

test('names are tidied and checked', () => {
  assert.deepEqual(validateFolderName('  Event   photos '), { ok: true, name: 'Event photos' });
  assert.equal(validateFolderName('').ok, false);
  assert.match(validateFolderName('x'.repeat(41)).error, /up to 40/);
  assert.match(validateFolderName('a/b').error, /cannot contain/);
  assert.match(validateFolderName('..').error, /letters or numbers/);
  assert.match(validateFolderName('Inward').error, /built-in/);
  assert.match(validateFolderName('outward REGISTER').error, /built-in/);
  assert.equal(validateFolderName('Tab\there').name, 'Tab here');
});

test('creating adds a folder with a fresh key, and names are unique ignoring case', () => {
  const first = create({}, 'Invoices');
  assert.equal(first.ok, true);
  assert.match(first.created.key, /^custom-[a-f0-9]{8}$/);
  assert.deepEqual(first.created, { key: first.created.key, name: 'Invoices', parentKey: '', createdByUid: 'u1', createdAtMillis: 1000 });
  const folder = { customFolders: first.customFolders };
  assert.match(create(folder, 'invoices').error, /already exists/);
  const second = create(folder, 'Photos');
  assert.equal(second.customFolders.length, 2);
  assert.notEqual(second.created.key, first.created.key);
});

test('a position can have at most 10 extra folders', () => {
  let folder = {};
  for (let index = 0; index < MAX_CUSTOM_FOLDERS; index += 1) folder = { customFolders: create(folder, `Folder ${index}`).customFolders };
  assert.equal(folder.customFolders.length, 10);
  assert.match(create(folder, 'One more').error, /up to 10/);
});

test('renaming keeps the key, checks the new name, and does nothing for the same name', () => {
  const folder = { customFolders: create({ customFolders: create({}, 'Invoices').customFolders }, 'Photos').customFolders };
  const [a, b] = folder.customFolders;
  const renamed = planRenameFolder(folder, { key: a.key, name: 'Bills' });
  assert.equal(renamed.customFolders.find(item => item.key === a.key).name, 'Bills');
  assert.equal(renamed.previousName, a.name);
  assert.match(planRenameFolder(folder, { key: a.key, name: b.name }).error, /already exists/);
  assert.equal(planRenameFolder(folder, { key: a.key, name: a.name }).unchanged, true);
  assert.match(planRenameFolder(folder, { key: 'custom-ffffffff', name: 'X' }).error, /no longer exists/);
});

test('deleting needs an empty folder and forgets its Drive folder', () => {
  const made = create({}, 'Invoices');
  const folder = { customFolders: made.customFolders, categoryFolderIds: { [made.created.key]: 'drive1', inward: 'drive2' } };
  assert.match(planDeleteFolder(folder, { key: made.created.key, activeFileCount: 2 }).error, /Move or remove/);
  const plan = planDeleteFolder(folder, { key: made.created.key, activeFileCount: 0 });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.customFolders, []);
  assert.deepEqual(plan.categoryFolderIds, { inward: 'drive2' });
  assert.match(planDeleteFolder(folder, { key: 'custom-ffffffff', activeFileCount: 0 }).error, /no longer exists/);
});

test('damaged entries are ignored when reading the list', () => {
  assert.deepEqual(listCustomFolders({ customFolders: [null, { key: 'bad', name: 'x' }, { key: 'custom-0a1b2c3d', name: ' ' }, { key: 'custom-0a1b2c3d', name: 'Ok' }] }).map(item => item.name), ['Ok']);
  assert.deepEqual(listCustomFolders({}), []);
  assert.deepEqual(listCustomFolders(null), []);
});

const BUILT_IN = ['inward', 'outward', 'inward-register', 'outward-register'];
const createSub = (folder, name, parentKey, builtInParents = BUILT_IN) => planCreateFolder(folder, { name, uid: 'u1', nowMillis: 1000, randomHex, parentKey, builtInParents });

test('a subfolder can go inside a built-in folder or a top-level folder, one level deep', () => {
  const top = create({}, 'Bank letters');
  const folder = { customFolders: top.customFolders };
  const inBuiltIn = createSub(folder, '2026', 'outward');
  assert.equal(inBuiltIn.ok, true);
  assert.equal(inBuiltIn.created.parentKey, 'outward');
  const inTop = createSub(folder, '2026', top.created.key);
  assert.equal(inTop.ok, true, 'same name is fine under a different parent');
  const nested = createSub({ customFolders: inTop.customFolders }, 'April', inTop.created.key);
  assert.match(nested.error, /one level deep/);
  assert.match(createSub(folder, '2026', 'inward', []).error, /one level deep/, 'built-in parents only where the position has them');
  assert.match(createSub(folder, '2026', 'custom-ffffffff').error, /one level deep/);
});

test('subfolder names only need to differ from their siblings, and may match a built-in name', () => {
  const first = createSub({}, 'Inward', 'outward');
  assert.equal(first.ok, true);
  assert.match(createSub({ customFolders: first.customFolders }, 'inward', 'outward').error, /already exists here/);
  assert.equal(createSub({ customFolders: first.customFolders }, 'Inward', 'inward').ok, true);
});

test('subfolder limits: 10 per folder, 10 top-level, 40 in total', () => {
  let folder = {};
  for (let index = 0; index < MAX_SUBFOLDERS_PER_FOLDER; index += 1) folder = { customFolders: createSub(folder, `Year ${index}`, 'outward').customFolders };
  assert.match(createSub(folder, 'One more', 'outward').error, /up to 10 subfolders/);
  assert.equal(createSub(folder, 'Fine', 'inward').ok, true, 'another folder has its own 10');
  let full = {};
  for (const parent of BUILT_IN) for (let index = 0; index < MAX_SUBFOLDERS_PER_FOLDER; index += 1) full = { customFolders: createSub(full, `S${index}`, parent).customFolders };
  assert.equal(full.customFolders.length, MAX_TOTAL_FOLDERS);
  assert.match(create(full, 'Top').error, /in total/);
});

test('renaming a subfolder checks its siblings, and a folder with subfolders cannot be deleted', () => {
  const top = create({}, 'Bank letters');
  const a = createSub({ customFolders: top.customFolders }, '2025', top.created.key);
  const b = createSub({ customFolders: a.customFolders }, '2026', top.created.key);
  const folder = { customFolders: b.customFolders };
  assert.match(planRenameFolder(folder, { key: b.created.key, name: '2025' }).error, /already exists here/);
  assert.equal(planRenameFolder(folder, { key: b.created.key, name: 'Inward' }).ok, true);
  assert.match(planDeleteFolder(folder, { key: top.created.key, activeFileCount: 0 }).error, /Delete the subfolders first/);
  assert.equal(planDeleteFolder(folder, { key: b.created.key, activeFileCount: 0 }).ok, true);
  assert.match(planDeleteFolder(folder, { key: b.created.key, activeFileCount: 1 }).error, /Move or remove/);
});

test('a subfolder whose parent is gone is ignored', () => {
  assert.deepEqual(listCustomFolders({ customFolders: [{ key: 'custom-0a1b2c3d', name: 'Orphan', parentKey: 'custom-ffffffff' }, { key: 'custom-0a1b2c3e', name: 'Ok', parentKey: 'outward' }] }).map(item => item.name), ['Ok']);
});

test('the three folder callables are wired to the visit service', () => {
  const index = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  for (const [callable, method] of [['createVisitSubmissionCustomFolder', 'createCustomFolder'], ['renameVisitSubmissionCustomFolder', 'renameCustomFolder'], ['deleteVisitSubmissionCustomFolder', 'deleteCustomFolder']]) {
    assert.match(index, new RegExp(`exports\\.${callable} = onCall\\(CALLABLE_OPTIONS, async \\(request\\) => \\{\\s+try \\{\\s+const uid = requireAuth\\(request\\);\\s+return await visitSubmissions\\.${method}\\(uid, request\\.data \\|\\| \\{\\}\\);`));
  }
});

test('the upload handler and the move handler pass the parent Drive folder on', () => {
  const drive = require('node:fs').readFileSync(require('node:path').join(__dirname, 'visit-drive.js'), 'utf8');
  assert.match(drive, /\.\.\.\(folder\.categoryParentFolderId \? \{ categoryParentFolderId: folder\.categoryParentFolderId \} : \{\}\)/);
  assert.match(drive, /\.\.\.\(parentFolderId \? \{ parentFolderId \} : \{\}\)/);
});
