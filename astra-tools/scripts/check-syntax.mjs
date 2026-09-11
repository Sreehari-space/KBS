
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
let count=0;for(const dir of ['public','extension-src','server','scripts']){function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory()){if(!['vendor','downloads'].includes(e.name))walk(f);}else if(/\.(js|mjs)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw Error(f+'\n'+r.stderr);count++;}}}walk(dir);}console.log(count+' source JavaScript files pass syntax checks.');
