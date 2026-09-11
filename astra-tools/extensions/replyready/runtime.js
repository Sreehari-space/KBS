
export function route(handler){chrome.runtime.onMessage.addListener((msg,sender,send)=>{if(sender.id!==chrome.runtime.id)return;Promise.resolve().then(()=>handler(msg,sender)).then(data=>send({ok:true,data})).catch(e=>send({ok:false,error:e.message||'Unable to complete action.'}));return true;});}
export async function saved(key,fallback){return(await chrome.storage.local.get(key))[key]??fallback;}
export const save=(key,data)=>chrome.storage.local.set({[key]:data});
export function openTool(id){return chrome.tabs.create({url:chrome.runtime.getURL('tool.html?tool='+id)});}
export async function notify(id,title,message){try{await chrome.notifications.create(id,{type:'basic',iconUrl:'icons/icon-128.png',title,message});}catch{}}
export function owner(sender){if(sender.tab||!sender.url?.startsWith(chrome.runtime.getURL('tool.html')))throw Error('Use the extension workspace for this action.');}
export function serial(){let tail=Promise.resolve();return fn=>{const next=tail.then(fn,fn);tail=next.catch(()=>{});return next;};}
