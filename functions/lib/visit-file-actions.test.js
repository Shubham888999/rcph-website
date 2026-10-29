'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createMemoryVisitSubmissionAdapter, createVisitSubmissionService, shapeSubmission } = require('./visit-submissions');
const { createVisitFileActionService, createVisitFileReplacementHandler, OPERATIONS } = require('./visit-file-actions');
const md5 = bytes => crypto.createHash('md5').update(bytes).digest('hex');
const old = Buffer.from('%PDF-1.4 old document');
const replacement = Buffer.from('%PDF-1.4 new document contents');
const config = { authMode: 'oauth', rootFolderIds: { dzrVisit: 'rootDriveFolder001' } };
function setup(options = {}) {
  let time = 1000000, failCommit = false, loseDriveResponse = false, failBackup = false, afterDrive = null, afterBackup = null;
  const people = {
    director: { role:'bod', status:'approved', active:true, positionKeys:['cmd'] },
    manager: { role:'president', status:'approved', active:true, positionKeys:['president'] },
    outsider: { role:'bod', status:'approved', active:true, positionKeys:['csd'] },
    official: { role:'districtOfficial', status:'approved', active:true },
    prospect: { role:'prospect', status:'approved', active:true },
  };
  const source = { submissionId:'submission1',visitType:'dzrVisit',positionKey:'cmd',fileName:'Document.pdf',originalFileName:'Document.pdf',mimeType:'application/pdf',sizeBytes:old.length,uploadedByUid:'manager',status:'active',driveFileId:'driveFile00001',driveFolderId:'categoryFolder0001',documentCategory:'custom-11111111',driveFileUrl:'https://drive.google.com/file/d/driveFile00001/view',updatedAt:123 };
  const adapter = createMemoryVisitSubmissionAdapter({users:people,roles:Object.fromEntries(Object.entries(people).map(([id,p])=>[id,{role:p.role,status:p.status,active:true}])),bodPositionAssignments:{cmd_director:{uid:'director',positionKey:'cmd',active:true},csd_outsider:{uid:'outsider',positionKey:'csd',active:true}},visitSubmissionConfig:{dzrVisit:{enabled:true,submissionOpen:true}},visitSubmissionPositions:{dzrVisit_cmd:{visitType:'dzrVisit',positionKey:'cmd',driveFolderId:'positionFolder001',categoryFolderIds:{'custom-11111111':'categoryFolder0001'},activeFileCount:1,primaryPresentationSubmissionId:'submission1',enabled:true,submissionOpen:true}},visitSubmissions:{submission1:source}});
  // Match Firestore transaction rollback/serialization, including injected commit failures.
  const baseTransaction = adapter.runTransaction.bind(adapter);
  let tail = Promise.resolve();
  adapter.runTransaction = callback => {
    const task = tail.then(async () => {
      const backup = JSON.parse(JSON.stringify(adapter.store));
      try { return await baseTransaction(tx => callback({...tx,createDoc(collection,id,data){if(collection==='visitSubmissionAudit'&&failCommit){failCommit=false;throw new Error('Firestore unavailable')}return tx.createDoc(collection,id,data)}})); }
      catch(error){Object.keys(adapter.store).forEach(k=>delete adapter.store[k]);Object.assign(adapter.store,backup);throw error;}
    });
    tail = task.catch(()=>{});return task;
  };
  const visitService=createVisitSubmissionService({adapter});
  const items = new Map([
    ['positionFolder001',{id:'positionFolder001',mimeType:'application/vnd.google-apps.folder',parents:['rootDriveFolder001']}],
    ['categoryFolder0001',{id:'categoryFolder0001',mimeType:'application/vnd.google-apps.folder',parents:['positionFolder001']}],
    ['driveFile00001',{id:'driveFile00001',name:'Document.pdf',mimeType:'application/pdf',parents:['categoryFolder0001'],trashed:false,md5Checksum:md5(old),size:String(old.length),headRevisionId:'revision1',capabilities:{canEdit:true,canTrash:true}}],
  ]);
  const revisions=new Map([['revision1',{id:'revision1',md5Checksum:md5(old),keepForever:false,bytes:old}]]);
  let currentBytes=old;
  const calls={content:0,trash:0,pin:0,rename:0};
  const drive={files:{async get({fileId,alt}){if(alt==='media')return {data:Readable.from(currentBytes)};if(!items.has(fileId))throw {response:{status:404}};return {data:structuredClone(items.get(fileId))}},async update({fileId,requestBody,media}){
    const item=items.get(fileId);
    if(requestBody?.name){item.name=requestBody.name;calls.rename++;}
    if(media){const chunks=[];for await(const chunk of media.body)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);currentBytes=bytes;Object.assign(item,{md5Checksum:md5(bytes),size:String(bytes.length),headRevisionId:'revision2'});revisions.set('revision2',{id:'revision2',md5Checksum:md5(bytes),keepForever:false,bytes});calls.content++;}
    if(requestBody?.trashed){item.trashed=true;calls.trash++;}
    if(afterDrive)await afterDrive();
    if(loseDriveResponse){loseDriveResponse=false;throw new Error('lost HTTP response')}
    return {data:structuredClone(item)};
  }},revisions:{async update({revisionId}){if(failBackup)throw new Error('cannot pin');revisions.get(revisionId).keepForever=true;calls.pin++;if(afterBackup)await afterBackup();return {data:revisions.get(revisionId)}},async get({revisionId,alt}){return alt==='media'?{data:Readable.from(revisions.get(revisionId).bytes)}:{data:structuredClone(revisions.get(revisionId))}}}};
  let held=false;
  const locks={async acquireLock(){if(held)throw {status:409};held=true;return {async release(){held=false}}}};
  const logs=[];
  const service=createVisitFileActionService({adapter,visitService,driveClient:drive,folderLockManager:locks,getDriveConfig:Object.hasOwn(options,'getDriveConfig')?options.getDriveConfig:(()=>config),env:options.env,logger:{error(message,details){logs.push({message,...details})}},now:()=>time});
  const input={submissionId:'submission1',operationId:'request1',fileName:'New Document.pdf',mimeType:'application/pdf',sizeBytes:replacement.length};
  return {adapter,visitService,service,drive,logs,items,revisions,calls,input,file:{buffer:replacement,mimeType:'application/pdf'},setFailCommit(){failCommit=true},setLostResponse(){loseDriveResponse=true},setFailBackup(){failBackup=true},afterDrive(fn){afterDrive=fn},afterBackup(fn){afterBackup=fn},advance(ms){time+=ms}};
}
test('assigned director replaces manager-uploaded file in place with a pinned original and unchanged primary/count/URLs',async()=>{
 const e=setup();const before={...e.adapter.store.visitSubmissions.submission1};
 await e.service.replace('director',e.input,e.file);
 const result=e.adapter.store.visitSubmissions.submission1;
 for(const key of ['driveFileId','driveFolderId','driveFileUrl','uploadedByUid','documentCategory'])assert.equal(result[key],before[key]);
 for(const key of ['fileName','originalFileName','sanitizedOriginalFileName'])assert.equal(result[key],'New Document.pdf');
 assert.equal(e.items.get('driveFile00001').name,'New Document.pdf');
 assert.equal(result.sizeBytes,replacement.length);assert.equal(result.status,'active');assert.equal(result.fileMutationId,null);
 assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.activeFileCount,1);assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.primaryPresentationSubmissionId,'submission1');
 assert.equal(e.revisions.get('revision1').keepForever,true);assert.equal(e.revisions.get('revision1').md5Checksum,md5(old));
 assert.equal(e.calls.content,1);await e.service.replace('director',e.input,e.file);assert.equal(e.calls.content,1);
 assert.equal(Object.keys(e.adapter.store.visitSubmissionAudit).length,1);
});
test('Delete trashes the Drive file before hiding the website record and releases its count/primary exactly once',async()=>{
 const e=setup();e.afterDrive(()=>{assert.equal(e.adapter.store.visitSubmissions.submission1.status,'active')});
 await e.service.remove('director',{submissionId:'submission1',mode:'withdraw'});
 assert.equal(e.items.get('driveFile00001').trashed,true);assert.equal(e.adapter.store.visitSubmissions.submission1.status,'archived');
 assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.activeFileCount,0);assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.primaryPresentationSubmissionId,'');
 await e.service.remove('director',{submissionId:'submission1',mode:'withdraw'});assert.equal(e.calls.trash,1);
});
for(const action of ['replace','delete'])for(const fault of ['setLostResponse','setFailCommit'])test(`${action} resumes after ${fault} without repeated Drive writes or duplicate counts`,async()=>{
 const e=setup();e[fault]();const run=()=>action==='replace'?e.service.replace('director',e.input,e.file):e.service.remove('director',{submissionId:'submission1'});
 await assert.rejects(run());assert.equal(e.adapter.store.visitSubmissions.submission1.status,'active');assert.ok(e.adapter.store.visitSubmissions.submission1.fileMutationId);
 await run();assert.equal(e.calls[action==='replace'?'content':'trash'],1);assert.equal(Object.keys(e.adapter.store.visitSubmissionAudit).length,1);
});
test('a new request ID can finish a pending replacement only with identical bytes',async()=>{
 const e=setup();e.setFailCommit();await assert.rejects(e.service.replace('director',e.input,e.file));
 const different=Buffer.from('different data');await assert.rejects(e.service.replace('director',{...e.input,operationId:'new-request',sizeBytes:different.length},{...e.file,buffer:different}),error=>error.details.reason==='file-pending');
 await e.service.replace('director',{...e.input,operationId:'retry-after-reload'},e.file);assert.equal(e.calls.content,1);
});
test('backup failure leaves original contents, active record and count intact',async()=>{
 const e=setup();e.setFailBackup();await assert.rejects(e.service.replace('director',e.input,e.file));assert.equal(e.calls.content,0);assert.equal(e.items.get('driveFile00001').md5Checksum,md5(old));assert.equal(e.adapter.store.visitSubmissions.submission1.fileMutationId,null);
});
for(const user of ['outsider','official','prospect'])test(`${user} cannot replace or delete the assigned director file`,async()=>{
 const e=setup();await assert.rejects(e.service.replace(user,e.input,e.file));await assert.rejects(e.service.remove(user,{submissionId:'submission1'}));assert.equal(e.calls.content+e.calls.trash,0);
});
test('locked folders block directors but managers may complete maintenance',async()=>{
 const e=setup();e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.locked=true;
 await assert.rejects(e.service.remove('director',{submissionId:'submission1'}));await e.service.remove('manager',{submissionId:'submission1',mode:'remove'});assert.equal(e.adapter.store.visitSubmissions.submission1.status,'admin-removed');
});
test('pending action rechecks revoked access before writing Drive',async()=>{
 const e=setup();e.afterBackup(()=>{e.adapter.store.users.director.status='pending'});await assert.rejects(e.service.replace('director',e.input,e.file));assert.equal(e.calls.content,0);
});
test('manager can finish pending Drive update after original actor loses access',async()=>{
 const e=setup();e.afterDrive(()=>{e.adapter.store.users.director.status='pending'});await assert.rejects(e.service.replace('director',e.input,e.file));
 e.afterDrive(null);await e.service.replace('manager',{...e.input,operationId:'manager-recovery'},e.file);assert.equal(e.calls.content,1);
 assert.equal(Object.values(e.adapter.store.visitSubmissionAudit)[0].actorUid,'manager');
});
for(const scenario of ['moved-file','moved-folder','wrong-root','shared-file','no-edit','no-trash','different-type'])test(`${scenario} never changes Drive contents or website status`,async()=>{
 const e=setup();if(scenario==='moved-file')e.items.get('driveFile00001').parents=['other'];
 if(scenario==='moved-folder')e.items.get('categoryFolder0001').parents=['other'];
 if(scenario==='wrong-root')e.items.get('positionFolder001').parents=['other'];
 if(scenario==='shared-file')e.adapter.store.visitSubmissions.other={...e.adapter.store.visitSubmissions.submission1,submissionId:'other'};
 if(scenario==='no-edit')e.items.get('driveFile00001').capabilities.canEdit=false;
 if(scenario==='no-trash')e.items.get('driveFile00001').capabilities.canTrash=false;
 if(scenario==='different-type'){e.input.fileName='Photo.png';e.input.mimeType='image/png';e.file.mimeType='image/png'}
 await assert.rejects(scenario==='no-trash'?e.service.remove('director',{submissionId:'submission1'}):e.service.replace('director',e.input,e.file));assert.equal(e.calls.content+e.calls.trash,0);assert.equal(e.adapter.store.visitSubmissions.submission1.status,'active');
});
test('concurrent Delete is refused while a replacement owns the folder lease',async()=>{
 const e=setup();let release;const blocked=new Promise(resolve=>{release=resolve});let entered;const started=new Promise(resolve=>{entered=resolve});e.afterDrive(async()=>{entered();await blocked});const replacing=e.service.replace('director',e.input,e.file);await started;
 await assert.rejects(e.service.remove('director',{submissionId:'submission1'}),error=>error.details.reason==='file-busy');release();await replacing;assert.equal(e.calls.trash,0);
});
test('stale leases can resume after a terminated process; live leases cannot',async()=>{
 const e=setup();e.setFailCommit();await assert.rejects(e.service.replace('director',e.input,e.file));const op=Object.values(e.adapter.store[OPERATIONS])[0];op.leaseUntilMillis=1000000+240000;
 await assert.rejects(e.service.replace('director',e.input,e.file));e.advance(240001);await e.service.replace('director',e.input,e.file);assert.equal(e.calls.content,1);
});
test('capability shaping includes manager-uploaded files in assigned folders, respecting locks and pending actions',()=>{
 const access={uid:'director',folderPositionKeys:['cmd']};const source={status:'active',positionKey:'cmd',uploadedByUid:'manager'};
 assert.equal(shapeSubmission(source,access,{folderWritable:true}).canWithdraw,true);assert.equal(shapeSubmission(source,access,{folderWritable:false}).canReplace,false);
 assert.equal(shapeSubmission({...source,fileMutationId:'op',fileMutationAction:'replace'},access,{folderWritable:true}).canWithdraw,false);
});
function response(){return {headers:{},statusCode:200,set(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(body){this.body=body;return this},send(body){this.body=body;return this}}}
test('replacement HTTP validates origin, Firebase auth and server-only destination fields',async()=>{
 let parsed=0,executed=0;const handler=createVisitFileReplacementHandler({service:{async replace(){executed++;return {ok:true}}},verifyIdToken:async token=>{if(token!=='good')throw new Error('bad');return {uid:'director'}},parseMultipartUpload:async()=>{parsed++;return {fields:{submissionId:'s',driveFileId:'browser-chosen'},file:{buffer:old}}}});
 const request={method:'POST',headers:{origin:'https://rcph3131.org',authorization:'Bearer bad'}};let res=response();await handler(request,res);assert.equal(res.statusCode,401);assert.equal(parsed,0);
 request.headers.authorization='Bearer good';res=response();await handler(request,res);assert.equal(res.statusCode,400);assert.equal(executed,0);
 request.headers.origin='https://evil.example';res=response();await handler(request,res);assert.equal(res.statusCode,403);assert.equal(parsed,1);
});
test('production delete delegation requires the explicit Drive-sync client contract; legacy replacement cannot issue new tickets',async()=>{
 const e=setup();let delegated=0;
 const service=createVisitSubmissionService({adapter:e.adapter,fileActions:{async remove(_uid,input){delegated++;assert.equal(input.mode,'withdraw');return {ok:true}}}});
 await assert.rejects(service.withdrawSubmission('director',{submissionId:'submission1'}),error=>error.details.reason==='client-refresh');
 await service.withdrawSubmission('director',{submissionId:'submission1',syncDrive:true});assert.equal(delegated,1);
 await assert.rejects(service.replaceSubmission('director',{submissionId:'submission1'}),/Refresh Club Visits/);
});
test('replacement preflight permits Authorization and valid authenticated requests reach the service',async()=>{
 let executed=0;const handler=createVisitFileReplacementHandler({service:{async replace(uid,fields,file){executed++;assert.equal(uid,'director');assert.equal(fields.submissionId,'s');assert.equal(file.buffer,old);return {ok:true,submissionId:'s',status:'active'}}},verifyIdToken:async()=>({uid:'director'}),parseMultipartUpload:async()=>({fields:{submissionId:'s',operationId:'request1',fileName:'Doc.pdf',mimeType:'application/pdf',sizeBytes:String(old.length)},file:{buffer:old,mimeType:'application/pdf'}})});
 let res=response();await handler({method:'OPTIONS',headers:{origin:'https://rcph3131.org'}},res);assert.equal(res.statusCode,204);assert.match(res.headers['Access-Control-Allow-Headers'],/Authorization/);
 res=response();await handler({method:'POST',headers:{origin:'https://rcph3131.org',authorization:'Bearer good'}},res);assert.equal(res.statusCode,200);assert.equal(executed,1);
});

test('missing Drive settings fail before a reservation or Drive write and produce a useful diagnostic',async()=>{
 const e=setup({env:{VISIT_DRIVE_AUTH_MODE:'oauth'},getDriveConfig:null});
 await assert.rejects(e.service.replace('director',e.input,e.file),error=>{
  assert.equal(error.details.reason,'drive-config');assert.equal(error.details.stage,'load-drive-config');assert.match(error.details.diagnosticId,/^[a-f0-9]{24}$/);return true;
 });
 assert.equal(e.calls.content+e.calls.trash,0);assert.equal(e.adapter.store.visitSubmissions.submission1.fileMutationId,undefined);
 assert.equal(e.logs.length,1);assert.deepEqual(e.logs[0].missingSettings,['VISIT_CLUB_ASSEMBLY_FOLDER_ID','VISIT_DZR_FOLDER_ID','VISIT_DRR_FOLDER_ID']);
 assert.equal(e.logs[0].stage,'load-drive-config');
});

test('provider failures log the failing stage and reason without tokens, filenames, bodies or raw provider messages',async()=>{
 const e=setup();const privateText='private-token-and-file-contents';
 e.drive.revisions.update=async()=>{throw Object.assign(new Error(privateText),{code:400,response:{status:400,data:{error:{message:privateText,errors:[{reason:'badRequest'}]}}},config:{headers:{Authorization:privateText}}})};
 await assert.rejects(e.service.replace('director',e.input,e.file));
 assert.equal(e.calls.content,0);assert.equal(e.logs.length,1);const entry=e.logs[0];
 assert.equal(entry.stage,'back-up-drive-revision');assert.equal(entry.providerReason,'badRequest');assert.equal(entry.httpStatus,400);assert.equal(entry.errorCode,'400');
 const serialized=JSON.stringify(entry);assert.ok(!serialized.includes(privateText));assert.ok(!serialized.includes('New Document.pdf'));assert.ok(!serialized.includes('driveFile00001'));
});

test('HTTP retains a service diagnostic without logging the same failure twice',async()=>{
 const logs=[];
 const handler=createVisitFileReplacementHandler({
  logger:{error(...args){logs.push(args)}},
  verifyIdToken:async()=>({uid:'director'}),
  parseMultipartUpload:async()=>({fields:{submissionId:'s'},file:{buffer:old}}),
  service:{async replace(){
   throw Object.assign(new Error('private detail'),{code:'failed-precondition',details:{reason:'drive-config',diagnosticId:'a'.repeat(24),stage:'load-drive-config'}});
  }},
 });
 const res=response();await handler({method:'POST',headers:{origin:'https://rcph3131.org',authorization:'Bearer good'}},res);
 const body=JSON.parse(res.body);assert.equal(res.statusCode,412);assert.equal(body.diagnosticId,'a'.repeat(24));assert.equal(body.stage,'load-drive-config');assert.equal(body.reason,'drive-config');assert.ok(!res.body.includes('private detail'));assert.equal(logs.length,0);
});

test('multipart failures before the service runs are logged with a diagnostic and parse stage',async()=>{
 const logs=[];const handler=createVisitFileReplacementHandler({logger:{error(message,details){logs.push({message,...details})}},verifyIdToken:async()=>({uid:'director'}),parseMultipartUpload:async()=>{throw Object.assign(new Error('private request body'),{httpStatus:400})},service:{async replace(){assert.fail('The service must not run')}}});
 const res=response();await handler({method:'POST',headers:{origin:'https://rcph3131.org',authorization:'Bearer good'}},res);
 const body=JSON.parse(res.body);assert.equal(res.statusCode,400);assert.equal(logs.length,1);assert.equal(logs[0].stage,'parse-replacement');assert.equal(body.diagnosticId,logs[0].diagnosticId);assert.ok(!JSON.stringify(logs).includes('private request body'));
});

test('success includes the digest of downloaded replacement bytes and keeps the main presentation',async()=>{
 const e=setup();const result=await e.service.replace('director',e.input,e.file);
 assert.equal(result.verifiedReplacement.sha256,crypto.createHash('sha256').update(replacement).digest('hex'));
 assert.equal(result.verifiedReplacement.sizeBytes,replacement.length);assert.equal(result.verifiedReplacement.driveFileId,'driveFile00001');assert.equal(result.unchanged,false);
 assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.primaryPresentationSubmissionId,'submission1');
});

