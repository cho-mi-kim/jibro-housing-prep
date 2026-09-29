// Server-only authenticated encryption. Never import this module into client code.
export const ENCRYPTED_PREFIX='jibro:encrypted:v1:';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const keyIdPattern=/^[a-zA-Z0-9_-]{1,48}$/;
function encode(bytes){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function decode(value){
 if(typeof value!=='string'||!value||!/^[a-zA-Z0-9_-]+$/.test(value))throw new Error('Invalid encrypted record');
 const binary=atob(value.replaceAll('-','+').replaceAll('_','/')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 if(encode(bytes)!==value)throw new Error('Invalid encrypted record');return bytes;
}
export function notebookCipher(env){
 let config;
 try{config=JSON.parse(env.JIBRO_NOTEBOOK_KEYS);if(!keyIdPattern.test(config.active)||!config.keys||Array.isArray(config.keys))throw Error();
  const entries=Object.entries(config.keys);if(!entries.length||entries.length>8)throw Error();
  for(const [id,value] of entries)if(!keyIdPattern.test(id)||decode(value).length!==32)throw Error();
  if(!Object.hasOwn(config.keys,config.active))throw Error();
 }catch{throw new Error('Notebook encryption unavailable');}
 const imported=new Map();
 const key=id=>{
  if(!Object.hasOwn(config.keys,id))throw new Error('Notebook encryption unavailable');
  if(!imported.has(id))imported.set(id,crypto.subtle.importKey('raw',decode(config.keys[id]),{name:'AES-GCM'},false,['encrypt','decrypt']));
  return imported.get(id);
 };
 const aad=(userId,id)=>{
  if(typeof userId!=='string'||!userId)throw new Error('Missing notebook owner');
  return encoder.encode(JSON.stringify(['jibro-member-notebook',1,id,userId]));
 };
 return {
  active:config.active,
  async seal(userId,state){
   const id=config.active,iv=crypto.getRandomValues(new Uint8Array(12));
   const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(userId,id),tagLength:128},await key(id),encoder.encode(JSON.stringify(state)));
   return ENCRYPTED_PREFIX+id+':'+encode(iv)+':'+encode(new Uint8Array(data));
  },
  async open(userId,payload){
   if(typeof payload!=='string')throw new Error('Invalid notebook record');
   if(payload.startsWith(ENCRYPTED_PREFIX)){
    const parts=payload.slice(ENCRYPTED_PREFIX.length).split(':');
    if(parts.length!==3||!keyIdPattern.test(parts[0]))throw new Error('Invalid encrypted record');
    const [id,ivText,dataText]=parts,iv=decode(ivText),data=decode(dataText);
    if(iv.length!==12||data.length<16)throw new Error('Invalid encrypted record');
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(userId,id),tagLength:128},await key(id),data);
    return {state:JSON.parse(decoder.decode(plain)),rewrite:id!==config.active};
   }
   // Only pre-encryption JSON objects qualify for migration. An unknown or
   // damaged encrypted envelope must never be treated as a plaintext fallback.
   if(!payload.startsWith('{'))throw new Error('Unsupported notebook record');
   const state=JSON.parse(payload);
   if(!state||Array.isArray(state)||typeof state!=='object')throw new Error('Invalid legacy notebook');
   return {state,rewrite:true};
  }
 };
}

export async function readNotebook(env,userId){
 const cipher=notebookCipher(env),row=await env.DB.prepare('SELECT payload,revision FROM jibro_member_notebooks WHERE user_id = ?').bind(userId).first();
 if(!row)return {state:null,revision:0};
 const {state,rewrite}=await cipher.open(userId,row.payload);
 if(rewrite){
  const encrypted=await cipher.seal(userId,state);
  // Encryption changes representation only. Preserve the user's revision and
  // timestamp, and never overwrite a concurrent edit.
  await env.DB.prepare('UPDATE jibro_member_notebooks SET payload = ? WHERE user_id = ? AND revision = ? AND payload = ?').bind(encrypted,userId,row.revision,row.payload).run();
 }
 return {state,revision:row.revision};
}

// A bounded server maintenance pass when a member opens their account. No
// maintenance endpoint, exported data, or client-supplied owner IDs are involved.
export async function migrateLegacyNotebooks(env){
 const cipher=notebookCipher(env);
 const {results}=await env.DB.prepare("SELECT user_id,payload,revision FROM jibro_member_notebooks WHERE substr(payload,1,1) = '{' ORDER BY user_id LIMIT 25").all();
 let migrated=0,failed=0;
 for(const row of results){
  try{
   const {state}=await cipher.open(row.user_id,row.payload),encrypted=await cipher.seal(row.user_id,state);
   const result=await env.DB.prepare('UPDATE jibro_member_notebooks SET payload = ? WHERE user_id = ? AND revision = ? AND payload = ?').bind(encrypted,row.user_id,row.revision,row.payload).run();
   migrated+=result.meta.changes;
  }catch{failed++;}
 }
 return {scanned:results.length,migrated,failed};
}
