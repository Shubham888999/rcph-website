#!/usr/bin/env node
'use strict';

// Run locally with privileged Firebase and Drive credentials. Never a public endpoint.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const CORE_POSITIONS = Object.freeze(['president', 'co-president', 'immediate-past-president', 'vice-president', 'co-vice-president', 'secretary', 'joint-secretary', 'co-secretary', 'treasurer', 'co-treasurer', 'club-advisor', 'co-club-advisor']);
const META = 'id,name,mimeType,size,md5Checksum,parents,trashed,capabilities(canEdit)';
const hash = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const version = snap => `${snap.updateTime.seconds}:${snap.updateTime.nanoseconds}`;
function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
function assertPdf(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 5 || bytes.length > 25 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Replacement must be a PDF of at most 25 MB.');
}
function matches(data, scope) {
  return data.status === 'active' && data.visitType === scope.visitType
    && scope.positions.includes(data.positionKey)
    && (data.originalFileName || data.fileName) === scope.fileName;
}
function selectRecords(records, scope) {
  return records.filter(record => matches(record.data, scope)).map(record => ({
    id: record.id, version: record.version, positionKey: record.data.positionKey,
    documentCategory: record.data.documentCategory || '', driveFileId: record.data.driveFileId,
    driveFolderId: record.data.driveFolderId,
  })).sort((a, b) => a.positionKey.localeCompare(b.positionKey) || a.id.localeCompare(b.id));
}
function checkDrive(meta, file) {
  if (meta.id !== file.driveFileId || meta.trashed || meta.mimeType !== 'application/pdf'
    || !meta.md5Checksum || meta.capabilities?.canEdit !== true
    || !meta.parents?.includes(file.driveFolderId)) throw new Error(`Drive file is missing, moved, uneditable or not a PDF: ${file.driveFileId}`);
}
function requireCompleteSelection(selected, scope) {
  if (scope.expectOnePerPosition && (selected.length !== scope.positions.length
    || scope.positions.some(key => selected.filter(row => row.positionKey === key).length !== 1))) {
    throw new Error('Expected exactly one matching file for every selected position. No files changed.');
  }
}
function resolveSourceVisit(records, scope) {
  if (scope.visitType !== 'auto') return scope;
  const visits = ['clubAssembly', 'dzrVisit', 'drrVisit'].filter(visitType => {
    const selected = selectRecords(records, { ...scope, visitType });
    return selected.length === scope.positions.length
      && scope.positions.every(key => selected.filter(row => row.positionKey === key).length === 1);
  });
  if (visits.length !== 1) throw new Error('Could not identify one unique visit with exactly one file per selected position. Specify --visit clubAssembly, dzrVisit or drrVisit after checking the website records.');
  return { ...scope, visitType: visits[0] };
}
async function checkFolder(drive, folderId, expectedName) {
  if (!expectedName) return;
  const folder = (await drive.files.get({ fileId: folderId, supportsAllDrives: true, fields: 'id,name,mimeType,trashed' })).data;
  if (folder.id !== folderId || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || folder.name !== expectedName) throw new Error(`Expected the ${expectedName} subfolder: ${folderId}`);
}
async function createPlan({ scope, records, replacement, drive, references }) {
  assertPdf(replacement);
  const selected = selectRecords(records, scope);
  if (!selected.length) throw new Error('No active website records match this exact filename and scope.');
  requireCompleteSelection(selected, scope);
  const files = [];
  for (const driveFileId of [...new Set(selected.map(r => r.driveFileId))]) {
    if (!/^[a-zA-Z0-9_-]{10,200}$/.test(driveFileId || '')) throw new Error('A matching record has no valid Drive file ID.');
    const rows = selected.filter(r => r.driveFileId === driveFileId);
    const meta = (await drive.files.get({ fileId: driveFileId, supportsAllDrives: true, fields: META })).data;
    rows.forEach(row => checkDrive(meta, row));
    await checkFolder(drive, rows[0].driveFolderId, scope.folderName);
    const refs = await references(driveFileId);
    if (refs.some(ref => !rows.some(row => row.id === ref.id))) throw new Error(`This Drive file is also used by an active record outside the selected scope: ${driveFileId}`);
    files.push({ driveFileId, driveFolderId: rows[0].driveFolderId, driveName: meta.name, oldMd5: meta.md5Checksum, oldSizeBytes: Number(meta.size), records: rows });
  }
  const plan = { schema: 1, createdAt: new Date().toISOString(), scope, replacementSha256: hash(replacement), replacementMd5: hash(replacement, 'md5'), replacementSizeBytes: replacement.length, files };
  return { ...plan, planId: hash(JSON.stringify(plan)) };
}
async function applyPlan({ plan, projectId, replacement, drive, loadRecord, updateRecords, references, workDir }) {
  assertPdf(replacement);
  const { planId, ...unsigned } = plan;
  if (hash(JSON.stringify(unsigned)) !== planId || plan.scope.projectId !== projectId || hash(replacement) !== plan.replacementSha256) throw new Error('Plan, project or replacement PDF changed. Create a new dry-run plan.');
  requireCompleteSelection(plan.files.flatMap(file => file.records), plan.scope);
  fs.mkdirSync(workDir, { recursive: true });
  const journalPath = path.join(workDir, 'journal.json');
  const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : { planId, files: {} };
  if (journal.planId !== planId) throw new Error('Backup directory belongs to another plan.');
  // Validate all website records and back up every old binary before any replacement.
  for (const file of plan.files) {
    const refs = await references(file.driveFileId);
    if (refs.some(ref => !file.records.some(row => row.id === ref.id))) throw new Error('An unselected record now references a target file.');
    for (const record of file.records) {
      const current = await loadRecord(record.id);
      if (!current || !matches(current.data, plan.scope) || current.data.driveFileId !== file.driveFileId || current.data.driveFolderId !== record.driveFolderId
        || (current.version !== record.version && current.data.contentReplacementId !== planId)) throw new Error(`Website record changed: ${record.id}`);
    }
    const meta = (await drive.files.get({ fileId: file.driveFileId, supportsAllDrives: true, fields: META })).data;
    checkDrive(meta, file);
    await checkFolder(drive, file.driveFolderId, plan.scope.folderName);
    if (![file.oldMd5, plan.replacementMd5].includes(meta.md5Checksum) || meta.name !== file.driveName) throw new Error(`Drive file changed since planning: ${file.driveFileId}`);
    const backup = path.join(workDir, `${file.driveFileId}.pdf`);
    if (fs.existsSync(backup)) {
      if (hash(fs.readFileSync(backup), 'md5') !== file.oldMd5) throw new Error('Backup checksum mismatch.');
    } else {
      if (meta.md5Checksum !== file.oldMd5) throw new Error('New content exists but the original backup is missing. Stop and recover the previous revision.');
      const response = await drive.files.get({ fileId: file.driveFileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
      const original = Buffer.from(response.data);
      if (hash(original, 'md5') !== file.oldMd5) throw new Error('Original file changed during backup.');
      fs.writeFileSync(backup, original, { flag: 'wx' });
    }
  }
  saveJson(journalPath, journal);
  for (const file of plan.files) {
    const meta = (await drive.files.get({ fileId: file.driveFileId, supportsAllDrives: true, fields: META })).data;
    checkDrive(meta, file);
    await checkFolder(drive, file.driveFolderId, plan.scope.folderName);
    if (![file.oldMd5, plan.replacementMd5].includes(meta.md5Checksum)) throw new Error('Drive content changed during execution.');
    if (meta.md5Checksum !== plan.replacementMd5) {
      // Persist intent first: a lost HTTP response can safely be resumed by checksum.
      journal.files[file.driveFileId] = 'started'; saveJson(journalPath, journal);
      await drive.files.update({ fileId: file.driveFileId, supportsAllDrives: true, requestBody: {}, media: { mimeType: 'application/pdf', body: Readable.from(replacement) }, fields: META });
    }
    const verified = (await drive.files.get({ fileId: file.driveFileId, supportsAllDrives: true, fields: META })).data;
    checkDrive(verified, file);
    if (verified.md5Checksum !== plan.replacementMd5 || Number(verified.size) !== replacement.length) throw new Error('Drive replacement could not be verified.');
    journal.files[file.driveFileId] = 'drive-updated'; saveJson(journalPath, journal);
    await updateRecords(file.records, plan);
    journal.files[file.driveFileId] = 'complete'; saveJson(journalPath, journal);
  }
  return journal;
}
async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--apply' || key === '--help' || key === '--expect-one-per-position') args[key.slice(2)] = true;
    else if (['--project','--visit','--name','--positions','--replacement','--plan','--confirm','--drive-auth','--folder-name'].includes(key) && argv[i+1] && !argv[i+1].startsWith('--')) args[key.slice(2)] = argv[++i];
    else throw new Error(`Unknown or incomplete argument: ${key}`);
  }
  if (args.help) { console.log('Dry run: node functions/scripts/replace-visit-file.js --project rcph-admin --visit clubAssembly --name "Resolution_05.pdf" --positions core --replacement <corrected.pdf> --plan <plan.json>\nApply: node functions/scripts/replace-visit-file.js --project rcph-admin --replacement <corrected.pdf> --plan <plan.json> --apply --confirm replace-file-contents\nDrive credentials: existing VISIT_DRIVE_* OAuth environment, or --drive-auth shared-drive with Drive-scoped ADC. Use --visit auto --expect-one-per-position to find a unique complete visit; --folder-name Resolutions verifies the parent subfolder name. No live writes occur during dry run.'); return; }
  if (!args.project || !args.replacement || !args.plan) throw new Error('--project, --replacement and --plan are required.');
  if (args.apply && args.confirm !== 'replace-file-contents') throw new Error('Apply requires --confirm replace-file-contents.');
  const replacement = fs.readFileSync(path.resolve(args.replacement)); assertPdf(replacement);
  const admin = require('firebase-admin');
  const { createGoogleDriveClient } = require('../lib/visit-drive');
  if (!admin.apps.length) admin.initializeApp({ projectId: args.project });
  const db = admin.firestore();
  const drive = createGoogleDriveClient({ config: { authMode: args['drive-auth'] || process.env.VISIT_DRIVE_AUTH_MODE || 'oauth' } });
  const references = async id => (await db.collection('visitSubmissions').where('driveFileId','==',id).get()).docs.filter(d=>d.data().status==='active').map(d=>({id:d.id}));
  const loadRecord = async id => { const snap=await db.collection('visitSubmissions').doc(id).get();return snap.exists?{id:snap.id,data:snap.data(),version:version(snap),snap}:null; };
  const updateRecords = async (records, plan) => {
    const batch = db.batch();
    for (const record of records) {
      const current = await loadRecord(record.id);
      if (!current || !matches(current.data,plan.scope) || current.data.driveFileId !== record.driveFileId || current.data.driveFolderId !== record.driveFolderId) throw new Error(`Website scope changed: ${record.id}`);
      if (current.data.contentReplacementId === plan.planId) continue;
      if (current.version !== record.version) throw new Error(`Website record changed during replacement: ${record.id}. Drive was updated; rerun only after reviewing the journal.`);
      batch.update(current.snap.ref,{sizeBytes:plan.replacementSizeBytes,mimeType:'application/pdf',contentSha256:plan.replacementSha256,contentReplacementId:plan.planId,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{lastUpdateTime:current.snap.updateTime});
    }
    await batch.commit();
  };
  const planPath=path.resolve(args.plan);
  if (args.apply) {
    const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
    const result=await applyPlan({plan,projectId:args.project,replacement,drive,loadRecord,updateRecords,references,workDir:`${planPath}.backups`});
    console.log(JSON.stringify({replaced:result.files,backups:`${planPath}.backups`},null,2));
  } else {
    if (!['auto','clubAssembly','dzrVisit','drrVisit'].includes(args.visit) || !args.name || !args.positions) throw new Error('Dry run requires --visit, exact --name and --positions (core or comma-separated canonical position keys).');
    const { POSITION_KEYS }=require('../lib/positions');
    const positions=[...new Set(args.positions.split(',').flatMap(value=>value==='core'?CORE_POSITIONS:[value]))];
    if (positions.some(value=>!POSITION_KEYS.includes(value))) throw new Error('Unknown position key.');
    const query = args.visit === 'auto' ? db.collection('visitSubmissions').where('status','==','active') : db.collection('visitSubmissions').where('visitType','==',args.visit);
    const records=(await query.get()).docs.map(snap=>({id:snap.id,data:snap.data(),version:version(snap)}));
    const scope=resolveSourceVisit(records,{projectId:args.project,visitType:args.visit,fileName:args.name,positions,folderName:args['folder-name'] || '',expectOnePerPosition:args['expect-one-per-position'] === true});
    const plan=await createPlan({scope,records,replacement,drive,references});
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(planPath,JSON.stringify(plan,null,2),{flag:'wx'});
    console.log(JSON.stringify({dryRun:true,plan:planPath,visitType:scope.visitType,folderName:scope.folderName,positions,files:plan.files.map(file=>({driveFileId:file.driveFileId,records:file.records}))},null,2));
  }
}
module.exports={CORE_POSITIONS,hash,selectRecords,resolveSourceVisit,createPlan,applyPlan};
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