test('new metadata with unchanged file bytes cannot produce a success response',async()=>{
 const e=setup();const get=e.drive.files.get;
 e.drive.files.get=async args=>args.alt==='media'?{data:Readable.from(old)}:get(args);
 e.afterDrive(()=>{e.items.get('driveFile00001').sha256Checksum=crypto.createHash('sha256').update(replacement).digest('hex')});
 await assert.rejects(e.service.replace('director',e.input,e.file),error=>error.details.reason==='file-changed');
 assert.equal(e.adapter.store.visitSubmissions.submission1.contentSha256,undefined);
 assert.equal(Object.values(e.adapter.store[OPERATIONS])[0].state,'pending');
});

test('a completed request re-downloads the file instead of accepting its old success record',async()=>{
 const e=setup();await e.service.replace('director',e.input,e.file);
 const get=e.drive.files.get;
 e.drive.files.get=async args=>args.alt==='media'?{data:Readable.from(old)}:get(args);
 await assert.rejects(e.service.replace('director',e.input,e.file),error=>error.details.reason==='file-changed'&&error.details.stage==='verify-completed-replacement');
 assert.equal(e.calls.content,1);
});

test('the exact existing contents are verified and reported as unchanged',async()=>{
 const e=setup();e.input.sizeBytes=old.length;e.input.fileName='Document.pdf';e.file.buffer=old;
 const result=await e.service.replace('director',e.input,e.file);
 assert.equal(result.unchanged,true);assert.equal(e.calls.content,0);assert.equal(result.verifiedReplacement.sha256,crypto.createHash('sha256').update(old).digest('hex'));
});

