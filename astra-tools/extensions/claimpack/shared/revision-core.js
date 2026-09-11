
export const uid=()=>crypto.randomUUID();
export const text=(v,max=2000)=>String(v??'').trim().slice(0,max);
export function money(paise,currency='INR'){return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(paise/100);}
export function paise(value){const s=String(value).trim();if(!/^\d{1,8}(\.\d{1,2})?$/.test(s))throw Error('Use a non-negative amount with up to two decimal places.');const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
export function safeSource(v){if(!v)return '';try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';return u.origin+u.pathname;}catch{return '';}}
export function classify(project,request){
 if(request.type==='defect')return {kind:'included',reason:'Correction to an agreed deliverable; no revision allowance consumed.',fee:0};
 const item=project.scope.find(x=>x.id===request.scopeId);
 if(request.type==='revision'&&!item)return{kind:'review',reason:'Match this request to a deliverable before quoting.',fee:0};
 if(request.type==='revision'&&request.round<=item.rounds)return{kind:'included',reason:'Round '+request.round+' is within the '+item.rounds+' included rounds for '+item.title+'.',fee:0};
 const reason=request.type==='new'?'New deliverable, outside the listed scope.':'Round '+request.round+' exceeds the '+item.rounds+' included rounds for '+item.title+'.';
 if(request.minutes<=0)return{kind:'review',reason:reason+' Add a time estimate.',fee:0};
 return{kind:'extra',reason,fee:Math.round(project.ratePaise*request.minutes/60)};
}
export function summary(project,requests=project.requests){const result={included:0,extra:0,review:0,fee:0,minutes:0};for(const r of requests){const c=classify(project,r);result[c.kind]++;result.fee+=c.fee;if(c.kind==='extra')result.minutes+=r.minutes;}return result;}
export function validateProject(raw){
 if(!raw||!Array.isArray(raw.scope)||raw.scope.length<1||raw.scope.length>30||!Array.isArray(raw.requests)||raw.requests.length>100)throw Error('Use 1–30 deliverables and at most 100 requests.');
 const p={name:text(raw.name,150),client:text(raw.client,150),currency:['INR','USD','EUR','GBP'].includes(raw.currency)?raw.currency:'INR',ratePaise:raw.ratePaise,scopeLocked:!!raw.scopeLocked,archived:!!raw.archived,scope:[],requests:[]};
 if(!p.name||!p.client||!Number.isSafeInteger(p.ratePaise)||p.ratePaise<0||p.ratePaise>1000000000)throw Error('Project, client and a valid hourly rate are required.');
 const ids=new Set();
 for(const s of raw.scope){if(typeof s.id!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(s.id)||ids.has(s.id)||!Number.isInteger(s.rounds)||s.rounds<0||s.rounds>99||!text(s.title))throw Error('Every deliverable needs a unique ID, title and revision allowance.');ids.add(s.id);p.scope.push({id:text(s.id,60),title:text(s.title,150),description:text(s.description,1000),rounds:s.rounds});}
 const requests=new Set();
 for(const r of raw.requests){if(typeof r.id!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(r.id)||requests.has(r.id)||!['revision','new','defect'].includes(r.type)||!Number.isInteger(r.round)||r.round<1||r.round>100||!Number.isInteger(r.minutes)||r.minutes<0||r.minutes>60000||!text(r.title))throw Error('Check request titles, revision rounds and estimated minutes.');requests.add(r.id);p.requests.push({id:text(r.id,60),title:text(r.title,150),detail:text(r.detail,4000),source:safeSource(r.source),capturedAt:text(r.capturedAt,40),scopeId:text(r.scopeId,60),type:r.type,round:r.round,minutes:r.minutes,evidence:/^[a-f0-9-]{36}$/.test(r.evidence||'')?r.evidence:'',note:text(r.note,1500)});}
 return p;
}
export function assertLocked(previous,next){if(previous.scopeLocked&&(!next.scopeLocked||JSON.stringify(previous.scope)!==JSON.stringify(next.scope)||previous.ratePaise!==next.ratePaise||previous.currency!==next.currency||previous.client!==next.client))throw Error('The agreed scope is locked. Create a new project for a changed agreement.');}
export function makeProposal(project,ids,options={}){
 if(!project.scopeLocked)throw Error('Lock the agreed scope before creating a proposal.');
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Choose requests to include.');
 const chosen=ids.map(id=>{const r=project.requests.find(x=>x.id===id);if(!r)throw Error('Request not found.');const c=classify(project,r);if(c.kind==='review')throw Error('Resolve every Needs review item before issuing a proposal.');return{...r,...c};});
 return{format:'astra-revision-proposal-1',project:project.name,client:project.client,currency:project.currency,ratePaise:project.ratePaise,scope:project.scope,items:chosen,total:chosen.reduce((sum,x)=>sum+x.fee,0),delayDays:Math.max(0,Math.min(365,Number(options.delayDays)||0)),message:text(options.message,2000),createdAt:new Date().toISOString(),disclosure:'Scope classification uses the deliverables and revision rounds entered by the project owner. A link response records a stated decision; it is not verified identity, a certified signature or proof of payment.'};
}
export function demoProject(){return validateProject({name:'Juniper Studio website',client:'Juniper Studio',currency:'INR',ratePaise:150000,scopeLocked:true,scope:[{id:'home',title:'Five-section homepage',description:'Design and build the agreed homepage. Two consolidated rounds of feedback.',rounds:2},{id:'contact',title:'Contact form',description:'Name, email and message fields. One revision round.',rounds:1}],requests:[{id:'r1',title:'Update the headline',detail:'Please use the new headline from our brand document.',type:'revision',scopeId:'home',round:2,minutes:20},{id:'r2',title:'Add a booking calendar',detail:'Can visitors choose an appointment slot and receive a confirmation?',type:'new',scopeId:'',round:1,minutes:180},{id:'r3',title:'Fix the contact button',detail:'The agreed contact button does not open the form.',type:'defect',scopeId:'contact',round:1,minutes:15},{id:'r4',title:'Another homepage colour pass',detail:'After round two, please apply the new palette throughout.',type:'revision',scopeId:'home',round:3,minutes:90}]});}
