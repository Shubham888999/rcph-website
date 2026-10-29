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
function setup() {
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
  const calls={content:0,trash:0,pin:0};
  const drive={files:{async get({fileId,alt}){if(alt==='media')return {data:Readable.from(currentBytes)};if(!items.has(fileId))throw {response:{status:404}};return {data:structuredClone(items.get(fileId))}},async update({fileId,requestBody,media}){
    const item=items.get(fileId);
    if(media){const chunks=[];for await(const chunk of media.body)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);currentBytes=bytes;Object.assign(item,{md5Checksum:md5(bytes),size:String(bytes.length),headRevisionId:'revision2'});revisions.set('revision2',{id:'revision2',md5Checksum:md5(bytes),keepForever:false,bytes});calls.content++;}
    if(requestBody?.trashed){item.trashed=true;calls.trash++;}
    if(afterDrive)await afterDrive();
    if(loseDriveResponse){loseDriveResponse=false;throw new Error('lost HTTP response')}
    return {data:structuredClone(item)};
  }},revisions:{async update({revisionId}){if(failBackup)throw new Error('cannot pin');revisions.get(revisionId).keepForever=true;calls.pin++;if(afterBackup)await afterBackup();return {data:revisions.get(revisionId)}},async get({revisionId,alt}){return alt==='media'?{data:Readable.from(revisions.get(revisionId).bytes)}:{data:structuredClone(revisions.get(revisionId))}}}};
  let held=false;
  const locks={async acquireLock(){if(held)throw {status:409};held=true;return {async release(){held=false}}}};
  const service=createVisitFileActionService({adapter,visitService,driveClient:drive,folderLockManager:locks,getDriveConfig:()=>config,now:()=>time});
  const input={submissionId:'submission1',operationId:'request1',fileName:'New Document.pdf',mimeType:'application/pdf',sizeBytes:replacement.length};
  return {adapter,visitService,service,items,revisions,calls,input,file:{buffer:replacement,mimeType:'application/pdf'},setFailCommit(){failCommit=true},setLostResponse(){loseDriveResponse=true},setFailBackup(){failBackup=true},afterDrive(fn){afterDrive=fn},afterBackup(fn){afterBackup=fn},advance(ms){time+=ms}};
}
test('assigned director replaces manager-uploaded file in place with a pinned original and unchanged primary/count/URLs',async()=>{
 const e=setup();const before={...e.adapter.store.visitSubmissions.submission1};
 await e.service.replace('director',e.input,e.file);
 const result=e.adapter.store.visitSubmissions.submission1;
 for(const key of ['driveFileId','driveFolderId','driveFileUrl','originalFileName','fileName','uploadedByUid','documentCategory'])assert.equal(result[key],before[key]);
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
