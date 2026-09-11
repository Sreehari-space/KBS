import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {demoProject,classify,summary,paise,validateProject,assertLocked} from '../public/shared/revision-core.js';
import {revisionApi,digest} from '../server/revision.js';import {localStorage} from '../scripts/revision-local.mjs';
test('revision classification accounts for consolidated rounds and integer currency',()=>{const p=demoProject();assert.equal(summary(p).fee,675000);p.requests.push({...p.requests[0],id:'duplicate-round'});assert.equal(summary(p).fee,675000);assert.equal(classify(p,{type:'revision',scopeId:'missing'}).kind,'review');assert.equal(classify(p,{type:'new',minutes:0}).kind,'review');assert.equal(paise('0.30'),30);assert.throws(()=>paise('1e3'));assert.throws(()=>validateProject({...p,scope:[{id:'x'.repeat(61),title:'long',rounds:1}]}));assert.throws(()=>assertLocked(p,{...p,ratePaise:1}));});
test('hosted workflow isolates owners, locks versions, snapshots evidence and records one response',async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'astra-revision-test-')),env=localStorage(dir);
async function call(route,data,owner='alice',method=data?'POST':'GET',origin='https://example.test'){const r=await revisionApi(new Request('https://example.test/api/revision'+route,{method,headers:{'Content-Type':'application/json','Origin':origin,...(owner?{'oai-authenticated-user-id':owner}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return{status:r.status,data:await r.json()};}
try{
assert.equal((await call('/me',null,'')).status,401);
assert.equal((await call('/projects',{project:demoProject()},'alice','POST','https://evil.test')).status,403);
let created=await call('/projects',{project:demoProject()});assert.equal(created.status,201,JSON.stringify(created));let p=created.data.project;
assert.equal((await call('/projects/'+p.id,null,'bob')).status,404);
assert.equal((await call('/projects',{project:demoProject()})).status,409);
assert.equal((await call('/projects/'+p.id,{version:99,project:p},'alice','PUT')).status,409);
assert.equal((await call('/projects/'+p.id,{version:p.version,project:{...p,ratePaise:1}},'alice','PUT')).status,400);
const badAsset=await call('/assets',{projectId:p.id,image:'data:image/jpeg;base64,AAAA'});assert.equal(badAsset.status,400);
const issued=await call('/proposals',{projectId:p.id,version:p.version,requestIds:['r2','r4'],delayDays:3,message:'Please review'});assert.equal(issued.status,200,JSON.stringify(issued));const {id,token}=issued.data;
assert.equal((await call('/proposals',{projectId:p.id,version:p.version,requestIds:['r2']})).status,409);
assert.equal((await call('/review/read',{id,token:'a'.repeat(64)},'')).status,404);
let doc=await call('/review/read',{id,token},'');assert.equal(doc.data.proposal.total,675000);assert.equal(doc.data.digest,await digest(JSON.stringify(doc.data.proposal)));
p=(await call('/projects/'+p.id)).data.project;p.requests[1].minutes=1;
let updated=await call('/projects/'+p.id,{version:p.version,project:p},'alice','PUT');assert.equal(updated.status,200);
doc=await call('/review/read',{id,token},'');assert.equal(doc.data.proposal.total,675000);
assert.equal((await call('/review/respond',{id,digest:doc.data.digest,name:'Alice',decision:'approved'})).status,403);
assert.equal((await call('/review/respond',{id,token,digest:'changed',name:'Client',decision:'approved'},'')).status,409);
const response=await call('/review/respond',{id,token,digest:doc.data.digest,name:'Client',decision:'approved'},'');assert.equal(response.status,200);
assert.equal((await call('/review/respond',{id,token,digest:doc.data.digest,name:'Other',decision:'changes-requested'},'')).status,409);
p=updated.data.project;const next=await call('/proposals',{projectId:p.id,version:p.version,requestIds:['r1']});assert.equal(next.status,200);assert.equal((await call('/proposals/revoke',{id:next.data.id},'bob')).status,409);assert.equal((await call('/proposals/revoke',{id:next.data.id})).status,200);assert.equal((await call('/review/read',{id:next.data.id,token:next.data.token},'')).status,410);
}finally{env.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('extension capture transfers only to the permitted site with the one-time token',async()=>{
let click,external;const saved={},opened=[];
globalThis.chrome={runtime:{id:'a'.repeat(32),onInstalled:{addListener(){}},onMessageExternal:{addListener(fn){external=fn;}}},contextMenus:{onClicked:{addListener(){}}},action:{onClicked:{addListener(fn){click=fn;}}},scripting:{async executeScript(){return[{result:{text:'Please add booking',title:'Client'}}];}},tabs:{async captureVisibleTab(){throw Error('No screenshot in this test');},async create(x){opened.push(x);}},storage:{session:{async set(x){Object.assign(saved,x);},async get(){return saved;},async remove(k){delete saved[k];}}}};
try{await import('../extensions/revisiondesk/background.js?test='+Date.now());await click({id:1,url:'https://example.test/client?secret=123#private',title:'Client request',windowId:1});assert.equal(saved.revisionCapture.data.source,'https://example.test/client');assert.equal(saved.revisionCapture.data.text,'Please add booking');assert.ok(opened[0].url.includes('/revisiondesk.html#capture='));
let response;assert.equal(external({type:'take-revision-capture',token:saved.revisionCapture.token},{url:'https://evil.test'},x=>response=x),undefined);assert.equal(response,undefined);
const {STORE_ORIGIN}=await import('../public/shared/config.js');const token=saved.revisionCapture.token;
const wrong=await new Promise(resolve=>external({type:'take-revision-capture',token:'wrong'},{url:STORE_ORIGIN+'/revisiondesk.html'},resolve));assert.ok(wrong.error);
const correct=await new Promise(resolve=>external({type:'take-revision-capture',token},{url:STORE_ORIGIN+'/revisiondesk.html'},resolve));assert.equal(correct.capture.text,'Please add booking');assert.equal(saved.revisionCapture,undefined);
}finally{delete globalThis.chrome;}
});
