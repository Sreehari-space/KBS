import {getProduct,icon} from '../shared/catalog.js';import {STORE_ORIGIN} from '../shared/config.js';import {isExtension,isPro,verifyLicense,write} from '../shared/license.js';import {$,status} from '../shared/ui.js';
const id=new URLSearchParams(location.search).get('tool')||document.documentElement.dataset.tool;const p=getProduct(id);
if(!p){document.querySelector('main').textContent='Tool not found. Please return to the store.';}else{
document.title=p.name+' — Astra Tools';document.body.style.setProperty('--tool-color',p.color);$('#tool-title').textContent=p.name;$('#tool-eyebrow').textContent=p.tag;$('#tool-description').textContent=p.description;$('#tool-breadcrumb').textContent=p.name;$('#tool-limit').textContent=p.limit+' '+p.permission;$('#store-link').href=STORE_ORIGIN;$('#help-link').href=STORE_ORIGIN+'/install.html';
const updatePlan=async()=>$('#plan-status').textContent=await isPro(id)?(p.period==='annual'?'Pro · annual licence':'Pro · version 1'):p.free;
await updatePlan();$('#activate').onclick=async()=>{const token=$('#licence-input').value.trim();if(await verifyLicense(token,id)){await write('license:'+id,token);$('#licence-status').textContent='Licence activated. Reloading your tool…';location.reload();}else $('#licence-status').textContent='This licence is invalid, expired or belongs to a different tool. Check the complete code.';};
try{const module=await import('./'+id+'.js');await module.mount($('#workspace'));}catch(error){status('Unable to open the tool: '+error.message,true);}
}
