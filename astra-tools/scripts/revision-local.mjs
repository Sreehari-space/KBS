import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import path from 'node:path';
export function localStorage(directory='revision-data.local'){
fs.mkdirSync(directory,{recursive:true});const db=new DatabaseSync(path.join(directory,'database.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){if(!db.prepare('SELECT name FROM local_migrations WHERE name=?').get(file)){db.exec('BEGIN');try{db.exec(fs.readFileSync('drizzle/'+file,'utf8'));db.prepare('INSERT INTO local_migrations VALUES (?)').run(file);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}}
function prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return{results:db.prepare(sql).all(...args)};},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}
const DB={prepare,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
const objectPath=key=>{const p=path.resolve(directory,'objects',key),root=path.resolve(directory,'objects')+path.sep;if(!p.startsWith(root))throw Error('Invalid object key');return p;};
const BUCKET={async put(key,value){const p=objectPath(key);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'?value:Buffer.from(value));},async get(key){const p=objectPath(key);if(!fs.existsSync(p))return null;const bytes=fs.readFileSync(p);return{body:bytes,text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};},async delete(key){fs.rmSync(objectPath(key),{force:true});}};
return{DB,BUCKET,close:()=>db.close()};}
