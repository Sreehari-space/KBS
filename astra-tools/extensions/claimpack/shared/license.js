import {getProduct} from './catalog.js';
import {PUBLIC_JWK} from './config.js';
export const isExtension=typeof chrome!=='undefined'&&!!chrome.runtime?.id;
export async function read(key){if(isExtension)return(await chrome.storage.local.get(key))[key];try{return JSON.parse(localStorage.getItem('astra:'+key)||'null');}catch{return null;}}
export async function write(key,value){if(isExtension)return chrome.storage.local.set({[key]:value});localStorage.setItem('astra:'+key,JSON.stringify(value));}
export function decode64(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function verifyLicense(token,product){try{if(!PUBLIC_JWK||typeof token!=='string'||token.length>5000)return null;const [body,signature,...extra]=token.split('.');if(extra.length||!body||!signature)return null;const key=await crypto.subtle.importKey('jwk',PUBLIC_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode64(signature),new TextEncoder().encode(body)))return null;const data=JSON.parse(new TextDecoder().decode(decode64(body)));if(data.product!==product||data.major!==1||data.issuer!=='astra-tools'||!data.paymentId)return null;if(getProduct(product)?.period==='annual'&&(!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now()/1000))return null;return data;}catch{return null;}}
export async function isPro(product){return !!await verifyLicense(await read('license:'+product),product);}
export async function allowExport(product){if(await isPro(product))return true;const day=new Date().toISOString().slice(0,10);const usage=await read('usage:'+product);return !usage||usage.day!==day||usage.count<3;}
export async function recordExport(product){const day=new Date().toISOString().slice(0,10);const usage=await read('usage:'+product);await write('usage:'+product,{day,count:usage?.day===day?usage.count+1:1});}
