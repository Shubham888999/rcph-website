import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { findVisitUploadConflicts, hasVisitUploadConflicts, performVisitReplacement, resolveVisitReplacementEndpoint, visitFileActionError } from './visitFileActionsModel.js';
import { safeAdminError } from '../shared/adminErrors.js';
const env={VITE_FIREBASE_PROJECT_ID:'rcph-admin'};
const file=new File(['%PDF-1.4 corrected'], 'New document.pdf',{type:'application/pdf'});
function store(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map};}
function success(){return {ok:true,json:async()=>({ok:true,submissionId:'submission1',status:'active',verifiedReplacement:{driveFileId:'driveFile00001',sha256:createHash('sha256').update('%PDF-1.4 corrected').digest('hex'),sizeBytes:file.size}})};}
test('replacement endpoint follows the trusted upload project and emulator endpoint',()=>{
 assert.equal(resolveVisitReplacementEndpoint(env),'https://us-central1-rcph-admin.cloudfunctions.net/replaceVisitSubmissionFile');
 assert.equal(resolveVisitReplacementEndpoint({VITE_FIREBASE_PROJECT_ID:'another-project'}),'https://us-central1-another-project.cloudfunctions.net/replaceVisitSubmissionFile');
 assert.equal(resolveVisitReplacementEndpoint({VITE_FIREBASE_PROJECT_ID:'rcph-admin',VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT:'https://evil.example/uploadVisitSubmissionFile'}),'https://us-central1-rcph-admin.cloudfunctions.net/replaceVisitSubmissionFile');
});
test('replacement sends Firebase identity and file bytes without browser-selected Drive authority',async()=>{
 const storage=store();let request;
 await performVisitReplacement({file,submissionId:'submission1',uid:'director',getIdToken:async()=>'firebase-token',env,storage,fetcher:async(endpoint,options)=>{request={endpoint,...options};return success()}});
 assert.equal(request.headers.Authorization,'Bearer firebase-token');assert.equal(request.body.get('submissionId'),'submission1');assert.equal(request.body.get('fileName'),'New document.pdf');assert.equal(request.body.get('sizeBytes'),String(file.size));assert.equal(await request.body.get('file').text(),await file.text());
 for(const field of ['driveFileId','driveFolderId','positionKey','visitType'])assert.equal(request.body.has(field),false);
 assert.equal(storage.map.size,0);
});
test('lost response preserves the operation ID through a retry; success clears it',async()=>{
 const storage=store();const ids=[];let count=0;
 const options={file,submissionId:'submission1',uid:'director',getIdToken:async()=>'token',env,storage,fetcher:async(_url,req)=>{ids.push(req.body.get('operationId'));if(!count++)throw new Error('network failed');return success()}};
 await assert.rejects(performVisitReplacement(options));assert.equal(storage.map.size,1);await performVisitReplacement(options);assert.equal(ids[0],ids[1]);assert.equal(storage.map.size,0);
});
test('a failed server result retains retry state and uses safe actionable errors',async()=>{
 const storage=store();await assert.rejects(performVisitReplacement({file,submissionId:'submission1',uid:'director',getIdToken:async()=>'token',env,storage,fetcher:async()=>({ok:false,json:async()=>({reason:'file-location',message:'internal private data'})})}),error=>error.code==='visit/file-location'&&!error.message.includes('internal private data'));
 assert.equal(storage.map.size,1);assert.match(safeAdminError(visitFileActionError({details:{reason:'file-busy'}})),/retry/i);
});
test('optional storage denial does not block replacement',async()=>{
 await performVisitReplacement({file,submissionId:'submission1',uid:'director',getIdToken:async()=>'token',env,storage:{getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}},fetcher:async()=>success()});
});
test('missing server Drive configuration is shown as a setup problem instead of an unconfirmed replacement',async()=>{
 await assert.rejects(performVisitReplacement({file,submissionId:'submission1',uid:'director',getIdToken:async()=>'token',env,fetcher:async()=>({ok:false,json:async()=>({reason:'drive-config',message:'private environment values'})})}),error=>error.code==='visit/drive-config'&&/check its setup/.test(safeAdminError(error))&&!error.message.includes('private environment values'));
});
test('same filename conflicts only in the selected category; Keep both and completed uploads are explicit exemptions',()=>{
 const queue={file:{name:'Resolution_05.pdf'},documentCategory:'custom-11111111',status:'Ready'};
 const existing=[{submissionId:'one',fileName:'Resolution_05.pdf',status:'active',documentCategory:'custom-11111111'},{submissionId:'two',fileName:'Resolution_05.pdf',status:'active',documentCategory:'custom-22222222'},{submissionId:'old',fileName:'Resolution_05.pdf',status:'archived',documentCategory:'custom-11111111'}];
 assert.deepEqual(findVisitUploadConflicts(queue,existing).map(f=>f.submissionId),['one']);assert.equal(hasVisitUploadConflicts([queue],existing),true);
 assert.equal(findVisitUploadConflicts({...queue,allowDuplicate:true},existing).length,0);assert.equal(findVisitUploadConflicts({...queue,completionProof:'proof'},existing).length,0);assert.equal(findVisitUploadConflicts({...queue,status:'Uploaded'},existing).length,0);
});
for(const invalidProof of ['missing','wrong-contents','wrong-file','wrong-size'])test(`an OK response with ${invalidProof} is not accepted as a successful replacement`,async()=>{
 const storage=store();const response=success();const body=await response.json();
 if(invalidProof==='missing')delete body.verifiedReplacement;
 if(invalidProof==='wrong-contents')body.verifiedReplacement.sha256='0'.repeat(64);
 if(invalidProof==='wrong-file')body.verifiedReplacement.driveFileId='otherDriveFile001';
 if(invalidProof==='wrong-size')body.verifiedReplacement.sizeBytes++;
 await assert.rejects(performVisitReplacement({file,submissionId:'submission1',expectedDriveFileId:'driveFile00001',uid:'director',getIdToken:async()=>'token',env,storage,fetcher:async()=>({ok:true,json:async()=>body})}),error=>error.code==='visit/drive-unavailable');
 assert.equal(storage.map.size,1);
});
test('a superseded completed request clears its request ID so a deliberate new replacement can start',async()=>{
 const storage=store();const ids=[];let calls=0;
 const options={file,submissionId:'submission1',uid:'director',getIdToken:async()=>'token',env,storage,fetcher:async(_url,request)=>{ids.push(request.body.get('operationId'));return calls++?success():{ok:false,json:async()=>({reason:'file-changed'})}}};
 await assert.rejects(performVisitReplacement(options));assert.equal(storage.map.size,0);await performVisitReplacement(options);assert.notEqual(ids[0],ids[1]);
});
