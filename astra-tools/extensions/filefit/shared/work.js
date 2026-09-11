
import {isExtension,read,write} from './license.js';
import {$,status,download} from './ui.js';
export {$,status,download,isExtension,read,write};
export function act(fn){return async(...args)=>{try{await fn(...args);}catch(e){status(e.message||'Something went wrong. Please retry.',true);}};}
export async function rpc(type,data={}){if(!isExtension)throw Error('Install the extension to use this feature.');const result=await chrome.runtime.sendMessage({type,...data});if(!result?.ok)throw Error(result?.error||'Extension did not respond. Reload it and try again.');return result.data;}
export async function webTabs(select){if(!isExtension)return;const tabs=await chrome.tabs.query({});select.replaceChildren();for(const tab of tabs.filter(t=>/^https?:/.test(t.url||''))){const o=document.createElement('option');o.value=tab.id;o.textContent=(tab.title||tab.url).slice(0,100);o.dataset.url=tab.url;select.append(o);}if(!select.options.length){const o=document.createElement('option');o.textContent='Open a website tab, then refresh this list';o.value='';select.append(o);}}
export async function grantTab(select){const o=select.selectedOptions[0];if(!o?.dataset.url)throw Error('Select an open website tab.');const origin=new URL(o.dataset.url).origin+'/*';if(!await chrome.permissions.request({origins:[origin]}))throw Error('Website access was declined.');return{id:Number(o.value),origin,url:o.dataset.url};}
export function jsonDownload(data,name){download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}
export async function jsonFile(file,max=2000000){if(!file||file.size>max)throw Error('Choose a JSON backup smaller than '+Math.round(max/1000000)+' MB.');return JSON.parse(await file.text());}
export function note(text){return '<p class="tool-shell-note">'+text+'</p>';}