test('the same contents with a new filename rename both Drive and website while keeping the main selection',async()=>{
 const e=setup();e.input.sizeBytes=old.length;e.file.buffer=old;
 const result=await e.service.replace('director',e.input,e.file);
 assert.equal(result.unchanged,false);assert.equal(e.calls.content,0);assert.equal(e.calls.rename,1);assert.equal(result.verifiedReplacement.fileName,'New Document.pdf');
 assert.equal(e.items.get('driveFile00001').name,'New Document.pdf');assert.equal(e.adapter.store.visitSubmissions.submission1.originalFileName,'New Document.pdf');
 assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.primaryPresentationSubmissionId,'submission1');assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.activeFileCount,1);
});

test('pending replacement retries cannot silently change the target filename',async()=>{
 const e=setup();e.setFailCommit();await assert.rejects(e.service.replace('director',e.input,e.file));
 await assert.rejects(e.service.replace('director',{...e.input,fileName:'Different.pdf'},e.file),error=>error.details.reason==='file-pending');
 await e.service.replace('director',e.input,e.file);assert.equal(e.calls.content,1);assert.equal(e.items.get('driveFile00001').name,'New Document.pdf');
});

test('a completed request cannot be reused for identical bytes with a different filename',async()=>{
 const e=setup();await e.service.replace('director',e.input,e.file);
 await assert.rejects(e.service.replace('director',{...e.input,fileName:'Different.pdf'},e.file),error=>error.details.reason==='file-changed');
 assert.equal(e.items.get('driveFile00001').name,'New Document.pdf');
});

