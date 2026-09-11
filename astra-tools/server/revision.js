
import {validateProject,assertLocked,makeProposal} from '../public/shared/revision-core.js';
import {verifyLicense} from '../public/shared/license.js';
const enc=new TextEncoder();
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const secret=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const bad=(message,status=400)=>{throw Object.assign(Error(message),{status});};
async function body(request,max=1500000){if(!request.headers.get('Content-Type')?.includes('application/json'))bad('JSON required.',415);const reader=request.body?.getReader();let size=0,chunks=[];if(reader)while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();bad('Request is too large.',413);}chunks.push(r.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{bad('Invalid JSON.');}}
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
async function owned(env,id,owner){const row=await stmt(env,'SELECT * FROM revision_projects WHERE id = ? AND owner = ?',id,owner).first();if(!row)bad('Project not found.',404);return row;}
async function consume(env,key,limit){const r=await stmt(env,'INSERT INTO revision_usage (id,count) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count',key,limit).first();if(!r)bad('Usage limit reached. Please try again later.',429);}
function decodeImage(data){if(typeof data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data))bad('Use a JPEG image.');const raw=atob(data.split(',')[1]);if(raw.length>650000||raw.charCodeAt(0)!==255||raw.charCodeAt(1)!==216||raw.charCodeAt(raw.length-2)!==255||raw.charCodeAt(raw.length-1)!==217)bad('Use a valid JPEG smaller than 650 KB.');return Uint8Array.from(raw,c=>c.charCodeAt(0));}
const packProject=row=>({id:row.id,version:row.version,updated:row.updated,...JSON.parse(row.payload)});
export async function revisionApi(request,env){
 try{
 if(!env.DB||!env.BUCKET)return json({error:'RevisionDesk storage is not available yet. Your draft has not been submitted.'},503);
 const url=new URL(request.url),path=url.pathname.replace('/api/revision',''),method=request.method,owner=request.headers.get('oai-authenticated-user-id');
 if(!['GET','POST','PUT'].includes(method))bad('Method not allowed.',405);
 if(method!=='GET'&&request.headers.get('Origin')!==url.origin)bad('Use the Astra website to perform this action.',403);
 const data=method==='GET'?{}:await body(request);
 if(path==='/review/read'||path==='/review/respond'){
 if(method!=='POST')bad('Method not allowed.',405);
 const row=await stmt(env,'SELECT * FROM revision_reviews WHERE id = ?',String(data.id||'')).first();if(!row)bad('Review not found.',404);
 const isOwner=!!owner&&row.owner===owner;
 if(!isOwner&&(typeof data.token!=='string'||data.token.length!==64||await digest(data.token)!==row.token_hash))bad('Review link is invalid.',404);
 if(!isOwner&&(row.expires<Date.now()||row.status==='revoked'))bad('This review link has expired or was revoked.',410);
 if(path==='/review/respond'){
 if(typeof data.token!=='string'||data.token.length!==64||await digest(data.token)!==row.token_hash)bad('Use the original review link to respond.',403);
 if(row.status!=='pending'||row.expires<Date.now())bad('This proposal is no longer accepting responses.',409);
 if(data.digest!==row.digest)bad('The proposal changed. Reload it before responding.',409);
 if(!['approved','changes-requested'].includes(data.decision)||typeof data.name!=='string'||!data.name.trim()||data.name.length>150)bad('Enter your name and choose a decision.');
 const result=await stmt(env,"UPDATE revision_reviews SET status=?,name=?,note=?,decided=? WHERE id=? AND status='pending' AND expires>=? AND digest=?",data.decision,data.name.trim(),String(data.note||'').slice(0,2000),Date.now(),row.id,Date.now(),row.digest).run();
 if(!result.meta.changes)bad('A response has already been recorded.',409);
 return json({status:data.decision,recordedAt:Date.now()});
 }
 const object=await env.BUCKET.get(row.object_key);if(!object)bad('Review document unavailable. Contact the sender.',503);
 return json({proposal:JSON.parse(await object.text()),digest:row.digest,status:row.status,expires:row.expires,response:row.decided?{name:row.name,note:row.note,at:row.decided}:null});
 }
 if(!owner)bad('Sign in with ChatGPT to save and manage your projects.',401);
 const pro=!!await verifyLicense(request.headers.get('X-Astra-License'),'revisiondesk');
 if(path==='/me'&&method==='GET')return json({signedIn:true,pro,limits:{projects:pro?20:1,requests:pro?100:10,proposals:pro?50:3}});
 if(path==='/projects'&&method==='GET'){const list=await stmt(env,'SELECT * FROM revision_projects WHERE owner=? ORDER BY updated DESC',owner).all();return json({projects:list.results.map(packProject)});}
 if(path==='/projects'&&method==='POST'){
 const p=validateProject(data.project);if(p.requests.length>(pro?100:10))bad('The free plan supports 10 requests per project.');
 if(p.requests.some(r=>r.evidence))bad('Add screenshots after creating the project.');if(p.archived)bad('Create an active project first.');await consume(env,'create:'+owner+':'+new Date().toISOString().slice(0,10),pro?40:5);
 const id=crypto.randomUUID(),now=Date.now();const r=await stmt(env,'INSERT INTO revision_projects (id,owner,payload,version,archived,created,updated) SELECT ?,?,?,1,?,?,? WHERE (SELECT count(*) FROM revision_projects WHERE owner=? AND archived=0) < ?',id,owner,JSON.stringify(p),p.archived?1:0,now,now,owner,pro?20:1).run();
 if(!r.meta.changes)bad('Active project limit reached. Archive a finished project or activate Pro.',409);
 return json({project:packProject(await owned(env,id,owner))},201);
 }
 const match=path.match(/^\/projects\/([a-f0-9-]{36})$/);
 if(match){const row=await owned(env,match[1],owner);
 if(method==='GET'){const reviews=await stmt(env,'SELECT id,status,digest,expires,created,name,note,decided,request_ids FROM revision_reviews WHERE project=? AND owner=? ORDER BY created DESC',row.id,owner).all();return json({project:packProject(row),reviews:reviews.results});}
 if(method==='PUT'){const previous=JSON.parse(row.payload),p=validateProject(data.project);assertLocked(previous,p);if(p.requests.length>(pro?100:10)&&p.requests.length>previous.requests.length)bad('Free plan supports 10 requests. Existing data remains available.');
 for(const r of p.requests.filter(x=>x.evidence)){if(!await stmt(env,'SELECT id FROM revision_assets WHERE id=? AND owner=? AND project=?',r.evidence,owner,row.id).first())bad('Screenshot does not belong to this project.');}
 if(previous.archived&&!p.archived){const count=await stmt(env,'SELECT count(*) AS n FROM revision_projects WHERE owner=? AND archived=0',owner).first();if(count.n>=(pro?20:1))bad('Active project limit reached.');}
 const r=await stmt(env,'UPDATE revision_projects SET payload=?,version=version+1,archived=?,updated=? WHERE id=? AND owner=? AND version=? AND (?=1 OR archived=0 OR (SELECT count(*) FROM revision_projects WHERE owner=? AND archived=0) < ?)',JSON.stringify(p),p.archived?1:0,Date.now(),row.id,owner,data.version,p.archived?1:0,owner,pro?20:1).run();
 if(!r.meta.changes)bad('This project changed in another tab. Reload it before saving; your draft is still on screen.',409);
 return json({project:packProject(await owned(env,row.id,owner))});
 }}
 if(path==='/assets'&&method==='POST'){await owned(env,data.projectId,owner);await consume(env,'asset:'+owner+':'+new Date().toISOString().slice(0,10),pro?100:15);const count=await stmt(env,'SELECT count(*) AS n FROM revision_assets WHERE owner=? AND project=?',owner,data.projectId).first();if(count.n>=(pro?100:15))bad('Screenshot limit reached for this project.');const bytes=decodeImage(data.image),id=crypto.randomUUID(),key='revisiondesk/assets/'+id+'.jpg';await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});try{const stored=await stmt(env,'INSERT INTO revision_assets (id,owner,project,object_key,bytes,created) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM revision_assets WHERE owner=? AND project=?) < ?',id,owner,data.projectId,key,bytes.length,Date.now(),owner,data.projectId,pro?100:15).run();if(!stored.meta.changes)bad('Screenshot limit reached for this project.');}catch(e){await env.BUCKET.delete(key);throw e;}return json({id});}
 if(path.startsWith('/assets/')&&method==='GET'){const asset=await stmt(env,'SELECT * FROM revision_assets WHERE id=? AND owner=?',path.slice(8),owner).first();if(!asset)bad('Screenshot not found.',404);const image=await env.BUCKET.get(asset.object_key);if(!image)bad('Screenshot unavailable.',404);return new Response(image.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 if(path==='/proposals'&&method==='POST'){
 const row=await owned(env,data.projectId,owner);if(row.version!==data.version)bad('Reload the latest project before issuing a proposal.',409);const project=JSON.parse(row.payload);if(project.archived)bad('Unarchive this project before issuing a proposal.');
 const proposal=makeProposal(project,data.requestIds,data);if(proposal.items.length>10)bad('Include at most 10 requests in a proposal.');
 const pending=await stmt(env,"SELECT request_ids FROM revision_reviews WHERE owner=? AND project=? AND status='pending' AND expires>=?",owner,row.id,Date.now()).all();if(pending.results.some(x=>JSON.parse(x.request_ids).some(id=>data.requestIds.includes(id))))bad('Some requests already have a pending proposal. Revoke it before replacing it.',409);
 await consume(env,'proposal:'+owner+':'+new Date().toISOString().slice(0,7),pro?50:3);
 for(const item of proposal.items){if(item.evidence){const asset=await stmt(env,'SELECT object_key FROM revision_assets WHERE id=? AND owner=? AND project=?',item.evidence,owner,row.id).first();if(asset){const image=await env.BUCKET.get(asset.object_key);if(image){const bytes=new Uint8Array(await image.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));item.image='data:image/jpeg;base64,'+btoa(binary);}}}delete item.evidence;}
 const snapshot=JSON.stringify(proposal);if(enc.encode(snapshot).length>4000000)bad('Proposal is too large. Use fewer screenshots.');
 const id=crypto.randomUUID(),token=secret(),hash=await digest(snapshot),key='revisiondesk/proposals/'+id+'.json',expires=Date.now()+30*86400000;
 await env.BUCKET.put(key,snapshot,{httpMetadata:{contentType:'application/json'}});
 try{const result=await env.DB.batch([stmt(env,'INSERT INTO revision_reviews (id,owner,project,token_hash,digest,object_key,request_ids,status,expires,created) SELECT ?,?,?,?,?,?,?,?, ?,? WHERE EXISTS (SELECT 1 FROM revision_projects WHERE id=? AND owner=? AND version=?)',id,owner,row.id,await digest(token),hash,key,JSON.stringify(data.requestIds),'pending',expires,Date.now(),row.id,owner,data.version),stmt(env,'UPDATE revision_projects SET version=version+1,updated=? WHERE id=? AND owner=? AND version=?',Date.now(),row.id,owner,data.version)]);if(!result[0].meta.changes)bad('The project changed. Reload before issuing.',409);}catch(e){await env.BUCKET.delete(key);throw e;}
 return json({id,token,digest:hash,expires,link:url.origin+'/revision-review.html#'+id+'.'+token});
 }
 if(path==='/proposals/revoke'&&method==='POST'){const r=await stmt(env,"UPDATE revision_reviews SET status='revoked' WHERE id=? AND owner=? AND status='pending'",String(data.id),owner).run();if(!r.meta.changes)bad('Only a pending proposal can be revoked.',409);return json({revoked:true});}
 return json({error:'Not found.'},404);
 }catch(e){if(!e.status&&!(e.message||'').match(/scope|request|deliverable|amount|project|estimate|revision|proposal|round|rate|required|Choose|Lock|Match|Resolve/i))return json({error:'Storage is temporarily unavailable. Your draft has not been submitted.'},503);return json({error:e.message||'Unable to complete the action.'},e.status||400);}
}
