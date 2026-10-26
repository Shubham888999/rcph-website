'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_CUSTOM_FOLDERS, isCustomFolderKey, listCustomFolders, planCreateFolder, planDeleteFolder, planRenameFolder, validateFolderName,
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
  assert.deepEqual(first.created, { key: first.created.key, name: 'Invoices', createdByUid: 'u1', createdAtMillis: 1000 });
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

test('the three folder callables are wired to the visit service', () => {
  const index = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  for (const [callable, method] of [['createVisitSubmissionCustomFolder', 'createCustomFolder'], ['renameVisitSubmissionCustomFolder', 'renameCustomFolder'], ['deleteVisitSubmissionCustomFolder', 'deleteCustomFolder']]) {
    assert.match(index, new RegExp(`exports\\.${callable} = onCall\\(CALLABLE_OPTIONS, async \\(request\\) => \\{\\s+try \\{\\s+const uid = requireAuth\\(request\\);\\s+return await visitSubmissions\\.${method}\\(uid, request\\.data \\|\\| \\{\\}\\);`));
  }
});
