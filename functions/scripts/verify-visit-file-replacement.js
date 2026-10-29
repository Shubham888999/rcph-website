'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {hash,selectRecords,resolveSourceVisit,createPlan,applyPlan,loadProjectDriveSecrets}=require('./replace-visit-file');
const old=Buffer.from('%PDF-1.4 old resolution'), replacement=Buffer.from('%PDF-1.4 corrected resolution 5');
const scope={projectId:'test-project',visitType:'clubAssembly',fileName:'Resolution_05.pdf',positions:['president','secretary']};
function fixture(){
 const records=['president','secretary'].map((positionKey,i)=>({id:`s${i}`,version:'1:0',data:{status:'active',visitType:'clubAssembly',positionKey,documentCategory:`custom-folder-${i}`,originalFileName:'Resolution_05.pdf',driveFileId:`driveFile000${i}`,driveFolderId:`folder000${i}`}}));
 const contents=new Map(records.map(r=>[r.data.driveFileId,Buffer.from(old)]));let writes=0,lost=false,metadataFailure=false;
 const drive={files:{
  get:async(args)=> args.fileId.startsWith('folder')?{data:{id:args.fileId,name:'Resolutions',mimeType:'application/vnd.google-apps.folder'}}:args.alt==='media'?{data:contents.get(args.fileId)}:{data:{id:args.fileId,name:`internal-${args.fileId}.pdf`,mimeType:'application/pdf',size:String(contents.get(args.fileId).length),md5Checksum:hash(contents.get(args.fileId),'md5'),parents:[records.find(r=>r.data.driveFileId===args.fileId).data.driveFolderId],capabilities:{canEdit:true}}},
  update:async(args)=>{const chunks=[];for await(const chunk of args.media.body)chunks.push(Buffer.from(chunk));contents.set(args.fileId,Buffer.concat(chunks));writes++;if(lost){lost=false;throw new Error('Lost upload response')}return {data:{}};}
 }};
 const references=async id=>records.filter(r=>r.data.driveFileId===id&&r.data.status==='active').map(r=>({id:r.id}));
 const loadRecord=async id=>records.find(r=>r.id===id);
 const updateRecords=async(rows,plan)=>{if(metadataFailure){metadataFailure=false;throw new Error('Firestore unavailable')}rows.forEach(r=>{const record=records.find(x=>x.id===r.id);record.version='2:0';record.data.contentReplacementId=plan.planId;record.data.sizeBytes=plan.replacementSizeBytes;});};
 return {records,drive,contents,references,loadRecord,updateRecords,get writes(){return writes},loseResponse(){lost=true},failMetadata(){metadataFailure=true}};
}
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rcph-replacement-'));
 try{
  const secretReads=[];
  const credentials=await loadProjectDriveSecrets({projectId:'test-project',env:{VISIT_DRIVE_CLIENT_ID:'already-configured'},accessSecret:async name=>{secretReads.push(name);return {data:{payload:{data:Buffer.from('mock-secret-value').toString('base64')}}}}});
  assert.equal(credentials.VISIT_DRIVE_CLIENT_ID,'already-configured');
  assert.equal(credentials.VISIT_DRIVE_REFRESH_TOKEN,'mock-secret-value');
  assert.equal(secretReads.length,2);
  await assert.rejects(loadProjectDriveSecrets({projectId:'test-project',env:{},accessSecret:async()=>{throw new Error('sensitive-canary-token')}}),error=>!error.message.includes('sensitive-canary-token')&&error.message.includes('gcloud auth application-default login'));
  await assert.rejects(loadProjectDriveSecrets({projectId:'../other',env:{},accessSecret:async()=>{throw new Error('must not access')}}),/valid Google Cloud project/);
  const scoped=fixture();
  const strict={...scope,visitType:'auto',folderName:'Resolutions',expectOnePerPosition:true};
  assert.equal(resolveSourceVisit(scoped.records,strict).visitType,'clubAssembly');
  assert.throws(()=>resolveSourceVisit(scoped.records.slice(1),strict),/unique visit/);
  assert.throws(()=>resolveSourceVisit([...scoped.records,...scoped.records.map(r=>({...r,data:{...r.data,visitType:'dzrVisit'}}))],strict),/unique visit/);
  const detected=resolveSourceVisit(scoped.records,strict);
  await createPlan({...scoped,scope:detected,replacement});
  await assert.rejects(createPlan({...scoped,scope:{...detected,folderName:'Wrong folder'},replacement}),/Expected the/);
  await assert.rejects(createPlan({...scoped,records:scoped.records.slice(1),scope:detected,replacement}),/exactly one/);
  await assert.rejects(createPlan({...scoped,records:[...scoped.records,{...scoped.records[0],id:'duplicate'}],scope:detected,replacement}),/exactly one/);
  assert.equal(scoped.writes,0);
  const f=fixture();
  assert.equal(selectRecords([...f.records,{id:'wrong',data:{...f.records[0].data,originalFileName:'Resolution_04.pdf'}}],scope).length,2);
  const plan=await createPlan({...f,scope,replacement});assert.equal(f.writes,0);assert.equal(plan.files.length,2);
  const options={...f,plan,projectId:'test-project',replacement,workDir:path.join(root,'success')};
  await applyPlan(options);assert.equal(f.writes,2);
  for(const file of plan.files){assert.deepEqual(f.contents.get(file.driveFileId),replacement);assert.deepEqual(fs.readFileSync(path.join(options.workDir,`${file.driveFileId}.pdf`)),old)}
  assert.ok(f.records.every(r=>r.data.sizeBytes===replacement.length));
  await applyPlan(options);assert.equal(f.writes,2,'resuming a completed plan must not upload again');
  for(const failure of ['loseResponse','failMetadata']){
   const env=fixture();const p=await createPlan({...env,scope,replacement});const opts={...env,plan:p,projectId:'test-project',replacement,workDir:path.join(root,failure)};
   env[failure]();await assert.rejects(applyPlan(opts));await applyPlan(opts);assert.equal(env.writes,2);assert.ok(env.records.every(r=>r.data.contentReplacementId===p.planId));
  }
  const stale=fixture();const p=await createPlan({...stale,scope,replacement});stale.records[0].version='9:0';
  await assert.rejects(applyPlan({...stale,plan:p,projectId:'test-project',replacement,workDir:path.join(root,'stale')}),/changed/);assert.equal(stale.writes,0);
  await assert.rejects(applyPlan({...stale,plan:p,projectId:'wrong',replacement,workDir:path.join(root,'wrong')}),/changed/);
  const external=fixture();await assert.rejects(createPlan({...external,scope,replacement,references:async()=>[{id:'outside-scope'}]}),/outside/);
  console.log('File replacement checks passed: exact scope, dry run, preserved IDs/folders, original backups, metadata, idempotency, lost-response recovery, partial-failure recovery, stale records and outside references.');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
