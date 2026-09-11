chrome.action.onClicked.addListener(() => chrome.tabs.create({url:chrome.runtime.getURL('tool.html?tool=downloadrules')}));
import {applyRules,validateRule} from './shared/core.js';
import {isPro} from './shared/license.js';
chrome.downloads.onDeterminingFilename.addListener((item,suggest)=>{ (async()=>{ try {const saved=(await chrome.storage.local.get('rules')).rules; let rules=Array.isArray(saved)?saved.slice(0,100).map(validateRule):[]; if(!await isPro('downloadrules'))rules=rules.filter(r=>r.enabled).slice(0,2); const filename=applyRules({filename:item.filename,url:item.finalUrl||item.url},rules); if(filename)suggest({filename,conflictAction:'uniquify'});else suggest(); } catch { suggest(); } })(); return true; });