test('a pending operation from the previous filename-preserving version can finish with the selected name',async()=>{
 const e=setup();e.setFailCommit();await assert.rejects(e.service.replace('director',e.input,e.file));
 const operation=Object.values(e.adapter.store[OPERATIONS])[0];delete operation.replacement.fileName;e.items.get('driveFile00001').name='Document.pdf';
 await e.service.replace('director',{...e.input,operationId:'new-client-request'},e.file);
 assert.equal(e.calls.content,1);assert.equal(e.items.get('driveFile00001').name,'New Document.pdf');assert.equal(e.adapter.store.visitSubmissions.submission1.fileName,'New Document.pdf');
});

test('replacing a main PPTX changes its name and contents without changing its main selection or link',async()=>{
 const e=setup();const mime='application/vnd.openxmlformats-officedocument.presentationml.presentation';
 Object.assign(e.adapter.store.visitSubmissions.submission1,{mimeType:mime,fileName:'Original.pptx',originalFileName:'Original.pptx'});
 Object.assign(e.items.get('driveFile00001'),{mimeType:mime,name:'Original.pptx'});
 Object.assign(e.input,{mimeType:mime,fileName:'Updated presentation.pptx'});e.file.mimeType=mime;
 const result=await e.service.replace('director',e.input,e.file);
 assert.equal(result.verifiedReplacement.fileName,'Updated presentation.pptx');assert.equal(e.calls.content,1);
 const source=e.adapter.store.visitSubmissions.submission1;assert.equal(source.driveFileId,'driveFile00001');assert.equal(source.originalFileName,'Updated presentation.pptx');
 assert.equal(e.adapter.store.visitSubmissionPositions.dzrVisit_cmd.primaryPresentationSubmissionId,'submission1');
});

