export function parseCSV(input,delimiter=','){
 if(typeof input!=='string'||input.length>5000000)throw Error('Use a UTF-8 CSV file smaller than 5 MB.');
 if(![',',';','\t'].includes(delimiter))throw Error('Choose a supported delimiter.');
 const s=input.replace(/^\uFEFF/,''),rows=[];let row=[],field='',quoted=false,closed=false;
 const cell=()=>{row.push(field);field='';closed=false;if(row.length>100)throw Error('Maximum 100 columns.');};
 const record=()=>{cell();if(row.length>1||row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>10001)throw Error('Maximum 10,000 data rows per file.');};
 for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c===delimiter){cell();continue;}if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;record();continue;}
 if(closed)throw Error('Unexpected text after a closing quote. Check your delimiter.');
 if(c==='"'){if(field)throw Error('A quote inside a value must be escaped.');quoted=true;}else field+=c;}
 if(quoted)throw Error('Unclosed quoted value.');if(field||row.length||closed)record();
 if(rows.length<2)throw Error('Include a header and at least one data row.');
 const headers=rows.shift().map(x=>x.trim());if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('Column headings must be non-empty and unique.');
 const data=rows.map((values,i)=>{if(values.length!==headers.length)throw Error('Record '+(i+2)+' has '+values.length+' values; expected '+headers.length+'.');return{record:i+2,values};});
 return{headers,rows:data};
}
export function decimal(value){const s=String(value).trim();if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))return null;const negative=s[0]==='-',parts=s.replace(/^[+-]/,'').split('.');const a=parts[0].replace(/^0+(?=\d)/,''),b=(parts[1]||'').replace(/0+$/,'');return (negative&&(a!=='0'||b)?'-':'')+a+(b?'.'+b:'');}
export function compareCSV(left,right,options){
 const {leftKey,rightKey,leftValue,rightValue,trim=true,ignoreCase=false,numeric=false}=options;
 for(const [data,col] of [[left,leftKey],[left,leftValue],[right,rightKey],[right,rightValue]])if(!Number.isInteger(col)||col<0||col>=data.headers.length)throw Error('Choose valid columns.');
 const norm=v=>{let s=trim?v.trim():v;return ignoreCase?s.toLowerCase():s;};
 const index=(data,key)=>{const map=new Map(),blank=[];for(const r of data.rows){const k=norm(r.values[key]);if(!k.trim()){blank.push(r);continue;}if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return{map,blank};};
 const a=index(left,leftKey),b=index(right,rightKey),result=[];
 for(const key of new Set([...a.map.keys(),...b.map.keys()])){const la=a.map.get(key)||[],rb=b.map.get(key)||[];let status;
 if(la.length>1||rb.length>1)status='duplicate';
 else if(!la.length)status='right-only';else if(!rb.length)status='left-only';
 else {const av=la[0].values[leftValue],bv=rb[0].values[rightValue];if(numeric){const x=decimal(av),y=decimal(bv);status=x===null||y===null?'invalid-number':x===y?'matched':'changed';}else status=norm(av)===norm(bv)?'matched':'changed';}
 result.push({status,key,left:la.map(r=>({record:r.record,value:r.values[leftValue]})),right:rb.map(r=>({record:r.record,value:r.values[rightValue]}))});}
 for(const r of a.blank)result.push({status:'blank-key',key:'',left:[{record:r.record,value:r.values[leftValue]}],right:[]});
 for(const r of b.blank)result.push({status:'blank-key',key:'',left:[],right:[{record:r.record,value:r.values[rightValue]}]});
 return result;
}
export function exportCSV(rows){
 const protect=v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const out=[['Status','Matching key','Left record','Left value','Right record','Right value']];
 for(const row of rows){const n=Math.max(row.left.length,row.right.length,1);for(let i=0;i<n;i++)out.push([row.status,row.key,row.left[i]?.record||'',row.left[i]?.value||'',row.right[i]?.record||'',row.right[i]?.value||'']);}
 return '\uFEFF'+out.map(r=>r.map(protect).join(',')).join('\r\n');
}
