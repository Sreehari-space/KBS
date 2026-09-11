
export const annualProducts=['stepguide','replyready','watchdesk','followupdesk'];
export const yearSeconds=365*24*60*60;
export function httpUrl(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use a regular HTTP or HTTPS website address.');return u;}
export function gmailUrl(value){const u=httpUrl(value);if(u.origin!=='https://mail.google.com'||!/^\/mail\/u\/\d+\/?$/.test(u.pathname)||!u.hash)throw Error('Open a Gmail conversation and copy its address.');return u.href;}
export function threadKey(value){try{const u=new URL(gmailUrl(value));const segments=u.hash.slice(1).split('/');const id=segments.at(-1);if(!/^[A-Za-z0-9_-]{12,}$/.test(id))return '';return u.pathname+'|'+id;}catch{return '';}}
export function fieldsIn(text){return [...new Set([...text.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]{0,30})\}\}/g)].map(m=>m[1]))];}
export function renderTemplate(text,values){return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]{0,30})\}\}/g,(_,key)=>String(values[key]??''));}
export function quoteTotal(quantity,rate){const q=Number(quantity),r=Number(rate);if(!Number.isFinite(q)||q<=0||q>100000||!Number.isFinite(r)||r<0||r>10000000)throw Error('Enter a valid quantity and unit price.');return (Math.round(q*Math.round(r*100))/100).toFixed(2);}
export function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim().slice(0,12000);}
export function monitorChange(previous,current,pending=''){const next=cleanText(current);if(!next)throw Error('Selected area is empty. Check the selector or sign-in state.');if(!previous)return {baseline:next,pending:'',changed:false};if(next===previous)return{baseline:previous,pending:'',changed:false};if(next===pending)return{baseline:next,pending:'',changed:true,before:previous,after:next};return{baseline:previous,pending:next,changed:false};}
export function dueReminder(item,now=Date.now()){return item.status==='waiting'&&Number.isFinite(Date.parse(item.due))&&Date.parse(item.due)<=now&&!item.notified;}
export function validSnippet(s){if(!s||typeof s.title!=='string'||!s.title.trim()||typeof s.body!=='string'||!s.body.trim()||s.body.length>12000||!/^[a-z0-9_-]{1,30}$/i.test(s.shortcut))throw Error('Each template needs a title, text and a shortcut using letters, numbers, _ or -.');return{id:typeof s.id==='string'?s.id:crypto.randomUUID(),title:s.title.trim().slice(0,100),body:s.body,shortcut:s.shortcut.toLowerCase(),folder:String(s.folder||'General').slice(0,60)};}