test('a website Open file link targeting another Drive file is blocked before any write',async()=>{
 const e=setup();e.adapter.store.visitSubmissions.submission1.fileUrl='https://drive.google.com/file/d/differentDriveFile/view';
 await assert.rejects(e.service.replace('director',e.input,e.file),error=>error.details.reason==='file-location');assert.equal(e.calls.content+e.calls.trash,0);
});

test('read-only inspection detects the actual byte and link mismatches without modifying data',async()=>{
 const {inspectReplacement,latestReplacements}=require('../scripts/inspect-visit-file-actions');
 const e=setup();await e.service.replace('director',e.input,e.file);const operation=Object.values(e.adapter.store[OPERATIONS])[0];
 const options={operation,drive:e.drive,loadSubmission:async()=>e.adapter.store.visitSubmissions.submission1};
 const before=e.calls.content;let report=await inspectReplacement(options);
 assert.equal(report.downloadedContentsMatchReplacement,true);assert.equal(report.websiteRecordMatchesReplacement,true);assert.equal(report.websiteLinkMatchesDriveFile,true);
 const get=e.drive.files.get;e.drive.files.get=async args=>args.alt==='media'?{data:Readable.from(old)}:get(args);
 e.adapter.store.visitSubmissions.submission1.fileUrl='https://drive.google.com/file/d/otherFile00001/view';report=await inspectReplacement(options);
 assert.equal(report.downloadedContentsMatchReplacement,false);assert.equal(report.websiteLinkMatchesDriveFile,false);assert.equal(e.calls.content,before);
 const rows=latestReplacements([{id:'old',data:{...operation,completedAt:1}},{id:'new',data:{...operation,completedAt:2}},{id:'unrelated',data:{...operation,fileName:'Other.pdf',completedAt:3}}],'Document.pdf');
 assert.equal(rows.length,1);assert.equal(rows[0].id,'new');
});
