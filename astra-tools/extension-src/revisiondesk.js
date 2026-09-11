
import {STORE_ORIGIN} from './shared/config.js';
const MENU='astra-revision-capture';
chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.removeAll(()=>chrome.contextMenus.create({id:MENU,title:'Capture request in RevisionDesk',contexts:['selection'],documentUrlPatterns:['http://*/*','https://*/*']}));});
async function capture(tab,selected=''){
 if(!tab?.id||!/^https?:/.test(tab.url||'')){await chrome.tabs.create({url:STORE_ORIGIN+'/revisiondesk.html'});return;}
 let info={text:selected.slice(0,4000),source:tab.url,title:tab.title||'',capturedAt:new Date().toISOString(),image:''};
 try{const out=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({text:getSelection()?.toString().slice(0,4000)||'',title:document.title})});if(!info.text)info.text=out[0]?.result?.text||'';}catch{}
 const url=new URL(info.source);info.source=url.origin+url.pathname;
 try{const src=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:60});const still=await chrome.tabs.get(tab.id);if(still.active&&still.url===tab.url){const blob=await(await fetch(src)).blob(),bitmap=await createImageBitmap(blob);const scale=Math.min(1,1280/bitmap.width);const canvas=new OffscreenCanvas(Math.round(bitmap.width*scale),Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const resized=await canvas.convertToBlob({type:'image/jpeg',quality:.65});const bytes=new Uint8Array(await resized.arrayBuffer());let b='';for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));if(bytes.length<=650000)info.image='data:image/jpeg;base64,'+btoa(b);}}catch{}
 const token=crypto.randomUUID();await chrome.storage.session.set({revisionCapture:{token,at:Date.now(),data:info}});
 await chrome.tabs.create({url:STORE_ORIGIN+'/revisiondesk.html#capture='+chrome.runtime.id+'.'+token});
}
chrome.action.onClicked.addListener(tab=>capture(tab));
chrome.contextMenus.onClicked.addListener((info,tab)=>{if(info.menuItemId===MENU)capture(tab,info.selectionText||'');});
chrome.runtime.onMessageExternal.addListener((message,sender,reply)=>{
 if(!sender.url||new URL(sender.url).origin!==STORE_ORIGIN||message.type!=='take-revision-capture')return;
 (async()=>{const {revisionCapture:c}=await chrome.storage.session.get('revisionCapture');if(!c||c.token!==message.token||Date.now()-c.at>600000){reply({error:'Capture expired. Capture the request again.'});return;}await chrome.storage.session.remove('revisionCapture');reply({capture:c.data});})();return true;
});
